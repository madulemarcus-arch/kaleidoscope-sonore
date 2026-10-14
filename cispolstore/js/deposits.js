// Client deposits ("fonds en attente"): money a client has already paid to us that we keep until we pay for them (Starlink, an order…).
// A deposit is not revenue. It enters the cash journal when received and leaves it when we pay for the client or give it back.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const PURPOSES = ['Abonnement Starlink', 'Kit / matériel', 'Installation', 'Commande en cours', 'Autre'];
  const PICO = { 'Abonnement Starlink': '📡', 'Kit / matériel': '📦', 'Installation': '🔧', 'Commande en cours': '🛒', 'Autre': '💼' };
  const st = { f: 'wait' };
  const list = () => (App.db.deposits = App.db.deposits || []);
  const out = d => (d.uses || []).reduce((a, u) => a + (+u.amount || 0), 0);
  App.depBalance = d => Math.max(0, Math.round(((+d.amount || 0) - out(d)) * 100) / 100);
  App.depStatus = d => App.depBalance(d) <= 0.004 ? ((d.uses || []).some(u => u.type === 'refund') && !(d.uses || []).some(u => u.type === 'paid') ? 'refunded' : 'done') : (d.uses || []).length ? 'part' : 'wait';
  const STAT = { wait: ['En attente', 'warn'], part: ['Partiel', 'blue'], done: ['Payé', 'ok'], refunded: ['Remboursé', 'ok'] };
  const held = () => list().filter(d => App.depBalance(d) > 0.004);
  App.depHeldUsd = () => held().reduce((a, d) => a + App.usd(App.depBalance(d), d.currency, d), 0);
  App.depHeldBy = c => held().filter(d => d.clientId === c).reduce((a, d) => a + App.usd(App.depBalance(d), d.currency, d), 0);
  App.depCount = () => held().length;
  // rows for the cash journal (Finance, cash estimate, daily closing)
  App.depRows = () => { const rows = [], U = (n, d) => App.usd(n, d.currency, d);
    list().forEach(d => { const who = App.cname(App.client(d.clientId));
      rows.push({ date: d.date, kind: 'in', type: 'Dépôt client', label: 'Dépôt client · ' + (d.purpose || 'Autre'), who, mode: d.mode || 'Cash', ref: d.ref || '', cur: d.currency, amt: d.amount, usd: U(d.amount, d), go: ['deposits', ''] });
      (d.uses || []).forEach(u => rows.push({ date: u.date, kind: 'out', type: u.type === 'refund' ? 'Dépôt remboursé' : 'Dépôt payé', label: (u.type === 'refund' ? 'Remboursement au client · ' : 'Payé pour le client · ') + (d.purpose || 'Autre') + (u.note ? ' · ' + u.note : ''), who, mode: u.mode || d.mode || 'Cash', ref: u.ref || '', cur: d.currency, amt: u.amount, usd: U(u.amount, d), go: ['deposits', ''] })); });
    return rows; };
  const money = (n, c) => App.fmt(n, c);
  const days = d => Math.max(0, -App.diff(d.date, App.today()));

  // receipt number DEP-2026-0003: one more than the highest of the year
  const nextNo = date => { const y = (date || App.today()).slice(0, 4); let m = 0; list().forEach(d => { const x = /^DEP-(\d{4})-(\d+)$/.exec(d.no || ''); if (x && x[1] === y) m = Math.max(m, +x[2]); }); return `DEP-${y}-${String(m + 1).padStart(4, '0')}`; };
  App.depNo = d => { if (!d.no) { d.no = nextNo(d.date); App.save(); } return d.no; };

  // ---------- list ----------
  App.views.deposits = () => {
    const all = list().slice().sort((a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0)), H = held(), tot = App.depHeldUsd();
    const shown = all.filter(d => st.f === 'all' || (st.f === 'wait' ? App.depBalance(d) > 0.004 : App.depBalance(d) <= 0.004));
    const byC = {}; H.forEach(d => { byC[d.currency] = (byC[d.currency] || 0) + App.depBalance(d); });
    const clients = new Set(H.map(d => d.clientId)).size, oldest = H.length ? Math.max(...H.map(days)) : 0;
    const row = d => { const c = App.client(d.clientId), s = STAT[App.depStatus(d)], b = App.depBalance(d);
      return `<button class="item" data-act="dep_open" data-id="${d.id}"><span class="avatar ${s[1] === 'warn' ? 'warn' : s[1] === 'ok' ? 'ok' : ''}">${PICO[d.purpose] || '💼'}</span><div class="grow"><b>${esc(App.cname(c))}</b><small>${App.fdate(d.date)} · ${esc(d.purpose || 'Autre')} · ${esc(d.mode || 'Cash')}${b > 0.004 ? ' · depuis ' + days(d) + ' j' : ''}</small>${d.note ? `<small>${esc(d.note)}</small>` : ''}</div><div class="end"><b>${money(b > 0.004 ? b : d.amount, d.currency)}</b><span class="pill ${s[1]}">${s[0]}</span>${b > 0.004 && b < d.amount - 0.004 ? `<small>sur ${money(d.amount, d.currency)}</small>` : ''}</div></button>`; };
    return {
      title: 'Fonds en attente', sub: `${H.length} dépôt(s) à payer`, back: 'more', nav: 'more',
      html: `<section class="hero dhero"><div class="hero-top"><div><small>💼 À payer pour les clients</small><div class="hero-num" data-count="${tot}">${money(tot)}</div></div></div>
          <div class="cstats"><div><b>${H.length}</b><small>dépôt(s)</small></div><div><b>${clients}</b><small>client(s)</small></div><div class="${oldest > 14 ? 'bad' : ''}"><b>${oldest} j</b><small>plus ancien</small></div></div>
          ${Object.keys(byC).length > 1 ? `<small>${Object.entries(byC).map(([c, v]) => money(v, c)).join(' + ')}</small>` : ''}</section>
        <div class="bar noprint"><button class="btn" data-act="dep_new">+ Nouveau dépôt client</button></div>
        <div class="chips">${[['wait', 'En attente'], ['done', 'Payés / rendus'], ['all', 'Tous']].map(([k, t]) => `<button class="chip ${st.f === k ? 'on' : ''}" data-act="dep_f" data-f="${k}">${t}</button>`).join('')}</div>
        <p class="mut" style="margin:0 0 10px;font-size:13px">Cet argent est à vos clients tant que vous ne l'avez pas payé pour eux : il compte dans la caisse, mais pas dans votre chiffre d'affaires ni votre bénéfice.</p>
        ${shown.length ? `<div class="list">${shown.map(row).join('')}</div>` : `<div class="empty big"><div class="ei">💼</div><b>${st.f === 'wait' ? 'Aucun fonds en attente' : 'Rien à afficher'}</b><p class="mut">Quand un client verse de l'argent que vous payez plus tard pour lui (Starlink, commande…), notez-le ici.</p></div>`}`
    };
  };
  App.actions.dep_f = d => { st.f = d.f; App.refresh(); };
  App.actions.dep_new = d => App.depositForm(null, d && d.cid);
  App.actions.q_deposit = () => { App.close(); setTimeout(() => App.depositForm(), 30); };

  // ---------- create / edit ----------
  // only the clients managed by CISPOLstore (plus the one already on an existing deposit), filtered by a search text
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const clientOpts = (q, keep) => { const n = norm(q), l = App.db.clients.filter(c => c.type === 'gere' || c.id === keep).filter(c => !n || norm([App.cname(c), c.acc, c.phone, c.phone2, c.code].join(' ')).includes(n));
    return [['', l.length ? '— Choisir (' + l.length + ') —' : 'Aucun client trouvé'], ...l.map(c => [c.id, `${App.cname(c)}${c.acc ? ' · ' + c.acc : ''}${c.phone ? ' · ' + c.phone : ''}`])]; };
  const wireSearch = () => { const q = $('f_dq'), s = $('f_dc'); if (!q || !s) return;
    q.oninput = () => { const cur = s.value; s.innerHTML = clientOpts(q.value, cur).map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join(''); if (cur && [...s.options].some(o => o.value === cur)) s.value = cur; else if (s.options.length === 2) s.selectedIndex = 1; }; };

  App.depositForm = (dep, cid) => {
    if (!App.can('finance')) return App.toast('Action réservée au gérant ou au comptable');
    const isNew = !dep, t = App.today(), d = dep || { clientId: cid || '', date: t, amount: '', currency: 'USD', mode: 'Cash', purpose: 'Abonnement Starlink', note: '', ref: '' };
    if (!App.db.clients.length) return App.toast("Ajoutez d'abord un client");
    App.modal(isNew ? 'Nouveau dépôt client' : 'Modifier le dépôt',
      `<p class="mut" style="margin-top:0">Argent reçu d'un client, que vous gardez en attendant de payer pour lui.</p>
       ${F.text('f_dq', 'Rechercher un client', '', 'placeholder="Nom, compte ACC ou téléphone" autocomplete="off"')}${F.sel('f_dc', 'Client géré par CISPOLstore', clientOpts('', d.clientId), d.clientId)}
       <div class="row">${F.num('f_da', 'Montant reçu', d.amount)}${F.sel('f_dcur', 'Devise', [['USD', 'Dollars ($)'], ['CDF', 'Francs (CDF)']], d.currency)}</div>
       <div class="row">${F.sel('f_dp', 'Pour payer', PURPOSES, d.purpose)}${F.sel('f_dm', 'Reçu par', App.PAY_MODES, d.mode)}</div>
       ${F.date('f_dd', 'Date de réception', d.date, `max="${t}"`)}${F.text('f_dr', 'Référence (n° transaction)', d.ref || '')}${F.text('f_dn', 'Note', d.note || '', 'placeholder="Ex. à payer à Starlink le 15"')}`,
      () => {
        const cl = App.v('f_dc'), amt = App.n('f_da'); if (!cl) { App.toast('Choisissez le client'); return false; } if (amt <= 0) { App.toast('Montant invalide'); return false; }
        if (!isNew && (d.uses || []).length && amt < out(d) - 0.004) { App.toast('Le montant ne peut pas être inférieur à ce qui a déjà été payé'); return false; }
        const o = { clientId: cl, amount: amt, currency: App.v('f_dcur'), mode: App.v('f_dm'), purpose: App.v('f_dp'), date: App.v('f_dd') || t, ref: App.v('f_dr'), note: App.v('f_dn') };
        if (isNew) { Object.assign(d, o, { id: App.uid(), ts: Date.now(), rate: App.rate(), uses: [], no: nextNo(o.date) }); list().push(d); App.log(cl, `Dépôt reçu : ${money(amt, o.currency)} (${o.purpose})`); }
        else { if (o.currency !== d.currency) o.rate = App.rate(); Object.assign(d, o); App.log(cl, `Dépôt modifié : ${money(amt, o.currency)}`); }
        App.save(); App.toast(isNew ? 'Dépôt enregistré : ' + money(amt, o.currency) : 'Dépôt modifié'); App.refresh();
      }, isNew ? 'Enregistrer le dépôt' : 'Enregistrer'); wireSearch();
  };

  // printed / shared receipt of a deposit, with what has been paid for the client since and what is still held
  App.depositDoc = (d, logo, stamp) => {
    const K = App.docKit, co = App.db.settings.company, c = App.client(d.clientId), esc2 = App.esc, b = App.depBalance(d), uses = (d.uses || []).slice().sort((x, y) => x.date.localeCompare(y.date));
    const rows = uses.map(u => `<tr><td>${App.fdate(u.date)}</td><td>${u.type === 'refund' ? 'Remboursé au client' : 'Payé pour le client'}${u.note ? ' — ' + esc2(u.note) : ''}</td><td>${esc2(u.mode || 'Cash')}</td><td class="r">${K.money(u.amount, d.currency)}</td></tr>`).join('');
    return `<div class="paper">${K.head(co, logo)}
      ${K.boxes('REÇU DE DÉPÔT', [['N°', `<b>${esc2(App.depNo(d))}</b>`], ['Date', App.fdate(d.date)], ['Mode', esc2(d.mode || 'Cash')], d.ref && ['Référence', esc2(d.ref)]], 'CLIENT', [['Nom', `<b>${esc2(App.cname(c))}</b>`], ['Code Client', esc2(c ? c.code : '—')], c && c.phone && ['Téléphone', esc2(c.phone)]])}
      <div class="rc">Nous avons reçu de <b>${esc2(App.cname(c))}</b> la somme de <b class="big">${App.fmt(d.amount, d.currency)}</b> <i>(${esc2(App.amountWords(d.amount, d.currency))})</i>, déposée pour payer : <b>${esc2(d.purpose || 'Autre')}</b>${d.note ? ' — ' + esc2(d.note) : ''}. Cette somme est conservée pour le compte du client jusqu'à son paiement.</div>
      ${uses.length ? `<table class="items" style="margin-bottom:12px"><thead><tr><th style="width:16%">Date</th><th>Opération</th><th style="width:16%">Mode</th><th class="r" style="width:20%">Montant</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
      <table class="tots"><tr><td><b>Reçu :</b></td><td>${K.money(d.amount, d.currency)}</td></tr><tr class="net"><td>${b > 0.004 ? 'RESTE DÉTENU POUR LE CLIENT :' : 'SOLDE (TOUT EST RÉGLÉ) :'}</td><td>${K.money(b, d.currency)}</td></tr></table>
      <table class="sg"><tr><td></td><td class="gp"></td><td class="s2"><img src="${esc2(stamp || 'stamp.png')}" alt=""></td></tr><tr><td class="ln">Le client</td><td class="gp"></td><td class="ln">${esc2(co.name)}</td></tr></table>${K.foot(stamp, true)}</div>`; };
  App.actions.dep_print = async x => { const d = list().find(y => y.id === x.id); if (d) App.docKit.print('Dépôt ' + App.depNo(d), App.depositDoc(d, await App.docKit.logoData(), await App.docKit.stampData())); };
  App.actions.dep_pdf = async x => { const d = list().find(y => y.id === x.id); if (d) App.sharePdf(`Depot-${App.depNo(d)}.pdf`, App.depositDoc(d, await App.docKit.logoData(), await App.docKit.stampData())); };

  // ---------- detail, pay for the client, give back ----------
  const useRows = d => (d.uses || []).map(u => `<div class="item"><span class="avatar ${u.type === 'refund' ? '' : 'ok'}">${u.type === 'refund' ? '↩' : '✓'}</span><div class="grow"><b>${u.type === 'refund' ? 'Remboursé au client' : 'Payé pour le client'}</b><small>${App.fdate(u.date)} · ${esc(u.mode || 'Cash')}${u.note ? ' · ' + esc(u.note) : ''}</small></div><div class="end"><b>${money(u.amount, d.currency)}</b></div></div>`).join('');
  App.actions.dep_open = x => {
    const d = list().find(y => y.id === x.id); if (!d) return; const c = App.client(d.clientId), s = STAT[App.depStatus(d)], b = App.depBalance(d), fin = App.can('finance');
    App.modal('Dépôt · ' + App.cname(c),
      `<div class="card" style="margin:0 0 10px"><div class="spread"><span>Reçu le ${App.fdate(d.date)} (${esc(d.mode || 'Cash')})</span><b>${money(d.amount, d.currency)}</b></div><div class="spread"><span>Pour payer</span><b>${esc(d.purpose || 'Autre')}</b></div><div class="spread"><span>Reste à payer pour lui</span><b class="${b > 0.004 ? 'warn' : 'ok'}">${money(b, d.currency)}</b></div><div class="spread"><span>État</span><span class="pill ${s[1]}">${s[0]}</span></div>${d.note ? `<p class="mut" style="margin:8px 0 0">${esc(d.note)}</p>` : ''}${d.ref ? `<small class="mut">Réf. ${esc(d.ref)}</small>` : ''}</div>
       ${(d.uses || []).length ? `<h2 class="sec">Historique</h2><div class="list">${useRows(d)}</div>` : ''}
       <div class="bar noprint"><button type="button" class="btn sec" data-act="dep_print" data-id="${d.id}">🧾 Reçu</button><button type="button" class="btn sec" data-act="dep_pdf" data-id="${d.id}">📤 PDF</button></div>
       ${fin ? `<div class="bar">${b > 0.004 ? `<button type="button" class="btn" data-act="dep_use" data-id="${d.id}">✅ Payer pour le client</button><button type="button" class="btn sec" data-act="dep_refund" data-id="${d.id}">↩ Rendre au client</button>` : ''}<button type="button" class="btn sec" data-act="dep_edit" data-id="${d.id}">✎ Modifier</button><button type="button" class="btn del" data-act="dep_del" data-id="${d.id}">Supprimer</button></div>` : ''}${c ? `<div class="bar"><button type="button" class="btn sec" data-act="go" data-v="client" data-id="${c.id}">Voir le client</button></div>` : ''}`);
  };
  App.actions.dep_edit = x => { const d = list().find(y => y.id === x.id); if (d) App.depositForm(d); };
  const useForm = (x, refund) => {
    const d = list().find(y => y.id === x.id); if (!d || !App.can('finance')) return; const b = App.depBalance(d), c = App.client(d.clientId), t = App.today();
    App.modal(refund ? 'Rendre l\'argent au client' : 'Payer pour le client', `<p class="mut" style="margin-top:0">${esc(App.cname(c))} · reste ${money(b, d.currency)} sur ${money(d.amount, d.currency)} (${esc(d.purpose || 'Autre')}).</p>
      <div class="row">${F.num('f_ua', 'Montant ' + (refund ? 'rendu' : 'payé') + ' (' + (d.currency === 'CDF' ? 'CDF' : '$') + ')', b)}${F.date('f_ud', 'Date', t, `max="${t}"`)}</div>
      ${F.sel('f_um', refund ? 'Rendu par' : 'Payé par', App.PAY_MODES, d.mode || 'Cash')}${F.text('f_un', refund ? 'Note' : 'Payé à qui / note', '', refund ? '' : 'placeholder="Ex. paiement Starlink compte ACC…"')}${F.text('f_ur', 'Référence (n° transaction)', '')}
      ${!refund && c && c.type === 'gere' && /Abonnement/.test(d.purpose || '') ? '<label class="chk" style="margin-top:8px"><input type="checkbox" id="f_uren"> Ouvrir ensuite le renouvellement de son abonnement</label>' : ''}`,
      () => { const a = Math.round(App.n('f_ua') * 100) / 100; if (a <= 0) { App.toast('Montant invalide'); return false; } if (a > b + 0.004) { App.toast('Plus que le reste du dépôt (' + money(b, d.currency) + ')'); return false; }
        (d.uses = d.uses || []).push({ id: App.uid(), date: App.v('f_ud') || t, amount: a, type: refund ? 'refund' : 'paid', mode: App.v('f_um'), note: App.v('f_un'), ref: App.v('f_ur') });
        App.log(d.clientId, `${refund ? 'Dépôt rendu' : 'Payé pour le client'} : ${money(a, d.currency)} (${d.purpose})`); const ren = !refund && $('f_uren') && $('f_uren').checked;
        App.save(); App.toast((refund ? 'Rendu : ' : 'Payé : ') + money(a, d.currency)); App.refresh(); if (ren) setTimeout(() => App.renewForm(d.clientId), 60); if (!ren && App.depBalance(d) <= 0.004 && !refund) App.celebrate && App.celebrate(); },
      refund ? 'Rendre' : 'Enregistrer le paiement');
  };
  App.actions.dep_use = x => useForm(x, false);
  App.actions.dep_refund = x => useForm(x, true);
  App.actions.dep_del = x => { const d = list().find(y => y.id === x.id); if (!d || !App.can('finance')) return;
    if (!App.confirm(`Supprimer ce dépôt de ${money(d.amount, d.currency)} ?${(d.uses || []).length ? ' Ses paiements et remboursements seront supprimés aussi.' : ''}`)) return;
    App.db.deposits = list().filter(y => y !== d); App.log(d.clientId, 'Dépôt supprimé'); App.save(); App.close(); App.refresh(); };

  // ---------- client file: deposits tab ----------
  App.clientDepTab = c => { const l = list().filter(d => d.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date));
    return `<div class="bar"><button class="btn sm" data-act="dep_new" data-cid="${c.id}">+ Nouveau dépôt</button></div>${l.length ? `<div class="list">${l.map(d => { const s = STAT[App.depStatus(d)]; return `<button class="item" data-act="dep_open" data-id="${d.id}"><span class="avatar ${s[1] === 'warn' ? 'warn' : s[1] === 'ok' ? 'ok' : ''}">${PICO[d.purpose] || '💼'}</span><div class="grow"><b>${esc(d.purpose || 'Autre')}</b><small>${App.fdate(d.date)} · ${esc(d.mode || 'Cash')}</small></div><div class="end"><b>${money(App.depBalance(d) > 0.004 ? App.depBalance(d) : d.amount, d.currency)}</b><span class="pill ${s[1]}">${s[0]}</span></div></button>`; }).join('')}</div>` : '<div class="empty">Aucun dépôt de ce client.</div>'}`; };
})();
