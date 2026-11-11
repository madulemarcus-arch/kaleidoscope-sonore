// Finance: expenses, journal of money in / out (by mode and currency), period helpers, charts. The "Argent" screen hosts Journal | Dépenses | Rapports.
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money, A = App.sales, C = App.clients, norm = C.norm, db = () => App.db;
  const F = App.fin = { tabs: {} };
  F.cashMode = () => db().settings.modes[0];
  F.toMain = (amount, cur, rate) => cur === db().settings.currency ? amount : M.convert(amount, cur, db().settings.currency, rate || db().settings.rate);
  F.at = x => x.at || Date.parse((x.date || '1970-01-01') + 'T12:00:00');

  // ---------- periods ----------
  F.range = key => {
    const t = App.today(), d = new Date(), y = d.getFullYear(), mo = d.getMonth(), z = n => String(n).padStart(2, '0'), last = (yy, mm) => new Date(yy, mm + 1, 0).getDate();
    if (key === 'today') return { from: t, to: t, label: 'Aujourd\'hui' };
    if (key === 'week') return { from: App.addDays(t, -6), to: t, label: '7 derniers jours' };
    if (key === 'prev') { const p = new Date(y, mo - 1, 1), yy = p.getFullYear(), mm = p.getMonth(); return { from: yy + '-' + z(mm + 1) + '-01', to: yy + '-' + z(mm + 1) + '-' + z(last(yy, mm)), label: 'Mois dernier' }; }
    if (key === 'year') return { from: y + '-01-01', to: t, label: 'Cette année' };
    if (/^\d{4}-\d{2}$/.test(key)) { const [yy, mm] = key.split('-').map(Number); return { from: key + '-01', to: key + '-' + z(last(yy, mm - 1)), label: key }; }
    return { from: y + '-' + z(mo + 1) + '-01', to: t, label: 'Ce mois' };
  };
  F.prevRange = r => { const n = App.diff(r.from, r.to) + 1; return { from: App.addDays(r.from, -n), to: App.addDays(r.from, -1) }; }; // same length, right before
  F.inR = (date, r) => date >= r.from && date <= r.to;
  F.RANGES = [['today', 'Aujourd\'hui'], ['week', '7 jours'], ['month', 'Ce mois'], ['prev', 'Mois dernier'], ['year', 'Année']];

  // ---------- data ----------
  F.cats = () => db().settings.expenseCats;
  F.entries = r => {
    const out = [];
    db().payments.filter(p => F.inR(p.date, r)).forEach(p => { const i = A.get(p.invoiceId); out.push({ k: 'in', t: 'payment', id: p.id, date: p.date, at: F.at(p), amount: p.amount, cur: p.currency, rate: p.rate, mode: p.mode, label: 'Paiement ' + (i ? i.number + ' · ' + A.cname(i) : '') }); });
    db().expenses.filter(e => F.inR(e.date, r)).forEach(e => out.push({ k: 'out', t: 'expense', id: e.id, date: e.date, at: F.at(e), amount: e.amount, cur: e.currency, rate: e.rate, mode: e.mode, label: e.category + (e.note ? ' · ' + e.note : '') }));
    return out.sort((a, b) => b.at - a.at);
  };
  F.sumMain = list => list.reduce((a, e) => a + F.toMain(e.amount, e.cur, e.rate), 0);
  F.byCur = list => { const o = {}; list.forEach(e => o[e.cur] = (o[e.cur] || 0) + e.amount); return o; };
  F.byMode = list => { const o = {}; list.forEach(e => o[e.mode] = (o[e.mode] || 0) + F.toMain(e.amount, e.cur, e.rate)); return o; };
  F.expensesIn = r => db().expenses.filter(e => F.inR(e.date, r));

  // ---------- SVG bars (no library) ----------
  F.bars = (items, o) => {
    o = o || {}; if (!items.length) return ''; const W = 320, H = 110, max = Math.max(...items.map(i => i.v), 1e-9), bw = W / items.length, g = bw > 14 ? 3 : 1;
    return '<svg viewBox="0 0 ' + W + ' ' + (H + 16) + '" role="img" aria-label="' + esc(o.title || 'Graphique') + '" style="width:100%;height:auto"><defs><linearGradient id="barg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#d5522f"/><stop offset="1" stop-color="#e5b044"/></linearGradient></defs>' + items.map((it, k) => { const h = Math.max(it.v > 0 ? 2 : 0, it.v / max * H); return '<rect class="bar" x="' + (k * bw + g / 2) + '" y="' + (H - h) + '" width="' + Math.max(bw - g, 1) + '" height="' + h + '" rx="2" fill="' + (it.c || 'url(#barg)') + '"><title>' + esc(it.l + ' : ' + (o.fmt ? o.fmt(it.v) : it.v)) + '</title></rect>'; }).join('') + (items.length <= 12 ? items.map((it, k) => '<text x="' + (k * bw + bw / 2) + '" y="' + (H + 12) + '" font-size="9" text-anchor="middle" fill="var(--mut)">' + esc(it.l) + '</text>').join('') : '<text x="0" y="' + (H + 12) + '" font-size="9" fill="var(--mut)">' + esc(items[0].l) + '</text><text x="' + W + '" y="' + (H + 12) + '" font-size="9" text-anchor="end" fill="var(--mut)">' + esc(items[items.length - 1].l) + '</text>') + '</svg>';
  };
  F.perDay = (r, pick) => { const out = [], n = Math.min(App.diff(r.from, r.to) + 1, 62); for (let k = 0; k < n; k++) { const d = App.addDays(r.from, k); out.push({ l: d.slice(8), d, v: 0 }); } pick(out); return out; };

  // ---------- expense form ----------
  F.expenseForm = (id, done) => {
    const e = id ? db().expenses.find(x => x.id === id) : null, s = db().settings, sup = [['', '— Aucun —'], ...db().suppliers.map(x => [x.id, x.name])];
    const sh = ui.sheet({ title: e ? 'Modifier la dépense' : 'Nouvelle dépense', wide: true,
      html: '<div class="row2">' + ui.field('Montant *', ui.input('amount', e ? e.amount : '', { num: 1 })) + ui.field('Devise', ui.select('currency', [s.currency, s.cur2], e ? e.currency : s.currency)) + '</div><div id="xr">' + ui.field('Taux (1 ' + s.currency + ' = ? ' + s.cur2 + ')', ui.input('rate', e ? e.rate : s.rate, { num: 1 })) + '</div>' +
        ui.field('Catégorie', '<input name="category" list="dl-xc" value="' + esc(e ? e.category : F.cats()[0]) + '"><datalist id="dl-xc">' + F.cats().map(c => '<option value="' + esc(c) + '">').join('') + '</datalist>') + '<div class="row2">' + ui.field('Payé par', ui.select('mode', s.modes, e ? e.mode : s.modes[0])) + ui.field('Fournisseur', ui.select('supplierId', sup, e ? e.supplierId : '')) + '</div>' + ui.field('Date', ui.dateField('date', e && e.date)) + ui.field('Note', ui.input('note', e && e.note)),
      actions: [...(e && App.can('delete') ? [{ label: 'Supprimer', cls: 'danger', fn: async s2 => { if (await ui.confirm('Supprimer cette dépense ?', 'Supprimer', true)) { db().expenses = db().expenses.filter(x => x.id !== id); App.log('expense.delete', e.category); App.save(); s2.close(); done ? done() : App.render(); } return false; } }] : []), { label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: s2 => {
        const f = ui.read(s2.body); if (!(f.amount > 0)) { App.toast('Montant invalide', 'err'); return false; } if (f.currency !== s.currency && !(f.rate > 0)) { App.toast('Taux invalide', 'err'); return false; }
        const cat = f.category || F.cats()[0]; if (!F.cats().includes(cat)) F.cats().push(cat);
        const rec = { amount: f.amount, currency: f.currency, rate: f.currency === s.currency ? s.rate : f.rate, category: cat, mode: f.mode, supplierId: f.supplierId, date: f.date, note: f.note };
        if (e) Object.assign(e, rec); else db().expenses.push({ id: App.uid(), at: Date.now(), ...rec });
        App.log(e ? 'expense.edit' : 'expense.add', cat + ' ' + f.amount); App.save(); App.toast('Dépense enregistrée'); done ? done() : App.render();
      } }] });
    const sync = () => { const f = ui.read(sh.body); sh.q('#xr').style.display = f.currency === s.currency ? 'none' : ''; }; sh.body.addEventListener('input', sync); sync();
  };

  // ---------- screen: Journal | Dépenses | Rapports ----------
  const st = { tab: 'journal', r: 'month', cat: '' };
  const rangeChips = () => '<div class="chips">' + F.RANGES.map(([k, l]) => '<button data-r="' + k + '" class="' + (st.r === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div>';
  const curLines = o => Object.entries(o).map(([c, v]) => M.fmt(v, c)).join(' + ') || '—';
  const journal = (tab, el) => {
    const r = F.range(st.r), en = F.entries(r), ins = en.filter(e => e.k === 'in'), outs = en.filter(e => e.k === 'out'), tin = F.sumMain(ins), tout = F.sumMain(outs);
    const bars = F.perDay(r, days => en.forEach(e => { const d = days.find(x => x.d === e.date); if (d) d.v += F.toMain(e.amount, e.cur, e.rate) * (e.k === 'in' ? 1 : 0); }));
    const bm = F.byMode(ins);
    tab.innerHTML = rangeChips() + '<div class="stats card"><div class="' + '"><b style="color:var(--ok)">' + M.main(tin) + '</b><small>entrées</small></div><div><b style="color:var(--bad)">' + M.main(tout) + '</b><small>sorties</small></div><div><b>' + M.main(tin - tout) + '</b><small>solde</small></div></div>' +
      '<div class="card"><small class="muted">Entrées par devise : ' + esc(curLines(F.byCur(ins))) + '<br>Sorties par devise : ' + esc(curLines(F.byCur(outs))) + '</small>' + (Object.keys(bm).length ? '<div>' + Object.entries(bm).map(([m, v]) => '<span class="pill">' + esc(m) + ' ' + M.main(v) + '</span>').join(' ') + '</div>' : '') + F.bars(bars, { title: 'Entrées par jour', fmt: M.main }) + '</div>' +
      (en.length ? '<div class="list">' + en.slice(0, 80).map(e => '<div class="swr" style="--n:0"><div class="item"><span class="av">' + (e.k === 'in' ? '↗' : '↘') + '</span><span class="tx"><b>' + esc(e.label) + '</b><small>' + App.fmtDate(e.date) + ' · ' + esc(e.mode) + '</small></span><span class="end"><b style="color:var(--' + (e.k === 'in' ? 'ok' : 'bad') + ')">' + (e.k === 'in' ? '+' : '−') + M.fmt(e.amount, e.cur) + '</b></span></div></div>').join('') + '</div>' : '<div class="empty"><div class="big">💰</div><h2>Aucun mouvement</h2><p class="muted">Les paiements encaissés et les dépenses apparaissent ici.</p></div>');
  };
  const expenses = (tab, el) => {
    const r = F.range(st.r), l = F.expensesIn(r).filter(e => !st.cat || e.category === st.cat).sort((a, b) => F.at(b) - F.at(a)), tot = F.sumMain(l.map(e => ({ amount: e.amount, cur: e.currency, rate: e.rate })));
    tab.innerHTML = rangeChips() + '<div class="tools"><button class="btn primary" id="nx">+ Dépense</button><select id="xc"><option value="">Toutes catégories</option>' + F.cats().map(c => '<option' + (st.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select></div><div class="card"><b>Total : ' + M.main(tot) + '</b> <small class="muted">≈ ' + M.second(tot) + ' · ' + l.length + ' dépense(s)</small></div>' +
      (l.length ? '<div class="list">' + l.map(e => '<div class="swr" style="--n:0"><div class="item" data-x="' + e.id + '" role="button" tabindex="0"><span class="av">↘</span><span class="tx"><b>' + esc(e.category) + '</b><small>' + App.fmtDate(e.date) + ' · ' + esc(e.mode) + (e.note ? ' · ' + esc(e.note) : '') + '</small></span><span class="end"><b>' + M.fmt(e.amount, e.currency) + '</b></span></div></div>').join('') + '</div>' : '<div class="empty"><div class="big">🧾</div><h2>Aucune dépense</h2></div>');
    tab.querySelector('#nx').onclick = () => F.expenseForm(); tab.querySelector('#xc').onchange = e => { st.cat = e.target.value; expenses(tab, el); }; tab.querySelectorAll('[data-x]').forEach(i => i.onclick = () => F.expenseForm(i.dataset.x));
  };
  App.views.money = {
    title: 'Argent',
    render(el, params) {
      if (params && params.tab) st.tab = params.tab;
      const tabs = { journal: 'Journal', exp: 'Dépenses', ...Object.fromEntries(Object.entries(F.tabs).filter(([k, v]) => !v.perm || App.can(v.perm)).map(([k, v]) => [k, v.label])) }; if (!tabs[st.tab]) st.tab = 'journal';
      el.innerHTML = '<div class="page"><div class="seg" id="mtabs">' + Object.entries(tabs).map(([k, l]) => '<button data-t="' + k + '" class="' + (st.tab === k ? 'on' : '') + '">' + esc(l) + '</button>').join('') + '</div><div id="mt"></div></div>';
      el.querySelectorAll('#mtabs button').forEach(b => b.onclick = () => { st.tab = b.dataset.t; App.views.money.render(el); });
      const tab = el.querySelector('#mt'), draw = () => { (st.tab === 'journal' ? journal : st.tab === 'exp' ? expenses : F.tabs[st.tab].render)(tab, el); tab.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { st.r = b.dataset.r; draw(); }); }; draw();
      if (params && params.add) F.expenseForm();
    }
  };
  App.quick[3].run = () => { App.go('money', { tab: 'exp' }); setTimeout(() => F.expenseForm(), 30); };
  F.state = st; F.rangeChips = rangeChips;
})();
