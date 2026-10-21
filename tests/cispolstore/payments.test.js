const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(()=>{document.addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{const d=document.querySelector('dialog');if(d&&d.open&&/Envoyez le reçu au client/.test(d.textContent))d.close()}).observe(document,{subtree:true,childList:true,attributes:true,characterData:true}))}); // these tests are not about the receipt window: close it as soon as it opens
await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => { App.db.clients.push({ id: 'c1', code: 'CL-1', type: 'mat', first: 'Awa', last: 'Diop', name: 'Awa Diop', phone: '081', subs: [], created: App.today() }); App.setRate(2800); App.save(); });
  const open = async () => { await p.evaluate(() => App.invoiceForm('materiel')); await p.selectOption('#f_cl', 'c1'); await p.fill('#f_desc', 'Starlink'); await p.fill('#f_price', '450'); await p.click('#f_add'); };
  const sum = async () => (await p.innerText('#p_sum')).replace(/ | /g, ' ');
  // ---- the payment card is visible and prefilled with the full amount
  await open(); ok('payment card present, titled', /Paiement du client/.test(await p.innerText('#paycard')));
  ok('total shown + given prefilled with the total', /450/.test(await p.innerText('#p_total')) && (await p.inputValue('#f_paid')) === '450');
  ok('"Payée en totalité" by default', /Payée en totalité/.test(await sum()));
  await p.fill('#f_paid', '200'); ok('partial: "Reste à payer : 250 $"', /Reste à payer : 250 \$/.test(await sum()), await sum());
  await p.click('#p_none'); ok('"Rien pour l\'instant": invoice stays unpaid', /restera impayée/.test(await sum()) && (await p.inputValue('#f_paid')) === '0');
  await p.click('#p_half'); ok('"La moitié" = 225', (await p.inputValue('#f_paid')) === '225'); await p.click('#p_all'); ok('"Tout payé" = 450', (await p.inputValue('#f_paid')) === '450');
  await p.fill('#f_paid', '500'); ok('gave 500 → change to give back 50 $', /À rendre au client : 50 \$/.test(await sum()), await sum());
  // overpay: only the total is recorded
  await p.selectOption('#f_pay', 'M-Pesa'); await p.fill('#f_ref', 'MP999'); await p.click('#dok'); await p.waitForTimeout(300);
  let r = await p.evaluate(() => { const i = App.db.invoices[0], pay = App.db.payments[0]; return { paid: App.invPaid(i), pay: [pay.amount, pay.currency, pay.mode, pay.ref, pay.rate] }; });
  ok('overpayment: 450 recorded (not 500), M-Pesa, reference kept', r.paid === 450 && JSON.stringify(r.pay) === JSON.stringify([450, 'USD', 'M-Pesa', 'MP999', 2800]), JSON.stringify(r));
  ok('invoice page shows Total / Reçu / Reste', /Reçu du client\s*450 \$/.test((await p.innerText('#view')).replace(/\n/g, ' ').replace(/ | /g, ' ')));
  ok('receipt flagged « à envoyer » right after creating the invoice', await p.evaluate(() => App.rcptTodo().length === 1));
  // ---- partial, paid in CDF (invoice in USD)
  await p.evaluate(() => { App.db.invoices = []; App.db.payments = []; App.save(); }); await open();
  await p.selectOption('#f_pcur', 'CDF'); ok('paying in CDF: prefilled with 1 260 000 (= 450 × 2 800)', (await p.inputValue('#f_paid')) === '1260000', await p.inputValue('#f_paid'));
  await p.fill('#f_paid', '700000'); ok('700 000 CDF = 250 $ → reste 200 $', /Reste à payer : 200 \$/.test(await sum()), await sum()); await p.click('#dok'); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const i = App.db.invoices[0], pay = App.db.payments[0]; return { paid: App.invPaid(i), due: App.invDue(i), pay: [pay.amount, pay.currency, pay.rate] }; });
  ok('stored as 700000 CDF at 2800: invoice paid 250 $, due 200 $', Math.abs(r.paid - 250) < 0.01 && Math.abs(r.due - 200) < 0.01 && JSON.stringify(r.pay) === JSON.stringify([700000, 'CDF', 2800]), JSON.stringify(r));
  const doc = await p.evaluate(() => App.invoiceDoc(App.db.invoices[0]).replace(/ | /g, ' ')); ok('printed invoice shows only the full total', /Total TTC :/.test(doc) && !/Reste à payer/.test(doc));
  // ---- invoice in CDF
  await p.evaluate(() => { App.db.invoices = []; App.db.payments = []; App.save(); App.invoiceForm('materiel'); }); await p.selectOption('#f_cl', 'c1'); await p.selectOption('#f_cur', 'CDF'); ok('paying currency follows the invoice currency', (await p.inputValue('#f_pcur')) === 'CDF');
  await p.fill('#f_desc', 'Câble'); await p.fill('#f_price', '56000'); await p.click('#f_add'); ok('CDF invoice: given prefilled 56 000', (await p.inputValue('#f_paid')) === '56000'); await p.fill('#f_paid', '20000'); await p.click('#dok'); await p.waitForTimeout(200);
  ok('CDF partial recorded: 20 000 CDF, reste 36 000', await p.evaluate(() => App.db.payments[0].amount === 20000 && Math.abs(App.invDue(App.db.invoices[0]) - 36000) < 0.01));
  // ---- nothing given
  await p.evaluate(() => { const u = document.getElementById('undo'); if (u) u.remove(); });
  await p.evaluate(() => { App.db.invoices = []; App.db.payments = []; App.save(); }); await open(); await p.click('#p_none'); await p.click('#dok'); await p.waitForTimeout(200);
  ok('nothing given: invoice unpaid, no payment', await p.evaluate(() => App.db.payments.length === 0 && App.invStatus(App.db.invoices[0]) === 'unpaid')); ok('no receipt to send when nothing was paid', await p.evaluate(() => App.rcptTodo().length === 0));
  await p.screenshot({ path: 'pay.png', fullPage: true });
  console.log('errors', errs); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); await b.close();
})();
