// Shared helpers for the Archi 2D tests (one browser per test file, no real data).
const { chromium } = require('playwright');
exports.check = (name, ok, extra) => console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || !extra ? '' : ' → ' + extra));
exports.launch = async (opts = {}) => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1200, height: 760 }, serviceWorkers: 'block', acceptDownloads: true, hasTouch: !!opts.touch });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto(process.env.BASE_URL + '/index.html'); await page.waitForSelector('html[data-ready="1"]');
  const box = await page.locator('#cv').boundingBox();
  // Screen position of a world point (metres) for mouse events.
  const at = async (x, y) => { const v = await page.evaluate(() => ({ s: App.view.s, ox: App.view.ox, oy: App.view.oy })); return [box.x + x * v.s + v.ox, box.y - y * v.s + v.oy]; };
  const click = async (x, y) => { const [sx, sy] = await at(x, y); await page.mouse.move(sx, sy); await page.mouse.click(sx, sy); };
  const items = () => page.evaluate(() => JSON.parse(JSON.stringify(App.doc.items)));
  return { browser, page, errors, at, click, items, reload: async () => { await page.reload(); await page.waitForSelector('html[data-ready="1"]'); } };
};
