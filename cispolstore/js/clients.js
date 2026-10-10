// Clients: list, creation by type, client file (fiche), subscription renewal.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const tel = p => p ? `<a href="tel:${esc(String(p).replace(/[^+\d]/g, ''))}">${esc(p)}</a>` : '<span class="mut">—</span>';
  App.tel = tel;
  const tone = c => { const s = App.sub(c); return c.type === 'gere' ? (s ? { actif: 'ok', sursis: 'warn', inactif: 'bad' }[s.status] : 'mut') : c.type === 'mat' ? '' : 'mut'; };
  const badge = c => { const s = App.sub(c); return c.type === 'gere' ? (s ? App.pill(s.status) : '<span class="pill">Sans abonnement</span>') : `<span class="pill blue">${c.type === 'mat' ? 'Matériel' : 'Installation'}</span>`; };

  // WhatsApp link with a ready-made reminder (opened manually by the user)
  App.waUrl = (phone, msg) => {
    let d = String(phone || '').replace(/[^\d]/g, ''); if (!d) return '';
    if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '243' + d.slice(1);
    return `https://wa.me/${d}?text=${encodeURIComponent(msg)}`;
  };
  App.waLink = c => App.waUrl(c.phone, App.reminderText(c));

  // ---------- List ----------
  const st = App.clState = { f: 'all', q: '', sel: false, picked: new Set() };
  const FILTERS = [['all', 'Tous'], ['gere', '📡 Gérés'], ['mat', '📦 Matériel'], ['install', '🔧 Installation'], ['actif', '🟢 Actifs'], ['sursis', '🟠 Sursis'], ['inactif', '🔴 Inactifs']];
  const filtered = () => {
    const q = st.q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    return App.db.clients.filter(c => {
      if (['gere', 'mat', 'install'].includes(st.f) && c.type !== st.f) return false;
      if (['actif', 'sursis', 'inactif'].includes(st.f)) { const s = App.sub(c); if (!s || s.status !== st.f) return false; }
      if (!q) return true;
      return [App.cname(c), c.code, c.acc, c.phone, c.phone2, c.address, c.city, c.quarter, c.installAddr, c.serial, c.kit, c.article].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q);
    }).sort((a, b) => App.cname(a).localeCompare(App.cname(b)));
  };
  const drawList = () => {
    const l = filtered();
    if ($('clbar')) $('clbar').innerHTML = !App.guard('delclients') ? '' : st.sel ? `<button class="btn sm sec" data-act="cl_all">☑ Tout (${l.length})</button><button class="btn sm del" data-act="delclients">🗑 Supprimer (${st.picked.size})</button><button class="btn sm sec" data-act="cl_sel">Terminer</button>` : '<button class="btn sm sec" data-act="cl_sel">☑ Sélectionner pour supprimer</button>';
    const dayTxt = (c, s) => !s ? '' : s.status === 'actif' ? (s.left === 0 ? "aujourd'hui" : `dans ${s.left} j`) : s.status === 'sursis' ? `sursis · ${s.left} j` : `depuis ${-s.left} j`;
    const row = c => { const s = App.sub(c), t = tone(c);
      const body = `<span class="avatar ${t}">${esc(App.initials(c))}</span><div class="grow"><b>${esc(App.cname(c))}</b><small><span class="mono">${esc(c.acc || c.article || c.code)}</span>${c.phone ? ' · ' + esc(c.phone) : ''}</small></div><div class="end">${badge(c)}${s ? `<small class="${t}">${dayTxt(c, s)}</small>` : ''}</div>`;
      if (st.sel) return `<button class="item rw t-${t}" data-act="cl_pick" data-v="client" data-id="${c.id}"><span style="font-size:20px">${st.picked.has(c.id) ? '☑️' : '⬜'}</span>${body}</button>`;
      const acts = [], tel = String(c.phone || '').replace(/[^+\d]/g, '');
      if (tel) acts.push(`<a class="sw sw-call" href="tel:${esc(tel)}"><span>📞</span>Appeler</a>`);
      if (c.phone) acts.push(`<a class="sw sw-wa" href="${esc(c.type === 'gere' ? App.waLink(c) : App.waUrl(c.phone, 'Bonjour'))}" target="_blank" rel="noopener"><span>💬</span>WhatsApp</a>`);
      if (c.acc) acts.push(`<button class="sw sw-copy" data-act="copy" data-t="${esc(c.acc)}"><span>📋</span>Copier ACC</button>`);
      if (c.type === 'gere' && App.guard('renew')) acts.push(`<button class="sw sw-renew" data-act="renew" data-id="${c.id}"><span>🔄</span>Renouveler</button>`);
      const open = `<div class="item rw t-${t}" role="button" tabindex="0" data-act="go" data-v="client" data-id="${c.id}">${body}</div>`;
      return acts.length ? App.rowSwipe(acts.length, acts.join(''), open) : open; };
    let last = '';
    $('clist').innerHTML = l.length ? `<div class="list">${l.map(c => { const L = App.letterOf(App.cname(c)), h = L !== last ? `<div class="lh">${L}</div>` : ''; last = L; return h + row(c); }).join('')}</div>` : `<div class="empty big"><div class="ei">👥</div><b>${App.db.clients.length ? 'Aucun client pour ce filtre' : 'Aucun client pour le moment'}</b><p>${App.db.clients.length ? 'Essayez un autre filtre ou une autre recherche.' : 'Ajoutez votre premier client, ou importez votre fichier Excel.'}</p>${App.db.clients.length ? '' : '<button class="btn" data-act="newclient">+ Nouveau client</button>'}</div>`;
  };
  App.views.clients = () => {
    const all = App.db.clients, cnt = f => f === 'all' ? all.length : ['gere', 'mat', 'install'].includes(f) ? all.filter(c => c.type === f).length : all.filter(c => (App.sub(c) || {}).status === f).length;
    return {
      title: 'Clients', sub: `${all.length} au total`, nav: 'clients',
      html: `<div class="search"><input id="cq" placeholder="Rechercher un client, ACC, téléphone…" value="${esc(st.q)}" autocomplete="off"></div>
        <div class="chips">${FILTERS.map(([k, t]) => `<button class="chip ${st.f === k ? 'on' : ''}" data-act="clfilter" data-f="${k}">${t} (${cnt(k)})</button>`).join('')}</div>
        <div class="bar" id="clbar" style="margin-bottom:6px"></div><div id="clist"></div><button class="btn full" data-act="newclient" style="margin-top:14px">+ Nouveau client</button>${App.canView('importc') ? '<button class="btn sec full" data-act="go" data-v="importc" style="margin-top:8px">📥 Importer des clients (Excel)</button>' : ''}`,
      after: () => { drawList(); $('cq').oninput = e => { st.q = e.target.value; drawList(); }; }
    };
  };
  App.actions.cl_sel = () => { st.sel = !st.sel; st.picked = new Set(); drawList(); };
  App.actions.cl_pick = d => { st.picked.has(d.id) ? st.picked.delete(d.id) : st.picked.add(d.id); drawList(); };
  App.actions.cl_all = () => { const all = filtered(), full = all.every(c => st.picked.has(c.id)); all.forEach(c => full ? st.picked.delete(c.id) : st.picked.add(c.id)); drawList(); };
  // several clients at once (those with invoices or payments are kept); the "Annuler" bar puts them all back
  App.actions.delclients = () => {
    const db = App.db, ids = [...st.picked]; if (!ids.length) return App.toast('Sélectionnez au moins un client');
    const used = id => db.invoices.some(i => i.clientId === id) || db.payments.some(p => p.clientId === id), del = ids.filter(id => !used(id)), keep = ids.length - del.length;
    if (!del.length) return App.toast('Ces clients ont des factures ou paiements : suppression impossible');
    if (!App.confirm(`Supprimer définitivement ${del.length} client(s) ?${keep ? `\n${keep} client(s) avec factures ou paiements seront conservés.` : ''}`)) return;
    const snap = JSON.parse(JSON.stringify({ clients: db.clients, installs: db.installs, penalties: db.penalties, deliveries: db.deliveries, log: db.log }));
    db.clients = db.clients.filter(c => !del.includes(c.id)); ['installs', 'penalties', 'deliveries', 'log'].forEach(k => { db[k] = db[k].filter(x => !del.includes(x.clientId)); });
    st.picked = new Set(); st.sel = false; App.save(); App.refresh();
    App.undoBar(`${del.length} client(s) supprimé(s)`, () => { Object.assign(db, snap); App.save(); App.refresh(); App.toast('Suppression annulée'); }, 'Annuler');
  };
  App.actions.clfilter = d => { st.f = d.f; st.picked = new Set(); App.refresh(); };
  App.actions.newclient = () => App.clientForm();

  // ---------- Create / edit ----------
  const typeChooser = () => App.modal('Nouveau client',
    `<p class="mut">Choisissez le type de client : les champs adaptés s'afficheront ensuite. Le type ne pourra plus être modifié.</p>
     <button class="opt" data-act="cf_type" data-t="gere"><span class="ico">📡</span><span><b>Client géré par CISPOLstore</b><small>Vente matériel + gestion abonnement (ACC, dates, sursis…)</small></span></button>
     <button class="opt" data-act="cf_type" data-t="mat"><span class="ico">📦</span><span><b>Matériel uniquement</b><small>Achat de matériel sans gestion d'abonnement</small></span></button>
     <button class="opt" data-act="cf_type" data-t="install"><span class="ico">🔧</span><span><b>Installation uniquement</b><small>Le client possède déjà son matériel</small></span></button>`);
  App.actions.cf_type = d => App.clientForm(null, d.t);
  App.clientForm = (c, type) => {
    if (!c && !type) return typeChooser();
    const S = App.db.settings, isNew = !c;
    c = c || { type, first: '', last: '', phone: '', phone2: '', address: '', city: '', quarter: '', installAddr: '', acc: '', serial: '', kit: '', plan: '', price: '', payMode: 'Cash', start: App.today(), period: S.period, grace: S.grace, note: '', article: '', subs: [] };
    const g = c.type === 'gere';
    App.modal((isNew ? 'Nouveau client · ' : 'Modifier · ') + App.TYPES[c.type],
      `<div class="row">${F.text('f_first', 'Prénom', c.first)}${F.text('f_last', 'Nom', c.last)}</div>
       <div class="row">${F.text('f_phone', 'Téléphone', c.phone, 'type="tel" inputmode="tel"')}${F.text('f_phone2', 'Deuxième téléphone', c.phone2, 'type="tel" inputmode="tel"')}</div>
       ${F.text('f_address', 'Adresse', c.address)}
       <div class="row">${F.text('f_city', 'Ville', c.city)}${F.text('f_quarter', 'Quartier', c.quarter)}</div>
       ${c.type !== 'mat' ? F.text('f_inst', "Référence / adresse d'installation", c.installAddr) : ''}
       ${c.type === 'mat' ? F.text('f_article', 'Matériel acheté (note)', c.article, 'list="dl_k"') + F.list('dl_k', App.KITS) : ''}
       ${g ? `<h2 class="sec">Compte Starlink</h2>${F.text('f_acc', 'ACC', c.acc, 'autocapitalize="characters"')}
         <div class="row">${F.text('f_serial', 'Numéro de série', c.serial)}${F.text('f_kit', 'Modèle du kit', c.kit, 'list="dl_k"')}</div>${F.list('dl_k', App.KITS)}
         <h2 class="sec">Abonnement</h2>
         <div class="row">${F.text('f_plan', "Type d'abonnement", c.plan, 'list="dl_p"')}${F.num('f_price', "Prix de l'abonnement ($)", c.price)}</div>${F.list('dl_p', App.PLANS)}
         ${F.sel('f_pay', 'Mode de paiement', App.PAY_MODES, c.payMode)}
         <div class="row">${F.date('f_start', 'Date de début', c.start)}${F.num('f_period', 'Durée (jours)', c.period, 'min="1"')}${F.num('f_grace', 'Sursis (jours)', c.grace)}</div>
         <div class="card" id="prev" style="margin-top:10px"></div>` : ''}
       ${c.type === 'mat' ? F.text('f_serial', 'Numéro de série (matériel)', c.serial) : ''}
       ${F.area('f_note', 'Note', c.note)}`,
      () => {
        if (!App.v('f_first') && !App.v('f_last')) { App.toast('Saisissez au moins un nom'); return false; }
        const o = { first: App.v('f_first'), last: App.v('f_last'), phone: App.v('f_phone'), phone2: App.v('f_phone2'), address: App.v('f_address'), city: App.v('f_city'), quarter: App.v('f_quarter'), note: App.v('f_note') };
        o.name = (o.first + ' ' + o.last).trim();
        if (c.type !== 'mat') o.installAddr = App.v('f_inst');
        if (c.type === 'mat') { o.article = App.v('f_article'); o.serial = App.v('f_serial'); }
        if (g) Object.assign(o, { acc: App.v('f_acc'), serial: App.v('f_serial'), kit: App.v('f_kit'), plan: App.v('f_plan'), price: App.n('f_price'), payMode: App.v('f_pay'), start: App.v('f_start') || App.today(), period: Math.max(1, Math.round(App.n('f_period')) || S.period), grace: Math.max(0, Math.round(App.n('f_grace'))) });
        Object.assign(c, o);
        if (isNew) { c.id = App.uid(); c.code = App.nextClientCode(); c.created = App.today(); c.subs = []; App.db.clients.push(c); App.log(c.id, 'Client créé (' + App.TYPES[c.type] + ')'); App.save(); App.toast('Client enregistré'); App.go('client', { id: c.id }); return; }
        App.log(c.id, 'Fiche modifiée'); App.save(); App.toast('Modifications enregistrées'); App.refresh();
      });
    if (g) {
      const prev = () => {
        const days = Math.max(1, Math.round(App.n('f_period')) || 30), gr = Math.max(0, Math.round(App.n('f_grace'))), s = App.v('f_start') || App.today(), end = App.addDays(s, days);
        $('prev').innerHTML = `<div class="spread"><span class="mut">Fin automatique</span><b>${App.fdate(end)}</b></div><div class="spread"><span class="mut">Sursis</span><b>${gr ? App.fdate(App.addDays(end, 1)) + ' → ' + App.fdate(App.addDays(end, gr)) : 'aucun'}</b></div>`;
      };
      ['f_start', 'f_period', 'f_grace'].forEach(i => $(i).oninput = prev); prev();
    }
  };

  // ---------- Client file ----------
  const TABS = { gere: ['infos', 'abo', 'pay', 'fac', 'inst', 'mat', 'hist'], mat: ['infos', 'pay', 'fac', 'mat', 'hist'], install: ['infos', 'pay', 'fac', 'inst', 'hist'] };
  const TAB_NAMES = { infos: 'Infos', abo: 'Abonnement', pay: 'Paiements', fac: 'Factures', inst: 'Installations', mat: 'Matériel', hist: 'Historique' };
  const copyBtn = t => `<button class="btn sm sec" data-act="copy" data-t="${esc(t)}">Copier</button>`;
  App.actions.copy = d => { const done = () => App.toast('Copié'); try { navigator.clipboard.writeText(d.t).then(done, () => window.prompt('Copiez :', d.t)); } catch (e) { window.prompt('Copiez :', d.t); } };
  App.actions.cltab = d => App.go('client', { id: d.id, tab: d.tab }, true);

  const aboTab = c => {
    const s = App.sub(c);
    if (!s) return `<div class="card"><p class="mut">Aucun abonnement enregistré.</p><button class="btn" data-act="renew" data-id="${c.id}">Démarrer un abonnement</button></div>`;
    const msg = s.status === 'actif' ? (s.left === 0 ? "L'abonnement se termine aujourd'hui" : `Expire dans ${s.left} jour(s)`) : s.status === 'sursis' ? `En sursis : inactif dans ${s.left} jour(s)` : `Inactif depuis ${-s.left} jour(s)`;
    const last = App.db.invoices.filter(i => i.clientId === c.id && i.type === 'abonnement').slice(-1)[0];
    const hist = [...(c.subs || [])].reverse();
    return `<div class="card"><div class="spread"><b>Compte Starlink</b>${c.acc ? copyBtn(c.acc) : ''}</div><div class="blue" style="margin-top:4px;word-break:break-all">${esc(c.acc || '—')}</div></div>
      <div class="card"><div class="spread"><b>Abonnement actuel</b>${App.pill(s.status)}</div>
        <dl class="kv" style="margin-top:10px"><dt>Type</dt><dd>${esc(c.plan || '—')}</dd><dt>Date de début</dt><dd>${App.fdate(s.start)}</dd><dt>Date de fin</dt><dd>${App.fdate(s.end)}</dd><dt>Sursis</dt><dd>${s.grace ? App.fdate(s.gStart) + ' → ' + App.fdate(s.gEnd) : 'aucun'}</dd><dt>Tarif</dt><dd>${App.fmt(c.price || 0)}</dd>${(m => m && App.can('costs') ? `<dt>Coût Starlink</dt><dd>${App.fmt(m.cost)}</dd><dt>Marge</dt><dd class="${m.margin > 0 ? 'ok' : 'bad'}">${App.fmt(m.margin)}</dd>` : '')(App.subMargin(c))}<dt>Statut</dt><dd class="${{ actif: 'ok', sursis: 'warn', inactif: 'bad' }[s.status]}">${msg}</dd></dl>
        <div class="bar" style="margin-top:12px"><button class="btn" data-act="renew" data-id="${c.id}">Renouveler</button>${last ? `<button class="btn sec" data-act="go" data-v="invoice" data-id="${last.id}">Voir la facture</button>` : ''}</div></div>
      ${hist.length ? `<h2 class="sec">Périodes précédentes</h2><div class="list">${hist.map(h => `<div class="item"><div class="grow"><b>${App.fdate(h.start)} → ${App.fdate(App.addDays(h.start, h.days))}</b><small>${h.days} jours</small></div></div>`).join('')}</div>` : ''}`;
  };
  const listOrEmpty = (rows, empty) => rows.length ? `<div class="list">${rows.join('')}</div>` : `<div class="empty">${empty}</div>`;
  App.views.client = p => {
    const c = App.client(p.id); if (!c) return { title: 'Client', back: 'clients', html: '<div class="empty">Client introuvable.</div>' };
    const tabs = TABS[c.type], tab = tabs.includes(p.tab) ? p.tab : 'infos', db = App.db;
    let body = '';
    if (tab === 'infos') body = `<div class="card"><dl class="kv"><dt>Code client</dt><dd>${esc(c.code)}</dd><dt>Type</dt><dd>${App.TYPES[c.type]}</dd><dt>Téléphone</dt><dd>${tel(c.phone)}</dd>${c.phone2 ? `<dt>2e téléphone</dt><dd>${tel(c.phone2)}</dd>` : ''}<dt>Adresse</dt><dd>${esc(c.address || '—')}</dd><dt>Ville / quartier</dt><dd>${esc([c.city, c.quarter].filter(Boolean).join(' / ') || '—')}</dd>${c.type !== 'mat' ? `<dt>Référence</dt><dd>${esc(c.installAddr || '—')}</dd>` : ''}${c.type === 'gere' ? `<dt>ACC</dt><dd>${esc(c.acc || '—')} ${c.acc ? copyBtn(c.acc) : ''}</dd><dt>N° de série</dt><dd>${esc(c.serial || '—')}</dd><dt>Kit</dt><dd>${esc(c.kit || '—')}</dd>` : ''}${c.type === 'mat' ? `<dt>Matériel</dt><dd>${esc(c.article || '—')}</dd><dt>N° de série</dt><dd>${esc(c.serial || '—')}</dd>` : ''}<dt>Créé le</dt><dd>${App.fdate(c.created)}</dd>${c.note ? `<dt>Note</dt><dd>${esc(c.note)}</dd>` : ''}</dl>
      <div class="bar" style="margin-top:12px"><button class="btn sec" data-act="editclient" data-id="${c.id}">Modifier</button><button class="btn del" data-act="delclient" data-id="${c.id}">Supprimer</button></div></div>`;
    if (tab === 'abo') body = aboTab(c) + App.penaltyBlock(c);
    if (tab === 'pay') body = `<div class="bar"><button class="btn sm" data-act="newpay" data-cid="${c.id}">+ Paiement</button></div>` + listOrEmpty(db.payments.filter(x => x.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date)).map(x => { const i = App.invoice(x.invoiceId); return `<div class="item"><div class="grow"><b>${App.fdate(x.date)} · ${esc(x.mode)}</b><small>${i ? esc(i.number) : 'Sans facture'}${x.ref ? ' · ' + esc(x.ref) : ''}</small></div><b class="ok">${App.fmt(x.amount, x.currency)}</b></div>`; }), 'Aucun paiement enregistré.');
    if (tab === 'fac') body = `<div class="bar"><button class="btn sm" data-act="newinv" data-cid="${c.id}">+ Nouvelle facture</button></div>` + listOrEmpty(db.invoices.filter(i => i.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)).map(i => { const [t, k] = App.INV[App.invStatus(i)]; return `<button class="item" data-act="go" data-v="invoice" data-id="${i.id}"><div class="grow"><b>${esc(i.number)}</b><small>${App.fdate(i.date)} · ${App.invTypes[i.type]}</small></div><div class="end"><b>${App.fmt(App.invTotal(i), i.currency)}</b><span class="pill ${k}">${t}</span></div></button>`; }), 'Aucune facture.');
    if (tab === 'inst') body = `<div class="bar"><button class="btn sm" data-act="newinst" data-cid="${c.id}">+ Installation</button></div>` + listOrEmpty(db.installs.filter(x => x.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date)).map(x => `<div class="item"><div class="grow"><b>${App.fdate(x.date)} · ${esc(x.kind)}</b><small>${esc(x.tech || 'Technicien non précisé')}${x.obs ? ' · ' + esc(x.obs) : ''}</small></div><b>${App.fmt(x.price || 0)}</b></div>`), "Aucune intervention enregistrée.");
    if (tab === 'mat') {
      const rows = []; db.invoices.filter(i => i.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date)).forEach(i => i.lines.forEach(l => { if (l.pid && App.tracked(App.prod(l.pid))) rows.push(`<div class="item"><div class="grow"><b>${esc(l.desc)}</b><small>${App.fdate(i.date)} · ${esc(i.number)}</small></div><div class="end"><b>${l.qty} ${esc(l.unit || '')}</b><span class="mut">${App.fmt(l.qty * l.price, i.currency)}</span></div></div>`); }));
      body = (c.serial ? `<div class="card"><span class="mut">Numéro de série</span><br><b>${esc(c.serial)}</b></div><div style="height:10px"></div>` : '') + listOrEmpty(rows, 'Aucun matériel vendu à ce client.');
    }
    if (tab === 'hist') body = listOrEmpty(db.log.filter(x => x.clientId === c.id).slice().reverse().map(x => `<div class="item"><div class="grow"><b>${esc(x.text)}</b><small>${App.fdate(x.date)}</small></div></div>`), 'Aucune opération.');
    const wa = App.waLink(c);
    return {
      title: App.cname(c), sub: 'Fiche client', back: 'clients', nav: 'clients',
      html: `<div class="card"><div class="row" style="flex-wrap:nowrap;align-items:center"><span class="avatar big ${tone(c)}" style="flex:none;min-width:60px">${esc(App.initials(c))}</span><div style="flex:1;min-width:0"><h2 style="font-size:19px">${esc(App.cname(c))}</h2><div style="margin:4px 0">${badge(c)} <span class="pill">${esc(c.code)}</span></div><div class="mut">${tel(c.phone)}</div></div></div>
        <div class="bar" style="margin-top:12px">${c.phone ? `<a class="btn sm sec" href="tel:${esc(c.phone.replace(/[^+\d]/g, ''))}" style="text-decoration:none">📞 Appeler</a>` : ''}${wa ? `<a class="btn sm sec" href="${wa}" target="_blank" rel="noopener" style="text-decoration:none">💬 WhatsApp</a>` : ''}<button class="btn sm" data-act="newinv" data-cid="${c.id}">🧾 Facture</button></div></div>
        <div class="tabs">${tabs.map(t => `<button class="${t === tab ? 'on' : ''}" data-act="cltab" data-id="${c.id}" data-tab="${t}">${TAB_NAMES[t]}</button>`).join('')}</div>${body}`
    };
  };
  App.actions.editclient = d => App.clientForm(App.client(d.id));
  App.actions.delclient = d => {
    const c = App.client(d.id), db = App.db;
    if (db.invoices.some(i => i.clientId === c.id) || db.payments.some(p => p.clientId === c.id)) return App.toast('Ce client a des factures ou paiements : suppression impossible');
    if (!App.confirm(`Supprimer définitivement ${App.cname(c)} ?`)) return;
    db.clients = db.clients.filter(x => x !== c); db.installs = db.installs.filter(x => x.clientId !== c.id); db.penalties = db.penalties.filter(x => x.clientId !== c.id); db.deliveries = db.deliveries.filter(x => x.clientId !== c.id); db.log = db.log.filter(x => x.clientId !== c.id);
    App.save(); App.toast('Client supprimé'); App.go('clients', {}, true);
  };

  // ---------- Renewal ----------
  App.renewPicker = () => {
    const g = App.db.clients.filter(c => c.type === 'gere').sort((a, b) => (App.sub(a) || { left: 1e9 }).left - (App.sub(b) || { left: 1e9 }).left);
    if (!g.length) return App.toast('Aucun client géré');
    App.modal('Renouveler un abonnement', F.sel('f_rc', 'Client', g.map(c => [c.id, `${App.cname(c)} — ${(App.sub(c) ? App.STATUS[App.sub(c).status][0] : 'sans abonnement')}`])), () => { const id = App.v('f_rc'); setTimeout(() => App.renewForm(id), 30); }, 'Continuer');
  };
  App.renewForm = id => {
    const c = App.client(id), s = App.sub(c), today = App.today();
    const start = s && s.status !== 'inactif' ? s.end : today;
    App.modal('Renouveler · ' + App.cname(c),
      `<p class="mut">${s ? `Période actuelle : ${App.fdate(s.start)} → ${App.fdate(s.end)} (${App.STATUS[s.status][0]})` : "Aucun abonnement en cours"}</p>
       <div class="row">${F.date('f_start', 'Début de la nouvelle période', start)}${F.num('f_period', 'Durée (jours)', c.period || App.db.settings.period, 'min="1"')}</div>
       <div class="row">${F.num('f_price', 'Prix ($)', c.price || '')}${F.sel('f_pay', 'Mode de paiement', App.PAY_MODES, c.payMode || 'Cash')}</div>
       <label class="l"><input type="checkbox" id="f_mk" checked style="width:auto"> Créer la facture et enregistrer le paiement</label>
       ${F.num('f_paid', 'Montant reçu ($)', c.price || 0)}
       <div class="card" id="prev" style="margin-top:10px"></div>`,
      () => {
        const days = Math.max(1, Math.round(App.n('f_period')) || 30), price = App.n('f_price'), ns = App.v('f_start') || today, mode = App.v('f_pay');
        const prevSub = { start: c.start || '', period: c.period, price: c.price };
        if (c.start) (c.subs = c.subs || []).push({ start: c.start, days: c.period || days, price: c.price || 0, date: today });
        Object.assign(c, { start: ns, period: days, price, payMode: mode });
        const end = App.addDays(ns, days);
        if ($('f_mk').checked && price > 0) { const ri = App.createInvoice({ type: 'abonnement', clientId: c.id, currency: 'USD', payMode: mode, date: today, lines: [{ pid: '', desc: `Abonnement ${c.plan || 'Starlink'} (${App.fdate(ns)} → ${App.fdate(end)})`, qty: 1, price, cost: 0, unit: '' }] }, Math.min(App.n('f_paid'), price), true); ri.renew = { prev: prevSub, ns, date: today }; }
        App.log(c.id, `Abonnement renouvelé : ${App.fdate(ns)} → ${App.fdate(end)}`);
        App.save(); App.toast('Abonnement renouvelé'); App.refresh();
      }, 'Renouveler');
    const prev = () => { const d = Math.max(1, Math.round(App.n('f_period')) || 30), e = App.addDays(App.v('f_start') || today, d), g = c.grace ?? App.db.settings.grace; $('prev').innerHTML = `<div class="spread"><span class="mut">Nouvelle fin</span><b>${App.fdate(e)}</b></div><div class="spread"><span class="mut">Sursis</span><b>${g ? App.fdate(App.addDays(e, 1)) + ' → ' + App.fdate(App.addDays(e, g)) : 'aucun'}</b></div>`; };
    ['f_start', 'f_period'].forEach(i => $(i).oninput = prev); $('f_price').oninput = () => { $('f_paid').value = $('f_price').value; }; prev();
  };
  App.actions.renew = d => App.renewForm(d.id);
})();
