const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'commerce' });
  await p.evaluate(() => {
    const today = App.today(); App.db.clients.push({ id: 'c1', code: 'CL-0001', name: 'Alice Test001', phone: '', type: 'Particulier', created: today, fields: {} });
    App.db.invoices.push({ id: 'i1', number: 'FAC-1', clientId: 'c1', date: today, currency: 'USD', rate: 2800, lines: [{ desc: 'x', qty: 1, price: 100, cost: 0 }], sub: 100, total: 100, disc: {}, fields: {} });
    App.db.payments.push({ id: 'a', invoiceId: 'i1', clientId: 'c1', date: today, amount: 70, currency: 'USD', rate: 2800, mode: 'Espèces', note: '', no: 'R1', at: Date.now() - 9000 }, { id: 'b', invoiceId: 'i1', clientId: 'c1', date: today, amount: 30, currency: 'USD', rate: 2800, mode: 'Banque', note: '', no: 'R2', at: Date.now() - 8000 }, { id: 'c', invoiceId: 'i1', clientId: 'c1', date: today, amount: 28000, currency: 'CDF', rate: 2800, mode: 'Espèces', note: '', no: 'R3', at: Date.now() - 7000 });
    App.db.expenses.push({ id: 'x', at: Date.now() - 6000, amount: 20, currency: 'USD', rate: 2800, category: 'Transport', mode: 'Espèces', date: today, note: '' }, { id: 'y', at: Date.now() - 5000, amount: 5, currency: 'USD', rate: 2800, category: 'Autres', mode: 'Banque', date: today, note: '' });
    App.save(); App.go('cash');
  });
  await p.waitForSelector('#cc');
  const e = await p.evaluate(() => App.cash.expected());
  check('cash attendu : seulement les Espèces (70 − 20 USD, 28 000 FC)', e.USD === 50 && e.CDF === 28000, JSON.stringify(e));
  check('affiché à l\'écran', (await p.textContent('.hero')).replace(/\s/g, ' ').includes('50,00 $') && (await p.textContent('.hero')).replace(/\s/g, ' ').includes('28 000 FC'));
  await p.click('#cc'); await p.waitForSelector('.sheet-wrap.on'); await p.waitForTimeout(150); await p.fill('.sheet [name=c_USD]', '48'); await p.fill('.sheet [name=c_CDF]', '28000'); await p.dispatchEvent('.sheet [name=c_USD]', 'input');
  check('écart calculé en direct', (await p.textContent('#cg')).replace(/\s/g, ' ').includes('-2,00 $'));
  await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  check('comptage enregistré avec écart −2', await p.evaluate(() => { const c = App.db.cashCounts[0]; return c.gap.USD === -2 && c.gap.CDF === 0 && c.kind === 'count'; }));
  check('le comptage devient la nouvelle base', await p.evaluate(() => { const e = App.cash.expected(); return e.USD === 48 && e.CDF === 28000; }));
  check('écart signalé dans l\'historique', (await p.textContent('.list')).includes('écart'));
  // new cash movement after the count
  await p.evaluate(() => { App.db.expenses.push({ id: 'z', at: Date.now() + 10, amount: 8, currency: 'USD', rate: 2800, category: 'Autres', mode: 'Espèces', date: App.today(), note: '' }); App.save(); });
  check('mouvement après comptage pris en compte', await p.evaluate(() => App.cash.expected().USD === 40));
  // closing
  await p.click('#cl'); await p.waitForSelector('.sheet-wrap.on'); await p.waitForTimeout(150); await p.fill('.sheet [name=c_USD]', '40'); await p.fill('.sheet [name=c_CDF]', '28000'); await p.fill('.sheet [name=note]', 'RAS'); await p.click('.sheet footer .primary');
  await p.waitForSelector('.sheet .card');
  const text = await p.evaluate(() => App.db.closings[0].text);
  check('texte de clôture : ventes, encaissé, dépenses, attendu, compté, écart', ['Clôture du', 'Ventes : 1 facture(s), 100,00', 'Encaissé : 100,00', 'Dépenses :', 'Cash attendu : 40,00', 'Cash compté : 40,00', 'Écart', 'Note : RAS'].every(x => text.replace(/ | /g, ' ').includes(x.replace(/ | /g, ' '))), text);
  await p.evaluate(() => { window.__o = []; window.open = u => window.__o.push(u); }); await p.click('.sheet footer .primary:text("WhatsApp")');
  check('partage WhatsApp de la clôture', await p.evaluate(() => window.__o[0].startsWith('https://wa.me/?text=') && decodeURIComponent(window.__o[0]).includes('Clôture du')));
  await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  // closing again the same day replaces
  await p.evaluate(() => App.cash.closeSheet()); await p.waitForSelector('.sheet-wrap.on'); check('avertissement de remplacement', (await p.textContent('.sheet')).includes('sera remplacée'));
  await p.fill('.sheet [name=c_USD]', '40'); await p.click('.sheet footer .primary'); await p.waitForSelector('.sheet .card');
  check('une seule clôture par jour', await p.evaluate(() => App.db.closings.length === 1 && App.db.cashCounts.length === 3));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | ')); await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
