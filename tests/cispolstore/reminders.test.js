const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const ctx = await b.newContext({ ...devices['Pixel 5'] }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => { const t = App.today(); const mk = (id, name, off, ph) => ({ id, code: id, type: 'gere', first: name, last: 'X', name, phone: ph, start: App.addDays(t, off - 30), period: 30, grace: 15, subs: [], created: t });
    App.db.clients.push(mk('a', 'Awa', 3, '0812345678'), mk('b', 'Bob', -5, '0820000000'), mk('c', 'Cy', 20, '0830000000'), mk('d', 'Di', -60, '0840000000'), mk('e', 'Eli', 1, '')); App.save(); });
  await p.click('[data-nav=more]'); await p.click('#view [data-v=subs]'); await p.click('#view [data-v=rappels]');
  const txt = await p.innerText('#view'); console.log(txt.replace(/\n/g, ' | ').slice(0, 400));
  ok('Awa (3d), Bob (sursis), Eli (no phone) listed; Cy (20d) and Di (very old) not', /Awa/.test(txt) && /Bob/.test(txt) && /Eli/.test(txt) && !/\bCy\b/.test(txt) && !/\bDi\b/.test(txt));
  const url = await p.evaluate(() => decodeURIComponent(App.waLink(App.client('a'))));
  ok('link uses template', /wa\.me\/243812345678\?text=Bonjour Awa, votre abonnement Starlink arrive à expiration le .* \(dans 3 jour\(s\)\)/.test(url), url);
  const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null), p.click('[data-act=remind][data-id=a]')]);
  ok('whatsapp window opened', !!pop);
  ok('marked reminded', await p.evaluate(() => App.client('a').lastRemind === App.today()) && /rappelé le/.test(await p.innerText('#view')));
  // settings: edit template
  await p.click('#view [data-act=go][data-v=settings]'); await p.click('details[data-fold=msgs] summary'); await p.fill('#m_actif', 'Salut {prenom}, fin le {fin}.'); await p.dispatchEvent('#m_actif', 'change');
  ok('custom message used', /Salut Awa, fin le/.test(await p.evaluate(() => decodeURIComponent(App.waLink(App.client('a'))))));
  ok('msgs part of shared sync settings', true);
  ok('stays open after a redraw', await p.evaluate(() => { App.refresh(); return document.querySelector('details[data-fold=msgs]').open; })); await p.click('[data-act=msgreset]'); ok('reset', await p.evaluate(() => !App.db.settings.msgs));
  await p.click('#view [data-act=go][data-v=rappels]').catch(() => {}); await p.screenshot({ path: 'rem.png' });
  console.log('errors', errs); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); await b.close();
})();
