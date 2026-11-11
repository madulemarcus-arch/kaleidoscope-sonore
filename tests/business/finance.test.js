const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'commerce' });
  await p.evaluate(() => {
    const today = App.today(); App.db.clients.push({ id: 'c1', code: 'CL-0001', name: 'Alice Test001', phone: '', type: 'Particulier', created: today, fields: {} });
    App.db.products.push({ id: 'p1', code: 'PR-0001', name: 'Riz', cat: 'Général', unit: 'kg', track: true, qty: 100, min: 10, cost: 1, price: 2.5, fields: {}, supplierId: '' });
    // invoice of 100 $ with cost 40 $, paid 60 $ cash + 56 000 FC cash
    App.db.invoices.push({ id: 'i1', number: 'FAC-1', clientId: 'c1', date: today, currency: 'USD', rate: 2800, lines: [{ pid: 'p1', desc: 'Riz', qty: 40, price: 2.5, cost: 1 }], disc: { type: 'pct', value: 0 }, sub: 100, discAmt: 0, total: 100, fields: {} });
    App.db.payments.push({ id: 'pay1', invoiceId: 'i1', clientId: 'c1', date: today, amount: 60, currency: 'USD', rate: 2800, mode: 'Espèces', note: '', no: 'REC-1', at: Date.now() - 5000 }, { id: 'pay2', invoiceId: 'i1', clientId: 'c1', date: today, amount: 56000, currency: 'CDF', rate: 2800, mode: 'Mobile money', note: '', no: 'REC-2', at: Date.now() - 4000 });
    App.save(); App.go('money');
  });
  await p.waitForSelector('#mtabs');
  check('journal : 2 entrées', (await p.locator('.list .item').count()) === 2);
  check('entrées = 60 $ + 56 000 FC ≈ 80 $', (await p.textContent('.stats')).replace(/\s/g, ' ').includes('80,00 $'));
  { const tx = (await p.textContent('#mt')).replace(/\s/g, ' '); check('entrées par devise', tx.includes('60,00 $') && tx.includes('56 000 FC')); }
  check('ventilation par mode', (await p.textContent('#mt')).includes('Mobile money'));
  check('graphique SVG', await p.isVisible('#mt svg'));
  // expense via the form (CDF, needs rate), then USD
  await p.click('#mtabs [data-t=exp]'); await p.click('#nx'); await p.waitForSelector('.sheet-wrap.on'); await p.waitForTimeout(150);
  await p.fill('.sheet input[name=amount]', '28000'); await p.selectOption('.sheet select[name=currency]', 'CDF'); await p.fill('.sheet input[name=category]', 'Transport'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('dépense CDF enregistrée avec taux', await p.evaluate(() => App.db.expenses[0].currency === 'CDF' && App.db.expenses[0].rate === 2800 && App.db.expenses[0].category === 'Transport'));
  await p.evaluate(() => { App.fin.expenseForm(); }); await p.waitForSelector('.sheet-wrap.on'); await p.waitForTimeout(150); await p.fill('.sheet input[name=amount]', '10'); await p.fill('.sheet input[name=category]', 'Loyer'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('total dépenses = 10 $ + 28 000 FC = 20 $', (await p.textContent('#mt .card b')).replace(/\s/g, ' ').includes('20,00 $'));
  await p.selectOption('#xc', 'Loyer'); check('filtre par catégorie', (await p.locator('#mt .item[data-x]').count()) === 1); await p.selectOption('#xc', '');
  // reports
  await p.click('#mtabs [data-t=rep]');
  const c = await p.evaluate(() => { const r = App.reports.compute(App.fin.range('month')); return { revenue: r.revenue, cogs: r.cogs, exp: r.exp, profit: r.profit, collected: r.collected, n: r.n }; });
  check('CA = 100, coût = 40, dépenses = 20', c.revenue === 100 && c.cogs === 40 && c.exp === 20, JSON.stringify(c));
  check('bénéfice = 100 − 40 − 20 = 40', c.profit === 40); check('encaissé ≈ 80', c.collected === 80);
  check('rapport affiché', (await p.textContent('#mt')).includes('Meilleures ventes') && (await p.textContent('#mt')).includes('Comptabilité simple'));
  await p.fill('#mt [name=goal]', '400'); await p.click('#sg'); check('objectif enregistré', await p.evaluate(() => App.db.settings.goal === 400));
  await p.click('#mtabs [data-t=rep]'); check('progression vers l\'objectif : 25 %', (await p.textContent('#mt .hero')).includes('25 %'));
  await p.evaluate(() => App.go('home')); await p.waitForSelector('.hero'); check('objectif sur l\'accueil : anneau de progression à 25 %', await p.isVisible('.hero .ring svg') && (await p.textContent('.hero .ring')).includes('25'));
  // previous period comparison
  await p.evaluate(() => { const d = App.fin.prevRange(App.fin.range('month')); App.db.invoices.push({ id: 'i0', number: 'FAC-0', clientId: 'c1', date: d.to, currency: 'USD', rate: 2800, lines: [{ desc: 'x', qty: 1, price: 50, cost: 0 }], sub: 50, total: 50, disc: {}, fields: {} }); App.save(); const r = App.reports.compute(d); window.__p = r.revenue; });
  check('période précédente calculée (même durée, juste avant)', await p.evaluate(() => window.__p === 50));
  // monthly text
  const txt = await p.evaluate(() => App.reports.monthText(App.today().slice(0, 7)));
  check('rapport du mois partageable', txt.includes('Chiffre d\'affaires : 100,00') && txt.includes('Bénéfice : 40,00') && txt.includes('Objectif') && txt.includes('Alice Test001'));
  check('exemples de mois dans le texte', /Rapport de [a-zéû]+ \d{4} — Ets Test/.test(txt));
  // modules off → sections disappear
  await p.evaluate(() => { App.db.settings.modules.stock = false; App.db.settings.modules.sales = false; App.save(); App.go('money', { tab: 'rep' }); }); await p.waitForSelector('#mt .hero');
  const rep = await p.textContent('#mt'); check('module Ventes désactivé : plus de section Ventes', !rep.includes('Meilleures ventes') && !rep.includes('panier moyen')); check('module Stock désactivé : plus de section Stock', !rep.includes('stock bas'));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | ')); await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
