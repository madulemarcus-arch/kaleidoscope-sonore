const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  ok('default plan Résidentiel 70/64', await p.evaluate(() => { const x = App.db.settings.plans['Résidentiel']; return x.price === 70 && x.cost === 64; }));
  await p.evaluate(() => { const t = App.today(); App.db.clients.push({ id: 'c1', code: 'CL-1', type: 'gere', first: 'Awa', last: 'D', name: 'Awa D', phone: '081', plan: 'Résidentiel', price: 70, start: t, period: 30, grace: 15, subs: [], created: t }); App.save(); });
  // client fiche shows margin
  await p.evaluate(() => App.go('client', { id: 'c1', tab: 'abo' })); const fi = (await p.innerText('#view')).replace(/\n/g, ' '); ok('fiche: cost 64, margin 6', /Coût Starlink 64 \$/.test(fi) && /Marge 6 \$/.test(fi), fi.slice(0, 260));
  // invoice created -> line cost 64
  const r = await p.evaluate(() => { const inv = App.createInvoice({ type: 'abonnement', clientId: 'c1', currency: 'USD', payMode: 'Cash', lines: [{ pid: '', desc: 'Abonnement Résidentiel (x → y)', qty: 1, price: 70, cost: 0, unit: '' }] }, 70); return [inv.lines[0].cost, App.invCost(inv)]; });
  ok('subscription line carries cost 64', r[0] === 64 && r[1] === 64, r);
  // CDF invoice converts the cost
  const rc = await p.evaluate(() => { const inv = App.createInvoice({ type: 'abonnement', clientId: 'c1', currency: 'CDF', payMode: 'Cash', lines: [{ pid: '', desc: 'Abonnement Résidentiel', qty: 1, price: 168000, cost: 0, unit: '' }] }, 0); return [inv.lines[0].cost, App.usd(App.invCost(inv), 'CDF')]; });
  ok('CDF cost converted (64 $)', Math.abs(rc[1] - 64) < 0.01, rc);
  // margin in finance (dashboard 'Marge brute' via invCost): ca 140 - cost 128 = 12
  ok('margin = 6 + 6', await p.evaluate(() => { const inv = App.db.invoices; const ca = inv.reduce((a, i) => a + App.usd(App.invTotal(i), i.currency), 0), co = inv.reduce((a, i) => a + App.usd(App.invCost(i), i.currency), 0); return Math.abs(ca - co - 12) < 0.01; }));
  // old invoice w/o cost fixed by button
  await p.evaluate(() => { App.db.invoices.push({ id: 'old', number: 'OLD-1', type: 'abonnement', clientId: 'c1', date: App.today(), currency: 'USD', lines: [{ pid: '', desc: 'Abonnement Résidentiel Lite', qty: 1, price: 50, cost: 0 }, { pid: '', desc: 'Abonnement Résidentiel', qty: 2, price: 70 }], created: App.today() }); App.save(); });
  // settings card
  await p.click('[data-nav=more]'); await p.click('#view [data-v=settings]'); const closed = await p.evaluate(() => [...document.querySelectorAll('details.fold')].map(d => d.open)); ok('WhatsApp + tarifs sections closed by default', closed.length >= 2 && closed.every(x => !x), closed); await p.click('details[data-fold=plans] summary'); await p.waitForTimeout(100); const st = (await p.innerText('#view')).replace(/\n/g, ' '); ok('settings card lists plans', /Tarifs d'abonnement/.test(st) && /Résidentiel Lite/.test(st) && /Marge : 6 \$/.test(st));
  const i = await p.evaluate(() => App.PLANS.indexOf('Résidentiel Lite'));
  await p.fill('#pl_p' + i, '50'); await p.fill('#pl_c' + i, '45'); await p.dispatchEvent('#pl_c' + i, 'change');
  ok('Lite saved 50/45', await p.evaluate(() => { const x = App.db.settings.plans['Résidentiel Lite']; return x.price === 50 && x.cost === 45; }));
  await p.click('[data-act=plansfix]');
  ok('old lines costed (Lite 45, Résidentiel 64, longest-name match)', await p.evaluate(() => { const l = App.db.invoices.find(i => i.id === 'old').lines; return l[0].cost === 45 && l[1].cost === 64; }), await p.evaluate(() => JSON.stringify(App.db.invoices.find(i => i.id === 'old').lines.map(l => l.cost))));
  // choosing a plan fills price in client form
  await p.evaluate(() => App.clientForm(null, 'gere')); const hasForm = await p.$('#f_plan'); 
  if (hasForm) { await p.fill('#f_price', ''); await p.fill('#f_plan', 'Résidentiel Lite'); await p.dispatchEvent('#f_plan', 'change'); ok('plan fills empty price', (await p.inputValue('#f_price')) === '50'); await p.keyboard.press('Escape'); } else ok('client form opened', false);
  // report abos has margin
  await p.evaluate(() => App.go('reports')); await p.screenshot({ path: 'plan.png' });
  console.log('errors', errs); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); await b.close();
})();
