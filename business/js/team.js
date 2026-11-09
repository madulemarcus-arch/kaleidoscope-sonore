// Team screen: profiles (role + PIN), recovery code, audit journal. Also reachable from « Données et sécurité ».
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, R = App.roles, db = () => App.db;
  const T = App.team = {};
  const roleOpts = () => Object.entries(R.ROLES);
  const showCode = (code, then) => ui.sheet({ title: 'Code de récupération', html: '<p>Notez ce code en lieu sûr. Il permet de réinitialiser un PIN oublié et <b>ne sera plus jamais affiché</b>.</p><div class="card" style="font-size:1.4rem;text-align:center;letter-spacing:2px"><b>' + esc(code) + '</b></div>', onClose: then, actions: [{ label: 'Copier', cls: 'ghost', fn: () => { (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => App.toast('Copié'), () => App.toast('Copie impossible', 'err')); return false; } }, { label: 'J\'ai noté le code', cls: 'primary' }] });
  T.userForm = (id, done) => {
    const u = id ? db().users.find(x => x.id === id) : null, first = !db().users.length;
    ui.sheet({ title: u ? 'Modifier — ' + u.name : first ? 'Premier profil (administrateur)' : 'Nouveau profil', html: (first ? '<p class="muted">Dès qu\'un profil existe, l\'application demande un PIN au démarrage.</p>' : '') + ui.field('Nom *', ui.input('name', u && u.name)) + ui.field('Profil', ui.select('role', first ? [['admin', R.ROLES.admin]] : roleOpts(), u ? u.role : first ? 'admin' : 'seller'), 'Chaque profil voit seulement ses écrans et ses actions.') + '<label class="fld"><span>' + (u ? 'Nouveau PIN (laisser vide pour garder)' : 'PIN personnel (4 à 8 chiffres) *') + '</span><input name="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></label>',
      actions: [...(u ? [{ label: 'Supprimer', cls: 'danger', fn: async sh => { if (!(await ui.confirm('Supprimer le profil ' + u.name + ' ?', 'Supprimer', true))) return false; if (!R.removeUser(u.id)) { App.toast('Il faut garder au moins un administrateur', 'err'); return false; } sh.close(); App.render(); done && done(); return false; } }] : []), { label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: async sh => {
        const f = ui.read(sh.body); if (!f.name) { App.toast('Le nom est obligatoire', 'err'); return false; }
        try {
          if (u) { if (u.role === 'admin' && f.role !== 'admin' && db().users.filter(x => x.role === 'admin').length < 2) throw new Error('Il faut garder au moins un administrateur'); u.name = f.name; u.role = f.role; if (f.pin) await R.setPin(u.id, f.pin); App.log('user.edit', f.name); App.save(); App.toast('Profil enregistré'); App.render(); done && done(); }
          else { const r = await R.addUser(f.name, f.role, f.pin); App.toast('Profil créé'); App.render(); sh.close(); if (r.code) showCode(r.code, () => done && done()); else done && done(); return false; }
        } catch (e) { App.toast(e.message, 'err'); return false; }
      } }] });
  };
  T.list = () => db().users.length ? '<div class="list">' + db().users.map(u => '<div class="swr" style="--n:0"><div class="item" data-u="' + u.id + '" role="button" tabindex="0"><span class="av">' + esc(App.letterOf(u.name)) + '</span><span class="tx"><b>' + esc(u.name) + '</b><small>' + esc(R.ROLES[u.role]) + '</small></span></div></div>').join('') + '</div>' : '<p class="muted">Aucun profil : l\'application est ouverte à toute personne qui tient l\'appareil. Créez le premier administrateur pour la protéger par un PIN.</p>';
  T.audit = () => {
    const users = [...new Set(db().log.map(l => l.u).filter(Boolean))];
    const sh = ui.sheet({ title: 'Journal d\'audit', wide: true, html: '<div class="tools"><input type="search" id="aq" placeholder="Rechercher une action">' + (users.length ? '<select id="au"><option value="">Tous</option>' + users.map(u => '<option>' + esc(u) + '</option>').join('') + '</select>' : '') + '</div><div id="al"></div>' });
    const draw = () => { const q = sh.q('#aq').value.toLowerCase(), u = sh.q('#au') ? sh.q('#au').value : '', l = db().log.slice().reverse().filter(x => (!u || x.u === u) && (!q || (x.a + ' ' + x.d + ' ' + x.u).toLowerCase().includes(q))).slice(0, 200); sh.q('#al').innerHTML = l.length ? '<div class="list">' + l.map(x => '<div class="item"><span class="tx"><b>' + esc(x.a) + '</b><small>' + esc(x.d) + '</small></span><span class="end"><small>' + new Date(x.t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) + '</small><small>' + esc(x.u || '—') + '</small></span></div>').join('') + '</div>' : '<p class="muted">Aucune entrée.</p>'; };
    sh.q('#aq').oninput = draw; sh.q('#au') && (sh.q('#au').onchange = draw); draw();
  };
  T.bind = (el, redo) => { el.querySelectorAll('[data-u]').forEach(i => i.onclick = () => App.can('team') ? T.userForm(i.dataset.u, redo) : App.toast('Réservé à l\'administrateur', 'err')); };
  // security card used by « Données et sécurité »
  T.securityHtml = () => '<section class="card"><h3>Sécurité</h3>' + T.list() + '<div class="tools"><button class="btn primary" id="uadd">+ ' + (db().users.length ? 'Profil' : 'Créer l\'administrateur') + '</button>' + (db().users.length ? '<button class="btn ghost" id="ulock">🔒 Verrouiller</button><button class="btn ghost" id="urec">Nouveau code de récupération</button>' : '') + '<button class="btn ghost" id="uaud">Journal d\'audit</button></div>' + (db().users.length ? ui.field('Verrouillage automatique (cet appareil)', ui.select('lockMin', [['0', 'Jamais'], ['1', 'après 1 min'], ['5', 'après 5 min'], ['15', 'après 15 min'], ['30', 'après 30 min']], String(R.lockMin()))) : '') + '</section>';
  T.bindSecurity = (el, redo) => {
    T.bind(el, redo); const q = s => el.querySelector(s);
    q('#uadd').onclick = () => App.can('team') ? T.userForm(null, redo) : App.toast('Réservé à l\'administrateur', 'err');
    q('#uaud').onclick = () => App.can('team') ? T.audit() : App.toast('Réservé à l\'administrateur', 'err');
    q('#ulock') && (q('#ulock').onclick = () => R.lock()); q('#urec') && (q('#urec').onclick = async () => { if (App.can('team') && await ui.confirm('Générer un nouveau code ? L\'ancien ne fonctionnera plus.', 'Générer')) showCode(await R.newRecovery()); });
    q('[name=lockMin]') && (q('[name=lockMin]').onchange = e => { R.setLockMin(+e.target.value); App.toast('Enregistré'); });
  };
  App.views.team = { title: 'Équipe', render(el) { el.innerHTML = '<div class="page">' + T.securityHtml() + '</div>'; T.bindSecurity(el, () => App.views.team.render(el)); } };
  // admin-only actions
  const A = () => { const u = App.user; return !db().users.length || (u && u.role === 'admin'); };
  const base = App.can; App.can = p => (p === 'team' || p === 'settings') ? A() : base(p);
})();
