// Load take-down by level: dead / live split, live-load reduction (NF P06-001), column sections level by level, bar schedule per level.
const { check, launch } = require('./helper');
const near = (a, b, tol) => Math.abs(a - b) <= tol;
(async () => {
  const { browser, page, click, errors } = await launch(), key = k => page.keyboard.press(k);
  const deg = await page.evaluate(() => [1, 4, 5, 6, 10].map(n => App.struct.degression(n)));
  check('coefficient de dégression : 1 jusqu\'à 4 planchers, puis (3 + n)/(2n) : 0,8 ; 0,75 ; 0,65', deg[0] === 1 && deg[1] === 1 && near(deg[2], 0.8, 1e-12) && near(deg[3], 0.75, 1e-12) && near(deg[4], 0.65, 1e-12), JSON.stringify(deg));
  await key('r'); await click(-3, -2); await click(3, 2); await key('d'); await click(0, -2); await key('f'); await click(3, 0); await key('v');
  await page.evaluate(() => { App.struct.autoColumns(); });
  const run = mod => page.evaluate(m => { App.edit(d => { Object.assign(d.struct.p, { nlev: 1, Q: 1.5, degr: true, found: 'isolees', sigSol: 0.2 }, m); }); return JSON.parse(JSON.stringify(App.struct.run())); }, mod);
  // ---- one level: Nu = 1,35 (G + poids propre) + 1,5 Q
  const one = await run({}), c1 = one.columns[0], l1 = c1.levels[0], H = one.H;
  check('un niveau : un seul tronçon nommé RDC', c1.levels.length === 1 && l1.name === 'RDC' && l1.k === 1);
  check('poids propre du poteau = 25 · a² · H', one.columns.every(c => near(c.levels[0].self, 25 * c.levels[0].a * c.levels[0].a * H, 1e-9)));
  check('Nu = 1,35·ΣG + 1,5·ΣQ et Ns = ΣG + ΣQ', one.columns.every(c => { const l = c.levels[0]; return near(l.Nu, 1.35 * l.G + 1.5 * l.Q, 1e-9) && near(l.Ns, l.G + l.Q, 1e-9) && near(l.G, l.Gk + l.self, 1e-9) && near(l.Q, l.Qk, 1e-9); }));
  check('le poteau reprend les résultats du niveau du bas (section, Nu, Ns, armatures)', one.columns.every(c => { const l = c.levels[c.levels.length - 1]; return c.a === l.a && near(c.Nu, l.Nu, 1e-9) && near(c.Ns, l.Ns, 1e-9) && c.bars.text === l.bars.text; }));
  check('toutes les réactions de poutres ont une part permanente et une part d\'exploitation', one.columns.every(c => c.levels[0].Gk > 0 && c.levels[0].Qk > 0));
  // ---- three levels: floors under the roof, no reduction below 5
  const three = await run({ nlev: 3 }), c3 = three.columns.find(c => c.continuous) || three.columns[0], L = c3.levels;
  check('3 niveaux : tronçons nommés R+2, R+1, RDC (du haut vers le bas)', L.map(l => l.name).join() === 'R+2,R+1,RDC', L.map(l => l.name).join());
  check('planchers courants identiques : mêmes réactions aux niveaux 2 et 3, la toiture est à part', near(L[1].Gk, L[2].Gk, 1e-9) && near(L[1].Qk, L[2].Qk, 1e-9) && !near(L[0].Gk, L[1].Gk, 1e-6));
  check('Σ G cumulée : somme des réactions et des poids propres des tronçons', near(L[2].G, L.reduce((s, l) => s + l.Gk + l.self, 0), 1e-9) && near(L[1].G, L[0].G + L[1].Gk + L[1].self, 1e-9));
  check('Σ Q cumulée sans dégression (moins de 5 planchers) : Q toiture + 2 planchers', near(L[2].Q, L[0].Qk + 2 * L[1].Qk, 1e-9) && L.every(l => l.deg === 1));
  check('section jamais inférieure à celle du niveau supérieur', three.columns.every(c => c.levels.every((l, i) => i === 0 || l.a >= c.levels[i - 1].a - 1e-12)));
  check('charge à la base nettement plus forte qu\'avec 1 niveau', near(three.totals.Nu / one.totals.Nu, 3, 0.6), (three.totals.Nu / one.totals.Nu).toFixed(2));
  // ---- six levels: reduction (3 + 5)/(2 · 5)... n = 5 floors under the roof -> 0,8
  const six = await run({ nlev: 6, Q: 5 }), s6 = six.columns[0].levels, six0 = await run({ nlev: 6, Q: 5, degr: false }), s60 = six0.columns[0].levels;
  check('6 niveaux : au pied, n = 5 planchers sous la toiture, coefficient 0,8', s6[5].nFloors === 5 && near(s6[5].deg, 0.8, 1e-12), JSON.stringify([s6[5].nFloors, s6[5].deg]));
  check('Q au pied = Q toiture + 0,8 · 5 · Q plancher', near(s6[5].Q, s6[0].Qk + 0.8 * 5 * s6[1].Qk, 1e-9), JSON.stringify([s6[5].Q, s6[0].Qk, s6[1].Qk]));
  check('niveaux 2 à 5 (n < 5) : aucune réduction', s6.slice(1, 5).every(l => l.deg === 1) && near(s6[4].Q, s6[0].Qk + 4 * s6[1].Qk, 1e-9));
  check('sans dégression : Q au pied = Q toiture + 5 · Q plancher', near(s60[5].Q, s60[0].Qk + 5 * s60[1].Qk, 1e-9) && s60.every(l => l.deg === 1));
  check('la dégression allège les poteaux : Nu avec < Nu sans', six.totals.Nu < six0.totals.Nu && s6[5].Nu < s60[5].Nu, JSON.stringify([six.totals.Nu, six0.totals.Nu]));
  check('Nu des étages supérieurs identiques avec ou sans dégression (n < 5)', near(s6[3].Nu, s60[3].Nu, 1e-6));
  const eleven = await run({ nlev: 11 }); const e11 = eleven.columns[0].levels; check('11 niveaux : n = 10, coefficient (3 + 10)/20 = 0,65', near(e11[10].deg, 0.65, 1e-12) && e11[10].nFloors === 10);
  const tall = await run({ nlev: 12, Q: 5, G2: 4 }); check('sections en escalier : le bas du poteau est plus gros que le haut (12 niveaux, Q = 5, G = 4)', tall.columns.some(c => c.levels[11].a > c.levels[0].a) && tall.columns.every(c => c.levels.every(l => l.a >= 0.2 && l.a <= 0.6)), JSON.stringify(tall.columns.map(c => c.levels.map(l => Math.round(l.a * 100)))));
  // ---- the live loads are exactly linear: dead and live parts add up to the factored reaction (equilibrium with the applied loads)
  const eq = await page.evaluate(() => { const r = App.doc.struct.result; return { Nu: r.totals.Nu, slab: r.slab.panels[0].pu * r.slab.panels[0].lx * r.slab.panels[0].ly }; });
  check('équilibre conservé avec la descente par niveau (somme des Nu ≥ charges appliquées)', eq.Nu > eq.slab, JSON.stringify(eq));
  // ---- bar schedule per level
  await run({ nlev: 3, Q: 5 });
  const mdl = await page.evaluate(() => { const m = App.rebar.model(App.doc); const r = App.doc.struct.result; return { cols: m.cols.map((c, i) => ({ lv: c.levels, bars: c.bars, conc: c.conc, a: c.a, H: m.H, lap: c.lap, fh: r.columns[i].footing.h, label: c.label })) }; });
  const cc = mdl.cols[0], H3 = cc.H;
  check('ferraillage : 3 tronçons, 6 lignes (barres et cadres par niveau), RDC en premier (repères 1 et 2)', cc.lv.length === 3 && cc.bars.length === 6 && cc.bars[0].mark === '1' && cc.bars[1].mark === '2' && /RDC/.test(cc.bars[0].desc) && /R\+1/.test(cc.bars[2].desc) && /R\+2/.test(cc.bars[4].desc), cc.bars.map(b => b.desc.slice(0, 22)).join(' | '));
  check('béton du poteau = Σ a² · H des trois niveaux', near(cc.conc, cc.lv.reduce((s, l) => s + l.a * l.a * H3, 0), 1e-9));
  const lsOf = d => d / 1000 * 500 / (4 * 0.6 * 2.25 * (0.6 + 0.06 * 25));
  check('barres du dernier niveau : H − 3 cm ; niveau intermédiaire : H + ls ; RDC : H + ls + pied dans la semelle', near(cc.bars[4].len, H3 - 0.03, 1e-9) && near(cc.bars[2].len, H3 + lsOf(cc.bars[2].d), 1e-9) && near(cc.bars[0].len, H3 + lsOf(cc.bars[0].d) + (cc.fh - 0.05) + 12 * cc.bars[0].d / 1000, 1e-9), JSON.stringify(cc.bars.map(b => b.len)));
  check('cadres : au moins 2 de plus au RDC (dans la semelle)', cc.bars[1].n === Math.floor(H3 / (cc.lv[0].st / 100)) + 2 && cc.bars[3].n === Math.floor(H3 / (cc.lv[1].st / 100)));
  // ---- report, table view, UI
  const rep = await page.evaluate(() => App.struct.report(App.doc)); check('note de calcul : descente de charges avec la loi de dégression', /4\. Descente de charges, poteaux et semelles/.test(rep) && /NF P06-001/.test(rep) && /R\+2/.test(rep) && /Poteaux \(niveau RDC\)/.test(rep));
  const dc = await page.evaluate(() => { const m = App.rebar.model(App.doc), tmp = document.createElement('div'); tmp.innerHTML = App.rebar.viewHTML(App.doc, m, 'dc'); return { rows: tmp.querySelectorAll('tr').length, n: m.cols.length, text: tmp.textContent }; });
  check('vue « Descente de charges » : une ligne par poteau et par niveau', dc.rows === 1 + dc.n * 3 && /dégression/.test(dc.text), String(dc.rows));
  await page.evaluate(() => App.setDoc(App.doc)); await key('2');
  await page.evaluate(() => App.edit(d => { d.struct.p.nlev = 6; })); await page.click('#structBox [data-act=calc]'); const withDeg = await page.evaluate(() => App.doc.struct.result.totals.Nu);
  await page.uncheck('#structBox [data-s=degr]'); check('case « dégression » : paramètre décoché', await page.evaluate(() => App.doc.struct.p.degr) === false);
  await page.click('#structBox [data-act=calc]'); const noDeg = await page.evaluate(() => App.doc.struct.result.totals.Nu); check('sans dégression la charge totale est plus forte', noDeg > withDeg, withDeg.toFixed(0) + ' → ' + noDeg.toFixed(0));
  await page.check('#structBox [data-s=degr]'); check('case recochée', await page.evaluate(() => App.doc.struct.p.degr) === true);
  await key('4'); await page.click('#ferList [data-v=dc]'); check('mode Ferraillage : vue Descente de charges', /Descente de charges/.test(await page.textContent('#ferMain')) && /R\+5/.test(await page.textContent('#ferMain')));
  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.stack); process.exit(1); });
