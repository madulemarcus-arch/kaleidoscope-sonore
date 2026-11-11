// Plane frame analysis (direct stiffness method): hand calculations, equilibrium, patterns; then the column moments of a real plan.
const { check, launch } = require('./helper');
const near = (a, b, tol) => Math.abs(a - b) <= tol;
(async () => {
  const { browser, page, click, errors } = await launch(), key = k => page.keyboard.press(k);
  const E = 32164000, Ib = 0.2 * Math.pow(0.5, 3) / 12, Ic = Math.pow(0.3, 4) / 12;
  // ---- portal frame, 6 m span, 3 m storey, beams 20 x 50, columns 30 x 30, w = 30 kN/m (hand calculation by slope-deflection)
  const f = await page.evaluate(([E, Ib, Ic]) => { const S = App.struct, mk = (base, ic = Ic) => S.frame({ L: [6], N: 1, H: 3, bI: [Ib], bA: [0.1], cI: [[ic], [ic]], cA: [[0.09], [0.09]], pmaxT: [30], pminT: [30], pmaxF: [30], pminF: [30], E, base });
    const pin = mk('pin'), fix = mk('fix'), stiff = mk('pin', 2 * Ic); return { pin: pin.patterns[0], fix: fix.patterns[0], stiff: stiff.patterns[0], envPin: pin.env[0][0] }; }, [E, Ib, Ic]);
  const FEM = 30 * 36 / 12, hPin = FEM * (3 * Ic / 3) / (2 * Ib / 6 + 3 * Ic / 3), hFix = FEM * (4 * Ic / 3) / (2 * Ib / 6 + 4 * Ic / 3);
  check('portique articulé en pied : moment de poteau = (wL²/12)·(3Ic/h)/(2Ib/L + 3Ic/h) = 44,4 kN.m (écart ≤ 0,3 kN.m, déformation axiale)', near(f.pin.cols[0][0].top, hPin, 0.3) && near(f.pin.cols[1][0].top, hPin, 0.3), JSON.stringify([f.pin.cols[0][0].top, hPin]));
  check('pied articulé : moment nul en pied', near(f.pin.cols[0][0].bot, 0, 1e-6));
  check('portique encastré en pied : 4Ic/h, soit 50,8 kN.m en tête (écart ≤ 0,4)', near(f.fix.cols[0][0].top, hFix, 0.4), JSON.stringify([f.fix.cols[0][0].top, hFix]));
  check('pied encastré : moment de pied ≈ moitié de celui de la tête (transmission 1/2)', f.fix.cols[0][0].bot / f.fix.cols[0][0].top > 0.45 && f.fix.cols[0][0].bot / f.fix.cols[0][0].top < 0.55, String(f.fix.cols[0][0].bot / f.fix.cols[0][0].top));
  check('moment de nœud équilibré : poutre = poteau (≈ 44,3 kN.m)', near(Math.abs(f.pin.beams[0].m1), f.pin.cols[0][0].top, 1e-6) && near(Math.abs(f.pin.beams[0].m2), f.pin.cols[1][0].top, 1e-6));
  check('réactions verticales = charge totale (180 kN) et efforts normaux 90 kN par poteau', near(f.pin.R[0] + f.pin.R[1], 180, 1e-6) && near(f.pin.cols[0][0].N, 90, 1e-6));
  check('poteaux plus raides, plus de moment', f.stiff.cols[0][0].top > f.pin.cols[0][0].top + 3, JSON.stringify([f.pin.cols[0][0].top, f.stiff.cols[0][0].top]));
  check('l\'enveloppe est le maximum sur les sept dispositions de charges', f.envPin.M >= f.pin.cols[0][0].top - 1e-9 && f.envPin.patt === 'tout chargé');
  // ---- 2 spans, 2 floors: symmetry and equilibrium on every pattern
  const g = await page.evaluate(([E, Ib, Ic]) => { const S = App.struct, r = S.frame({ L: [4, 4], N: 2, H: 2.8, bI: [Ib, Ib], bA: [0.1, 0.1], cI: [[Ic, Ic], [Ic, Ic], [Ic, Ic]], cA: [[0.09, 0.09], [0.09, 0.09], [0.09, 0.09]], pmaxT: [21, 21], pminT: [13.5, 13.5], pmaxF: [25, 25], pminF: [16, 16], E, base: 'pin' });
    const load = (p, pat) => { let t = 0; for (let j = 1; j <= 2; j++) for (let s = 0; s < 2; s++) { const loaded = [() => true, s => s % 2 === 0, s => s % 2 === 1, (s, j) => j % 2 === 1, (s, j) => j % 2 === 0, (s, j) => (s + j) % 2 === 0, (s, j) => (s + j) % 2 === 1][pat](s, j); t += 4 * (loaded ? (j === 1 ? 21 : 25) : (j === 1 ? 13.5 : 16)); } return t; };
    const joint = r.patterns.map(p => { let worst = 0; for (let j = 1; j <= 2; j++) for (let i = 0; i <= 2; i++) { let sum = 0; p.beams.forEach(b => { if (b.j === j && b.s === i) sum += b.m1; if (b.j === j && b.s === i - 1) sum += b.m2; }); if (j <= 2) sum += p.cols[i][j - 1].mTop; if (j >= 2) sum += p.cols[i][j - 2].mBot; worst = Math.max(worst, Math.abs(sum)); } return worst; });
    return { names: r.patterns.map(p => p.name), mid: r.patterns.map(p => [p.cols[1][0].top, p.cols[1][1].top]), R: r.patterns.map((p, k) => [p.R.reduce((a, b) => a + b, 0), load(p, k)]), joint, env: r.env[1].map(e => [e.M, e.patt]) }; }, [E, Ib, Ic]);
  check('7 dispositions : tout chargé, travées alternées (2), planchers alternés (2), damiers (2)', g.names.length === 7 && g.names[0] === 'tout chargé' && /damier/.test(g.names[5]));
  check('chargement symétrique : aucun moment dans le poteau central', g.mid[0][0] < 1e-6 && g.mid[0][1] < 1e-6 && g.mid[3][0] < 1e-6 && g.mid[4][0] < 1e-6, JSON.stringify(g.mid));
  check('travées alternées : moment dans le poteau central, identique dans les deux dispositions symétriques', g.mid[1][0] > 1 && near(g.mid[1][0], g.mid[2][0], 1e-6) && near(g.mid[1][1], g.mid[2][1], 1e-6), JSON.stringify(g.mid.slice(1, 3)));
  check('équilibre vertical : Σ réactions = charge totale, pour les 7 dispositions', g.R.every(([a, b]) => near(a, b, 1e-6)), JSON.stringify(g.R));
  check('équilibre des nœuds : somme des moments d\'extrémité nulle, pour les 7 dispositions', g.joint.every(v => v < 1e-6), JSON.stringify(g.joint));
  check('le moment de calcul du poteau central est celui d\'une disposition alternée', g.env.every(([M, p]) => M > 1 && /alternées|damier/.test(p)), JSON.stringify(g.env));
  // ---- room 6 x 4 m: the corner and middle columns get their moments from the frame rows
  await key('r'); await click(-3, -2); await click(3, 2); await key('d'); await click(0, -2); await key('f'); await click(3, 0); await key('v');
  await page.evaluate(() => { App.struct.autoColumns(); });
  const run = mod => page.evaluate(m => { App.edit(d => { Object.assign(d.struct.p, { nlev: 1, Q: 1.5, G2: 2, degr: true, found: 'isolees', sigSol: 0.2, frame: true, base: 'pin' }, m); }); return JSON.parse(JSON.stringify(App.struct.run())); }, mod);
  const r1 = await run({}), fr = r1.columns.map(c => [c.label, c.levels[0].alt && c.levels[0].alt.frame]);
  check('analyse de portique active : chaque tronçon porte le détail de la disposition déterminante', r1.columns.every(c => Array.isArray(c.levels[0].alt.frame) && c.levels[0].alt.frame.length >= 1 && c.levels[0].alt.frame.every(q => q.M > 0 && q.patt)), JSON.stringify(fr[0]));
  check('un poteau d\'angle reçoit Mx du portique en x et My du portique en y', ['P1', 'P3', 'P4', 'P6'].every(l => { const c = r1.columns.find(x => x.label === l), i = c.levels[0].alt.frame; return i.length === 2 && i.some(q => q.axis === 'x') && i.some(q => q.axis === 'y') && c.levels[0].Mx > 0 && c.levels[0].My > 0; }));
  // independent recomputation of P2 with the final sections
  const re = await page.evaluate(([E]) => { const r = App.doc.struct.result, byId = Object.fromEntries(r.beams.map(b => [b.id, b])), p2 = r.columns.find(c => c.label === 'P2'), [ia, ib] = p2.node.pairs[0].beams, ba = byId[ia], bb = byId[ib], line = r.columns.filter(c => Math.abs(c.p[1] - p2.p[1]) < 1e-6).sort((a, b) => a.p[0] - b.p[0]), bs = [ba, bb].sort((a, b) => a.p1[0] + a.p2[0] - b.p1[0] - b.p2[0]);
    const Em = 11000 * Math.cbrt(r.params.fc28) * 1000, sec = bs[0], ld = b => ({ g: b.slabG + b.self + b.wall, q: b.slabQ }), pmax = b => 1.35 * ld(b).g + 1.5 * ld(b).q, pmin = b => 1.35 * ld(b).g;
    const out = App.struct.frame({ L: bs.map(b => b.L), N: 1, H: r.H, bI: bs.map(b => b.b * Math.pow(b.h, 3) / 12), bA: bs.map(b => b.b * b.h), cI: line.map(c => [Math.pow(c.levels[0].a, 4) / 12]), cA: line.map(c => [c.levels[0].a * c.levels[0].a]), pmaxT: bs.map(pmax), pminT: bs.map(pmin), pmaxF: bs.map(pmax), pminF: bs.map(pmin), E: Em, base: 'pin' });
    return { M: out.env[1][0].M, patt: out.env[1][0].patt, got: p2.levels[0].Mx, gotY: p2.levels[0].My, line: line.map(c => c.label), L: bs.map(b => b.L) }; }, [E]);
  check('P2 : moment du niveau = enveloppe de l\'analyse de portique recalculée avec les sections et les charges finales', near(re.M, re.got, 1e-9) && re.gotY === 0 && /alternées|damier/.test(re.patt), JSON.stringify(re));
  check('P2 est entre P1 et P3 sur la file de 6 m (2 travées de 3 m)', re.line.join() === 'P1,P2,P3' && re.L.join() === '3,3');
  check('les sections ont convergé : un recalcul du moment avec les sections finales redonne les moments de calcul', r1.columns.every(c => { const l = c.levels[0]; return l.Mx >= 0 && l.My >= 0; }) && near(re.M, re.got, 1e-9));
  // frame vs simplified
  const simple = await run({ frame: false }), fp = await run({ frame: true });
  check('sans analyse de portique : les moments viennent de l\'approche simplifiée (pas de détail de disposition)', simple.columns.every(c => !c.levels[0].alt.frame) && simple.columns.some(c => c.levels[0].alt.x > 0 || c.levels[0].alt.dMx > 0 || c.levels[0].Mx > 0));
  check('l\'analyse de portique donne des moments de rive plus forts que 0,15·M0 réparti', fp.columns.filter(c => c.node.rive.length).every(c => c.levels[0].Mx > simple.columns.find(x => x.label === c.label).levels[0].Mx || c.levels[0].My > simple.columns.find(x => x.label === c.label).levels[0].My), JSON.stringify(fp.columns.map(c => [c.label, +c.levels[0].Mx.toFixed(1), +simple.columns.find(x => x.label === c.label).levels[0].Mx.toFixed(1)])));
  const fix = await run({ base: 'fix' }); check('pied encastré : les moments des poteaux de rive augmentent (poteau plus raide en pied)', fix.columns.filter(c => c.node.rive.length).some(c => c.levels[0].Mx > fp.columns.find(x => x.label === c.label).levels[0].Mx + 1e-9 || c.levels[0].My > fp.columns.find(x => x.label === c.label).levels[0].My + 1e-9));
  // multi-storey: every segment gets a frame moment, sections never decrease downwards
  const five = await run({ nlev: 5, Q: 3 }); check('5 niveaux : chaque tronçon de chaque poteau a son moment de portique', five.columns.every(c => c.levels.length === 5 && c.levels.every(l => l.alt.frame && l.alt.frame.length >= 1 && l.Mx + l.My > 0)));
  check('5 niveaux : sections jamais plus petites vers le bas', five.columns.every(c => c.levels.every((l, i) => i === 0 || l.a >= c.levels[i - 1].a - 1e-12)));
  check('5 niveaux : flexion composée aux armatures ≥ compression centrée', five.columns.every(c => c.levels.every(l => !l.bend || l.bend.AsFlex >= l.bend.AsCentered - 1e-9)));
  // ---- UI, report
  await key('2'); check('panneau Structure : case Analyse de portique et menu Pied de poteau', await page.locator('#structBox [data-s=frame]').isChecked() && (await page.inputValue('#structBox [data-s=base]')) === 'pin');
  await page.uncheck('#structBox [data-s=frame]'); check('case décochée : paramètre frame = false', await page.evaluate(() => App.doc.struct.p.frame) === false); await page.check('#structBox [data-s=frame]'); await page.selectOption('#structBox [data-s=base]', 'fix'); check('menu : pied encastré', await page.evaluate(() => App.doc.struct.p.base) === 'fix');
  await page.selectOption('#structBox [data-s=base]', 'pin'); await page.click('#structBox [data-act=calc]');
  const rep = await page.evaluate(() => App.struct.report(App.doc)); check('note de calcul : analyse de portique complète, sept dispositions, dispositions déterminantes', /analyse de portique complète/.test(rep) && /sept dispositions/.test(rep) && /Disposition de charges déterminante/.test(rep) && /(alternées|damier|tout chargé)/.test(rep));
  const nd = await page.evaluate(() => { const m = App.rebar.model(App.doc), tmp = document.createElement('div'); tmp.innerHTML = App.rebar.viewHTML(App.doc, m, 'ND-P2'); return { txt: tmp.textContent, svg: tmp.querySelector('svg') ? tmp.querySelector('svg').textContent : '' }; });
  check('nœud continu : tableau de portique et légende du dessin', /Moment de calcul du poteau/.test(nd.txt) && /Disposition de charges déterminante/.test(nd.txt) && /Analyse de portique/.test(nd.svg));
  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.stack); process.exit(1); });
