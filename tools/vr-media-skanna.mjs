#!/usr/bin/env node
// Letar 360-bilder från andra än Google runt slotten och golfklubbarna (Street View-metadata, gratis, nyckel i MAPS_KEY),
// främst för att hitta VR Media International AB:s rundturer. Körs av .github/workflows/vr-media-skanning.yml på en
// claude/-gren. In: data/source/vr-media-platser.json { platser: [{ register, id, namn, lat, lon, ut, steg, r }] }.
// Varje plats får ett sexkantsrutnät ut till `ut` meter med `steg` meters avstånd; varje punkt frågar efter närmaste bild
// inom `r` meter. Ut: data/source/vr-media-skanning.json { tid, fragor, status, platser: { "<register>/<id>": [bilder] } }.
import fs from 'node:fs';

const IN = 'data/source/vr-media-platser.json', UT = 'data/source/vr-media-skanning.json';
const key = process.env.MAPS_KEY;
// Saknad nyckel eller fel stoppar aldrig arbetsflödet (Daniel vill inte ha mejl om misslyckade körningar); felet sparas i svaret.
if (!key) { fs.writeFileSync(UT, JSON.stringify({ tid: new Date().toISOString(), fel: 'nyckel saknas (MAPS_KEY)' })); console.log('nyckel saknas'); process.exit(0); }
const { platser } = JSON.parse(fs.readFileSync(IN, 'utf8'));
const vila = (ms) => new Promise((ok) => setTimeout(ok, ms));

function rutnat(ut, steg) {
  const h = steg * Math.sqrt(3) / 2, p = [];
  for (let j = -Math.ceil(ut / h); j <= Math.ceil(ut / h); j++)
    for (let i = -Math.ceil(ut / steg) - 1; i <= Math.ceil(ut / steg) + 1; i++) {
      const x = i * steg + (j % 2 ? steg / 2 : 0), y = j * h;
      if (x * x + y * y <= ut * ut) p.push([x, y]);
    }
  return p;
}

const fragor = [];
for (const s of platser)
  for (const [dx, dy] of rutnat(s.ut, s.steg))
    fragor.push({ s, lat: s.lat + dy / 111320, lon: s.lon + dx / (111320 * Math.cos(s.lat * Math.PI / 180)) });

const res = { tid: new Date().toISOString(), fragor: fragor.length, status: {}, platser: {} };
const sedda = {};
let i = 0, stopp = false;
await Promise.allSettled(Array.from({ length: 16 }, async () => {
  while (i < fragor.length && !stopp) {
    const f = fragor[i++];
    const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${f.lat.toFixed(6)},${f.lon.toFixed(6)}&radius=${f.s.r}&source=default&key=${key}`;
    let j = null;
    for (const v of [0, 2000, 8000]) {
      if (v) await vila(v);
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (r.ok) { j = await r.json(); break; }
        res.status['http ' + r.status] = (res.status['http ' + r.status] ?? 0) + 1;
      } catch (e) { res.status.natfel = (res.status.natfel ?? 0) + 1; }
    }
    if (!j) continue;
    res.status[j.status] = (res.status[j.status] ?? 0) + 1;
    if (j.error_message) res.felmeddelande ??= j.error_message.replaceAll(key, '…');
    if (j.status === 'REQUEST_DENIED' || j.status === 'OVER_QUERY_LIMIT') { if (res.status[j.status] > 20) stopp = true; continue; }
    if (j.status !== 'OK' || !j.pano_id || !j.location || /^©\s*Google$/i.test(j.copyright || '')) continue;
    const k = `${f.s.register}/${f.s.id}`;
    sedda[k] ??= {};
    if (sedda[k][j.pano_id]) continue;
    sedda[k][j.pano_id] = { pano: j.pano_id, av: (j.copyright || '').replace(/^©\s*/, ''), lat: j.location.lat, lon: j.location.lng, datum: j.date || null };
  }
}));
for (const [k, v] of Object.entries(sedda)) res.platser[k] = Object.values(v);
if (stopp) res.avbruten = true;
fs.writeFileSync(UT, JSON.stringify(res));
const vr = Object.entries(res.platser).filter(([, v]) => v.some((b) => /VR Media/i.test(b.av)));
console.log(res.fragor, 'frågor', JSON.stringify(res.status));
console.log(vr.length, 'platser med VR Media:', vr.map(([k, v]) => `${k} (${v.filter((b) => /VR Media/i.test(b.av)).length})`).join(', '));
