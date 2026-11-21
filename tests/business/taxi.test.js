// Taxi & moto-taxi: vehicles with driver and daily quota, quota handed over (real paid invoice), days off, costs (expenses), documents with expiry, servicing by kilometres, owner balance
// (share of the quota − costs − payments), arrears derived, cancellation, report, screens. Fictitious data only.
const { check, launch, setup } = require('./helper');
(async () => {
  const near = (a, b) => Math.abs(a - b) < 0.005, t = await launch(), p = t.page; await setup(p, { activity: 'taxi' });
  const go = async tab => { await p.evaluate(tb => App.go('taxi', { tab: tb }), tab); await p.waitForSelector('#gtabs'); };
  const settle = () => p.waitForFunction(() => document.activeElement && document.activeElement.closest && document.activeElement.closest('.sheet')), ok = () => p.click('.sheet-wrap.on footer .primary'), closeTop = async () => { await p.waitForSelector('.sheet-wrap.on'); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' }); };

  check('secteur « Taxi & moto-taxi » : module activé', await p.evaluate(() => App.mod('taxi') && App.mod('sales') && App.db.settings.activity === 'taxi'));
  check('barre du bas : Taxi', (await p.textContent('#tabs')).includes('Taxi'));
  await go('day'); check('écran vide : carte avec bouton d\'action', (await p.locator('#gtab .empty [data-cta]').count()) === 1);
  await p.evaluate(() => { App.db.clients.push({ id: 'c1', code: 'CL-0001', name: 'Propriétaire Un', phone: '09900000', fields: {} }); App.db.staff.push({ id: 'm1', name: 'Chauffeur Un', role: 'Chauffeur', phone: '09911111' }, { id: 'm2', name: 'Chauffeur Deux', role: 'Chauffeur', phone: '' }); App.save(); });

  // vehicles
  check('véhicule refusé : sans plaque, plaque en double (majuscules, espaces et tirets ignorés), propriétaire inconnu', await p.evaluate(() => { const X = App.taxi, a = X.saveVehicle({ kind: 'Taxi' }), v = X.saveVehicle({ plate: 'ab-123 c', kind: 'Moto-taxi', driverId: 'm1', quota: 5, since: App.addDays(App.today(), -10), rest: [] }), b = X.saveVehicle({ plate: 'AB123C' }), c = X.saveVehicle({ plate: 'ZZ1', ownerId: 'nope' }); return !!a.err && !!b.err && !!c.err && v.plate === 'AB-123 C' && App.db.txVehicles.length === 1; }));
  await p.evaluate(() => { const X = App.taxi, td = App.today(); X.saveVehicle({ plate: 'TX 777', kind: 'Taxi', quota: 10, since: App.addDays(td, -5), rest: [], ownerId: 'c1', comm: 20, km: 1000, service: 500, docs: 'Assurance ' + App.addDays(td, 10) + '\nVignette ' + App.addDays(td, -3) }); });
  const ids = await p.evaluate(() => ({ v1: App.db.txVehicles[0].id, v2: App.db.txVehicles[1].id }));
  check('versements dus : 10 jours × 5 = 50 pour la moto, 5 jours × 10 = 50 pour le taxi ; solde = dû − remis', await p.evaluate(i => { const X = App.taxi, a = X.vehicle(i.v1), b = X.vehicle(i.v2); return X.dueDays(a) === 10 && Math.abs(X.due(a) - 50) < 0.005 && Math.abs(X.due(b) - 50) < 0.005 && Math.abs(X.balance(a) - 50) < 0.005; }, ids));

  // quota handed over
  const r0 = await p.evaluate(i => { const X = App.taxi, a = X.versement({}), b = X.versement({ vehicleId: i.v1, amount: 0 }), c = X.versement({ vehicleId: i.v1, amount: 5, date: App.addDays(App.today(), 2) }); return { a: !!a.err, b: !!b.err, c: !!c.err, n: App.db.txOps.length }; }, ids);
  check('versement refusé : sans véhicule, montant nul, date future ; aucun numéro consommé', r0.a && r0.b && r0.c && r0.n === 0);
  const o1 = await p.evaluate(i => { const X = App.taxi, a = X.versement({ vehicleId: i.v1, amount: '' }), b = X.versement({ vehicleId: i.v1, amount: 15 }); return { n: a.number, id: b.id, inv: App.sales.get(a.invoiceId) }; }, ids);
  check('versement TX-AAAA-0001 (montant vide = quota 5) : facture « Taxi » payée ; deuxième versement de 15 → solde 30', /^TX-\d{4}-0001$/.test(o1.n) && o1.inv.source === 'Taxi' && await p.evaluate(i => { const X = App.taxi, a = X.vehicle(i.v1), inv = App.sales.get(X.vers(a)[0].invoiceId); return near(App.sales.paid(inv), 5) && near(App.sales.due(inv), 0) && near(X.paid(a), 20) && near(X.balance(a), 30) && X.vers(a)[0].driverId === 'm1'; function near(x, y) { return Math.abs(x - y) < 0.005; } }, ids));
  check('versement du taxi géré : 40 reçus → part du propriétaire 32 (commission 20 %)', await p.evaluate(i => { const X = App.taxi; X.versement({ vehicleId: i.v2, amount: 40 }); return near(X.ownerShare('c1'), 32) && near(X.ownerBal('c1'), 32); function near(x, y) { return Math.abs(x - y) < 0.005; } }, ids));

  // costs, odometer, servicing
  check('dépense refusée : nature absente, montant nul, compteur inférieur au dernier relevé (900 < 1000)', await p.evaluate(i => { const X = App.taxi; return !!X.cost({ vehicleId: i.v2, cat: 'Rien', amount: 5 }).err && !!X.cost({ vehicleId: i.v2, cat: 'Carburant', amount: 0 }).err && !!X.cost({ vehicleId: i.v2, cat: 'Carburant', amount: 5, km: 900 }).err; }, ids));
  check('carburant 6 (1100 km) : dépense « Taxi · Carburant », compteur 1100, pas d\'entretien encore ; 4 à 1600 km → entretien à prévoir (600 km) ; entretien à 1650 km → plus d\'alerte', await p.evaluate(i => { const X = App.taxi, v = X.vehicle(i.v2), a = X.cost({ vehicleId: i.v2, cat: 'Carburant', amount: 6, km: 1100 }), e = App.db.expenses.find(x => x.category === 'Taxi · Carburant'), s1 = X.serviceDue(v), n1 = X.lastKm(v); X.cost({ vehicleId: i.v2, cat: 'Carburant', amount: 4, km: 1600 }); const s2 = X.serviceDue(v); X.cost({ vehicleId: i.v2, cat: 'Entretien', amount: 10, km: 1650 }); return /^TX-/.test(a.number) && e.amount === 6 && s1 === null && n1 === 1100 && s2 && s2.run === 600 && X.serviceDue(v) === null && X.lastKm(v) === 1650; }, ids));
  check('solde du propriétaire : 32 − 20 de dépenses avancées = 12', await p.evaluate(() => { const X = App.taxi; return Math.abs(X.ownerCosts('c1') - 20) < 0.005 && Math.abs(X.ownerBal('c1') - 12) < 0.005; }));

  // owner payments
  check('reversement refusé : sans propriétaire, au-delà du solde (50 > 12)', await p.evaluate(() => { const X = App.taxi; return !!X.reverse({}).err && X.reverse({ ownerId: 'c1', amount: 50 }).err.includes('12'); }));
  const rv = await p.evaluate(() => { const X = App.taxi, a = X.reverse({ ownerId: 'c1', amount: 7 }), b = X.reverse({ ownerId: 'c1' }), e = App.db.expenses.filter(x => x.category === 'Reversements propriétaires taxi'), c = X.reverse({ ownerId: 'c1' }); return { a: a.amount, b: b.amount, bid: b.id, n: e.length, bal: X.ownerBal('c1'), again: !!c.err }; });
  check('reversement de 7 puis du solde (5) : deux dépenses « Reversements propriétaires taxi », solde 0 ; un troisième est refusé', near(rv.a, 7) && near(rv.b, 5) && rv.n === 2 && Math.abs(rv.bal) < 0.005 && rv.again);
  check('reversement annulé : dépense supprimée, solde de nouveau dû (5)', await p.evaluate(id => { const X = App.taxi, r = X.cancelOp(X.op(id)); return r === true && App.db.expenses.filter(x => x.category === 'Reversements propriétaires taxi').length === 1 && Math.abs(X.ownerBal('c1') - 5) < 0.005 && X.cancelOp(X.op(id)) === false; }, rv.bid));

  // days off
  check('jour sans versement hier pour la moto : 9 jours × 5 = 45, solde 25 ; doublon refusé', await p.evaluate(i => { const X = App.taxi, a = X.vehicle(i.v1), y = App.addDays(App.today(), -1), r = X.restDay({ vehicleId: i.v1, date: y, note: 'Panne' }), d = X.restDay({ vehicleId: i.v1, date: y }); return !!r.number && !!d.err && X.dueDays(a) === 9 && Math.abs(X.balance(a) - 25) < 0.005 && !!X.restDay({ vehicleId: i.v1 }).err; }, ids));
  check('repos hebdomadaire du taxi (jour d\'hier) : 5 → 4 jours dus, solde 0', await p.evaluate(i => { const X = App.taxi, v = X.vehicle(i.v2), y = App.addDays(App.today(), -1), d = new Date(y + 'T00:00:00').getDay(); X.saveVehicle({ plate: v.plate, kind: v.kind, quota: v.quota, since: v.since, rest: [d], ownerId: 'c1', comm: 20, km: 1000, service: 500, docs: v.docs }, v.id); return X.dueDays(v) === 4 && Math.abs(X.balance(v)) < 0.005; }, ids));

  // today and documents
  const v3 = await p.evaluate(() => App.taxi.saveVehicle({ plate: 'ZZ 999', kind: 'Tricycle', quota: 8, since: App.addDays(App.today(), -1), rest: [] }).id);
  check('état du jour : moto et taxi « Versé », tricycle « Manquant » ; rapport : 1 véhicule sans versement, 1 chauffeur en retard sur le tricycle', await p.evaluate(([i, id]) => { const X = App.taxi, td = App.today(); return X.dayState(X.vehicle(i.v1), td) === 'Versé' && X.dayState(X.vehicle(i.v2), td) === 'Versé' && X.dayState(X.vehicle(id), td) === 'Manquant' && X.report(App.fin.range('month')).today === 1 && X.balance(X.vehicle(id)) === 8; }, [ids, v3]));
  check('documents : assurance dans 10 jours et vignette expirée signalées (vignette d\'abord), alerte sur l\'accueil', await p.evaluate(() => { const X = App.taxi, a = X.docAlerts(); return a.length === 2 && a[0].d.name === 'Vignette' && a[0].days === -3 && a[1].days === 10 && X.todo().some(x => x[0].includes('document')); }));
  check('véhicule jamais utilisé supprimable ; véhicule avec opérations non supprimable', await p.evaluate(([i, id]) => { const X = App.taxi; return X.removeVehicle(X.vehicle(id)) === true && X.removeVehicle(X.vehicle(i.v1)) === false && App.db.txVehicles.length === 2; }, [ids, v3]));

  // cancellation of a quota
  check('versement annulé (15) : facture annulée, paiement supprimé, solde de la moto 25 + 15 = 40 ; deuxième annulation refusée', await p.evaluate(id => { const X = App.taxi, o = X.op(id), i = App.sales.get(o.invoiceId), v = X.vehicle(o.vehicleId), r = X.cancelOp(o); return r === true && !App.sales.live(i) && !App.db.payments.some(x => x.invoiceId === i.id) && Math.abs(X.balance(v) - 40) < 0.005 && X.cancelOp(o) === false; }, o1.id));

  // messages, documents and report
  check('relance du chauffeur, message au propriétaire et ticket de versement', await p.evaluate(i => { const X = App.taxi, v = X.vehicle(i.v1), w = X.vehicle(i.v2); return X.msg(v, 'late').includes('Chauffeur Un') && X.msg(v, 'late').includes('AB-123 C') && X.msg(w, 'owner').includes('Propriétaire Un') && X.msg(v, 'thanks').includes('merci'); }, ids));
  const rep = await p.evaluate(() => { const X = App.taxi, c = X.report({ from: App.addDays(App.today(), -30), to: App.today(), label: 'test' }); return { paid: c.paid, due: c.due, cost: c.cost, net: c.net, rate: c.rate, rows: c.rows.length, cats: c.cats, drivers: c.drivers.map(d => d.name).sort().join(), owed: c.owed, od: c.ownersDue, n: c.n, arrears: c.arrears }; });
  check('rapport : reçu 5 + 40 = 45 sur 45 + 40 = 85 attendus (53 %), dépenses 20, résultat 25 ; carburant 10, entretien 10 ; à récupérer 40 ; à reverser 5', near(rep.paid, 45) && near(rep.due, 85) && near(rep.cost, 20) && near(rep.net, 25) && rep.rate === 53 && rep.rows === 2 && near(rep.cats.Carburant, 10) && near(rep.cats.Entretien, 10) && near(rep.owed, 40) && near(rep.od, 5) && rep.n === 2 && rep.arrears === 1, JSON.stringify(rep));
  check('rapport par chauffeur : Chauffeur Un et « non attribué »', rep.drivers.includes('Chauffeur Un') && rep.drivers.includes('Non attribué'));
  check('texte du rapport (WhatsApp)', await p.evaluate(() => App.taxi.reportText(App.fin.range('month')).includes('Rapport taxi')));

  // screens: new vehicle from the form, quota from the form
  await go('vehicles'); await p.click('#nvh'); await p.waitForSelector('.sheet [name=plate]'); await settle(); await p.fill('.sheet [name=plate]', 'MT 55'); await p.selectOption('.sheet [name=kind]', 'Moto-taxi'); await p.selectOption('.sheet [name=driverId]', 'm2'); await p.fill('.sheet [name=quota]', '6'); await p.click('.sheet #rd [data-d="0"]'); await ok();
  await p.waitForFunction(() => App.db.txVehicles.length === 3);
  check('véhicule par le formulaire : MT 55, chauffeur Deux, quota 6, repos le dimanche', await p.evaluate(() => { const v = App.db.txVehicles[2]; return v.plate === 'MT 55' && v.driverId === 'm2' && v.quota === 6 && v.rest.join() === '0' && v.kind === 'Moto-taxi'; }));
  await p.evaluate(id => App.taxi.versementForm(id), (await p.evaluate(() => App.db.txVehicles[2].id))); await p.waitForSelector('.sheet [name=amount]'); await settle();
  check('formulaire de versement : le montant reprend le quota (6)', (await p.inputValue('.sheet [name=amount]')) === '6');
  await p.fill('.sheet [name=amount]', '9'); await ok(); await p.waitForFunction(() => App.db.txOps.some(o => o.vehicleId === App.db.txVehicles[2].id && o.kind === 'versement'));
  check('versement par le formulaire : 9 reçus pour MT 55', await p.evaluate(() => { const o = App.db.txOps.find(x => x.vehicleId === App.db.txVehicles[2].id); return o.amount === 9 && o.driverId === 'm2'; }));
  for (const tab of ['day', 'vehicles', 'ops', 'rep']) { await go(tab); check('onglet ' + tab + ' s\'affiche sans erreur', (await p.locator('#gtab').innerHTML()).length > 80); }
  await go('vehicles'); await p.click('#gtab [data-v] >> nth=0'); await p.waitForSelector('.sheet .hero'); check('fiche véhicule : solde, documents, opérations', (await p.textContent('.sheet')).includes('quota') && (await p.textContent('.sheet-wrap.on footer')).length > 1); await closeTop();
  await go('ops'); check('onglet opérations : propriétaire et solde à reverser listés', (await p.textContent('#gtab')).includes('Propriétaire Un') && (await p.textContent('#gtab')).includes('À reverser'));
  check('Synchro : les collections sont partagées', await p.evaluate(() => ['txVehicles', 'txOps'].every(k => Array.isArray(App.db[k]))));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
