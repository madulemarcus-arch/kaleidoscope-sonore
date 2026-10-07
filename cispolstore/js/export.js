// Readable exports built without any library: tables, a real .xlsx workbook (zip, no compression) and a simple PDF.
(() => {
  'use strict';
  const App = window.App, esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ---------- Tables (shared by CSV, Excel and PDF) ----------
  App.tables = () => {
    const db = App.db;
    return {
      clients: { title: 'Clients', rows: [['Code', 'Type', 'Prénom', 'Nom', 'Téléphone', 'Adresse', 'ACC', 'N° série', 'Kit', 'Abonnement', 'Début', 'Fin', 'Fin sursis', 'Statut'], ...db.clients.map(c => { const s = App.sub(c); return [c.code, App.TYPES[c.type], c.first, c.last, c.phone, c.address, c.acc, c.serial, c.kit, c.plan, s ? s.start : '', s ? s.end : '', s ? s.gEnd : '', s ? App.STATUS[s.status][0] : '']; })] },
      factures: { title: 'Factures', rows: [['Numéro', 'Date', 'Client', 'Type', 'Devise', 'Total', 'Payé', 'Solde'], ...db.invoices.map(i => [i.number, i.date, App.cname(App.client(i.clientId)), App.invTypes[i.type], i.currency, App.invTotal(i), App.invPaid(i), App.invDue(i)])] },
      paiements: { title: 'Paiements', rows: [['Date', 'Client', 'Facture', 'Montant', 'Devise', 'Mode', 'Référence', 'Commentaire'], ...db.payments.map(p => [p.date, App.cname(App.client(p.clientId)), (App.invoice(p.invoiceId) || {}).number || '', p.amount, p.currency, p.mode, p.ref, p.comment])] },
      depenses: { title: 'Dépenses', rows: [['Date', 'Libellé', 'Catégorie', 'Montant', 'Devise'], ...db.expenses.map(e => [e.date, e.label, e.cat, e.amount, e.currency])] },
      stock: { title: 'Stock', rows: [['Nom', 'Catégorie', 'Référence', 'Unité', 'Quantité', 'Prix achat', 'Prix vente'], ...db.products.map(p => [p.name, p.cat, p.ref, p.unit, p.qty, p.cost, p.price])] }
    };
  };

  // ---------- ZIP / XLSX ----------
  const enc = new TextEncoder();
  let crcT; const crc32 = u8 => { if (!crcT) { crcT = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; } } let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = crcT[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const zip = files => { // files: [[name, string]] stored without compression
    const parts = [], cen = []; let off = 0;
    const u16 = n => [n & 255, n >> 8 & 255], u32 = n => [n & 255, n >> 8 & 255, n >> 16 & 255, n >>> 24 & 255];
    for (const [name, text] of files) {
      const nm = enc.encode(name), data = enc.encode(text), crc = crc32(data);
      const head = Uint8Array.from([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nm.length), ...u16(0)]);
      parts.push(head, nm, data);
      cen.push(Uint8Array.from([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nm.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nm);
      off += head.length + nm.length + data.length;
    }
    const cenLen = cen.reduce((a, b) => a + b.length, 0), end = Uint8Array.from([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cenLen), ...u32(off), ...u16(0)]);
    const all = [...parts, ...cen, end], out = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let p = 0; for (const b of all) { out.set(b, p); p += b.length; } return out;
  };
  const col = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
  App.makeXlsx = sheets => {
    const names = sheets.map(s => s.title.replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31));
    const sheetXml = s => {
      const w = []; s.rows.forEach(r => r.forEach((v, j) => { w[j] = Math.max(w[j] || 8, Math.min(48, String(v ?? '').length + 2)); }));
      const rows = s.rows.map((r, i) => `<row r="${i + 1}">${r.map((v, j) => {
        const ref = col(j) + (i + 1), st = i === 0 ? ' s="1"' : '';
        if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
        if (v === '' || v == null) return `<c r="${ref}"${st}/>`;
        return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
      }).join('')}</row>`).join('');
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${w.map((x, j) => `<col min="${j + 1}" max="${j + 1}" width="${x}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData></worksheet>`;
    };
    const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    return zip([
      ['[Content_Types].xml', X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>'],
      ['_rels/.rels', X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', X + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ['xl/styles.xml', X + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF12365D"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
      ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)])
    ]);
  };

  // ---------- PDF (Helvetica, A4 landscape, tables) ----------
  const win = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, 'œ': 0x9c, 'Œ': 0x8c };
  const pdfStr = s => { let o = ''; for (const ch of String(s ?? '').replace(/[\r\n\t]+/g, ' ')) { let c = win[ch] ?? ch.charCodeAt(0); if (c > 255) c = 63; if (c === 40 || c === 41 || c === 92) o += '\\' + ch; else if (c < 32 || c > 126) o += '\\' + c.toString(8).padStart(3, '0'); else o += String.fromCharCode(c); } return o; };
  App.makePdf = (sheets, title) => {
    const PW = 842, PH = 595, M = 28, FS = 7.5, LH = 11, CW = FS * 0.5; // average glyph width of Helvetica ≈ 0.5 em
    const pages = []; let cur = null, y = 0;
    const newPage = () => { cur = []; pages.push(cur); y = PH - M; };
    const text = (x, yy, s, size = FS, bold = false, rgb = '0 0 0') => cur.push(`${rgb} rg BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(1)} ${yy.toFixed(1)} Td (${pdfStr(s)}) Tj ET`);
    const rect = (x, yy, w, h, rgb) => cur.push(`${rgb} rg ${x.toFixed(1)} ${yy.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`);
    newPage(); rect(0, PH - 58, PW, 58, '0.07 0.21 0.36'); text(M, PH - 30, 'CISPOLstore — ' + title, 16, true, '1 1 1'); text(M, PH - 46, 'Édité le ' + App.today() + ' · ' + (App.db.settings.company.name || 'CISPOLstore'), 9, false, '0.9 0.9 0.9'); y = PH - 80;
    for (const s of sheets) {
      const rows = s.rows, n = rows[0].length, avail = PW - 2 * M, len = [];
      for (let j = 0; j < n; j++) len[j] = Math.max(4, ...rows.slice(0, 400).map(r => Math.min(40, String(r[j] ?? '').length)));
      const tot = len.reduce((a, b) => a + b, 0), w = len.map(l => avail * l / tot);
      const cell = (v, j) => { const k = Math.max(1, Math.floor((w[j] - 6) / CW)), t = typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v ?? ''); return t.length > k ? t.slice(0, k - 1) + '…' : t; };
      const header = () => { rect(M, y - 3, avail, LH, '0.84 0.32 0.18'); let x = M; rows[0].forEach((v, j) => { text(x + 3, y, cell(v, j), FS, true, '1 1 1'); x += w[j]; }); y -= LH + 2; };
      if (y < 90) newPage();
      text(M, y, `${s.title} (${rows.length - 1})`, 12, true, '0.07 0.21 0.36'); y -= 18; header();
      if (rows.length === 1) { text(M + 3, y, 'Aucune donnée', FS, false, '0.4 0.4 0.4'); y -= LH + 14; continue; }
      rows.slice(1).forEach((r, i) => {
        if (y < M + LH) { newPage(); header(); }
        if (i % 2) rect(M, y - 3, avail, LH, '0.95 0.96 0.98');
        let x = M; r.forEach((v, j) => { text(x + 3, y, cell(v, j), FS); x += w[j]; }); y -= LH;
      });
      y -= 16;
    }
    // objects: 1 catalog, 2 pages, 3/4 fonts, then (page, content) pairs
    const objs = ['<</Type/Catalog/Pages 2 0 R>>', `<</Type/Pages/Kids[${pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}]/Count ${pages.length}>>`, '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>', '<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>'];
    pages.forEach((p, i) => {
      const lab = `Page ${i + 1} / ${pages.length}`; p.push(`0.4 0.4 0.4 rg BT /F1 7 Tf ${PW - M - 50} 14 Td (${lab}) Tj ET`);
      const body = p.join('\n'); objs.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${PW} ${PH}]/Resources<</Font<</F1 3 0 R/F2 4 0 R>>>>/Contents ${6 + i * 2} 0 R>>`, `<</Length ${body.length}>>\nstream\n${body}\nendstream`);
    });
    let out = '%PDF-1.4\n'; const off = [];
    objs.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xr = out.length; out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xr}\n%%EOF`;
    const u8 = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) u8[i] = out.charCodeAt(i) & 255; return u8;
  };
  App.reportSheets = () => Object.values(App.tables());
})();
