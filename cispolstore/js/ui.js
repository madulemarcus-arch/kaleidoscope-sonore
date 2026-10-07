// UI shell: toast, modal, form helpers, router, theme, PIN lock, global search, quick actions.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc;
  const dbs = () => App.db.settings;

  // ---------- Toast ----------
  let tt;
  App.toast = msg => {
    let t = $('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 2800);
  };

  // ---------- Modal ----------
  const dlg = $('dlg');
  App.modal = (title, body, onOk, okLabel = 'Enregistrer') => {
    dlg.innerHTML = `<form method="dialog"><h3>${esc(title)}</h3>${body}<div class="end"><button type="button" class="btn sec" id="dcancel">${onOk ? 'Annuler' : 'Fermer'}</button>${onOk ? `<button class="btn" id="dok">${okLabel}</button>` : ''}</div></form>`;
    $('dcancel').onclick = () => dlg.close();
    if (onOk) dlg.querySelector('form').onsubmit = e => { e.preventDefault(); if (onOk() !== false) dlg.close(); };
    else dlg.querySelector('form').onsubmit = e => e.preventDefault();
    if (!dlg.open) dlg.showModal();
  };
  App.close = () => { if (dlg.open) dlg.close(); };
  App.confirm = msg => window.confirm(msg);

  // ---------- Form helpers ----------
  App.opts = (list, sel) => list.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(l)}</option>`; }).join('');
  App.f = {
    text: (id, label, val = '', x = '') => `<label class="l" for="${id}">${label}</label><input id="${id}" value="${esc(val)}" ${x}>`,
    num: (id, label, val = '', x = '') => `<label class="l" for="${id}">${label}</label><input id="${id}" type="number" inputmode="decimal" step="any" min="0" value="${esc(val)}" ${x}>`,
    date: (id, label, val = '', x = '') => `<label class="l" for="${id}">${label}</label><input id="${id}" type="date" value="${esc(val)}" ${x}>`,
    sel: (id, label, list, sel = '', x = '') => `<label class="l" for="${id}">${label}</label><select id="${id}" ${x}>${App.opts(list, sel)}</select>`,
    area: (id, label, val = '', x = '') => `<label class="l" for="${id}">${label}</label><textarea id="${id}" rows="2" ${x}>${esc(val)}</textarea>`,
    list: (id, items) => `<datalist id="${id}">${items.map(i => `<option value="${esc(i)}">`).join('')}</datalist>`
  };
  App.v = id => ($(id) ? $(id).value.trim() : '');
  App.n = id => parseFloat(String($(id) ? $(id).value : '').replace(',', '.')) || 0;
  App.clientOpts = (withNone, only) => [...(withNone ? [['', withNone]] : []), ...App.db.clients.filter(c => !only || only.includes(c.type)).map(c => [c.id, `${App.cname(c)}${c.acc ? ' · ' + c.acc : ''}`])];

  // ---------- Router ----------
  App.state = { view: 'home', params: {} };
  const render = keepScroll => {
    const y = window.scrollY, fn = App.views[App.state.view] || App.views.home;
    const r = fn(App.state.params) || {};
    $('title').innerHTML = r.sub ? `${esc(r.title)}<small>${esc(r.sub)}</small>` : esc(r.title || '');
    $('view').innerHTML = r.html || '';
    $('backBtn').hidden = !r.back; $('backBtn').dataset.to = r.back || '';
    $('logo').hidden = !!r.back;
    document.querySelectorAll('#bottom [data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === (r.nav || App.state.view)));
    if (r.after) r.after();
    window.scrollTo(0, keepScroll ? y : 0);
  };
  App.refresh = () => render(true);
  App.go = (view, params = {}, replace = false) => {
    App.state = { view, params };
    try { history[replace ? 'replaceState' : 'pushState']({ view, params }, ''); } catch (e) {}
    render(false);
  };
  window.addEventListener('popstate', e => { App.close(); App.state = e.state || { view: 'home', params: {} }; render(false); });
  $('backBtn').onclick = () => { const to = $('backBtn').dataset.to; if (to) App.go(to); else history.back(); };

  // ---------- New version banner ----------
  App.showUpdate = () => {
    if ($('upd')) return;
    const d = document.createElement('div'); d.id = 'upd';
    d.innerHTML = '<span>Nouvelle version disponible</span><button class="btn sm" id="updgo">Actualiser</button><button class="ib" id="updx" aria-label="Plus tard">✕</button>';
    document.body.appendChild(d);
    $('updgo').onclick = () => location.reload();
    $('updx').onclick = () => d.remove();
  };

  // ---------- Click delegation ----------
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const fn = App.actions[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el.dataset, el, e); }
  });
  App.actions.go = d => { App.close(); App.go(d.v, d.p ? JSON.parse(d.p) : d.id ? { id: d.id } : {}); };

  // ---------- Theme ----------
  const darkNow = () => dbs().theme === 'dark' || (dbs().theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  App.applyTheme = () => {
    const dark = darkNow();
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('themeBtn').textContent = dark ? '☀️' : '🌙';
    const co = dbs().company; $('logo').src = co.logo || 'logo.png';
  };
  $('themeBtn').onclick = () => { dbs().theme = darkNow() ? 'light' : 'dark'; App.save(); App.applyTheme(); };

  // ---------- PIN lock ----------
  const lockEl = $('lock');
  let buf = '', first = '', mode = 'enter', flow = 'unlock', fails = 0, blockedUntil = 0, lastActive = Date.now(), hiddenAt = 0;
  App.locked = false;
  const hash = async s => {
    try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
    catch (e) { let h = 5381; for (const ch of s) h = ((h << 5) + h + ch.charCodeAt(0)) | 0; return 'x' + h; }
  };
  const TITLES = { enter: 'Entrez votre code PIN', new1: 'Choisissez un code PIN à 4 chiffres', new2: 'Confirmez le code PIN' };
  const drawLock = (msg = '') => {
    lockEl.hidden = false; document.body.style.overflow = 'hidden';
    if (mode === 'recover') {
      lockEl.innerHTML = `<img src="logo.png" alt=""><h1>Code PIN oublié</h1><p>Saisissez le code de récupération remis à la création du PIN.</p><input id="rec" placeholder="XXXX-XXXX" autocapitalize="characters" autocomplete="off"><p class="warn">${msg}</p><button class="btn" data-lk="recok">Valider</button><button class="lnk" data-lk="back">Retour</button>`; return;
    }
    if (mode === 'showrec') {
      lockEl.innerHTML = `<img src="logo.png" alt=""><h1>Code de récupération</h1><p>Notez-le dans un endroit sûr. Il permet de changer le PIN si vous l'oubliez et ne sera plus affiché.</p><h1 style="letter-spacing:4px;color:var(--acc2)">${esc(msg)}</h1><button class="btn" data-lk="recdone">J'ai noté le code</button>`; return;
    }
    const dots = [0, 1, 2, 3].map(i => `<i class="${i < buf.length ? 'f' : ''}"></i>`).join('');
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(k => k ? `<button data-k="${k}">${k}</button>` : '<i></i>').join('');
    const cancel = flow !== 'unlock' ? '<button class="lnk" data-lk="cancel">Annuler</button>' : '';
    lockEl.innerHTML = `<img src="logo.png" alt=""><h1>CISPOLstore Manager</h1><p>Gérez votre activité en toute simplicité</p><p><b>${TITLES[mode]}</b></p><div class="dots" id="dots">${dots}</div><p class="warn" id="lmsg">${msg}</p><div class="pad">${keys}</div>${mode === 'enter' && flow === 'unlock' ? '<button class="lnk" data-lk="forgot">Code PIN oublié ?</button>' : ''}${mode === 'new1' && flow === 'setup' ? '<button class="lnk" data-lk="skip">Plus tard</button>' : ''}${cancel}`;
  };
  const unlock = () => { lockEl.hidden = true; lockEl.innerHTML = ''; document.body.style.overflow = ''; App.locked = false; lastActive = Date.now(); fails = 0; };
  App.showLock = (m = 'enter', f = 'unlock') => { buf = ''; first = ''; mode = m; flow = f; App.locked = f === 'unlock'; drawLock(); };
  App.hasPin = () => !!dbs().pin;
  const newPin = async pin => {
    const salt = App.uid(), rec = Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    dbs().pin = { salt, hash: await hash(salt + pin), rec: await hash(salt + rec) }; App.save();
    mode = 'showrec'; drawLock(rec.slice(0, 4) + '-' + rec.slice(4));
  };
  const submitPin = async () => {
    const p = dbs().pin;
    if (mode === 'enter') {
      if (Date.now() < blockedUntil) { buf = ''; return drawLock('Trop d\'essais. Patientez quelques secondes.'); }
      if (p && await hash(p.salt + buf) === p.hash) {
        if (flow === 'remove') { dbs().pin = null; App.save(); unlock(); App.toast('PIN désactivé'); if (App.state.view === 'settings') App.refresh(); return; }
        if (flow === 'change') { buf = ''; mode = 'new1'; return drawLock(); }
        return unlock();
      }
      buf = ''; if (++fails >= 5) { blockedUntil = Date.now() + 30000; fails = 0; }
      drawLock('Code incorrect'); const d = $('dots'); if (d) d.classList.add('shake'); return;
    }
    if (mode === 'new1') { first = buf; buf = ''; mode = 'new2'; return drawLock(); }
    if (mode === 'new2') {
      if (buf === first) return newPin(buf);
      buf = ''; first = ''; mode = 'new1'; drawLock('Les deux codes ne correspondent pas');
    }
  };
  lockEl.addEventListener('click', async e => {
    const k = e.target.closest('[data-k]'), l = e.target.closest('[data-lk]');
    if (k) {
      if (k.dataset.k === '⌫') buf = buf.slice(0, -1); else if (buf.length < 4) buf += k.dataset.k;
      const msg = ($('lmsg') || {}).textContent || ''; drawLock(buf.length ? '' : msg);
      if (buf.length === 4) submitPin();
      return;
    }
    if (!l) return;
    const a = l.dataset.lk;
    if (a === 'forgot') { mode = 'recover'; drawLock(); }
    else if (a === 'back') { App.showLock('enter', 'unlock'); }
    else if (a === 'skip' || a === 'cancel') unlock();
    else if (a === 'recdone') { unlock(); App.toast('PIN enregistré'); if (App.state.view === 'settings') App.refresh(); }
    else if (a === 'recok') {
      const p = dbs().pin, code = ($('rec').value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (p && await hash(p.salt + code) === p.rec) { buf = ''; first = ''; mode = 'new1'; flow = 'unlock'; drawLock('Choisissez un nouveau PIN'); }
      else drawLock('Code de récupération incorrect');
    }
  });
  $('lockBtn').onclick = () => { if (App.hasPin()) App.showLock('enter', 'unlock'); else App.showLock('new1', 'setup'); };

  // Auto-lock after inactivity / when the app was in the background
  ['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true }));
  const idleLimit = () => (+dbs().lockMin || 0) * 60000;
  setInterval(() => { if (App.hasPin() && !App.locked && idleLimit() && Date.now() - lastActive > idleLimit()) App.showLock('enter', 'unlock'); }, 10000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (App.hasPin() && !App.locked && idleLimit() && Date.now() - hiddenAt > idleLimit()) App.showLock('enter', 'unlock');
  });

  // ---------- Global search ----------
  const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const match = (hay, q) => { const h = norm(hay); return q.split(/\s+/).filter(Boolean).every(t => h.includes(t)); };
  App.searchAll = raw => {
    const q = norm(raw).trim(), db = App.db; if (!q) return [];
    const g = [];
    const cl = db.clients.filter(c => match([App.cname(c), c.first, c.last, c.code, c.acc, c.phone, c.phone2, c.address, c.city, c.quarter, c.installAddr, c.serial, c.kit, c.plan, c.article].join(' '), q));
    if (cl.length) g.push(['Clients', cl.slice(0, 8).map(c => ({ v: 'client', id: c.id, t: App.cname(c), s: [App.TYPES[c.type], c.acc, c.phone].filter(Boolean).join(' · ') }))]);
    const inv = db.invoices.filter(i => match([i.number, App.cname(App.client(i.clientId)), i.lines.map(l => l.desc).join(' ')].join(' '), q));
    if (inv.length) g.push(['Factures', inv.slice(-8).reverse().map(i => ({ v: 'invoice', id: i.id, t: i.number, s: `${App.cname(App.client(i.clientId))} · ${App.fmt(App.invTotal(i), i.currency)}` }))]);
    const pr = db.products.filter(p => match([p.name, p.ref, p.cat].join(' '), q));
    if (pr.length) g.push(['Stock', pr.slice(0, 8).map(p => ({ v: 'stock', id: p.id, t: p.name, s: `${p.cat} · ${App.tracked(p) ? p.qty + ' ' + p.unit : 'sans stock'}` }))]);
    const su = db.suppliers.filter(s => match([s.name, s.phone, s.goods].join(' '), q));
    if (su.length) g.push(['Fournisseurs', su.slice(0, 8).map(s => ({ v: 'supplier', id: s.id, t: s.name, s: s.phone || '' }))]);
    return g;
  };
  const resultsHtml = q => {
    const g = App.searchAll(q);
    if (!q.trim()) return '<p class="empty">Tapez un nom, un numéro ACC, un téléphone, une facture (FAC-2026-…), un numéro de série ou un matériel.</p>';
    if (!g.length) return '<p class="empty">Aucun résultat.</p>';
    return g.map(([t, items]) => `<h2 class="sec">${t}</h2><div class="list">${items.map(r => `<button class="item" data-act="sgo" data-v="${r.v}" data-id="${esc(r.id)}"><div class="grow"><b>${esc(r.t)}</b><small>${esc(r.s)}</small></div></button>`).join('')}</div>`).join('');
  };
  App.search = () => {
    App.modal('Recherche', `<div class="search"><input id="gq" placeholder="Rechercher client, ACC, facture, matériel…" autocomplete="off"></div><div id="gres">${resultsHtml('')}</div>`);
    $('gq').oninput = () => { $('gres').innerHTML = resultsHtml($('gq').value); };
    setTimeout(() => $('gq').focus(), 50);
  };
  App.actions.search = () => App.search();
  App.actions.sgo = d => { App.close(); App.go(d.v === 'stock' ? 'stock' : d.v, { id: d.id, q: d.v === 'stock' ? $('gq')?.value : undefined }); };
  $('searchBtn').onclick = () => App.search();

  // ---------- Quick actions (+) ----------
  const q = (act, ico, t, s) => `<button class="opt" data-act="${act}"><span class="ico">${ico}</span><span><b>${t}</b><small>${s}</small></span></button>`;
  App.actions.quick = () => App.modal('Action rapide',
    q('q_client', '👤', 'Nouveau client', 'Géré, matériel ou installation') +
    q('q_renew', '📡', 'Renouveler un abonnement', 'Prolonger un client géré') +
    q('q_invoice', '🧾', 'Nouvelle facture', 'Matériel, abonnement, installation…') +
    q('q_sale', '🛒', 'Nouvelle vente', 'Facture de matériel') +
    q('q_stockin', '📥', 'Entrée de stock', 'Réception de matériel') +
    q('q_install', '🔧', 'Installation', 'Enregistrer une intervention'));
  const after = fn => () => { App.close(); setTimeout(fn, 30); };
  App.actions.q_client = after(() => App.clientForm());
  App.actions.q_renew = after(() => App.renewPicker());
  App.actions.q_invoice = after(() => App.invoiceStart());
  App.actions.q_sale = after(() => App.invoiceForm('materiel'));
  App.actions.q_stockin = after(() => App.stockInForm());
  App.actions.q_install = after(() => App.installForm());

  // ---------- "Plus" menu ----------
  const item = (v, ico, t, s) => `<button class="item" data-act="go" data-v="${v}"><span class="ico avatar" style="background:var(--navy)">${ico}</span><div class="grow"><b>${t}</b><small>${s}</small></div><span class="mut">›</span></button>`;
  App.views.more = () => ({
    title: 'Plus', nav: 'more',
    html: `<div class="list">${item('subs', '📡', 'Abonnements', 'Calendrier et renouvellements')}${item('invoices', '🧾', 'Factures', 'Créer, imprimer, exporter')}${item('payments', '💰', 'Paiements', 'Encaissements et modes de paiement')}${item('suppliers', '🚚', 'Fournisseurs', 'Gérer vos fournisseurs')}${item('installs', '🔧', 'Installations', 'Historique des interventions')}${item('expenses', '💸', 'Dépenses', 'Toutes les dépenses de l\'activité')}${item('reports', '📊', 'Rapports', 'Ventes, bénéfices, stock…')}${item('settings', '⚙️', 'Paramètres', 'Entreprise, taux, PIN, sauvegarde')}<button class="item" data-act="shareapp"><span class="ico avatar" style="background:var(--navy)">📤</span><div class="grow"><b>Partager l'application</b><small>Envoyer le lien par WhatsApp, SMS…</small></div><span class="mut">›</span></button></div>
      <p class="mut" style="text-align:center;margin-top:18px">CISPOLstore Manager · version 2.0</p>`
  });
})();
