// BTP & chantiers: sites with contract, change orders, costs (stock materials as internal cost, direct purchases, labour, subcontractors, machines, other costs as expenses),
// progress billing as invoices (advance, situations with retention and pro rata advance recovery, final release), planning, site journal, profitability, cash drawer, report. Fictitious data only.
const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'btp' }); await p.evaluate(() => { window.near = (a, b) => Math.abs(a - b) < 0.02; });
  const go = async tab => { await p.evaluate(tb => App.go('btp', { tab: tb }), tab); await p.waitForSelector('#gtabs'); };
  const settle = () => p.waitForFunction(() => document.activeElement && document.activeElement.closest && document.activeElement.closest('.sheet')), ok = () => p.click('.sheet-wrap.on footer .primary'), closeTop = async () => { await p.waitForSelector('.sheet-wrap.on'); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' }); };

  check('secteur « BTP & chantiers » : module activé avec stock et ventes', await p.evaluate(() => App.mod('btp') && App.mod('stock') && App.mod('sales') && App.db.settings.activity === 'btp'));
  check('barre du bas : BTP en tête', (await p.textContent('#tabs')).includes('BTP'));
  await go('sites'); check('écran vide : carte avec bouton d\'action', (await p.locator('#view .empty [data-cta]').count()) === 1);
  await p.evaluate(() => {
    [['ci', 'Ciment (sac)', 10, 8, 100], ['fe', 'Fer à béton', 15, 12, 50]].forEach(a => App.db.products.push({ id: a[0], code: 'PR-' + a[0], name: a[1], cat: 'Général', unit: 'pièce', qty: a[4], min: 5, cost: a[3], price: a[2], track: true, fields: {} }));
    App.db.suppliers.push({ id: 'f1', code: 'FO-0001', name: 'Quincaillerie Test', created: App.today() }); App.db.clients.push({ id: 'c1', code: 'CL-0001', name: 'Client Test', phone: '0990000001', type: 'Particulier', created: App.today(), fields: {} }); App.save(); });

  // site through the form
  await p.click('#cn'); await p.waitForSelector('.sheet [name=name]'); await settle(); await p.fill('.sheet [name=name]', 'Villa Test'); await p.selectOption('.sheet [name=clientId]', 'c1'); await p.fill('.sheet [name=address]', 'Av. des Tests'); await p.fill('.sheet [name=amount]', '10000'); await p.fill('.sheet [name=budget]', '7000'); await p.fill('.sheet [name=advPct]', '10'); await p.fill('.sheet [name=retPct]', '5');
  await ok(); await p.waitForFunction(() => App.db.btChantiers.length === 1); await p.waitForSelector('.sheet-wrap.on .hero'); await closeTop();
  const c1 = await p.evaluate(() => App.db.btChantiers[0].id);
  check('chantier CH-AAAA-0001 : marché 10 000, avance 10 %, retenue 5 %, en cours', await p.evaluate(id => { const c = App.btp.site(id); return /^CH-\d{4}-0001$/.test(c.number) && c.amount === 10000 && c.advPct === 10 && c.retPct === 5 && App.btp.status(c) === 'En cours' && App.btp.stat(c).pct === 0; }, c1));
  check('nom ou marché manquant refusé', await p.evaluate(() => App.btp.addSite({ amount: 1 }) === null && App.btp.addSite({ name: 'X' }) === null));

  // advance and situations (retention, advance recovered pro rata)
  const adv = await p.evaluate(id => { const o = App.btp.addBill({ chId: id, kind: 'advance', amount: 1000 }); return { err: o.err, inv: App.sales.get(o.invoiceId) }; }, c1);
  check('avance de démarrage : facture « BTP » de 1 000, impayée', adv.inv.total === 1000 && adv.inv.source === 'BTP' && adv.inv.lines.length === 1);
  check('situation à 30 % : brut 3 000, retenue 150, avance reprise 300 → facture 2 550 (3 lignes)', await p.evaluate(id => { const o = App.btp.addBill({ chId: id, kind: 'situation', pct: 30 }), i = App.sales.get(o.invoiceId), c = App.btp.site(id); return o.gross === 3000 && o.ret === 150 && o.rec === 300 && i.total === 2550 && i.lines.length === 3 && App.btp.progress(c) === 30 && App.btp.advance(c).left === 700 && App.btp.retained(c).left === 150; }, c1));
  check('avancement inférieur ou égal à l\'actuel, ou au-delà de 100 : refusé', await p.evaluate(id => !!App.btp.addBill({ chId: id, kind: 'situation', pct: 30 }).err && !!App.btp.addBill({ chId: id, kind: 'situation', pct: 120 }).err, c1));
  check('situation à 60 % : 3 000 − 150 − 300 = 2 550 ; avance restante 400, retenue 300', await p.evaluate(id => { const o = App.btp.addBill({ chId: id, kind: 'situation', pct: 60 }), c = App.btp.site(id); return o.net === 2550 && App.btp.advance(c).left === 400 && App.btp.retained(c).left === 300; }, c1));
  await p.evaluate(id => App.btp.opForm('avenant', id), c1); await p.waitForSelector('.sheet [name=what]'); await settle(); await p.fill('.sheet [name=what]', 'Travaux supplémentaires'); await p.fill('.sheet [name=amount]', '1000'); await ok(); await p.waitForFunction(() => App.db.btOps.some(o => o.type === 'avenant')); await closeTop();
  check('avenant +1 000 : marché 11 000 (sans dépense ni facture)', await p.evaluate(id => App.btp.total(App.btp.site(id)) === 11000 && !App.db.expenses.length, c1));
  check('situation à 80 % sur 11 000 : brut 2 800, retenue 140, avance 280 → 2 380', await p.evaluate(id => { const o = App.btp.addBill({ chId: id, kind: 'situation', pct: 80 }); return o.gross === 2800 && o.ret === 140 && o.rec === 280 && o.net === 2380; }, c1));
  check('solde à 100 % : brut 2 200, retenue 110, avance reprise plafonnée à 120 → 1 970, avance entièrement remboursée', await p.evaluate(id => { const o = App.btp.addBill({ chId: id, kind: 'situation', pct: 100 }), c = App.btp.site(id); return o.gross === 2200 && o.ret === 110 && o.rec === 120 && o.net === 1970 && o.label.startsWith('Solde') && App.btp.advance(c).left === 0 && App.btp.retained(c).left === 550; }, c1));

  // payments and cancellations
  await p.evaluate(id => { const a = App.db.btOps.find(o => o.chId === id && o.kind === 'advance'); App.sales.addPayment(App.sales.get(a.invoiceId), { amount: 1000, mode: 'Espèces' }); App.save(); }, c1);
  check('avance payée : caisse +1 000, annulation refusée (paiement)', await p.evaluate(id => App.cash.expected().USD === 1000 && App.btp.cancelOp(App.db.btOps.find(o => o.chId === id && o.kind === 'advance')) === 'paid', c1));
  check('annuler une situation qui n\'est pas la dernière : refusé', await p.evaluate(id => App.btp.cancelOp(App.db.btOps.find(o => o.chId === id && o.kind === 'situation' && o.pct === 30)) === 'later', c1));
  check('annuler le solde (sans paiement) : facture annulée, avancement revient à 80 %', await p.evaluate(id => { const o = App.db.btOps.find(x => x.chId === id && x.pct === 100), i = App.sales.get(o.invoiceId); return App.btp.cancelOp(o) === true && !App.sales.live(i) && App.btp.progress(App.btp.site(id)) === 80; }, c1));

  // costs
  await p.evaluate(id => App.btp.opForm('mat', id), c1); await p.waitForSelector('.sheet [name=qty]'); await settle(); await p.selectOption('.sheet [name=pid]', 'ci'); await p.fill('.sheet [name=qty]', '20'); await ok(); await p.waitForFunction(() => App.db.btOps.some(o => o.type === 'mat')); await closeTop();
  check('matériaux 20 sacs : stock 80, coût interne 160, aucune dépense, numéro BT-AAAA-', await p.evaluate(() => { const o = App.db.btOps.find(x => x.type === 'mat'); return /^BT-\d{4}-\d{4}$/.test(o.number) && o.cost === 160 && App.stock.get('ci').qty === 80 && !App.db.expenses.length; }));
  check('matériau au-delà du stock refusé', await p.evaluate(id => App.btp.addOp({ type: 'mat', chId: id, pid: 'ci', qty: 999 }) === null, c1));
  await p.evaluate(id => App.btp.opForm('labor', id), c1); await p.waitForSelector('.sheet [name=workers]'); await settle(); await p.fill('.sheet [name=workers]', '3'); await p.fill('.sheet [name=days]', '10'); await p.fill('.sheet [name=rate]', '15'); await ok(); await p.waitForFunction(() => App.db.btOps.some(o => o.type === 'labor')); await closeTop();
  check('main-d\'œuvre 3 × 10 j × 15 = 450 : dépense « Main-d\'œuvre chantier »', await p.evaluate(() => { const o = App.db.btOps.find(x => x.type === 'labor'), e = App.db.expenses.find(x => x.id === o.expenseId); return o.amount === 450 && o.dayRate === 15 && e.amount === 450 && e.category === 'Main-d\'œuvre chantier'; }));
  await p.evaluate(id => { const B = App.btp; B.addOp({ type: 'buy', chId: id, amount: 200, what: '50 sacs de ciment', supplierId: 'f1' }); B.addOp({ type: 'sub', chId: id, amount: 500, who: 'Électricien Test' }); B.addOp({ type: 'equip', chId: id, amount: 300, what: 'Location pelleteuse' }); B.addOp({ type: 'cost', chId: id, amount: 100, kind: 'Transport' }); }, c1);
  check('achat 200 (fournisseur lié), sous-traitant 500, engin 300, autre frais 100 : 4 dépenses', await p.evaluate(() => { const c = App.db.expenses.map(e => e.category); return App.db.expenses.length === 5 && c.includes('Matériaux chantier') && c.includes('Sous-traitance') && c.includes('Engins & carburant') && c.includes('Charges chantier') && App.db.expenses.find(e => e.category === 'Matériaux chantier').supplierId === 'f1'; }));
  check('coûts = 160 + 450 + 200 + 500 + 300 + 100 = 1 710 ; réalisé 80 % de 11 000 = 8 800 ; marge 7 090 ; budget utilisé 24,4 %', await p.evaluate(id => { const s = App.btp.stat(App.btp.site(id)); return s.costs === 1710 && s.earned === 8800 && near(s.margin, 7090) && s.used === 24.4 && s.mat === 160 && s.labor === 450; }, c1));
  check('caisse en espèces : +1 000 − 1 550 = −550', await p.evaluate(() => App.cash.expected().USD === -550));
  await p.evaluate(() => { const l = App.db.btOps.find(o => o.type === 'mat'); App.btp.cancelOp(l); App.btp.cancelOp(App.db.btOps.find(o => o.type === 'labor')); });
  check('annuler matériau et main-d\'œuvre : stock remis (100), dépense supprimée, coûts 1 100', await p.evaluate(id => App.stock.get('ci').qty === 100 && App.db.expenses.length === 4 && App.btp.stat(App.btp.site(id)).costs === 1100, c1));

  // planning and journal through the forms
  await p.evaluate(id => App.btp.taskForm(id), c1); await p.waitForSelector('.sheet [name=title]'); await settle(); await p.fill('.sheet [name=title]', 'Fondations'); await p.fill('.sheet [name=date]', await p.evaluate(() => App.addDays(App.today(), -3))); await ok(); await p.waitForFunction(() => App.db.btTasks.length === 1); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('étape « Fondations » en retard : comptée, remonte sur l\'accueil', await p.evaluate(() => App.btp.late().length === 1 && App.btp.todo().some(x => x[0].includes('en retard'))));
  await go('plan'); await p.click('#gtab [data-d]'); await p.waitForFunction(() => App.db.btTasks[0].done); check('étape terminée : plus en retard', await p.evaluate(() => App.btp.late().length === 0));
  await p.evaluate(id => App.btp.logForm(id), c1); await p.waitForSelector('.sheet [name=work]'); await settle(); await p.selectOption('.sheet [name=weather]', 'Pluie'); await p.fill('.sheet [name=workers]', '8'); await p.fill('.sheet [name=work]', 'Coulage de la dalle'); await ok(); await p.waitForFunction(() => App.db.btLogs.length === 1); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('journal : météo, effectif et travaux enregistrés', await p.evaluate(() => { const l = App.db.btLogs[0]; return l.weather === 'Pluie' && l.workers === 8 && l.work === 'Coulage de la dalle'; }));
  await go('log'); check('onglet Journal : 1 entrée', (await p.locator('#gtab [data-g]').count()) === 1);

  // closing and release of the retention
  check('retenue à libérer à la clôture : rappel sur l\'accueil', await p.evaluate(id => { App.btp.addBill({ chId: id, kind: 'situation', pct: 100 }); App.btp.setClosed(App.btp.site(id), true); return App.btp.todo().some(x => x[0].includes('retenue')); }, c1));
  check('chantier clos : plus d\'opération ni de situation', await p.evaluate(id => App.btp.addOp({ type: 'cost', chId: id, amount: 5 }) === null && !!App.btp.addBill({ chId: id, kind: 'situation', pct: 100 }).err && App.btp.status(App.btp.site(id)) === 'Terminé', c1));
  check('libération de la retenue : facture de 550, retenue restante 0', await p.evaluate(id => { const o = App.btp.addBill({ chId: id, kind: 'release' }), c = App.btp.site(id); return o.net === 550 && App.sales.get(o.invoiceId).total === 550 && App.btp.retained(c).left === 0 && !!App.btp.addBill({ chId: id, kind: 'release' }).err; }, c1));
  check('monnaie du chantier verrouillée une fois facturé', await p.evaluate(id => { const c = App.btp.site(id); App.btp.addSite({ name: c.name, amount: c.amount, clientId: c.clientId, advPct: c.advPct, retPct: c.retPct, currency: 'CDF' }, id); return c.currency === 'USD'; }, c1));

  // screens, report, messages
  const r = await p.evaluate(() => { const c = App.btp.report({ from: '0000-00-00', to: '9999-99-99', label: 'Tout' }); return { billed: c.billed > 0, costs: c.costs, n: c.n, as: c.as.length }; });
  check('rapport : factures comptées, coûts 1 100, chantier clos non « en cours »', r.billed && r.costs === 1100 && r.n === 0 && r.as === 1);
  for (const tab of ['sites', 'plan', 'log', 'ops', 'rep']) { await go(tab); check('onglet ' + tab + ' s\'affiche sans erreur', (await p.locator('#gtab').innerHTML()).length > 80); }
  await go('sites'); await p.click('#gtab [data-c]'); await p.waitForSelector('.sheet .hero'); check('fiche chantier : avancement 100 %, coûts et marge, boutons Facturer / Plus', (await p.textContent('.sheet .hero')).includes('100') && (await p.textContent('.sheet')).includes('Marge à ce jour') && (await p.textContent('.sheet-wrap.on footer')).includes('Facturer')); await closeTop();
  const msg = await p.evaluate(id => App.btp.msg(App.btp.site(id)), c1);
  check('message WhatsApp au client : nom du chantier, avancement et reste à payer', msg.includes('Villa Test') && msg.includes('100') && msg.includes('Client Test'), msg);
  check('Synchro : les collections sont partagées', await p.evaluate(() => ['btChantiers', 'btOps', 'btTasks', 'btLogs'].every(k => Array.isArray(App.db[k]))));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
