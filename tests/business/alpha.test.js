// Ordre alphabétique : les activités (assistant et réglages), la liste des modules et les tuiles du menu « Plus » se suivent dans l'ordre alphabétique français (accents et casse ignorés). Données fictives uniquement.
const { check, launch, setup } = require('./helper');
const sorted = a => a.every((x, i) => !i || a[i - 1].localeCompare(x, 'fr', { sensitivity: 'base' }) <= 0);
(async () => {
  const t = await launch(), p = t.page;
  const wiz = await p.$$eval('.wizard select[name=activity] option', o => o.map(x => x.textContent));
  check('assistant : les ' + wiz.length + ' activités sont en ordre alphabétique', wiz.length >= 70 && sorted(wiz), wiz.slice(0, 5).join(' | '));
  await setup(p, { activity: 'gaz' });
  await p.evaluate(() => App.go('settings')); await p.waitForSelector('[data-p=activity]');
  const act = await p.$$eval('[data-p=activity] option', o => o.map(x => x.textContent));
  check('réglages : activités en ordre alphabétique, « Dépôt de gaz » toujours sélectionné', sorted(act) && await p.$eval('[data-p=activity]', s => s.value === 'gaz'), act.slice(0, 5).join(' | '));
  await p.click('#modrib'); await p.waitForSelector('#modbody:not([hidden]) .mod');
  const mods = await p.$$eval('#modbody .mod b', o => o.map(x => x.textContent));
  check('réglages : les ' + mods.length + ' modules sont en ordre alphabétique', mods.length >= 60 && sorted(mods), mods.slice(0, 5).join(' | '));
  await p.evaluate(() => { App.MODULES.forEach(m => { App.db.settings.modules[m[0]] = true; }); App.save(); App.go('more'); }); await p.waitForTimeout(300);
  const tiles = await p.$$eval('h3.grp', hs => hs.map(h => [h.textContent, [...h.nextElementSibling.querySelectorAll('.tile span')].map(x => x.textContent)]));
  check('menu « Plus » : chaque groupe est en ordre alphabétique', tiles.length >= 2 && tiles.every(g => sorted(g[1])), JSON.stringify(tiles.filter(g => !sorted(g[1]))));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
