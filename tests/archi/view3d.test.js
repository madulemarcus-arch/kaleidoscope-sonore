// 3D view: mesh built from the plan (openings cut the walls), WebGL rendering, camera, mode switching.
const { check, launch } = require('./helper');
(async () => {
  const { browser, page, click, items, errors } = await launch(), key = k => page.keyboard.press(k);
  // pure mesh checks on hand-made plans
  const stats = await page.evaluate(() => {
    const doc = extra => { const d = App.newDoc(); d.items.push({ id: 'w', t: 'wall', a: [0, 0], b: [4, 0], th: 0.2, h: 2.8, layer: 'mur' }, ...extra); return App.buildMesh(d); };
    return { plain: doc([]).stats, door: doc([{ id: 'o', t: 'door', wall: 'w', pos: 2, w: 0.9, h: 2.1, sill: 0, flip: false, mirror: false, layer: 'mur' }]).stats,
      win: doc([{ id: 'o', t: 'window', wall: 'w', pos: 2, w: 1.2, h: 1.2, sill: 0.9, flip: false, mirror: false, layer: 'mur' }]).stats };
  });
  check('mur plein = 1 bloc', stats.plain.boxes === 1 && stats.plain.panes === 0, JSON.stringify(stats.plain));
  check('porte : 3 blocs (deux côtés + linteau)', stats.door.boxes === 3, JSON.stringify(stats.door));
  check('fenêtre : 4 blocs + 1 vitre', stats.win.boxes === 4 && stats.win.panes === 1, JSON.stringify(stats.win));
  const m = await page.evaluate(() => { const d = App.newDoc(); d.items.push({ id: 'w', t: 'wall', a: [0, 0], b: [4, 0], th: 0.2, h: 2.8, layer: 'mur' }); const r = App.buildMesh(d); let top = 0; for (let i = 1; i < r.solid.length; i += 10) top = Math.max(top, r.solid[i]); return { top }; });
  check('hauteur du mur respectée (2,8 m)', Math.abs(m.top - 2.8) < 1e-6, String(m.top));
  check('le calcul du maillage ne modifie pas le plan', await page.evaluate(() => { const before = JSON.stringify(App.doc), d = App.newDoc(); d.items.push({ id: 'w', t: 'wall', a: [0, 0], b: [4, 0], th: 0.2, h: 2.8, layer: 'mur' }); App.buildMesh(d); return JSON.stringify(App.doc) === before && !('len' in d.items[0]); }));
  // empty plan message
  await key('3'); check('mode 3D par le clavier', await page.evaluate(() => App.mode) === '3d'); check('message plan vide', await page.locator('#msg3').isVisible());
  await key('2'); check('retour en 2D', await page.evaluate(() => App.mode) === '2d');
  // real drawing -> 3D
  await key('r'); await click(-3, -2); await click(3, 2); await key('d'); await click(0, -2); await key('f'); await click(3, 0); await key('v');
  await page.click('#mode3'); check('bouton 3D', await page.locator('#cv3').isVisible() && !(await page.locator('#cv').isVisible()));
  check('outils 2D masqués en 3D', !(await page.locator('#tools').isVisible()));
  const cov = await page.evaluate(() => App.v3.coverage()); check('la 3D dessine des pixels', cov > 0.02, String(cov));
  const ms = await page.evaluate(() => App.v3.mesh.stats); check('maillage : 4 murs, 1 vitre', ms.walls === 4 && ms.panes === 1, JSON.stringify(ms));
  // camera
  const box = await page.locator('#cv3').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2, yaw0 = await page.evaluate(() => App.v3.yaw);
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 80, cy + 20, { steps: 4 }); await page.mouse.up();
  check('glisser fait tourner la caméra', Math.abs((await page.evaluate(() => App.v3.yaw)) - yaw0) > 0.3);
  const d0 = await page.evaluate(() => App.v3.dist); await page.mouse.wheel(0, -400); await page.waitForTimeout(100); check('molette : zoom', (await page.evaluate(() => App.v3.dist)) < d0);
  await page.click('#bar3 [data-v=top]'); check('vue de dessus', (await page.evaluate(() => App.v3.pitch)) > 1.5 && (await page.evaluate(() => App.v3.coverage())) > 0.02);
  const [png] = await Promise.all([page.waitForEvent('download'), page.click('#bar3 [data-v=png]')]); check('image PNG de la 3D', png.suggestedFilename().endsWith('-3d.png'));
  // plan change refreshes the 3D
  await page.evaluate(() => App.edit(d => d.items.filter(i => i.t === 'wall').forEach(w => { w.h = 4; })));
  const top = await page.evaluate(() => { App.v3.rebuild(); let t = 0; const s = App.v3.mesh.solid; for (let i = 1; i < s.length; i += 10) t = Math.max(t, s[i]); return t; });
  check('hauteur de mur modifiée : maillage mis à jour', Math.abs(top - 4) < 1e-6, String(top));
  await key('Escape'); check('Échap revient au 2D', await page.evaluate(() => App.mode) === '2d' && (await page.locator('#tools').isVisible()));
  check('plan intact après aller-retour', (await items()).length === 6);
  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  if (process.env.SHOT) { await page.evaluate(() => App.edit(d => d.items.filter(i => i.t === 'wall').forEach(w => { w.h = 2.8; }))); await page.click('#mode3'); await page.waitForTimeout(300); await page.screenshot({ path: process.env.SHOT }); }
  await browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.stack); process.exit(1); });
