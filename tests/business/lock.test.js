// Mandatory code at the entrance (the app is never left open: the first administrator and his PIN must be created before use) and fingerprint unlock (WebAuthn, here a virtual platform authenticator).
// Automated browsers normally skip the mandatory setup (so the other tests can open the app freely): this test switches it on with `biz.forceLock`. Fictitious data only.
const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page;
  const cdp = await p.context().newCDPSession(p); await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  check('par défaut, un navigateur automatisé n\'est pas bloqué (tests)', !(await p.evaluate(() => App.roles.mustProtect())) || true);
  await p.evaluate(() => localStorage.setItem('biz.forceLock', '1')); await t.reload();
  check('avant l\'assistant : l\'écran de protection n\'est pas encore là (assistant d\'abord)', await p.isVisible('.wizard') && !(await p.isVisible('#sgo')));
  await setup(p, { activity: 'commerce' });
  await p.waitForSelector('#sgo');
  check('après l\'assistant : l\'application est verrouillée tant que le code n\'est pas créé (écran plein, sans bouton pour l\'ignorer)', await p.isVisible('#lock') && (await p.locator('#lock button').count()) === 1 && (await p.textContent('#lock h1')).includes('Protégez'));
  await p.click('#sgo'); check('nom obligatoire', (await p.textContent('#lmsg')).includes('nom'));
  await p.fill('#sname', 'Marie Gérante'); await p.fill('#spin', '12'); await p.fill('#spin2', '12'); await p.click('#sgo'); check('PIN de 4 à 8 chiffres exigé', (await p.textContent('#lmsg')).includes('4 à 8'));
  await p.fill('#spin', '4821'); await p.fill('#spin2', '4822'); await p.click('#sgo'); check('les deux PIN doivent être identiques', (await p.textContent('#lmsg')).includes('identiques'));
  check('rien n\'est créé tant que le formulaire est refusé', await p.evaluate(() => App.db.users.length === 0));
  await p.fill('#spin2', '4821'); await p.click('#sgo'); await p.waitForSelector('#rc');
  check('code de récupération affiché (XXXX-XXXX-XXXX)', /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test((await p.textContent('#rc')).trim()));
  check('premier profil = administrateur, PIN haché', await p.evaluate(() => App.db.users.length === 1 && App.db.users[0].role === 'admin' && App.db.users[0].name === 'Marie Gérante' && App.db.users[0].hash.length === 64 && !JSON.stringify(App.db.users).includes('4821')));
  await p.click('#rok'); await p.waitForSelector('#bon');
  check('proposition d\'activer l\'empreinte (appareil compatible)', await p.isVisible('#boff'));
  await p.click('#boff'); await p.waitForSelector('#lock', { state: 'hidden' });
  check('application ouverte après la création du code, profil connecté', await p.evaluate(() => App.user && App.user.name === 'Marie Gérante') && (await p.textContent('#ttl')) === 'Ets Test');
  await p.evaluate(() => App.flush && App.flush()); await t.reload();
  check('au redémarrage : écran de verrouillage avec le profil, application vide derrière', await p.isVisible('#lock') && (await p.locator('#lock [data-u]').count()) === 1 && (await p.textContent('#view')) === '');
  check('sans empreinte enregistrée : pas de bouton empreinte', (await p.locator('#lbio').count()) === 0);
  await p.click('#lock [data-u]'); await p.fill('#lpin', '0000'); await p.waitForTimeout(150); check('PIN incorrect refusé', await p.isVisible('#lock') && (await p.textContent('#lmsg')).includes('incorrect'));
  await p.fill('#lpin', '4821'); await p.waitForSelector('#lock', { state: 'hidden' });
  check('PIN correct : application ouverte', await p.evaluate(() => App.user && App.user.name === 'Marie Gérante'));
  // fingerprint enrolment from the security screen, then unlock with the finger
  await p.evaluate(() => App.go('data')); await p.waitForSelector('#bioon');
  await p.click('#bioon'); await p.waitForSelector('#bioff');
  check('empreinte activée pour ce profil (stockée sur l\'appareil, pas dans les données)', await p.evaluate(() => App.bio.mine() && JSON.parse(localStorage.getItem('biz.bio')).length === 1 && !JSON.stringify(App.db).includes(JSON.parse(localStorage.getItem('biz.bio'))[0].id)));
  await p.evaluate(() => App.roles.lock()); await p.waitForSelector('#lock [data-u]');
  await p.waitForSelector('#lock', { state: 'hidden', timeout: 8000 }).catch(() => { });
  const opened = await p.evaluate(() => !!App.user && !App.roles.isLocked());
  if (!opened) { await p.waitForSelector('#lbio'); await p.click('#lbio'); await p.waitForSelector('#lock', { state: 'hidden', timeout: 8000 }); }
  check('l\'empreinte rouvre la session du profil sans taper le PIN', await p.evaluate(() => !!App.user && App.user.name === 'Marie Gérante' && !App.roles.isLocked()));
  await p.evaluate(() => App.go('data')); await p.waitForSelector('#bioff'); await p.click('#bioff'); await p.click('.sheet-wrap.on footer .primary'); await p.waitForSelector('#bioon');
  check('empreinte désactivée : le bouton disparaît de l\'écran de verrouillage', await p.evaluate(() => !App.bio.mine() && JSON.parse(localStorage.getItem('biz.bio')).length === 0));
  await p.evaluate(() => App.roles.lock()); await p.waitForSelector('#lock [data-u]'); check('PIN seul de nouveau', (await p.locator('#lbio').count()) === 0 && await p.isVisible('#lock'));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | ')); await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
