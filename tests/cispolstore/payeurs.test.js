// Payers (politician, organisation, big client) who pay or offer kits used by beneficiaries: link, kits tab, batch creation, « Gros clients » list
const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => { const t = App.today(); App.db.clients.push(
    { id: 'pay1', code: 'CL-1', type: 'mat', first: 'Hon.', last: 'Mukendi', name: 'Hon. Mukendi', phone: '0811111111', subs: [], created: t, payer: true, payCat: 'politicien' },
    { id: 'pay2', code: 'CL-2', type: 'mat', first: 'Paroisse', last: 'Saint-Joseph', name: 'Paroisse Saint-Joseph', phone: '', subs: [], created: t, payer: true, payCat: 'organisation' },
    { id: 'ex1', code: 'CL-3', type: 'gere', first: 'Jean', last: 'Mbuyi', name: 'Jean Mbuyi', phone: '0822222222', acc: 'ACC-EXIST', city: 'Kinshasa', quarter: 'Limete', start: App.addDays(t, -5), period: 30, grace: 15, subs: [], created: t },
    { id: 'ex2', code: 'CL-4', type: 'install', first: 'Rose', last: 'Ilunga', name: 'Rose Ilunga', phone: '', subs: [], created: t }); App.save(); });

  // 1) « Gros clients » list: the payers, even before they have kits
  await p.evaluate(() => App.go('payeurs')); await p.waitForTimeout(400);
  let v = await p.innerText('#view');
  ok('Gros clients: both payers listed with their category', /Hon\. Mukendi/.test(v) && /Paroisse Saint-Joseph/.test(v) && /Politicien/.test(v) && /Organisation/.test(v));
  ok('empty payers say « aucun kit pour l\'instant »', /aucun kit pour l'instant/.test(v));
  ok('menu: « Gros clients » entry in Plus', await p.evaluate(() => { App.go('more'); return true; }) && (await p.waitForTimeout(300), /Gros clients/.test(await p.innerText('#view'))));

  // 2) several kits at once, with the installation place; a known ACC is skipped
  await p.evaluate(() => App.go('client', { id: 'pay1', tab: 'kits' })); await p.waitForTimeout(400);
  ok('payer file has the « Kits » tab with the 3 buttons', await p.evaluate(() => [...document.querySelectorAll('.tabs button')].some(b => /Kits \(0\)/.test(b.textContent)) && !!document.querySelector('[data-act=kit_add]') && !!document.querySelector('[data-act=kit_many]') && !!document.querySelector('[data-act=kit_link]')));
  await p.click('[data-act=kit_many]'); await p.waitForTimeout(300);
  const fill = async (i, n, ph, lieu, acc) => { const r = (await p.$$('#km_rows .km'))[i]; await (await r.$('.km_n')).fill(n); await (await r.$('.km_p')).fill(ph); await (await r.$('.km_l')).fill(lieu); await (await r.$('.km_a')).fill(acc); };
  await fill(0, 'Awa Diallo', '', 'Kinshasa / Gombe', 'acc-1001'); await fill(1, 'Marie Kalala', '0833333333', 'Lubumbashi / Golf', 'ACC-1002'); await fill(2, 'Paul Tshibanda', '', 'Goma / Himbi', 'ACC-EXIST'); await fill(3, '', '', '', '');
  await p.click('#km_more'); ok('« + Ajouter un kit » adds a block', (await p.$$('#km_rows .km')).length === 5);
  await p.selectOption('#km_by', 'self'); await p.click('#dok'); await p.waitForTimeout(500);
  let r = await p.evaluate(() => App.kitsOf('pay1').map(c => ({ n: c.name, acc: c.acc, ph: c.phone, city: c.city, q: c.quarter, by: c.subBy, st: App.sub(c) && App.sub(c).status, type: c.type })));
  ok('2 beneficiaries created (the known ACC skipped), phone optional', r.length === 2 && r.some(x => x.n === 'Awa Diallo' && x.acc === 'ACC-1001' && x.ph === '' && x.city === 'Kinshasa' && x.q === 'Gombe') && r.some(x => x.n === 'Marie Kalala' && x.ph === '0833333333' && x.city === 'Lubumbashi'), JSON.stringify(r));
  ok('subscription starts today and the beneficiary pays it', r.every(x => x.st === 'actif' && x.by === 'self' && x.type === 'gere'));
  v = await p.innerText('#view');
  ok('kits tab lists them with place and who pays', /Awa Diallo/.test(v) && /Kinshasa \/ Gombe/.test(v) && /payé par lui/.test(v) && /Kits \(2\)/.test(await p.innerText('.tabs')));
  ok('city filter chips (Kinshasa / Lubumbashi)', await p.evaluate(() => document.querySelectorAll('[data-act=kit_city]').length === 3));
  await p.click('[data-act=kit_city][data-city=Lubumbashi]'); await p.waitForTimeout(300);
  ok('filter by city keeps only that place', await p.evaluate(() => /Marie Kalala/.test(document.getElementById('view').innerText) && !/Awa Diallo/.test(document.getElementById('view').innerText)));

  // 3) add one beneficiary through the normal form, pre-linked to the payer
  await p.evaluate(() => App.go('client', { id: 'pay1', tab: 'kits' })); await p.waitForTimeout(300);
  await p.click('[data-act=kit_add]'); await p.waitForTimeout(300);
  ok('form opens pre-linked to the payer, phone not required', await p.evaluate(() => document.getElementById('f_payer').value === 'pay1' && document.getElementById('f_subby').value === 'payer'));
  await p.fill('#f_first', 'Grâce'); await p.fill('#f_last', 'Makengo'); await p.fill('#f_city', 'Kinshasa'); await p.fill('#f_quarter', 'Kitambo'); await p.click('#dok'); await p.waitForTimeout(500);
  r = await p.evaluate(() => { const c = App.db.clients.find(x => x.name === 'Grâce Makengo'); return c && { payer: c.payerId, by: c.subBy, ph: c.phone }; });
  ok('beneficiary saved with payerId and no phone', r && r.payer === 'pay1' && r.by === 'payer' && r.ph === '', JSON.stringify(r));
  ok('his file says who offers the kit', /offert par Hon\. Mukendi/.test(await p.innerText('#view')) && /Payé par/.test(await p.innerText('#view')));

  // 4) link an existing client
  await p.evaluate(() => App.go('client', { id: 'pay1', tab: 'kits' })); await p.waitForTimeout(300);
  await p.click('[data-act=kit_link]'); await p.waitForTimeout(300);
  ok('picker lists the other clients and filters on typing', await p.evaluate(() => { const q = document.getElementById('kl_q'); q.value = 'rose'; q.dispatchEvent(new Event('input')); return [...document.querySelectorAll('#kl_l [data-n]')].filter(b => !b.hidden).length === 1; }));
  await p.click('#kl_l [data-n]:not([hidden])'); await p.waitForTimeout(400);
  ok('existing client linked to the payer', await p.evaluate(() => App.client('ex2').payerId === 'pay1' && App.kitsOf('pay1').length === 4));
  // a payer cannot become a beneficiary of someone else
  await p.evaluate(() => App.actions.kit_linkto({ id: 'pay1', pid: 'pay2' })); await p.waitForTimeout(200);
  ok('a payer who has beneficiaries cannot be linked under another payer', await p.evaluate(() => !App.client('pay1').payerId));

  // 5) client list filters and un-linking
  await p.evaluate(() => { App.clState.f = 'payeur'; App.go('clients'); }); await p.waitForTimeout(400);
  ok('Clients list: « Payeurs » filter shows only the payers', await p.evaluate(() => { const t = document.getElementById('clist').innerText; return /Hon\. Mukendi/.test(t) && /Paroisse/.test(t) && !/Awa Diallo/.test(t); }));
  await p.evaluate(() => { App.clState.f = 'offert'; App.refresh(); }); await p.waitForTimeout(300);
  ok('« Kits offerts » filter shows the beneficiaries with their payer', await p.evaluate(() => { const t = document.getElementById('clist').innerText; return /Awa Diallo/.test(t) && /Hon\. Mukendi/.test(t) && !/Paroisse/.test(t); }));
  await p.evaluate(() => { App.clState.f = 'all'; App.go('client', { id: 'ex2' }); }); await p.waitForTimeout(300);
  await p.click('[data-act=kit_unlink]'); await p.waitForTimeout(300);
  ok('« Détacher du payeur » unlinks without touching the file', await p.evaluate(() => !App.client('ex2').payerId && App.client('ex2').name === 'Rose Ilunga'));

  // 6) the list now has the numbers
  await p.evaluate(() => App.go('payeurs')); await p.waitForTimeout(400);
  v = await p.innerText('#view');
  ok('Gros clients: 2 payers, 3 kits offered, sorted by number of kits', /Hon\. Mukendi[\s\S]*3[\s\S]*Paroisse/.test(v) && await p.evaluate(() => { const c = document.querySelectorAll('#plist .item'); return c.length === 2 && /Hon\. Mukendi/.test(c[0].innerText); }));
  await p.click('[data-act=pay_cat][data-k=organisation]'); await p.waitForTimeout(300);
  ok('category chip filters the payers', await p.evaluate(() => { const c = document.querySelectorAll('#plist .item'); return c.length === 1 && /Paroisse/.test(c[0].innerText); }));
  await p.click('#plist .item'); await p.waitForTimeout(400);
  ok('tapping a payer opens his file on the Kits tab', await p.evaluate(() => App.state.view === 'client' && !!document.querySelector('.tabs button.on') && /Kits/.test(document.querySelector('.tabs button.on').textContent)));

  // 7) a new payer from the list
  await p.evaluate(() => App.go('payeurs')); await p.waitForTimeout(300); await p.click('[data-act=payer_new]'); await p.waitForTimeout(300);
  ok('« Nouveau payeur » opens the form with the payer box ticked', await p.evaluate(() => document.getElementById('f_ispayer').checked));
  await p.fill('#f_first', 'Sté'); await p.fill('#f_last', 'Kivu Logistique'); await p.selectOption('#f_paycat', 'entreprise'); await p.click('#dok'); await p.waitForTimeout(500);
  ok('new payer saved with its category', await p.evaluate(() => { const c = App.db.clients.find(x => x.name === 'Sté Kivu Logistique'); return c && c.payer === true && c.payCat === 'entreprise' && App.isPayer(c); }));
  console.log('errors', errs); ok('no page error', errs.length === 0); await b.close(); process.exit(f ? 1 : 0);
})();
