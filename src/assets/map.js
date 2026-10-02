'use strict';
// Kartan: alla slott, guld = virtuell rundtur. Filter på rundtur och kategori, sökning och lista över slotten i utsnittet.
(function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var GOLD = '#C9A24E', GREY = '#7E8A82';
  var map = L.map('karta', { preferCanvas: true, minZoom: 4, maxZoom: 18 });
  map.fitBounds([[55.3, 11.0], [69.1, 24.2]], { padding: [10, 10] });
  L.tileLayer('/tiles/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  var renderer = L.canvas({ padding: .3 }), layer = L.layerGroup().addTo(map);
  var params = new URLSearchParams(location.search);
  var state = { tour: params.get('rundtur') === '1', cat: params.get('kategori') || '', q: params.get('q') || '', set: null };
  var tourBox = document.getElementById('bara-rundtur'), catSel = document.getElementById('kategori'), input = document.querySelector('.map-panel [data-search]');
  var listEl = document.getElementById('kartlista'), D, rows = [];
  tourBox.checked = state.tour; catSel.value = state.cat; if (input) input.value = state.q;

  function popup(c) {
    var img = SR.thumb(c, 500);
    return '<div class="pop">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '') + '<strong>' + esc(c.n) + '</strong><small>' + esc(c.k + ' · ' + D.lanName[c.l]) + '</small>' +
      (c.r ? '<small style="color:#7E5D18;font-weight:600">Virtuell rundtur</small>' : '') +
      '<a class="btn ' + (c.r ? 'btn-gold' : '') + '" href="/slott/' + c.s + '/">' + (c.r ? 'Kliv in i slottet' : 'Till slottet') + '</a></div>';
  }
  function ok(c) {
    if (c.lat == null) return false;
    if (state.tour && !c.r) return false;
    if (state.cat && c.o.indexOf(state.cat) < 0) return false;
    if (state.set && !state.set[c.s]) return false;
    return true;
  }
  function draw() {
    layer.clearLayers();
    // Slott utan rundtur först, så att de guldmarkerade hamnar ovanpå.
    rows = D.list.filter(ok).sort(function (a, b) { return a.r - b.r; });
    rows.forEach(function (c) {
      var m = c.r
        ? L.circleMarker([c.lat, c.lon], { renderer: renderer, radius: 8, color: '#fff', weight: 2, fillColor: GOLD, fillOpacity: 1 })
        : L.circleMarker([c.lat, c.lon], { renderer: renderer, radius: 5.5, color: GREY, weight: 2, fillColor: '#fff', fillOpacity: 1 });
      m.bindTooltip(c.n, { direction: 'top', offset: [0, -6] }).bindPopup(popup(c));
      c.marker = m; layer.addLayer(m);
    });
    list();
  }
  function list() {
    var b = map.getBounds();
    var vis = rows.filter(function (c) { return b.contains([c.lat, c.lon]); }).sort(function (a, b) { return b.r - a.r || a.n.localeCompare(b.n, 'sv'); });
    document.querySelector('[data-count]').textContent = vis.length ? vis.length + (vis.length === 1 ? ' slott' : ' slott') + ' i kartutsnittet' : 'Inga slott i kartutsnittet.';
    listEl.innerHTML = vis.slice(0, 80).map(function (c) {
      var img = SR.thumb(c, 250);
      return '<li><a href="/slott/' + c.s + '/" data-s="' + c.s + '">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" width="58" height="58">' : '<span class="ph"></span>') +
        '<span><strong>' + esc(c.n) + '</strong><small>' + esc(c.k) + '</small>' + (c.r ? '<span class="k">Virtuell rundtur</span>' : '') + '</span></a></li>';
    }).join('') + (vis.length > 80 ? '<li class="small" style="padding:10px 6px">Visar 80 av ' + vis.length + '. Zooma in för att se fler.</li>' : '');
  }
  listEl.addEventListener('mouseover', function (e) { var a = e.target.closest('a[data-s]'); if (!a) return; var c = D.list.find(function (x) { return x.s === a.dataset.s; }); if (c && c.marker) c.marker.openTooltip(); });
  map.on('moveend', function () { if (D) list(); });
  function applyQuery() {
    var q = input ? input.value.trim() : '';
    state.q = q; state.set = null;
    if (q.length >= 2) {
      var r = SR.search(q); state.set = {};
      if (r.p.cat && r.p.cat !== 'tour') { state.cat = r.p.cat; catSel.value = r.p.cat; }
      if (r.p.cat === 'tour') { state.tour = true; tourBox.checked = true; }
      r.hits.forEach(function (c) { state.set[c.s] = 1; });
      var pts = r.hits.filter(function (c) { return c.lat != null; }).map(function (c) { return [c.lat, c.lon]; });
      draw();
      if (pts.length === 1) map.setView(pts[0], 12); else if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 11 });
    } else draw();
  }
  SR.load(function (data) {
    D = data; draw();
    if (state.q) applyQuery();
  });
  tourBox.addEventListener('change', function () { state.tour = tourBox.checked; draw(); });
  catSel.addEventListener('change', function () { state.cat = catSel.value; draw(); });
  var form = document.querySelector('.map-panel form.search');
  if (form) form.addEventListener('submit', function (e) { e.preventDefault(); applyQuery(); });
  if (input) input.addEventListener('search', applyQuery);
})();
