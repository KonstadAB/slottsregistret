#!/usr/bin/env node
// Hämtar öppna data som arbetsmiljön inte når (Wikidata, Wikipedia, Commons, slottens egna webbplatser).
// Körs i GitHub Actions (.github/workflows/hamta.yml) när data/source/bestallning.json ändras på en claude/-gren.
// Svaret läggs ihop med data/source/svar.json. Varje del fångar sina egna fel, så att ett fel aldrig stoppar
// resten; felen skrivs till data/source/hamta-logg.txt, som sparas på grenen tillsammans med svaret.
//
// Beställning (alla delar valfria):
//   sparql:     [{ key, query }]    -> rader från Wikidatas frågetjänst (förenklade: { variabel: värde })
//   wdSearch:   [{ id, q }]         -> de sju bästa träffarna på Wikidata, och för varje träff posten (se entities)
//   entities:   ["Q123", ...]       -> etikett, beskrivning, koordinater, bild, webbplats, typer, kommun, byggår,
//                                      Commons-kategori och svensk Wikipedia-artikel
//   wikiTitles: [...]               -> inledningen av artiklar på svenska Wikipedia (artiklar från entities tas med)
//   commonsFiles: [...]             -> storlek, fotograf och licens (bilder från entities tas med)
//   textPages:  [...]               -> sidans titel, text, inbäddade ramar och länkar
//   jsonUrls:   [{ url, body? }]    -> svaret som JSON eller text
import fs from 'node:fs';

const REQ = 'data/source/bestallning.json', OUT = 'data/source/svar.json', LOG = 'data/source/hamta-logg.txt';
const UA = 'slottsregistret.se-datahamtning/1.0 (https://slottsregistret.se; kontakt@slottsregistret.se)';
const req = JSON.parse(fs.readFileSync(REQ, 'utf8'));
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
for (const k of ['sparql', 'wdsearch', 'entities', 'wiki', 'commons', 'pages', 'json']) out[k] = out[k] || {};
out.fetched = new Date().toISOString();
const log = [];
const note = (...a) => { const s = a.join(' '); log.push(s); console.log(s); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const save = () => { fs.writeFileSync(OUT, JSON.stringify(out)); fs.writeFileSync(LOG, log.join('\n') + '\n'); };

async function get(url, opts = {}, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { ...opts, headers: { 'User-Agent': UA, Accept: 'application/json', ...(opts.headers || {}) }, signal: AbortSignal.timeout(60000) });
      if (r.ok) return await r.json();
      if (i >= tries || ![429, 500, 502, 503, 504].includes(r.status)) throw new Error(`HTTP ${r.status} ${url.slice(0, 140)}`);
    } catch (e) { if (i >= tries) throw e; }
    await sleep(2500 * i);
  }
}
const step = async (name, fn) => { try { await fn(); } catch (e) { note('FEL i', name + ':', String(e && e.stack || e).slice(0, 400)); } save(); };

await step('sparql', async () => {
  for (const s of req.sparql || []) {
    try {
      const j = await get('https://query.wikidata.org/sparql?format=json', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'query=' + encodeURIComponent(s.query) });
      out.sparql[s.key] = j.results.bindings.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
      note('SPARQL', s.key, out.sparql[s.key].length, 'rader');
    } catch (e) { note('FEL SPARQL', s.key, String(e).slice(0, 200)); }
  }
});

const qids = new Set(req.entities || []);
await step('wdSearch', async () => {
  for (const s of req.wdSearch || []) {
    try {
      const j = await get('https://www.wikidata.org/w/api.php?action=wbsearchentities&language=sv&uselang=sv&type=item&limit=7&format=json&search=' + encodeURIComponent(s.q));
      out.wdsearch[s.id] = (j.search || []).map(x => ({ qid: x.id, label: x.label || '', description: x.description || '' }));
      for (const x of out.wdsearch[s.id]) qids.add(x.qid);
    } catch (e) { note('FEL sökning', s.id, s.q, String(e).slice(0, 160)); }
    await sleep(150);
  }
  note('Wikidata-sökningar', (req.wdSearch || []).length);
});

const titles = new Set(req.wikiTitles || []), files = new Set(req.commonsFiles || []);
await step('entities', async () => {
  const todo = [...qids].filter(q => !out.entities[q]);
  const admin = new Set();
  for (let i = 0; i < todo.length; i += 50) {
    try {
      const j = await get('https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels|descriptions|aliases|claims|sitelinks&languages=sv|en&sitefilter=svwiki&format=json&ids=' + todo.slice(i, i + 50).join('|'));
      for (const [qid, e] of Object.entries(j.entities || {})) {
        const claim = p => (e.claims && e.claims[p] || []).map(c => c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value).filter(v => v != null);
        const coord = claim('P625')[0], inc = claim('P571')[0];
        const lab = o => o && (o.sv || o.en) ? (o.sv || o.en).value : '';
        const ent = {
          qid, label: lab(e.labels), description: lab(e.descriptions), alts: (e.aliases && e.aliases.sv || []).map(a => a.value),
          lat: coord ? coord.latitude : null, lon: coord ? coord.longitude : null,
          image: claim('P18')[0] || null, website: claim('P856')[0] || null, commonsCat: claim('P373')[0] || null,
          types: claim('P31').map(v => v.id), admin: claim('P131').map(v => v.id), heritage: claim('P1435').map(v => v.id),
          inception: inc && inc.time ? inc.time.replace(/^\+/, '').slice(0, 4) : null, bbr: claim('P1260')[0] || null,
          article: e.sitelinks && e.sitelinks.svwiki ? e.sitelinks.svwiki.title : null,
        };
        out.entities[qid] = ent;
        ent.admin.forEach(a => admin.add(a));
      }
    } catch (e) { note('FEL poster', i, String(e).slice(0, 200)); }
    await sleep(300);
  }
  // Namn på kommuner och andra områden som posterna ligger i, och på typerna.
  out.labels = out.labels || {};
  const more = [...new Set([...admin, ...Object.values(out.entities).flatMap(e => e.types)])].filter(q => !out.labels[q]);
  for (let i = 0; i < more.length; i += 50) {
    try {
      const j = await get('https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels&languages=sv|en&format=json&ids=' + more.slice(i, i + 50).join('|'));
      for (const [q, e] of Object.entries(j.entities || {})) out.labels[q] = e.labels && (e.labels.sv || e.labels.en) ? (e.labels.sv || e.labels.en).value : '';
    } catch (e) { note('FEL etiketter', String(e).slice(0, 160)); }
  }
  for (const e of Object.values(out.entities)) { if (e.article) titles.add(e.article); if (e.image) files.add(e.image); }
  note('Wikidata-poster', Object.keys(out.entities).length);
});

