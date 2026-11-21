// Recovery code sheet: PDF / print buttons on the screen that shows the code once, secret warning, one page, nothing kept.
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8774';
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }), p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const pin = async d => { for (const c of d) await p.click(`#lock [data-k="${c}"]`); await p.waitForTimeout(250); };
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => { App.db.settings.company.name = 'Ma Boutique'; App.save(); App.showLock('new1', 'setup'); }); await p.waitForTimeout(200);
  await pin('135790'); await pin('135790'); await p.waitForTimeout(300);
  let t = await p.innerText('#lock');
  ok('recovery screen shows the code and the three actions', /Code de récupération/.test(t) && await p.locator('#lock [data-lk=recpdf]').count() === 1 && await p.locator('#lock [data-lk=recprint]').count() === 1 && await p.locator('#lock [data-lk=recdone]').count() === 1);
  ok('the screen warns that the document is secret', /Document secret/.test(t));
  const code = await p.evaluate(() => document.querySelector('#lock h1[style]').textContent.trim()); ok('code looks like XXXX-XXXX', /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code), code);
  await p.evaluate(() => { window.__pdf = null; navigator.canShare = () => true; navigator.share = async o => { window.__pdf = { name: o.files[0].name, f: o.files[0] }; }; });
  await p.click('#lock [data-lk=recpdf]'); await p.waitForFunction(() => window.__pdf, null, { timeout: 15000 }).catch(() => {});
  const r = await p.evaluate(async () => { const x = window.__pdf; if (!x) return null; const txt = new TextDecoder('latin1').decode(new Uint8Array(await x.f.arrayBuffer())); return { name: x.name, head: txt.slice(0, 5), pages: +(/\/Count (\d+)/.exec(txt) || [0, -1])[1], size: x.f.size }; });
  ok('PDF produced: right name, %PDF, one page', !!r && r.name === 'Code-de-recuperation-PIN.pdf' && r.head === '%PDF-' && r.pages === 1 && r.size > 2000, JSON.stringify(r));
  ok('lock screen still on the code after the PDF', /Code de récupération/.test(await p.innerText('#lock')));
  const doc = await p.evaluate(async c => App.recoveryDoc(c, 'Admin', ''), code);
  ok('the sheet holds the code, the company, the secret notice and the passphrase line', doc.includes(code) && doc.includes('Ma Boutique') && /Document secret/.test(doc) && /Mot de passe de l'application/.test(doc) && /data-fit/.test(doc));
  ok('the sheet never contains a passphrase value or the PIN', !doc.includes('135790'));
  await p.click('#lock [data-lk=recdone]'); await p.waitForTimeout(400);
  ok('after "J\'ai noté le code": unlocked, nothing kept in the data', await p.evaluate(() => !App.locked && !JSON.stringify(App.db).includes('recCode')));
  ok('the stored recovery data is only a hash (cannot rebuild the sheet)', await p.evaluate(() => { const s = App.db.settings.pin; return !!s.rec && /^[0-9a-f]{64}$/.test(s.rec); }));
  ok('no page errors', errs.length === 0, errs.join('|')); await b.close(); process.exit(f ? 1 : 0);
})();
