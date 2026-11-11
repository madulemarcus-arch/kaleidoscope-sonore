const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'commerce' });
  await p.evaluate(() => { App.db.settings.name = 'Ets Mavuela'; App.db.settings.goal = 200; ['Alice Test001', 'Bernard Test002'].forEach((n, i) => App.db.clients.push({ id: 'c' + i, code: 'CL-000' + (i + 1), name: n, phone: '0810000000', type: 'Particulier', created: App.today(), fields: {} }));
    App.db.invoices.push({ id: 'i1', number: 'FAC-2026-0001', clientId: 'c0', date: App.today(), currency: 'USD', rate: 2800, lines: [{ desc: 'Riz', qty: 1, price: 50, cost: 20 }], sub: 50, total: 50, disc: {}, fields: {} }, { id: 'i0', number: 'FAC-2026-0000', clientId: 'c1', date: App.addDays(App.today(), -40), currency: 'USD', rate: 2800, lines: [{ desc: 'Riz', qty: 1, price: 30, cost: 10 }], sub: 30, total: 30, disc: {}, fields: {} }); App.save(); App.go('home'); App.render(); });
  // identity
  check('police Inter chargée', await p.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px Inter') && getComputedStyle(document.body).fontFamily.includes('Inter'); }));
  check('palette CISPOLstore : marine, orange, jaune', await p.evaluate(() => { const c = getComputedStyle(document.documentElement); return c.getPropertyValue('--navy').trim() === '#12365d' && c.getPropertyValue('--pri').trim() === '#d5522f' && c.getPropertyValue('--yel').trim() === '#e5b044'; }));
  check('marque Business dans l\'en-tête (logo par défaut)', (await p.getAttribute('#top img.logo', 'src')) === 'icons/logo.svg');
  check('salutation avec le nom de l\'entreprise', (await p.textContent('.hello')).includes('Ets Mavuela'));
  check('date en français avec majuscule initiale', /^[A-Z][a-zéû]+ \d{1,2} [a-zéû]+$/.test((await p.textContent('.hero-date')).trim()));
  // hero
  check('ciel animé derrière le héros', await p.isVisible('.hero canvas.sky') && await p.evaluate(() => { const c = document.querySelector('.hero canvas.sky'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; }));
  await p.waitForTimeout(900); check('chiffre d\'affaires du mois affiché (50 $)', (await p.textContent('#amt')).replace(/\s/g, ' ').includes('50,00 $'));
  check('anneau d\'objectif : 25 % de 200 $', (await p.textContent('.hero .ring')).includes('25'));
  await p.click('#per [data-p=year]'); await p.waitForTimeout(900); check('période « Cette année » : 80 $', (await p.textContent('#amt')).replace(/\s/g, ' ').includes('80,00 $'));
  await p.click('#per [data-p=today]'); await p.waitForTimeout(900); check('période « Aujourd\'hui » : 50 $', (await p.textContent('#amt')).replace(/\s/g, ' ').includes('50,00 $'));
  await p.click('#per [data-p=month]');
  await p.click('#goal'); await p.waitForSelector('.sheet [name=goal]'); await p.fill('.sheet [name=goal]', '500'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' }); check('objectif modifiable depuis l\'anneau', await p.evaluate(() => App.db.settings.goal === 500) && (await p.textContent('.hero .ring')).includes('10'));
  check('quatre actions rapides colorées', (await p.locator('.qa button').count()) === 4 && await p.evaluate(() => [...document.querySelectorAll('.qa button span')].every(s => s.style.getPropertyValue('--qc'))));
  check('compteurs : clients, factures, produits', (await p.textContent('.cnts')).includes('2 clients') && (await p.textContent('.cnts')).includes('2 factures'));
  // navigation icons
  check('icônes bicolores dans le menu du bas', (await p.locator('#tabs svg.ic').count()) === 5 && (await p.locator('#tabs button.on svg.ic').count()) === 1);
  // global search
  await p.click('#gs'); await p.waitForSelector('#gsq'); await p.fill('#gsq', 'bernard'); check('recherche globale : client trouvé', (await p.textContent('#gsr')).includes('Bernard Test002'));
  await p.fill('#gsq', 'FAC-2026-0001'); check('recherche globale : facture trouvée', (await p.textContent('#gsr')).includes('FAC-2026-0001'));
  await p.click('#gsr [data-g^="invoices"]'); await p.waitForSelector('.sheet-wrap.on .stats'); check('un résultat ouvre sa fiche', (await p.textContent('.sheet h2')).includes('FAC-2026-0001')); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  await p.click('#gsbtn'); await p.waitForSelector('#gsq'); check('bouton de recherche de l\'en-tête', true); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  // brand: company logo replaces the mark
  await p.evaluate(() => { App.db.settings.logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='; App.render(); }); check('le logo de l\'entreprise remplace la marque', (await p.getAttribute('#top img.logo', 'src')).startsWith('data:image/png'));
  // dark theme
  const bg1 = await p.evaluate(() => getComputedStyle(document.body).backgroundColor); await p.evaluate(() => { App.db.settings.theme = 'dark'; App.ui.applyTheme(); });
  check('thème sombre : fond marine', (await p.evaluate(() => getComputedStyle(document.body).backgroundColor)) !== bg1 && (await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())) === '#0a1a2c');
  await p.evaluate(() => { App.db.settings.theme = 'light'; App.ui.applyTheme(); });
  // count-up and celebration
  check('confettis sur l\'objectif atteint', await p.evaluate(() => { App.db.settings.goal = 40; App.db.settings.goalHit = ''; App.save(); App.render(); return true; }) && (await p.waitForSelector('#confetti', { timeout: 3000 }).then(() => true, () => false)));
  check('objectif célébré une seule fois par mois', await p.evaluate(() => App.db.settings.goalHit === App.today().slice(0, 7)));
  // lock keypad by tapping the keys
  await p.evaluate(async () => { await App.roles.addUser('Marie Admin', 'admin', '4321'); App.flush(); }); await t.reload(); await p.click('#lock [data-u]'); check('clavier PIN : 4 points', (await p.locator('#pd i').count()) === 4);
  for (const k of ['4', '3']) await p.click('#lock [data-k="' + k + '"]'); check('les points se remplissent', (await p.locator('#pd i.f').count()) === 2);
  await p.click('#lock [data-k="x"]'); check('effacer retire un chiffre', (await p.locator('#pd i.f').count()) === 1);
  for (const k of ['9', '9', '9']) await p.click('#lock [data-k="' + k + '"]'); await p.waitForTimeout(200); check('mauvais PIN : secousse et message', (await p.textContent('#lmsg')).includes('incorrect') && await p.evaluate(() => document.querySelector('#pd').classList.contains('shake')));
  for (const k of ['4', '3', '2', '1']) await p.click('#lock [data-k="' + k + '"]'); await p.waitForSelector('#lock', { state: 'hidden' }); check('bon PIN : validation automatique', await p.evaluate(() => App.user && App.user.name === 'Marie Admin'));
  // reduced motion: still a sky, no loop
  const ctx2 = await t.browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 800 }, serviceWorkers: 'block' }), q = await ctx2.newPage(); await q.goto(process.env.BASE_URL + '/index.html'); await q.waitForSelector('html[data-ready="1"]'); await q.fill('.wizard input[name=name]', 'Ets Test'); for (let i = 0; i < 3; i++) await q.click('[data-next]'); await q.waitForSelector('.wizard', { state: 'detached' });
  check('mouvement réduit : ciel statique et chiffre direct', await q.isVisible('.hero canvas.sky') && (await q.textContent('#amt')).includes('0,00')); await ctx2.close();
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | ')); await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
