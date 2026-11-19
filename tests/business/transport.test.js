// Transport module: vehicles, trips (departure, arrival, stopover time), cargo by goods category and client, freight as revenue,
// fuel stock and consumption, maintenance and breakdown assistance with their expenses, export. Fictitious data only.
const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'transport' });
  const save = async () => { await p.click('.sheet-wrap.on >> text=Enregistrer'); await p.waitForTimeout(250); };
  const go = async tab => { await p.evaluate(tb => App.go('transport', { tab: tb }), tab); await p.waitForSelector('#ttabs'); };

  check('secteur « Transport » : module activé', await p.evaluate(() => App.mod('transport') && App.mod('cash') && App.db.settings.activity === 'transport'));
  check('barre du bas : Transport en tête', (await p.textContent('#tabs')).includes('Transport'));
  await go('trips'); check('écran vide : carte avec bouton d\'action', (await p.locator('#view .empty [data-cta]').count()) === 1);

  // vehicle
  await go('veh'); await p.click('#tv2'); await p.waitForSelector('.sheet [name=plate]'); await p.fill('.sheet [name=plate]', '1234AB01'); await p.fill('.sheet [name=name]', 'Camion 1'); await p.fill('.sheet [name=driver]', 'Chauffeur Test'); await save();
  check('chariot enregistré', await p.evaluate(() => App.db.trVehicles.length === 1 && App.db.trVehicles[0].plate === '1234AB01'));

  // trip with two cargo lines
  await go('trips'); await p.click('#tn'); await p.waitForSelector('.sheet [name=from]');
  check('conducteur proposé depuis le chariot', (await p.inputValue('.sheet [name=driver]')) === 'Chauffeur Test');
  await p.fill('.sheet [name=from]', 'Kinshasa'); await p.fill('.sheet [name=to]', 'Matadi'); await p.fill('.sheet [name=dep]', '2026-11-19T06:00'); await p.fill('.sheet [name=arr]', '2026-11-19T14:30'); await p.fill('.sheet [name=stop]', '30'); await p.fill('.sheet [name=km]', '350');
  await p.click('.sheet #tla'); await p.click('.sheet #tla');
  const rows = p.locator('.sheet .tl');
  await rows.nth(0).locator('[data-k=client]').fill('Client Test'); await rows.nth(0).locator('[data-k=cat]').selectOption('carton'); await rows.nth(0).locator('[data-k=qty]').fill('20'); await rows.nth(0).locator('[data-k=freight]').fill('50');
  await rows.nth(1).locator('[data-k=client]').fill('Autre Client'); await rows.nth(1).locator('[data-k=cat]').selectOption('cash'); await rows.nth(1).locator('[data-k=qty]').fill('1000'); await rows.nth(1).locator('[data-k=freight]').fill('10');
  await save();
  check('mouvement enregistré avec numéro TR-AAAA-0001', await p.evaluate(() => /^TR-\d{4}-0001$/.test(App.db.trTrips[0].number)));
  check('chargement : 2 lignes, catégories carton et espèces', await p.evaluate(() => { const l = App.db.trTrips[0].lines; return l.length === 2 && l[0].cat === 'carton' && l[1].cat === 'cash' && l[0].qty === 20; }));
  check('temps de route = durée − scale (8 h 00)', await p.evaluate(() => { const x = App.db.trTrips[0]; return App.transport.minutes(x) === 510 && App.transport.driving(x) === 480 && App.transport.status(x) === 'Arrivé'; }));
  check('fret du mouvement = 60 USD', await p.evaluate(() => App.transport.freight(App.db.trTrips[0]) === 60));
  await p.waitForSelector('#view .item[data-id]'); check('liste : heures de départ et d\'arrivée visibles', (await p.textContent('#view .item[data-id]')).includes('06:00') && (await p.textContent('#view .item[data-id]')).includes('14:30'));

  // planned trip: departure and arrival with one tap
  await p.evaluate(() => { const v = App.db.trVehicles[0]; App.db.trTrips.push({ id: 'tr2', number: 'TR-X', at: Date.now(), date: App.today(), vehicleId: v.id, driver: '', from: 'A', to: 'B', dep: '', arr: '', stop: 0, km: 0, lines: [], currency: 'USD', rate: 2800, note: '' }); App.save(); App.render(); });
  await p.evaluate(() => App.transport.profile('tr2')); await p.waitForSelector('.sheet-wrap.on >> text=Départ maintenant'); await p.click('.sheet-wrap.on >> text=Départ maintenant'); await p.waitForTimeout(300);
  check('« Départ maintenant » : statut En route', await p.evaluate(() => App.transport.status(App.transport.get('tr2')) === 'En route'));
  await p.evaluate(() => App.transport.profile('tr2')); await p.waitForSelector('.sheet-wrap.on >> text=Arrivée maintenant'); await p.click('.sheet-wrap.on >> text=Arrivée maintenant'); await p.waitForTimeout(300);
  check('« Arrivée maintenant » : statut Arrivé', await p.evaluate(() => App.transport.status(App.transport.get('tr2')) === 'Arrivé'));

  // fuel: reception creates an expense, issues feed the consumption
  await go('fuel'); await p.click('#fi'); await p.waitForSelector('.sheet [name=liters]'); await p.fill('.sheet [name=liters]', '500'); await p.fill('.sheet [name=price]', '1.2'); await save();
  check('réception : stock 500 L et dépense Carburant 600', await p.evaluate(() => App.transport.stock() === 500 && App.db.expenses.some(e => e.category === 'Carburant' && e.amount === 600)));
  await p.evaluate(() => { const v = App.db.trVehicles[0].id, f = (l, km) => App.db.trFuel.push({ id: App.uid(), at: Date.now(), type: 'out', date: App.today(), liters: l, vehicleId: v, km, price: 0, currency: 'USD', rate: 2800 }); f(100, 1000); f(120, 1400); App.save(); App.render(); });
  check('stock après sorties : 280 L', await p.evaluate(() => App.transport.stock() === 280));
  check('consommation : 120 L sur 400 km = 30 L/100 km', await p.evaluate(() => Math.abs(App.transport.consumption(App.db.trVehicles[0].id) - 30) < 1e-9));
  await p.click('#fo'); await p.waitForSelector('.sheet [name=vehicleId]'); await p.fill('.sheet [name=liters]', '9999'); await save();
  check('sortie refusée si le stock est insuffisant', await p.evaluate(() => App.transport.stock() === 280));
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  check('écran carburant : stock et consommation affichés', (await p.textContent('#ttab')).includes('280') && (await p.textContent('#ttab')).includes('L/100 km'));

  // maintenance and breakdown assistance
  await go('maint'); await p.click('#mn2'); await p.waitForSelector('.sheet [name=place]'); await p.selectOption('.sheet [name=kind]', 'Dépannage'); await p.fill('.sheet [name=cost]', '80'); await p.fill('.sheet [name=place]', 'Garage Test'); await p.fill('.sheet [name=phone]', '0990000002');
  await p.evaluate(() => { document.querySelector('.sheet [name=nextDate]').value = '2020-01-01'; }); await save();
  check('entretien : siège de dépannage et dépense Entretien 80', await p.evaluate(() => App.db.trMaint[0].place === 'Garage Test' && App.db.expenses.some(e => e.category === 'Entretien' && e.amount === 80)));
  check('entretien en retard signalé', await p.evaluate(() => App.transport.due().length === 1 && App.transport.due()[0].late));
  await p.click('#view .item[data-m]'); await p.waitForSelector('.sheet [name=place]'); await p.click('.sheet-wrap.on >> text=Supprimer'); await p.waitForSelector('.sheet-wrap.on >> text=Confirmation'); await p.locator('.sheet-wrap.on').last().locator('footer >> text=Supprimer').click(); await p.waitForTimeout(300);
  check('suppression : l\'entretien et sa dépense disparaissent', await p.evaluate(() => App.db.trMaint.length === 0 && !App.db.expenses.some(e => e.category === 'Entretien')));

  // report, revenue, journal
  await go('rep'); await p.waitForSelector('#ttab .hero');
  check('rapport : chargement par marchandise, clients', (await p.textContent('#ttab')).includes('Cartons') && (await p.textContent('#ttab')).includes('Espèces') && (await p.textContent('#ttab')).includes('Client Test'));
  check('chiffre d\'affaires et bénéfice incluent le fret', await p.evaluate(() => { const r = App.fin.range('month'), c = App.reports.compute(r); return c.tr === 60 && c.revenue === c.sales + c.mm + c.tr; }));
  check('dépenses de carburant dans les finances', await p.evaluate(() => App.fin.entries(App.fin.range('month')).some(e => e.k === 'out' && /Carburant|carburant/i.test(JSON.stringify(e)))));
  check('rapport en texte (WhatsApp)', await p.evaluate(() => App.transport.reportText(App.fin.range('month')).includes('Cartons')));

  // cancel, export, links
  await p.evaluate(() => App.transport.profile(App.db.trTrips[0].id)); await p.waitForSelector('.sheet-wrap.on >> text=Annuler le mouvement'); await p.click('.sheet-wrap.on >> text=Annuler le mouvement'); await p.waitForSelector('.sheet-wrap.on >> text=Confirmation'); await p.locator('.sheet-wrap.on').last().locator('footer >> text=Annuler le mouvement').click(); await p.waitForTimeout(300);
  check('annulation : le fret n\'est plus compté', await p.evaluate(() => App.transport.revenue(App.fin.range('month')) === 0 && App.transport.status(App.db.trTrips[0]) === 'Annulé'));
  check('Excel : feuilles transport', await p.evaluate(() => { const T = App.data.tables(), n = T.map(x => x.name); const m = T.find(x => x.name === 'Mouvements transport'); return ['Mouvements transport', 'Carburant', 'Entretien'].every(x => n.includes(x)) && m.rows.length >= 3; }));
  check('Synchro : les collections de transport sont partagées', await p.evaluate(() => ['trVehicles', 'trTrips', 'trFuel', 'trMaint'].every(k => Array.isArray(App.db[k]))));
  await p.evaluate(() => App.go('more')); await p.waitForSelector('#view .grid'); check('menu Plus : Fournisseurs accessibles avec le module Transport', (await p.textContent('#view')).includes('Fournisseurs'));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
