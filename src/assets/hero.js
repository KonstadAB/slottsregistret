'use strict';
// Startsidans film: bilderna tonar över i varandra och glider sakta (Ken Burns). Bilderna efter den första hämtas
// först när sidan har laddats. Den som valt minskade rörelser i sitt system ser bara den första bilden.
(function () {
  var slides = [].slice.call(document.querySelectorAll('.film .slide'));
  var cap = document.querySelector('.film-caption');
  if (slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  function load(s) {
    var src = s.querySelector('source[data-srcset]'), img = s.querySelector('img[data-src]');
    if (src) { src.srcset = src.dataset.srcset; src.removeAttribute('data-srcset'); }
    if (img) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
  }
  var i = 0, timer;
  function show(n) {
    var next = slides[n];
    load(slides[(n + 1) % slides.length]);
    var img = next.querySelector('img');
    var go = function () {
      slides[i].classList.remove('on'); slides[i].classList.add('off');
      var prev = slides[i];
      setTimeout(function () { prev.classList.remove('off'); }, 2000);
      next.classList.add('on'); i = n;
      if (cap) { var a = cap.querySelector('a'), sm = cap.querySelector('small'); a.href = next.dataset.href; a.textContent = next.dataset.name; sm.textContent = next.dataset.credit; }
    };
    if (img.complete && img.naturalWidth) go(); else { img.addEventListener('load', go, { once: true }); img.addEventListener('error', go, { once: true }); }
  }
  function tick() { show((i + 1) % slides.length); }
  window.addEventListener('load', function () {
    load(slides[1]);
    timer = setInterval(tick, 7000);
  });
  // Pausa när fliken inte syns.
  document.addEventListener('visibilitychange', function () {
    clearInterval(timer);
    if (!document.hidden) timer = setInterval(tick, 7000);
  });
})();
