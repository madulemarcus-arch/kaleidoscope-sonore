// Production & fabrication: recipes (materials per batch, labour and other costs, expected loss), production orders (planned → started → finished or cancelled), needs against the stock,
// stock movements (materials out at launch, good pieces in at the materials cost), labour and other costs as expenses, yield, rejects, lots, cancellations, report. Fictitious data only.
const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'production' }); await p.evaluate(() => { window.near = (a, b) => Math.abs(a - b) < 0.001; });
  const go = async tab => { await p.evaluate(tb => App.go('production', { tab: tb }), tab); await p.waitForSelector('#gtabs'); };
  const settle = () => p.waitForFunction(() => document.activeElement && document.activeElement.closest && document.activeElement.closest('.sheet')), ok = () => p.click('.sheet-wrap.on footer .primary'), closeTop = async () => { await p.waitForSelector('.sheet-wrap.on'); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' }); };

  check('secteur « Production & fabrication » : module activé avec stock, ventes et achats', await p.evaluate(() => App.mod('production') && App.mod('stock') && App.mod('sales') && App.mod('purchases') && App.db.settings.activity === 'production'));
  check('barre du bas : Production en tête', (await p.textContent('#tabs')).includes('Production'));
  await p.evaluate(() => { [['fa', 'Farine', 'kg', 1, 100, true], ['su', 'Sucre', 'kg', 2, 20, true], ['sv', 'Service', 'pièce', 0, 0, false]].forEach(a => App.db.products.push({ id: a[0], code: 'PR-' + a[0], name: a[1], cat: 'Général', unit: a[2], qty: a[4], min: 0, cost: a[3], price: 0, track: a[5], fields: {} })); App.save(); });
  await go('orders'); check('écran vide : bouton « + Recette » (pas d\'ordre sans recette)', (await p.locator('#gtab #rn').count()) === 1 && (await p.locator('#gtab #on').count()) === 0);

  // recipe through the form (creates the finished product)
  await p.click('#rn'); await p.waitForSelector('.sheet [name=name]'); await settle(); await p.fill('.sheet [name=name]', 'Biscuit'); await p.fill('.sheet [name=yield]', '100'); await p.fill('.sheet [name=price]', '0.5'); await p.fill('.sheet [name=labor]', '20'); await p.fill('.sheet [name=other]', '10');
  await p.selectOption('.sheet .ig >> nth=0 >> [name=ip]', 'fa'); await p.fill('.sheet .ig >> nth=0 >> [name=iq]', '40'); await p.click('.sheet #ai'); await p.waitForFunction(() => document.querySelectorAll('.sheet .ig').length === 2); await p.selectOption('.sheet .ig >> nth=1 >> [name=ip]', 'su'); await p.fill('.sheet .ig >> nth=1 >> [name=iq]', '10');
  check('aperçu : matières 60, coût complet 90 par lot, 0,90 par pièce', await p.evaluate(() => { const x = document.querySelector('.sheet #rc').textContent.replace(/\s/g, ''); return x.includes('60,00') && x.includes('90,00') && x.includes('0,90'); }));
  await p.fill('.sheet [name=steps]', 'Mélanger, cuire 20 min'); await ok(); await p.waitForFunction(() => App.db.prRecipes.length === 1); await p.waitForSelector('.sheet-wrap.on .hero'); await closeTop();
  const r1 = await p.evaluate(() => App.db.prRecipes[0].id);
  check('recette NM-AAAA-0001 : 100 pièces par lot, 2 matières, produit fini « Biscuit » créé (prix 0,5, catégorie Production, stock 0)', await p.evaluate(id => { const r = App.production.recipe(id), pr = App.stock.get(r.productId); return /^NM-\d{4}-0001$/.test(r.number) && r.yield === 100 && r.items.length === 2 && pr.name === 'Biscuit' && pr.price === 0.5 && pr.cat === 'Production' && pr.qty === 0 && App.stock.tracked(pr) && r.steps.includes('cuire'); }, r1));
  check('coût estimé : matières 60, complet 90, 0,90 la pièce, marge −0,40', await p.evaluate(id => { const c = App.production.cost(App.production.recipe(id)); return c.mat === 60 && c.full === 90 && near(c.unitFull, 0.9) && near(c.margin, -0.4); }, r1));
  check('recette refusée : sans matière, rendement nul, doublon, matière non suivie, produit fini comme matière', await p.evaluate(id => { const P = App.production, pf = P.recipe(id).productId, b = { name: 'X', productId: '', yield: 10 }; return P.addRecipe({ ...b, items: [] }) === null && P.addRecipe({ ...b, yield: 0, items: [{ pid: 'fa', qty: 1 }] }) === null && P.addRecipe({ ...b, items: [{ pid: 'fa', qty: 1 }, { pid: 'fa', qty: 2 }] }) === null && P.addRecipe({ ...b, items: [{ pid: 'sv', qty: 1 }] }) === null && P.addRecipe({ ...b, productId: pf, items: [{ pid: pf, qty: 1 }] }) === null; }, r1));

  // planned order, needs against the stock
  await go('orders'); await p.click('#on'); await p.waitForSelector('.sheet [name=batches]'); await settle(); await p.fill('.sheet [name=batches]', '3');
  check('aperçu de l\'ordre : production prévue 300, farine manque 20, sucre manque 10', await p.evaluate(() => { const x = document.querySelector('.sheet #nd').textContent; return x.includes('300') && x.includes('manque 20') && x.includes('manque 10'); }));
  await ok(); await p.waitForFunction(() => App.db.prOrders.length === 1); await p.waitForSelector('.sheet-wrap.on .hero'); await closeTop();
  const o1 = await p.evaluate(() => App.db.prOrders[0].id);
  check('ordre OF-AAAA-0001 planifié : lot LOT-AAMMJJ-1, 3 lots', await p.evaluate(id => { const o = App.production.order(id); return /^OF-\d{4}-0001$/.test(o.number) && o.status === 'Planifié' && /^LOT-\d{6}-1$/.test(o.lot) && o.batches === 3; }, o1));
  check('besoins des ordres planifiés : farine 120 (manque 20), sucre 30 (manque 10) ; alerte sur l\'accueil', await p.evaluate(() => { const n = App.production.allNeeds(), f = n.find(x => x.pid === 'fa'), s = n.find(x => x.pid === 'su'); return f.need === 120 && f.short === 20 && s.need === 30 && s.short === 10 && App.production.todo().some(x => x[0].includes('manquante')); }));
  check('lancement refusé : stock insuffisant (rien ne bouge)', await p.evaluate(id => { const r = App.production.start(App.production.order(id)); return !!r.err && r.err.includes('Farine') && App.stock.get('fa').qty === 100 && App.production.order(id).status === 'Planifié'; }, o1));
  await p.evaluate(() => { App.stock.move({ pid: 'fa', qty: 100, type: 'in', cost: 1 }); App.stock.move({ pid: 'su', qty: 30, type: 'in', cost: 2 }); App.save(); });
  check('lancement : farine 200 − 120 = 80, sucre 50 − 30 = 20, coût des matières 180, aucune dépense, ordre « En cours »', await p.evaluate(id => { const o = App.production.order(id), r = App.production.start(o); return !r.err && o.status === 'En cours' && App.stock.get('fa').qty === 80 && App.stock.get('su').qty === 20 && App.production.stat(o).mat === 180 && !App.db.expenses.length; }, o1));
  check('un ordre déjà lancé ne se relance pas', await p.evaluate(id => !!App.production.start(App.production.order(id)).err, o1));

  // finish through the form
  await p.evaluate(id => App.production.finishForm(id), o1); await p.waitForSelector('.sheet [name=good]'); await settle(); await p.fill('.sheet [name=good]', '280'); await p.fill('.sheet [name=rejected]', '10');
  check('aperçu de fin : rendement 93,3 %, coût total 270, 0,96 la pièce', await p.evaluate(() => { const x = document.querySelector('.sheet #fc').textContent.replace(/\s/g, ''); return x.includes('93,3') && x.includes('270,00') && x.includes('0,96'); }));
  await ok(); await p.waitForFunction(id => App.production.order(id).status === 'Terminé', o1); await p.waitForSelector('.sheet-wrap.on .hero'); await closeTop();
  check('fin : 280 Biscuit en stock au coût matières 0,643 la pièce, rebuts 10, perte 10 sur 300 prévus', await p.evaluate(id => { const o = App.production.order(id), s = App.production.stat(o), pr = App.stock.get(App.production.recipe(o.recipeId).productId); return pr.qty === 280 && near(pr.cost, 180 / 280) && s.good === 280 && s.rejected === 10 && s.lost === 10 && s.yieldPct === 93.3 && o.good === 280; }, o1));
  check('main-d\'œuvre 60 et autres frais 30 : deux dépenses, caisse −90, coût complet 270 (0,964 la pièce)', await p.evaluate(id => { const o = App.production.order(id), s = App.production.stat(o), c = App.db.expenses.map(e => e.category + e.amount).sort().join(); return c === 'Frais de production30,Main-d\'œuvre production60' && App.cash.expected().USD === -90 && s.total === 270 && near(s.unitFull, 270 / 280); }, o1));
  check('fin refusée : quantité nulle, production supérieure de plus de 20 %, ordre non lancé', await p.evaluate(() => { const P = App.production, o = P.addOrder({ recipeId: App.db.prRecipes[0].id, batches: 1 }); const a = !!P.finish(o, { good: 5 }).err; P.start(o); const b = !!P.finish(o, { good: 0 }).err, c = !!P.finish(o, { good: 130 }).err; P.cancel(o); return a && b && c; }));

  // cancellations
  check('annuler un ordre terminé dont une partie est vendue : refusé', await p.evaluate(id => { const pid = App.production.recipe(App.production.order(id).recipeId).productId; App.stock.move({ pid, qty: -10, type: 'out', ref: 'FAC-test' }); return App.production.cancel(App.production.order(id)) === 'sold'; }, o1));
  check('annuler après retour du stock : production retirée, matières remises (200 et 50), dépenses supprimées', await p.evaluate(id => { const o = App.production.order(id), pid = App.production.recipe(o.recipeId).productId; App.stock.move({ pid, qty: 10, type: 'return', ref: 'FAC-test' }); const r = App.production.cancel(o); return r === true && o.status === 'Annulé' && App.stock.get(pid).qty === 0 && App.stock.get('fa').qty === 200 && App.stock.get('su').qty === 50 && App.db.expenses.length === 0; }, o1));
  check('annuler un ordre en cours : matières remises ; un ordre planifié : rien ne bouge', await p.evaluate(() => { const P = App.production, rid = App.db.prRecipes[0].id, a = P.addOrder({ recipeId: rid, batches: 1 }); P.start(a); const was = App.stock.get('fa').qty; P.cancel(a); const b = P.addOrder({ recipeId: rid, batches: 1 }); P.cancel(b); return was === 160 && App.stock.get('fa').qty === 200 && a.status === 'Annulé' && b.status === 'Annulé'; }));

  // report and screens
  await p.evaluate(() => { const P = App.production, o = P.addOrder({ recipeId: App.db.prRecipes[0].id, batches: 1 }); P.start(o); P.finish(o, { good: 95, rejected: 5 }); P.addOrder({ recipeId: App.db.prRecipes[0].id, batches: 1, date: App.addDays(App.today(), -2) }); });
  check('ordre planifié en retard : alerte sur l\'accueil', await p.evaluate(() => App.production.late().length === 1 && App.production.todo().some(x => x[0].includes('en retard'))));
  const rep = await p.evaluate(() => { const c = App.production.report(App.fin.range('month')); return { n: c.n, good: c.good, rej: c.rej, y: c.yieldPct, total: c.total, by: c.by.length, planned: c.planned }; });
  check('rapport du mois : 1 ordre terminé, 95 bonnes, 5 rebuts, rendement 95 %, coût 90 (60 + 20 + 10), 1 produit', rep.n === 1 && rep.good === 95 && rep.rej === 5 && rep.y === 95 && rep.total === 90 && rep.by === 1 && rep.planned === 1);
  for (const tab of ['orders', 'recipes', 'needs', 'rep']) { await go(tab); check('onglet ' + tab + ' s\'affiche sans erreur', (await p.locator('#gtab').innerHTML()).length > 80); }
  await go('recipes'); await p.click('#gtab [data-r]'); await p.waitForSelector('.sheet .hero'); check('fiche recette : coût complet par pièce, matières et étapes', (await p.textContent('.sheet')).includes('Mélanger') && (await p.textContent('.sheet .hero')).includes('0,90')); await closeTop();
  await go('orders'); await p.click('#gtab [data-f="all"]'); await p.click('#gtab [data-o]'); await p.waitForSelector('.sheet .hero'); check('fiche d\'ordre : production prévue / pièces bonnes affichées', (await p.textContent('.sheet .hero')).length > 5); await closeTop();
  check('texte du rapport (WhatsApp)', await p.evaluate(() => App.production.reportText(App.fin.range('month')).includes('Rapport production')));
  check('Synchro : les collections sont partagées', await p.evaluate(() => ['prRecipes', 'prOrders'].every(k => Array.isArray(App.db[k]))));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
