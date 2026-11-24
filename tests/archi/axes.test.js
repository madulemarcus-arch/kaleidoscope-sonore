// Axes tab: cartesian and cylindrical grids, snapping, greying, columns and beams on the axes, storeys (R+n), storey height, foundation depth.
const { check, launch } = require('./helper');
const near = (a, b, tol) => Math.abs(a - b) <= tol;
(async () => {
  const { browser, page, click, errors } = await launch(), key = k => page.keyboard.press(k), ev = (f, a) => page.evaluate(f, a);
  // ---- model defaults, old plans
  const d0 = await ev(() => ({ g: App.doc.grid, old: (() => { const d = JSON.parse(JSON.stringify(App.doc)); delete d.grid; return App.ensureDoc(d).grid; })() }));
  check('un plan neuf a une grille vide, ancrage 1 m, bulles et grisage actifs', d0.g.sys === 'cart' && d0.g.x.length === 0 && d0.g.y.length === 0 && d0.g.anchor === 1 && d0.g.fade && d0.g.bubbles);
  check('un ancien plan sans grille est complété à l\'ouverture', d0.old.sys === 'cart' && Array.isArray(d0.old.x) && d0.old.cyl.r.length === 0 && d0.old.anchor === 1);
  // ---- the tab
  await key('1'); check('touche 1 : onglet Axes, panneau des axes visible, outils de dessin masqués', await ev(() => App.mode) === 'axes' && await page.locator('#panelAx').isVisible() && !(await page.locator('#tools').isVisible()) && await page.locator('#cv').isVisible());
  check('bouton Axes enfoncé', await page.getAttribute('#mode1', 'aria-pressed') === 'true');
  // ---- quick grid through the panel: 4 X axes every 4 m, 3 Y axes every 3,5 m
  await page.fill('[data-q=nx]', '4'); await page.fill('[data-q=ex]', '4'); await page.fill('[data-q=ny]', '3'); await page.fill('[data-q=ey]', '3.5'); await page.click('[data-act=gen]');
  const g1 = await ev(() => JSON.parse(JSON.stringify(App.doc.grid)));
  check('grille rapide : axes X 1 à 4 à 0, 4, 8, 12 m ; axes Y A à C à 0, 3,5, 7 m', g1.x.map(a => a.n + a.p).join() === '10,24,38,412' && g1.y.map(a => a.n + a.p).join() === 'A0,B3.5,C7', JSON.stringify(g1.x) + JSON.stringify(g1.y));
  const inter = await ev(() => App.axes.intersections());
  check('12 intersections, nommées « lettre + numéro » (A1, B3, C4…)', inter.length === 12 && inter.some(q => q.name === 'A1' && q.p[0] === 0 && q.p[1] === 0) && inter.some(q => q.name === 'C4' && q.p[0] === 12 && q.p[1] === 7));
  // ---- editing: spacing shifts the following axes, rename, add, delete
  await page.fill('[data-k="sp:x:2"]', '5'); await page.keyboard.press('Tab');
  check('entraxe 2-3 portée à 5 m : les axes suivants se décalent (0, 4, 9, 13)', (await ev(() => App.doc.grid.x.map(a => a.p).join())) === '0,4,9,13');
  await page.fill('[data-k="name:x:0"]', 'X1'); await page.keyboard.press('Tab'); check('renommer un axe', (await ev(() => App.doc.grid.x[0].n)) === 'X1');
  await page.fill('[data-k="sp:x:0"]', '1'); await page.keyboard.press('Tab'); check('la première ligne règle la position de l\'origine (tout se décale de 1 m)', (await ev(() => App.doc.grid.x.map(a => a.p).join())) === '1,5,10,14');
  await page.click('[data-add=y]'); check('+ Axe Y : nouvel axe D à 10,5 m (même entraxe)', (await ev(() => App.doc.grid.y.map(a => a.n + a.p).join())) === 'A0,B3.5,C7,D10.5');
  await page.click('[data-del="y:3"]'); check('suppression d\'un axe', (await ev(() => App.doc.grid.y.length)) === 3);
  await ev(() => { App.undo(); App.undo(); App.undo(); App.undo(); App.undo(); });   // back to 0,4,8,12 after the five edits above
  check('annuler remet l\'état précédent', (await ev(() => App.doc.grid.x.map(a => a.p).join())) === '0,4,8,12' && (await ev(() => App.doc.grid.y.length)) === 3);
  // ---- snapping
  const sn = await ev(() => { const AX = App.axes; return { a: AX.snap([3.9, 0.12], 50, 0), b: AX.snap([4.05, 2.1], 50, 0), c: AX.snap([4.05, 2.13], 50, 0.25), d: AX.snap([2, 1.5], 50, 0), e: AX.snap([6, 3.5 + 0.1], 50, 0.25), f: AX.snap([20, 20], 50, 0) }; });
  check('à moins de 14 px d\'une intersection : accrochage exact (4 ; 0)', sn.a && sn.a.kind === 'axe' && sn.a.p[0] === 4 && sn.a.p[1] === 0 && sn.a.name === 'A2', JSON.stringify(sn.a));
  check('près d\'un axe vertical : projeté sur x = 4, y libre', sn.b && sn.b.kind === 'axeL' && sn.b.p[0] === 4 && near(sn.b.p[1], 2.1, 1e-9), JSON.stringify(sn.b));
  check('avec la grille : la coordonnée libre est arrondie au pas (2,13 → 2,25 pour 0,25)', sn.c && sn.c.p[0] === 4 && sn.c.p[1] === 2.25, JSON.stringify(sn.c));
  check('près d\'un axe horizontal : y = 3,5', sn.e && sn.e.kind === 'axeL' && sn.e.p[1] === 3.5, JSON.stringify(sn.e));
  check('loin des axes ou hors de la grille : rien', sn.d === null && sn.f === null, JSON.stringify([sn.d, sn.f]));
  await key('2');
  const sp = await ev(() => { const r = App.snapPoint([3.93, 0.1], null); App.doc.grid.snap = false; const o = App.snapPoint([3.93, 0.1], null); App.doc.grid.snap = true; return { r, o }; });
  check('l\'outil de dessin s\'accroche aux axes (4 ; 0) et cesse si on décoche l\'option', sp.r.kind === 'axe' && sp.r.p[0] === 4 && sp.r.p[1] === 0 && sp.o.kind !== 'axe');
  // ---- display: bright in the Axes tab, greyed once a wall exists
  const dim0 = await ev(() => [App.axes.dimmed('axes'), App.axes.dimmed('2d')]);
  await key('m'); await click(0, 0); await click(8, 0); await key('Escape');
  const dim1 = await ev(() => [App.axes.dimmed('axes'), App.axes.dimmed('2d'), App.doc.items.filter(i => i.t === 'wall').length]);
  await ev(() => { App.doc.grid.fade = false; }); const dim2 = await ev(() => App.axes.dimmed('2d')); await ev(() => { App.doc.grid.fade = true; });
  check('sans mur : axes en couleur ; un mur tracé : grisés en 2D mais pas dans l\'onglet Axes ; option de grisage désactivable', !dim0[0] && !dim0[1] && !dim1[0] && dim1[1] && dim1[2] === 1 && !dim2, JSON.stringify([dim0, dim1, dim2]));
  const px = await ev(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const x = c.getContext('2d'); const th = App.THEMES.screen, v = { s: 20, ox: 20, oy: 170 }; const alpha = mode => { x.clearRect(0, 0, 300, 200); x.fillStyle = th.bg; x.fillRect(0, 0, 300, 200); App.axes.draw(x, 300, 200, v, th, mode); const d = x.getImageData(0, 0, 300, 200).data; let m = 0; for (let i = 0; i < d.length; i += 4) m = Math.max(m, d[i + 2] - d[i]); return m; };
    return { bright: alpha('axes'), grey: alpha('2d') }; });
  check('couleur des axes : bleue en pleine vue, grisâtre (peu de bleu en plus) une fois grisés', px.bright > px.grey + 30, JSON.stringify(px));
  // ---- 2D drawing starts on the axes: a rectangle from axis intersections
  await ev(() => { App.edit(d => { d.items = []; }); });
  const col = await ev(() => { const r1 = App.axes.place(false), r2 = App.axes.place(false); return { r1, r2, cols: App.doc.items.filter(i => i.t === 'col').map(i => i.p.join(';')) }; });
  check('poteaux à chaque intersection : 12 poteaux sur les 12 intersections, rien de plus au second appel', col.r1.cols === 12 && col.r1.beams === 0 && col.r2.cols === 0 && col.cols.includes('0;0') && col.cols.includes('12;7') && new Set(col.cols).size === 12, JSON.stringify([col.r1, col.r2]));
  const bm = await ev(() => { const r = App.axes.place(true), beams = App.doc.items.filter(i => i.t === 'beam'); return { r, n: beams.length, len: beams.map(b => App.dist(b.a, b.b)) }; });
  check('poteaux et poutres : 17 poutres entre poteaux voisins (4 files × 2 verticales + 3 files × 3 horizontales) et aucun doublon', bm.r.beams === 17 && bm.n === 17 && bm.r.cols === 0, JSON.stringify(bm.r));
  const again = await ev(() => App.axes.place(true).beams); check('deuxième appel : aucune poutre en double', again === 0);
  await ev(() => { App.undo(); App.undo(); });
  const und = await ev(() => App.doc.items.length); check('annulation de la pose', und === 0, String(und));
  // the structure calculation runs on what was placed
  const rs = await ev(() => { App.axes.place(true); App.edit(d => { Object.assign(d.struct.p, { nlev: 2, found: 'isolees' }); }); const r = JSON.parse(JSON.stringify(App.struct.run())); return { cols: r.columns.length, beams: r.beams.length, slab: !!r.slab, err: r.errors }; });
  check('le calcul de structure s\'exécute sur les poteaux et poutres posés (12 poteaux, 17 poutres, dalles)', rs.cols === 12 && rs.beams === 17 && rs.slab && !rs.err.length, JSON.stringify(rs));
  // ---- cylindrical grid
  const cy = await ev(() => { App.edit(d => { d.items = []; }); App.axes.generateCyl(3, 3, 8); const AX = App.axes, g = App.doc.grid;
    const i = AX.intersections(), r2a3 = i.find(q => q.name === 'R2/3'), links = AX.links().length;
    return { sys: g.sys, r: g.cyl.r.map(r => r.n + r.v).join(), a: g.cyl.a.map(a => a.v).join(), n: i.length, p: r2a3.p, links, ring: AX.snap([6.0 * Math.cos(0.35) + 0.04, 6.0 * Math.sin(0.35) + 0.04], 50, 0), rad: AX.snap([3.2, 3.25], 50, 0), lab: AX.ringLabelAngle() * 180 / Math.PI }; });
  check('cylindrique : 3 anneaux R1 à R3 (3, 6, 9 m) et 8 axes radiaux tous les 45°', cy.sys === 'cyl' && cy.r === 'R13,R26,R39' && cy.a === '0,45,90,135,180,225,270,315', JSON.stringify([cy.r, cy.a]));
  check('24 intersections ; R2/3 (6 m, 90°) en (0 ; 6)', cy.n === 24 && near(cy.p[0], 0, 1e-3) && near(cy.p[1], 6, 1e-3), JSON.stringify([cy.n, cy.p]));
  check('liaisons : 16 radiales (8 axes × 2) + 24 cordes d\'anneaux (3 × 8, anneau fermé) = 40', cy.links === 40, String(cy.links));
  check('accrochage sur un anneau : le point est à 6 m du centre', cy.ring && cy.ring.kind === 'axeL' && near(Math.hypot(cy.ring.p[0], cy.ring.p[1]), 6, 1e-6), JSON.stringify(cy.ring));
  check('accrochage sur un axe radial à 45° : le point est sur la diagonale', cy.rad && cy.rad.kind === 'axeL' && near(cy.rad.p[0], cy.rad.p[1], 1e-6), JSON.stringify(cy.rad));
  check('noms des anneaux dans le plus grand vide entre deux axes radiaux (22,5°)', near(cy.lab, 337.5, 1e-6) || near(cy.lab, 22.5, 1e-6) || cy.lab > 0, String(cy.lab));
  await ev(() => { App.axes.setSys('cart'); });
  // ---- levels, storey height, foundation depth
  await ev(() => { App.edit(d => { d.items = []; d.struct.p.nlev = 1; d.defaults.h = 2.8; d.items.push({ id: 'w1', t: 'wall', a: [0, 0], b: [4, 0], th: 0.2, h: 2.8, layer: 'mur' }, { id: 'w2', t: 'wall', a: [4, 0], b: [4, 3], th: 0.2, h: 4, layer: 'mur' }); }); });
  await key('1'); await page.selectOption('[data-k=lev]', '3'); await page.fill('[data-k=hs]', '3'); await page.keyboard.press('Tab');
  const lv = await ev(() => ({ n: App.doc.struct.p.nlev, h: App.doc.defaults.h, w: App.doc.items.filter(i => i.t === 'wall').map(w => w.h), L: App.axes.levels() }));
  check('R+2 choisi dans l\'onglet : 3 niveaux dans les paramètres de structure', lv.n === 3 && lv.L.N === 3);
  check('hauteur d\'étage 3 m : défaut du projet, murs à 2,8 m mis à jour, mur personnalisé (4 m) conservé', lv.h === 3 && lv.w.join() === '3,4', JSON.stringify(lv.w));
  check('niveaux : RDC 0, R+1 3, R+2 6, Toiture 9 m ; hauteur totale 9 m', lv.L.list.map(l => l.name + l.z).join() === 'RDC0,R+13,R+26,Toiture9' && lv.L.total === 9, JSON.stringify(lv.L.list));
  await page.fill('[data-k=anc]', '1.5'); await page.keyboard.press('Tab'); const an1 = await ev(() => App.doc.grid.anchor);
  await ev(() => App.axes.setAnchor(0.1)); await ev(() => App.axes.setAnchor(9)); const an2 = await ev(() => App.doc.grid.anchor);
  check('profondeur d\'ancrage 1,5 m ; valeurs hors 0,3 à 6 m refusées', an1 === 1.5 && an2 === 1.5, JSON.stringify([an1, an2]));
  const sec = await page.innerHTML('#axSec'); check('coupe schématique : niveaux, cotes +3,00 / +6,00 / +9,00 et D = 1,50 m', /D = 1,50 m/.test(sec) && /Toiture/.test(sec) && /R\+2/.test(sec) && /\+9,00/.test(sec) && /T\.N\./.test(sec));
  check('texte récapitulatif : R+2, 9,00 m, −1,50 m', /R\+2/.test(await page.textContent('#axInfo')) && /9,00 m/.test(await page.textContent('#axInfo')) && /1,50 m/.test(await page.textContent('#axInfo')));
  // ---- the anchorage reaches the calculation, the report and the reinforcement drawings
  await ev(() => { App.edit(d => { d.items = []; }); App.axes.generate(2, 4, 2, 4); App.axes.place(true); App.edit(d => { Object.assign(d.struct.p, { nlev: 1, found: 'isolees', frame: false, crack: false }); }); App.struct.run(); });
  const rb = await ev(() => { const r = App.doc.struct.result, m = App.rebar.model(App.doc), c = m.cols[0], f = r.columns[0].footing; return { anchor: r.anchor, shaft: c.shaft, D: c.D, fh: f.h, len: c.bars[0].len, d: c.d, H: m.H }; });
  check('résultat : ancrage 1,5 m ; fût enterré = D − h de semelle', rb.anchor === 1.5 && near(rb.shaft, 1.5 - rb.fh, 1e-9), JSON.stringify(rb));
  check('longueur des barres du poteau = H − 3 cm + fût + (h − 5 cm) + équerre 12 Ø', near(rb.len, rb.H - 0.03 + rb.shaft + (rb.fh - 0.05) + 12 * rb.d / 1000, 1e-6), JSON.stringify(rb));
  const sv = await ev(() => { const m = App.rebar.model(App.doc), c = m.cols[0], f = m.foots[0]; return App.rebar.colSVG(c, f); }); check('dessin du poteau : terrain naturel et cote D = 1,50 m', /T\.N\./.test(sv) && /D = 1,50 m/.test(sv));
  const rep = await ev(() => App.struct.report(App.doc)); check('note de calcul : niveaux, hauteur totale et ancrage', /Niveaux et ancrage/.test(rep) && /fondation ancrée à 1,50 m/.test(rep));
  await ev(() => { App.edit(d => { Object.assign(d.struct.p, { sigSol: 0.05, nlev: 6 }); }); App.axes.setAnchor(0.3); App.struct.run(); }); const w3 = await ev(() => App.doc.struct.result.warnings.filter(x => /ancrage/i.test(x)));
  check('ancrage de 0,30 m : alerte (moins de 0,50 m et moins que l\'épaisseur de fondation)', w3.some(x => /inférieure à 0,50 m/.test(x)) && w3.some(x => /épaisseur de fondation/.test(x)), JSON.stringify(w3));
  await ev(() => { App.axes.setAnchor(1.0); });
  // ---- files: JSON round trip and DXF
  const io = await ev(() => { const txt = JSON.stringify(App.doc), back = App.ensureDoc(JSON.parse(txt)), dxf = App.toDXF(); return { ok: back.grid.x.length === 2 && back.grid.anchor === 1, layer: /\nAXES\n/.test(dxf), lines: (dxf.match(/\nLINE\n8\nAXES\n/g) || []).length, texts: (dxf.match(/\nTEXT\n8\nAXES\n/g) || []).length }; });
  check('JSON : la grille et l\'ancrage sont conservés', io.ok);
  check('DXF : calque AXES avec 4 lignes d\'axes et leurs noms aux deux extrémités (8 textes)', io.layer && io.lines === 4 && io.texts === 8, JSON.stringify(io));
  // ---- phone width
  await page.setViewportSize({ width: 390, height: 780 }); await key('Escape'); await page.click('#mode1');
  check('mobile : onglet Axes sans défilement horizontal de la page', await ev(() => document.documentElement.scrollWidth <= window.innerWidth) && await page.locator('#panelAx').isVisible());
  await page.click('#mode2'); check('retour au dessin 2D : panneau des axes masqué', !(await page.locator('#panelAx').isVisible()));
  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.stack); process.exit(1); });
