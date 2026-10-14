// Importing a client list (CSV in the layout of the owner's spreadsheet), with synthetic data.
const { chromium, devices } = require('playwright'); const { csvFile } = require('../fixtures');
const BASE = process.env.BASE_URL || 'http://localhost:8774';
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }), p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => App.go('importc')); await p.waitForTimeout(300);
  await p.setInputFiles('#im_file', csvFile(40)); await p.waitForTimeout(1200);
  let v = await p.innerText('#view'); ok('preview reads 40 clients', /Clients lus\s*\n?\s*40/.test(v), v.slice(0, 160).replace(/\n+/g, ' | '));
  await p.click('[data-act=imp_go]'); await p.waitForTimeout(700);
  const r = await p.evaluate(() => ({ n: App.db.clients.length, a: App.db.clients.find(c => c.acc === 'ACC-TEST-00001'), plans: Object.keys(App.db.settings.plans || {}), gere: App.db.clients.filter(c => c.type === 'gere').length, late: App.db.clients.filter(c => /Solde/i.test(c.note || '')).length }));
  ok('40 clients imported', r.n === 40, String(r.n));
  ok('first client mapped (name, ACC, phone, plan)', r.a && r.a.first === 'Alice' && r.a.last === 'Test001' && /^08\d{8}$/.test(r.a.phone) && /illimit/i.test(r.a.plan), JSON.stringify(r.a && [r.a.first, r.a.last, r.a.phone, r.a.plan]));
  ok('plans created from the file', r.plans.some(x => /illimit/i.test(x)) && r.plans.includes('250 Go'), r.plans.join(','));
  ok('clients with a subscription are managed clients', r.gere === 40, String(r.gere));
  const st = await p.evaluate(() => { const c = {}; App.db.clients.forEach(x => { const s = App.sub(x), k = s ? s.status : 'sans'; c[k] = (c[k] || 0) + 1; }); return c; });
  ok('subscription status computed (active and expired both present)', st.actif > 0 && (st.inactif > 0 || st.sursis > 0), JSON.stringify(st));
  await p.evaluate(() => App.go('importc')); await p.waitForTimeout(200); await p.setInputFiles('#im_file', csvFile(40)); await p.waitForTimeout(1000);
  v = await p.innerText('#view'); ok('second import: nothing new to add', /À ajouter\s*\n?\s*0/.test(v) || /Ajouter 0/.test(v), (v.match(/À ajouter[\s\S]{0,30}/) || [''])[0].replace(/\n/g, ' '));
  await p.evaluate(() => App.go('importc')); await p.waitForTimeout(200); await p.setInputFiles('#im_file', csvFile(55)); await p.waitForTimeout(1000);
  v = await p.innerText('#view'); ok('a longer file only offers the 15 new clients', /Nouveaux\s*\n?\s*15/.test(v) && /Déjà présents\s*\n?\s*40/.test(v), v.slice(0, 200).replace(/\n+/g, ' | '));
  ok('no page errors', errs.length === 0, errs.join('|')); await b.close(); process.exit(f ? 1 : 0);
})();
