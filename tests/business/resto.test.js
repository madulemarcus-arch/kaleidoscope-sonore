// Restaurant & bar: tables, menu (dishes with recipe, tracked drinks), orders taken at the table, kitchen and bar queues, discount and service charge, payment (change, split between
// payment modes) as one invoice, stock and recipe consumption, takeaway and delivery, bookings, report. Fictitious data only.
const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'restauration' }); await p.evaluate(() => { window.near = (a, b) => Math.abs(a - b) < 0.005; });
  const near = (a, b) => Math.abs(a - b) < 0.005;
  const go = async tab => { await p.evaluate(tb => App.go('resto', { tab: tb }), tab); await p.waitForSelector('#gtabs'); };
  const settle = () => p.waitForFunction(() => document.activeElement && document.activeElement.closest && document.activeElement.closest('.sheet')), ok = () => p.click('.sheet-wrap.on footer .primary'), closeTop = async () => { await p.waitForSelector('.sheet-wrap.on'); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' }); };

  check('secteur « Restauration » : module Restaurant activé avec stock, ventes et livraisons', await p.evaluate(() => App.mod('resto') && App.mod('stock') && App.mod('sales') && App.mod('delivery') && App.db.settings.activity === 'restauration' && App.vocab('product') === 'plat'));
  check('barre du bas : Restaurant en tête', (await p.textContent('#tabs')).includes('Restaurant'));
  await p.evaluate(() => { [['po', 'Poulet', 'kg', 5, 20], ['ri', 'Riz', 'kg', 1, 50]].forEach(a => App.db.products.push({ id: a[0], code: 'PR-' + a[0], name: a[1], cat: 'Général', unit: a[2], qty: a[4], min: 0, cost: a[3], price: 0, track: true, fields: {} })); App.db.staff.push({ id: 'sv', name: 'Serveur Test' }); App.db.clients.push({ id: 'c1', code: 'CL-0001', name: 'Client Test', phone: '0990000001', type: 'Particulier', created: App.today(), fields: {} }); App.save(); });
  await go('tables'); check('écran vide : carte avec bouton d\'action', (await p.locator('#gtab .empty [data-cta]').count()) === 1);
  await p.click('#tn'); await p.waitForSelector('.sheet [name=name]'); await settle(); await p.fill('.sheet [name=name]', 'Table 1'); await p.fill('.sheet [name=seats]', '4'); await ok(); await p.waitForFunction(() => App.db.rsTables.length === 1); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  await p.evaluate(() => { App.resto.addTable({ name: 'Table 2', seats: 2, zone: 'Terrasse' }); });
  check('tables : nom unique exigé', await p.evaluate(() => App.db.rsTables.length === 2 && App.resto.addTable({ name: 'table 1' }) === null && App.resto.addTable({}) === null));

  // menu: a dish with a recipe through the form, a tracked drink, a free item
  await go('menu'); await p.click('#in'); await p.waitForSelector('.sheet [name=name]'); await settle(); await p.fill('.sheet [name=name]', 'Poulet braisé'); await p.fill('.sheet [name=price]', '10');
  await p.click('.sheet #ar'); await p.waitForFunction(() => document.querySelectorAll('.sheet .ri').length === 1); await p.selectOption('.sheet .ri >> nth=0 >> [name=ip]', 'po'); await p.fill('.sheet .ri >> nth=0 >> [name=iq]', '0.5');
  await p.click('.sheet #ar'); await p.waitForFunction(() => document.querySelectorAll('.sheet .ri').length === 2); await p.selectOption('.sheet .ri >> nth=1 >> [name=ip]', 'ri'); await p.fill('.sheet .ri >> nth=1 >> [name=iq]', '0.3');
  check('aperçu de la recette : coût 2,80 et marge 7,20', await p.evaluate(() => { const x = document.querySelector('.sheet #rc').textContent.replace(/\s/g, ''); return x.includes('2,80') && x.includes('7,20'); }));
  await ok(); await p.waitForFunction(() => App.db.rsMenu.length === 1); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  await p.evaluate(() => { const R = App.resto; R.addItem({ name: 'Bière 65 cl', cat: 'Bière', dest: 'Bar', price: 3, cost: 1.5, track: true, qty: 24 }); R.addItem({ name: 'Jus de mangue', cat: 'Boisson', dest: 'Aucune', price: 2 }); });
  check('carte : plat sans stock suivi (recette, coût 2,80), bière suivie (stock 24, coût 1,50), jus servi sans préparation', await p.evaluate(() => { const R = App.resto, m = App.db.rsMenu, a = App.stock.get(m[0].pid), b = App.stock.get(m[1].pid), c = App.stock.get(m[2].pid); return !App.stock.tracked(a) && a.price === 10 && near(R.cost(m[0]), 2.8) && App.stock.tracked(b) && b.qty === 24 && R.cost(m[1]) === 1.5 && m[0].dest === 'Cuisine' && m[1].dest === 'Bar' && m[2].dest === 'Aucune' && !App.stock.tracked(c); }));
  check('article refusé : sans nom, catégorie inconnue, prix manquant', await p.evaluate(() => App.resto.addItem({ cat: 'Plat', price: 1 }) === null && App.resto.addItem({ name: 'X', cat: 'Nope', price: 1 }) === null && App.resto.addItem({ name: 'X', cat: 'Plat', price: '' }) === null));
  const mids = await p.evaluate(() => App.db.rsMenu.map(m => m.id));

  // order at the table through the forms
  await go('tables'); await p.click('#on'); await p.waitForSelector('.sheet [name=tableId]'); await settle(); await p.fill('.sheet [name=covers]', '3'); await p.selectOption('.sheet [name=serverId]', 'sv'); await ok(); await p.waitForSelector('.sheet #pl [data-m]');
  await p.click('.sheet #pl [data-m="' + mids[0] + '"]'); await p.click('.sheet #pl [data-m="' + mids[0] + '"]'); await p.click('.sheet #pl [data-m="' + mids[1] + '"]'); await p.click('.sheet #pl [data-m="' + mids[1] + '"]'); await p.click('.sheet #pl [data-m="' + mids[1] + '"]'); await p.click('.sheet #pl [data-m="' + mids[2] + '"]');
  await ok(); await p.waitForSelector('.sheet-wrap.on .hero'); await closeTop();
  const o1 = await p.evaluate(() => App.db.rsOrders[0].id);
  check('commande CD-AAAA-0001 sur Table 1 : 3 couverts, serveur, poulet ×2 (cuisine), bière ×3 (bar), jus ×1 (servi d\'office)', await p.evaluate(id => { const o = App.resto.order(id), L = o.lines; return /^CD-\d{4}-0001$/.test(o.number) && o.status === 'Ouverte' && o.covers === 3 && o.serverId === 'sv' && L.length === 3 && L[0].qty === 2 && L[0].status === 'À préparer' && L[0].dest === 'Cuisine' && L[1].qty === 3 && L[1].dest === 'Bar' && L[2].status === 'Servi'; }, o1));
  check('table occupée ; une 2e commande sur la même table refusée ; sans table refusée', await p.evaluate(id => { const R = App.resto, t = R.table(R.order(id).tableId); return R.tableState(t) === 'Occupée' && !!R.addOrder({ kind: 'Sur place', tableId: t.id }).err && !!R.addOrder({ kind: 'Sur place' }).err; }, o1));
  check('addition : 2 × 10 + 3 × 3 + 2 = 31', await p.evaluate(id => App.resto.total(App.resto.order(id)).total === 31, o1));

  // kitchen and bar
  check('cuisine : 1 article à préparer (poulet) ; bar : 1 (bière)', await p.evaluate(() => App.resto.queue('Cuisine').length === 1 && App.resto.queue('Bar').length === 1 && App.resto.queue().length === 2));
  await go('kitchen'); check('écran cuisine : le poulet attend, avec le nom de la table', (await p.textContent('#gtab')).includes('Poulet braisé') && (await p.textContent('#gtab')).includes('Table 1')); await p.click('#gtab [data-r]'); await p.waitForFunction(() => App.resto.queue('Cuisine').length === 0);
  check('« Prêt » : le poulet quitte la file, statut Prêt ; le bar attend encore', await p.evaluate(id => App.resto.order(id).lines[0].status === 'Prêt' && App.resto.queue('Bar').length === 1, o1));
  check('note pour la cuisine et retrait d\'une portion', await p.evaluate(id => { const R = App.resto, o = R.order(id), l = R.addLine(o, o.lines[2].mid, 1, 'sans glaçons'); return l.note === 'sans glaçons' && R.voidLine(o, l, 'Erreur') && l.status === 'Annulé' && R.total(o).total === 31; }, o1));

  // discount, service charge, payment with change
  await p.evaluate(id => { App.resto.cfg().service = 10; App.resto.setDisc(App.resto.order(id), 10); }, o1);
  check('remise 10 % et service 10 % : 31 − 3,10 + 2,79 = 30,69', await p.evaluate(id => { const t = App.resto.total(App.resto.order(id)); return t.sub === 31 && t.disc === 3.1 && t.fee === 2.79 && t.total === 30.69; }, o1));
  check('encaissement insuffisant refusé', await p.evaluate(id => !!App.resto.pay(App.resto.order(id), [{ mode: 'Espèces', amount: 20 }]).err, o1));
  await p.evaluate(id => App.resto.orderSheet(id), o1); await p.waitForSelector('.sheet .hero'); await p.click('.sheet-wrap.on footer >> text=Encaisser'); await p.waitForSelector('.sheet [name=m0]'); await settle(); await p.fill('.sheet [name=m0]', '40');
  check('paiement : « À rendre 9,31 »', (await p.textContent('.sheet #pc2')).replace(/\s/g, '').includes('9,31'));
  await ok(); await p.waitForFunction(id => App.resto.order(id).status === 'Payée', o1); await p.waitForSelector('.sheet-wrap.on .hero'); await closeTop();
  check('facture « Restaurant » de 30,69 payée (seule l\'addition est enregistrée), monnaie 9,31', await p.evaluate(id => { const o = App.resto.order(id), i = App.sales.get(o.invoiceId); return i.source === 'Restaurant' && i.total === 30.69 && App.sales.due(i) === 0 && App.sales.paid(i) === 30.69 && o.change === 9.31 && i.lines.some(l => l.desc.includes('Remise') && l.price === -3.1) && i.lines.some(l => l.desc.startsWith('Service')); }, o1));
  check('stock : bière 24 − 3 = 21 ; recette : poulet 20 − 1 = 19 kg, riz 50 − 0,6 = 49,4 kg ; caisse +30,69', await p.evaluate(() => App.db.products.find(x => x.name === 'Bière 65 cl').qty === 21 && near(App.stock.get('po').qty, 19) && near(App.stock.get('ri').qty, 49.4) && near(App.cash.expected().USD, 30.69)));
  check('commande payée : table libre, plus modifiable ni annulable', await p.evaluate(id => { const R = App.resto, o = R.order(id); return R.tableState(R.table(o.tableId)) === 'Libre' && R.addLine(o, o.lines[0].mid, 1) === null && R.cancel(o) === false && o.lines.every(l => l.status === 'Servi' || l.status === 'Annulé'); }, o1));

  // split payment, takeaway, delivery
  const sp = await p.evaluate(() => { const R = App.resto, o = R.addOrder({ kind: 'Sur place', tableId: App.db.rsTables[1].id, covers: 2 }); R.cfg().service = 0; R.addLine(o, App.db.rsMenu[0].id, 1); R.addLine(o, App.db.rsMenu[1].id, 1); const r = R.pay(o, [{ mode: 'Espèces', amount: 5 }, { mode: 'Mobile money', amount: 8 }]); const ps = App.sales.payments(App.sales.get(o.invoiceId)); return { err: r.err, total: App.sales.get(o.invoiceId).total, modes: ps.map(x => x.mode + x.amount).sort().join() }; });
  check('addition de 13 payée en deux fois : espèces 5 + mobile money 8', !sp.err && sp.total === 13 && sp.modes === 'Espèces5,Mobile money8');
  const tk = await p.evaluate(() => { const R = App.resto, o = R.addOrder({ kind: 'À emporter' }); R.addLine(o, App.db.rsMenu[2].mid || App.db.rsMenu[2].id, 2); const t = R.total(o).total; R.cfg().service = 10; const t2 = R.total(o).total; const r = R.pay(o, [{ mode: 'Espèces', amount: 4 }]); return { t, t2, err: r.err, st: o.status }; });
  check('à emporter : 2 jus = 4, sans frais de service, payé comptant', tk.t === 4 && tk.t2 === 4 && !tk.err && tk.st === 'Payée');
  check('livraison : adresse exigée, frais de livraison ajoutés à l\'addition', await p.evaluate(() => { const R = App.resto, a = R.addOrder({ kind: 'Livraison' }); if (!a.err) return false; const o = R.addOrder({ kind: 'Livraison', address: 'Av. Test', delFee: 1.5, clientId: 'c1' }); R.addLine(o, App.db.rsMenu[2].id, 1); const t = R.total(o); return t.del === 1.5 && t.total === 3.5 && R.pay(o, [{ mode: 'Espèces', amount: 3.5 }]).status === 'Payée' && App.sales.get(o.invoiceId).clientId === 'c1'; }));
  check('boisson suivie en rupture : encaissement refusé (« Stock insuffisant »), commande annulable', await p.evaluate(() => { const R = App.resto, o = R.addOrder({ kind: 'À emporter' }); R.addLine(o, App.db.rsMenu[1].id, 100); const r = R.pay(o, [{ mode: 'Espèces', amount: 999 }]); const c = R.cancel(o); return !!r.err && r.err.includes('Stock') && c === true && o.status === 'Annulée' && o.lines.every(l => l.status === 'Annulé'); }));

  // bookings
  await p.evaluate(() => { App.resto.addBooking({ name: 'Famille Dupont', date: App.today(), time: '19:00', covers: 4, tableId: App.db.rsTables[0].id }); });
  check('réservation du jour : table « Réservée », rappel sur l\'accueil', await p.evaluate(() => App.resto.tableState(App.db.rsTables[0]) === 'Réservée' && App.resto.todo().some(x => x[0].includes('réservation'))));
  await go('book'); await p.click('#gtab [data-s]'); await p.waitForSelector('.sheet #pl'); await closeTop();
  check('« Installer » : commande ouverte sur la table, réservation « Arrivée »', await p.evaluate(() => { const b = App.db.rsBookings[0]; return b.status === 'Arrivée' && !!App.resto.openOf(App.db.rsTables[0]) && App.resto.tableState(App.db.rsTables[0]) === 'Occupée'; }));
  check('réservation sans nom ou sans heure refusée', await p.evaluate(() => App.resto.addBooking({ date: App.today(), time: '19:00' }) === null && App.resto.addBooking({ name: 'X', date: App.today() }) === null));

  // report and screens
  const rep = await p.evaluate(() => { const c = App.resto.report(App.fin.range('month')), sum = App.db.rsOrders.filter(o => o.status === 'Payée').reduce((s, o) => s + App.sales.get(o.invoiceId).total, 0); return { n: c.n, sales: c.sales, sum, covers: c.covers, takeaway: c.takeaway, cats: Object.keys(c.by).sort().join(), top: c.top[0].name, modes: Object.keys(c.byMode).sort().join(), srv: Object.keys(c.bySrv).length }; });
  check('rapport : 4 additions payées, ventes = somme des factures, 5 couverts, 2 emporter/livraison, catégories et modes de paiement', rep.n === 4 && near(rep.sales, rep.sum) && rep.covers === 5 && rep.takeaway === 2 && rep.cats === 'Plat,Bière,Boisson'.split(',').sort().join() && rep.modes === 'Espèces,Mobile money' && rep.srv >= 1, JSON.stringify(rep));
  for (const tab of ['tables', 'orders', 'kitchen', 'menu', 'book', 'rep']) { await go(tab); check('onglet ' + tab + ' s\'affiche sans erreur', (await p.locator('#gtab').innerHTML()).length > 80); }
  check('texte du rapport (WhatsApp)', await p.evaluate(() => App.resto.reportText(App.fin.range('month')).includes('Rapport restaurant')));
  check('Synchro : les collections sont partagées', await p.evaluate(() => ['rsTables', 'rsMenu', 'rsOrders', 'rsBookings'].every(k => Array.isArray(App.db[k]))));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
