// Drawing: walls, rooms, openings, dimensions, typed lengths, snapping, undo/redo, deletion.
const { check, launch } = require('./helper');
(async () => {
  const { browser, page, click, at, items, errors } = await launch();
  const key = k => page.keyboard.press(k), kinds = async () => (await items()).map(i => i.t).join(',');
  // room by two clicks
  await key('r'); await click(-3, -2); await click(3, 2);
  let it = await items(); check('pièce = 4 murs', it.length === 4 && it.every(i => i.t === 'wall'), await kinds());
  check('murs chaînés (coins communs)', it[0].b.join() === it[1].a.join() && it[3].b.join() === it[0].a.join());
  check('épaisseur par défaut 0,2 m', it.every(i => i.th === 0.2 && i.h === 2.8));
  // openings
  await key('d'); await click(0, -2); await key('f'); await click(3, 0);
  it = await items(); const door = it.find(i => i.t === 'door'), win = it.find(i => i.t === 'window');
  check('porte posée sur le mur du bas', !!door && door.w === 0.9 && Math.abs(door.pos - 3) < 0.06, JSON.stringify(door));
  check('fenêtre posée sur le mur de droite', !!win && win.h === 1.2 && win.sill === 0.9);
  await key('d'); await click(0, 0); check('porte refusée hors d\'un mur', (await items()).filter(i => i.t === 'door').length === 1);
  // dimension (3 clicks)
  await key('c'); await click(-3, -2); await click(3, -2); await click(3, -3);
  const dim = (await items()).find(i => i.t === 'dim'); check('cote créée avec décalage', !!dim && Math.abs(Math.abs(dim.off) - 1) < 0.06, JSON.stringify(dim));
  // chain of walls with typed length
  await key('m'); await click(5, 0); await page.mouse.move(...(await at(8, 0)));
  for (const c of '2.5') await key(c); check('saisie affichée dans la barre', (await page.textContent('#hint')).includes('2.5'));
  await key('Enter'); let w = (await items()).filter(i => i.t === 'wall').pop();
  check('longueur saisie 2,5 m', Math.abs(Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) - 2.5) < 1e-6 && Math.abs(w.b[1]) < 1e-6, JSON.stringify(w));
  await key('Escape'); check('Échap termine la chaîne', (await page.evaluate(() => App.pts.length)) === 0);
  // rect typed 4x3
  await key('r'); await click(4, -5); await page.mouse.move(...(await at(6, -3))); for (const c of '4x3') await key(c); await key('Enter');
  const added = (await items()).filter(i => i.t === 'wall').slice(-4); const xs = added.flatMap(i => [i.a[0], i.b[0]]), ys = added.flatMap(i => [i.a[1], i.b[1]]);
  check('pièce saisie 4x3', Math.max(...xs) - Math.min(...xs) === 4 && Math.max(...ys) - Math.min(...ys) === 3);
  // snapping to an existing endpoint
  await key('l'); const [sx, sy] = await at(3.02, 2.03); await page.mouse.move(sx, sy); await page.mouse.click(sx, sy);
  check('accrochage sur une extrémité', (await page.evaluate(() => App.pts[0].join())) === '3,2', await page.evaluate(() => App.pts[0]));
  await key('Escape');
  // undo / redo / delete
  const n = (await items()).length; await key('Control+z'); check('annuler', (await items()).length < n); await key('Control+y'); check('rétablir', (await items()).length === n);
  await key('v'); await click(-3, 0); check('sélection d\'un mur', (await page.evaluate(() => App.sel.length)) === 1);
  await key('Delete'); check('suppression', (await items()).length === n - 1);
  await key('v'); await click(3, 0); await key('Delete'); check('suppression d\'une fenêtre', !(await items()).some(i => i.t === 'window'));
  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.stack); process.exit(1); });
