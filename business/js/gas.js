// Dépôt de gaz (module « Gaz »): domestic gas bottles. The stock stays the products' one (one product per bottle size, counted in FULL bottles); the sheet of a bottle (`gzInfo`: product, kg, price of a refill, deposit)
// says how it is sold. Operations (`gzOps`, never edited, only cancelled): an EXCHANGE (the customer brings an empty bottle, pays the refill; a full bottle leaves the stock, an empty one comes into the depot), a NEW
// bottle (refill + deposit; a full bottle leaves the stock and the customer now holds one of our bottles), a RETURN (the customer gives a bottle back and gets the deposit back: a real expense « Consignes remboursées
// gaz »; the empty comes into the depot) and a SUPPLIER exchange (n empties go out, n full come in; an optional unit price is a real expense « Rechargement gaz »). Every sale is one ordinary invoice (source « Gaz »), so
// the cash drawer, the unpaid list, the journal and the profit stay right; the deposit of each bottle is copied into the operation. Nothing derived is stored: the empties in the depot, the bottles held by customers
// (per customer too) and the deposits owed, the figures of the report.
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money, A = App.sales, S = App.stock, C = App.clients, F = App.fin, norm = C.norm, db = () => App.db;
  const GZ = App.gas = {};
  const infos = () => db().gzInfo, ops = () => db().gzOps, cur = () => db().settings.currency, rd = n => M.round(n, cur()), num = v => parseFloat(String(v).replace(',', '.')) || 0, live = o => o.status !== 'Annulé';
  GZ.cfg = () => Object.assign({ sendAt: 10 }, db().settings.gz || {}); GZ.info = id => infos().find(i => i.id === id); GZ.infoOf = pid => infos().find(i => i.pid === pid);
  const client = id => db().clients.find(c => c.id === id), who = o => o.clientId ? (client(o.clientId) ? client(o.clientId).name : '(supprimé)') : (o.name || 'Client de passage'), inv = id => { const i = id && A.get(id); return i && A.live(i) ? i : null; }, pname = pid => (S.get(pid) || {}).name || '';
  const expense = (cat, amount, mode, date, note) => { const e = { id: App.uid(), at: Date.now(), amount, currency: cur(), rate: db().settings.rate, category: cat, mode, supplierId: '', date, note }; if (!F.cats().includes(cat)) F.cats().push(cat); db().expenses.push(e); return e.id; };
  const dropExp = id => { if (id) db().expenses = db().expenses.filter(e => e.id !== id); };

  // ---------- bottle sheets ----------
  GZ.saveInfo = (f, id) => {
    const p = S.get(f.pid); if (!p || !S.tracked(p)) return { err: 'Choisissez un produit suivi en stock' }; const kg = num(f.kg), refill = num(f.refill), deposit = num(f.deposit); if (!(kg > 0)) return { err: 'Indiquez le poids de la bouteille (kg)' }; if (!(refill > 0)) return { err: 'Indiquez le prix du gaz (échange)' }; if (deposit < 0) return { err: 'Consigne invalide' };
    if (infos().some(i => i.id !== id && i.pid === p.id)) return { err: 'Ce produit a déjà une fiche' }; let i = id ? GZ.info(id) : null; const rec = { pid: p.id, kg, refill, deposit }; if (i) Object.assign(i, rec); else { i = { id: App.uid(), ...rec }; infos().push(i); } App.save(); return i;
  };
  GZ.deleteInfo = i => { if (ops().some(o => o.pid === i.pid)) return 'used'; db().gzInfo = infos().filter(x => x.id !== i.id); App.save(); return true; };

  // ---------- derived counts ----------
  const sum = (pid, f, kinds) => ops().filter(o => live(o) && o.pid === pid && kinds.includes(o.kind) && f(o)).reduce((s, o) => s + o.qty, 0);
  GZ.empties = pid => sum(pid, () => true, ['swap', 'back']) - sum(pid, () => true, ['supplier']);
  GZ.held = (pid, clientId) => { const f = o => !clientId || o.clientId === clientId; return sum(pid, f, ['new']) - sum(pid, f, ['back']); };
  GZ.owed = () => rd(infos().reduce((s, i) => s + Math.max(0, GZ.held(i.pid)) * i.deposit, 0));
  GZ.heldBy = () => { const by = {}; ops().filter(o => live(o) && o.clientId && ['new', 'back'].includes(o.kind)).forEach(o => { const k = by[o.clientId + '|' + o.pid] = by[o.clientId + '|' + o.pid] || { clientId: o.clientId, pid: o.pid, n: 0 }; k.n += o.kind === 'new' ? o.qty : -o.qty; }); return Object.values(by).filter(x => x.n > 0); };

  // ---------- operations ----------
  GZ.sell = f => {
    const i = GZ.infoOf(f.pid), p = S.get(f.pid); if (!i || !p) return { err: 'Choisissez une bouteille (fiche à créer)' }; const kind = f.kind === 'new' ? 'new' : 'swap', qty = Math.round(num(f.qty)); if (!(qty >= 1)) return { err: 'Indiquez la quantité' }; if (p.qty < qty) return { err: 'Stock insuffisant : ' + p.qty + ' bouteille(s) pleine(s)' };
    const cl = f.clientId ? client(f.clientId) : null; if (f.clientId && !cl) return { err: 'Client introuvable' }; const price = f.price != null && f.price !== '' ? num(f.price) : i.refill; if (!(price > 0)) return { err: 'Prix invalide' };
    const L = [{ pid: p.id, desc: p.name + (kind === 'new' ? ' · bouteille neuve' : ' · échange'), qty, price, cost: p.cost || 0 }]; if (kind === 'new' && i.deposit > 0) L.push({ pid: '', desc: 'Consigne bouteille ' + i.kg + ' kg', qty, price: i.deposit, cost: 0 });
    const total = rd(L.reduce((s, l) => s + l.qty * l.price, 0)), paid = f.paid != null && f.paid !== '' ? num(f.paid) : (cl ? 0 : total); if (paid < 0 || paid > total + 0.004) return { err: 'Montant invalide' }; if (!cl && paid < total - 0.004) return { err: 'Montant insuffisant : un client de passage paie tout (' + M.main(total) + ')' };
    const o = { id: App.uid(), number: A.nextNo('GZ', 'gz', () => ops()), kind, date: App.today(), at: Date.now(), pid: p.id, qty, dep: kind === 'new' ? i.deposit : 0, price, clientId: cl ? cl.id : '', name: cl ? '' : String(f.name || '').trim(), status: 'Valide', note: f.note || '' };
    const v = A.createInvoice({ clientId: o.clientId, lines: L, paid: 0, mode: f.mode || db().settings.modes[0], date: App.today(), source: 'Gaz', note: o.number + ' · ' + who(o) }); o.invoiceId = v.id; if (paid > 0) A.addPayment(v, { amount: paid, currency: v.currency, mode: f.mode || db().settings.modes[0], date: App.today() }, true);
    ops().push(o); App.log('gas.sell', o.number + ' ' + kind + ' ' + qty); App.save(); return o;
  };
  GZ.back = f => {
    const i = GZ.infoOf(f.pid); if (!i) return { err: 'Choisissez une bouteille' }; const qty = Math.round(num(f.qty)); if (!(qty >= 1)) return { err: 'Indiquez la quantité' }; if (!(i.deposit > 0)) return { err: 'Aucune consigne définie pour cette bouteille' };
    const all = GZ.held(i.pid); if (qty > all) return { err: 'Au-delà des bouteilles en consigne (' + Math.max(0, all) + ')' }; const cl = f.clientId ? client(f.clientId) : null; if (f.clientId && !cl) return { err: 'Client introuvable' };
    if (cl && qty > GZ.held(i.pid, cl.id)) { if (!f.force || !App.can('cash')) return { err: cl.name + ' ne détient que ' + Math.max(0, GZ.held(i.pid, cl.id)) + ' de nos bouteilles', soft: true }; }
    const amount = rd(qty * i.deposit), mode = f.mode || db().settings.modes[0], o = { id: App.uid(), number: A.nextNo('GZ', 'gz', () => ops()), kind: 'back', date: App.today(), at: Date.now(), pid: i.pid, qty, dep: i.deposit, amount, clientId: cl ? cl.id : '', name: cl ? '' : String(f.name || '').trim(), mode, status: 'Valide', note: f.note || '' };
    o.expenseId = expense('Consignes remboursées gaz', amount, mode, o.date, pname(i.pid) + ' ×' + qty + ' · ' + o.number); ops().push(o); App.log('gas.back', o.number + ' ' + qty); App.save(); return o;
  };
  GZ.supplier = f => {
    const i = GZ.infoOf(f.pid), p = S.get(f.pid); if (!i || !p) return { err: 'Choisissez une bouteille' }; const qty = Math.round(num(f.qty)); if (!(qty >= 1)) return { err: 'Indiquez la quantité' }; const e = GZ.empties(i.pid); if (qty > e) return { err: 'Seulement ' + Math.max(0, e) + ' bouteille(s) vide(s) au dépôt' }; const unit = num(f.unit); if (unit < 0) return { err: 'Prix invalide' };
    const o = { id: App.uid(), number: A.nextNo('GZ', 'gz', () => ops()), kind: 'supplier', date: App.today(), at: Date.now(), pid: i.pid, qty, unit, supplierId: f.supplierId || '', status: 'Valide', note: f.note || '' }; S.move({ pid: p.id, qty, type: 'in', cost: unit > 0 ? unit : 0, ref: o.number, note: 'Échange fournisseur ' + o.number, supplierId: o.supplierId });
    if (unit > 0) o.expenseId = expense('Rechargement gaz', rd(unit * qty), f.mode || db().settings.modes[0], o.date, p.name + ' ×' + qty + ' · ' + o.number); ops().push(o); App.log('gas.supplier', o.number + ' ' + qty); App.save(); return o;
  };
  GZ.stat = o => { const i = inv(o.invoiceId); return i ? { total: A.main(i, i.total), paid: A.main(i, A.paid(i)), due: A.main(i, A.due(i)), inv: i } : { total: o.kind === 'back' ? o.amount : 0, paid: 0, due: 0, inv: null }; };
  GZ.cancel = o => {
    if (!live(o)) return false; const p = S.get(o.pid); o.status = 'Annulé'; let bad = false;
    if (o.kind === 'supplier') { if (p && p.qty < o.qty) bad = 'sold'; } if (GZ.empties(o.pid) < 0 || GZ.held(o.pid) < 0) bad = bad || 'used';
    if (bad) { o.status = 'Valide'; return bad; }
    if (['swap', 'new'].includes(o.kind)) { const i = inv(o.invoiceId); if (i) { (i.lines || []).forEach(l => { const q = l.pid && S.get(l.pid); if (q && S.tracked(q)) S.move({ pid: q.id, qty: l.qty, type: 'return', ref: i.number, note: 'Annulation ' + i.number }); }); db().payments = db().payments.filter(x => x.invoiceId !== i.id); i.cancelled = true; } }
    else if (o.kind === 'supplier') { S.move({ pid: o.pid, qty: -o.qty, type: 'out', ref: o.number, note: 'Annulation ' + o.number }); dropExp(o.expenseId); } else dropExp(o.expenseId);
    App.log('gas.cancel', o.number); App.save(); return true;
  };

  // ---------- report, to-do ----------
  GZ.report = r => {
    const os = ops().filter(o => live(o) && F.inR(o.date, r)), by = {}; let sales = 0, refunds = 0, kg = 0; os.forEach(o => { const i = GZ.infoOf(o.pid), k = by[o.pid] = by[o.pid] || { name: pname(o.pid), swap: 0, neu: 0, back: 0 }; if (o.kind === 'swap' || o.kind === 'new') { sales += GZ.stat(o).total; kg += o.qty * (i ? i.kg : 0); if (o.kind === 'swap') k.swap += o.qty; else k.neu += o.qty; } else if (o.kind === 'back') { refunds += o.amount; k.back += o.qty; } });
    return { n: os.length, sales: rd(sales), refunds: rd(refunds), kg: Math.round(kg * 10) / 10, swaps: os.filter(o => o.kind === 'swap').reduce((s, o) => s + o.qty, 0), news: os.filter(o => o.kind === 'new').reduce((s, o) => s + o.qty, 0), by: Object.values(by), owed: GZ.owed(), held: infos().reduce((s, i) => s + Math.max(0, GZ.held(i.pid)), 0), empties: infos().reduce((s, i) => s + Math.max(0, GZ.empties(i.pid)), 0), full: infos().reduce((s, i) => s + ((S.get(i.pid) || {}).qty || 0), 0), toSend: infos().filter(i => GZ.empties(i.pid) >= GZ.cfg().sendAt).length, low: infos().filter(i => S.get(i.pid) && S.get(i.pid).qty <= (+S.get(i.pid).min || 0)).length, due: rd(ops().filter(live).reduce((s, o) => s + GZ.stat(o).due, 0)), noSheet: !infos().length };
  };
  GZ.reportText = r => { const c = GZ.report(r), s = db().settings; return 'Rapport gaz — ' + s.name + ' · ' + r.label + '\n• Échanges : ' + c.swaps + ' · bouteilles neuves : ' + c.news + ' · ' + c.kg + ' kg\n• Ventes : ' + M.main(c.sales) + '\n• Bouteilles chez les clients : ' + c.held + ' (consignes dues ' + M.main(c.owed) + ')\n• Vides au dépôt : ' + c.empties; };
  GZ.todo = () => {
    const t = []; if (!App.mod('gas')) return t; const R = GZ.report({ from: '9999-12-30', to: '9999-12-31', label: '' }); if (R.noSheet) t.push(['Créez vos fiches de bouteilles', 'gas', { tab: 'bottles' }]); if (R.toSend) t.push([R.toSend + ' bouteille(s) : vides à renvoyer au fournisseur', 'gas', { tab: 'bottles' }]); if (R.low) t.push([R.low + ' bouteille(s) en rupture ou sous le minimum', 'gas', { tab: 'bottles' }]); if (R.due > 0.004) t.push(['À encaisser : ' + M.main(R.due), 'gas', { tab: 'ops' }]); return t;
  };
  const wa = (ph, text) => window.open('https://wa.me/' + (ph ? C.intl(ph) : '') + '?text=' + encodeURIComponent(text), '_blank');
  GZ.heldMsg = clientId => { const cl = client(clientId); if (!cl) return null; const o = db().settings, l = infos().map(i => [pname(i.pid), GZ.held(i.pid, clientId)]).filter(x => x[1] > 0); return { ph: cl.phone || '', text: 'Bonjour ' + cl.name + ',\nvous détenez ' + (l.map(x => x[1] + ' × ' + x[0]).join(', ') || 'aucune bouteille') + ' en consigne chez nous.\n' + o.name + (o.phone ? ' · ' + o.phone : '') }; };
  GZ.print = o => { const s = GZ.stat(o); A.printHtml(A.page('Ticket ' + o.number, who(o), '<p>' + esc({ swap: 'Échange', new: 'Bouteille neuve', back: 'Retour de bouteille', supplier: 'Échange fournisseur' }[o.kind]) + ' · ' + esc(pname(o.pid)) + ' × ' + o.qty + '</p><p><b>Total : ' + esc(M.main(s.total)) + '</b>' + (o.kind === 'new' ? ' (dont consigne ' + esc(M.main(o.dep * o.qty)) + ')' : '') + '</p>')); };

  // ---------- forms ----------
  const after = msg => { App.toast(msg); App.render(); }, ERR = r => { if (r && r.err) { App.toast(r.err, 'err'); return true; } return false; };
  const parentOpts = () => [['', '— Client de passage —'], ...db().clients.slice().sort((a, b) => norm(a.name).localeCompare(norm(b.name))).map(c => [c.id, c.name])], bottleOpts = () => [['', '— Choisir —'], ...infos().map(i => [i.pid, pname(i.pid) + ' (' + i.kg + ' kg)'])];
  GZ.infoForm = id => {
    const i = id && GZ.info(id), prods = [['', '— Choisir —'], ...db().products.filter(p => S.tracked(p)).map(p => [p.id, p.name])], sh = ui.sheet({ title: i ? pname(i.pid) : 'Nouvelle bouteille', html: '<div id="if">' + ui.field('Produit (stock en bouteilles pleines) *', ui.select('pid', prods, i ? i.pid : '')) + '<div class="row2">' + ui.field('Poids (kg) *', ui.input('kg', i ? i.kg : '', { num: 1 })) + ui.field('Prix du gaz (échange) *', ui.input('refill', i ? i.refill : '', { num: 1 })) + '</div>' + ui.field('Consigne de la bouteille', ui.input('deposit', i ? i.deposit : '', { num: 1 })) + '</div>', actions: [...(i ? [{ label: 'Supprimer', cls: 'ghost', fn: async () => { if (await ui.confirm('Supprimer cette fiche ?', 'Supprimer', true)) { const r = GZ.deleteInfo(i); if (r === 'used') App.toast('Des opérations existent pour cette bouteille', 'err'); else { after('Fiche supprimée'); sh.close(); } } return false; } }] : []), { label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: x => { const r = GZ.saveInfo(ui.read(sh.q('#if')), id); if (ERR(r)) return false; after('Fiche enregistrée'); } }] });
  };
  GZ.saleForm = kind => {
    const sh = ui.sheet({ title: kind === 'new' ? 'Bouteille neuve (avec consigne)' : 'Échange de bouteille', html: '<div id="sf">' + ui.field('Bouteille *', ui.select('pid', bottleOpts(), '')) + '<div class="row2">' + ui.field('Quantité *', ui.input('qty', 1, { num: 1 })) + ui.field('Prix unitaire (laisser vide = fiche)', ui.input('price', '', { num: 1 })) + '</div>' + ui.field('Client', ui.select('clientId', parentOpts(), '')) + '<div class="row2">' + ui.field('Montant encaissé', ui.input('paid', '', { num: 1 })) + ui.field('Mode', ui.select('mode', db().settings.modes, db().settings.modes[0])) + '</div><p class="muted">Vide = tout encaissé (client de passage) ou à crédit (client connu).</p></div>', actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Vendre', cls: 'primary', fn: x => { const f = ui.read(sh.q('#sf')); f.kind = kind; ['paid', 'price'].forEach(k => { if (sh.q('[name=' + k + ']').value.trim() === '') f[k] = ''; }); const r = GZ.sell(f); if (ERR(r)) return false; after(r.number + ' · ' + M.main(GZ.stat(r).total)); } }] });
  };
  GZ.backForm = () => {
    const sh = ui.sheet({ title: 'Retour de bouteille', html: '<div id="bf">' + ui.field('Bouteille *', ui.select('pid', bottleOpts(), '')) + '<div class="row2">' + ui.field('Quantité *', ui.input('qty', 1, { num: 1 })) + ui.field('Client', ui.select('clientId', parentOpts(), '')) + '</div>' + ui.field('Mode de remboursement', ui.select('mode', db().settings.modes, db().settings.modes[0])) + '</div>', actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Rembourser la consigne', cls: 'primary', fn: async x => { const f = ui.read(sh.q('#bf')); let r = GZ.back(f); if (r && r.soft && await ui.confirm(r.err + '. Continuer ?', 'Continuer', true)) r = GZ.back({ ...f, force: true }); if (ERR(r)) return false; after(r.number + ' · consigne ' + M.main(r.amount)); } }] });
  };
  GZ.supplierForm = () => {
    const sh = ui.sheet({ title: 'Échange chez le fournisseur', html: '<div id="xf">' + ui.field('Bouteille *', ui.select('pid', bottleOpts(), '')) + '<div class="row2">' + ui.field('Vides envoyés = pleines reçues *', ui.input('qty', '', { num: 1 })) + ui.field('Prix par bouteille', ui.input('unit', '', { num: 1 })) + '</div>' + ui.field('Mode', ui.select('mode', db().settings.modes, db().settings.modes[0])) + '</div>', actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: x => { const r = GZ.supplier(ui.read(sh.q('#xf'))); if (ERR(r)) return false; after(r.number + ' · ' + r.qty + ' bouteille(s)'); } }] });
  };
  const menu = (title, its) => { const m = ui.sheet({ title, html: '<div class="list">' + its.map((x, k) => '<div class="item" data-m="' + k + '" role="button" tabindex="0"><span class="tx"><b>' + esc(x[0]) + '</b></span></div>').join('') + '</div>' }); m.body.querySelectorAll('[data-m]').forEach(e => e.onclick = () => { m.close(); setTimeout(its[+e.dataset.m][1], 220); }); };
  GZ.opMenu = id => {
    const o = ops().find(x => x.id === id); if (!o) return; const s = GZ.stat(o);
    menu(o.number + ' · ' + who(o), [['💳 Encaisser', () => s.inv && A.payForm(s.inv.id), !!s.inv && s.due > 0.004 && App.can('pay')], ['💬 Bouteilles en consigne', () => { const m = GZ.heldMsg(o.clientId); if (m) wa(m.ph, m.text); }, !!o.clientId && GZ.held(o.pid, o.clientId) > 0], ['🖨️ Ticket', () => GZ.print(o), true], ['🧾 Voir la facture', () => s.inv && A.profile(s.inv.id), !!s.inv], ['❌ Annuler l\'opération', async () => { if (await ui.confirm('Annuler ' + o.number + ' ?', 'Annuler', true)) { const r = GZ.cancel(o); if (r === 'sold') App.toast('Ces bouteilles sont déjà vendues', 'err'); else if (r === 'used') App.toast('Des opérations ultérieures en dépendent', 'err'); else after('Opération annulée'); } }, live(o) && App.can('delete')]].filter(x => x[2]).map(x => [x[0], x[1]]));
  };

  // ---------- screen ----------
  const KIND = { swap: ['🔄', 'Échange'], new: ['🆕', 'Neuve'], back: ['↩️', 'Retour'], supplier: ['🚚', 'Fournisseur'] }, pill = (t, tone) => '<span class="pill ' + (tone || '') + '">' + esc(t) + '</span>';
  const row = (id, ic, title, sub, end, attr) => '<div class="swr" style="--n:0"><div class="item" ' + attr + '="' + id + '" role="button" tabindex="0"><span class="av">' + ic + '</span><span class="tx"><b>' + esc(title) + '</b><small>' + sub + '</small></span><span class="end">' + end + '</span></div></div>';
  const st = { tab: 'ops' };
  const tabOps = tab => {
    const l = ops().slice().sort((a, b) => b.at - a.at).slice(0, 80);
    tab.innerHTML = '<div class="tools">' + (App.can('sell') ? '<button class="btn primary" id="n1">🔄 Échange</button><button class="btn ghost" id="n2">🆕 Neuve</button><button class="btn ghost" id="n3">↩️ Retour</button>' : '') + (App.can('stockedit') || App.can('cash') ? '<button class="btn ghost" id="n4">🚚 Fournisseur</button>' : '') + '</div>' + (l.length ? '<div class="list">' + l.map(o => { const s = GZ.stat(o); return row(o.id, KIND[o.kind][0], o.number + ' · ' + KIND[o.kind][1] + ' · ' + pname(o.pid) + ' ×' + o.qty, esc(o.kind === 'supplier' ? App.fmtDate(o.date) : who(o) + ' · ' + App.fmtDate(o.date)), (s.due > 0.004 && live(o) ? '<b class="bad">' + esc(M.main(s.due)) + '</b> ' : o.kind === 'supplier' ? '' : '<b>' + esc(M.main(s.total)) + '</b> ') + (live(o) ? '' : pill('Annulée', 'bad')), 'data-o'); }).join('') + '</div>' : ui.empty('🔥', 'Aucune opération', 'Enregistrez un échange ou une bouteille neuve.', null));
    const q2 = x => tab.querySelector(x); if (q2('#n1')) { q2('#n1').onclick = () => GZ.saleForm('swap'); q2('#n2').onclick = () => GZ.saleForm('new'); q2('#n3').onclick = () => GZ.backForm(); } if (q2('#n4')) q2('#n4').onclick = () => GZ.supplierForm(); tab.querySelectorAll('[data-o]').forEach(i => i.onclick = () => GZ.opMenu(i.dataset.o));
  };
  const tabBottles = tab => {
    const hb = GZ.heldBy();
    tab.innerHTML = '<div class="tools">' + (App.can('stockedit') || App.can('cash') ? '<button class="btn primary" id="ni">+ Bouteille</button>' : '') + '</div>' + (infos().length ? '<div class="list">' + infos().map(i => row(i.id, '🔥', pname(i.pid) + ' · ' + i.kg + ' kg', 'Pleines ' + ((S.get(i.pid) || {}).qty || 0) + ' · vides ' + GZ.empties(i.pid) + ' · chez les clients ' + Math.max(0, GZ.held(i.pid)), '<b>' + esc(M.main(i.refill)) + '</b> ' + pill('consigne ' + M.main(i.deposit)), 'data-i')).join('') + '</div>' : ui.empty('🔥', 'Aucune bouteille', 'Créez une fiche par taille de bouteille (produit, poids, prix, consigne).', null)) + (hb.length ? '<section class="card"><h3>Bouteilles chez les clients</h3><div class="list">' + hb.map(x => row(x.clientId, '👤', (client(x.clientId) || { name: '(supprimé)' }).name, esc(pname(x.pid)), '<b>' + x.n + '</b>', 'data-h')).join('') + '</div></section>' : '');
    if (tab.querySelector('#ni')) tab.querySelector('#ni').onclick = () => GZ.infoForm(); tab.querySelectorAll('[data-i]').forEach(i => i.onclick = () => (App.can('stockedit') || App.can('cash')) && GZ.infoForm(i.dataset.i)); tab.querySelectorAll('[data-h]').forEach(i => i.onclick = () => { const m = GZ.heldMsg(i.dataset.h); if (m) wa(m.ph, m.text); });
  };
  const tabRep = tab => {
    const r = F.range(F.state.r), c = GZ.report(r);
    tab.innerHTML = F.rangeChips() + '<section class="hero"><small>Ventes · ' + esc(r.label) + '</small><div class="amt">' + M.main(c.sales) + '</div><div class="sub">' + c.swaps + ' échange(s) · ' + c.news + ' neuve(s) · ' + c.kg + ' kg</div></section><div class="stats card"><div><b>' + c.full + '</b><small>pleines</small></div><div><b>' + c.empties + '</b><small>vides</small></div><div><b>' + c.held + '</b><small>chez les clients</small></div></div><div class="stats card"><div><b>' + esc(M.main(c.owed)) + '</b><small>consignes dues</small></div><div><b>' + esc(M.main(c.refunds)) + '</b><small>consignes rendues</small></div><div class="' + (c.due > 0.004 ? 'bad' : '') + '"><b>' + esc(M.main(c.due)) + '</b><small>à encaisser</small></div></div><section class="card"><h3>Par bouteille</h3><div class="list">' + (c.by.length ? c.by.map(x => '<div class="item"><span class="av">🔥</span><span class="tx"><b>' + esc(x.name) + '</b><small>' + x.swap + ' échange(s) · ' + x.neu + ' neuve(s) · ' + x.back + ' retour(s)</small></span></div>').join('') : '<p class="muted center">Aucune opération.</p>') + '</div></section><div class="tools"><button class="btn ghost" id="rc">Copier</button><button class="btn ghost" id="rw">💬 WhatsApp</button></div>';
    tab.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { F.state.r = b.dataset.r; tabRep(tab); });
    tab.querySelector('#rc').onclick = () => (navigator.clipboard ? navigator.clipboard.writeText(GZ.reportText(r)) : Promise.reject()).then(() => App.toast('Copié'), () => App.toast('Copie impossible', 'err')); tab.querySelector('#rw').onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent(GZ.reportText(r)), '_blank');
  };
  App.views.gas = { title: 'Gaz', render(el, params) {
    if (params && params.tab) st.tab = params.tab; const tabs = [['ops', 'Opérations'], ['bottles', 'Bouteilles'], ...(App.can('reports') ? [['rep', 'Rapport']] : [])]; if (!tabs.some(t => t[0] === st.tab)) st.tab = 'ops';
    el.innerHTML = '<div class="page"><div class="seg" id="gztabs">' + tabs.map(t => '<button data-t="' + t[0] + '" class="' + (st.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div><div id="gztab" class="page" style="padding:0"></div></div>';
    el.querySelectorAll('#gztabs button').forEach(b => b.onclick = () => { st.tab = b.dataset.t; App.views.gas.render(el); });
    ({ ops: tabOps, bottles: tabBottles, rep: tabRep })[st.tab](el.querySelector('#gztab'));
  } };
  App.quick.push({ label: () => 'Échange de gaz', mod: 'gas', to: 'gas', qc: '#c2410c', ic: '🔥', short: () => 'Gaz', run: () => { App.go('gas', { tab: 'ops' }); setTimeout(() => GZ.saleForm('swap'), 200); } });
})();
