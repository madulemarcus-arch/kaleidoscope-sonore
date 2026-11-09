// Profiles and security: roles (administrateur, comptable, vendeur, technicien / employé, livreur), personal PIN (salted hash),
// lock screen, auto-lock per device, recovery code, and limits on screens and actions by role. Without any profile the app is open (single owner).
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, db = () => App.db;
  const R = App.roles = {};
  R.ROLES = { admin: 'Administrateur', accountant: 'Comptable', seller: 'Vendeur', tech: 'Technicien / employé', driver: 'Livreur' };
  const PERMS = { admin: ['*'], accountant: ['sell', 'pay', 'clientedit', 'stockedit', 'costs', 'expense', 'cash', 'reports', 'export'], seller: ['sell', 'pay', 'clientedit'], tech: [], driver: ['pay'] };
  const VIEWS = { admin: '*', accountant: ['clients', 'sales', 'stock', 'suppliers', 'money', 'cash', 'purchases', 'contracts', 'data'], seller: ['clients', 'sales', 'stock'], tech: ['clients', 'services', 'interventions', 'contracts'], driver: ['clients', 'delivery'] };
  R.perms = role => PERMS[role] || [];
  const state = { locked: false };
  App.user = null;

  // ---------- who may do what ----------
  App.can = p => { if (!db().users.length) return true; const u = App.user; if (!u || state.locked) return false; const l = PERMS[u.role] || []; return l.includes('*') || l.includes(p); };
  App.canView = id => { if (!db().users.length) return true; if (id === 'home' || id === 'more') return true; const u = App.user; if (!u || state.locked) return false; const v = VIEWS[u.role]; return v === '*' || (v || []).includes(id); };
  // wrap an entry point so a profile without the right gets a clear message instead of the form
  const guard = (obj, fn, perm) => { const f = obj && obj[fn]; if (!f) return; obj[fn] = function () { if (!App.can(perm)) { App.toast('Action non autorisée pour votre profil', 'err'); return; } return f.apply(this, arguments); }; };
  const wrapAll = () => {
    guard(App.stock, 'form', 'stockedit'); guard(App.stock, 'moveForm', 'stockedit'); guard(App.stock, 'inventory', 'stockedit'); guard(App.stock, 'reorder', 'stockedit');
    guard(App.suppliers, 'form', 'stockedit'); guard(App.clients, 'form', 'clientedit'); guard(App.clients, 'importSheet', 'clientedit');
    guard(App.sales, 'invoiceForm', 'sell'); guard(App.sales, 'payForm', 'pay'); guard(App.quotes, 'form', 'sell'); guard(App.fin, 'expenseForm', 'expense');
    guard(App.cash, 'closeSheet', 'cash'); guard(App.clients, 'remove', 'delete'); guard(App.sales, 'delPayment', 'delete');
  };

  // ---------- PIN hashing ----------
  const te = new TextEncoder(), hex = u => [...new Uint8Array(u)].map(b => b.toString(16).padStart(2, '0')).join('');
  R.hash = async (salt, secret) => hex(await crypto.subtle.digest('SHA-256', te.encode(salt + ':' + secret)));
  R.salt = () => hex(crypto.getRandomValues(new Uint8Array(8)));
  R.validPin = p => /^\d{4,8}$/.test(p);
  R.makeCode = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(12)); return [...r].map(x => a[x % a.length]).join('').replace(/(.{4})/g, '$1-').slice(0, 14); };

  // ---------- profiles ----------
  R.addUser = async (name, role, pin) => {
    if (!name || !R.ROLES[role] || !R.validPin(pin)) throw new Error('Nom, profil et PIN (4 à 8 chiffres) requis');
    const first = !db().users.length; if (first && role !== 'admin') throw new Error('Le premier profil doit être administrateur');
    const salt = R.salt(), u = { id: App.uid(), name, role, salt, hash: await R.hash(salt, pin) }; db().users.push(u);
    let code = null; if (first) { code = R.makeCode(); const rs = R.salt(); db().settings.recovery = { salt: rs, hash: await R.hash(rs, code.replace(/-/g, '')) }; App.user = u; }
    App.log('user.add', name + ' (' + role + ')'); App.save(); return { user: u, code };
  };
  R.setPin = async (id, pin) => { const u = db().users.find(x => x.id === id); if (!u || !R.validPin(pin)) throw new Error('PIN de 4 à 8 chiffres requis'); u.salt = R.salt(); u.hash = await R.hash(u.salt, pin); App.log('user.pin', u.name); App.save(); };
  R.removeUser = id => { const u = db().users.find(x => x.id === id); if (!u) return false; if (u.role === 'admin' && db().users.filter(x => x.role === 'admin').length < 2) return false; db().users = db().users.filter(x => x.id !== id); App.log('user.delete', u.name); if (!db().users.length) { db().settings.recovery = null; App.user = null; } App.save(); return true; };
  R.newRecovery = async () => { const code = R.makeCode(), rs = R.salt(); db().settings.recovery = { salt: rs, hash: await R.hash(rs, code.replace(/-/g, '')) }; App.log('security.recovery', ''); App.save(); return code; };

  // ---------- per-device auto-lock ----------
  const dev = () => { try { return JSON.parse(localStorage.getItem('biz.dev')) || {}; } catch (e) { return {}; } };
  R.lockMin = () => { const d = dev(); return d.lockMin == null ? 5 : d.lockMin; };
  R.setLockMin = n => { const d = dev(); d.lockMin = n; try { localStorage.setItem('biz.dev', JSON.stringify(d)); } catch (e) { } };
  let last = Date.now(); ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { last = Date.now(); }, { passive: true }));
  setInterval(() => { if (db().users.length && App.user && !state.locked && R.lockMin() > 0 && Date.now() - last > R.lockMin() * 60000) R.lock(); }, 10000);

  // ---------- lock screen ----------
  let fails = 0, until = 0;
  R.lock = () => {
    if (!db().users.length) return; state.locked = true; if (App.user) App.log('logout', ''); App.user = null; App.$$('.sheet-wrap').forEach(e => e.remove());
    let el = App.$('#lock'); if (!el) { el = document.createElement('div'); el.id = 'lock'; el.className = 'lockscr'; document.body.appendChild(el); } el.hidden = false; pick(el); App.render && App.render();
  };
  const pick = el => {
    el.innerHTML = '<div class="lbox"><div class="logo">' + (db().settings.logo ? '<img alt="" src="' + db().settings.logo + '">' : '<b>CB</b>') + '</div><h1>' + esc(db().settings.name || App.NAME) + '</h1><p class="muted">Qui êtes-vous ?</p><div class="ulist">' + db().users.map(u => '<button class="btn ghost" data-u="' + u.id + '"><span class="av">' + esc(App.letterOf(u.name)) + '</span><span><b>' + esc(u.name) + '</b><br><small>' + esc(R.ROLES[u.role]) + '</small></span></button>').join('') + '</div></div>';
    el.querySelectorAll('[data-u]').forEach(b => b.onclick = () => pin(el, db().users.find(u => u.id === b.dataset.u)));
  };
  const pin = (el, u) => {
    el.innerHTML = '<div class="lbox"><h1>' + esc(u.name) + '</h1><p class="muted">Entrez votre PIN</p><input id="lpin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" aria-label="PIN" autofocus><p id="lmsg" class="muted" style="color:var(--bad)"></p><div class="tools"><button class="btn ghost" id="lback">Retour</button><button class="btn primary" id="lgo">Entrer</button></div><button class="btn ghost sm" id="lforgot">PIN oublié ?</button></div>';
    const go = async () => {
      const msg = el.querySelector('#lmsg'); if (Date.now() < until) { msg.textContent = 'Trop d\'essais : patientez ' + Math.ceil((until - Date.now()) / 1000) + ' s'; return; }
      const v = el.querySelector('#lpin').value; if (!v) return;
      if (await R.hash(u.salt, v) === u.hash) { fails = 0; state.locked = false; App.user = u; last = Date.now(); App.log('login', ''); App.save(); el.hidden = true; if (!App.canView(App.current && App.current())) App.go('home'); App.render(); }
      else { fails++; el.querySelector('#lpin').value = ''; if (fails >= 5) { until = Date.now() + 30000; fails = 0; msg.textContent = 'Trop d\'essais : patientez 30 s'; } else msg.textContent = 'PIN incorrect'; App.log('login.fail', u.name); }
    };
    el.querySelector('#lgo').onclick = go; el.querySelector('#lpin').onkeydown = e => { if (e.key === 'Enter') go(); }; el.querySelector('#lback').onclick = () => pick(el); setTimeout(() => { const i = el.querySelector('#lpin'); i && i.focus(); }, 50);
    el.querySelector('#lforgot').onclick = () => recover(el);
  };
  const recover = el => {
    const admins = db().users.filter(u => u.role === 'admin');
    el.innerHTML = '<div class="lbox"><h1>PIN oublié</h1><p class="muted">Saisissez le code de récupération noté à la création du premier profil.</p><input id="lcode" autocomplete="off" placeholder="XXXX-XXXX-XXXX" aria-label="Code de récupération"><label class="fld"><span>Profil à réinitialiser</span><select id="lwho">' + db().users.map(u => '<option value="' + u.id + '">' + esc(u.name) + '</option>').join('') + '</select></label><label class="fld"><span>Nouveau PIN</span><input id="lnew" type="password" inputmode="numeric" maxlength="8"></label><p id="lmsg" style="color:var(--bad)"></p><div class="tools"><button class="btn ghost" id="lback">Retour</button><button class="btn primary" id="lok">Réinitialiser</button></div></div>';
    el.querySelector('#lback').onclick = () => pick(el);
    el.querySelector('#lok').onclick = async () => {
      const msg = el.querySelector('#lmsg'), rec = db().settings.recovery, code = el.querySelector('#lcode').value.toUpperCase().replace(/[^A-Z0-9]/g, ''), np = el.querySelector('#lnew').value;
      if (!rec || await R.hash(rec.salt, code) !== rec.hash) { msg.textContent = 'Code incorrect'; return; } if (!R.validPin(np)) { msg.textContent = 'Nouveau PIN : 4 à 8 chiffres'; return; }
      await R.setPin(el.querySelector('#lwho').value, np); App.log('security.recovered', ''); App.toast('PIN réinitialisé'); pick(el);
    };
  };
  R.boot = () => { if (db().users.length) { state.locked = true; App.user = null; let el = App.$('#lock'); if (!el) { el = document.createElement('div'); el.id = 'lock'; el.className = 'lockscr'; document.body.appendChild(el); } el.hidden = false; pick(el); } };
  R.isLocked = () => state.locked && db().users.length > 0;
  R.wrap = wrapAll;
  window.addEventListener('DOMContentLoaded', () => { });
  App.ready.then(() => { wrapAll(); R.boot(); });
})();
