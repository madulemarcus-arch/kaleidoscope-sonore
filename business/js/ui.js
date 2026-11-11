// UI kit: bottom sheets, toasts, confirm, quick date chips, − / + steppers, theme, image import.
(function () {
  const App = window.App, esc = App.esc, ui = App.ui = {};

  // ---------- theme ----------
  ui.applyTheme = () => {
    const t = App.db.settings.theme, dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#0a1a2c' : '#12365d';
  };
  matchMedia('(prefers-color-scheme: dark)').addEventListener && matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => ui.applyTheme());

  // ---------- toast ----------
  App.toast = (msg, kind, action) => {
    const box = App.$('#toasts'), el = document.createElement('div'); el.className = 'toast ' + (kind || '');
    el.innerHTML = '<span>' + esc(msg) + '</span>' + (action ? '<button type="button">' + esc(action.label) + '</button>' : '');
    if (action) el.querySelector('button').onclick = () => { action.fn(); el.remove(); };
    box.appendChild(el); setTimeout(() => el.remove(), action ? 7000 : 2800);
  };

  // ---------- sheet (form rising from the bottom) ----------
  // opts: {title, html, actions:[{label, cls, fn(sheet)->false to stay open}], onMount(sheet), wide}
  ui.sheet = opts => {
    const layer = App.$('#layer'), wrap = document.createElement('div'); wrap.className = 'sheet-wrap';
    wrap.innerHTML = '<div class="sheet-bg"></div><section class="sheet' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(opts.title || '') + '"><header><h2>' + esc(opts.title || '') + '</h2><button type="button" class="x" aria-label="Fermer">×</button></header><div class="body">' + (opts.html || '') + '</div>' + (opts.actions && opts.actions.length ? '<footer></footer>' : '') + '</section>';
    layer.appendChild(wrap);
    const sheet = { el: wrap, body: wrap.querySelector('.body'), q: s => wrap.querySelector(s), close() { document.removeEventListener('keydown', esc_); wrap.classList.remove('on'); setTimeout(() => wrap.remove(), 180); opts.onClose && opts.onClose(); } };
    const esc_ = e => { if (e.key === 'Escape' && layer.lastElementChild === wrap) sheet.close(); };
    document.addEventListener('keydown', esc_);
    wrap.querySelector('.sheet-bg').onclick = wrap.querySelector('.x').onclick = () => sheet.close();
    const foot = wrap.querySelector('footer');
    (opts.actions || []).forEach(a => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + (a.cls || ''); b.textContent = a.label;
      b.onclick = async () => { const r = a.fn ? await a.fn(sheet) : true; if (r !== false) sheet.close(); }; foot.appendChild(b);
    });
    requestAnimationFrame(() => wrap.classList.add('on'));
    opts.onMount && opts.onMount(sheet);
    const first = wrap.querySelector('input,select,textarea'); if (first && !opts.noFocus) setTimeout(() => first.focus(), 60);
    return sheet;
  };
  ui.confirm = (msg, ok, danger) => new Promise(res => {
    let done = false; const fin = v => { if (!done) { done = true; res(v); } };
    ui.sheet({ title: 'Confirmation', html: '<p>' + esc(msg) + '</p>', onClose: () => fin(false), actions: [{ label: 'Annuler', cls: 'ghost' }, { label: ok || 'Confirmer', cls: danger ? 'danger' : 'primary', fn: () => { fin(true); } }] });
  });

  // ---------- form bits ----------
  // Reads every [name] of a container into an object (numbers via data-num, checkboxes as booleans).
  ui.read = root => {
    const o = {}; root.querySelectorAll('[name]').forEach(el => {
      o[el.name] = el.type === 'checkbox' ? el.checked : el.type === 'radio' ? (el.checked ? el.value : o[el.name]) : el.dataset.num !== undefined ? (parseFloat(String(el.value).replace(',', '.')) || 0) : el.value.trim();
    }); return o;
  };
  ui.field = (label, inner, hint) => '<label class="fld"><span>' + esc(label) + '</span>' + inner + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</label>';
  ui.input = (name, val, o) => { o = o || {}; return '<input name="' + name + '" value="' + esc(val == null ? '' : val) + '"' + (o.type ? ' type="' + o.type + '"' : '') + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.num ? ' data-num inputmode="decimal"' : '') + (o.tel ? ' inputmode="tel"' : '') + (o.max ? ' maxlength="' + o.max + '"' : '') + '>'; };
  ui.select = (name, opts, val) => '<select name="' + name + '">' + opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(v) + '"' + (v === val ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>';
  // Numeric keypad field with − / + buttons (quantities)
  ui.stepper = (name, val, min, step) => '<div class="stepper" data-min="' + (min == null ? 0 : min) + '" data-step="' + (step || 1) + '"><button type="button" data-d="-1" aria-label="Moins">−</button><input name="' + name + '" data-num inputmode="decimal" value="' + (val == null ? 1 : val) + '"><button type="button" data-d="1" aria-label="Plus">+</button></div>';
  // Quick dates: Aujourd'hui / Hier / −7 j
  ui.dateField = (name, val) => '<div class="datef"><input type="date" name="' + name + '" value="' + esc(val || App.today()) + '"><div class="chips"><button type="button" data-dd="0">Aujourd\'hui</button><button type="button" data-dd="-1">Hier</button><button type="button" data-dd="-7">−7 j</button></div></div>';
  document.addEventListener('click', e => {
    const st = e.target.closest('.stepper button'), dd = e.target.closest('.datef [data-dd]');
    if (st) { const box = st.parentNode, inp = box.querySelector('input'), step = +box.dataset.step, min = +box.dataset.min; const v = Math.max(min, Math.round(((parseFloat(String(inp.value).replace(',', '.')) || 0) + step * +st.dataset.d) * 1000) / 1000); inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    if (dd) { dd.closest('.datef').querySelector('input').value = App.addDays(App.today(), +dd.dataset.dd); }
  });

  // Reads an image file, shrinks it and returns a PNG/JPEG data URL (logo, stamp).
  ui.pickImage = (file, max) => new Promise((res, rej) => {
    if (!file) return rej(); const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, (max || 400) / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL(/png|gif|svg/.test(file.type) ? 'image/png' : 'image/jpeg', .85)); }; img.onerror = rej; img.src = r.result; };
    r.onerror = rej; r.readAsDataURL(file);
  });

  // ---------- quick exchange-rate editor (one tap on the rate chip) ----------
  ui.rateSheet = () => {
    const s = App.db.settings;
    ui.sheet({ title: 'Taux de change', html: '<p class="muted">1 ' + esc(s.currency) + ' = ? ' + esc(s.cur2) + '</p>' + ui.field('Taux', ui.input('rate', s.rate, { num: 1 })) + '<p class="muted">Chaque document garde le taux du jour où il a été créé.</p>',
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: sh => { const v = ui.read(sh.body).rate; if (!(v > 0)) { App.toast('Taux invalide', 'err'); return false; } App.money.setRate(v); App.toast('Taux mis à jour'); } }] });
  };
})();
