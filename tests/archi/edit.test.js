// Editing: stretching handles, moving, properties, layers, persistence, text, touch gestures.
const { check, launch } = require('./helper');
(async () => {
  const { browser, page, click, at, items, reload, errors } = await launch(), key = k => page.keyboard.press(k);
  const drag = async (a, b) => { const [x0, y0] = await at(...a), [x1, y1] = await at(...b); await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 3 }); await page.mouse.move(x1, y1, { steps: 3 }); await page.mouse.up(); };
  await key('r'); await click(-3, -2); await click(3, 2); await key('v');
  // move a wall: the touching walls stretch with it
  await click(3, 0); await drag([3, 0], [4, 0]);
  let it = await items(); check('mur déplacé de 1 m', it[1].a[0] === 4 && it[1].b[0] === 4, JSON.stringify(it[1]));
  check('murs voisins étirés', it[0].b[0] === 4 && it[2].a[0] === 4, JSON.stringify([it[0].b, it[2].a]));
  // drag a handle
  await click(-3, 0); await drag([-3, -2], [-4, -2]); it = await items();
  check('poignée déplacée', it[0].a[0] === -4 && it[3].b[0] === -4, JSON.stringify([it[0].a, it[3].b]));
  await key('Control+z'); await key('Control+z'); it = await items(); check('annuler les deux déplacements', it[1].a[0] === 3 && it[0].a[0] === -3);
  // door follows its wall and moves along it
  await key('d'); await click(0, -2); await key('v'); await click(0, -2); await drag([0, -2], [1, -2]); it = await items(); const door = it.find(i => i.t === 'door');
  check('porte glissée le long du mur', Math.abs(door.pos - 4) < 0.06, String(door.pos));
  // properties panel
  await page.fill('#props input[type=number] >> nth=0', '1.2'); await page.locator('#props input[type=number] >> nth=0').dispatchEvent('change');
  check('largeur de porte modifiée', (await items()).find(i => i.t === 'door').w === 1.2);
  await key('Escape'); await click(-3, 0); await page.fill('#props input[type=number] >> nth=0', '0.3'); await page.locator('#props input[type=number] >> nth=0').dispatchEvent('change');
  check('épaisseur de mur modifiée', (await items())[3].th === 0.3);
  // layers
  await page.evaluate(() => App.edit(d => { d.layers[0].on = false; })); check('calque masqué : plus d\'accroche', (await page.evaluate(() => App.hit([-3, 0], 0.1))) === null);
  await page.evaluate(() => App.edit(d => { d.layers[0].lock = true; d.layers[0].on = true; })); check('calque verrouillé : non sélectionnable', (await page.evaluate(() => App.hit([-3, 0], 0.1))) === null);
  await page.evaluate(() => App.edit(d => { d.layers[0].lock = false; }));
  // text (prompt dialog)
  page.once('dialog', d => d.accept('Salon')); await key('t'); await click(-1, 0);
  check('texte créé', (await items()).some(i => i.t === 'text' && i.s === 'Salon'));
  // persistence
  const before = (await items()).length; await reload(); check('plan restauré après rechargement', (await items()).length === before && before > 0);
  // wheel zoom keeps the point under the cursor
  const [mx, my] = await at(0, 0); await page.mouse.move(mx, my); await page.mouse.wheel(0, -300);
  const s = await page.evaluate(() => App.view.s); check('zoom molette', s > 50, String(s));
  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.stack); process.exit(1); });
