// Formulären (från slott och tips från besökare) tas emot här, på sajtens egen adress /api/skicka.
// Varje inlämning sparas i KV (bindningen FORMS) i högst två år och skickas som e-post till Daniel via Cloudflare
// Email Routing (bindningen MAIL, mottagaren i hemligheten MAIL_TO). Saknas e-posten sparas inlämningen ändå.
// Läs inlämningarna med `node tools/cloudflare.mjs formular` (via .github/workflows/cloudflare.yml).
import { EmailMessage } from 'cloudflare:email';

const FORMS = {
  slott: {
    subject: 'Från slott',
    required: ['slott', 'namn', 'epost'],
    fields: ['slott', 'vill', 'lank', 'namn', 'roll', 'epost', 'telefon', 'meddelande'],
  },
  tips: {
    subject: 'Tips från besökare',
    required: ['vad'],
    fields: ['slott', 'vad', 'lank', 'meddelande', 'epost'],
  },
};
const LABELS = {
  slott: 'Slott', vill: 'Gäller', vad: 'Gäller', lank: 'Länk', namn: 'Namn', roll: 'Roll', epost: 'E-post', telefon: 'Telefon', meddelande: 'Meddelande',
};
// Tacksidorna som formulären får skicka vidare till (svenska och de andra språken).
const THANKS = /^\/tack\/$/;
const TWO_YEARS = 2 * 365 * 86400;
const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i;

export async function handleForm(request, env, ctx) {
  const url = new URL(request.url);
  const json = (request.headers.get('accept') || '').includes('application/json');
  const fail = (status, error) => json
    ? Response.json({ success: false, error }, { status })
    : new Response('Det gick inte att skicka formuläret. Gå tillbaka och försök igen.', { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  if (request.method !== 'POST') return fail(405, 'method');
  const origin = request.headers.get('origin');
  if (origin && origin !== 'null' && new URL(origin).host !== url.host) return fail(403, 'origin');
  if (+(request.headers.get('content-length') || 0) > 20000) return fail(413, 'size');
  // Högst fem inlämningar i minuten från samma adress.
  if (env.FORM_LIMIT) {
    const { success } = await env.FORM_LIMIT.limit({ key: request.headers.get('cf-connecting-ip') || 'okänd' });
    if (!success) return fail(429, 'limit');
  }
  let data;
  try { data = await request.formData(); } catch { return fail(400, 'data'); }
  const name = String(data.get('formular') || ''), form = Object.hasOwn(FORMS, name) && FORMS[name];
  if (!form) return fail(400, 'form');
  const thanks = THANKS.test(String(data.get('tack') || '')) ? String(data.get('tack')) : '/tack/';
  const done = () => json ? Response.json({ success: true }) : Response.redirect(url.origin + thanks, 303);
  // Fällan: ett dolt fält som bara robotar fyller i. De får samma svar som alla andra, men inget sparas.
  if (String(data.get('webbplats') || '').trim()) return done();

  const entry = {};
  for (const k of form.fields) {
    const v = data.getAll(k).map(String).join(', ').replace(/\r\n?/g, '\n').trim().slice(0, k === 'meddelande' ? 5000 : 500);
    if (v) entry[k] = v;
  }
  if (form.required.some(k => !entry[k])) return fail(400, 'required');
  if (entry.epost && !EMAIL.test(entry.epost)) return fail(400, 'email');
  if (!env.FORMS) return fail(503, 'storage');

  const at = new Date().toISOString();
  const record = { formular: name, at, ...entry };
  await env.FORMS.put(`${name}:${at}:${crypto.randomUUID().slice(0, 8)}`, JSON.stringify(record), {
    expirationTtl: TWO_YEARS,
    metadata: { slott: (entry.slott || '').slice(0, 80), vad: (entry.vad || entry.vill || '').slice(0, 80) },
  });
  if (env.MAIL && env.MAIL_TO) ctx.waitUntil(notify(env, form, record).catch(e => console.log('E-posten gick inte iväg:', e.message)));
  return done();
}

async function notify(env, form, r) {
  const subject = `${form.subject}${r.slott ? ` – ${r.slott}` : ''}${r.vill || r.vad ? ` (${(r.vill || r.vad).slice(0, 60)})` : ''}`;
  const text = Object.keys(LABELS).filter(k => r[k]).map(k => `${LABELS[k]}: ${r[k]}`).join('\n') +
    `\n\nSkickat ${r.at} via slottsregistret.se.${r.epost ? ' Svara på det här mejlet för att svara avsändaren.' : ''}\n`;
  const from = 'formular@slottsregistret.se';
  const raw = mime({ from: `Slottsregistret.se <${from}>`, to: env.MAIL_TO, replyTo: r.epost, subject, text });
  await env.MAIL.send(new EmailMessage(from, env.MAIL_TO, raw));
}

function b64(s) {
  let bin = '';
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin);
}

// Ett enkelt textmejl. Ämnet och texten kodas (UTF-8, base64), så att inget i formuläret kan bli en egen rubrikrad.
export function mime({ from, to, replyTo, subject, text }) {
  const head = [
    `From: ${from}`, `To: ${to}`, `Subject: =?UTF-8?B?${b64(subject)}?=`, `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@slottsregistret.se>`, 'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64',
  ];
  if (replyTo && EMAIL.test(replyTo)) head.push(`Reply-To: ${replyTo}`);
  return `${head.join('\r\n')}\r\n\r\n${b64(text).replace(/.{76}/g, '$&\r\n')}\r\n`;
}
