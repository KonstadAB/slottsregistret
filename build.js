#!/usr/bin/env node
// Bygger hela sajten till dist/. Kör: node build.js  (Node 18+, inga paket behövs)
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const T = require('./src/templates');
const { haversine } = require('./src/lib');

const ROOT = __dirname, OUT = path.join(ROOT, 'dist');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/site-data.json'), 'utf8'));

const S = {
  config, data,
  catBySlug: new Map(data.categories.map(c => [c.slug, c])),
  countyBySlug: new Map(data.counties.map(c => [c.slug, c])),
};
{ const n = new Map(); for (const c of data.castles) n.set(c.name, (n.get(c.name) || 0) + 1); S.dupNames = new Set([...n].filter(x => x[1] > 1).map(x => x[0])); }
const located = data.castles.filter(c => c.lat != null);
// Närliggande slott: de med rundtur först (inom 60 km), sedan övriga.
S.nearby = (c, n) => {
  if (c.lat == null) return [];
  const near = located.filter(o => o.id !== c.id).map(o => [haversine(c, o), o]).filter(x => x[0] < 60);
  return near.sort((a, b) => (b[1].tours.length > 0) - (a[1].tours.length > 0) || a[0] - b[0]).slice(0, n).map(x => x[1]);
};
// Startsidans urval: slott med rundtur, helst inbäddningsbar, med bild och hög prioritet; högst två per län.
// Först de som visar slottet inifrån bäst (granskade för hand), sedan övriga.
const FEATURE_FIRST = ['granso-slott', 'drottningholms-slott', 'mauritzbergs-slott', 'bjarsjolagards-slott', 'trollenas-slott', 'osterbybruk-herrgard', 'kronovalls-slott', 'malmohus'];
S.featured = FEATURE_FIRST.map(id => data.castles.find(c => c.id === id)).filter(c => c && c.tours.length);
{
  const per = {};
  const cand = data.castles.filter(c => c.tours.length && c.image)
    .sort((a, b) => (!!b.tours[0].embed - !!a.tours[0].embed) || (b.tours[0].kind === 'walk') - (a.tours[0].kind === 'walk') || a.prio - b.prio);
  for (const c of cand) { if (S.featured.length >= 8) break; if (S.featured.includes(c)) continue; if ((per[c.lan] = (per[c.lan] || 0) + 1) > 2) continue; S.featured.push(c); }
}

