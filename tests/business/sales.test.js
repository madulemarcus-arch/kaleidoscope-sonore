const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'commerce' });
  await p.evaluate(() => { App.db.clients.push({ id: 'c1', code: 'CL-0001', name: 'Alice Test001', phone: '0810000000', type: 'Particulier', created: '2026-01-01', fields: {} }); App.db.products.push({ id: 'p1', code: 'PR-0001', name: 'Riz', cat: 'Général', unit: 'kg', track: true, qty: 100, min: 10, cost: 1, price: 2.5, fields: {}, supplierId: '' }, { id: 'p2', code: 'PR-0002', name: 'Conseil', cat: 'Général', unit: 'pièce', track: false, qty: 0, min: 0, cost: 0, price: 50, fields: {}, supplierId: '' }); App.save(); App.go('sales'); });
  await p.waitForSelector('#ni'); check('écran vide', await p.isVisible('.empty'));
  // ---- create through the form: product line, discount, payment at creation
  await p.click('#ni'); await p.waitForSelector('#invf .ln'); await p.waitForTimeout(150);
  await p.selectOption('#invf [name=clientId]', 'c1'); await p.selectOption('#invf .ln [name=pid]', 'p1');
  check('prix repris du produit', (await p.inputValue('#invf .ln [name=price]')) === '2.5' || (await p.inputValue('#invf .ln [name=price]')) === '2,5');
  check('client conservé après changement de produit', (await p.inputValue('#invf [name=clientId]')) === 'c1');
  await p.fill('#invf .ln [name=qty]', '10'); await p.dispatchEvent('#invf .ln [name=qty]', 'input');
  await p.fill('#invf [name=dval]', '10'); await p.dispatchEvent('#invf [name=dval]', 'input');
  check('total = 25 − 10 % = 22,50', (await p.textContent('#tot')).replace(/\s/g, ' ').includes('22,50 $'));
  check('montant en lettres affiché', (await p.textContent('#tot')).includes('Vingt-deux dollars américains et cinquante cents'));
  await p.fill('#invf [name=given]', '30'); await p.dispatchEvent('#invf [name=given]', 'input'); check('monnaie à rendre', (await p.textContent('#chg')).replace(/\s/g, ' ').includes('7,50 $'));
  await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet .stats');
  const y = new Date().getFullYear();
  check('numéro FAC-AAAA-0001', await p.evaluate(y => App.db.invoices[0].number === 'FAC-' + y + '-0001', y));
  check('stock sorti (100 − 10)', await p.evaluate(() => App.stock.get('p1').qty === 90 && App.db.movements.some(m => m.type === 'sale' && m.ref.startsWith('FAC-'))));
  check('payée, paiement plafonné à 22,50', await p.evaluate(() => { const i = App.db.invoices[0]; return App.sales.status(i)[0] === 'Payée' && App.db.payments[0].amount === 22.5 && App.db.payments[0].note.includes('7,50'); }));
  check('reçu numéroté REC-AAAA-0001', await p.evaluate(y => App.db.payments[0].no === 'REC-' + y + '-0001', y));
  await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  // ---- second invoice in CDF, partial payments, multi-currency
  const ids = await p.evaluate(() => { const s = App.sales; const inv = { id: 'i2', number: s.nextNo('FAC', 'invoice', () => App.db.invoices), kind: 'sale', clientId: 'c1', date: App.addDays(App.today(), -40), currency: 'USD', rate: 2800, lines: [{ pid: 'p2', desc: 'Conseil', qty: 2, price: 50 }], disc: { type: 'pct', value: 0 }, sub: 100, discAmt: 0, total: 100, fields: {} }; App.db.invoices.push(inv); App.save(); return inv.number; });
  check('numérotation séquentielle 0002', ids.endsWith('-0002'));
  await p.evaluate(() => App.sales.payForm('i2')); await p.fill('.sheet input[name=amount]', '60'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap.on');
  check('paiement partiel → Partielle, reste 40', await p.evaluate(() => App.sales.status(App.sales.get('i2'))[0] === 'Partielle' && App.sales.due(App.sales.get('i2')) === 40));
  await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  await p.evaluate(() => App.sales.payForm('i2')); await p.selectOption('.sheet select[name=currency]', 'CDF'); await p.fill('.sheet input[name=amount]', '56000'); await p.dispatchEvent('.sheet input[name=amount]', 'input');
  check('équivalent affiché (56 000 FC ≈ 20 $)', (await p.textContent('#peq')).replace(/\s/g, ' ').includes('20,00 $'));
  await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap.on'); check('paiement en CDF converti au taux (reste 20)', await p.evaluate(() => App.sales.due(App.sales.get('i2')) === 20));
  await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  await p.evaluate(() => App.sales.payForm('i2')); await p.fill('.sheet input[name=amount]', '25'); await p.click('.sheet footer .primary'); check('paiement supérieur au reste refusé', await p.isVisible('.toast.err') && await p.evaluate(() => App.sales.due(App.sales.get('i2')) === 20));
  await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  // ---- unpaid: age, reminder
  await p.evaluate(() => { App.go('sales', { tab: 'unpaid' }); }); await p.waitForSelector('[data-wa]');
  check('impayés : 1 facture, 40 jours', (await p.textContent('#tab')).includes('40 j') && (await p.locator('.item[data-id]').count()) === 1);
  check('texte de relance rempli', await p.evaluate(() => { const t = App.sales.remindText(App.sales.get('i2')); return t.includes('Alice Test001') && t.includes('FAC-') && t.includes('40 jour') && !t.includes('{'); }));
  await p.evaluate(() => { window.__opened = []; window.open = u => { window.__opened.push(u); }; }); await p.click('[data-wa]');
  check('WhatsApp ouvert avec le numéro et le message', await p.evaluate(() => window.__opened[0].startsWith('https://wa.me/243810000000?text=') && decodeURIComponent(window.__opened[0]).includes('Alice Test001')));
  check('relance mémorisée, plus dans les relances du jour', await p.evaluate(() => App.sales.get('i2').lastRemind === App.today()) && !(await p.isVisible('#rs')));
  // ---- documents
  const html = await p.evaluate(() => App.sales.docHtml('invoice', 'i2'));
  check('facture imprimée : nom, mentions, mots, équivalent', html.includes('Ets Test') && html.includes('Cent dollars américains') && html.includes('280') && html.includes('Équivalent'));
  check('mention de bas de page', html.includes("Document généré par l'application CISPOLstore Business") && html.includes('class="made"'));
  check('facture imprimée : reste à payer', html.includes('Reste à payer'));
  check('reçu imprimable', (await p.evaluate(() => App.sales.docHtml('receipt', App.db.payments[0].id))).includes('REÇU DE PAIEMENT'));
  check('nom de fichier : client - numéro', await p.evaluate(() => App.sales.docHtml('invoice', 'i2').includes('<title>Alice Test001 - FAC-')));
  // ---- cancel restores stock, edit
  await p.evaluate(() => { const i = App.db.invoices[0]; App.db.payments = App.db.payments.filter(x => x.invoiceId !== i.id); App.save(); App.sales.profile(i.id); }); await p.click('.sheet footer .danger'); await p.locator('.sheet-wrap').last().locator('footer .danger').click(); await p.waitForTimeout(400);
  check('annulation : stock remis, facture annulée', await p.evaluate(() => App.stock.get('p1').qty === 100 && App.db.invoices[0].cancelled === true));
  check('annulée exclue des impayés et du chiffre d\'affaires', await p.evaluate(() => App.sales.due(App.db.invoices[0]) === 0 && App.sales.sumMonth().billed === 0));
  // ---- quotes
  await p.evaluate(() => { App.go('sales'); }); await p.click('#stabs [data-t=quote]'); await p.click('#nq'); await p.waitForSelector('#qf .ln'); await p.waitForTimeout(150);
  await p.selectOption('#qf [name=clientId]', 'c1'); await p.selectOption('#qf .ln [name=pid]', 'p2'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('devis DEV-AAAA-0001', await p.evaluate(y => App.db.quotes[0].number === 'DEV-' + y + '-0001' && App.db.quotes[0].total === 50, y));
  await p.evaluate(() => App.quotes.profile(App.db.quotes[0].id)); await p.click('.sheet footer .primary:text("En facture")'); await p.waitForSelector('#invf .ln'); await p.waitForTimeout(250);
  check('devis → facture : lignes reprises', (await p.inputValue('#invf .ln [name=desc]')) === 'Conseil'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet .stats');
  check('devis marqué « facturé »', await p.evaluate(() => App.db.quotes[0].status === 'invoiced' && !!App.db.quotes[0].invoiceId));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | ')); await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
