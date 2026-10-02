// Körs före de statiska filerna (run_worker_first i wrangler.jsonc).
// - www.slottsregistret.se skickas vidare till slottsregistret.se med samma sökväg.
// - /img/... hämtar bilder från Wikimedia Commons åt besökaren (se commons nedan).
// - /tiles/z/x/y.png hämtar kartplattor från OpenStreetMap åt besökaren (se tiles nedan).
// - /api/skicka tar emot formulären (se forms.js).
// - Allt annat hämtas bland filerna i dist/, där _headers, _redirects och 404-sidorna gäller som vanligt.
import { handleForm } from './forms.js';

const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons/';
const UA = 'slottsregistret.se/1.0 (https://slottsregistret.se/; kontakt@slottsregistret.se)';
// Commons-sökvägar: a/ab/Namn.jpg eller thumb/a/ab/Namn.jpg/500px-Namn.jpg. Inget annat släpps igenom.
const PATH = /^(thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/[^/]+(\/(\d+)px-[^/]+)?$/;

// Bilderna hämtas från Wikimedia av Cloudflare och sparas i Cloudflares cache ett år (Commons-filer byter inte innehåll
// under samma namn). Besökaren pratar bara med slottsregistret.se: Wikimedia ser inte besöket och sätter inga kakor,
// och sidan behöver ingen extra anslutning till en annan server.
async function commons(request, url, ctx) {
  const rest = url.pathname.slice('/img/'.length);
  const m = rest.match(PATH);
  if (!m || (m[1] && !m[2]) || (!m[1] && m[2])) return new Response('Not found', { status: 404 });
  const cache = caches.default;
  const key = new Request(`${url.origin}${url.pathname}`);
  const hit = await cache.match(key);
  if (hit) return hit;
  const get = p => fetchRetry(COMMONS + p, { headers: { 'user-agent': UA }, cf: { cacheTtl: 31536000, cacheEverything: true } });
  let up = await get(rest);
  // Wikimedia gör bara miniatyrer i vissa bredder. Går en bredd inte att få, används 500 px (som alltid fungerar).
  if (!up.ok && m[3] && m[3] !== '500') up = await get(rest.replace(/\/\d+px-([^/]+)$/, '/500px-$1'));
  if (!up.ok) return new Response('Not found', { status: up.status === 404 ? 404 : 502 });
  const res = new Response(up.body, {
    headers: {
      'content-type': up.headers.get('content-type') || 'image/jpeg',
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

// Ett nytt försök efter en kort paus om servern svarar att den har för mycket att göra.
async function fetchRetry(url, init) {
  const r = await fetch(url, init);
  if (r.status !== 429 && r.status < 500) return r;
  await new Promise(ok => setTimeout(ok, 400));
  return fetch(url, init);
}

// Kartplattor från OpenStreetMap. Deras regler för plattor följs: tydlig User-Agent, plattorna sparas i Cloudflares
// cache enligt OSM:s egna cachetider (minst en dag) och bara plattor som besökare faktiskt tittar på hämtas.
async function tiles(request, url, ctx) {
  const m = url.pathname.match(/^\/tiles\/(\d{1,2})\/(\d{1,6})\/(\d{1,6})\.png$/);
  if (!m || +m[1] > 19) return new Response('Not found', { status: 404 });
  const cache = caches.default;
  const key = new Request(`${url.origin}${url.pathname}`);
  const hit = await cache.match(key);
  if (hit) return hit;
  const up = await fetchRetry(`https://tile.openstreetmap.org/${m[1]}/${m[2]}/${m[3]}.png`, { headers: { 'user-agent': UA, referer: 'https://slottsregistret.se/' } });
  if (!up.ok) return new Response('Not found', { status: up.status === 404 ? 404 : 502 });
  const age = Math.max(86400, +((up.headers.get('cache-control') || '').match(/max-age=(\d+)/) || [])[1] || 0);
  const res = new Response(up.body, {
    headers: { 'content-type': 'image/png', 'cache-control': `public, max-age=${age}`, 'x-content-type-options': 'nosniff' },
  });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === '/api/skicka') return handleForm(request, env, ctx);
    const read = request.method === 'GET' || request.method === 'HEAD';
    if (read && url.pathname.startsWith('/img/')) return commons(request, url, ctx);
    if (read && url.pathname.startsWith('/tiles/')) return tiles(request, url, ctx);
    return env.ASSETS.fetch(request);
  },
};
