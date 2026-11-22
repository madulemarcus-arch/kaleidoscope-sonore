// Parking & gardiennage: spots, rates by type and unit, stay fee (grace, hourly, daily cap, lost ticket), rates copied into the stay, subscribers (free entry, reserved spot, overlap refused),
// full parking, stays and subscriptions as real invoices, cancellation, report, forms and screens. Fictitious data only.
const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'parking' });
  const go = async tab => { await p.evaluate(a => App.go('parking', a), { tab }); await p.waitForSelector('#ktabs'); };

  check('secteur « Parking & gardiennage » : module activé, vocabulaire « abonné »', await p.evaluate(() => App.mod('parking') && App.mod('sales') && App.db.settings.activity === 'parking' && App.db.settings.vocab.client === 'abonné'));
  await go('gate'); check('écran vide : carte avec bouton d\'action', (await p.locator('#ktab .empty').count()) >= 1);
  await p.evaluate(() => { [['c1', 'Abonné Un'], ['c2', 'Abonné Deux']].forEach(x => App.db.clients.push({ id: x[0], code: 'CL-' + x[0], name: x[1], phone: '09900000' + x[0].slice(1), type: 'Particulier', created: App.today(), fields: {} })); App.save(); });

  const a = await p.evaluate(() => { const K = App.parking, noRate = K.enter({ plate: 'AB-123', vtype: 'Voiture' }).err, n = K.prepare(), again = K.prepare(), s1 = K.saveSpot({ name: 'A1', vtype: 'Voiture' }), s2 = K.saveSpot({ name: 'A2', vtype: 'Voiture' }), m1 = K.saveSpot({ name: 'M1', vtype: 'Moto' }), dup = K.saveSpot({ name: 'a1', vtype: 'Voiture' }).err; return { noRate, n, again, dup, s1: s1.id, s2: s2.id, m1: m1.id }; });
  check('sans tarif, l\'entrée est refusée ; « Préparer les tarifs » ajoute 8 tarifs sans doublon ; place en double refusée', /tarif/i.test(a.noRate) && a.n === 8 && a.again === 0 && /existe/.test(a.dup));

  const f = await p.evaluate(() => { const K = App.parking, fee = m => K.fee({ hr: 1, dr: 6, inAt: 0, outAt: m * 60000 }); return { g: fee(5), h1: fee(30), h3: fee(180), cap: fee(480), d1: fee(1500), two: fee(2880), sub: K.fee({ subId: 'x', hr: 1, dr: 6, inAt: 0, outAt: 99999999 }) }; });
  check('tarif : 10 min offertes, heure commencée, plafond par jour, 25 h = 1 jour + 1 h, abonné = 0', f.g === 0 && f.h1 === 1 && f.h3 === 3 && f.cap === 6 && f.d1 === 7 && f.two === 12 && f.sub === 0, JSON.stringify(f));

  const e = await p.evaluate(a => { const K = App.parking, s = K.enter({ plate: 'ab 123', vtype: 'Voiture', at: Date.now() - 3 * 3600000 }), dup = K.enter({ plate: 'AB-123', vtype: 'Voiture' }).err, s2 = K.enter({ plate: 'CD-456', vtype: 'Voiture' }), full = K.enter({ plate: 'EF-789', vtype: 'Voiture' }).err, fut = K.enter({ plate: 'ZZ-111', vtype: 'Moto', at: Date.now() + 3600000 * 5 }).err; return { n: s.number, dup, full, fut, inside: K.inside().length, spot: s.spotId !== s2.spotId, hr: s.hr, dr: s.dr }; }, null);
  check('entrée : numéro PK-, plaque reconnue écrite autrement (doublon refusé), parking complet refusé, heure future refusée', /^PK-\d{4}-0001$/.test(e.n) && /déjà/.test(e.dup) && /complet/i.test(e.full) && /futur/.test(e.fut) && e.inside === 2 && e.spot, JSON.stringify(e));

  const l = await p.evaluate(() => { const K = App.parking, S = App.sales, s = K.insideOf('AB123'), low = K.leave(s, { paid: 1 }).err, i0 = App.db.invoices.length; K.saveRate({ vtype: 'Voiture', unit: 'heure', price: 5 }, App.db.pkRates.find(r => r.vtype === 'Voiture' && r.unit === 'heure').id); const r = K.leave(s, {}), inv = S.get(r.invoiceId); return { low, status: r.status, total: inv.total, source: inv.source, paid: S.paid(inv), n: App.db.invoices.length - i0, snap: r.hr }; });
  check('sortie : montant insuffisant refusé sans client ; 3 h au tarif copié (le tarif changé ensuite ne réécrit pas) = 3 ; vraie facture « Parking » payée', /insuffisant/i.test(l.low) && l.status === 'Sorti' && l.total === 3 && l.source === 'Parking' && l.paid === 3 && l.n === 1 && l.snap === 1, JSON.stringify(l));
  check('un véhicule sorti ne ressort pas ; sa place est de nouveau libre', await p.evaluate(() => { const K = App.parking, s = App.db.pkStays[0]; return !!K.leave(s, {}).err && K.free('Voiture').length === 1; }));
  const lost = await p.evaluate(() => { const K = App.parking, s = K.insideOf('CD456'), r = K.leave(s, { lost: true, paid: 5 }); return { total: App.sales.get(r.invoiceId).total, lost: r.lost }; });
  check('ticket perdu : forfait de 5 facturé même sans durée à payer', lost.total === 5 && lost.lost === true, JSON.stringify(lost));

  const s = await p.evaluate(a => { const K = App.parking, M = App.db.pkSpots.find(x => x.name === 'M1'), sub = K.sell({ clientId: 'c1', plate: 'SUB-001', vtype: 'Voiture', months: 3, spotId: App.db.pkSpots.find(x => x.name === 'A1').id }), ov = K.sell({ clientId: 'c2', plate: 'sub 001', vtype: 'Voiture', months: 1, start: App.today() }).err, other = K.sell({ clientId: 'c2', plate: 'OTH-002', vtype: 'Voiture', months: 1, spotId: App.db.pkSpots.find(x => x.name === 'A1').id }).err, wrong = K.sell({ clientId: 'c2', plate: 'OTH-003', vtype: 'Voiture', months: 1, spotId: M.id }).err, i = App.sales.get(sub.invoiceId); return { n: sub.number, total: i.total, paid: App.sales.paid(i), ov, other, wrong, end: K.end(sub) > App.today() }; });
  check('abonnement : PA-…, vraie facture payée (80 × 3), chevauchement de plaque refusé, place déjà réservée refusée, place d\'un autre type refusée', /^PA-\d{4}-0001$/.test(s.n) && s.total === 240 && s.paid === 240 && /déjà/.test(s.ov) && /réservée|déjà/.test(s.other) && /réservée/.test(s.wrong) && s.end, JSON.stringify(s));
  const sb = await p.evaluate(() => { const K = App.parking, i0 = App.db.invoices.length, other = K.enter({ plate: 'NEW-009', vtype: 'Voiture' }), st = K.enter({ plate: 'SUB001', vtype: 'Voiture' }), a1 = App.db.pkSpots.find(x => x.name === 'A1'), r = K.leave(st, {}); return { otherSpotNotA1: other.spotId !== a1.id, own: st.spotId === a1.id, sub: !!st.subId, invs: App.db.invoices.length - i0, status: r.status, fee: K.fee(st) }; });
  check('abonné : entre et sort gratuitement sur sa place réservée (jamais donnée à un autre), sans facture', sb.otherSpotNotA1 && sb.own && sb.sub && sb.invs === 0 && sb.status === 'Sorti' && sb.fee === 0, JSON.stringify(sb));

  const c = await p.evaluate(() => { const K = App.parking, sub = App.db.pkSubs[0], r = K.cancelSub(sub), pay = App.db.invoices.length; return { r, status: sub.status }; });
  check('annuler un abonnement payé est refusé (paiements)', c.r === 'paid' && c.status === 'Valide', JSON.stringify(c));
  const cs = await p.evaluate(() => { const K = App.parking, s = App.db.pkStays.find(x => x.invoiceId && x.number.endsWith('0001')), i = App.sales.get(s.invoiceId), ok = K.cancelStay(s); return { ok, st: s.status, live: App.sales.live(i), paid: App.sales.paid(i) }; });
  check('annuler un passage (erreur de caisse) retire les paiements et annule la facture', cs.ok === true && cs.st === 'Annulé' && cs.live === false && cs.paid === 0, JSON.stringify(cs));
  const r = await p.evaluate(() => { const c = App.parking.report({ from: '0000-01-01', to: '9999-12-31', label: '' }); return { stays: c.stays, subs: c.subs, rev: c.revenue, txt: App.parking.reportText({ from: '0000-01-01', to: '9999-12-31', label: 'Tout' }).includes('Rapport parking') }; });
  check('rapport : passages, abonnements, recette (abonnement 240 + ticket perdu 5), texte copiable', r.stays === 2 && r.subs === 1 && r.rev === 245 && r.txt, JSON.stringify(r));
  check('Synchro : collections partagées et numéros uniques', await p.evaluate(() => ['pkSpots', 'pkRates', 'pkSubs', 'pkStays'].every(k => Array.isArray(App.db[k])) && new Set(App.db.pkStays.map(x => x.number)).size === App.db.pkStays.length));

  await go('gate'); await p.evaluate(() => App.parking.enterForm()); await p.waitForSelector('.sheet [name=plate]'); await p.fill('.sheet [name=plate]', 'frm-777'); await p.selectOption('.sheet [name=vtype]', 'Moto'); await p.click('.sheet-wrap.on footer .primary'); await p.waitForTimeout(400);
  check('entrée par le formulaire : FRM-777 est dans le parking', await p.evaluate(() => !!App.parking.insideOf('FRM777')));
  for (const tab of ['gate', 'subs', 'spots', 'rates', 'rep']) { await go(tab); await p.waitForTimeout(100); }
  check('les cinq onglets s\'affichent', true);
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
