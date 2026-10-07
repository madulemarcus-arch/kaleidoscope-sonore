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
      <div class="row">${F.text('f_zone', 'Zone / quartier', t.zone)}${F.sel('f_act', 'Statut', [['1', 'Actif'], ['0', 'Inactif']], t.active === false ? '0' : '1')}</div>${F.text('f_spec', 'Spécialité', t.spec, 'placeholder="Ex. pose antenne, câblage, réglage routeur"')}${F.area('f_notes', 'Notes', t.notes)}`, () => {
      const name = App.v('f_name'); if (!name) { App.toast('Nom requis'); return false; }
      if (App.db.technicians.some(x => x !== t && norm(x.name) === norm(name))) { App.toast('Ce nom existe déjà'); return false; }
      const old = t.name;
      Object.assign(t, { name, phone: App.v('f_phone'), role: App.v('f_role'), zone: App.v('f_zone'), spec: App.v('f_spec'), active: App.v('f_act') !== '0', notes: App.v('f_notes') });
      if (isNew) { t.id = App.uid(); App.db.technicians.push(t); }
      else if (old !== name) App.db.installs.forEach(x => { if (x.techId === t.id || norm(x.tech) === norm(old)) { x.tech = name; x.techId = t.id; } });
      App.save(); App.toast('Enregistré'); App.refresh();
    });
  };
  App.views.technician = p => {
    const t = App.tech(p.id); if (!t) return { title: 'Technicien', back: 'technicians', html: '<div class="empty">Introuvable.</div>' };
    const l = jobs(t), rev = l.reduce((a, x) => a + (x.price || 0), 0), w = wa(t.phone);
    return {
      title: t.name, sub: t.role || 'Technicien', back: 'technicians', nav: 'more',
      html: `<div class="card"><dl class="kv"><dt>Téléphone</dt><dd>${App.tel(t.phone)}</dd><dt>Rôle</dt><dd>${esc(t.role || '—')}</dd><dt>Zone</dt><dd>${esc(t.zone || '—')}</dd><dt>Spécialité</dt><dd>${esc(t.spec || '—')}</dd><dt>Statut</dt><dd>${t.active === false ? 'Inactif' : 'Actif'}</dd>${t.notes ? `<dt>Notes</dt><dd>${esc(t.notes)}</dd>` : ''}</dl>
        <div class="bar" style="margin-top:12px">${t.phone ? `<a class="btn sm sec" href="tel:${esc(t.phone.replace(/[^+\d]/g, ''))}" style="text-decoration:none">📞 Appeler</a>` : ''}${w ? `<a class="btn sm sec" href="${w}" target="_blank" rel="noopener" style="text-decoration:none">💬 WhatsApp</a>` : ''}<button class="btn sm sec" data-act="edittech" data-id="${t.id}">Modifier</button><button class="btn sm del" data-act="deltech" data-id="${t.id}">Supprimer</button></div></div>
        <div class="grid"><div class="stat"><small>Interventions</small><b>${l.length}</b></div><div class="stat"><small>Valeur des installations</small><b>${App.fmt(rev)}</b></div><div class="stat"><small>Dernière</small><b style="font-size:15px">${l[0] ? App.fdate(l[0].date) : '—'}</b></div></div>
        <h2 class="sec">Interventions</h2>${l.length ? `<div class="list">${l.map(x => `<button class="item" data-act="go" data-v="client" data-id="${x.clientId}" data-p='${JSON.stringify({ id: x.clientId, tab: 'inst' })}'><span class="avatar">🔧</span><div class="grow"><b>${esc(App.cname(App.client(x.clientId)))}</b><small>${App.fdate(x.date)} · ${esc(x.kind)}</small></div><b>${App.fmt(x.price || 0)}</b></button>`).join('')}</div>` : '<div class="empty">Aucune intervention. Choisissez ce technicien dans « Nouvelle installation » ou dans une facture d\'installation.</div>'}`
    };
  };
  App.actions.edittech = d => App.techForm(App.tech(d.id));
  App.actions.deltech = d => { const t = App.tech(d.id); if (!t || !App.confirm('Supprimer ce technicien ? Ses interventions restent enregistrées.')) return; App.db.technicians = App.db.technicians.filter(x => x !== t); App.db.installs.forEach(x => { if (x.techId === t.id) x.techId = ''; }); App.save(); App.go('technicians', {}, true); };
})();
