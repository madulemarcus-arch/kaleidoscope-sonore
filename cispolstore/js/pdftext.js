// Minimal PDF text reader (no library): enough for the invoices Starlink attaches to its e-mails (Flate streams, Type0/Identity-H fonts with a ToUnicode map).
// App.pdfText(bytes) -> Promise<string>, one line per text row, columns of a row separated by two spaces.
(() => {
  'use strict';
  const App = window.App;
  const inflate1 = async u8 => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  // the end-of-line before "endstream" is not part of the data but cannot be told apart from its last byte: try without it
  const inflate = async u8 => { for (let cut = 0; ; cut++) { try { return await inflate1(cut ? u8.subarray(0, u8.length - cut) : u8); } catch (e) { if (cut >= 2) throw e; } } };
  const hex16 = h => { let s = ''; for (let i = 0; i + 3 < h.length + 1; i += 4) s += String.fromCharCode(parseInt(h.substr(i, 4), 16)); return s; };
  // ToUnicode CMap: code -> text
  const parseCmap = t => {
    const m = new Map(), H = '([0-9A-Fa-f]+)';
    for (const b of t.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const x of b[1].matchAll(new RegExp(`<${H}>\\s*<${H}>`, 'g'))) m.set(parseInt(x[1], 16), hex16(x[2]));
    for (const b of t.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const x of b[1].matchAll(new RegExp(`<${H}>\\s*<${H}>\\s*(?:<${H}>|\\[([^\\]]*)\\])`, 'g'))) {
        const lo = parseInt(x[1], 16), hi = parseInt(x[2], 16);
        if (x[4] !== undefined) [...x[4].matchAll(new RegExp(`<${H}>`, 'g'))].forEach((d, i) => m.set(lo + i, hex16(d[1])));
        else { const d = hex16(x[3]); for (let c = lo; c <= hi; c++) m.set(c, d.slice(0, -1) + String.fromCharCode(d.charCodeAt(d.length - 1) + c - lo)); }
      }
    }
    return m;
  };
  const unesc = s => s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, c) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' }[c] || (/^[0-7]+$/.test(c) ? String.fromCharCode(parseInt(c, 8)) : c)));
  // content stream -> [{ y, text }] (one per text object / baseline)
  const readContent = (src, fonts) => {
    const out = [], re = /\/([^\s/<>()[\]]+)|<([0-9A-Fa-f\s]*)>|\(((?:\\[\s\S]|[^\\()])*)\)|(\[)|(\])|(-?\d*\.?\d+)|([A-Za-z*'"]+)/g;
    let st = [], font = null, a = 1, d = 1, e = 0, f = 0, lx = 0, ly = 0, cur = null, arr = null;
    const show = parts => {
      let txt = '';
      parts.forEach(p => { if (typeof p === 'number') return; if (p.h !== undefined) { const h = p.h.replace(/\s/g, ''), w = font && font.wide ? 4 : 2; for (let i = 0; i < h.length; i += w) { const c = parseInt(h.substr(i, w), 16); txt += font && font.map.has(c) ? font.map.get(c) : String.fromCharCode(c); } } else for (const ch of unesc(p.s)) txt += font && font.map.has(ch.charCodeAt(0)) ? font.map.get(ch.charCodeAt(0)) : ch; });
      const y = Math.round((f + d * ly) * 10) / 10;
      if (cur && Math.abs(cur.y - y) < 1) cur.text += txt; else out.push(cur = { y, text: txt });
    };
    let m; while ((m = re.exec(src))) {
      if (m[1] !== undefined) st.push({ n: m[1] });
      else if (m[2] !== undefined) (arr || st).push({ h: m[2] });
      else if (m[3] !== undefined) (arr || st).push({ s: m[3] });
      else if (m[4]) arr = [];
      else if (m[5]) { st.push({ a: arr }); arr = null; }
      else if (m[6] !== undefined) (arr || st).push(+m[6]);
      else if (m[7]) {
        const op = m[7], nums = st.filter(x => typeof x === 'number');
        if (op === 'BT') { a = 1; d = 1; e = 0; f = 0; lx = 0; ly = 0; cur = null; }
        else if (op === 'ET') cur = null;
        else if (op === 'Tf') { const n = st.find(x => x.n !== undefined); font = n && fonts[n.n] || null; }
        else if (op === 'Tm' && nums.length >= 6) { [a, , , d, e, f] = nums.slice(-6); lx = 0; ly = 0; }
        else if ((op === 'Td' || op === 'TD') && nums.length >= 2) { lx += nums[nums.length - 2]; ly += nums[nums.length - 1]; }
        else if (op === 'Tj' || op === "'" || op === '"') { const s = st.filter(x => x.h !== undefined || x.s !== undefined); if (s.length) show([s[s.length - 1]]); }
        else if (op === 'TJ') { const s = st.find(x => x.a); if (s) show(s.a); }
        st = [];
      }
    }
    return out;
  };
  App.pdfText = async bytes => {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), s = Array.from({ length: Math.ceil(u8.length / 8192) }, (_, i) => String.fromCharCode.apply(null, u8.subarray(i * 8192, i * 8192 + 8192))).join('');
    const objs = {};
    for (const m of s.matchAll(/(\d+)\s+0\s+obj([\s\S]*?)endobj/g)) {
      const body = m[2], i = body.indexOf('stream'); let dict = body, data = null;
      if (i >= 0) { dict = body.slice(0, i); const a = m.index + m[0].indexOf('stream', m[1].length) + 6, st = u8[a] === 13 ? a + 2 : a + 1, en = s.lastIndexOf('endstream', m.index + m[0].length); data = u8.subarray(st, Math.max(st, en)); }
      objs[m[1]] = { dict, data };
    }
    const dec = async n => { const o = objs[n]; if (!o || !o.data) return ''; try { const b = /FlateDecode/.test(o.dict) ? await inflate(o.data) : o.data; return Array.from(b, c => String.fromCharCode(c)).join(''); } catch (e) { return ''; } };
    const refs = t => [...String(t).matchAll(/(\d+)\s+0\s+R/g)].map(x => x[1]);
    const fontOf = async ref => {
      const o = objs[ref]; if (!o) return { map: new Map() };
      const tu = /\/ToUnicode\s+(\d+)\s+0\s+R/.exec(o.dict);
      return { map: tu ? parseCmap(await dec(tu[1])) : new Map(), wide: /Identity-H/.test(o.dict) };
    };
    const lines = [];
    for (const [id, o] of Object.entries(objs)) {
      if (!/\/Type\s*\/Page(?![s\w])/.test(o.dict)) continue;
      let res = o.dict; const r = /\/Resources\s+(\d+)\s+0\s+R/.exec(o.dict); if (r && objs[r[1]]) res = objs[r[1]].dict;
      const fd = /\/Font\s*(?:(\d+)\s+0\s+R|<<([^>]*)>>)/.exec(res), fonts = {};
      if (fd) { const txt = fd[2] !== undefined ? fd[2] : objs[fd[1]] ? objs[fd[1]].dict : ''; for (const x of txt.matchAll(/\/([^\s/<>]+)\s+(\d+)\s+0\s+R/g)) fonts[x[1]] = await fontOf(x[2]); }
      const c = /\/Contents\s*(\[[^\]]*\]|\d+\s+0\s+R)/.exec(o.dict);
      for (const ref of c ? refs(c[1]) : []) lines.push(...readContent(await dec(ref), fonts));
    }
    // same baseline = same row (columns of a table, label and value)
    const rows = []; lines.filter(l => l.text.trim()).forEach(l => { const p = rows[rows.length - 1]; if (p && p.y === l.y) p.text += '  ' + l.text.trim(); else rows.push({ y: l.y, text: l.text.trim() }); });
    return rows.map(r => r.text).join('\n');
  };
})();
