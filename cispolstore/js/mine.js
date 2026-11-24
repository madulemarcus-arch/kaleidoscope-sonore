// "Part de l'entreprise": what stays with the company in each payment (the rest goes to Starlink and the technicians), month by month,
// with the net result, a consistency check, the technicians' balance and a month closing. Nothing derived is stored except the closings.
(() => {
  'use strict';
  const App = window.App, esc = App.esc, F = App.f;
  const M = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const mlabel = k => M[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4);
  const U = (n, cur, rec) => App.usd(n, cur, rec), r2 = n => Math.round(n * 100) / 100, money = n => App.fmt(r2(n));
  const norm = s => String(s || '').trim().toLowerCase();
  const COMM = 'Commission technicien';
  const isAdmin = () => !App.multi() || (App.user && App.user.role === 'admin');
  App.mineName = () => ((App.db.settings.company || {}).name || '').trim() || 'CISPOLstore';
  const closes = () => (App.db.mcloses = App.db.mcloses || []);
  const closing = m => closes().find(c => c.month === m);
  // a closed month no longer accepts payments or expenses (the administrator can reopen it)
  App.closedGuard = date => { const c = date && closing(String(date).slice(0, 7)); if (!c) return false; App.toast(`${mlabel(c.month)} est clôturé : rouvrez le mois (Plus > Part de ${App.mineName()}) pour modifier`); return true; };

  // technician of an expense (explicit id, or the name after "Commission " / "Versement ")
  const expTech = e => e.techId || App.techId(String(e.label || '').replace(/^(commission|versement)\s+/i, '')) || '';
  const instTech = p => { const x = App.db.installs.find(i => i.invoiceId && i.invoiceId === p.invoiceId); return x ? (x.techId || App.techId(x.tech) || '') : ''; };

  // every figure, by month (USD)
  const compute = () => {
    const by = {}, row = m => (by[m] = by[m] || { enc: 0, own: 0, inst: 0, sub: 0, pen: 0, penSl: 0, comm: 0, other: 0 }), tech = {};
    const T = id => (tech[id || ''] = tech[id || ''] || { inst: 0, paid: 0 });
    App.db.payments.forEach(p => { const q = App.payParts(p), o = row(p.date.slice(0, 7)); o.enc += U(p.amount, p.currency, p); o.own += U(q.own, p.currency, p); o.inst += U(q.inst, p.currency, p); o.sub += U(q.sub, p.currency, p); if (q.inst > 0) T(instTech(p)).inst += U(q.inst, p.currency, p); });
    (App.db.penalties || []).filter(p => p.paid).forEach(p => { const c = p.cost === undefined || p.cost === '' ? p.amount : p.cost, o = row(p.paid.slice(0, 7)); o.enc += U(p.amount, p.currency, p); o.penSl += U(Math.min(c, p.amount), p.currency, p); o.pen += U(Math.max(0, p.amount - c), p.currency, p); });
    App.db.expenses.forEach(e => { const o = row(e.date.slice(0, 7)), v = U(e.amount, e.currency, e); if (e.cat === COMM) { o.comm += v; T(expTech(e)).paid += v; } else o.other += v; });
    // chronological: the installation money goes to the technicians; a commission above what they collected is a cost for the company
    let bal = 0; Object.keys(by).sort().forEach(m => { const o = by[m]; o.mine = o.own + o.pen; bal += o.inst - o.comm; o.cost = 0; if (bal < 0) { o.cost = -bal; bal = 0; } o.techBal = bal;
      o.net = o.mine - o.other - o.cost; o.gap = o.enc - (o.own + o.inst + o.sub + o.pen + o.penSl); });
    const t = App.today().slice(0, 7), pd = new Date(+t.slice(0, 4), +t.slice(5) - 2, 1), pm = pd.getFullYear() + '-' + String(pd.getMonth() + 1).padStart(2, '0');
    const all = Object.values(by);
    return { by, tech, t, pm, total: all.reduce((a, o) => a + o.mine, 0), net: all.reduce((a, o) => a + o.net, 0), cur: by[t] || { mine: 0, net: 0 }, prev: by[pm] || { mine: 0, net: 0 }, techDue: bal };
  };
  App.mineStats = () => { const s = compute(); return { by: s.by, total: s.total, cur: s.cur.mine, prev: s.prev.mine, net: s.net, techDue: s.techDue, tech: s.tech, t: s.t, pm: s.pm }; };
  const ok = o => Math.abs(o.gap) < 0.015;

  App.views.mine = () => {
    const s = compute(), co = esc(App.mineName()), months = Object.keys(s.by).sort().reverse(), techs = App.db.technicians.filter(t => t.active !== false || (s.tech[t.id] && (s.tech[t.id].inst || s.tech[t.id].paid)));
    const bad = Object.keys(s.by).filter(m => !ok(s.by[m]));
    return {
      title: 'Part de ' + App.mineName(), sub: 'Ce qui vous revient', back: 'more', nav: 'more',
      html: `<section class="hero dhero"><div class="hero-top"><div><small>💼 Revenu de ${co}, ${esc(mlabel(s.t))}</small><div class="hero-num" data-count="${s.cur.mine}">${money(s.cur.mine)}</div></div></div>
          <div class="cstats"><div><b class="${s.cur.net < 0 ? 'bad' : ''}">${money(s.cur.net)}</b><small>net du mois</small></div><div><b>${money(s.prev.mine)}</b><small>${esc(mlabel(s.pm))}</small></div><div><b>${money(s.total)}</b><small>total depuis le début</small></div></div></section>
        ${bad.length ? `<div class="card" style="border-left:4px solid var(--bad)"><b>⚠️ Contrôle : écart détecté</b><div class="mut">${bad.map(m => esc(mlabel(m))).join(', ')} : la somme des parts ne correspond pas à l'argent encaissé. Ouvrez le mois pour voir l'écart.</div></div>` : ''}
        <p class="mut" style="font-size:13px;margin:0 0 10px">Dans chaque paiement reçu, une partie va à Starlink (abonnement) et aux techniciens (installation) : le reste, avec la part de l'entreprise des pénalités payées, est ce qui revient à ${co}. Le net retire les dépenses enregistrées.</p>
        <div class="bar"><button class="btn sec sm" data-act="mine_csv">⬇️ Excel (CSV)</button><button class="btn sec sm" data-act="mine_pdf">📄 PDF</button></div>
        <h2 class="sec">Revenu de ${co}, mois par mois</h2>
        ${months.length ? `<div class="list">${months.map(m => { const o = s.by[m], c = closing(m); return `<button class="item" data-act="mine_m" data-m="${m}"><span class="avatar">${c ? '🔒' : '💼'}</span><div class="grow"><b>${esc(mlabel(m))}${ok(o) ? '' : ' ⚠️'}</b><small>Part ${money(o.mine)} · dépenses ${money(o.other + o.cost)}</small><small>Starlink ${money(o.sub)} · techniciens ${money(o.inst)}</small></div><div class="end"><b class="${o.net < 0 ? 'bad' : 'ok'}">${money(o.net)}</b><small>net</small></div></button>`; }).join('')}</div>` : '<div class="empty">Aucun paiement pour le moment.</div>'}
        <h2 class="sec">Techniciens : reste à payer</h2>
        <p class="mut" style="font-size:13px;margin:0 0 8px">Installations encaissées moins ce qui a déjà été versé (commissions et versements).</p>
        ${techs.length || s.tech[''] ? `<div class="list">${[...techs.map(t => [t.id, t.name]), ...(s.tech[''] && (s.tech[''].inst || s.tech[''].paid) ? [['', 'Sans technicien précisé']] : [])].map(([id, name]) => { const o = s.tech[id] || { inst: 0, paid: 0 }, d = r2(o.inst - o.paid); return `<div class="item"><span class="avatar">🧰</span><div class="grow"><b>${esc(name)}</b><small>Installations ${money(o.inst)} · versé ${money(o.paid)}</small></div><div class="end"><b class="${d < 0 ? 'bad' : d > 0 ? 'warn' : 'ok'}">${money(Math.abs(d))}</b><small>${d < 0 ? 'avance' : d > 0 ? 'à payer' : 'à jour'}</small></div>${App.can('finance') ? `<button class="btn sm sec" data-act="mine_pay" data-id="${id}">Verser</button>` : ''}</div>`; }).join('')}</div>` : '<div class="empty">Aucun technicien enregistré.</div>'}`
    };
  };

  const detail = m => {
    const s = compute(), o = s.by[m]; if (!o) return; const c = closing(m), co = esc(App.mineName());
    const L = (a, b, cls) => `<div class="spread"><span>${a}</span><b class="${cls || ''}">${b}</b></div>`;
    App.modal(mlabel(m) + (c ? ' 🔒' : ''), `<div class="card" style="margin:0 0 10px">${L('Argent encaissé', money(o.enc))}${L('− Starlink (abonnements)', money(o.sub + o.penSl))}${L('− Techniciens (installations)', money(o.inst))}${L('= Part de ' + co, money(o.mine), 'ok')}
        <hr style="border:0;border-top:1px solid var(--line);margin:8px 0">${L('Dépenses du mois', '− ' + money(o.other))}${o.cost > 0.004 ? L('Commissions au-dessus des installations', '− ' + money(o.cost)) : ''}${L('Net du mois', money(o.net), o.net < 0 ? 'bad' : 'ok')}
        <hr style="border:0;border-top:1px solid var(--line);margin:8px 0">${ok(o) ? '<div class="ok">✅ Contrôle : part + Starlink + techniciens = argent encaissé</div>' : `<div class="bad">⚠️ Écart de ${money(o.gap)} entre l'argent encaissé et la somme des parts (une facture dont l'installation + l'abonnement dépassent le paiement ?)</div>`}
        ${c ? `<div class="mut" style="margin-top:8px">Clôturé le ${App.fdate(c.date)}${c.by ? ' par ' + esc(c.by) : ''} : part ${money(c.mine)}, net ${money(c.net)}.${r2(c.mine - o.mine) !== 0 || r2(c.net - o.net) !== 0 ? ` <b class="bad">Les chiffres ont changé depuis (part ${money(o.mine)}, net ${money(o.net)}).</b>` : ''}</div>` : ''}</div>
      ${c ? (isAdmin() ? `<div class="bar"><button type="button" class="btn sec" data-act="mine_open" data-m="${m}">🔓 Rouvrir le mois</button></div>` : '') : (m < App.today().slice(0, 7) && App.can('finance') ? `<div class="bar"><button type="button" class="btn" data-act="mine_close" data-m="${m}">🔒 Clôturer ${esc(mlabel(m))}</button></div><p class="mut" style="font-size:12px">Clôturer fige les chiffres : plus de paiement ni de dépense à une date de ce mois sans rouvrir le mois.</p>` : '<p class="mut" style="font-size:12px">Un mois se clôture une fois terminé.</p>')}`);
  };
  App.actions.mine_m = d => detail(d.m);
  App.actions.mine_close = d => { const m = d.m; if (closing(m) || m >= App.today().slice(0, 7) || !App.can('finance')) return; const o = compute().by[m]; if (!o) return;
    if (!ok(o) && !App.confirm('Le contrôle montre un écart. Clôturer quand même ?')) return;
    if (!App.confirm(`Clôturer ${mlabel(m)} ? Les chiffres sont figés et le mois n'accepte plus de paiement ni de dépense.`)) return;
    const who = App.me && App.me();
    closes().push({ id: App.uid(), month: m, date: App.today(), ts: Date.now(), by: who ? who.name : '', mine: r2(o.mine), net: r2(o.net), enc: r2(o.enc), sub: r2(o.sub + o.penSl), inst: r2(o.inst), other: r2(o.other + o.cost) });
    if (App.secLog) App.secLog(`Mois clôturé : ${mlabel(m)}`); App.save(); App.toast(mlabel(m) + ' clôturé'); App.close(); App.refresh(); };
  App.actions.mine_open = d => { const c = closing(d.m); if (!c || !isAdmin()) return; if (!App.confirm(`Rouvrir ${mlabel(d.m)} ? La clôture sera supprimée.`)) return;
    App.db.mcloses = closes().filter(x => x !== c); if (App.secLog) App.secLog(`Mois rouvert : ${mlabel(d.m)}`); App.save(); App.toast(mlabel(d.m) + ' rouvert'); App.close(); App.refresh(); };

  // free payment to a technician: an expense in the "Commission technicien" category linked to the technician
  App.actions.mine_pay = d => {
    if (!App.can('finance')) return App.toast('Action réservée au gérant ou au comptable');
    const s = compute(), t = d.id && App.tech(d.id), o = s.tech[d.id || ''] || { inst: 0, paid: 0 }, due = r2(o.inst - o.paid), today = App.today();
    const list = App.db.technicians.map(x => [x.id, x.name]);
    App.modal('Verser à un technicien', `<p class="mut" style="margin-top:0">${t ? `Reste à payer à ${esc(t.name)} : <b>${money(Math.max(0, due))}</b>.` : 'Somme versée à un technicien.'}</p>
      ${F.sel('f_tech', 'Technicien', list, d.id || (list[0] || [''])[0])}<div class="row">${F.num('f_ta', 'Montant ($)', due > 0.004 ? due : '')}${F.date('f_td', 'Date', today, `max="${today}"`)}</div>${F.sel('f_tm', 'Payé par', App.PAY_MODES, 'Cash')}${F.text('f_tn', 'Note', '', 'placeholder="Ex. installations de la semaine"')}`,
      () => { const id = App.v('f_tech'), tt = App.tech(id), a = App.n('f_ta'), date = App.v('f_td') || today;
        if (!tt) { App.toast('Choisissez un technicien'); return false; } if (!(a > 0)) { App.toast('Montant invalide'); return false; }
        if (App.closedGuard(date)) return false;
        App.db.expenses.push({ id: App.uid(), label: 'Versement ' + tt.name + (App.v('f_tn') ? ' · ' + App.v('f_tn') : ''), cat: COMM, techId: id, amount: a, currency: 'USD', mode: App.v('f_tm'), date });
        App.save(); App.toast('Versement enregistré : ' + App.fmt(a)); App.refresh(); }, 'Enregistrer');
  };

  // exports: one line per month
  const table = () => { const s = compute(); return [['Mois', 'Encaissé', 'Starlink', 'Techniciens', 'Part ' + App.mineName(), 'Dépenses', 'Net', 'Contrôle', 'Clôturé'],
    ...Object.keys(s.by).sort().map(m => { const o = s.by[m], c = closing(m); return [mlabel(m), r2(o.enc), r2(o.sub + o.penSl), r2(o.inst), r2(o.mine), r2(o.other + o.cost), r2(o.net), ok(o) ? 'OK' : 'Écart ' + r2(o.gap), c ? App.fdate(c.date) : '']; })]; };
  App.actions.mine_csv = () => App.download(`part-${norm(App.mineName()).replace(/[^a-z0-9]+/g, '-')}-${App.today()}.csv`, App.csv(table()), 'text/csv');
  App.actions.mine_pdf = () => { const t = table(), h = `<div style="font-family:Inter,Arial,sans-serif;padding:24px;width:760px"><h2 style="margin:0 0 4px">${esc(App.mineName())} : part de l'entreprise</h2><div style="color:#666;margin-bottom:12px">Relevé au ${App.fdate(App.today())} (en dollars)</div><table style="border-collapse:collapse;width:100%;font-size:13px">${t.map((r, k) => `<tr>${r.map((v, j) => `<${k ? 'td' : 'th'} style="border:1px solid #ccc;padding:5px 7px;text-align:${j && j < 7 ? 'right' : 'left'};${k ? '' : 'background:#eef2f7'}">${esc(v)}</${k ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</table></div>`;
    App.sharePdf(`part-entreprise-${App.today()}.pdf`, h); };
})();
