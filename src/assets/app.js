'use strict';
// Gemensamt för alla sidor: menyn och snabbsökningen med förslag.
// Bilder från Commons kan ibland inte hämtas direkt (Wikimedia begränsar nya miniatyrer): ett nytt försök efter en stund.
document.addEventListener('error', function (e) {
  var img = e.target;
  if (img.tagName !== 'IMG' || img.dataset.retry || !/\/img\//.test(img.currentSrc || img.src)) return;
  img.dataset.retry = '1';
  setTimeout(function () { var s = img.src; if (img.srcset) img.srcset = img.srcset; img.src = ''; img.src = s; }, 2500);
}, true);
// Kortare exempeltext i sökrutan på smala skärmar, så att den inte klipps av.
if (window.matchMedia && matchMedia('(max-width: 560px)').matches) {
  [].forEach.call(document.querySelectorAll('input[data-short]'), function (i) { i.placeholder = i.dataset.short; });
}
(function () {
  var btn = document.querySelector('.menu-btn'), nav = document.getElementById('huvudmeny');
  if (btn && nav) {
    var set = function (o) { nav.classList.toggle('open', o); btn.setAttribute('aria-expanded', o ? 'true' : 'false'); };
    btn.addEventListener('click', function () { set(!nav.classList.contains('open')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) { set(false); btn.focus(); } });
  }
})();

// Sökningen: förstår namn, kommun, län och vad man vill göra ("bröllop skåne", "spa", "ruiner i kalmar").
window.SR = (function () {
  var D = null, waiting = [];
  function load(cb) {
    if (D) return cb(D);
    waiting.push(cb);
    if (waiting.length > 1) return;
    fetch('/data/slott.json').then(function (r) { return r.json(); }).then(function (j) {
      D = j;
      D.list = j.castles.map(function (c) {
        return { n: c[0], s: c[1], k: c[2], l: c[3], t: c[4], o: c[5].split(' '), r: c[6], lat: c[7], lon: c[8], img: c[9], w: c[10], key: norm(c[0] + ' ' + c[2] + ' ' + (c[11] || '')) };
      });
      D.lanName = {}; j.counties.forEach(function (x) { D.lanName[x[0]] = x[1]; });
      D.catName = {}; j.cats.forEach(function (x) { D.catName[x[0]] = x[1]; });
      waiting.forEach(function (f) { f(D); }); waiting = [];
    });
  }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  var CAT_WORDS = [
    [/^(bo|boende|hotell|slottshotell|overnatt\w*|sova|natt|weekend)$/, 'bo-pa-slott'],
    [/^(spa|bad|massage|wellness)$/, 'spa'],
    [/^(konferens\w*|mote|moten|kickoff)$/, 'konferens'],
    [/^(brollop\w*|vigsel|gifta|fest|bjudning)$/, 'brollop-och-fest'],
    [/^(restaurang\w*|kafe|cafe|mat|lunch|middag|fika)$/, 'restaurang-och-kafe'],
    [/^(besok\w*|museum|museer|visning\w*|oppet)$/, 'besok'],
    [/^(park\w*|tradgard\w*)$/, 'park-och-tradgard'],
    [/^(kunglig\w*)$/, 'kungliga-slott'],
    [/^(ruin\w*|borg\w*|slottsruin\w*|fornborg\w*)$/, 'borgar-och-ruiner'],
    [/^(fastning\w*|fort|kastell|skans\w*)$/, 'fastningar'],
    [/^(rundtur\w*|360|virtuell\w*|digital\w*)$/, 'tour'],
  ];
  var PLAIN = {};
  'bo boende hotell slottshotell sova natt weekend spa bad konferens konferenser mote moten brollop vigsel gifta fest restaurang kafe cafe mat lunch middag fika besok museum museer visning visningar oppet park parker tradgard tradgardar kunglig kungliga ruin ruiner borg borgar slottsruin slottsruiner fornborg fornborgar fastning fastningar fort kastell skans skansar rundtur rundturer 360 virtuell virtuella digital digitalt'
    .split(' ').forEach(function (w) { PLAIN[w] = 1; });
  var STOP = { i: 1, pa: 1, slott: 1, slottet: 1, med: 1, och: 1, nara: 1, lan: 1, kommun: 1, att: 1, ett: 1, en: 1 };
  function parse(q) {
    var words = norm(q).split(' ').filter(Boolean), cat = null, lan = null, rest = [];
    words.forEach(function (w) {
      var hit = null;
      CAT_WORDS.forEach(function (cw) { if (!hit && cw[0].test(w)) hit = cw[1]; });
      // "Borgeby", "Borgholm", "Parkudden": ett längre ord som börjar som en kategori men är början på ett namn är ett namn.
      if (hit && !PLAIN[w] && D.list.some(function (c) { return (' ' + c.key).indexOf(' ' + w) >= 0; })) hit = null;
      if (hit && !cat) { cat = hit; return; }
      var l = null;
      Object.keys(D.lanName).forEach(function (s) { if (!l && (norm(D.lanName[s]) === w || norm(D.lanName[s]).split(' ')[0] === w && w.length > 3)) l = s; });
      if (l && !lan) { lan = l; return; }
      if (!STOP[w]) rest.push(w);
    });
    return { cat: cat, lan: lan, rest: rest };
  }
  function search(q) {
    var p = parse(q), out = [];
    D.list.forEach(function (c) {
      if (p.cat === 'tour' ? !c.r : p.cat && c.o.indexOf(p.cat) < 0) return;
      if (p.lan && c.l !== p.lan) return;
      var score = 0;
      if (p.rest.length) {
        var ok = p.rest.every(function (w) { return (' ' + c.key).indexOf(' ' + w) >= 0 || c.key.indexOf(w) >= 0; });
        if (!ok) return;
        p.rest.forEach(function (w) { if (norm(c.n).indexOf(w) === 0) score += 3; else if ((' ' + norm(c.n)).indexOf(' ' + w) >= 0) score += 2; else score += 1; });
      }
      score += c.r ? 1.5 : 0;
      out.push([score, c]);
    });
    out.sort(function (a, b) { return b[0] - a[0] || a[1].n.localeCompare(b[1].n, 'sv'); });
    return { p: p, hits: out.map(function (x) { return x[1]; }) };
  }
  function pageFor(p) {
    if (p.cat === 'tour') return { u: '/virtuella-rundturer/', t: 'Alla slott med virtuell rundtur' };
    if (p.cat) return { u: '/' + p.cat + '/' + (p.lan ? p.lan + '/' : ''), t: D.catName[p.cat] + (p.lan ? ' i ' + D.lanName[p.lan] : '') };
    if (p.lan) return { u: '/lan/' + p.lan + '/', t: 'Alla slott i ' + D.lanName[p.lan] };
    return null;
  }
  function thumb(c, w) { if (!c.img) return ''; var n = c.img.split('/').pop(); return c.w && c.w <= w ? '/img/' + c.img : '/img/thumb/' + c.img + '/' + w + 'px-' + n; }
  return { load: load, search: search, pageFor: pageFor, norm: norm, thumb: thumb, data: function () { return D; } };
})();

(function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  document.querySelectorAll('form.search').forEach(function (form) {
    var input = form.querySelector('[data-search]'), box = form.querySelector('.suggest'), sel = -1;
    if (!input || !box || document.body.classList.contains('map-body')) return;
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-autocomplete', 'list');
    box.id = input.id + '-forslag'; input.setAttribute('aria-controls', box.id);
    function close() { box.hidden = true; input.setAttribute('aria-expanded', 'false'); sel = -1; }
    function render() {
      var q = input.value.trim();
      if (q.length < 2) return close();
      SR.load(function (D) {
        var r = SR.search(q), page = SR.pageFor(r.p), rows = [];
        if (page) rows.push('<li role="option"><a href="' + page.u + '"><span class="s-cat">' + esc(page.t) + '</span></a></li>');
        r.hits.slice(0, 7).forEach(function (c) {
          rows.push('<li role="option"><a href="/slott/' + c.s + '/"><span class="' + (c.r ? 'gold' : 'grey') + '" aria-hidden="true"></span><span>' + esc(c.n) + '<small>' + esc(c.k === D.lanName[c.l] ? c.k : c.k + ' · ' + D.lanName[c.l]) + (c.r ? ' · virtuell rundtur' : '') + '</small></span></a></li>');
        });
        if (!rows.length) rows.push('<li class="small" style="padding:8px 10px">Inga träffar. Tryck Sök för att söka bredare.</li>');
        box.innerHTML = rows.join(''); box.hidden = false; input.setAttribute('aria-expanded', 'true'); sel = -1;
      });
    }
    input.addEventListener('input', render);
    input.addEventListener('focus', function () { SR.load(function () {}); });
    input.addEventListener('keydown', function (e) {
      var items = box.querySelectorAll('[role=option]');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!items.length) return; e.preventDefault();
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach(function (li, i) { li.setAttribute('aria-selected', i === sel ? 'true' : 'false'); });
      } else if (e.key === 'Enter' && sel >= 0 && items[sel]) { e.preventDefault(); location.href = items[sel].querySelector('a').href; }
      else if (e.key === 'Escape') close();
    });
    document.addEventListener('click', function (e) { if (!form.contains(e.target)) close(); });
  });
})();
