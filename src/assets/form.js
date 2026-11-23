'use strict';
// Formulären: väljer slottet i förväg när sidan öppnas med ?slott=…
(function () {
  var s = new URLSearchParams(location.search).get('slott'), sel = document.getElementById('slott');
  if (s && sel && sel.querySelector('option[value="' + s.replace(/[^a-z0-9-]/g, '') + '"]')) sel.value = s;
})();

// Skickar formuläret utan att lämna sidan. Går det inte visas ett meddelande, och det som skrivits ligger kvar.
// Utan JavaScript skickas formuläret som vanligt.
(function () {
  [].forEach.call(document.querySelectorAll('form[data-form]'), function (form) {
    var btn = form.querySelector('button[type=submit], button:not([type])');
    var kind = ({ forfragan: 'förfrågan', forslag: 'förslag på slott', tips: 'tips', slott: 'från slott' })[(form.querySelector('[name=formular]') || {}).value] || 'formulär';
    // Statistik: när formuläret syns och när någon börjar fylla i det (en gång per sidvisning).
    var started = false;
    form.addEventListener('focusin', function () { if (!started) { started = true; window.srEvent && window.srEvent('Börjar fylla i: ' + kind); } });
    if (window.IntersectionObserver) {
      var seen = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { seen.disconnect(); window.srEvent && window.srEvent('Ser formulär: ' + kind); } }, { threshold: 0.3 });
      seen.observe(form);
    }
    var msg = document.createElement('p');
    msg.className = 'form-msg'; msg.setAttribute('role', 'alert'); msg.hidden = true;
    (btn ? btn.parentNode : form).insertBefore(msg, btn ? btn.nextSibling : null);
    var TEXT = {
      required: 'Fyll i de obligatoriska fälten och försök igen.',
      email: 'Kontrollera e-postadressen och försök igen.',
      limit: 'Du har skickat flera gånger på kort tid. Vänta en minut och försök igen.',
    };
    form.addEventListener('submit', function (e) {
      if (!window.fetch || !window.FormData) return;
      e.preventDefault();
      msg.hidden = true;
      if (btn) btn.disabled = true;
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json().catch(function () { return { success: false }; }); })
        .then(function (j) {
          if (j.success) { window.srEvent && window.srEvent('Skickat: ' + kind); var t = form.querySelector('[name=tack]'); setTimeout(function () { location.href = t && t.value ? t.value : '/tack/'; }, 350); return; }
          throw j;
        })
        .catch(function (j) {
          msg.textContent = (j && TEXT[j.error]) || 'Det gick inte att skicka just nu. Försök igen om en stund, eller mejla oss på kontakt@slottsregistret.se.';
          msg.hidden = false;
          if (btn) btn.disabled = false;
        });
    });
  });
})();

// Den fasta knappen på mobilen döljs när formuläret syns, så att den inte ligger över fälten.
(function () {
  var cta = document.querySelector('.sticky-cta'); if (!cta || !window.IntersectionObserver) return;
  var target = document.querySelector(cta.getAttribute('href')); if (!target) return;
  // Syns först när man har skrollat förbi sidhuvudet (där finns redan knappen) och döljs vid formuläret.
  var atForm = false, upd = function () { cta.classList.toggle('hide', atForm || window.scrollY < 600); };
  new IntersectionObserver(function (es) { atForm = es[0].isIntersecting; upd(); }, { rootMargin: '0px 0px -20% 0px' }).observe(target);
  window.addEventListener('scroll', upd, { passive: true }); upd();
})();