// ---- Tillgångar (allt under /assets/ får en innehållshash i adressen och cachas ett år) ----
const A = path.join(ROOT, 'src/assets'), LV = path.join(ROOT, 'src/vendor/leaflet');
const assets = new Map(), hashes = new Map();
const addAsset = (url, from) => assets.set(url, fs.readFileSync(from));
for (const f of fs.readdirSync(A)) if (/\.(js|svg|jpg|png|avif)$/.test(f)) addAsset(`/assets/${/\.(svg|jpg|png|avif)$/.test(f) ? 'img/' : ''}${f}`, path.join(A, f));
// Startsidans film: bilderna i src/assets/hero (skapas av tools/hero.py), med namn och fotograf i src/hero.json.
S.hero = fs.existsSync(path.join(ROOT, 'src/hero.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'src/hero.json'), 'utf8')) : [];
if (fs.existsSync(path.join(A, 'hero'))) for (const f of fs.readdirSync(path.join(A, 'hero'))) addAsset(`/assets/hero/${f}`, path.join(A, 'hero', f));
for (const f of fs.readdirSync(path.join(ROOT, 'src/fonts'))) addAsset(`/assets/fonts/${f}`, path.join(ROOT, 'src/fonts', f));
addAsset('/assets/vendor/leaflet.js', path.join(LV, 'leaflet.js'));
addAsset('/assets/vendor/leaflet.css', path.join(LV, 'leaflet.css'));
addAsset('/assets/vendor/LEAFLET-LICENSE.txt', path.join(LV, 'LICENSE'));
S.asset = url => {
  if (!assets.has(url)) throw new Error(`Okänd fil under /assets/: ${url}`);
  if (!hashes.has(url)) hashes.set(url, crypto.createHash('sha256').update(assets.get(url)).digest('hex').slice(0, 10));
  return `${url}?v=${hashes.get(url)}`;
};
// Kartbilden på startsidan ritas av slottens lägen (södra Sverige), guld för slott med rundtur.
{
  const [la0, la1, lo0, lo1] = [55.15, 61.3, 10.9, 19.6], W = 560, H = 420, k = Math.cos(58 * Math.PI / 180);
  const sx = W / ((lo1 - lo0) * k), sy = H / (la1 - la0), s = Math.min(sx, sy), ox = (W - (lo1 - lo0) * k * s) / 2;
  const pts = located.filter(c => c.lat > la0 && c.lat < la1 && c.lon > lo0 && c.lon < lo1).sort((a, b) => a.tours.length - b.tours.length)
    .map(c => { const x = (ox + (c.lon - lo0) * k * s).toFixed(1), y = ((la1 - c.lat) * s).toFixed(1);
      return c.tours.length ? `<circle cx="${x}" cy="${y}" r="6" fill="#C9A24E" stroke="#1F3A31" stroke-width="1.5"/>` : `<circle cx="${x}" cy="${y}" r="3.6" fill="none" stroke="#9FB3A8" stroke-width="1.4"/>`; });
  assets.set('/assets/img/karta.svg', Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#1F3A31"/>${pts.join('')}</svg>`));
}
assets.set('/assets/style.css', Buffer.from(fs.readFileSync(path.join(A, 'style.css'), 'utf8').replace(/\/assets\/[\w./-]+\.(?:woff2|jpg|avif|png|svg)/g, S.asset)));

// ---- Skriv ----
fs.rmSync(OUT, { recursive: true, force: true });
const write = (rel, content) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };
const urls = [];
const page = (rel, html, loc, prio = 0.5) => { write(rel, html); if (loc) urls.push([loc, prio]); };

page('index.html', T.home(S), '/', 1.0);
page('karta/index.html', T.mapPage(S), '/karta/', 0.9);
page('virtuella-rundturer/index.html', T.tours(S), '/virtuella-rundturer/', 0.9);
page('lan/index.html', T.countiesIndex(S), '/lan/', 0.8);
for (const co of data.counties) page(`lan/${co.slug}/index.html`, T.county(S, co), T.countyURL(co), 0.8);
for (const cat of data.categories) {
  if (!cat.total) continue;
  page(`${cat.slug}/index.html`, T.category(S, cat), T.catURL(cat), 0.9);
  for (const co of data.counties) {
    const n = data.castles.filter(c => c.offers.includes(cat.slug) && c.lanSlug === co.slug).length;
    if (n) page(`${cat.slug}/${co.slug}/index.html`, T.category(S, cat, co), T.catURL(cat, co), n > 2 ? 0.7 : 0.5);
  }
}
for (const c of data.castles) page(`slott/${c.slug}/index.html`, T.castle(S, c), T.castleURL(c), c.tours.length ? 0.8 : 0.6);
page('om/index.html', T.about(S), '/om/', 0.5);
page('for-slott/index.html', T.forCastles(S), '/for-slott/', 0.6);
page('kontakt/index.html', T.contact(S), '/kontakt/', 0.3);
page('integritet/index.html', T.privacy(S), '/integritet/', 0.2);
write('tipsa/index.html', T.tip(S));
write('tack/index.html', T.thanks(S));
write('sok/index.html', T.searchPage(S));
write('404.html', T.notFound(S));

// ---- Data för sök och karta ----
const r5 = x => Math.round(x * 1e5) / 1e5;
const thumb = c => c.image ? c.image.path : '';
write('data/slott.json', JSON.stringify({
  cats: data.categories.map(c => [c.slug, c.name, c.short]),
  counties: data.counties.map(c => [c.slug, c.name]),
  // [namn, slug, kommun, länsslug, typ, kategorier, rundtur (0/1), lat, lon, bild, bredd]
  castles: data.castles.map(c => [c.name, c.slug, c.kommun, c.lanSlug, c.type, c.offers.join(' '), c.tours.length ? 1 : 0,
    c.lat != null ? r5(c.lat) : null, c.lon != null ? r5(c.lon) : null, thumb(c), c.image && c.image.w || 0]),
}));
for (const [url, buf] of assets) write(url.slice(1), buf);
write('favicon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#1F3A31"/><path d="M8 33V18l3.5-2.5V12h2.5v3.5L17.5 13V9h5v4l3.5 2.5V12h2.5v3.5L32 18v15" fill="none" stroke="#F3EBDB" stroke-width="2" stroke-linejoin="round"/><path d="M17 33v-6a3 3 0 0 1 6 0v6" fill="#C9A24E"/></svg>');

// ---- Sökmotorer ----
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /sok/\n\nSitemap: ${config.domain}/sitemap.xml\n`);
write('.well-known/security.txt', `Contact: mailto:${config.contactEmail}\nExpires: ${new Date(Date.now() + 364 * 864e5).toISOString()}\nPreferred-Languages: sv, en\n`);
const today = new Date().toISOString().slice(0, 10);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, p]) => `<url><loc>${config.domain}${u}</loc><lastmod>${today}</lastmod><priority>${p.toFixed(1)}</priority></url>`).join('\n')}\n</urlset>\n`);
write('_headers', ['/assets/*', '  Cache-Control: public, max-age=31536000, immutable', '/data/*', '  Cache-Control: public, max-age=3600', '/*', '  X-Content-Type-Options: nosniff', '  Referrer-Policy: strict-origin-when-cross-origin', '  Strict-Transport-Security: max-age=31536000', "  Content-Security-Policy: frame-ancestors 'self'"].join('\n') + '\n');

const count = fs.readdirSync(OUT, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).length;
console.log(`Klart: ${urls.length} sidor, ${count} filer. Slott ${data.castles.length}, med rundtur ${data.stats.withTour}. Utvalda: ${S.featured.map(c => c.name).join(', ') || '–'}`);
