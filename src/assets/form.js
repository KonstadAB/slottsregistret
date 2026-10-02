'use strict';
// Formulären: väljer slottet i förväg när sidan öppnas med ?slott=…
(function () {
  var s = new URLSearchParams(location.search).get('slott'), sel = document.getElementById('slott');
  if (s && sel && sel.querySelector('option[value="' + s.replace(/[^a-z0-9-]/g, '') + '"]')) sel.value = s;
})();
