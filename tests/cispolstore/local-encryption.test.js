// Local data encryption: the data and the secret settings are unreadable at rest, the passphrase gate starts the app, and every way back works
const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
const SECRET = 'Zéphyrine-Confidentielle', SYNC = JSON.stringify({ key: 'CLE-SYNC-SECRETE-AAAA', token: 'tok-secret', anon: 'anon-secret', ws: 'espace' });
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const ctx = await b.newContext({ ...devices['Pixel 5'] }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const dump = () => p.evaluate(async () => { const all = []; for (let i = 0; i < localStorage.length; i++) all.push(localStorage.key(i) + '=' + Storage.prototype.getItem.call(localStorage, localStorage.key(i))); let idbTxt = ''; try { idbTxt = await new Promise(ok => { const o = indexedDB.open('cispolstore', 1); o.onupgradeneeded = () => o.result.createObjectStore('kv'); o.onerror = () => ok(''); o.onsuccess = () => { try { const r = o.result.transaction('kv').objectStore('kv').get('db2'); r.onsuccess = () => ok(String(r.result || '')); r.onerror = () => ok(''); } catch (e) { ok(''); } }; }); } catch (e) {} return { ls: all.join('\n'), idb: idbTxt, keys: all.map(x => x.split('=')[0]) }; });
  const booted = () => p.waitForFunction(() => window.__gateDone && window.App && App.db && document.getElementById('view') && !document.getElementById('gp'), null, { timeout: 15000 });
  const unlock = async pw => { await p.fill('#gp', pw); await p.click('#gb'); };
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(([s, sync]) => { App.db.clients.push({ id: 'c1', code: 'CL-1', type: 'mat', first: s, last: 'X', name: s + ' X', phone: '0811', subs: [], created: App.today() }); localStorage.setItem('cispolstore-sync', sync); App.save(); }, [SECRET, SYNC]);
  await p.waitForTimeout(300);
  let d = await dump();
  ok('before: the data is readable in localStorage (as always) and mirrored in IndexedDB', d.ls.includes(SECRET) && d.idb.includes(SECRET));
  // enable through the settings
  await p.evaluate(() => App.go('settings')); await p.waitForTimeout(400);
  ok('Réglages offers « Chiffrer les données de ce téléphone »', !!(await p.$('[data-act=enc_on]')));
  await p.click('[data-act=enc_on]'); await p.waitForTimeout(200);
  await p.fill('#enc_p1', 'court'); await p.fill('#enc_p2', 'court'); await p.click('#dok'); await p.waitForTimeout(300);
  ok('a short passphrase is refused', /Au moins 8/.test(await p.innerText('#enc_msg')) && await p.evaluate(() => !window.__enc.on));
  await p.fill('#enc_p1', 'phrase-secrete-1'); await p.fill('#enc_p2', 'autre-chose-123'); await p.click('#dok'); await p.waitForTimeout(300);
  ok('two different passphrases are refused', /pas identiques/.test(await p.innerText('#enc_msg')) && await p.evaluate(() => !window.__enc.on));
  await p.fill('#enc_p2', 'phrase-secrete-1'); await p.click('#dok'); await p.waitForTimeout(1500);
  await p.evaluate(() => window.__enc.flush());
  ok('encryption is on', await p.evaluate(() => window.__enc.on));
  ok('enabling the encryption is written in the security journal', await p.evaluate(() => (App.db.audit || []).some(e => e.kind === 'sec' && /activé le chiffrement/.test(e.text))));
  d = await dump();
  ok('NOTHING readable is left: no client name, no sync key, no plain data key, no IndexedDB mirror', !d.ls.includes(SECRET) && !d.ls.includes('CLE-SYNC') && !d.keys.includes('cispolstore-v2') && !d.keys.includes('cispolstore-sync') && !d.idb.includes(SECRET) && d.keys.includes('cispolstore-enc'), JSON.stringify(d.keys));
  ok('the application still reads its secret settings (served from memory)', await p.evaluate(s => localStorage.getItem('cispolstore-sync') === s, SYNC));
  await p.evaluate(() => { App.db.clients.push({ id: 'c2', code: 'CL-2', type: 'mat', first: 'Nouveau', last: 'Client', name: 'Nouveau Client', phone: '0822', subs: [], created: App.today() }); App.save(); localStorage.setItem('cispolstore-gmail', '{"accounts":[{"email":"a@example.test"}]}'); });
  await p.evaluate(() => window.__enc.flush());
  // restart: the gate
  await p.reload({ waitUntil: 'commit' }); await p.waitForSelector('#gp', { timeout: 10000 });
  ok('after a restart, the passphrase screen is shown and the application is NOT started', !!(await p.$('#gp')) && await p.evaluate(() => !window.App));
  await unlock('mauvais-mot-de-passe'); await p.waitForFunction(() => /incorrect/.test(document.getElementById('gm').textContent), null, { timeout: 10000 });
  ok('a wrong passphrase is refused, the app stays closed', await p.evaluate(() => !window.App && !!document.getElementById('gp')));
  await p.evaluate(() => { document.getElementById('gp').value = ''; document.activeElement.blur(); }); await p.keyboard.type('abc');
  ok('typing starts at once on the passphrase screen (no tap on the field)', await p.evaluate(() => document.getElementById('gp').value === 'abc'));
  await unlock('phrase-secrete-1'); await booted();
  ok('the right passphrase starts the application with ALL the data (both clients)', await p.evaluate(() => App.db.clients.length === 2 && !!App.client('c2')));
  await p.waitForTimeout(1500); ok('the wrong passphrase typed before the opening is reported in the journal', await p.evaluate(() => (App.db.audit || []).some(e => e.kind === 'sec' && e.fail && /mauvais essai\(s\) du mot de passe/.test(e.text))));
  ok('no PIN screen on top of the passphrase', await p.evaluate(() => document.getElementById('lock').hidden));
  ok('secret settings are back for the application (sync, gmail)', await p.evaluate(s => localStorage.getItem('cispolstore-sync') === s && /a@example.test/.test(localStorage.getItem('cispolstore-gmail')), SYNC));
  d = await dump(); ok('still nothing readable at rest after the restart', !d.ls.includes(SECRET) && !d.ls.includes('CLE-SYNC') && !d.keys.includes('cispolstore-v2'));
  // a change after the restart is kept
  await p.evaluate(() => { App.client('c1').phone = '0999'; App.save(); }); await p.evaluate(() => window.__enc.flush());
  await p.reload({ waitUntil: 'commit' }); await p.waitForSelector('#gp'); await unlock('phrase-secrete-1'); await booted();
  ok('changes made after unlocking are kept (encrypted)', await p.evaluate(() => App.client('c1').phone === '0999'));
  // change the passphrase
  await p.evaluate(() => App.go('settings')); await p.waitForTimeout(400);
  ok('Réglages shows the encryption as active with Changer / Désactiver', /Données chiffrées/.test(await p.innerText('#view')) && !!(await p.$('[data-act=enc_change]')) && !!(await p.$('[data-act=enc_off]')));
  await p.click('[data-act=enc_change]'); await p.waitForTimeout(200); await p.fill('#enc_p0', 'faux'); await p.fill('#enc_p1', 'nouvelle-phrase-2'); await p.fill('#enc_p2', 'nouvelle-phrase-2'); await p.click('#dok'); await p.waitForTimeout(800);
  ok('changing needs the current passphrase', /actuel incorrect/.test(await p.innerText('#enc_msg')));
  await p.fill('#enc_p0', 'phrase-secrete-1'); await p.click('#dok'); await p.waitForTimeout(1500); await p.evaluate(() => window.__enc.flush());
  await p.reload({ waitUntil: 'commit' }); await p.waitForSelector('#gp'); await unlock('phrase-secrete-1'); await p.waitForFunction(() => /incorrect/.test(document.getElementById('gm').textContent));
  ok('the old passphrase no longer works', await p.evaluate(() => !window.App));
  await unlock('nouvelle-phrase-2'); await booted();
  ok('the new passphrase opens the data', await p.evaluate(() => App.db.clients.length === 2));
  // lock-out and automatic wipe
  await p.evaluate(() => { localStorage.setItem('cispol.encfail', JSON.stringify({ n: 2, until: 0 })); }); await p.reload({ waitUntil: 'commit' }); await p.waitForSelector('#gp');
  await unlock('x1234567'); await p.waitForFunction(() => /patientez/.test(document.getElementById('gm').textContent), null, { timeout: 10000 });
  ok('after 3 wrong passphrases, a waiting delay is imposed', await p.evaluate(() => document.getElementById('gb').disabled));
  await p.evaluate(() => localStorage.setItem('cispol.encfail', JSON.stringify({ n: 0, until: 0 }))); await p.reload({ waitUntil: 'commit' }); await p.waitForSelector('#gp'); await unlock('nouvelle-phrase-2'); await booted();
  ok('a good passphrase resets the failure counter', await p.evaluate(() => !localStorage.getItem('cispol.encfail')));
  // wipe option
  await p.evaluate(() => { window.__enc.setWipeOpt(true); }); await p.reload({ waitUntil: 'commit' }); await p.waitForSelector('#gp');
  await p.evaluate(() => localStorage.setItem('cispol.encfail', JSON.stringify({ n: 9, until: 0 })));
  await unlock('encore-faux-123'); await p.waitForTimeout(2500); await p.waitForFunction(() => window.App || document.getElementById('gp'), null, { timeout: 10000 }).catch(() => {});
  d = await dump(); ok('wipe option: the 10th wrong passphrase deletes the data of this phone (the application restarts empty)', !d.keys.includes('cispolstore-enc') && !d.ls.includes(SECRET) && await p.evaluate(() => !!window.App && App.db.clients.length === 0));
  // switching off (fresh run)
  await p.evaluate(() => { localStorage.clear(); }); await p.goto(BASE + '/index.html'); await p.waitForTimeout(600); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(([s, sync]) => { App.db.clients.push({ id: 'c9', code: 'CL-9', type: 'mat', first: s, last: 'Y', name: s + ' Y', phone: '1', subs: [], created: App.today() }); localStorage.setItem('cispolstore-sync', sync); App.save(); }, [SECRET, SYNC]);
  await p.evaluate(() => App.go('settings')); await p.waitForTimeout(300); await p.click('[data-act=enc_on]'); await p.fill('#enc_p1', 'phrase-secrete-9'); await p.fill('#enc_p2', 'phrase-secrete-9'); await p.click('#dok'); await p.waitForTimeout(1500);
  await p.evaluate(() => App.go('settings')); await p.waitForTimeout(400); await p.click('[data-act=enc_off]'); await p.fill('#enc_p0', 'mauvais'); await p.click('#dok'); await p.waitForTimeout(800);
  ok('switching off needs the passphrase', /incorrect/.test(await p.innerText('#enc_msg')) && await p.evaluate(() => window.__enc.on));
  await p.fill('#enc_p0', 'phrase-secrete-9'); await p.click('#dok'); await p.waitForTimeout(1500);
  d = await dump();
  ok('switched off: data and sync settings are back in plain storage, no vault left', !d.keys.includes('cispolstore-enc') && d.ls.includes(SECRET) && d.ls.includes('CLE-SYNC') && await p.evaluate(() => !window.__enc.on));
  await p.reload({ waitUntil: 'commit' }); await p.waitForTimeout(800);
  ok('after switching off, the application opens directly (no passphrase screen)', await p.evaluate(() => !!window.App && !document.getElementById('gp') && !!App.client('c9')));
  console.log('errors', errs); ok('no page error', errs.length === 0); await b.close(); process.exit(f ? 1 : 0);
})();
