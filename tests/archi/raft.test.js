// Raft foundation (radier nervuré): geometry, loads, hand calculations, selection rules, drawings and quantities.
const { check, launch } = require('./helper');
const near = (a, b, tol) => Math.abs(a - b) <= tol;
(async () => {
  const { browser, page, click, errors } = await launch(), key = k => page.keyboard.press(k);
  // room 6 x 4 m, columns every <= 4,5 m (6 columns), one slab panel of 4 x 6 m
  await key('r'); await click(-3, -2); await click(3, 2); await key('d'); await click(0, -2); await key('f'); await click(3, 0); await key('v');
  await page.evaluate(() => { App.struct.autoColumns(); });
  const run = mod => page.evaluate(m => { App.edit(d => { Object.assign(d.struct.p, { found: 'auto', sigSol: 0.2, nlev: 1, Q: 1.5 }, m); }); return JSON.parse(JSON.stringify(App.struct.run())); }, mod);
  const auto = await run({}); check('sol normal : pas de radier (les semelles isolées couvrent 5 % de l\'emprise)', !auto.raft && auto.footRatio < 0.5 && auto.columns.every(c => !c.raft), String(auto.footRatio));
  const r = await run({ found: 'radier' }); const rf = r.raft;
  check('radier demandé : calculé, sans erreur', !!rf && r.errors.length === 0 && !rf.failed && !rf.soilFailed, JSON.stringify(r.warnings));
  check('tous les poteaux reposent sur le radier, plus de semelle ni de semelle filante', r.columns.every(c => c.raft && !c.strips) && r.strips.length === 0);
  check('radier centré sur la résultante des charges de service (pression uniforme)', near((rf.x0 + rf.x1) / 2, rf.xR, 1e-9) && near((rf.y0 + rf.y1) / 2, rf.yR, 1e-9));
  const cx = r.columns.reduce((s, c) => s + c.Ns * c.p[0], 0) / r.columns.reduce((s, c) => s + c.Ns, 0), cy = r.columns.reduce((s, c) => s + c.Ns * c.p[1], 0) / r.columns.reduce((s, c) => s + c.Ns, 0);
  check('résultante recalculée à partir des poteaux', near(rf.xR, cx, 1e-9) && near(rf.yR, cy, 1e-9));
  check('emprise = débord (0,5 m au moins) autour des poteaux extrêmes', rf.rim >= 0.5 && near(rf.Lx, 2 * (Math.max(rf.xR - (-3), 3 - rf.xR) + rf.rim), 1e-9) && near(rf.S, rf.Lx * rf.Ly, 1e-9), JSON.stringify([rf.Lx, rf.Ly, rf.rim]));
  check('pression nette ELU : qu = ΣNu / S', near(rf.qu, rf.sNu / rf.S, 1e-9) && near(rf.sNu, r.columns.reduce((s, c) => s + c.Nu, 0), 1e-6), String(rf.qu));
  check('poids du radier = 25 × (S·e + nervures sous la dalle) et σ = (ΣNs + W)/S', near(rf.W, 25 * rf.conc, 1e-9) && near(rf.conc, rf.S * rf.e + rf.nerv.reduce((s, n) => s + n.b * (n.h - rf.e) * n.L, 0), 1e-9) && near(rf.sigma, (rf.sNs + rf.W) / rf.S / 1000, 1e-12));
  check('pression du sol ≤ admissible', rf.sigma <= 0.2);
  // slab panel: coefficients of annex E3 for lx = 4, ly = 6 under qu
  const pn = rf.panels[0], mu = a => ({ x: 1 / (8 * (1 + 2.4 * Math.pow(a, 3))), y: a * a * (1 - 0.95 * Math.pow(1 - a, 2)) });
  check('un panneau de 4 × 6 m', rf.panels.length === 1 && near(pn.lx, 4, 1e-9) && near(pn.ly, 6, 1e-9));
  check('panneau : M0x = μx·qu·lx² avec μx = 0,0731', near(pn.mux, mu(4 / 6).x, 1e-9) && near(pn.M0x, mu(4 / 6).x * rf.qu * 16, 1e-6) && near(pn.M0y, mu(4 / 6).y * pn.M0x, 1e-6));
  check('dalle : e ≥ lx/20 et ≥ 20 cm ; cisaillement admissible', rf.e >= 0.20 - 1e-9 && rf.e >= 4 / 20 - 1e-9 && pn.tau <= pn.tauLim + 1e-9, String(rf.e));
  check('panneau : armatures de travée (face supérieure) et chapeaux (face inférieure) choisies', /^HA\d+ e=\d+$/.test(pn.barTx.text) && /^HA\d+ e=\d+$/.test(pn.barAx.text));
  // rim cantilever
  check('console de débord : M = qu·d²/2', near(rf.dbord.M, rf.qu * rf.rim * rf.rim / 2, 1e-9) && /^HA\d+ e=\d+$/.test(rf.dbord.bar.text));
  // ribs: 4 m rib on the short side, triangle load qu·lx/3 plus the rim load qu·d
  check('6 nervures sous les 6 poutres', rf.nerv.length === 6);
  const nv = rf.nerv.find(n => near(n.L, 4, 1e-9)), w = rf.qu * (4 / 3 + rf.rim), M0 = w * 16 / 8;
  check('nervure de 4 m : charge qu·(lx/3 + débord), M0 = w·L²/8', near(nv.M0, M0, 1e-6), JSON.stringify([nv.M0, M0]));
  check('nervure isolée : appuis 0,15·M0 et travée 1,05·M0 − 0,15·M0 = 0,9·M0', near(nv.MA, 0.15 * M0, 1e-6) && near(nv.MB, 0.15 * M0, 1e-6) && near(nv.Mt, 0.9 * M0, 1e-6));
  check('nervure : section ≥ 30 × 40 et plus haute que la dalle + 20 cm', r.raft.nerv.every(n => n.b >= 0.3 - 1e-9 && n.h >= 0.4 - 1e-9 && n.h >= rf.e + 0.2 - 1e-9));
  check('nervures : τu = Vu/(b·d) ≤ limite', rf.nerv.every(n => near(n.tau, n.Vu / 1000 / (n.b * n.d), 1e-9) && n.tau <= 2.5 + 1e-9));
  check('files de 2 travées (murs de 6 m) : méthode forfaitaire, appui central 0,6·M0', rf.nerv.filter(n => n.nSpans === 2).length === 4 && rf.nerv.filter(n => n.nSpans === 2).every(n => n.method === 'forfaitaire' && near(Math.max(n.MA, n.MB), 0.6 * n.M0, 1e-6)));
  // equilibrium: the rib loads carry the whole pressure over the panels and the rim
  check('équilibre : Σ(charges de nervure × portée) = qu·(aire des panneaux + débord × périmètre)', near(rf.ribLoad, rf.qu * (24 + rf.rim * rf.perimLen), 1e-6), JSON.stringify([rf.ribLoad, rf.qu * (24 + rf.rim * rf.perimLen), rf.perimLen]));
  check('débord de poteau : hauteur de pied = hauteur de la nervure la plus haute', r.columns.every(c => c.fh >= rf.e && c.fh === Math.max(rf.e, ...rf.nerv.filter(n => n.ca === c.id || n.cb === c.id).map(n => n.h))));
  check('avertissement de pré-dimensionnement du radier', r.warnings.some(w => /Radier nervuré : pré-dimensionnement/.test(w)));
  // ---- automatic selection and fallbacks
  const soft = await run({ sigSol: 0.05, nlev: 4, Q: 5 }); check('sol faible et charges fortes : radier retenu automatiquement (semelles ≥ 50 % de l\'emprise)', !!soft.raft && soft.footRatio >= 0.5 && soft.warnings.some(w => /Radier retenu automatiquement/.test(w)), String(soft.footRatio));
  check('radier : le débord augmente si le sol est plus faible', soft.raft.rim >= rf.rim && near(soft.raft.sigma, (soft.raft.sNs + soft.raft.W) / soft.raft.S / 1000, 1e-12), String(soft.raft.rim));
  check('radier : pression ≤ admissible ou avertissement', soft.raft.sigma <= 0.05 + 1e-9 || soft.warnings.some(w => /dépasse l'admissible/.test(w)));
  const iso = await run({ found: 'isolees', sigSol: 0.05, nlev: 4, Q: 5 }); check('mode « isolées » : jamais de radier', !iso.raft && iso.columns.every(c => !c.raft));
  const fil = await run({ found: 'filantes' }); check('mode « filantes » : jamais de radier', !fil.raft && fil.strips.length === 4);
  const none = await page.evaluate(() => { App.setDoc(App.newDoc()); App.edit(d => { [-2, 0, 2].forEach(x => d.items.push({ id: App.uid(), t: 'col', p: [x, 0], a: 0.2, layer: 'str' })); d.items.push({ id: 'w', t: 'wall', a: [-2, 0], b: [2, 0], th: 0.2, h: 2.8, layer: 'mur' }); d.struct.p.found = 'radier'; }); const r = App.struct.run(); return { raft: !!r.raft, w: r.warnings.filter(x => /Radier : aucune dalle/.test(x)).length, foot: r.columns.every(c => !c.raft) }; });
  check('sans panneau de dalle fermé : pas de radier, avertissement, semelles à la place', !none.raft && none.w === 1 && none.foot);
  // ---- reinforcement model, drawings, quantities
  await page.evaluate(() => App.setDoc(App.newDoc())); await key('r'); await click(-3, -2); await click(3, 2); await key('v');
  await page.evaluate(() => { App.struct.autoColumns(); App.edit(d => { d.struct.p.found = 'radier'; }); App.struct.run(); });
  const mdl = await page.evaluate(() => { const m = App.rebar.model(App.doc); return { foots: m.foots.length, strips: m.strips.length, nerv: m.nerv.map(n => ({ id: n.id, L: n.L, aA: n.aA, aB: n.aB, bars: n.bars, kg: n.kg })), rs: m.rslabs.map(s => ({ id: s.id, bars: s.bars, tx: s.tx, ty: s.ty, w: s.w, h: s.h, lx: s.lx, ly: s.ly, kg: s.kg, conc: s.conc, thick: s.thick })), raft: m.raft, tot: m.totals.raft, all: m.totals.all, cols: m.cols.map(c => ({ b: c.bars[0].len, H: m.H, d: c.d, fh: c.fh })), byD: m.byDiameter }; });
  check('ferraillage : pas de semelle, 6 nervures, 1 panneau, 1 radier', mdl.foots === 0 && mdl.strips === 0 && mdl.nerv.length === 6 && mdl.rs.length === 1 && mdl.raft && mdl.raft.id === 'RAD');
  const nv4 = mdl.nerv.find(n => Math.abs(n.L - 4) < 1e-9), b1 = nv4.bars[0];
  check('nervure : barres principales de travée, longueur L + a − 6 cm + 2 crochets de 20 Ø', /côté dalle/.test(b1.desc) && near(b1.len, 4 + 0.2 - 0.06 + 2 * 20 * b1.d / 1000, 1e-9), JSON.stringify(b1));
  const rs = mdl.rs[0]; check('panneau : lits supérieur et inférieur, nombre de barres = ⌊largeur/espacement⌋ + 1', /face supérieure/.test(rs.bars[0].desc) && /face inférieure/.test(rs.bars[1].desc) && rs.bars[0].n === Math.floor(rs.ly * 100 / rs.tx.e + 1e-9) + 1 && near(rs.bars[0].len, 4, 1e-9), JSON.stringify(rs.bars.map(b => b.n)));
  const rim = mdl.raft; check('débord : barres perpendiculaires au bord, longueur = débord + 50 cm + équerre 12 Ø', near(rim.bars[0].len, rim.rim + 0.5 + 12 * rim.bars[0].d / 1000, 1e-9) && rim.bars[0].n === Math.floor(2 * (rim.Lx + rim.Ly) / (/e=(\d+)/.exec(rim.bars[0].desc)[1] / 100)) + 1, JSON.stringify(rim.bars[0]));
  check('béton du radier = S·e + nervures sous la dalle', near(mdl.tot.conc, rim.conc, 1e-9) && rim.conc > rim.S * rim.e);
  check('acier du radier = débord + panneaux + nervures', near(mdl.tot.kg, rim.kg + mdl.rs.reduce((s, x) => s + x.kg, 0) + mdl.nerv.reduce((s, x) => s + x.kg, 0), 1e-9));
  check('métré total = Σ des ouvrages et Σ des diamètres', await page.evaluate(() => { const m = App.rebar.model(App.doc); return Math.abs(m.byDiameter.reduce((s, x) => s + x.kg, 0) - m.totals.all.kg) < 1e-6; }));
  check('poteaux : pied descendu au fond de la nervure (hauteur fh)', mdl.cols.every(c => near(c.b, c.H - 0.03 + (c.fh - 0.05) + 12 * c.d / 1000, 1e-9)));
  const views = await page.evaluate(() => App.rebar.views(App.rebar.model(App.doc)).map(v => v.id)); check('vues : RAD, NV1 à NV6, RP1 ; pas de semelles', ['RAD', 'NV1', 'NV6', 'RP1'].every(v => views.includes(v)) && !views.some(v => /^S\d|^SF/.test(v)), views.join());
  const bad = await page.evaluate(() => { const m = App.rebar.model(App.doc), out = []; App.rebar.views(m).forEach(v => { const tmp = document.createElement('div'); tmp.innerHTML = App.rebar.viewHTML(App.doc, m, v.id); tmp.querySelectorAll('svg').forEach(s => { if (new DOMParser().parseFromString(s.outerHTML, 'image/svg+xml').querySelector('parsererror') || !s.querySelectorAll('line,path,rect,circle').length) out.push(v.id); }); if (!tmp.querySelector('svg') && v.id !== 'qty') out.push(v.id + ' (vide)'); }); return out; });
  check('toutes les vues (radier, nervures, panneau, poteaux, plan) : SVG bien formés', bad.length === 0, bad.join());
  await key('4'); await click(0, 0).catch(() => {}); await page.click('#ferList [data-v=RAD]'); check('mode Ferraillage : plan du radier', /Radier nervuré/.test(await page.textContent('#ferMain')) && (await page.$$('#ferMain svg')).length === 1);
  await page.click('#ferList [data-v=NV3]'); check('mode Ferraillage : nervure retournée', /dessinée retournée/.test(await page.textContent('#ferMain')) || /Nervure de radier/.test(await page.innerHTML('#ferMain')));
  await page.click('#ferList [data-v=qty]'); check('métré : ligne Radier nervuré', /Radier nervuré/.test(await page.textContent('#ferMain')));
  const rep = await page.evaluate(() => App.struct.report(App.doc)); check('note de calcul : section 6 Radier nervuré, tableaux des panneaux et des nervures', /6\. Radier nervuré/.test(rep) && /NV1/.test(rep) && /RP1/.test(rep) && /sur le radier/.test(rep));
  // ---- UI
  await key('2'); await page.selectOption('#structBox [data-s=found]', 'auto'); await page.selectOption('#structBox [data-s=found]', 'radier'); check('menu Fondations : option Radier nervuré', await page.evaluate(() => App.doc.struct.p.found) === 'radier');
  const px = await page.evaluate(() => { App.struct.run(); const c = document.getElementById('cv'), g = c.getContext('2d'); return new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(() => { const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 220 && d[i + 1] > 140 && d[i + 1] < 200 && d[i + 2] < 150) n++; ok(n); }))); });
  check('plan 2D : contour du radier dessiné en orange', px > 80, String(px));
  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.stack); process.exit(1); });
