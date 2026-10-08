// Profiles (administrator, accountant, salesperson, technician, delivery driver): each person signs in with their own PIN
// and only sees the screens and actions of their profile. This controls the interface, it is not encryption of the data.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const ALL = ['home', 'clients', 'client', 'subs', 'rappels', 'stock', 'invoices', 'invoice', 'payments', 'impayes', 'suppliers', 'supplier', 'technicians', 'technician', 'installs', 'expenses', 'reports', 'settings', 'livraisons', 'users', 'rapportmois', 'daily', 'finance', 'more', 'profile'];
  // actions only the administrator may run
  const ADMIN = /^(del[a-z]+|pen_del|backup|plansfix|setco|setapp|pin[a-z]+|sync[a-z]+|drive_[a-z]+|msgreset|users_[a-z]+|dl_del|restore)$/;
  const COMMON = /^(go|copy|calday|calnav|cltab|clfilter|search|sgo|stcat|invfilter|dper|repper|reptab|paymode|lockNow|me_[a-z]+|shareapp|cf_type|dl_filter|dl_view)$/;
  const ROLES = {
    admin: { label: 'Administrateur', icon: '🛡️', views: ALL, home: 'home', nav: ['home', 'clients', 'finance', 'stock', 'more'], fab: true, costs: true, finance: true, stockedit: true, desc: 'Voit et modifie tout, gère les profils et les réglages.' },
    comptable: { label: 'Comptable', icon: '📒', views: ALL.filter(v => !['settings', 'users'].includes(v)), home: 'home', nav: ['home', 'clients', 'finance', 'stock', 'more'], fab: true, costs: true, finance: true, stockedit: true, desc: 'Factures, paiements, dépenses, rapports et stock. Ne supprime pas, pas de réglages.' },
    vendeur: { label: 'Vendeur', icon: '🛒', views: ['home', 'clients', 'client', 'subs', 'rappels', 'stock', 'invoices', 'invoice', 'payments', 'impayes', 'installs', 'livraisons', 'more', 'profile'], home: 'home', nav: ['home', 'clients', 'stock', 'more'], fab: true, costs: false, finance: false, stockedit: false, deny: /^(newexp|newsup|editsup|newtech|edittech|paytech|pen_edit|stin|stout|newprod|editprod|exportcsv|csvdo|xlsx|repcsv)$/, desc: 'Clients, abonnements, factures et paiements. Ne voit ni les coûts ni les bénéfices.' },
    technicien: { label: 'Technicien', icon: '🧰', solo: true, views: ['mestaches'], home: 'mestaches', nav: [], fab: false, costs: false, finance: false, stockedit: false, only: /^(newinst|rmmat)$/, desc: 'Une seule fenêtre : ses interventions (client, adresse), et il enregistre ses installations.' },
    livreur: { label: 'Livreur', icon: '🚚', solo: true, views: ['livraisons'], home: 'livraisons', nav: [], fab: false, costs: false, finance: false, stockedit: false, only: /^dl_[a-z]+$/, desc: 'Une seule fenêtre : ses livraisons (client, adresse), il note livré ou non livré.' }
  };
  App.ROLES = ROLES;
  const S = () => App.db.settings;
  App.users = () => S().users || [];
  App.multi = () => App.users().some(u => u.active !== false);
  App.me = () => App.multi() ? App.user : { id: '', name: 'Administrateur', role: 'admin' };
  const role = () => { const m = App.me(); return ROLES[(m && m.role) || 'admin'] || ROLES.admin; };
  App.role = role;
  App.canView = v => !App.multi() || (!!App.user && role().views.includes(v));
  App.can = k => !App.multi() || (!!App.user && !!role()[k]);
  App.guard = act => {
    if (!App.multi()) return true;
    if (!App.user) return false;
    const r = role(); if (r === ROLES.admin) return true;
    if (r.only) return COMMON.test(act) || r.only.test(act);
    return !ADMIN.test(act) && !(r.deny && r.deny.test(act));
  };

  // ---------- Navigation adapted to the profile ----------
  const NAVI = { home: ['🏠', 'Accueil'], clients: ['👥', 'Clients'], finance: ['🏦', 'Finance'], stock: ['📦', 'Stock'], installs: ['🔧', 'Install.'], livraisons: ['🚚', 'Livraisons'], more: ['☰', 'Plus'] };
  App.applyRole = () => {
    const r = role(), m = App.me();
    document.body.classList.toggle('solo', !!r.solo);
    const btn = v => `<button data-act="go" data-v="${v}" data-nav="${v}"><span>${NAVI[v][0]}</span>${NAVI[v][1]}</button>`;
    $('bottom').innerHTML = r.fab ? r.nav.slice(0, 2).map(btn).join('') + '<i></i>' + r.nav.slice(2).map(btn).join('') : r.nav.map(btn).join('');
    $('bottom').style.gridTemplateColumns = `repeat(${r.nav.length + (r.fab ? 1 : 0)},1fr)`;
    $('fab').hidden = !r.fab; $('syncBtn').hidden = !(r === ROLES.admin);
    $('searchBtn').hidden = !r.views.includes('clients');
    if (r.solo) { $('searchBtn').hidden = true; $('syncBtn').hidden = true; }
    document.querySelectorAll('#side nav [data-v]').forEach(b => { b.hidden = !App.canView(b.dataset.v); });
    let who = $('who'); if (!who) { who = document.createElement('div'); who.id = 'who'; who.className = 'sfoot'; $('side').appendChild(who); }
    who.innerHTML = App.multi() && m ? `<small>${r.icon} ${esc(m.name)} · ${r.label}</small>` : '';
    if (!App.canView(App.state.view)) App.go(r.home, {}, true);
  };
  const origGo = App.go;
  App.go = (view, params, replace) => { if (App.multi() && !App.user) return origGo(view, params, replace); // lock screen is up
    if (!App.canView(view)) { App.toast('Écran non disponible pour votre profil'); view = role().home; params = {}; } return origGo(view, params, replace); };
  App.me_login = u => { const same = App.user && App.user.id === u.id; App.user = u; App.applyRole(); if (!same || !App.canView(App.state.view)) App.go(role().home, {}, true); else App.refresh(); };
  // sign out when the profile disappears (removed/deactivated, or sync switched the app to multi-user)
  setInterval(() => {
    if (!App.multi()) { if (App.user) { App.user = null; App.applyRole(); } return; }
    const u = App.user && App.users().find(x => x.id === App.user.id && x.active !== false);
    if (App.user && !u) { App.user = null; App.showLock('enter', 'unlock'); }
    else if (!App.user && !App.locked) App.showLock('enter', 'unlock');
    else if (u && u.role !== App.user.role) { App.user = u; App.applyRole(); }
  }, 4000);

  // ---------- "Plus" menu / profile ----------
  App.views.profile = () => {
    const m = App.me(), r = role();
    return { title: 'Mon profil', back: 'more', nav: 'more', html: `<div class="card"><div class="row" style="align-items:center"><span class="avatar big" style="flex:none">${r.icon}</span><div><h2 style="font-size:18px">${esc(m.name)}</h2><span class="pill blue">${r.label}</span></div></div><p class="mut">${r.desc}</p></div>
      <div class="list"><button class="item" data-act="me_pin"><span class="ico avatar" style="background:var(--navy)">🔑</span><div class="grow"><b>Changer mon code PIN</b><small>Votre code personnel à 4 chiffres</small></div><span class="mut">›</span></button>
      <button class="item" data-act="lockNow"><span class="ico avatar" style="background:var(--navy)">🔒</span><div class="grow"><b>Verrouiller / changer de profil</b><small>Un autre profil se connecte avec son propre code</small></div><span class="mut">›</span></button></div>` };
  };
  // footer of the single-window profiles: own PIN and sign out
  App.soloFoot = () => `<div class="bar" style="margin-top:24px;justify-content:center"><button class="btn sm sec" data-act="me_pin">🔑 Mon code PIN</button><button class="btn sm sec" data-act="lockNow">🔒 Quitter</button></div><p class="mut" style="text-align:center;font-size:13px">${esc((App.user || {}).name || '')}</p>`;
  App.actions.me_pin = () => { if (!App.user) return; App.showLock('enter', 'change'); };

  // ---------- Administration of profiles ----------
  const rows = () => App.users().map(u => `<button class="item" data-act="users_edit" data-id="${u.id}" style="${u.active === false ? 'opacity:.55' : ''}"><span class="avatar">${(ROLES[u.role] || ROLES.admin).icon}</span><div class="grow"><b>${esc(u.name)}</b><small>${(ROLES[u.role] || ROLES.admin).label}${u.active === false ? ' · désactivé' : ''}</small></div><span class="mut">›</span></button>`).join('');
  App.views.users = () => ({
    title: 'Utilisateurs', back: 'settings', nav: 'more',
    html: App.multi() ? `<h2 class="sec">Ajouter une personne</h2><div class="list">${Object.entries(ROLES).filter(([k]) => k !== 'admin').map(([k, r]) => `<button class="item" data-act="users_new" data-role="${k}"><span class="avatar">${r.icon}</span><div class="grow"><b>${r.label}</b><small>${r.desc}</small></div><span class="btn sm">+ Ajouter</span></button>`).join('')}<button class="item" data-act="users_new" data-role="admin"><span class="avatar">${ROLES.admin.icon}</span><div class="grow"><b>Un autre administrateur</b><small>${ROLES.admin.desc}</small></div><span class="btn sm sec">+ Ajouter</span></button></div>
      <h2 class="sec">Profils créés (${App.users().length})</h2><div class="list">${rows()}</div>
            <p class="mut" style="font-size:13px">Chacun entre son code PIN à l'ouverture. Les profils se synchronisent entre appareils. Cela règle l'affichage et les actions autorisées ; ce n'est pas un chiffrement des données présentes sur l'appareil.</p>
      <div class="bar"><button class="btn sm del" data-act="users_off">Désactiver les profils</button></div>`
      : `<div class="card"><b>Profils désactivés</b><p class="mut">Aujourd'hui, la personne qui ouvre l'application voit et modifie tout. Activez les profils pour donner à chacun (comptable, vendeur, technicien, livreur) ses propres écrans et son propre code PIN.</p><button class="btn" data-act="users_on">Activer les profils</button></div>`
  });
  const roleOpts = Object.entries(ROLES).map(([k, r]) => [k, `${r.icon} ${r.label}`]);
  const pinOk = p => /^\d{4}$/.test(p);
  const clash = async (pin, exceptId) => { for (const u of App.users()) if (u.id !== exceptId && u.pin && await App.hash(u.pin.salt + pin) === u.pin.hash) return true; return false; };
  const mkPin = async pin => { const salt = App.uid(); return { salt, hash: await App.hash(salt + pin) }; };
  App.actions.users_on = () => {
    const hasPin = !!S().pin;
    App.modal('Activer les profils', `<p>Vous devenez l'<b>administrateur</b>. ${hasPin ? 'Votre code PIN actuel est conservé.' : 'Choisissez votre code PIN d\'administrateur.'}</p>${F.text('f_name', 'Votre nom', 'Administrateur')}${hasPin ? '' : F.text('f_pin', 'Code PIN (4 chiffres)', '', 'type="tel" inputmode="numeric" maxlength="4" autocomplete="off"')}<p id="f_msg" class="warn"></p>`, () => {
      const name = App.v('f_name') || 'Administrateur', pin = App.v('f_pin');
      if (!hasPin && !pinOk(pin)) { $('f_msg').textContent = 'Le code doit avoir 4 chiffres'; return false; }
      (async () => {
        const u = { id: App.uid(), name, role: 'admin', active: true, pin: hasPin ? { ...S().pin } : await mkPin(pin) };
        S().users = [u]; App.user = u; App.save(); App.close(); App.applyRole(); App.toast('Profils activés : ajoutez maintenant vos collaborateurs'); App.refresh();
        if (!hasPin) { App.toast("Conservez bien votre code PIN d'administrateur"); }
      })(); return false;
    }, 'Activer');
  };
  App.actions.users_new = d => userForm(null, d && d.role);
  App.actions.users_edit = d => userForm(App.users().find(u => u.id === d.id));
  const userForm = (u, role) => {
    const isNew = !u; u = u || { name: '', role: ROLES[role] ? role : 'vendeur', active: true };
    App.modal(isNew ? 'Nouveau profil' : 'Modifier le profil', `${F.text('f_name', 'Nom', u.name)}${F.sel('f_role', 'Profil', roleOpts, u.role)}${F.sel('f_tech', 'Fiche technicien liée (profil Technicien)', [['', '— Aucune —'], ...App.db.technicians.map(t => [t.id, t.name])], u.techId || '')}${F.text('f_pin', isNew ? 'Code PIN (4 chiffres)' : 'Nouveau code PIN (laisser vide = inchangé)', '', 'type="tel" inputmode="numeric" maxlength="4" autocomplete="off"')}
      ${isNew ? '' : F.sel('f_act', 'Statut', [['1', 'Actif'], ['0', 'Désactivé']], u.active === false ? '0' : '1')}<p id="f_msg" class="warn"></p>${isNew ? '' : `<div class="bar"><button type="button" class="btn sm del" data-act="users_del" data-id="${u.id}">Supprimer ce profil</button></div>`}`, () => {
      const name = App.v('f_name'), pin = App.v('f_pin'), rl = App.v('f_role'), active = isNew || App.v('f_act') !== '0';
      const bad = m => { $('f_msg').textContent = m; return false; };
      if (!name) return bad('Nom requis'); if (isNew && !pinOk(pin)) return bad('Le code doit avoir 4 chiffres'); if (pin && !pinOk(pin)) return bad('Le code doit avoir 4 chiffres');
      const admins = App.users().filter(x => x.role === 'admin' && x.active !== false && x !== u).length;
      if (!isNew && u.role === 'admin' && (rl !== 'admin' || !active) && !admins) return bad('Il faut garder au moins un administrateur actif');
      (async () => {
        if (pin && await clash(pin, u.id)) { $('f_msg').textContent = 'Ce code est déjà utilisé par un autre profil'; return; }
        Object.assign(u, { name, role: rl, active, techId: App.v('f_tech') }); if (pin) u.pin = { ...(await mkPin(pin)), ...(u.pin && u.pin.rec ? { rec: u.pin.rec } : {}) };
        if (isNew) { u.id = App.uid(); S().users = [...App.users(), u]; }
        else S().users = App.users().map(x => x.id === u.id ? u : x);
        App.save(); App.close(); App.toast('Profil enregistré'); App.refresh();
      })(); return false;
    });
  };
  App.actions.users_del = d => {
    const u = App.users().find(x => x.id === d.id); if (!u) return;
    if (u.role === 'admin' && App.users().filter(x => x.role === 'admin' && x.active !== false && x !== u).length === 0) return App.toast('Il faut garder au moins un administrateur actif');
    if (!App.confirm(`Supprimer le profil de ${u.name} ?`)) return;
    S().users = App.users().filter(x => x !== u); App.close(); App.save(); App.refresh();
  };
  App.actions.users_off = () => {
    if (!App.confirm('Désactiver les profils ? Tous les profils sont supprimés et l\'application redevient ouverte à toute personne qui la déverrouille.')) return;
    const me = App.user; S().pin = me && me.pin ? { ...me.pin } : S().pin; S().users = []; App.user = null; App.save(); App.applyRole(); App.refresh();
  };
  App.usersRow = () => App.multi()
    ? `<div class="item"><div class="grow"><b>Utilisateurs et profils</b><small>${App.users().length} profil(s) · connecté : ${esc((App.user || {}).name || '')}</small></div><button class="btn sm" data-act="go" data-v="users">Gérer</button></div>`
    : `<div class="item"><div class="grow"><b>Utilisateurs et profils</b><small style="white-space:normal">Administrateur, comptable, vendeur, technicien, livreur : chacun son code PIN et ses écrans.</small></div><button class="btn sm" data-act="go" data-v="users">Activer…</button></div>`;
})();
