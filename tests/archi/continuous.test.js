// Continuous beams: forfaitaire and Caquot methods against hand calculations, then chains in real plans.
const { check, launch } = require('./helper');
const near = (a, b, tol) => Math.abs(a - b) <= tol;
(async () => {
  const { browser, page, click, errors } = await launch(), key = k => page.keyboard.press(k);
  const run = spans => page.evaluate(s => App.struct.continuous(s.map(x => ({ L: x.L, Gm: x.G, Qm: x.Q, Gv: x.G, Qv: x.Q }))), spans);
  // ---- two equal spans, G = 10, Q = 5 kN/m, L = 4 m : p = 21, M0 = 42
  const two = await run([{ L: 4, G: 10, Q: 5 }, { L: 4, G: 10, Q: 5 }]);
  check('2 travées : méthode forfaitaire', two.method === 'forfaitaire' && !two.reasons.length);
  check('2 travées : M0 = 42 kN.m', near(two.spans[0].M0, 42, 1e-9) && near(two.spans[0].p, 21, 1e-9));
  check('2 travées : appui de rive 0,15 M0 = 6,3 et appui central 0,6 M0 = 25,2', near(two.spans[0].Mw, 6.3, 1e-9) && near(two.spans[0].Me, 25.2, 1e-9) && near(two.spans[1].Mw, 25.2, 1e-9) && near(two.spans[1].Me, 6.3, 1e-9));
  check('2 travées : Mt = 1,1·M0 − (6,3 + 25,2)/2 = 30,45 kN.m', near(two.spans[0].Mt, 30.45, 1e-9) && near(two.spans[1].Mt, 30.45, 1e-9), String(two.spans[0].Mt));
  check('2 travées : tranchant 42 kN à la rive, 46,2 kN (+10 %) sur l\'appui central', near(two.spans[0].Vl, 42, 1e-9) && near(two.spans[0].Vr, 46.2, 1e-9) && near(two.spans[1].Vl, 46.2, 1e-9) && near(two.spans[1].Vr, 42, 1e-9));
  // ---- three spans 4 - 5 - 4 m
  const three = await run([{ L: 4, G: 10, Q: 5 }, { L: 5, G: 10, Q: 5 }, { L: 4, G: 10, Q: 5 }]);
  check('3 travées : forfaitaire (rapports 0,8 et 1,25 admis)', three.method === 'forfaitaire', three.reasons.join());
  check('3 travées : appuis voisins de la rive 0,5·M0max = 32,81', near(three.spans[0].Me, 0.5 * 65.625, 1e-9) && near(three.spans[2].Mw, 0.5 * 65.625, 1e-9) && near(three.spans[1].Mw, 32.8125, 1e-9));
  check('3 travées : Mt de rive 27,3 (≥ 0,65 M0) et Mt intermédiaire 39,375', near(three.spans[0].Mt, 27.3, 1e-9) && near(three.spans[1].Mt, 39.375, 1e-9), JSON.stringify(three.spans.map(s => s.Mt)));
  check('3 travées : tranchant majoré de 15 % sur les deux premiers appuis intermédiaires', near(three.spans[0].Vr, 1.15 * 42, 1e-9) && near(three.spans[1].Vl, 1.15 * 52.5, 1e-9) && near(three.spans[1].Vr, 1.15 * 52.5, 1e-9) && near(three.spans[2].Vl, 1.15 * 42, 1e-9));
  const prop = await page.evaluate(() => { let bad = 0; for (let t = 0; t < 200; t++) { const n = 1 + Math.floor(Math.random() * 5), L0 = 2 + Math.random() * 4, sp = Array.from({ length: n }, () => { const G = 3 + Math.random() * 12; return { L: L0 * (0.85 + 0.3 * Math.random()), Gm: G, Qm: Math.random() * 1.5 * G, Gv: G, Qv: 0 }; }); sp.forEach(s => { s.Qv = s.Qm; });
      const r = App.struct.continuous(sp); r.spans.forEach(s => { const a = s.alpha; if (s.Mt + (s.Mw + s.Me) / 2 < Math.max(1.05, 1 + 0.3 * a) * s.M0 - 1e-6 && r.method === 'forfaitaire') bad++; }); } return bad; });
  check('forfaitaire : Mt + (Mw + Me)/2 ≥ max(1,05 ; 1 + 0,3α)·M0 sur 200 files au hasard', prop === 0, String(prop));
  // ---- Caquot when the spans are too different or Q > 2G
  const cq = await run([{ L: 4, G: 10, Q: 5 }, { L: 6, G: 10, Q: 5 }]);
  check('portées 4 et 6 m : rapport 0,67, méthode de Caquot', cq.method === 'caquot' && /0,67/.test(cq.reasons.join()), cq.reasons.join());
  check('Caquot : M appui = (p·l\'₁³ + p·l\'₂³)/(8,5·(l\'₁ + l\'₂)) = 69,18 kN.m', near(cq.spans[0].Me, (21 * 64 + 21 * 216) / (8.5 * 10), 1e-9) && near(cq.spans[0].Me, cq.spans[1].Mw, 1e-9), String(cq.spans[0].Me));
  check('Caquot : la somme des tranchants égale la charge totale (équilibre)', near(cq.spans.reduce((s, x) => s + x.Vl + x.Vr, 0), 21 * 10, 1e-9));
  check('Caquot : le tranchant augmente côté du plus grand moment d\'appui', cq.spans[1].Vl > cq.spans[1].Vr);
  const qg = await run([{ L: 4, G: 2, Q: 6 }, { L: 4, G: 2, Q: 6 }]); check('Q > 2G : méthode de Caquot', qg.method === 'caquot' && /Q > 2G/.test(qg.reasons.join()));
  const eq = await page.evaluate(() => { const r = App.struct.continuous([{ L: 4, Gm: 2, Qm: 6, Gv: 2, Qv: 6 }, { L: 4, Gm: 2, Qm: 6, Gv: 2, Qv: 6 }]); return r.spans.map(s => s.Mt); }); check('Caquot : moments de travée positifs', eq.every(v => v > 0), eq.join());
  const one = await run([{ L: 6, G: 10, Q: 5 }]); check('travée isolée : appuis 0,15 M0 et Mt = 1,1 M0 − 0,15 M0', one.spans[0].endW === 'rive' && near(one.spans[0].Mw, 0.15 * one.spans[0].M0, 1e-9) && near(one.spans[0].Mt, 1.1 * one.spans[0].M0 - 0.15 * one.spans[0].M0, 1e-9));
  // ---- in a real plan: room 6 x 4 m, columns every <= 4,5 m -> the 6 m walls are chains of two 3 m spans
  await key('r'); await click(-3, -2); await click(3, 2); await key('d'); await click(0, -2); await key('v');
  await page.evaluate(() => { App.struct.autoColumns(); App.struct.run(); });
  const r = await page.evaluate(() => JSON.parse(JSON.stringify(App.doc.struct.result)));
  check('4 files de poutres : 2 files de 2 travées (murs de 6 m) et 2 travées isolées (murs de 4 m)', r.chains.length === 4 && r.chains.filter(c => c.beams.length === 2).length === 2 && r.chains.filter(c => c.beams.length === 1).length === 2, JSON.stringify(r.chains));
  check('files continues : méthode forfaitaire', r.chains.every(c => c.method === 'forfaitaire'));
  const cont = r.beams.filter(b => b.nSpans === 2), single = r.beams.filter(b => b.nSpans === 1);
  check('travées d\'une même file : même section', ['PO1', 'PO2'].every(id => true) && cont.every(b => cont.filter(c => c.chain === b.chain).every(c => c.b === b.b && c.h === b.h)));
  check('file de 2 travées : appui central 0,6·M0 et appui de rive 0,15·M0', cont.every(b => near(Math.max(b.MA, b.MB), 0.6 * b.M0, 1e-6) && near(Math.min(b.MA, b.MB), 0.15 * b.M0, 1e-6)), cont.map(b => [b.MA, b.MB, b.M0].map(v => v.toFixed(1)).join('/')).join(' '));
  check('file de 2 travées : Mt = (1,05 ou 1 + 0,3α)·M0 − 0,375·M0 (< 0,85·M0 de la travée isolée)', cont.every(b => near(b.Mt, Math.max(Math.max(1.05, 1 + 0.3 * b.alpha) * b.M0 - 0.375 * b.M0, (1.2 + 0.3 * b.alpha) / 2 * b.M0), 1e-6) && b.Mt < 0.85 * b.M0));
  check('travée isolée : appuis 0,15·M0', single.every(b => near(b.MA, 0.15 * b.M0, 1e-6) && near(b.MB, 0.15 * b.M0, 1e-6)));
  check('l\'appui continu est identifié comme tel', cont.every(b => (b.endA === 'rive') !== (b.endB === 'rive')) && single.every(b => b.endA === 'rive' && b.endB === 'rive'));
  const col = Object.fromEntries(r.columns.map(c => [c.label, c]));
  check('poteau d\'appui central plus chargé que les poteaux de coin', r.columns.some(c => c.continuous) && Math.max(...r.columns.filter(c => c.continuous).map(c => c.Nu)) > Math.max(...r.columns.filter(c => !c.continuous).map(c => c.Nu)), r.columns.map(c => c.label + ':' + c.Nu.toFixed(0)).join(' '));
  const tot = await page.evaluate(() => { const r = App.doc.struct.result, p = r.slab.panels[0], slab = p.pu * p.lx * p.ly, line = r.beams.reduce((s, b) => s + 1.35 * (b.self + b.wall) * b.L, 0); return { slab, line, Nu: r.totals.Nu }; });
  check('équilibre : la somme des charges poteaux dépasse les charges appliquées de 0 à 12 % (effet de continuité inclus)', tot.Nu >= (tot.slab + tot.line) * 0.999 && tot.Nu <= (tot.slab + tot.line) * 1.12 + 40, JSON.stringify(tot));
  check('tranchant de calcul = max des deux extrémités ; τu = Vu/(b·d)', r.beams.every(b => near(b.tau, b.Vu / 1000 / (b.b * b.d), 1e-9)));
  // ---- the three-column frame with unequal spans uses Caquot
  await page.evaluate(() => App.setDoc(App.newDoc())); await key('p'); await click(-4, 0); await click(-1, 0); await click(5, 0); await key('b'); await click(-4, 0); await click(-1, 0); await click(5, 0); await key('Escape'); await key('v');
  const cq2 = await page.evaluate(() => { const r = App.struct.run(); return { m: r.chains.map(c => c.method), w: r.warnings.filter(x => /Caquot/.test(x)), n: r.beams.map(b => b.nSpans) }; });
  check('trois poteaux alignés, portées 3 m et 6 m : une file de 2 travées calculée par Caquot', cq2.n.join() === '2,2' && cq2.m.join() === 'caquot' && cq2.w.length === 1, JSON.stringify(cq2));
  // ---- report and drawings mention the continuity
  const rep = await page.evaluate(() => App.struct.report(App.doc)); check('note de calcul : colonne Continuité et méthode de Caquot', /Continuité/.test(rep) && /Caquot/.test(rep) && /B\.6\.2,22/.test(rep));
  // ---- reinforcement: chapeaux lengths follow the supports
  await page.evaluate(() => App.setDoc(App.newDoc())); await key('r'); await click(-3, -2); await click(3, 2); await key('v');
  await page.evaluate(() => { App.struct.autoColumns(); App.edit(d => { d.struct.p.nlev = 3; d.struct.p.Q = 5; }); App.struct.run(); });
  const rb = await page.evaluate(() => { const m = App.rebar.model(App.doc); return m.beams.map(e => ({ id: e.id, a: e.chapA && { n: e.chapA.n, d: e.chapA.d, cap: e.capA, end: e.endA, aA: e.aA, len: (e.bars.find(b => b.mark === e.mk.A) || {}).len }, b: e.chapB && { n: e.chapB.n, d: e.chapB.d, cap: e.capB, end: e.endB, aB: e.aB, len: (e.bars.find(b => b.mark === e.mk.B) || {}).len } })); });
  const any = rb.filter(x => x.a || x.b); check('avec 3 niveaux et Q = 5 : des chapeaux sont nécessaires', any.length > 0, JSON.stringify(rb));
  check('chapeaux : longueur = L_chapeau + a/2 (appui continu) ou + a/2 − 3 cm + crochet de 20 Ø (rive)', any.every(x => [[x.a, 'aA'], [x.b, 'aB']].every(([c, ak]) => !c || near(c.len, c.cap + (c[ak]) / 2 + (c.end === 'rive' ? -0.03 + 20 * c.d / 1000 : 0), 1e-9))), JSON.stringify(any[0]));
  check('chapeaux : 0,2 à 0,25 fois la portée de part et d\'autre de l\'appui', any.every(x => [x.a, x.b].every(c => !c || (c.cap >= 0.2 * 3 - 1e-9 && c.cap <= 0.25 * 4 + 1e-9))), JSON.stringify(any.map(x => [x.a && x.a.cap, x.b && x.b.cap])));
  await page.keyboard.press('4'); await page.click('#ferList [data-v=PO1]'); check('plan de ferraillage : poutre continue légendée', /Poutre continue de 2 travées/.test(await page.textContent('#ferMain')) && /forfaitaire/.test(await page.textContent('#ferMain')));
  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.stack); process.exit(1); });
