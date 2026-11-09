const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p);
  await p.click('#top [data-go=settings]');
  await p.fill('[data-p=city]', 'Lubumbashi'); await p.dispatchEvent('[data-p=city]', 'change');
  await p.fill('[data-legal-v="0"]', 'CD/LSH/RCCM/00-0000'); await p.fill('[data-vocab=client]', 'élève'); await p.dispatchEvent('[data-vocab=client]', 'change');
  await p.click('[data-cfadd=clients]'); await p.fill('.sheet input[name=label]', 'Immatriculation'); await p.click('.sheet footer .primary');
  await p.click('[data-t=dark]'); check('thème sombre appliqué', (await p.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  await t.reload();
  const s = await p.evaluate(() => App.db.settings);
  check('ville enregistrée', s.city === 'Lubumbashi'); check('mention légale enregistrée', s.legal[0].v.startsWith('CD/LSH')); check('vocabulaire enregistré', s.vocab.client === 'élève');
  check('champ personnalisé enregistré', s.fields.clients.length === 1 && s.fields.clients[0].label === 'Immatriculation');
  check('thème sombre conservé', (await p.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  // IndexedDB copy restores data when localStorage is wiped
  await p.waitForTimeout(500); await p.evaluate(() => localStorage.clear()); await t.reload();
  check('restauration automatique depuis IndexedDB', (await p.evaluate(() => App.db.settings.city)) === 'Lubumbashi');
  // migration fills missing keys
  await p.evaluate(() => localStorage.setItem('biz.db', JSON.stringify({ v: 0, settings: { name: 'Vieux', setup: true } }))); await t.reload();
  check('migration : clés manquantes complétées', await p.evaluate(() => App.db.settings.modules.sales === true && Array.isArray(App.db.clients) && App.db.settings.currency === 'USD' && App.db.settings.name === 'Vieux'));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | ')); await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
