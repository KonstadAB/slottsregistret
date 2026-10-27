'use strict';
// Formulären: väljer slottet i förväg när sidan öppnas med ?slott=…
(function () {
  var s = new URLSearchParams(location.search).get('slott'), sel = document.getElementById('slott');
  if (s && sel && sel.querySelector('option[value="' + s.replace(/[^a-z0-9-]/g, '') + '"]')) sel.value = s;
  // Tipsformuläret: sidan besökaren kom ifrån (t.ex. slottets sida) följer med, och "Vilket slott?" visas bara när inget slott i listan är valt.
  var kom = document.querySelector('input[name=kom]'), fri = document.getElementById('vilket');
  if (kom && document.referrer.indexOf(location.origin + '/') === 0) kom.value = document.referrer;
  if (fri && sel) {
    var show = function () { var on = !sel.value || sel.value === 'annat'; fri.hidden = fri.labels[0].hidden = !on; if (!on) fri.value = ''; };
    sel.addEventListener('change', show); show();
  }
})();

// Skickar formuläret utan att lämna sidan. Går det inte visas ett meddelande, och det som skrivits ligger kvar.
// Utan JavaScript skickas formuläret som vanligt.
(function () {
  [].forEach.call(document.querySelectorAll('form[data-form]'), function (form) {
    var btn = form.querySelector('button[type=submit], button:not([type])');
    var msg = document.createElement('p');
    msg.className = 'form-msg'; msg.setAttribute('role', 'alert'); msg.hidden = true;
    (btn ? btn.parentNode : form).insertBefore(msg, btn ? btn.nextSibling : null);
    var TEXT = {
      required: 'Fyll i de obligatoriska fälten och försök igen.',
      short: 'Skriv ett meddelande på minst 10 tecken, så att vi förstår vad tipset gäller.',
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
          if (j.success) { var t = form.querySelector('[name=tack]'); location.href = t && t.value ? t.value : '/tack/'; return; }
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
