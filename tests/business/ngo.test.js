// ONG & projets: projects with donor and budget by heading, funds received (income of the organisation: turnover, journal, cash drawer), project expenses (ordinary expenses), overspending
// flags, beneficiaries, activities with participants (people reached without double counting), indicators, closing, report, to-do. Fictitious data only.
const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'ong' }); await p.evaluate(() => { window.near = (a, b) => Math.abs(a - b) < 0.02; });
  const go = async tab => { await p.evaluate(tb => App.go('ngo', { tab: tb }), tab); await p.waitForSelector('#gtabs'); };
  const settle = () => p.waitForFunction(() => document.activeElement && document.activeElement.closest && document.activeElement.closest('.sheet')), ok = () => p.click('.sheet-wrap.on footer .primary'), closeTop = async () => { await p.waitForSelector('.sheet-wrap.on'); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' }); };

  check('secteur « ONG & projets » : module activé, vocabulaire « donateur »', await p.evaluate(() => App.mod('ngo') && App.db.settings.activity === 'ong' && App.vocab('client') === 'donateur'));
  check('barre du bas : ONG en tête', (await p.textContent('#tabs')).includes('ONG'));
  await p.evaluate(() => { App.db.clients.push({ id: 'd1', code: 'CL-0001', name: 'Fondation Test', phone: '0990000001', type: 'Entreprise', created: App.today(), fields: {} }); App.db.suppliers.push({ id: 'f1', code: 'FO-0001', name: 'Fournisseur Test', created: App.today() }); App.save(); });
  await go('projects'); check('écran vide : carte avec bouton d\'action', (await p.locator('#gtab .empty [data-cta]').count()) === 1);

  // project through the form, with budget rows
  await p.click('#pn'); await p.waitForSelector('.sheet [name=name]'); await settle(); await p.fill('.sheet [name=name]', 'Eau potable'); await p.selectOption('.sheet [name=donorId]', 'd1'); await p.fill('.sheet [name=zone]', 'Village A');
  await p.fill('.sheet .br:nth-of-type(1) [name=rb]', 'Matériel & équipement'); await p.fill('.sheet .br:nth-of-type(1) [name=am]', '6000'); await p.click('.sheet #ab'); await p.waitForFunction(() => document.querySelectorAll('.sheet .br').length === 2);
  await p.fill('.sheet .br >> nth=1 >> [name=rb]', 'Personnel'); await p.fill('.sheet .br >> nth=1 >> [name=am]', '4000');
  check('total du budget affiché : 10 000', (await p.textContent('.sheet #bt')).replace(/\s/g, '').includes('10000'));
  await ok(); await p.waitForFunction(() => App.db.ngProjects.length === 1); await p.waitForSelector('.sheet-wrap.on .hero'); await closeTop();
  const p1 = await p.evaluate(() => App.db.ngProjects[0].id);
  check('projet PJ-AAAA-0001 : bailleur, 2 rubriques, budget 10 000, en cours', await p.evaluate(id => { const x = App.ngo.project(id); return /^PJ-\d{4}-0001$/.test(x.number) && x.donorId === 'd1' && x.budget.length === 2 && App.ngo.budget(x) === 10000 && App.ngo.status(x) === 'En cours'; }, p1));
  check('nom manquant refusé', await p.evaluate(() => App.ngo.addProject({}) === null));

  // funds received are income (turnover, journal, cash drawer)
  const g1 = await p.evaluate(id => { const N = App.ngo; return { a: N.addOp({ type: 'grant', projectId: id, donorId: 'd1', amount: 8000, ref: 'VIR-1' }), b: N.addOp({ type: 'grant', projectId: '', amount: 500, mode: 'Mobile money' }) }; }, p1);
  check('financements NG-AAAA-0001 : 8 000 au projet (espèces), 500 non affectés (mobile money)', await p.evaluate(id => { const s = App.ngo.stat(App.ngo.project(id)); return /^NG-\d{4}-0001$/.test(App.db.ngOps[0].number) && s.received === 8000 && s.balance === 8000 && App.db.ngOps[1].projectId === ''; }, p1));
  check('fonds reçus = chiffre d\'affaires et bénéfice : 8 500', await p.evaluate(() => { const c = App.reports.compute(App.fin.range('month')); return c.ng === 8500 && c.revenue === 8500 && c.profit === 8500; }));
  check('journal : 2 entrées « Financement »', await p.evaluate(() => App.fin.entries(App.fin.range('month')).filter(e => e.t === 'ngo').length === 2));
  check('caisse en espèces : +8 000 (les 500 en mobile money n\'y sont pas)', await p.evaluate(() => App.cash.expected().USD === 8000));
  check('montant nul, projet inconnu ou donateur sans montant refusés', await p.evaluate(() => App.ngo.addOp({ type: 'grant', amount: 0 }) === null && App.ngo.addOp({ type: 'grant', projectId: 'zz', amount: 5 }) === null));

  // expenses (ordinary expenses) and budget by heading
  await p.evaluate(id => App.ngo.opForm('expense', id), p1); await p.waitForSelector('.sheet #rb'); await settle(); await p.selectOption('.sheet #rb', 'Matériel & équipement'); await p.fill('.sheet [name=amount]', '2500'); await p.selectOption('.sheet [name=supplierId]', 'f1'); await p.fill('.sheet [name=ref]', 'F-12');
  check('rubrique : aide « 0 dépensés sur 6 000 »', (await p.textContent('.sheet #rh')).replace(/\s/g, '').includes('6000'));
  await ok(); await p.waitForFunction(() => App.db.ngOps.length === 3); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('dépense 2 500 : dépense « ONG · Matériel & équipement » (fournisseur, pièce), rubrique à 41,7 %', await p.evaluate(id => { const o = App.db.ngOps[2], e = App.db.expenses.find(x => x.id === o.expenseId), b = App.ngo.stat(App.ngo.project(id)).by.find(x => x.rubric === 'Matériel & équipement'); return e.amount === 2500 && e.category === 'ONG · Matériel & équipement' && e.supplierId === 'f1' && e.note.includes('F-12') && b.pct === 41.7; }, p1));
  check('solde du projet 5 500 ; caisse 8 000 − 2 500 = 5 500 ; bénéfice 8 500 − 2 500', await p.evaluate(id => App.ngo.stat(App.ngo.project(id)).balance === 5500 && App.cash.expected().USD === 5500 && App.reports.compute(App.fin.range('month')).profit === 6000, p1));
  await p.evaluate(id => { const N = App.ngo; N.addOp({ type: 'expense', projectId: id, rubric: 'Personnel', amount: 4500 }); N.addOp({ type: 'expense', projectId: id, rubric: 'Communication', amount: 300 }); }, p1);
  check('rubrique Personnel à 112,5 % (au-delà), dépense hors budget 300 signalée', await p.evaluate(id => { const s = App.ngo.stat(App.ngo.project(id)); return s.by.find(b => b.rubric === 'Personnel').pct === 112.5 && s.other === 300 && s.spent === 7300; }, p1));
  check('dépense sans rubrique, sans projet ou montant nul : refusée', await p.evaluate(id => App.ngo.addOp({ type: 'expense', projectId: id, amount: 5 }) === null && App.ngo.addOp({ type: 'expense', rubric: 'Personnel', amount: 5 }) === null && App.ngo.addOp({ type: 'expense', projectId: id, rubric: 'Personnel', amount: 0 }) === null, p1));
  await p.evaluate(id => { App.ngo.addOp({ type: 'expense', projectId: id, rubric: 'Formation', amount: 1000 }); }, p1);
  check('dépenses 8 300 > fonds reçus 8 000 : solde −300, alerte sur l\'accueil', await p.evaluate(id => App.ngo.stat(App.ngo.project(id)).balance === -300 && App.ngo.todo().some(x => x[0].includes('plus que les fonds')), p1));
  check('annuler une dépense : dépense supprimée, solde revient à 700', await p.evaluate(id => { const o = App.db.ngOps[App.db.ngOps.length - 1], n = App.db.expenses.length; return App.ngo.cancelOp(o) === true && App.db.expenses.length === n - 1 && App.ngo.stat(App.ngo.project(id)).balance === 700 && o.status === 'Annulé'; }, p1));

  // beneficiaries and activities
  await go('people'); await p.click('#bn'); await p.waitForSelector('.sheet [name=name]'); await settle(); await p.fill('.sheet [name=name]', 'Marie Test'); await p.selectOption('.sheet [name=sex]', 'F'); await p.fill('.sheet [name=birth]', '1990'); await p.fill('.sheet [name=zone]', 'Village A'); await p.selectOption('.sheet [name=projectId]', p1); await ok(); await p.waitForFunction(() => App.db.ngPeople.length === 1); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  await p.evaluate(id => { const N = App.ngo; N.addPerson({ name: 'Jean Test', sex: 'M', birth: new Date().getFullYear() - 11, projectId: id }); N.addPerson({ name: 'Anna Test', sex: 'F', birth: new Date().getFullYear() - 76 }); N.addPerson({ name: 'Paul Test', sex: 'M' }); }, p1);
  check('bénéficiaires : groupes d\'âge 18-59, 6-17, 60+ et âge inconnu', await p.evaluate(() => App.db.ngPeople.map(x => App.ngo.group(x)).join() === '18-59 ans,6-17 ans,60 ans et plus,Âge inconnu'));
  check('bénéficiaire sans nom refusé', await p.evaluate(() => App.ngo.addPerson({}) === null));
  const ids = await p.evaluate(() => App.db.ngPeople.map(x => x.id)); await go('acts');
  await p.click('#an'); await p.waitForSelector('.sheet #pl [data-p]'); await settle(); await p.selectOption('.sheet [name=kind]', 'Distribution'); await p.fill('.sheet [name=place]', 'École du village'); await p.fill('.sheet [name=extra]', '10');
  await p.check('.sheet #pl [data-p="' + ids[0] + '"]'); await p.check('.sheet #pl [data-p="' + ids[1] + '"]'); check('compteur de participants cochés : (2)', (await p.textContent('.sheet #pc')).includes('2'));
  await ok(); await p.waitForFunction(() => App.db.ngActs.length === 1); await p.waitForSelector('.sheet-wrap.on .hero'); await closeTop();
  check('activité DS-AAAA-0001 : 2 participants + 10 autres = 12 personnes touchées', await p.evaluate(id => /^DS-\d{4}-0001$/.test(App.db.ngActs[0].number) && App.ngo.reached(App.ngo.project(id)) === 12, p1));
  check('2e activité avec une personne déjà comptée : pas de doublon (3 enregistrés + 15 autres = 18)', await p.evaluate(([id, a, b]) => { App.ngo.addAct({ projectId: id, kind: 'Formation', people: [a, b], extra: 5 }); return App.ngo.reached(App.ngo.project(id)) === 18; }, [p1, ids[0], ids[2]]));
  check('activité sans projet ou de type inconnu refusée', await p.evaluate(() => App.ngo.addAct({ kind: 'Distribution' }) === null && App.ngo.addAct({ projectId: App.db.ngProjects[0].id, kind: 'Fête' }) === null));

  // indicators
  await p.evaluate(id => { const N = App.ngo, pr = N.project(id), a = N.addIndicator(pr, { label: 'Puits construits', unit: 'puits', target: 5 }), b = N.addIndicator(pr, { label: 'Accès à l\'eau', unit: '%', target: 100, mode: 'last' }); N.addMeasure(a, { value: 2 }); N.addMeasure(a, { value: 1 }); N.addMeasure(b, { value: 40, date: App.addDays(App.today(), -10) }); N.addMeasure(b, { value: 55 }); }, p1);
  check('indicateurs : cumul 3 puits sur 5 (60 %), dernier relevé 55 % de 100', await p.evaluate(id => { const pr = App.ngo.project(id), a = App.ngo.indicator(pr, pr.indicators[0]), b = App.ngo.indicator(pr, pr.indicators[1]); return a.value === 3 && a.pct === 60 && b.value === 55 && b.pct === 55; }, p1));
  check('indicateur sans libellé ou relevé vide refusés', await p.evaluate(id => App.ngo.addIndicator(App.ngo.project(id), {}) === null && App.ngo.addMeasure(App.ngo.project(id).indicators[0], { value: '' }) === null, p1));

  // report, to-do, closing
  const r = await p.evaluate(() => { const c = App.ngo.report(App.fin.range('month')); return { received: c.received, spent: c.spent, net: c.net, reached: c.reached, people: c.people, neg: c.neg.length, n: c.n }; });
  check('rapport : reçu 8 500, dépensé 7 300, excédent 1 200, 18 personnes touchées, 4 bénéficiaires, 1 projet', r.received === 8500 && r.spent === 7300 && r.net === 1200 && r.reached === 18 && r.people === 4 && r.neg === 0 && r.n === 1);
  check('rapport à remettre sous 7 jours : alerte sur l\'accueil', await p.evaluate(id => { App.ngo.project(id).nextReport = App.addDays(App.today(), 3); return App.ngo.todo().some(x => x[0].includes('rapport')); }, p1));
  check('projet clos : plus de dépense ni de financement', await p.evaluate(id => { const x = App.ngo.project(id); x.closed = true; const r = App.ngo.addOp({ type: 'expense', projectId: id, rubric: 'Personnel', amount: 5 }) === null && App.ngo.addOp({ type: 'grant', projectId: id, amount: 5 }) === null && App.ngo.status(x) === 'Clos'; x.closed = false; return r; }, p1));
  for (const tab of ['projects', 'people', 'acts', 'ops', 'rep']) { await go(tab); check('onglet ' + tab + ' s\'affiche sans erreur', (await p.locator('#gtab').innerHTML()).length > 80); }
  await go('projects'); await p.click('#gtab [data-p]'); await p.waitForSelector('.sheet .hero'); const txt = await p.textContent('.sheet'); check('fiche projet : solde, budget par rubrique, personnes touchées, indicateurs, boutons Dépense / Fonds reçus', txt.includes('Budget par rubrique') && txt.includes('18') && txt.includes('Puits construits') && (await p.textContent('.sheet-wrap.on footer')).includes('Dépense')); await closeTop();
  check('texte du rapport (WhatsApp)', await p.evaluate(() => App.ngo.reportText(App.fin.range('month')).includes('Rapport ONG')));
  check('Synchro : les collections sont partagées', await p.evaluate(() => ['ngProjects', 'ngPeople', 'ngActs', 'ngOps'].every(k => Array.isArray(App.db[k]))));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
