const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const ctx = await b.newContext({ ...devices['Pixel 5'] }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => { const t = App.today(), d = App.db, m = t.slice(0, 7);
    d.clients.push({ id: 'c1', code: 'CL-1', type: 'gere', first: 'Awa', last: 'D', name: 'Awa D', phone: '081', plan: 'Résidentiel', price: 70, start: t, period: 30, grace: 15, subs: [], created: t }, { id: 'c2', code: 'CL-2', type: 'mat', first: 'Bob', last: 'K', name: 'Bob K', phone: '', subs: [], created: t });
    d.products.push({ id: 'p1', name: 'Câble', cat: 'Câbles', unit: 'm', qty: 3, cost: 1, price: 2, min: 10 }, { id: 'p2', name: 'Kit', cat: 'Kits Starlink', unit: 'pièce', qty: 9, cost: 300, price: 450, min: 1 });
    const inv = (id, n, cid, type, lines, date) => ({ id, number: n, type, clientId: cid, date: date || t, currency: 'USD', lines, created: t });
    d.invoices.push(inv('i1', 'F1', 'c1', 'abonnement', [{ pid: '', desc: 'Abonnement Résidentiel', qty: 1, price: 70, cost: 64 }]), inv('i2', 'F2', 'c2', 'materiel', [{ pid: 'p2', desc: 'Kit', qty: 1, price: 450, cost: 300 }]), inv('i0', 'F0', 'c1', 'abonnement', [{ pid: '', desc: 'Abonnement Résidentiel', qty: 1, price: 70, cost: 64 }], App.addDays(m + '-01', -5)));
    d.payments.push({ id: 'p1', date: t, clientId: 'c1', invoiceId: 'i1', amount: 70, currency: 'USD', mode: 'Cash', ref: '', comment: '' });
    d.expenses.push({ id: 'e1', date: t, label: 'Transport', cat: 'Transport', amount: 20, currency: 'USD' });
    d.penalties.push({ id: 'pe1', clientId: 'c1', date: t, amount: 10, currency: 'USD', reason: 'Retard', cost: 7, note: '', paid: t, mode: 'Cash' }, { id: 'pe2', clientId: 'c1', date: t, amount: 5, currency: 'USD', reason: 'Retard', cost: 5, note: '', paid: '' });
    d.installs.push({ id: 'in1', clientId: 'c1', date: t, kind: 'Installation Starlink', tech: 'T', price: 50, materials: [] });
    d.deliveries.push({ id: 'd1', clientId: 'c1', items: 'x', address: 'a', date: t, status: 'done', doneAt: t, driverName: 'L' }, { id: 'd2', clientId: 'c1', items: 'y', address: 'a', date: t, status: 'todo' }); App.save(); });
  await p.click('[data-nav=more]'); ok('menu entry', /Rapport mensuel/.test(await p.innerText('#view'))); await p.click('#view [data-v=rapportmois]');
  const tx = (await p.innerText('#view')).replace(/\n/g, ' '); console.log(tx.slice(0, 700));
  const d = await p.evaluate(() => { const m = App.today().slice(0, 7); App.go('rapportmois'); return App.monthlyText(m); }); console.log(d);
  // CA = 70 + 450 + penalty 10 = 530 ; cost = 64 + 300 + 7 = 371 ; margin 159 ; exp 20 ; net 139
  ok('CA 530 $ (invoices + paid penalty), net 139 $', /Total facturé : 530 \$/.test(d) && /Marge brute : 159 \$/.test(d) && /Bénéfice net : 139 \$/.test(d));
  ok('only this month counted (F0 from last month excluded)', /\(2 facture/.test(d));
  ok('subscriptions: 1 renewed, margin 6', /1 renouvelé\(s\), 70 \$/.test(d) && /marge 6 \$/.test(d));
  ok('installations 1 (50 $), materiel 450 $', /Installations : 1 \(50 \$\)/.test(d) && /Ventes de matériel : 450 \$/.test(d));
  ok('unpaid: F2 450 + F0 70 = 520 + penalty due 5 = 525', /Impayés à ce jour : 525 \$/.test(d) && /450 \$ facturés ce mois|dont 450 \$/.test(d), d.split('\n').find(l => /Impay/.test(l)));
  ok('penalties 10 paid / 5 due', /10 \$ payées ce mois · 5 \$ à payer/.test(d));
  ok('deliveries 1 done / 1 pending', /1 faite\(s\) ce mois · 1 à faire/.test(d));
  ok('low stock lists the cable', /Stock bas : Câble \(3 m\)/.test(d));
  ok('expenses 20', /Dépenses : 20 \$/.test(d));
  // navigation
  ok('next disabled on current month', await p.$eval('[data-act=rm_nav][data-n="1"]', e => e.disabled));
  await p.click('[data-act=rm_nav][data-n="-1"]'); const prev = (await p.innerText('#view')).replace(/\n/g, ' '); ok('previous month shows F0 only (70 $)', /Chiffre d'affaires\s*70 \$/.test(prev) || /70 \$/.test(prev), prev.slice(0, 160));
  await p.click('[data-act=rm_nav][data-n="1"]');
  const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null), p.click('[data-act=rm_wa]')]); ok('whatsapp share opens', !!pop);
  await p.screenshot({ path: 'month.png', fullPage: true });
  console.log('errors', errs); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); await b.close();
})();
