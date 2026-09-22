(function () {
  'use strict';

  var WA_BASE = 'https://wa.me/972506264382';

  // Footer year
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = String(new Date().getFullYear());

  // Sticky header shadow
  var header = document.getElementById('header');
  if (header) {
    var onScroll = function () { header.classList.toggle('scrolled', window.scrollY > 12); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Mobile menu
  var burger = document.getElementById('burger');
  var links = document.getElementById('navLinks');
  if (burger && links) {
    burger.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      burger.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        links.classList.remove('open');
        burger.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && links.classList.contains('open')) {
        links.classList.remove('open');
        burger.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        burger.focus();
      }
    });
  }

  // Scroll reveal
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var els = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  // Lead / intake forms
  function buildWhatsAppText(data) {
    var lines = [data.get('type') === 'intake' ? 'שאלון היכרות מהאתר' : 'פנייה חדשה מהאתר', ''];
    var labels = {
      name: 'שם', phone: 'טלפון', email: 'אימייל', preferred_contact: 'דרך התקשרות',
      service: 'סוג הפנייה', message: 'הודעה', age: 'גיל', location: 'מיקום', timezone: 'אזור זמן',
      participants: 'משתתפים', reason: 'מה מביא', goals: 'מטרות', history: 'ניסיון קודם',
      health: 'חשוב לדעת', support: 'סביבה תומכת', availability: 'זמינות', emergency_contact: 'איש קשר לחירום'
    };
    Object.keys(labels).forEach(function (k) {
      var v = data.get(k);
      if (v && String(v).trim()) lines.push(labels[k] + ': ' + String(v).trim());
    });
    return lines.join('\n');
  }

  function wireForm(form) {
    var card = form.closest('.form-card');
    var errorEl = form.querySelector('.form-error');
    var success = card ? card.querySelector('.form-success') : null;
    var submit = form.querySelector('button[type=submit]');
    var label = submit ? submit.querySelector('.btn-label') : null;
    var pageField = form.querySelector('input[name=page]');
    if (pageField) pageField.value = location.pathname;

    function showError(html) {
      if (!errorEl) return;
      errorEl.innerHTML = html;
      errorEl.hidden = false;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (errorEl) errorEl.hidden = true;
      var data = new FormData(form);
      if (submit) submit.disabled = true;
      if (label) label.textContent = 'שולח…';

      var body = {};
      data.forEach(function (v, k) { body[k] = v; });

      fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, json: j }; });
      }).then(function (res) {
        if (res.ok) {
          form.hidden = true;
          if (success) { success.hidden = false; success.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); }
          return;
        }
        throw new Error(res.json && res.json.error ? res.json.error : 'send_failed');
      }).catch(function () {
        // Graceful fallback: hand the same content to WhatsApp.
        var url = WA_BASE + '?text=' + encodeURIComponent(buildWhatsAppText(data));
        showError('לא הצלחתי לשלוח את הטופס כרגע. <a href="' + url + '" target="_blank" rel="noopener">לחצו כאן כדי לשלוח את אותם הפרטים בוואטסאפ</a>, או נסו שוב בעוד רגע.');
        if (submit) submit.disabled = false;
        if (label) label.textContent = 'נסו שוב';
      });
    });
  }

  document.querySelectorAll('form.lead-form').forEach(wireForm);
})();
