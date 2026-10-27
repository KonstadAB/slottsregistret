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
    required: ['vad', 'meddelande'],
    fields: ['slott', 'vilket', 'vad', 'lank', 'meddelande', 'epost', 'kom'],
    castle: true,
  },
};
const LABELS = {
  slott: 'Slott', vill: 'Gäller', vad: 'Gäller', lank: 'Länk', namn: 'Namn', roll: 'Roll', epost: 'E-post', telefon: 'Telefon', meddelande: 'Meddelande',
};
// Tipsformulärets meddelande måste ha minst så här många tecken (samma som minlength i formuläret).
const MIN_MESSAGE = 10;
// Felmeddelanden på svenska (visas på sidan av form.js, eller som text om JavaScript saknas).
const ERRORS = {
  required: 'Fyll i de obligatoriska fälten och försök igen.',
  short: `Skriv ett meddelande på minst ${MIN_MESSAGE} tecken, så att vi förstår vad tipset gäller.`,
  email: 'Kontrollera e-postadressen och försök igen.',
  limit: 'Du har skickat flera gånger på kort tid. Vänta en minut och försök igen.',
};
const SLUG = /^[a-z0-9-]{1,80}$/;
// Tacksidorna som formulären får skicka vidare till (svenska och de andra språken).
const THANKS = /^\/tack\/$/;
const TWO_YEARS = 2 * 365 * 86400;
const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i;

export async function handleForm(request, env, ctx) {
  const url = new URL(request.url);
  const json = (request.headers.get('accept') || '').includes('application/json');
  const fail = (status, error) => json
    ? Response.json({ success: false, error, message: ERRORS[error] }, { status })
    : new Response(`Det gick inte att skicka formuläret. ${ERRORS[error] || 'Gå tillbaka och försök igen.'}`, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
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
  if (form.required.some(k => !entry[k] && k !== 'meddelande')) return fail(400, 'required');
  if (form.required.includes('meddelande') && (entry.meddelande || '').length < MIN_MESSAGE) return fail(400, 'short');
  if (entry.epost && !EMAIL.test(entry.epost)) return fail(400, 'email');
  if (!env.FORMS) return fail(503, 'storage');

  if (form.castle) {
    // Sidan formuläret skickades från (t.ex. /tipsa/?slott=svaneholms-slott) och sidan besökaren kom från innan dess
    // (fyllt i av form.js). Bara adresser på den egna sajten tas med.
    const ref = sameSite(request.headers.get('referer'), url);
    if (ref) entry.sida = ref.href;
    const kom = sameSite(entry.kom, url);
    if (kom && kom.href !== entry.sida) entry.kom = kom.href; else delete entry.kom;
    // Slottet: valt i listan, eller ?slott=… i adressen till formuläret (om JavaScript saknas). Namnet hämtas ur sajtens data.
    const slug = SLUG.test(entry.slott || '') && entry.slott !== 'annat' ? entry.slott : ref && SLUG.test(ref.searchParams.get('slott') || '') && ref.searchParams.get('slott') !== 'annat' ? ref.searchParams.get('slott') : '';
    delete entry.slott;
    if (slug) {
      const names = await castleNames(env, url);
      entry.slott = names.get(slug) || slug;
      entry.slottid = slug;
      entry.slottlank = `${url.origin}/slott/${slug}/`;
    }
  }

  const at = new Date().toISOString();
  const record = { formular: name, at, ...entry };
  await env.FORMS.put(`${name}:${at}:${crypto.randomUUID().slice(0, 8)}`, JSON.stringify(record), {
    expirationTtl: TWO_YEARS,
    metadata: { slott: (entry.slott || '').slice(0, 80), vad: (entry.vad || entry.vill || '').slice(0, 80) },
  });
  if (env.MAIL && env.MAIL_TO) ctx.waitUntil(notify(env, form, record).catch(e => console.log('E-posten gick inte iväg:', e.message)));
  return done();
}

// Slottens namn efter id, ur sajtens egen sökdata (dist/data/slott.json). Läses en gång per Worker-instans.
let names;
async function castleNames(env, url) {
  if (names) return names;
  try {
    const r = await env.ASSETS.fetch(new Request(`${url.origin}/data/slott.json`));
    if (!r.ok) throw new Error(r.status);
    names = new Map((await r.json()).castles.map(c => [c[1], c[0]]));
    return names;
  } catch (e) {
    console.log('Slottens namn gick inte att läsa:', e.message);
    return new Map();
  }
}

function sameSite(s, url) {
  try {
    const u = new URL(s || '');
    return u.host === url.host && u.href.length <= 500 ? u : null;
  } catch { return null; }
}

export function message(form, r) {
  if (!form.castle) {
    return {
      subject: `${form.subject}${r.slott ? ` – ${r.slott}` : ''}${r.vill || r.vad ? ` (${(r.vill || r.vad).slice(0, 60)})` : ''}`,
      text: Object.keys(LABELS).filter(k => r[k]).map(k => `${LABELS[k]}: ${r[k]}`).join('\n') +
        `\n\nSkickat ${r.at} via slottsregistret.se.${r.epost ? ' Svara på det här mejlet för att svara avsändaren.' : ''}\n`,
    };
  }
  // Tips: ämnet säger vad det gäller och vilket slott, texten har länk till slottets sida och varifrån tipset kom.
  const castle = r.slott || (r.vilket ? `${r.vilket} (ifyllt för hand)` : '');
  const subject = `${form.subject}${r.vad ? ` (${r.vad.slice(0, 60)})` : ''}${castle ? ` – ${castle.slice(0, 80)}` : ''}`;
  const lines = [
    `Gäller: ${r.vad}`,
    r.slott ? `Slott: ${r.slott} (id: ${r.slottid})` : `Slott: ${r.vilket ? `${r.vilket} (ifyllt för hand, finns inte i listan)` : 'inget särskilt slott angivet'}`,
    r.slottlank && `Slottets sida: ${r.slottlank}`,
    r.lank && `Länk: ${r.lank}`,
    '', 'Meddelande:', r.meddelande, '',
    `E-post: ${r.epost || 'ingen angiven'}`,
    r.sida && `Skickat från: ${r.sida}`,
    r.kom && `Kom dit från: ${r.kom}`,
  ].filter(x => x != null && x !== false);
  return {
    subject,
    text: `${lines.join('\n')}\n\nSkickat ${r.at} via slottsregistret.se.${r.epost ? ' Svara på det här mejlet för att svara avsändaren.' : ''}\n`,
  };
}

async function notify(env, form, r) {
  const { subject, text } = message(form, r);
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
