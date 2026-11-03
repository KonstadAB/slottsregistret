'use strict';
// Kontosidorna för slotten (/konto/, /konto/ansok/, /konto/granska/). Pratar med /api/konto/… (worker/konto.js).
(function () {
  var root = document.querySelector('[data-konto]');
  if (!root || !window.fetch) return;
  var page = root.getAttribute('data-konto');
  var OFFER_NAMES = { 'bo-pa-slott': 'Boende', spa: 'Spa', konferens: 'Konferens', 'brollop-och-fest': 'Bröllop och fest',
    'restaurang-och-kafe': 'Restaurang eller kafé', besok: 'Öppet för besök', 'park-och-tradgard': 'Park eller trädgård' };
  var ERR = { email: 'Kontrollera e-postadressen.', required: 'Fyll i de obligatoriska fälten.', castle: 'Välj slottet i listan. Saknas det? Skriv till kontakt@slottsregistret.se.',
    limit: 'Du har skickat flera gånger på kort tid. Vänta en minut och försök igen.', soon: 'Kontona öppnar inom kort.' };

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]); });
    (kids || []).forEach(function (k) { if (k) e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k); });
    return e;
  }
  function show(name) { [].forEach.call(root.querySelectorAll('[data-view]'), function (v) { v.hidden = v.getAttribute('data-view') !== name; }); }
  function msg(name, on) { var m = root.querySelector('[data-msg="' + name + '"]'); if (m) m.hidden = !on; }
  function api(path, data) {
    var opt = data ? { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(data), credentials: 'same-origin' }
      : { headers: { accept: 'application/json' }, credentials: 'same-origin' };
    return fetch('/api/konto/' + path, opt).then(function (r) { return r.json().catch(function () { return { success: false, error: 'server' }; }); });
  }
  function formData(form) {
    var d = {};
    [].forEach.call(form.elements, function (f) {
      if (!f.name) return;
      if (f.type === 'checkbox') { d[f.name] = d[f.name] || []; if (f.checked) d[f.name].push(f.value); }
      else d[f.name] = f.value;
    });
    return d;
  }
  function errorAfter(form, j) {
    var p = form.querySelector('.form-msg') || form.appendChild(el('p', { class: 'form-msg', role: 'alert' }));
    p.textContent = ERR[j && j.error] || 'Det gick inte just nu. Försök igen om en stund, eller mejla kontakt@slottsregistret.se.';
    p.hidden = false;
  }
  function onSubmit(form, fn) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var b = form.querySelector('[type=submit]'); if (b) b.disabled = true;
      fn(formData(form)).then(function (j) { if (b) b.disabled = false; if (!j.success) errorAfter(form, j); return j; });
    });
  }

  // ---- Ansökan ----
  if (page === '/konto/ansok/') {
    var s = new URLSearchParams(location.search).get('slott'), sel = root.querySelector('#slott');
    if (s && sel && sel.querySelector('option[value="' + s.replace(/[^a-z0-9-]/g, '') + '"]')) sel.value = s;
    var f = root.querySelector('[data-action=ansok]');
    onSubmit(f, function (d) {
      return api('ansok', d).then(function (j) {
        if (j.success) { f.hidden = true; msg('klar', true); }
        else if (j.error === 'soon') { f.hidden = true; msg('snart', true); }
        return j.error === 'soon' ? { success: true } : j;
      });
    });
    return;
  }

  // ---- Inloggning och mitt konto ----
  if (page === '/konto/') {
    var login = root.querySelector('[data-action=logga-in]');
    if (/fel=lank/.test(location.search)) msg('lank', true);
    onSubmit(login, function (d) { return api('logga-in', d).then(function (j) { if (j.success) { login.hidden = true; msg('lank', false); msg('skickat', true); } return j; }); });
    api('jag').then(function (j) {
      if (j.error === 'soon') return show('snart');
      if (!j.success) return show('logga-in');
      renderAccount(j);
      show('konto');
    });
    return;
  }

  function renderAccount(j) {
    var v = root.querySelector('[data-view=konto]');
    v.textContent = '';
    v.appendChild(el('p', { class: 'lead' }, ['Inloggad som ' + (j.user.name || j.user.email) + '. ',
      el('button', { class: 'linkbtn', type: 'button', 'data-logout': true, text: 'Logga ut' })]));
    if (j.user.admin) v.appendChild(el('p', {}, [el('a', { href: '/konto/granska/', class: 'btn btn-ghost', text: 'Granska ansökningar och ändringar' })]));
    if (!j.castles.length) v.appendChild(el('p', { text: 'Inga slott är kopplade till kontot än.' }));
    j.castles.forEach(function (c) { v.appendChild(castleForm(c, j.offers)); });
    v.querySelector('[data-logout]').addEventListener('click', function () { api('logga-ut', {}).then(function () { location.href = '/konto/'; }); });
  }

  function castleForm(c, offers) {
    var base = (c.latest && c.latest.status === 'pending' ? c.latest.data : null) || (c.live && c.live.data) || {
      text: '', offers: (c.current.offers || []).filter(function (o) { return offers.indexOf(o) >= 0; }), website: c.current.website || '', booking: '', phone: '', email: '', open: '' };
    var status = c.membership !== 'approved' ? 'Ansökan väntar på att godkännas.'
      : c.latest && c.latest.status === 'pending' ? 'Era senaste ändringar väntar på granskning. Ni kan fortsätta ändra.'
      : c.latest && c.latest.status === 'rejected' ? 'De senaste ändringarna godkändes inte' + (c.latest.note ? ': ' + c.latest.note : '.')
      : c.live ? 'Uppgifterna är godkända. Ändringar syns på sajten inom ett dygn efter granskningen.' : 'Fyll i och skicka, så granskar vi uppgifterna innan de syns.';
    var form = el('form', { class: 'form account-form account-castle' }, [
      el('h2', {}, [el('a', { href: '/slott/' + c.slug + '/', text: c.name })]),
      el('p', { class: 'note', text: status }),
      el('label', { for: 't-' + c.slug, text: 'Er text om slottet' }),
      el('textarea', { id: 't-' + c.slug, name: 'text', rows: 8, maxlength: 3000, placeholder: 'Berätta om slottet, vad gästerna kan göra och vad som gör det speciellt. Visas på sidan under rubriken ”Från slottet”.' }),
      el('fieldset', {}, [el('legend', { text: 'Det här erbjuder ni' })].concat(offers.map(function (o) {
        return el('label', {}, [el('input', { type: 'checkbox', name: 'offers', value: o, checked: base.offers.indexOf(o) >= 0 }), ' ' + OFFER_NAMES[o]]);
      }))),
      el('label', { for: 'w-' + c.slug, text: 'Webbplats' }), el('input', { id: 'w-' + c.slug, name: 'website', type: 'url', placeholder: 'https://', value: base.website || '' }),
      el('label', { for: 'b-' + c.slug, text: 'Länk till bokning (frivilligt)' }), el('input', { id: 'b-' + c.slug, name: 'booking', type: 'url', placeholder: 'https://', value: base.booking || '' }),
      el('label', { for: 'p-' + c.slug, text: 'Telefon för gäster (frivilligt)' }), el('input', { id: 'p-' + c.slug, name: 'phone', type: 'tel', value: base.phone || '' }),
      el('label', { for: 'e-' + c.slug, text: 'E-post för gäster (frivilligt)' }), el('input', { id: 'e-' + c.slug, name: 'email', type: 'email', value: base.email || '' }),
      el('label', { for: 'o-' + c.slug, text: 'Säsong och öppet (frivilligt)' }), el('input', { id: 'o-' + c.slug, name: 'open', maxlength: 400, placeholder: 't.ex. Visningar maj–september, i övrigt efter bokning', value: base.open || '' }),
      el('input', { type: 'hidden', name: 'slott', value: c.slug }),
      el('button', { class: 'btn btn-gold', type: 'submit', disabled: c.membership !== 'approved', text: 'Skicka för granskning' }),
    ]);
    form.querySelector('textarea').value = base.text || '';
    onSubmit(form, function (d) {
      return api('profil', d).then(function (j) { if (j.success) form.querySelector('.note').textContent = 'Tack! Ändringarna väntar på granskning. Ni får gärna fortsätta ändra.'; return j; });
    });
    return form;
  }

  // ---- Granskning (Daniel) ----
  if (page === '/konto/granska/') {
    api('granska').then(function (j) {
      if (!j.success) return show('logga-in');
      var v = root.querySelector('[data-view=granska]');
      v.appendChild(el('h2', { text: 'Ansökningar om konto (' + j.memberships.length + ')' }));
      if (!j.memberships.length) v.appendChild(el('p', { text: 'Inga just nu.' }));
      j.memberships.forEach(function (m) {
        v.appendChild(el('div', { class: 'review' }, [
          el('h3', {}, [el('a', { href: '/slott/' + m.castle + '/', text: m.castleName })]),
          el('p', { text: m.name + (m.role ? ', ' + m.role : '') + ' · ' + m.email + (m.phone ? ' · ' + m.phone : '') }),
          m.message ? el('p', { class: 'small', text: m.message }) : null,
          decide('konto', m.id),
        ]));
      });
      v.appendChild(el('h2', { text: 'Ändringar att granska (' + j.profiles.length + ')' }));
      if (!j.profiles.length) v.appendChild(el('p', { text: 'Inga just nu.' }));
      j.profiles.forEach(function (p) {
        var d = p.data, cur = p.current || {};
        var rows = [['Text', d.text], ['Erbjuder', d.offers.map(function (o) { return OFFER_NAMES[o]; }).join(', ') + (cur.offers ? '  (i dag: ' + cur.offers.filter(function (o) { return OFFER_NAMES[o]; }).map(function (o) { return OFFER_NAMES[o]; }).join(', ') + ')' : '')],
          ['Webbplats', d.website + (cur.website && cur.website !== d.website ? '  (i dag: ' + cur.website + ')' : '')], ['Bokning', d.booking], ['Telefon', d.phone], ['E-post', d.email], ['Öppet', d.open]];
        v.appendChild(el('div', { class: 'review' }, [
          el('h3', {}, [el('a', { href: '/slott/' + p.castle + '/', text: p.castleName })]),
          el('p', { class: 'small', text: 'Från ' + (p.name || p.email) + ', ' + p.created_at.slice(0, 16).replace('T', ' ') }),
          el('dl', { class: 'facts' }, rows.filter(function (r) { return r[1]; }).map(function (r) { return el('div', {}, [el('dt', { text: r[0] }), el('dd', { text: r[1] })]); })),
          decide('profil', p.id, true),
        ]));
      });
      show('granska');
    });
  }
  function decide(typ, id, note) {
    var box = el('p', { class: 'actions' });
    var input = note ? el('input', { placeholder: 'Kommentar vid nej (visas för slottet)', class: 'review-note' }) : null;
    [['ja', 'Godkänn', 'btn btn-gold'], ['nej', 'Neka', 'btn btn-ghost']].forEach(function (b) {
      var btn = el('button', { type: 'button', class: b[2], text: b[1] });
      btn.addEventListener('click', function () {
        btn.disabled = true;
        api('granska', { typ: typ, id: id, beslut: b[0], note: input ? input.value : '' }).then(function (j) {
          box.textContent = j.success ? (b[0] === 'ja' ? 'Godkänd.' : 'Nekad.') : 'Det gick inte. Försök igen.';
        });
      });
      box.appendChild(btn);
    });
    if (input) box.appendChild(input);
    return box;
  }
})();
