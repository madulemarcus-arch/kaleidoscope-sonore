// The 62 activities: every preset (the 39 first ones and the 11 sectors built on the shared modules) switches on existing modules with its own vocabulary, opens every screen it offers without an error,
// and is found by the search bar of the wizard.
const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'veto' });
  const NEW = ['pressing', 'sport', 'creche', 'laveauto', 'engins', 'kiosque', 'photo', 'voyage', 'funerailles', 'veto', 'opticien'];
  const info = await p.evaluate(n => { const P = App.PRESETS, labels = Object.values(P).map(x => x.label); return { total: Object.keys(P).length, uniq: new Set(labels).size, missing: n.filter(k => !P[k]), vocab: n.every(k => P[k].vocab && P[k].vocab.client && P[k].vocab.product && P[k].vocab.sub), mods: n.every(k => P[k].modules.length >= 4) }; }, NEW);
  check('62 activités au total, noms uniques, les 11 nouvelles présentes avec vocabulaire et au moins 4 modules', info.total === 62 && info.uniq === 62 && !info.missing.length && info.vocab && info.mods, JSON.stringify(info));
  check('activité choisie à l\'assistant (Pharmacie vétérinaire) : vocabulaire « éleveur », module Pharmacie actif', await p.evaluate(() => App.db.settings.activity === 'veto' && App.db.settings.vocab.client === 'éleveur' && App.mod('pharmacy')));
  const err0 = t.errors.length;
  for (const k of NEW) {
    const r = await p.evaluate(key => { const P = App.PRESETS[key], s = App.db.settings; s.activity = key; s.vocab = { ...P.vocab }; App.MODULES.forEach(m => { s.modules[m[0]] = P.modules.includes(m[0]); }); App.save(); App.emit('settings'); let bad = []; for (const id of ['home', 'clients', 'more', ...P.modules.filter(m => App.views[m])]) { try { App.go(id); const h = document.querySelector('#view').innerHTML.length; if (h < 100) bad.push(id); } catch (e) { bad.push(id + ':' + e.message); } } return { bad, client: s.vocab.client }; }, k);
    check('activité « ' + k + ' » : tous ses écrans s\'ouvrent', !r.bad.length, r.bad.join(', '));
  }
  check('aucune erreur JS en parcourant les 11 nouvelles activités', t.errors.length === err0, t.errors.slice(err0).join(' | '));
  await p.evaluate(() => App.go('settings')); await p.waitForSelector('[data-find=act]');
  for (const [q, key] of [['sport', 'sport'], ['creche', 'creche'], ['funeb', 'funerailles'], ['veterinaire', 'veto'], ['lunette', 'opticien'], ['voyage', 'voyage'], ['engin', 'engins'], ['boisson', 'kiosque']]) {
    await p.fill('[data-find=act]', q);
    const vals = await p.locator('select[data-p=activity] option').evaluateAll(o => o.map(x => x.value));
    check('recherche « ' + q + ' » trouve l\'activité ' + key, vals.includes(key), vals.join(','));
  }
  check('aucune erreur JS', t.errors.length === err0, t.errors.slice(err0).join(' | '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
