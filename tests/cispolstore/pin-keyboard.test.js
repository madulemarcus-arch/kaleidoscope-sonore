// The PIN can be typed on the keyboard (default) instead of tapping the on-screen pad; the pad stays available with a switch.
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8774';
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }), p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(async () => { const salt = 's1'; App.db.settings.pin = { salt, hash: await App.hash(salt + '246810'), len: 6, rec: 'x' }; App.save(); App.showLock('enter', 'unlock'); });
  await p.waitForTimeout(300);
  ok('default: a code field instead of the on-screen pad', await p.locator('#lock #lkin').count() === 1 && await p.locator('#lock .pad').count() === 0 && /clavier/.test(await p.innerText('#lock')));
  ok('the keyboard field is focused and invisible (nothing is shown)', await p.evaluate(() => document.activeElement && document.activeElement.id === 'lkin' && getComputedStyle(document.activeElement).opacity === '0'));
  await p.keyboard.type('2468'); await p.waitForTimeout(150);
  ok('dots follow what is typed (4 of 6)', await p.locator('#lock .dots i.f').count() === 4 && await p.evaluate(() => App.locked));
  await p.keyboard.press('Backspace'); await p.waitForTimeout(100);
  ok('Backspace removes a dot', await p.locator('#lock .dots i.f').count() === 3);
  await p.keyboard.type('x9'); await p.waitForTimeout(100);
  ok('letters are ignored', await p.locator('#lock .dots i.f').count() === 4);
  await p.keyboard.type('11'); await p.waitForTimeout(500);
  ok('a wrong code (6th digit) is refused, the field is cleared and refocused', /incorrect/.test(await p.innerText('#lock')) && await p.locator('#lock .dots i.f').count() === 0 && await p.evaluate(() => App.locked && document.activeElement.id === 'lkin'));
  await p.evaluate(() => localStorage.removeItem('cispol.pinfail'));
  await p.keyboard.type('246810'); await p.waitForTimeout(500);
  ok('the right code typed on the keyboard opens the application', await p.evaluate(() => !App.locked && document.getElementById('lock').hidden));
  // typing starts at once: no tap on the field, the keys go to the code wherever the focus is
  await p.evaluate(() => App.showLock('enter', 'unlock')); await p.waitForTimeout(200);
  await p.evaluate(() => document.activeElement.blur()); await p.keyboard.type('2468'); await p.waitForTimeout(150);
  ok('keyboard mode: digits typed without focus still fill the dots', await p.locator('#lock .dots i.f').count() === 4 && await p.evaluate(() => document.activeElement.id === 'lkin'));
  await p.keyboard.type('10'); await p.waitForTimeout(500);
  ok('...and the code opens the application', await p.evaluate(() => !App.locked));
  // switch to the pad and back
  await p.evaluate(() => App.showLock('enter', 'unlock')); await p.waitForTimeout(200);
  await p.click('[data-lk=kbtoggle]'); await p.waitForTimeout(200);
  ok('switch: the on-screen pad appears and the choice is remembered', await p.locator('#lock .pad').count() === 1 && await p.locator('#lock #lkin').count() === 0 && await p.evaluate(() => localStorage.getItem('cispol.lockkb') === '0'));
  await p.keyboard.type('246810'); await p.waitForTimeout(500);
  ok('pad mode: the physical keyboard also types the code without tapping the pad', await p.evaluate(() => !App.locked));
  await p.evaluate(() => App.showLock('enter', 'unlock')); await p.waitForTimeout(200); await p.click('[data-lk=kbtoggle]'); await p.waitForTimeout(200);
  ok('switch back to the keyboard', await p.locator('#lock #lkin').count() === 1 && await p.evaluate(() => localStorage.getItem('cispol.lockkb') === '1'));
  // Enter validates a short code (older 4-digit codes among 6-digit profiles)
  await p.evaluate(async () => { const mk = async (id, role, code, len) => { const salt = 's' + id; return { id, name: id, role, active: true, pin: { salt, hash: await App.hash(salt + code), ...(len ? { len } : {}) } }; }; App.db.settings.users = [await mk('a', 'admin', '4321'), await mk('v', 'vendeur', '246810', 6)]; App.save(); App.showLock('enter', 'unlock'); }); await p.waitForTimeout(300);
  ok('mixed lengths: the hint says Entrée', /Entrée/.test(await p.innerText('#lock')));
  await p.keyboard.type('4321'); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
  ok('a 4-digit code is validated with Enter', await p.evaluate(() => !App.locked && App.user && App.user.id === 'a'));
  // creating a PIN works with the keyboard too
  await p.evaluate(() => { App.db.settings.users = []; App.db.settings.pin = null; App.save(); App.showLock('new1', 'setup'); }); await p.waitForTimeout(300);
  await p.keyboard.type('135790'); await p.waitForTimeout(300); ok('creation: confirmation asked after 6 digits', /Confirmez/.test(await p.innerText('#lock')) && await p.evaluate(() => document.activeElement.id === 'lkin'));
  await p.keyboard.type('135790'); await p.waitForTimeout(500); ok('creation: recovery code shown', /Code de récupération/.test(await p.innerText('#lock')));
  ok('no page errors', errs.length === 0, errs.join('|')); await b.close(); process.exit(f ? 1 : 0);
})();
