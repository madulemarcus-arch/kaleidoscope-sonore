const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'location' }); await p.evaluate(() => { App.db.settings.modules.delivery = true; App.save(); });
  await p.evaluate(() => { App.db.clients.push({ id: 'c1', code: 'CL-0001', name: 'Alice Test001', phone: '0810000000', type: 'Particulier', address: '5 av. Test', created: App.today(), fields: {} }); App.db.staff.push({ id: 'd1', name: 'Luc Livreur', role: 'Livreur', phone: '' }); App.save(); App.go('rental'); });
  await p.waitForSelector('#rn'); await p.click('#rn'); await p.waitForSelector('.sheet-wrap.on'); await p.waitForTimeout(150);
  await p.selectOption('.sheet [name=clientId]', 'c1'); await p.fill('.sheet [name=item]', 'Perceuse pro'); await p.fill('.sheet [name=start]', await p.evaluate(() => App.addDays(App.today(), -10))); await p.fill('.sheet [name=end]', await p.evaluate(() => App.addDays(App.today(), -3))); await p.fill('.sheet [name=price]', '40'); await p.fill('.sheet [name=deposit]', '100');
  await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  const y = new Date().getFullYear(); check('location LOC-AAAA-0001', await p.evaluate(y => App.db.rentals[0].number === 'LOC-' + y + '-0001', y));
  check('retour dépassé → « En retard », 3 jours', await p.evaluate(() => App.rental.status(App.db.rentals[0])[0] === 'En retard' && App.rental.lateDays(App.db.rentals[0]) === 3));
  check('cautions à rendre : 100 $', (await p.textContent('.stats')).replace(/\s/g, ' ').includes('100,00 $'));
  check('retour avant le début refusé', await (async () => { await p.evaluate(() => App.rental.form()); await p.waitForSelector('.sheet-wrap.on'); await p.waitForTimeout(150); await p.fill('.sheet [name=item]', 'X'); await p.fill('.sheet [name=start]', '2026-05-10'); await p.fill('.sheet [name=end]', '2026-05-01'); await p.click('.sheet footer .primary'); const ok = await p.isVisible('.toast.err'); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' }); return ok && (await p.evaluate(() => App.db.rentals.length)) === 1; })());
  // return with late fee and retention
  await p.evaluate(() => App.rental.returnForm(App.db.rentals[0].id)); await p.waitForSelector('.sheet-wrap.on'); await p.waitForTimeout(150); check('retard affiché dans le retour', (await p.textContent('.sheet')).includes('3 jour(s) de retard'));
  await p.fill('.sheet [name=back]', '150'); await p.click('.sheet footer .primary'); check('caution rendue > caution reçue refusée', await p.isVisible('.toast.err'));
  await p.fill('.sheet [name=back]', '80'); await p.fill('.sheet [name=fee]', '15'); await p.fill('.sheet [name=why]', 'Mandrin abîmé'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  const r = await p.evaluate(() => { const x = App.db.rentals[0]; return { st: App.rental.status(x)[0], retention: x.retention, back: x.depositBack, fee: App.db.invoices[0] && App.db.invoices[0].total, src: App.db.invoices[0] && App.db.invoices[0].source, dep: App.rental.deposits() }; });
  check('retour : retenue 20, frais facturés 15, plus de caution à rendre', r.st === 'Retournée' && r.retention === 20 && r.back === 80 && r.fee === 15 && r.src === 'rental' && r.dep === 0, JSON.stringify(r));
  // deliveries
  await p.evaluate(() => { const inv = App.sales.createInvoice({ clientId: 'c1', lines: [{ desc: 'Colis', qty: 1, price: 50 }] }); window.__inv = inv.id; App.save(); App.go('delivery'); }); await p.waitForSelector('#dn');
  await p.click('#dn'); await p.waitForSelector('.sheet-wrap.on'); await p.waitForTimeout(150); const invId = await p.evaluate(() => window.__inv.length ? window.__inv : App.db.invoices[App.db.invoices.length - 1].id);
  await p.evaluate(id => { const sel = document.querySelector('.sheet [name=invoiceId]'); sel.value = id; sel.dispatchEvent(new Event('input', { bubbles: true })); }, invId);
  check('facture choisie : client, adresse et montant à encaisser préremplis', (await p.inputValue('.sheet [name=clientId]')) === 'c1' && (await p.inputValue('.sheet [name=address]')) === '5 av. Test' && (await p.inputValue('.sheet [name=collect]')) === '50');
  await p.selectOption('.sheet [name=driverId]', 'd1'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('livraison LIV-AAAA-0001 À planifier', await p.evaluate(y => App.db.deliveries[0].number === 'LIV-' + y + '-0001' && App.db.deliveries[0].status === 'À planifier', y));
  check('à encaisser : 50 $ dans l\'en-tête', (await p.textContent('.stats')).replace(/\s/g, ' ').includes('50,00 $'));
  const done = p.evaluate(() => App.delivery.setStatus(App.db.deliveries[0], 'Livrée')); await p.waitForSelector('.sheet footer .primary'); check('confirmation d\'encaissement à la livraison', (await p.textContent('.sheet')).replace(/\s/g, ' ').includes('Encaisser 50,00 $')); await p.click('.sheet footer .primary'); await done;
  check('encaissé : paiement sur la facture, espèces, facture payée', await p.evaluate(() => { const i = App.db.invoices[App.db.invoices.length - 1]; return App.sales.status(i)[0] === 'Payée' && App.db.payments.some(x => x.note.includes('LIV-') && x.mode === 'Espèces') && App.db.deliveries[0].collected && App.db.deliveries[0].status === 'Livrée'; }));
  check('encaissement impossible deux fois', await p.evaluate(() => App.delivery.collect(App.db.deliveries[0]) === false));
  check('liste du jour : la livrée n\'y est plus', await p.evaluate(() => { App.go('delivery'); return true; }) && (await p.locator('.item[data-id]').count()) === 0);
  // late rental dashboard + permissions: driver can collect, cannot create
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | ')); await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
