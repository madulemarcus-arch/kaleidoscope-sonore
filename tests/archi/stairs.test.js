// Stairs: geometry against hand calculations, the Escalier tab, placement on levels, 2D / 3D / DXF.
const { check, launch } = require('./helper');
const near = (a, b, tol) => Math.abs(a - b) <= tol;
(async () => {
  const { browser, page, click, errors } = await launch(), key = k => page.keyboard.press(k), ev = (f, a) => page.evaluate(f, a);
  // ---- geometry by hand: H = 2,80 m, h = 17 cm -> 16 risers of 17,5 cm, 15 treads, giron 28 cm, width 1 m
  const g = await ev(() => { const S = App.stairs, D = S.defaults(), c = k => S.calc(Object.assign({}, D, { kind: k })); const d = c('droit'), p = c('palier'), q = c('quart'), u = c('demi'), b = c('quartbal'), m = S.calc(Object.assign({}, D, { kind: 'quart', turn: 'd' }));
    return { d: { n: d.n, hr: d.hr, M: d.M, bl: d.blondel, L: d.L, W: d.Wd, sl: d.slope * 180 / Math.PI, pail: d.pail, vol: d.vol, z: d.steps.map(s => s.z), msgs: d.msgs }, p: { f: p.flights, L: p.L, W: p.Wd, k: p.steps.filter(s => s.kind === 'landing').length }, q: { f: q.flights, L: q.L, W: q.Wd }, u: { f: u.flights, L: u.L, W: u.Wd }, b: { f: b.flights, kw: b.kw, w: b.steps.filter(s => s.kind === 'winder').length, M: b.M, winG: b.winG }, m: { v0: m.bb.v0, v1: m.bb.v1 } }; });
  check('droit : 16 contremarches de 17,5 cm, 15 marches, formule de Blondel 2h + g = 63 cm', g.d.n === 16 && near(g.d.hr, 0.175, 1e-12) && g.d.M === 15 && near(g.d.bl, 0.63, 1e-12) && g.d.msgs.some(m => m[0] === 'ok' && /63 cm/.test(m[1])), JSON.stringify(g.d));
  check('droit : longueur 15 × 28 = 4,20 m, largeur 1 m, pente atan(17,5/28) = 32,0°', near(g.d.L, 4.2, 1e-9) && near(g.d.W, 1, 1e-9) && near(g.d.sl, 32.005, 0.01), JSON.stringify([g.d.L, g.d.W, g.d.sl]));
  check('droit : la marche i est à la cote i × h (la dernière, 15 × 17,5 = 2,625 m, sous le palier haut)', near(g.d.z[0], 0.175, 1e-12) && near(g.d.z[14], 2.625, 1e-12) && g.d.z.length === 15);
  check('longueur de paillasse = √((15·g)² + (15·h)²) = 4,95 m', near(g.d.pail[0], Math.hypot(15 * 0.28, 15 * 0.175), 1e-9), String(g.d.pail[0]));
  const vol = 15 * 0.28 * (0.15 / (0.28 / Math.hypot(0.28, 0.175)) + 0.175 / 2); check('volume de béton = Σ aire × (épaisseur verticale de paillasse + h/2) = 1,11 m³', near(g.d.vol, vol, 1e-9) && near(vol, 1.110, 0.005), JSON.stringify([g.d.vol, vol]));
  check('palier : 7 + palier + 7 marches (7 + 1 + 7 = 15), longueur 7 × 0,28 + 1 + 7 × 0,28 = 4,92 m', g.p.f.join() === '7,7' && g.p.k === 1 && near(g.p.L, 4.92, 1e-9) && near(g.p.W, 1, 1e-9), JSON.stringify(g.p));
  check('quart tournant : emprise 7 × 0,28 + 1 = 2,96 m dans les deux sens', g.q.f.join() === '7,7' && near(g.q.L, 2.96, 1e-9) && near(g.q.W, 2.96, 1e-9), JSON.stringify(g.q));
  check('demi-tournant : jour de 10 cm, emprise 2,96 × (2 × 1 + 0,1) = 2,10 m', g.u.f.join() === '7,7' && near(g.u.L, 2.96, 1e-9) && near(g.u.W, 2.1, 1e-9), JSON.stringify(g.u));
  check('quart balancé : 6 marches, 3 balancées, 6 marches (6 + 3 + 6 = 15) ; giron à la ligne de foulée (w/2)·(π/2/3) = 26,2 cm', g.b.f.join() === '6,6' && g.b.kw === 3 && g.b.w === 3 && near(g.b.winG, 0.5 * Math.PI / 6, 1e-9), JSON.stringify(g.b));
  check('tourne à droite : la 2e volée part du côté opposé (v de −1,96 à 1)', near(g.m.v0, -1.96, 1e-9) && near(g.m.v1, 1, 1e-9), JSON.stringify(g.m));
  const wr = await ev(() => { const S = App.stairs, it = { p: [2, 3], rot: 90, par: S.defaults() }, W = S.world(it, S.calc(it.par)); return { p0: W.path[0], p1: W.path[W.path.length - 1] }; });
  check('placement : départ local (0 ; 0,5) avec rotation 90° en (2 ; 3) → (1,5 ; 3), arrivée à (1,5 ; 7,2)', near(wr.p0[0], 1.5, 1e-9) && near(wr.p0[1], 3, 1e-9) && near(wr.p1[0], 1.5, 1e-9) && near(wr.p1[1], 7.2, 1e-9), JSON.stringify(wr));
  const w = await ev(() => { const S = App.stairs, D = S.defaults(), bad = S.calc(Object.assign({}, D, { g: 0.35 })), narrow = S.calc(Object.assign({}, D, { w: 0.7 })), thin = S.calc(Object.assign({}, D, { ep: 0.1 })), tight = S.calc(Object.assign({}, D, { kind: 'quartbal', w: 0.8 })); return { bad: bad.msgs.filter(m => m[0] === 'warn').map(m => m[1]), narrow: narrow.msgs.filter(m => m[0] === 'warn').length, thin: thin.msgs.some(m => /12 cm/.test(m[1])), tight: tight.winG, tm: tight.msgs.some(m => /balancées/.test(m[1])) }; });
  check('giron de 35 cm : Blondel 70 cm hors plage et giron hors plage signalés', w.bad.some(m => /Blondel/.test(m)) && w.bad.some(m => /Giron/.test(m)), JSON.stringify(w.bad));
  check('emmarchement 70 cm et paillasse de 10 cm signalés', w.narrow >= 1 && w.thin);
  check('marches balancées trop étroites à la ligne de foulée (w = 80 cm : 20,9 cm < 22) signalées', near(w.tight, 0.4 * Math.PI / 6, 1e-9) && w.tm);
  // ---- the tab
  await ev(() => { App.edit(d => { d.struct.p.nlev = 3; [[0, 0, 6, 0], [6, 0, 6, 5], [6, 5, 0, 5], [0, 5, 0, 0]].forEach(([a, b, c, e]) => d.items.push({ id: App.uid(), t: 'wall', a: [a, b], b: [c, e], th: 0.2, h: 2.8, layer: 'mur' })); }); App.fitView(); });
  await key('6'); check('touche 6 : onglet Escalier, formulaire et résultats', await ev(() => App.mode) === 'stairs' && await page.locator('#stairs').isVisible() && /contremarches/.test(await page.textContent('#stairs')) && !(await page.locator('#cv').isVisible()));
  check('résultats initiaux : 16 contremarches, 17,50 cm, Blondel conforme', /16 contremarches/.test(await page.textContent('.stm')) && /17,50 cm/.test(await page.textContent('.stm')) && /conforme/.test(await page.textContent('.stm')));
  check('aperçus : plan numéroté et coupe en SVG', (await page.$$('.stm svg')).length === 2 && /Coupe de la première volée/.test(await page.innerHTML('.stm')));
  await page.selectOption('#stairs [data-k=kind]', 'quartbal'); check('type quart balancé : champ des marches balancées visible et résultat « dont 3 balancées »', await page.locator('#stairs [data-k=k]').isVisible() && /dont 3 balancées/.test(await page.textContent('.stm')));
  await page.selectOption('#stairs [data-k=kind]', 'droit'); check('type droit : plus de champ de palier ni de balancées', !(await page.locator('#stairs [data-k=k]').isVisible()) && !(await page.locator('#stairs [data-k=lp]').isVisible()));
  await page.fill('#stairs [data-k=g]', '35'); await page.keyboard.press('Tab'); check('giron 35 cm : alerte Blondel dans les résultats', /Blondel/.test(await page.textContent('.stm')) && /70 cm/.test(await page.textContent('.stm')));
  await page.fill('#stairs [data-k=g]', '28'); await page.keyboard.press('Tab');
  await page.selectOption('#stairs [data-k=mat]', 'bois'); check('matériau bois : la ligne de béton disparaît', !/Béton \(marches/.test(await page.textContent('.stm')) && !(await page.locator('#stairs [data-k=ep]').isVisible()) && await page.locator('#stairs [data-k=th]').isVisible());
  await page.selectOption('#stairs [data-k=mat]', 'beton');
  // levels + validation
  await page.selectOption('#stairs [data-k=kind]', 'quart'); await page.fill('#stairs [data-k=x]', '0.5'); await page.keyboard.press('Tab'); await page.fill('#stairs [data-k=y]', '0.5'); await page.keyboard.press('Tab');
  check('niveaux desservis : RDC → R+1 et R+1 → R+2 (le dernier niveau n\'en dessert pas)', (await page.$$('[data-lvs]')).length === 2);
  await page.click('[data-act=ok]'); check('Valider et placer : l\'escalier est créé, on passe au plan 2D', await ev(() => App.mode) === '2d' && (await ev(() => App.doc.items.filter(i => i.t === 'stair').length)) === 1);
  const st = await ev(() => { const s = App.doc.items.find(i => i.t === 'stair'); return { p: s.p, lv: s.lv, kind: s.par.kind, sel: App.sel.join() === s.id }; });
  check('escalier posé en (0,5 ; 0,5), paramètres conservés, sélectionné, au niveau 0 seulement par défaut (lv = [0])', near(st.p[0], 0.5, 1e-9) && near(st.p[1], 0.5, 1e-9) && st.kind === 'quart' && st.lv.join() === '0' && st.sel, JSON.stringify(st));
  // copy over the other level: tick R+1 in the properties
  const pr = await page.textContent('#props'); check('propriétés : résumé de l\'escalier et bouton de modification', /contremarches/.test(pr) && /Modifier dans l'onglet Escalier/.test(pr), pr.slice(0, 160));
  await page.check('[data-lv="1"]'); check('copie par translation : cocher R+1 pose l\'escalier aussi au niveau 1 (lv = 0, 1)', (await ev(() => App.doc.items.find(i => i.t === 'stair').lv.join())) === '0,1');
  const vis = await ev(() => { const r = []; for (let i = 0; i < 3; i++) r.push(App.withLevel(i, () => App.doc.items.some(x => x.t === 'stair' && App.shown(x)))); return r; });
  check('visible aux niveaux 0 et 1, pas au 2 ; le niveau 2 reçoit la trémie du niveau 1', vis.join() === 'true,true,false' && await ev(() => App.atLevel(App.doc.items.find(i => i.t === 'stair'), 1)));
  await page.selectOption('#lvSel', '1'); await page.waitForTimeout(50); check('affichage du niveau R+1 : l\'escalier est sélectionnable', await ev(() => App.hit([1.2, 0.8], 0.1)) === await ev(() => App.doc.items.find(i => i.t === 'stair').id));
  await page.selectOption('#lvSel', '0');
  const hit = await ev(() => ({ inside: !!App.hit([0.8, 0.7], 0.05), out: App.hit([5, 4], 0.05) })); check('sélection par clic dans une marche ; rien en dehors', hit.inside && !hit.out, JSON.stringify(hit));
  // ---- edit in the tab
  const id0 = await ev(() => App.doc.items.find(i => i.t === 'stair').id); await ev(() => { App.sel = [App.doc.items.find(i => i.t === 'stair').id]; App.emit(); }); await page.click('#props button:has-text("Modifier")');
  check('Modifier : retour dans l\'onglet Escalier avec les paramètres de cet escalier', await ev(() => App.mode) === 'stairs' && (await page.inputValue('#stairs [data-k=kind]')) === 'quart' && (await page.inputValue('#stairs [data-k=x]')) === '0.5');
  await page.fill('#stairs [data-k=g]', '30'); await page.keyboard.press('Tab'); await page.click('[data-act=ok]');
  const ed = await ev(() => ({ n: App.doc.items.filter(i => i.t === 'stair').length, id: App.doc.items.find(i => i.t === 'stair').id, g: App.doc.items.find(i => i.t === 'stair').par.g })); check('valider les modifications met à jour le même escalier (giron 30 cm)', ed.n === 1 && ed.id === id0 && near(ed.g, 0.3, 1e-9), JSON.stringify(ed));
  // ---- tool: place with the mouse, rotate with X
  await key('Escape'); await key('e'); check('touche E : outil Escalier avec aperçu', await ev(() => App.tool) === 'stair');
  await page.mouse.move(...(await ev(() => { const b = document.getElementById('cv').getBoundingClientRect(); return [b.x + 400, b.y + 300]; }))); await key('x'); check('X tourne l\'escalier de 90° avant de le poser', await ev(() => App.stairRot) === 90);
  await click(3, 1); const n2 = await ev(() => App.doc.items.filter(i => i.t === 'stair').length); const s2 = await ev(() => App.doc.items.filter(i => i.t === 'stair').pop()); check('clic : un deuxième escalier, tourné de 90°, aux niveaux de l\'onglet', n2 === 2 && s2.rot === 90 && near(s2.p[0], 3, 0.3), JSON.stringify([n2, s2.rot, s2.p]));
  await key('v'); await ev(() => { App.edit(d => { d.items = d.items.filter(i => i.id === (d.items.find(x => x.t === 'stair') || {}).id || i.t !== 'stair'); }); });
  // ---- 3D: stacked at each level, openings in the floor slabs
  const m3 = await ev(() => { const r = App.buildMesh(App.doc); return { stairs: r.stats.stairs, pieces: r.stats.slabPieces, solid: r.solid.length }; });
  check('3D : escalier aux niveaux 0 et 1 (2 occurrences), trémie dans les planchers de R+1 et R+2 (4 morceaux chacun)', m3.stairs === 2 && m3.pieces === 8, JSON.stringify(m3));
  const m0 = await ev(() => { App.edit(d => { d.items = d.items.filter(i => i.t !== 'stair'); }); const r = App.buildMesh(App.doc); return { stairs: r.stats.stairs, pieces: r.stats.slabPieces || 0, solid: r.solid.length }; });
  check('sans escalier : planchers pleins (1 morceau par niveau, soit 2) et moins de géométrie', m0.stairs === 0 && m0.pieces === 2 && m0.solid < m3.solid, JSON.stringify(m0));
  for (const mat of ['bois', 'metal', 'beton']) for (const kind of ['droit', 'palier', 'quart', 'demi', 'quartbal']) { const r = await ev(([mat, kind]) => { const P = Object.assign(App.stairs.defaults(), { mat, kind, lv: [0, 1] }); App.stairs.place(P, [1, 1], true); const x = App.buildMesh(App.doc); const ok = x.stats.stairs >= 2 && x.solid.every ? true : true; App.edit(d => { d.items = d.items.filter(i => i.t !== 'stair'); }); return x.stats.stairs; }, [mat, kind]); if (r < 2) check('3D ' + mat + ' ' + kind, false, String(r)); }
  check('3D : les 15 combinaisons matériau × type se construisent sans erreur', errors.length === 0, errors.join('|'));
  // ---- exports, calculation notice, delete
  await ev(() => { App.stairs.place(Object.assign(App.stairs.defaults(), { kind: 'palier', lv: [0] }), [1, 1], true); App.axes.generate(2, 4, 2, 4); App.axes.place(true); App.struct.run(); });
  const dxf = await ev(() => App.toDXF()), warn = await ev(() => App.doc.struct.result.warnings.filter(x => /Escalier/.test(x)));
  check('DXF : marches et ligne de montée de l\'escalier en lignes', (dxf.match(/\nLINE\n/g) || []).length > 60, String((dxf.match(/\nLINE\n/g) || []).length));
  check('calcul : avertissement sur les escaliers non pris en compte', warn.length === 1 && /trémies/.test(warn[0]), JSON.stringify(warn));
  await ev(() => { App.stairs.edit(App.doc.items.find(i => i.t === 'stair').id); }); await page.click('[data-act=del]'); check('Supprimer cet escalier', (await ev(() => App.doc.items.filter(i => i.t === 'stair').length)) === 0);
  await page.setViewportSize({ width: 390, height: 780 }); await page.click('#mode6'); check('mobile : onglet Escalier sans défilement horizontal', await ev(() => document.documentElement.scrollWidth <= window.innerWidth));
  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.stack); process.exit(1); });
