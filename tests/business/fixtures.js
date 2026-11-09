// Fictitious data only (no real customers). Builds CSV and a minimal .xlsx (zip written by hand, deflate) for the import tests.
const zlib = require('zlib');
const FIRST = ['Alice', 'Bernard', 'Chantal', 'David', 'Esther', 'Fabrice', 'Gisèle', 'Hervé', 'Irène', 'Jules', 'Kevin', 'Lydie', 'Michel', 'Nadine', 'Olivier'];
exports.people = (n = 30) => Array.from({ length: n }, (_, i) => ({ name: FIRST[i % FIRST.length] + ' Test' + String(i + 1).padStart(3, '0'), phone: '08' + String(10000000 + i * 37).padStart(8, '0'), email: 'test' + (i + 1) + '@example.test', type: i % 3 ? 'Particulier' : 'Entreprise', ville: 'Ville' + (i % 4) }));
exports.csv = (n = 30, sep = ';') => ['Nom', 'Téléphone', 'Courriel', 'Type', 'Ville'].join(sep) + '\n' + exports.people(n).map(p => [p.name, p.phone, p.email, p.type, p.ville].join(sep)).join('\n');
exports.csvFile = (n, name = 'clients-test.csv') => ({ name, mimeType: 'text/csv', buffer: Buffer.from(exports.csv(n)) });
const crc = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
const zip = files => {
  const parts = [], cd = []; let off = 0;
  for (const [name, str] of Object.entries(files)) {
    const raw = Buffer.from(str), def = zlib.deflateRawSync(raw), nm = Buffer.from(name), h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(8, 8); h.writeUInt32LE(crc(raw), 14); h.writeUInt32LE(def.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(nm.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10); c.writeUInt32LE(crc(raw), 16); c.writeUInt32LE(def.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    parts.push(h, nm, def); cd.push(c, nm); off += 30 + nm.length + def.length;
  }
  const cdb = Buffer.concat(cd), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(cd.length / 2, 8); e.writeUInt16LE(cd.length / 2, 10); e.writeUInt32LE(cdb.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cdb, e]);
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
exports.xlsxFile = (n = 10, name = 'clients-test.xlsx') => {
  const rows = [['Nom', 'Téléphone', 'Courriel', 'Type', 'Ville'], ...exports.people(n).map(p => [p.name, p.phone, p.email, p.type, p.ville])];
  const sheet = '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + rows.map((r, i) => '<row r="' + (i + 1) + '">' + r.map((v, j) => '<c r="' + String.fromCharCode(65 + j) + (i + 1) + '" t="inlineStr"><is><t>' + esc(v) + '</t></is></c>').join('') + '</row>').join('') + '</sheetData></worksheet>';
  const buffer = zip({ '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>', 'xl/workbook.xml': '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Clients" sheetId="1" r:id="rId1"/></sheets></workbook>', 'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>', 'xl/worksheets/sheet1.xml': sheet });
  return { name, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer };
};
