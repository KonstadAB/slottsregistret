#!/usr/bin/env node
// Cloudflare-kontot för slottsregistret.se, via Cloudflares API. Körs av .github/workflows/cloudflare.yml
// (arbetsmiljön når inte Cloudflare). Nyckeln läses från CLOUDFLARE_API_TOKEN.
//
//   node tools/cloudflare.mjs status                      -> zonen, DNS, DNSSEC, Workern, byggen, Pages, e-post
//   node tools/cloudflare.mjs builds                      -> Workers Builds för slottsregistret, med logg för det senaste
//   node tools/cloudflare.mjs "api GET /zones/{zone}/dns_records"
//   node tools/cloudflare.mjs "api POST /zones/{zone}/dns_records {\"type\":\"TXT\",...}"
//   node tools/cloudflare.mjs "dns-set TXT _dmarc.slottsregistret.se v=DMARC1; p=reject"
//                                                         -> skapar eller ersätter posten (TXT: den som börjar likadant)
//   node tools/cloudflare.mjs formular                    -> de senaste inlämningarna i formulären (datum, slott, vad)
//   node tools/cloudflare.mjs "formular-visa anmalan:2026-..."  -> hela inlämningen (innehåller personuppgifter)
//   Flera kommandon i samma körning skiljs med " ;; ".
//
// I api-anrop byts {zone} och {account} mot zonens och kontots id.
const ACCOUNT = '36f39bea33a1d0e03815a8b01039efea';
const ZONE_NAME = 'slottsregistret.se';
const WORKER = 'slottsregistret';
const FORMS_KV = process.env.FORMS_KV || ''; // KV-namnrymden för formulären (se wrangler.jsonc)
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
if (!TOKEN) { console.error('CLOUDFLARE_API_TOKEN saknas'); process.exit(1); }

async function cf(method, path, body) {
  const r = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 4000) }; }
  if (!r.ok || json.success === false) console.log(`!! ${method} ${path} -> ${r.status} ${JSON.stringify(json.errors || json.raw || json).slice(0, 600)}`);
  return json;
}
let zoneId;
const zone = async () => zoneId || (zoneId = ((await cf('GET', `/zones?name=${ZONE_NAME}`)).result || [])[0]?.id);
const fill = async p => p.replaceAll('{account}', ACCOUNT).replaceAll('{zone}', p.includes('{zone}') ? await zone() : '');
const line = s => console.log(s);

async function status() {
  const v = await cf('GET', '/user/tokens/verify'); line(`== Nyckel: ${v.result?.status || '?'}`);
  const z = ((await cf('GET', `/zones?name=${ZONE_NAME}`)).result || [])[0];
  if (z) { zoneId = z.id; line(`== Zon ${z.name}: ${z.status}, plan ${z.plan?.name}, namnservrar ${z.name_servers?.join(' ')}`); }
  const dns = (await cf('GET', `/zones/${zoneId}/dns_records?per_page=100`)).result || [];
  line('== DNS'); for (const r of dns) line(`  ${r.type.padEnd(6)} ${r.name.padEnd(28)} ${String(r.content).slice(0, 90)} ${r.proxied ? '(proxad)' : ''} ${r.meta?.read_only ? '(Cloudflare)' : ''}`);
  const sec = (await cf('GET', `/zones/${zoneId}/dnssec`)).result; line(`== DNSSEC: ${sec?.status}`);
  const er = (await cf('GET', `/zones/${zoneId}/email/routing`)).result; line(`== Email Routing: ${er ? `${er.enabled ? 'på' : 'av'} (${er.status})` : '?'}`);
  const scripts = (await cf('GET', `/accounts/${ACCOUNT}/workers/scripts`)).result || [];
  line(`== Workers: ${scripts.map(s => s.id).join(', ')}`);
  const dom = (await cf('GET', `/accounts/${ACCOUNT}/workers/domains`)).result || [];
  line(`== Egna domäner: ${dom.map(d => `${d.hostname} -> ${d.service} (${d.environment})`).join(', ')}`);
  const dep = (await cf('GET', `/accounts/${ACCOUNT}/workers/scripts/${WORKER}/deployments`)).result;
  const d0 = dep?.deployments?.[0]; if (d0) line(`== Senaste publicering av Workern: ${d0.created_on} ${d0.source} versioner ${d0.versions.map(x => x.version_id.slice(0, 8)).join(',')} ${d0.annotations?.['workers/message'] || ''}`);
  const ver = (await cf('GET', `/accounts/${ACCOUNT}/workers/scripts/${WORKER}/versions?page=1&per_page=5`)).result;
  for (const x of ver?.items || []) line(`  version ${x.id.slice(0, 8)} ${x.metadata?.created_on} ${x.metadata?.source} ${x.annotations?.['workers/message'] || ''} ${x.annotations?.['workers/triggered_by'] || ''}`);
  const pages = (await cf('GET', `/accounts/${ACCOUNT}/pages/projects`)).result || [];
  line(`== Pages-projekt: ${pages.map(p => `${p.name} (${p.domains?.join(' ')})`).join(', ') || 'inga'}`);
  await builds();
}

