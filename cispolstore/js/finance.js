// Finance tab (administrator and accountant): every movement of money in one journal — what came in, what went out, by mode and currency.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc;
  const fs = { per: 'month', from: App.today().slice(0, 8) + '01', to: App.today(), kind: 'all', mode: 'all', stock: true };
  const NOMODE = 'Non précisé';

  // All movements, newest first: cash received (payments, penalties) and cash paid out (expenses, commissions, stock purchases)
  App.ledger = () => {
    const db = App.db, rows = [], U = (n, c, r) => App.usd(n, c, r);
    db.payments.forEach(p => { const i = App.invoice(p.invoiceId); rows.push({ date: p.date, kind: 'in', type: 'Paiement', label: i ? 'Paiement · ' + i.number : 'Paiement (sans facture)', who: App.cname(App.client(p.clientId)), mode: p.mode || NOMODE, ref: p.ref || '', cur: p.currency, amt: p.amount, usd: U(p.amount, p.currency, p), go: i ? ['invoice', i.id] : p.clientId ? ['client', p.clientId] : null }); });
    // the installation fee is paid straight to the technicians and the subscription goes to Starlink, both out of the cash received: they never stay in the caisse
    db.payments.forEach(p => { const i = App.invoice(p.invoiceId); if (!i) return; const q = App.payParts(p), ins = db.installs.find(x => x.invoiceId === i.id);
      if (App.instOut() && q.inst > 0) rows.push({ date: p.date, kind: 'out', type: 'Installation', label: 'Frais d\'installation · ' + i.number, who: (ins && ins.tech) || 'Technicien', mode: p.mode || NOMODE, ref: '', cur: p.currency, amt: q.inst, usd: U(q.inst, p.currency, p), go: ['invoice', i.id] });
      if (App.subOut() && q.sub > 0) rows.push({ date: p.date, kind: 'out', type: 'Abonnement', label: 'Abonnement Starlink · ' + i.number, who: 'Starlink', mode: p.mode || NOMODE, ref: '', cur: p.currency, amt: q.sub, usd: U(q.sub, p.currency, p), go: ['invoice', i.id] }); });
    db.penalties.filter(p => p.paid).forEach(p => rows.push({ date: p.paid, kind: 'in', type: 'Pénalité', label: 'Pénalité · ' + p.reason, who: App.cname(App.client(p.clientId)), mode: p.mode || NOMODE, ref: '', cur: p.currency, amt: p.amount, usd: U(p.amount, p.currency, p), go: p.clientId ? ['client', p.clientId] : null }));
    db.expenses.forEach(e => rows.push({ date: e.date, kind: 'out', type: e.cat === 'Commission technicien' ? 'Commission' : 'Dépense', label: e.label, who: e.cat, mode: e.mode || NOMODE, ref: '', cur: e.currency, amt: e.amount, usd: U(e.amount, e.currency, e), go: ['expenses', ''] }));
    (db.purchases || []).forEach(b => rows.push({ date: b.date, kind: 'out', type: 'Achat', label: App.purchaseLabel(b), who: App.purchaseWho(b), mode: b.mode || NOMODE, ref: b.ref || '', cur: b.currency, amt: App.purchaseTotal(b), usd: U(App.purchaseTotal(b), b.currency, b), go: ['purchase', b.id] }));
    db.moves.filter(m => m.qty > 0 && (m.purchase === true || (m.purchase === undefined && !m.invoiceId && m.supplierId && !/^Annulation/.test(m.note || ''))) && m.cost > 0).forEach(m => { const p = App.prod(m.pid); rows.push({ date: m.date, kind: 'out', type: 'Achat stock', label: `Achat stock · ${p ? p.name : '?'} × ${App.nf(m.qty, 2)}`, who: (App.supplier(m.supplierId) || {}).name || '', mode: NOMODE, ref: '', cur: 'USD', amt: m.qty * m.cost, usd: m.qty * m.cost, go: ['stock', ''] }); });
    return rows.map((r, k) => ({ ...r, k })).sort((a, b) => b.date.localeCompare(a.date) || b.k - a.k);
  };
  App.instOut = () => App.db.settings.instFromCash !== false;
  App.subOut = () => App.db.settings.subFromCash !== false;

  // ---------- Caisse: the amount really in the drawer, written down by hand; the app then follows the cash movements since that count ----------
  const lastCount = () => (App.db.caisse || []).slice().sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts)[0];
  const estimate = (base, upto) => { const e = { USD: base.usd || 0, CDF: base.cdf || 0 }; App.ledger().filter(r => r.mode === 'Cash' && r.date > base.date && (!upto || r.date <= upto)).forEach(r => { e[r.cur] = (e[r.cur] || 0) + (r.kind === 'in' ? r.amt : -r.amt); }); return e; };
  const cur2 = o => [['USD', o.USD], ['CDF', o.CDF]].filter(([, v]) => Math.abs(v || 0) > 0.004).map(([c, v]) => App.fmt(v, c)).join(' + ') || '0 $';
  // what the money received in the period is really made of
  App.paySplit = r => { const o = { enc: 0, inst: 0, sub: 0, own: 0 }; App.db.payments.filter(p => App.inRange(p.date, r)).forEach(p => { const q = App.payParts(p), U = x => App.usd(x, p.currency, p); o.enc += U(p.amount); o.inst += U(q.inst); o.sub += U(q.sub); o.own += U(q.own); }); return o; };
  const splitCard = r => { const s = App.paySplit(r), F = x => App.fmt(x); if (s.enc <= 0) return '';
    return `<h2 class="sec">🧮 Où va l'argent encaissé</h2><div class="list"><div class="item"><div class="grow"><b>Encaissé (paiements)</b></div><b>${F(s.enc)}</b></div><div class="item"><div class="grow"><b>🔧 Installations</b><small>pour les techniciens</small></div><b class="bad">− ${F(s.inst)}</b></div><div class="item"><div class="grow"><b>📡 Abonnements</b><small>pour Starlink</small></div><b class="bad">− ${F(s.sub)}</b></div><div class="item"><div class="grow"><b>✅ Chiffre d'affaires CISPOLstore</b><small>kits, matériel, accessoires</small></div><b class="ok" style="font-size:18px">${F(s.own)}</b></div></div>`; };
  const caisseCard = () => {
    const base = lastCount(), hist = (App.db.caisse || []).slice().sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts).slice(0, 5), est = base && estimate(base);
    return `<h2 class="sec">💵 En caisse</h2><div class="card">
      ${base ? `<div class="spread"><span>Caisse estimée maintenant</span><b style="font-size:20px">${cur2(est)}</b></div><small class="mut">Dernier montant noté : ${cur2({ USD: base.usd, CDF: base.cdf })} le ${App.fdate(base.date)}, puis les entrées et sorties en <b>Cash</b> des jours suivants${App.instOut() ? ' (frais d\'installation et abonnements retirés selon vos cases)' : ''}.</small>` : '<p class="mut" style="margin:0 0 8px">Notez le montant qu\'il y a dans la caisse : l\'application suivra ensuite les entrées et sorties en Cash pour estimer ce qu\'il doit y rester.</p>'}
      <div class="bar noprint" style="margin-top:10px"><button class="btn" data-act="caisse_set">✏️ Noter le montant en caisse</button></div>
      <label class="l noprint" style="margin:10px 0 0"><input type="checkbox" id="fin_inst" ${App.instOut() ? 'checked' : ''} style="width:auto"> Retirer les frais d'installation de la caisse (payés directement aux techniciens)</label>
      <label class="l noprint" style="margin:6px 0 0"><input type="checkbox" id="fin_sub" ${App.subOut() ? 'checked' : ''} style="width:auto"> Retirer les abonnements de la caisse (reversés à Starlink)</label>
      ${hist.length ? `<div class="list" style="margin-top:10px">${hist.map(h => `<div class="item"><div class="grow"><b>${cur2({ USD: h.usd, CDF: h.cdf })}</b><small>${App.fdate(h.date)}${h.by ? ' · ' + esc(h.by) : ''}${h.note ? ' · ' + esc(h.note) : ''}${h.expected ? ' · attendu ' + cur2(h.expected) : ''}</small></div>${h.expected && h.diff ? `<b class="warn">écart ${cur2(h.diff)}</b>` : h.expected ? '<b class="ok">OK</b>' : ''}<button class="btn sm del noprint" data-act="delcaisse" data-id="${h.id}">✕</button></div>`).join('')}</div>` : ''}</div>`;
  };
  App.actions.caisse_set = () => {
    const base = lastCount(), t = App.today(), e = base ? estimate(base, t) : null;
    App.modal('Montant en caisse', `<p class="mut" style="margin-top:0">Comptez ce qu'il y a dans la caisse (billets et monnaie) et écrivez-le.${e ? ` L'application attendait <b>${cur2(e)}</b>.` : ''}</p>
      ${App.f.date('c_date', 'Date du comptage', t, `max="${t}"`)}<div class="row">${App.f.num('c_usd', 'Dollars ($)', '', e ? `placeholder="${App.nf(e.USD, 2)}"` : '')}${App.f.num('c_cdf', 'Francs (CDF)', '', e ? `placeholder="${App.nf(e.CDF, 0)}"` : '')}</div>${App.f.text('c_note', 'Note (facultatif)', '', 'placeholder="Ex. après paiement des techniciens"')}`,
      () => {
        const usd = App.n('c_usd'), cdf = App.n('c_cdf'), date = App.v('c_date') || t;
        if (!$('c_usd').value && !$('c_cdf').value) { App.toast('Écrivez le montant en dollars et/ou en francs'); return false; }
        const exp = base && date > base.date ? estimate(base, date) : null, who = App.me ? App.me() : null, diff = {};
        if (exp) { const dU = Math.round((usd - exp.USD) * 100) / 100, dC = Math.round(cdf - exp.CDF); if (Math.abs(dU) > 0.004) diff.USD = dU; if (Math.abs(dC) > 0.4) diff.CDF = dC; }
        (App.db.caisse = App.db.caisse || []).push({ id: App.uid(), ts: Date.now(), date, usd, cdf, note: App.v('c_note'), by: who ? who.name : '', ...(exp ? { expected: exp, diff: Object.keys(diff).length ? diff : null } : {}) });
        App.save(); App.refresh(); App.toast('Montant en caisse noté');
      });
  };
  App.actions.delcaisse = d => { if (!App.confirm('Supprimer ce montant noté ?')) return; App.db.caisse = (App.db.caisse || []).filter(x => x.id !== d.id); App.save(); App.refresh(); };

  const span = () => fs.per === 'custom' ? [fs.from, fs.to] : App.range(fs.per);
  const sum = (rows, kind) => rows.filter(r => r.kind === kind).reduce((a, r) => a + r.usd, 0);

  const data = () => {
    const r = span(), period = App.ledger().filter(x => App.inRange(x.date, r) && (fs.stock || x.type !== 'Achat stock'));
    const byMode = {}; period.forEach(x => { const o = byMode[x.mode] = byMode[x.mode] || { in: 0, out: 0 }; o[x.kind] += x.usd; });
    const inMode = period.filter(x => fs.mode === 'all' || x.mode === fs.mode);
    const byCur = {}; inMode.forEach(x => { const o = byCur[x.cur] = byCur[x.cur] || { in: 0, out: 0 }; o[x.kind] += x.amt; });
    return { r, period, byMode, inMode, byCur, list: inMode.filter(x => fs.kind === 'all' || x.kind === fs.kind) };
  };

  App.views.finance = () => {
    const d = data(), F = x => App.fmt(x), cin = sum(d.inMode, 'in'), cout = sum(d.inMode, 'out'), net = cin - cout;
    const chips = (act, cur, items) => `<div class="chips">${items.map(([k, t]) => `<button class="chip ${cur === k ? 'on' : ''}" data-act="${act}" data-v="${esc(k)}">${esc(t)}</button>`).join('')}</div>`;
    const modes = Object.keys(d.byMode).sort();
    const byDay = []; d.list.slice(0, 1000).forEach(x => { const g = byDay[byDay.length - 1]; if (g && g.date === x.date) g.rows.push(x); else byDay.push({ date: x.date, rows: [x] }); });
    const sgn = x => (x.kind === 'in' ? '+' : '−');
    return {
      title: 'Finance', sub: `${App.fdate(d.r[0])} → ${App.fdate(d.r[1])}`, back: 'more', nav: 'finance',
      html: `<div class="noprint">${chips('fin_per', fs.per, [['day', "Aujourd'hui"], ['week', 'Cette semaine'], ['month', 'Ce mois'], ['year', 'Cette année'], ['custom', 'Personnalisée']])}${fs.per === 'custom' ? `<div class="row"><div class="fld"><label class="l">Du</label><input type="date" id="fin_from" value="${fs.from}"></div><div class="fld"><label class="l">Au</label><input type="date" id="fin_to" value="${fs.to}"></div></div>` : ''}</div>
        <div class="grid"><button class="stat tap ${fs.kind === 'in' ? 'on' : ''}" data-act="fin_show" data-v="in"><small>⬇ Entrées</small><b class="ok">${F(cin)}</b><small>${d.inMode.filter(x => x.kind === 'in').length} mouvement(s) · touchez pour voir</small></button><button class="stat tap ${fs.kind === 'out' ? 'on' : ''}" data-act="fin_show" data-v="out"><small>⬆ Sorties</small><b class="bad">${F(cout)}</b><small>${d.inMode.filter(x => x.kind === 'out').length} mouvement(s) · touchez pour voir</small></button><button class="stat tap ${fs.kind === 'all' ? 'on' : ''}" data-act="fin_show" data-v="all"><small>Solde de la période</small><b class="${net >= 0 ? 'ok' : 'bad'}">${F(net)}</b><small>tous les mouvements</small></button></div>
        ${splitCard(d.r)}
        ${caisseCard()}
        ${modes.length ? `<h2 class="sec">Par mode de paiement</h2><div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th style="text-align:left;padding:8px 10px;color:var(--mut);font-size:12px">Mode</th><th style="text-align:right;padding:8px 10px;color:var(--mut);font-size:12px">Entrées</th><th style="text-align:right;padding:8px 10px;color:var(--mut);font-size:12px">Sorties</th><th style="text-align:right;padding:8px 10px;color:var(--mut);font-size:12px">Solde</th></tr></thead><tbody>${modes.map(m => { const o = d.byMode[m]; return `<tr><td style="padding:8px 10px;border-top:1px solid var(--line)">${esc(m)}</td><td style="padding:8px 10px;border-top:1px solid var(--line);text-align:right;white-space:nowrap" class="ok">${F(o.in)}</td><td style="padding:8px 10px;border-top:1px solid var(--line);text-align:right;white-space:nowrap" class="bad">${F(o.out)}</td><td style="padding:8px 10px;border-top:1px solid var(--line);text-align:right;white-space:nowrap"><b>${F(o.in - o.out)}</b></td></tr>`; }).join('')}</tbody></table></div>` : ''}
        ${Object.keys(d.byCur).length > 1 || d.byCur.CDF ? `<h2 class="sec">Par devise (montants réellement encaissés / payés)</h2><div class="list">${Object.entries(d.byCur).map(([c, o]) => `<div class="item"><div class="grow"><b>${c === 'CDF' ? 'Francs congolais' : 'Dollars'}</b><small>Entrées ${App.fmt(o.in, c)} · Sorties ${App.fmt(o.out, c)}</small></div><b class="${o.in - o.out >= 0 ? 'ok' : 'bad'}">${App.fmt(o.in - o.out, c)}</b></div>`).join('')}</div>` : ''}
        <h2 class="sec noprint" id="fin_list">Mouvements${fs.kind === 'in' ? ' · entrées' : fs.kind === 'out' ? ' · sorties' : ''}</h2>
        <div class="noprint">${chips('fin_kind', fs.kind, [['all', 'Tout'], ['in', 'Entrées'], ['out', 'Sorties']])}${chips('fin_mode', fs.mode, [['all', 'Tous les modes'], ...modes.map(m => [m, m])])}
        <label class="l" style="margin:0 0 8px"><input type="checkbox" id="fin_stock" ${fs.stock ? 'checked' : ''} style="width:auto"> Inclure les achats de stock (sorties de caisse, hors dépenses du bénéfice)</label></div>
        ${byDay.length ? byDay.map(g => { const dn = sum(g.rows, 'in') - sum(g.rows, 'out'); return `<h2 class="sec" style="font-size:14px">${App.fdate(g.date)}<span class="more" style="color:var(--mut)">${dn >= 0 ? '+' : '−'}${F(Math.abs(dn))}</span></h2><div class="list">${g.rows.map(x => `<${x.go ? 'button' : 'div'} class="item"${x.go ? ` data-act="go" data-v="${x.go[0]}"${x.go[1] ? ` data-id="${x.go[1]}"` : ''}` : ''}><span class="avatar ${x.kind === 'in' ? 'ok' : 'bad'}">${x.kind === 'in' ? '⬇' : '⬆'}</span><div class="grow"><b>${esc(x.label)}</b><small>${esc([x.who, x.mode !== NOMODE ? x.mode : '', x.ref].filter(Boolean).join(' · '))}</small></div><div class="end"><b class="${x.kind === 'in' ? 'ok' : 'bad'}">${sgn(x)}${App.fmt(x.amt, x.cur)}</b>${x.cur !== 'USD' ? `<span class="mut">≈ ${F(x.usd)}</span>` : ''}</div></${x.go ? 'button' : 'div'}>`).join('')}</div>`; }).join('') + (d.list.length > 250 ? `<p class="mut">250 mouvements affichés sur ${d.list.length} : réduisez la période ou exportez.</p>` : '') : '<div class="empty">Aucun mouvement sur cette période.</div>'}
        <div class="bar noprint" style="margin-top:14px"><button class="btn sec" data-act="fin_csv">⬇ Exporter CSV</button><button class="btn sec" data-act="fin_print">🖨️ Imprimer</button><button class="btn sec" data-act="newexp">+ Dépense</button><button class="btn sec" data-act="newpay">+ Paiement</button></div>`,
      after: () => {
        ['fin_from', 'fin_to'].forEach(id => { if ($(id)) $(id).onchange = () => { fs.from = $('fin_from').value || fs.from; fs.to = $('fin_to').value || fs.to; App.refresh(); }; });
        if ($('fin_sub')) $('fin_sub').onchange = () => { App.db.settings.subFromCash = $('fin_sub').checked; App.save(); App.refresh(); };
        if ($('fin_inst')) $('fin_inst').onchange = () => { App.db.settings.instFromCash = $('fin_inst').checked; App.save(); App.refresh(); };
        if ($('fin_stock')) $('fin_stock').onchange = () => { fs.stock = $('fin_stock').checked; App.refresh(); };
      }
    };
  };
  App.actions.fin_per = d => { fs.per = d.v; App.refresh(); };
  App.actions.fin_show = d => { fs.kind = d.v; App.refresh(); const el = $('fin_list'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  App.actions.fin_kind = d => { fs.kind = d.v; App.refresh(); };
  App.actions.fin_mode = d => { fs.mode = d.v; App.refresh(); };
  App.actions.fin_print = () => window.print();
  App.actions.fin_csv = () => {
    const d = data(); App.download(`cispolstore-finance-${d.r[0]}_${d.r[1]}.csv`, App.csv([['Date', 'Sens', 'Type', 'Libellé', 'Client / Catégorie', 'Mode', 'Référence', 'Devise', 'Montant', 'Équivalent $'], ...d.list.map(x => [x.date, x.kind === 'in' ? 'Entrée' : 'Sortie', x.type, x.label, x.who, x.mode, x.ref, x.cur, x.kind === 'in' ? x.amt : -x.amt, Math.round((x.kind === 'in' ? x.usd : -x.usd) * 100) / 100])]), 'text/csv');
  };
})();
