// Shared helpers for the CISPOLstore Business tests (one browser per test file, fictitious data only).
const { chromium } = require('playwright');
exports.check = (name, ok, extra) => console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || !extra ? '' : ' → ' + extra));
exports.launch = async (opts = {}) => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 800 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto(process.env.BASE_URL + '/index.html'); await page.waitForSelector('html[data-ready="1"]');
  return { browser, page, errors, reload: async () => { await page.reload(); await page.waitForSelector('html[data-ready="1"]'); } };
};
// Walks the 3-step wizard with fictitious values.
exports.setup = async (page, o = {}) => {
  await page.fill('.wizard input[name=name]', o.name || 'Ets Test'); if (o.activity) await page.selectOption('.wizard select[name=activity]', o.activity);
  await page.click('[data-next]'); await page.click('[data-next]'); await page.click('[data-next]'); await page.waitForSelector('.wizard', { state: 'detached' });
};
