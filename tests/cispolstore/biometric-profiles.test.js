// Fingerprint unlock with profiles: each profile enrols on this device, the finger itself tells which profile opens
const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const ctx = await b.newContext({ ...devices['Pixel 5'] }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const cdp = await ctx.newCDPSession(p); await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: false, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  const pin = async d => { for (const c of d) await p.click(`#lock [data-k="${c}"]`); };
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(async () => { const mk = async (id, name, role, code) => { const salt = 's' + id; return { id, name, role, active: true, pin: { salt, hash: await App.hash(salt + code) } }; };
    App.db.settings.users = [await mk('u1', 'Chef', 'admin', '1111'), await mk('u2', 'Awa', 'comptable', '2222')]; App.user = App.users()[0]; App.applyRole(); App.save(); App.go('profile'); }); await p.waitForTimeout(500);
  const txt = () => p.evaluate(() => document.getElementById('view').innerText);
  ok('profile page offers « Ouvrir avec mon empreinte »', /Ouvrir avec mon empreinte/.test(await txt()) && !!(await p.$('[data-act=bioset]')));
  // admin enrols
  await p.click('[data-act=bioset]'); await p.waitForTimeout(300); await pin('1111'); await p.waitForTimeout(1200);
  ok('admin enrolled; shown as active', await p.evaluate(() => App.bio.mine()) && /Empreinte activée/.test(await txt()));
  // second profile enrols
  await p.evaluate(() => { App.me_login(App.users()[1]); App.go('profile'); }); await p.waitForTimeout(400);
  ok('Awa does not have it yet (per profile)', await p.evaluate(() => !App.bio.mine()));
  await p.click('[data-act=bioset]'); await p.waitForTimeout(300); await pin('2222'); await p.waitForTimeout(1200);
  ok('Awa enrolled', await p.evaluate(() => App.bio.mine()));
  const ents = await p.evaluate(() => JSON.parse(localStorage.getItem('cispol.bio')));
  ok('two entries on this device, none in the synced settings', ents.length === 2 && ents.map(e => e.u).sort().join() === 'u1,u2' && await p.evaluate(() => !('bio' in App.db.settings)));
  // lock: the finger opens the profile it belongs to
  await cdp.send('WebAuthn.removeCredential', { authenticatorId, credentialId: Buffer.from(ents.find(e => e.u === 'u1').id, 'base64url').toString('base64') });
  await p.evaluate(() => App.showLock('enter', 'unlock')); await p.waitForTimeout(1800);
  ok('fingerprint (Awa\'s) opens Awa\'s profile, no code typed', await p.evaluate(() => document.getElementById('lock').hidden && App.user && App.user.id === 'u2'));
  // the PIN of another profile still works, and an unknown finger leaves it locked
  await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });
  await p.evaluate(() => App.showLock('enter', 'unlock')); await p.waitForTimeout(1500);
  ok('refused fingerprint: stays locked', await p.evaluate(() => !document.getElementById('lock').hidden && App.locked));
  await pin('1111'); await p.waitForTimeout(600);
  ok('the admin PIN still opens the admin profile', await p.evaluate(() => document.getElementById('lock').hidden && App.user.id === 'u1'));
  // deactivated profile: its finger no longer opens anything
  await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: true });
  await p.evaluate(() => { App.db.settings.users = App.users().map(u => u.id === 'u2' ? { ...u, active: false } : u); App.save(); App.showLock('enter', 'unlock'); }); await p.waitForTimeout(1500);
  ok('deactivated profile: its fingerprint does not open it (screen stays locked)', await p.evaluate(() => !document.getElementById('lock').hidden && App.locked && !(App.user && App.user.id === 'u2')));
  await pin('1111'); await p.waitForTimeout(500);
  // disable for admin only
  await p.evaluate(() => { App.db.settings.users = App.users().map(u => ({ ...u, active: true })); App.go('profile'); }); await p.waitForTimeout(400);
  await p.click('[data-act=bioremove]'); await p.waitForTimeout(400);
  ok('admin disabled his own; Awa\'s stays', await p.evaluate(() => !App.bio.mine() && JSON.parse(localStorage.getItem('cispol.bio')).length === 1 && JSON.parse(localStorage.getItem('cispol.bio'))[0].u === 'u2'));
  console.log('errors', errs); ok('no page error', errs.length === 0); await b.close(); process.exit(f ? 1 : 0);
})();
