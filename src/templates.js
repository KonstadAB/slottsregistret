'use strict';
// Sidmallarna. Varje funktion får sammanhanget S (se build.js) och returnerar en hel HTML-sida.
const { esc, nf, pct, commonsImage, wikiText, kommunLabel } = require('./lib');

const KIND = {
  walk: { label: 'Virtuell rundvandring', verb: 'Gå runt i slottet', lead: 'Gå från rum till rum och se dig omkring åt alla håll, i din egen takt.' },
  look: { label: 'Titta runt från en plats', verb: 'Titta runt', lead: 'Stå mitt i rummet och se dig omkring åt alla håll.' },
  view: { label: 'Se slottet inifrån', verb: 'Se slottet inifrån', lead: 'Se salarna inifrån, var du än är.' },
};
const castleURL = c => `/slott/${c.slug}/`;
const countyURL = co => `/lan/${co.slug}/`;
const catURL = (cat, co) => `/${cat.slug}/${co ? co.slug + '/' : ''}`;

// Ikoner för erbjudandena (24×24, linjer).
const ICON = {
  'bo-pa-slott': '<path d="M4 20V10l8-5 8 5v10M9 20v-5h6v5"/>', spa: '<path d="M12 4c3 4 5 6.5 5 9a5 5 0 0 1-10 0c0-2.5 2-5 5-9Z"/>',
  konferens: '<path d="M4 6h16v10H4zM9 20h6M12 16v4"/>', 'brollop-och-fest': '<circle cx="9" cy="13" r="5"/><circle cx="15" cy="13" r="5"/>',
  'restaurang-och-kafe': '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M16 3c-2 2-2 6 0 8v10"/>', besok: '<path d="M3 21h18M5 21V9l7-5 7 5v12M10 21v-6h4v6"/>',
  'park-och-tradgard': '<path d="M12 21v-7M12 14c-4 0-6-3-6-6 3 0 6 2 6 6Zm0 0c4 0 6-3 6-6-3 0-6 2-6 6Z"/>',
};
const icon = slug => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICON[slug] || ''}</svg>`;
const TOUR_ICON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V11a6 6 0 0 1 12 0v10M3 21h18M12 15v2"/></svg>';

// ---------- Delar ----------
function layout(S, { title, description, path, body, image, jsonld, scripts = [], noindex = false, bodyClass = '', preload = '' }) {
  const c = S.config;
  const full = title ? `${title} | ${c.name}` : `${c.name} – ${c.tagline}`;
  const canonical = c.domain + path;
  const og = image ? (image.startsWith('http') ? image : c.domain + image) : c.domain + S.asset('/assets/img/og.jpg');
  return `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description || c.description)}">
