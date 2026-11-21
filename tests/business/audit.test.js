// Vérification d'ensemble : tous les modules activés en même temps. Chaque écran et chaque onglet s'affiche sans erreur, les modules sont branchés partout (menu, accueil, rôles, synchro, export Excel),
// les noms de feuilles Excel sont valides et uniques, les préréglages ne citent que des modules qui existent. Données fictives vides : ce test cherche les oublis de câblage, pas la logique de chaque module.
const fs = require('fs'), path = require('path'), { check, launch, setup } = require('./helper'), root = path.resolve(__dirname, '..', '..', 'business');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'commerce' });
  const SECTOR = ['mm', 'transport', 'coop', 'realty', 'pharmacy', 'agri', 'furniture', 'hotel', 'btp', 'station', 'ngo', 'production', 'resto', 'cleaning', 'butcher', 'hardware', 'shop', 'school', 'garage', 'salon', 'tailor', 'taxi', 'exchange', 'wholesale', 'clinic', 'events', 'cyber', 'utility', 'bakery', 'garden', 'driving', 'printing', 'gym', 'laundry', 'daycare'];
  const src = f => fs.readFileSync(path.join(root, f), 'utf8');

  // static wiring
  const core = src('js/core.js'), main = src('js/main.js'), roles = src('js/roles.js'), icons = src('js/icons.js'), sw = src('sw.js'), idx = src('index.html'), sync = src('js/sync.js');
  const missing = {}; const add = (k, id) => (missing[k] = missing[k] || []).push(id);
  SECTOR.forEach(id => {
    const f = id === 'resto' ? 'resto' : id === 'pharmacy' ? 'pharmacy' : id; if (!fs.existsSync(path.join(root, 'js', f + '.js'))) return add('fichier js absent', id);
    if (!idx.includes('js/' + f + '.js')) add('absent de index.html', id); if (!sw.includes('./js/' + f + '.js')) add('absent du service worker', id); if (!new RegExp("\\['" + id + "', '").test(core)) add('absent de MODULES', id);
    if (!new RegExp('\\b' + id + ": \\['").test(main)) add('absent des écrans (main.js)', id); if (!new RegExp("'" + id + "'").test(roles)) add('absent des rôles', id); if (!new RegExp('\\b' + id + ": '").test(icons)) add('icône absente', id);
  });
  Object.keys(missing).forEach(k => check('câblage : ' + k + ' — aucun module concerné', false, missing[k].join(', '))); if (!Object.keys(missing).length) check('câblage : les 35 modules sont dans index.html, le service worker, MODULES, les écrans, les rôles et les icônes', true);
  const swVer = (sw.match(/business-v(\d+)/) || [])[1], coreVer = (core.match(/business-v(\d+)/) || [])[1]; check('version du cache = version de l\'application (v' + swVer + ')', swVer && swVer === coreVer);

  // synchro covers every collection of the database
  const coll = new Set([...(sync.match(/const COLL = \[([^\]]*)\]/) || ['', ''])[1].matchAll(/'(\w+)'/g)].map(m => m[1]));
  const cols = await p.evaluate(() => Object.keys(App.db).filter(k => Array.isArray(App.db[k]) && k !== 'log'));
  const notSynced = cols.filter(c => !coll.has(c)); check('synchro : toutes les collections de la base sont synchronisées (' + cols.length + ' collections)', !notSynced.length, notSynced.join(', '));
  const ghost = [...coll].filter(c => !['users', 'log'].includes(c) && !cols.includes(c)); check('synchro : aucune collection fantôme', !ghost.length, ghost.join(', '));

  // presets
  const pre = await p.evaluate(() => { const ids = App.MODULES.map(m => m[0]), P = App.PRESETS, bad = []; Object.keys(P).forEach(k => P[k].modules.forEach(m => { if (!ids.includes(m)) bad.push(k + ':' + m); })); const used = new Set(Object.values(P).flatMap(x => x.modules)), unused = ids.filter(i => !used.has(i)), labels = Object.values(P).map(x => x.label), dup = labels.filter((l, i) => labels.indexOf(l) !== i); return { bad, unused, dup, n: Object.keys(P).length }; });
  check('préréglages : ne citent que des modules existants (' + pre.n + ' préréglages)', !pre.bad.length, pre.bad.join(', ')); check('préréglages : chaque module est proposé dans au moins un préréglage', !pre.unused.length, pre.unused.join(', ')); check('préréglages : libellés uniques', !pre.dup.length, pre.dup.join(', '));

  // all modules on, every screen and every tab
  await p.evaluate(ids => { ids.forEach(id => { App.db.settings.modules[id] = true; }); App.save(); }, SECTOR);
  const empty = [], err0 = t.errors.length;
  for (const id of SECTOR) {
    await p.evaluate(i => App.go(i), id); await p.waitForTimeout(60); const len = await p.evaluate(() => document.querySelector('#view').innerHTML.length); if (len < 120) { empty.push(id); continue; }
    const tabs = await p.evaluate(() => [...document.querySelectorAll('#gtabs button[data-t]')].map(b => b.dataset.t));
    for (const tb of tabs) { await p.evaluate(([i, x]) => App.go(i, { tab: x }), [id, tb]); await p.waitForTimeout(30); const l2 = await p.evaluate(() => (document.querySelector('#gtab') || document.querySelector('#view')).innerHTML.length); if (l2 < 60) empty.push(id + '/' + tb); }
  }
  check('écrans : les 35 modules et tous leurs onglets s\'affichent (rien de vide)', !empty.length, empty.join(', '));
  await p.evaluate(() => App.go('home')); await p.waitForTimeout(100); check('accueil : s\'affiche avec tous les modules activés', (await p.locator('#view').innerHTML()).length > 500);
  check('aucune erreur JS en parcourant tous les écrans', t.errors.length === err0, t.errors.slice(err0).join(' | '));
  await p.evaluate(() => App.go('more')); await p.waitForTimeout(100); check('menu « Plus » : s\'affiche avec tous les modules activés', (await p.locator('#view').innerHTML()).length > 500);

  // Excel
  const sh = await p.evaluate(() => { const T = App.data.tables(), names = T.map(s => s.name), bad = names.filter(n => !n || n.length > 31 || /[\\/?*\[\]:]/.test(n)), dup = names.filter((n, i) => names.indexOf(n) !== i), ragged = T.filter(s => !Array.isArray(s.rows) || !s.rows.length || !Array.isArray(s.rows[0])).map(s => s.name); let ok = true, e = ''; try { const b = App.xlsx(T); ok = !!b && (b.size > 1000 || b.length > 1000 || b.byteLength > 1000); } catch (x) { ok = false; e = x.message; } return { n: names.length, bad, dup: [...new Set(dup)], ragged, ok, e }; });
  check('Excel : ' + sh.n + ' feuilles, noms valides (31 caractères au plus, sans caractère interdit)', !sh.bad.length, sh.bad.join(', ')); check('Excel : noms de feuilles uniques', !sh.dup.length, sh.dup.join(', ')); check('Excel : chaque feuille a une ligne d\'en-tête', !sh.ragged.length, sh.ragged.join(', ')); check('Excel : le classeur complet se génère sans erreur', sh.ok, sh.e);

  // numbering prefixes
  const pref = {}; fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js') && f !== 'sync.js').forEach(f => { [...src('js/' + f).matchAll(/nextNo\('([A-Z]+)', '(\w+)'/g)].forEach(m => { (pref[m[1]] = pref[m[1]] || new Set()).add(m[2]); }); });
  const clash = Object.keys(pref).filter(k => pref[k].size > 1).map(k => k + ' → ' + [...pref[k]].join(' / ')); check('numérotation : un préfixe = une seule suite de numéros', !clash.length, clash.join(' ; '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
