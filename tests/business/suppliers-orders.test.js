const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'commerce' });
  await p.evaluate(() => App.go('suppliers')); await p.waitForSelector('#sn'); await p.click('#sn');
  await p.fill('.sheet input[name=name]', 'Grossiste Test'); await p.fill('.sheet input[name=phone]', '0812345678'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('fournisseur créé FO-0001', await p.evaluate(() => App.db.suppliers[0].code === 'FO-0001'));
  await p.fill('#sq', 'gross'); check('recherche fournisseur', (await p.locator('.item[data-id]').count()) === 1);
  await p.evaluate(() => { const sid = App.db.suppliers[0].id; App.db.products.push({ id: 'a', code: App.stock.nextCode(), name: 'Farine', cat: 'Général', unit: 'kg', track: true, qty: 2, min: 10, cost: 3, price: 4, supplierId: sid, fields: {} }, { id: 'b', code: App.stock.nextCode(), name: 'Lait', cat: 'Général', unit: 'pièce', track: true, qty: 0, min: 4, cost: 1, price: 2, supplierId: '', fields: {} }); App.save(); });
  await p.evaluate(() => App.go('stock')); await p.waitForSelector('#ro'); check('compteur À commander', (await p.textContent('#ro')).includes('(2)'));
  await p.click('#ro'); check('regroupement par fournisseur', (await p.locator('.sheet section.card').count()) === 2);
  check('quantité suggérée = 2 × min − stock', (await p.inputValue('.sheet [name=q_a]')) === '18');
  await p.locator('.sheet section.card', { hasText: 'Grossiste Test' }).locator('[data-mk]').click(); await p.waitForTimeout(500);
  check('bon BC-AAAA-0001 créé', await p.evaluate(() => /^BC-\d{4}-0001$/.test(App.db.orders[0].number) && App.db.orders[0].lines[0].qty === 18));
  await p.waitForSelector('[data-rc]'); check('bon affiché en cours', await p.isVisible('[data-rc]'));
  check('texte du bon pour WhatsApp', await p.evaluate(() => App.stock.orderText(App.db.orders[0]).includes('Farine : 18 kg')));
  await p.click('[data-rc]'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('réception : stock mis à jour (2 + 18)', await p.evaluate(() => App.stock.get('a').qty === 20 && App.db.orders[0].status === 'received'));
  check('réception journalisée avec fournisseur', await p.evaluate(() => App.db.movements.some(m => m.ref === App.db.orders[0].number && m.supplierId === App.db.suppliers[0].id)));
  // inventory
  await p.click('#inv'); await p.fill('.sheet tr[data-p="a"] input', '19'); check('écart affiché', (await p.textContent('.sheet tr[data-p="a"] .gap')).includes('-1'));
  await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('inventaire : stock corrigé', await p.evaluate(() => App.stock.get('a').qty === 19 && App.stock.get('b').qty === 0 && App.db.inventories.length === 1));
  // supplier with history can't be deleted
  await p.evaluate(() => App.go('suppliers')); await p.waitForSelector('.item[data-id]'); await p.evaluate(() => App.suppliers.form(App.db.suppliers[0].id)); await p.click('.sheet footer .danger');
  check('fournisseur avec historique non supprimable', await p.isVisible('.toast.err') && (await p.evaluate(() => App.db.suppliers.length)) === 1);
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | ')); await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
