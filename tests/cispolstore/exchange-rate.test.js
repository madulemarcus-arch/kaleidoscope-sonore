const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => { const t = App.today(); App.db.clients.push({ id: 'c1', code: 'CL-1', type: 'mat', first: 'Awa', last: 'D', name: 'Awa D', phone: '081', subs: [], created: t });
    // legacy invoice (no rate) + legacy payment
    App.db.invoices.push({ id: 'old', number: 'OLD', type: 'materiel', clientId: 'c1', date: t, currency: 'CDF', lines: [{ pid: '', desc: 'X', qty: 1, price: 240000, cost: 0 }], created: t }); App.save(); });
  ok('legacy invoice stamped at the current rate (2400) on first save', await p.evaluate(() => App.db.invoices[0].rate === 2400));
  const ca = () => p.evaluate(() => App.finance(App.range('month')).ca);
  ok('CDF invoice 240000 = 100 $ at 2400', Math.abs(await ca() - 100) < 0.01);
  // rate changes -> past keeps its rate
  await p.evaluate(() => { App.setRate(2600); App.save(); });
  ok('after rate 2600 the old invoice is still 100 $ (not 92.3)', Math.abs(await ca() - 100) < 0.01, await ca());
  ok('history has the change', await p.evaluate(() => App.db.settings.rates.length === 1 && App.db.settings.rates[0].rate === 2600));
  // a new CDF invoice uses the new rate
  const r = await p.evaluate(() => { const i = App.createInvoice({ type: 'materiel', clientId: 'c1', currency: 'CDF', payMode: 'Cash', lines: [{ pid: '', desc: 'Y', qty: 1, price: 260000, cost: 0 }] }, 0); return [i.rate, App.usd(App.invTotal(i), 'CDF', i)]; });
  ok('new invoice frozen at 2600 (260000 CDF = 100 $)', r[0] === 2600 && Math.abs(r[1] - 100) < 0.01, r);
  // rate changes again; both stay
  await p.evaluate(() => { App.setRate(2800); App.save(); }); ok('both invoices still 100 $ each (200 $ total)', Math.abs(await ca() - 200) < 0.01, await ca());
  // payment in the other currency at its own rate
  const pay = await p.evaluate(() => { const i = App.createInvoice({ type: 'materiel', clientId: 'c1', currency: 'USD', payMode: 'Cash', lines: [{ pid: '', desc: 'Z', qty: 1, price: 100, cost: 0 }] }, 0);
    App.db.payments.push({ id: 'py', date: App.today(), clientId: 'c1', invoiceId: i.id, amount: 140000, currency: 'CDF', rate: 2800, mode: 'Cash', ref: '', comment: '' }); App.save(); const paid = App.invPaid(i); App.setRate(3000); App.save(); return [paid, App.invPaid(i), App.invDue(i)]; });
  ok('140000 CDF paid at 2800 = 50 $, unchanged after rate 3000', Math.abs(pay[0] - 50) < 0.01 && Math.abs(pay[1] - 50) < 0.01 && Math.abs(pay[2] - 50) < 0.01, pay);
  // printed invoice shows its own rate
  const doc = await p.evaluate(() => App.invoiceDoc(App.db.invoices.find(i => i.id === 'old'))); ok('printed invoice shows 2400 (its rate), not the current 3000', /2 ?400 CDF/.test(doc.replace(/ | /g, ' ')) && !/3 ?000 CDF/.test(doc.replace(/ | /g, ' ')));
  // invoice form: field + typing a new rate updates the day's rate
  await p.evaluate(() => App.invoiceForm('materiel')); ok('form pre-filled with the current rate 3000', (await p.inputValue('#f_rate')) === '3000');
  await p.selectOption('#f_cl', 'c1'); await p.fill('#f_rate', '3100'); await p.dispatchEvent('#f_rate', 'change'); await p.selectOption('#f_cur', 'CDF'); await p.fill('#f_desc', 'Câble'); await p.fill('#f_price', '31000'); await p.click('#f_add'); await p.click('#dok');
  const last = await p.evaluate(() => { const i = App.db.invoices[App.db.invoices.length - 1]; return [i.rate, App.rate(), App.db.settings.rates.slice(-1)[0].rate]; }); ok('invoice rate 3100 and the day rate follows (3100)', last[0] === 3100 && last[1] === 3100 && last[2] === 3100, last);
  // backdated invoice picks the rate of that date
  await p.evaluate(() => { App.db.settings.rates.unshift({ date: '2026-01-01', ts: 1, rate: 2000 }); App.save(); });
  await p.evaluate(() => App.invoiceForm('materiel')); await p.fill('#f_date', '2026-03-01'); await p.dispatchEvent('#f_date', 'change'); ok('backdated: rate field = rate on that date (2000)', (await p.inputValue('#f_rate')) === '2000'); await p.keyboard.press('Escape');
  // payment form
  await p.evaluate(() => App.paymentForm({})); ok('payment form has the rate field', (await p.inputValue('#f_rate')) === '3100'); await p.keyboard.press('Escape');
  // dashboard chip + quick edit
  await p.evaluate(() => App.go('home')); const chip = await p.innerText('[data-act=rate_edit]'); ok('dashboard shows the rate', /3\s?100 CDF/.test(chip.replace(/ | /g, ' ')), chip);
  await p.click('[data-act=rate_edit]'); await p.fill('#f_rate', '3200'); await p.click('#dok'); ok('quick edit works + history', await p.evaluate(() => App.rate() === 3200 && App.db.settings.rates.slice(-1)[0].rate === 3200));
  // restore of a legacy backup (no rates)
  const rs = await p.evaluate(() => { const o = JSON.parse(JSON.stringify(App.exportData())); o.invoices.forEach(i => delete i.rate); o.payments.forEach(x => delete x.rate); delete o.settings.rates; return App.restoreData(JSON.stringify(o)) && (App.save(), App.db.invoices.every(i => i.rate > 0) && App.db.payments.every(x => x.rate > 0)); }); ok('legacy backup restored then stamped', rs);
  console.log('errors', errs); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); await b.close();
})();
