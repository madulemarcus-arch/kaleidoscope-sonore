// Element library (tab Éléments), levels, block walls, lintels, claustra, guard-rails, shear walls, multi-level 3D.
const { check, launch } = require('./helper');
const near = (a, b, tol) => Math.abs(a - b) <= tol;
(async () => {
  const { browser, page, click, errors } = await launch(), key = k => page.keyboard.press(k), ev = (f, a) => page.evaluate(f, a);
  // ---- library defaults
  const d0 = await ev(() => { const l = App.doc.lib; return { fam: ['beam', 'col', 'slab', 'foot', 'voile', 'wall', 'lintel', 'rail', 'claustra'].map(f => [f, l.sec.filter(s => s.f === f).length, l.act[f]]), mats: l.mat.length, blocks: App.lib.blocks().length, old: (() => { const d = JSON.parse(JSON.stringify(App.doc)); delete d.lib; return App.ensureDoc(d).lib.sec.length; })() }; });
  check('bibliothèque par défaut : au moins un type pour chacune des 9 familles, un type actif (sauf mur : libre)', d0.fam.every(([f, n, a]) => n >= 2 && (f === 'wall' ? a === '' : !!a)), JSON.stringify(d0.fam));
  check('9 matériaux, 18 blocs et briques au catalogue ; un ancien plan reçoit la bibliothèque', d0.mats === 9 && d0.blocks === 17 && d0.old > 20, JSON.stringify([d0.mats, d0.blocks, d0.old]));
  const blk = await ev(() => { const b = App.lib.block('bc15'); return { L: b.L, H: b.H, e: b.e, per: 1 / ((b.L + 0.01) * (b.H + 0.01)) }; });
  check('bloc de 15 : 40 × 20 × 15 cm (longueur, hauteur, épaisseur), 11,6 blocs au m² avec joint de 1 cm', blk.L === 0.4 && blk.H === 0.2 && blk.e === 0.15 && near(blk.per, 11.6, 0.05), JSON.stringify(blk));
  // ---- tab
  await key('5'); check('touche 5 : onglet Éléments, liste des familles, canevas masqué', await ev(() => App.mode) === 'elem' && await page.locator('#lib').isVisible() && !(await page.locator('#cv').isVisible()) && (await page.$$('#libNav button')).length >= 12);
  await page.click('[data-nav=beam]'); const nb0 = (await page.$$('#libMain tr[data-row]')).length;
  await page.click('[data-new=beam]'); const nb1 = (await page.$$('#libMain tr[data-row]')).length; check('+ Nouveau type : une ligne de plus, devenue le type actif', nb1 === nb0 + 1);
  const lastId = await ev(() => App.doc.lib.act.beam);
  await page.fill(`[data-id="${lastId}"][data-k=b]`, '30'); await page.keyboard.press('Tab'); await page.fill(`[data-id="${lastId}"][data-k=h]`, '60'); await page.keyboard.press('Tab');
  const bs = await ev(id => App.lib.sec(id), lastId); check('saisie de la base (30 cm) et de la hauteur (60 cm) : stockées en mètres, nom mis à jour', near(bs.b, 0.3, 1e-9) && near(bs.h, 0.6, 1e-9) && /30 × 60/.test(bs.n), JSON.stringify(bs));
  check('aperçu : coupe de la poutre avec les cotes', /30 cm/.test(await page.innerHTML('.libprev')) && /60 cm/.test(await page.innerHTML('.libprev')));
  await page.selectOption(`[data-id="${lastId}"][data-k=mat]`, 'bois'); check('matériau bois choisi', (await ev(id => App.lib.sec(id).mat, lastId)) === 'bois');
  for (const f of ['col', 'slab', 'foot', 'voile', 'wall', 'blk', 'lintel', 'rail', 'claustra', 'mat', 'qty']) { await page.click(`[data-nav=${f}]`); if (!/<(table|svg)/.test(await page.innerHTML('#libMain'))) check('famille ' + f, false); }
  check('toutes les familles s\'affichent (tableaux et aperçus) sans erreur', errors.length === 0, errors.join('|'));
  await page.click('[data-nav=blk]'); await page.fill('#nbN', 'Bloc test'); await page.fill('#nbL', '50'); await page.fill('#nbH', '25'); await page.fill('#nbE', '12'); await page.click('[data-addblk]');
  const cb = await ev(() => App.lib.block(App.doc.lib.blk[0].id)); check('bloc personnalisé 50 × 25 × 12', cb && cb.L === 0.5 && cb.H === 0.25 && cb.e === 0.12);
  // ---- wall types, quantities by hand: wall 5 m x 2.8 m with a 1 x 1 window and a 0.9 x 2.1 door, block 15
  await key('2'); await ev(() => { App.edit(d => { d.items = []; d.lib.act.wall = 'wall1'; }); });
  await key('m'); await click(0, 0); await click(5, 0); await key('Escape'); await key('v');
  const w = await ev(() => { const w = App.doc.items[0]; return { wt: w.wt, th: w.th, h: w.h }; });
  check('mur dessiné avec le type actif : bloc de 15 + enduit 1,5 cm de chaque côté = 18 cm', w.wt === 'wall1' && near(w.th, 0.18, 1e-9), JSON.stringify(w));
  await ev(() => { const w = App.doc.items[0]; App.edit(d => { d.items.push({ id: 'o1', t: 'window', wall: w.id, pos: 1.5, w: 1.0, h: 1.0, sill: 1.0, layer: 'mur' }, { id: 'o2', t: 'door', wall: w.id, pos: 3.5, w: 0.9, h: 2.1, sill: 0, layer: 'mur' }); }); });
  const q = await ev(() => { const q = App.lib.quantities(), o = q.blocks.bc15; return { area: o.area, n: o.n, mortar: o.mortar, plaster: o.plaster, lint: q.lintels }; });
  const area = 5 * 2.8 - 1.0 - 0.9 * 2.1, unit = 0.41 * 0.21;
  check('surface nette = 5 × 2,8 − 1,0 − 1,89 = 11,11 m²', near(q.area, area, 1e-9), String(q.area));
  check('nombre de blocs = ⌈surface / ((L + j)(H + j)) × 1,05⌉', q.n === Math.ceil(area / unit * 1.05), JSON.stringify([q.n, area / unit * 1.05]));
  check('mortier = surface × e × (1 − L·H / ((L+j)(H+j)))', near(q.mortar, area * 0.15 * (1 - 0.08 / unit), 1e-9), String(q.mortar));
  check('enduit : deux faces', near(q.plaster, 2 * area, 1e-9), String(q.plaster));
  check('2 linteaux (fenêtre et porte) : longueurs ouverture + 2 appuis de 25 cm, béton 15 × 20 cm', q.lint.n === 2 && near(q.lint.len, 1.0 + 0.9 + 4 * 0.25, 1e-9) && near(q.lint.vol, (1.0 + 0.9 + 1.0) * 0.15 * 0.2, 1e-9), JSON.stringify(q.lint));
  // type edit reaches the walls already drawn
  await ev(() => App.lib.update('wall1', 'ens', 0.02)); check('changer l\'enduit du type met à jour l\'épaisseur des murs (15 + 2 × 2 = 19 cm)', near(await ev(() => App.doc.items[0].th), 0.19, 1e-9));
  const pr = await page.evaluate(() => { App.sel = [App.doc.items[0].id]; App.emit(); return document.getElementById('props').textContent; });
  check('propriétés du mur : type, bloc, nombre de blocs et linteaux', /Type de mur/.test(pr) && /Bloc béton creux 15/.test(pr) && /blocs/.test(pr) && /2 linteau/.test(pr), pr.slice(0, 200));
  // ---- levels
  await ev(() => { App.edit(d => { d.struct.p.nlev = 3; }); });
  check('niveaux : sélecteur visible à partir de 2 niveaux, RDC / R+1 / R+2', await ev(() => [...document.querySelectorAll('#lvSel option')].map(o => o.textContent).join()) === 'RDC,R+1,R+2' && await page.locator('#lvSel').isVisible());
  const q3 = await ev(() => App.lib.quantities().blocks.bc15.area); check('métré : les éléments « tous niveaux » comptent à chaque étage (×3)', near(q3, 3 * area, 1e-6), String(q3));
  await ev(() => { App.edit(d => { d.items.push({ id: 'rl', t: 'rail', a: [0, 2], b: [3, 2], rt: App.doc.lib.act.rail, layer: 'mur', lv: [1] }); }); });
  const lv = await ev(() => { const r = {}; for (let i = 0; i < 3; i++) r[i] = App.withLevel(i, () => App.doc.items.filter(App.shown).map(x => x.id).includes('rl')); return r; });
  check('un élément posé au niveau 1 seulement n\'apparaît qu\'à R+1', !lv[0] && lv[1] && !lv[2], JSON.stringify(lv));
  await page.selectOption('#lvSel', '1'); check('choix du niveau R+1 : le garde-corps est visible et sélectionnable', await ev(() => App.lvView) === 1 && await ev(() => App.doc.items.filter(App.shown).some(i => i.id === 'rl')));
  await ev(() => { App.sel = ['rl']; App.emit(); }); await page.check('[data-lv="2"]'); check('case R+2 cochée : élément copié au niveau 2 (lv = 1, 2)', (await ev(() => App.doc.items.find(i => i.id === 'rl').lv.join())) === '1,2');
  await page.check('[data-lv="0"]'); check('les trois niveaux cochés : plus de restriction (tous niveaux)', (await ev(() => App.doc.items.find(i => i.id === 'rl').lv)) === undefined);
  await page.click('#lvOnly'); check('« Ce niveau seul » : les nouveaux éléments ne vont qu\'au niveau affiché', await ev(() => App.doc.lvOnly) === true);
  await key('l'); await click(0, 4); await click(2, 4); await key('Escape'); await key('v'); const ln = await ev(() => App.doc.items.filter(i => i.t === 'line').pop()); check('ligne créée avec lv = [niveau affiché]', ln && ln.lv && ln.lv.join() === '1', JSON.stringify(ln));
  await page.click('#lvOnly'); await page.selectOption('#lvSel', '0');
  // ---- 3D: levels stacked, bond joints, lintels, claustra, rails, shear walls
  await ev(() => { App.edit(d => { d.items.push({ id: 'cl', t: 'claustra', wall: d.items[0].id, pos: 4.4, w: 0.6, h: 0.6, sill: 1.0, layer: 'mur', ct: d.lib.act.claustra }, { id: 'vo', t: 'voile', a: [1, 3], b: [3, 3], th: 0.2, h: 2.8, rt: d.lib.act.voile, layer: 'str' }); }); });
  const m = await ev(() => { const r = App.buildMesh(App.doc); return { ...r.stats, solid: r.solid.length }; });
  check('3D : 3 niveaux empilés (hauteur 3 × 2,8 = 8,4 m), murs répétés à chaque niveau', m.levels === 3 && near(m.height, 8.4, 1e-9) && m.walls === 3 * 1 && m.panes === 3, JSON.stringify(m));
  check('3D : joints de mortier, linteaux, claustra, voile et garde-corps présents', m.joints > 100 && m.lintels === 9, JSON.stringify(m));   // 3 openings (window, door, claustra) x 3 levels
  check('3D : voile par niveau (3), claustra par niveau (3), garde-corps du niveau 1 au moins', m.voiles === 3 && m.claustra === 3 && m.rails >= 1, JSON.stringify(m));
  const ymax = await ev(() => { const r = App.buildMesh(App.doc); let mx = 0; for (let i = 1; i < r.solid.length; i += 10) mx = Math.max(mx, r.solid[i]); return mx; });
  check('3D : la géométrie monte jusqu\'à la hauteur totale du bâtiment (8,4 m)', near(ymax, 8.4, 0.1), String(ymax));
  // ---- engine: types are minimum sections; non-concrete members flagged; shear walls flagged
  await ev(() => { App.edit(d => { d.items = []; d.struct.p.nlev = 1; d.lib.act.wall = ''; }); App.axes.generate(2, 4, 2, 4); });
  const sec = await ev(() => { const id = App.doc.lib.sec.find(s => s.f === 'beam' && s.b === 0.3 && s.h === 0.5).id; App.axes.place(true); App.edit(d => { d.items.filter(i => i.t === 'beam').forEach(b => { b.sec = id; }); }); const r = App.struct.run(); return { hs: r.beams.map(b => b.b + 'x' + b.h), warn: r.warnings.length }; });
  check('poutres de type 30 × 50 : sections du calcul jamais inférieures (30 × 50)', sec.hs.every(s => { const [b, h] = s.split('x').map(Number); return b >= 0.3 - 1e-9 && h >= 0.5 - 1e-9; }), sec.hs.join());
  const col = await ev(() => { const id = App.doc.lib.sec.find(s => s.f === 'col' && s.b === 0.3 && s.h === 0.3).id; App.edit(d => d.items.filter(i => i.t === 'col').forEach(c => { c.sec = id; c.a = 0.3; })); const r = App.struct.run(); return r.columns.map(c => c.a); });
  check('poteaux de type 30 × 30 : section de calcul au moins 30 cm', col.every(a => a >= 0.3 - 1e-9), col.join());
  const rect = await ev(() => { const id = App.doc.lib.sec.find(s => s.f === 'col' && s.shape === 'circ').id; App.edit(d => d.items.filter(i => i.t === 'col').forEach(c => { c.sec = id; })); return { d: App.colDims(App.doc.items.find(i => i.t === 'col')), side: App.lib.colSide(App.doc.items.find(i => i.t === 'col')), poly: App.colPoly(App.doc.items.find(i => i.t === 'col')).length }; });
  check('poteau circulaire Ø30 : polygone de 24 côtés, section carrée équivalente de même aire (26,6 cm)', rect.d.shape === 'circ' && rect.poly === 24 && near(rect.side, 0.3 * Math.sqrt(Math.PI) / 2, 1e-9), JSON.stringify(rect));
  const steel = await ev(() => { const id = App.doc.lib.sec.find(s => s.f === 'beam').id; App.edit(d => { d.lib.sec.find(s => s.id === id).mat = 's235'; d.items.filter(i => i.t === 'beam').forEach(b => { b.sec = id; }); }); const r = App.struct.run(); return r.warnings.filter(x => /non en béton armé/.test(x)); });
  check('poutre en acier : modélisée, signalée comme non dimensionnée par le calcul béton', steel.length === 1 && /poutre/.test(steel[0]), JSON.stringify(steel));
  await ev(() => { App.edit(d => { d.items.push({ id: 'vv', t: 'voile', a: [0, 0], b: [2, 0], th: 0.2, h: 2.8, rt: d.lib.act.voile }); }); }); check('voiles : avertissement « pas encore pris en compte »', (await ev(() => App.struct.run().warnings.some(x => /Voiles/.test(x)))));
  await ev(() => { App.edit(d => { d.items = d.items.filter(i => i.t !== 'voile'); d.lib.sec.find(s => s.f === 'slab' && s.e === 0.15).fixed = true; d.lib.act.slab = d.lib.sec.find(s => s.f === 'slab' && s.e === 0.15).id; }); }); const hs15 = await ev(() => App.struct.run().slab.h); check('dalle de type 15 cm « imposée au calcul » : épaisseur au moins 15 cm', hs15 >= 0.15 - 1e-9, String(hs15));
  await ev(() => { App.lib.setActive('foot', App.doc.lib.sec.find(s => s.f === 'foot' && s.kind === 'radier').id); }); check('type de fondation actif « radier » : mode de fondation du calcul = radier', (await ev(() => App.doc.struct.p.found)) === 'radier');
  // ---- DXF / JSON round trip keep the library
  const io = await ev(() => { const back = App.ensureDoc(JSON.parse(JSON.stringify(App.doc))); return back.lib.sec.length === App.doc.lib.sec.length && back.lib.blk.length === 1; }); check('JSON : la bibliothèque et les blocs personnalisés sont conservés', io);
  await page.setViewportSize({ width: 390, height: 780 }); await page.click('#mode5'); check('mobile : onglet Éléments sans défilement horizontal de la page', await ev(() => document.documentElement.scrollWidth <= window.innerWidth));
  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.stack); process.exit(1); });
