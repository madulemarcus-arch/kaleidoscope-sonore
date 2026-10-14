const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => { const t = App.today(); App.db.clients.push({ id: 'c1', code: 'CL-1', type: 'gere', first: 'Awa', last: 'D', name: 'Awa D', phone: '081', plan: 'Résidentiel', price: 70, start: App.addDays(t, -10), period: 30, grace: 15, subs: [], created: t });
    App.db.products.push({ id: 'p1', name: 'Kit', cat: 'Kits Starlink', unit: 'pièce', qty: 5, cost: 300, price: 450, min: 1 });
    // sale of 2 kits (stock 5 -> 3) with a payment
    const i = App.createInvoice({ type: 'materiel', clientId: 'c1', currency: 'USD', payMode: 'Cash', lines: [{ pid: 'p1', desc: 'Kit', qty: 2, price: 450, cost: 300 }] }, 100); window.__i1 = i.id;
    App.createInvoice({ type: 'materiel', clientId: 'c1', currency: 'USD', payMode: 'Cash', lines: [{ pid: '', desc: 'Erreur', qty: 1, price: 10, cost: 0 }] }, 0);
    App.createInvoice({ type: 'materiel', clientId: 'c1', currency: 'USD', payMode: 'Cash', lines: [{ pid: '', desc: 'Erreur 2', qty: 1, price: 20, cost: 0 }] }, 0); App.save(); });
  ok('stock after sale = 3', await p.evaluate(() => App.prod('p1').qty === 3));
  // ---- single delete from the invoice page
  await p.evaluate(() => App.go('invoice', { id: window.__i1 })); await p.click('[data-act=delinv]');
  ok('single delete: invoice gone, stock back to 5, payment gone', await p.evaluate(() => !App.invoice(window.__i1) && App.prod('p1').qty === 5 && App.db.payments.length === 0));
  ok('undo bar shown', !!(await p.$('#undo')) && /supprimée/.test(await p.innerText('#undo')));
  await p.click('#undogo'); ok('undo restores invoice, stock 3, payment', await p.evaluate(() => !!App.invoice(window.__i1) && App.prod('p1').qty === 3 && App.db.payments.length === 1 && App.db.invoices.length === 3));
  ok('undo bar gone', !(await p.$('#undo')));
  // ---- multi-select from the list
  await p.evaluate(() => App.go('invoices')); ok('select button visible', !!(await p.$('[data-act=inv_sel]')));
  await p.click('[data-act=inv_sel]'); const rows = await p.$$('#ilist [data-act=inv_pick]'); ok('rows are pickable in selection mode', rows.length === 3);
  await p.click('#ilist [data-act=inv_pick] >> nth=1'); await p.click('#ilist [data-act=inv_pick] >> nth=2');
  ok('2 picked, button shows (2)', /Supprimer \(2\)/.test(await p.innerText('#ibar')));
  await p.click('[data-act=inv_all]'); ok('"Tout" picks all 3', /Supprimer \(3\)/.test(await p.innerText('#ibar'))); await p.click('[data-act=inv_all]'); ok('"Tout" again clears', /Supprimer \(0\)/.test(await p.innerText('#ibar')));
  await p.click('#ilist [data-act=inv_pick] >> nth=0'); await p.click('#ilist [data-act=inv_pick] >> nth=1'); await p.click('[data-act=delinvs]');
  ok('2 invoices deleted, 1 left', await p.evaluate(() => App.db.invoices.length === 1)); ok('undo bar says 2 factures', /2 factures supprimées/.test(await p.innerText('#undo')));
  await p.click('#undogo'); ok('bulk undo restores all 3', await p.evaluate(() => App.db.invoices.length === 3));
  // ---- renewal is undone with the invoice
  const ren = await p.evaluate(() => { const c = App.client('c1'), before = { start: c.start, period: c.period, price: c.price, subs: c.subs.length };
    const t = App.today(), prev = { start: c.start, period: c.period, price: c.price }; c.subs.push({ start: c.start, days: 30, price: 70, date: t }); Object.assign(c, { start: t, period: 30, price: 70 });
    const inv = App.createInvoice({ type: 'abonnement', clientId: 'c1', currency: 'USD', payMode: 'Cash', lines: [{ pid: '', desc: 'Abonnement Résidentiel', qty: 1, price: 70, cost: 64 }] }, 70); inv.renew = { prev, ns: t, date: t }; App.save(); window.__r = inv.id; return before; });
  await p.evaluate(() => App.removeInvoices([window.__r]));
  const after = await p.evaluate(() => { const c = App.client('c1'); return { start: c.start, period: c.period, price: c.price, subs: c.subs.length }; });
  ok('renewal undone: previous period given back', JSON.stringify(after) === JSON.stringify(ren), JSON.stringify([ren, after]));
  await p.click('#undogo'); ok('undo of that deletion re-applies the renewal', await p.evaluate(() => App.client('c1').start === App.today() && !!App.invoice(window.__r)));
  // ---- the invoice number is reused when the last one is deleted
  const nums = await p.evaluate(() => { const last = App.db.invoices[App.db.invoices.length - 1]; const n = last.number; App.removeInvoices([last.id]); const nn = App.createInvoice({ type: 'materiel', clientId: 'c1', currency: 'USD', payMode: 'Cash', lines: [{ pid: '', desc: 'N', qty: 1, price: 1, cost: 0 }] }, 0).number; return [n, nn]; });
  ok('numbers are never reused (no duplicate numbers, even across devices)', nums[0] !== nums[1], nums);
  // ---- roles: only admin sees the selection button
  await p.evaluate(() => { const L = { id: 'u1', name: 'V', role: 'vendeur', active: true, pin: { salt: 's', hash: 'h' } }, A = { id: 'u0', name: 'A', role: 'admin', active: true, pin: { salt: 's', hash: 'h' } }; App.db.settings.users = [A, L]; App.user = L; App.applyRole(); App.go('invoices'); });
  ok('vendeur: no selection button, delinv/delinvs refused', !(await p.$('[data-act=inv_sel]')) && await p.evaluate(() => !App.guard('delinv') && !App.guard('delinvs')));
  await p.evaluate(() => { App.user = App.users()[0]; App.applyRole(); App.go('invoices'); }); ok('admin: selection button visible', !!(await p.$('[data-act=inv_sel]')));
  await p.screenshot({ path: 'del.png', fullPage: true });
  console.log('errors', errs); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); await b.close();
})();
