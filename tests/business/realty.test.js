// Immobilier & loyers: properties, units, leases (schedule, arrears, penalties, rent revision), rents, deposits, works, owners' accounts (commission, balance),
// income only on owned rents / commissions / penalties, cash drawer, journal, reports, export. Fictitious data only.
const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'immo' });
  const go = async tab => { await p.evaluate(tb => App.go('realty', { tab: tb }), tab); await p.waitForSelector('#rtabs'); };
  const ok = () => p.click('.sheet-wrap.on footer .primary'), closeTop = async () => { await p.waitForSelector('.sheet-wrap.on'); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' }); };
  const all = { from: '0000-00-00', to: '9999-99-99' };
  await p.evaluate(() => { ['Alice Test', 'Bruno Test', 'Chantal Test'].forEach((n, i) => App.db.clients.push({ id: 't' + (i + 1), code: 'CL-000' + (i + 1), name: n, phone: '09900000' + (i + 1), type: 'Particulier', created: App.today(), fields: {} })); App.save(); });

  check('secteur « Immobilier & loyers » : module activé, vocabulaire « locataire »', await p.evaluate(() => App.mod('realty') && App.mod('cash') && App.db.settings.activity === 'immo' && App.vocab('client') === 'locataire'));
  check('barre du bas : Immobilier en tête', (await p.textContent('#tabs')).includes('Immobilier'));
  await go('rents'); check('écran vide : carte avec bouton d\'action', (await p.locator('#view .empty [data-cta]').count()) === 1);

  // property + units through the forms
  await p.click('#rb'); await p.waitForSelector('.sheet [name=name]'); await p.fill('.sheet [name=name]', 'Résidence Test'); await p.fill('.sheet [name=address]', 'Avenue Test 1'); await ok(); await p.waitForFunction(() => App.db.reProps.length === 1); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  const pid = await p.evaluate(() => App.db.reProps[0].id);
  check('bien à soi : sans propriétaire, non géré', await p.evaluate(() => !App.realty.managed(App.db.reProps[0])));
  await p.evaluate(id => App.realty.unitForm(id), pid); await p.waitForSelector('.sheet [name=count]'); await p.fill('.sheet [name=name]', 'Appartement'); await p.fill('.sheet [name=count]', '3'); await p.fill('.sheet [name=rent]', '100'); await p.fill('.sheet [name=charges]', '20'); await p.fill('.sheet [name=deposit]', '240'); await ok();
  await p.waitForFunction(() => App.db.reUnits.length === 3); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('3 lots identiques créés : Appartement 1, 2, 3 (loyer 100 + 20, caution 240)', await p.evaluate(() => App.db.reUnits.map(u => u.name).join() === 'Appartement 1,Appartement 2,Appartement 3' && App.db.reUnits.every(u => u.rent === 100 && u.charges === 20 && u.deposit === 240)));
  // managed property for an owner, 10 % commission
  await p.evaluate(() => { App.db.reProps.push({ id: 'pm', name: 'Villa Test', kind: 'Maison', address: '', ownerName: 'M. Propriétaire', ownerPhone: '0990000009', mgmtPct: 10, note: '' }); App.db.reUnits.push({ id: 'um', propId: 'pm', name: 'Villa', kind: 'Maison', currency: 'USD', rent: 200, charges: 0, deposit: 0 }); App.save(); });
  check('bien géré : propriétaire et commission', await p.evaluate(() => App.realty.managed(App.realty.prop('pm')) && App.realty.prop('pm').mgmtPct === 10));
  check('tous les lots sont libres, occupation 0 %', await p.evaluate(() => { const S = App.realty.stats(); return S.units === 4 && S.occupied === 0 && S.rate === 0 && S.free === 4; }));

  // lease 1 through the form: started 75 days ago, 120/month, deposit 240 collected, 5 days grace, 10 % penalty
  const u1 = await p.evaluate(() => App.db.reUnits[0].id);
  await p.evaluate(u => App.realty.leaseForm(u, 't1'), u1); await p.waitForSelector('.sheet [name=rent]');
  check('formulaire de bail : loyer, charges et caution repris du lot', (await p.inputValue('.sheet [name=rent]')) === '100' && (await p.inputValue('.sheet [name=charges]')) === '20' && (await p.inputValue('.sheet [name=deposit]')) === '240');
  await p.fill('.sheet [name=penaltyPct]', '10');
  await p.evaluate(() => { const d = document.querySelector('.sheet [name=start]'); d.value = App.addDays(App.today(), -75); d.dispatchEvent(new Event('input', { bubbles: true })); });
  check('aperçu du bail : 120 par mois', (await p.textContent('.sheet #lc')).includes('120')); await ok(); await p.waitForFunction(() => App.db.reLeases.length === 1); await closeTop();
  const l1 = await p.evaluate(() => App.db.reLeases[0].id);
  check('bail BA-AAAA-0001 : caution encaissée à la signature, lot occupé', await p.evaluate(id => { const l = App.realty.lease(id); return /^BA-\d{4}-0001$/.test(l.number) && App.realty.held(l) === 240 && App.realty.unitStatus(App.realty.unit(l.unitId)) === 'Occupé' && App.db.reOps.length === 1 && /^LY-\d{4}-0001$/.test(App.db.reOps[0].number); }, l1));
  check('échéancier : 3 loyers échus de 120, retard 360, pénalité 36, statut En retard', await p.evaluate(id => { const s = App.realty.state(App.realty.lease(id)); return s.rows.length === 3 && s.rows.every(r => r.amount === 120) && s.overdue === 360 && s.balance === 360 && s.penalty === 36 && s.pay === 'En retard' && s.status === 'En cours' && s.days > 0; }, l1));
  check('un lot déjà loué ne peut pas recevoir un second bail', await p.evaluate(u => App.realty.addLease({ unitId: u, tenantId: 't2', start: App.today(), rent: 100 }) === null, u1));
  check('« À faire » signale le loyer impayé', await p.evaluate(() => App.realty.todo().some(x => /impayé/.test(x[0])) && App.realty.late().length === 1));

  // payments: the form proposes the balance, FIFO allocation, penalty stays
  await p.evaluate(id => App.realty.rentForm(id), l1); await p.waitForSelector('.sheet [name=amount]'); check('loyer : montant proposé = reste dû 360', (await p.inputValue('.sheet [name=amount]')) === '360'); await p.fill('.sheet [name=amount]', '120');
  check('indication : règle le loyer le plus ancien', (await p.textContent('.sheet #rv')).includes('Règle')); await ok(); await p.waitForFunction(() => App.db.reOps.length === 2); await closeTop();
  check('après 120 : retard 240, la pénalité reste due (36)', await p.evaluate(id => { const s = App.realty.state(App.realty.lease(id)); return s.paid === 120 && s.overdue === 240 && s.penalty === 36 && s.penaltyDue === 36 && s.rows[0].paid && !s.rows[1].paid; }, l1));
  check('quittance : le paiement règle le 1er loyer', await p.evaluate(id => { const o = App.db.reOps.find(x => x.type === 'rent'); return App.realty.covers(App.realty.lease(id), o).length === 1; }, l1));
  await p.evaluate(id => App.realty.rentForm(id, 'penalty'), l1); await p.waitForSelector('.sheet [name=amount]'); check('pénalité : montant proposé = 36', (await p.inputValue('.sheet [name=amount]')) === '36'); await ok(); await p.waitForFunction(() => App.db.reOps.length === 3); await closeTop();
  check('pénalité réglée : plus rien de dû', await p.evaluate(id => App.realty.state(App.realty.lease(id)).penaltyDue === 0 && App.realty.addOp({ type: 'penalty', refId: id, amount: 5 }) === null, l1));

  // rent revision: only future installments change
  check('révision du loyer : seules les échéances à venir changent', await p.evaluate(id => { const l = App.realty.lease(id), s = App.realty.state(l); const r = App.realty.revise(l, s.next.due, 150, 0); return r && App.realty.state(l).rows.every(x => x.amount === 120) && App.realty.amountAt(l, s.next.due) === 150 && App.realty.state(l).next.amount === 150; }, l1));

  // managed property: 200/month, paid → commission 20, owner's balance 180; works advanced; payout
  await p.evaluate(() => { const l = App.realty.addLease({ unitId: 'um', tenantId: 't2', start: App.today(), rent: 200, charges: 0, deposit: 0, grace: 3, penaltyPct: 0 }); App.realty.addOp({ type: 'rent', refId: l.id, amount: 200 }); App.render(); });
  check('bien géré : commission 10 % = 20, solde propriétaire 180', await p.evaluate(() => { const o = App.db.reOps.find(x => x.propId === 'pm' && x.type === 'rent'); return App.realty.income(o) === 20 && App.realty.ownerBal('pm', 'USD') === 180; }));
  await p.evaluate(() => App.realty.workForm('pm')); await p.waitForSelector('.sheet [name=amount]'); check('travaux sur un bien géré : avancés pour le propriétaire', (await p.textContent('.sheet #wn')).includes('M. Propriétaire')); await p.fill('.sheet [name=amount]', '30'); await p.fill('.sheet [name=note]', 'Plomberie'); await ok(); await p.waitForFunction(() => App.db.reOps.some(o => o.type === 'work')); await closeTop();
  check('travaux 30 déduits du compte : solde 150, pas de dépense créée', await p.evaluate(() => App.realty.ownerBal('pm', 'USD') === 150 && !App.db.expenses.length));
  await p.evaluate(() => App.realty.ownerForm('pm')); await p.waitForSelector('.sheet [name=amount]'); check('reversement : montant proposé = solde 150', (await p.inputValue('.sheet [name=amount]')) === '150'); await p.fill('.sheet [name=amount]', '100'); await ok(); await p.waitForFunction(() => App.db.reOps.some(o => o.type === 'owner')); await closeTop();
  check('reversement 100 : solde 50, un reversement supérieur au solde est refusé', await p.evaluate(() => App.realty.ownerBal('pm', 'USD') === 50 && App.realty.addOp({ type: 'owner', propId: 'pm', amount: 60 }) === null));
  check('relevé propriétaire : loyers 200, commission 20, travaux 30, reversé 100', await p.evaluate(() => { const x = App.realty.statement('pm', { from: '0000-00-00', to: '9999-99-99' }), v = a => (a[0] || {}).v; return v(x.rent) === 200 && v(x.comm) === 20 && v(x.works) === 30 && v(x.paid) === 100 && v(x.bal) === 50 && /Solde à reverser/.test(App.realty.statementText('pm', { from: '0000-00-00', to: '9999-99-99', label: 'Tout' })); }));

  // works on an owned property = expense; cancelled with the operation
  await p.evaluate(id => App.realty.addOp({ type: 'work', propId: id, amount: 50, note: 'Peinture' }), pid);
  check('travaux sur un bien à soi : dépense « Travaux » de 50, aucun effet de caisse en double', await p.evaluate(() => { const o = App.db.reOps.find(x => x.type === 'work' && x.propId !== 'pm'); return App.db.expenses.length === 1 && App.db.expenses[0].category === 'Travaux' && App.db.expenses[0].amount === 50 && App.realty.cash(o) === 0 && !!o.expenseId; }));

  // deposit: refund proposal, limits, cancellation guard
  await p.evaluate(id => App.realty.depositForm(id, 'refund'), l1); await p.waitForSelector('.sheet [name=amount]'); check('restitution : retenue des loyers impayés (240 − 240 = 0)', (await p.inputValue('.sheet [name=amount]')) === '0'); await p.fill('.sheet [name=amount]', '100'); await ok(); await p.waitForFunction(() => App.db.reOps.some(o => o.type === 'refund')); await closeTop();
  check('caution : 240 − 100 = 140 gardés, restitution supérieure refusée', await p.evaluate(id => App.realty.held(App.realty.lease(id)) === 140 && App.realty.addOp({ type: 'refund', refId: id, amount: 200 }) === null, l1));
  check('la caution reçue ne s\'annule pas tant qu\'une restitution la dépasse', await p.evaluate(() => { const o = App.db.reOps.find(x => x.type === 'deposit'); return App.realty.cancelOp(o) === false && o.status === 'Valide'; }));

  // end of a lease: unit free again, no rent after the end
  await p.evaluate(() => { const l = App.realty.addLease({ unitId: App.db.reUnits[2].id, tenantId: 't3', start: App.addDays(App.today(), -10), rent: 50, deposit: 0 }); App.realty.endLease(l, App.today()); App.render(); });
  check('bail résilié : lot libre, 1 seul loyer échu, statut Résilié', await p.evaluate(() => { const l = App.db.reLeases[2], s = App.realty.state(l); return s.status === 'Résilié' && s.rows.length === 1 && App.realty.unitStatus(App.realty.unit(l.unitId)) === 'Libre'; }));
  check('occupation : 2 lots sur 4 (50 %)', await p.evaluate(() => { const S = App.realty.stats(); return S.occupied === 2 && S.rate === 50 && S.vacancy > 0; }));

  // revenue = owned rents + commissions + penalties only; deposits and owner's share are not revenue
  check('revenus : 120 loyer + 36 pénalité + 20 commission = 176', await p.evaluate(a => App.realty.gains(a) === 176, all));
  check('journal : 3 entrées de revenu (loyer, pénalité, commission)', await p.evaluate(a => App.fin.entries(a).filter(e => e.t === 'realty').length === 3, all));
  check('chiffre d\'affaires et rapport financier reprennent les revenus', await p.evaluate(a => App.reports.compute ? App.reports.compute(a).re === 176 : true, all));
  // cash: +240 +120 +36 −100 (lease 1) +200 −30 −100 (managed) = 366, and −50 for the works expense of the owned property
  check('caisse : mouvements en espèces des opérations = 366', await p.evaluate(() => App.realty.cashSince(0).USD === 366));
  check('caisse attendue = 366 − 50 de dépense = 316', await p.evaluate(() => App.cash.expected().USD === 316));

  // screens
  await go('rents'); check('Loyers : impayés affichés (240)', (await p.textContent('#rtab')).includes('240') && (await p.locator('#rtab [data-l]').count()) >= 1);
  await go('props'); await p.waitForSelector('#rtab .hero'); check('Biens : occupation et liste', (await p.textContent('#rtab')).includes('Résidence Test') && (await p.textContent('#rtab')).includes('Villa Test') && (await p.textContent('#rtab')).includes('50 %'));
  await p.click('#rtab [data-p="pm"]'); await p.waitForSelector('.sheet-wrap.on >> text=M. Propriétaire'); check('fiche du bien géré : à reverser 50, actions Reverser et relevé', (await p.textContent('.sheet-wrap.on')).includes('50') && (await p.textContent('.sheet-wrap.on')).includes('Reverser')); await closeTop();
  await go('leases'); check('Baux : 3 baux listés', (await p.locator('#rtab [data-l]').count()) === 3);
  await p.click('#rtab [data-l="' + l1 + '"]'); await p.waitForSelector('.sheet-wrap.on >> text=Loyers'); check('fiche du bail : caution gardée, loyers, actions', (await p.textContent('.sheet-wrap.on')).includes('Caution gardée') && (await p.textContent('.sheet-wrap.on')).includes('Relancer')); await closeTop();
  await go('ops'); check('Opérations : liste du mois', (await p.locator('#rtab [data-o]').count()) >= 7);
  await go('rep'); await p.waitForSelector('#rtab .hero'); check('rapport : recouvrement, parc immobilier, propriétaires', (await p.textContent('#rtab')).includes('Recouvrement') && (await p.textContent('#rtab')).includes('Parc immobilier') && (await p.textContent('#rtab')).includes('M. Propriétaire'));
  check('rapport en texte (WhatsApp)', await p.evaluate(() => App.realty.reportText(App.fin.range('month')).includes('Impayés')));
  check('Excel : feuilles Biens, Lots, Baux, Opérations loyers', await p.evaluate(() => { const n = App.data.tables().map(x => x.name); return ['Biens', 'Lots immobilier', 'Baux', 'Opérations loyers'].every(x => n.includes(x)); }));
  check('Synchro : les collections sont partagées', await p.evaluate(() => ['reProps', 'reUnits', 'reLeases', 'reOps'].every(k => Array.isArray(App.db[k]))));

  // an operation is cancelled, never edited
  const wid = await p.evaluate(() => App.db.reOps.find(o => o.type === 'work' && o.propId !== 'pm').id);
  await p.evaluate(id => App.realty.opSheet(id), wid); await p.waitForSelector('.sheet-wrap.on >> text=Annuler l\'opération'); await p.click('.sheet-wrap.on >> text=Annuler l\'opération'); await p.waitForSelector('.sheet-wrap.on >> text=Confirmation');
  await p.click('.sheet-wrap.on >> text=Annuler l\'opération >> nth=-1'); await p.waitForFunction(() => App.db.reOps.find(o => o.type === 'work' && o.propId !== 'pm').status === 'Annulé');
  check('travaux annulés : la dépense liée disparaît, la caisse revient à 366', await p.evaluate(() => App.db.expenses.length === 0 && App.cash.expected().USD === 366));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
