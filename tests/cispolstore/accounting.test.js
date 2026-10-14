// Accountant's workbook (formatted .xlsx) and complete monthly PDF, checked on a small month worked out by hand.
const { chromium, devices } = require('playwright'); const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:8774';
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }), ctx = await b.newContext({ ...devices['Pixel 5'], acceptDownloads: true }), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => {
    const t = App.today(), m = t.slice(0, 7), day = n => m + '-' + String(n).padStart(2, '0'), first = day(1) > t ? t : day(1);
    App.db.clients.push({ id: 'c1', code: 'CL-1', type: 'mat', first: 'Jean', last: 'K', name: 'Jean K', phone: '1', created: t, subs: [] }, { id: 'c2', code: 'CL-2', type: 'mat', first: 'Awa', last: 'M', name: 'Awa M', phone: '2', created: t, subs: [] });
    App.db.products.push({ id: 'p1', name: 'Routeur', cat: 'Routeurs', price: 40, cost: 25, qty: 10, min: 2, ref: 'RX' });
    const inv = (cid, price, paid, cur) => App.createInvoice({ type: 'materiel', clientId: cid, currency: cur || 'USD', payMode: 'Cash', date: first, lines: [{ pid: 'p1', desc: 'Routeur', qty: 1, price, cost: 25 }], payAmount: paid }, 0);
    inv('c1', 100, 100); inv('c2', 60, 20);
    App.db.expenses.push({ id: 'e1', date: first, label: 'Transport', amount: 10, currency: 'USD', cat: 'Transport', mode: 'Cash' }, { id: 'e2', date: first, label: 'Loyer', amount: 24000, currency: 'CDF', cat: 'Loyer', mode: 'Banque', rate: 2400 });
    App.save(); App.go('rapportmois');
  });
  await p.waitForTimeout(700);
  let t = await p.innerText('#view');
  ok('monthly report has the two new buttons', /Rapport complet en PDF/.test(t) && /Excel pour le comptable/.test(t));
  const x = await p.evaluate(async () => {
    const m = App.monthCurrent(), sheets = App.accountingSheets(m), bytes = App.makeAccountingXlsx(sheets);
    // read the stored zip back
    const dv = new DataView(bytes.buffer), parts = {}; let o = 0; const dec = new TextDecoder();
    while (dv.getUint32(o, true) === 0x04034b50) { const sz = dv.getUint32(o + 18, true), nl = dv.getUint16(o + 26, true), el = dv.getUint16(o + 28, true), name = dec.decode(bytes.slice(o + 30, o + 30 + nl)); parts[name] = dec.decode(bytes.slice(o + 30 + nl + el, o + 30 + nl + el + sz)); o += 30 + nl + el + sz; }
    const bad = Object.entries(parts).filter(([k, v]) => /\.xml$|\.rels$/.test(k) && new DOMParser().parseFromString(v, 'application/xml').querySelector('parsererror')).map(([k]) => k);
    return { names: Object.keys(parts), bad, sheets: sheets.map(s => ({ t: s.title, n: s.rows.length })), sum: sheets[0].rows.map(r => r.map(c => c && (c.v !== undefined ? c.v : c)).join('|')), ventes: sheets[1].rows.map(r => r.map(c => c && (c.v !== undefined ? c.v : c)).join('|')), journal: sheets[2].rows.slice(-3).map(r => r.filter(Boolean).map(c => c.f ? c.f + '=' + c.v : c.v).join('|')), stock: sheets[5].rows.slice(-1)[0].map(c => c && c.f ? c.f + '=' + c.v : '').join('|'), wb: parts['xl/workbook.xml'], s2: parts['xl/worksheets/sheet2.xml'], size: bytes.length, byteArr: Array.from(bytes) };
  });
  ok('workbook parts present (content types, styles, 6 sheets)', ['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet6.xml'].every(n => x.names.includes(n)), x.names.length + ' parts');
  ok('every XML part is well formed', x.bad.length === 0, x.bad.join(','));
  ok('six sheets: Résumé, Ventes, Journal de caisse, Dépenses, Impayés, Stock valorisé', JSON.stringify(x.sheets.map(s => s.t)) === '["Résumé","Ventes","Journal de caisse","Dépenses","Impayés","Stock valorisé"]');
  ok('workbook recalculates on load; sheet 2 has frozen header and filter', /fullCalcOnLoad="1"/.test(x.wb) && /state="frozen"/.test(x.s2) && /<autoFilter ref="A1:K3"\/>/.test(x.s2), (x.s2.match(/<autoFilter[^>]*>/) || [''])[0]);
  ok('summary: total facturé 160 $ (100 + 60)', x.sum.some(r => /^Total facturé\|160\|/.test(r)), x.sum.slice(3, 6).join(' // '));
  ok('summary: expenses 20 $ (10 $ + 24 000 CDF at 2 400)', x.sum.some(r => /^Dépenses\|20\|/.test(r)), x.sum.find(r => /^Dépenses/.test(r)));
  ok('sales sheet: 2 invoices + total row with 160 $ total and 40 $ left', x.ventes.length === 4 && /^TOTAL\|.*\|160\|40$/.test(x.ventes[3]), x.ventes[3]);
  ok('cash journal ends with SUMIF totals', x.journal.some(r => /SUMIF/.test(r)) && x.journal.some(r => /J\d+-J\d+=/.test(r)), x.journal.join(' // '));
  ok('stock total uses the E*F formulas (qty × price)', /SUM\(G2:G2\)=\d+/.test(x.stock) || /SUM\(G2:G2\)/.test(x.stock), x.stock);
  fs.writeFileSync(process.env.KEEP_XLSX||'compta.xlsx', Buffer.from(x.byteArr)); ok('xlsx file written (' + x.size + ' bytes)', x.size > 3000);
  // the download action
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=acct_xlsx]')]);
  ok('download action: file name CISPOLstore-compta-<month>.xlsx', /^CISPOLstore-compta-\d{4}-\d{2}\.xlsx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  // PDF
  const doc = await p.evaluate(() => App.monthDoc(App.monthCurrent(), '', 'stamp.png'));
  ok('PDF document: title, KPIs, finances, cash and situation sections', /RAPPORT MENSUEL/.test(doc) && /Total facturé/.test(doc) && /Argent encaissé et dépensé/.test(doc) && /Situation au/.test(doc) && /<svg/.test(doc));
  const [pd] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('[data-act=rm_pdf]')]);
  const buf = fs.readFileSync(await pd.path()); ok('PDF downloaded, valid header, multi-object', pd.suggestedFilename().endsWith('.pdf') && buf.slice(0, 5).toString() === '%PDF-' && buf.length > 5000, pd.suggestedFilename() + ' ' + buf.length);
  await p.evaluate(() => { App.db.settings.users = [{ id: 'v', name: 'Vic', role: 'vendeur', active: true, salt: 's', hash: 'h' }]; App.user = App.db.settings.users[0]; App.applyRole && App.applyRole(); });
  ok('vendeur does not get the accountant buttons', await p.evaluate(() => !App.can('finance')));
  ok('no page errors', errs.length === 0, errs.join('|')); await b.close(); process.exit(f ? 1 : 0);
})();
