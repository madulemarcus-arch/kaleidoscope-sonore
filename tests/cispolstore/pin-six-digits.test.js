// PIN with 6 digits + progressive delays: new codes have 6 digits, old 4-digit codes still work, wrong codes are counted across reloads.
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8774';
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }), p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const pin = async d => { for (const c of d) await p.click(`#lock [data-k="${c}"]`); await p.waitForTimeout(250); };
  await p.addInitScript(() => { try { localStorage.setItem('cispol.lockkb', '0'); } catch (e) {} });
await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  // 1. creating a PIN: 6 dots, 6 digits needed, confirmation must match
  await p.evaluate(() => App.showLock('new1', 'setup')); await p.waitForTimeout(200);
  ok('creation screen asks for 6 digits with 6 dots', /6 chiffres/.test(await p.innerText('#lock')) && await p.locator('#lock .dots i').count() === 6);
  await pin('1234'); ok('4 digits are not enough (no confirmation yet)', /6 chiffres/.test(await p.innerText('#lock')) && !/Confirmez/.test(await p.innerText('#lock')));
  await pin('56'); ok('after 6 digits: confirmation asked', /Confirmez/.test(await p.innerText('#lock')));
  await pin('123456'); await p.waitForTimeout(300); ok('recovery code shown after the confirmation', /Code de récupération/.test(await p.innerText('#lock')));
  await p.click('[data-lk=recdone]'); await p.waitForTimeout(300);
  ok('stored code has len 6', await p.evaluate(() => App.db.settings.pin && App.db.settings.pin.len === 6 && App.pinLen(App.db.settings.pin) === 6));
  ok('settings say 6 digits', (await p.evaluate(() => { App.go('settings'); return new Promise(r => setTimeout(() => r(document.getElementById('view').innerText), 400)); })).includes('Activé (6 chiffres)'));
  // 2. unlock, wrong codes counted with delays that survive a reload
  await p.evaluate(() => App.showLock('enter', 'unlock')); await p.waitForTimeout(200);
  await pin('111111'); ok('wrong code 1: message with remaining tries', /Code incorrect \(2 essai/.test(await p.innerText('#lock')));
  await pin('111111'); ok('wrong code 2: one try left', /Code incorrect \(1 essai/.test(await p.innerText('#lock')));
  await pin('111111'); await p.waitForTimeout(300); let t = await p.innerText('#lock'); ok('wrong code 3: blocked with a countdown', /Trop d'essais : patientez/.test(t), t.replace(/\n/g, ' | '));
  await pin('123456'); ok('the right code is refused during the delay', await p.evaluate(() => App.locked));
  const f3 = await p.evaluate(() => JSON.parse(localStorage.getItem('cispol.pinfail')));
  ok('delay stored: 3 failures, about 30 s', f3.n === 3 && f3.until - Date.now() > 25000 && f3.until - Date.now() <= 30500, JSON.stringify(f3));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(700);
  ok('after a reload the lock is still there and the delay too', await p.evaluate(() => App.locked && JSON.parse(localStorage.getItem('cispol.pinfail')).n === 3));
  await pin('123456'); ok('still refused after the reload', await p.evaluate(() => App.locked));
  // 3. delays double, then success resets the counter
  await p.evaluate(() => localStorage.setItem('cispol.pinfail', JSON.stringify({ n: 5, until: 0 })));
  await p.evaluate(() => App.showLock('enter', 'unlock')); await p.waitForTimeout(200);
  await pin('111111'); const f6 = await p.evaluate(() => JSON.parse(localStorage.getItem('cispol.pinfail')));
  ok('6th failure: 4 minutes (30 s x 2^3)', f6.n === 6 && Math.abs((f6.until - Date.now()) / 1000 - 240) < 5, JSON.stringify(f6));
  await p.evaluate(() => localStorage.setItem('cispol.pinfail', JSON.stringify({ n: 4, until: 0 })));
  await p.evaluate(() => App.showLock('enter', 'unlock')); await p.waitForTimeout(200); await pin('123456'); await p.waitForTimeout(300);
  ok('right code unlocks and clears the counter', await p.evaluate(() => !App.locked && localStorage.getItem('cispol.pinfail') === null));
  // 4. an old 4-digit code keeps working; changing it asks for 6 digits
  await p.evaluate(async () => { const salt = 'old1'; App.db.settings.pin = { salt, hash: await App.hash(salt + '4321'), rec: 'x' }; App.save(); App.showLock('enter', 'unlock'); }); await p.waitForTimeout(250);
  ok('old code: 4 dots', await p.locator('#lock .dots i').count() === 4);
  await pin('4321'); await p.waitForTimeout(300); ok('old 4-digit code still unlocks', await p.evaluate(() => !App.locked));
  ok('settings invite to move to 6 digits', (await p.evaluate(() => { App.go('settings'); return new Promise(r => setTimeout(() => r(document.getElementById('view').innerText), 400)); })).includes('passer à 6 chiffres'));
  await p.evaluate(() => App.showLock('enter', 'change')); await p.waitForTimeout(200); await pin('4321'); await p.waitForTimeout(300);
  ok('change: the new code is asked with 6 dots', /6 chiffres/.test(await p.innerText('#lock')) && await p.locator('#lock .dots i').count() === 6);
  // 5. profiles with mixed lengths: ✓ key appears, auto-submit at the longest
  await p.evaluate(() => App.showLock('enter', 'unlock')); await p.evaluate(async () => {
    const mk = async (id, role, code, len) => { const salt = 's' + id; return { id, name: id, role, active: true, pin: { salt, hash: await App.hash(salt + code), ...(len ? { len } : {}) } }; };
    App.db.settings.users = [await mk('a', 'admin', '4321'), await mk('v', 'vendeur', '246810', 6)]; App.save(); App.showLock('enter', 'unlock');
  }); await p.waitForTimeout(300);
  ok('mixed lengths: 6 dots and a ✓ key', await p.locator('#lock .dots i').count() === 6 && await p.locator('#lock [data-k="✓"]').count() === 1);
  await pin('4321'); await p.click('#lock [data-k="✓"]'); await p.waitForTimeout(600);
  ok('the 4-digit profile logs in with ✓', await p.evaluate(() => !App.locked && App.user && App.user.id === 'a'));
  await p.evaluate(() => App.showLock('enter', 'unlock')); await p.waitForTimeout(200); await pin('246810'); await p.waitForTimeout(600);
  ok('the 6-digit profile logs in on the sixth digit', await p.evaluate(() => !App.locked && App.user && App.user.id === 'v'));
  ok('no page errors', errs.length === 0, errs.join('|')); await b.close(); process.exit(f ? 1 : 0);
})();
