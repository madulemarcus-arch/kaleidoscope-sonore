const { check, launch, setup } = require('./helper'), fx = require('./fixtures');
(async () => {
  const t = await launch(), p = t.page; await setup(p);
  const people = fx.people(30);
  await p.evaluate(ps => { ps.forEach((x, i) => App.db.clients.push({ id: 'c' + i, code: App.clients.nextCode(), created: '2026-01-01', name: x.name, phone: x.phone, email: x.email, type: x.type, address: '', note: '', fields: {} })); App.save(); }, people);
  await p.evaluate(() => App.go('clients')); await p.waitForSelector('.list');
  check('30 clients affichés', (await p.locator('.item[data-id]').count()) === 30);
  check('index alphabétique présent', await p.isVisible('.index'));
  check('en-têtes de lettres', (await p.locator('.lhd').count()) >= 10);
  await p.fill('#cq', people[3].phone.slice(-6)); check('recherche par téléphone', (await p.locator('.item[data-id]').count()) === 1);
  await p.fill('#cq', 'cl-0007'); check('recherche par code', (await p.locator('.item[data-id]').count()) === 1);
  await p.fill('#cq', 'zzzz'); check('aucun résultat', (await p.locator('.item[data-id]').count()) === 0); await p.fill('#cq', '');
  // add via form, duplicate phone warning
  await p.evaluate(() => App.clients.form()); await p.waitForSelector('.sheet-wrap.on'); await p.waitForTimeout(200); await p.fill('.sheet input[name=name]', 'Nouveau Client'); await p.fill('.sheet input[name=phone]', people[0].phone); await p.click('.sheet footer .primary');
  check('doublon de téléphone signalé', await p.waitForSelector('.toast.err', { timeout: 5000 }).then(() => true, () => false) && (await p.evaluate(() => App.db.clients.length)) === 30);
  await p.fill('.sheet input[name=phone]', '0899999999'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('client ajouté avec code', await p.evaluate(() => App.db.clients.length === 31 && /^CL-\d{4}$/.test(App.db.clients[30].code)));
  // profile and intl link
  await p.fill('#cq', 'Nouveau'); await p.click('.item[data-id]'); check('fiche ouverte', await p.isVisible('.sheet dl.kv'));
  check('lien WhatsApp avec indicatif', (await p.getAttribute('.sheet a[href*="wa.me"]', 'href')).endsWith('/243899999999'));
  check('lien appel', (await p.getAttribute('.sheet a[href^="tel:"]', 'href')) === 'tel:0899999999');
  await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet input[name=name]'); await p.waitForTimeout(300);
  await p.fill('.sheet input[name=name]', 'Client Modifié'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('client modifié', await p.evaluate(() => App.db.clients.some(c => c.name === 'Client Modifié')));
  // multi delete + undo
  await p.fill('#cq', ''); await p.click('#csel'); await p.locator('.item[data-id]').nth(0).click(); await p.locator('.item[data-id]').nth(1).click();
  check('compteur de sélection', (await p.textContent('.selbar')).includes('2 sélectionné'));
  await p.click('#sdel'); await p.click('.sheet footer .danger'); await p.waitForSelector('.toast button');
  check('suppression multiple', (await p.evaluate(() => App.db.clients.length)) === 29);
  await p.click('.toast button'); check('annulation de la suppression', (await p.evaluate(() => App.db.clients.length)) === 31 - 0 || (await p.evaluate(() => App.db.clients.length)) === 31);
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | ')); await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
