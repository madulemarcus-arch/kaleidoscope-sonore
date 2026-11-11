// Subscriptions / recurring (module « Abonnements »): the user names them as they like (abonnement, contrat, formule, inscription…).
// Period + grace → automatic status (actif / en sursis / inactif), renewal with invoice, calendar of due dates, WhatsApp reminders,
// and an optional cost paid back to an external supplier (margin = price − cost) with a « Dû aux fournisseurs » ledger (dues, payments, advances).
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money, A = App.sales, C = App.clients, F = App.fin, norm = C.norm, db = () => App.db;
  const B = App.subs = {};
  B.get = id => db().subs.find(s => s.id === id);
  B.end = s => s.periods.length ? s.periods[s.periods.length - 1].end : s.start;
  B.status = s => { if (s.cancelled) return ['Résilié', 'bad']; const t = App.today(), e = B.end(s); return t <= e ? ['Actif', 'ok'] : t <= App.addDays(e, s.grace) ? ['En sursis', 'warn'] : ['Inactif', 'bad']; };
  B.daysLeft = s => App.diff(App.today(), B.end(s));
  B.margin = s => s.supplierId ? M.round(s.price - (s.cost || 0), s.currency) : null;
  const cname = s => { const c = C.get(s.clientId); return c ? c.name : 'Client de passage'; };
  const delai = n => n === 0 ? 'aujourd\'hui' : n > 0 ? 'dans ' + n + ' jour' + (n > 1 ? 's' : '') : 'dépassé de ' + (-n) + ' jour' + (-n > 1 ? 's' : '');

  // ---------- supplier ledger (« Dû au fournisseur ») ----------
  const L = App.ledger = {};
  L.balance = id => M.round(db().ledger.filter(e => e.supplierId === id).reduce((a, e) => a + F.toMain(e.amount, e.currency, e.rate) * (e.kind === 'due' ? 1 : -1), 0), db().settings.currency);
  L.addDue = (supplierId, amount, cur, ref, subId) => { if (supplierId && amount > 0) db().ledger.push({ id: App.uid(), supplierId, date: App.today(), kind: 'due', amount, currency: cur, rate: db().settings.rate, ref: ref || '', subId: subId || '', note: '' }); };
  // paying a supplier (or advancing money) is also cash out: it appears in the journal as an expense
  L.pay = (supplierId, kind, amount, cur, rate, mode, date, note) => {
    const exp = { id: App.uid(), at: Date.now(), amount, currency: cur, rate: cur === db().settings.currency ? db().settings.rate : rate, category: kind === 'advance' ? 'Avance fournisseur' : 'Reversement fournisseur', mode, supplierId, date, note: note || '' };
    if (!F.cats().includes(exp.category)) F.cats().push(exp.category); db().expenses.push(exp);
    db().ledger.push({ id: App.uid(), supplierId, date, kind, amount, currency: cur, rate: exp.rate, ref: '', subId: '', note: note || '', expenseId: exp.id }); App.log('ledger.' + kind, amount + ' ' + cur); App.save();
  };
  L.form = (supplierId, kind) => {
    const s = db().settings, sp = App.stock.supplier(supplierId), adv = kind === 'advance';
    ui.sheet({ title: (adv ? 'Avance à ' : 'Reversement à ') + (sp ? sp.name : ''), html: '<p class="muted">Dû actuel : <b>' + M.main(L.balance(supplierId)) + '</b></p><div class="row2">' + ui.field('Montant *', ui.input('amount', adv ? '' : Math.max(L.balance(supplierId), 0) || '', { num: 1 })) + ui.field('Devise', ui.select('currency', [s.currency, s.cur2], s.currency)) + '</div><div class="row2">' + ui.field('Taux', ui.input('rate', s.rate, { num: 1 })) + ui.field('Mode', ui.select('mode', s.modes, s.modes[0])) + '</div>' + ui.field('Date', ui.dateField('date')) + ui.field('Note', ui.input('note', '')),
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: sh => { const f = ui.read(sh.body); if (!(f.amount > 0)) { App.toast('Montant invalide', 'err'); return false; } L.pay(supplierId, kind, f.amount, f.currency, f.rate, f.mode, f.date, f.note); App.toast('Enregistré'); App.render(); } }] });
  };
  L.profile = id => {
    const sp = App.stock.supplier(id); if (!sp) return; const l = db().ledger.filter(e => e.supplierId === id).sort((a, b) => b.date.localeCompare(a.date)), bal = L.balance(id), lab = { due: 'À reverser', paid: 'Reversé', advance: 'Avance' };
    ui.sheet({ title: sp.name + ' — dû', wide: true, html: '<div class="stats"><div class="' + (bal > 0 ? 'bad' : '') + '"><b>' + M.main(bal) + '</b><small>' + (bal < 0 ? 'avance restante' : 'à reverser') + '</small></div><div><b>' + M.main(l.filter(e => e.kind === 'due').reduce((a, e) => a + F.toMain(e.amount, e.currency, e.rate), 0)) + '</b><small>total dû</small></div><div><b>' + M.main(l.filter(e => e.kind !== 'due').reduce((a, e) => a + F.toMain(e.amount, e.currency, e.rate), 0)) + '</b><small>déjà versé</small></div></div>' + (l.length ? '<div class="list">' + l.map(e => '<div class="item"><span class="tx"><b>' + lab[e.kind] + '</b><small>' + App.fmtDate(e.date) + (e.ref ? ' · ' + esc(e.ref) : '') + (e.note ? ' · ' + esc(e.note) : '') + '</small></span><span class="end"><b style="color:var(--' + (e.kind === 'due' ? 'bad' : 'ok') + ')">' + (e.kind === 'due' ? '+' : '−') + M.fmt(e.amount, e.currency) + '</b></span></div>').join('') + '</div>' : '<p class="muted">Aucun mouvement.</p>'),
      actions: [{ label: 'Avance', cls: 'ghost', fn: () => { setTimeout(() => L.form(id, 'advance'), 200); } }, { label: 'Reverser', cls: 'primary', fn: () => { setTimeout(() => L.form(id, 'paid'), 200); } }] });
  };
  // the supplier profile (stock module) shows what is owed
  App.suppliers.extras.push(s => { const n = db().ledger.filter(e => e.supplierId === s.id).length; return n ? '<div class="card"><b>Dû : ' + M.main(L.balance(s.id)) + '</b> <button class="btn sm ghost" data-ledger="' + s.id + '">Détail</button></div>' : ''; });
  document.addEventListener('click', e => { const b = e.target.closest('[data-ledger]'); if (b) L.profile(b.dataset.ledger); });

  // ---------- creation and renewal ----------
  const invoiceFor = (s, from, to, paid, mode) => A.createInvoice({ clientId: s.clientId, currency: s.currency, rate: s.rate, lines: [{ desc: s.name + ' — du ' + App.fmtDate(from) + ' au ' + App.fmtDate(to), qty: 1, price: s.price, cost: s.supplierId ? F.toMain(s.cost || 0, s.currency, s.rate) : 0 }], paid, mode, source: 'subscription' });
  B.addPeriod = (s, start, billing) => {
    const end = App.addDays(start, s.days - 1), p = { start, end, invoiceId: '', amount: s.price }; s.periods.push(p);
    if (billing) { const inv = invoiceFor(s, start, end, billing.paid, billing.mode); p.invoiceId = inv.id; }
    if (s.supplierId && s.cost > 0) L.addDue(s.supplierId, s.cost, s.currency, s.name + ' ' + App.fmtDate(start), s.id); return p;
  };
  B.form = id => {
    const s = id ? B.get(id) : null, st = db().settings, names = [...new Set(db().subs.map(x => x.name))];
    const sup = [['', '— Aucun —'], ...db().suppliers.map(x => [x.id, x.name])];
    const sh = ui.sheet({ title: s ? 'Modifier — ' + s.name : 'Nouveau ' + App.vocab('sub'), wide: true,
      html: ui.field(App.cap(App.vocab('client')), ui.select('clientId', C.options('— Choisir —'), s ? s.clientId : '')) + ui.field('Formule / libellé *', '<input name="name" list="dl-sn" value="' + esc(s ? s.name : '') + '" placeholder="Ex. Forfait mensuel"><datalist id="dl-sn">' + names.map(n => '<option value="' + esc(n) + '">').join('') + '</datalist>') +
        '<div class="row2">' + ui.field('Prix par période *', ui.input('price', s ? s.price : '', { num: 1 })) + ui.field('Devise', ui.select('currency', [st.currency, st.cur2], s ? s.currency : st.currency)) + '</div><div class="row2">' + ui.field('Durée d\'une période (jours)', ui.input('days', s ? s.days : st.subDays, { num: 1 })) + ui.field('Sursis (jours)', ui.input('grace', s ? s.grace : st.subGrace, { num: 1 })) + '</div>' + (s ? '' : ui.field('Début', ui.dateField('start'))) +
        '<div class="card"><b>Fournisseur externe (facultatif)</b><p class="muted">Si une partie du prix est reversée à un partenaire : la marge et le dû sont calculés tout seuls.</p><div class="row2">' + ui.field('Fournisseur', ui.select('supplierId', sup, s ? s.supplierId : '')) + ui.field('Coût reversé par période', ui.input('cost', s ? s.cost : '', { num: 1 })) + '</div></div>' +
        (s ? '' : '<label class="mod"><input type="checkbox" name="bill" checked><span><b>Créer la facture de la 1re période</b></span></label><div class="row2">' + ui.field('Payé maintenant', ui.input('paid', '', { num: 1 })) + ui.field('Mode', ui.select('mode', st.modes, st.modes[0])) + '</div>') + ui.field('Note', ui.input('note', s && s.note)),
      actions: [...(s && App.can('delete') ? [{ label: 'Supprimer', cls: 'danger', fn: async x => { if (await ui.confirm('Supprimer cet ' + App.vocab('sub') + ' ? Les factures restent.', 'Supprimer', true)) { db().subs = db().subs.filter(y => y.id !== s.id); App.save(); x.close(); App.render(); } return false; } }] : []), { label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: x => {
        const f = ui.read(x.body); if (!f.name || !(f.price > 0)) { App.toast('Libellé et prix obligatoires', 'err'); return false; } if (!(f.days >= 1)) { App.toast('Durée invalide', 'err'); return false; } if (f.supplierId && !(f.cost > 0)) { App.toast('Indiquez le coût reversé au fournisseur', 'err'); return false; }
        const rec = { clientId: f.clientId, name: f.name, price: f.price, currency: f.currency, rate: st.rate, days: Math.round(f.days), grace: Math.max(0, Math.round(f.grace || 0)), supplierId: f.supplierId, cost: f.supplierId ? f.cost : 0, note: f.note };
        if (s) Object.assign(s, rec); else { const n = { id: App.uid(), start: f.start, periods: [], cancelled: false, created: App.today(), ...rec }; db().subs.push(n); B.addPeriod(n, f.start, f.bill ? { paid: f.paid, mode: f.mode } : null); }
        App.log(s ? 'sub.edit' : 'sub.add', f.name); App.save(); App.toast('Enregistré'); App.render();
      } }] });
  };
  B.renew = id => {
    const s = B.get(id); if (!s) return; const [stl] = B.status(s), start = stl === 'Inactif' || stl === 'Résilié' ? App.today() : App.addDays(B.end(s), 1), end = App.addDays(start, s.days - 1), st = db().settings;
    ui.sheet({ title: 'Renouveler — ' + s.name, html: '<p>Nouvelle période : du <b>' + App.fmtDate(start) + '</b> au <b>' + App.fmtDate(end) + '</b> · ' + M.fmt(s.price, s.currency) + (s.supplierId ? ' · à reverser ' + M.fmt(s.cost, s.currency) : '') + '</p><label class="mod"><input type="checkbox" name="bill" checked><span><b>Créer la facture</b></span></label><div class="row2">' + ui.field('Payé maintenant', ui.input('paid', '', { num: 1 })) + ui.field('Mode', ui.select('mode', st.modes, st.modes[0])) + '</div>',
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Renouveler', cls: 'primary', fn: x => { const f = ui.read(x.body); s.cancelled = false; B.addPeriod(s, start, f.bill ? { paid: f.paid, mode: f.mode } : null); App.log('sub.renew', s.name); App.save(); App.toast('Renouvelé jusqu\'au ' + App.fmtDate(end)); App.render(); } }] });
  };
  // ---------- reminders ----------
  B.text = s => { const c = C.get(s.clientId); return A.msg(db().settings.msgs.sub, { nom: c ? c.name : '', abonnement: App.vocab('sub'), formule: s.name, date: App.fmtDate(B.end(s)), delai: delai(B.daysLeft(s)), montant: M.fmt(s.price, s.currency), entreprise: db().settings.name }); };
  B.remind = s => { const c = C.get(s.clientId); window.open('https://wa.me/' + (c && c.phone ? C.intl(c.phone) : '') + '?text=' + encodeURIComponent(B.text(s)), '_blank', 'noopener'); s.lastRemind = App.today(); App.log('sub.remind', s.name); App.save(); };
  B.queue = () => db().subs.filter(s => !s.cancelled && B.daysLeft(s) <= 3 && B.daysLeft(s) >= -db().settings.subGrace && s.lastRemind !== App.today() && (C.get(s.clientId) || {}).phone);

  // ---------- screen: Abonnés | Échéances | Dû aux fournisseurs ----------
  const st = { tab: 'list', f: 'all', q: '' };
  const row = s => { const [l, c] = B.status(s), d = B.daysLeft(s); return '<div class="swr" style="--n:0"><div class="item" data-id="' + s.id + '" role="button" tabindex="0"><span class="av">' + esc(App.letterOf(cname(s))) + '</span><span class="tx"><b>' + esc(cname(s)) + '</b><small>' + esc(s.name) + ' · fin ' + App.fmtDate(B.end(s)) + ' (' + esc(delai(d)) + ')</small></span><span class="end"><b>' + M.fmt(s.price, s.currency) + '</b><span class="pill ' + c + '">' + l + '</span></span></div></div>'; };
  B.profile = id => {
    const s = B.get(id); if (!s) return; const [l, c] = B.status(s), m = B.margin(s), sp = App.stock.supplier(s.supplierId);
    const sh = ui.sheet({ title: s.name, wide: true, html: '<p><span class="pill ' + c + '">' + l + '</span> ' + esc(cname(s)) + '</p><div class="stats"><div><b>' + M.fmt(s.price, s.currency) + '</b><small>/ ' + s.days + ' j</small></div><div><b>' + App.fmtDate(B.end(s)) + '</b><small>fin</small></div><div><b>' + (m == null ? '—' : M.fmt(m, s.currency)) + '</b><small>marge</small></div></div>' + (sp ? '<p class="muted">Fournisseur : ' + esc(sp.name) + ' · reversé ' + M.fmt(s.cost, s.currency) + ' par période</p>' : '') + '<h4>Périodes</h4><div class="list">' + s.periods.slice().reverse().map(p => { const i = p.invoiceId && A.get(p.invoiceId); return '<div class="item"><span class="tx"><b>' + App.fmtDate(p.start) + ' → ' + App.fmtDate(p.end) + '</b><small>' + (i ? esc(i.number) + ' · ' + A.status(i)[0] : 'sans facture') + '</small></span></div>'; }).join('') + '</div>',
      actions: [{ label: s.cancelled ? 'Réactiver' : 'Résilier', cls: 'ghost', fn: () => { s.cancelled = !s.cancelled; App.log('sub.cancel', s.name); App.save(); App.render(); } }, { label: 'Modifier', cls: 'ghost', fn: () => { setTimeout(() => B.form(id), 200); } }, ...(C.get(s.clientId) && C.get(s.clientId).phone ? [{ label: '💬 Rappel', cls: 'ghost', fn: () => { B.remind(s); return false; } }] : []), { label: 'Renouveler', cls: 'primary', fn: () => { setTimeout(() => B.renew(id), 200); } }] });
  };
  const tabList = tab => {
    const q = norm(st.q), F2 = { all: ['Tous', () => true], ok: ['Actifs', s => B.status(s)[0] === 'Actif'], warn: ['En sursis', s => B.status(s)[0] === 'En sursis'], bad: ['Inactifs', s => ['Inactif', 'Résilié'].includes(B.status(s)[0])] };
    const l = db().subs.filter(s => F2[st.f][1](s) && (!q || norm(cname(s) + ' ' + s.name).includes(q))).sort((a, b) => B.end(a).localeCompare(B.end(b))), rem = B.queue().length, act = db().subs.filter(s => B.status(s)[0] === 'Actif');
    tab.innerHTML = '<div class="stats card"><div><b>' + act.length + '</b><small>actifs</small></div><div><b>' + M.main(act.reduce((a, s) => a + F.toMain(s.price, s.currency, s.rate) * 30 / s.days, 0)) + '</b><small>revenu / mois</small></div><div class="' + (db().subs.some(s => B.status(s)[0] === 'En sursis') ? 'bad' : '') + '"><b>' + db().subs.filter(s => B.status(s)[0] === 'En sursis').length + '</b><small>en sursis</small></div></div><div class="tools"><input type="search" id="bq" placeholder="Rechercher" value="' + esc(st.q) + '"><button class="btn primary" id="bn">+ ' + esc(App.cap(App.vocab('sub'))) + '</button></div><div class="chips">' + Object.entries(F2).map(([k, v]) => '<button data-f="' + k + '" class="' + (st.f === k ? 'on' : '') + '">' + v[0] + '</button>').join('') + '</div>' + (rem ? '<button class="btn ghost" id="brs">💬 Rappels du jour (' + rem + ')</button>' : '') + (l.length ? '<div class="list">' + l.map(row).join('') + '</div>' : '<div class="empty"><div class="big">🔁</div><h2>Aucun ' + esc(App.vocab('sub')) + '</h2></div>');
    const bq = tab.querySelector('#bq'); bq.oninput = () => { st.q = bq.value; const p = bq.selectionStart; tabList(tab); const n = tab.querySelector('#bq'); n.focus(); n.setSelectionRange(p, p); };
    tab.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { st.f = b.dataset.f; tabList(tab); }); tab.querySelector('#bn').onclick = () => B.form(); tab.querySelectorAll('.item[data-id]').forEach(i => i.onclick = () => B.profile(i.dataset.id));
    const rs = tab.querySelector('#brs'); rs && (rs.onclick = () => { const ids = B.queue().map(s => s.id); let k = 0, sh; const show = () => { const s = B.get(ids[k]); sh.body.innerHTML = '<p class="muted">' + (k + 1) + ' sur ' + ids.length + '</p><h3>' + esc(cname(s)) + '</h3><div class="card" style="white-space:pre-wrap">' + esc(B.text(s)) + '</div><div class="tools"><button class="btn primary" id="go">💬 Ouvrir WhatsApp</button><button class="btn ghost" id="skip">Passer</button></div>'; sh.body.querySelector('#go').onclick = () => { B.remind(s); next(); }; sh.body.querySelector('#skip').onclick = next; }, next = () => { k++; if (k >= ids.length) { sh.close(); App.render(); } else show(); }; sh = ui.sheet({ title: 'Rappels du jour', wide: true, html: '' }); show(); });
  };
  const tabCal = tab => {
    const l = db().subs.filter(s => !s.cancelled).sort((a, b) => B.end(a).localeCompare(B.end(b))), groups = {};
    l.forEach(s => { const d = B.daysLeft(s), k = d < 0 ? 'En retard' : d === 0 ? 'Aujourd\'hui' : d <= 7 ? 'Cette semaine' : d <= 30 ? 'Ce mois' : 'Plus tard'; (groups[k] = groups[k] || []).push(s); });
    tab.innerHTML = l.length ? ['En retard', 'Aujourd\'hui', 'Cette semaine', 'Ce mois', 'Plus tard'].filter(k => groups[k]).map(k => '<h4>' + k + ' (' + groups[k].length + ')</h4><div class="list">' + groups[k].map(row).join('') + '</div>').join('') : '<p class="muted">Aucune échéance.</p>';
    tab.querySelectorAll('.item[data-id]').forEach(i => i.onclick = () => B.profile(i.dataset.id));
  };
  const tabDue = tab => {
    const ids = [...new Set(db().ledger.map(e => e.supplierId))], rows = ids.map(id => ({ id, sp: App.stock.supplier(id), bal: L.balance(id) })).filter(r => r.sp).sort((a, b) => b.bal - a.bal), tot = rows.reduce((a, r) => a + Math.max(r.bal, 0), 0);
    tab.innerHTML = '<div class="card"><b>Total à reverser : ' + M.main(tot) + '</b></div>' + (rows.length ? '<div class="list">' + rows.map(r => '<div class="swr" style="--n:0"><div class="item" data-sp="' + r.id + '" role="button" tabindex="0"><span class="av">' + esc(App.letterOf(r.sp.name)) + '</span><span class="tx"><b>' + esc(r.sp.name) + '</b><small>' + (r.bal < 0 ? 'avance restante' : 'à reverser') + '</small></span><span class="end"><b style="color:var(--' + (r.bal > 0 ? 'bad' : 'ok') + ')">' + M.main(Math.abs(r.bal)) + '</b></span></div></div>').join('') + '</div>' : '<div class="empty"><div class="big">🤝</div><h2>Rien à reverser</h2><p class="muted">Indiquez un fournisseur et un coût sur un ' + esc(App.vocab('sub')) + ' : le dû se calcule à chaque période.</p></div>');
    tab.querySelectorAll('[data-sp]').forEach(i => i.onclick = () => L.profile(i.dataset.sp));
  };
  App.views.subs = { title: 'Abonnements', render(el, params) {
    if (params && params.tab) st.tab = params.tab; const tabs = { list: App.cap(App.vocab('sub', true)), cal: 'Échéances', due: 'Dû fournisseurs' };
    el.innerHTML = '<div class="page"><div class="seg" id="btabs">' + Object.entries(tabs).map(([k, l]) => '<button data-t="' + k + '" class="' + (st.tab === k ? 'on' : '') + '">' + esc(l) + '</button>').join('') + '</div><div id="bt"></div></div>';
    el.querySelectorAll('#btabs button').forEach(b => b.onclick = () => { st.tab = b.dataset.t; App.views.subs.render(el); }); (st.tab === 'cal' ? tabCal : st.tab === 'due' ? tabDue : tabList)(el.querySelector('#bt')); if (params && params.add) B.form();
  } };
  App.quick.push({ label: () => 'Nouvel ' + App.vocab('sub'), mod: 'subs', run: () => { App.go('subs'); setTimeout(() => B.form(), 30); } });
  const wrap = (o, fn, perm) => { const f = o[fn]; o[fn] = function () { if (!App.can(perm)) { App.toast('Action non autorisée pour votre profil', 'err'); return; } return f.apply(this, arguments); }; };
  App.ready.then(() => { wrap(B, 'form', 'sell'); wrap(B, 'renew', 'sell'); wrap(L, 'form', 'pay'); });
})();
