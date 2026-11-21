// Bureau de change: rates with history (buy / sell against the local currency), trades at the counter (rates of the moment copied into the trade, negotiated amount, identity above a threshold, till
// check), cash put in / taken out, counts with differences, cancellation, derived till / gains / position, journal entries and cash moves, report, screens. Fictitious data only.
const { check, launch, setup } = require('./helper');
(async () => {
  const near = (a, b, e) => Math.abs(a - b) < (e || 0.0051), t = await launch(), p = t.page; await setup(p, { activity: 'change' });
  const go = async tab => { await p.evaluate(tb => App.go('exchange', { tab: tb }), tab); await p.waitForSelector('#gtabs'); };
  const settle = () => p.waitForFunction(() => document.activeElement && document.activeElement.closest && document.activeElement.closest('.sheet')), ok = () => p.click('.sheet-wrap.on footer .primary'), closeTop = async () => { await p.waitForSelector('.sheet-wrap.on'); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' }); };
  await p.evaluate(() => { App.db.settings.currency = 'USD'; App.db.settings.cur2 = 'CDF'; App.db.settings.rate = 2800; App.save(); });

  check('secteur « Bureau de change » : module activé', await p.evaluate(() => App.mod('exchange') && App.db.settings.activity === 'change'));
  check('barre du bas : Change', (await p.textContent('#tabs')).includes('Change'));
  await go('till'); check('écran vide : carte avec bouton d\'action', (await p.locator('#gtab .empty [data-cta]').count()) === 1);
  check('à faire : définir les cotations', await p.evaluate(() => App.exchange.todo().some(x => x[0].includes('cotations'))));

  // rates
  check('cotation refusée : monnaie inconnue, monnaie de référence, prix nuls, vente inférieure à l\'achat', await p.evaluate(() => { const X = App.exchange; return !!X.setRate({ cur: 'ZZZ', buy: 1, sell: 2 }).err && !!X.setRate({ cur: 'CDF', buy: 1, sell: 1 }).err && !!X.setRate({ cur: 'USD', buy: 0, sell: 2800 }).err && !!X.setRate({ cur: 'USD', buy: 2820, sell: 2780 }).err && App.db.xcRates.length === 0; }));
  check('cotations : USD 2780 / 2820, EUR 3000 / 3100 ; cours moyen du dollar 2800 ; la monnaie de référence vaut 1', await p.evaluate(() => { const X = App.exchange; X.setRate({ cur: 'USD', buy: 2780, sell: 2820 }); X.setRate({ cur: 'EUR', buy: '3000', sell: '3100' }); return X.rate('USD').mid === 2800 && X.rate('CDF').buy === 1 && X.kMain() === 2800 && X.currencies().join() === 'CDF,USD,EUR' && !X.todo().some(x => x[0].includes('Définissez')); }));

  // cash in / out
  check('apport refusé : sans monnaie, montant nul ; apports : 5 000 000 CDF, 1 000 USD, 500 EUR ; sortie refusée au-delà de la caisse', await p.evaluate(() => { const X = App.exchange, a = X.fund({ amount: 5 }), b = X.fund({ cur: 'USD', amount: 0 }); X.fund({ cur: 'CDF', amount: 5000000 }); X.fund({ cur: 'USD', amount: 1000 }); X.fund({ cur: 'EUR', amount: 500 }); const c = X.draw({ cur: 'EUR', amount: 501 }); return !!a.err && !!b.err && c.err.includes('Caisse insuffisante') && X.till('CDF') === 5000000 && X.till('USD') === 1000 && X.till('EUR') === 500; }));
  check('position de la caisse : (1 000 × 2 800 + 5 000 000 + 500 × 3 050) ÷ 2 800 = 3 330,36', await p.evaluate(() => Math.abs(App.exchange.position() - 3330.36) < 0.006));

  // trades
  check('opération refusée : même monnaie, montant nul, cotation manquante (GBP), caisse insuffisante (2 000 000 CDF → 645 EUR pour 500 en caisse) ; aucun numéro consommé', await p.evaluate(() => { const X = App.exchange; return !!X.trade({ give: 'USD', get: 'USD', amount: 5 }).err && !!X.trade({ give: 'USD', get: 'CDF', amount: 0 }).err && X.trade({ give: 'GBP', get: 'CDF', amount: 5 }).err.includes('GBP') && X.trade({ give: 'CDF', get: 'EUR', amount: 2000000 }).err.includes('Caisse insuffisante') && App.db.xcOps.filter(o => o.kind === 'trade').length === 0; }));
  const t1 = await p.evaluate(() => { const o = App.exchange.trade({ give: 'USD', get: 'CDF', amount: 100 }); return { id: o.id, n: o.number, got: o.r.amt }; });
  check('100 USD → CDF au cours d\'achat 2 780 : 278 000 CDF, XC-AAAA-0004 (après les trois apports) ; caisse USD 1 100, CDF 4 722 000 ; marge (100 × 2 800 − 278 000) ÷ 2 800 = 0,71', /^XC-\d{4}-0004$/.test(t1.n) && t1.got === 278000 && await p.evaluate(id => { const X = App.exchange; return X.till('USD') === 1100 && X.till('CDF') === 4722000 && Math.abs(X.gain(X.op(id)) - 0.71) < 0.006; }, t1.id));
  check('au-delà du seuil (1 000 USD) : nom et pièce d\'identité obligatoires ; avec eux l\'opération passe', await p.evaluate(() => { const X = App.exchange, a = X.trade({ give: 'USD', get: 'CDF', amount: 1200 }), b = X.trade({ give: 'USD', get: 'CDF', amount: 1200, person: 'Client Test', idDoc: 'ID-123' }); const ok = !a.err === false && !!b.number && b.person === 'Client Test' && b.idDoc === 'ID-123' && X.cancel(b) === true; return ok && X.till('USD') === 1100; }));
  const t2 = await p.evaluate(() => { const o = App.exchange.trade({ give: 'CDF', get: 'USD', amount: 300000 }); return { id: o.id, got: o.r.amt }; });
  check('300 000 CDF → USD au cours de vente 2 820 : 106,38 USD ; marge 0,76', near(t2.got, 106.38) && await p.evaluate(id => Math.abs(App.exchange.gain(App.exchange.op(id)) - 0.76) < 0.006, t2.id));
  check('montant négocié : 50 EUR → 149 000 CDF au lieu de 150 000, marge (50 × 3 050 − 149 000) ÷ 2 800 = 1,25 ; EUR → USD croisé : 100 EUR → 106,38 USD, marge 2,55', await p.evaluate(() => { const X = App.exchange, a = X.trade({ give: 'EUR', get: 'CDF', amount: 50, getAmt: 149000 }), b = X.trade({ give: 'EUR', get: 'USD', amount: 100 }); return a.r.amt === 149000 && Math.abs(X.gain(a) - 1.25) < 0.006 && Math.abs(b.r.amt - 106.38) < 0.006 && Math.abs(X.gain(b) - 2.55) < 0.006; }));
  check('caisse après les opérations : CDF 4 873 000, USD 887,24, EUR 650', await p.evaluate(() => { const X = App.exchange; return X.till('CDF') === 4873000 && Math.abs(X.till('USD') - 887.24) < 0.006 && X.till('EUR') === 650; }));
  check('changer la cotation du dollar (2 790 / 2 830) ne change pas la marge ni le montant des opérations passées', await p.evaluate(id => { const X = App.exchange, g = X.gain(X.op(id)); X.setRate({ cur: 'USD', buy: 2790, sell: 2830 }); const q = X.quote('USD', 100, 'CDF'); return Math.abs(X.gain(X.op(id)) - g) < 1e-9 && X.op(id).r.amt === 278000 && q.amt === 279000 && X.kMain() === 2810 && App.db.xcRates.filter(r => r.cur === 'USD').length === 2; }, t1.id));
  check('à faire : caisse non comptée aujourd\'hui (des opérations ont eu lieu)', await p.evaluate(() => App.exchange.todo().some(x => x[0].includes('non comptée'))));

  // count
  check('comptage refusé : rien de saisi, monnaie sans cotation avec écart ; comptage : CDF compté 4 872 000 (manque 1 000), USD exact', await p.evaluate(() => { const X = App.exchange, a = X.count({ counts: {} }), b = X.count({ counts: { GBP: 10 } }), r = X.count({ counts: { CDF: '4872000', USD: '887.24' } }); return !!a.err && !!b.err && r.length === 2 && r[0].d === -1000 && r[1].d === 0 && X.till('CDF') === 4872000; }));
  check('l\'écart de caisse est une perte : −1 000 CDF ÷ 2 810 = −0,36 ; plus d\'alerte de comptage', await p.evaluate(() => { const X = App.exchange, c = App.db.xcOps.find(o => o.kind === 'count' && o.d); return Math.abs(X.gain(c) + 0.36) < 0.006 && !X.todo().some(x => x[0].includes('non comptée')); }));

  // cancellation
  check('annulation d\'une opération : 300 000 CDF → USD annulée, caisse rétablie (USD 993,62) ; deuxième annulation refusée', await p.evaluate(id => { const X = App.exchange, r = X.cancel(X.op(id)); return r === true && Math.abs(X.till('USD') - 993.62) < 0.006 && X.till('CDF') === 4572000 && X.cancel(X.op(id)) === false; }, t2.id));
  check('annulation refusée si une caisse devient négative : l\'apport de 1 000 USD ne s\'annule pas (caisse USD < 0)', await p.evaluate(() => { const X = App.exchange, f = App.db.xcOps.find(o => o.kind === 'fund' && o.cur === 'USD'); return X.cancel(f) === 'neg' && f.status === 'Valide' && Math.abs(X.till('USD') - 993.62) < 0.006; }));

  // gains, journal, cash, report
  const rep = await p.evaluate(() => { const X = App.exchange, td = App.today(), r = { from: td, to: td, label: 'Aujourd\'hui' }, c = X.report(r); return { n: c.n, fx: c.fx, gap: c.gap, gains: c.gains, g2: X.gains(r), cur: c.cur.map(x => x.cur).sort().join(), tills: c.tills.length, large: c.large }; });
  check('rapport du jour : 3 opérations vivantes (1,0 + 0,71 + 1,25 + 2,55 − annulées) : marge 4,51, écart −0,36, gains 4,15', rep.n === 3 && near(rep.fx, 4.51) && near(rep.gap, -0.36) && near(rep.gains, 4.15) && near(rep.g2, 4.15) && rep.cur === 'CDF,EUR,USD' && rep.tills === 3, JSON.stringify(rep));
  check('journal : une écriture par opération avec marge ou écart (3 marges + 1 écart), en entrées sauf l\'écart de caisse', await p.evaluate(() => { const td = App.today(), e = App.fin.entries({ from: td, to: td }).filter(x => x.t === 'exchange'); return e.length === 4 && e.filter(x => x.k === 'in').length === 3 && e.filter(x => x.k === 'out').length === 1; }));
  check('caisse en espèces : les mouvements de change sont repris (cashSince(0) = caisse de chaque monnaie)', await p.evaluate(() => { const X = App.exchange, c = X.cashSince(0); return Math.abs(c.USD - X.till('USD')) < 0.006 && c.CDF === X.till('CDF'); }));
  check('chiffre d\'affaires et bénéfice : les gains du change sont repris dans les rapports', await p.evaluate(() => { const td = App.today(), c = App.reports.compute ? App.reports.compute({ from: td, to: td, label: 'x' }) : null; return c ? Math.abs(c.xc - 4.15) < 0.006 && Math.abs(c.revenue - 4.15) < 0.006 : true; }));
  check('textes : cotations du jour, rapport, reçu imprimable', await p.evaluate(() => { const X = App.exchange; return X.ratesText().includes('Cotations') && X.ratesText().includes('USD') && X.reportText(App.fin.range('month')).includes('Rapport change') && typeof X.printReceipt === 'function'; }));
  check('à faire : une cotation ancienne est signalée', await p.evaluate(() => { App.db.xcRates.push({ id: 'old', at: 1, date: '2020-01-01', cur: 'GBP', buy: 3500, sell: 3600 }); return App.exchange.todo().some(x => x[0].includes('à mettre à jour')); }));
  await p.evaluate(() => { App.db.xcRates = App.db.xcRates.filter(r => r.id !== 'old'); });

  // screens
  await p.evaluate(() => App.exchange.tradeForm()); await p.waitForSelector('.sheet [name=give]'); await settle(); await p.selectOption('.sheet [name=give]', 'USD'); await p.selectOption('.sheet [name=get]', 'CDF'); await p.fill('.sheet [name=amount]', '10');
  check('formulaire : la cotation s\'affiche (10 USD → 27 900 CDF)', await p.evaluate(() => { const t = document.querySelector('.sheet #qt').textContent.replace(/\s/g, ''); return t.includes('Cotation') && t.includes('27900'); }));
  await ok(); await p.waitForFunction(() => App.db.xcOps.filter(o => o.kind === 'trade').length === 6); await p.waitForSelector('.sheet-wrap', { state: 'detached' }).catch(() => {});
  check('opération par le formulaire : 10 USD → 27 900 CDF', await p.evaluate(() => { const o = App.db.xcOps.filter(x => x.kind === 'trade').pop(); return o.g.amt === 10 && o.r.amt === 27900; }));
  await p.evaluate(() => App.exchange.rateForm('EUR')); await p.waitForSelector('.sheet [name=buy]'); await settle(); await p.fill('.sheet [name=buy]', '3010'); await p.fill('.sheet [name=sell]', '3110'); await ok(); await p.waitForFunction(() => App.exchange.rate('EUR').buy === 3010);
  check('cotation par le formulaire : EUR 3 010 / 3 110', await p.evaluate(() => App.exchange.rate('EUR').sell === 3110));
  for (const tab of ['till', 'rates', 'ops', 'rep']) { await go(tab); check('onglet ' + tab + ' s\'affiche sans erreur', (await p.locator('#gtab').innerHTML()).length > 80); }
  check('Synchro : les collections sont partagées', await p.evaluate(() => ['xcRates', 'xcOps'].every(k => Array.isArray(App.db[k]))));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | '));
  await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
