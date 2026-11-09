// Excel (.xlsx) and CSV writers without any library: a minimal zip (stored, no compression) of the OOXML parts.
(function () {
  const App = window.App, te = new TextEncoder();
  const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = u8 => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = crcT[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const zip = files => {
    const parts = [], cd = []; let off = 0;
    const u16 = n => [n & 255, n >> 8 & 255], u32 = n => [n & 255, n >> 8 & 255, n >> 16 & 255, n >>> 24 & 255];
    for (const [name, str] of Object.entries(files)) {
      const nm = te.encode(name), data = te.encode(str), c = crc(data);
      parts.push(new Uint8Array([0x50, 0x4b, 3, 4, 20, 0, 0, 8, 0, 0, 0, 0, 0, 0, ...u32(c), ...u32(data.length), ...u32(data.length), ...u16(nm.length), 0, 0]), nm, data);
      cd.push(new Uint8Array([0x50, 0x4b, 1, 2, 20, 0, 20, 0, 0, 8, 0, 0, 0, 0, 0, 0, ...u32(c), ...u32(data.length), ...u32(data.length), ...u16(nm.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(off)]), nm);
      off += 30 + nm.length + data.length;
    }
    const cdLen = cd.reduce((a, x) => a + x.length, 0), n = cd.length / 2;
    return new Blob([...parts, ...cd, new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(n), ...u16(n), ...u32(cdLen), ...u32(off), 0, 0])], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const col = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
  const sheetXml = rows => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + rows.map((r, i) => '<row r="' + (i + 1) + '">' + r.map((v, j) => v == null || v === '' ? '' : typeof v === 'number' && isFinite(v) ? '<c r="' + col(j) + (i + 1) + '"><v>' + v + '</v></c>' : '<c r="' + col(j) + (i + 1) + '" t="inlineStr"' + (i === 0 ? ' s="1"' : '') + '><is><t xml:space="preserve">' + esc(v) + '</t></is></c>').join('') + '</row>').join('') + '</sheetData></worksheet>';
  // sheets: [{name, rows: [[header...], [..]]}]
  App.xlsx = sheets => {
    const n = sheets.length, files = {
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>',
      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((s, i) => '<sheet name="' + esc(s.name).slice(0, 31) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (n + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>'
    };
    sheets.forEach((s, i) => files['xl/worksheets/sheet' + (i + 1) + '.xml'] = sheetXml(s.rows));
    return zip(files);
  };
  // CSV with ';' separator and a BOM so Excel opens accents correctly
  App.csv = rows => '﻿' + rows.map(r => r.map(v => { v = v == null ? '' : String(v); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';')).join('\r\n');
  App.saveFile = (name, data, type) => { const b = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); };
})();