<link rel="canonical" href="${esc(canonical)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(c.name)}">
<meta property="og:title" content="${esc(title || c.name)}">
<meta property="og:description" content="${esc(description || c.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(og)}">
<meta property="og:locale" content="sv_SE">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1F3A31">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="${S.asset('/assets/fonts/fraunces-latin.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${S.asset('/assets/fonts/instrument-sans-latin.woff2')}" as="font" type="font/woff2" crossorigin>
${preload}
<link rel="stylesheet" href="${S.asset('/assets/style.css')}">
${[].concat(jsonld || []).map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body class="${bodyClass}">
<a class="skip" href="#innehall">Till innehållet</a>
${header(S, path)}
<main id="innehall">
${body}
</main>
${footer(S)}
<script src="${S.asset('/assets/app.js')}" defer></script>
${scripts.map(s => `<script src="${S.asset(s)}" defer></script>`).join('\n')}
${c.cloudflareAnalyticsToken ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${esc(c.cloudflareAnalyticsToken)}"}'></script>` : ''}
</body>
</html>`;
}

const LOGO = `<svg class="logo-mark" viewBox="0 0 40 40" aria-hidden="true"><path d="M6 35V17l4-3v-4h3v4l4-3V7h6v4l4 3v-4h3v4l4 3v18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M16 35v-8a4 4 0 0 1 8 0v8" fill="currentColor" class="door"/></svg>`;

function header(S, path) {
  const nav = [['/karta/', 'Karta'], ['/virtuella-rundturer/', 'Rundturer'], ['/lan/', 'Län'], ['/bo-pa-slott/', 'Bo på slott'], ['/brollop-och-fest/', 'Bröllop'], ['/konferens/', 'Konferens'], ['/besok/', 'Besöka']];
  return `<header class="site-header">
  <div class="wrap hdr">
    <a class="logo" href="/" aria-label="${esc(S.config.name)}, till startsidan">${LOGO}<span>Slotts<b>registret</b></span></a>
    <button class="menu-btn" aria-expanded="false" aria-controls="huvudmeny"><span class="visually-hidden">Meny</span><span class="bars" aria-hidden="true"></span></button>
    <nav id="huvudmeny" class="nav" aria-label="Huvudmeny">
      ${nav.map(([u, t]) => `<a href="${u}"${path.startsWith(u) ? ' aria-current="page"' : ''}>${t}</a>`).join('')}
      <a class="nav-m nav-m-first" href="/spa/">Spa</a><a class="nav-m" href="/for-slott/">För slottsägare</a>
      <a class="nav-search" href="/sok/" aria-label="Sök"${path.startsWith('/sok/') ? ' aria-current="page"' : ''}><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><span class="nav-m-label">Sök</span></a>
    </nav>
  </div>
</header>`;
}

function footer(S) {
  const c = S.config;
  return `<footer class="site-footer">
  <div class="wrap ftr">
    <div>
      <a class="logo logo-light" href="/">${LOGO}<span>Slotts<b>registret</b></span></a>
      <p>${esc(c.tagline)}. Ett register över ${nf(S.data.stats.total)} slott, borgar och fästningar i hela Sverige.</p>
    </div>
    <div>
      <h2>Hitta</h2>
      <ul>${S.data.categories.map(cat => `<li><a href="${catURL(cat)}">${esc(cat.name)}</a></li>`).join('')}</ul>
    </div>
    <div>
      <h2>Län</h2>
      <ul class="cols">${S.data.counties.map(co => `<li><a href="${countyURL(co)}">${esc(co.name)}</a></li>`).join('')}</ul>
    </div>
    <div>
      <h2>Om</h2>
      <ul>
        <li><a href="/om/">Om Slottsregistret</a></li>
        <li><a href="/for-slott/">För slott och slottsägare</a></li>
        <li><a href="/tipsa/">Tipsa om en rundtur eller ett fel</a></li>
        <li><a href="/kontakt/">Kontakt</a></li>
        <li><a href="/integritet/">Integritet</a></li>
      </ul>
    </div>
  </div>
  <div class="wrap fine">Texter från Wikipedia (CC BY-SA) och bilder från Wikimedia Commons visas med upphov och licens på varje sida. Kartdata © OpenStreetMap.</div>
</footer>`;
}

// Brödsmulorna som strukturerad data, så att sökmotorerna kan visa sökvägen i träfflistan.
function crumbLd(S, items) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map(([u, t], i) => ({ '@type': 'ListItem', position: i + 1, name: t, item: S.config.domain + u })) };
}

function crumbs(items) {
  return `<nav class="crumbs" aria-label="Brödsmulor"><ol>${items.map(([u, t], i) => i < items.length - 1 ? `<li><a href="${u}">${esc(t)}</a></li>` : `<li aria-current="page">${esc(t)}</li>`).join('')}</ol></nav>`;
}

function card(S, c, opts = {}) {
  const img = commonsImage(c.image, 500);
  const offers = c.offers.map(o => S.catBySlug.get(o)).filter(x => x && x.kind === 'offer' && x.slug !== 'besok').slice(0, 3);
  const kind = c.tours.length ? (KIND[c.tours[0].kind] || KIND.view).label : '';
  return `<li class="card${c.tours.length ? ' has-tour' : ''}">
  <a href="${castleURL(c)}">
    <span class="card-img">${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async" width="500" height="375">` : '<span class="ph" aria-hidden="true"></span>'}${c.tours.length ? `<span class="lit" title="${esc(kind)}">${TOUR_ICON}Kliv in<span class="visually-hidden">: ${esc(kind)}</span></span>` : ''}</span>
    <span class="card-body">
      <small class="card-loc">${esc(c.kommun)}${opts.noCounty ? '' : ` · ${esc(c.lan)}`}</small>
      <strong>${esc(c.name)}</strong>
      ${offers.length ? `<small class="card-offers">${offers.map(o => esc(o.short)).join(' · ')}</small>` : ''}
    </span>
  </a>
</li>`;
}

const cards = (S, list, opts) => `<ul class="cards">${list.map(c => card(S, c, opts)).join('')}</ul>`;

function coverage(n, total, label) {
  const p = pct(n, total);
  return `<div class="coverage" role="img" aria-label="${p} procent: ${n} av ${total} ${label}">
  <div class="bar"><span style="width:${p}%"></span></div>
  <p><b>${p} %</b> · ${nf(n)} av ${nf(total)} ${esc(label)}</p>
</div>`;
}

function searchBox(S, big = false) {
  return `<form class="search${big ? ' search-big' : ''}" action="/sok/" role="search">
  <label class="visually-hidden" for="q${big ? 'h' : ''}">Sök slott, ort, län eller vad du vill göra</label>
  <input id="q${big ? 'h' : ''}" name="q" type="search" autocomplete="off" placeholder="Sök slott, ort eller t.ex. ”bröllop Skåne”" data-short="Sök slott eller ”bröllop Skåne”" data-search>
  <button type="submit">Sök</button>
  <ul class="suggest" role="listbox" hidden></ul>
</form>`;
}

// Sorterar så att slott med rundtur kommer först, sedan prioritet och namn.
const byTour = (a, b) => (b.tours.length > 0) - (a.tours.length > 0) || a.prio - b.prio || a.name.localeCompare(b.name, 'sv');

// ---------- Sidor ----------
function home(S) {
  const d = S.data, st = d.stats;
  const offers = d.categories.filter(c => c.kind === 'offer');
  const types = d.categories.filter(c => c.kind === 'type');
  // En bild per erbjudande: utvalda slott som visar just det (TILE), annars ett slott med bild och hög prioritet.
  const TILE = { 'bo-pa-slott': 'hackeberga-slott', spa: 'nasby-slott', konferens: 'snogeholms-slott', 'brollop-och-fest': 'gunnebo-slott',
    'restaurang-och-kafe': 'svaneholms-slott', besok: 'gripsholms-slott', 'park-och-tradgard': 'sofiero-slott' };
  const used = new Set();
  const offerTiles = offers.filter(o => o.total).map(o => {
    const c = d.castles.find(c => c.id === TILE[o.slug] && c.image) || d.castles.filter(c => c.image && c.offers.includes(o.slug) && !used.has(c.id))
      .sort((a, b) => a.prio - b.prio || (b.tours.length > 0) - (a.tours.length > 0) || a.name.localeCompare(b.name, 'sv'))[0];
    if (c) used.add(c.id);
    return [o, c];
  });
  return layout(S, {
    path: '/', bodyClass: 'home', scripts: S.hero.length ? ['/assets/hero.js'] : [],
    preload: S.hero.length ? `<link rel="preload" as="image" type="image/avif" imagesrcset="${S.asset(`/assets/hero/${S.hero[0].id}-1100.avif`)} 1100w, ${S.asset(`/assets/hero/${S.hero[0].id}-1920.avif`)} 1920w" imagesizes="100vw" fetchpriority="high">` : '',
    jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: S.config.name, url: S.config.domain + '/',
      potentialAction: { '@type': 'SearchAction', target: S.config.domain + '/sok/?q={q}', 'query-input': 'required name=q' } },
    body: `
<section class="hero hero-film">
  ${S.hero.length ? `<div class="film" aria-hidden="true">${S.hero.map((h, i) => `<div class="slide${i === 0 ? ' on' : ''}" style="--dx:${['-2%', '2%', '-1.5%', '1.5%'][i % 4]};--dy:${['-1%', '1%', '1.5%', '-1.5%'][i % 4]}" data-name="${esc(h.name)}" data-href="/slott/${esc(h.id)}/" data-credit="${esc(h.credit)}"><picture><source type="image/avif" ${i === 0 ? 'srcset' : 'data-srcset'}="${S.asset(`/assets/hero/${h.id}-1100.avif`)} 1100w, ${S.asset(`/assets/hero/${h.id}-1920.avif`)} 1920w" sizes="100vw"><img ${i === 0 ? 'src' : 'data-src'}="${S.asset(`/assets/hero/${h.id}-1600.jpg`)}" alt="" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></picture></div>`).join('')}</div>` : ''}
  <div class="hero-shade" aria-hidden="true"></div>
  <div class="wrap hero-in">
    <p class="kicker kicker-gold"><span>${nf(st.total)} slott, borgar och fästningar</span></p>
    <h1>Sveriges slott –<br><em class="gold-text">och vägen in</em></h1>
    <p class="lead">Hitta slott att besöka, bo på, gifta dig eller ha konferens på. Och kliv in i dem redan nu: ${nf(st.withTour)} slott kan du gå runt i digitalt.</p>
    ${searchBox(S, true)}
    <ul class="quick">${offers.filter(o => o.total).map(o => `<li><a href="${catURL(o)}">${icon(o.slug)}${esc(o.short)}</a></li>`).join('')}</ul>
  </div>
  ${S.hero.length ? `<p class="film-caption"><a href="/slott/${esc(S.hero[0].id)}/">${esc(S.hero[0].name)}</a><small>${esc(S.hero[0].credit)}</small></p>` : ''}
</section>

${S.featured.length ? `<section class="band band-dark">
  <div class="wrap">
    <div class="sec-head">
      <div><p class="kicker kicker-gold"><span>Virtuella rundturer</span></p><h2>Kliv in i slottet</h2></div>
      <p>Virtuella rundturer där du går runt i salarna själv, i din egen takt – var du än är.</p>
    </div>
    ${cards(S, S.featured)}
    <p class="more"><a class="btn btn-light" href="/virtuella-rundturer/">Alla ${nf(st.withTour)} slott med rundtur</a></p>
  </div>
</section>` : ''}

<section class="band">
  <div class="wrap">
    <div class="sec-head"><div><p class="kicker">Upptäck</p><h2>Vad vill du göra?</h2></div><p>Bo en natt på ett slott, gift dig i en slottssal eller gå på upptäcktsfärd i en borgruin.</p></div>
    <ul class="photo-tiles">${offerTiles.map(([o, c]) => `<li><a href="${catURL(o)}">${c ? `<img src="${esc(commonsImage(c.image, 500))}" alt="" loading="lazy" decoding="async">` : ''}<span class="pt-in">${icon(o.slug)}<strong>${esc(o.name)}</strong><small>${nf(o.total)} slott</small></span></a></li>`).join('')}</ul>
    <ul class="pills">${types.map(t => `<li><a href="${catURL(t)}">${esc(t.name)} <small>${nf(t.total)}</small></a></li>`).join('')}</ul>
  </div>
</section>

<section class="band band-paper2">
  <div class="wrap">
    <div class="sec-head">
      <div><p class="kicker">Hela Sverige</p><h2>Län för län</h2></div>
      <p>Från Skånes borgar till Uppsalas kungsgårdar. Den gyllene linjen visar hur stor del av länets slott du kan kliva in i digitalt.</p>
    </div>
    <ol class="county-list">${[...d.counties].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'sv')).map(co => `<li><a href="${countyURL(co)}"><strong>${esc(co.name)}</strong><span class="mini"><span style="width:${pct(co.withTour, co.total)}%"></span></span><small>${nf(co.total)} slott${co.withTour ? `<span class="visually-hidden">, ${nf(co.withTour)} med rundtur</span>` : ''}</small></a></li>`).join('')}</ol>
  </div>
</section>

<section class="band">
  <div class="wrap split">
    <div>
      <h2>Alla slott på en karta</h2>
      <p>Guldmarkerade slott har en virtuell rundtur. Filtrera på vad du vill göra och se vad som finns nära dig.</p>
      <p><a class="btn" href="/karta/">Öppna kartan</a></p>
    </div>
    <a class="map-teaser" href="/karta/" aria-label="Öppna kartan"><img src="${S.asset('/assets/img/karta.svg')}" alt="" width="560" height="420" loading="lazy"></a>
  </div>
</section>`,
  });
}

// Beskrivning för sökmotorer: läge, vad man kan göra och början av texten om slottet, helst 120–160 tecken.
const DO = { 'bo-pa-slott': 'bo', 'brollop-och-fest': 'gifta dig eller ha fest', konferens: 'ha konferens', 'restaurang-och-kafe': 'äta och fika',
  spa: 'gå på spa', besok: 'besöka slottet', 'park-och-tradgard': 'promenera i parken' };
function castleDesc(c, co, offerCats) {
  const parts = [`${c.name} – ${c.type.toLowerCase()} i ${kommunLabel(c.kommun)}, ${co ? co.full : c.lan}.`];
  if (c.tours.length) parts.push('Kliv in med en virtuell rundtur.');
  const verbs = offerCats.map(o => DO[o.slug]).filter(Boolean);
  if (verbs.length) parts.push(`Här kan du ${verbs.length > 1 ? verbs.slice(0, -1).join(', ') + ' och ' + verbs.at(-1) : verbs[0]}.`);
  let d = parts.join(' ');
  const text = (c.text || (c.wiki && c.wiki.text) || '').replace(/\s+/g, ' ').trim();
  if (d.length < 120 && text) {
    // Lägg till hela meningar ur texten så länge det ryms.
    for (const m of text.match(/[^.!?]+[.!?]+/g) || []) {
      if ((d + ' ' + m.trim()).length > 165) break;
      d += ' ' + m.trim();
    }
  }
  return d;
}

function castle(S, c) {
  const img = commonsImage(c.image, 1280), imgSm = commonsImage(c.image, 960);
  const imgXl = c.image && c.image.w > 1920 ? commonsImage(c.image, 1920) : null;
  const wiki = c.text ? [c.text] : wikiText(c.wiki && c.wiki.text);
  const co = S.countyBySlug.get(c.lanSlug);
  const offers = c.offers.map(o => S.catBySlug.get(o)).filter(Boolean);
  const near = S.nearby(c, 6);
  const t = c.tours[0];
  const facts = [
    ['Typ', c.type], ['Byggt', c.inception && +c.inception > 900 ? (c.inception.length === 4 ? c.inception : c.inception) : null],
    ['Används i dag', c.use], ['Öppet för besök', { Ja: 'Ja', Delvis: 'Delvis – se slottets egen webbplats', Nej: 'Nej, privat' }[c.open]],
    ['Kommun', kommunLabel(c.kommun)], ['Län', co ? co.full : c.lan],
  ].filter(f => f[1]);
  const directions = c.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lon}` : null;
  const offerCats = offers.filter(o => o.kind === 'offer');
  // Stor bild överst bara när bilden är skarp nog; annars bilden bredvid rubriken.
  const big = !!(img && c.image.w >= 1000);
  const titleBlock = `<p class="kicker${big ? ' kicker-gold' : ''}"><span>${esc(c.type)} · ${esc(kommunLabel(c.kommun))}</span></p>
    <h1>${esc(c.name)}</h1>
    ${offerCats.length ? `<p class="c-offers">${offerCats.map(o => `<a href="${catURL(o)}">${icon(o.slug)}${esc(o.short)}</a>`).join('')}</p>` : ''}
    <p class="actions">${t ? `<a class="btn btn-gold" href="#rundtur">${TOUR_ICON}Kliv in i slottet</a>` : ''}${c.website ? `<a class="btn ${big ? 'btn-light' : 'btn-ghost'}" href="${esc(c.website)}" target="_blank" rel="noopener">Slottets webbplats</a>` : ''}${directions ? `<a class="btn ${big ? 'btn-light' : 'btn-ghost'}" href="${esc(directions)}" target="_blank" rel="noopener">Hitta hit</a>` : ''}</p>`;
  const desc = castleDesc(c, co, offerCats);
  const tk = t ? (KIND[t.kind] || KIND.view) : null;
  const tourBlock = t ? `
<section class="tour" id="rundtur" aria-labelledby="rundtur-h">
  <div class="wrap tour-in">
    <div class="tour-text">
      <p class="kicker kicker-gold"><span>${esc(tk.label)}${t.title ? ` · ${esc(t.title)}` : ''}</span></p>
      <h2 id="rundtur-h">Kliv in i ${esc(c.name)}</h2>
      <p class="tour-lead">${esc(tk.lead)}</p>
      <p>${t.embed ? `<button class="btn btn-gold" type="button" data-start>${TOUR_ICON}${esc(tk.verb)}</button>` : `<a class="btn btn-gold" href="${esc(t.url)}" target="_blank" rel="noopener">${TOUR_ICON}${esc(tk.verb)}</a>`}</p>
      <p class="consent">${t.embed ? `Rundturen visas från ${esc(t.provider)} och laddas först när du startar den.` : `Öppnas i ett nytt fönster hos ${esc(t.provider)}.`}</p>
      <p class="credit">Rundtur: ${esc(t.provider)}${t.credit && t.credit.length ? ` · Foto: ${esc(t.credit.join(', '))}` : ''}${t.year ? ` · ${esc(t.year)}` : ''}${t.url && t.embed ? ` · <a href="${esc(t.url)}" target="_blank" rel="noopener">Öppna i nytt fönster</a>` : ''}</p>
    </div>
    <div class="tour-frame" data-embed="${esc(t.embed || '')}" data-title="${esc(c.name)}">
      ${imgSm ? `<img src="${esc(imgSm)}" alt="" class="poster" loading="lazy" decoding="async">` : ''}
      ${t.embed ? `<button class="portal" type="button" data-start aria-label="${esc(tk.verb)}">${TOUR_ICON}</button>` : `<a class="portal" href="${esc(t.url)}" target="_blank" rel="noopener" aria-label="${esc(tk.verb)}">${TOUR_ICON}</a>`}
    </div>
  </div>
  ${c.tours.length > 1 ? `<div class="wrap"><h3 class="more-tours">Fler rum att kliva in i</h3><ul class="tour-list">${c.tours.slice(1).map(tour => `<li><a href="${esc(tour.url)}" target="_blank" rel="noopener"><strong>${esc(tour.title || (KIND[tour.kind] || KIND.view).label)}</strong><small>${esc(tour.provider)}${tour.credit && tour.credit.length ? ` · Foto: ${esc(tour.credit.join(', '))}` : ''}</small></a></li>`).join('')}</ul></div>` : ''}
</section>` : `
<section class="tour-none" id="rundtur" aria-labelledby="rundtur-h">
  <div class="wrap">
    <div class="tour-none-in">
      <span class="door" aria-hidden="true"><svg viewBox="0 0 60 80"><path d="M4 78V30a26 26 0 0 1 52 0v48"/><path d="M14 78V32a16 16 0 0 1 32 0v46"/><path d="M30 16v62" opacity=".5"/><circle cx="25" cy="52" r="1.6"/><circle cx="35" cy="52" r="1.6"/></svg></span>
      <div>
        <h2 id="rundtur-h">Dörren till ${esc(c.name)} är ännu stängd</h2>
        <p>Det finns ingen virtuell rundtur av ${esc(c.name)} här än. ${nf(S.data.stats.withTour)} av Sveriges slott går redan att besöka digitalt, för den som har långt att resa, inte kan ta sig dit eller vill se salarna innan ett bröllop eller en konferens.</p>
        <p class="actions"><a class="btn btn-ghost" href="/for-slott/?slott=${esc(c.slug)}">Äger du slottet? Visa det inifrån</a></p>
        <p class="small">Finns det redan en rundtur? <a href="/tipsa/?slott=${esc(c.slug)}">Tipsa oss</a>.</p>
      </div>
    </div>
  </div>
</section>`;
  return layout(S, {
    title: `${c.name}${S.dupNames.has(c.name) ? ` (${c.kommun})` : ''}`, description: desc.slice(0, 300), path: castleURL(c), bodyClass: big ? 'overlay' : '',
    image: commonsImage(c.image, 1280) || undefined,
    scripts: [...(c.lat != null ? ['/assets/vendor/leaflet.js'] : []), '/assets/castle.js'],
    jsonld: [crumbLd(S, [['/', 'Start'], [countyURL(co), co.full], [castleURL(c), c.name]]), {
      '@context': 'https://schema.org', '@type': ['LandmarksOrHistoricalBuildings', 'TouristAttraction'], name: c.name,
      description: desc, url: S.config.domain + castleURL(c), ...(img ? { image: encodeURI(S.config.domain + img) } : {}),
      ...(c.lat != null ? { geo: { '@type': 'GeoCoordinates', latitude: c.lat, longitude: c.lon } } : {}),
      address: { '@type': 'PostalAddress', addressLocality: c.kommun, addressRegion: co ? co.full : c.lan, addressCountry: 'SE' },
      ...(c.website || c.qid || c.wiki ? { sameAs: [c.website, c.qid && `https://www.wikidata.org/wiki/${c.qid}`,
        c.wiki && `https://sv.wikipedia.org/wiki/${encodeURIComponent(c.wiki.title.replace(/ /g, '_'))}`].filter(Boolean) } : {}),
    }],
    body: `
${big ? `<header class="c-hero">
  <img class="c-hero-img" src="${esc(img)}" srcset="${esc(imgSm)} 960w, ${esc(img)} 1280w${imgXl ? `, ${esc(imgXl)} 1920w` : ''}" sizes="(max-width: 700px) 250vw, 100vw" alt="${esc(c.name)}" fetchpriority="high">
  <div class="hero-shade" aria-hidden="true"></div>
  <div class="wrap c-hero-top">${crumbs([['/', 'Start'], [countyURL(co), co.full], [castleURL(c), c.name]])}</div>
  <div class="wrap c-hero-in">
    ${titleBlock}
  </div>
  <p class="film-caption"><small>${c.image.artist ? `Foto: ${esc(c.image.artist)}` : 'Foto'}${c.image.license ? `, ${esc(c.image.license)}` : ''} · <a href="${esc(c.image.page || 'https://commons.wikimedia.org/wiki/File:' + c.image.file)}" target="_blank" rel="noopener">Wikimedia Commons</a></small></p>
</header>` : `<div class="wrap">${crumbs([['/', 'Start'], [countyURL(co), co.full], [castleURL(c), c.name]])}</div>
<header class="c-head"><div class="wrap c-head-in"><div>${titleBlock}</div>${img ? `<figure class="c-img"><img src="${esc(img)}" alt="${esc(c.name)}" fetchpriority="high"><figcaption>${c.image.artist ? `Foto: ${esc(c.image.artist)}` : 'Foto'}${c.image.license ? `, ${esc(c.image.license)}` : ''} · <a href="${esc(c.image.page || 'https://commons.wikimedia.org/wiki/File:' + c.image.file)}" target="_blank" rel="noopener">Wikimedia Commons</a></figcaption></figure>` : ''}</div></header>`}
${tourBlock}
<section class="c-body">
  <div class="wrap c-grid">
    <div class="c-text">
      <h2>Om ${esc(c.name)}</h2>
      ${wiki.length ? wiki.map(p => `<p>${esc(p)}</p>`).join('') : `<p>${esc(c.name)} är ${esc(c.type.toLowerCase())} i ${esc(kommunLabel(c.kommun))}.</p>`}
      ${c.wiki && !c.text ? `<p class="source">Text från <a href="https://sv.wikipedia.org/wiki/${encodeURIComponent(c.wiki.title.replace(/ /g, '_'))}" target="_blank" rel="noopener">Wikipedia</a> (CC BY-SA 4.0).</p>` : ''}
      ${offerCats.length ? `<h3>Här kan du</h3><ul class="offer-list">${offerCats.map(o => `<li><a href="${catURL(o)}">${icon(o.slug)}<span>${esc(o.short)}</span></a></li>`).join('')}</ul>
      <p class="small">Kontrollera alltid öppettider, priser och bokning på slottets egen webbplats.</p>` : ''}
    </div>
    <aside class="c-side">
      <dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${c.lat != null ? `<link rel="stylesheet" href="${S.asset('/assets/vendor/leaflet.css')}"><div class="mini-map" id="minikarta" data-lat="${c.lat}" data-lon="${c.lon}" data-name="${esc(c.name)}" role="img" aria-label="Karta över läget för ${esc(c.name)}"></div>` : ''}
      <p class="small">Stämmer något inte? <a href="/tipsa/?slott=${esc(c.slug)}">Tipsa oss</a> · Är det ditt slott? <a href="/for-slott/?slott=${esc(c.slug)}">Uppdatera uppgifterna</a></p>
    </aside>
  </div>
</section>
${near.length ? `<section class="band band-paper2">
  <div class="wrap">
    <h2>Fler slott i närheten</h2>
    ${cards(S, near)}
  </div>
</section>` : ''}`,
  });
}

function listPage(S, { title, h1, intro, path, list, crumbsList, extra = '', countyFilter = null, noCounty = false, kicker = '' }) {
  const sorted = [...list].sort(byTour);
  const tours = sorted.filter(c => c.tours.length).length;
  // Sidhuvudet får en bild från ett av de första slotten i listan (helst ett med rundtur).
  const hero = sorted.find(c => c.image && c.image.w >= 1280) || sorted.find(c => c.image);
  return layout(S, {
    title, path, description: `${intro} ${nf(list.length)} slott${tours ? `, varav ${nf(tours)} med virtuell rundtur` : ''}.`,
    bodyClass: hero ? 'overlay' : '', image: hero ? commonsImage(hero.image, 1280) : undefined, jsonld: crumbLd(S, crumbsList),
    body: `
${hero ? `<header class="page-hero">
  <img class="c-hero-img" src="${esc(commonsImage(hero.image, 1280))}" srcset="${esc(commonsImage(hero.image, 960))} 960w, ${esc(commonsImage(hero.image, 1280))} 1280w${hero.image.w > 1920 ? `, ${esc(commonsImage(hero.image, 1920))} 1920w` : ''}" sizes="100vw" alt="" fetchpriority="high">
  <div class="hero-shade" aria-hidden="true"></div>
  <div class="wrap c-hero-top">${crumbs(crumbsList)}</div>
  <div class="wrap page-hero-in">
    ${kicker ? `<p class="kicker kicker-gold"><span>${esc(kicker)}</span></p>` : ''}
    <h1>${esc(h1)}</h1>
    <p class="lead">${esc(intro)}</p>
  </div>
  <p class="film-caption"><a href="${castleURL(hero)}">${esc(hero.name)}</a><small>${hero.image.artist ? `Foto: ${esc(hero.image.artist)}` : ''}${hero.image.license ? `, ${esc(hero.image.license)}` : ''}, Wikimedia Commons</small></p>
</header>` : `<div class="wrap">${crumbs(crumbsList)}</div>
<header class="page-head"><div class="wrap"><h1>${esc(h1)}</h1><p class="lead">${esc(intro)}</p></div></header>`}
<section class="band band-tight">
  <div class="wrap">
    ${extra ? `<div class="list-extra">${extra}</div>` : ''}
    ${countyFilter || ''}
    ${sorted.length ? `<p class="count">${nf(sorted.length)} slott${tours ? ` · <span class="lit-text">${nf(tours)} med virtuell rundtur</span>` : ''}</p>${cards(S, sorted, { noCounty })}` : '<p>Inga slott här ännu.</p>'}
  </div>
</section>`,
  });
}

function category(S, cat, co) {
  const list = S.data.castles.filter(c => c.offers.includes(cat.slug) && (!co || c.lanSlug === co.slug));
  const counties = S.data.counties.map(x => [x, S.data.castles.filter(c => c.offers.includes(cat.slug) && c.lanSlug === x.slug).length]).filter(x => x[1]);
  const filter = `<nav class="chips" aria-label="Välj län"><a href="${catURL(cat)}"${!co ? ' aria-current="page"' : ''}>Hela Sverige</a>${counties.map(([x, n]) => `<a href="${catURL(cat, x)}"${co && co.slug === x.slug ? ' aria-current="page"' : ''}>${esc(x.name)} <small>${n}</small></a>`).join('')}</nav>`;
  const h1 = co ? `${cat.name} i ${co.name}` : cat.name;
  return listPage(S, {
    title: h1, h1, kicker: co ? co.full : `${nf(list.length)} slott i hela Sverige`, intro: co ? `${cat.intro.replace(/\.$/, '')} i ${co.full}.` : cat.intro, path: catURL(cat, co), list, countyFilter: filter,
    crumbsList: co ? [['/', 'Start'], [catURL(cat), cat.name], [catURL(cat, co), co.name]] : [['/', 'Start'], [catURL(cat), cat.name]],
  });
}

// Ingress per län, byggd av registret: kända slott först och vad man kan göra där.
function countyIntro(co, list) {
  const and = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' och ' + a.at(-1) : a[0];
  const top = [...list].sort((a, b) => a.prio - b.prio || (b.tours.length > 0) - (a.tours.length > 0) || (b.image ? 1 : 0) - (a.image ? 1 : 0)).slice(0, 3).map(c => c.name);
  let t = list.length > 3 ? `Slott, borgar och fästningar i ${co.full}, bland dem ${and(top)}.` : `Från ${co.full} finns än så länge ${and(top)} i registret.`;
  if (list.length === 1) return t;
  const n = slug => list.filter(c => c.offers.includes(slug)).length;
  const W = ['', 'ett', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio', 'elva', 'tolv'];
  const bits = [[n('bo-pa-slott'), 'går att bo på'], [n('brollop-och-fest'), 'tar emot bröllop'], [n('besok'), k => k === 1 ? 'är öppet för besök' : 'är öppna för besök']]
    .filter(x => x[0]).map(([k, v], i) => `${k === list.length ? (k === 2 ? 'båda' : `alla ${W[k] || k}`) : `${W[k] || k}${i ? '' : ' av dem'}`} ${typeof v === 'function' ? v(k) : v}`);
  if (bits.length) t += ' ' + and(bits).replace(/^./, x => x.toUpperCase()) + '.';
  return t;
}

function county(S, co) {
  const list = S.data.castles.filter(c => c.lanSlug === co.slug);
  const cats = S.data.categories.map(cat => [cat, list.filter(c => c.offers.includes(cat.slug)).length]).filter(x => x[1]);
  return listPage(S, {
    title: `Slott i ${co.full}`, h1: `Slott i ${co.name}`, path: countyURL(co), list, noCounty: true, kicker: list.length === 1 ? '1 slott i registret' : `${nf(list.length)} slott, borgar och fästningar`,
    intro: countyIntro(co, list),
    crumbsList: [['/', 'Start'], ['/lan/', 'Län'], [countyURL(co), co.name]],
    extra: coverage(co.withTour, co.total, 'slott i länet går att besöka digitalt') +
      `<nav class="chips" aria-label="Kategorier i länet">${cats.map(([cat, n]) => `<a href="${catURL(cat, co)}">${esc(cat.short)} <small>${n}</small></a>`).join('')}</nav>`,
  });
}

function countiesIndex(S) {
  const d = S.data;
  // En bild per län: länets bästa slott med bild (rundtur först, sedan prioritet).
  const pick = co => d.castles.filter(c => c.lanSlug === co.slug && c.image)
    .sort((a, b) => (b.tours.length > 0) - (a.tours.length > 0) || a.prio - b.prio || (b.image.w || 0) - (a.image.w || 0))[0];
  const list = [...d.counties].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'sv'));
  return layout(S, {
    title: 'Slott län för län', path: '/lan/', description: 'Sveriges slott, borgar och fästningar län för län – från Skånes borgar till Norrbottens herrgårdar.',
    jsonld: crumbLd(S, [['/', 'Start'], ['/lan/', 'Län']]),
    body: `
<div class="wrap">${crumbs([['/', 'Start'], ['/lan/', 'Län']])}</div>
<header class="page-head"><div class="wrap"><p class="kicker kicker-gold"><span>${nf(d.counties.length)} län</span></p><h1>Slott län för län</h1>
<p class="lead">Välj ett län och se dess slott, borgar och fästningar. ${nf(d.stats.withTour)} av Sveriges ${nf(d.stats.total)} slott i registret kan du redan kliva in i digitalt.</p></div></header>
<section class="band band-tight"><div class="wrap">
<ul class="photo-tiles county-tiles">${list.map(co => { const c = pick(co); return `<li><a href="${countyURL(co)}">${c ? `<img src="${esc(commonsImage(c.image, 500))}" alt="" loading="lazy" decoding="async">` : ''}<span class="pt-in"><strong>${esc(co.name)}</strong><small>${nf(co.total)} slott${co.withTour ? ` · ${nf(co.withTour)} med rundtur` : ''}</small></span></a></li>`; }).join('')}</ul>
</div></section>`,
  });
}

function tours(S) {
  const list = S.data.castles.filter(c => c.tours.length);
  return listPage(S, {
    title: 'Slott med virtuell rundtur', h1: 'Kliv in i slottet', path: '/virtuella-rundturer/', list, kicker: 'Virtuella rundturer',
    intro: 'Slott du kan gå runt i digitalt – i din egen takt, var du än är. För den som har långt att resa, inte kan ta sig dit eller vill se salarna före ett bröllop eller en konferens.',
    crumbsList: [['/', 'Start'], ['/virtuella-rundturer/', 'Virtuella rundturer']],
    extra: coverage(S.data.stats.withTour, S.data.stats.total, 'slott i registret har en virtuell rundtur'),
  });
}

function mapPage(S) {
  return layout(S, {
    title: 'Karta över Sveriges slott', path: '/karta/', bodyClass: 'map-body',
    description: 'Alla slott, borgar och fästningar i registret på en karta. Guldmarkerade slott har en virtuell rundtur.',
    scripts: ['/assets/vendor/leaflet.js', '/assets/map.js'],
    body: `
<div class="map-layout">
  <aside class="map-panel">
    <p class="kicker">${nf(S.data.stats.total)} slott</p>
    <h1 class="map-title">Karta över Sveriges slott</h1>
    ${searchBox(S)}
    <fieldset class="map-filter"><legend class="visually-hidden">Visa</legend>
      <label><input type="checkbox" id="bara-rundtur"> Bara slott med virtuell rundtur</label>
      <select id="kategori" aria-label="Kategori"><option value="">Alla slott</option>${S.data.categories.map(c => `<option value="${c.slug}">${esc(c.name)}</option>`).join('')}</select>
    </fieldset>
    <p class="legend"><span><span class="dot dot-gold"></span> Virtuell rundtur</span> <span><span class="dot dot-grey"></span> Ingen rundtur ännu</span></p>
    <p class="count" data-count aria-live="polite"></p>
    <ul id="kartlista" class="map-list"></ul>
  </aside>
  <div id="karta" class="map" role="region" aria-label="Karta"></div>
</div>
<link rel="stylesheet" href="${S.asset('/assets/vendor/leaflet.css')}">`,
  });
}

function searchPage(S) {
  return layout(S, {
    title: 'Sök', path: '/sok/', noindex: true, scripts: ['/assets/search.js'], bodyClass: 'overlay',
    body: `
<header class="page-dark"><div class="wrap"><p class="kicker kicker-gold"><span>${nf(S.data.stats.total)} slott, borgar och fästningar</span></p><h1>Sök bland Sveriges slott</h1>${searchBox(S, true)}</div></header>
<section class="band band-tight"><div class="wrap"><p class="count" id="sok-antal" aria-live="polite"></p><ul class="cards" id="sok-traffar"></ul></div></section>`,
  });
}

function textPage(S, { title, path, body, description, scripts }) {
  return layout(S, { title, path, description, scripts, body: `<div class="wrap">${crumbs([['/', 'Start'], [path, title]])}</div><article class="prose wrap"><p class="kicker kicker-gold"><span>Slottsregistret</span></p>${body}</article>` });
}

function about(S) {
  const st = S.data.stats;
  return textPage(S, { title: 'Om Slottsregistret', path: '/om/', body: `
<h1>Om Slottsregistret</h1>
<p class="lead">Slottsregistret samlar Sveriges slott, borgar, fästningar och slottsmiljöer på ett ställe – med vad du kan göra där, och vägen in.</p>
<p>Registret har i dag ${nf(st.total)} slott, och ${nf(st.withTour)} av dem går att besöka digitalt med en virtuell rundtur. Rundturerna gör slotten tillgängliga för den som har långt att resa, inte kan ta sig dit, eller vill se salarna innan ett bröllop, en konferens eller en vistelse.</p>
<h2>Varifrån kommer uppgifterna?</h2>
<p>Grunduppgifterna – läge, byggår, bilder och texter – kommer från öppna källor: Wikidata, Wikipedia och Wikimedia Commons. Vad slotten används till och vad du kan göra där har vi sammanställt från slottens egna webbplatser. Rundturerna kommer från slotten själva och från fotografer som har publicerat dem. Upphov och licens står vid varje bild och text.</p>
<p>Öppettider och priser ändras. Kontrollera alltid hos slottet innan du åker.</p>
<h2>Vem står bakom?</h2>
<p>Slottsregistret drivs av ${esc(S.config.company)} och är en del av samma familj som <a href="https://svenskakyrkor.se">Svenskakyrkor.se</a>.</p>
<p>Hittar du ett fel, eller känner du till en rundtur som saknas? <a href="/tipsa/">Tipsa oss</a>.</p>` });
}

function contact(S) {
  return textPage(S, { title: 'Kontakt', path: '/kontakt/', body: `
<h1>Kontakt</h1>
<p>Frågor, rättelser eller samarbeten: <a href="mailto:${esc(S.config.contactEmail)}">${esc(S.config.contactEmail)}</a>.</p>
<p>Äger eller förvaltar du ett slott? Läs mer på sidan <a href="/for-slott/">För slott och slottsägare</a>.</p>
<p>Ansvarig för sajten och personuppgifterna: ${esc(S.config.owner)}, ${esc(S.config.company)}.</p>` });
}

function privacy(S) {
  return textPage(S, { title: 'Integritet', path: '/integritet/', body: `
<h1>Integritet och kakor</h1>
<p>Slottsregistret sätter inga egna kakor och använder ingen spårning för annonser.</p>
<h2>Bilder och kartor</h2>
<p>Bilder från Wikimedia Commons och kartplattor från OpenStreetMap hämtas via slottsregistret.se, så att Wikimedia och OpenStreetMap inte ser ditt besök.</p>
<h2>Virtuella rundturer</h2>
<p>En rundtur laddas först när du trycker på knappen för att starta den. Då hämtas den från leverantören (till exempel Google, Matterport eller Kuula), som kan sätta egna kakor enligt sina villkor. Att starta rundturen är ditt samtycke till det.</p>
<h2>Formulär</h2>
<p>Det du skickar via våra formulär sparas i högst två år och används bara för att svara dig och uppdatera registret. Ansvarig: ${esc(S.config.owner)}, ${esc(S.config.company)}, <a href="mailto:${esc(S.config.contactEmail)}">${esc(S.config.contactEmail)}</a>.</p>` });
}

function formFields(S, name) {
  return `<input type="hidden" name="formular" value="${name}"><input type="hidden" name="tack" value="/tack/">
<div class="trap" aria-hidden="true"><label>Lämna tomt <input name="webbplats" tabindex="-1" autocomplete="off"></label></div>`;
}

function castleSelect(S, required) {
  return `<label for="slott">Slott${required ? '' : ' (om det gäller ett visst slott)'}</label>
<select id="slott" name="slott"${required ? ' required' : ''}><option value="">Välj slott</option>${[...S.data.castles].sort((a, b) => a.name.localeCompare(b.name, 'sv')).map(c => `<option value="${esc(c.slug)}">${esc(c.name)} (${esc(c.kommun)})</option>`).join('')}<option value="annat">Ett slott som saknas</option></select>`;
}

function forCastles(S) {
  const st = S.data.stats, path = '/for-slott/';
  const hero = S.hero.find(h => h.id === 'drottningholms-slott') || S.hero[0];
  return layout(S, { title: 'För slott och slottsägare', path, scripts: ['/assets/form.js'], bodyClass: hero ? 'overlay' : '',
    description: 'Visa ert slott inifrån för besökare, bröllopspar och konferensgäster – och håll uppgifterna om slottet aktuella.', body: `
<header class="page-hero sales-hero">
  ${hero ? `<img class="c-hero-img" src="${S.asset(`/assets/hero/${hero.id}-1600.jpg`)}" alt="" fetchpriority="high">` : ''}
  <div class="hero-shade" aria-hidden="true"></div>
  <div class="wrap c-hero-top">${crumbs([['/', 'Start'], [path, 'För slott och slottsägare']])}</div>
  <div class="wrap page-hero-in">
    <p class="kicker kicker-gold"><span>För slott och slottsägare</span></p>
    <h1>Låt gästerna kliva in <em class="gold-text">innan de bokar</em></h1>
    <p class="lead">Brudpar, konferensbokare och resenärer vill se salarna innan de bestämmer sig. Med en virtuell rundtur kan de gå runt i ert slott redan i dag, var de än är.</p>
    <p class="actions"><a class="btn btn-gold" href="#formular">${TOUR_ICON}Visa ert slott inifrån</a><a class="btn btn-light" href="/virtuella-rundturer/">Se slott med rundtur</a></p>
  </div>
</header>
<section class="band">
  <div class="wrap">
    <ul class="stats">
      <li><b>${nf(st.total)}</b><span>slott, borgar och fästningar i registret</span></li>
      <li><b class="gold-text">${nf(st.withTour)}</b><span>går redan att besöka digitalt</span></li>
      <li><b>1:a</b><span>Slott med rundtur visas först i sök, listor och på kartan</span></li>
    </ul>
    <ul class="benefits">
      <li>${TOUR_ICON}<h2>Visa slottet inifrån</h2><p>Har ni redan en rundtur visar vi den på ert slotts sida. Saknar ni en hjälper vi er att ta fram en, som ni också kan använda på er egen webbplats.</p></li>
      <li>${icon('brollop-och-fest')}<h2>Fler förfrågningar</h2><p>Den som redan har gått runt i festsalen eller konferensrummet hemifrån vet vad de bokar. Rundturen visar slottet innan visningen.</p></li>
      <li>${icon('besok')}<h2>Rätt uppgifter</h2><p>Text, bilder, vad ni erbjuder (boende, spa, konferens, bröllop, restaurang, visningar) och länk till er bokning. Snart kan ni sköta sidan själva.</p></li>
    </ul>
  </div>
</section>
<section class="band band-paper2" id="formular">
  <div class="wrap form-split">
    <div>
      <p class="kicker">Kontakt</p>
      <h2>Berätta om ert slott</h2>
      <p>Skicka uppgifterna här så hör vi av oss.</p>
      <p class="small">Hellre e-post? <a href="mailto:${esc(S.config.contactEmail)}">${esc(S.config.contactEmail)}</a></p>
    </div>
    <form class="form" method="post" action="/api/skicka" data-form>
${formFields(S, 'slott')}
${castleSelect(S, true)}
<fieldset><legend>Det gäller</legend>
  <label><input type="checkbox" name="vill" value="Vi vill ta fram en virtuell rundtur"> Vi vill ta fram en virtuell rundtur</label>
  <label><input type="checkbox" name="vill" value="Vi har en rundtur som ska visas"> Vi har redan en rundtur som ska visas</label>
  <label><input type="checkbox" name="vill" value="Uppdatera uppgifterna om slottet"> Uppdatera uppgifterna om slottet</label>
  <label><input type="checkbox" name="vill" value="Logga in och sköta sidan själva"> Vi vill kunna logga in och sköta sidan själva</label>
</fieldset>
<label for="lank">Länk till rundturen eller er webbplats (om ni har)</label><input id="lank" name="lank" type="url" inputmode="url">
<label for="namn">Ditt namn</label><input id="namn" name="namn" required autocomplete="name">
<label for="roll">Roll</label><input id="roll" name="roll" placeholder="t.ex. ägare, förvaltare, marknadsansvarig" autocomplete="organization-title">
<label for="epost">E-post</label><input id="epost" name="epost" type="email" required autocomplete="email">
<label for="telefon">Telefon (frivilligt)</label><input id="telefon" name="telefon" type="tel" autocomplete="tel">
<label for="meddelande">Meddelande</label><textarea id="meddelande" name="meddelande" rows="5"></textarea>
<button class="btn btn-gold" type="submit">Skicka</button>
<p class="small">Vi sparar uppgifterna i högst två år och använder dem bara för att svara er. Se <a href="/integritet/">integritet</a>.</p>
</form>
  </div>
</section>` });
}

function tip(S) {
  return textPage(S, { title: 'Tipsa oss', path: '/tipsa/', scripts: ['/assets/form.js'], description: 'Tipsa om en virtuell rundtur som saknas eller ett fel i registret.', body: `
<h1>Tipsa oss</h1>
<p class="lead">Känner du till en virtuell rundtur av ett slott som saknas här, eller har du hittat ett fel?</p>
<form class="form" method="post" action="/api/skicka" data-form>
${formFields(S, 'tips')}
${castleSelect(S, false)}
<fieldset><legend>Det gäller</legend>
  <label><input type="radio" name="vad" value="En rundtur som saknas" required> En rundtur som saknas</label>
  <label><input type="radio" name="vad" value="En rundtur som inte fungerar"> En rundtur som inte fungerar</label>
  <label><input type="radio" name="vad" value="Fel uppgift"> Fel uppgift om slottet</label>
  <label><input type="radio" name="vad" value="Slott som saknas"> Ett slott som saknas i registret</label>
  <label><input type="radio" name="vad" value="Annat"> Annat</label>
</fieldset>
<label for="lank">Länk (frivilligt)</label><input id="lank" name="lank" type="url" inputmode="url">
<label for="meddelande">Beskriv gärna</label><textarea id="meddelande" name="meddelande" rows="5"></textarea>
<label for="epost">Din e-post (frivilligt, om du vill ha svar)</label><input id="epost" name="epost" type="email" autocomplete="email">
<button class="btn btn-gold" type="submit">Skicka tipset</button>
</form>` });
}

function thanks(S) {
  return textPage(S, { title: 'Tack', path: '/tack/', body: `<h1>Tack!</h1><p class="lead">Vi har tagit emot det du skickade och hör av oss om vi behöver veta mer.</p><p><a class="btn" href="/">Till startsidan</a></p>` });
}

function notFound(S) {
  return layout(S, { title: 'Sidan finns inte', path: '/404.html', noindex: true, bodyClass: 'overlay', body: `<header class="page-hero nf-hero">${S.hero.length ? `<img class="c-hero-img" src="${S.asset(`/assets/hero/${S.hero[S.hero.length - 1].id}-1600.jpg`)}" alt="">` : ''}<div class="hero-shade" aria-hidden="true"></div>
<div class="wrap page-hero-in"><p class="kicker kicker-gold"><span>Sidan finns inte</span></p><h1>Här tog vägen slut</h1><p class="lead">Sidan kan ha flyttats. Sök efter slottet i stället, eller gå till <a href="/">startsidan</a>.</p>${searchBox(S, true)}</div></header>` });
}

module.exports = { home, castle, category, county, countiesIndex, tours, mapPage, searchPage, about, contact, privacy, forCastles, tip, thanks, notFound, castleURL, countyURL, catURL };
