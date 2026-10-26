'use strict';
// Ingresser för länssidorna och kategorisidorna (SEO-genomgången 22 okt, punkt 2). Allt byggs av registrets egna uppgifter
// (antal, namn, kommun, typ, byggår, rundturer, erbjudanden, läge), så att texten är sann och olika på varje sida.
// Ordval och meningsbyggnad väljs med en slumpgenerator som utgår från sidans adress: samma sida får alltid samma text.
const { esc, kommunLabel, haversine } = require('./lib');

const W = ['inga', 'ett', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio', 'elva', 'tolv'];
const num = (n, g = 'ett') => n === 1 ? g : (W[n] || String(n));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const and = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' och ' + a.at(-1) : (a[0] || '');

function rng(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
// Väljer en variant; varianter som skulle börja med en siffra (t.ex. "17 slott …") väljs bort om det går.
const chooser = r => a => { const ok = a.filter(s => !/^(<[^>]+>)?\d/.test(s)); const l = ok.length ? ok : a; return l[Math.floor(r() * l.length)]; };

// Typerna i grundlistan som ord i löptext: [ord, en/ett].
const TYPE = {
  'Borg/slott': ['borg', 'en'], Borgtorn: ['borgtorn', 'ett'], 'Kungligt slott (f.d.)': ['före detta kungligt slott', 'ett'], Borg: ['borg', 'en'],
  Slott: ['slott', 'ett'], 'Fästning/slott': ['fästning', 'en'], Borgruin: ['borgruin', 'en'], Slottsruin: ['slottsruin', 'en'],
  'Herrgård/slott': ['herrgård', 'en'], Fästning: ['fästning', 'en'], 'Fästning/borg': ['fästning', 'en'], 'Fästning/borgruin': ['fästningsruin', 'en'],
  Herrgård: ['herrgård', 'en'], 'Slottsruin (romantisk)': ['romantisk slottsruin', 'en'], 'Kungligt slott': ['kungligt slott', 'ett'],
  Fornborg: ['fornborg', 'en'], Stadsmur: ['stadsmur', 'en'], Kungsgård: ['kungsgård', 'en'], Stenhus: ['stenhus', 'ett'], 'Slott/borg': ['slott', 'ett'],
  'Kungligt lustslott': ['kungligt lustslott', 'ett'], Bruksherrgård: ['bruksherrgård', 'en'], 'Slottsliknande hotell': ['slottsliknande hotell', 'ett'],
};
const aType = c => { const [w, g] = TYPE[c.type] || [c.type.toLowerCase(), 'ett']; return `${g} ${w}`; };
const year = c => c.inception && /^\d{4}$/.test(c.inception) && +c.inception > 900 ? +c.inception : null;
const century = c => year(c) ? `${Math.floor(year(c) / 100) * 100}-talet` : null;
// "med anor från 1400-talet" passar gamla anläggningar, "från 1900-talet" nyare.
const since = c => century(c) ? (year(c) < 1700 ? `med anor från ${century(c)}` : `från ${century(c)}`) : '';
// "Hotell, konferens" -> "hotell och konferens"
const useText = c => c.use ? and(c.use.split(/[;,]\s*/).map(p => /^[A-ZÅÄÖ][a-zåäö]/.test(p) && !/^(Kungl\.|Nordiska)/.test(p) ? p.charAt(0).toLowerCase() + p.slice(1) : p)) : '';
// Län som heter som en stad skrivs ut ("Kalmar län"), övriga ibland med landskapsnamnet ("Skåne").
const CITY = new Set(['kalmar', 'jonkoping', 'stockholm', 'uppsala', 'orebro']);
const where = co => CITY.has(co.slug) ? co.full : co.name;
const whereR = (co, r) => CITY.has(co.slug) || r() < 0.5 ? co.full : co.name;
// "i Skåne", men "på Gotland".
const inL = L => L === 'Gotland' ? 'på Gotland' : `i ${L}`;

const link = c => `<a href="/slott/${esc(c.slug)}/">${esc(c.name)}</a>`;
// "Hemsö fästning (Västernorrlands län)", men "Bodens fästning (Rödbergsfortet) i Norrbottens län" när namnet redan har en parentes.
const withCo = (c, full, extra = '') => /\)$/.test(c.name) ? `${link(c)} i ${esc(full)}${extra ? ` (${extra})` : ''}` : `${link(c)} (${esc(full)}${extra ? `, ${extra}` : ''})`;
const inK = k => k === 'Gotland' ? 'på Gotland' : `i ${esc(kommunLabel(k))}`;
const at = c => `${link(c)} ${inK(c.kommun)}`;
// "A i Lunds kommun och B i Eslövs kommun", men "A och B på Gotland" när alla ligger i samma kommun.
const atList = l => l.length > 1 && l.every(c => c.kommun === l[0].kommun) ? `${and(l.map(link))} ${inK(l[0].kommun)}` : and(l.map(at));
const href = (u, t) => `<a href="${u}">${t}</a>`;
const known = list => [...list].sort((a, b) => a.prio - b.prio || (b.tours.length > 0) - (a.tours.length > 0) || (b.image ? 1 : 0) - (a.image ? 1 : 0) || a.name.localeCompare(b.name, 'sv'));
const centre = list => { const l = list.filter(c => c.lat != null); return l.length ? { lat: l.reduce((s, c) => s + c.lat, 0) / l.length, lon: l.reduce((s, c) => s + c.lon, 0) / l.length } : null; };
const nearest = (from, cands, n) => from ? cands.filter(c => c.lat != null).map(c => [haversine(from, c), c]).sort((a, b) => a[0] - b[0]).slice(0, n) : [];
const mil = d => d < 10 ? 'mindre än en mil' : `ungefär ${Math.round(d / 10)} mil`;
const names = (l, max = 3) => and(l.slice(0, max).map(link)) + (l.length > max ? ' med flera' : '');

// De som har flest i en sorterad lista [[x, antal], …], högst max stycken. Delad plats vid gränsen tas inte med,
// och ingen "har flest" om ledaren bara har ett.
function leaders(arr, max) {
  let k = Math.min(max, arr.length);
  while (k > 0 && arr[k] && arr[k][1] === arr[k - 1][1]) k--;
  return arr.length && arr[0][1] > 1 ? arr.slice(0, k) : [];
}

// Hur varje kategori beskrivs: inledningar (n = antal, L = länet), varför en rundtur hjälper, substantiv,
// och meningar om vad slotten i kategorin dessutom erbjuder (med slottens namn).
const CAT = {
  'bo-pa-slott': {
    open: [
      (n, L) => `Att bo på slott ${L} går att göra på ${num(n)} ${n === 1 ? 'ställe' : 'ställen'} i registret.`,
      (n, L) => `Vill du övernatta på ett slott ${L} finns ${n === 1 ? 'ett alternativ i registret' : `${num(n)} alternativ att välja mellan`}.`,
      (n, L) => `${cap(num(n))} slott ${L} tar emot gäster över natten, i slottshotell, värdshus eller gästrum.`,
    ],
    why: ['så att du kan se miljön innan du bokar rum', 'ett bra sätt att känna in stämningen före vistelsen', 'innan du bestämmer dig för en natt där'],
    noun: 'slott att bo på',
    also: { spa: l => `${names(l)} har även spa.`, 'restaurang-och-kafe': l => `På ${names(l)} finns också restaurang eller kafé, så middagen kan ätas på plats.`,
      konferens: l => `${names(l)} tar dessutom emot konferenser.` },
  },
  spa: {
    open: [
      (n, L) => `Spa på slott ${L}: registret har ${num(n)} slott med spa, bad eller behandlingar.`,
      (n, L) => `För den som söker spa i slottsmiljö ${L} finns ${num(n)} slott i registret.`,
    ],
    why: ['så att du kan se miljön innan du bokar', 'innan du bokar en spavistelse'],
    noun: 'slott med spa',
    also: { 'bo-pa-slott': l => `På ${names(l)} kan du också bo, så spadagen kan bli en hel helg.`, konferens: l => `${names(l)} tar även emot konferenser, för den som vill kombinera möte och spa.` },
  },
  konferens: {
    open: [
      (n, L) => `Konferens på slott ${L}: ${num(n)} slott i registret tar emot möten, konferenser och kickoffer.`,
      (n, L) => `Ska ni ha möte, kickoff eller konferens ${L} finns ${num(n)} ${n === 1 ? 'slott' : 'slott att välja bland'}.`,
      (n, L) => `${cap(num(n))} slott ${L} har lokaler för konferens och möten.`,
    ],
    why: ['så att ni kan se lokalerna innan bokningen', 'praktiskt för den som planerar och inte hinner åka på visning', 'utan att någon behöver åka dit'],
    noun: 'konferensslott',
    also: { 'bo-pa-slott': l => `${names(l)} har även boende, för möten som pågår över flera dagar.`, spa: l => `${names(l)} har dessutom spa.`,
      'restaurang-och-kafe': l => `På ${names(l)} finns restaurang eller kafé i huset.` },
  },
  'brollop-och-fest': {
    open: [
      (n, L) => `Bröllop på slott ${L} kan ni ha på ${num(n)} ${n === 1 ? 'ställe' : 'ställen'} i registret.`,
      (n, L) => `Drömmer ni om att gifta er på slott ${L}? Registret har ${num(n)} slott som tar emot bröllop och fester.`,
      (n, L) => `För vigsel, bröllopsmiddag eller en stor fest ${L} finns ${n === 1 ? 'ett slott i registret' : `${num(n)} slott att välja mellan`}.`,
    ],
    why: ['så att ni kan gå runt i salarna innan ni bestämmer er', 'ett sätt att se slottet innan visningen', 'så att ni kan visa platsen för familjen redan före bröllopet'],
    noun: 'slott för bröllop och fest',
    also: { 'bo-pa-slott': l => `På ${names(l)} kan gästerna också övernatta.`, 'restaurang-och-kafe': l => `${names(l)} har egen restaurang eller kafé.`,
      konferens: l => `${names(l)} tar även emot konferenser.` },
  },
  'restaurang-och-kafe': {
    open: [
      (n, L) => `Restaurang eller kafé på slott ${L} finns på ${num(n)} ${n === 1 ? 'ställe' : 'ställen'} i registret.`,
      (n, L) => `Vill du äta lunch, middag eller fika i slottsmiljö ${L} har registret ${num(n)} slott med servering.`,
      (n, L) => `${cap(num(n))} slott ${L} har restaurang, kafé eller servering.`,
    ],
    why: ['så att du ser slottet innan du åker dit', 'så att du kan se dig omkring före besöket'],
    noun: 'slott med restaurang eller kafé',
    also: { besok: l => `${names(l)} går också att besöka, med museum, visningar eller utställningar.`, 'park-och-tradgard': l => `Efter maten kan du promenera i parken vid ${names(l)}.`,
      'bo-pa-slott': l => `På ${names(l)} går det även att bo.` },
  },
  besok: {
    open: [
      (n, L) => `Slott att besöka ${L}: ${num(n)} slott, borgar och fästningar i registret är öppna för besökare.`,
      (n, L) => `${cap(num(n))} slott ${L} går att besöka, med museum, visningar eller utställningar.`,
      (n, L) => `Den som vill besöka slott ${L} har ${num(n, 'ett')} ${n === 1 ? 'besöksmål' : 'besöksmål'} i registret, från museer till guidade visningar.`,
    ],
    why: ['bra för den som har långt att resa', 'så att du kan förbereda besöket hemifrån', 'för den som inte kan ta sig dit'],
    noun: 'slott att besöka',
    also: { 'restaurang-och-kafe': l => `Vid ${names(l)} finns kafé eller restaurang för en paus under besöket.`, 'park-och-tradgard': l => `${names(l)} har också park eller trädgård att gå runt i.` },
  },
  'park-och-tradgard': {
    open: [
      (n, L) => `Slottsparker och trädgårdar ${L}: registret har ${num(n)} slott med park eller trädgård som går att besöka.`,
      (n, L) => `För en promenad i en slottspark ${L} finns ${num(n)} slott i registret.`,
    ],
    why: ['så att du ser mer än parken', 'en chans att se slottet inifrån också'],
    noun: 'slottsparker och trädgårdar',
    also: { 'restaurang-och-kafe': l => `${names(l)} har kafé eller restaurang.`, besok: l => `På ${names(l)} kan du också besöka själva slottet.` },
  },
  'kungliga-slott': {
    open: [
      (n, L) => `Kungliga slott ${L}: registret har ${n === 1 ? 'ett kungligt slott eller lustslott' : `${num(n)} kungliga slott och lustslott`}.`,
      (n, L) => n === 1 ? `Ett av de kungliga slotten ligger ${L}.` : `${cap(num(n))} av de kungliga slotten och lustslotten ligger ${L}.`,
    ],
    why: ['så att du kan se de kungliga miljöerna inifrån', 'för den som vill se salarna utan att resa'],
    noun: 'kungliga slott',
    also: { besok: l => `${names(l)} går att besöka.`, 'park-och-tradgard': l => `Parken vid ${names(l)} är öppen för besökare.` },
  },
  'borgar-och-ruiner': {
    open: [
      (n, L) => `Borgar och slottsruiner ${L}: registret har ${num(n, 'en')} ${n === 1 ? 'borg eller ruin' : 'medeltida borgar, fornborgar och ruiner'}.`,
      (n, L) => `${cap(num(n, 'en'))} ${n === 1 ? 'borg eller ruin' : 'borgar och ruiner'} ${L} finns med i registret.`,
      (n, L) => `Den som söker medeltid ${L} hittar ${num(n, 'en')} ${n === 1 ? 'borg eller slottsruin' : 'borgar och slottsruiner'} här.`,
    ],
    why: ['så att du kommer in bakom murarna hemifrån', 'så att du kan se borgen inifrån innan du åker'],
    noun: 'borgar och ruiner', g: 'en',
    also: { besok: l => `${names(l)} går att besöka.`, 'restaurang-och-kafe': l => `Vid ${names(l)} finns kafé eller restaurang.` },
  },
  fastningar: {
    open: [
      (n, L) => `Fästningar ${L}: registret har ${num(n, 'en')} ${n === 1 ? 'fästning, kastell eller skans' : 'fästningar, kastell och skansar'}.`,
      (n, L) => `${cap(num(n, 'en'))} ${n === 1 ? 'fästning' : 'fästningar'} ${L} finns med i registret.`,
    ],
    why: ['så att du kommer in i fästningen hemifrån', 'så att du kan se anläggningen inifrån'],
    noun: 'fästningar', g: 'en',
    also: { besok: l => `${names(l)} går att besöka.`, 'restaurang-och-kafe': l => `Vid ${names(l)} finns kafé eller restaurang.` },
  },
};

// Vad man kan göra, för uppräkningar: [slug, en (singular), flera (plural)].
const DOES = [
  ['bo-pa-slott', 'går att bo på', 'går att bo på'], ['spa', 'har spa', 'har spa'], ['konferens', 'tar emot konferenser', 'tar emot konferenser'],
  ['brollop-och-fest', 'tar emot bröllop och fest', 'tar emot bröllop och fest'], ['restaurang-och-kafe', 'har restaurang eller kafé', 'har restaurang eller kafé'],
  ['besok', 'är öppet för besök', 'är öppna för besök'], ['park-och-tradgard', 'har en park att besöka', 'har park eller trädgård att besöka'],
];
const VERB = { 'bo-pa-slott': 'bo', spa: 'gå på spa', konferens: 'ha konferens', 'brollop-och-fest': 'gifta dig eller ha fest', 'restaurang-och-kafe': 'äta eller fika', besok: 'besöka slottet', 'park-och-tradgard': 'promenera i parken' };

// En mening med antal: "fyra av dem går att bo på, tre har spa och två …". items = [[antal, en, flera, länk?]], n = alla.
// Börjar meningen med ett tal över tolv skrivs den "Av dem är det 25 som …" i stället.
function counts(items, n, of) {
  const first = items.findIndex(x => x[0] !== n);
  const bit = ([m, one, many, u], i, som) => {
    const t = m === n ? `${n === 2 ? 'båda' : 'alla'} ${many}` : `${num(m)}${i === first && !som ? ` ${of}` : ''}${som ? ' som' : ''} ${m === 1 ? one : many}`;
    return u ? href(u, t) : t;
  };
  if (items[0][0] > 12 && items[0][0] !== n) return `${cap(of)} är det ${and(items.map((x, i) => bit(x, i, true)))}.`;
  const s = and(items.map((x, i) => bit(x, i, false)));
  return (s.startsWith('<a') ? s.replace(/^(<a[^>]*>)(.)/, (m0, a, c) => a + c.toUpperCase()) : cap(s)) + '.';
}

// En mening om ett slott i en kort lista: "A i Lunds kommun är en borg med anor från 1300-talet och är i dag museum."
// Typer som bara heter "slott" upprepas inte ("Gävle slott är ett slott").
const plain = c => (TYPE[c.type] || [''])[0] === 'slott' && /slott\b/i.test(c.name);
const what = c => plain(c) ? (year(c) ? (year(c) < 1700 ? `har anor från ${century(c)}` : `är från ${century(c)}`) : '') : `är ${aType(c)}${since(c) ? ' ' + since(c) : ''}`;
function brief(c) {
  const u = useText(c), w = (TYPE[c.type] || [''])[0];
  const showUse = u && !w.includes(u.toLowerCase()) && u.length < 40;
  const wh = what(c);
  const here = c.kommun === 'Gotland' ? link(c) : at(c);
  return `${wh ? `${here} ${wh}` : `${link(c)} ligger ${inK(c.kommun)}`}${showUse ? ` (i dag ${esc(u)})` : ''}.`;
}

// Kort porträtt av ett enskilt slott.
function portrait(c, pick, S, single = true) {
  const s = [], use = useText(c);
  s.push(what(c) ? pick([`${link(c)} ${inK(c.kommun)} ${what(c)}.`, ...(plain(c) ? [] : [`${link(c)} är ${aType(c)} ${inK(c.kommun)}${since(c) ? ' ' + since(c) : ''}.`])]) : `${link(c)} ligger ${inK(c.kommun)}.`);
  if (use) s.push(`Verksamheten i dag: ${esc(use)}.`);
  const verbs = c.offers.filter(o => VERB[o]).map(o => VERB[o]);
  if (verbs.length > 1) s.push(`Här kan du ${and(verbs)}.`);
  if (c.open === 'Nej') s.push('Slottet är privat och inte öppet för allmänheten, så kontakta slottet direkt.');
  else if (c.open === 'Delvis') s.push('Det är delvis öppet, så se slottets egen webbplats innan du åker.');
  if (single) s.push(`På slottets egen sida i registret finns ${and([c.website && 'länk till webbplatsen', c.lat != null && 'karta och vägbeskrivning', 'fler slott i närheten'].filter(Boolean))}.`);
  if (c.tours.length) s.push(pick([`Du kan redan nu kliva in i ${esc(c.name)} med en virtuell rundtur.`, `${esc(c.name)} har en virtuell rundtur, så du kan gå runt inne i slottet redan nu.`]));
  return s.join(' ');
}

// Slott med rundtur i listan, eller närmaste slott med rundtur utanför.
function tourPart(pick, list, others, why, used = new Set()) {
  const t = known(list.filter(c => c.tours.length)), n = list.length;
  const w = pick(why);
  if (t.length) {
    if (n === 1) return '';
    if (t.length === n) return `${n === 2 ? 'Båda' : `Alla ${num(n)}`} går att kliva in i digitalt med en virtuell rundtur, ${w}.`;
    if (t.length === 1) return pick([`${link(t[0])} har en virtuell rundtur där du kan gå runt inne i slottet, ${w}.`, `Ett av dem, ${link(t[0])}, kan du redan nu kliva in i med en virtuell rundtur, ${w}.`]);
    if (t.length > 4) return pick([`${cap(num(t.length))} av dem har en virtuell rundtur, bland andra ${and(t.slice(0, 4).map(link))} – ${w}.`,
      `Med en virtuell rundtur kan du redan nu gå runt i ${num(t.length)} av dem, bland andra ${and(t.slice(0, 4).map(link))}, ${w}.`]);
    return pick([`${cap(num(t.length))} av dem har en virtuell rundtur – ${and(t.map(link))} – ${w}.`, `Med en virtuell rundtur kan du redan nu gå runt i ${and(t.map(link))}, ${w}.`]);
  }
  const near = others && nearest(centre(list), others.filter(c => c.tours.length), 1)[0];
  if (!near) return 'Här finns ännu ingen virtuell rundtur.';
  const [d, c] = near;
  used.add(c.id);
  const none = n === 1 ? 'Det finns ännu ingen virtuell rundtur här.' : pick(['Inget av dem har ännu en virtuell rundtur.', 'Här finns ännu ingen virtuell rundtur.']);
  return `${none} ${pick([`Närmast med rundtur ligger ${at(c)}, ${mil(d)} bort fågelvägen.`, `Vill du kliva in i ett slott digitalt redan nu är ${at(c)} närmast, ${mil(d)} bort.`])}`;
}

// Slott i registret inom fem (annars tio) mil från listans mittpunkt, för sidor med få slott.
// Exemplen tas helst bland slott som inte redan nämns på sidan (used), och läggs sedan till i used.
function around(list, all, pick, used = new Set()) {
  const from = centre(list); if (!from) return '';
  for (const r of [50, 100]) {
    const l = all.filter(c => !list.includes(c) && c.lat != null && haversine(from, c) < r);
    if (!l.length) continue;
    const k = [...known(l).filter(c => !used.has(c.id)), ...known(l).filter(c => used.has(c.id))], m = r / 10 === 5 ? 'fem' : 'tio';
    k.slice(0, 2).forEach(c => used.add(c.id));
    return l.length === 1 ? `Inom ${m} mil fågelvägen finns ytterligare ett slott i registret, ${link(k[0])}.`
      : pick([`Inom ${m} mil fågelvägen finns ytterligare ${num(l.length)} slott i registret, bland dem ${and(k.slice(0, 2).map(link))}.`,
        `Den som reser i trakten har ${num(l.length)} slott till inom ${m} mil, till exempel ${and(k.slice(0, 2).map(link))}.`]);
  }
  return 'Inga andra slott i registret ligger inom tio mil.';
}

// Herrgårdar, borgar, fästningar och kungliga slott i en lista (utom kategorin själv).
function kinds(list, skip) {
  return [[list.filter(c => /herrgård/i.test(c.type)).length, 'en herrgård', 'herrgårdar', 'herrgard'], [list.filter(c => c.offers.includes('borgar-och-ruiner')).length, 'en borg eller ruin', 'borgar eller ruiner', 'borgar-och-ruiner'],
    [list.filter(c => c.offers.includes('fastningar')).length, 'en fästning', 'fästningar', 'fastningar'], [list.filter(c => c.offers.includes('kungliga-slott')).length, 'ett kungligt slott', 'kungliga slott', 'kungliga-slott']]
    .filter(x => x[0] && x[3] !== skip).map(([m, one, many]) => m === 1 ? one : `${num(m)} ${many}`);
}

// Privata och delvis öppna slott i listan.
function openPart(list, pick) {
  const no = list.filter(c => c.open === 'Nej').length, part = list.filter(c => c.open === 'Delvis').length, n = list.length;
  if (!no && !part) return '';
  const pl = no + part > 1;
  const tail = pick([`så kontrollera vad som gäller hos ${pl ? 'slotten' : 'slottet'} innan du åker`, `så se ${pl ? 'slottens egna webbplatser' : 'slottets egen webbplats'} innan du åker`, `så hör av dig till ${pl ? 'slotten' : 'slottet'} i förväg för bokning och öppettider`]);
  if (no === n || part === n) return `${n === 2 ? 'Båda' : 'Alla'} är ${no ? 'privata' : 'delvis öppna'}, ${tail}.`;
  if (Math.max(no, part) > 12) return `Av dem är ${and([no && `${num(no)} privata`, part && `${num(part)} delvis öppna`].filter(Boolean))}, ${tail}.`;
  const bits = [];
  if (no) bits.push(`${num(no)} är ${no === 1 ? 'privat' : 'privata'}`);
  if (part) bits.push(`${num(part)} är delvis ${part === 1 ? 'öppet' : 'öppna'}`);
  bits[0] = bits[0].replace(/^(\S+)/, '$1 av dem');
  return `${cap(and(bits))}, ${tail}.`;
}

// Ingress för en kategorisida, för ett län (co) eller hela Sverige (co = null).
function categoryIngress(S, cat, co, list) {
  const r = rng(cat.slug + '/' + (co ? co.slug : '')), pick = chooser(r);
  const k = CAT[cat.slug], all = S.data.castles;
  const inCat = all.filter(c => c.offers.includes(cat.slug));
  const n = list.length, top = known(list), p = [];
  const perCounty = S.data.counties.map(x => [x, inCat.filter(c => c.lanSlug === x.slug).length]).filter(x => x[1]).sort((x, y) => y[1] - x[1]);

  // 1. Svar på sökningen: antal, namn och var de ligger.
  let a = pick(k.open.map(f => f(n, esc(inL(co ? whereR(co, r) : 'Sverige')))));
  const used = new Set();
  if (n === 1) {
    a += ' ' + portrait(top[0], pick, S); used.add(top[0].id);
    const other = DOES.filter(([slug]) => slug !== cat.slug && top[0].offers.includes(slug)).map(([slug]) => href(`/${slug}/${co.slug}/`, esc(S.catBySlug.get(slug).name.toLowerCase())));
    if (other.length) a += ` ${esc(top[0].name)} finns också under ${and(other)} ${esc(inL(where(co)))}.`;
  }
  else {
    const named = top.slice(0, n > 6 ? 4 : n === 2 ? 2 : 3);
    named.forEach(c => used.add(c.id));
    if (n <= 5) { top.forEach(c => used.add(c.id)); a += ' ' + top.map(brief).join(' '); }
    else a += ' ' + pick([`Bland dem finns ${atList(named)}.`, `Här hittar du till exempel ${atList(named)}.`, `Några av dem är ${and(named.map(link))}.`]);
    const lead = leaders(perCounty, 3);
    if (!co && lead.length) a += ` Flest finns i ${and(lead.map(([x, m]) => `${href(`/${cat.slug}/${x.slug}/`, esc(where(x)))} (${m})`))}, och sammanlagt ${num(perCounty.length)} län är representerade.`;
    else if (!co) a += ` De ligger i ${num(perCounty.length)} olika län.`;
    else if (n >= 3) {
      const kom = Object.entries(list.reduce((m, c) => (m[c.kommun] = (m[c.kommun] || 0) + 1, m), {})).sort((x, y) => y[1] - x[1]);
      if (kom.length === 1) a += ` Alla ligger ${inK(kom[0][0])}.`;
      else if (leaders(kom, 1).length) a += ' ' + pick([`De ligger i ${num(kom.length, 'en')} olika kommuner, flest i ${esc(kommunLabel(kom[0][0]))} (${kom[0][1]}).`, `Flest finns i ${esc(kommunLabel(kom[0][0]))}, men sammanlagt är ${num(kom.length, 'en')} kommuner representerade.`]);
      else if (kom.length === n) a += ` Alla ligger i olika kommuner.`;
      else a += ` De ligger i ${num(kom.length, 'en')} olika kommuner.`;
    }
    const kd = kinds(list, cat.slug);
    if (kd.length && n > 5) a += ' ' + pick([`Bland slotten finns ${and(kd)}.`, `Här finns ${and(kd)}.`]);
  }
  p.push(a);

  // 2. Rundturer, vad slotten dessutom erbjuder och det äldsta.
  const b = [];
  const tp = tourPart(pick, list, co ? all : null, k.why, used);
  if (tp) b.push(tp);
  const inCounty = co ? all.filter(x => x.lanSlug === co.slug) : [];
  const other = co && n <= 6 ? known(inCounty.filter(x => !list.includes(x))).slice(0, 3) : [];
  other.forEach(x => used.add(x.id));
  if (n <= 3) b.push(around(list, all, pick, used));
  if (n > 1) {
    const extra = DOES.filter(([slug]) => slug !== cat.slug).map(([slug, one, many]) => [list.filter(c => c.offers.includes(slug)).length, one, many, slug]).filter(x => x[0]).sort((x, y) => y[0] - x[0]);
    if (extra.length) b.push(counts(extra.slice(0, 3).map(([m, one, many, slug]) => [m, one, many, co ? `/${slug}/${co.slug}/` : `/${slug}/`]), n, pick(['av dem', 'av slotten'])));
    // En mening med namn för det första erbjudande som kategorin har en egen formulering för.
    const also = Object.keys(k.also).find(slug => { const m = list.filter(c => c.offers.includes(slug)).length; return m > 1 && m < n; });
    if (also) { const l = known(list.filter(c => c.offers.includes(also))); b.push(k.also[also]([...l.filter(c => !used.has(c.id)), ...l.filter(c => used.has(c.id))])); }
    const old = list.filter(year).sort((x, y) => year(x) - year(y))[0];
    if (old && n > 2) b.push(pick([`Längst tillbaka går ${link(old)}, ${since(old)}.`, `Äldst bland dem är ${link(old)}, från ${century(old)}.`]));
    const op = openPart(list, pick);
    if (op) b.push(op);
  }
  if (b.length) p.push(b.join(' '));

  // 3. Sammanhang: andel av länet, närmaste utanför länet och hela landet.
  const c = [];
  if (co) {
    const tot = inCounty.length;
    if (tot === n) c.push(tot === 1 ? `Det är länets enda slott i registret.` : `Det är alla länets ${num(tot)} slott i registret.`);
    else c.push(pick([`Det är ${num(n)} av de ${num(tot)} slotten i ${href(`/lan/${co.slug}/`, esc(co.full))}.`, `Av ${href(`/lan/${co.slug}/`, `länets ${num(tot)} slott`)} är det ${num(n)} som hör hit.`]));
    if (other.length) {
      c.push(pick([`I länet finns också ${other.length < tot - n ? 'bland annat ' : ''}${and(other.map(link))}.`, `${other.length < tot - n ? 'Andra slott i länet är' : `Länets ${other.length === 1 ? 'andra slott är' : 'övriga slott är'}`} ${and(other.map(link))}.`]));
    }
    // Slott med rundtur i länet som inte hör till kategorin.
    const ct = known(inCounty.filter(x => x.tours.length && !list.includes(x)));
    if (ct.length && !list.some(x => x.tours.length)) {
      const inOther = ct.filter(x => other.includes(x)), fresh = ct.filter(x => !other.includes(x) && !used.has(x.id));
      if (inOther.length) c.push(inOther.length === other.length && other.length > 1 ? `${other.length === 2 ? 'Båda' : `Alla ${num(other.length)}`} har en virtuell rundtur.`
        : `${other.length === 1 ? '' : 'Av dem har '}${and(inOther.map(x => esc(x.name)))}${other.length === 1 ? ' har' : ''} en virtuell rundtur.`);
      if (fresh.length) c.push(inOther.length ? `Dessutom går ${names(fresh, 2)} att kliva in i digitalt.` : pick([`I länet i övrigt går ${names(fresh, 2)} att kliva in i digitalt.`, `Annars i länet har ${names(fresh, 2)} en virtuell rundtur.`]));
    }
    const near = nearest(centre(list), inCat.filter(x => x.lanSlug !== co.slug), n < 4 ? 3 : 2);
    if (near.length) c.push(pick([`Närmast utanför länet ligger ${and(near.map(([d, x]) => withCo(x, S.countyBySlug.get(x.lanSlug).full, n === 1 ? `${mil(d)} bort` : '')))}.`,
      `Utanför länet är ${and(near.map(([, x]) => `${link(x)} i ${esc(where(S.countyBySlug.get(x.lanSlug)))}`))} närmast.`]));
    if (n === 1) {
      // Grannlänen i samma kategori, och slott i kategorin som redan går att kliva in i.
      const nb = [...new Set(near.map(([, x]) => x.lanSlug))].map(slug => perCounty.find(([x]) => x.slug === slug)).filter(Boolean);
      if (nb.length) c.push(and(nb.map(([x, m], i) => `${href(`/${cat.slug}/${x.slug}/`, esc(where(x)))} ${i ? '' : 'har '}${num(m, k.g || 'ett')}`)) + (nb.at(-1)[1] > 1 ? ` ${k.noun}.` : ' av samma slag.'));
      // Näst och tredje närmast med rundtur i kategorin (den närmaste nämns redan ovan).
      const t = nearest(list[0], inCat.filter(x => x.tours.length && x.lanSlug !== co.slug && !used.has(x.id)), 2).map(x => x[1]);
      if (t.length && !list[0].tours.length) c.push(pick([`${and(t.map(link))} är ${t.length > 1 ? 'två' : (k.g || 'ett')} av landets ${k.noun} som har en virtuell rundtur.`, `Bland landets ${k.noun} har ${and(t.map(link))} en virtuell rundtur.`]));
    }
    const rest = perCounty.filter(([x]) => x.slug !== co.slug), big = leaders(rest, 2).map(([x]) => esc(where(x)));
    const tail = big.length ? `flest i ${and(big)}` : rest.length && rest.length <= 4 ? `övriga i ${and(rest.map(([x]) => esc(where(x))))}` : '';
    c.push(pick([`I ${href(`/${cat.slug}/`, 'hela Sverige')} finns ${num(inCat.length, k.g || 'ett')} ${k.noun} i registret${tail ? `, ${tail}` : ''}.`,
      `Totalt har registret ${href(`/${cat.slug}/`, `${num(inCat.length, k.g || 'ett')} ${k.noun}`)} i landet${tail ? `, och utanför ${esc(where(co))} finns ${tail.replace(/^övriga /, 'de övriga ')}` : ''}.`]));
  } else {
    const t = inCat.filter(x => x.tours.length).length;
    c.push(`Det är ungefär ${Math.round(n / all.length * 100)} procent av alla ${all.length} slott i registret${t ? `, och ${num(t)} av dem går att kliva in i digitalt` : ''}.`);
    c.push(pick(['Välj ett län nedan för att se slotten där.', 'Länsknapparna nedan visar slotten län för län.']));
  }
  p.push(c.join(' '));
  return p.filter(Boolean).map(x => `<p>${x}</p>`).join('');
}

const FOR = { 'bo-pa-slott': 'för en natt på slott', spa: 'för spa', konferens: 'för konferens', 'brollop-och-fest': 'för bröllop och fest', 'restaurang-och-kafe': 'för en måltid eller fika', besok: 'för ett besök', 'park-och-tradgard': 'för en promenad i parken' };

// Ingress för en länssida.
function countyIngress(S, co, list) {
  const r = rng('lan/' + co.slug), pick = chooser(r);
  const all = S.data.castles, n = list.length, top = known(list), p = [];
  if (n === 1) {
    const c = top[0];
    let a = `${esc(co.full)} har än så länge ett slott i registret. ${portrait(c, pick, S)}`;
    const offers = DOES.filter(([slug]) => c.offers.includes(slug)).map(([slug]) => href(`/${slug}/${co.slug}/`, esc(S.catBySlug.get(slug).name.toLowerCase())));
    if (offers.length) a += ` Du hittar det under ${and(offers)} i ${esc(co.name)}.`;
    p.push(a);
    const near = nearest(c, all.filter(x => x.lanSlug !== co.slug), 3);
    const nt = nearest(c, all.filter(x => x.tours.length), 1)[0];
    const s = [`Närmast utanför länet ligger ${and(near.map(([d, x]) => withCo(x, S.countyBySlug.get(x.lanSlug).full, `${mil(d)} bort`)))}.`];
    s.push(around(list, all, pick, new Set(near.map(([, x]) => x.id))));
    if (nt && !c.tours.length) s.push(`Det närmaste slottet med virtuell rundtur är ${at(nt[1])} – ett sätt att se ett slott inifrån utan att resa.`);
    const nb = [...new Set(near.map(([, x]) => x.lanSlug))].map(slug => S.countyBySlug.get(slug));
    s.push(`I de närmaste länen har registret ${and(nb.map(x => `${num(x.total)} i ${href(`/lan/${x.slug}/`, esc(x.full))}`))}.`);
    const cats = S.data.categories.filter(x => c.offers.includes(x.slug));
    s.push(`I hela Sverige har registret ${and(cats.map(x => `${href(`/${x.slug}/`, `${num(x.total, CAT[x.slug].g || 'ett')} ${CAT[x.slug].noun}`)}`))}.`);
    s.push(`Känner du till fler slott, borgar eller fästningar i ${esc(co.name)} som borde finnas med? ${href('/tipsa/', 'Tipsa oss gärna')}.`);
    p.push(s.join(' '));
    return p.map(x => `<p>${x}</p>`).join('');
  }
  const L = whereR(co, r);
  let a = pick([`${cap(inL(esc(L)))} finns ${num(n)} slott, borgar och fästningar i registret.`, `Registret har ${num(n)} slott, borgar och fästningar ${inL(esc(L))}.`, `${cap(num(n))} slott, borgar och fästningar ${inL(esc(L))} finns med här.`]);
  const named = top.slice(0, n > 8 ? 4 : 3);
  if (n <= 4) a += ' ' + top.map(brief).join(' ');
  else a += ' ' + pick([`Bland de mer kända finns ${atList(named)}.`, `Hit hör ${atList(named)}.`, `Några av dem är ${atList(named)}.`]);
  const kom = Object.entries(list.reduce((m, c) => (m[c.kommun] = (m[c.kommun] || 0) + 1, m), {})).sort((x, y) => y[1] - x[1]);
  if (kom[0][1] >= 3 && kom.length > 1 && leaders(kom, 1).length) a += ' ' + pick([`Flest ligger i ${esc(kommunLabel(kom[0][0]))}, med ${num(kom[0][1])} slott, och sammanlagt finns de i ${num(kom.length, 'en')} kommuner.`, `${esc(cap(kommunLabel(kom[0][0])))} har flest, ${num(kom[0][1])} stycken. Sammanlagt finns slotten i ${num(kom.length, 'en')} kommuner.`]);
  else if (kom.length > 1) a += ` De ligger i ${num(kom.length, 'en')} olika kommuner.`;
  const kd = kinds(list);
  if (kd.length && n > 4) a += ' ' + pick([`Här finns bland annat ${and(kd)}.`, `Länets slott rymmer bland annat ${and(kd)}.`]);
  const seen = new Set(named.map(x => x.id));
  if (n <= 4) a += ' ' + around(list, all, pick, seen);
  p.push(a);

  const b = [];
  const tp = tourPart(pick, list, all, ['bra för den som har långt att resa', 'i din egen takt, var du än är', 'så att du kan se slottet inifrån innan du åker']);
  if (tp) b.push(tp);
  const dated = list.filter(year).sort((x, y) => year(x) - year(y));
  if (dated.length) b.push(pick([`Längst tillbaka går ${link(dated[0])}, ${since(dated[0])}.`, `Äldst i länet är ${link(dated[0])}, från ${century(dated[0])}.`]));
  if (dated.length >= 4) {
    const cs = Object.entries(dated.reduce((m, c) => (m[century(c)] = (m[century(c)] || 0) + 1, m), {})).sort((x, y) => y[1] - x[1]);
    if (cs[0][1] >= 3 && leaders(cs, 1).length) b.push(pick([`Av de ${num(dated.length)} slott där registret har ett byggår är flest från ${cs[0][0]} (${num(cs[0][1])}).`, `Räknat på byggår dominerar ${cs[0][0]}, med ${num(cs[0][1])} av ${num(dated.length)} slott.`]));
  }
  p.push(b.join(' '));

  const does = DOES.map(([slug, one, many]) => [list.filter(c => c.offers.includes(slug)), one, many, slug]).filter(x => x[0].length);
  if (does.length) {
    let c = counts(does.map(([l, one, many, slug]) => [l.length, one, many, `/${slug}/${co.slug}/`]), n, pick(['av slotten', 'av länets slott', 'av dem']));
    if (r() < 0.4) c = 'Vad kan man göra här? ' + c;
    // Exempel för de vanligaste erbjudandena (inte samma slott två gånger).
    const used = new Set(named.map(x => x.id)), ex = [];
    for (const [l, , , slug] of [...does].sort((x, y) => y[0].length - x[0].length)) {
      const e = known(l).find(x => !used.has(x.id));
      if (!e) continue;
      used.add(e.id); ex.push(`${link(e)} ${FOR[slug]}`);
      if (ex.length === 3) break;
    }
    if (ex.length) c += ' ' + pick([`Titta till exempel på ${and(ex)}.`, `Några exempel: ${and(ex)}.`]);
    const op = openPart(list, pick);
    if (op) c += ' ' + op;
    p.push(c);
  }
  // Grannlänen: närmaste slott utanför länet och hur många slott de länen har.
  const near = nearest(centre(list), all.filter(x => x.lanSlug !== co.slug && !seen.has(x.id)), 12);
  const nb = [...new Set(near.map(([, x]) => x.lanSlug))].slice(0, 3).map(slug => S.countyBySlug.get(slug));
  if (nb.length) p.push(pick([`Strax utanför länet ligger ${and(near.slice(0, 2).map(([, x]) => withCo(x, S.countyBySlug.get(x.lanSlug).full)))}.`, `Närmast på andra sidan länsgränsen finns ${and(near.slice(0, 2).map(([, x]) => `${link(x)} i ${esc(where(S.countyBySlug.get(x.lanSlug)))}`))}.`])
    + ' ' + pick([`I de närmaste länen har registret ${and(nb.map(x => `${num(x.total)} slott i ${href(`/lan/${x.slug}/`, esc(x.full))}`))}.`, `Bland de närmaste länen har ${and(nb.map((x, i) => `${href(`/lan/${x.slug}/`, esc(x.full))} ${num(x.total)}${i ? '' : ' slott'}`))} i registret.`]));
  return p.filter(Boolean).map(x => `<p>${x}</p>`).join('');
}

module.exports = { categoryIngress, countyIngress };
