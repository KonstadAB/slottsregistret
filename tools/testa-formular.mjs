// Provkör formulärhanteringen (worker/forms.js) lokalt utan Cloudflare: node tools/testa-formular.mjs
// Kräver att dist/ är byggd (node build.js), eftersom slottens namn läses ur dist/data/slott.json.
import { register } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// 'cloudflare:email' finns bara hos Cloudflare; här ersätts den med en enkel klass.
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(s, c, next) { return s === 'cloudflare:email' ? { url: 'data:text/javascript,export class EmailMessage { constructor(from, to, raw) { Object.assign(this, { from, to, raw }); } }', shortCircuit: true } : next(s, c); }
`));
const { handleForm } = await import('../worker/forms.js');

const ORIGIN = 'https://slottsregistret.se';
const data = fs.readFileSync(new URL('../dist/data/slott.json', import.meta.url));
function env() {
  const kv = [], mail = [];
  return {
    kv, mail, MAIL_TO: 'mottagare@example.com',
    FORMS: { put: async (k, v) => kv.push([k, JSON.parse(v)]) },
    MAIL: { send: async m => mail.push(m) },
    ASSETS: { fetch: async r => new URL(r.url).pathname === '/data/slott.json' ? new Response(data) : new Response('', { status: 404 }) },
  };
}
async function send(fields, { referer, json = true } = {}) {
  const e = env(), waits = [];
  const body = new FormData();
  for (const [k, v] of Object.entries({ formular: 'tips', tack: '/tack/', ...fields })) body.append(k, v);
  const headers = { origin: ORIGIN };
  if (json) headers.accept = 'application/json';
  if (referer) headers.referer = referer;
  const res = await handleForm(new Request(`${ORIGIN}/api/skicka`, { method: 'POST', body, headers }), e, { waitUntil: p => waits.push(p) });
  await Promise.all(waits);
  return { res, e };
}
function decode(raw) {
  const [head, body] = raw.split('\r\n\r\n');
  const subject = Buffer.from(head.match(/^Subject: =\?UTF-8\?B\?(.+)\?=$/m)[1], 'base64').toString();
  return { head, subject, text: Buffer.from(body.replace(/\s/g, ''), 'base64').toString() };
}
let n = 0;
async function test(name, fn) { await fn(); n++; console.log('ok', name); }

await test('tomt meddelande avvisas, inget sparas eller mejlas', async () => {
  const { res, e } = await send({ vad: 'En rundtur som saknas', meddelande: '' });
  assert.equal(res.status, 400);
  const j = await res.json();
  assert.equal(j.error, 'short');
  assert.match(j.message, /minst 10 tecken/);
  assert.equal(e.kv.length + e.mail.length, 0);
});

await test('för kort meddelande (bara mellanslag runt) avvisas', async () => {
  const { res, e } = await send({ vad: 'Annat', meddelande: '   kort   ' });
  assert.equal((await res.json()).error, 'short');
  assert.equal(e.mail.length, 0);
});

await test('utan JavaScript: felet visas som svensk text', async () => {
  const { res } = await send({ vad: 'Annat', meddelande: '' }, { json: false });
  assert.equal(res.status, 400);
  assert.match(await res.text(), /minst 10 tecken/);
});

await test('giltigt tips från slottssida: rätt ämne, länk, sida och e-post', async () => {
  const { res, e } = await send({
    slott: 'svaneholms-slott', vad: 'En rundtur som saknas', meddelande: 'Det finns en ny rundtur i källaren.',
    epost: 'besokare@example.com', kom: `${ORIGIN}/slott/svaneholms-slott/`,
  }, { referer: `${ORIGIN}/tipsa/?slott=svaneholms-slott` });
  assert.deepEqual(await res.json(), { success: true });
  assert.equal(e.kv.length, 1);
  const m = decode(e.mail[0].raw);
  assert.equal(m.subject, 'Tips från besökare (En rundtur som saknas) – Svaneholms slott');
  assert.match(m.text, /^Slott: Svaneholms slott \(id: svaneholms-slott\)$/m);
  assert.match(m.text, /^Slottets sida: https:\/\/slottsregistret\.se\/slott\/svaneholms-slott\/$/m);
  assert.match(m.text, /Det finns en ny rundtur i källaren\./);
  assert.match(m.text, /^E-post: besokare@example\.com$/m);
  assert.match(m.text, /^Skickat från: https:\/\/slottsregistret\.se\/tipsa\/\?slott=svaneholms-slott$/m);
  assert.match(m.text, /^Kom dit från: https:\/\/slottsregistret\.se\/slott\/svaneholms-slott\/$/m);
  assert.match(m.head, /^Reply-To: besokare@example\.com$/m);
  console.log('\n--- Ämne: ' + m.subject + '\n' + m.text + '---');
});

await test('utan JavaScript: slottet tas ur formulärsidans adress (Referer)', async () => {
  const { e } = await send({ vad: 'Fel uppgift', meddelande: 'Fel kommun står på sidan.' }, { referer: `${ORIGIN}/tipsa/?slott=malmohus` });
  assert.equal(decode(e.mail[0].raw).subject, 'Tips från besökare (Fel uppgift) – Malmöhus');
});

await test('slott ifyllt för hand, utan e-post', async () => {
  const { e } = await send({ slott: 'annat', vilket: 'Slottet i skogen', vad: 'Slott som saknas', meddelande: 'Det saknas ett slott i Småland.' });
  const m = decode(e.mail[0].raw);
  assert.equal(m.subject, 'Tips från besökare (Slott som saknas) – Slottet i skogen (ifyllt för hand)');
  assert.match(m.text, /^E-post: ingen angiven$/m);
  assert.doesNotMatch(m.text, /Slottets sida/);
  assert.doesNotMatch(m.head, /Reply-To/);
});

await test('adresser från andra sajter tas inte med', async () => {
  const { e } = await send({ vad: 'Annat', meddelande: 'Ett tips om något annat.', kom: 'https://example.com/spam' }, { referer: 'https://example.com/x?slott=malmohus' });
  const m = decode(e.mail[0].raw);
  assert.equal(m.subject, 'Tips från besökare (Annat)');
  assert.doesNotMatch(m.text, /example\.com|Skickat från|Kom dit/);
});

await test('fällan (honeypot): svaret är ok men inget sparas eller mejlas', async () => {
  const { res, e } = await send({ vad: 'Annat', meddelande: 'Köp billiga klockor här!', webbplats: 'http://spam.example' });
  assert.deepEqual(await res.json(), { success: true });
  assert.equal(e.kv.length + e.mail.length, 0);
});

await test('formuläret från slott fungerar som förut', async () => {
  const { e } = await send({ formular: 'slott', slott: 'malmohus', namn: 'Anna', epost: 'anna@example.com', vill: 'Uppdatera uppgifterna om slottet' });
  assert.equal(decode(e.mail[0].raw).subject, 'Från slott – malmohus (Uppdatera uppgifterna om slottet)');
});

console.log(`\nAlla ${n} prov gick igenom.`);
