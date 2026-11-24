// Inner (continuous) nodes: unbalanced moment under alternate loading, shared between the columns by stiffness.
const { check, launch } = require('./helper');
const near = (a, b, tol) => Math.abs(a - b) <= tol;
(async () => {
  const { browser, page, click, errors } = await launch(), key = k => page.keyboard.press(k);
  // ---- pure function, hand calculation: two 4 m spans, G = 10, Q = 5 kN/m, beams 20 x 35 cm, columns 25 x 25 cm, H = 2,8 m
  const I = 0.2 * Math.pow(0.35, 3) / 12, kb = I / 4, kc = Math.pow(0.25, 4) / 12 / 2.8;
  const u = await page.evaluate(([kb, kc, I]) => { const e = { Gm: 10, Qm: 5, L: 4, Ib: I }, S = App.struct; return { eq: S.unbalanced(e, e, kc, kc), top: S.unbalanced(e, e, 0, kc), stiff: S.unbalanced(e, e, kc, 2 * kc), long: S.unbalanced({ Gm: 10, Qm: 5, L: 6, Ib: I }, { Gm: 10, Qm: 5, L: 3, Ib: I }, kc, kc), dead: S.unbalanced({ Gm: 10, Qm: 0, L: 4, Ib: I }, { Gm: 10, Qm: 0, L: 4, Ib: I }, kc, kc) }; }, [kb, kc, I]);
  const sumK = 2 * kb + 2 * kc;
  check('ΔM = |p·L²/12 chargée − 1,35·G·L²/12 à vide| = |28 − 18| = 10 kN.m (= 1,5·Q·L²/12)', near(u.eq.dM, 10, 1e-9) && near(u.eq.dM, 1.5 * 5 * 16 / 12, 1e-9));
  check('partage par rigidités : part = ΔM · kc / (Σ k poutres + k poteaux)', near(u.eq.sumK, sumK, 1e-12) && near(u.eq.above, 10 * kc / sumK, 1e-9) && near(u.eq.below, 10 * kc / sumK, 1e-9), JSON.stringify(u.eq));
  check('valeurs : 1,97 kN.m reprise par chacun des deux poteaux', near(u.eq.above, 1.971, 0.005), String(u.eq.above));
  check('poteau absent au-dessus (sous la toiture) : sa part est nulle, celle du dessous augmente', u.top.above === 0 && u.top.below > u.eq.below && near(u.top.below, 10 * kc / (2 * kb + kc), 1e-9));
  check('poteau du dessous deux fois plus raide : deux fois la part de celui du dessus', near(u.stiff.below / u.stiff.above, 2, 1e-9));
  check('sans charge d\'exploitation, aucun déséquilibre', near(u.dead.dM, 0, 1e-12) && u.dead.above === 0);
  check('travées inégales (6 m et 3 m) : la grande travée chargée domine, ΔM = (1,35 G + 1,5 Q)·36/12 − 1,35 G·9/12', near(u.long.dM, Math.max(Math.abs(21 * 36 / 12 - 13.5 * 9 / 12), Math.abs(13.5 * 36 / 12 - 21 * 9 / 12)), 1e-9), String(u.long.dM));
  const prop = await page.evaluate(() => { let bad = 0; for (let t = 0; t < 300; t++) { const e = () => ({ Gm: 2 + Math.random() * 20, Qm: Math.random() * 15, L: 2 + Math.random() * 5, Ib: 3e-4 + Math.random() * 1e-3 }), a = e(), b = e(), kA = Math.random() * 4e-4, kB = Math.random() * 4e-4, r = App.struct.unbalanced(a, b, kA, kB); if (r.dM < -1e-12 || r.above + r.below > r.dM + 1e-9 || Math.abs(r.above * kB - r.below * kA) > 1e-12 || r.above < 0 || r.below < 0) bad++; } return bad; });
  check('300 nœuds au hasard : parts positives, somme ≤ ΔM, proportionnelles aux rigidités', prop === 0, String(prop));
  // ---- in a plan: room 6 x 4 m, P2 (and P5) are inner columns on the 6 m walls
  await key('r'); await click(-3, -2); await click(3, 2); await key('d'); await click(0, -2); await key('f'); await click(3, 0); await key('v');
  await page.evaluate(() => { App.struct.autoColumns(); });
  const run = mod => page.evaluate(m => { App.edit(d => { Object.assign(d.struct.p, { nlev: 1, Q: 1.5, G2: 2, degr: true, found: 'isolees', sigSol: 0.2, frame: false }, m); }); return JSON.parse(JSON.stringify(App.struct.run())); }, mod);
  const expected = (r, c, key, kA, kB) => { const byId = Object.fromEntries(r.beams.map(b => [b.id, b])), [pa, pb] = c.node.pairs[0].beams.map(id => byId[id]), e = b => ({ Gm: b.slabG + b.self + b.wall, Qm: b.slabQ, L: b.L, Ib: b.b * Math.pow(b.h, 3) / 12 });
    const A = e(pa), B = e(pb), fl = x => (1.35 * x.Gm + 1.5 * x.Qm) * x.L * x.L / 12, fu = x => 1.35 * x.Gm * x.L * x.L / 12, dM = Math.max(Math.abs(fl(A) - fu(B)), Math.abs(fu(A) - fl(B))), sk = A.Ib / A.L + B.Ib / B.L + kA + kB; return { dM, above: dM * kA / sk, below: dM * kB / sk }; };
  const r1 = await run({}), H = r1.H, kcOf = a => Math.pow(a, 4) / 12 / H, p2 = r1.columns.find(c => c.label === 'P2');
  check('P2 est un poteau continu : une paire de poutres alignées (sens x), pas de poutre de rive', p2.node.pairs.length === 1 && p2.node.pairs[0].axis === 'x' && p2.node.rive.length === 0 && p2.continuous);
  const e1 = expected(r1, p2, 'T', 0, kcOf(p2.levels[0].a));
  check('un niveau : moment du poteau = ΔM·kc/(Σ k poutres + kc), recalculé avec les charges des poutres', near(p2.levels[0].Mx, e1.below, 1e-9) && p2.levels[0].My === 0 && near(p2.levels[0].alt.dMx, e1.dM, 1e-9), JSON.stringify([p2.levels[0].Mx, e1.below, p2.levels[0].alt]));
  check('le moment est pris en compte en flexion composée (excentricités, Mu = N·(e0 + ea + e2))', (() => { const l = p2.levels[0], b = l.bend; return !!b && near(b.e0, l.Mx / l.Nu, 1e-9) && near(b.Mu, l.Nu * (b.e0 + b.ea + b.e2), 1e-6) && b.AsFlex >= 3.2 - 1e-9; })());
  const r3 = await run({ nlev: 3 }), q2 = r3.columns.find(c => c.label === 'P2'), L = q2.levels, a = L.map(l => l.a);
  const eTop3 = expected(r3, q2, 'F', kcOf(a[1]), kcOf(a[2])), eMid3 = { top: expected(r3, q2, 'F', kcOf(a[0]), kcOf(a[1])), bot: expected(r3, q2, 'F', kcOf(a[1]), kcOf(a[1])) };
  check('3 niveaux, tronçon du RDC (nœud du plancher du bas) : ΔM·kc(a3)/(Σk + kc(a2) + kc(a3))', near(L[2].Mx, eTop3.below, 1e-9), JSON.stringify([L[2].Mx, eTop3.below]));
  check('tronçon intermédiaire : plus forte des deux parts (nœud du haut, nœud du bas), pas leur somme', near(L[1].Mx, Math.max(eMid3.top.below, eMid3.bot.above), 1e-9) && L[1].Mx < eMid3.top.below + eMid3.bot.above, JSON.stringify([L[1].Mx, eMid3.top.below, eMid3.bot.above]));
  check('les deux nœuds d\'un plancher courant donnent la même part (planchers identiques) : tronçons 2 et 3 comparables', L[1].alt.dMx > 0 && near(L[1].alt.dMx, L[2].alt.dMx, 1e-9));
  const light = await run({ Qtop: 0.5 }), heavy = await run({ Qtop: 5 });
  check('plus de charge d\'exploitation, plus de moment dans le poteau continu', heavy.columns.find(c => c.label === 'P2').levels[0].Mx > light.columns.find(c => c.label === 'P2').levels[0].Mx);
  // ---- the corner columns keep their end moments (rive) and are not given the alternate-loading term
  const c1 = r1.columns.find(c => c.label === 'P1'); check('poteau d\'angle : moment de rive seul (pas de paire de poutres alignées)', c1.node.pairs.length === 0 && c1.node.rive.length === 2 && c1.levels[0].alt.x === 0 && c1.levels[0].alt.y === 0);
  // ---- report and drawings
  const rep = await page.evaluate(() => App.struct.report(App.doc)); check('note de calcul : poteaux continus, chargement alterné, rigidités', /Poteaux continus/.test(rep) && /chargement alterné/.test(rep) && /rigidités I\/L/.test(rep) && /ΔM/.test(rep));
  const nd = await page.evaluate(() => { const m = App.rebar.model(App.doc), tmp = document.createElement('div'); tmp.innerHTML = App.rebar.viewHTML(App.doc, m, 'ND-P2'); const s = tmp.querySelector('svg'); return { ok: !!s && !new DOMParser().parseFromString(s.outerHTML, 'image/svg+xml').querySelector('parsererror') && s.querySelectorAll('line,path,rect,circle').length >= 15, svg: s ? s.textContent : '', txt: tmp.textContent }; });
  check('dessin du nœud continu : SVG bien formé, légendé, avec ΔM et la part du poteau', nd.ok && /poteau continu/.test(nd.svg) && /ΔM = /.test(nd.svg) && /Déséquilibre ΔM/.test(nd.txt) && /Part reprise par le poteau/.test(nd.txt), JSON.stringify([nd.ok, /poteau continu/.test(nd.svg), /ΔM = /.test(nd.svg), /Déséquilibre ΔM/.test(nd.txt), /Part reprise par le poteau/.test(nd.txt), nd.svg.slice(0, 120)]));
  await key('4'); await page.click('#ferList [data-v=ND-P2]'); check('mode Ferraillage : vue du nœud P2', /Nœud P2/.test(await page.textContent('#ferMain')) && /Poteau continu/.test(await page.textContent('#ferMain')));
  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.stack); process.exit(1); });
