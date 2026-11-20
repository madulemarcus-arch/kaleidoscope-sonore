// Pharmacie: batches with expiry on top of the stock (first-expired-first-out allocation, returns go back to the same batch), expired / near-expiry alerts, prescriptions dispensed
// as invoices (patient share + insurer share), allergy alert, controlled-drug register, destruction of expired stock (loss without cash movement), lots assigned to existing stock,
// cash drawer, journal, reports, export. Fictitious data only.
const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'pharmacie' });
  const go = async (tab, f) => { await p.evaluate(a => App.go('pharmacy', { tab: a[0], f: a[1] }), [tab, f]); await p.waitForSelector('#ptabs'); };
  const ok = () => p.click('.sheet-wrap.on footer .primary'), closeTop = async () => { await p.waitForSelector('.sheet-wrap.on'); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' }); };
  const prod = (id, name, price, cost) => ({ id, code: 'PR-' + id, name, cat: 'Général', unit: 'pièce', qty: 0, min: 5, cost, price, track: true, fields: {} });

  check('secteur « Pharmacie » : module activé, vocabulaire patient / médicament', await p.evaluate(() => App.mod('pharmacy') && App.mod('stock') && App.mod('sales') && App.db.settings.activity === 'pharmacie' && App.vocab('client') === 'patient' && App.vocab('product') === 'médicament'));
  check('barre du bas : Pharmacie en tête', (await p.textContent('#tabs')).includes('Pharmacie'));
  await go('rx'); check('écran vide : carte avec bouton d\'action', (await p.locator('#view .empty [data-cta]').count()) === 1);
  await go('meds'); check('Médicaments vide : carte avec bouton d\'action', (await p.locator('#view .empty [data-cta]').count()) === 1);

  await p.evaluate(prodArgs => {
    prodArgs.forEach(a => App.db.products.push({ id: a[0], code: 'PR-' + a[0], name: a[1], cat: 'Général', unit: 'pièce', qty: 0, min: 5, cost: a[3], price: a[2], track: true, fields: {} }));
    [['p1', 'Alice Test', 'pénicilline'], ['p2', 'Bruno Test', '']].forEach((c, i) => { App.db.clients.push({ id: c[0], code: 'CL-000' + (i + 1), name: c[1], phone: '09900000' + i, type: 'Particulier', created: App.today(), fields: {} }); if (c[2]) App.db.phPatients.push({ id: 'pt' + i, clientId: c[0], allergies: c[2] }); });
    App.db.suppliers.push({ id: 's1', name: 'Grossiste Test' });
    App.db.phInfo.push({ id: 'i1', pid: 'am', dci: 'amoxicilline (pénicilline)', form: 'Gélule', dosage: '500 mg', rx: true, ctrl: false }, { id: 'i2', pid: 'mo', dci: 'morphine', form: 'Injectable', dosage: '10 mg', rx: true, ctrl: true });
    App.save();
  }, [['pa', 'Paracétamol 500', 2, 1], ['am', 'Amoxicilline 500', 10, 6], ['mo', 'Morphine 10', 20, 12], ['ex', 'Produit tout périmé', 5, 2], ['nb', 'Produit sans lot', 3, 1]]);

  // lots: one through the form, others by API (expired, near expiry)
  await p.evaluate(() => App.pharmacy.lotForm('pa')); await p.waitForSelector('.sheet [name=lot]'); await p.fill('.sheet [name=lot]', 'L1'); await p.fill('.sheet [name=expiry]', '12/2099'); await p.fill('.sheet [name=qty]', '100'); await ok(); await p.waitForFunction(() => App.db.phBatches.length === 1); await closeTop();
  check('lot L1 réceptionné : péremption fin 12/2099, stock +100, mouvement d\'entrée', await p.evaluate(() => { const b = App.db.phBatches[0]; return b.expiry === '2099-12-31' && b.q0 === 100 && App.stock.get('pa').qty === 100 && App.db.movements.some(m => m.type === 'in' && m.qty === 100); }));
  check('péremption saisie en MM/AAAA, AAAA-MM ou date complète', await p.evaluate(() => { const x = App.pharmacy.parseExp; return x('08/2027') === '2027-08-31' && x('2027-02') === '2027-02-28' && x('3/28') === '2028-03-31' && x('2027-08-15') === '2027-08-15' && x('n\'importe quoi') === ''; }));
  await p.evaluate(() => { const P = App.pharmacy; P.receive({ pid: 'pa', lot: 'OLD', expiry: '01/2020', qty: 20 }); P.receive({ pid: 'pa', lot: 'NEAR', expiry: App.addDays(App.today(), 30), qty: 30 }); P.receive({ pid: 'ex', lot: 'EX1', expiry: '06/2021', qty: 5 }); P.receive({ pid: 'am', lot: 'AM1', expiry: '12/2099', qty: 50 }); P.receive({ pid: 'mo', lot: 'MO1', expiry: '12/2099', qty: 10 }); App.render(); });
  check('états des lots : Périmé, Bientôt, Vendable', await p.evaluate(() => { const P = App.pharmacy, mp = P.remMap(), s = n => { const b = App.db.phBatches.find(x => x.lot === n); return P.bstate(b, P.rem(b, mp)); }; return s('OLD') === 'Périmé' && s('NEAR') === 'Bientôt' && s('L1') === 'Vendable'; }));
  check('synthèse : 150 en stock dont 20 périmés et 30 bientôt périmés, 100 vendables hors péremption proche', await p.evaluate(() => { const x = App.pharmacy.summary().pa; return x.total === 150 && x.exp === 20 && x.near === 30 && x.sellable === 130 && x.unbatched === 0 && x.lots === 3; }));

  // first-expired-first-out: a sale takes the non-expired batch that expires first, never the expired one
  const inv = await p.evaluate(() => { const i = App.sales.createInvoice({ clientId: 'p2', lines: [{ pid: 'pa', desc: 'Paracétamol', qty: 40, price: 2 }] }); App.save(); return i.number; });
  check('vente de 40 : 30 du lot NEAR puis 10 du lot L1, le périmé reste intact', await p.evaluate(() => { const P = App.pharmacy, mp = P.remMap(), r = n => P.rem(App.db.phBatches.find(x => x.lot === n), mp); return r('NEAR') === 0 && r('L1') === 90 && r('OLD') === 20 && App.stock.get('pa').qty === 110; }));
  check('retour de la vente : les unités retournent dans les lots d\'origine', await p.evaluate(n => { App.stock.move({ pid: 'pa', qty: 40, type: 'return', ref: n, note: 'Annulation' }); const i = App.db.invoices.find(x => x.number === n); i.cancelled = true; App.save(); const P = App.pharmacy, mp = P.remMap(), r = k => P.rem(App.db.phBatches.find(x => x.lot === k), mp); return r('NEAR') === 30 && r('L1') === 100 && r('OLD') === 20 && App.stock.get('pa').qty === 150; }, inv));
  check('un médicament sans lot : sortie de stock sans erreur', await p.evaluate(() => { App.db.products.find(x => x.id === 'nb').qty = 12; App.stock.move({ pid: 'nb', qty: -2, type: 'sale', ref: 'X' }); return App.stock.get('nb').qty === 10 && !App.db.movements.find(m => m.pid === 'nb' && m.type === 'sale').alloc; }));

  // lot assigned to existing stock, over-assignment refused
  await p.evaluate(() => App.pharmacy.lotForm('nb', true)); await p.waitForSelector('.sheet [name=lot]'); check('attribution : quantité proposée = stock sans lot (10)', (await p.inputValue('.sheet [name=qty]')) === '10'); await p.fill('.sheet [name=lot]', 'NB1'); await p.fill('.sheet [name=expiry]', '03/2099'); await ok(); await p.waitForFunction(() => App.db.phBatches.some(b => b.lot === 'NB1')); await closeTop();
  check('lot attribué au stock existant : le stock ne change pas, plus rien sans lot', await p.evaluate(() => { const x = App.pharmacy.summary().nb; return x.total === 10 && x.unbatched === 0 && x.batched === 10 && App.pharmacy.receive({ pid: 'nb', lot: 'Z', expiry: '01/2099', qty: 1, assign: true }) === null; }));
  check('lot jamais utilisé : supprimé, les unités reçues sortent du stock', await p.evaluate(() => { const P = App.pharmacy, b = P.receive({ pid: 'pa', lot: 'TMP', expiry: '01/2099', qty: 5 }); const ok1 = App.stock.get('pa').qty === 155 && P.deleteBatch(b) && App.stock.get('pa').qty === 150 && !P.batch(b.id); const c = App.db.phBatches.find(x => x.lot === 'L1'); return ok1 && c && P.deleteBatch(c) === true && P.receive({ pid: 'pa', lot: 'L1', expiry: '12/2099', qty: 100 }) !== null; }));
  check('lot déjà utilisé : suppression refusée', await p.evaluate(() => { const P = App.pharmacy; App.stock.move({ pid: 'pa', qty: -5, type: 'sale', ref: 'Y' }); const b = App.db.phBatches.filter(x => x.lot === 'NEAR')[0]; const r = P.deleteBatch(b); App.stock.move({ pid: 'pa', qty: 5, type: 'return', ref: 'Y' }); return r === false; }));

  // alerts
  await go('meds'); await p.waitForSelector('#ptab .hero');
  check('Médicaments : produits à surveiller et lignes de la liste', (await p.textContent('#ptab')).includes('Paracétamol 500') && (await p.locator('#ptab [data-m]').count()) >= 4);
  check('« À faire » signale périmés et bientôt périmés', await p.evaluate(() => { const t = App.pharmacy.todo().map(x => x[0]).join('|'); return /périmé\(s\) en stock/.test(t) && /bientôt/.test(t); }));
  await go('meds', 'exp'); check('filtre « Périmés » : Paracétamol et Produit tout périmé', (await p.locator('#ptab [data-m]').count()) === 2);

  // prescription through the form: Bruno, 10 paracetamol, insurer 80 %
  await p.evaluate(() => { App.pharmacy.saveInsurer({ name: 'Mutuelle Test', pct: 80, phone: '0990000099', note: '' }); App.render(); });
  check('assureur enregistré aussi comme client (pour la facture de la part prise en charge)', await p.evaluate(() => { const i = App.db.phInsurers[0], c = App.db.clients.find(x => x.id === i.clientId); return c && c.isInsurer && !App.pharmacy.patients().some(x => x.id === c.id); }));
  await p.evaluate(() => App.pharmacy.rxForm()); await p.waitForSelector('.sheet [name=prescriber]'); await p.selectOption('.sheet [name=patientId]', 'p2'); await p.fill('.sheet [name=prescriber]', 'Test');
  await p.selectOption('.sheet .rl [name=pid]', 'pa'); await p.fill('.sheet .rl [name=qty]', '10'); await p.fill('.sheet .rl [name=posology]', '1 comprimé 3 fois par jour'); await p.selectOption('.sheet [name=insurerId]', await p.evaluate(() => App.db.phInsurers[0].id));
  check('ordonnance : taux repris de l\'assureur, total 20, patient 4, assurance 16', (await p.inputValue('.sheet [name=pct]')) === '80' && /20/.test(await p.textContent('.sheet #rt')) && /4,00/.test(await p.textContent('.sheet #rt')) && /16,00/.test(await p.textContent('.sheet #rt')));
  await ok(); await p.waitForSelector('.sheet [name=pay]'); check('délivrance : le patient paie 4', (await p.textContent('.sheet-wrap.on')).includes('4,00')); await ok(); await p.waitForFunction(() => App.db.phRx.length === 1 && App.db.phRx[0].status === 'Délivrée'); await p.waitForSelector('.sheet-wrap.on >> text=Délivrée'); await closeTop();
  const rx1 = await p.evaluate(() => App.db.phRx[0].id);
  check('OR-AAAA-0001 délivrée : facture patient 4 payée, facture assureur 16 à encaisser', await p.evaluate(id => { const r = App.pharmacy.rx(id), a = App.sales.get(r.invoiceId), b = App.sales.get(r.insurerInvoiceId), ins = App.db.phInsurers[0]; return /^OR-\d{4}-0001$/.test(r.number) && a.total === 4 && App.sales.due(a) === 0 && b.total === 16 && b.clientId === ins.clientId && App.sales.due(b) === 16 && App.pharmacy.insurerOwed(ins) === 16 && a.source === 'Pharmacie'; }, rx1));
  check('sortie de stock par lot : 10 pris dans NEAR (périmé le plus proche, non périmé)', await p.evaluate(() => { const P = App.pharmacy, mp = P.remMap(), r = k => P.rem(App.db.phBatches.find(x => x.lot === k), mp); return r('NEAR') === 20 && r('OLD') === 20 && App.stock.get('pa').qty === 140; }));
  check('les revenus de la pharmacie sont ceux des factures : 4 + 16 = 20', await p.evaluate(() => { const r = { from: '0000-00-00', to: '9999-99-99' }; return App.reports.compute(r).sales === 20; }));
  check('annuler une ordonnance délivrée et encaissée est refusé', await p.evaluate(id => App.pharmacy.cancelRx(App.pharmacy.rx(id)) === false, rx1));

  // allergy alert, and dispensing blocked on expired stock
  await p.evaluate(() => App.pharmacy.rxForm()); await p.waitForSelector('.sheet [name=prescriber]'); await p.selectOption('.sheet [name=patientId]', 'p1'); await p.selectOption('.sheet .rl [name=pid]', 'am'); await p.waitForTimeout(150);
  check('allergie à la pénicilline : alerte avant l\'enregistrement', (await p.textContent('.sheet #al')).includes('Allergie possible')); await closeTop();
  check('médicament entièrement périmé : délivrance refusée (stock périmé)', await p.evaluate(() => { const r = App.pharmacy.addRx({ patientId: 'p2', prescriber: 'T', items: [{ pid: 'ex', qty: 1 }] }); const o = App.pharmacy.dispense(r, {}); return !!o.err && /périmé/.test(o.err) && r.status === 'À délivrer' && App.db.invoices.filter(i => i.source === 'Pharmacie').length === 2; }));
  check('médicament en rupture : délivrance refusée', await p.evaluate(() => { const r = App.pharmacy.addRx({ patientId: 'p2', prescriber: 'T', items: [{ pid: 'am', qty: 500 }] }); const o = App.pharmacy.dispense(r, {}); return !!o.err && /insuffisant/.test(o.err); }));

  // controlled drug: register, unpaid dispensation then cancellation restores the stock
  const rx2 = await p.evaluate(() => { const r = App.pharmacy.addRx({ patientId: 'p1', prescriber: 'Dr Test', items: [{ pid: 'mo', qty: 2, posology: '1 ampoule' }] }); const o = App.pharmacy.dispense(r, { pay: false }); return r.id; });
  check('stupéfiant délivré : inscrit au registre, facture à crédit', await p.evaluate(id => { const r = App.pharmacy.rx(id), reg = App.pharmacy.register({ from: '0000-00-00', to: '9999-99-99' }); return r.status === 'Délivrée' && reg.length === 1 && reg[0].qty === 2 && reg[0].product === 'Morphine 10' && App.stock.get('mo').qty === 8 && App.sales.due(App.sales.get(r.invoiceId)) === 40; }, rx2));
  check('annulation d\'une délivrance non payée : stock remis (lot d\'origine), facture annulée, registre vide', await p.evaluate(id => { const r = App.pharmacy.rx(id), inv = App.sales.get(r.invoiceId), okc = App.pharmacy.cancelRx(r), P = App.pharmacy, mp = P.remMap(); return okc && r.status === 'Annulée' && inv.cancelled && App.stock.get('mo').qty === 10 && P.rem(App.db.phBatches.find(b => b.lot === 'MO1'), mp) === 10 && P.register({ from: '0000-00-00', to: '9999-99-99' }).length === 0; }, rx2));

  // destruction of expired stock = loss without cash movement; supplier return = no loss
  const cashBefore = await p.evaluate(() => App.cash.expected().USD);
  await p.evaluate(() => { const b = App.db.phBatches.find(x => x.lot === 'OLD'); App.pharmacy.opForm(b.id, 'destroy'); }); await p.waitForSelector('.sheet [name=qty]'); check('destruction : quantité proposée = reste du lot (20)', (await p.inputValue('.sheet [name=qty]')) === '20'); await p.click('.sheet-wrap.on footer .danger'); await p.waitForFunction(() => App.db.phOps.length === 1); await closeTop();
  check('PH-AAAA-0001 : périmés détruits, stock −20, dépense « Pertes de péremption » de 20', await p.evaluate(() => { const o = App.db.phOps[0], e = App.db.expenses.find(x => x.id === o.expenseId); return /^PH-\d{4}-0001$/.test(o.number) && App.stock.get('pa').qty === 120 && e && e.amount === 20 && e.category === 'Pertes de péremption' && o.cost === 20; }));
  check('la perte ne touche pas la caisse en espèces', await p.evaluate(c => App.cash.expected().USD === c, cashBefore));
  check('plus aucun périmé sur le paracétamol', await p.evaluate(() => { const x = App.pharmacy.summary().pa; return x.exp === 0 && x.near === 20; }));
  check('retour fournisseur du lot NEAR (5) : stock −5, aucune perte', await p.evaluate(() => { const b = App.db.phBatches.find(x => x.lot === 'NEAR'), n = App.db.expenses.length, o = App.pharmacy.addOp({ batchId: b.id, type: 'supret', qty: 5 }); return !!o && App.stock.get('pa').qty === 115 && App.db.expenses.length === n && App.pharmacy.rem(b) === 15; }));
  check('quantité supérieure au reste du lot refusée', await p.evaluate(() => App.pharmacy.addOp({ batchId: App.db.phBatches.find(x => x.lot === 'NEAR').id, type: 'supret', qty: 999 }) === null));
  check('journal de stock : les mouvements de perte et de retour fournisseur y figurent', await p.evaluate(() => App.db.movements.some(m => m.type === 'loss' && m.qty === -20) && App.db.movements.some(m => m.type === 'return_supplier' && m.qty === -5)));
  check('annuler la destruction : unités remises, dépense supprimée', await p.evaluate(() => { const o = App.db.phOps[0], ok1 = App.pharmacy.cancelOp(o); return ok1 && o.status === 'Annulé' && !App.db.expenses.length && App.stock.get('pa').qty === 135 && App.pharmacy.summary().pa.exp === 20; }));
  await p.evaluate(() => { App.pharmacy.addOp({ batchId: App.db.phBatches.find(x => x.lot === 'OLD').id, type: 'destroy', qty: 20 }); App.render(); });

  // screens
  await go('rx'); check('Ordonnances : liste avec statut Délivrée', (await p.textContent('#ptab')).includes('Délivrée') && (await p.locator('#ptab [data-r]').count()) >= 1);
  await go('ins'); check('Assurances : part à encaisser 16 chez Mutuelle Test', (await p.textContent('#ptab')).includes('Mutuelle Test') && (await p.textContent('#ptab')).includes('16'));
  await p.click('#ptab [data-i]'); await p.waitForSelector('.sheet-wrap.on >> text=À encaisser'); check('fiche assureur : factures à encaisser', (await p.textContent('.sheet-wrap.on')).includes('Factures à encaisser')); await closeTop();
  await go('pat'); check('Patients : allergie de la patiente affichée', (await p.textContent('#ptab')).includes('pénicilline'));
  await go('rep'); await p.waitForSelector('#ptab .hero'); check('rapport : péremption, registre, destructions', (await p.textContent('#ptab')).includes('Péremption') && (await p.textContent('#ptab')).includes('Registre des stupéfiants') && (await p.textContent('#ptab')).includes('Destructions'));
  check('rapport en texte (WhatsApp)', await p.evaluate(() => App.pharmacy.reportText(App.fin.range('month')).includes('Ordonnances délivrées')));
  check('Excel : feuilles Médicaments, Lots, Ordonnances, Opérations pharmacie', await p.evaluate(() => { const n = App.data.tables().map(x => x.name); return ['Médicaments', 'Lots', 'Ordonnances', 'Opérations pharmacie'].every(x => n.includes(x)); }));
  check('Synchro : les collections sont partagées', await p.evaluate(() => ['phInfo', 'phBatches', 'phOps', 'phRx', 'phInsurers', 'phPatients'].every(k => Array.isArray(App.db[k]))));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
