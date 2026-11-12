// Strip footings: the design against a hand calculation, then selection rules, load sharing, drawings and quantities.
const { check, launch } = require('./helper');
const near = (a, b, tol) => Math.abs(a - b) <= tol;
(async () => {
  const { browser, page, errors } = await launch();
  // ---- hand calculation: three columns 3 m apart, Nu = 300 kN, Ns = 220 kN, 30 x 30 cm, soil 0,2 MPa, fc28 25, FeE500
  const st = await page.evaluate(() => { const m = App.struct.mat({ fc28: 25, fe: 500 }), r = App.struct.strip([{ x: 0, Nu: 300, Ns: 220, a: 0.3 }, { x: 3, Nu: 300, Ns: 220, a: 0.3 }, { x: 6, Nu: 300, Ns: 220, a: 0.3 }], { sigSol: 0.2 }, m);
    const { an, ...o } = r; const d35 = 0.35 - 0.07; return { ...o, tau35: r.V / 1000 / (r.B * d35), spans: an.spans.map(s => ({ Mt: s.Mt, Mw: s.Mw, Me: s.Me })) }; });
  check('longueur = 2 × (distance à la résultante + 25 cm) = 6,5 m, centrée sur la résultante', near(st.L, 6.5, 1e-9) && near(st.x0, -0.25, 1e-9) && near(st.x1, 6.25, 1e-9) && near(st.xR, 3, 1e-9), JSON.stringify([st.L, st.x0, st.x1]));
  check('largeur = 1,1·Ns/(σ·L) arrondie à 5 cm, au moins a + 30 cm : 0,60 m', near(st.B, 0.60, 1e-9), String(st.B));
  check('charge linéaire wu = ΣNu/L = 138,46 kN/m et pression qu = 230,8 kN/m²', near(st.wu, 138.4615, 1e-3) && near(st.qu, 230.769, 1e-2));
  check('pression du sol de service ≤ admissible (0,186 ≤ 0,2 MPa)', near(st.sigma, 0.186, 1e-3) && st.sigma <= 0.2);
  check('moments : appui central 0,6·M0 = 93,46 ; travée 0,675·M0 = 105,14 kN.m', near(st.Mbot, 93.462, 0.01) && near(st.Mtop, 105.144, 0.01), JSON.stringify([st.Mbot, st.Mtop]));
  check('moments de rive 0,15·M0 = 23,4 (la console de 25 cm ne donne que 4,3)', near(st.Msup[0], 23.365, 0.01) && near(st.Msup[2], 23.365, 0.01));
  check('tranchant 1,1 × wu·L/2 = 228,5 kN sur l\'appui central', near(st.V, 228.462, 0.01));
  check('hauteur : 35 cm ne passe pas au cisaillement (1,36 > 1,167 MPa), 40 cm passe (1,154)', st.tau35 > st.tauLim && st.h === 0.40 && near(st.tau, 1.154, 0.002) && st.tau <= st.tauLim, JSON.stringify([st.tau35, st.h, st.tau]));
  check('console transversale : M = qu·((B − 25 cm)/2)²/2 = 3,53 kN.m/m', near(st.Mtr, 230.769 * 0.175 * 0.175 / 2, 1e-3));
  check('aciers longitudinaux : l\'ELS fissuration préjudiciable commande (11,4 cm² sous les poteaux, 12,9 entre)', near(st.Ab, 11.445, 0.02) && near(st.At, 12.876, 0.02), JSON.stringify([st.Ab, st.At]));
  check('barres choisies : sections ≥ besoins, au moins 3 barres sur 0,60 m', st.barBot.As >= st.Ab && st.barTop.As >= st.At && st.barBot.n >= 3 && /^\d+HA\d+$/.test(st.barBot.text), JSON.stringify([st.barBot, st.barTop]));
  check('aciers transversaux HA e ≤ 33 cm', /^HA\d+ e=\d+$/.test(st.barTr.text) && st.barTr.e <= 33, st.barTr.text);
  // asymmetric loads: the strip is centred on the resultant, pressure stays uniform
  const asym = await page.evaluate(() => { const m = App.struct.mat({ fc28: 25, fe: 500 }), r = App.struct.strip([{ x: 0, Nu: 135, Ns: 100, a: 0.2 }, { x: 3, Nu: 270, Ns: 200, a: 0.2 }, { x: 6, Nu: 405, Ns: 300, a: 0.2 }], { sigSol: 0.2 }, m); return { xR: r.xR, mid: (r.x0 + r.x1) / 2, L: r.L, wuL: r.wu * r.L, sNu: r.sNu }; });
  check('charges inégales : résultante à x = 4 m, semelle centrée dessus (8,5 m)', near(asym.xR, 4, 1e-9) && near(asym.mid, 4, 1e-9) && near(asym.L, 8.5, 1e-9));
  check('équilibre : wu·L = ΣNu', near(asym.wuL, asym.sNu, 1e-9));
  const prop = await page.evaluate(() => { const m = App.struct.mat({ fc28: 25, fe: 500 }); let bad = []; for (let t = 0; t < 100; t++) { const n = 2 + Math.floor(Math.random() * 4), sp = 2 + Math.random() * 3; let x = 0; const cols = Array.from({ length: n }, () => { const c = { x, Nu: 100 + Math.random() * 600, a: 0.2 + 0.05 * Math.floor(Math.random() * 4) }; c.Ns = c.Nu / 1.38; x += sp * (0.85 + 0.3 * Math.random()); return c; });
      const r = App.struct.strip(cols, { sigSol: 0.1 + Math.random() * 0.3 }, m); if (r.sigma > 0.4 + 1e-9 || Math.abs(r.qu * r.B - r.wu) > 1e-6 || (!r.failed && r.tau > r.tauLim + 1e-9) || r.barBot.As + 1e-9 < r.Ab || r.barTop.As + 1e-9 < r.At || r.h < 0.3) bad.push(t); } return bad; });
  check('100 semelles au hasard : qu·B = wu, cisaillement admissible, sections d\'acier suffisantes', prop.length === 0, prop.join());
  // ---- in a plan: a row of four columns 2,4 m apart under one wall
  const setup = (spacing, params) => page.evaluate(([sp, pr]) => { App.setDoc(App.newDoc()); const xs = [0, 1, 2, 3].map(i => -1.5 * sp + i * sp);
    App.edit(d => { xs.forEach(x => d.items.push({ id: App.uid(), t: 'col', p: [x, 0], a: 0.2, layer: 'str' })); d.items.push({ id: 'w', t: 'wall', a: [xs[0], 0], b: [xs[3], 0], th: 0.2, h: 2.8, layer: 'mur' }); Object.assign(d.struct.p, pr); });
    const r = App.struct.run(); return JSON.parse(JSON.stringify(r)); }, [spacing, params]);
  const base = await setup(2.4, {}); check('sol correct, poteaux espacés de 2,4 m : semelles isolées', base.strips.length === 0 && base.columns.every(c => !c.strips));
  const heavy = { sigSol: 0.05, nlev: 6, Q: 5 };
  const iso = await setup(1.2, { ...heavy, found: 'isolees' }); check('mode « isolées » : on garde les semelles isolées et on signale le chevauchement', iso.strips.length === 0 && iso.warnings.some(w => /se chevauchent/.test(w)), iso.warnings.join(' | '));
  const auto = await setup(1.8, heavy); check('mode automatique : les semelles qui se chevauchent sont remplacées par une semelle filante', auto.strips.length === 1 && auto.columns.every(c => c.strips && c.strips[0] === 'SF1'), JSON.stringify(auto.strips.map(s => s.id)));
  check('automatique : ni chevauchement ni croisement signalés pour une seule semelle', !auto.warnings.some(w => /se chevauchent|croisements/.test(w)), auto.warnings.join(' | '));
  const fil = await setup(2.4, { found: 'filantes' }); check('mode « filantes » : une semelle sous les 4 poteaux même sans chevauchement', fil.strips.length === 1 && fil.strips[0].cols.length === 4);
  const s1 = fil.strips[0]; check('la semelle couvre tous les poteaux avec un débord de 25 cm au moins', s1.overL >= 0.25 - 1e-9 && s1.overR >= 0.25 - 1e-9 && s1.cols.every(c => c.x >= s1.x0 && c.x <= s1.x1));
  check('somme des charges des poteaux = wu·L', near(s1.cols.reduce((s, c) => s + c.Nu, 0), s1.wu * s1.L, 1e-6) && near(s1.cols.reduce((s, c) => s + c.Nu, 0), fil.columns.reduce((s, c) => s + c.Nu, 0), 1e-6));
  check('hauteur de semelle reportée sur les poteaux', fil.columns.every(c => near(c.fh, s1.h, 1e-9) && near(c.fw, s1.B, 1e-9)));
  // ---- room 6 x 4 with strips everywhere: corner columns belong to two strips and share their load
  await page.evaluate(() => App.setDoc(App.newDoc())); await page.keyboard.press('r'); const box = await page.locator('#cv').boundingBox(), v = await page.evaluate(() => ({ s: App.view.s, ox: App.view.ox, oy: App.view.oy }));
  const at = (x, y) => [box.x + x * v.s + v.ox, box.y - y * v.s + v.oy]; for (const [x, y] of [[-3, -2], [3, 2]]) { const [px, py] = at(x, y); await page.mouse.move(px, py); await page.mouse.click(px, py); } await page.keyboard.press('v');
  const room = await page.evaluate(() => { App.struct.autoColumns(); App.edit(d => { d.struct.p.found = 'filantes'; }); return JSON.parse(JSON.stringify(App.struct.run())); });
  check('pièce 6 × 4 m : 4 semelles filantes (une par file de poutres)', room.strips.length === 4 && room.errors.length === 0, String(room.strips.length));
  const share = {}; room.strips.forEach(s => s.cols.forEach(c => { share[c.id] = (share[c.id] || 0) + c.Nu; }));
  check('chaque poteau est entièrement repris : somme de ses parts = Nu', room.columns.every(c => near(share[c.id], c.Nu, 1e-6)), room.columns.map(c => c.label + ':' + (share[c.id] / c.Nu).toFixed(3)).join(' '));
  check('poteaux de coin dans deux semelles', room.columns.filter(c => c.strips.length === 2).length === 4 && room.columns.filter(c => c.strips.length === 1).length === 2);
  check('avertissement sur les croisements de semelles', room.warnings.some(w => /croisements/.test(w)));
  // ---- UI, report, drawings, quantities
  await page.selectOption('#structBox [data-s=found]', 'isolees'); check('menu Fondations : isolées', await page.evaluate(() => App.doc.struct.p.found) === 'isolees');
  await page.selectOption('#structBox [data-s=found]', 'filantes'); await page.click('#structBox [data-act=calc]'); check('menu Fondations : filantes puis Calculer', (await page.evaluate(() => App.doc.struct.result.strips.length)) === 4);
  const rep = await page.evaluate(() => App.struct.report(App.doc)); check('note de calcul : section Semelles filantes', /5\. Semelles filantes/.test(rep) && /SF1/.test(rep) && /sous SF/.test(rep));
  const mdl = await page.evaluate(() => { const m = App.rebar.model(App.doc); return { foots: m.foots.length, strips: m.strips.map(s => ({ id: s.id, B: s.B, L: s.L, h: s.h, bars: s.bars, kg: s.kg, conc: s.conc, tr: s.barTr })), totals: m.totals.strips, cols: m.cols.map(c => ({ fh: c.fh, bar: c.bars[0].len, H: m.H, d: c.d, ls: c.lap })) }; });
  check('ferraillage : plus de semelle isolée, 4 semelles filantes', mdl.foots === 0 && mdl.strips.length === 4);
  const sf = mdl.strips[0], hk = d => 12 * d / 1000;
  check('barres transversales : ⌊(L − 10 cm)/e⌋ + 1 barres de B − 10 cm + 2 équerres', sf.bars[0].n === Math.floor((sf.L - 0.10) / (sf.tr.e / 100) + 1e-9) + 1 && near(sf.bars[0].len, sf.B - 0.10 + 2 * hk(sf.bars[0].d), 1e-9), JSON.stringify(sf.bars[0]));
  check('barres longitudinales : L − 10 cm + 2 équerres', sf.bars.slice(1).every(b => near(b.len, sf.L - 0.10 + 2 * hk(b.d), 1e-9)));
  check('béton B × L × h et poids = Σ n·L·0,00617·Ø²', near(sf.conc, sf.B * sf.L * sf.h, 1e-9) && near(sf.kg, sf.bars.reduce((s, b) => s + b.n * b.len * 0.00617 * b.d * b.d, 0), 1e-9));
  check('barres de poteau : pied descendu jusqu\'à 5 cm du fond de la semelle filante', mdl.cols.every(c => near(c.bar, c.H - 0.03 + (c.fh - 0.05) + 12 * c.d / 1000 + c.ls, 1e-9)));
  const bad = await page.evaluate(() => { const m = App.rebar.model(App.doc), out = []; ['SF1', 'SF2', 'SF3', 'SF4'].forEach(id => { const tmp = document.createElement('div'); tmp.innerHTML = App.rebar.viewHTML(App.doc, m, id); const svg = tmp.querySelector('svg'); if (!svg) { out.push(id); return; } const x = new DOMParser().parseFromString(svg.outerHTML, 'image/svg+xml'); if (x.querySelector('parsererror') || svg.querySelectorAll('line,path,rect,circle').length < 20 || !/Armatures transversales/.test(tmp.textContent)) out.push(id); });
    App.rebar.views(m).forEach(v => { const tmp = document.createElement('div'); tmp.innerHTML = App.rebar.viewHTML(App.doc, m, v.id); tmp.querySelectorAll('svg').forEach(s => { if (new DOMParser().parseFromString(s.outerHTML, 'image/svg+xml').querySelector('parsererror')) out.push(v.id); }); }); return out; });
  check('dessins des semelles filantes (et de toutes les vues) : SVG bien formés', bad.length === 0, bad.join());
  const views = await page.evaluate(() => App.rebar.views(App.rebar.model(App.doc)).map(v => v.id)); check('vues : SF1 à SF4 ajoutées, aucune semelle isolée', ['SF1', 'SF2', 'SF3', 'SF4'].every(id => views.includes(id)) && !views.includes('S1'));
  await page.keyboard.press('4'); await page.click('#ferList [data-v=SF1]'); check('mode Ferraillage : vue de la semelle filante', /Semelle filante SF1/.test(await page.textContent('#ferMain')) && (await page.$$('#ferMain svg')).length === 1);
  await page.click('#ferList [data-v=qty]'); check('métré : ligne Semelles filantes', /Semelles filantes/.test(await page.textContent('#ferMain')));
  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.stack); process.exit(1); });
