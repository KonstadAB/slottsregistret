'use strict';
// Slottets sida: rundturen laddas först vid klick (klicket är samtycke till leverantörens kakor), och en liten karta
// som ritas när den kommer i bild.
(function () {
  document.querySelectorAll('.tour [data-start]').forEach(function (b) {
    b.addEventListener('click', function () {
      var sec = b.closest('.tour'), f = sec.querySelector('.tour-frame'), ifr = document.createElement('iframe');
      ifr.src = f.dataset.embed; ifr.title = 'Virtuell rundtur: ' + f.dataset.title;
      ifr.allow = 'fullscreen; xr-spatial-tracking; gyroscope; accelerometer'; ifr.allowFullscreen = true; ifr.loading = 'eager';
      sec.classList.add('playing'); f.innerHTML = ''; f.appendChild(ifr);
      f.scrollIntoView({ behavior: 'smooth', block: 'center' }); ifr.focus();
    });
  });
  var m = document.getElementById('minikarta');
  if (!m || !window.L) return;
  function draw() {
    var lat = +m.dataset.lat, lon = +m.dataset.lon;
    var map = L.map(m, { scrollWheelZoom: false, attributionControl: true }).setView([lat, lon], 13);
    L.tileLayer('/tiles/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    L.circleMarker([lat, lon], { radius: 9, color: '#fff', weight: 2.5, fillColor: '#C9A24E', fillOpacity: 1 }).addTo(map).bindTooltip(m.dataset.name);
  }
  if (!('IntersectionObserver' in window)) return draw();
  var io = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { io.disconnect(); draw(); } }, { rootMargin: '300px' });
  io.observe(m);
})();
