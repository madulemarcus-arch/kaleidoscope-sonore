// Reinforcement drawings (Ferraillage mode): bar lengths and weights against hand calculations, drawings, quantities, export.
const { check, launch } = require('./helper');
const near = (a, b, tol) => Math.abs(a - b) <= tol;
(async () => {
  const { browser, page, click, errors } = await launch(), key = k => page.keyboard.press(k);
  // no result yet: help message
  await key('4'); check('mode Ferraillage au clavier', await page.evaluate(() => App.mode) === 'fer');
  check('sans calcul : message et bouton Calculer', /Aucun calcul/.test(await page.textContent('#ferMain')) && await page.locator('#ferCalc').isVisible());
  check('outils 2D masqués', !(await page.locator('#tools').isVisible())); await key('2');
  await key('r'); await click(-3, -2); await click(3, 2); await key('d'); await click(0, -2); await key('f'); await click(3, 0); await key('v');
  await page.evaluate(() => { App.struct.autoColumns(); App.struct.run(); });
  await page.click('#mode4'); check('bouton Ferraillage', await page.locator('#fer').isVisible() && !(await page.locator('#cv').isVisible()));
  const ids = await page.$$eval('#ferList button', b => b.map(x => x.dataset.v));
  check('28 vues : repérage, descente de charges, 6 poutres, 6 poteaux, 6 nœuds, 6 semelles, 1 dalle, métré', ids.length === 28 && ids[0] === 'plan' && ids[1] === 'dc' && ids.filter(i => /^ND-/.test(i)).length === 6 && ids[ids.length - 1] === 'qty', ids.join(','));
  // model against hand calculations (fc28 25, FeE500, cover 3 cm)
  const mdl = await page.evaluate(() => { const m = App.rebar.model(App.doc); return { po: m.beams.find(b => Math.abs(b.L - 3) < 1e-6), p1: m.cols[0], s1: m.foots[0], d1: m.slabs[0], tot: m.totals, ls12: m.ls(12) }; });
  const b0 = mdl.po, last = b0.bars[b0.bars.length - 1];
  const b1 = b0.bars[0], hk = 20 * b1.d / 1000;
  check('poutre : barres inférieures, longueur 3,14 m + 2 crochets de 20 Ø', b1.n >= 2 && near(b1.len, 3.14 + 2 * hk, 1e-6), JSON.stringify(b1));
  check('poutre : poids = n·L·0,00617·Ø²', near(b1.kg, b1.n * b1.len * 0.00617 * b1.d * b1.d, 1e-9));
  check('poutre : cadres HA6, nombre = ⌊portée libre / espacement⌋, 0,78 m chacun', last.n === Math.floor(2.8 / (b0.st / 100)) && near(last.len, 0.78, 1e-6) && last.d === 6, JSON.stringify(last));
  check('poutre : 2HA10 de montage', b0.bars[1].n === 2 && b0.bars[1].d === 10 && near(b0.bars[1].len, 3.54, 1e-6));
  const p1 = mdl.p1;
  check('poteau : barres de 3,11 m (hauteur − enrobage + semelle − 5 cm + équerre 12 Ø)', near(p1.bars[0].len, 2.8 - 0.03 + (0.25 - 0.05) + 0.144, 1e-6) && p1.bars[0].n === 4 && p1.bars[0].d === 12, JSON.stringify(p1.bars[0]));
  check('poteau : cadres HA6 e=15 cm, 20 cadres', p1.st === 15 && p1.nCad === Math.floor(2.8 / 0.15) + 2 && near(p1.bars[1].len, 4 * (0.2 - 0.06) + 0.12, 1e-6));
  const s1 = mdl.s1;
  check('semelle : 2 × n barres avec équerres de 12 Ø', s1.bars[0].n === 2 * s1.n && near(s1.bars[0].len, s1.side - 0.10 + 2 * 12 * s1.d / 1000, 1e-6), JSON.stringify(s1.bars[0]));
  const d1 = mdl.d1;
  check('dalle : nombre de barres = ⌊largeur/espacement⌋ + 1', d1.bars[0].n === Math.floor(6 * 100 / d1.tx.e) + 1 && d1.bars[2].n === Math.floor(4 * 100 / d1.ty.e) + 1 && near(d1.bars[0].len, 4, 1e-9) && near(d1.bars[2].len, 6, 1e-9), JSON.stringify(d1.bars.map(b => b.n)));
  check('dalle : chapeaux de 0,2 de la portée + 15 cm', near(d1.bars[1].len, 0.2 * 4 + 0.15, 1e-9) && near(d1.bars[3].len, 0.2 * 6 + 0.15, 1e-9));
  check('longueur de scellement HA12 ≈ 0,53 m', near(mdl.ls12, 0.529, 0.002), String(mdl.ls12));
  check('béton de dalle : 24 m² × 12 cm = 2,88 m³', near(mdl.tot.slabs.conc, 2.88, 1e-9));
  check('totaux = somme des éléments', await page.evaluate(() => { const m = App.rebar.model(App.doc), sum = a => a.reduce((s, x) => s + x.kg, 0); return Math.abs(m.totals.all.kg - (sum(m.beams) + sum(m.cols) + sum(m.foots) + sum(m.slabs))) < 1e-9 && Math.abs(m.byDiameter.reduce((s, x) => s + x.kg, 0) - m.totals.all.kg) < 1e-6; }));
  const ratio = mdl.tot.all.kg / mdl.tot.all.conc; check('ratio d\'acier plausible (30 à 200 kg/m³)', ratio > 30 && ratio < 200, String(ratio));
  // positions of longitudinal bars in a column section
  const pos = await page.evaluate(() => [4, 6, 8, 10, 12, 16].map(n => { const p = App.rebar.colPositions(n, 0, 1), set = new Set(p.map(q => q.join())); return { n, got: p.length, uniq: set.size, inside: p.every(q => q[0] >= 0 && q[0] <= 1 && q[1] >= 0 && q[1] <= 1) }; }));
  check('section de poteau : n barres distinctes dans le carré (4 à 16)', pos.every(p => p.got === p.n && p.uniq === p.n && p.inside), JSON.stringify(pos));
  // every drawing is a well-formed SVG and the view mode shows it
  const bad = await page.evaluate(() => { const m = App.rebar.model(App.doc), out = [];
    App.rebar.views(m).forEach(v => { const h = App.rebar.viewHTML(App.doc, m, v.id), tmp = document.createElement('div'); tmp.innerHTML = h;
      tmp.querySelectorAll('svg').forEach(s => { const x = new DOMParser().parseFromString(s.outerHTML, 'image/svg+xml'); if (x.querySelector('parsererror') || !s.querySelectorAll('line,path,rect,circle').length) out.push(v.id); });
      if (!tmp.querySelector('svg') && v.id !== 'qty' && v.id !== 'dc') out.push(v.id + ' (sans dessin)'); }); return out; });
  check('28 vues : SVG bien formés et non vides', bad.length === 0, bad.join(','));
  await page.click('#ferList [data-v=PO1]'); check('vue poutre : coupes et tableau', (await page.$$('#ferMain svg')).length === 2 && /Armatures inférieures/.test(await page.textContent('#ferMain')));
  await page.click('#ferList [data-v=P1]'); check('vue poteau', /Armatures longitudinales/.test(await page.textContent('#ferMain')));
  await page.click('#ferList [data-v=S1]'); check('vue semelle', /Aciers de semelle/.test(await page.textContent('#ferMain')));
  await page.click('#ferList [data-v=D1]'); check('vue dalle', /Chapeaux sur appuis/.test(await page.textContent('#ferMain')));
  await page.click('#ferList [data-v=qty]'); check('métré : tableau par ouvrage et par diamètre', /Béton \(m³\)/.test(await page.textContent('#ferMain')) && /HA12/.test(await page.textContent('#ferMain')));
  // export
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#ferExport')]); check('export HTML de tous les plans', dl.suggestedFilename().endsWith('plans-de-ferraillage.html'));
  const doc = await page.evaluate(() => App.rebar.document(App.doc));
  check('document : 29 sections (garde + 28 vues), avertissement ingénieur', (doc.match(/<section>/g) || []).length === 29 && /valider par un ingénieur/.test(doc) && (doc.match(/<svg/g) || []).length >= 25);
  // stale results
  await page.evaluate(() => App.edit(d => { d.items.find(i => i.t === 'col').p = [-3.4, -2]; }));
  check('plan modifié : bandeau « périmés » et bouton Recalculer', /périmés/.test(await page.textContent('#ferMain')) && await page.locator('#ferCalc').isVisible());
  await page.click('#ferCalc'); check('recalcul depuis le mode Ferraillage', !/périmés/.test(await page.textContent('#ferMain')));
  // mode keys
  await key('3'); check('3 : vue 3D depuis le ferraillage', await page.evaluate(() => App.mode) === '3d');
  await key('4'); check('4 : retour au ferraillage', await page.evaluate(() => App.mode) === 'fer');
  await key('Escape'); check('Échap : retour au dessin 2D', await page.evaluate(() => App.mode) === '2d' && await page.locator('#cv').isVisible());
  // phone layout
  await page.setViewportSize({ width: 390, height: 780 }); await page.click('#mode4');
  check('mobile : liste en bandeau, pas de défilement horizontal de la page', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth) && await page.locator('#ferList').isVisible());
  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.stack); process.exit(1); });
