// For the accountant: a formatted Excel workbook of one month (summary, sales, cash journal, expenses, unpaid, stock) and a complete monthly report in PDF.
(() => {
  'use strict';
  const App = window.App, esc = App.esc;
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const col = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
  const serial = iso => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 864e5);
  const r2 = n => Math.round(n * 100) / 100;
  // cell helpers: { v, s (style name), f (formula, v = cached result) }
  const T = (v, s) => ({ v, s }), M = (n, cur) => ({ v: cur === 'CDF' ? Math.round(n) : r2(n), s: cur === 'CDF' ? 'cdf' : 'usd' }), U = n => ({ v: r2(n), s: 'usd' }), D = iso => ({ v: serial(iso), s: 'date' }), I = n => ({ v: n, s: 'int' });
  const HEAD = a => a.map(x => T(x, 'h'));
  const STY = { h: 1, title: 2, sub: 3, usd: 4, cdf: 5, date: 6, int: 7, tl: 8, tusd: 9, tcdf: 10, b: 11, pct: 12, sec: 13, tint: 14, note: 3 };

  // ---------- workbook writer (styles, number formats, formulas, filters, print setup) ----------
  const STYLES = X + `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="4"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;$&quot;"/><numFmt numFmtId="165" formatCode="#,##0\\ &quot;CDF&quot;"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy"/><numFmt numFmtId="167" formatCode="0.0%"/></numFmts>
    <fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF12365D"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF5D7690"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
    <fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF12365D"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F1FA"/></patternFill></fill></fills>
    <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FF12365D"/></top><bottom/><diagonal/></border></borders>
    <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
    <cellXfs count="15"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
      <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
      <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
      <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
      <xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left"/></xf><xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
      <xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="4" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
      <xf numFmtId="165" fontId="4" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
      <xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
      <xf numFmtId="1" fontId="4" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/></cellXfs></styleSheet>`;
  const cellXml = (c, ref) => {
    if (c === '' || c == null) return '';
    const o = typeof c === 'object' ? c : { v: c }, s = o.s ? ` s="${STY[o.s]}"` : '';
    if (o.f) return `<c r="${ref}"${s}><f>${esc(o.f)}</f><v>${o.v}</v></c>`;
    if (typeof o.v === 'number' && isFinite(o.v)) return `<c r="${ref}"${s}><v>${o.v}</v></c>`;
    if (o.v === '' || o.v == null) return o.s ? `<c r="${ref}"${s}/>` : '';
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(o.v)}</t></is></c>`;
  };
  // sheet: { title, rows, widths, header (row number of the header, frozen + filtered), landscape, grid }
  App.makeAccountingXlsx = sheets => {
    const names = sheets.map(s => s.title.replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31));
    const sheetXml = s => {
      const nCols = Math.max(...s.rows.map(r => r.length), 1), last = s.rows.length;
      const rows = s.rows.map((r, i) => `<row r="${i + 1}"${s.header === i + 1 ? ' ht="30" customHeight="1"' : ''}>${r.map((c, j) => cellXml(c, col(j) + (i + 1))).join('')}</row>`).join('');
      const pane = s.header ? `<pane ySplit="${s.header}" topLeftCell="A${s.header + 1}" activePane="bottomLeft" state="frozen"/>` : '';
      const filter = s.header && s.filterTo ? `<autoFilter ref="A${s.header}:${col(nCols - 1)}${s.filterTo}"/>` : '';
      return X + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"${s.grid === false ? ' showGridLines="0"' : ''}>${pane}</sheetView></sheetViews><cols>${(s.widths || []).map((w, j) => `<col min="${j + 1}" max="${j + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData>${filter}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${s.landscape ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/></worksheet>`;
    };
    return App.zip([
      ['[Content_Types].xml', X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>'],
      ['_rels/.rels', X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', X + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets><calcPr fullCalcOnLoad="1"/></workbook>'],
      ['xl/_rels/workbook.xml.rels', X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ['xl/styles.xml', STYLES],
      ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)])
    ]);
  };

  // ---------- the month, sheet by sheet ----------
  const inM = (d, r) => App.inRange(d, r);
  App.accountingSheets = m => {
    const db = App.db, r = App.monthRange(m), d = App.monthData(m), co = db.settings.company, t = App.today(), L = App.monthLabel(m), ledger = App.ledger().filter(x => inM(x.date, r));
    const by = (rows, k) => { const o = {}; rows.forEach(x => { o[x[k]] = (o[x[k]] || 0) + x.usd; }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
    const total = (label, from, to, cell) => [T(label, 'tl'), { v: cell.v, f: `SUM(B${from}:B${to})`, s: 'tusd' }];

    // 1. Summary
    const S = [[T(co.name, 'title')], [T(`Rapport comptable · ${L} · généré le ${App.fdate(t)}`, 'sub')], [], [T('Activité du mois', 'sec'), T('', 'sec'), T('', 'sec')]];
    const line = (a, v, note) => S.push([T(a), U(v), T(note || '', 'note')]);
    line('Total facturé', d.ca, `${d.nInv} facture(s) validée(s), prix convenus`); line('CA réel (kits, matériel)', d.real, 'sans abonnements ni installations'); line('Coût des marchandises et de Starlink', d.cost); line('Marge brute', d.margin); line('Dépenses', d.exp); S.push([T('Bénéfice net', 'tl'), { v: r2(d.net), s: 'tusd' }, T('', 'tl')]);
    S.push([T('Nouveaux clients'), I(d.newClients)], [T('Abonnements renouvelés'), I(d.sub.n), T(`${App.fmt(d.sub.amt)} facturés`, 'note')], []);
    const ins = by(ledger.filter(x => x.kind === 'in'), 'mode'), outs = by(ledger.filter(x => x.kind === 'out'), 'type');
    S.push([T('Encaissements du mois par mode de paiement', 'sec'), T('Équivalent $', 'sec'), T('', 'sec')]); const a1 = S.length + 1;
    ins.forEach(([k, v]) => S.push([T(k), U(v)])); if (ins.length) S.push(total('Total encaissé', a1, S.length, { v: r2(ins.reduce((a, x) => a + x[1], 0)) })); else S.push([T('Aucun encaissement', 'note')]);
    S.push([], [T('Sorties du mois par type', 'sec'), T('Équivalent $', 'sec'), T('', 'sec')]); const a2 = S.length + 1;
    outs.forEach(([k, v]) => S.push([T(k), U(v)])); if (outs.length) S.push(total('Total des sorties', a2, S.length, { v: r2(outs.reduce((a, x) => a + x[1], 0)) })); else S.push([T('Aucune sortie', 'note')]);
    S.push([], [T(`Situation au ${App.fdate(t)}`, 'sec'), T('', 'sec'), T('', 'sec')]);
    line('Impayés clients (factures et pénalités)', App.unpaidTotal(), 'à encaisser'); line('Fonds de clients en attente', App.depHeldUsd ? App.depHeldUsd() : 0, "argent reçu, pas encore payé pour les clients : ce n'est pas un revenu"); line('Dû à Starlink', App.slDue ? App.slDue() : 0, 'abonnements encaissés à reverser'); line("Valeur du stock (prix d'achat)", db.products.filter(App.tracked).reduce((a, p) => a + p.qty * p.cost, 0));
    S.push([T(`Taux du jour : 1 $ = ${App.nf(App.rate(), 0)} CDF`, 'note')]);

    // 2. Sales
    const inv = db.invoices.filter(i => App.live(i) && inM(i.date, r)).sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number)), V = [HEAD(['Numéro', 'Date', 'Client', 'Type', 'Statut', 'Devise', 'Total', 'Payé', 'Reste', 'Total ($)', 'Reste ($)'])];
    inv.forEach(i => { const tot = App.invAgreed(i), paid = App.invPaid(i), due = App.invDue(i); V.push([T(i.number), D(i.date), T(App.cname(App.client(i.clientId))), T(App.invTypes[i.type]), T(App.INV[App.invStatus(i)][0]), T(i.currency), M(tot, i.currency), M(paid, i.currency), M(due, i.currency), U(App.usd(tot, i.currency, i)), U(App.usd(due, i.currency, i))]); });
    const n1 = V.length; V.push([T('TOTAL', 'tl'), ...Array(8).fill(0).map(() => T('', 'tl')), { v: r2(inv.reduce((a, i) => a + App.usd(App.invAgreed(i), i.currency, i), 0)), f: `SUM(J2:J${n1})`, s: 'tusd' }, { v: r2(inv.reduce((a, i) => a + App.usd(App.invDue(i), i.currency, i), 0)), f: `SUM(K2:K${n1})`, s: 'tusd' }]);

    // 3. Cash journal
    const J = [HEAD(['Date', 'Sens', 'Type', 'Libellé', 'Client / Catégorie', 'Mode', 'Référence', 'Devise', 'Montant', 'Équivalent ($)'])], rows = ledger.slice().sort((a, b) => a.date.localeCompare(b.date) || a.k - b.k);
    rows.forEach(x => J.push([D(x.date), T(x.kind === 'in' ? 'Entrée' : 'Sortie'), T(x.type), T(x.label), T(x.who || ''), T(x.mode || ''), T(x.ref || ''), T(x.cur), M(x.amt, x.cur), U(x.usd)]));
    const n2 = J.length, sumIf = k => r2(rows.filter(x => x.kind === k).reduce((a, x) => a + x.usd, 0)), ein = sumIf('in'), eout = sumIf('out');
    J.push([], [T('Total des entrées ($)', 'tl'), ...Array(8).fill(0).map(() => T('', 'tl')), { v: ein, f: `SUMIF(B2:B${n2},"Entrée",J2:J${n2})`, s: 'tusd' }], [T('Total des sorties ($)', 'tl'), ...Array(8).fill(0).map(() => T('', 'tl')), { v: eout, f: `SUMIF(B2:B${n2},"Sortie",J2:J${n2})`, s: 'tusd' }], [T('Solde du mois ($)', 'tl'), ...Array(8).fill(0).map(() => T('', 'tl')), { v: r2(ein - eout), f: `J${n2 + 2}-J${n2 + 3}`, s: 'tusd' }]);

    // 4. Expenses
    const ex = db.expenses.filter(e => inM(e.date, r)).sort((a, b) => a.date.localeCompare(b.date)), E = [HEAD(['Date', 'Libellé', 'Catégorie', 'Mode', 'Devise', 'Montant', 'Équivalent ($)'])];
    ex.forEach(e => E.push([D(e.date), T(e.label), T(e.cat), T(e.mode || ''), T(e.currency), M(e.amount, e.currency), U(App.usd(e.amount, e.currency, e))]));
    const n3 = E.length; E.push([T('TOTAL', 'tl'), ...Array(5).fill(0).map(() => T('', 'tl')), { v: r2(ex.reduce((a, e) => a + App.usd(e.amount, e.currency, e), 0)), f: `SUM(G2:G${n3})`, s: 'tusd' }]);

    // 5. Unpaid invoices today
    const open = db.invoices.filter(i => App.invDue(i) > 0.004).sort((a, b) => a.date.localeCompare(b.date)), P = [HEAD(['Facture', 'Date', 'Client', 'Âge (jours)', 'Devise', 'Reste dû', 'Reste dû ($)'])];
    open.forEach(i => P.push([T(i.number), D(i.date), T(App.cname(App.client(i.clientId))), I(Math.max(0, App.diff(i.date, t))), T(i.currency), M(App.invDue(i), i.currency), U(App.usd(App.invDue(i), i.currency, i))]));
    const n4 = P.length; P.push([T('TOTAL', 'tl'), ...Array(5).fill(0).map(() => T('', 'tl')), { v: r2(open.reduce((a, i) => a + App.usd(App.invDue(i), i.currency, i), 0)), f: `SUM(G2:G${n4})`, s: 'tusd' }]);

    // 6. Stock valued
    const pr = db.products.filter(App.tracked).sort((a, b) => a.name.localeCompare(b.name)), K = [HEAD(['Produit', 'Catégorie', 'Référence', 'Unité', 'Quantité', "Prix d'achat ($)", "Valeur d'achat ($)", 'Prix de vente ($)', 'Valeur de vente ($)'])];
    pr.forEach((p, i) => { const n = i + 2; K.push([T(p.name), T(p.cat), T(p.ref || ''), T(p.unit || ''), { v: p.qty }, U(p.cost || 0), { v: r2(p.qty * (p.cost || 0)), f: `E${n}*F${n}`, s: 'usd' }, U(p.price || 0), { v: r2(p.qty * (p.price || 0)), f: `E${n}*H${n}`, s: 'usd' }]); });
    const n5 = K.length; K.push([T('TOTAL', 'tl'), ...Array(5).fill(0).map(() => T('', 'tl')), { v: r2(pr.reduce((a, p) => a + p.qty * (p.cost || 0), 0)), f: `SUM(G2:G${n5})`, s: 'tusd' }, T('', 'tl'), { v: r2(pr.reduce((a, p) => a + p.qty * (p.price || 0), 0)), f: `SUM(I2:I${n5})`, s: 'tusd' }]);

    return [
      { title: 'Résumé', rows: S, widths: [46, 18, 60], grid: false },
      { title: 'Ventes', rows: V, widths: [16, 12, 30, 18, 12, 9, 15, 15, 15, 15, 15], header: 1, filterTo: n1, landscape: true },
      { title: 'Journal de caisse', rows: J, widths: [12, 9, 14, 38, 26, 14, 18, 9, 16, 16], header: 1, filterTo: n2, landscape: true },
      { title: 'Dépenses', rows: E, widths: [12, 38, 22, 14, 9, 16, 16], header: 1, filterTo: n3 },
      { title: 'Impayés', rows: P, widths: [16, 12, 32, 12, 9, 16, 16], header: 1, filterTo: n4 },
      { title: 'Stock valorisé', rows: K, widths: [34, 18, 14, 8, 11, 16, 18, 16, 18], header: 1, filterTo: n5, landscape: true }
    ];
  };
  const MIME_X = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  App.actions.acct_xlsx = () => { if (!App.can('finance')) return App.toast('Action réservée au gérant ou au comptable'); const m = App.monthCurrent();
    App.download(`CISPOLstore-compta-${m}.xlsx`, App.makeAccountingXlsx(App.accountingSheets(m)), MIME_X); App.toast('Classeur du comptable créé : ' + App.monthLabel(m)); };

  // ---------- complete monthly report (PDF) ----------
  App.monthDoc = (m, logo, stamp) => {
    const K = App.docKit, db = App.db, co = db.settings.company, e = esc, d = App.monthData(m), r = App.monthRange(m), t = App.today(), F = x => K.money(x, 'USD'), L = App.monthLabel(m), pc = (a, b) => b > 0 ? Math.round(a / b * 100) : 0;
    const ledger = App.ledger().filter(x => inM(x.date, r)), grp = (rows, k) => { const o = {}; rows.forEach(x => { o[x[k]] = (o[x[k]] || 0) + x.usd; }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
    const H = txt => `<div style="font-size:12pt;font-weight:bold;color:#1A365D;margin:16px 0 6px;border-bottom:2px solid #DD6B20;padding-bottom:3px">${txt}</div>`;
    const table = (head, rows, right = []) => `<table class="items" style="margin-bottom:6px"><thead><tr>${head.map((h, i) => `<th${right.includes(i) ? ' class="r"' : ''}>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(rw => `<tr>${rw.map((c, i) => `<td${right.includes(i) ? ' class="r"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    // sales per day (inline SVG)
    const days = r[1].slice(8) * 1, per = Array(days).fill(0); App.db.invoices.filter(i => App.live(i) && inM(i.date, r)).forEach(i => { per[+i.date.slice(8) - 1] += App.usd(App.invAgreed(i), i.currency, i); });
    const mx = Math.max(...per, 1), bw = 700 / days, chart = per.some(v => v) ? `<svg viewBox="0 0 700 110" width="100%" style="display:block;margin:4px 0 2px"><line x1="0" y1="92" x2="700" y2="92" stroke="#CBD5E0"/>${per.map((v, i) => `<rect x="${(i * bw + 1).toFixed(1)}" y="${(92 - v / mx * 68).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${(v / mx * 68).toFixed(1)}" fill="#1E5AA8" rx="1.5"/>`).join('')}${per.map((v, i) => (i + 1) % 5 === 1 ? `<text x="${(i * bw + bw / 2).toFixed(1)}" y="105" font-size="9" text-anchor="middle" fill="#4A5568">${i + 1}</text>` : '').join('')}<text x="0" y="9" font-size="9" fill="#4A5568">Ventes facturées par jour (max ${e(F(mx))})</text></svg>` : '';
    const top = {}; db.invoices.filter(i => App.live(i) && i.clientId && inM(i.date, r)).forEach(i => { top[i.clientId] = (top[i.clientId] || 0) + App.usd(App.invAgreed(i), i.currency, i); });
    const best = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 8).filter(x => App.client(x[0]));
    const open = db.invoices.filter(i => App.invDue(i) > 0.004).sort((a, b) => App.usd(App.invDue(b), b.currency, b) - App.usd(App.invDue(a), a.currency, a)).slice(0, 8);
    const kpi = (lab, val, sub) => `<td style="border:1px solid #E2E8F0;background:#F7FAFC;padding:8px 10px;width:25%"><div style="font-size:8.5pt;color:#4A5568">${lab}</div><div style="font-size:15pt;font-weight:bold;color:#1A365D">${val}</div><div style="font-size:8pt;color:#718096">${sub || '&nbsp;'}</div></td>`;
    return `<div class="paper">${K.head(co, logo)}
      ${K.boxes('RAPPORT MENSUEL', [['Période', `<b>${e(L)}</b>`], ['Établi le', App.fdate(t)], co.city && ['Lieu', e(co.city)]], 'EN BREF', [['Total facturé', `<b>${e(F(d.ca))}</b>`], ['Bénéfice net', `<b>${e(F(d.net))}</b>`], ['Marge nette', pc(d.net, d.ca) + ' %']])}
      <table style="border-collapse:separate;border-spacing:6px 0;margin:0 -6px 4px;width:calc(100% + 12px)"><tr>${kpi('Total facturé', e(F(d.ca)), d.nInv + ' facture(s)')}${kpi('CA réel', e(F(d.real)), 'kits et matériel')}${kpi('Marge brute', e(F(d.margin)), pc(d.margin, d.ca) + ' % du facturé')}${kpi('Bénéfice net', e(F(d.net)), 'après dépenses')}</tr></table>
      ${chart}
      ${H('Finances')}${table(['Poste', 'Montant'], [['Total facturé', F(d.ca)], ['CA réel (sans abonnements ni installations)', F(d.real)], ['Coût des marchandises et de Starlink', F(d.cost)], ['<b>Marge brute</b>', `<b>${F(d.margin)}</b>`], ['Dépenses', F(d.exp)], ['<b>Bénéfice net</b>', `<b>${F(d.net)}</b>`]].map(x => x.map(c => typeof c === 'string' ? c : e(c))), [1])}
      ${H('Abonnements, installations et clients')}${table(['Indicateur', 'Valeur'], [['Renouvellements facturés', d.sub.n + ' · ' + e(F(d.sub.amt))], ['Marge sur abonnements', e(F(d.sub.margin))], ['Abonnés actifs / en sursis / inactifs', `${d.status.actif} / ${d.status.sursis} / ${d.status.inactif}`], ['Installations', d.inst.n + ' · ' + e(F(d.inst.amt))], ['Ventes de matériel', e(F(d.matSales))], ['Nouveaux clients', d.newClients]], [1])}
      ${best.length ? H('Meilleurs clients du mois') + table(['Client', 'Facturé', 'Part'], best.map(([id, v]) => [e(App.cname(App.client(id))), e(F(v)), pc(v, d.ca) + ' %']), [1, 2]) : ''}
      ${H("Argent encaissé et dépensé")}${table(['Encaissements par mode', 'Montant'], grp(ledger.filter(x => x.kind === 'in'), 'mode').map(([k, v]) => [e(k), e(F(v))]).concat([[`<b>Total encaissé</b>`, `<b>${e(F(ledger.filter(x => x.kind === 'in').reduce((a, x) => a + x.usd, 0)))}</b>`]]), [1])}
      ${table(['Sorties par type', 'Montant'], grp(ledger.filter(x => x.kind === 'out'), 'type').map(([k, v]) => [e(k), e(F(v))]).concat([[`<b>Total des sorties</b>`, `<b>${e(F(ledger.filter(x => x.kind === 'out').reduce((a, x) => a + x.usd, 0)))}</b>`]]), [1])}
      ${d.exps.length ? table(['Dépenses par catégorie', 'Montant'], d.exps.map(([k, v]) => [e(k), e(F(v))]), [1]) : ''}
      ${H(`Situation au ${App.fdate(t)}`)}${table(['Poste', 'Montant'], [['Impayés clients (factures et pénalités)', e(F(App.unpaidTotal())) + ` · ${d.unpaid.n} facture(s)`], ['Fonds de clients en attente (pas un revenu)', e(F(App.depHeldUsd ? App.depHeldUsd() : 0))], ['Dû à Starlink', e(F(App.slDue ? App.slDue() : 0))], ["Valeur du stock (prix d'achat)", e(F(db.products.filter(App.tracked).reduce((a, p) => a + p.qty * p.cost, 0)))]], [1])}
      ${open.length ? table(['Plus gros impayés', 'Facture', 'Âge', 'Reste dû'], open.map(i => [e(App.cname(App.client(i.clientId))), e(i.number), Math.max(0, App.diff(i.date, t)) + ' j', e(F(App.usd(App.invDue(i), i.currency, i)))]), [2, 3]) : ''}
      ${d.lowStock.length ? `<div class="wb"><b>Stock bas :</b> ${d.lowStock.map(e).join(' · ')}</div>` : ''}
      <table class="sg" style="margin-top:22px"><tr><td></td><td class="gp"></td><td class="s2"><img src="${e(stamp || 'stamp.png')}" alt=""></td></tr><tr><td class="ln">Le comptable</td><td class="gp"></td><td class="ln">${e(co.name)}</td></tr></table>${K.foot(stamp, true)}</div>`;
  };
  App.actions.rm_pdf = async () => { if (!App.can('finance')) return App.toast('Action réservée au gérant ou au comptable'); const m = App.monthCurrent(); App.sharePdf(`CISPOLstore-rapport-${m}.pdf`, App.monthDoc(m, await App.docKit.logoData(), await App.docKit.stampData())); };
  App.acctButtons = () => '<div class="bar noprint"><button class="btn" data-act="rm_pdf">📄 Rapport complet en PDF</button><button class="btn sec" data-act="acct_xlsx">📊 Excel pour le comptable</button></div>';
})();
