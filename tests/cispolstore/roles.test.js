const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) fails++; };
const pin = async (p, code) => { for (const d of code) await p.click(`#lock [data-k="${d}"]`); await p.waitForTimeout(250); };
const nav = p => p.evaluate(() => [...document.querySelectorAll('#bottom [data-v]')].map(b => b.dataset.v).join(','));
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const ctx = await b.newContext({ ...devices['Pixel 5'] }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => { const t = App.today(); App.db.clients.push({ id: 'c1', code: 'CL-1', type: 'gere', first: 'Awa', last: 'D', name: 'Awa D', phone: '0812345678', address: 'Av. Kasa-Vubu 12', plan: 'Résidentiel', price: 70, start: t, period: 30, grace: 15, subs: [], created: t });
    App.db.products.push({ id: 'p1', name: 'Starlink Mini', cat: 'Kits Starlink', ref: '', unit: 'pièce', qty: 5, cost: 300, price: 450, min: 1 });
    App.db.invoices.push({ id: 'i1', number: 'FAC-1', type: 'materiel', clientId: 'c1', date: t, currency: 'USD', lines: [{ pid: 'p1', desc: 'Starlink Mini', qty: 1, price: 450, cost: 300 }], created: t }); App.save(); });
  ok('legacy mode = admin, no restrictions', await p.evaluate(() => !App.multi() && App.guard('delclient') && App.canView('settings')));
  // enable profiles
  await p.click('[data-nav=more]'); await p.click('#view [data-v=settings]'); await p.click('#view [data-v=users]'); await p.click('[data-act=users_on]'); await p.fill('#f_pin', '1111'); await p.click('#dok'); await p.waitForTimeout(500);
  ok('profiles on, admin created', await p.evaluate(() => App.multi() && App.users().length === 1 && App.user.role === 'admin'));
  const mk = async (name, role, code) => { await p.evaluate(() => App.go('users')); await p.click(`[data-act=users_new][data-role=${role}]`); ok('role preselected: ' + role, (await p.inputValue('#f_role')) === role); await p.fill('#f_name', name); await p.fill('#f_pin', code); await p.click('#dok'); await p.waitForTimeout(400); };
  await p.evaluate(() => App.go('users')); await p.screenshot({ path: 'users_after_on.png', fullPage: true }); const ut = (await p.innerText('#view')).replace(/\n/g, ' '); ok('after activation: all roles offered, 1 profile listed', /Comptable/.test(ut) && /Vendeur/.test(ut) && /Technicien/.test(ut) && /Livreur/.test(ut) && /Profils créés \(1\)/.test(ut), ut.slice(0, 200));
  await mk('Chantal', 'comptable', '2222'); await mk('Victor', 'vendeur', '3333'); await mk('Thomas', 'technicien', '4444'); await mk('Lionel', 'livreur', '5555'); await mk('Aimé', 'livreur', '6666');
  ok('5 profiles + admin = 6', await p.evaluate(() => App.users().length === 6));
  // duplicate PIN refused
  await p.click('[data-act=users_new][data-role=vendeur]'); await p.fill('#f_name', 'Dup'); await p.fill('#f_pin', '3333'); await p.click('#dok'); await p.waitForTimeout(300);
  ok('duplicate PIN refused', /déjà utilisé/.test(await p.innerText('#f_msg')) && await p.evaluate(() => App.users().length === 6)); await p.keyboard.press('Escape');
  ok('backup export has no users/pin', await p.evaluate(() => { const e = App.exportData(); return !e.settings.users && !e.settings.pin; }));
  // delivery created by admin for each driver
  await p.evaluate(() => { const L = App.users().filter(u => u.role === 'livreur'); App.db.deliveries.push({ id: 'd1', clientId: 'c1', invoiceId: 'i1', items: '1 × Starlink Mini', address: 'Av. Kasa-Vubu 12', phone: '0812345678', date: App.today(), driverId: L[0].id, driverName: L[0].name, status: 'todo', note: '', collect: false }, { id: 'd3', clientId: 'c1', invoiceId: 'i1', items: 'Routeur', address: 'Av. Lumumba 5', phone: '', date: App.today(), driverId: L[0].id, driverName: L[0].name, status: 'todo', note: '', collect: true }, { id: 'd2', clientId: 'c1', invoiceId: '', items: 'Câble', address: 'X', phone: '', date: App.today(), driverId: L[1].id, driverName: L[1].name, status: 'todo', note: '' }); App.save(); });
  const login = async code => { await p.evaluate(() => App.showLock('enter', 'unlock')); await pin(p, code); };
  // ---- vendeur
  await login('3333'); ok('vendeur nav', (await nav(p)) === 'home,clients,stock,more', await nav(p));
  ok('vendeur: no reports/settings/expenses views', await p.evaluate(() => !App.canView('reports') && !App.canView('settings') && !App.canView('expenses') && App.canView('invoices')));
  ok('vendeur: finances hidden on home', await p.evaluate(() => document.querySelector('.dash [style*="grid-area:b"]').hidden === true));
  await p.evaluate(() => App.go('stock')); const stx = await p.innerText('#view'); ok('vendeur: stock shows sale price, not purchase cost', /Vente : 450/.test(stx) && !/Achat/.test(stx) && !(await p.$('[data-act=editprod]')));
  ok('vendeur: cannot delete / edit stock', await p.evaluate(() => !App.guard('delclient') && !App.guard('editprod') && App.guard('newinv') && App.guard('newpay')));
  await p.evaluate(() => App.go('client', { id: 'c1', tab: 'abo' })); ok('vendeur: no cost/margin on fiche', !/Coût Starlink/.test(await p.innerText('#view')));
  await p.evaluate(() => App.go('reports')); ok('vendeur redirected from reports', await p.evaluate(() => App.state.view === 'home'));
  // ---- comptable
  await login('2222'); ok('comptable sees finances + reports, not settings/users', await p.evaluate(() => App.canView('reports') && App.can('finance') && !App.canView('settings') && !App.canView('users') && !App.guard('delinv') && App.guard('newexp')));
  ok('comptable: finance visible', await p.evaluate(() => document.querySelector('.dash [style*="grid-area:b"]').hidden === false));
  // ---- technicien (single window)
  await p.evaluate(() => { App.db.technicians.push({ id: 't1', name: 'Thomas', active: true, role: 'Technicien' }); App.db.installs.push({ id: 'in0', clientId: 'c1', date: App.today(), kind: 'Installation Starlink', tech: 'Thomas', techId: 't1', price: 50, materials: [], obs: 'Poser sur le toit' }); App.db.installs.push({ id: 'in9', clientId: 'c1', date: App.today(), kind: 'Dépannage', tech: 'Autre Tech', price: 20, materials: [] }); App.save(); });
  await login('4444'); ok('technicien: single window, no menus', await p.evaluate(() => document.body.classList.contains('solo') && App.state.view === 'mestaches' && getComputedStyle(document.getElementById('bottom')).display === 'none' && getComputedStyle(document.getElementById('fab')).display === 'none' && document.getElementById('syncBtn').hidden && document.getElementById('searchBtn').hidden));
  let tt = (await p.innerText('#view')).replace(/\n/g, ' '); ok('technicien sees only his intervention (with address + note), not others', /Awa D/.test(tt) && /Installation Starlink/.test(tt) && /Av\. Kasa-Vubu 12/.test(tt) && /Poser sur le toit/.test(tt) && !/Dépannage/.test(tt), tt.slice(0, 200));
  ok('technicien: cannot reach other screens/actions', await p.evaluate(() => App.guard('newinst') && !App.guard('newinv') && !App.guard('newclient') && !App.canView('invoices') && !App.canView('stock') && !App.canView('clients')));
  await p.evaluate(() => App.go('invoices')); ok('technicien redirected away from invoices', await p.evaluate(() => App.state.view === 'mestaches'));
  await p.click('[data-act=newinst]'); ok('technician name locked in the form', (await p.inputValue('#f_t')) === 'Thomas' && await p.$eval('#f_t', e => e.readOnly)); await p.selectOption('#f_c', 'c1'); await p.fill('#f_p', '30'); await p.click('#dok');
  ok('new installation recorded under his name', await p.evaluate(() => App.db.installs.some(x => x.tech === 'Thomas' && x.techId === 't1' && x.price === 30)) && (await p.$$('#view .card')).length === 2);
  // ---- livreur Lionel (single window)
  await login('5555'); await p.screenshot({ path: 'roles_livreur.png' });
  ok('livreur: single window, no menus', await p.evaluate(() => document.body.classList.contains('solo') && App.state.view === 'livraisons' && getComputedStyle(document.getElementById('bottom')).display === 'none' && getComputedStyle(document.getElementById('side')).display === 'none' && document.getElementById('fab').hidden && document.getElementById('searchBtn').hidden && document.getElementById('syncBtn').hidden));
  let lv = (await p.innerText('#view')).replace(/\n/g, ' '); console.log(lv.slice(0, 400));
  ok('livreur: client + address + items only; no invoice, no prices, no WhatsApp', /Awa D/.test(lv) && /Av\. Kasa-Vubu 12/.test(lv) && /Starlink Mini/.test(lv) && !/FAC-1/.test(lv) && !/Facture/.test(lv) && !/450/.test(lv.replace(/Routeur.*/, '')) && !(await p.$('a[href*="wa.me"]')) && !/Câble/.test(lv));
  ok('livreur: buttons are Livré / Non livré (+ Appeler, Itinéraire)', !!(await p.$('[data-act=dl_done]')) && !!(await p.$('[data-act=dl_fail]')) && !(await p.$('[data-act=dl_go]')) && (await p.$$('a[href^="tel:"]')).length >= 1 && (await p.$$('a[href*="google.com/maps"]')).length >= 1);
  ok('livreur cannot create/edit/see anything else', await p.evaluate(() => !App.guard('newdl') && !App.guard('editdl') && !App.canView('clients') && !App.canView('more') && !App.canView('invoices') && !App.guard('newpay') && App.guard('dl_done')));
  ok('livreur: no "+ Livraison" button', !(await p.$('[data-act=newdl]')));
  await p.click('[data-act=dl_done][data-id=d1]'); ok('simple confirmation (no amount asked)', !(await p.$('#f_amt')) && /remis au client/.test(await p.innerText('#dlg'))); await p.click('#dok');
  ok('d1 delivered, no payment created', await p.evaluate(() => App.db.deliveries.find(d => d.id === 'd1').status === 'done' && App.db.payments.length === 0));
  const col = (await p.innerText('#view')).replace(/\n/g, ' '); ok('collect delivery shows amount to collect (and only then)', /À encaisser : 450 \$/.test(col));
  await p.click('[data-act=dl_done][data-id=d3]'); ok('collect prefilled with balance 450', (await p.inputValue('#f_amt')) === '450'); await p.selectOption('#f_m', 'M-Pesa'); await p.click('#dok');
  ok('collected: payment recorded + invoice settled', await p.evaluate(() => { const d = App.db.deliveries.find(x => x.id === 'd3'), pay = App.db.payments[0]; return d.status === 'done' && d.collected === 450 && pay && pay.amount === 450 && pay.mode === 'M-Pesa' && pay.invoiceId === 'i1' && App.invDue(App.invoice('i1')) < 0.01 && /Lionel/.test(pay.comment); }));
  ok('history logged', await p.evaluate(() => App.db.log.some(l => /Livraison effectuée par Lionel/.test(l.text))));
  // ---- livreur Aimé fail
  await login('6666'); lv = await p.innerText('#view'); ok('Aimé sees only his', /Câble/.test(lv) && !/Starlink Mini/.test(lv)); await p.click('[data-act=dl_fail]'); ok('fail dialog titled Colis non livré', /non livré/.test(await p.innerText('#dlg'))); await p.fill('#f_why', 'Client absent'); await p.click('#dok');
  ok('failed with reason', await p.evaluate(() => (d => d.status === 'failed' && /absent/.test(d.note))(App.db.deliveries.find(x => x.id === 'd2'))));
  // ---- admin
  await login('1111'); ok('admin: all rights, lands home', await p.evaluate(() => App.canView('settings') && App.guard('delinv') && App.guard('users_new') && App.user.role === 'admin'));
  await p.evaluate(() => App.go('livraisons')); await p.click('[data-f=all]'); ok('admin sees all deliveries + add button', (await p.$$('#view .card')).length === 3 && !!(await p.$('[data-act=newdl]')));
  await p.screenshot({ path: 'roles_admin_dl.png' });
  // new delivery form from admin
  await p.click('[data-act=newdl]'); await p.selectOption('#f_c', 'c1'); await p.waitForTimeout(100); ok('address+phone prefilled from client', (await p.inputValue('#f_ad')) === 'Av. Kasa-Vubu 12' && (await p.inputValue('#f_ph')) === '0812345678'); 
  const drv = await p.evaluate(() => [...document.querySelectorAll('#f_dr option')].map(o => o.textContent)); ok('driver list = livreurs only', drv.includes('Lionel') && drv.includes('Aimé') && !drv.includes('Victor'), drv);
  await p.fill('#f_it', 'Routeur'); await p.click('#dok'); ok('delivery created', await p.evaluate(() => App.db.deliveries.length === 4));
  // last admin protection
  await p.evaluate(() => App.go('users')); await p.click('[data-act=users_edit]:first-child'); await p.selectOption('#f_role', 'vendeur'); await p.click('#dok'); await p.waitForTimeout(200);
  ok('cannot demote last admin', /au moins un administrateur/.test(await p.innerText('#f_msg')) && await p.evaluate(() => App.users()[0].role === 'admin')); await p.keyboard.press('Escape');
  // own PIN change
  await p.evaluate(() => App.go('profile')); await p.click('[data-act=me_pin]'); await pin(p, '1111'); await pin(p, '7777'); await pin(p, '7777'); await p.waitForTimeout(300);
  ok('admin PIN changed (recovery code shown for admin)', /Code de récupération/.test(await p.innerText('#lock')));
  const rec = (await p.innerText('#lock h1:nth-of-type(2)')).trim(); await p.click('[data-lk=recdone]');
  await login('7777'); ok('login with new PIN', await p.evaluate(() => App.user && App.user.name === 'Administrateur')); await login('1111'); ok('old PIN no longer works', /incorrect/.test(await p.innerText('#lock')) || await p.evaluate(() => App.locked));
  // admin recovery
  await p.click('[data-lk=forgot]'); await p.fill('#rec', rec); await p.click('[data-lk=recok]'); await pin(p, '8888'); await pin(p, '8888'); await p.waitForTimeout(300); ok('recovery -> new PIN flow ran', /Code de récupération|CISPOL/.test(await p.innerText('#lock')) || await p.evaluate(() => App.user && App.user.role === 'admin'));
  await p.evaluate(() => { document.getElementById('lock').hidden = true; });
  // disable profiles
  await p.evaluate(() => { App.user = App.users()[0]; App.applyRole(); }); await p.evaluate(() => App.actions.users_off()); ok('profiles off -> legacy', await p.evaluate(() => !App.multi() && App.canView('settings')));
  await p.screenshot({ path: 'roles.png' }); console.log('errors', errs); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); await b.close();
})();
