'use strict';
// Sidmallarna. Varje funktion får sammanhanget S (se build.js) och returnerar en hel HTML-sida.
const { esc, nf, pct, commonsImage, wikiText, kommunLabel } = require('./lib');

const KIND = {
  walk: { label: 'Virtuell rundvandring', verb: 'Gå runt i slottet' },
  look: { label: 'Titta runt från en plats', verb: 'Titta runt' },
  view: { label: 'Se slottet inifrån', verb: 'Se slottet inifrån' },
};
const castleURL = c => `/slott/${c.slug}/`;
const countyURL = co => `/lan/${co.slug}/`;
const catURL = (cat, co) => `/${cat.slug}/${co ? co.slug + '/' : ''}`;

// ---------- Delar ----------
function layout(S, { title, description, path, body, image, jsonld, scripts = [], noindex = false, bodyClass = '' }) {
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
<link rel="stylesheet" href="${S.asset('/assets/style.css')}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
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

function crumbs(items) {
  return `<nav class="crumbs" aria-label="Brödsmulor"><ol>${items.map(([u, t], i) => i < items.length - 1 ? `<li><a href="${u}">${esc(t)}</a></li>` : `<li aria-current="page">${esc(t)}</li>`).join('')}</ol></nav>`;
}

function badge(c) {
  return c.tours.length ? `<span class="tag tag-tour">${esc(KIND[c.tours[0].kind] ? KIND[c.tours[0].kind].label : 'Virtuell rundtur')}</span>` : '';
}

function card(S, c, opts = {}) {
  const img = commonsImage(c.image, 500);
  const offers = c.offers.map(o => S.catBySlug.get(o)).filter(x => x && x.kind === 'offer' && x.slug !== 'besok').slice(0, 3);
  return `<li class="card${c.tours.length ? ' has-tour' : ''}">
  <a href="${castleURL(c)}">
    <span class="card-img">${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async" width="500" height="333">` : '<span class="ph" aria-hidden="true"></span>'}${c.tours.length ? '<span class="lit" aria-hidden="true">Kliv in</span>' : ''}</span>
    <span class="card-body">
      <strong>${esc(c.name)}</strong>
      <small>${esc(c.kommun)}${opts.noCounty ? '' : ` · ${esc(c.lan)}`}</small>
      <span class="tags">${badge(c)}${offers.map(o => `<span class="tag">${esc(o.short)}</span>`).join('')}</span>
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
  <input id="q${big ? 'h' : ''}" name="q" type="search" autocomplete="off" placeholder="Sök slott, ort eller t.ex. ”bröllop Skåne”" data-search>
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
  const ICON = {
    'bo-pa-slott': '<path d="M4 20V10l8-5 8 5v10M9 20v-5h6v5"/>', spa: '<path d="M12 4c3 4 5 6.5 5 9a5 5 0 0 1-10 0c0-2.5 2-5 5-9Z"/>',
    konferens: '<path d="M4 6h16v10H4zM9 20h6M12 16v4"/>', 'brollop-och-fest': '<circle cx="9" cy="13" r="5"/><circle cx="15" cy="13" r="5"/>',
    'restaurang-och-kafe': '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M16 3c-2 2-2 6 0 8v10"/>', besok: '<path d="M3 21h18M5 21V9l7-5 7 5v12M10 21v-6h4v6"/>',
    'park-och-tradgard': '<path d="M12 21v-7M12 14c-4 0-6-3-6-6 3 0 6 2 6 6Zm0 0c4 0 6-3 6-6-3 0-6 2-6 6Z"/>',
  };
  return layout(S, {
    path: '/', bodyClass: 'home',
    jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: S.config.name, url: S.config.domain + '/',
      potentialAction: { '@type': 'SearchAction', target: S.config.domain + '/sok/?q={q}', 'query-input': 'required name=q' } },
    body: `
<section class="hero">
  <div class="hero-bg" aria-hidden="true"></div>
  <div class="wrap hero-in">
    <p class="kicker">${nf(st.total)} slott, borgar och fästningar</p>
    <h1>Sveriges slott – <em>och vägen in</em></h1>
    <p class="lead">Hitta slott att besöka, bo på, gifta dig eller ha konferens på. Och kliv in i dem redan nu: ${nf(st.withTour)} slott kan du gå runt i digitalt.</p>
    ${searchBox(S, true)}
    <ul class="quick">${offers.filter(o => o.total).map(o => `<li><a href="${catURL(o)}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[o.slug] || ''}</svg>${esc(o.short)}</a></li>`).join('')}</ul>
  </div>
</section>

${S.featured.length ? `<section class="band band-dark">
  <div class="wrap">
    <div class="sec-head">
      <h2>Kliv in i slottet</h2>
      <p>Virtuella rundturer där du går runt i salarna själv, i din egen takt – var du än är.</p>
    </div>
    ${cards(S, S.featured)}
    <p class="more"><a class="btn btn-light" href="/virtuella-rundturer/">Alla ${nf(st.withTour)} slott med rundtur</a></p>
  </div>
</section>` : ''}

<section class="band">
  <div class="wrap">
    <div class="sec-head"><h2>Vad vill du göra?</h2></div>
    <ul class="tiles">${offers.filter(o => o.total).map(o => `<li><a href="${catURL(o)}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[o.slug] || ''}</svg><strong>${esc(o.name)}</strong><small>${nf(o.total)} slott</small></a></li>`).join('')}</ul>
    <ul class="pills">${types.map(t => `<li><a href="${catURL(t)}">${esc(t.name)} <small>${nf(t.total)}</small></a></li>`).join('')}</ul>
  </div>
</section>

<section class="band band-paper2">
  <div class="wrap">
    <div class="sec-head">
      <h2>Län för län</h2>
      <p>Hur många av länets slott går att besöka digitalt? Andelen räknas på slotten i registret.</p>
    </div>
    <ol class="county-list">${[...d.counties].sort((a, b) => pct(b.withTour, b.total) - pct(a.withTour, a.total) || b.total - a.total).map(co => `<li><a href="${countyURL(co)}"><strong>${esc(co.name)}</strong><span class="mini"><span style="width:${pct(co.withTour, co.total)}%"></span></span><small>${nf(co.withTour)} av ${nf(co.total)} · ${pct(co.withTour, co.total)} %</small></a></li>`).join('')}</ol>
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

function castle(S, c) {
  const img = commonsImage(c.image, 1280), imgSm = commonsImage(c.image, 960);
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
  const desc = `${c.name} – ${c.type.toLowerCase()} i ${kommunLabel(c.kommun)}, ${co ? co.full : c.lan}.${c.tours.length ? ' Kliv in med en virtuell rundtur.' : ''} ${offers.filter(o => o.kind === 'offer').map(o => o.short).join(', ')}`.trim();
  const tourBlock = t ? `
<section class="tour" id="rundtur" aria-labelledby="rundtur-h">
  <div class="wrap">
    <h2 id="rundtur-h">Kliv in i ${esc(c.name)}</h2>
    ${c.tours.map((tour, i) => `<div class="tour-frame" data-embed="${esc(tour.embed || '')}" data-url="${esc(tour.url || '')}" data-title="${esc(c.name)}">
      ${imgSm ? `<img src="${esc(imgSm)}" alt="" class="poster">` : ''}
      <div class="tour-cta">
        <p class="kind">${esc((KIND[tour.kind] || KIND.view).label)}${tour.title ? ` · ${esc(tour.title)}` : ''}</p>
        ${tour.embed ? `<button class="btn btn-gold" type="button" data-start>${esc((KIND[tour.kind] || KIND.view).verb)}</button>` : `<a class="btn btn-gold" href="${esc(tour.url)}" target="_blank" rel="noopener">${esc((KIND[tour.kind] || KIND.view).verb)}</a>`}
        <p class="consent">${tour.embed ? `Rundturen visas från ${esc(tour.provider)} och laddas först när du startar den.` : `Öppnas hos ${esc(tour.provider)}.`}</p>
      </div>
    </div>
    <p class="credit">Rundtur: ${esc(tour.provider)}${tour.credit && tour.credit.length ? ` · Foto: ${esc(tour.credit.join(', '))}` : ''}${tour.year ? ` · ${esc(tour.year)}` : ''}${tour.url ? ` · <a href="${esc(tour.url)}" target="_blank" rel="noopener">Öppna i nytt fönster</a>` : ''}</p>`).join('')}
  </div>
</section>` : `
<section class="tour tour-none" id="rundtur" aria-labelledby="rundtur-h">
  <div class="wrap tour-none-in">
    <div>
      <h2 id="rundtur-h">Gå in i ${esc(c.name)}</h2>
      <p>Det finns ännu ingen virtuell rundtur av ${esc(c.name)} här. ${nf(S.data.stats.withTour)} av Sveriges slott går redan att besöka digitalt – för den som har långt att resa, inte kan ta sig dit eller vill se salarna innan ett bröllop eller en konferens.</p>
      <p class="small">Äger eller förvaltar du ${esc(c.name)}? <a href="/for-slott/?slott=${esc(c.slug)}">Visa slottet inifrån</a> – eller <a href="/tipsa/?slott=${esc(c.slug)}">tipsa oss</a> om det redan finns en rundtur.</p>
    </div>
  </div>
</section>`;
  return layout(S, {
    title: `${c.name}${S.dupNames.has(c.name) ? ` (${c.kommun})` : ''}`, description: desc.slice(0, 300), path: castleURL(c),
    image: commonsImage(c.image, 1280) || undefined,
    scripts: ['/assets/castle.js', ...(c.lat != null ? ['/assets/vendor/leaflet.js'] : [])],
    jsonld: {
      '@context': 'https://schema.org', '@type': ['LandmarksOrHistoricalBuildings', 'TouristAttraction'], name: c.name,
      url: S.config.domain + castleURL(c), ...(img ? { image: S.config.domain + img } : {}),
      ...(c.lat != null ? { geo: { '@type': 'GeoCoordinates', latitude: c.lat, longitude: c.lon } } : {}),
      address: { '@type': 'PostalAddress', addressLocality: c.kommun, addressRegion: co ? co.full : c.lan, addressCountry: 'SE' },
      ...(c.website ? { sameAs: [c.website] } : {}),
    },
    body: `
<div class="wrap">${crumbs([['/', 'Start'], [countyURL(co), co.full], [castleURL(c), c.name]])}</div>
<header class="c-head">
  <div class="wrap c-head-in">
    <div class="c-title">
      <p class="kicker">${esc(c.type)} · ${esc(kommunLabel(c.kommun))}</p>
      <h1>${esc(c.name)}</h1>
      <p class="tags">${badge(c)}${offers.map(o => `<a class="tag" href="${catURL(o)}">${esc(o.short)}</a>`).join('')}</p>
      <p class="actions">${t ? `<a class="btn btn-gold" href="#rundtur">Kliv in i slottet</a>` : ''}${c.website ? `<a class="btn btn-ghost" href="${esc(c.website)}" target="_blank" rel="noopener">Slottets webbplats</a>` : ''}${directions ? `<a class="btn btn-ghost" href="${esc(directions)}" target="_blank" rel="noopener">Hitta hit</a>` : ''}</p>
    </div>
    ${img ? `<figure class="c-img"><img src="${esc(img)}" srcset="${esc(imgSm)} 960w, ${esc(img)} 1280w" sizes="(max-width: 900px) 100vw, 55vw" alt="${esc(c.name)}" fetchpriority="high"><figcaption>${c.image.artist ? `Foto: ${esc(c.image.artist)}` : 'Foto'}${c.image.license ? `, ${esc(c.image.license)}` : ''} · <a href="${esc(c.image.page || 'https://commons.wikimedia.org/wiki/File:' + c.image.file)}" target="_blank" rel="noopener">Wikimedia Commons</a></figcaption></figure>` : ''}
  </div>
</header>
${tourBlock}
<section class="c-body">
  <div class="wrap c-grid">
    <div class="c-text">
      <h2>Om ${esc(c.name)}</h2>
      ${wiki.length ? wiki.map(p => `<p>${esc(p)}</p>`).join('') : `<p>${esc(c.name)} är ${esc(c.type.toLowerCase())} i ${esc(kommunLabel(c.kommun))}.</p>`}
      ${c.wiki && !c.text ? `<p class="source">Text från <a href="https://sv.wikipedia.org/wiki/${encodeURIComponent(c.wiki.title.replace(/ /g, '_'))}" target="_blank" rel="noopener">Wikipedia</a> (CC BY-SA 4.0).</p>` : ''}
      ${offers.filter(o => o.kind === 'offer').length ? `<h3>Här kan du</h3><ul class="offer-list">${offers.filter(o => o.kind === 'offer').map(o => `<li><a href="${catURL(o)}">${esc(o.name)}</a></li>`).join('')}</ul>
      <p class="small">Kontrollera alltid öppettider, priser och bokning på slottets egen webbplats.</p>` : ''}
    </div>
    <aside class="c-side">
      <dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${c.lat != null ? `<div class="mini-map" id="minikarta" data-lat="${c.lat}" data-lon="${c.lon}" data-name="${esc(c.name)}" role="img" aria-label="Karta över läget för ${esc(c.name)}"></div>` : ''}
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

function listPage(S, { title, h1, intro, path, list, crumbsList, extra = '', countyFilter = null, noCounty = false }) {
  const sorted = [...list].sort(byTour);
  const tours = sorted.filter(c => c.tours.length).length;
  return layout(S, {
    title, path, description: `${intro} ${nf(list.length)} slott${tours ? `, varav ${nf(tours)} med virtuell rundtur` : ''}.`,
    body: `
<div class="wrap">${crumbs(crumbsList)}</div>
<header class="page-head">
  <div class="wrap">
    <h1>${esc(h1)}</h1>
    <p class="lead">${esc(intro)}</p>
    ${extra}
  </div>
</header>
<section class="band band-tight">
  <div class="wrap">
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
    title: h1, h1, intro: co ? `${cat.intro.replace(/\.$/, '')} i ${co.full}.` : cat.intro, path: catURL(cat, co), list, countyFilter: filter,
    crumbsList: co ? [['/', 'Start'], [catURL(cat), cat.name], [catURL(cat, co), co.name]] : [['/', 'Start'], [catURL(cat), cat.name]],
  });
}

function county(S, co) {
  const list = S.data.castles.filter(c => c.lanSlug === co.slug);
  const cats = S.data.categories.map(cat => [cat, list.filter(c => c.offers.includes(cat.slug)).length]).filter(x => x[1]);
  return listPage(S, {
    title: `Slott i ${co.full}`, h1: `Slott i ${co.name}`, path: countyURL(co), list, noCounty: true,
    intro: `Slott, borgar och fästningar i ${co.full}.`,
    crumbsList: [['/', 'Start'], ['/lan/', 'Län'], [countyURL(co), co.name]],
    extra: coverage(co.withTour, co.total, 'slott i länet går att besöka digitalt') +
      `<nav class="chips" aria-label="Kategorier i länet">${cats.map(([cat, n]) => `<a href="${catURL(cat, co)}">${esc(cat.short)} <small>${n}</small></a>`).join('')}</nav>`,
  });
}

function countiesIndex(S) {
  const d = S.data;
  return layout(S, {
    title: 'Slott län för län', path: '/lan/', description: 'Sveriges slott, borgar och fästningar län för län – och hur många som går att besöka digitalt.',
    body: `
<div class="wrap">${crumbs([['/', 'Start'], ['/lan/', 'Län']])}</div>
<header class="page-head"><div class="wrap"><h1>Slott län för län</h1>
<p class="lead">Hur många av länets slott går att besöka digitalt? Andelen räknas på slotten i registret.</p>
${coverage(d.stats.withTour, d.stats.total, 'slott i Sverige går att besöka digitalt')}</div></header>
<section class="band band-tight"><div class="wrap">
<ol class="county-list county-list-big">${[...d.counties].sort((a, b) => pct(b.withTour, b.total) - pct(a.withTour, a.total) || b.total - a.total).map((co, i) => `<li><a href="${countyURL(co)}"><span class="rank">${i + 1}</span><strong>${esc(co.name)}</strong><span class="mini"><span style="width:${pct(co.withTour, co.total)}%"></span></span><small>${nf(co.withTour)} av ${nf(co.total)} · ${pct(co.withTour, co.total)} %</small></a></li>`).join('')}</ol>
</div></section>`,
  });
}

function tours(S) {
  const list = S.data.castles.filter(c => c.tours.length);
  return listPage(S, {
    title: 'Slott med virtuell rundtur', h1: 'Kliv in i slottet', path: '/virtuella-rundturer/', list,
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
<h1 class="visually-hidden">Karta över Sveriges slott</h1>
<div class="map-layout">
  <aside class="map-panel">
    ${searchBox(S)}
    <fieldset class="map-filter"><legend class="visually-hidden">Visa</legend>
      <label><input type="checkbox" id="bara-rundtur"> Bara slott med virtuell rundtur</label>
      <select id="kategori" aria-label="Kategori"><option value="">Alla slott</option>${S.data.categories.map(c => `<option value="${c.slug}">${esc(c.name)}</option>`).join('')}</select>
    </fieldset>
    <p class="legend"><span class="dot dot-gold"></span> Virtuell rundtur <span class="dot dot-grey"></span> Ingen rundtur ännu</p>
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
    title: 'Sök', path: '/sok/', noindex: true, scripts: ['/assets/search.js'],
    body: `
<header class="page-head"><div class="wrap"><h1>Sök bland Sveriges slott</h1>${searchBox(S, true)}</div></header>
<section class="band band-tight"><div class="wrap"><p class="count" id="sok-antal" aria-live="polite"></p><ul class="cards" id="sok-traffar"></ul></div></section>`,
  });
}

function textPage(S, { title, path, body, description, scripts }) {
  return layout(S, { title, path, description, scripts, body: `<div class="wrap">${crumbs([['/', 'Start'], [path, title]])}</div><article class="prose wrap">${body}</article>` });
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
  const st = S.data.stats;
  return textPage(S, { title: 'För slott och slottsägare', path: '/for-slott/', scripts: ['/assets/form.js'], description: 'Visa ert slott inifrån för besökare, bröllopspar och konferensgäster – och håll uppgifterna om slottet aktuella.', body: `
<h1>För slott och slottsägare</h1>
<p class="lead">Visa ert slott inifrån – för alla som letar slott att besöka, bo på, gifta sig eller ha konferens på.</p>
<p>${nf(st.withTour)} av ${nf(st.total)} slott i registret går redan att besöka digitalt. De lyfts fram först i sökningar, i varje kategori och på kartan. En virtuell rundtur låter blivande gäster gå runt i salarna innan de bokar, och gör slottet tillgängligt för den som inte kan komma dit.</p>
<h2>Det här kan ni göra</h2>
<ul>
  <li><b>Visa slottet inifrån.</b> Har ni redan en rundtur visar vi den på ert slotts sida. Saknar ni en kan vi hjälpa er att ta fram en, som ni också kan använda på er egen webbplats.</li>
  <li><b>Hålla uppgifterna aktuella.</b> Text, bilder, vad ni erbjuder (boende, spa, konferens, bröllop, restaurang, visningar) och länk till er bokning.</li>
</ul>
<p>Snart kan ni logga in och uppdatera ert slotts sida själva. Fram till dess: skicka uppgifterna här, så lägger vi in dem.</p>
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
</form>` });
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
  return layout(S, { title: 'Sidan finns inte', path: '/404.html', noindex: true, body: `<article class="prose wrap"><h1>Sidan finns inte</h1><p>Sidan kan ha flyttats. Sök efter slottet i stället:</p>${searchBox(S, true)}<p><a href="/">Till startsidan</a></p></article>` });
}

module.exports = { home, castle, category, county, countiesIndex, tours, mapPage, searchPage, about, contact, privacy, forCastles, tip, thanks, notFound, castleURL, countyURL, catURL };
