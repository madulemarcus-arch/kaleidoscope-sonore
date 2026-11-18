// Letter form: the signer's name and function are two fields, both printed at the bottom; signature and stamp stay manual
const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => { const t = App.today(); App.db.clients.push({ id: 'c1', code: 'CL-1', type: 'mat', first: 'A', last: 'D', name: 'A D', phone: '1', subs: [], created: t }); App.save(); App.letterForm(null, 'c1'); });
  ok('two separate fields: name and function', !!(await p.$('#lt_rep')) && !!(await p.$('#lt_repjob')));
  await p.fill('#lf_amount', '100'); await p.fill('#lt_rep', 'Jean Mukendi'); await p.fill('#lt_repjob', 'Directeur Général'); await p.click('#dok'); await p.waitForTimeout(400);
  const r = await p.evaluate(() => { const c = App.db.letters[App.db.letters.length - 1]; return { rep: c.rep, doc: App.letterDoc(c, '', '') }; });
  ok('stored as « Nom, Fonction »', r.rep === 'Jean Mukendi, Directeur Général', r.rep);
  ok('the signature block prints the name and the function', /Nom : Jean Mukendi/.test(r.doc) && /Fonction : Directeur Général/.test(r.doc));
  ok('the signature itself is left for the pen', /Signature et cachet/.test(r.doc));
  await p.evaluate(() => App.letterForm(App.db.letters[App.db.letters.length - 1]));
  ok('editing shows the two fields filled', (await p.inputValue('#lt_rep')) === 'Jean Mukendi' && (await p.inputValue('#lt_repjob')) === 'Directeur Général');
  console.log('errors', errs); ok('no page error', errs.length === 0); await b.close(); process.exit(f ? 1 : 0);
})();
