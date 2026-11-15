// Empty screens offer one clear action, and the floating "+" never hides the last row of a list.
const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'commerce' });
  const go = async s => { await p.evaluate(s => { location.hash = '#/' + s; }, s); await p.waitForSelector('#view .empty'); };
  // clients: the empty card opens the new-client form (no top button on this screen)
  await go('clients'); check('clients vide : bouton d\'action', (await p.locator('#view .empty [data-cta]').count()) === 1);
  check('clients vide : plus de « bouton + » ambigu', !(await p.textContent('#view .empty')).includes('bouton +'));
  await p.click('#view .empty [data-cta]'); await p.waitForSelector('.sheet-wrap.on'); check('clients vide : ouvre le formulaire', (await p.locator('.sheet input[name=name]').count()) === 1);
  await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  // every other empty screen: the card button triggers the screen's own "+" button
  const cases = [['sales', 'input[name=client], .sheet select, .sheet input'], ['stock', '.sheet input[name=name]'], ['suppliers', '.sheet input[name=name]'], ['delivery', '.sheet']];
  for (const [s, sel] of cases) {
    await go(s); await p.click('#view .empty [data-cta]'); await p.waitForSelector('.sheet-wrap.on', { timeout: 5000 }).then(() => check(s + ' vide : le bouton ouvre le formulaire', true), () => check(s + ' vide : le bouton ouvre le formulaire', false));
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  }
  // the page leaves room under the last row for the floating button (phone)
  const room = await p.evaluate(() => { const pg = document.querySelector('#view .page'); return parseFloat(getComputedStyle(pg).paddingBottom); });
  check('espace sous les listes ≥ bouton + (phone)', room >= 80, String(room));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
})().catch(e => { console.log("FAIL exception → " + e.message); process.exit(1); });
