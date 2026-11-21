// Eau & énergie: tariffs with consumption tiers and a fixed fee, meters (postpaid / prepaid), readings (never below the previous index), billing of postpaid readings as real invoices, prepaid credit used
// up by the consumption, low credit and cut-off, reconnection fee, cancellation rules, report, screens. Fictitious data only.
const { check, launch, setup } = require('./helper');
(async () => {
  const near = (a, b) => Math.abs(a - b) < 0.005, t = await launch(), p = t.page; await setup(p, { activity: 'eau' });
  const go = async (tab, f) => { await p.evaluate(([tb, ff]) => App.go('utility', { tab: tb, f: ff }), [tab, f]); await p.waitForSelector('#gtabs'); };
  const settle = () => p.waitForFunction(() => document.activeElement && document.activeElement.closest && document.activeElement.closest('.sheet')), ok = () => p.click('.sheet-wrap.on footer .primary'), closeTop = async () => { await p.waitForSelector('.sheet-wrap.on'); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' }); };

  check('secteur « Eau & énergie prépayée » : module activé', await p.evaluate(() => App.mod('utility') && App.mod('sales') && App.db.settings.activity === 'eau'));
  check('barre du bas : Eau & énergie', (await p.textContent('#tabs')).includes('Eau'));
  await go('meters'); check('écran vide : carte avec bouton d\'action', (await p.locator('#gtab .empty [data-cta]').count()) === 1);
  await p.evaluate(() => { ['Abonné Un', 'Abonné Deux', 'Abonné Trois'].forEach((n, k) => App.db.clients.push({ id: 'c' + (k + 1), code: 'CL-000' + (k + 1), name: n, phone: '0990000' + k, fields: {} })); App.save(); });

  // tariffs
  check('tarif refusé : sans nom, unité inconnue, sans tranches, tranches invalides, décroissantes, « au-delà » pas en dernier', await p.evaluate(() => { const U = App.utility, b = { name: 'T', unit: 'm³', tiers: '10 : 1,5\nau-delà : 2' }; return !!U.saveTariff({ ...b, name: '' }).err && !!U.saveTariff({ ...b, unit: 'x' }).err && !!U.saveTariff({ ...b, tiers: '' }).err && !!U.saveTariff({ ...b, tiers: 'abc' }).err && !!U.saveTariff({ ...b, tiers: '20 : 1\n10 : 2' }).err && !!U.saveTariff({ ...b, tiers: 'au-delà : 1\n10 : 2' }).err && App.db.utTariffs.length === 0; }));
  check('tarifs : « Eau » (10 → 1,50 ; 30 → 2 ; au-delà 3 ; abonnement 2) et « Électricité » (0,20 le kWh) ; coût de 5 m³ = 7,50, de 15 m³ = 25, de 40 m³ = 85 ; doublon refusé', await p.evaluate(() => { const U = App.utility; U.saveTariff({ name: 'Eau', unit: 'm³', fee: 2, tiers: '10 : 1,5\n30 : 2\nau-delà : 3' }); U.saveTariff({ name: 'Électricité', unit: 'kWh', tiers: 'au-delà : 0,2' }); const e = App.db.utTariffs[0]; return near(U.cost(e, 5), 7.5) && near(U.cost(e, 15), 25) && near(U.cost(e, 40), 85) && near(U.cost(App.db.utTariffs[1], 100), 20) && !!U.saveTariff({ name: 'eau', unit: 'm³', tiers: '5 : 1' }).err && App.db.utTariffs.length === 2; function near(a, b) { return Math.abs(a - b) < 0.005; } }));
  const tid = await p.evaluate(() => ({ eau: App.db.utTariffs[0].id, el: App.db.utTariffs[1].id }));

  // meters
  check('compteur refusé : sans abonné, sans numéro, tarif inconnu, numéro en double', await p.evaluate(tid => { const U = App.utility, b = { clientId: 'c1', number: 'EAU-001', tariffId: tid.eau }; U.saveMeter({ ...b, start: 100, zone: 'Nord' }); return !!U.saveMeter({ ...b, clientId: '' }).err && !!U.saveMeter({ ...b, number: '' }).err && !!U.saveMeter({ ...b, tariffId: 'x', number: 'Z' }).err && !!U.saveMeter({ ...b, number: 'eau-001' }).err && App.db.utMeters.length === 1; }, tid));
  await p.evaluate(tid => { const U = App.utility; U.saveMeter({ clientId: 'c2', number: 'EAU-002', tariffId: tid.eau, mode: 'Prépayé', start: 0, zone: 'Sud' }); U.saveMeter({ clientId: 'c3', number: 'ELEC-1', tariffId: tid.el, start: 1000, zone: 'Nord' }); }, tid);
  const mid = await p.evaluate(() => ({ m1: App.db.utMeters[0].id, m2: App.db.utMeters[1].id, m3: App.db.utMeters[2].id }));

  // readings
  check('relevé refusé : sans compteur, sans index, index inférieur au départ (90 < 100), date future', await p.evaluate(m => { const U = App.utility; return !!U.addRead({ index: 10 }).err && !!U.addRead({ meterId: m.m1, index: '' }).err && U.addRead({ meterId: m.m1, index: 90 }).err.includes('inférieur') && !!U.addRead({ meterId: m.m1, index: 120, date: App.addDays(App.today(), 1) }).err && App.db.utReads.length === 0; }, mid));
  const r1 = await p.evaluate(m => { const U = App.utility, r = U.addRead({ meterId: m.m1, index: 115 }); return { id: r.id, u: U.usage(r), v: U.value(r) }; }, mid);
  check('relevé 115 (départ 100) : 15 m³ consommés, valeur 15 × tranches = 25 + abonnement 2 = 27', near(r1.u, 15) && near(r1.v, 27));
  check('relevé suivant refusé : index inférieur au précédent (110 < 115), date antérieure au dernier relevé', await p.evaluate(m => { const U = App.utility; return U.addRead({ meterId: m.m1, index: 110 }).err.includes('inférieur') && U.addRead({ meterId: m.m1, index: 130, date: App.addDays(App.today(), -1) }).err.includes('antérieure'); }, mid));
  const r2 = await p.evaluate(m => { const U = App.utility, r = U.addRead({ meterId: m.m1, index: 140 }); return { id: r.id, u: U.usage(r), v: U.value(r) }; }, mid);
  check('relevé 140 : 25 m³ (10 à 1,50 + 15 à 2 = 45) + 2 = 47', near(r2.u, 25) && near(r2.v, 47));
  const r3 = await p.evaluate(m => { const U = App.utility, a = U.addRead({ meterId: m.m3, index: 1100 }), b = U.addRead({ meterId: m.m3, index: 1100 }); return { a: a.id, b: b.id, va: U.value(a), vb: U.value(b) }; }, mid);
  check('électricité : 100 kWh × 0,20 = 20 ; même index ensuite : consommation nulle, valeur 0', near(r3.va, 20) && near(r3.vb, 0));
  check('à faire : relevés à facturer', await p.evaluate(() => App.utility.todo().some(x => x[0].includes('à facturer'))));

  // billing
  const b1 = await p.evaluate(id => { const U = App.utility, r = U.read(id), i = U.bill(r), again = U.bill(r); return { total: i.total, src: i.source, client: i.clientId, lines: i.lines.length, again: !!again.err, linked: r.invoiceId === i.id }; }, r1.id);
  check('facturation du relevé 1 : facture « Eau & énergie » de 27 pour l\'abonné 1 (consommation 25 + abonnement 2), reliée au relevé ; refacturer refusé', near(b1.total, 27) && b1.src === 'Eau & énergie' && b1.client === 'c1' && b1.lines === 2 && b1.again && b1.linked);
  check('consommation nulle sans abonnement : « rien à facturer » ; compteur prépayé : facturation refusée', await p.evaluate(([b, m2]) => { const U = App.utility; return U.bill(U.read(b)).err.includes('Rien à facturer'); }, [r3.b, mid.m2]));
  const ba = await p.evaluate(() => { const U = App.utility, r = U.billAll(); return { n: r.n, total: r.total, left: U.billable().length }; });
  check('tout facturer : 2 factures (47 + 20 = 67) ; reste le relevé sans valeur', ba.n === 2 && near(ba.total, 67) && ba.left === 1);

  // prepaid
  check('recharge refusée : sans compteur, compteur postpayé, montant nul', await p.evaluate(m => { const U = App.utility; return !!U.topup({ amount: 5 }).err && U.topup({ meterId: m.m1, amount: 5 }).err.includes('postpayé') && !!U.topup({ meterId: m.m2, amount: 0 }).err; }, mid));
  const tp = await p.evaluate(m => { const U = App.utility, o = U.topup({ meterId: m.m2, amount: 30 }), i = App.sales.get(o.invoiceId); return { id: o.id, n: o.number, paid: App.sales.paid(i), src: i.source, bal: U.balance(U.meter(m.m2)) }; }, mid);
  check('recharge de 30 : UT-AAAA-0001, facture payée, crédit 30', /^UT-\d{4}-0001$/.test(tp.n) && near(tp.paid, 30) && tp.src === 'Eau & énergie' && near(tp.bal, 30));
  check('relevé 12 sur le compteur prépayé : 12 m³ = 15 + 4 + 2 = 21 déduits du crédit → 9 ; pas de facture', await p.evaluate(m => { const U = App.utility, r = U.addRead({ meterId: m.m2, index: 12 }), me = U.meter(m.m2); return near(U.value(r), 21) && near(U.balance(me), 9) && !r.invoiceId && U.bill(r).err.includes('prépayé') && U.state(me) === 'Actif'; function near(a, b) { return Math.abs(a - b) < 0.005; } }, mid));
  check('alerte crédit bas à 10 : « Crédit bas » ; relevé 20 (8 m³ = 14) → crédit −5 : « À couper »', await p.evaluate(m => { const U = App.utility, me = U.meter(m.m2); U.cfg().low = 10; const s1 = U.state(me); U.addRead({ meterId: m.m2, index: 20 }); return s1 === 'Crédit bas' && Math.abs(U.balance(me) + 5) < 0.005 && U.state(me) === 'À couper'; }, mid));
  check('recharge de 20 → crédit 15 « Actif » ; recharge annulée : paiement supprimé, retour à −5', await p.evaluate(m => { const U = App.utility, me = U.meter(m.m2), o = U.topup({ meterId: m.m2, amount: 20 }), i = App.sales.get(o.invoiceId), s1 = Math.abs(U.balance(me) - 15) < 0.005 && U.state(me) === 'Actif', r = U.cancelTopup(o); return s1 && r === true && !App.sales.live(i) && !App.db.payments.some(x => x.invoiceId === i.id) && Math.abs(U.balance(me) + 5) < 0.005 && U.cancelTopup(o) === false; }, mid));
  check('annulation d\'un relevé : seul le dernier ; un relevé facturé jamais ; le dernier du compteur prépayé annulé → crédit 9', await p.evaluate(([m, r2id]) => { const U = App.utility, l = U.readsOf(m.m2), a = U.cancelRead(l[0]), b = U.cancelRead(U.read(r2id)), c = U.cancelRead(l[1]); return a === 'notlast' && b === 'billed' && c === true && Math.abs(U.balance(U.meter(m.m2)) - 9) < 0.005 && U.readsOf(m.m2).length === 1; }, [mid, r2.id]));

  // cut-off, reconnection
  check('facture de 20 jours (délai 15 j) : abonné 1 à couper (reste dû 74) ; abonné 3 (facture du jour) : « Impayé »', await p.evaluate(([m, id]) => { const U = App.utility, i = App.sales.get(U.read(id).invoiceId); i.date = App.addDays(App.today(), -20); return Math.abs(U.due(U.meter(m.m1)) - 74) < 0.005 && U.overdue(U.meter(m.m1)).length === 1 && U.state(U.meter(m.m1)) === 'À couper' && U.state(U.meter(m.m3)) === 'Impayé' && U.todo().some(x => x[0].includes('à couper')); }, [mid, r1.id]));
  check('coupure : compteur coupé (deuxième coupure refusée) ; rebranchement avec 5 de frais : facture payée, compteur actif ; rebranchement d\'un compteur non coupé refusé', await p.evaluate(m => { const U = App.utility, me = U.meter(m.m1); U.cfg().reconnect = 5; const c1 = U.cut(me), c2 = U.cut(me), s = U.state(me) === 'Coupé', r = U.reconnect(me, { paid: true }), x = U.reconnect(me, {}); return c1 === true && c2 === false && s && r.source === 'Eau & énergie' && Math.abs(App.sales.paid(r) - 5) < 0.005 && me.cut === false && !!x.err; }, mid));
  check('compteur sans relevé depuis plus de 35 jours signalé', await p.evaluate(tid => { const U = App.utility; U.saveMeter({ clientId: 'c3', number: 'EAU-004', tariffId: tid.eau, since: App.addDays(App.today(), -40) }); return U.todo().some(x => x[0].includes('35 jours')); }, tid));

  // report and texts
  const rep = await p.evaluate(() => { const c = App.utility.report(App.fin.range('month')); return { n: c.n, usage: c.usage, by: c.by.map(x => x.unit + ':' + x.q).sort().join(), total: c.total, paid: c.paid, due: c.due, topups: c.topups, ntops: c.ntops, meters: c.meters, unpaid: c.unpaid, cut: c.cut, low: c.low, toBill: c.toBill, zones: c.zones.map(z => z.zone).sort().join() }; });
  check('rapport : 5 relevés, 152 unités (52 m³ + 100 kWh), facturé 74 + 20 + 30 + 5 = 129, encaissé 35, à encaisser 94, recharges 30, 4 compteurs, impayés 94, 1 à couper, 1 crédit bas, zones Nord et Sud', rep.n === 5 && near(rep.usage, 152) && rep.by === 'kWh:100,m³:52' && near(rep.total, 129) && near(rep.paid, 35) && near(rep.due, 94) && near(rep.topups, 30) && rep.ntops === 1 && rep.meters === 4 && near(rep.unpaid, 94) && rep.cut === 1 && rep.low === 1 && rep.zones === 'Nord,Sud', JSON.stringify(rep));
  check('textes : rappel de paiement, crédit bas, dernier relevé, rapport, reçu de recharge', await p.evaluate(m => { const U = App.utility; return U.msg(U.meter(m.m1), 'due').includes('Abonné Un') && U.msg(U.meter(m.m2), 'low').includes('crédit') && U.msg(U.meter(m.m1), 'read').includes('EAU-001') && U.reportText(App.fin.range('month')).includes('Rapport eau') && typeof U.printTopup === 'function'; }, mid));

  // screens
  await p.evaluate(() => App.utility.readForm()); await p.waitForSelector('.sheet [name=meterId]'); await settle(); await p.selectOption('.sheet [name=meterId]', mid.m3); await p.fill('.sheet [name=index]', '1150');
  check('formulaire de relevé : dernier index 1 100 et consommation 50 kWh annoncés', await p.evaluate(() => { const t = document.querySelector('.sheet #ri').textContent.replace(/\s/g, ''); return t.includes('1100') && t.includes('50kWh'); }));
  await ok(); await p.waitForFunction(() => App.db.utReads.length === 7); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('relevé par le formulaire : 1 150 sur ELEC-1, à facturer', await p.evaluate(m => { const U = App.utility, r = U.last(U.meter(m.m3)); return r.index === 1150 && !r.invoiceId && near(U.value(r), 10) && U.billable().length === 2; function near(a, b) { return Math.abs(a - b) < 0.005; } }, mid));
  await p.evaluate(m => App.utility.topupForm(m), mid.m2); await p.waitForSelector('.sheet [name=amount]'); await settle(); await p.fill('.sheet [name=amount]', '10');
  check('formulaire de recharge : crédit actuel 9 annoncé', await p.evaluate(() => document.querySelector('.sheet #tb').textContent.replace(/\s/g, '').includes('9,00')));
  await ok(); await p.waitForFunction(m => App.utility.balance(App.utility.meter(m)) > 18, mid.m2); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('recharge par le formulaire : crédit 9 + 10 = 19', await p.evaluate(m => Math.abs(App.utility.balance(App.utility.meter(m)) - 19) < 0.005, mid.m2));
  for (const tab of ['meters', 'bills', 'tariffs', 'ops', 'rep']) { await go(tab); check('onglet ' + tab + ' s\'affiche sans erreur', (await p.locator('#gtab').innerHTML()).length > 80); }
  await go('meters'); await p.click('#gtab [data-m="' + mid.m1 + '"]'); await p.waitForSelector('.sheet .hero'); check('fiche compteur : reste à payer, relevés', (await p.textContent('.sheet')).includes('Reste à payer') && (await p.textContent('.sheet')).includes('Relevés')); await closeTop();
  check('Synchro : les collections sont partagées', await p.evaluate(() => ['utTariffs', 'utMeters', 'utReads', 'utOps'].every(k => Array.isArray(App.db[k]))));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
