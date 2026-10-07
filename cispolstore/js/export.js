// Readable exports built without any library: shared tables and a real .xlsx workbook (zip, no compression).
(() => {
  'use strict';
  const App = window.App, esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ---------- Tables (shared by CSV, Excel) ----------
  App.tables = () => {
    const db = App.db;
    return {
      clients: { title: 'Clients', rows: [['Code', 'Type', 'Prénom', 'Nom', 'Téléphone', 'Adresse', 'ACC', 'N° série', 'Kit', 'Abonnement', 'Début', 'Fin', 'Fin sursis', 'Statut'], ...db.clients.map(c => { const s = App.sub(c); return [c.code, App.TYPES[c.type], c.first, c.last, c.phone, c.address, c.acc, c.serial, c.kit, c.plan, s ? s.start : '', s ? s.end : '', s ? s.gEnd : '', s ? App.STATUS[s.status][0] : '']; })] },
      factures: { title: 'Factures', rows: [['Numéro', 'Date', 'Client', 'Type', 'Devise', 'Total', 'Payé', 'Solde'], ...db.invoices.map(i => [i.number, i.date, App.cname(App.client(i.clientId)), App.invTypes[i.type], i.currency, App.invTotal(i), App.invPaid(i), App.invDue(i)])] },
      paiements: { title: 'Paiements', rows: [['Date', 'Client', 'Facture', 'Montant', 'Devise', 'Mode', 'Référence', 'Commentaire'], ...db.payments.map(p => [p.date, App.cname(App.client(p.clientId)), (App.invoice(p.invoiceId) || {}).number || '', p.amount, p.currency, p.mode, p.ref, p.comment])] },
      penalites: { title: 'Pénalités', rows: [['Date', 'Client', 'Motif', 'Montant', 'Devise', 'Part Starlink', 'Statut', 'Payée le', 'Mode', 'Note'], ...db.penalties.map(p => [p.date, App.cname(App.client(p.clientId)), p.reason, p.amount, p.currency, p.cost, p.paid ? 'Payée' : 'À payer', p.paid || '', p.mode || '', p.note])] },
      livraisons: { title: 'Livraisons', rows: [['Date', 'Client', 'À livrer', 'Adresse', 'Livreur', 'Statut', 'Livrée le', 'Encaissé'], ...db.deliveries.map(d => [d.date, App.cname(App.client(d.clientId)), d.items, d.address, d.driverName, { todo: 'À livrer', route: 'En route', done: 'Livrée', failed: 'Échec' }[d.status], d.doneAt || '', d.collected || ''])] },
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

  App.reportSheets = () => Object.values(App.tables());
})();
