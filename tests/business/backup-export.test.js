const fs = require('fs'), { check, launch, setup } = require('./helper'), fx = require('./fixtures');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'commerce' });
  await p.evaluate(ps => { ps.forEach((x, i) => App.db.clients.push({ id: 'c' + i, code: App.clients.nextCode(), created: '2026-01-01', name: x.name, phone: x.phone, email: x.email, type: x.type, address: '', note: '', fields: {} }));
    App.db.products.push({ id: 'p1', code: 'PR-1', name: 'Riz', cat: 'Général', unit: 'kg', track: true, qty: 10, min: 2, cost: 1, price: 2, fields: {}, supplierId: '' });
    App.db.invoices.push({ id: 'i1', number: 'FAC-2026-0001', clientId: 'c0', date: '2026-11-01', currency: 'USD', rate: 2800, lines: [{ pid: 'p1', desc: 'Riz', qty: 3, price: 2, cost: 1 }], sub: 6, discAmt: 0, total: 6, disc: {}, fields: {} });
    App.db.payments.push({ id: 'pa', invoiceId: 'i1', clientId: 'c0', date: '2026-11-01', amount: 4, currency: 'USD', rate: 2800, mode: 'Espèces', note: '', no: 'REC-2026-0001' });
    App.save(); App.go('data'); }, fx.people(5));
  await p.waitForSelector('#dbk');
  // ---- backup
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#dbk')]); const path = await dl.path(), file = JSON.parse(fs.readFileSync(path, 'utf8'));
  check('nom de fichier de sauvegarde', /^sauvegarde-ets-test-\d{4}-\d{2}-\d{2}-\d{2}h\d{2}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  check('sauvegarde : application, version, données', file.app === 'cispolstore-business' && file.db.clients.length === 5 && file.db.invoices.length === 1);
  check('date de sauvegarde mémorisée', await p.evaluate(() => App.db.settings.lastBackup > 0));
  const text = fs.readFileSync(path, 'utf8');
  // ---- restore: change data, then restore the backup
  await p.evaluate(() => { App.db.clients = []; App.db.invoices = []; App.save(); });
  const ok = p.evaluate(t => App.data.restoreText(t, 'test.json'), text); await p.waitForSelector('.sheet footer .danger'); await p.click('.sheet footer .danger'); check('restauration confirmée', (await ok) === true);
  check('données restaurées', await p.evaluate(() => App.db.clients.length === 5 && App.db.invoices.length === 1 && App.db.payments.length === 1));
  await p.click('.toast button'); check('annulation de la restauration', await p.evaluate(() => App.db.clients.length === 0));
  const bad = await p.evaluate(async () => { try { await App.data.restoreText('pas du json'); return 'x'; } catch (e) { return e.message; } }); check('fichier illisible refusé', bad.includes('lisible'));
  check('fichier étranger refusé', (await p.evaluate(async () => { try { await App.data.restoreText('{"app":"autre","db":{}}'); return 'x'; } catch (e) { return e.message; } })).includes('CISPOLstore Business'));
  await p.evaluate(t => { App.db = App.migrate(JSON.parse(t).db); App.save(); App.go('data'); App.render(); }, text);
  // ---- xlsx export, read back with the app's own reader
  const [dx] = await Promise.all([p.waitForEvent('download'), p.click('#dxl')]); const buf = fs.readFileSync(await dx.path());
  check('export .xlsx : nom de fichier', /^export-ets-test-.*\.xlsx$/.test(dx.suggestedFilename()));
  const sheets = await p.evaluate(async b => { const r = await App.sheetio.readXlsx(new Uint8Array(b).buffer); return r.map(s => ({ n: s.name, rows: s.rows })); }, [...buf]);
  check('Excel : 8 feuilles', sheets.length === 8 && sheets.map(s => s.n).includes('Factures') && sheets.map(s => s.n).includes('Mouvements de stock'));
  const cl = sheets.find(s => s.n === 'Clients'); check('Excel : clients (en-tête + 5 lignes)', cl.rows.length === 6 && cl.rows[0][1] === 'Nom' && String(cl.rows[1][1]).includes('Test001'));
  const fa = sheets.find(s => s.n === 'Factures'); check('Excel : facture avec payé / reste / statut', fa.rows[1][0] === 'FAC-2026-0001' && fa.rows[1][8] === 4 && fa.rows[1][9] === 2 && fa.rows[1][10] === 'Partielle', JSON.stringify(fa.rows[1]));
  const pr = sheets.find(s => s.n === 'Produits'); check('Excel : nombres restent des nombres', typeof pr.rows[1][6] === 'number' && pr.rows[1][6] === 10);
  // ---- csv
  const [dc] = await Promise.all([p.waitForEvent('download'), p.click('[data-csv="Clients"]')]); const csv = fs.readFileSync(await dc.path(), 'utf8');
  check('CSV : BOM, séparateur ; et en-tête', csv.charCodeAt(0) === 0xfeff && csv.split('\r\n')[0].startsWith('﻿Code;Nom;Type;') && csv.split('\r\n').length === 6);
  check('CSV : guillemets protégés', await p.evaluate(() => App.csv([['a;b', 'c"d', 'é']]) === '﻿"a;b";"c""d";é'));
  // ---- export right
  await p.evaluate(async () => { await App.roles.addUser('Admin', 'admin', '1234'); await App.roles.addUser('Vendeur', 'seller', '1111'); App.user = App.db.users[1]; });
  await p.evaluate(() => App.data.exportXlsx()); check('export refusé au vendeur', await p.isVisible('.toast.err'));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | ')); await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
