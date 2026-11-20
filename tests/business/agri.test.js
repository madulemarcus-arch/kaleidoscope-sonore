// Agriculture & élevage: plots, crop cycles and herds, inputs from the stock (internal cost, no second expense), labour and costs as expenses, harvest / production into the stock,
// sales as invoices, headcount and mortality, task calendar, closing, profitability per activity, cash drawer, reports, export. Fictitious data only.
const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'agri' });
  const go = async tab => { await p.evaluate(tb => App.go('agri', { tab: tb }), tab); await p.waitForSelector('#gtabs'); };
  const ok = () => p.click('.sheet-wrap.on footer .primary'), closeTop = async () => { await p.waitForSelector('.sheet-wrap.on'); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' }); };
  const all = { from: '0000-00-00', to: '9999-99-99' };

  check('secteur « Agriculture & élevage » : module activé avec stock et ventes', await p.evaluate(() => App.mod('agri') && App.mod('stock') && App.mod('sales') && App.db.settings.activity === 'agri'));
  check('barre du bas : Agriculture en tête', (await p.textContent('#tabs')).includes('Agriculture'));
  await go('acts'); check('écran vide : carte avec bouton d\'action', (await p.locator('#view .empty [data-cta]').count()) === 1);
  await p.evaluate(() => {
    [['se', 'Semences maïs', 3, 2, 50], ['ma', 'Maïs récolté', 1, 0, 0], ['oe', 'Œufs', 0.2, 0, 0]].forEach(a => App.db.products.push({ id: a[0], code: 'PR-' + a[0], name: a[1], cat: 'Général', unit: 'pièce', qty: a[4], min: 5, cost: a[3], price: a[2], track: true, fields: {} }));
    App.db.clients.push({ id: 'c1', code: 'CL-0001', name: 'Client Test', phone: '0990000001', type: 'Particulier', created: App.today(), fields: {} }); App.save(); });

  // plot and crop through the forms
  await go('plots'); await p.click('#pn'); await p.waitForSelector('.sheet [name=name]'); await p.fill('.sheet [name=name]', 'Champ Test'); await p.fill('.sheet [name=area]', '2'); await ok(); await p.waitForFunction(() => App.db.agPlots.length === 1); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('parcelle de 2 ha enregistrée', await p.evaluate(() => App.db.agPlots[0].area === 2 && App.db.agPlots[0].name === 'Champ Test'));
  await go('acts'); await p.evaluate(() => App.agri.actForm(null, 'culture')); await p.waitForSelector('.sheet [name=name]'); await p.fill('.sheet [name=name]', 'Maïs A'); await p.selectOption('.sheet [name=plotId]', { index: 1 }); await p.selectOption('.sheet [name=productId]', 'ma'); await ok(); await p.waitForFunction(() => App.db.agActs.length === 1); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  const ca = await p.evaluate(() => App.db.agActs[0].id);
  check('culture AC-AAAA-0001 : maïs sur la parcelle, produit en stock lié, surface = celle de la parcelle', await p.evaluate(id => { const a = App.agri.act(id); return /^AC-\d{4}-0001$/.test(a.number) && a.kind === 'culture' && a.productId === 'ma' && App.agri.stat(a).ha === 2 && App.agri.status(a) === 'En cours'; }, ca));
  const el = await p.evaluate(() => App.agri.addAct({ kind: 'elevage', name: 'Poulailler', crop: 'Poules pondeuses', heads0: 100, productId: 'oe', unit: 'œuf' }).id);
  check('élevage : effectif de départ 100, mortalité 0', await p.evaluate(id => { const a = App.agri.act(id), s = App.agri.stat(a); return s.heads === 100 && s.mort.pct === 0; }, el));

  // inputs: taken from the stock, internal cost only (the purchase was already an expense)
  await p.evaluate(id => App.agri.opForm('input', id), ca); await p.waitForSelector('.sheet [name=qty]'); await p.selectOption('.sheet [name=pid]', 'se'); await p.fill('.sheet [name=qty]', '10'); check('intrant : coût interne affiché (10 × 2 = 20)', (await p.textContent('.sheet #ic')).includes('20')); await ok(); await p.waitForFunction(() => App.db.agOps.length === 1); await closeTop();
  check('intrant : stock −10, coût 20, aucune dépense créée, numéro AG-AAAA-0001', await p.evaluate(() => { const o = App.db.agOps[0]; return /^AG-\d{4}-0001$/.test(o.number) && o.cost === 20 && App.stock.get('se').qty === 40 && !App.db.expenses.length; }));
  check('intrant au-delà du stock refusé', await p.evaluate(id => App.agri.addOp({ type: 'input', actId: id, pid: 'se', qty: 999 }) === null, ca));

  // labour and other costs are real expenses (cash drawer)
  await p.evaluate(id => App.agri.opForm('labor', id), ca); await p.waitForSelector('.sheet [name=workers]'); await p.fill('.sheet [name=workers]', '2'); await p.fill('.sheet [name=days]', '3'); await p.fill('.sheet [name=rate]', '5'); await ok(); await p.waitForFunction(() => App.db.agOps.length === 2); await closeTop();
  check('main-d\'œuvre 2 × 3 j × 5 = 30 : dépense « Main-d\'œuvre agricole »', await p.evaluate(() => { const o = App.db.agOps[1], e = App.db.expenses.find(x => x.id === o.expenseId); return o.amount === 30 && e && e.amount === 30 && e.category === 'Main-d\'œuvre agricole'; }));
  await p.evaluate(id => App.agri.opForm('cost', id), ca); await p.waitForSelector('.sheet [name=amount]'); await p.selectOption('.sheet [name=kind]', 'Location de matériel'); await p.fill('.sheet [name=amount]', '50'); await ok(); await p.waitForFunction(() => App.db.agOps.length === 3); await closeTop();
  check('charge 50 : dépense « Charges agricoles »', await p.evaluate(() => { const e = App.db.expenses.find(x => x.id === App.db.agOps[2].expenseId); return e && e.amount === 50 && e.category === 'Charges agricoles'; }));
  check('caisse en espèces : −30 −50 = −80', await p.evaluate(() => App.cash.expected().USD === -80));

  // harvest into the stock, sale as an invoice
  await p.evaluate(id => App.agri.opForm('output', id), ca); await p.waitForSelector('.sheet [name=qty]'); await p.fill('.sheet [name=qty]', '300'); await ok(); await p.waitForFunction(() => App.db.agOps.length === 4); await closeTop();
  check('récolte 300 kg : stock du produit lié +300, rendement 150 kg/ha', await p.evaluate(id => { const s = App.agri.stat(App.agri.act(id)); return App.stock.get('ma').qty === 300 && s.out === 300 && s.perHa === 150; }, ca));
  const s1 = await p.evaluate(id => { const o = App.agri.addOp({ type: 'sale', actId: id, qty: 100, price: 1, pay: true, clientId: 'c1' }); const i = App.sales.get(o.invoiceId); return { id: o.id, inv: i.number, total: i.total, due: App.sales.due(i), src: i.source, cid: i.clientId, pid: i.lines[0].pid }; }, ca);
  check('vente de 100 kg payée : facture « Agriculture » de 100, stock sorti', s1.total === 100 && s1.due === 0 && s1.src === 'Agriculture' && s1.cid === 'c1' && s1.pid === 'ma' && await p.evaluate(() => App.stock.get('ma').qty === 200));
  check('vente supérieure au stock refusée', await p.evaluate(id => App.agri.addOp({ type: 'sale', actId: id, qty: 500, price: 1 }) === null, ca));
  await p.evaluate(id => App.agri.opForm('sale', id), ca); await p.waitForSelector('.sheet [name=qty]'); check('vente : stock disponible affiché (200)', (await p.textContent('.sheet #sa')).includes('200')); await p.fill('.sheet [name=qty]', '50'); await p.selectOption('.sheet [name=pay]', ''); await ok(); await p.waitForFunction(() => App.db.agOps.length === 6); await closeTop();
  const s2 = await p.evaluate(() => { const o = App.db.agOps[5], i = App.sales.get(o.invoiceId); return { id: o.id, due: App.sales.due(i), unpaid: App.sales.unpaidList().some(x => x.id === i.id) }; });
  check('vente à crédit : 50 dans les impayés', s2.due === 50 && s2.unpaid);
  check('rentabilité : ventes 150, charges 20 + 30 + 50 = 100, marge 50, coût par kg 0,33', await p.evaluate(id => { const s = App.agri.stat(App.agri.act(id)); return s.revenue === 150 && s.inputs === 20 && s.labor === 30 && s.other === 50 && s.costs === 100 && s.margin === 50 && Math.abs(s.perUnit - 100 / 300) < 1e-9 && s.sold === 150 && s.left === 150; }, ca));
  check('annuler la vente à crédit : facture annulée, stock remis (250), ventes 100', await p.evaluate(id => { const o = App.agri.op(id), r = App.agri.cancelOp(o); return r === true && o.status === 'Annulé' && App.sales.get(o.invoiceId).cancelled && App.stock.get('ma').qty === 200 && App.agri.stat(App.agri.act(App.db.agOps[0].actId)).revenue === 100; }, s2.id));
  check('annuler une vente déjà payée : refusé tant que des paiements existent', await p.evaluate(id => App.agri.cancelOp(App.agri.op(id)) === 'paid', s1.id));
  check('annuler la récolte alors qu\'une partie est vendue : refusé', await p.evaluate(() => App.agri.cancelOp(App.db.agOps[3]) === false && App.db.agOps[3].status === 'Valide'));
  check('annuler la main-d\'œuvre : la dépense liée est supprimée', await p.evaluate(() => { const o = App.db.agOps[1], n = App.db.expenses.length, r = App.agri.cancelOp(o); const back = App.agri.addOp({ type: 'labor', actId: o.actId, workers: 2, days: 3, rate: 5 }); return r === true && App.db.expenses.length === n - 1 + 1 && !!back; }));

  // livestock: headcount, mortality, production, sales of animals
  await p.evaluate(id => { const P = App.agri; P.addOp({ type: 'heads', actId: id, reason: 'Naissance', delta: 10 }); P.addOp({ type: 'heads', actId: id, reason: 'Achat', delta: 20, amount: 40 }); }, el);
  await p.evaluate(id => App.agri.opForm('heads', id), el); await p.waitForSelector('.sheet [name=reason]'); await p.selectOption('.sheet [name=reason]', 'Mort'); await p.fill('.sheet [name=delta]', '5'); await ok(); await p.waitForFunction(() => App.db.agOps.filter(o => o.type === 'heads').length === 3); await closeTop();
  check('effectif 100 + 10 + 20 − 5 = 125, mortalité 5 / 130 = 3,8 %', await p.evaluate(id => { const s = App.agri.stat(App.agri.act(id)); return s.heads === 125 && s.mort.dead === 5 && s.mort.pct === 3.8; }, el));
  check('achat d\'animaux 40 : dépense « Charges agricoles », compté dans les charges', await p.evaluate(id => { const s = App.agri.stat(App.agri.act(id)); return s.bought === 40 && s.costs === 40 && App.db.expenses.some(e => e.amount === 40 && e.category === 'Charges agricoles'); }, el));
  check('mort de plus de têtes que l\'effectif refusée', await p.evaluate(id => App.agri.addOp({ type: 'heads', actId: id, reason: 'Mort', delta: -999 }) === null, el));
  await p.evaluate(id => { const P = App.agri; P.addOp({ type: 'output', actId: id, qty: 600 }); P.addOp({ type: 'sale', actId: id, qty: 200, price: 0.2, pay: true }); P.addOp({ type: 'sale', actId: id, qty: 10, price: 5, animals: true, pay: true }); }, el);
  check('production 600 œufs : stock +600, vente de 200 œufs (−200), vente de 10 animaux : effectif 115, pas de mouvement de stock', await p.evaluate(id => { const s = App.agri.stat(App.agri.act(id)); return App.stock.get('oe').qty === 400 && s.heads === 115 && s.revenue === 90 && s.sold === 200; }, el));
  check('vente d\'animaux supérieure à l\'effectif refusée', await p.evaluate(id => App.agri.addOp({ type: 'sale', actId: id, qty: 9999, price: 1, animals: true }) === null, el));
  check('mortalité élevée (25 / 130 = 19,2 %) : alerte « À faire »', await p.evaluate(id => { App.agri.addOp({ type: 'heads', actId: id, reason: 'Mort', delta: -20 }); return App.agri.stat(App.agri.act(id)).mort.pct === 19.2 && App.agri.todo().some(x => /Mortalité élevée/.test(x[0])); }, el));

  // calendar: tasks and alerts, closing
  await p.evaluate(id => { App.db.agTasks.push({ id: 't1', title: 'Traitement', actId: id, date: App.addDays(App.today(), -2), done: false }, { id: 't2', title: 'Vaccin', actId: id, date: App.addDays(App.today(), 2), done: false }); App.save(); }, el);
  check('tâches : une en retard, une sous 3 jours, dans « À faire »', await p.evaluate(() => { const t = App.agri.todo().map(x => x[0]).join('|'); return App.agri.late().length === 1 && App.agri.soon(3).length === 1 && /en retard/.test(t) && /sous 3 jours/.test(t); }));
  await go('tasks'); await p.waitForSelector('#gtab .hero'); await p.click('#gtab [data-d="t1"]'); await p.waitForFunction(() => App.db.agTasks[0].done === true);
  check('tâche cochée « Fait » : plus de retard', await p.evaluate(() => App.agri.late().length === 0 && App.db.agTasks[0].doneAt === App.today()));
  check('activité dont la fin prévue est passée : « À clôturer » signalé', await p.evaluate(id => { App.agri.act(id).end = App.addDays(App.today(), -1); return App.agri.status(App.agri.act(id)) === 'À clôturer' && App.agri.todo().some(x => /à clôturer/.test(x[0])); }, ca));
  await p.evaluate(id => App.agri.actSheet(id), ca); await p.waitForSelector('.sheet-wrap.on >> text=Plus'); check('fiche : marge, charges et rendement affichés', (await p.textContent('.sheet-wrap.on')).includes('Marge') && (await p.textContent('.sheet-wrap.on')).includes('Charges') && (await p.textContent('.sheet-wrap.on')).includes('/ ha')); await p.click('.sheet-wrap.on footer button:has-text("Plus")'); await p.waitForSelector('.sheet-wrap.on [data-x="c"]'); await p.click('.sheet-wrap.on [data-x="c"]'); await p.waitForFunction(id => App.agri.act(id).closed, ca); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('activité clôturée : plus d\'opération possible', await p.evaluate(id => App.agri.status(App.agri.act(id)) === 'Clôturée' && App.agri.addOp({ type: 'cost', actId: id, amount: 1 }) === null, ca));

  // reports, export, screens
  check('rapport du mois : ventes 190 (100 + 50 animaux + 40 œufs), charges 140 (100 + 40)', await p.evaluate(() => { const r = App.agri.report(App.fin.range('month')); return Math.abs(r.rev - 190) < 1e-9 && Math.abs(r.costs - 140) < 1e-9; }));
  check('dépenses du rapport financier : 30 + 50 + 40 = 120 (les intrants ne sont pas comptés deux fois)', await p.evaluate(a => App.reports.compute(a).exp === 120, all));
  await go('acts'); check('Activités : les deux activités listées avec leur marge', (await p.locator('#gtab [data-a]').count()) === 2);
  await go('plots'); check('Parcelles : surface totale 2 ha', (await p.textContent('#gtab')).includes('2 ha'));
  await go('ops'); await p.waitForSelector('#gtab .hero'); check('Opérations : liste du mois', (await p.locator('#gtab [data-o]').count()) >= 8);
  await go('rep'); await p.waitForSelector('#gtab .hero'); check('rapport : rentabilité par activité', (await p.textContent('#gtab')).includes('Rentabilité par activité') && (await p.textContent('#gtab')).includes('Poulailler'));
  check('rapport en texte (WhatsApp)', await p.evaluate(() => App.agri.reportText(App.fin.range('month')).includes('Marge') || App.agri.reportText(App.fin.range('month')).includes('marge')));
  check('Excel : feuilles Parcelles, Activités agricoles, Opérations agricoles, Tâches agricoles', await p.evaluate(() => { const n = App.data.tables().map(x => x.name); return ['Parcelles', 'Activités agricoles', 'Opérations agricoles', 'Tâches agricoles'].every(x => n.includes(x)); }));
  check('Synchro : les collections sont partagées', await p.evaluate(() => ['agPlots', 'agActs', 'agOps', 'agTasks'].every(k => Array.isArray(App.db[k]))));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
