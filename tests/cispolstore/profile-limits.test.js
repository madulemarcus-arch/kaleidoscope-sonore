// Profile limits: hidden client phone numbers (display, links, forms, WhatsApp) and a ceiling per invoice / payment approved with the manager's PIN.
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8774';
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }), p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(async () => {
    const mk = async (id, name, role, code, o) => { const salt = 's' + id; return { id, name, role, active: true, pin: { salt, hash: await App.hash(salt + code), len: 6 }, ...(o || {}) }; };
    App.db.settings.users = [await mk('a', 'Gérant', 'admin', '135790'), await mk('v', 'Vic', 'vendeur', '246810', { hidePhone: true, cap: 100 })];
    App.db.clients.push({ id: 'K', code: 'K', first: 'Awa', last: 'Kasa', name: 'Awa Kasa', phone: '+243 812 345 678', phone2: '0998877665', subs: [], type: 'mat', created: App.today(), note: '' });
    App.save(); App.me_login(App.db.settings.users[1]); App.go('client', { id: 'K' });
  });
  await p.waitForTimeout(700);
  let t = await p.innerText('#view'), h = await p.evaluate(() => document.getElementById('view').innerHTML);
  ok('the number is not on the client sheet', !/812 345 678|243812345678/.test(t) && /•••/.test(t), t.slice(0, 160).replace(/\n/g, ' | '));
  ok('no tel: link and no WhatsApp link with a number', !/href="tel:/.test(h) && !/wa\.me\/\d/.test(h));
  ok('the phone is not in the list of clients either', await p.evaluate(() => { App.go('clients'); return new Promise(r => setTimeout(() => r(!/812 345 678|0998877665/.test(document.getElementById('view').innerText)), 600)); }));
  ok('WhatsApp links are built without the number', await p.evaluate(() => !/243812345678/.test(App.waUrl('+243812345678', 'Bonjour'))));
  // edit form: field empty, saving keeps the number
  await p.evaluate(() => { App.go('client', { id: 'K' }); }); await p.waitForTimeout(500);
  await p.evaluate(() => App.actions.editclient({ id: 'K' })); await p.waitForTimeout(500);
  ok('edit form: phone field is empty with a "masqué" hint', await p.evaluate(() => document.getElementById('f_phone').value === '' && /masqué/.test(document.getElementById('f_phone').placeholder)));
  await p.fill('#f_note', 'note de test'); await p.click('#dok'); await p.waitForTimeout(400);
  ok('saving the form keeps both numbers', await p.evaluate(() => { const c = App.client('K'); return c.phone === '+243 812 345 678' && c.phone2 === '0998877665' && c.note === 'note de test'; }));
  // ceiling on payments
  const pays0 = await p.evaluate(() => App.db.payments.length);
  await p.evaluate(() => App.paymentForm({})); await p.waitForTimeout(400);
  await p.selectOption('#f_cl', 'K'); await p.fill('#f_amt', '50'); await p.click('#dok'); await p.waitForTimeout(400);
  ok('50 $ (under the 100 $ ceiling) is recorded without any question', await p.evaluate(n => App.db.payments.length === n + 1 && !document.getElementById('apdlg'), pays0));
  await p.evaluate(() => App.paymentForm({})); await p.waitForTimeout(400);
  await p.selectOption('#f_cl', 'K'); await p.fill('#f_amt', '150'); await p.click('#dok'); await p.waitForTimeout(500);
  ok('150 $ asks for the manager and records nothing yet', await p.evaluate(n => !!document.getElementById('apdlg') && document.getElementById('apdlg').open && App.db.payments.length === n + 1, pays0) && /Accord du gérant/.test(await p.innerText('#apdlg')));
  await p.fill('#ap_pin', '111111'); await p.click('#ap_ok'); await p.waitForTimeout(500);
  ok('a wrong PIN is refused and written in the journal', /incorrect/.test(await p.innerText('#apdlg')) && await p.evaluate(n => App.db.payments.length === n + 1 && App.db.audit.some(e => e.kind === 'sec' && /Code du gérant incorrect/.test(e.text)), pays0));
  ok("a seller's own PIN is not an approval", await (async () => { await p.fill('#ap_pin', '246810'); await p.click('#ap_ok'); await p.waitForTimeout(500); return p.evaluate(n => App.db.payments.length === n + 1, pays0); })());
  await p.evaluate(() => localStorage.removeItem('cispol.apfail'));
  await p.fill('#ap_pin', '135790'); await p.click('#ap_ok'); await p.waitForTimeout(700);
  ok("the manager's PIN approves: the payment is recorded and the approval is journalised", await p.evaluate(n => App.db.payments.length === n + 2 && App.db.payments.some(x => x.amount === 150) && App.db.audit.some(e => /a obtenu l'accord de Gérant pour un encaissement de 150/.test(e.text)), pays0));
  // ceiling on invoices
  const inv0 = await p.evaluate(() => App.db.invoices.length);
  await p.evaluate(() => App.invoiceForm('materiel')); await p.waitForTimeout(400);
  await p.selectOption('#f_cl', 'K'); await p.fill('#f_desc', 'Kit'); await p.fill('#f_price', '300'); await p.click('#f_add'); await p.click('#dok'); await p.waitForTimeout(500);
  ok('a 300 $ invoice asks for the manager and is not created yet', await p.evaluate(n => !!document.getElementById('apdlg') && document.getElementById('apdlg').open && App.db.invoices.length === n, inv0) && /[Uu]ne facture/.test(await p.innerText('#apdlg')));
  await p.evaluate(() => localStorage.removeItem('cispol.apfail')); await p.fill('#ap_pin', '135790'); await p.click('#ap_ok'); await p.waitForTimeout(800);
  ok("the manager's PIN creates the invoice", await p.evaluate(n => App.db.invoices.length === n + 1 && App.invTotal(App.db.invoices[n]) === 300, inv0));
  await p.evaluate(() => { const d = document.getElementById('dlg'); if (d.open) d.close(); });
  ok('the approval covers one operation only', await p.evaluate(() => { const a = App.capGate(120, 'un encaissement', () => {}); const d = document.getElementById('apdlg'); const o = d && d.open; if (d) d.close(); return a === false && o; }));
  ok('capGate: under the ceiling passes, no ceiling for the manager', await p.evaluate(() => { const r1 = App.capGate(99, 'x', () => {}); App.me_login(App.db.settings.users[0]); const r2 = App.capGate(5000, 'x', () => {}); App.me_login(App.db.settings.users[1]); return r1 === true && r2 === true; }));
  // the manager sees everything
  await p.evaluate(() => { App.me_login(App.db.settings.users[0]); App.go('client', { id: 'K' }); }); await p.waitForTimeout(700);
  t = await p.innerText('#view'); h = await p.evaluate(() => document.getElementById('view').innerHTML);
  ok('the manager still sees the number and the Appeler button', /812 345 678/.test(t) && /href="tel:/.test(h));
  // settings of a profile
  await p.evaluate(() => App.actions.users_edit({ id: 'v' })); await p.waitForTimeout(400);
  ok('profile form offers the two limits', await p.evaluate(() => document.getElementById('f_hp').value === '1' && document.getElementById('f_cap').value === '100'));
  await p.selectOption('#f_hp', '0'); await p.fill('#f_cap', '250'); await p.click('#dok'); await p.waitForTimeout(500);
  ok('saved: phones visible again, ceiling 250, change journalised', await p.evaluate(() => { const u = App.db.settings.users[1]; return !u.hidePhone && u.cap === 250 && App.db.audit.some(e => /a modifié le profil Vic.*plafond 250/.test(e.text)); }));
  ok('no page errors', errs.length === 0, errs.join('|')); await b.close(); process.exit(f ? 1 : 0);
})();
