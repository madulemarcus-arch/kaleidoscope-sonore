// Hôtel & hébergement: rooms, reservations and immediate arrivals as ordinary invoices, no double booking, extras charged to the room (services and stock items), tourist tax,
// stay changes (extend, move room), departure, housekeeping, no-show keeping the deposit, passage stays, occupancy report, cash drawer. Fictitious data only.
const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'hotel' });
  const go = async tab => { await p.evaluate(tb => App.go('hotel', { tab: tb }), tab); await p.waitForSelector('#gtabs'); };
  const ok = () => p.click('.sheet-wrap.on footer .primary'), closeTop = async () => { await p.waitForSelector('.sheet-wrap.on'); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' }); };
  await p.evaluate(() => { window.near = (a, b) => Math.abs(a - b) < 0.02; });
  const D = n => p.evaluate(n => App.addDays(App.today(), n), n);

  check('secteur « Hôtel & hébergement » : module activé avec stock et ventes', await p.evaluate(() => App.mod('hotel') && App.mod('stock') && App.mod('sales') && App.db.settings.activity === 'hotel'));
  check('barre du bas : Hôtel en tête', (await p.textContent('#tabs')).includes('Hôtel'));
  await go('rooms'); check('écran vide : carte avec bouton d\'action', (await p.locator('#view .empty [data-cta]').count()) === 1);
  await p.click('#ra'); await p.waitForSelector('.sheet [name=no]'); await p.fill('.sheet [name=no]', '101'); await p.fill('.sheet [name=rate]', '40'); await p.fill('.sheet [name=short]', '15'); await ok(); await p.waitForFunction(() => App.db.htRooms.length === 1); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('chambre 101 enregistrée (propre, 2 personnes, 40 par nuit)', await p.evaluate(() => { const r = App.db.htRooms[0]; return r.no === '101' && r.rate === 40 && r.short === 15 && r.hk === 'Propre' && r.cap === 2; }));
  check('numéro déjà utilisé refusé', await p.evaluate(() => App.hotel.addRoom({ no: '101', rate: 1 }) === null));
  await p.evaluate(() => { App.hotel.addRoom({ no: '102', type: 'Climatisée', rate: 60, short: 20 }); App.hotel.addRoom({ no: '103', type: 'VIP', rate: 100 });
    App.db.products.push({ id: 'bi', code: 'PR-bi', name: 'Bière', cat: 'Général', unit: 'pièce', qty: 10, min: 1, cost: 1, price: 2, track: true, fields: {} });
    App.db.clients.push({ id: 'c1', code: 'CL-0001', name: 'Client Test', phone: '0990000001', type: 'Particulier', created: App.today(), fields: {} }); App.save(); });
  check('plan des chambres : 3 chambres libres', await p.evaluate(() => App.db.htRooms.every(r => App.hotel.state(r) === 'Libre')));

  // immediate arrival through the form
  await go('stays'); await p.click('#sa'); await p.waitForSelector('.sheet #sf'); await p.selectOption('.sheet [name=clientId]', 'c1'); await p.fill('.sheet [name=out]', await D(2)); await p.fill('.sheet [name=idNo]', 'AB123'); await p.fill('.sheet [name=deposit]', '30');
  check('récapitulatif : 2 nuits, total 80, reste 50', await p.evaluate(() => { const x = document.querySelector('.sheet #tt').textContent; return x.includes('2 nuits') && x.includes('80') && x.includes('50'); }));
  await ok(); await p.waitForFunction(() => App.db.htStays.length === 1); await p.waitForSelector('.sheet-wrap.on .hero'); await closeTop();
  const s1 = await p.evaluate(() => App.db.htStays[0].id);
  check('séjour SJ-AAAA-0001 : en séjour, facture « Hôtel » de 80, acompte 30 encaissé, chambre occupée', await p.evaluate(id => { const s = App.hotel.stay(id), i = App.sales.get(s.invoiceId); return /^SJ-\d{4}-0001$/.test(s.number) && s.status === 'En séjour' && i.source === 'Hôtel' && i.total === 80 && App.sales.paid(i) === 30 && App.hotel.state(App.hotel.room(s.roomId)) === 'Occupée' && s.idNo === 'AB123'; }, s1));
  check('caisse en espèces : +30 (acompte)', await p.evaluate(() => App.cash.expected().USD === 30));

  // no double booking
  check('même chambre sur des dates qui se chevauchent : refusé', await p.evaluate(async () => { const r = App.hotel.addStay({ roomId: App.db.htRooms[0].id, in: App.addDays(App.today(), 1), out: App.addDays(App.today(), 3), rate: 40 }); return !!r.err; }));
  check('passage refusé dans une chambre occupée la nuit', await p.evaluate(() => !!App.hotel.addStay({ kind: 'short', roomId: App.db.htRooms[0].id, in: App.today(), rate: 15 }).err));
  check('arrivée le jour du départ : acceptée (la chambre se libère)', await p.evaluate(() => !!App.hotel.free(App.db.htRooms[0].id, App.addDays(App.today(), 2), App.addDays(App.today(), 4), 'night')));
  check('départ avant arrivée refusé, chambre en maintenance refusée à l\'arrivée', await p.evaluate(() => { const r = App.db.htRooms[2]; r.hk = 'Maintenance'; const a = !!App.hotel.addStay({ roomId: App.db.htRooms[1].id, in: App.addDays(App.today(), 3), out: App.today(), rate: 60 }).err, b = !!App.hotel.addStay({ now: true, roomId: r.id, out: App.addDays(App.today(), 1), rate: 100 }).err; r.hk = 'Propre'; return a && b; }));

  // extras: a service and a stock item
  await p.evaluate(id => App.hotel.chargeForm(id), s1); await p.waitForSelector('.sheet [name=item]'); await p.selectOption('.sheet [name=item]', 's0'); await p.fill('.sheet [name=qty]', '2'); await ok(); await p.waitForFunction(id => App.hotel.stay(id).charges.length === 1, s1); await closeTop();
  check('extra « Petit-déjeuner » 2 × 5 : facture 90', await p.evaluate(id => App.sales.get(App.hotel.stay(id).invoiceId).total === 90, s1));
  const c2 = await p.evaluate(id => App.hotel.addCharge(App.hotel.stay(id), { pid: 'bi', qty: 3, price: 2 }).id, s1);
  check('bière du stock 3 × 2 : stock −3, facture 96', await p.evaluate(id => App.stock.get('bi').qty === 7 && App.sales.get(App.hotel.stay(id).invoiceId).total === 96, s1));
  check('extra au-delà du stock refusé', await p.evaluate(id => App.hotel.addCharge(App.hotel.stay(id), { pid: 'bi', qty: 99, price: 2 }) === null, s1));
  await p.evaluate(([id, c]) => { const s = App.hotel.stay(id); App.hotel.cancelCharge(s, s.charges.find(x => x.id === c)); }, [s1, c2]);
  check('extra retiré : stock remis (10), facture 90', await p.evaluate(id => App.stock.get('bi').qty === 10 && App.sales.get(App.hotel.stay(id).invoiceId).total === 90, s1));

  // tourist tax, extend, move room
  await p.evaluate(() => { App.hotel.cfg().tax = 1; });
  const s2 = await p.evaluate(() => App.hotel.addStay({ roomId: App.db.htRooms[1].id, in: App.addDays(App.today(), 5), out: App.addDays(App.today(), 7), rate: 60, guests: 2, clientId: 'c1', deposit: 20 }).id);
  check('réservation future : Réservé, chambre libre aujourd\'hui, taxe de séjour 2 nuits × 2 pers. (124)', await p.evaluate(id => { const s = App.hotel.stay(id), i = App.sales.get(s.invoiceId); return s.status === 'Réservé' && App.hotel.state(App.hotel.room(s.roomId)) === 'Libre' && i.total === 124 && i.lines.some(l => l.desc === 'Taxe de séjour' && l.qty === 4); }, s2));
  await p.evaluate(() => { App.hotel.cfg().tax = 0; });
  check('prolonger d\'une nuit : 3 nuits, facture 130', await p.evaluate(id => { const r = App.hotel.modify(App.hotel.stay(id), { out: App.addDays(App.today(), 3) }); return !r.err && App.hotel.nights(App.hotel.stay(id)) === 3 && App.sales.get(App.hotel.stay(id).invoiceId).total === 130; }, s1));
  check('prolonger sur une réservation existante : refusé', await p.evaluate(id => { App.hotel.addStay({ roomId: App.db.htRooms[0].id, in: App.addDays(App.today(), 4), out: App.addDays(App.today(), 5), rate: 40 }); return !!App.hotel.modify(App.hotel.stay(id), { out: App.addDays(App.today(), 5) }).err; }, s1));
  check('changer de chambre (103 à 100 la nuit) : lignes recalculées, 101 à nettoyer', await p.evaluate(id => { const s = App.hotel.stay(id), r = App.hotel.moveRoom(s, App.db.htRooms[2].id, 100); return !r.err && s.moves.length === 1 && App.sales.get(s.invoiceId).total === 100 * 3 + 10 && App.hotel.state(App.db.htRooms[0]) === 'À nettoyer' && App.hotel.state(App.db.htRooms[2]) === 'Occupée'; }, s1));

  // departure: nights recomputed, room to clean
  await p.evaluate(id => App.hotel.staySheet(id), s1); await p.waitForSelector('.sheet .hero'); check('fiche du séjour : reste à payer et boutons Extra / Départ', (await p.textContent('.sheet-wrap.on footer')).includes('Extra') && (await p.textContent('.sheet-wrap.on footer')).includes('Départ')); await closeTop();
  check('départ le jour même : 1 nuit facturée (100 + 10), statut Parti, chambre 103 à nettoyer', await p.evaluate(id => { const s = App.hotel.stay(id); App.hotel.checkOut(s); return s.status === 'Parti' && App.hotel.nights(s) === 1 && App.sales.get(s.invoiceId).total === 110 && App.hotel.state(App.db.htRooms[2]) === 'À nettoyer'; }, s1));
  await go('clean'); check('onglet Ménage : 2 chambres à nettoyer (101 et 103)', (await p.locator('#gtab [data-p]').count()) === 2); await p.click('#gtab [data-p]'); await p.waitForFunction(() => App.db.htRooms.filter(r => r.hk === 'À nettoyer').length === 1);
  check('marquer propre : chambre de nouveau libre', await p.evaluate(() => App.db.htRooms.filter(r => r.hk === 'Propre').length === 2));
  check('accueil « À faire » : chambre à nettoyer', await p.evaluate(() => App.hotel.todo().some(x => x[0].includes('à nettoyer'))));

  // cancel and no-show
  const s3 = await p.evaluate(() => App.hotel.addStay({ roomId: App.db.htRooms[1].id, in: App.addDays(App.today(), 10), out: App.addDays(App.today(), 11), rate: 60 }).id);
  check('annuler une réservation sans paiement : facture annulée, chambre libérée', await p.evaluate(id => { const s = App.hotel.stay(id); return App.hotel.cancelStay(s) === true && s.status === 'Annulé' && !App.sales.live(App.sales.get(s.invoiceId)) && App.hotel.free(s.roomId, s.in, s.out, 'night'); }, s3));
  check('annuler avec acompte : refusé (« paid »)', await p.evaluate(id => App.hotel.cancelStay(App.hotel.stay(id)) === 'paid', s2));
  check('no-show avec acompte 20 : gardé comme frais d\'annulation, facture 20 soldée', await p.evaluate(id => { const s = App.hotel.stay(id); App.hotel.cancelStay(s, true); const i = App.sales.get(s.invoiceId); return s.status === 'No-show' && i.total === 20 && App.sales.due(i) === 0 && App.hotel.free(s.roomId, s.in, s.out, 'night'); }, s2));

  // reservation then arrival, busy room, passage
  const s4 = await p.evaluate(() => App.hotel.addStay({ roomId: App.db.htRooms[1].id, in: App.today(), out: App.addDays(App.today(), 1), rate: 60 }).id);
  check('arrivée attendue aujourd\'hui : listée, puis enregistrée → en séjour', await p.evaluate(id => { const s = App.hotel.stay(id), a = App.hotel.arrivals().includes(s); return a && App.hotel.checkIn(s) === true && s.status === 'En séjour'; }, s4));
  check('passage de 3 h : facture 15 pour la chambre libre, deux passages le même jour acceptés', await p.evaluate(() => { const r = App.db.htRooms[0], a = App.hotel.addStay({ kind: 'short', roomId: r.id, in: App.today(), rate: 15, now: true }), b = App.hotel.addStay({ kind: 'short', roomId: r.id, in: App.today(), rate: 15 }); return !a.err && !b.err && App.sales.get(a.invoiceId).total === 15 && App.hotel.nights(a) === 0; }));

  // report and tabs
  const r = await p.evaluate(() => { const c = App.hotel.report(App.fin.range('month')); return { occ: c.occ, nights: c.nights, passages: c.passages, total: c.total, by: Object.keys(c.by).sort().join() }; });
  check('rapport du mois : nuitées, passages et chiffre d\'affaires comptés, par type de chambre', r.nights >= 2 && r.passages === 1 && r.total > 0 && r.occ > 0 && r.occ <= 100 && r.by.includes('VIP') && r.by.includes('Standard'));
  for (const tab of ['rooms', 'stays', 'clean', 'rep']) { await go(tab); check('onglet ' + tab + ' s\'affiche sans erreur', (await p.locator('#gtab').innerHTML()).length > 80); }
  await go('rooms'); await p.click('#gtab [data-r]'); await p.waitForSelector('.sheet .hero'); check('fiche chambre : prix par nuit affiché', (await p.textContent('.sheet .hero')).includes('40')); await closeTop();
  check('texte du rapport (WhatsApp)', await p.evaluate(() => App.hotel.reportText(App.fin.range('month')).includes('Rapport hôtel')));
  check('Synchro : les collections sont partagées', await p.evaluate(() => ['htRooms', 'htStays'].every(k => Array.isArray(App.db[k]))));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
