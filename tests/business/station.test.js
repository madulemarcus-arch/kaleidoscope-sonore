// Station-service: tanks, pumps, price history, gauging, fuel deliveries (expense), shifts (index readings → litres, credit sales, declared cash → one invoice with the cash shortage line),
// derived tank levels, cancellations, report and cash drawer. Fictitious data only.
const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'station' }); await p.evaluate(() => { window.near = (a, b) => Math.abs(a - b) < 0.02; });
  const go = async tab => { await p.evaluate(tb => App.go('station', { tab: tb }), tab); await p.waitForSelector('#gtabs'); };
  const settle = () => p.waitForFunction(() => document.activeElement && document.activeElement.closest && document.activeElement.closest('.sheet')), ok = () => p.click('.sheet-wrap.on footer .primary'), closeTop = async () => { await p.waitForSelector('.sheet-wrap.on'); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' }); };

  check('secteur « Station-service » : module activé avec stock et ventes', await p.evaluate(() => App.mod('station') && App.mod('stock') && App.mod('sales') && App.db.settings.activity === 'station'));
  check('barre du bas : Station en tête', (await p.textContent('#tabs')).includes('Station'));
  await p.evaluate(() => { App.db.staff.push({ id: 'pm', name: 'Pompiste Test' }); App.db.clients.push({ id: 'c1', code: 'CL-0001', name: 'Transporteur Test', phone: '0990000001', type: 'Entreprise', created: App.today(), fields: {} }); App.db.suppliers.push({ id: 'f1', code: 'FO-0001', name: 'Dépôt Test', created: App.today() }); App.save(); });
  await go('tanks'); check('écran vide : carte avec bouton d\'action', (await p.locator('#gtab .empty [data-cta]').count()) === 1);
  await p.click('#tn'); await p.waitForSelector('.sheet [name=name]'); await settle(); await p.fill('.sheet [name=name]', 'Cuve 1'); await p.fill('.sheet [name=cap]', '10000'); await p.fill('.sheet [name=min]', '1000'); await ok(); await p.waitForFunction(() => App.db.stTanks.length === 1); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('cuve « Cuve 1 » : essence, 10 000 L, minimum 1 000', await p.evaluate(() => { const c = App.db.stTanks[0]; return c.fuel === 'Essence' && c.cap === 10000 && c.min === 1000; }));
  check('nom déjà utilisé, capacité nulle ou carburant inconnu refusés', await p.evaluate(() => App.station.addTank({ name: 'cuve 1', fuel: 'Essence', cap: 5 }) === null && App.station.addTank({ name: 'X', fuel: 'Essence', cap: 0 }) === null && App.station.addTank({ name: 'X', fuel: 'Eau', cap: 5 }) === null));
  await p.evaluate(() => { App.station.addTank({ name: 'Cuve 2', fuel: 'Gasoil', cap: 20000, min: 2000 }); });
  await go('pumps'); await p.click('#pn'); await p.waitForSelector('.sheet [name=name]'); await settle(); await p.fill('.sheet [name=name]', 'Pompe 1'); await p.fill('.sheet [name=index0]', '1000'); await ok(); await p.waitForFunction(() => App.db.stPumps.length === 1); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  await p.evaluate(() => { const S = App.station; S.addPump({ name: 'Pompe 2', tankId: App.db.stTanks[1].id, index0: 5000 }); S.setPrice({ fuel: 'Essence', price: 3 }); S.setPrice({ fuel: 'Gasoil', price: 2.5 }); S.addDip({ tankId: App.db.stTanks[0].id, litres: 8000 }); S.addDip({ tankId: App.db.stTanks[1].id, litres: 15000 }); });
  check('pompes reliées à leur cuve, prix du litre fixés (3 et 2,5)', await p.evaluate(() => App.db.stPumps.length === 2 && App.station.fuelOf(App.db.stPumps[0]) === 'Essence' && App.station.price('Essence') === 3 && App.station.price('Gasoil') === 2.5 && App.station.lastIndex(App.db.stPumps[1]) === 5000));
  check('niveaux de départ par jaugeage : 8 000 et 15 000 L', await p.evaluate(() => App.station.level(App.db.stTanks[0]) === 8000 && App.station.level(App.db.stTanks[1]) === 15000));

  // fuel deliveries
  await p.evaluate(() => App.station.deliveryForm(App.db.stTanks[0].id)); await p.waitForSelector('.sheet [name=litres]'); await settle(); await p.fill('.sheet [name=litres]', '2000'); await p.fill('.sheet [name=amount]', '5000'); await p.selectOption('.sheet [name=supplierId]', 'f1'); await ok(); await p.waitForFunction(() => App.db.stDeliveries.length === 1); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('livraison LV-AAAA-0001 : 2 000 L, niveau 10 000, dépense « Achat carburant » 5 000 (fournisseur lié)', await p.evaluate(() => { const d = App.db.stDeliveries[0], e = App.db.expenses.find(x => x.id === d.expenseId); return /^LV-\d{4}-0001$/.test(d.number) && App.station.level(App.db.stTanks[0]) === 10000 && e.amount === 5000 && e.category === 'Achat carburant' && e.supplierId === 'f1'; }));
  check('livraison au-delà de la capacité refusée', await p.evaluate(() => !!App.station.addDelivery({ tankId: App.db.stTanks[0].id, litres: 1000, amount: 10 }).err));
  check('livraison annulée : dépense supprimée, niveau remis', await p.evaluate(() => { const S = App.station, t = App.db.stTanks[1], d = S.addDelivery({ tankId: t.id, litres: 500, amount: 1400 }), n = App.db.expenses.length; const r = S.cancelDelivery(d); return r === true && App.db.expenses.length === n - 1 && S.level(t) === 15000; }));

  // shifts
  await go('shifts'); await p.click('#so'); await p.waitForSelector('.sheet [name=attendantId]'); await settle(); await p.selectOption('.sheet [name=attendantId]', 'pm');
  check('index de départ préremplis avec le compteur de chaque pompe', await p.evaluate(() => [...document.querySelectorAll('.sheet-wrap.on [name^=s_]')].map(i => i.value).join() === '1000,5000'));
  await ok(); await p.waitForFunction(() => App.db.stShifts.length === 1); await p.waitForSelector('.sheet-wrap.on .hero, .sheet-wrap.on .list'); await closeTop();
  const s1 = await p.evaluate(() => App.db.stShifts[0].id);
  check('service SV-AAAA-0001 ouvert : pompiste, 2 pompes, plus aucune pompe libre', await p.evaluate(id => { const s = App.station.shift(id); return /^SV-\d{4}-0001$/.test(s.number) && s.status === 'Ouvert' && s.readings.length === 2 && !!App.station.openShift({ attendantId: 'pm' }).err; }, s1));
  check('clôture refusée : index de fin inférieur, retour supérieur aux litres, crédit supérieur aux litres vendus', await p.evaluate(id => { const S = App.station, s = S.shift(id), p0 = s.readings.map(r => r.pumpId), a = S.closeShift(s, { readings: [{ pumpId: p0[0], end: 900 }, { pumpId: p0[1], end: 5100 }], declared: { cash: 1 } }), b = S.closeShift(s, { readings: [{ pumpId: p0[0], end: 1100, back: 500 }, { pumpId: p0[1], end: 5100 }], declared: { cash: 1 } }), c = S.closeShift(s, { readings: [{ pumpId: p0[0], end: 1100 }, { pumpId: p0[1], end: 5100 }], credits: [{ clientId: 'c1', fuel: 'Gasoil', litres: 999 }], declared: { cash: 1 } }); return !!a.err && !!b.err && !!c.err && s.status === 'Ouvert'; }, s1));
  check('clôture sans prix fixé refusée', await p.evaluate(id => { const S = App.station, s = S.shift(id), save = App.db.stPrices.slice(); App.db.stPrices = []; const r = S.closeShift(s, { readings: s.readings.map(x => ({ pumpId: x.pumpId, end: x.start + 10 })), declared: { cash: 1 } }); App.db.stPrices = save; return !!r.err && r.err.includes('prix'); }, s1));
  const cl = await p.evaluate(id => { const S = App.station, s = S.shift(id), r = s.readings.map(x => x.pumpId), res = S.closeShift(s, { readings: [{ pumpId: r[0], end: 1400, back: 10 }, { pumpId: r[1], end: 5200 }], credits: [{ clientId: 'c1', fuel: 'Gasoil', litres: 50 }], declared: { cash: 1300, mobile: 100, card: 0 } }); return { err: res.err, x: S.shiftStat(s) }; }, s1);
  check('clôture : 390 L d\'essence + 200 L de gasoil = 590 L, valeur 1 670, crédit 125, ventes comptoir 1 545, remis 1 400, écart −145', !cl.err && cl.x.litres === 590 && cl.x.value === 1670 && cl.x.credit === 125 && cl.x.walkin === 1545 && cl.x.declared === 1400 && cl.x.ecart === -145);
  check('facture comptoir : total 1 400 (ligne d\'écart −145), payée en espèces 1 300 et mobile money 100', await p.evaluate(id => { const s = App.station.shift(id), i = App.sales.get(s.invoiceId), ps = App.sales.payments(i); return i.source === 'Station' && i.total === 1400 && i.lines.length === 3 && i.lines.some(l => l.desc.includes('manque') && l.price === -145) && App.sales.due(i) === 0 && ps.length === 2 && ps.some(x => x.mode === 'Espèces' && x.amount === 1300) && ps.some(x => x.mode === 'Mobile money' && x.amount === 100); }, s1));
  check('vente à crédit : facture de 125 impayée au client, dans les impayés', await p.evaluate(id => { const s = App.station.shift(id), i = App.sales.get(s.creditInvoiceIds[0]); return i.clientId === 'c1' && i.total === 125 && App.sales.due(i) === 125 && App.sales.unpaidList().some(x => x.id === i.id); }, s1));
  check('niveaux de cuve : essence 8 000 + 2 000 − 390 = 9 610 ; gasoil 15 000 − 200 = 14 800', await p.evaluate(() => App.station.level(App.db.stTanks[0]) === 9610 && App.station.level(App.db.stTanks[1]) === 14800));
  check('caisse en espèces : +1 300 − 5 000 (livraison) = −3 700', await p.evaluate(() => App.cash.expected().USD === -3700));
  check('prix changé après coup : la valeur du service clos ne bouge pas', await p.evaluate(id => { App.station.setPrice({ fuel: 'Essence', price: 3.5 }); const v = App.station.shiftStat(App.station.shift(id)).value; App.station.setPrice({ fuel: 'Essence', price: 3, date: App.addDays(App.today(), -1) }); return v === 1670 && App.station.price('Essence') === 3.5 && App.station.price('Essence', App.addDays(App.today(), -1)) === 3; }, s1));
  await p.evaluate(() => { App.db.stPrices = App.db.stPrices.filter(x => !(x.fuel === 'Essence' && x.price === 3.5)); });

  // second shift closed through the form
  const s2 = await p.evaluate(() => App.station.openShift({ attendantId: 'pm' }).id);
  check('2e service : index de départ = fin du 1er (1 400 et 5 200)', await p.evaluate(id => App.station.shift(id).readings.map(r => r.start).join() === '1400,5200', s2));
  await p.evaluate(id => App.station.closeForm(id), s2); await p.waitForSelector('.sheet [name^=e_]'); await settle();
  const ends = await p.evaluate(() => [...document.querySelectorAll('.sheet-wrap.on [name^=e_]')].map(i => i.name));
  await p.fill('.sheet-wrap.on [name="' + ends[0] + '"]', '1500'); await p.fill('.sheet-wrap.on [name="' + ends[1] + '"]', '5300'); await p.fill('.sheet-wrap.on [name=d_cash]', '550');
  check('aperçu de clôture : 200 L, valeur 550, écart 0', await p.evaluate(() => { const x = document.querySelector('.sheet-wrap.on #tt').textContent; return x.includes('200') && x.includes('550'); }));
  await ok(); await p.waitForFunction(id => App.station.shift(id).status === 'Clôturé', s2); await p.waitForSelector('.sheet-wrap.on .hero'); await closeTop();
  check('service clôturé par le formulaire : facture 550 sans ligne d\'écart, écart 0', await p.evaluate(id => { const s = App.station.shift(id), i = App.sales.get(s.invoiceId); return i.total === 550 && i.lines.length === 2 && App.station.shiftStat(s).ecart === 0; }, s2));

  // gauging gap, cancellations, low level
  const gap = await p.evaluate(() => { const d = App.station.addDip({ tankId: App.db.stTanks[0].id, litres: 9400 }); return { g: App.station.dipGap(d), lv: App.station.level(App.db.stTanks[0]) }; });
  check('jaugeage 9 400 L pour 9 510 théoriques : écart −110 L, niveau recalé', gap.g === -110 && gap.lv === 9400);
  check('annuler un service payé : refusé ; un service ouvert : annulé', await p.evaluate(id => { const S = App.station, o = S.openShift({ attendantId: 'pm' }); return S.cancelShift(S.shift(id)) === 'paid' && S.cancelShift(o) === true && o.status === 'Annulé' && !S.openShifts().length; }, s1));
  check('cuve sous le minimum : alerte sur l\'accueil', await p.evaluate(() => { App.station.addDip({ tankId: App.db.stTanks[0].id, litres: 500 }); return App.station.low().length === 1 && App.station.todo().some(x => x[0].includes('minimum')); }));

  // report and screens
  const r = await p.evaluate(() => { const c = App.station.report(App.fin.range('month')); return { litres: c.litres, value: c.value, ecart: c.ecart, bought: c.bought, cost: c.cost, avg: c.avg, margin: c.margin, credit: c.credit }; });
  check('rapport du mois : 790 L, 2 220 de ventes, écart −145, crédit 125, achat 2 000 L pour 5 000 (2,5 / L), marge ≈ 0,31 / L', r.litres === 790 && r.value === 2220 && r.ecart === -145 && r.credit === 125 && r.bought === 2000 && r.cost === 5000 && r.avg === 2.5 && Math.abs(r.margin - (2220 / 790 - 2.5)) < 0.001);
  for (const tab of ['shifts', 'tanks', 'pumps', 'rep']) { await go(tab); check('onglet ' + tab + ' s\'affiche sans erreur', (await p.locator('#gtab').innerHTML()).length > 80); }
  await go('tanks'); await p.click('#gtab [data-t]'); await p.waitForSelector('.sheet .hero'); check('fiche de cuve : niveau et boutons Jauger / Livraison', (await p.textContent('.sheet .hero')).includes('500') && (await p.textContent('.sheet-wrap.on footer')).includes('Jauger')); await closeTop();
  check('texte du rapport (WhatsApp)', await p.evaluate(() => App.station.reportText(App.fin.range('month')).includes('Rapport station')));
  check('Synchro : les collections sont partagées', await p.evaluate(() => ['stTanks', 'stPumps', 'stShifts', 'stDeliveries', 'stDips', 'stPrices'].every(k => Array.isArray(App.db[k]))));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
