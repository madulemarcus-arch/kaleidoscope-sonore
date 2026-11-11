const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'commerce' });
  await p.evaluate(() => App.go('stock')); await p.waitForSelector('#np');
  check('écran vide au départ', await p.isVisible('.empty'));
  await p.click('#np'); await p.waitForSelector('.sheet-wrap.on'); await p.waitForTimeout(150); await p.fill('.sheet input[name=name]', 'Sac de riz'); await p.fill('.sheet input[name=cat]', 'Alimentation'); await p.fill('.sheet input[name=unit]', 'kg');
  await p.fill('.sheet input[name=qty]', '50'); await p.fill('.sheet input[name=min]', '10'); await p.fill('.sheet input[name=cost]', '1,5'); await p.fill('.sheet input[name=price]', '2'); await p.click('.sheet footer .primary');
  await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('produit créé avec code PR-0001', await p.evaluate(() => App.db.products[0].code === 'PR-0001' && App.db.products[0].qty === 50));
  check('catégorie et unité mémorisées', await p.evaluate(() => App.db.settings.categories.includes('Alimentation') && App.db.settings.units.includes('kg')));
  check('coût mémorisé', await p.evaluate(() => App.db.products[0].cost === 1.5), JSON.stringify(await p.evaluate(() => App.db.products[0]))); check('stock initial journalisé', await p.evaluate(() => App.db.movements.length === 1 && App.db.movements[0].type === 'in'));
  { const v = await p.textContent('.hero .amt'); check('valeur du stock = 50 × 1,50', v.replace(/\s/g, ' ').startsWith('75,00'), v); }
  await p.evaluate(() => { for (const n of ['Huile', 'Sucre']) App.db.products.push({ id: n, code: App.stock.nextCode(), name: n, cat: 'Alimentation', unit: 'pièce', track: true, qty: 20, min: 5, cost: 10, price: 12, fields: {}, supplierId: '' }); App.save(); App.render(); });
  check('tri par valeur : le plus gros d\'abord', await (async () => { await p.click('#byv'); return (await p.locator('.item[data-id]').first().textContent()).includes('Huile') || (await p.locator('.item[data-id]').first().textContent()).includes('Sucre'); })());
  // out below minimum → alert
  await p.evaluate(() => App.stock.moveForm('out', 'Huile')); await p.click('.sheet .stepper [data-d="1"]'); for (let i = 0; i < 13; i++) await p.click('.sheet .stepper [data-d="1"]');
  await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('sortie enregistrée (20 − 15 = 5)', await p.evaluate(() => App.stock.get('Huile').qty === 5));
  check('alerte stock bas affichée', (await p.textContent('.warnbox')).includes('Huile'));
  await p.click('[data-f=low]'); check('filtre « Stock bas »', (await p.locator('.item[data-id]').count()) === 1);
  await p.click('[data-f=all]');
  // insufficient stock needs a second tap
  await p.evaluate(() => App.stock.moveForm('out', 'Sucre')); await p.fill('.sheet input[name=qty]', '999'); await p.click('.sheet footer .primary');
  check('stock insuffisant : confirmation demandée', await p.isVisible('.toast.err') && (await p.evaluate(() => App.stock.get('Sucre').qty)) === 20);
  await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  // product report
  await p.fill('#pq', 'riz'); await p.click('.item[data-id]'); check('rapport du produit', (await p.textContent('.sheet .stats')).includes('50') && await p.isVisible('.sheet dl.kv'));
  await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  await p.click('#jr'); check('journal des mouvements', (await p.locator('.sheet .item').count()) >= 2); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  // untracked product (service)
  await p.fill('#pq', '');
  await p.evaluate(() => App.stock.form()); await p.fill('.sheet input[name=name]', 'Livraison'); await p.uncheck('.sheet input[name=track]'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('produit sans suivi : ∞', (await p.textContent('#view')).includes('∞'));
  // delete product
  await p.evaluate(() => App.stock.form(App.db.products.find(x => x.name === 'Livraison').id)); await p.click('.sheet footer .danger'); await p.locator('.sheet-wrap').last().locator('footer .danger').click();
  await p.waitForTimeout(400); check('produit supprimé', await p.evaluate(() => !App.db.products.some(x => x.name === 'Livraison')));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | ')); await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
