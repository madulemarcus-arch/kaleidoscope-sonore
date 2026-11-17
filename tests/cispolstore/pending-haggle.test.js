// Pending invoice: « Le client a marchandé » validates the sale at the amount the client really gave (no deposit-then-balance)
const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => new MutationObserver(() => { const d = document.querySelector('dialog'); if (d && d.open && /Envoyez le reçu au client/.test(d.textContent)) d.close(); }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true })); });
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => { const t = App.today(); App.db.products.push({ id: 'p1', name: 'Routeur', cat: 'Réseau', ref: 'R', unit: '', cost: 20, price: 100, qty: 5, min: 1, track: true });
    App.db.clients.push({ id: 'c1', code: 'CL-1', type: 'mat', first: 'A', last: 'D', name: 'A D', phone: '1', subs: [], created: t });
    App.createInvoice({ type: 'materiel', clientId: 'c1', currency: 'USD', payMode: 'Cash', date: t, pending: true, lines: [{ pid: 'p1', desc: 'Routeur', qty: 1, price: 100, cost: 20 }] }, 0);
    App.createInvoice({ type: 'materiel', clientId: 'c1', currency: 'USD', payMode: 'Cash', date: t, pending: true, lines: [{ pid: 'p1', desc: 'Routeur', qty: 1, price: 100, cost: 20 }], payAmount: 30 }, 30); App.save(); });
  const ids = await p.evaluate(() => App.db.invoices.map(i => i.id));
  // 1) bargained: the client gives 80 for a 100 invoice
  await p.evaluate(id => App.go('invoice', { id }), ids[0]); await p.waitForTimeout(400);
  ok('pending card offers « Le client a marchandé »', /Le client a marchandé/.test(await p.innerText('#view')) && !!(await p.$('[data-act=invhag]')));
  await p.click('[data-act=invhag]'); await p.waitForTimeout(300);
  ok('the form shows the total and asks for the amount paid', /Total de la facture/.test(await p.innerText('dialog')) && !!(await p.$('#hg_amt')));
  await p.fill('#hg_amt', '80'); await p.waitForTimeout(150);
  ok('live line: 20 $ discount (20 %), 80 $ to collect now', /Remise accordée : .*20.*20 %.*à encaisser maintenant : .*80/.test(await p.innerText('#hg_msg')), await p.innerText('#hg_msg'));
  await p.fill('#hg_amt', '150'); await p.click('#dok'); await p.waitForTimeout(250);
  ok('more than the total is refused (form stays open)', await p.evaluate(() => App.db.invoices[0].pending === true && !!document.getElementById('hg_amt')));
  await p.fill('#hg_amt', '80'); await p.click('#dok'); await p.waitForTimeout(500);
  let r = await p.evaluate(() => { const i = App.db.invoices[0]; return { pend: i.pending, st: App.invStatus(i), agreed: i.agreed, paid: App.invPaid(i), due: App.invDue(i), pays: App.db.payments.filter(x => x.invoiceId === i.id).length, qty: App.prod('p1').qty }; });
  ok('sale validated, paid 80 $, agreed price 80 $, nothing left to pay', r.pend === undefined && r.st === 'paid' && r.agreed === 80 && r.paid === 80 && r.due === 0 && r.pays === 1, JSON.stringify(r));
  ok('stock was deducted when the sale was validated (5 → 4)', r.qty === 4);
  ok('the printed invoice keeps its full total, revenue counts 80', await p.evaluate(() => App.invTotal(App.db.invoices[0]) === 100 && App.invAgreed(App.db.invoices[0]) === 80));
  // 2) with a deposit already received: 30 deposit, the client gives 90 in total → 60 now
  await p.evaluate(id => App.go('invoice', { id }), ids[1]); await p.waitForTimeout(400);
  await p.click('[data-act=invhag]'); await p.waitForTimeout(300);
  ok('the form mentions the deposit already received', /acompte déjà reçu/.test(await p.innerText('dialog')));
  await p.fill('#hg_amt', '20'); await p.click('#dok'); await p.waitForTimeout(250);
  ok('an amount below the deposit is refused', await p.evaluate(() => App.db.invoices[1].pending === true));
  await p.fill('#hg_amt', '90'); await p.click('#dok'); await p.waitForTimeout(500);
  r = await p.evaluate(() => { const i = App.db.invoices[1]; return { st: App.invStatus(i), agreed: i.agreed, paid: App.invPaid(i), pays: App.db.payments.filter(x => x.invoiceId === i.id).length, last: App.db.payments.filter(x => x.invoiceId === i.id).pop().amount }; });
  ok('deposit 30 + 60 now = 90 paid, agreed price 90, settled', r.st === 'paid' && r.agreed === 90 && r.paid === 90 && r.pays === 2 && r.last === 60, JSON.stringify(r));
  // 3) paying the full total is not a discount
  await p.evaluate(() => { App.createInvoice({ type: 'materiel', clientId: 'c1', currency: 'USD', payMode: 'Cash', date: App.today(), pending: true, lines: [{ pid: 'p1', desc: 'Routeur', qty: 1, price: 100, cost: 20 }] }, 0); App.save(); });
  const id3 = await p.evaluate(() => App.db.invoices[2].id); await p.evaluate(id => App.go('invoice', { id }), id3); await p.waitForTimeout(400);
  await p.click('[data-act=invhag]'); await p.waitForTimeout(300); await p.fill('#hg_amt', '100'); await p.click('#dok'); await p.waitForTimeout(500);
  ok('the full price → settled with no negotiated price recorded', await p.evaluate(() => { const i = App.db.invoices[2]; return App.invStatus(i) === 'paid' && i.agreed === undefined; }));
  ok('a validated invoice no longer shows the pending card', await p.evaluate(() => !document.querySelector('#view [data-act=invhag]')));
  console.log('errors', errs); ok('no page error', errs.length === 0); await b.close(); process.exit(f ? 1 : 0);
})();
