const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'commerce' });
  await p.click('#tabs [data-go=more]'); await p.waitForSelector('#view .grid'); check('Livraisons visible (commerce)', (await p.textContent('#view')).includes('Livraisons'));
  check('Location absente (module désactivé)', !(await p.textContent('#view')).includes('Location'));
  await p.click('#top [data-go=settings]'); await p.uncheck('[data-mod=delivery]'); await p.check('[data-mod=rental]');
  await p.click('#tabs [data-go=more]'); await p.waitForSelector('#view .grid'); const txt = await p.textContent('#view');
  check('Livraisons disparaît du menu', !txt.includes('Livraisons')); check('Location apparaît', txt.includes('Location'));
  await p.click('#top [data-go=settings]'); await p.uncheck('[data-mod=sales]');
  check('onglets du bas : 5 places', (await p.locator('#tabs button').count()) === 5);
  check('Ventes retirées du menu du bas', !(await p.textContent('#tabs')).includes('Ventes'));
  await p.click('#tabs [data-go=home]'); await p.waitForSelector('#view .hero'); check('tuile facture masquée sans Ventes', !(await p.textContent('.tiles')).includes('facture'));
  await p.evaluate(() => App.go('sales')); await p.waitForSelector('#view .hero'); check('écran désactivé redirige vers accueil', await p.isVisible('.hero'));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | ')); await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
