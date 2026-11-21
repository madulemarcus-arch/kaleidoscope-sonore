// Structural pre-sizing (BAEL): formulas checked against hand calculations, then the whole chain on drawn plans.
const { check, launch } = require('./helper');
const near = (a, b, tol) => Math.abs(a - b) <= tol;
(async () => {
  const { browser, page, click, items, errors } = await launch(), key = k => page.keyboard.press(k);
  // ---- formulas (fc28 = 25 MPa, FeE500)
  const f = await page.evaluate(() => { const S = App.struct, m = S.mat({ fc28: 25, fe: 500 }), fl = S.flex(0.03, 1, 0.13, m), sm = S.slabMoments(4, 5, 10), one = S.slabMoments(2, 9, 10), col = S.column(1.5, 0.3, 3.0, m), ft = S.footing(500, 370, 0.3, 0.2, m),
    pl = { sq: S.panelLoad(10, 4, 4, 'short'), sqL: S.panelLoad(10, 4, 4, 'long'), tri: S.panelLoad(10, 4, 8, 'short'), trap: S.panelLoad(10, 4, 8, 'long'), ow: S.panelLoad(10, 3, 9, 'long'), owS: S.panelLoad(10, 3, 9, 'short') };
    return { m, fl, sm, one, col, ft, pl, big: S.flex(0.5, 0.2, 0.3, m) }; });
  check('fbu = 14,17 MPa et ft28 = 2,1 MPa', near(f.m.fbu, 14.1667, 1e-3) && near(f.m.ft28, 2.1, 1e-9), JSON.stringify(f.m));
  check('σs = 434,8 MPa ; μl = 0,372 ; σs ELS = 201,6 MPa', near(f.m.ss, 434.78, 0.01) && near(f.m.muL, 0.3717, 0.001) && near(f.m.ssSer, 201.6, 0.1));
  check('flexion simple : As = 5,69 cm² pour 30 kN.m/m, d = 13 cm', f.fl.ok && near(f.fl.As, 5.69, 0.03) && near(f.fl.mu, 0.1253, 0.0005), JSON.stringify(f.fl));
  check('flexion : section insuffisante détectée (μ > μl)', f.big.ok === false);
  check('dalle 4 × 5 : μx = 0,0561 ; μy = 0,6157', near(f.sm.mux, 0.056089, 1e-5) && near(f.sm.muy, 0.61568, 1e-5), JSON.stringify(f.sm));
  check('dalle 4 × 5 : M0x = 8,97 kN.m/m', near(f.sm.M0x, 8.974, 0.005));
  check('dalle portant dans un seul sens (α < 0,4) : M0 = pl²/8', f.one.oneWay && near(f.one.M0x, 5, 1e-9));
  check('charges des dalles sur les poutres : triangle p·lx/3 et p·lx/4', near(f.pl.sq.m, 13.333, 0.001) && near(f.pl.sq.v, 10, 1e-9) && near(f.pl.tri.m, 13.333, 0.001));
  check('charges des dalles : trapèze (1 − α²/3) et (1 − α/2)', near(f.pl.trap.m, 20 * (1 - 0.25 / 3), 1e-6) && near(f.pl.trap.v, 20 * (1 - 0.25), 1e-6), JSON.stringify(f.pl.trap));
  check('carré : les deux côtés donnent la même charge', near(f.pl.sqL.m, f.pl.sq.m, 1e-6) && near(f.pl.sqL.v, f.pl.sq.v, 1e-6));
  check('dalle à un sens : seuls les grands côtés sont chargés', near(f.pl.ow.m, 15, 1e-9) && f.pl.owS.m === 0);
  check('poteau 30 × 30, Nu = 1,5 MN, l0 = 3 m : λ = 24,2 et A = 11,1 cm²', near(f.col.lam, 24.25, 0.05) && near(f.col.Areq, 11.08, 0.1), JSON.stringify(f.col));
  check('semelle : 1,45 × 1,45 m, d = 30 cm', near(f.ft.side, 1.45, 1e-9) && near(f.ft.d, 0.30, 1e-9) && near(f.ft.h, 0.35, 1e-9), JSON.stringify(f.ft));
  check('semelle : aciers max(ELU 5,5 ; ELS 8,8 cm²)', near(f.ft.Asu, 5.51, 0.02) && near(f.ft.Ass, 8.79, 0.03) && near(f.ft.As, f.ft.Ass, 1e-9), JSON.stringify(f.ft));
  // ---- a room 6 x 4 m with an opening each
  await key('r'); await click(-3, -2); await click(3, 2); await key('d'); await click(0, -2); await key('f'); await click(3, 0); await key('v');
  const r0 = await page.evaluate(() => { const r = App.struct.compute(App.doc); return r.errors; }); check('sans poteau : message d\'aide', r0.length === 1 && /poteau/i.test(r0[0]), r0.join());
  const n = await page.evaluate(() => App.struct.autoColumns()); check('poteaux automatiques : 4 coins + 2 milieux de grands côtés', n === 6, String(n));
  check('pas de doublon au second passage', (await page.evaluate(() => App.struct.autoColumns())) === 0);
  await page.evaluate(() => App.edit(d => { d.struct.p.crack = false; }));   // gross sections here: the cracked stiffness has its own test file
  const r = await page.evaluate(() => JSON.parse(JSON.stringify(App.struct.run())));
  check('calcul sans erreur', r.errors.length === 0 && r.columns.length === 6 && r.beams.length === 6, JSON.stringify(r.errors));
  check('une dalle de 4 × 6 m, épaisseur 12 cm', !!r.slab && r.slab.panels.length === 1 && near(r.slab.panels[0].lx, 4, 1e-9) && near(r.slab.panels[0].ly, 6, 1e-9) && near(r.slab.h, 0.12, 1e-9), JSON.stringify(r.slab && r.slab.h));
  const d = r.slab.panels[0]; check('dalle : moments du cas calculé à la main', near(d.mux, 0.07305, 1e-4) && near(d.M0x, 0.07305195 * d.pu * 16, 0.01) && near(d.pu, 7.575, 1e-6), JSON.stringify({ pu: d.pu, M0x: d.M0x }));
  check('dalle : armatures choisies et cisaillement admissible', /^HA\d+ e=\d+$/.test(d.barTx.text) && d.tau < d.tauLim, d.barTx.text);
  check('poutres : sections minimales 20 × 25 (3 m) et 20 × 35 (4 m)', r.beams.some(b => near(b.L, 3, 1e-6) && near(b.h, 0.25, 1e-9) && near(b.b, 0.2, 1e-9)) && r.beams.some(b => near(b.L, 4, 1e-6) && near(b.h, 0.35, 1e-9)), r.beams.map(b => b.L + ':' + b.h).join(' '));
  check('poutre : M0 = pu·L²/8 et τu = Vu/(b·d)', r.beams.every(b => near(b.M0, b.pu * b.L * b.L / 8, 1e-6) && near(b.tau, b.Vu / 1000 / (b.b * b.d), 1e-9)));
  check('poutre : le poids de la maçonnerie est pris en compte (≈ 7 kN/m)', r.beams.some(b => b.wall > 6 && b.wall < 7.5), r.beams.map(b => b.wall.toFixed(2)).join(' '));
  // equilibrium: the factored column loads must cover the factored slab + beam + wall loads (continuity raises them by at most 10 %)
  const tot = await page.evaluate(() => { const r = App.doc.struct.result, p = r.slab.panels[0], slab = p.pu * p.lx * p.ly, line = r.beams.reduce((s, b) => s + 1.35 * (b.self + b.wall) * b.L, 0), colw = 6 * 1.35 * 25 * 0.04 * r.H; return { slab, line, colw, Nu: r.totals.Nu }; });
  check('équilibre : somme des charges poteaux ≈ charges appliquées (0 à +10 %)', tot.Nu >= (tot.slab + tot.line) * 0.999 && tot.Nu <= (tot.slab + tot.line + tot.colw) * 1.10 + 1, JSON.stringify(tot));
  check('poteaux : 20 × 20 minimum, armatures minimales 4HA12', r.columns.every(c => c.a >= 0.2) && r.columns.every(c => c.Areq < c.Amin) && r.columns[0].bars.text === '4HA12', r.columns.map(c => c.a + ':' + c.bars.text).join(' '));
  check('poteaux de milieu continus (+10 %)', r.columns.some(c => c.continuous) && r.columns.some(c => !c.continuous));
  check('semelles : σ sol ≤ admissible', r.columns.every(c => c.footing.sigma <= 0.2 + 1e-9), r.columns.map(c => c.footing.sigma.toFixed(3)).join(' '));
  check('semelle : côté = √(1,1·Ns/σ) arrondi à 5 cm', r.columns.every(c => c.footing.side >= Math.sqrt(1.1 * c.Ns / 200) - 1e-9 && c.footing.side - Math.sqrt(1.1 * c.Ns / 200) < 0.25));
  // ---- parameters change the result in the right direction
  const cmp = await page.evaluate(() => { const base = App.doc.struct.result, get = (mod) => { const d = JSON.parse(JSON.stringify(App.doc)); mod(d.struct.p); return App.struct.compute(d); };
    const three = get(p => { p.nlev = 3; }), soft = get(p => { p.sigSol = 0.1; }), heavy = get(p => { p.Q = 5; }), roof = get(p => { p.top = 'charpente'; });
    return { n1: base.totals.Nu, n3: three.totals.Nu, f1: base.columns[0].footing.side, f2: soft.columns[0].footing.side, q: heavy.slab.h, q0: base.slab.h, roofSlab: roof.slab, roofNu: roof.totals.Nu, threeA: three.columns[0].a }; });
  check('3 niveaux : charge ≈ 3 fois plus grande', cmp.n3 > cmp.n1 * 2.5 && cmp.n3 < cmp.n1 * 3.5, cmp.n1.toFixed(0) + ' -> ' + cmp.n3.toFixed(0));
  check('sol plus faible : semelle plus grande', cmp.f2 > cmp.f1, cmp.f1 + ' -> ' + cmp.f2);
  check('charge d\'exploitation 5 kN/m² : dalle pas plus mince', cmp.q >= cmp.q0, cmp.q0 + ' -> ' + cmp.q);
  check('charpente légère seule : pas de dalle, charge plus faible', cmp.roofSlab === null && cmp.roofNu < cmp.n1, String(cmp.roofNu));
  // ---- stale detection, 2D overlay, panel, report, 3D
  check('résultats à jour juste après le calcul', await page.evaluate(() => !App.struct.stale()));
  const orig = await page.evaluate(() => App.doc.items.find(i => i.t === 'col').p.slice());
  await page.evaluate(() => App.edit(d => { d.items.find(i => i.t === 'col').p = [-3.5, -2]; })); check('résultats périmés après modification du plan', await page.evaluate(() => App.struct.stale()) && /périmés/.test(await page.textContent('#structBox')));
  await page.evaluate(p => App.edit(d => { d.items.find(i => i.t === 'col').p = p; }), orig); await page.evaluate(() => App.struct.run());
  check('panneau Structure : résumé affiché', /6 poteaux, 6 poutres, dalle de 12 cm/.test(await page.textContent('#structBox')));
  await page.click('#structBox [data-act=apply]'); check('appliquer les sections aux poteaux', (await items()).filter(i => i.t === 'col').every(c => c.a >= 0.2));
  const rep = await page.evaluate(() => App.struct.report(App.doc)); check('note de calcul : sections et tableaux', /Note de calcul/.test(rep) && /<h2>3\. Poutres<\/h2>/.test(rep) && (rep.match(/<tr>/g) || []).length > 20 && /BAEL/.test(rep));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#structBox [data-act=report]')]); check('téléchargement de la note de calcul', dl.suggestedFilename().endsWith('note-de-calcul.html'));
  const px = await page.evaluate(() => { const c = document.getElementById('cv'), g = c.getContext('2d'); App.redraw(); return new Promise(ok => requestAnimationFrame(() => { const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 120 && d[i + 1] < 200 && d[i + 2] < 140) n++; ok(n); })); });
  check('plan : poteaux et poutres dessinés en orange', px > 100, String(px));
  await page.click('#mode3'); const st = await page.evaluate(() => { App.v3.rebuild(); return App.v3.mesh.stats; }); check('3D : 6 poteaux et 6 poutres', st.cols === 6 && st.beams === 6, JSON.stringify(st)); check('3D : le calcul se dessine', await page.evaluate(() => App.v3.coverage()) > 0.05);
  await page.uncheck('#panel3 [data-k=structure]'); check('3D : structure masquable', await page.evaluate(() => { App.v3.rebuild(); return App.v3.mesh.stats.cols; }) === 0); await key('2');
  // ---- hand-drawn tools and selection (no crash on a selected column)
  await page.evaluate(() => App.setDoc(App.newDoc()));
  await key('p'); await click(-2, 0); await click(2, 0); await key('b'); await click(-2, 0); await click(2, 0); await key('Escape'); await key('v');
  const it = await items(); check('outil Poteau et outil Poutre', it.filter(i => i.t === 'col').length === 2 && it.filter(i => i.t === 'beam').length === 1, JSON.stringify(it.map(i => i.t)));
  await key('p'); await click(0, 2); await key('v'); await click(0, 2); check('poteau sélectionné', (await page.evaluate(() => App.sel.length)) === 1 && (await page.evaluate(() => App.item(App.sel[0]).t)) === 'col');
  await click(0, 2); await click(0, 1.5);   // pressing again on a selected item used to look for handles
  const rb = await page.evaluate(() => App.struct.compute(App.doc)); check('poutre dessinée à la main entre deux poteaux', rb.beams.length === 1 && rb.beams[0].manual, JSON.stringify(rb.beams.map(b => b.manual)));
  check('dalle absente : message d\'attention', rb.warnings.some(w => /dalle rectangulaire/.test(w)), rb.warnings.join(' | '));
  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.stack); process.exit(1); });
