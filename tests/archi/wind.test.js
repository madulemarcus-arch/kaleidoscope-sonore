// Cracked sections and wind in the frame analysis: hand calculations of the solver, then the whole chain on a plan.
const { check, launch } = require('./helper');
const near = (a, b, tol) => Math.abs(a - b) <= tol;
(async () => {
  const { browser, page, click, errors } = await launch(), key = k => page.keyboard.press(k);
  const E = 30e6, Ib = 0.2 * Math.pow(0.4, 3) / 12, Ic = Math.pow(0.25, 4) / 12;
  // ---- cracked sections, hand calculation of a portal (pinned bases, symmetric load): M = FEM · kc / (kb + kc), kb = 2EI/L, kc = 3EI/h
  const c = await page.evaluate(([E, Ib, Ic]) => { const S = App.struct, w = 40, L = 6, h = 3, run = (fb, fc) => S.frame({ L: [L], N: 1, H: h, bI: [fb * Ib], bA: [0.1], cI: [[fc * Ic], [fc * Ic]], cA: [[0.0625], [0.0625]], pmaxT: [w], pminT: [w], pmaxF: [w], pminF: [w], E, base: 'pin' }).env[0][0].M;
    return { gross: run(1, 1), same: run(0.5, 0.5), crack: run(0.35, 0.7) }; }, [E, Ib, Ic]);
  const hand = (fb, fc) => { const fem = 40 * 36 / 12, kb = 2 * E * fb * Ib / 6, kc = 3 * E * fc * Ic / 3; return fem * kc / (kb + kc); };
  check('portique, charge verticale : moment du poteau = FEM·kc/(kb + kc) (sections brutes)', near(c.gross, hand(1, 1), hand(1, 1) * 0.01), JSON.stringify([c.gross, hand(1, 1)]));
  check('même facteur sur poutres et poteaux : moments inchangés (à 0,2 % près : les rigidités axiales ne sont pas réduites)', near(c.same, c.gross, c.gross * 2e-3), JSON.stringify([c.same, c.gross]));
  check('sections fissurées (poutre × 0,35, poteau × 0,70) : moment recalculé à la main', near(c.crack, hand(0.35, 0.7), hand(0.35, 0.7) * 0.01), JSON.stringify([c.crack, hand(0.35, 0.7)]));
  check('poutre plus souple que le poteau : le poteau prend plus de moment', c.crack > c.gross);
  // ---- wind on a one-storey portal, F = 10 kN at the roof, beam 1000 times stiffer: columns work as cantilevers sharing the shear
  const w = await page.evaluate(([E, Ic]) => { const S = App.struct, F = 10, mk = base => S.frame({ L: [6], N: 1, H: 3, bI: [1e3], bA: [0.1], cI: [[Ic], [Ic]], cA: [[0.0625], [0.0625]], pmaxT: [0], pminT: [0], pmaxF: [0], pminF: [0], E, base, wind: { F: [F], gT: [0], qT: [0], gF: [0], qF: [0], psi: 0.77 } }),
      pin = mk('pin'), fix = mk('fix'), pat = (r, n) => r.patterns.find(q => q.name === n); const a = pat(pin, 'tout chargé + vent →'), b = pat(pin, 'tout chargé + vent ←'), f = pat(fix, 'tout chargé + vent →');
    return { pinTop: a.cols[0][0].top, pinBot: a.cols[0][0].bot, fixTop: f.cols[0][0].top, fixBot: f.cols[0][0].bot, dN: pin.patterns.find(q => q.name === 'tout chargé + vent →').dN, dNneg: b.dN, shear: a.Rh, Rv: a.R, envW: pin.envW[0][0], envW1: pin.envW[1][0], nPat: pin.patterns.length }; }, [E, Ic]);
  check('14 + 14 cas de vent + 7 de gravité + 2 « G + vent » = 37 dispositions', w.nPat === 7 + 2 * 8, String(w.nPat));
  check('pieds articulés : moment en tête de chaque poteau = (1,5·F/2)·h = 22,5 kN.m, nul en pied', near(w.pinTop, 22.5, 0.3) && near(w.pinBot, 0, 1e-6), JSON.stringify([w.pinTop, w.pinBot]));
  check('pieds encastrés : moment en tête et en pied = 1,5·F·h/4 = 11,25 kN.m', near(w.fixTop, 11.25, 0.15) && near(w.fixBot, 11.25, 0.15), JSON.stringify([w.fixTop, w.fixBot]));
  check('effort tranchant à la base : somme = 1,5·F = 15 kN', near(Math.abs(w.shear[0] + w.shear[1]), 15, 1e-6), JSON.stringify(w.shear));
  check('renversement (pieds articulés) : couple des réactions verticales = 1,5·F·H / L = 7,5 kN', near(w.dN[1][0], 7.5, 1e-6) && near(w.dN[0][0], -7.5, 1e-6) && near(w.Rv[0] + w.Rv[1], 0, 1e-6), JSON.stringify([w.dN, w.Rv]));
  check('vent de sens contraire : efforts normaux et moments opposés', near(w.dNneg[0][0], 7.5, 1e-6) && near(w.dNneg[1][0], -7.5, 1e-6));
  check('enveloppe : cas sans charge d\'exploitation (G + 1,5 W) et avec, moment 22,5 kN.m', w.envW.live && w.envW.dead && near(w.envW.live.M, 22.5, 0.3) && near(w.envW.dead.M, 22.5, 0.3) && w.envW.dead.gfac === 1 && near(w.envW.live.gfac, 1.35, 1e-12), JSON.stringify(w.envW));
  // ---- on a plan: 6 x 4 m room, 3 levels
  await key('r'); await click(-3, -2); await click(3, 2); await key('d'); await click(0, -2); await key('f'); await click(3, 0); await key('v');
  await page.evaluate(() => { App.struct.autoColumns(); });
  const run = mod => page.evaluate(m => { App.edit(d => { Object.assign(d.struct.p, { nlev: 3, Q: 1.5, G2: 2, found: 'isolees', sigSol: 0.2, degr: true, frame: true, crack: true, vent: 0 }, m); }); return JSON.parse(JSON.stringify(App.struct.run())); }, mod);
  const r0 = await run({}), rg = await run({ crack: false }), rw = await run({ vent: 1.0 });
  const mx = (r, f) => Math.max(...r.columns.map(cc => Math.max(...cc.levels.map(f))));
  check('sans vent : aucune donnée de vent', r0.wind === null);
  check('sections fissurées : moments des poteaux ≥ ceux des sections brutes (poutres plus souples), et strictement plus grands quelque part', mx(r0, l => Math.max(l.Mx, l.My)) >= mx(rg, l => Math.max(l.Mx, l.My)) - 1e-9 && mx(r0, l => Math.max(l.Mx, l.My)) > mx(rg, l => Math.max(l.Mx, l.My)) + 1e-6, JSON.stringify([mx(r0, l => Math.max(l.Mx, l.My)), mx(rg, l => Math.max(l.Mx, l.My))]));
  check('avec vent : résultats de vent présents, pression 1,0 × Cp 1,3 = 1,3 kN/m²', !!rw.wind && near(rw.wind.q, 1.3, 1e-12) && near(rw.wind.Cp, 1.3, 1e-12), JSON.stringify(rw.wind && [rw.wind.q, rw.wind.Cp]));
  const H = rw.H, W = rw.wind, dx = W.dirs.x, dy = W.dirs.y;
  // sens x: portiques le long de x (files de poutres de 6 m); un portique par file, largeur d'influence = demi-distance entre files
  check('forces par plancher : demi-étage en haut, étage entier ensuite, F = q·largeur·H', dx && near(dx.F[0], 1.3 * dx.width * H / 2, 1e-9) && near(dx.F[1], 1.3 * dx.width * H, 1e-9) && near(dx.F[2], 1.3 * dx.width * H, 1e-9) && near(dx.Ftot, 1.3 * dx.width * H * 2.5, 1e-9), JSON.stringify(dx && [dx.F, dx.width]));
  check('moment de renversement = Σ F·hauteur du plancher au-dessus du sol', near(dx.Mo, dx.F[0] * 3 * H + dx.F[1] * 2 * H + dx.F[2] * H, 1e-9));
  check('stabilité : Ms = G·B/2 et coefficient = Ms/Mo, drapeau ok ⇔ ≥ 1,5', near(dx.Ms, dx.Gtot * dx.B / 2, 1e-9) && near(dx.fs, dx.Ms / dx.Mo, 1e-9) && dx.ok === (dx.fs >= 1.5));
  check('la somme des largeurs d\'influence couvre la façade (≥ la largeur entre poteaux extrêmes)', dx.width >= 4 - 1e-9 && dx.rows.length >= 2, JSON.stringify(dx.rows));
  const withWind = rw.columns.filter(cc => cc.levels.some(l => l.wind && !l.wind.uplift));
  check('chaque tronçon de poteau a une vérification au vent (combinaison, Nu, Mu, aciers)', rw.columns.every(cc => cc.levels.every(l => l.wind && (l.wind.uplift || (l.wind.Nu > 0 && l.wind.Mu > 0 && l.wind.As > 0)))), JSON.stringify(rw.columns[0].levels.map(l => l.wind && [l.wind.key, l.wind.Nu, l.wind.As])));
  check('Nu au vent = G·gfac (+ 1,3·0,77·Q) + effort normal dû au vent seul', withWind.every(cc => cc.levels.every(l => !l.wind || l.wind.uplift || near(l.wind.Nu, l.wind.gfac * l.G + (l.wind.gfac > 1 ? 1.3 * 0.77 * l.Q : 0) + l.wind.dN, 1e-6))));
  check('le vent ne diminue jamais les aciers (As ≥ sans vent)', rw.columns.every((cc, i) => cc.levels.every((l, k) => l.bars.As >= r0.columns[i].levels[k].bars.As - 1e-9)) && rw.columns.some((cc, i) => cc.levels.some((l, k) => l.bars.As > r0.columns[i].levels[k].bars.As + 1e-9 || l.a > r0.columns[i].levels[k].a + 1e-9)));
  const big = await run({ vent: 3, nlev: 8 }), bw = Object.entries(big.wind.dirs).filter(([, d]) => !d.none);
  check('vent fort sur 8 niveaux : une alerte de renversement par sens dont le coefficient Ms/Mo est < 1,5', bw.every(([ax, d]) => (d.fs < 1.5) === big.warnings.some(x => new RegExp('sens ' + ax + ' : stabilité au renversement').test(x))) && bw.some(([, d]) => d.fs < 1.5), JSON.stringify(bw.map(([ax, d]) => [ax, d.fs])));
  // ---- report, panel
  await run({ vent: 1.0 });
  const rep = await page.evaluate(() => App.struct.report(App.doc)); check('note de calcul : 4 ter Vent, Cp, combinaisons, stabilité', /4 ter\. Vent/.test(rep) && /1,35 G \+ 1,5 W \+ 1,3·ψ0·Q/.test(rep) && /G \+ 1,5 W/.test(rep) && /Ms \/ Mo/.test(rep) && /sections fissurées/.test(rep));
  await run({ vent: 0, crack: false }); const rep2 = await page.evaluate(() => App.struct.report(App.doc)); check('sans vent ni fissuration : pas de section vent, hypothèse « non fissurées »', !/4 ter/.test(rep2) && /non fissurées/.test(rep2));
  await key('2'); await page.evaluate(() => { const b = document.querySelector('[data-panel=struct],#tabStruct,[data-tab=struct]'); if (b) b.click(); });
  const ui = await page.evaluate(() => ({ crack: !!document.querySelector('#structBox [data-s=crack]'), vent: !!document.querySelector('#structBox [data-s=vent]') }));
  check('panneau Structure : case « sections fissurées » et champ « vent »', ui.crack && ui.vent, JSON.stringify(ui));
  await page.evaluate(() => { const i = document.querySelector('#structBox [data-s=vent]'); i.value = '0.8'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  check('saisie du vent : paramètre enregistré et résultats périmés', await page.evaluate(() => App.doc.struct.p.vent === 0.8 && App.struct.stale()));
  await page.evaluate(() => { const i = document.querySelector('#structBox [data-s=crack]'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
  check('case fissuration : paramètre enregistré', await page.evaluate(() => App.doc.struct.p.crack === true));
  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.stack); process.exit(1); });
