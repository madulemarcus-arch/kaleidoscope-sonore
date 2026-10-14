// Android app shortcuts: ?go=<view> opens that screen (only if the profile may see it).
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8774';
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }), p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const open = async q => { await p.goto(BASE + '/index.html' + q); await p.waitForTimeout(700); await p.click('[data-lk=skip]', { timeout: 1200 }).catch(() => {}); await p.waitForTimeout(200); return p.evaluate(() => App.state.view); };
  ok('no parameter: home', (await open('')) === 'home');
  ok('?go=relances opens the daily reminders', (await open('?source=shortcut&go=relances')) === 'relances');
  ok('?go=clients opens the clients', (await open('?go=clients')) === 'clients');
  ok('?go=quotes opens the quotes', (await open('?go=quotes')) === 'quotes');
  ok('unknown view is ignored', (await open('?go=nimportequoi')) === 'home');
  ok('?go=settings is blocked for a profile without access (vendeur)', await (async () => { await p.evaluate(() => { App.db.settings.users = [{ id: 'v', name: 'Vic', role: 'vendeur', active: true, salt: 's', hash: 'h' }]; App.save(); }); return (await open('?go=settings')) !== 'settings'; })());
  const m = await (await p.request.get(BASE + '/manifest.webmanifest')).json(); ok('manifest served with shortcuts and maskable icon', m.shortcuts.length >= 3 && m.icons.some(i => i.purpose === 'maskable'));
  const pr = await p.request.get(BASE + '/privacy.html'); ok('privacy.html is served', pr.ok() && /confidentialité/.test(await pr.text()));
  ok('no page errors', errs.length === 0, errs.join('|')); await b.close(); process.exit(f ? 1 : 0);
})();
