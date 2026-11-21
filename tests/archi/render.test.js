// Rendering (step 3): furniture, materials, roof, sun and shadows, old plans, HD picture.
const { check, launch } = require('./helper');
(async () => {
  const { browser, page, click, items, errors } = await launch(), key = k => page.keyboard.press(k);
  // old plan without rendering settings is upgraded
  const up = await page.evaluate(() => { const d = { v: 1, name: 'Ancien', active: 'mur', layers: [{ id: 'mur', name: 'Murs', color: '#fff', on: true, lock: false }], items: [] }; App.setDoc(App.ensureDoc(d)); return { r: App.doc.render.roof, lay: App.doc.layers.some(l => l.id === 'meu') }; });
  check('ancien plan complété (rendu + calque Mobilier)', up.r === 'none' && up.lay);
  await page.evaluate(() => App.setDoc(App.newDoc()));
  // room + furniture
  await key('r'); await click(-3, -2); await click(3, 2);
  await key('u'); check('outil Meuble : sélecteur visible', await page.locator('#furnSel').isVisible());
  await page.selectOption('#furnSel', 'table'); await click(0, 0); await page.selectOption('#furnSel', 'lit'); await key('x'); await click(-2, 1);
  let it = await items(); const table = it.find(i => i.kind === 'table'), bed = it.find(i => i.kind === 'lit');
  check('meubles posés sur le calque Mobilier', !!table && !!bed && table.layer === 'meu' && bed.layer === 'meu', JSON.stringify(it.slice(4)));
  check('dimensions du catalogue', table.w === 1.4 && table.d === 0.8 && table.h === 0.75 && bed.rot === 90);
  await key('v'); await click(0, 0); check('meuble sélectionnable', (await page.evaluate(() => App.sel.length)) === 1 && (await page.evaluate(() => App.item(App.sel[0]).kind)) === 'table');
  await page.fill('#props input[type=number] >> nth=3', '45'); await page.locator('#props input[type=number] >> nth=3').dispatchEvent('change');
  check('rotation par le panneau', (await items()).find(i => i.kind === 'table').rot === 45);
  // meshes
  const st = await page.evaluate(() => { const r = App.buildMesh(App.doc); return { stats: r.stats, base: r.base.length, solid: r.solid.length }; });
  check('maillage : 2 meubles', st.stats.furn === 2, JSON.stringify(st.stats)); check('maillage : sol et terrain', st.base > 0);
  const col = await page.evaluate(() => { const d = JSON.parse(JSON.stringify(App.doc)); d.render.wallMat = 'brique'; d.items.filter(i => i.t === 'wall')[0].mat = 'bleu'; const r = App.buildMesh(d), s = r.solid, seen = new Set(); for (let i = 0; i < s.length; i += 10) seen.add([s[i + 6], s[i + 7], s[i + 8]].map(v => v.toFixed(2)).join()); return [...seen]; });
  check('matériau par défaut et matériau d\'un mur', col.includes('0.70,0.34,0.26') && col.includes('0.35,0.55,0.75'), col.join(' | '));
  // roof
  const roofs = await page.evaluate(() => { const out = {}; for (const t of ['none', 'flat', 'gable']) { const d = JSON.parse(JSON.stringify(App.doc)); d.render.roof = t; d.render.slope = 30; d.render.over = 0.4; const r = App.buildMesh(d); let top = 0; for (let i = 1; i < r.solid.length; i += 10) top = Math.max(top, r.solid[i]); out[t] = { roof: r.stats.roof, top }; } return out; });
  check('sans toiture : hauteur des murs', roofs.none.roof === 'none' && Math.abs(roofs.none.top - 2.8) < 1e-6, JSON.stringify(roofs.none));
  check('toit plat : dalle de 20 cm', roofs.flat.roof === 'flat' && Math.abs(roofs.flat.top - 3.0) < 1e-6, JSON.stringify(roofs.flat));
  const rise = Math.tan(30 * Math.PI / 180) * 2.1; // half of the 4,2 m outer width check('deux pentes : faîtage à la bonne hauteur', roofs.gable.roof === 'gable' && Math.abs(roofs.gable.top - (2.8 + rise)) < 1e-4, JSON.stringify(roofs.gable) + ' attendu ' + (2.8 + rise));
  // sun
  const sun = await page.evaluate(() => ({ am: App.sunAt(7).dir, noon: App.sunAt(12).dir, pm: App.sunAt(17).dir }));
  check('soleil : levant à l\'est, couchant à l\'ouest, haut à midi', sun.am[0] > 0.3 && sun.pm[0] < -0.3 && sun.noon[1] > 0.9 && Math.abs(sun.noon[0]) < 0.05, JSON.stringify(sun));
  // 3D rendering with and without shadows
  await page.click('#mode3'); check('panneau de rendu visible en 3D', await page.locator('#panel3').isVisible());
  await page.evaluate(() => App.edit(d => { d.render.roof = 'none'; d.render.hour = 15; d.render.shadows = false; })); const noSh = await page.evaluate(() => App.v3.coverage());
  await page.evaluate(() => App.edit(d => { d.render.shadows = true; })); const sh = await page.evaluate(() => App.v3.coverage());
  check('la 3D dessine les meubles et le sol', noSh > 0.1, String(noSh)); 
  await page.click('#bar3 [data-v=top]');
  const diff = await page.evaluate(() => { const gl = App.v3.gl, w = App.v3.cv.width, h = App.v3.cv.height, grab = on => { App.doc.render.shadows = on; App.v3.render(); const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
    const a = grab(false), b = grab(true); let n = 0, darker = 0; for (let i = 0; i < a.length; i += 4) { const d = a[i] + a[i + 1] + a[i + 2] - b[i] - b[i + 1] - b[i + 2]; if (d !== 0) n++; if (d > 30) darker++; } return { n, darker, total: w * h }; });
  check('ombres portées : une zone assombrie au sol', diff.darker > 500 && diff.darker < diff.total * 0.5, JSON.stringify(diff));
  // panel controls
  await page.selectOption('#panel3 [data-k=roof]', 'gable'); check('toiture par le panneau', (await page.evaluate(() => App.doc.render.roof)) === 'gable' && (await page.evaluate(() => { App.v3.render(); return App.v3.mesh.stats.roof; })) === 'gable');
  await page.selectOption('#panel3 [data-k=wallMat]', 'brique'); check('matériau des murs par le panneau', (await page.evaluate(() => App.doc.render.wallMat)) === 'brique');
  await page.locator('#panel3 [data-k=hour]').fill('9'); check('heure par le curseur', (await page.evaluate(() => App.doc.render.hour)) === 9 && (await page.textContent('#hourTxt')).startsWith('9 h'));
  await page.uncheck('#panel3 [data-k=shadows]'); check('ombres désactivables', (await page.evaluate(() => App.doc.render.shadows)) === false);
  // HD picture is twice the screen size
  const dim = await page.evaluate(() => new Promise(ok => { const w = App.v3.cv.width; App.v3.snapshot(2, b => { const im = new Image(); im.onload = () => ok({ w, got: im.width, back: App.v3.cv.width }); im.src = URL.createObjectURL(b); }); }));
  check('image HD : 2 x la taille de l\'écran', dim.got === dim.w * 2 && dim.back === dim.w, JSON.stringify(dim));
  // DXF + persistence of the render settings
  await key('Escape'); const dxf = await page.evaluate(() => App.toDXF()); check('DXF : meubles (contour + nom)', /MOBILIER/.test(dxf) && /\n1\nTable\n/.test(dxf));
  await page.reload(); await page.waitForSelector('html[data-ready="1"]'); check('réglages de rendu restaurés', (await page.evaluate(() => App.doc.render.roof)) === 'gable' && (await page.evaluate(() => App.doc.render.wallMat)) === 'brique');
  // mobile: render panel opens from the 3D bar
  await page.setViewportSize({ width: 390, height: 780 }); await page.click('#mode3'); check('mobile : panneau de rendu fermé au départ', !(await page.locator('#panel3').isVisible()));
  await page.click('#bar3 [data-v=panel]'); check('mobile : bouton Rendu ouvre le panneau', await page.locator('#panel3').isVisible());
  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.stack); process.exit(1); });
