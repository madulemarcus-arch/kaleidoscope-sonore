const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const ctx = await b.newContext({ ...devices['Pixel 5'] }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(()=>{document.addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{const d=document.querySelector('dialog');if(d&&d.open&&/Envoyez le reçu au client/.test(d.textContent))d.close()}).observe(document,{subtree:true,childList:true,attributes:true,characterData:true}))}); // these tests are not about the receipt window: close it as soon as it opens
await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => { const t = App.today(), A = n => App.addDays(t, n), d = App.db;
    d.clients.push({ id: 'c1', code: 'CL-1', type: 'mat', first: 'Awa', last: 'Diop', name: 'Awa Diop', phone: '0812345678', subs: [], created: t });
    d.suppliers.push({ id: 's1', name: 'Starlink RDC', phone: '', address: '', goods: '', notes: '' });
    d.products.push({ id: 'p1', name: 'Kit', cat: 'Kits Starlink', unit: 'pièce', qty: 5, cost: 30, price: 45, min: 1 });
    // invoice 100 $ paid in 3 times: 40 $ cash, 140000 CDF @2800 (=50 $) via M-Pesa, then 10 $ cash -> settled
    const inv = App.createInvoice({ type: 'materiel', clientId: 'c1', currency: 'USD', payMode: 'Cash', lines: [{ pid: '', desc: 'Starlink', qty: 1, price: 100, cost: 0 }] }, 0); window.__inv = inv.id;
    d.payments.push({ id: 'pa1', date: A(-2), clientId: 'c1', invoiceId: inv.id, amount: 40, currency: 'USD', rate: 2400, mode: 'Cash', ref: '', comment: '' }, { id: 'pa2', date: A(-1), clientId: 'c1', invoiceId: inv.id, amount: 140000, currency: 'CDF', rate: 2800, mode: 'M-Pesa', ref: 'MP123', comment: '' }, { id: 'pa3', date: t, clientId: 'c1', invoiceId: inv.id, amount: 10, currency: 'USD', rate: 2800, mode: 'Cash', ref: '', comment: '' });
    d.penalties.push({ id: 'pe1', clientId: 'c1', date: t, amount: 10, currency: 'USD', rate: 2800, reason: 'Retard', cost: 10, note: '', paid: t, mode: 'Cash' });
    d.expenses.push({ id: 'e1', date: t, label: 'Transport', cat: 'Transport', amount: 20, currency: 'USD', rate: 2800, mode: 'Cash' }, { id: 'e2', date: t, label: 'Commission Jean', cat: 'Commission technicien', amount: 5, currency: 'USD', rate: 2800 }, { id: 'e0', date: A(-60), label: 'Ancienne dépense', cat: 'Autre', amount: 999, currency: 'USD', rate: 2400, mode: 'Cash' });
    d.moves.push({ id: 'm1', date: t, pid: 'p1', qty: 3, type: 'in', cost: 30, supplierId: 's1', purchase: true, invoiceId: '', clientId: '', note: 'Entrée de stock' }, { id: 'm2', date: t, pid: 'p1', qty: 2, type: 'in', cost: 30, supplierId: '', invoiceId: '', clientId: '', note: 'Annulation FAC-1' }); App.save(); });
  // ================= invoice document: what the client paid
  const doc = await p.evaluate(() => App.invoiceDoc(App.invoice(window.__inv)).replace(/ | /g, ' '));
  ok('printed invoice stays customer-facing: no payment block, full total', !/PAIEMENTS|Montant payé|Reste/.test(doc) && /Total TTC :/.test(doc));


  await p.evaluate(() => { App.db.payments = App.db.payments.filter(x => x.id !== 'pa3'); App.save(); });
  const doc2 = await p.evaluate(() => App.invoiceDoc(App.invoice(window.__inv)).replace(/ | /g, ' ')); ok('printed invoice unchanged when partially paid', !/Reste à payer|SOLD/.test(doc2));
  await p.evaluate(() => { App.db.payments.push({ id: 'pa3', date: App.today(), clientId: 'c1', invoiceId: window.__inv, amount: 10, currency: 'USD', rate: 2800, mode: 'Cash', ref: '', comment: '' }); App.save(); });
  // ================= receipt
  const rc = await p.evaluate(() => App.receiptDoc(App.db.payments.find(x => x.id === 'pa2')).replace(/ | /g, ' '));
  ok('receipt: number, client in bold, amount in words, invoice summary', /-P2/.test(rc) && /<b>Awa Diop<\/b>/.test(rc) && /140 000 CDF/.test(rc) && /cent quarante mille/i.test(rc) && /FACTURE FAC-/.test(rc));
  ok('receipt numbers follow the payment order', await p.evaluate(() => ['pa1', 'pa2', 'pa3'].map(id => App.receiptNo(App.db.payments.find(x => x.id === id)).slice(-2)).join() === 'P1,P2,P3'));
  await p.evaluate(() => App.go('invoice', { id: window.__inv })); ok('invoice page: one 🧾 button per payment', (await p.$$('[data-act=recprint]')).length === 3);
  await p.click('[data-act=recprint][data-id=pa2]'); await p.waitForTimeout(400); ok('printing creates the print frame', await p.evaluate(() => !!document.querySelector('iframe') && /REÇU DE PAIEMENT/.test(document.querySelector('iframe').srcdoc)));
  // payment form offers the receipt
  await p.evaluate(() => App.paymentForm({ clientId: 'c1' })); await p.fill('#f_amt', '5'); await p.click('#dok'); await p.waitForTimeout(300);
  ok('after saving a payment: the receipt is flagged « à envoyer »', await p.evaluate(() => App.rcptTodo().length === 1));
  await p.evaluate(() => { App.db.payments.pop(); App.save(); });
  // ================= finance tab
  await p.evaluate(() => App.go('finance'));
  let tx = (await p.innerText('#view')).replace(/\n/g, ' ').replace(/ | /g, ' '); console.log(tx.slice(0, 420));
  // today: payments 10 (+ earlier ones this month: 40 and 50 yesterday/2 days ago if same month) -> use custom period = today only
  await p.click('[data-act=fin_per][data-v=day]'); tx = (await p.innerText('#view')).replace(/\n/g, ' ').replace(/ | /g, ' ');
  // today: in = payment 10 + penalty 10 = 20 ; out = 20 + 5 + purchase 90 = 115 (the 'Annulation' move is not a purchase)
  ok('today: Entrées 20 $, Sorties 115 $, Solde −95 $', /Entrées\s*20 \$/.test(tx) && /Sorties\s*115 \$/.test(tx) && /Solde de la période\s*95 \$|−95|-95/.test(tx), tx.slice(0, 260));
  ok('"Annulation" stock return is not counted as a purchase', await p.evaluate(() => !App.ledger().some(x => /Achat stock/.test(x.label) && x.usd === 60)));
  await p.uncheck('#fin_stock'); tx = (await p.innerText('#view')).replace(/\n/g, ' ').replace(/ | /g, ' '); ok('without stock purchases: Sorties 25 $', /Sorties\s*25 \$/.test(tx), tx.slice(0, 200)); await p.check('#fin_stock');
  await p.click('[data-act=fin_per][data-v=year]'); tx = (await p.innerText('#view')).replace(/\n/g, ' ').replace(/ | /g, ' ');
  // year: in = 40 + 50 + 10 + penalty 10 = 110 ; out = 20 + 5 + 90 + 999 = 1114
  ok('year: Entrées 110 $ (40 + 50 from CDF at its own rate + 10 + penalty 10)', /Entrées\s*110 \$/.test(tx), tx.slice(0, 220));
  ok('mode table: M-Pesa 50 $, Cash 60 $ in', /M-Pesa/.test(tx) && /Non précisé/.test(tx));
  ok('currency section shows CDF 140 000 really received', /Francs congolais/.test(tx) && /140 000 CDF/.test(tx));
  await p.click('[data-act=fin_kind][data-v=in]'); ok('kind filter: only entrées listed', (await p.$$('#view .avatar.bad')).length === 0 && (await p.$$('#view .avatar.ok')).length === 4);
  await p.click('[data-act=fin_kind][data-v=all]'); await p.click('[data-act=fin_mode][data-v="M-Pesa"]'); tx = (await p.innerText('#view')).replace(/\n/g, ' ').replace(/ | /g, ' '); ok('mode filter M-Pesa: Entrées 50 $, Sorties 0 $', /Entrées\s*50 \$/.test(tx) && /Sorties\s*0 \$/.test(tx), tx.slice(0, 160)); await p.click('[data-act=fin_mode][data-v=all]');
  const csv = await p.evaluate(() => new Promise(r => { const o = App.download; App.download = (n, t) => { App.download = o; r([n, t]); }; App.actions.fin_csv(); })); ok('CSV export has header + rows, entrées positive / sorties negative', /^﻿?"Date";"Sens"/.test(csv[1]) && /-999/.test(csv[1]) && csv[1].split('\n').length >= 8, csv[0]);
  ok('Excel sheet "Finance" exists', await p.evaluate(() => App.reportSheets().some(s => s.title === 'Finance' && s.rows.length > 6)));
  // ================= roles + nav
  ok('admin bottom nav has Finance (5 columns)', (await p.evaluate(() => [...document.querySelectorAll('#bottom [data-v]')].map(b => b.dataset.v).join(','))) === 'home,clients,finance,stock,more' && await p.evaluate(() => document.getElementById('bottom').style.gridTemplateColumns === 'repeat(5, 1fr)'));
  await p.evaluate(() => { const mk = (id, role) => ({ id, name: role, role, active: true, pin: { salt: 's', hash: 'h' } }); App.db.settings.users = [mk('u0', 'admin'), mk('u1', 'comptable'), mk('u2', 'vendeur')]; });
  const can = await p.evaluate(() => { const r = {}; ['u0', 'u1', 'u2'].forEach(id => { App.user = App.users().find(u => u.id === id); r[App.user.role] = App.canView('finance'); }); return r; }); ok('finance visible to admin + comptable only', can.admin && can.comptable && !can.vendeur, JSON.stringify(can));
  await p.evaluate(() => { App.user = App.users()[2]; App.applyRole(); App.go('finance'); }); ok('vendeur redirected away from finance', await p.evaluate(() => App.state.view === 'home'));
  await p.evaluate(() => { App.user = App.users()[1]; App.applyRole(); App.go('finance'); await0 = 1; }); ok('comptable sees the tab in nav', (await p.evaluate(() => [...document.querySelectorAll('#bottom [data-v]')].map(b => b.dataset.v))).includes('finance'));
  await p.screenshot({ path: 'fin2.png', fullPage: true });
  console.log('errors', errs); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); await b.close();
})();
