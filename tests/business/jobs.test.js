const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'services' });
  await p.evaluate(() => { App.db.clients.push({ id: 'c1', code: 'CL-0001', name: 'Alice Test001', phone: '', type: 'Particulier', address: '12 rue Test', created: App.today(), fields: {} }); App.save(); App.go('services'); });
  await p.waitForSelector('#sn'); await p.click('#sn'); await p.waitForSelector('.sheet-wrap.on'); await p.waitForTimeout(150); await p.fill('.sheet [name=name]', 'Dépannage'); await p.fill('.sheet [name=price]', '200'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('prestation = produit sans suivi de stock', await p.evaluate(() => App.db.products[0].track === false && App.db.products[0].unit === 'prestation' && App.jobs.services().length === 1));
  await p.click('#vt [data-t=staff]'); await p.click('#sn'); await p.waitForSelector('.sheet-wrap.on'); await p.waitForTimeout(150); await p.fill('.sheet [name=name]', 'Marc Technicien'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('employé ajouté', await p.evaluate(() => App.db.staff.length === 1 && App.db.staff[0].role === 'Technicien'));
  // intervention through the form
  await p.evaluate(() => App.go('interventions')); await p.waitForSelector('#jn'); await p.click('#jn'); await p.waitForSelector('.sheet-wrap.on'); await p.waitForTimeout(150);
  await p.selectOption('.sheet [name=clientId]', 'c1'); await p.selectOption('.sheet [name=pid]', await p.evaluate(() => App.db.products[0].id));
  check('prestation : objet, prix et adresse préremplis', (await p.inputValue('.sheet [name=title]')) === 'Dépannage' && (await p.inputValue('.sheet [name=price]')) === '200' && (await p.inputValue('.sheet [name=address]')) === '12 rue Test');
  await p.selectOption('.sheet [name=employeeId]', await p.evaluate(() => App.db.staff[0].id)); await p.fill('.sheet [name=cval]', '10'); await p.dispatchEvent('.sheet [name=cval]', 'input'); check('commission calculée en direct (10 % = 20 $)', (await p.textContent('#cm')).replace(/\s/g, ' ').includes('20,00 $'));
  await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  const y = new Date().getFullYear(); check('intervention INT-AAAA-0001', await p.evaluate(y => App.db.jobs[0].number === 'INT-' + y + '-0001' && App.db.jobs[0].status === 'Planifiée', y));
  check('commission non due avant la fin du travail', (await p.textContent('.stats')).replace(/\s/g, ' ').includes('0,00 $'));
  await p.click('.item[data-id]'); await p.waitForSelector('.sheet [data-s]'); await p.click('.sheet [data-s="Terminée"]'); await p.waitForSelector('.sheet-wrap.on'); await p.waitForTimeout(400);
  check('statut Terminée → commission à payer 20 $', await p.evaluate(() => App.db.jobs[0].status === 'Terminée') && (await p.textContent('.stats')).replace(/\s/g, ' ').includes('20,00 $'));
  await p.evaluate(() => App.jobs.payCommission(App.db.jobs[0]));
  check('commission payée = dépense « Commissions » (espèces)', await p.evaluate(() => { const e = App.db.expenses[0]; return e.category === 'Commissions' && e.amount === 20 && e.mode === 'Espèces' && e.note.includes('Marc') && App.db.jobs[0].commissionPaid; }));
  await p.evaluate(() => App.jobs.payCommission(App.db.jobs[0])); check('commission payée une seule fois', await p.evaluate(() => App.db.expenses.length === 1));
  // montant fixe
  check('commission en montant fixe', await p.evaluate(() => { const j = { price: 200, currency: 'USD', commission: { type: 'amt', value: 35 } }; return App.jobs.commission(j) === 35; }));
  // invoicing from the job
  await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  await p.evaluate(() => { App.jobs.invoice(App.db.jobs[0]); }); await p.waitForSelector('#invf .ln'); await p.waitForTimeout(200);
  check('facture préremplie depuis l\'intervention', (await p.inputValue('#invf .ln [name=desc]')).includes('Dépannage') && (await p.inputValue('#invf .ln [name=price]')) === '200'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet .stats');
  check('intervention liée à sa facture', await p.evaluate(() => App.db.jobs[0].invoiceId === App.db.invoices[0].id && App.db.invoices[0].total === 200));
  await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  // staff with history cannot be deleted
  await p.evaluate(() => App.staff.form(App.db.staff[0].id)); await p.waitForSelector('.sheet-wrap.on'); await p.click('.sheet footer .danger'); check('employé avec historique non supprimable', await p.isVisible('.toast.err') && await p.evaluate(() => App.db.staff.length === 1));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | ')); await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
