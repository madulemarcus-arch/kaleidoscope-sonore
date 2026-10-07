// Penalties charged by Starlink for late subscriptions: recorded per client, flagged when paid, counted in the profit.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const REASONS = ['Retard de paiement', 'Réactivation après suspension', 'Frais de reconnexion', 'Autre'];
  const CUR = [['USD', 'Dollar ($)'], ['CDF', 'Franc congolais (CDF)']];
  const list = () => App.db.penalties;
  App.penalty = id => list().find(p => p.id === id);
  const due = () => list().filter(p => !p.paid).sort((a, b) => a.date.localeCompare(b.date));
  App.penaltyDueTotal = () => due().reduce((a, p) => a + App.usd(p.amount, p.currency), 0);
  const tag = p => p.paid ? `<span class="pill ok">Payée le ${App.fdate(p.paid)}</span>` : '<span class="pill bad">À payer</span>';
  const row = (p, withName) => `<div class="item"><div class="grow"><b>${withName ? esc(App.cname(App.client(p.clientId))) + ' · ' : ''}${App.fmt(p.amount, p.currency)}</b><small style="white-space:normal">${esc(p.reason)} · ${App.fdate(p.date)}${p.paid ? ' · ' + esc(p.mode || '') : ''}${p.note ? ' · ' + esc(p.note) : ''}</small></div><div class="end">${tag(p)}<span>${p.paid ? `<button class="btn sm sec" data-act="pen_unpay" data-id="${p.id}">↩︎</button>` : `<button class="btn sm" data-act="pen_pay" data-id="${p.id}">✓ Payée</button>${(App.client(p.clientId) || {}).phone ? ` <button class="btn sm sec" data-act="pen_reminder" data-id="${p.id}">💬</button>` : ''}`} <button class="btn sm sec" data-act="pen_edit" data-id="${p.id}">✏️</button></span></div></div>`;

  // block shown in the client's "Abonnement" tab
  App.penaltyBlock = c => {
    const l = list().filter(p => p.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date)), owed = l.filter(p => !p.paid).length;
    return `<h2 class="sec">Pénalités${owed ? ` <span class="pill bad">${owed} à payer</span>` : ''}<button class="more" data-act="pen_new" data-cid="${c.id}">+ Pénalité</button></h2>` + (l.length ? `<div class="list">${l.map(p => row(p)).join('')}</div>` : '<div class="empty">Aucune pénalité enregistrée pour ce client.</div>');
  };
  // section shown on the "Impayés" page
  App.penaltySection = () => { const l = due(); return l.length ? `<h2 class="sec">Pénalités à encaisser <span class="pill bad">${l.length}</span></h2><div class="list">${l.map(p => row(p, true)).join('')}</div>` : ''; };

  App.penaltyForm = (p, clientId) => {
    const isNew = !p; p = p || { clientId, date: App.today(), amount: '', currency: 'USD', reason: REASONS[0], cost: '', note: '', paid: '', mode: 'Cash' };
    const cl = App.clientOpts('— Choisir —', ['gere']);
    App.modal(isNew ? 'Nouvelle pénalité' : 'Modifier la pénalité',
      `${F.sel('f_c', 'Client', cl, p.clientId)}<div class="row">${F.num('f_a', 'Montant de la pénalité', p.amount)}${F.sel('f_cur', 'Devise', CUR, p.currency)}</div>
       <div class="row">${F.text('f_r', 'Motif', p.reason, 'list="pen_rs" autocomplete="off"')}${F.date('f_d', 'Date', p.date)}</div>${F.list('pen_rs', REASONS)}
       ${F.num('f_cost', 'Part reversée à Starlink (laisser vide = tout le montant)', p.cost === p.amount ? '' : p.cost)}${F.area('f_n', 'Note', p.note)}
       ${isNew ? '' : '<div class="bar"><button type="button" class="btn sm del" data-act="pen_del" data-id="' + p.id + '">Supprimer cette pénalité</button></div>'}`,
      () => {
        if (!App.v('f_c')) { App.toast('Choisissez un client'); return false; }
        const amount = App.n('f_a'); if (!(amount > 0)) { App.toast('Montant requis'); return false; }
        const cost = $('f_cost').value === '' ? amount : Math.min(App.n('f_cost'), amount);
        Object.assign(p, { clientId: App.v('f_c'), amount, currency: App.v('f_cur'), reason: App.v('f_r') || REASONS[0], date: App.v('f_d') || App.today(), cost, note: App.v('f_n') });
        if (isNew) { p.id = App.uid(); list().push(p); App.log(p.clientId, `Pénalité enregistrée : ${App.fmt(p.amount, p.currency)} (${p.reason})`); }
        App.save(); App.toast('Pénalité enregistrée'); App.refresh();
      });
  };
  App.actions.pen_new = d => App.penaltyForm(null, d.cid);
  App.actions.pen_edit = d => App.penaltyForm(App.penalty(d.id));
  App.actions.pen_del = d => { const p = App.penalty(d.id); if (!p || !App.confirm('Supprimer cette pénalité ?')) return; App.db.penalties = list().filter(x => x !== p); App.close(); App.save(); App.refresh(); };
  App.actions.pen_pay = d => {
    const p = App.penalty(d.id); if (!p) return;
    App.modal('Pénalité payée', `<p>${esc(App.cname(App.client(p.clientId)))} : <b>${App.fmt(p.amount, p.currency)}</b> (${esc(p.reason)})</p><div class="row">${F.date('f_d', 'Date du paiement', App.today())}${F.sel('f_m', 'Mode', App.PAY_MODES, 'Cash')}</div>`, () => {
      p.paid = App.v('f_d') || App.today(); p.mode = App.v('f_m'); App.log(p.clientId, `Pénalité payée : ${App.fmt(p.amount, p.currency)} (${p.reason})`);
      App.save(); App.toast('Pénalité marquée comme payée'); App.refresh();
    }, 'Confirmer le paiement');
  };
  App.actions.pen_unpay = d => { const p = App.penalty(d.id); if (!p || !App.confirm('Annuler le paiement de cette pénalité ?')) return; p.paid = ''; App.log(p.clientId, 'Paiement de pénalité annulé'); App.save(); App.refresh(); };
  // quick access from a client's subscription card
  App.actions.pen_reminder = d => { const p = App.penalty(d.id), c = p && App.client(p.clientId); if (!c || !c.phone) return App.toast('Pas de numéro de téléphone'); window.open(App.waUrl(c.phone, App.penaltyText(p, c)), '_blank', 'noopener'); };
})();
