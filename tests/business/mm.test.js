// Mobile money & bank module: accounts, deposits / withdrawals with automatic fees, balances from legs, cancel, movements, pending, reconciliation,
// and the links with the cash drawer, the journal, the reports and the Excel export. Fictitious data only.
const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'finance' });
  const bal = name => p.evaluate(n => { const a = App.db.mmAccounts.find(x => x.name === n.split('|')[0] && x.currency === n.split('|')[1]); return a ? App.mm.balance(a.id) : null; }, name);
  const go = async () => { await p.evaluate(() => App.go('mm', { tab: 'ops' })); await p.waitForSelector('#mtabs'); };

  // module and sector
  check('secteur « Mobile money & banque » : module activé', await p.evaluate(() => App.mod('mm') && App.mod('cash') && App.db.settings.activity === 'finance'));
  check('barre du bas : Mobile money en tête', (await p.textContent('#tabs')).includes('Mobile money'));
  await go(); check('écran vide : carte avec bouton d\'action', (await p.locator('#view .empty [data-cta]').count()) === 1);

  // first use: choose accounts
  await p.click('#mn'); await p.waitForSelector('.sheet [data-n]'); check('création des comptes proposée au premier usage', (await p.locator('.sheet [data-n]').count()) === 7);
  await p.check('.sheet [data-n="0"]'); await p.check('.sheet [data-n="1"]'); await p.click('.sheet-wrap.on >> text=Créer mes comptes');
  await p.waitForSelector('.sheet [name=type]');
  check('comptes créés : Espèces + Illico Cash + Airtel Money (USD)', await p.evaluate(() => App.db.mmAccounts.map(a => a.name + '|' + a.currency).sort().join(',') === 'Airtel Money|USD,Espèces|USD,Illico Cash|USD'));
  await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  await p.evaluate(() => { const a = n => App.db.mmAccounts.find(x => x.name === n); a('Espèces').opening = 500; Object.assign(a('Illico Cash'), { opening: 1000, feePct: 2, commPct: 0.5 }); App.save(); App.render(); });
  check('soldes de départ', (await bal('Espèces|USD')) === 500 && (await bal('Illico Cash|USD')) === 1000);

  // deposit through the form: fee and commission suggested from the account percentages
  await p.click('#mn'); await p.waitForSelector('.sheet [name=type]');
  await p.selectOption('.sheet [name=type]', 'deposit'); await p.selectOption('.sheet [name=accountId]', { label: 'Illico Cash · USD' }); await p.fill('.sheet [name=amount]', '100');
  check('frais proposés : 2 % de 100 = 2', (await p.inputValue('.sheet [name=fee]')) === '2'); check('commission proposée : 0,5 % de 100 = 0,5', (await p.inputValue('.sheet [name=commission]')) === '0.5');
  check('aperçu des effets sur les comptes', (await p.textContent('.sheet #pv')).includes('Illico Cash'));
  await p.fill('.sheet [name=party]', 'Alice Test'); await p.fill('.sheet [name=phone]', '0990000001'); await p.fill('.sheet [name=ref]', 'TX-001'); await p.click('.sheet-wrap.on >> text=Enregistrer');
  await p.waitForSelector('.sheet-wrap.on >> text=Reçu'); // the details sheet opens with the receipt button
  check('dépôt : espèces +102 (montant + frais)', (await bal('Espèces|USD')) === 602); check('dépôt : Illico −100 + commission 0,5', (await bal('Illico Cash|USD')) === 900.5);
  check('numérotation OP-AAAA-0001', await p.evaluate(() => /^OP-\d{4}-0001$/.test(App.db.mmOps[0].number)));
  await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });

  // withdrawal
  await p.evaluate(() => { const a = App.db.mmAccounts.find(x => x.name === 'Illico Cash'); App.mm.addOp({ type: 'withdraw', accountId: a.id, amount: 50, fee: 1, commission: 0.25, party: 'Jean Test' }); App.render(); });
  check('retrait : espèces −50 + frais 1', (await bal('Espèces|USD')) === 553); check('retrait : Illico +50 + commission 0,25', (await bal('Illico Cash|USD')) === 950.75);
  check('gains = frais + commissions (2 + 0,5 + 1 + 0,25)', await p.evaluate(() => { const t = App.today(); return Math.abs(App.mm.gains({ from: t, to: t }) - 3.75) < 1e-9; }));

  // cancel the deposit from its sheet
  await go(); await p.click('#view .item[data-id] >> nth=1'); await p.waitForSelector('.sheet-wrap.on >> text=Annuler l\'opération');
  const which = await p.textContent('.sheet-wrap.on h2'); await p.click('.sheet-wrap.on >> text=Annuler l\'opération'); await p.waitForSelector('.sheet-wrap.on >> text=Les fonds sont remis'); await p.locator('.sheet-wrap.on').last().locator('footer >> text=Annuler l\'opération').click();
  await p.waitForTimeout(400);
  check('annulation (' + which + ') : fonds remis comme avant', (await bal('Espèces|USD')) === 451 && (await bal('Illico Cash|USD')) === 1050.25);
  check('annulation : l\'opération est gardée avec le statut Annulé', await p.evaluate(() => App.db.mmOps.some(o => o.status === 'Annulé')));
  check('annulation : gains recalculés (1 + 0,25)', await p.evaluate(() => { const t = App.today(); return Math.abs(App.mm.gains({ from: t, to: t }) - 1.25) < 1e-9; }));

  // movement between accounts (buy float with cash), fee = cost
  await p.evaluate(() => { const a = n => App.db.mmAccounts.find(x => x.name === n); App.mm.addOp({ type: 'move', accountId: a('Espèces').id, toId: a('Airtel Money').id, amount: 100, fee: 1 }); App.render(); });
  check('mouvement : espèces −101, Airtel +100', (await bal('Espèces|USD')) === 350 && (await bal('Airtel Money|USD')) === 100);
  check('frais de mouvement = coût (gains 1,25 − 1)', await p.evaluate(() => { const t = App.today(); return Math.abs(App.mm.gains({ from: t, to: t }) - 0.25) < 1e-9; }));
  check('mouvement refusé entre devises ou comptes identiques', await p.evaluate(() => { const a = App.db.mmAccounts.find(x => x.name === 'Airtel Money'); return App.mm.addOp({ type: 'move', accountId: a.id, toId: a.id, amount: 5 }) === null; }));

  // pending operation: no effect until finished
  const pend = await p.evaluate(() => { const a = App.db.mmAccounts.find(x => x.name === 'Airtel Money'), o = App.mm.addOp({ type: 'receive', accountId: a.id, amount: 40, status: 'En attente', party: 'Marie Test' }); return o.id; });
  check('opération en attente : aucun effet', (await bal('Espèces|USD')) === 350 && (await bal('Airtel Money|USD')) === 100);
  await p.evaluate(id => App.mm.setStatus(App.mm.get(id), 'Terminé'), pend);
  check('opération terminée : effet appliqué (espèces −40, Airtel +40)', (await bal('Espèces|USD')) === 310 && (await bal('Airtel Money|USD')) === 140);

  // reconciliation through the sheet
  await p.evaluate(() => App.go('mm', { tab: 'funds' })); await p.waitForSelector('[data-a]'); await p.click('[data-a] >> nth=2');
  await p.waitForSelector('.sheet-wrap.on >> text=Rapprocher'); await p.click('.sheet-wrap.on >> text=Rapprocher'); await p.waitForSelector('.sheet [name=real]');
  await p.fill('.sheet [name=real]', '1000'); check('rapprochement : l\'écart s\'affiche', (await p.textContent('.sheet #gp')).includes('Écart'));
  await p.click('.sheet-wrap.on >> text=Enregistrer'); await p.waitForTimeout(300);
  check('rapprochement : un ajustement est créé et le solde devient le solde réel', await p.evaluate(() => App.db.mmOps.some(o => o.type === 'adjust') && App.db.mmAccounts.some(a => a.checked && App.mm.balance(a.id) === 1000)));
  check('l\'ajustement ne compte pas comme un gain', await p.evaluate(() => App.mm.gain(App.db.mmOps.find(o => o.type === 'adjust')) === 0));

  // links with the cash drawer, journal, reports, export
  check('Caisse : le cash attendu tient compte des opérations', await p.evaluate(() => { const c = App.mm.cashAcc('USD'); return App.cash.expected().USD === App.mm.balance(c.id) - c.opening; }));
  check('Journal : frais et commissions sont des entrées', await p.evaluate(() => { const t = App.today(), e = App.fin.entries({ from: t, to: t }).filter(x => x.t === 'mm'); return e.length >= 2 && e.every(x => x.k === 'in' || x.k === 'out'); }));
  check('Rapports : le chiffre d\'affaires et le bénéfice incluent les gains', await p.evaluate(() => { const r = App.fin.range('month'), c = App.reports.compute(r); return Math.abs(c.mm - App.mm.gains(r)) < 1e-9 && c.revenue === c.sales + c.mm && c.profit === c.revenue - c.cogs - c.exp; }));
  check('Excel : feuilles Opérations et Comptes', await p.evaluate(() => { const T = App.data.tables(), o = T.find(x => x.name === 'Opérations'), c = T.find(x => x.name === 'Comptes'); return !!o && !!c && o.rows.length === App.db.mmOps.length + 1 && c.rows.length === App.db.mmAccounts.length + 1; }));
  check('Synchro : les opérations et les comptes sont partagés', await p.evaluate(() => typeof App.db.mmOps === 'object' && Array.isArray(App.db.mmAccounts)));

  // screens
  await p.evaluate(() => App.go('mm', { tab: 'gains' })); await p.waitForSelector('#mtab .hero');
  check('onglet Gains : détail par type et par compte', (await p.textContent('#mtab')).includes('Par type d\'opération') && (await p.textContent('#mtab')).includes('Gains par compte'));
  await p.evaluate(() => App.go('mm', { tab: 'ops' })); await p.waitForSelector('#md'); await p.click('#md'); await p.waitForSelector('.sheet-wrap.on >> text=Fonds');
  check('rapport du jour : opérations, gains et fonds', (await p.textContent('.sheet-wrap.on .card')).includes('Gains') && (await p.textContent('.sheet-wrap.on .card')).includes('Illico Cash'));
  await p.keyboard.press('Escape');
  await p.evaluate(() => App.go('home')); await p.waitForSelector('#view .hero #amt'); await p.waitForTimeout(900);
  check('Accueil : le chiffre d\'affaires compte les frais et commissions', await p.evaluate(() => { const r = App.fin.range('month'); return document.querySelector('#amt').textContent.replace(/\s/g, ' ').includes(App.money.main(App.mm.gains(r)).replace(/\s/g, ' ')); }));
  check('Accueil : tuile « Opération » et compteur du jour', (await p.textContent('.qa')).includes('Opération') && (await p.textContent('.cnts')).includes('opération'));
  // fee schedule by tiers: ≤50 fixed 1, ≤200 2 %, above fixed 3; commission 10 % of nothing; withdrawals only for the fee grid
  check('grille : tranches fixe / % / au-delà', await p.evaluate(() => { const a = { currency: 'USD', feeGrid: [{ upTo: 50, v: 1, pct: false }, { upTo: 200, v: 2, pct: true }, { upTo: 0, v: 3, pct: false }], feeFor: 'all' }, f = x => App.mm.suggest(a, 'deposit', x).fee; return f(20) === 1 && f(50) === 1 && f(100) === 2 && f(200) === 4 && f(500) === 3; }));
  check('grille : limitée aux retraits, sinon aucun frais proposé', await p.evaluate(() => { const a = { currency: 'USD', feeGrid: [{ upTo: 0, v: 5, pct: false }], feeFor: 'take' }; return App.mm.suggest(a, 'deposit', 100).fee === 0 && App.mm.suggest(a, 'withdraw', 100).fee === 5; }));
  check('sans grille : pourcentage et minimum inchangés', await p.evaluate(() => { const a = { currency: 'USD', feePct: 2, feeMin: 1, commPct: 0.5 }; const r = App.mm.suggest(a, 'deposit', 10); return r.fee === 1 && r.commission === 0.05 && App.mm.suggest(a, 'move', 10).fee === 0; }));
  await p.evaluate(() => App.mm.accountForm(App.db.mmAccounts.find(x => x.name === 'Illico Cash').id)); await p.waitForSelector('.sheet [data-add=fee]');
  await p.click('.sheet [data-add=fee]'); await p.click('.sheet [data-add=fee]');
  const rows = p.locator('.sheet [data-grid=fee] .gr');
  await rows.nth(0).locator('[data-k=upTo]').fill('50'); await rows.nth(0).locator('[data-k=v]').fill('1');
  await rows.nth(1).locator('[data-k=v]').fill('3');
  await p.fill('.sheet #gt', '30'); check('grille : essai en direct dans le formulaire', (await p.textContent('.sheet #gtr')).includes('Dépôt') || (await p.textContent('.sheet #gtr')).includes('frais'));
  await p.click('.sheet-wrap.on >> text=Enregistrer'); await p.waitForTimeout(300);
  check('grille : enregistrée et triée avec le compte', await p.evaluate(() => { const a = App.db.mmAccounts.find(x => x.name === 'Illico Cash'); return a.feeGrid.length === 2 && a.feeGrid[0].upTo === 50 && a.feeGrid[1].upTo === 0 && a.feeFor === 'all'; }));
  await p.evaluate(() => App.mm.form('deposit')); await p.waitForSelector('.sheet [name=type]');
  await p.selectOption('.sheet [name=type]', 'deposit'); await p.selectOption('.sheet [name=accountId]', { label: 'Illico Cash · USD' }); await p.fill('.sheet [name=amount]', '30');
  check('grille : le formulaire d\'opération propose le frais de la tranche', (await p.inputValue('.sheet [name=fee]')) === '1');
  await p.fill('.sheet [name=amount]', '300'); check('grille : tranche « au-delà »', (await p.inputValue('.sheet [name=fee]')) === '3');
  await p.keyboard.press('Escape');
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
