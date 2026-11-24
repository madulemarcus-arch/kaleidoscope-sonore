// "Dû à Starlink": the subscription money collected from clients (and the Starlink share of paid penalties) belongs to Starlink.
// Owed = collected - already transferred; transfers ("reversements") are recorded here.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const list = () => (App.db.slpays = App.db.slpays || []);
  const M = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const mlabel = k => M[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4);
  const U = (n, cur, rec) => App.usd(n, cur, rec);
  // money collected for Starlink, by month (USD): subscription share of each payment + Starlink share of each paid penalty
  const collected = () => {
    const by = {}, add = (d, v, k) => { const m = d.slice(0, 7); (by[m] = by[m] || { sub: 0, pen: 0 })[k] += v; };
    App.db.payments.forEach(p => { const q = App.payParts(p); if (q.sub > 0) add(p.date, U(q.sub, p.currency, p), 'sub'); });
    (App.db.penalties || []).filter(p => p.paid).forEach(p => { const c = p.cost === undefined || p.cost === '' ? p.amount : p.cost; if (c > 0) add(p.paid, U(c, p.currency, p), 'pen'); });
    return by;
  };
  const sent = r => U(r.amount, r.currency, r);
  App.slStats = () => {
    const by = collected(), owed = Object.values(by).reduce((a, o) => a + o.sub + o.pen, 0), paid = list().reduce((a, r) => a + sent(r), 0);
    return { by, owed, paid, due: Math.round((owed - paid) * 100) / 100 };
  };
  App.slDue = () => Math.max(0, App.slStats().due);
  // when subscriptions are not taken out of the caisse automatically, a transfer is a real cash-out
  App.slRows = () => App.subOut() ? [] : list().map(r => ({ date: r.date, kind: 'out', type: 'Starlink', label: 'Reversement à Starlink', who: 'Starlink', mode: r.mode || 'Cash', ref: r.ref || '', cur: r.currency, amt: r.amount, usd: sent(r), go: ['starlink', ''] }));

  App.views.starlink = () => {
    const s = App.slStats(), pays = list().slice().sort((a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0)), last = pays[0];
    const months = Object.keys(s.by).sort().reverse(), money = n => App.fmt(Math.round(n * 100) / 100);
    const adv = s.due < -0.004;
    return {
      title: 'Dû à Starlink', sub: adv ? 'Vous êtes en avance' : s.due > 0.004 ? 'Reste à reverser' : 'Tout est à jour', back: 'more', nav: 'more',
      html: `<section class="hero dhero"><div class="hero-top"><div><small>📡 ${adv ? 'Avance versée à Starlink' : 'À reverser à Starlink'}</small><div class="hero-num" data-count="${Math.abs(s.due)}">${money(Math.abs(s.due))}</div></div></div>
          <div class="cstats"><div><b>${money(s.owed)}</b><small>encaissé pour Starlink</small></div><div><b>${money(s.paid)}</b><small>déjà reversé</small></div><div><b>${last ? App.fdate(last.date) : '—'}</b><small>dernier reversement</small></div></div></section>
        ${App.can('finance') ? `<div class="bar"><button class="btn" data-act="sl_new">+ Reversement à Starlink</button></div>` : ''}
        <p class="mut" style="font-size:13px;margin:0 0 10px">Les abonnements encaissés (et la part Starlink des pénalités payées) appartiennent à Starlink. Notez ici chaque somme que vous lui reversez : le reste à payer se met à jour tout seul.</p>
        <h2 class="sec">Encaissé pour Starlink, mois par mois</h2>
        ${months.length ? `<div class="list">${months.map(m => { const o = s.by[m]; return `<div class="item"><span class="avatar">📡</span><div class="grow"><b>${esc(mlabel(m))}</b><small>Abonnements ${money(o.sub)}${o.pen ? ' · pénalités ' + money(o.pen) : ''}</small></div><div class="end"><b>${money(o.sub + o.pen)}</b></div></div>`; }).join('')}</div>` : '<div class="empty">Aucun abonnement encaissé pour le moment.</div>'}
        <h2 class="sec">Reversements</h2>
        ${pays.length ? `<div class="list">${pays.map(r => `<button class="item" data-act="sl_open" data-id="${r.id}"><span class="avatar ok">✓</span><div class="grow"><b>${App.fmt(r.amount, r.currency)}</b><small>${App.fdate(r.date)} · ${esc(r.mode || 'Cash')}${r.ref ? ' · ' + esc(r.ref) : ''}${r.note ? ' · ' + esc(r.note) : ''}</small></div><span class="mut">›</span></button>`).join('')}</div>` : '<div class="empty">Aucun reversement enregistré.</div>'}`
    };
  };

  const form = r => {
    if (!App.can('finance')) return App.toast('Action réservée au gérant ou au comptable');
    const isNew = !r, t = App.today(), due = App.slDue();
    r = r || { date: t, amount: due > 0.004 ? due : '', currency: 'USD', mode: 'Cash', ref: '', note: '' };
    App.modal(isNew ? 'Reversement à Starlink' : 'Modifier le reversement',
      `<p class="mut" style="margin-top:0">${due > 0.004 ? `Reste à reverser : <b>${App.fmt(due)}</b>.` : 'Somme envoyée à Starlink.'}</p>
       <div class="row">${F.num('f_sa', 'Montant', r.amount)}${F.sel('f_scur', 'Devise', [['USD', 'Dollars ($)'], ['CDF', 'Francs (CDF)']], r.currency)}</div>
       <div class="row">${F.date('f_sd', 'Date', r.date, `max="${t}"`)}${F.sel('f_sm', 'Payé par', App.PAY_MODES, r.mode)}</div>
       ${F.text('f_sr', 'Référence (n° transaction)', r.ref || '')}${F.text('f_sn', 'Note', r.note || '', 'placeholder="Ex. paiement du mois de septembre"')}`,
      () => { const a = App.n('f_sa'); if (a <= 0) { App.toast('Montant invalide'); return false; }
        const o = { amount: a, currency: App.v('f_scur'), date: App.v('f_sd') || t, mode: App.v('f_sm'), ref: App.v('f_sr'), note: App.v('f_sn') };
        if (isNew) { list().push(Object.assign(o, { id: App.uid(), ts: Date.now(), rate: App.rate() })); } else { if (o.currency !== r.currency) o.rate = App.rate(); Object.assign(r, o); }
        App.save(); App.toast(isNew ? 'Reversement enregistré : ' + App.fmt(a, o.currency) : 'Reversement modifié'); App.refresh(); if (isNew && App.slDue() <= 0.004 && App.celebrate) App.celebrate(); },
      isNew ? 'Enregistrer' : 'Enregistrer');
  };
  App.actions.sl_new = () => form();
  App.actions.sl_open = x => { const r = list().find(y => y.id === x.id); if (!r) return;
    App.modal('Reversement à Starlink', `<div class="card" style="margin:0 0 10px"><div class="spread"><span>${App.fdate(r.date)} (${esc(r.mode || 'Cash')})</span><b>${App.fmt(r.amount, r.currency)}</b></div>${r.ref ? `<div class="mut">Réf. ${esc(r.ref)}</div>` : ''}${r.note ? `<div class="mut">${esc(r.note)}</div>` : ''}</div>
      ${App.can('finance') ? `<div class="bar"><button type="button" class="btn sec" data-act="sl_edit" data-id="${r.id}">✏️ Modifier</button><button type="button" class="btn sec" data-act="sl_del" data-id="${r.id}">🗑 Supprimer</button></div>` : ''}`); };
  App.actions.sl_edit = x => { const r = list().find(y => y.id === x.id); if (r) { App.close(); setTimeout(() => form(r), 30); } };
  App.actions.sl_del = x => { const r = list().find(y => y.id === x.id); if (!r || !App.can('finance')) return;
    if (!App.confirm(`Supprimer ce reversement de ${App.fmt(r.amount, r.currency)} ?`)) return;
    App.db.slpays = list().filter(y => y !== r); App.save(); App.close(); App.refresh(); };
})();
