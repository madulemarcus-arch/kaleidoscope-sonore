// Fingerprint unlock (WebAuthn) next to the PIN, tested with a virtual platform authenticator
const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const ctx = await b.newContext({ ...devices['Pixel 5'] }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const cdp = await ctx.newCDPSession(p); await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: false, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  const pin = async d => { for (const c of d) await p.click(`#lock [data-k="${c}"]`); };
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(async () => { App.db.settings.pin = null; const salt = 's1'; App.db.settings.pin = { salt, hash: await App.hash(salt + '1234') }; App.save(); App.go('settings'); }); await p.waitForTimeout(500);
  const txt = () => p.evaluate(() => document.getElementById('view').innerText);
  ok('settings offer « Empreinte — Activer » when the device supports it', /Empreinte/.test(await txt()) && !!(await p.$('[data-act=bioset]')));
  ok('nothing stored yet', await p.evaluate(() => !App.bio.mine() && !localStorage.getItem('cispol.bio')));
  await p.click('[data-act=bioset]'); await p.waitForTimeout(300);
  ok('the PIN is asked first', await p.evaluate(() => !document.getElementById('lock').hidden));
  await pin('1234'); await p.waitForTimeout(1200);
  ok('after the PIN the fingerprint is enrolled (credential id kept)', await p.evaluate(() => App.bio.mine()));
  ok('settings now show it as active', /Activée/.test(await txt()) && !!(await p.$('[data-act=bioremove]')));
  const creds = await cdp.send('WebAuthn.getCredentials', { authenticatorId }); ok('the authenticator holds one credential', creds.credentials.length === 1);
  ok('the id is device-bound: not in the settings, nor in the exported data', await p.evaluate(() => !('bio' in App.db.settings) && !('bio' in App.exportData().settings) && !JSON.stringify(App.exportData()).includes(JSON.parse(localStorage.getItem('cispol.bio'))[0].id)));
  // lock: the fingerprint opens it by itself
  await p.evaluate(() => App.showLock('enter', 'unlock')); await p.waitForTimeout(1500);
  ok('locked screen: fingerprint opens the app without typing', await p.evaluate(() => document.getElementById('lock').hidden && !App.locked));
  // refused fingerprint: stays locked, PIN still works
  await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });
  await p.evaluate(() => App.showLock('enter', 'unlock')); await p.waitForTimeout(1500);
  ok('refused fingerprint: the screen stays locked', await p.evaluate(() => !document.getElementById('lock').hidden && App.locked));
  ok('the « Utiliser l\'empreinte » button is shown', !!(await p.$('[data-lk=bio]')));
  await pin('1234'); await p.waitForTimeout(500);
  ok('the PIN still unlocks', await p.evaluate(() => document.getElementById('lock').hidden));
  // a wrong PIN is still refused
  await p.evaluate(() => App.showLock('enter', 'unlock')); await p.waitForTimeout(400); await pin('9999'); await p.waitForTimeout(400);
  ok('a wrong PIN is refused', await p.evaluate(() => !document.getElementById('lock').hidden));
  // disable
  await pin('1234').catch(() => {}); await p.waitForTimeout(300);
  await p.evaluate(() => { App.unlockNow(); App.go('settings'); }); await p.waitForTimeout(400);
  await p.click('[data-act=bioremove]'); await p.waitForTimeout(400);
  ok('disabled: id removed, PIN kept', await p.evaluate(() => !App.bio.mine() && !App.bio.on() && !!App.db.settings.pin));
  await p.evaluate(() => App.showLock('enter', 'unlock')); await p.waitForTimeout(800);
  ok('no fingerprint button once disabled', !(await p.$('[data-lk=bio]')));
  // v197 kept the id in the settings: it moves to this device's storage by itself
  await p.evaluate(() => { localStorage.removeItem('cispol.bio'); App.db.settings.bio = { id: 'AAAA' }; App.save(); });
  await p.reload(); await p.waitForTimeout(700);
  ok('old settings.bio is migrated to the device storage and removed from the settings', await p.evaluate(() => App.bio.on() && !('bio' in App.db.settings) && JSON.parse(localStorage.getItem('cispol.bio'))[0].u === 'solo'));
  console.log('errors', errs); ok('no page error', errs.length === 0); await b.close(); process.exit(f ? 1 : 0);
})();
