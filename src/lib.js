'use strict';
// Små hjälpare som delas av mallarna.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = n => new Intl.NumberFormat('sv-SE').format(n);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Bilder från Wikimedia Commons hämtas via sajtens egen adress (/img/..., se worker/index.js), så att besökaren
// bara pratar med slottsregistret.se. Standardbredder: 250, 500, 960, 1280.
function commonsImage(img, width) {
  if (!img || !img.path) return null;
  const name = img.path.split('/').pop();
  if (img.w && img.w <= width) return `/img/${img.path}`;
  return `/img/thumb/${img.path}/${width}px-${name}`;
}

// Kortar Wikipedia-inledningen till hela meningar, utan hänvisningsrader.
function wikiText(text, maxChars = 1100) {
  if (!text) return [];
  const paras = text.split(/\n+/).map(p => p.trim())
    .filter(p => p && !/^(denna artikel handlar om|den här artikeln handlar om|för andra|för .* se |se (även|också) |.{0,80}(omdirigerar|redirigerar) (hit|här)\b)/i.test(p));
  const out = []; let n = 0;
  for (const p of paras) {
    if (n >= maxChars) break;
    let t = p;
    if (n + t.length > maxChars) {
      const cut = t.slice(0, maxChars - n), end = cut.lastIndexOf('. ');
      t = end > 40 ? cut.slice(0, end + 1) : '';
      if (!t) break;
    }
    if (!/[.!?»”)]$/.test(t)) { const end = t.lastIndexOf('. '); t = end > 40 ? t.slice(0, end + 1) : t; }
    if (!/[.!?»”)…]$/.test(t)) continue;
    out.push(t); n += t.length;
  }
  return out;
}

const haversine = (a, b) => {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

// "Malmö" -> "Malmö kommun", "Lund" -> "Lunds kommun"
function kommunLabel(k) {
  if (!k) return '';
  if (k === 'Gotland') return 'Region Gotland';
  return /[aeiouyåäösxz]$/i.test(k) ? `${k} kommun` : `${k}s kommun`;
}

module.exports = { esc, nf, pct, commonsImage, wikiText, haversine, kommunLabel };
