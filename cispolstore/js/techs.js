// Technicians and partners (installers, resellers, collaborators we work with on Starlink).
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const ROLES = ['Technicien', 'Installateur Starlink', 'Électricien / câblage', 'Revendeur', 'Partenaire', 'Autre'];
  const norm = s => String(s || '').trim().toLowerCase();
  App.tech = id => App.db.technicians.find(t => t.id === id);
  App.techNames = () => App.db.technicians.filter(t => t.active !== false).map(t => t.name);
  App.techId = name => { const n = norm(name); const t = n && App.db.technicians.find(x => norm(x.name) === n); return t ? t.id : ''; };
  const jobs = t => App.db.installs.filter(x => (x.techId && x.techId === t.id) || (!x.techId && norm(x.tech) === norm(t.name))).sort((a, b) => b.date.localeCompare(a.date));
  const CTYPES = [['none', 'Aucune'], ['pct', 'Pourcentage du prix de l\'installation'], ['fixed', 'Montant fixe par intervention ($)']];
  // commission of one job: frozen once paid, otherwise computed from the technician's current setting
  const comm = (t, x) => x.techPaid ? (x.techComm || 0) : t.ctype === 'pct' ? Math.round((x.price || 0) * (t.cval || 0)) / 100 : t.ctype === 'fixed' ? (t.cval || 0) : 0;
  const ctext = t => t.ctype === 'pct' ? `${t.cval || 0} % du prix de l'installation` : t.ctype === 'fixed' ? `${App.fmt(t.cval || 0)} par intervention` : 'Aucune';
  const wa = p => { let d = String(p || '').replace(/[^\d]/g, ''); if (!d) return ''; if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '243' + d.slice(1); return 'https://wa.me/' + d; };

  App.views.technicians = () => {
    const l = App.db.technicians.slice().sort((a, b) => (b.active !== false) - (a.active !== false) || a.name.localeCompare(b.name));
    return {
      title: 'Techniciens', back: 'more', nav: 'more',
      html: `<div class="bar"><button class="btn" data-act="newtech">+ Technicien / collaborateur</button></div>` + (l.length ? `<div class="list">${l.map(t => `<button class="item" data-act="go" data-v="technician" data-id="${t.id}" style="${t.active === false ? 'opacity:.6' : ''}"><span class="avatar">🧰</span><div class="grow"><b>${esc(t.name)}</b><small>${esc(t.role || '')}${t.zone ? ' · ' + esc(t.zone) : ''}${t.phone ? ' · ' + esc(t.phone) : ''}</small></div><div class="end">${t.active === false ? '<span class="pill">Inactif</span>' : `<span class="mut">${jobs(t).length} interv.</span>`}</div></button>`).join('')}</div>` : '<div class="empty">Aucun technicien enregistré. Ajoutez ceux avec qui vous travaillez sur Starlink.</div>')
    };
  };
  App.actions.newtech = () => App.techForm();
  App.techForm = t => {
    const isNew = !t; t = t || { name: '', phone: '', role: 'Technicien', zone: '', spec: '', active: true, notes: '' };
    App.modal(isNew ? 'Nouveau technicien / collaborateur' : 'Modifier', `${F.text('f_name', 'Nom', t.name)}<div class="row">${F.text('f_phone', 'Téléphone', t.phone, 'type="tel" inputmode="tel"')}${F.sel('f_role', 'Rôle', ROLES, t.role)}</div>
      <div class="row">${F.sel('f_ct', 'Commission', CTYPES, t.ctype || 'none')}${F.num('f_cv', 'Valeur (% ou $)', t.cval || '')}</div><div class="row">${F.text('f_zone', 'Zone / quartier', t.zone)}${F.sel('f_act', 'Statut', [['1', 'Actif'], ['0', 'Inactif']], t.active === false ? '0' : '1')}</div>${F.text('f_spec', 'Spécialité', t.spec, 'placeholder="Ex. pose antenne, câblage, réglage routeur"')}${F.area('f_notes', 'Notes', t.notes)}`, () => {
      const name = App.v('f_name'); if (!name) { App.toast('Nom requis'); return false; }
      if (App.db.technicians.some(x => x !== t && norm(x.name) === norm(name))) { App.toast('Ce nom existe déjà'); return false; }
      if (App.v('f_ct') === 'pct' && App.n('f_cv') > 100) { App.toast('Un pourcentage ne dépasse pas 100'); return false; }
      const old = t.name;
      Object.assign(t, { name, phone: App.v('f_phone'), role: App.v('f_role'), zone: App.v('f_zone'), ctype: App.v('f_ct'), cval: App.v('f_ct') === 'none' ? 0 : App.n('f_cv'), spec: App.v('f_spec'), active: App.v('f_act') !== '0', notes: App.v('f_notes') });
      if (isNew) { t.id = App.uid(); App.db.technicians.push(t); }
      else if (old !== name) App.db.installs.forEach(x => { if (x.techId === t.id || norm(x.tech) === norm(old)) { x.tech = name; x.techId = t.id; } });
      App.save(); App.toast('Enregistré'); App.refresh();
    });
  };
  App.views.technician = p => {
    const t = App.tech(p.id); if (!t) return { title: 'Technicien', back: 'technicians', html: '<div class="empty">Introuvable.</div>' };
    const l = jobs(t), rev = l.reduce((a, x) => a + (x.price || 0), 0), w = wa(t.phone), due = l.filter(x => !x.techPaid).reduce((a, x) => a + comm(t, x), 0), paid = l.filter(x => x.techPaid).reduce((a, x) => a + comm(t, x), 0);
    return {
      title: t.name, sub: t.role || 'Technicien', back: 'technicians', nav: 'more',
      html: `<div class="card"><dl class="kv"><dt>Téléphone</dt><dd>${App.tel(t.phone)}</dd><dt>Rôle</dt><dd>${esc(t.role || '—')}</dd><dt>Zone</dt><dd>${esc(t.zone || '—')}</dd><dt>Spécialité</dt><dd>${esc(t.spec || '—')}</dd><dt>Commission</dt><dd>${esc(ctext(t))}</dd><dt>Statut</dt><dd>${t.active === false ? 'Inactif' : 'Actif'}</dd>${t.notes ? `<dt>Notes</dt><dd>${esc(t.notes)}</dd>` : ''}</dl>
        <div class="bar" style="margin-top:12px">${t.phone ? `<a class="btn sm sec" href="tel:${esc(t.phone.replace(/[^+\d]/g, ''))}" style="text-decoration:none">📞 Appeler</a>` : ''}${w ? `<a class="btn sm sec" href="${w}" target="_blank" rel="noopener" style="text-decoration:none">💬 WhatsApp</a>` : ''}<button class="btn sm sec" data-act="edittech" data-id="${t.id}">Modifier</button><button class="btn sm del" data-act="deltech" data-id="${t.id}">Supprimer</button></div></div>
        <div class="grid"><div class="stat"><small>Interventions</small><b>${l.length}</b></div><div class="stat"><small>Valeur des installations</small><b>${App.fmt(rev)}</b></div><div class="stat"><small>Commission à payer</small><b>${App.fmt(due)}</b></div><div class="stat"><small>Commission payée</small><b>${App.fmt(paid)}</b></div></div>
        ${due > 0 ? `<div class="bar"><button class="btn" data-act="paytech" data-id="${t.id}">💵 Payer la commission (${App.fmt(due)})</button></div>` : ''}
        <h2 class="sec">Interventions</h2>${l.length ? `<div class="list">${l.map(x => `<button class="item" data-act="go" data-v="client" data-id="${x.clientId}" data-p='${JSON.stringify({ id: x.clientId, tab: 'inst' })}'><span class="avatar">🔧</span><div class="grow"><b>${esc(App.cname(App.client(x.clientId)))}</b><small>${App.fdate(x.date)} · ${esc(x.kind)} · ${App.fmt(x.price || 0)}</small></div><div class="end"><b>${App.fmt(comm(t, x))}</b><span class="mut">${x.techPaid ? '✓ payée le ' + App.fdate(x.techPaid) : 'à payer'}</span></div></button>`).join('')}</div>` : '<div class="empty">Aucune intervention. Choisissez ce technicien dans « Nouvelle installation » ou dans une facture d\'installation.</div>'}`
    };
  };
  // pay all unpaid commissions: freezes each amount, and records one expense so the profit reports stay right
  App.actions.paytech = d => {
    const t = App.tech(d.id); if (!t) return;
    const todo = jobs(t).filter(x => !x.techPaid), sum = todo.reduce((a, x) => a + comm(t, x), 0);
    if (!(sum > 0) || !App.confirm(`Payer ${App.fmt(sum)} de commission à ${t.name} (${todo.length} intervention(s)) ? Une dépense sera enregistrée.`)) return;
    todo.forEach(x => { x.techComm = comm(t, x); x.techPaid = App.today(); });
    App.db.expenses.push({ id: App.uid(), label: 'Commission ' + t.name, cat: 'Commission technicien', amount: sum, currency: 'USD', date: App.today() });
    App.save(); App.toast('Commission payée et dépense enregistrée'); App.refresh();
  };
  App.actions.edittech = d => App.techForm(App.tech(d.id));
  App.actions.deltech = d => { const t = App.tech(d.id); if (!t || !App.confirm('Supprimer ce technicien ? Ses interventions restent enregistrées.')) return; App.db.technicians = App.db.technicians.filter(x => x !== t); App.db.installs.forEach(x => { if (x.techId === t.id) x.techId = ''; }); App.save(); App.go('technicians', {}, true); };
})();
