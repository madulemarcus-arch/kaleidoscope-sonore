// The Gmail card: the error message is readable in full (it used to be cut to one line), and the advice shown when the Google window closes by itself
const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(() => { window.google = { accounts: { oauth2: { initTokenClient: c => ({ requestAccessToken: () => setTimeout(() => c.error_callback({ type: 'popup_closed' }), 5) }) } } }; });
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => { localStorage.setItem('cispolstore-gmail', JSON.stringify({ clientId: '123-test.apps.googleusercontent.com', every: 0, accounts: [{ email: 'a@example.test', err: 'reconnect' }] })); });
  await p.reload(); await p.waitForTimeout(800); await p.evaluate(() => App.go('clients')); await p.waitForTimeout(800);
  await p.evaluate(() => { const d = document.querySelector('details[data-fold=slmail]'); if (d) d.open = true; }); await p.waitForTimeout(200);
  // the Google window closes by itself when we reconnect
  await p.click('[data-act=slm_reconnect]'); await p.waitForTimeout(500);
  const card = () => p.evaluate(() => { const c = document.querySelector('details[data-fold=slmail]') || document.getElementById('view'); return c.innerText; });
  ok('after a closed Google window, the card gives the advice (sign in with Chrome first / « Ne pas lire ici »)', /s'est fermée toute seule[\s\S]*Chrome[\s\S]*Ne pas lire ici/.test(await card()), (await card()).slice(0, 400));
  const h = await p.evaluate(() => { const el = [...document.querySelectorAll('.item .grow span.bad')].find(x => /Erreur/.test(x.textContent)); if (!el) return null; const r = el.getBoundingClientRect(); return { h: r.height, t: el.textContent, so: getComputedStyle(el).textOverflow, ws: getComputedStyle(el).whiteSpace }; });
  ok('the error line is not cut to one line (wraps, no ellipsis)', !!h && h.so !== 'ellipsis' && h.ws !== 'nowrap', JSON.stringify(h));
  ok('the full error text is shown', !!h && /Fenêtre Google fermée avant la fin/.test(h.t), h && h.t);
  console.log('errors', errs); ok('no page error', errs.length === 0); await b.close(); process.exit(f ? 1 : 0);
})();
