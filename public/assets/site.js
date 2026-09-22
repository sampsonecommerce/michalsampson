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


  // Custom select: the native macOS popup ignores color-scheme, so we draw our
  // own listbox and keep the real <select> (hidden) as the submitted control.
  function enhanceSelect(sel) {
    if (sel.dataset.csEnhanced) return;
    sel.dataset.csEnhanced = '1';

    var uid = sel.id || 'cs' + Math.random().toString(36).slice(2, 8);
    var wrap = document.createElement('div');
    wrap.className = 'cselect';
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.classList.add('cselect-native');
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cselect-btn';
    btn.id = uid + '-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');

    var label = sel.id ? document.querySelector('label[for="' + sel.id + '"]') : null;
    if (label) {
      if (!label.id) label.id = uid + '-label';
      btn.setAttribute('aria-labelledby', label.id + ' ' + btn.id);
      label.setAttribute('for', btn.id);
    }

    var text = document.createElement('span');
    text.className = 'cselect-text';
    btn.appendChild(text);
    btn.insertAdjacentHTML('beforeend',
      '<svg class="cselect-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>');

    var list = document.createElement('ul');
    list.className = 'cselect-list';
    list.id = uid + '-list';
    list.setAttribute('role', 'listbox');
    list.tabIndex = -1;
    list.hidden = true;

    var opts = Array.prototype.slice.call(sel.options);
    opts.forEach(function (o, i) {
      var li = document.createElement('li');
      li.className = 'cselect-opt';
      li.id = uid + '-o' + i;
      li.setAttribute('role', 'option');
      li.dataset.index = String(i);
      li.textContent = o.textContent;
      list.appendChild(li);
    });
    var items = Array.prototype.slice.call(list.children);

    wrap.appendChild(btn);
    wrap.appendChild(list);

    var active = sel.selectedIndex < 0 ? 0 : sel.selectedIndex;

    function paint() {
      var i = sel.selectedIndex < 0 ? 0 : sel.selectedIndex;
      text.textContent = opts[i] ? opts[i].textContent : '';
      wrap.classList.toggle('is-empty', !!opts[i] && opts[i].value === '');
      items.forEach(function (li, n) {
        li.setAttribute('aria-selected', String(n === i));
        li.classList.toggle('is-active', n === active);
      });
      list.setAttribute('aria-activedescendant', items[active] ? items[active].id : '');
    }

    function open() {
      if (!list.hidden) return;
      active = sel.selectedIndex < 0 ? 0 : sel.selectedIndex;
      list.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      paint();
      list.focus();
      if (items[active]) items[active].scrollIntoView({ block: 'nearest' });
    }

    function close(focusBtn) {
      if (list.hidden) return;
      list.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (focusBtn) btn.focus();
    }

    function choose(i) {
      if (i < 0 || i >= opts.length) return;
      sel.selectedIndex = i;
      active = i;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      paint();
      close(true);
    }

    function move(delta) {
      var n = Math.min(items.length - 1, Math.max(0, active + delta));
      active = n;
      paint();
      if (items[active]) items[active].scrollIntoView({ block: 'nearest' });
    }

    btn.addEventListener('click', function () {
      if (list.hidden) open(); else close(true);
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });

    list.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Home') { e.preventDefault(); active = 0; paint(); }
      else if (e.key === 'End') { e.preventDefault(); active = items.length - 1; paint(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'Tab') { close(false); }
    });
    list.addEventListener('blur', function () { close(false); });
    items.forEach(function (li, n) {
      li.addEventListener('mousedown', function (e) { e.preventDefault(); choose(n); });
      li.addEventListener('mousemove', function () { if (active !== n) { active = n; paint(); } });
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) close(false);
    });

    paint();
  }

  document.querySelectorAll('.field select').forEach(enhanceSelect);

  document.querySelectorAll('form.lead-form').forEach(wireForm);
})();
