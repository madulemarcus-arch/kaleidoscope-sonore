// Client sheet, "Factures" tab: summary (invoiced / paid / due), status filter, and for a payer the invoices of his beneficiaries.
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8774';
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }), p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => {
    const t = App.today(), A = App.addDays;
    const mk = (id, o) => App.db.clients.push({ id, code: id, first: id, last: 'X', name: id + ' X', phone: '09' + id.length, subs: [], created: A(t, -50), note: '', ...o });
    mk('P', { type: 'mat', payer: true }); mk('K', { type: 'mat', payerId: 'P' }); mk('Z', { type: 'mat' });
    const inv = (cid, date, price, pay) => App.createInvoice({ type: 'materiel', clientId: cid, currency: 'USD', payMode: 'Cash', date, lines: [{ pid: '', desc: 'Article', qty: 1, price, cost: 0 }], payAmount: pay }, 0);
    inv('P', A(t, -9), 100, 100); inv('P', A(t, -5), 80, 30); inv('P', A(t, -2), 20, 0); inv('K', A(t, -3), 50, 0); inv('Z', A(t, -1), 999, 999);
    App.save(); App.go('client', { id: 'P', tab: 'fac' });
  });
  await p.waitForTimeout(500);
  let t = await p.innerText('#view');
  ok('summary: 3 invoices', /3 facture\(s\)/.test(t), t.slice(0, 200).replace(/\n/g, ' | '));
  const inv = await p.evaluate(() => { const l = App.db.invoices.filter(i => i.clientId === 'P'); return { tot: l.reduce((a, i) => a + App.invAgreed(i), 0), due: l.reduce((a, i) => a + App.invDue(i), 0) }; });
  ok('totals worked out by hand: 200 invoiced, 50 + 20 = 70 due', inv.tot === 200 && Math.abs(inv.due - 70) < 0.01, JSON.stringify(inv));
  ok('summary shows Reste à payer 70', /Reste à payer\s*70/.test(await p.innerText('#view')));
  ok('3 rows for the client, none from Z', await p.locator('#view .item[data-act=go]').count() >= 4 && !/999/.test(t));
  ok("beneficiary invoice section shows K's invoice", /Factures des bénéficiaires \(1\)/.test(t) && /K X/.test(t));
  await p.click('[data-act=clfac][data-f=due]'); await p.waitForTimeout(400); t = await p.innerText('#view');
  ok('filter "À payer": 2 own invoices + 1 beneficiary', await p.locator('#view .item[data-act=go]').count() === 3 && /Factures des bénéficiaires \(1\)/.test(t));
  await p.click('[data-act=clfac][data-f=paid]'); await p.waitForTimeout(400); t = await p.innerText('#view');
  ok('filter "Payées": 1 own invoice, no beneficiary invoice', await p.locator('#view .item[data-act=go]').count() === 1 && /Factures des bénéficiaires \(0\)/.test(t));
  await p.evaluate(() => App.go('client', { id: 'Z', tab: 'fac' })); await p.waitForTimeout(400); t = await p.innerText('#view');
  ok('ordinary client: no beneficiary section', !/bénéficiaires/.test(t) && /1 facture\(s\)/.test(t));
  ok('no page errors', errs.length === 0, errs.join('|')); await b.close(); process.exit(f ? 1 : 0);
})();
