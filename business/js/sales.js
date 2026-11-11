// Sales: invoices (FAC-AAAA-0001), payments (partial, multi-currency), stock link, list screen. Quotes, documents and unpaid are in their own files.
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money, S = App.stock, C = App.clients, norm = C.norm;
  const A = App.sales = {}, db = () => App.db;
  A.tabs = {}; // 'unpaid' etc. register {label, render(el)}
  A.get = id => db().invoices.find(i => i.id === id);
  A.client = i => C.get(i.clientId);
  A.cname = i => { const c = A.client(i); return c ? c.name : (i.clientName || 'Client de passage'); };
  A.live = i => !i.cancelled;

  // unique, sequential numbers per year: FAC-2026-0001 (never reused, even after a deletion)
  A.nextNo = (prefix, key, list) => {
    const y = new Date().getFullYear(), q = db().settings.seq; q[key] = q[key] || {}; let n = (q[key][y] || 0) + 1, no;
    do { no = prefix + '-' + y + '-' + String(n++).padStart(4, '0'); } while (list().some(x => x.number === no));
    q[key][y] = n - 1; return no;
  };
  // ----- money maths (each document keeps its own rate) -----
  A.calc = (lines, disc, cur) => {
    const sub = lines.reduce((a, l) => a + (+l.qty || 0) * (+l.price || 0), 0), d = disc && disc.value > 0 ? (disc.type === 'pct' ? sub * Math.min(disc.value, 100) / 100 : Math.min(disc.value, sub)) : 0;
    return { sub: M.round(sub, cur), disc: M.round(d, cur), total: M.round(sub - d, cur) };
  };
  A.payments = i => db().payments.filter(p => p.invoiceId === i.id);
  A.paid = i => M.round(A.payments(i).reduce((a, p) => a + (p.currency === i.currency ? p.amount : M.convert(p.amount, p.currency, i.currency, p.rate || i.rate)), 0), i.currency);
  A.due = i => A.live(i) ? Math.max(0, M.round(i.total - A.paid(i), i.currency)) : 0;
  A.status = i => !A.live(i) ? ['Annulée', 'bad'] : A.due(i) <= 0.004 ? ['Payée', 'ok'] : A.paid(i) > 0 ? ['Partielle', 'warn'] : ['Impayée', 'bad'];
  A.main = (i, n) => M.convert(n, i.currency, db().settings.currency, i.rate); // amount of a document in the main currency
  A.fmt = (i, n) => M.fmt(n, i.currency);
  A.age = i => Math.max(0, App.diff(i.date, App.today()));

  // ----- stock link: lines tied to a tracked product leave the stock; edit/cancel puts them back -----
  const applyStock = i => (i.lines || []).forEach(l => { const p = l.pid && S.get(l.pid); if (p && S.tracked(p)) S.move({ pid: p.id, qty: -l.qty, type: 'sale', ref: i.number, date: i.date, note: 'Vente ' + i.number }); });
  const undoStock = (i, why) => (i.lines || []).forEach(l => { const p = l.pid && S.get(l.pid); if (p && S.tracked(p)) S.move({ pid: p.id, qty: l.qty, type: 'return', ref: i.number, note: why + ' ' + i.number }); });

  // ---------- invoice form ----------
  A.invoiceForm = (o) => {
    o = o || {}; const old = o.id ? A.get(o.id) : null, s = db().settings, src = old || o.from || {}; if (!db().clients.length && !db().products.length) { /* still allowed: walk-in client, free lines */ }
    const st = { lines: JSON.parse(JSON.stringify(src.lines || [{ pid: '', desc: '', qty: 1, price: '' }])) };
    const cl = [['', '— Client de passage —'], ...db().clients.slice().sort((a, b) => norm(a.name).localeCompare(norm(b.name))).map(c => [c.id, c.name + (c.phone ? ' · ' + c.phone : '')])];
    const sh = ui.sheet({ title: old ? 'Modifier ' + old.number : 'Nouvelle facture', wide: true, onClose: () => { }, html: '<div id="invf"></div>',
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: old ? 'Enregistrer' : 'Créer la facture', cls: 'primary', fn: sh => save(sh) }] });
    const box = sh.q('#invf'), prodOpts = () => [['', '— Ligne libre —'], ...db().products.map(p => [p.id, p.name + (S.tracked(p) ? ' (' + S.qty(p) + ')' : '')])];
    const draw = () => {
      if (box.firstChild) st.f = ui.read(box); const g = (k, d) => st.f && st.f[k] !== undefined && st.f[k] !== '' ? st.f[k] : d; // keep what was typed when the lines are redrawn
      box.innerHTML = '<div class="row2">' + ui.field(App.cap(App.vocab('client')), ui.select('clientId', cl, g('clientId', o.clientId || src.clientId || ''))) + ui.field('Date', ui.dateField('date', g('date', src.date))) + '</div>' +
        '<div class="row2">' + ui.field('Devise', ui.select('currency', [s.currency, s.cur2], g('currency', src.currency || s.currency))) + ui.field('Taux (1 ' + s.currency + ' = ? ' + s.cur2 + ')', ui.input('rate', g('rate', src.rate || s.rate), { num: 1 })) + '</div>' +
        '<div class="fld"><span>Lignes</span><div id="ln">' + st.lines.map((l, k) => '<div class="card ln" data-k="' + k + '">' + ui.select('pid', prodOpts(), l.pid) + '<input name="desc" placeholder="Désignation" value="' + esc(l.desc) + '"><div class="row2">' + ui.stepper('qty', l.qty, 0) + '<input name="price" data-num inputmode="decimal" placeholder="Prix unitaire" value="' + esc(l.price) + '"></div>' + (st.lines.length > 1 ? '<button type="button" class="btn ghost sm" data-rm="' + k + '">Retirer la ligne</button>' : '') + '</div>').join('') + '</div><button type="button" class="btn ghost" id="addln">+ Ajouter une ligne</button></div>' +
        '<div class="row2">' + ui.field('Remise', ui.select('dtype', [['pct', 'en %'], ['amt', 'montant']], g('dtype', (src.disc && src.disc.type) || 'pct'))) + ui.field('Valeur', ui.input('dval', g('dval', (src.disc && src.disc.value) || ''), { num: 1 })) + '</div><div class="card" id="tot"></div>' +
        (old ? '' : '<div class="card"><b>Paiement à la création</b><div class="row2">' + ui.field('Le client a donné', ui.input('given', g('given', ''), { num: 1 })) + ui.field('Mode', ui.select('mode', s.modes, g('mode', s.modes[0]))) + '</div><div id="chg" class="muted"></div></div>') +
        ui.field('Note', '<textarea name="note" rows="2">' + esc(g('note', src.note || '')) + '</textarea>') + App.cf.html('invoices', src.fields);
      recalc();
    };
    const readLines = () => { box.querySelectorAll('.ln').forEach((d, k) => { const l = st.lines[k]; l.pid = d.querySelector('[name=pid]').value; l.desc = d.querySelector('[name=desc]').value; l.qty = parseFloat(String(d.querySelector('[name=qty]').value).replace(',', '.')) || 0; l.price = d.querySelector('[name=price]').value; }); };
    const vals = () => { const f = ui.read(box); readLines(); const lines = st.lines.map(l => ({ ...l, price: parseFloat(String(l.price).replace(',', '.')) || 0 })); return { f, lines, calc: A.calc(lines, { type: f.dtype, value: f.dval }, f.currency) }; };
    const recalc = () => {
      const { f, calc } = vals(), cur = f.currency, rate = f.rate > 0 ? f.rate : s.rate, other = cur === s.currency ? s.cur2 : s.currency, eq = M.convert(calc.total, cur, other, rate);
      box.querySelector('#tot').innerHTML = '<div class="kv"><dt>Sous-total</dt><dd>' + M.fmt(calc.sub, cur) + '</dd>' + (calc.disc ? '<dt>Remise</dt><dd>− ' + M.fmt(calc.disc, cur) + '</dd>' : '') + '<dt><b>Total</b></dt><dd><b>' + M.fmt(calc.total, cur) + '</b> <small class="muted">≈ ' + M.fmt(eq, other) + '</small></dd></div><small class="muted">' + esc(M.inWords(calc.total, cur)) + '</small>';
      const g = box.querySelector('[name=given]'); if (g) { const gv = f.given || 0; box.querySelector('#chg').innerHTML = gv ? (gv >= calc.total ? 'Monnaie à rendre : <b>' + M.fmt(gv - calc.total, cur) + '</b>' : 'Reste à payer : <b>' + M.fmt(calc.total - gv, cur) + '</b>') : 'Reste à payer : <b>' + M.fmt(calc.total, cur) + '</b>'; }
    };
    box.addEventListener('input', e => { if (e.target.name === 'pid') { readLines(); const k = +e.target.closest('.ln').dataset.k, l = st.lines[k], p = S.get(l.pid), f = ui.read(box); if (p) { l.desc = p.name; l.price = f.currency === s.currency ? p.price : M.convert(p.price, s.currency, f.currency, f.rate); draw(); return; } } recalc(); });
    box.addEventListener('click', e => { const rm = e.target.closest('[data-rm]'); if (rm) { readLines(); st.lines.splice(+rm.dataset.rm, 1); draw(); } if (e.target.id === 'addln') { readLines(); st.lines.push({ pid: '', desc: '', qty: 1, price: '' }); draw(); } });
    const save = sh => {
      const { f, lines, calc } = vals(), ok = lines.filter(l => l.qty > 0 && (l.desc || l.pid)); if (!ok.length) { App.toast('Ajoutez au moins une ligne', 'err'); return false; }
      if (!(f.rate > 0)) { App.toast('Taux invalide', 'err'); return false; }
      if (!old && !sh._ok) { const short = ok.filter(l => { const p = l.pid && S.get(l.pid); return p && S.tracked(p) && p.qty < l.qty; }); if (short.length) { App.toast('Stock insuffisant : ' + short.map(l => l.desc).join(', ') + '. Appuyez encore pour continuer.', 'err'); sh._ok = true; return false; } }
      const rec = { clientId: f.clientId, clientName: f.clientId ? '' : 'Client de passage', date: f.date, currency: f.currency, rate: f.rate, lines: ok.map(l => { const pr = l.pid && S.get(l.pid); return { ...l, cost: pr ? +pr.cost || 0 : +l.cost || 0 }; }), disc: { type: f.dtype, value: f.dval || 0 }, sub: calc.sub, discAmt: calc.disc, total: calc.total, note: f.note, fields: App.cf.read('invoices', box) };
      let inv;
      if (old) { undoStock(old, 'Modification'); Object.assign(old, rec); inv = old; applyStock(inv); App.log('invoice.edit', inv.number); }
      else { inv = { id: App.uid(), number: A.nextNo('FAC', 'invoice', () => db().invoices), kind: 'sale', ...rec }; db().invoices.push(inv); applyStock(inv); if (o.fromQuote) { o.fromQuote.status = 'invoiced'; o.fromQuote.invoiceId = inv.id; }
        if (f.given > 0) A.addPayment(inv, { amount: Math.min(f.given, inv.total), currency: inv.currency, mode: f.mode, date: f.date, note: f.given > inv.total ? 'Monnaie rendue : ' + M.fmt(f.given - inv.total, inv.currency) : '' }, true);
        App.log('invoice.add', inv.number); }
      App.save(); App.toast(old ? 'Facture modifiée' : 'Facture ' + inv.number + ' créée'); App.render(); setTimeout(() => A.profile(inv.id), 250);
    };
    draw();
  };

  // Programmatic invoice used by the other modules (subscriptions, interventions, rentals): same numbering, stock and payment rules as the form.
  A.createInvoice = o => {
    const s = db().settings, cur = o.currency || s.currency, rate = o.rate || s.rate, lines = o.lines.map(l => ({ pid: l.pid || '', desc: l.desc, qty: l.qty == null ? 1 : l.qty, price: l.price, cost: l.cost || 0 })), calc = A.calc(lines, o.disc, cur);
    const inv = { id: App.uid(), number: A.nextNo('FAC', 'invoice', () => db().invoices), kind: 'sale', clientId: o.clientId || '', clientName: o.clientId ? '' : 'Client de passage', date: o.date || App.today(), currency: cur, rate, lines, disc: o.disc || { type: 'pct', value: 0 }, sub: calc.sub, discAmt: calc.disc, total: calc.total, note: o.note || '', fields: {}, source: o.source || '' };
    db().invoices.push(inv); applyStock(inv); if (o.paid > 0) A.addPayment(inv, { amount: Math.min(o.paid, inv.total), currency: cur, mode: o.mode, date: inv.date }, true);
    App.log('invoice.add', inv.number + (o.source ? ' (' + o.source + ')' : '')); return inv;
  };
  // ---------- payments ----------
  A.addPayment = (inv, p, quiet) => {
    const rec = { id: App.uid(), invoiceId: inv.id, clientId: inv.clientId, date: p.date || App.today(), amount: p.amount, currency: p.currency || inv.currency, rate: p.rate || (p.currency && p.currency !== inv.currency ? db().settings.rate : inv.rate), mode: p.mode || db().settings.modes[0], at: Date.now(), note: p.note || '', no: A.nextNo('REC', 'receipt', () => db().payments.map(x => ({ number: x.no }))) };
    db().payments.push(rec); App.log('payment.add', inv.number + ' ' + rec.amount + ' ' + rec.currency); if (!quiet) App.save(); return rec;
  };
  A.payForm = (id) => {
    const inv = A.get(id), s = db().settings; if (!inv) return; const due = A.due(inv);
    if (due <= 0.004) return App.toast('Cette facture est déjà payée');
    const sh = ui.sheet({ title: 'Encaisser — ' + inv.number, html: '<p>Reste à payer : <b>' + A.fmt(inv, due) + '</b></p><div class="row2">' + ui.field('Montant', ui.input('amount', due, { num: 1 })) + ui.field('Devise', ui.select('currency', [s.currency, s.cur2], inv.currency)) + '</div><div class="row2">' + ui.field('Taux (1 ' + s.currency + ' = ? ' + s.cur2 + ')', ui.input('rate', inv.rate, { num: 1 })) + ui.field('Mode', ui.select('mode', s.modes, s.modes[0])) + '</div>' + ui.field('Date', ui.dateField('date')) + ui.field('Note', ui.input('note', '')) + '<div id="peq" class="muted"></div>',
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: sh => {
        const f = ui.read(sh.body); if (!(f.amount > 0)) { App.toast('Montant invalide', 'err'); return false; }
        const eq = f.currency === inv.currency ? f.amount : M.convert(f.amount, f.currency, inv.currency, f.rate); if (eq > due + (M.decimals(inv.currency) ? .005 : .5)) { App.toast('Supérieur au reste à payer (' + A.fmt(inv, due) + ')', 'err'); return false; }
        const rec = A.addPayment(inv, { amount: f.amount, currency: f.currency, rate: f.rate, mode: f.mode, date: f.date, note: f.note }); App.save(); App.toast('Paiement enregistré'); App.render(); setTimeout(() => A.receiptSheet(rec.id), 250);
      } }] });
    const eqf = () => { const f = ui.read(sh.body); sh.q('#peq').textContent = f.currency !== inv.currency && f.amount > 0 ? '≈ ' + A.fmt(inv, M.convert(f.amount, f.currency, inv.currency, f.rate)) + ' sur la facture' : ''; }; sh.body.addEventListener('input', eqf); eqf();
  };
  A.delPayment = async (pid, inv) => { if (await ui.confirm('Supprimer ce paiement ?', 'Supprimer', true)) { db().payments = db().payments.filter(p => p.id !== pid); App.log('payment.delete', inv.number); App.save(); App.render(); return true; } return false; };
  A.msg = (tpl, o) => tpl.replace(/\{(\w+)\}/g, (m, k) => o[k] == null ? '' : o[k]);
  A.receiptSheet = id => {
    const p = db().payments.find(x => x.id === id), inv = p && A.get(p.invoiceId); if (!p) return; const c = inv && A.client(inv);
    ui.sheet({ title: 'Reçu ' + p.no, html: '<p>Paiement de <b>' + M.fmt(p.amount, p.currency) + '</b> (' + esc(p.mode) + ') le ' + App.fmtDate(p.date) + (inv ? ' pour <b>' + esc(inv.number) + '</b>' : '') + '.</p>',
      actions: [{ label: '💬 WhatsApp', cls: 'ghost', fn: () => { const t = A.msg(db().settings.msgs.receipt, { nom: c ? c.name : '', montant: M.fmt(p.amount, p.currency), facture: inv ? ' pour la facture ' + inv.number : '', date: App.fmtDate(p.date), entreprise: db().settings.name }); window.open('https://wa.me/' + (c && c.phone ? C.intl(c.phone) : '') + '?text=' + encodeURIComponent(t), '_blank', 'noopener'); return false; } }, { label: '🖨️ Imprimer le reçu', cls: 'primary', fn: () => { A.print('receipt', p.id); return false; } }, { label: 'Fermer', cls: 'ghost' }] });
  };

  // ---------- invoice profile ----------
  A.profile = id => {
    const i = A.get(id); if (!i) return; const [stl, stc] = A.status(i), ps = A.payments(i), c = A.client(i), due = A.due(i);
    const sh = ui.sheet({ title: i.number, wide: true, html: '<div class="stats"><div><b>' + A.fmt(i, i.total) + '</b><small>total</small></div><div class="ok"><b>' + A.fmt(i, A.paid(i)) + '</b><small>payé</small></div><div class="' + (due ? 'bad' : '') + '"><b>' + A.fmt(i, due) + '</b><small>reste</small></div></div><p><span class="pill ' + stc + '">' + stl + '</span> ' + esc(A.cname(i)) + ' · ' + App.fmtDate(i.date) + (due && A.age(i) ? ' · <b>' + A.age(i) + ' j</b>' : '') + '</p>' +
      '<table class="tbl"><tr><th>Désignation</th><th>Qté</th><th>Prix</th><th>Total</th></tr>' + i.lines.map(l => '<tr><td>' + esc(l.desc) + '</td><td>' + S.nf(l.qty) + '</td><td>' + A.fmt(i, l.price) + '</td><td>' + A.fmt(i, l.qty * l.price) + '</td></tr>').join('') + '</table>' + (i.discAmt ? '<p class="muted">Remise : − ' + A.fmt(i, i.discAmt) + '</p>' : '') + '<p class="muted">' + esc(M.inWords(i.total, i.currency)) + '</p>' +
      (ps.length ? '<h4>Paiements</h4><div class="list">' + ps.map(p => '<div class="item"><span class="tx"><b>' + M.fmt(p.amount, p.currency) + '</b><small>' + App.fmtDate(p.date) + ' · ' + esc(p.mode) + ' · ' + esc(p.no) + '</small></span><span class="end"><button class="btn sm ghost" data-rec="' + p.id + '">Reçu</button><button class="btn sm ghost" data-delp="' + p.id + '" aria-label="Supprimer">🗑</button></span></div>').join('') + '</div>' : '') + (i.note ? '<p class="muted">' + esc(i.note) + '</p>' : ''),
      actions: [...(A.live(i) && App.can('delete') ? [{ label: 'Annuler la facture', cls: 'danger', fn: async s => { if (ps.length) { App.toast('Supprimez d\'abord les paiements', 'err'); return false; } if (await ui.confirm('Annuler ' + i.number + ' ? Le stock sera remis.', 'Annuler la facture', true)) { undoStock(i, 'Annulation'); i.cancelled = true; App.log('invoice.cancel', i.number); App.save(); s.close(); App.render(); } return false; } }] : []), ...(A.live(i) && App.can('sell') ? [{ label: 'Modifier', cls: 'ghost', fn: () => { setTimeout(() => A.invoiceForm({ id: id }), 200); } }] : []), { label: '🖨️ Imprimer / PDF', cls: 'ghost', fn: () => { A.print('invoice', id); return false; } }, { label: 'Word', cls: 'ghost', fn: () => { A.word('invoice', id); return false; } }, ...(due > 0 && A.live(i) ? [{ label: '💰 Encaisser', cls: 'primary', fn: () => { setTimeout(() => A.payForm(id), 200); } }] : [])] });
    sh.body.addEventListener('click', async e => { const r = e.target.closest('[data-rec]'), d = e.target.closest('[data-delp]'); if (r) A.receiptSheet(r.dataset.rec); if (d && await A.delPayment(d.dataset.delp, i)) { sh.close(); setTimeout(() => A.profile(id), 200); } });
  };

  // ---------- list screen: Factures | Devis | Impayés ----------
  const st = { tab: 'inv', f: 'all', q: '' };
  A.sumMonth = () => { const k = App.today().slice(0, 7), l = db().invoices.filter(i => A.live(i) && i.date.startsWith(k)); return { billed: l.reduce((a, i) => a + A.main(i, i.total), 0), paid: db().payments.filter(p => p.date.startsWith(k)).reduce((a, p) => a + (p.currency === db().settings.currency ? p.amount : M.convert(p.amount, p.currency, db().settings.currency, p.rate)), 0) }; };
  A.unpaidList = () => db().invoices.filter(i => A.due(i) > 0.004).sort((a, b) => a.date.localeCompare(b.date));
  A.unpaidTotal = () => A.unpaidList().reduce((a, i) => a + A.main(i, A.due(i)), 0);
  App.views.sales = {
    title: 'Ventes',
    render(el, params) {
      if (params && params.tab) st.tab = params.tab;
      const m = A.sumMonth(), tabs = { inv: 'Factures', quote: 'Devis', ...Object.fromEntries(Object.entries(A.tabs).map(([k, v]) => [k, v.label])) };
      el.innerHTML = '<div class="page"><section class="hero"><small>Facturé ce mois</small><div class="amt">' + M.main(m.billed) + '</div><div class="sub">Encaissé : ' + M.main(m.paid) + ' · À encaisser : ' + M.main(A.unpaidTotal()) + '</div></section><div class="seg" id="stabs">' + Object.entries(tabs).map(([k, l]) => '<button data-t="' + k + '" class="' + (st.tab === k ? 'on' : '') + '">' + esc(l) + '</button>').join('') + '</div><div id="tab"></div></div>';
      el.querySelectorAll('#stabs button').forEach(b => b.onclick = () => { st.tab = b.dataset.t; App.views.sales.render(el); });
      const tab = el.querySelector('#tab');
      if (st.tab === 'inv') drawInv(tab, el); else if (st.tab === 'quote') A.drawQuotes && A.drawQuotes(tab, el); else A.tabs[st.tab].render(tab, el);
      if (params && params.add) A.invoiceForm();
    }
  };
  const drawInv = (tab, el) => {
    const q = norm(st.q), F = { all: ['Toutes', () => true], due: ['Impayées', i => A.live(i) && A.due(i) > 0.004], paid: ['Payées', i => A.live(i) && A.due(i) <= 0.004], x: ['Annulées', i => !A.live(i)] };
    const list = db().invoices.filter(i => F[st.f][1](i) && (!q || norm(i.number + ' ' + A.cname(i)).includes(q))).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
    tab.innerHTML = '<div class="tools"><input type="search" id="iq" placeholder="Rechercher (numéro, client)" value="' + esc(st.q) + '"><button class="btn primary" id="ni">+ Facture</button></div><div class="chips">' + Object.entries(F).map(([k, v]) => '<button data-f="' + k + '" class="' + (st.f === k ? 'on' : '') + '">' + v[0] + '</button>').join('') + '</div>' +
      (!db().invoices.length ? '<div class="empty"><div class="big">🧾</div><h2>Aucune facture</h2><p class="muted">Créez la première avec le bouton +.</p></div>' : '<div class="list">' + (list.map(i => { const [l, c] = A.status(i), due = A.due(i); return '<div class="swr" style="--n:0"><div class="item" role="button" tabindex="0" data-id="' + i.id + '"><span class="av">🧾</span><span class="tx"><b>' + esc(A.cname(i)) + '</b><small>' + esc(i.number) + ' · ' + App.fmtDate(i.date) + '</small></span><span class="end"><b>' + A.fmt(i, i.total) + '</b><span class="pill ' + c + '">' + l + (l === 'Partielle' ? ' · reste ' + A.fmt(i, due) : '') + '</span></span></div></div>'; }).join('') || '<p class="muted center">Aucun résultat.</p>') + '</div>');
    const iq = tab.querySelector('#iq'); iq.oninput = () => { st.q = iq.value; const p = iq.selectionStart; drawInv(tab, el); const n = tab.querySelector('#iq'); n.focus(); n.setSelectionRange(p, p); };
    tab.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { st.f = b.dataset.f; drawInv(tab, el); }); tab.querySelector('#ni').onclick = () => A.invoiceForm();
    tab.querySelectorAll('.item[data-id]').forEach(i => i.onclick = () => A.profile(i.dataset.id));
  };
  A.quick = () => { App.go('sales'); setTimeout(() => A.invoiceForm(), 30); };
  App.quick[1].run = A.quick;
})();
