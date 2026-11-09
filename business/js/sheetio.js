// Spreadsheet input: .xlsx reader (zip + XML, no library, nothing leaves the device) and CSV reader. Adapted from CISPOLstore Manager.
(function () {
  'use strict';
  const App = window.App, td = new TextDecoder();
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

  const inflate = async u8 => { const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(u8); w.close(); return new Uint8Array(await new Response(ds.readable).arrayBuffer()); };
  const unzip = async buf => {
    const u8 = new Uint8Array(buf), dv = new DataView(buf); let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('zip'); const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const files = {};
    for (let i = 0; i < n && dv.getUint32(p, true) === 0x02014b50; i++) {
      const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      files[td.decode(u8.subarray(p + 46, p + 46 + nl))] = { m: dv.getUint16(p + 10, true), cs: dv.getUint32(p + 20, true), lh: dv.getUint32(p + 42, true) }; p += 46 + nl + el + cl;
    }
    return async name => { const f = files[name]; if (!f) return null; const o = f.lh + 30 + dv.getUint16(f.lh + 26, true) + dv.getUint16(f.lh + 28, true), d = u8.subarray(o, o + f.cs); return td.decode(f.m === 0 ? d : await inflate(d)); };
  };
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const colIdx = ref => { let n = 0; for (const ch of ref.replace(/[^A-Z]/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const serialToIso = n => new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000).toISOString().slice(0, 10);
  const readXlsx = async buf => {
    const read = await unzip(buf), wb = xml(await read('xl/workbook.xml')), rels = xml(await read('xl/_rels/workbook.xml.rels'));
    const target = {}; [...rels.getElementsByTagName('Relationship')].forEach(r => { target[r.getAttribute('Id')] = r.getAttribute('Target'); });
    const ss = []; const sx = await read('xl/sharedStrings.xml'); if (sx) [...xml(sx).getElementsByTagName('si')].forEach(si => ss.push([...si.getElementsByTagName('t')].map(t => t.textContent).join('')));
    // which cell styles are dates
    const dateXf = []; const st = await read('xl/styles.xml');
    if (st) { const d = xml(st), fm = {}; [...d.getElementsByTagName('numFmt')].forEach(f => { fm[f.getAttribute('numFmtId')] = f.getAttribute('formatCode'); });
      const xfs = d.getElementsByTagName('cellXfs')[0]; if (xfs) [...xfs.getElementsByTagName('xf')].forEach(x => { const id = +x.getAttribute('numFmtId'); const code = (fm[id] || '').replace(/"[^"]*"|\[[^\]]*\]|\\./g, ''); dateXf.push((id >= 14 && id <= 22) || (id >= 45 && id <= 47) || (id >= 164 && /[dmyh]/i.test(code) && !/^general$/i.test(code))); }); }
    const sheets = [];
    for (const s of [...wb.getElementsByTagName('sheet')]) {
      const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'); let t = target[rid] || ''; t = t.startsWith('/') ? t.slice(1) : 'xl/' + t;
      const sx2 = await read(t); if (!sx2) continue; const rows = [];
      [...xml(sx2).getElementsByTagName('row')].forEach(r => { const row = []; [...r.getElementsByTagName('c')].forEach(c => {
        const i = colIdx(c.getAttribute('r') || 'A1'), ty = c.getAttribute('t'), v = c.getElementsByTagName('v')[0], is = c.getElementsByTagName('is')[0]; let val = null;
        if (ty === 's' && v) val = ss[+v.textContent]; else if (ty === 'inlineStr' && is) val = [...is.getElementsByTagName('t')].map(x => x.textContent).join(''); else if (ty === 'str' && v) val = v.textContent;
        else if (v && ty !== 'e' && ty !== 'b') { const n = parseFloat(v.textContent); val = Number.isFinite(n) ? (dateXf[+c.getAttribute('s')] ? { iso: serialToIso(n) } : n) : v.textContent; }
        row[i] = val; }); rows[+r.getAttribute('r') - 1] = row; });
      sheets.push({ name: s.getAttribute('name'), rows: Array.from(rows, r => r || []) });
    }
    return sheets;
  };
  const readCsv = text => {
    const first = text.split(/\r?\n/)[0] || '', d = [';', '\t', ','].map(c => [c, first.split(c).length]).sort((a, b) => b[1] - a[1])[0][0], rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) { const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true; else if (ch === d) { row.push(cur); cur = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += ch; }
    if (cur || row.length) { row.push(cur); rows.push(row); } return [{ name: 'CSV', rows: rows.map(r => r.map(c => c === '' ? null : c)) }];
  };

  // ---------- reading the table ----------
  App.sheetio = { readXlsx, readCsv, norm, unzip, xml };
})();
