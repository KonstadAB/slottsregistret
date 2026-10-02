'use strict';
// Söksidan /sok/?q=…: visar alla träffar som kort.
(function () {
  var q = new URLSearchParams(location.search).get('q') || '';
  var input = document.getElementById('qh'), list = document.getElementById('sok-traffar'), count = document.getElementById('sok-antal');
  if (input) input.value = q;
  var DOOR = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V11a6 6 0 0 1 12 0v10M3 21h18M12 15v2"/></svg>';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  if (!q.trim()) { count.textContent = 'Skriv vad du letar efter: ett slott, en ort, ett län eller vad du vill göra.'; return; }
  SR.load(function (D) {
    var r = SR.search(q), page = SR.pageFor(r.p);
    var tours = r.hits.filter(function (c) { return c.r; }).length;
    count.innerHTML = r.hits.length ? esc(r.hits.length + ' slott' + (tours ? ', varav ' + tours + ' med virtuell rundtur' : '')) + (page ? ' · <a href="' + page.u + '">' + esc(page.t) + '</a>' : '') : 'Inga träffar på ”' + esc(q) + '”. Prova ett kortare ord, en ort eller ett län.';
    list.innerHTML = r.hits.slice(0, 120).map(function (c) {
      var img = SR.thumb(c, 500);
      return '<li class="card' + (c.r ? ' has-tour' : '') + '"><a href="/slott/' + c.s + '/"><span class="card-img">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '<span class="ph"></span>') + (c.r ? '<span class="lit">' + DOOR + 'Kliv in<span class="visually-hidden">: virtuell rundtur</span></span>' : '') +
        '</span><span class="card-body"><small class="card-loc">' + esc(c.k + ' · ' + D.lanName[c.l]) + '</small><strong>' + esc(c.n) + '</strong></span></a></li>';
    }).join('');
  });
})();
