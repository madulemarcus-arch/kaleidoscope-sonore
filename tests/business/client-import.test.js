const { check, launch, setup } = require('./helper'), fx = require('./fixtures');
(async () => {
  const t = await launch(), p = t.page; await setup(p);
  await p.evaluate(() => App.go('clients')); await p.waitForSelector('#cimp');
  await p.click('#cimp'); await p.setInputFiles('#imf', fx.csvFile(12));
  await p.waitForSelector('[data-m]');
  const map = await p.evaluate(() => JSON.stringify([...document.querySelectorAll('[data-m]')].map(s => [s.dataset.m, s.value])));
  check('colonnes reconnues (nom, téléphone, courriel, type)', ['name|0', 'phone|1', 'email|2', 'type|3'].every(x => { const [k, v] = x.split('|'); return JSON.parse(map).some(m => m[0] === k && m[1] === v); }), map);
  check('aperçu : 12 nouveaux', (await p.textContent('.sheet .body')).includes('12 nouveau'));
  await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('12 clients importés', (await p.evaluate(() => App.db.clients.length)) === 12);
  check('types créés (Entreprise, Particulier)', await p.evaluate(() => App.db.clients.every(c => ['Entreprise', 'Particulier'].includes(c.type))));
  // undo via toast
  await p.click('.toast button'); check('annulation de l\'import', (await p.evaluate(() => App.db.clients.length)) === 0);
  // re-import then duplicates
  await p.click('#cimp'); await p.setInputFiles('#imf', fx.csvFile(12)); await p.waitForSelector('[data-m]'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  await p.click('#cimp'); await p.setInputFiles('#imf', fx.csvFile(15)); await p.waitForSelector('[data-m]');
  const txt = await p.textContent('.sheet .body'); check('comparaison : 3 nouveaux, 12 déjà enregistrés', txt.includes('3 nouveau') && txt.includes('12 déjà'));
  await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('doublons ignorés par défaut', (await p.evaluate(() => App.db.clients.length)) === 15);
  // update mode
  await p.evaluate(() => { App.db.clients[0].email = ''; App.save(); });
  await p.click('#cimp'); await p.setInputFiles('#imf', fx.csvFile(15)); await p.waitForSelector('[name=mode]'); await p.selectOption('[name=mode]', 'update'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('mise à jour des doublons', await p.evaluate(() => App.db.clients[0].email.endsWith('@example.test') && App.db.clients.length === 15));
  await p.evaluate(() => App.clients.undoImport()); check('annulation restaure l\'ancien état', await p.evaluate(() => App.db.clients[0].email === ''));
  // xlsx
  await p.evaluate(() => { App.db.clients = []; App.save(); App.render(); }); await p.click('#cimp'); await p.setInputFiles('#imf', fx.xlsxFile(8)); await p.waitForSelector('[data-m]');
  check('lecture .xlsx sans bibliothèque', (await p.textContent('.sheet .body')).includes('8 nouveau'));
  await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' }); check('8 clients importés depuis Excel', (await p.evaluate(() => App.db.clients.length)) === 8);
  // custom field mapping
  await p.evaluate(() => { App.db.settings.fields.clients.push({ id: 'v', label: 'Ville', type: 'text', options: '' }); App.db.clients = []; App.save(); });
  await p.click('#cimp'); await p.setInputFiles('#imf', fx.csvFile(5)); await p.waitForSelector('[data-m]'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('champ personnalisé importé', await p.evaluate(() => /^Ville\d$/.test(App.db.clients[0].fields.v)));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | ')); await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
