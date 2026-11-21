// Import / export: JSON round trip, DXF structure (mm, layers, wall faces cut by openings), PNG, mobile layout.
const { check, launch } = require('./helper');
(async () => {
  const { browser, page, click, items, errors } = await launch(), key = k => page.keyboard.press(k);
  await key('r'); await click(-3, -2); await click(3, 2); await key('d'); await click(0, -2); await key('c'); await click(-3, -2); await click(3, -2); await click(3, -3);
  const dxf = await page.evaluate(() => App.toDXF());
  check('DXF : sections et fin de fichier', /SECTION\n2\nENTITIES/.test(dxf) && dxf.trim().endsWith('EOF'));
  check('DXF : calque MURS', /\n2\nMURS\n/.test(dxf) && /\n8\nMURS\n/.test(dxf));
  check('DXF : coordonnées en millimètres', /\n11\n3000\n/.test(dxf) || /\n10\n3000\n/.test(dxf));
  check('DXF : cote en texte', /\n1\n6,00 m\n/.test(dxf));
  const walls = (dxf.match(/\n0\nLINE\n/g) || []).length; check('DXF : lignes de murs et d\'ouverture présentes', walls >= 8, String(walls));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => App.exportDXF())]); check('téléchargement .dxf', dl.suggestedFilename().endsWith('.dxf'));
  const [png] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => App.exportPNG())]); check('téléchargement .png', png.suggestedFilename().endsWith('.png'));
  const json = await page.evaluate(() => JSON.stringify(App.doc)); await page.evaluate(() => App.setDoc(App.newDoc())); check('plan vidé', (await items()).length === 0);
  await page.evaluate(j => App.importJSON(j), json); check('import JSON : plan identique', JSON.stringify(await items()) === JSON.stringify(JSON.parse(json).items));
  const bad = await page.evaluate(() => { try { App.importJSON('{"v":2}'); return false; } catch (e) { return true; } }); check('fichier invalide refusé', bad);
  await page.setViewportSize({ width: 390, height: 780 });
  check('mobile : barre d\'outils visible', await page.locator('#tools').isVisible()); check('mobile : pas de défilement horizontal', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.click('#panelBtn'); check('mobile : panneau des calques', await page.locator('#panel').isVisible());
  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.stack); process.exit(1); });