await step('wiki', async () => {
  const list = [...titles].filter(t => !out.wiki[t]);
  for (let i = 0; i < list.length; i += 20) {
    const batch = list.slice(i, i + 20);
    try {
      const j = await get('https://sv.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&exlimit=20&redirects=1&format=json&titles=' + encodeURIComponent(batch.join('|')));
      const alias = {};
      for (const n of [...(j.query.normalized || []), ...(j.query.redirects || [])]) alias[n.to] = n.from;
      for (const p of Object.values(j.query.pages || {})) {
        if (p.missing !== undefined || !p.extract) continue;
        let from = p.title; while (alias[from]) from = alias[from];
        out.wiki[from] = { title: p.title, text: p.extract };
      }
    } catch (e) { note('FEL Wikipedia', batch[0], String(e).slice(0, 160)); }
  }
  note('Wikipedia-texter', Object.keys(out.wiki).length);
});

await step('commons', async () => {
  const list = [...files].filter(f => !out.commons[f]);
  for (let i = 0; i < list.length; i += 20) {
    const batch = list.slice(i, i + 20).map(f => 'File:' + f);
    try {
      const j = await get('https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=size|extmetadata|url&format=json&titles=' + encodeURIComponent(batch.join('|')));
      const alias = {};
      for (const n of j.query.normalized || []) alias[n.to] = n.from;
      for (const p of Object.values(j.query.pages || {})) {
        const ii = p.imageinfo && p.imageinfo[0]; if (!ii) continue;
        const md = ii.extmetadata || {}, val = k => (md[k] ? String(md[k].value) : '');
        const from = (alias[p.title] || p.title).replace(/^File:/, '');
        out.commons[from] = { title: p.title, w: ii.width, h: ii.height, url: ii.url, page: ii.descriptionurl,
          artist: val('Artist').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120), license: val('LicenseShortName') };
      }
    } catch (e) { note('FEL Commons', batch[0], String(e).slice(0, 160)); }
  }
  note('Commons-bilder', Object.keys(out.commons).length);
});

const HTML_UA = 'Mozilla/5.0 (compatible; slottsregistret.se/1.0; +https://slottsregistret.se)';
await step('textPages', async () => {
  const queue = [...new Set(req.textPages || [])];
  async function worker() {
    for (let u; (u = queue.shift());) {
      try {
        const r = await fetch(u, { headers: { 'User-Agent': HTML_UA, Accept: 'text/html,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
        const html = (r.headers.get('content-type') || '').includes('html') ? await r.text() : '';
        const base = r.url || u, abs = h => { try { return new URL(h.replace(/&amp;/g, '&'), base).href; } catch { return null; } };
        const title = ((html.match(/<title[^>]*>([^<]*)/i) || [])[1] || '').trim();
        const text = html.replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|li|h[1-6]|div)>/gi, '\n')
          .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
        const frames = [...new Set([...html.matchAll(/<iframe\b[^>]*?\s(?:data-)?src=["']([^"']+)/gi)].map(m => abs(m[1])).filter(Boolean))];
        const links = [...html.matchAll(/<a\b[^>]*?\shref=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)]
          .map(m => [abs(m[1]), m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)]).filter(l => l[0]).slice(0, 400);
        out.pages[u] = { status: r.status, final: r.url, title, text: text.slice(0, 20000), frames, links };
      } catch (e) { out.pages[u] = { status: 0, error: String(e.cause && (e.cause.code || e.cause.message) || e.name || e).slice(0, 160) }; }
      await sleep(200);
    }
  }
  await Promise.all([1, 2, 3, 4, 5, 6].map(worker));
  note('Sidor lästa', (req.textPages || []).length);
});

await step('jsonUrls', async () => {
  for (const j of req.jsonUrls || []) {
    const key = j.body ? `${j.url} ${JSON.stringify(j.body)}` : j.url;
    try {
      const r = await fetch(j.url, { method: j.body ? 'POST' : 'GET', headers: { 'User-Agent': UA, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: j.body ? JSON.stringify(j.body) : undefined, signal: AbortSignal.timeout(30000) });
      const t = await r.text();
      let data; try { data = JSON.parse(t.replace(/^﻿/, '')); } catch { data = t.slice(0, 150000); }
      out.json[key] = { status: r.status, data };
    } catch (e) { out.json[key] = { status: 0, error: String(e).slice(0, 160) }; }
    await sleep(300);
  }
});

note('Klart', new Date().toISOString());
save();
