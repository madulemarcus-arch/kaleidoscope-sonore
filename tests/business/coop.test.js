// Tontine & micro-crédit: rotating tontine (rounds, pot, fees, arrears), savings, loans (schedule, arrears, penalties, repayments), income only on fees / interest / penalties,
// cash drawer, journal, reports, export. Fictitious data only.
const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'tontine' });
  const go = async tab => { await p.evaluate(tb => App.go('coop', { tab: tb }), tab); await p.waitForSelector('#ctabs'); };
  const ok = () => p.click('.sheet-wrap.on footer .primary'), closeTop = async () => { await p.waitForSelector('.sheet-wrap.on'); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' }); };
  const all = { from: '0000-00-00', to: '9999-99-99' }, near = (a, b) => Math.abs(a - b) < 1e-6;
  await p.evaluate(() => { ['Alice Test', 'Bruno Test', 'Chantal Test'].forEach((n, i) => App.db.clients.push({ id: 'm' + (i + 1), code: 'CL-000' + (i + 1), name: n, phone: '09900000' + (i + 1), type: 'Particulier', created: App.today(), fields: {} })); App.save(); });

  check('secteur « Tontine & micro-crédit » : module activé, vocabulaire « membre »', await p.evaluate(() => App.mod('coop') && App.mod('cash') && App.db.settings.activity === 'tontine' && App.vocab('client') === 'membre'));
  check('barre du bas : Tontine en tête', (await p.textContent('#tabs')).includes('Tontine'));
  await go('tontines'); check('écran vide : carte avec bouton d\'action', (await p.locator('#view .empty [data-cta]').count()) === 1);

  // tontine: 3 members, 100 per round, 5 % fee, order Bruno, Alice, Chantal
  await p.click('#tn'); await p.waitForSelector('.sheet [name=name]'); await p.fill('.sheet [name=name]', 'Tontine Test'); await p.fill('.sheet [name=amount]', '100'); await p.fill('.sheet [name=feePct]', '5');
  for (const m of ['m1', 'm2', 'm3']) await p.check('.sheet [data-m="' + m + '"]');
  await p.fill('.sheet [data-o="m2"]', '1'); await p.fill('.sheet [data-o="m1"]', '2'); await p.fill('.sheet [data-o="m3"]', '3'); await ok(); await p.waitForFunction(() => App.db.coTontines.length === 1);
  const tid = await p.evaluate(() => App.db.coTontines[0].id);
  check('tontine : membres dans l\'ordre de passage (Bruno, Alice, Chantal)', await p.evaluate(() => App.db.coTontines[0].memberIds.join() === 'm2,m1,m3'));
  check('tour 1 : pot de Bruno, échéance au premier tour', await p.evaluate(id => { const t = App.coop.tontine(id), r = App.coop.rounds(t)[0]; return r.benef === 'm2' && r.due === t.start && App.coop.current(t) === 0; }, tid));

  // contributions: one through the form, two by API
  await p.evaluate(id => App.coop.contribForm(id), tid); await p.waitForSelector('.sheet [name=memberId]'); await p.selectOption('.sheet [name=memberId]', 'm1'); check('cotisation : montant proposé = 100', (await p.inputValue('.sheet [name=amount]')) === '100'); await ok(); await p.waitForFunction(() => App.db.coOps.length === 1); await closeTop();
  await p.evaluate(id => { App.coop.addOp({ type: 'contrib', refId: id, round: 0, memberId: 'm2', amount: 100 }); App.coop.addOp({ type: 'contrib', refId: id, round: 0, memberId: 'm3', amount: 100 }); App.render(); }, tid);
  check('tour 1 : 300 collectés, frais 15, pot 285', await p.evaluate(id => { const x = App.coop.tRound(App.coop.tontine(id), 0); return x.collected === 300 && x.fee === 15 && x.pot === 285 && !x.payout; }, tid));
  check('cotisation de membre hors tontine ou de tour inconnu refusée', await p.evaluate(id => App.coop.addOp({ type: 'contrib', refId: id, round: 0, memberId: 'zz', amount: 10 }) === null && App.coop.addOp({ type: 'contrib', refId: id, round: 9, memberId: 'm1', amount: 10 }) === null, tid));
  await p.evaluate(id => App.coop.payoutForm(id), tid); await p.waitForSelector('.sheet-wrap.on >> text=Pot à verser'); check('pot à verser affiché (285)', (await p.textContent('.sheet-wrap.on')).includes('285')); await ok(); await p.waitForFunction(() => App.db.coOps.length === 4); await closeTop();
  check('pot versé à Bruno : tour 2 en cours, aucun second versement possible', await p.evaluate(id => { const t = App.coop.tontine(id), po = App.db.coOps.find(o => o.type === 'payout'); return po.memberId === 'm2' && po.amount === 285 && App.coop.current(t) === 1 && App.coop.addOp({ type: 'payout', refId: id, round: 0, memberId: 'm2', amount: 10 }) === null; }, tid));
  await p.evaluate(id => { const t = App.coop.tontine(id); t.start = App.addDays(App.today(), -95); App.save(); App.render(); }, tid);
  check('cotisations en retard détectées (tours 2 et 3 non payés)', await p.evaluate(id => App.coop.tLate(App.coop.tontine(id)).length >= 3 && App.coop.todo().some(x => /cotisation/.test(x[0])), tid));

  // savings
  await p.evaluate(() => App.coop.savingForm('deposit', 'm1')); await p.waitForSelector('.sheet [name=amount]'); await p.fill('.sheet [name=amount]', '50'); await ok(); await p.waitForFunction(() => App.db.coOps.length === 5); await closeTop();
  await p.evaluate(() => App.coop.savingForm('withdraw', 'm1')); await p.waitForSelector('.sheet [name=amount]'); await p.fill('.sheet [name=amount]', '80'); await ok(); await p.waitForTimeout(300);
  check('retrait supérieur au solde refusé', await p.evaluate(() => App.db.coOps.length === 5 && App.coop.balance('m1', 'USD') === 50));
  await p.fill('.sheet [name=amount]', '20'); await ok(); await p.waitForFunction(() => App.db.coOps.length === 6); await closeTop();
  check('solde d\'épargne = 50 − 20 = 30', await p.evaluate(() => App.coop.balance('m1', 'USD') === 30));

  // loan: 300 at 10 % over 3 monthly installments, 2 % fee, 5 % penalty, started 75 days ago
  await p.evaluate(() => App.coop.loanForm('m3')); await p.waitForSelector('.sheet [name=principal]'); await p.fill('.sheet [name=principal]', '300'); await p.fill('.sheet [name=interestPct]', '10'); await p.fill('.sheet [name=feePct]', '2'); await p.fill('.sheet [name=n]', '3'); await p.fill('.sheet [name=penaltyPct]', '5'); await p.fill('.sheet [name=grace]', '3');
  await p.evaluate(() => { const d = document.querySelector('.sheet [name=date]'); d.value = App.addDays(App.today(), -75); d.dispatchEvent(new Event('input', { bubbles: true })); });
  check('aperçu du crédit : total 330, 3 × 110', (await p.textContent('.sheet #lp')).includes('330') && (await p.textContent('.sheet #lp')).includes('110')); await ok(); await p.waitForFunction(() => App.db.coLoans.length === 1); await closeTop();
  const lid = await p.evaluate(() => App.db.coLoans[0].id);
  check('crédit CR-AAAA-0001, décaissement −300 + frais 6, frais = revenu', await p.evaluate(() => { const l = App.db.coLoans[0], o = App.db.coOps.find(x => x.type === 'loan'); return /^CR-\d{4}-0001$/.test(l.number) && o.fee === 6 && App.coop.cash(o) === -294 && App.coop.income(o) === 6; }));
  check('échéancier : 3 × 110, retard 220, pénalité 11, statut En retard', await p.evaluate(id => { const s = App.coop.loanState(App.coop.loan(id)); return s.rows.length === 3 && s.rows.every(r => r.amount === 110) && s.overdue === 220 && s.penalty === 11 && s.status === 'En retard' && s.days > 10; }, lid));
  check('crédit en retard dans « À faire » et dans le portefeuille', await p.evaluate(() => App.coop.todo().some(x => /crédit/.test(x[0])) && App.coop.portfolio().late.length === 1 && App.coop.portfolio().par === 100));
  await p.evaluate(id => App.coop.repayForm(id), lid); await p.waitForSelector('.sheet [name=amount]'); check('remboursement : montant proposé = retard 220', (await p.inputValue('.sheet [name=amount]')) === '220'); await p.fill('.sheet [name=amount]', '110'); await ok(); await p.waitForFunction(() => App.db.coOps.length === 8); await closeTop();
  check('après 110 : retard 110, la pénalité reste due même si une échéance est payée', await p.evaluate(id => { const s = App.coop.loanState(App.coop.loan(id)); return s.paid === 110 && s.overdue === 110 && s.penalty === 11 && s.penaltyDue === 11 && s.rows[0].paid; }, lid));
  await p.evaluate(id => App.coop.repayForm(id, 'penalty'), lid); await p.waitForSelector('.sheet [name=amount]'); check('pénalité : montant proposé = 11', (await p.inputValue('.sheet [name=amount]')) === '11'); await ok(); await p.waitForFunction(() => App.db.coOps.length === 9); await closeTop();
  await p.evaluate(id => App.coop.addOp({ type: 'repay', refId: id, amount: 220 }), lid);
  check('crédit soldé ; trop-perçu et pénalité en trop refusés', await p.evaluate(id => { const s = App.coop.loanState(App.coop.loan(id)); return s.status === 'Soldé' && s.remaining === 0 && s.penaltyDue === 0 && App.coop.addOp({ type: 'repay', refId: id, amount: 1 }) === null && App.coop.addOp({ type: 'penalty', refId: id, amount: 1 }) === null; }, lid));
  check('crédit avec remboursements : annulation du décaissement refusée', await p.evaluate(() => App.coop.cancelOp(App.db.coOps.find(o => o.type === 'loan')) === false));

  // income = fees, interest, penalties only; cash = everything
  check('revenus (toute période) = frais tontine 15 + frais dossier 6 + intérêts 30 + pénalité 11 = 62', await p.evaluate(a => Math.abs(App.coop.gains(a) - 62) < 1e-6, all));
  check('revenus du mois = 56 (le frais de dossier date de 75 jours)', await p.evaluate(() => Math.abs(App.coop.gains(App.fin.range('month')) - 56) < 1e-6));
  check('chiffre d\'affaires et bénéfice incluent les revenus', await p.evaluate(() => { const r = App.fin.range('month'), c = App.reports.compute(r); return Math.abs(c.co - 56) < 1e-6 && Math.abs(c.revenue - (c.sales + c.mm + c.tr + c.co)) < 1e-6; }));
  check('journal : 7 entrées de revenus (3 frais de tontine, 1 dossier, 2 remboursements, 1 pénalité)', await p.evaluate(a => App.fin.entries(a).filter(e => e.t === 'coop' && e.k === 'in').length === 7, all));
  check('caisse en espèces : 300 − 285 + 50 − 20 − 294 + 330 + 11 = 92', await p.evaluate(() => App.coop.cashSince(0).USD === 92 && App.cash.expected().USD === 92));

  // screens, report, export
  await go('loans'); check('onglet Crédits : crédit soldé listé', (await p.textContent('#ctab')).includes('Soldé') && (await p.textContent('#ctab')).includes('CR-'));
  await go('savings'); check('onglet Épargne : solde du membre', (await p.textContent('#ctab')).includes('Alice Test') && (await p.textContent('#ctab')).includes('30'));
  await go('ops'); await p.click('#ctab [data-f="all"]'); check('onglet Opérations : les 10 opérations', (await p.locator('#ctab [data-o]').count()) === 10);
  await go('rep'); await p.waitForSelector('#ctab .hero'); check('rapport : portefeuille, épargne et revenus', (await p.textContent('#ctab')).includes('Portefeuille') && (await p.textContent('#ctab')).includes('Épargne et tontines'));
  check('rapport en texte (WhatsApp)', await p.evaluate(() => App.coop.reportText(App.fin.range('month')).includes('Encours')));
  check('Excel : feuilles Tontines, Crédits, Opérations tontine', await p.evaluate(() => { const n = App.data.tables().map(x => x.name); return ['Tontines', 'Crédits', 'Opérations tontine'].every(x => n.includes(x)); }));
  check('Synchro : les collections sont partagées', await p.evaluate(() => ['coTontines', 'coLoans', 'coOps'].every(k => Array.isArray(App.db[k]))));

  // an operation is cancelled, never edited
  const wid = await p.evaluate(() => App.db.coOps.find(o => o.type === 'withdraw').id);
  await p.evaluate(id => App.coop.opSheet(id), wid); await p.waitForSelector('.sheet-wrap.on >> text=Annuler l\'opération'); await p.click('.sheet-wrap.on >> text=Annuler l\'opération'); await p.waitForSelector('.sheet-wrap.on >> text=Confirmation'); await p.locator('.sheet-wrap.on').last().locator('footer >> text=Annuler l\'opération').click(); await p.waitForTimeout(300);
  check('retrait annulé : épargne 50, les 20 reviennent en caisse (112)', await p.evaluate(() => App.coop.balance('m1', 'USD') === 50 && App.coop.cashSince(0).USD === 112));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
