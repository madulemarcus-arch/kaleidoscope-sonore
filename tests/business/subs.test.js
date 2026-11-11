const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'abonnements' });
  await p.evaluate(() => { App.db.clients.push({ id: 'c1', code: 'CL-0001', name: 'Alice Test001', phone: '0810000000', type: 'Particulier', created: App.today(), fields: {} }); App.db.suppliers.push({ id: 's1', code: 'FO-0001', name: 'Partenaire Test', phone: '', created: App.today() }); App.save(); App.go('subs'); });
  await p.waitForSelector('#bn'); check('écran vide', await p.isVisible('.empty'));
  await p.click('#bn'); await p.waitForSelector('.sheet-wrap.on'); await p.waitForTimeout(150);
  await p.selectOption('.sheet [name=clientId]', 'c1'); await p.fill('.sheet [name=name]', 'Forfait mensuel'); await p.fill('.sheet [name=price]', '30'); await p.selectOption('.sheet [name=supplierId]', 's1'); await p.fill('.sheet [name=cost]', '20'); await p.fill('.sheet [name=paid]', '30');
  await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  const s = await p.evaluate(() => { const x = App.db.subs[0]; return { n: App.db.subs.length, per: x.periods.length, inv: App.db.invoices.length, paid: App.sales.status(App.db.invoices[0])[0], status: App.subs.status(x)[0], margin: App.subs.margin(x), due: App.ledger.balance('s1'), end: x.periods[0].end, start: x.start, source: App.db.invoices[0].source }; });
  check('abonnement créé avec sa 1re période et sa facture payée', s.n === 1 && s.per === 1 && s.inv === 1 && s.paid === 'Payée' && s.source === 'subscription');
  check('statut actif, fin = début + 29 jours', s.status === 'Actif' && s.end === await p.evaluate(a => App.addDays(a, 29), s.start));
  check('marge = 30 − 20 = 10, dû au fournisseur = 20', s.margin === 10 && s.due === 20);
  check('la ligne de facture porte le coût (bénéfice)', await p.evaluate(() => App.db.invoices[0].lines[0].cost === 20));
  // status from dates
  const st = await p.evaluate(() => { const x = App.db.subs[0], out = []; for (const d of [-5, -16, 3]) { x.periods[0].end = App.addDays(App.today(), d); out.push(App.subs.status(x)[0]); } x.cancelled = true; out.push(App.subs.status(x)[0]); x.cancelled = false; return out; });
  check('statuts automatiques : sursis, inactif, actif, résilié', JSON.stringify(st) === JSON.stringify(['En sursis', 'Inactif', 'Actif', 'Résilié']), JSON.stringify(st));
  // renew while inactive → starts today
  await p.evaluate(() => { App.db.subs[0].periods[0].end = App.addDays(App.today(), -40); App.save(); App.subs.renew(App.db.subs[0].id); }); await p.waitForSelector('.sheet-wrap.on');
  check('renouvellement d\'un inactif : repart d\'aujourd\'hui', (await p.textContent('.sheet .body')).includes(await p.evaluate(() => App.fmtDate(App.today()))));
  await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  const r = await p.evaluate(() => { const x = App.db.subs[0]; return { per: x.periods.length, start: x.periods[1].start, status: App.subs.status(x)[0], inv: App.db.invoices.length, due: App.ledger.balance('s1'), t: App.today() }; });
  check('2e période facturée, actif, dû 2 × 20 = 40', r.per === 2 && r.start === r.t && r.status === 'Actif' && r.inv === 2 && r.due === 40, JSON.stringify(r));
  await p.evaluate(() => App.subs.renew(App.db.subs[0].id)); await p.waitForSelector('.sheet-wrap.on'); await p.uncheck('.sheet [name=bill]'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('renouvellement d\'un actif : démarre le lendemain de la fin, sans facture si décoché', await p.evaluate(() => { const x = App.db.subs[0]; return x.periods[2].start === App.addDays(x.periods[1].end, 1) && x.periods[2].invoiceId === '' && App.db.invoices.length === 2; }));
  // supplier ledger: payment and advance are real cash-out
  await p.evaluate(() => App.ledger.pay('s1', 'paid', 15, 'USD', 2800, 'Espèces', App.today(), 'Mobile')); check('reversement : dû 60 − 15 = 45', await p.evaluate(() => App.ledger.balance('s1') === 45));
  check('reversement enregistré comme dépense (journal et caisse)', await p.evaluate(() => App.db.expenses.some(e => e.category === 'Reversement fournisseur' && e.amount === 15 && e.supplierId === 's1') && App.cash.expected().USD < 200));
  await p.evaluate(() => App.ledger.pay('s1', 'advance', 100, 'USD', 2800, 'Espèces', App.today(), '')); check('avance : solde négatif (avance restante)', await p.evaluate(() => App.ledger.balance('s1') === -55));
  await p.evaluate(() => App.go('subs', { tab: 'due' })); await p.waitForSelector('[data-sp]'); check('écran « Dû fournisseurs »', (await p.textContent('#bt')).includes('Partenaire Test') && (await p.textContent('#bt')).includes('avance restante'));
  await p.click('[data-sp]'); await p.waitForSelector('.sheet .stats'); check('détail : dû, versé, historique', (await p.textContent('.sheet')).includes('Reversé') && (await p.textContent('.sheet')).includes('Avance') && (await p.textContent('.sheet')).includes('À reverser')); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  // reminders
  await p.evaluate(() => { const x = App.db.subs[0]; x.periods = [{ start: App.addDays(App.today(), -28), end: App.addDays(App.today(), 2), invoiceId: '', amount: 30 }]; App.save(); window.__o = []; window.open = u => window.__o.push(u); });
  const txt = await p.evaluate(() => App.subs.text(App.db.subs[0])); check('message de rappel rempli (client, formule, délai, montant)', txt.includes('Alice Test001') && txt.includes('Forfait mensuel') && txt.includes('dans 2 jours') && txt.includes('30,00') && !txt.includes('{'), txt);
  check('file de rappels : 1 abonné à relancer', await p.evaluate(() => App.subs.queue().length === 1));
  await p.evaluate(() => App.subs.remind(App.db.subs[0])); check('WhatsApp ouvert, puis plus dans la file du jour', await p.evaluate(() => window.__o[0].startsWith('https://wa.me/243810000000') && App.subs.queue().length === 0));
  await p.evaluate(() => App.go('subs', { tab: 'cal' })); await p.waitForSelector('#bt h4'); check('calendrier des échéances groupé', (await p.textContent('#bt')).includes('Cette semaine'));
  // vocabulary and module off
  await p.evaluate(() => { App.db.settings.vocab.sub = 'contrat'; App.save(); App.go('subs', { tab: 'list' }); }); await p.waitForSelector('#bn'); check('vocabulaire personnalisé (contrat)', (await p.textContent('#bn')).includes('Contrat') && (await p.textContent('#btabs')).includes('Contrats'));
  await p.evaluate(() => { App.db.settings.modules.subs = false; App.save(); App.go('more'); }); await p.waitForSelector('#view .grid'); check('module désactivé : disparaît du menu et de l\'accueil', (await p.locator('#view [data-go=subs]').count()) === 0 && !(await p.evaluate(() => App.quick.filter(q => !q.mod || App.mod(q.mod)).map(q => q.label()).join('|'))).includes('contrat'));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | ')); await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
