// Mobile money & bank (module « Mobile money »): deposits, withdrawals, transfers, bill payments, funds in / out and movements between accounts.
// Accounts are cash drawers, e-money wallets (Illico, Airtel, Orange, M-Pesa…) or bank accounts, one currency each. Balances are never stored: they are
// opening balance + the effect (« legs ») of every completed operation, so cancelling or syncing an operation always keeps them right.
// The real income is the fee charged to the client + the commission paid by the operator; the amounts that pass through are not revenue.
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money, A = App.sales, C = App.clients, F = App.fin, norm = C.norm, db = () => App.db;
  const MM = App.mm = {};
  // type → [label, icon, kind]; kind: give = client hands cash in, take = client takes cash out, in / out = funds enter / leave an account, move = between two accounts, adj = reconciliation gap
  MM.TYPES = { deposit: ['Dépôt', '📥', 'give'], send: ['Transfert envoyé', '📤', 'give'], bill: ['Paiement / crédit', '🧾', 'give'], withdraw: ['Retrait', '💵', 'take'], receive: ['Transfert reçu', '📩', 'take'], fundin: ['Entrée de fonds', '➕', 'in'], fundout: ['Sortie de fonds', '➖', 'out'], move: ['Mouvement de fonds', '🔁', 'move'], adjust: ['Ajustement', '⚖️', 'adj'] };
  MM.KINDS = { cash: ['Espèces', '💵'], emoney: ['Mobile money', '📲'], bank: ['Banque', '🏦'] };
  MM.NETS = [['Illico Cash', 'emoney'], ['Airtel Money', 'emoney'], ['Orange Money', 'emoney'], ['M-Pesa', 'emoney'], ['Africell Money', 'emoney'], ['Banque', 'bank'], ['Western Union / MoneyGram', 'emoney']];
  const accs = () => db().mmAccounts, ops = () => db().mmOps, kind = o => MM.TYPES[o.type][2], live = o => o.status === 'Terminé';
  MM.acc = id => accs().find(a => a.id === id);
  MM.get = id => ops().find(o => o.id === id);
  MM.cashAcc = cur => accs().find(a => a.kind === 'cash' && a.currency === cur);
  const aname = id => { const a = MM.acc(id); return a ? a.name : '—'; };

  // ---------- effect of an operation on the accounts: [[accountId, delta], …] ----------
  MM.legs = o => {
    if (!live(o)) return []; const k = kind(o), c = MM.cashAcc(o.currency), cash = c ? c.id : '', amt = o.amount, fee = o.fee || 0, com = o.commission || 0;
    return (k === 'give' ? [[cash, amt + fee], [o.accountId, -amt + com]] : k === 'take' ? [[cash, -amt + fee], [o.accountId, amt + com]] : k === 'in' ? [[o.accountId, amt]] : k === 'out' ? [[o.accountId, -amt]] : k === 'move' ? [[o.accountId, -amt - fee], [o.toId, amt]] : [[o.accountId, amt]]).filter(l => l[0]);
  };
  MM.balance = id => { const a = MM.acc(id); if (!a) return 0; let n = a.opening || 0; ops().forEach(o => MM.legs(o).forEach(([x, d]) => { if (x === id) n += d; })); return M.round(n, a.currency); };
  // cash moved by operations since a time (the drawer count of the Caisse screen adds it to its expected cash)
  MM.cashSince = since => { const r = {}; ops().filter(o => (o.at || 0) > since).forEach(o => MM.legs(o).forEach(([x, d]) => { const a = MM.acc(x); if (a && a.kind === 'cash') r[a.currency] = (r[a.currency] || 0) + d; })); return r; };
  // income of an operation (in its currency): fee + commission; a movement fee is a cost
  MM.gain = o => { if (!live(o)) return 0; const k = kind(o); return k === 'give' || k === 'take' ? (o.fee || 0) + (o.commission || 0) : k === 'move' ? -(o.fee || 0) : 0; };
  MM.main = (o, n) => F.toMain(n, o.currency, o.rate);
  MM.inRange = r => ops().filter(o => F.inR(o.date, r));
  MM.gains = r => MM.inRange(r).reduce((s, o) => s + MM.main(o, MM.gain(o)), 0);
  MM.entries = r => MM.inRange(r).filter(o => MM.gain(o)).map(o => { const g = MM.gain(o); return { k: g > 0 ? 'in' : 'out', t: 'mm', id: o.id, date: o.date, at: o.at, amount: Math.abs(g), cur: o.currency, rate: o.rate, mode: F.cashMode(), label: (g > 0 ? 'Frais et commission ' : 'Frais de mouvement ') + o.number }; });
  MM.totalMain = () => accs().reduce((s, a) => s + F.toMain(MM.balance(a.id), a.currency, db().settings.rate), 0);

  // ---------- fee / commission schedules ----------
  // A schedule is a list of tiers { upTo, v, pct }: the first tier whose upTo is >= the amount applies (upTo 0 = « and above »); v is a fixed amount, or a % of the amount when pct is true.
  MM.tier = (rows, amt) => { const r = rows.slice().sort((x, y) => (x.upTo || Infinity) - (y.upTo || Infinity)).find(x => !x.upTo || amt <= x.upTo); return r ? (r.pct ? amt * r.v / 100 : r.v) : 0; };
  // suggested fee and commission of an operation: the schedule when the account has one (limited to deposits / withdrawals if so chosen), else the simple % and minimum
  MM.suggest = (a, type, amt) => {
    const k = MM.TYPES[type][2]; if (!a || !(amt > 0) || (k !== 'give' && k !== 'take')) return { fee: 0, commission: 0 };
    const use = f => !f || f === 'all' || f === (k === 'give' ? 'give' : 'take'), has = g => g && g.length;
    const fee = has(a.feeGrid) ? (use(a.feeFor) ? MM.tier(a.feeGrid, amt) : 0) : (a.feePct ? Math.max(amt * a.feePct / 100, a.feeMin || 0) : (a.feeMin || 0));
    const com = has(a.commGrid) ? (use(a.commFor) ? MM.tier(a.commGrid, amt) : 0) : (a.commPct ? amt * a.commPct / 100 : 0);
    return { fee: M.round(fee, a.currency), commission: M.round(com, a.currency) };
  };

  // ---------- recording ----------
  MM.addOp = f => {
    const a = MM.acc(f.accountId), t = MM.TYPES[f.type]; if (!a || !t) return null; const k = t[2];
    if (k === 'adj' ? !f.amount : !(f.amount > 0)) return null; if (k === 'move' && (!MM.acc(f.toId) || f.toId === a.id || MM.acc(f.toId).currency !== a.currency)) return null;
    if ((k === 'give' || k === 'take') && !MM.cashAcc(a.currency)) accs().push({ id: App.uid(), name: 'Espèces', kind: 'cash', currency: a.currency, opening: 0 });
    const r = n => M.round(n || 0, a.currency), o = { id: App.uid(), number: A.nextNo('OP', 'op', () => ops()), date: f.date || App.today(), at: Date.now(), type: f.type, accountId: a.id, toId: k === 'move' ? f.toId : '', currency: a.currency, rate: db().settings.rate, amount: r(f.amount), fee: k === 'give' || k === 'take' || k === 'move' ? r(f.fee) : 0, commission: k === 'give' || k === 'take' ? r(f.commission) : 0, party: f.party || '', phone: f.phone || '', ref: f.ref || '', status: f.status || 'Terminé', note: f.note || '', by: App.user ? App.user.name : '' };
    ops().push(o); App.log('mm.' + o.type, o.number + ' ' + M.fmt(o.amount, o.currency)); App.save(); return o;
  };
  MM.setStatus = (o, status) => { o.status = status; if (status === 'Terminé') o.at = Date.now(); App.log('mm.status', o.number + ' ' + status); App.save(); };

  // ---------- receipt / sharing ----------
  const total = o => kind(o) === 'give' ? o.amount + o.fee : o.amount - o.fee;
  MM.receiptText = o => { const s = db().settings, a = MM.acc(o.accountId); return s.name + ' — reçu ' + o.number + '\n' + MM.TYPES[o.type][0] + ' de ' + M.fmt(o.amount, o.currency) + (a ? ' · ' + a.name : '') + (o.fee ? '\nFrais : ' + M.fmt(o.fee, o.currency) : '') + (o.ref ? '\nRéférence : ' + o.ref : '') + '\nLe ' + App.fmtDate(o.date) + '. Merci !'; };
  MM.receipt = o => {
    const k = kind(o), rows = [['Opération', MM.TYPES[o.type][0]], ['Numéro', o.number], ['Date', App.fmtDate(o.date)], ['Compte', aname(o.accountId)], ...(o.ref ? [['Référence', o.ref]] : []), ...(o.party ? [[k === 'take' ? 'Bénéficiaire / expéditeur' : 'Client / bénéficiaire', o.party + (o.phone ? ' · ' + o.phone : '')]] : []), ['Montant', M.fmt(o.amount, o.currency)], ...(o.fee ? [['Frais', M.fmt(o.fee, o.currency)]] : []), ...(k === 'give' || k === 'take' ? [[k === 'give' ? 'Total payé par le client' : 'Remis au client', M.fmt(total(o), o.currency)]] : [])];
    A.printHtml(A.page('Reçu d\'opération', o.number + ' · ' + App.fmtDate(o.date), '<div class="box">' + rows.map(r => '<p><b>' + esc(r[0]) + ' :</b> ' + esc(r[1]) + '</p>').join('') + (k === 'give' || k === 'take' ? '<p>' + esc(M.inWords(total(o), o.currency)) + '</p>' : '') + (o.status !== 'Terminé' ? '<p><b>Statut : ' + esc(o.status) + '</b></p>' : '') + '</div>'));
  };
  const copy = t => { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => App.toast('Copié'), () => App.toast('Copie impossible', 'err')); };

  MM.profile = id => {
    const o = MM.get(id); if (!o) return; const k = kind(o), tone = { 'Terminé': 'ok', 'En attente': 'warn', 'Annulé': 'bad' }[o.status];
    const rows = [['Compte', aname(o.accountId) + (k === 'move' ? ' → ' + aname(o.toId) : '') + ' (' + o.currency + ')'], ['Date', App.fmtDate(o.date)], ...(o.party ? [['Personne', o.party + (o.phone ? ' · ' + o.phone : '')]] : []), ...(o.ref ? [['Référence', o.ref]] : []), ['Montant', M.fmt(o.amount, o.currency)], ...(o.fee ? [[k === 'move' ? 'Frais' : 'Frais perçus', M.fmt(o.fee, o.currency)]] : []), ...(o.commission ? [['Commission opérateur', M.fmt(o.commission, o.currency)]] : []), ...(o.by ? [['Saisi par', o.by]] : []), ...(o.note ? [['Note', o.note]] : [])];
    const sh = ui.sheet({ title: o.number + ' · ' + MM.TYPES[o.type][0], wide: true, html: '<p><span class="pill ' + tone + '">' + esc(o.status) + '</span></p><dl class="kv">' + rows.map(r => '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>').join('') + '</dl>' + (o.status === 'En attente' ? '<p class="muted">En attente : aucun effet sur les fonds tant que l\'opération n\'est pas terminée.</p>' : ''),
      actions: [...(o.status === 'En attente' && App.can('pay') ? [{ label: '✔ Terminer', cls: 'primary', fn: x => { MM.setStatus(o, 'Terminé'); x.close(); App.render(); return false; } }] : []), ...(live(o) && App.can('delete') ? [{ label: 'Annuler l\'opération', cls: 'danger', fn: async x => { if (await ui.confirm('Annuler ' + o.number + ' ? Les fonds sont remis comme avant.', 'Annuler l\'opération', true)) { MM.setStatus(o, 'Annulé'); x.close(); App.render(); } return false; } }] : []), ...(k === 'give' || k === 'take' ? [{ label: '🖨️ Reçu', cls: 'ghost', fn: () => { MM.receipt(o); return false; } }, { label: '💬 WhatsApp', cls: 'ghost', fn: () => { window.open('https://wa.me/' + (o.phone ? C.intl(o.phone) : '') + '?text=' + encodeURIComponent(MM.receiptText(o)), '_blank'); return false; } }] : [])] });
    return sh;
  };

  // ---------- operation form ----------
  MM.form = (type, preAcc) => {
    if (!accs().length) return MM.setup(() => MM.form(type));
    const s = db().settings, types = Object.entries(MM.TYPES).filter(([key, t]) => key !== 'adjust' && App.can(t[2] === 'give' || t[2] === 'take' ? 'pay' : 'cash')); if (!types.length) return App.toast('Action non autorisée pour votre profil', 'err');
    const first = (type && MM.TYPES[type] && types.some(t => t[0] === type)) ? type : types[0][0];
    const sh = ui.sheet({ title: 'Nouvelle opération', wide: true,
      html: ui.field('Type', ui.select('type', types.map(([key, t]) => [key, t[1] + ' ' + t[0]]), first)) + ui.field('Compte', '<select name="accountId"></select>') + '<div data-k="move">' + ui.field('Vers le compte', '<select name="toId"></select>') + '</div>' +
        '<div class="row2">' + ui.field('Montant', ui.input('amount', '', { num: 1 })) + '<span data-k="give take move">' + ui.field('Frais', ui.input('fee', '', { num: 1 }), 'Perçus auprès du client') + '</span></div>' +
        '<div data-k="give take">' + ui.field('Commission de l\'opérateur', ui.input('commission', '', { num: 1 }), 'Créditée sur le compte') + '<div class="row2">' + ui.field('Client / bénéficiaire', ui.input('party', '')) + ui.field('Téléphone', ui.input('phone', '', { tel: 1 })) + '</div></div>' +
        '<div class="row2">' + ui.field('Référence', ui.input('ref', '', { ph: 'N° de transaction' })) + ui.field('Statut', ui.select('status', ['Terminé', 'En attente'], 'Terminé')) + '</div>' + ui.field('Date', ui.dateField('date')) + ui.field('Note', ui.input('note', '')) + '<div id="pv" class="muted"></div>',
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: x => {
        const f = ui.read(x.body), o = MM.addOp({ ...f, amount: f.amount }); if (!o) { App.toast(f.type === 'move' ? 'Choisissez deux comptes différents, de même devise, et un montant' : 'Indiquez un compte et un montant', 'err'); return false; }
        App.toast(o.number + ' enregistrée'); App.render(); if (kind(o) === 'give' || kind(o) === 'take') setTimeout(() => MM.profile(o.id), 250);
      } }] });
    const q = n => sh.q('[name=' + n + ']'), k = () => MM.TYPES[q('type').value][2]; let dirty = {};
    const fillAccs = () => {
      const kk = k(), keep = q('accountId').value, list = accs().filter(a => kk === 'give' || kk === 'take' ? a.kind !== 'cash' : true), opt = a => '<option value="' + a.id + '">' + esc(a.name + ' · ' + a.currency) + '</option>';
      q('accountId').innerHTML = list.map(opt).join(''); q('accountId').value = list.some(a => a.id === keep) ? keep : (preAcc && list.some(a => a.id === preAcc) ? preAcc : (list[0] ? list[0].id : ''));
      const cur = (MM.acc(q('accountId').value) || {}).currency, keepTo = q('toId').value, tos = accs().filter(a => a.currency === cur && a.id !== q('accountId').value);
      q('toId').innerHTML = tos.map(opt).join(''); q('toId').value = tos.some(a => a.id === keepTo) ? keepTo : (tos[0] ? tos[0].id : '');
    };
    const vis = () => sh.el.querySelectorAll('[data-k]').forEach(e => { e.hidden = !e.dataset.k.split(' ').includes(k()); });
    const auto = () => { // suggested fee and commission from the account's schedule or percentages, until the user types their own
      const a = MM.acc(q('accountId').value), amt = parseFloat(String(q('amount').value).replace(',', '.')) || 0; if (!a || kind({ type: q('type').value }) === 'move') return;
      const sg = MM.suggest(a, q('type').value, amt); if (!dirty.fee) q('fee').value = sg.fee || ''; if (!dirty.commission) q('commission').value = sg.commission || '';
    };
    const pv = () => { const f = ui.read(sh.body), a = MM.acc(f.accountId); if (!a || !(f.amount > 0)) { sh.q('#pv').textContent = ''; return; } const tmp = { type: f.type, accountId: a.id, toId: f.toId, currency: a.currency, amount: f.amount, fee: f.fee || 0, commission: f.commission || 0, status: 'Terminé' }; sh.q('#pv').innerHTML = MM.legs(tmp).map(([id, d]) => esc(aname(id)) + ' : <b>' + (d > 0 ? '+' : '') + M.fmt(M.round(d, a.currency), a.currency) + '</b> → ' + M.fmt(MM.balance(id) + d, a.currency)).join('<br>'); };
    sh.body.addEventListener('input', e => { if (e.target.name === 'fee' || e.target.name === 'commission') dirty[e.target.name] = true; if (e.target.name === 'type') { dirty = {}; fillAccs(); vis(); } if (e.target.name === 'accountId') { dirty = {}; fillAccs(); } if (['type', 'accountId', 'amount'].includes(e.target.name)) auto(); pv(); });
    fillAccs(); vis(); auto();
    return sh;
  };

  // ---------- accounts ----------
  MM.setup = done => {
    const s = db().settings, curs = [s.currency, s.cur2];
    const sh = ui.sheet({ title: 'Vos comptes', wide: true, html: '<p class="muted">Cochez les opérateurs et banques avec lesquels vous travaillez. Les espèces sont ajoutées automatiquement. Vous pourrez en ajouter d\'autres, renommer et régler les frais ensuite.</p><div class="mods">' + MM.NETS.map((n, i) => '<label class="mod"><input type="checkbox" data-n="' + i + '"><span><b>' + esc(n[0]) + '</b><small>' + esc(MM.KINDS[n[1]][0]) + '</small></span></label>').join('') + '</div><h4>Devises</h4><div class="mods">' + curs.map((c, i) => '<label class="mod"><input type="checkbox" data-c="' + i + '"' + (i === 0 ? ' checked' : '') + '><span><b>' + esc(c) + '</b></span></label>').join('') + '</div>',
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Créer mes comptes', cls: 'primary', fn: x => {
        const cs = [...x.body.querySelectorAll('[data-c]')].filter(b => b.checked).map(b => curs[+b.dataset.c]), ns = [...x.body.querySelectorAll('[data-n]')].filter(b => b.checked).map(b => MM.NETS[+b.dataset.n]); if (!cs.length) { App.toast('Choisissez au moins une devise', 'err'); return false; }
        cs.forEach(c => { if (!MM.cashAcc(c)) accs().push({ id: App.uid(), name: 'Espèces', kind: 'cash', currency: c, opening: 0 }); ns.forEach(n => { if (!accs().some(a => a.name === n[0] && a.currency === c)) accs().push({ id: App.uid(), name: n[0], kind: n[1], currency: c, opening: 0, feePct: 0, commPct: 0 }); }); });
        App.save(); App.render(); if (done) setTimeout(done, 250);
      } }] });
    return sh;
  };
  // editor of one schedule: rows « jusqu'à / valeur / fixe ou % »
  const gridRow = r => { r = r || {}; return '<div class="gr" style="display:grid;grid-template-columns:1fr 1fr 78px 36px;gap:6px;margin:6px 0"><input data-k="upTo" inputmode="decimal" placeholder="Jusqu\'à" value="' + esc(r.upTo || '') + '"><input data-k="v" inputmode="decimal" placeholder="Valeur" value="' + esc(r.v == null ? '' : r.v) + '"><select data-k="u"><option value="fix"' + (r.pct ? '' : ' selected') + '>Fixe</option><option value="pct"' + (r.pct ? ' selected' : '') + '>%</option></select><button type="button" class="btn ghost" data-del aria-label="Supprimer la tranche">×</button></div>'; };
  const gridBox = (k, title, rows, forWhat) => '<div class="card" data-grid="' + k + '"><h4>' + esc(title) + '</h4><p class="muted">Quand elle est remplie, la grille remplace le pourcentage. Laissez « Jusqu\'à » vide pour la dernière tranche (au-delà).</p>' + ui.field('S\'applique à', ui.select(k + 'For', [['all', 'Toutes les opérations'], ['give', 'Dépôts, envois et paiements'], ['take', 'Retraits et transferts reçus']], forWhat || 'all')) + '<div class="gr-rows">' + (rows || []).map(gridRow).join('') + '</div><button type="button" class="btn ghost" data-add="' + k + '">+ Tranche</button></div>';
  const num = v => parseFloat(String(v).replace(',', '.')) || 0;
  const readGrid = (root, k) => [...root.querySelectorAll('[data-grid=' + k + '] .gr')].filter(r => r.querySelector('[data-k=v]').value.trim() !== '').map(r => ({ upTo: num(r.querySelector('[data-k=upTo]').value), v: num(r.querySelector('[data-k=v]').value), pct: r.querySelector('[data-k=u]').value === 'pct' })).sort((x, y) => (x.upTo || Infinity) - (y.upTo || Infinity));
  MM.accountForm = id => {
    const a = id ? MM.acc(id) : null, s = db().settings, src = a || { kind: 'emoney', currency: s.currency };
    const sh = ui.sheet({ title: a ? 'Modifier ' + a.name : 'Nouveau compte', wide: true, html: ui.field('Nom', ui.input('name', src.name, { ph: 'Ex. Illico Cash' })) + '<div class="row2">' + ui.field('Type', ui.select('kind', Object.entries(MM.KINDS).map(([k, v]) => [k, v[1] + ' ' + v[0]]), src.kind)) + ui.field('Devise', ui.select('currency', [s.currency, s.cur2], src.currency)) + '</div>' + ui.field('Solde de départ', ui.input('opening', src.opening || '', { num: 1 }), 'Ce que contient le compte aujourd\'hui, avant vos opérations') +
        '<div data-fees><div class="row2">' + ui.field('Frais perçus (%)', ui.input('feePct', src.feePct || '', { num: 1 }), 'Proposés à chaque opération') + ui.field('Frais minimum', ui.input('feeMin', src.feeMin || '', { num: 1 })) + '</div>' + ui.field('Commission de l\'opérateur (%)', ui.input('commPct', src.commPct || '', { num: 1 })) + gridBox('fee', 'Grille de frais par tranches', src.feeGrid, src.feeFor) + gridBox('comm', 'Grille de commission par tranches', src.commGrid, src.commFor) + '<div class="card"><b>Essai</b><div class="row2">' + ui.field('Montant', '<input id="gt" inputmode="decimal" placeholder="100">') + '<div id="gtr" class="muted" style="align-self:end"></div></div></div></div>',
      actions: [...(a ? [{ label: 'Supprimer', cls: 'danger', fn: async x => { if (ops().some(o => o.accountId === a.id || o.toId === a.id)) { App.toast('Ce compte a des opérations : il ne peut pas être supprimé', 'err'); return false; } if (await ui.confirm('Supprimer ' + a.name + ' ?', 'Supprimer', true)) { db().mmAccounts = accs().filter(y => y.id !== a.id); App.save(); x.close(); App.render(); } return false; } }] : []), { label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: x => {
        const f = ui.read(x.body); if (!f.name) { App.toast('Donnez un nom au compte', 'err'); return false; }
        if (a && f.currency !== a.currency && ops().some(o => o.accountId === a.id || o.toId === a.id)) { App.toast('La devise ne peut plus changer : le compte a des opérations', 'err'); return false; }
        const rec = { name: f.name, kind: f.kind, currency: f.currency, opening: M.round(f.opening, f.currency), feePct: f.kind === 'cash' ? 0 : f.feePct, feeMin: f.kind === 'cash' ? 0 : f.feeMin, commPct: f.kind === 'cash' ? 0 : f.commPct, feeGrid: f.kind === 'cash' ? [] : readGrid(x.body, 'fee'), feeFor: f.feeFor, commGrid: f.kind === 'cash' ? [] : readGrid(x.body, 'comm'), commFor: f.commFor };
        if (a) Object.assign(a, rec); else accs().push({ id: App.uid(), ...rec }); App.log(a ? 'mm.account.edit' : 'mm.account.add', f.name); App.save(); App.toast('Compte enregistré'); App.render();
      } }] });
    const fees = () => { sh.q('[data-fees]').hidden = sh.q('[name=kind]').value === 'cash'; }; sh.q('[name=kind]').onchange = fees; fees();
    sh.body.addEventListener('click', e => { const ad = e.target.closest('[data-add]'), dl = e.target.closest('[data-del]'); if (ad) sh.q('[data-grid=' + ad.dataset.add + '] .gr-rows').insertAdjacentHTML('beforeend', gridRow()); if (dl) { dl.closest('.gr').remove(); sh.body.dispatchEvent(new Event('input')); } });
    const test = () => { // live check of what the schedules give for an amount
      const amt = num(sh.q('#gt').value), f = ui.read(sh.body), tmp = { currency: f.currency, feePct: f.feePct, feeMin: f.feeMin, commPct: f.commPct, feeGrid: readGrid(sh.body, 'fee'), feeFor: f.feeFor, commGrid: readGrid(sh.body, 'comm'), commFor: f.commFor };
      sh.q('#gtr').innerHTML = amt > 0 ? ['deposit', 'withdraw'].map(t => { const r = MM.suggest(tmp, t, amt); return esc(MM.TYPES[t][0]) + ' : frais <b>' + esc(M.fmt(r.fee, f.currency)) + '</b> · commission <b>' + esc(M.fmt(r.commission, f.currency)) + '</b>'; }).join('<br>') : '';
    };
    sh.body.addEventListener('input', test); sh.body.addEventListener('change', test);
    return sh;
  };
  // reconciliation: compare the real balance (wallet app, bank statement, drawer count) with the calculated one
  MM.reconcile = id => {
    const a = MM.acc(id); if (!a) return; const th = MM.balance(id);
    ui.sheet({ title: 'Rapprocher ' + a.name, html: '<p class="muted">Solde calculé : <b>' + esc(M.fmt(th, a.currency)) + '</b></p>' + ui.field('Solde réel constaté (' + a.currency + ')', ui.input('real', '', { num: 1 }), 'Dans l\'application de l\'opérateur, le relevé ou le comptage') + '<div id="gp" class="muted"></div>',
      onMount: sh => sh.body.addEventListener('input', () => { const v = sh.q('[name=real]').value; if (v === '') { sh.q('#gp').textContent = ''; return; } const g = M.round(ui.read(sh.body).real - th, a.currency); sh.q('#gp').innerHTML = g ? 'Écart : <b>' + (g > 0 ? '+' : '') + esc(M.fmt(g, a.currency)) + '</b>' : '<b>Aucun écart ✔</b>'; }),
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: sh => {
        const v = sh.q('[name=real]').value; if (v === '') { App.toast('Indiquez le solde réel', 'err'); return false; } const real = ui.read(sh.body).real, g = M.round(real - th, a.currency);
        a.checked = { at: Date.now(), date: App.today(), real, gap: g }; if (g) MM.addOp({ type: 'adjust', accountId: id, amount: g, note: 'Rapprochement : solde réel ' + M.fmt(real, a.currency) }); App.log('mm.reconcile', a.name + ' ' + g); App.save(); App.toast(g ? 'Écart régularisé : ' + M.fmt(g, a.currency) : 'Compte juste ✔'); App.render();
      } }] });
  };
  MM.accountSheet = id => {
    const a = MM.acc(id); if (!a) return; const bal = MM.balance(id), recent = ops().filter(o => o.accountId === id || o.toId === id || (kind(o) !== 'move' && MM.legs(o).some(l => l[0] === id))).sort((x, y) => (y.at || 0) - (x.at || 0)).slice(0, 12);
    const sh = ui.sheet({ title: a.name, wide: true, html: '<p class="muted">' + esc(MM.KINDS[a.kind][0]) + ' · ' + esc(a.currency) + (a.checked ? ' · rapproché le ' + App.fmtDate(a.checked.date) : '') + '</p><section class="hero"><small>Solde calculé</small><div class="amt">' + esc(M.fmt(bal, a.currency)) + '</div></section>' + (recent.length ? '<h4>Dernières opérations</h4><div class="list">' + recent.map(o => '<div class="swr" style="--n:0"><div class="item" data-o="' + o.id + '" role="button" tabindex="0"><span class="av">' + MM.TYPES[o.type][1] + '</span><span class="tx"><b>' + esc(MM.TYPES[o.type][0]) + '</b><small>' + App.fmtDate(o.date) + ' · ' + esc(o.number) + (o.status !== 'Terminé' ? ' · ' + esc(o.status) : '') + '</small></span><span class="end"><b>' + esc(M.fmt(o.amount, o.currency)) + '</b></span></div></div>').join('') + '</div>' : '<p class="muted">Aucune opération.</p>'),
      actions: [...(App.can('cash') ? [{ label: '⚖️ Rapprocher', cls: 'ghost', fn: () => { setTimeout(() => MM.reconcile(id), 200); } }, { label: 'Modifier', cls: 'ghost', fn: () => { setTimeout(() => MM.accountForm(id), 200); } }] : [])] });
    sh.body.querySelectorAll('[data-o]').forEach(i => i.onclick = () => { sh.close(); setTimeout(() => MM.profile(i.dataset.o), 220); });
  };

  // ---------- daily report ----------
  MM.dayText = date => {
    const l = ops().filter(o => o.date === date && live(o)), s = db().settings, by = {}, sum = fn => l.reduce((x, o) => x + MM.main(o, fn(o)), 0);
    l.forEach(o => { const t = by[o.type] = by[o.type] || { n: 0, v: 0 }; t.n++; t.v += MM.main(o, o.amount); });
    return 'Opérations du ' + App.fmtDate(date) + ' — ' + s.name + '\n• ' + l.length + ' opération(s)' + Object.entries(by).map(([k, v]) => '\n   – ' + MM.TYPES[k][0] + ' : ' + v.n + ' · ' + M.main(v.v)).join('') + '\n• Frais perçus : ' + M.main(sum(o => o.fee && kind(o) !== 'move' ? o.fee : 0)) + '\n• Commissions : ' + M.main(sum(o => o.commission || 0)) + '\n• Gains : ' + M.main(sum(MM.gain)) + '\n• Fonds :' + accs().map(a => '\n   – ' + a.name + ' (' + a.currency + ') : ' + M.fmt(MM.balance(a.id), a.currency)).join('');
  };
  MM.daySheet = () => {
    const date = App.today(), text = MM.dayText(date);
    ui.sheet({ title: 'Rapport du jour — ' + App.fmtDate(date), html: '<div class="card" style="white-space:pre-wrap">' + esc(text) + '</div>', actions: [{ label: 'Copier', cls: 'ghost', fn: () => { copy(text); return false; } }, { label: '🖨️ Imprimer', cls: 'ghost', fn: () => { A.printHtml(A.page('Rapport du jour', App.fmtDate(date), '<div class="box" style="white-space:pre-wrap">' + esc(text) + '</div>')); return false; } }, { label: '💬 WhatsApp', cls: 'primary', fn: () => { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); return false; } }] });
  };

  // ---------- screen ----------
  const st = { tab: 'ops', f: 'today', q: '' };
  const bars = (items, fmt) => items.length ? '<div>' + items.map(([l, v, max]) => '<div class="rbar"><span>' + esc(l) + '</span><i style="width:' + Math.max(3, Math.round(v / (max || 1) * 100)) + '%"></i><b>' + fmt(v) + '</b></div>').join('') + '</div>' : '<p class="muted">Aucune donnée.</p>';
  const row = o => { const k = kind(o), sign = k === 'give' || k === 'in' ? '+' : k === 'take' || k === 'out' ? '−' : k === 'move' ? '⇄' : (o.amount > 0 ? '+' : ''), who = [o.party, o.ref].filter(Boolean).join(' · '); return '<div class="swr" style="--n:0"><div class="item" data-id="' + o.id + '" role="button" tabindex="0"><span class="av">' + MM.TYPES[o.type][1] + '</span><span class="tx"><b>' + esc(MM.TYPES[o.type][0]) + ' · ' + esc(aname(o.accountId)) + '</b><small>' + esc(new Date(o.at || 0).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })) + ' · ' + esc(o.number) + (who ? ' · ' + esc(who) : '') + '</small></span><span class="end"><b>' + sign + ' ' + esc(M.fmt(Math.abs(o.amount), o.currency)) + '</b>' + (o.status !== 'Terminé' ? '<span class="pill ' + (o.status === 'Annulé' ? 'bad' : 'warn') + '">' + esc(o.status) + '</span>' : (MM.gain(o) ? '<small>gain ' + esc(M.fmt(MM.gain(o), o.currency)) + '</small>' : '')) + '</span></div></div>'; };
  const tabOps = (tab, el) => {
    const t = App.today(), RG = { today: ['Aujourd\'hui', { from: t, to: t }], week: ['7 jours', F.range('week')], month: ['Ce mois', F.range('month')], all: ['Tout', { from: '0000-00-00', to: '9999-99-99' }] }, r = RG[st.f][1], q = norm(st.q);
    const l = MM.inRange(r).filter(o => !q || norm([o.number, o.party, o.phone, o.ref, aname(o.accountId), MM.TYPES[o.type][0]].join(' ')).includes(q)).sort((a, b) => (b.at || 0) - (a.at || 0)), td = MM.inRange({ from: t, to: t }), good = td.filter(live);
    tab.innerHTML = '<section class="hero"><small>Gains du jour</small><div class="amt">' + M.main(good.reduce((s, o) => s + MM.main(o, MM.gain(o)), 0)) + '</div><div class="sub">' + good.length + ' opération(s) · ' + M.main(good.filter(o => ['give', 'take'].includes(kind(o))).reduce((s, o) => s + MM.main(o, o.amount), 0)) + ' brassés' + (td.some(o => o.status === 'En attente') ? ' · ' + td.filter(o => o.status === 'En attente').length + ' en attente' : '') + '</div></section>' +
      '<div class="tools"><button class="btn primary" id="mn">+ Opération</button>' + (App.can('cash') || App.can('reports') ? '<button class="btn ghost" id="md">📤 Rapport du jour</button>' : '') + '<input type="search" id="mq" placeholder="Nom, téléphone, référence…" value="' + esc(st.q) + '"></div>' +
      '<div class="chips">' + Object.entries(RG).map(([k, v]) => '<button data-f="' + k + '" class="' + (st.f === k ? 'on' : '') + '">' + v[0] + '</button>').join('') + '</div>' +
      (l.length ? '<div class="list">' + l.slice(0, 150).map(row).join('') + '</div>' : (ops().length ? '<p class="muted center">Aucune opération sur cette période.</p>' : App.ui.empty('📲', 'Aucune opération', 'Enregistrez un dépôt, un retrait ou un transfert : les fonds et vos gains se calculent tout seuls.', { label: '+ Opération', to: '#mn' })));
    tab.querySelector('#mn').onclick = () => MM.form(); const md = tab.querySelector('#md'); if (md) md.onclick = MM.daySheet;
    const mq = tab.querySelector('#mq'); mq.oninput = () => { st.q = mq.value; const p = mq.selectionStart; tabOps(tab, el); const n = tab.querySelector('#mq'); n.focus(); n.setSelectionRange(p, p); };
    tab.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { st.f = b.dataset.f; tabOps(tab, el); }); tab.querySelectorAll('.item[data-id]').forEach(i => i.onclick = () => MM.profile(i.dataset.id));
  };
  const tabFunds = (tab, el) => {
    const s = db().settings, by = {}; accs().forEach(a => by[a.currency] = (by[a.currency] || 0) + MM.balance(a.id));
    tab.innerHTML = '<section class="hero"><small>Total des fonds</small><div class="amt">' + M.main(MM.totalMain()) + '</div><div class="sub">' + Object.entries(by).map(([c, v]) => esc(M.fmt(M.round(v, c), c))).join(' · ') + '</div></section>' +
      (App.can('cash') ? '<div class="tools">' + (accs().length ? '<button class="btn primary" id="fa">+ Compte</button><button class="btn ghost" data-t="fundin">➕ Entrée</button><button class="btn ghost" data-t="fundout">➖ Sortie</button><button class="btn ghost" data-t="move">🔁 Mouvement</button>' : '<button class="btn primary" id="fs">Choisir mes comptes</button>') + '</div>' : '') +
      (accs().length ? '<div class="list">' + accs().slice().sort((a, b) => ['cash', 'emoney', 'bank'].indexOf(a.kind) - ['cash', 'emoney', 'bank'].indexOf(b.kind)).map(a => { const b = MM.balance(a.id); return '<div class="swr" style="--n:0"><div class="item" data-a="' + a.id + '" role="button" tabindex="0"><span class="av">' + MM.KINDS[a.kind][1] + '</span><span class="tx"><b>' + esc(a.name) + '</b><small>' + esc(MM.KINDS[a.kind][0]) + ' · ' + esc(a.currency) + (a.checked ? ' · rapproché le ' + App.fmtDate(a.checked.date) : '') + '</small></span><span class="end"><b class="' + (b < 0 ? 'bad' : '') + '">' + esc(M.fmt(b, a.currency)) + '</b></span></div></div>'; }).join('') + '</div>' : App.ui.empty('🏦', 'Aucun compte', 'Ajoutez vos espèces, vos portefeuilles mobile money et vos comptes en banque.', App.can('cash') ? { label: 'Choisir mes comptes', to: '#fs' } : null));
    const fa = tab.querySelector('#fa'); if (fa) fa.onclick = () => MM.accountForm(); const fs = tab.querySelector('#fs'); if (fs) fs.onclick = () => MM.setup();
    tab.querySelectorAll('[data-t]').forEach(b => b.onclick = () => MM.form(b.dataset.t)); tab.querySelectorAll('[data-a]').forEach(i => i.onclick = () => MM.accountSheet(i.dataset.a));
  };
  const tabGains = (tab, el) => {
    const r = F.range(F.state.r), l = MM.inRange(r).filter(live), sum = fn => l.reduce((x, o) => x + MM.main(o, fn(o)), 0), byT = {}, byA = {};
    l.forEach(o => { const t = byT[o.type] = byT[o.type] || { n: 0, v: 0, g: 0 }; t.n++; t.v += MM.main(o, o.amount); t.g += MM.main(o, MM.gain(o)); const a = aname(o.accountId); byA[a] = (byA[a] || 0) + MM.main(o, MM.gain(o)); });
    const tMax = Math.max(0, ...Object.values(byT).map(x => x.v)), aMax = Math.max(0, ...Object.values(byA));
    tab.innerHTML = F.rangeChips() + '<section class="hero"><small>Gains · ' + esc(r.label) + '</small><div class="amt">' + M.main(sum(MM.gain)) + '</div><div class="sub">' + l.length + ' opération(s) · ' + M.main(sum(o => ['give', 'take'].includes(kind(o)) ? o.amount : 0)) + ' brassés</div></section>' +
      '<div class="stats card"><div><b>' + M.main(sum(o => ['give', 'take'].includes(kind(o)) ? o.fee : 0)) + '</b><small>frais perçus</small></div><div><b>' + M.main(sum(o => o.commission || 0)) + '</b><small>commissions</small></div><div><b>' + M.main(sum(o => kind(o) === 'move' ? o.fee : 0)) + '</b><small>frais payés</small></div></div>' +
      '<section class="card"><h3>Par type d\'opération</h3>' + bars(Object.entries(byT).sort((a, b) => b[1].v - a[1].v).map(([k, v]) => [MM.TYPES[k][0] + ' (' + v.n + ')', v.v, tMax]), M.main) + '</section><section class="card"><h3>Gains par compte</h3>' + bars(Object.entries(byA).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.max(v, 0), aMax]), M.main) + '</section><p class="muted center">Seuls les frais et les commissions sont vos gains : les montants qui passent par vos comptes ne sont pas du chiffre d\'affaires.</p>';
    tab.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { F.state.r = b.dataset.r; tabGains(tab, el); });
  };
  App.views.mm = { title: 'Opérations', render(el, params) {
    if (params && params.tab) st.tab = params.tab;
    const tabs = [['ops', 'Opérations'], ...(App.can('cash') ? [['funds', 'Fonds']] : []), ...(App.can('reports') ? [['gains', 'Gains']] : [])]; if (!tabs.some(t => t[0] === st.tab)) st.tab = 'ops';
    el.innerHTML = '<div class="page"><div class="seg" id="mtabs">' + tabs.map(t => '<button data-t="' + t[0] + '" class="' + (st.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div><div id="mtab" class="page" style="padding:0"></div></div>';
    el.querySelectorAll('#mtabs button').forEach(b => b.onclick = () => { st.tab = b.dataset.t; App.views.mm.render(el); });
    ({ ops: tabOps, funds: tabFunds, gains: tabGains })[st.tab](el.querySelector('#mtab'), el);
    if (params && params.add) MM.form();
  } };
  App.quick.push({ label: () => 'Nouvelle opération', mod: 'mm', to: 'mm', qc: '#7c5cff', ic: '📲', short: () => 'Opération', run: () => { App.go('mm', { tab: 'ops' }); setTimeout(() => MM.form(), 30); } });
  const wrap = (o, fn, perm) => { const f = o[fn]; o[fn] = function () { if (!App.can(perm)) { App.toast('Action non autorisée pour votre profil', 'err'); return; } return f.apply(this, arguments); }; };
  App.ready.then(() => { wrap(MM, 'accountForm', 'cash'); wrap(MM, 'reconcile', 'cash'); wrap(MM, 'setup', 'cash'); });
})();
