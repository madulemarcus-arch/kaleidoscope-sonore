// Import / export: JSON project, DXF (millimetres), PNG, and file helpers.
(function () {
  const A = window.App;
  const download = (name, blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  A.download = download;
  const base = () => (A.doc.name || 'plan').replace(/[^\w\-À-ÿ ]+/g, '').trim().replace(/\s+/g, '-') || 'plan';
  A.exportJSON = () => download(base() + '.archi.json', new Blob([JSON.stringify(A.doc, null, 1)], { type: 'application/json' }));
  A.importJSON = text => { const d = JSON.parse(text); if (!A.valid(d)) throw new Error('Fichier non reconnu'); if (!d.layers.some(l => l.id === d.active)) d.active = d.layers[0].id; d.defaults = d.defaults || { th: 0.2, h: 2.8 }; A.setDoc(d); };

  // ---------- DXF (R12 ASCII, 1 unit = 1 mm) ----------
  const ascii = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?');
  const lname = l => ascii(l.name).replace(/[^A-Za-z0-9_$-]/g, '_').toUpperCase() || 'CALQUE';
  A.toDXF = () => {
    const out = [], g = (c, v) => out.push(String(c), String(v)), mm = v => Math.round(v * 1000 * 100) / 100, doc = A.doc;
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, doc.layers.length);
    doc.layers.forEach(l => { g(0, 'LAYER'); g(2, lname(l)); g(70, 0); g(62, 7); g(6, 'CONTINUOUS'); }); g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    const line = (a, b, ly) => { if (A.dist(a, b) < 1e-6) return; g(0, 'LINE'); g(8, ly); g(10, mm(a[0])); g(20, mm(a[1])); g(30, 0); g(11, mm(b[0])); g(21, mm(b[1])); g(31, 0); };
    const text = (s, p, h, ly, ang) => { g(0, 'TEXT'); g(8, ly); g(10, mm(p[0])); g(20, mm(p[1])); g(30, 0); g(40, mm(h)); g(1, ascii(s)); if (ang) g(50, Math.round(ang * 100) / 100); };
    doc.items.filter(A.shown).forEach(it => { const l = A.layer(it.layer) || doc.layers[0], ly = lname(l);
      if (it.t === 'line') line(it.a, it.b, ly);
      else if (it.t === 'wall') { const w = A.wallGeom(it), ops = A.openings(it).map(o => [A.openPos(o, it) - o.w / 2, A.openPos(o, it) + o.w / 2]).sort((x, y) => x[0] - y[0]);
        const at = (s, k) => [it.a[0] + w.u[0] * s + w.n[0] * k, it.a[1] + w.u[1] * s + w.n[1] * k], s0 = -w.ea, s1 = w.len + w.eb; let cur = s0;
        const faces = (x, y) => { line(at(x, w.h), at(y, w.h), ly); line(at(x, -w.h), at(y, -w.h), ly); };
        ops.forEach(o => { if (o[0] > cur) faces(cur, o[0]); line(at(o[0], w.h), at(o[0], -w.h), ly); line(at(o[1], w.h), at(o[1], -w.h), ly); cur = Math.max(cur, o[1]); });
        if (s1 > cur) faces(cur, s1); if (!w.ea) line(at(s0, w.h), at(s0, -w.h), ly); if (!w.eb) line(at(s1, w.h), at(s1, -w.h), ly); }
      else if (it.t === 'dim') { const d = A.dimGeom(it); line(it.a, d.a2, ly); line(it.b, d.b2, ly); line(d.a2, d.b2, ly);
        let ang = Math.atan2(d.u[1], d.u[0]) * 180 / Math.PI; text(A.fmt(d.len) + ' m', [(d.a2[0] + d.b2[0]) / 2 + d.n[0] * 0.05, (d.a2[1] + d.b2[1]) / 2 + d.n[1] * 0.05], 0.15, ly, ang); }
      else if (it.t === 'text') text(it.s, it.p, it.size, ly);
    });
    g(0, 'ENDSEC'); g(0, 'EOF'); return out.join('\n') + '\n';
  };
  A.exportDXF = () => download(base() + '.dxf', new Blob([A.toDXF()], { type: 'application/dxf' }));

  // ---------- PNG (white background, black ink, whole drawing) ----------
  A.exportPNG = () => {
    const b = A.bounds(); if (!b) return false; const m = 0.6, w = b.x1 - b.x0 + 2 * m, h = b.y1 - b.y0 + 2 * m, s = Math.min(2400 / Math.max(w, h), 400);
    const cv = document.createElement('canvas'); cv.width = Math.ceil(w * s); cv.height = Math.ceil(h * s);
    const v = { s, ox: (m - b.x0) * s, oy: (b.y1 + m) * s }; A.render(cv.getContext('2d'), cv.width, cv.height, v, 'print', {});
    cv.toBlob(bl => download(base() + '.png', bl), 'image/png'); return true;
  };
})();
