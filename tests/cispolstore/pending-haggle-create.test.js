// Pending invoice at creation: « Le client a marchandé » records the agreed price straight away
const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => new MutationObserver(() => { const d = document.querySelector('dialog'); if (d && d.open && /Envoyez le reçu au client/.test(d.textContent)) d.close(); }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true })); });
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => { const t = App.today(); App.db.clients.push({ id: 'c1', code: 'CL-1', type: 'mat', first: 'A', last: 'D', name: 'A D', phone: '1', subs: [], created: t }); App.save(); App.invoiceForm('materiel'); });
  await p.selectOption('#f_cl', 'c1'); await p.fill('#f_desc', 'Kit'); await p.fill('#f_price', '100'); await p.click('#f_add');
  ok('not pending: « Le client a marchandé » is already offered in the payment card', await p.isVisible('#f_neg'));
  ok('price field hidden until ticked', !(await p.isVisible('#f_hagp')));
  await p.check('#f_neg'); await p.fill('#f_hagp', '90'); await p.waitForTimeout(150);
  ok('not pending: the amount given follows the agreed price, with the discount shown', (await p.inputValue('#f_paid')) === '90' && /Remise accordée : .*10/.test(await p.innerText('#p_hagm')));
  await p.fill('#f_hagp', ''); await p.check('#f_pend'); await p.waitForTimeout(200);
  ok('pending: the option stays offered', await p.isVisible('#f_neg') && await p.isChecked('#f_neg'));
  ok('price field shown once ticked', await p.isVisible('#f_hagp'));
  await p.fill('#f_hagp', '120'); await p.click('#dok'); await p.waitForTimeout(250);
  ok('a price above the total is refused (form stays open)', await p.evaluate(() => App.db.invoices.length === 0 && !!document.getElementById('f_hagp')));
  await p.fill('#f_hagp', '70'); await p.fill('#f_paid', '80'); await p.click('#dok'); await p.waitForTimeout(250);
  ok('a deposit above the agreed price is refused', await p.evaluate(() => App.db.invoices.length === 0));
  await p.fill('#f_paid', '30'); await p.click('#dok'); await p.waitForTimeout(500);
  const r = await p.evaluate(() => { const i = App.db.invoices[0]; return { pend: i.pending, agreed: i.agreed, total: App.invTotal(i), paid: App.invPaid(i), pend2: App.invAgreed(i) - App.invPaid(i) }; });
  ok('created pending, agreed 70 $, printed total stays 100 $, deposit 30 $', r.pend === true && r.agreed === 70 && r.total === 100 && r.paid === 30 && r.pend2 === 40, JSON.stringify(r));
  ok('the invoice page shows the agreed price', /Prix convenu : .*70/.test(await p.innerText('#view')));
  await p.click('[data-act=invhag]'); await p.waitForTimeout(300);
  ok('« Le client a marchandé » later is prefilled with the agreed price', (await p.inputValue('#hg_amt')) === '70');
  console.log('errors', errs); ok('no page error', errs.length === 0); await b.close(); process.exit(f ? 1 : 0);
})();
