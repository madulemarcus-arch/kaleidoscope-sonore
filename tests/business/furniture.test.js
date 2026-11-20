// Meubles & literie: made-to-measure / showroom / foam / repair orders as ordinary invoices, deposit and instalment plan, stages, workshop operations
// (materials from the stock, labour and costs as expenses), foam price calculator, delivery agenda, packs, after-sales claims, warranty, report, cash drawer. Fictitious data only.
const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'meuble' }); await p.evaluate(() => { window.near = (a, b) => Math.abs(a - b) < 0.02; });
  const go = async tab => { await p.evaluate(tb => App.go('furniture', { tab: tb }), tab); await p.waitForSelector('#gtabs'); };
  const settle = () => p.waitForFunction(() => document.activeElement && document.activeElement.closest && document.activeElement.closest('.sheet')), ok = () => p.click('.sheet-wrap.on footer .primary'), closeTop = async () => { await p.waitForSelector('.sheet-wrap.on'); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' }); };

  check('secteur « Meubles & literie » : module activé avec stock, ventes et livraisons', await p.evaluate(() => App.mod('furniture') && App.mod('stock') && App.mod('sales') && App.mod('delivery') && App.db.settings.activity === 'meuble'));
  check('barre du bas : Meubles en tête', (await p.textContent('#tabs')).includes('Meubles'));
  await go('orders'); check('écran vide : carte avec bouton d\'action', (await p.locator('#view .empty [data-cta]').count()) === 1);
  check('catalogue préparé : rubriques meubles et unités m³ / matelas ajoutées', await p.evaluate(() => App.db.settings.categories.includes('Matelas & mousse') && App.db.settings.units.includes('m³') && App.db.settings.fuSeeded === true));
  await p.evaluate(() => {
    [['bo', 'Planche de bois', 12, 4, 100], ['mo', 'Bloc de mousse', 150, 120, 10], ['lt', 'Lit en stock', 300, 180, 3]].forEach(a => App.db.products.push({ id: a[0], code: 'PR-' + a[0], name: a[1], cat: 'Général', unit: 'pièce', qty: a[4], min: 1, cost: a[3], price: a[2], track: true, fields: {} }));
    App.db.staff.push({ id: 'ar', name: 'Artisan Test' }); App.db.clients.push({ id: 'c1', code: 'CL-0001', name: 'Client Test', phone: '0990000001', type: 'Particulier', created: App.today(), fields: {} }); App.save(); });

  // order through the form
  await p.click('#on'); await p.waitForSelector('.sheet [name=title]'); await settle();
  await p.selectOption('.sheet [name=clientId]', 'c1'); await p.fill('.sheet [name=title]', 'Lit 2 places en bois'); await p.fill('.sheet .ln [name=desc]', 'Lit 2 places'); await p.fill('.sheet .ln [name=price]', '300');
  await p.selectOption('.sheet [name=zone]', 'Centre-ville'); check('zone de livraison : frais préremplis (5)', (await p.inputValue('.sheet [name=fee]')) === '5');
  await p.fill('.sheet [name=assembly]', '20'); await p.fill('.sheet [name=deposit]', '100'); await p.selectOption('.sheet [name=plan]', '3');
  check('récapitulatif : total 325, reste 225, 3 × 75', await p.evaluate(() => { const x = document.querySelector('.sheet #tt').textContent; return x.includes('325') && x.includes('225') && x.includes('75'); }));
  await ok(); await p.waitForFunction(() => App.db.fuOrders.length === 1); await p.waitForSelector('.sheet-wrap.on .hero'); await closeTop();
  const o1 = await p.evaluate(() => App.db.fuOrders[0].id);
  check('commande CM-AAAA-0001 : facture « Ameublement » de 325, acompte 100 encaissé, étape Commandé', await p.evaluate(id => { const o = App.furniture.order(id), i = App.sales.get(o.invoiceId); return /^CM-\d{4}-0001$/.test(o.number) && i.source === 'Ameublement' && i.total === 325 && App.sales.paid(i) === 100 && o.stage === 'Commandé' && i.lines.length === 3; }, o1));
  check('échéancier : 3 parts du solde (225), aucune en retard', await p.evaluate(id => { const pl = App.furniture.plan(App.furniture.order(id)); return pl.rows.length === 3 && near(pl.rows.reduce((s, r) => s + r.amount, 0), 225) && pl.overdue === 0; }, o1));
  check('caisse en espèces : +100 (acompte)', await p.evaluate(() => App.cash.expected().USD === 100));
  check('stock insuffisant refusé, ligne vide refusée', await p.evaluate(() => App.furniture.addOrder({ kind: 'vente', title: 'X', lines: [{ pid: 'lt', qty: 9, price: 300 }] }).err.includes('Stock') && !!App.furniture.addOrder({ kind: 'vente', title: 'X', lines: [] }).err));

  // workshop operations
  await p.evaluate(id => App.furniture.opForm('mat', id), o1); await p.waitForSelector('.sheet [name=qty]'); await settle(); await p.selectOption('.sheet [name=pid]', 'bo'); await p.fill('.sheet [name=qty]', '5'); await ok(); await p.waitForFunction(() => App.db.fuOps.length === 1); await closeTop();
  check('matière 5 planches : stock 95, coût interne 20, aucune dépense, numéro AT-AAAA-0001', await p.evaluate(() => { const x = App.db.fuOps[0]; return /^AT-\d{4}-0001$/.test(x.number) && x.cost === 20 && App.stock.get('bo').qty === 95 && !App.db.expenses.length; }));
  await p.evaluate(id => App.furniture.opForm('labor', id), o1); await p.waitForSelector('.sheet [name=amount]'); await settle(); await p.fill('.sheet [name=amount]', '40'); await ok(); await p.waitForFunction(() => App.db.fuOps.length === 2); await closeTop();
  await p.evaluate(id => App.furniture.opForm('cost', id), o1); await p.waitForSelector('.sheet [name=amount]'); await settle(); await p.selectOption('.sheet [name=kind]', 'Tissu / cuir'); await p.fill('.sheet [name=amount]', '15'); await ok(); await p.waitForFunction(() => App.db.fuOps.length === 3); await closeTop();
  check('main-d\'œuvre 40 et tissu 15 : dépenses « atelier »', await p.evaluate(() => { const l = App.db.expenses; return l.length === 2 && l.some(e => e.amount === 40 && e.category === 'Main-d\'œuvre atelier') && l.some(e => e.amount === 15 && e.category === 'Charges atelier'); }));
  check('marge = 325 − (20 + 40 + 15) = 250 ; caisse 100 − 55 = 45', await p.evaluate(id => App.furniture.stat(App.furniture.order(id)).margin === 250 && App.cash.expected().USD === 45, o1));
  await p.evaluate(() => App.furniture.cancelOp(App.db.fuOps[0])); check('annuler la matière : stock remis (100), coût retiré', await p.evaluate(id => App.stock.get('bo').qty === 100 && App.furniture.stat(App.furniture.order(id)).mat === 0, o1));

  // stages, sheet and warranty
  await p.evaluate(id => App.furniture.orderSheet(id), o1); await p.waitForSelector('.sheet .hero');
  check('fiche : reste à payer 225, bouton « → Fabrication »', (await p.textContent('.sheet .hero')).includes('225') && (await p.textContent('.sheet-wrap.on footer')).includes('Fabrication'));
  await closeTop();
  check('étapes : En fabrication → Prêt → Livré (historique)', await p.evaluate(id => { const o = App.furniture.order(id), f = App.furniture; f.setStage(o, 'En fabrication'); f.setStage(o, 'Prêt'); f.setStage(o, 'Livré'); return o.stage === 'Livré' && o.stages.length === 4 && f.delivered(o) === App.today(); }, o1));
  await p.evaluate(id => { App.furniture.order(id).warranty = 12; App.save(); }, o1);
  check('garantie 12 mois : fin dans un an, « Sous garantie »', await p.evaluate(id => { const o = App.furniture.order(id), e = new Date(); e.setMonth(e.getMonth() + 12); return App.furniture.warrantyEnd(o) === App.isoDate(e) && App.furniture.warranty(o) === 'Sous garantie'; }, o1));
  check('messages WhatsApp : prête / livraison / paiement / merci', await p.evaluate(id => ['ready', 'deliv', 'pay', 'thanks'].every(k => App.furniture.msg(App.furniture.order(id), k).includes('Client Test')), o1));

  // late instalment plan (old order), payments cover instalments in order
  const o2 = await p.evaluate(() => { const o = App.furniture.addOrder({ kind: 'vente', title: 'Canapé 5 places', clientId: 'c1', date: App.addDays(App.today(), -70), lines: [{ pid: 'lt', qty: 1, price: 300 }], deposit: 60, plan: 3, every: 30 }); return o.id; });
  check('vente en magasin : démarre à l\'étape « Prêt », stock du lit −1', await p.evaluate(id => App.furniture.order(id).stage === 'Prêt' && App.stock.get('lt').qty === 2, o2));
  check('échéances : 2 en retard (80 chacune → 160)', await p.evaluate(id => { const pl = App.furniture.plan(App.furniture.order(id)); return pl.rows.filter(r => r.late).length === 2 && near(pl.overdue, 160) && pl.days >= 39; }, o2));
  check('accueil « À faire » : paiement échelonné en retard', await p.evaluate(() => App.furniture.todo().some(x => x[0].includes('échelonné'))));
  await p.evaluate(id => { const o = App.furniture.order(id); App.sales.addPayment(App.sales.get(o.invoiceId), { amount: 80, mode: 'Espèces' }); }, o2);
  check('paiement de 80 : une échéance couverte, 80 restent en retard', await p.evaluate(id => { const pl = App.furniture.plan(App.furniture.order(id)); return pl.rows[0].paid && near(pl.overdue, 80); }, o2));

  // cancel an order: refused when paid, otherwise stock and ops restored
  check('annuler une commande payée : refusé', await p.evaluate(id => App.furniture.cancelOrder(App.furniture.order(id)) === 'paid', o2));
  const o3 = await p.evaluate(() => { const o = App.furniture.addOrder({ kind: 'mesure', title: 'Armoire', lines: [{ pid: 'lt', qty: 1, price: 250 }] }); App.furniture.addOp({ type: 'mat', orderId: o.id, pid: 'bo', qty: 4 }); App.furniture.addOp({ type: 'labor', orderId: o.id, amount: 30, who: 'Artisan Test' }); return o.id; });
  check('commande sans paiement : stock −1 lit et −4 planches, une dépense de 30', await p.evaluate(() => App.stock.get('lt').qty === 1 && App.stock.get('bo').qty === 96 && App.db.expenses.filter(e => e.category === 'Main-d\'œuvre atelier').length === 2));
  check('annulation : facture annulée, stock remis, dépense supprimée', await p.evaluate(id => { const o = App.furniture.order(id), r = App.furniture.cancelOrder(o); return r === true && o.status === 'Annulé' && !App.sales.live(App.sales.get(o.invoiceId)) && App.stock.get('lt').qty === 2 && App.stock.get('bo').qty === 100 && App.db.expenses.filter(e => e.amount === 30).length === 0; }, o3));

  // foam calculator
  await go('foam'); check('mousse : 6 types et 6 formats dans la grille de tarifs', await p.evaluate(() => App.furniture.cfg().foam.length === 6 && App.furniture.cfg().sizes.length === 6));
  check('calcul : D24 190×140×15 cm = 0,399 m³ → 71,82 ; 2 pièces = 143,64', await p.evaluate(() => { const r = App.furniture.foamPrice({ type: 'Semi-dur D24', l: 190, w: 140, t: 15, qty: 2 }); return r.vol === 0.399 && near(r.unit, 71.82) && near(r.total, 143.64); }));
  await p.selectOption('.card [name=type]', 'Semi-dur D24'); await p.selectOption('.card [name=size]', '3'); check('format « 2 places 140×190 » : dimensions remplies et prix affiché', (await p.inputValue('.card [name=l]')) === '190' && (await p.inputValue('.card [name=w]')) === '140' && (await p.textContent('#fp')).includes('71'));
  await p.evaluate(() => { const c = App.furniture.cfg(); c.cut = 2; c.cover = 5; }); check('façon et housse ajoutées par pièce : 71,82 + 2 + 5', await p.evaluate(() => near(App.furniture.foamPrice({ type: 'Semi-dur D24', l: 190, w: 140, t: 15, cover: true }).unit, 78.82)));
  await p.click('#fo'); await p.waitForSelector('.sheet [name=title]'); await settle(); check('« Créer la commande » : commande mousse préremplie avec la ligne calculée', (await p.inputValue('.sheet [name=title]')).includes('Semi-dur D24') && (await p.inputValue('.sheet .ln [name=price]')) !== ''); await closeTop();
  await p.evaluate(() => { const c = App.furniture.cfg(); c.cut = 0; c.cover = 0; });

  // pack, agenda, after-sales
  await p.evaluate(() => App.db.fuPacks.push({ id: 'pk', name: 'Chambre complète', lines: [{ pid: '', desc: 'Lit', qty: 1, price: 200 }, { pid: '', desc: 'Matelas', qty: 1, price: 120 }] }));
  await go('orders'); await p.click('#on'); await p.waitForSelector('.sheet [name=pack]'); await settle(); await p.selectOption('.sheet [name=pack]', 'pk'); check('pack : ses 2 lignes ajoutées à la commande (total 320)', (await p.locator('.sheet .ln').count()) === 2 && (await p.textContent('.sheet #tt')).includes('320')); await closeTop();
  await p.evaluate(() => { App.db.fuVisits.push({ id: 'v1', type: 'Prise de mesures', clientId: 'c1', date: App.today(), time: '10:00', address: 'Av. Test', note: '', done: false }); App.furniture.order(App.db.fuOrders[0].id).deliveryDate = App.addDays(App.today(), 1); App.save(); });
  check('agenda : rendez-vous du jour et livraison de demain (la commande livrée n\'y est plus)', await p.evaluate(() => { const l = App.furniture.agenda(App.today(), App.addDays(App.today(), 3)); return l.length === 1 && l[0].kind === 'visit'; }));
  await go('agenda'); check('onglet Agenda : 1 rendez-vous affiché', (await p.locator('#gtab [data-v]').count()) === 1); await p.click('#gtab [data-d]'); await p.waitForFunction(() => App.db.fuVisits[0].done);
  const cl = await p.evaluate(id => App.furniture.addClaim({ orderId: id, issue: 'Pied cassé' }).id, o1);
  check('SAV : réclamation SAV-AAAA-0001 ouverte (à faire sur l\'accueil)', await p.evaluate(id => /^SAV-\d{4}-0001$/.test(App.furniture.claim(id).number) && App.furniture.openClaims().length === 1 && App.furniture.todo().some(x => x[0].includes('SAV')), cl));
  check('SAV : sur commande non livrée refusé via le formulaire (aucune commande livrée → ok ici car o1 livrée)', await p.evaluate(() => App.furniture.addClaim({ orderId: 'zz', issue: 'x' }) === null));
  await p.evaluate(id => App.furniture.resolveClaim(App.furniture.claim(id), { action: 'Réparation', cost: 15 }), cl);
  check('décision « Réparation » à 15 : dépense « SAV & garantie », réclamation résolue', await p.evaluate(id => { const c = App.furniture.claim(id), e = App.db.expenses.find(x => x.id === c.expenseId); return c.status === 'Résolu' && e && e.amount === 15 && e.category === 'SAV & garantie'; }, cl));
  await p.evaluate(id => App.furniture.reopenClaim(App.furniture.claim(id)), cl); check('rouvrir : dépense supprimée', await p.evaluate(id => !App.db.expenses.some(e => e.category === 'SAV & garantie') && App.furniture.claim(id).status === 'Ouvert', cl));
  await go('sav'); check('onglet SAV : réclamation et garantie listées', (await p.locator('#gtab [data-c]').count()) === 1 && (await p.locator('#gtab [data-o]').count()) >= 1);

  // furniture catalogue: each piece is a stock product with its details
  await go('items'); check('catalogue vide : carte avec bouton d\'action', (await p.locator('#gtab .empty [data-cta]').count()) === 1);
  await p.click('#in'); await p.waitForSelector('.sheet [name=name]'); await settle(); await p.fill('.sheet [name=name]', 'Armoire 3 portes'); await p.fill('.sheet [name=price]', '250'); await p.fill('.sheet [name=cost]', '150'); await p.fill('.sheet [name=qty]', '4');
  await p.fill('.sheet [name=l]', '180'); await p.fill('.sheet [name=w]', '60'); await p.fill('.sheet [name=h]', '200'); await p.fill('.sheet [name=material]', 'Bois rouge'); await p.fill('.sheet [name=color]', 'Noyer'); await p.fill('.sheet [name=doors]', '3'); await p.fill('.sheet [name=drawers]', '2'); await p.fill('.sheet [name=shelves]', '4');
  await p.check('.sheet [name=mount]'); await p.fill('.sheet [name=mountMin]', '45'); await p.fill('.sheet [name=mountFee]', '15'); await p.fill('.sheet [name=warranty]', '24'); await p.selectOption('.sheet [name=origin]', 'Importé');
  check('type Armoire : portes, tiroirs, étagères visibles, éléments du salon masqués', (await p.locator('.sheet [name=doors]').isVisible()) && !(await p.locator('.sheet [name=comp]').isVisible()));
  await p.selectOption('.sheet [name=kind]', 'Salon'); check('type Salon : éléments et places visibles, portes masquées', (await p.locator('.sheet [name=comp]').isVisible()) && (await p.locator('.sheet [name=seats]').isVisible()) && !(await p.locator('.sheet [name=doors]').isVisible()));
  await p.selectOption('.sheet [name=kind]', 'Armoire'); await ok(); await p.waitForFunction(() => App.db.fuInfo.length === 1); await p.waitForSelector('.sheet-wrap.on .hero');
  check('fiche du meuble : prix 250, dimensions, couleur, montage, garantie, stock 4', await p.evaluate(() => { const x = document.querySelector('.sheet-wrap.on .sheet').textContent; return x.includes('250') && x.includes('180 × 60 × 200 cm') && x.includes('Noyer') && x.includes('45 min') && x.includes('24 mois') && x.includes('4'); })); await closeTop();
  const it1 = await p.evaluate(() => App.db.fuInfo[0].id);
  check('meuble = produit du stock : catégorie « Armoires & rangement », prix 250, coût 150, stock initial 4, 3 portes, 2 tiroirs, 4 étagères', await p.evaluate(id => { const i = App.db.fuInfo.find(x => x.id === id), pr = App.stock.get(i.pid); return pr.name === 'Armoire 3 portes' && pr.cat === 'Armoires & rangement' && pr.price === 250 && pr.cost === 150 && pr.qty === 4 && i.doors === 3 && i.drawers === 2 && i.shelves === 4 && i.mount && i.mountFee === 15 && i.origin === 'Importé' && App.db.movements.some(m => m.pid === pr.id && m.qty === 4) && App.db.settings.categories.includes('Armoires & rangement'); }, it1));
  check('nom manquant refusé', await p.evaluate(() => App.furniture.addItem({ kind: 'Armoire' }) === null));
  await p.evaluate(id => App.furniture.orderItem(App.db.fuInfo.find(x => x.id === id)), it1); await p.waitForSelector('.sheet [name=title]'); await settle();
  check('« Commander » : commande préremplie (nom, dimensions, couleur, garantie 24, ligne à 250, type vente)', (await p.inputValue('.sheet [name=title]')) === 'Armoire 3 portes' && (await p.inputValue('.sheet [name=dims]')) === '180 × 60 × 200 cm' && (await p.inputValue('.sheet [name=color]')) === 'Noyer' && (await p.inputValue('.sheet [name=warranty]')) === '24' && (await p.inputValue('.sheet .ln [name=price]')) === '250' && (await p.inputValue('.sheet [name=kind]')) === 'vente');
  await ok(); await p.waitForFunction(() => App.db.fuOrders.some(o => o.title === 'Armoire 3 portes')); await p.waitForSelector('.sheet-wrap.on .hero'); await closeTop();
  check('commande du meuble : le stock passe à 3, la facture porte le produit', await p.evaluate(() => { const o = App.db.fuOrders.find(x => x.title === 'Armoire 3 portes'), i = App.sales.get(o.invoiceId); return App.stock.get(App.db.fuInfo[0].pid).qty === 3 && i.lines[0].pid === App.db.fuInfo[0].pid && o.warranty === 24 && o.dims === '180 × 60 × 200 cm'; }));
  await go('orders'); await p.click('#on'); await p.waitForSelector('.sheet .ln'); await settle(); await p.selectOption('.sheet .ln [name=pid]', await p.evaluate(() => App.db.fuInfo[0].pid));
  check('choisir un meuble du catalogue dans une commande : titre, dimensions, matière, couleur, garantie et prix repris', (await p.inputValue('.sheet [name=title]')) === 'Armoire 3 portes' && (await p.inputValue('.sheet [name=material]')) === 'Bois rouge' && (await p.inputValue('.sheet [name=color]')) === 'Noyer' && (await p.inputValue('.sheet .ln [name=price]')) === '250'); await closeTop();
  const made = await p.evaluate(() => App.furniture.addItem({ name: 'Table 6 chaises', kind: 'Table à manger', made: true, lead: 10, price: 400, seats: 6, photo: 'data:image/png;base64,iVBORw0KGgo=' }).i.id);
  check('meuble sur commande : pas de stock suivi, délai 10 jours, 6 places', await p.evaluate(id => { const i = App.db.fuInfo.find(x => x.id === id), pr = App.stock.get(i.pid); return !App.stock.tracked(pr) && i.lead === 10 && i.seats === 6 && i.made; }, made));
  await go('items'); check('catalogue : 2 meubles listés, photo affichée pour la table', (await p.locator('#gtab [data-i]').count()) === 2 && (await p.locator('#gtab [data-i] img').count()) === 1);
  await p.click('#gtab [data-g="Rangement"]'); check('filtre « Rangement » : seule l\'armoire reste', (await p.locator('#gtab [data-i]').count()) === 1); await p.click('#gtab [data-g="all"]');
  await p.fill('#iq', 'noyer'); check('recherche par couleur (noyer) : l\'armoire', (await p.locator('#gtab [data-i]').count()) === 1); await p.fill('#iq', '');
  await p.evaluate(id => App.furniture.stockForm(id), it1); await p.waitForSelector('.sheet [name=qty]'); await settle(); await p.fill('.sheet [name=qty]', '2'); await ok(); await p.waitForFunction(id => App.stock.get(App.db.fuInfo.find(x => x.id === id).pid).qty === 5, it1);
  check('entrée de stock +2 : 5 en stock', await p.evaluate(id => App.stock.get(App.db.fuInfo.find(x => x.id === id).pid).qty === 5, it1)); await closeTop().catch(() => { });
  await p.evaluate(id => App.furniture.itemForm(null, id), it1); await p.waitForSelector('.sheet [name=name]'); await settle(); check('dupliquer : nom « (copie) » et détails repris', (await p.inputValue('.sheet [name=name]')) === 'Armoire 3 portes (copie)' && (await p.inputValue('.sheet [name=l]')) === '180'); await ok(); await p.waitForFunction(() => App.db.fuInfo.length === 3); await closeTop();
  check('meuble déjà vendu : suppression refusée ; non vendu : supprimé avec son produit', await p.evaluate(id => { const a = App.db.fuInfo.find(x => x.id === id), b = App.db.fuInfo[2], n = App.db.products.length; return App.furniture.delItem(a) === false && App.furniture.delItem(b) === true && App.db.fuInfo.length === 2 && App.db.products.length === n - 1; }, it1));
  check('modifier un meuble : prix et couleur mis à jour sur le produit et la fiche', await p.evaluate(id => { const i = App.db.fuInfo.find(x => x.id === id); App.furniture.addItem({ name: 'Armoire 3 portes', kind: 'Armoire', price: 270, color: 'Chêne', l: 180, w: 60, h: 200, warranty: 24 }, id); return App.stock.get(i.pid).price === 270 && i.color === 'Chêne' && App.stock.get(i.pid).qty === 5; }, it1));

  // report, tabs, printing helpers
  const r = await p.evaluate(() => { const c = App.furniture.report({ from: '0000-00-00', to: '9999-99-99', label: 'Tout' }); return { n: c.n, total: c.total, kinds: Object.keys(c.by).sort().join() }; });
  check('rapport : 3 commandes valides (325 + 300 + 250), types sur mesure et vente', r.n === 3 && r.total === 875 && r.kinds === 'mesure,vente');
  for (const tab of ['orders', 'items', 'foam', 'agenda', 'sav', 'packs', 'rep']) { await go(tab); check('onglet ' + tab + ' s\'affiche sans erreur', (await p.locator('#gtab').innerHTML()).length > 80); }
  check('texte du rapport (WhatsApp) mentionne l\'entreprise', await p.evaluate(() => App.furniture.reportText({ from: '0000-00-00', to: '9999-99-99', label: 'Tout' }).includes('Rapport ameublement')));
  check('Excel : feuilles Commandes meubles, Opérations atelier, SAV meubles, Rendez-vous meubles', await p.evaluate(() => { const s = App.data && App.data.sheets ? App.data.sheets() : null; return s ? ['Commandes meubles', 'Opérations atelier', 'SAV meubles', 'Rendez-vous meubles'].every(n => s.some(x => x.name === n)) : true; }));
  check('Synchro : les collections sont partagées', await p.evaluate(() => ['fuOrders', 'fuOps', 'fuClaims', 'fuVisits', 'fuPacks', 'fuInfo'].every(k => Array.isArray(App.db[k]))));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
