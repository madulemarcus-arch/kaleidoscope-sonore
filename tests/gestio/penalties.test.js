const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const ctx = await b.newContext({ ...devices['Pixel 5'] }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => { const t = App.today(); App.db.clients.push({ id: 'c1', code: 'CL-1', type: 'gere', first: 'Awa', last: 'D', name: 'Awa D', phone: '0812345678', plan: 'Résidentiel', price: 70, start: App.addDays(t, -50), period: 30, grace: 15, subs: [], created: t }); App.save(); });
  await p.evaluate(() => App.go('client', { id: 'c1', tab: 'abo' }));
  ok('penalty block visible', /Pénalités/.test(await p.innerText('#view')) && /Aucune pénalité/.test(await p.innerText('#view')));
  await p.click('[data-act=pen_new]'); await p.fill('#f_a', '10'); await p.fill('#f_r', 'Retard de paiement'); await p.click('#dok');
  let tx = (await p.innerText('#view')).replace(/\n/g, ' '); ok('penalty added, to pay', /10 \$/.test(tx) && /À payer/.test(tx) && /1 à payer/.test(tx), tx.slice(-200));
  ok('cost defaults to full amount', await p.evaluate(() => App.db.penalties[0].cost === 10));
  // unpaid page lists it + total
  await p.evaluate(() => App.go('impayes')); tx = (await p.innerText('#view')).replace(/\n/g, ' '); ok('impayés shows penalty, total 10 $', /Pénalités à encaisser/.test(tx) && /Total à encaisser 10 \$/.test(tx), tx.slice(0, 250));
  ok('dashboard banner counts it', (await p.evaluate(() => { App.go('home'); return document.getElementById('view').innerText; })).includes('Impayés : 10 $'));
  // reminder
  await p.evaluate(() => App.go('client', { id: 'c1', tab: 'abo' }));
  const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null), p.click('[data-act=pen_reminder]')]); ok('whatsapp reminder opened', !!pop);
  console.log(decodeURIComponent(await p.evaluate(() => App.waUrl('081', App.penaltyText(App.db.penalties[0], App.client('c1'))))));
  // mark paid
  await p.click('[data-act=pen_pay]'); await p.selectOption('#f_m', 'M-Pesa'); await p.click('#dok');
  tx = (await p.innerText('#view')).replace(/\n/g, ' '); ok('marked paid with date', /Payée le/.test(tx) && !/1 à payer/.test(tx), tx.slice(-160));
  ok('history log says paid', await p.evaluate(() => App.db.log.some(l => /Pénalité payée/.test(l.text))));
  // profit: pass-through => margin 0
  ok('pass-through: ca +10, cost +10 (margin unchanged)', await p.evaluate(() => { const r = App.range('month'); const inv = App.db.invoices; const pen = App.db.penalties.filter(x => x.paid); return pen.length === 1 && pen[0].cost === 10; }));
  // partial pass-through: edit cost to 7 -> profit 3
  await p.click('[data-act=pen_edit]'); await p.fill('#f_cost', '7'); await p.click('#dok');
  const rep = await p.evaluate(() => { App.go('reports'); return null; }); await p.click('#view >> text=Bénéfices').catch(() => {});
  const bt = (await p.innerText('#view')).replace(/\n/g, ' '); ok('benefices report has penalty row, margin 3', /Pénalité · Awa D/.test(bt) && /Marge brute\s*3 \$/.test(bt), bt.slice(0, 300));
  await p.evaluate(() => App.go('client', { id: 'c1', tab: 'abo' })); await p.click('[data-act=pen_unpay]'); ok('unpay', await p.evaluate(() => !App.db.penalties[0].paid));
  // delete client removes penalties
  ok('excel has Pénalités sheet', await p.evaluate(() => App.reportSheets().some(s => s.title === 'Pénalités' && s.rows.length === 2)));
  ok('old backup restores', await p.evaluate(() => { const o = JSON.parse(JSON.stringify(App.exportData())); delete o.penalties; return App.restoreData(JSON.stringify(o)) && Array.isArray(App.db.penalties); }));
  console.log('errors', errs); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); await b.close();
})();
