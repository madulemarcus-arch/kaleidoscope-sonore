const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p);
  const w = await p.evaluate(() => [0, 1, 21, 71, 80, 81, 91, 100, 200, 1000, 1001, 2000, 80000, 1e6, 2e6, 1234567].map(n => App.money.words(n)));
  const exp = ['zéro', 'un', 'vingt et un', 'septante et un', 'quatre-vingts', 'quatre-vingt-un', 'nonante et un', 'cent', 'deux cents', 'mille', 'mille un', 'deux mille', 'quatre-vingt mille', 'un million', 'deux millions', 'un million deux cent trente-quatre mille cinq cent soixante-sept'];
  exp.forEach((e, i) => check('en lettres : ' + e, w[i] === e, w[i]));
  check('formes françaises en option', await p.evaluate(() => { App.db.settings.words = 'fr'; const r = App.money.words(71) === 'soixante et onze' && App.money.words(90) === 'quatre-vingt-dix'; App.db.settings.words = 'be'; return r; }));
  const iw = await p.evaluate(() => [App.money.inWords(120.5, 'USD'), App.money.inWords(1, 'USD'), App.money.inWords(2800, 'CDF'), App.money.inWords(1e6, 'CDF')]);
  check('montant en lettres USD', iw[0] === 'Cent vingt dollars américains et cinquante cents', iw[0]); check('un dollar', iw[1] === 'Un dollar américain', iw[1]);
  check('montant en lettres CDF', iw[2] === 'Deux mille huit cents francs congolais', iw[2]); check('million de', iw[3] === 'Un million de francs congolais', iw[3]);
  const f = await p.evaluate(() => [App.money.fmt(1234.5, 'USD'), App.money.fmt(2800000, 'CDF'), App.money.convert(10, 'USD', 'CDF'), App.money.convert(5600, 'CDF', 'USD')]);
  check('format USD', f[0].replace(/\s/g, ' ') === '1 234,50 $', f[0]); check('format CDF sans décimales', f[1].replace(/\s/g, ' ') === '2 800 000 FC', f[1]);
  check('conversion USD→CDF au taux 2800', f[2] === 28000); check('conversion CDF→USD', f[3] === 2);
  await p.click('#ratechip'); await p.fill('.sheet input[name=rate]', '3000'); await p.click('.sheet footer .primary');
  check('taux modifié en un geste', (await p.textContent('#ratechip')).replace(/\s/g, ' ').includes('3 000 CDF'));
  await p.waitForSelector('.sheet-wrap', { state: 'detached' }); await p.click('#ratechip'); await p.fill('.sheet input[name=rate]', '0'); await p.click('.sheet footer .primary'); check('taux 0 refusé', await p.isVisible('.sheet') && await p.isVisible('.toast.err'));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | ')); await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
