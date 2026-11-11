// Beam-column nodes: section analysis in compound bending, moments transmitted by end beams, anchorage of beam bars, node drawings.
const { check, launch } = require('./helper');
const near = (a, b, tol) => Math.abs(a - b) <= tol;
(async () => {
  const { browser, page, click, errors } = await launch(), key = k => page.keyboard.press(k);
  // ---- section analysis (fc28 25, FeE500), square 30 x 30 cm, 9 cm² = 4,5 cm² in each layer at 4,5 cm from the faces
  const f = await page.evaluate(() => { const S = App.struct, m = S.mat({ fc28: 25, fe: 500 }), a = 0.3, As = 9e-4, mr = N => S.colMR(N, As, a, m) * 1000;
    const Npure = 14.1667 * 0.09 + As * (400 - 14.1667), bend = S.colBending(0.5, 0.090, a, m), less = S.colMR(0.5, bend.As / 1e4 * 0.97, a, m);
    return { m0: mr(0), m4: mr(0.4), m8: mr(0.8), m12: mr(1.2), m15: mr(1.5), mTop: mr(Npure + 0.2), Npure, mBigAs: S.colMR(0.5, 18e-4, a, m) * 1000, mSmallAs: S.colMR(0.5, 5e-4, a, m) * 1000, bend, less: less * 1000, a1: S.anchorage(12, m), a2: S.anchorage(10, m), a3: S.anchorage(16, m) }; });
  check('flexion simple (N = 0) : M_R entre 44 et 62 kN.m (bloc rectangulaire sans acier comprimé : 45,4)', f.m0 > 44 && f.m0 < 62, String(f.m0));
  check('l\'effort normal augmente d\'abord le moment résistant (0,8 MN > 0)', f.m8 > f.m0 && f.m4 > f.m0, JSON.stringify([f.m0, f.m4, f.m8]));
  check('puis le diminue vers la compression pure (1,5 MN < 0,8 MN)', f.m15 < f.m8 && f.m12 < f.m8 && f.m15 < f.m12, JSON.stringify([f.m8, f.m12, f.m15]));
  check('compression pure : N = fbu·a² + As·(400 − fbu) = 1,622 MN, M quasi nul au-delà', near(f.Npure, 1.6223, 1e-3) && Math.abs(f.mTop) < 8, JSON.stringify([f.Npure, f.mTop]));
  check('plus d\'acier, plus de moment résistant', f.mBigAs > f.mSmallAs, JSON.stringify([f.mSmallAs, f.mBigAs]));
  check('section minimale retenue pour 90 kN.m sous 0,5 MN : M_R ≥ M_u et M_R(97 % de l\'acier) < M_u (minimalité)', f.bend.ok && f.bend.MR * 1000 >= 90 - 0.05 && f.less < 90 && f.bend.As > 9 && f.bend.As < 11, JSON.stringify([f.bend, f.less]));
  check('ancrage : ls = Ø·fe/(4τs) = 52,9 cm (HA12), 44,1 (HA10), 70,5 (HA16) ; crochet : 0,4·ls', near(f.a1.ls, 0.5291, 1e-3) && near(f.a1.la, 0.2116, 1e-3) && near(f.a2.ls, 0.4409, 1e-3) && near(f.a3.ls, 0.7054, 1e-3));
  check('largeur de poteau requise pour HA12 : 0,2116 + 0,03 = 24,2 cm → 25 cm', Math.round(Math.ceil((f.a1.la + 0.03) * 20) * 5) === 25);
  // ---- room 6 x 4 m with 20 cm columns
  await key('r'); await click(-3, -2); await click(3, 2); await key('d'); await click(0, -2); await key('f'); await click(3, 0); await key('v');
  await page.evaluate(() => { App.struct.autoColumns(); });
  const run = mod => page.evaluate(m => { App.edit(d => { Object.assign(d.struct.p, { nlev: 1, Q: 1.5, found: 'isolees', sigSol: 0.2, degr: true }, m); }); return JSON.parse(JSON.stringify(App.struct.run())); }, mod);
  const r = await run({}), corners = r.columns.filter(c => c.node.rive.length), inner = r.columns.filter(c => !c.node.rive.length);
  check('4 poteaux d\'angle reçoivent le moment de leurs poutres de rive, les 2 poteaux de milieu (poutres alignées) n\'en reçoivent pas', corners.length === 4 && inner.length === 2 && corners.every(c => c.node.rive.length === 2));
  check('poteaux de milieu : pas de moment transmis, compression centrée', inner.every(c => c.levels[0].Mx === 0 && c.levels[0].My === 0 && c.levels[0].bend === null));
  const beamOf = id => r.beams.find(b => b.id === id);
  check('moment transmis par une poutre de rive = 0,15·M0 de sa travée (selon son sens)', corners.every(c => { const l = c.levels[0]; return c.node.rive.every(n => { const M = 0.15 * beamOf(n.beam).M0; return near(n.axis === 'x' ? l.Mx : l.My, M, 1e-6) || c.node.rive.filter(q => q.axis === n.axis).length > 1; }); }), JSON.stringify(corners.map(c => [c.label, c.levels[0].Mx, c.levels[0].My, c.node.rive.map(n => [n.beam, n.axis, 0.15 * beamOf(n.beam).M0])])));
  check('flexion déviée : e0 = e_grand + 0,7·e_petit, ea = max(2 cm ; l0/250), e2 = 3·lf²·(2 + 2α)/(10⁴·a)', corners.every(c => { const l = c.levels[0], b = l.bend, N = l.Nu, ex = l.Mx / N, ey = l.My / N, al = l.G / (l.G + l.Q), lf = 0.7 * c.l0; return near(b.e0, Math.max(ex, ey) + 0.7 * Math.min(ex, ey), 1e-9) && near(b.ea, Math.max(0.02, c.l0 / 250), 1e-9) && near(b.e2, 3 * lf * lf * (2 + 2 * al) / (1e4 * l.a), 1e-9) && near(b.Mu, N * (b.e0 + b.ea + b.e2), 1e-6); }), JSON.stringify(corners[0].levels[0].bend));
  check('flexion composée : section ≥ compression centrée et M_R ≥ M_u', corners.every(c => c.levels.every(l => l.bend && l.bend.AsFlex >= l.bend.AsCentered - 1e-9 && l.bend.MR >= l.bend.Mu - 0.05 && l.bend.lamOK)));
  check('aciers retenus ≥ besoin en flexion composée', corners.every(c => c.levels.every(l => l.bars.As + 1e-9 >= l.bend.AsFlex)));
  // ---- heavy loads: the transmitted moment makes the corner columns bigger than the inner ones
  const heavy = await run({ nlev: 4, Q: 5, G2: 3 }), hc = heavy.columns.filter(c => c.node.rive.length), hi = heavy.columns.filter(c => !c.node.rive.length);
  check('4 niveaux chargés : l\'armature de flexion composée dépasse la compression centrée dans au moins un tronçon de poteau d\'angle', hc.some(c => c.levels.some(l => l.bend && l.bend.AsFlex > l.bend.AsCentered + 1e-6)), JSON.stringify(hc[0].levels.map(l => l.bend && [l.bend.AsFlex, l.bend.AsCentered].map(v => +v.toFixed(2)))));
  const hb = id => heavy.beams.find(x => x.id === id);
  check('niveaux courants : moitié de 0,15·M0 de la poutre (planchers courants identiques), pour chaque tronçon sous un plancher courant', hc.every(c => c.node.rive.every(n => { const M = 0.5 * 0.15 * hb(n.beam).M0, key = n.axis === 'x' ? 'Mx' : 'My'; return [1, 2, 3].every(i => near(c.levels[i][key], M, 1e-6)); })), JSON.stringify(hc[0].levels.map(l => [l.Mx, l.My])));
  check('sous la toiture, le moment passe en totalité au premier tronçon', hc[0].levels[0].Mx >= hc[0].levels[1].Mx - 1e-9 && hc[0].levels[0].My >= hc[0].levels[1].My - 1e-9);
  // ---- anchorage: 20 cm columns are too narrow for HA10/HA12 hooks (needs 25 cm), 25 cm walls give 25 cm columns
  const warn = r.warnings.filter(w => /Nœud/.test(w)); check('poteaux de 20 cm : ancrage insuffisant signalé pour les nœuds de rive (HA10 : 17,6 > 17,0 cm)', warn.length === 4 && warn.every(w => /ancrage des barres HA1[02]/.test(w) && /25 cm/.test(w)), warn.join(' | '));
  check('contrôle des nœuds : la = 0,4·ls, largeur requise = la + 3 cm', corners.every(c => c.node.rive.every(n => near(n.la, 0.4 * n.ls, 1e-12) && near(n.need, n.la + 0.03, 1e-12) && n.d >= 10)));
  check('les nœuds en défaut sont marqués', corners.every(c => c.node.levels.every(l => l.ok === false)));
  const wide = await page.evaluate(() => { App.setDoc(App.newDoc()); App.edit(d => { d.defaults.th = 0.25; }); return true; });
  await key('r'); await click(-3, -2); await click(3, 2); await key('v');
  const w25 = await page.evaluate(() => { App.struct.autoColumns(); App.edit(d => { Object.assign(d.struct.p, { found: 'isolees' }); }); const r = JSON.parse(JSON.stringify(App.struct.run())); return { a: r.columns.map(c => c.a), w: r.warnings.filter(x => /Nœud/.test(x)), ok: r.columns.every(c => c.node.levels.every(l => l.ok)) }; });
  check('murs de 25 cm : poteaux de 25 cm, ancrage suffisant, aucune alerte de nœud', w25.a.every(a => a >= 0.25 - 1e-9) && w25.w.length === 0 && w25.ok, JSON.stringify(w25));
  // ---- report, drawings
  const rep = await page.evaluate(() => App.struct.report(App.doc)); check('note de calcul : 4 bis Nœuds poutre-poteau, 0,15 M0, ea, second ordre', /4 bis\. Nœuds poutre-poteau/.test(rep) && /0,15 M0/.test(rep) && /max\(2 cm/.test(rep) && /BAEL A\.4\.3,5/.test(rep));
  await page.evaluate(() => { App.setDoc(App.newDoc()); }); await key('r'); await click(-3, -2); await click(3, 2); await key('d'); await click(0, -2); await key('v');
  await page.evaluate(() => { App.struct.autoColumns(); App.edit(d => { d.struct.p.found = 'isolees'; }); App.struct.run(); });
  const views = await page.evaluate(() => App.rebar.views(App.rebar.model(App.doc)).map(v => v.id)); check('vues Nœud : une par poteau d\'angle', views.filter(v => /^ND-/.test(v)).length === 4 && views.includes('ND-P1'), views.join());
  const nd = await page.evaluate(() => { const m = App.rebar.model(App.doc), tmp = document.createElement('div'); tmp.innerHTML = App.rebar.viewHTML(App.doc, m, 'ND-P1'); const s = tmp.querySelector('svg'); return { ok: !!s && !new DOMParser().parseFromString(s.outerHTML, 'image/svg+xml').querySelector('parsererror') && s.querySelectorAll('line,path,rect,circle').length > 20, txt: tmp.textContent }; });
  check('dessin du nœud : SVG bien formé, ancrage insuffisant annoncé, tableau des barres', nd.ok && /INSUFFISANT/.test(nd.txt) && /la = 0,4·ls/.test(nd.txt) && /Moment transmis/.test(nd.txt));
  await key('4'); await page.click('#ferList [data-v=ND-P1]'); check('mode Ferraillage : vue Nœud P1', /Nœud P1/.test(await page.textContent('#ferMain')) && /Ancrage insuffisant/.test(await page.textContent('#ferMain')));
  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.stack); process.exit(1); });
