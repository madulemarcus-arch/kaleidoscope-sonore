const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => { App.db.clients.push({ id: 'c1', code: 'CL-1', type: 'gere', first: 'Awa', last: 'D', name: 'Awa D', phone: '081', start: App.today(), period: 30, grace: 15, subs: [], created: App.today() }); App.save(); });
  await p.click('[data-nav=more]'); ok('menu entry', /Techniciens/.test(await p.innerText('#view')));
  await p.click('#view [data-v=technicians]'); ok('empty state', /Aucun technicien/.test(await p.innerText('#view')));
  await p.click('[data-act=newtech]'); await p.fill('#f_name', 'Jean Mbala'); await p.fill('#f_phone', '0991112223'); await p.selectOption('#f_role', 'Installateur Starlink'); await p.fill('#f_zone', 'Gombe'); await p.click('#dok');
  ok('listed', /Jean Mbala/.test(await p.innerText('#view')) && /Gombe/.test(await p.innerText('#view')));
  await p.click('[data-act=newtech]'); await p.fill('#f_name', 'jean mbala'); await p.click('#dok'); ok('duplicate name refused', await p.evaluate(() => App.db.technicians.length) === 1); await p.click('#dcancel').catch(() => p.keyboard.press('Escape'));
  // installation with technician
  const dl = await p.evaluate(() => { App.installForm({ clientId: 'c1' }); return [...document.querySelectorAll('#techlist option')].map(o => o.value); }); ok('datalist in install form', dl.includes('Jean Mbala'), dl);
  await p.fill('#f_t', 'Jean Mbala'); await p.fill('#f_p', '50'); await p.click('#dok');
  ok('install linked to technicien', await p.evaluate(() => App.db.installs[0].techId === App.db.technicians[0].id));
  await p.evaluate(() => App.go('technician', { id: App.db.technicians[0].id })); const t = await p.innerText('#view'); ok('fiche shows 1 intervention + $50', /Interventions\s*1/.test(t.replace(/\n/g, ' ')) && /50/.test(t), t.replace(/\n/g, ' | ').slice(0, 220));
  // rename updates installs
  await p.click('[data-act=edittech]'); await p.fill('#f_name', 'Jean-Pierre Mbala'); await p.click('#dok');
  ok('rename propagates', await p.evaluate(() => App.db.installs[0].tech === 'Jean-Pierre Mbala'));
  // commission
  await p.click('[data-act=edittech]'); await p.selectOption('#f_ct', 'pct'); await p.fill('#f_cv', '150'); await p.click('#dok'); ok('pct > 100 refused', await p.evaluate(() => App.db.technicians[0].ctype !== 'pct')); 
  await p.fill('#f_cv', '10'); await p.click('#dok');
  let tx = (await p.innerText('#view')).replace(/\n/g, ' '); ok('10% of $50 = $5 due', /Commission à payer\s*5 \$/.test(tx) && /10 % du prix/.test(tx), tx.slice(0, 300));
  await p.click('[data-act=paytech]');
  ok('paid: expense + frozen', await p.evaluate(() => { const x = App.db.installs[0], e = App.db.expenses.find(e => e.cat === 'Commission technicien'); return x.techPaid === App.today() && x.techComm === 5 && e && e.amount === 5; }));
  await p.click('[data-act=edittech]'); await p.selectOption('#f_ct', 'fixed'); await p.fill('#f_cv', '20'); await p.click('#dok');
  tx = (await p.innerText('#view')).replace(/\n/g, ' '); ok('paid commission stays $5, nothing due', /Commission payée\s*5 \$/.test(tx) && !/Payer la commission/.test(tx), tx.slice(0, 300));
  await p.evaluate(() => { App.db.installs.push({ id: 'i2', clientId: 'c1', date: App.today(), kind: 'Dépannage', tech: 'Jean-Pierre Mbala', techId: App.db.technicians[0].id, price: 0, materials: [] }); App.save(); App.refresh(); });
  ok('fixed $20 for new job', /Payer la commission \(20 \$\)/.test(await p.innerText('#view')));
  // search
  const hit = await p.evaluate(() => { App.search(); const i = document.getElementById('gq'); i.value = 'gombe'; i.dispatchEvent(new Event('input', { bubbles: true })); return new Promise(r => setTimeout(() => r(document.getElementById('dlg').innerText), 300)); }); ok('global search finds technician', /Jean-Pierre/.test(hit));
  await p.keyboard.press('Escape');
  // restore old backup without technicians
  const okr = await p.evaluate(() => { const o = JSON.parse(JSON.stringify(App.exportData())); delete o.technicians; return App.restoreData(JSON.stringify(o)) && Array.isArray(App.db.technicians); }); ok('old backup restores', okr);
  await p.evaluate(() => App.go('technicians')); await p.screenshot({ path: 'tech.png' });
  console.log('errors', errs); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); await b.close();
})();
