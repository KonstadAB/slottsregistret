'use strict';
// Slottets sida: rundturen laddas först vid klick (klicket är samtycke till leverantörens kakor), och en liten karta.
(function () {
  document.querySelectorAll('.tour-frame [data-start]').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.closest('.tour-frame'), ifr = document.createElement('iframe');
      ifr.src = f.dataset.embed; ifr.title = 'Virtuell rundtur: ' + f.dataset.title;
      ifr.allow = 'fullscreen; xr-spatial-tracking; gyroscope; accelerometer'; ifr.allowFullscreen = true; ifr.loading = 'eager';
      f.innerHTML = ''; f.appendChild(ifr); ifr.focus();
    });
  });
  var m = document.getElementById('minikarta');
  if (m && window.L) {
    var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = document.querySelector('script[src*="leaflet.js"]').src.replace('leaflet.js', 'leaflet.css'); document.head.appendChild(css);
    var lat = +m.dataset.lat, lon = +m.dataset.lon;
    var map = L.map(m, { scrollWheelZoom: false, attributionControl: true }).setView([lat, lon], 13);
    L.tileLayer('/tiles/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    L.circleMarker([lat, lon], { radius: 9, color: '#fff', weight: 2.5, fillColor: '#C9A24E', fillOpacity: 1 }).addTo(map).bindTooltip(m.dataset.name);
  }
})();