async function builds() {
  const scripts = (await cf('GET', `/accounts/${ACCOUNT}/workers/scripts`)).result || [];
  const tag = scripts.find(s => s.id === WORKER)?.tag;
  const b = await cf('GET', `/accounts/${ACCOUNT}/builds/workers/${tag}/builds?per_page=5`);
  const list = b.result || [];
  line(`== Workers Builds (${list.length})`);
  for (const x of list) line(`  ${x.created_on} ${x.status} ${x.build_outcome || ''} ${x.build_trigger_metadata?.commit_hash?.slice(0, 7) || ''} ${x.build_trigger_metadata?.commit_message?.split('\n')[0] || ''} ${x.build_uuid}`);
  const last = list[0];
  if (last) {
    const logs = await cf('GET', `/accounts/${ACCOUNT}/builds/builds/${last.build_uuid}/logs`);
    const lines = (logs.result?.lines || []).map(l => (Array.isArray(l) ? l[1] : l.message || JSON.stringify(l)));
    line(`== Logg för senaste bygget (${lines.length} rader, de sista 40):`);
    for (const l of lines.slice(-40)) line(`  ${l}`);
  }
}

// Formulärens inlämningar (nycklar formular:tid:slump). Listan visar bara datum, slott och vad det gäller,
// så att personuppgifter inte hamnar i loggen i onödan; formular-visa visar en hel inlämning.
async function formular() {
  const keys = [];
  for (let cursor = ''; ;) {
    const r = await cf('GET', `/accounts/${ACCOUNT}/storage/kv/namespaces/${FORMS_KV}/keys?limit=1000${cursor ? `&cursor=${cursor}` : ''}`);
    keys.push(...(r.result || [])); cursor = r.result_info?.cursor; if (!cursor) break;
  }
  keys.sort((a, b) => a.name.split(':').slice(1).join(':').localeCompare(b.name.split(':').slice(1).join(':')));
  line(`== Inlämningar: ${keys.length} (de senaste 50)`);
  for (const k of keys.slice(-50)) line(`  ${k.name}  ${k.metadata?.slott || ''}  ${k.metadata?.vad || ''}`);
}
async function formularVisa(key) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/storage/kv/namespaces/${FORMS_KV}/values/${encodeURIComponent(key)}`, { headers: { authorization: `Bearer ${TOKEN}` } });
  line(r.ok ? JSON.stringify(JSON.parse(await r.text()), null, 1) : `!! ${r.status} ${key}`);
}

// Skapar eller ersätter en DNS-post. För TXT ersätts den post som börjar med samma ord (t.ex. v=spf1), så att andra
// TXT-poster på samma namn får vara kvar.
async function dnsSet(type, name, content) {
  const z = await zone();
  if (type === 'TXT' && !content.startsWith('"')) content = `"${content}"`;
  const bare = c => String(c).replace(/^"|"$/g, '');
  const existing = ((await cf('GET', `/zones/${z}/dns_records?type=${type}&name=${encodeURIComponent(name)}`)).result || [])
    .find(r => type !== 'TXT' || bare(r.content).split(/[\s;]/)[0] === bare(content).split(/[\s;]/)[0]);
  const body = { type, name, content, ttl: 1 };
  const res = existing ? await cf('PATCH', `/zones/${z}/dns_records/${existing.id}`, body) : await cf('POST', `/zones/${z}/dns_records`, body);
  line(`${existing ? 'Ändrad' : 'Skapad'}: ${type} ${name} ${res.result?.content ?? '(misslyckades)'}${existing ? ` (förut ${existing.content})` : ''}`);
}

for (const cmd of (process.argv[2] || 'status').split(' ;; ').map(c => c.trim()).filter(Boolean)) {
  line(`>> ${cmd}`);
  if (cmd === 'status') await status();
  else if (cmd === 'builds') await builds();
  else if (cmd === 'formular') await formular();
  else if (cmd.startsWith('formular-visa ')) await formularVisa(cmd.slice('formular-visa '.length).trim());
  else if (cmd.startsWith('dns-set ')) {
    const [, type, name, ...rest] = cmd.split(' ');
    await dnsSet(type, name, rest.join(' '));
  } else if (cmd.startsWith('api ')) {
    const [, method, path, ...rest] = cmd.split(' ');
    const res = await cf(method, await fill(path), rest.length ? rest.join(' ') : undefined);
    line(JSON.stringify(res.result ?? res, null, 1).slice(0, 20000));
  } else line(`Okänt kommando: ${cmd}`);
}
