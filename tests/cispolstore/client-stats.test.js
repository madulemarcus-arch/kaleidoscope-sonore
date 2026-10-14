// Client statistics: average value, best clients, subscription churn computed from a small dataset worked out by hand.
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8774';
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }), p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => {
    const t = App.today(), A = App.addDays, S = App.db.settings; S.period = 30; S.grace = 15;
    const mk = (id, o) => App.db.clients.push({ id, code: id, first: id, last: 'X', name: id + ' X', phone: '09' + id.length, subs: [], created: A(t, -150), note: '', ...o });
    mk('A', { type: 'gere', start: A(t, -10), period: 30, subs: [-100, -70, -40].map(d => ({ start: A(t, d), days: 30, price: 70, date: A(t, d) })) }); // renewed in time, every month: stays
    mk('B', { type: 'gere', start: A(t, -100), period: 30 }); // lapsed at t-54: lost
    mk('C', { type: 'gere', start: A(t, -200), period: 30 }); // lapsed long ago: not in the base
    mk('D', { type: 'gere', start: A(t, -20), period: 30, created: A(t, -20) }); // new subscriber
    mk('E', { type: 'gere', start: A(t, -60), period: 30, subs: [{ start: A(t, -120), days: 30, price: 70, date: A(t, -120) }] }); // renewed too late: lost
    mk('F', { type: 'mat' });
    const inv = (cid, date, price) => App.createInvoice({ type: 'materiel', clientId: cid, currency: 'USD', payMode: 'Cash', date, lines: [{ pid: '', desc: 'Article', qty: 1, price, cost: 0 }], payAmount: price }, 0);
    inv('A', A(t, -5), 100); inv('A', A(t, -20), 60); inv('B', A(t, -80), 50); inv('F', A(t, -10), 200); inv('F', A(t, -200), 200);
    App.save(); App.go('more');
  });
  await p.waitForTimeout(500);
  ok('Plus has Statistiques clients', /Statistiques clients/.test(await p.innerText('#view')));
  await p.evaluate(() => App.go('clients')); await p.waitForTimeout(500);
  ok('Clients screen has the Statistiques button', /Statistiques clients/.test(await p.innerText('#view')));
  const s = await p.evaluate(() => { const r = App.clientStats(90); return { ca: r.ca, buyers: r.buyers, avg: r.avgClient, basket: r.basket, loyal: r.loyalPct, top: r.top.map(x => [x.c.id, x.v]), top5: r.top5, base: r.churn.base, rate: r.churn.rate, kept: r.churn.kept, lostIds: r.churn.lostList.map(c => c.id), back: r.churn.back, sleeping: r.sleeping.map(x => x.c.id) }; });
  ok('revenue over 90 days = 410 $ (the t-200 invoice is out)', Math.abs(s.ca - 410) < 0.01, String(s.ca));
  ok('3 buyers (A, B, F) -> average 136.67 $ per client', s.buyers === 3 && Math.abs(s.avg - 410 / 3) < 0.01, `${s.buyers} / ${s.avg}`);
  ok('basket 102.5 $ (410 / 4 invoices)', Math.abs(s.basket - 102.5) < 0.01, String(s.basket));
  ok('best clients ordered F 200, A 160, B 50', JSON.stringify(s.top) === JSON.stringify([['F', 200], ['A', 160], ['B', 50]]), JSON.stringify(s.top));
  ok('loyalty: A and F bought twice -> 2 of 3 = 67 %', s.loyal === 67, String(s.loyal));
  ok('churn base = A, B, E (subscribed at the start of the period)', s.base === 3, String(s.base));
  ok('lost = B and E, kept = A, rate 67 %', JSON.stringify(s.lostIds.sort()) === '["B","E"]' && s.kept === 1 && s.rate === 67, JSON.stringify([s.lostIds, s.kept, s.rate]));
  ok('C (gone long before) and D (new) are not counted as lost', !s.lostIds.includes('C') && !s.lostIds.includes('D'));
  ok('no sleeping client with a recent purchase (F bought 10 days ago)', !s.sleeping.includes('F'), JSON.stringify(s.sleeping));
  const m = await p.evaluate(() => App.clientStats(90).months.reduce((a, x) => [a[0] + x.v, a[1] + x.v2], [0, 0]));
  ok('monthly chart data: lapses of B and E in the 6 months', m[1] >= 2, JSON.stringify(m));
  await p.evaluate(() => App.go('clientstats')); await p.waitForTimeout(1300);
  let t = await p.innerText('#view');
  ok('hero shows the average value 136,67', /136[,.]67/.test(t), t.slice(0, 120).replace(/\n/g, ' | '));
  ok('churn rate 67 % and best clients listed', /67 %/.test(t) && /F X/.test(t) && /🥇/.test(t));
  ok('top 5 share of revenue shown', /100 %/.test(t));
  await p.click('[data-act=cs_per][data-p="30"]'); await p.waitForTimeout(1300); t = await p.innerText('#view');
  ok('30 days: revenue 360 $ (A 160 + F 200)', await p.evaluate(() => Math.abs(App.clientStats(30).ca - 360) < 0.01));
  await p.click('[data-act=cs_per][data-p="365"]'); await p.waitForTimeout(1300);
  ok('12 months: all invoices (610 $)', await p.evaluate(() => Math.abs(App.clientStats(365).ca - 610) < 0.01));
  await p.evaluate(() => { App.db.settings.users = [{ id: 'v', name: 'Vic', role: 'vendeur', active: true, salt: 's', hash: 'h' }]; App.user = App.db.settings.users[0]; App.applyRole && App.applyRole(); });
  ok('vendeur cannot open the statistics', await p.evaluate(() => !App.canView('clientstats')));
  ok('no page errors', errs.length === 0, errs.join('|')); await b.close(); process.exit(f ? 1 : 0);
})();
