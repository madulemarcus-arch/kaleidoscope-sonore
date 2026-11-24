// Element library (tab "Éléments"): materials, section types of beams, columns, slabs, foundations, shear walls, masonry blocks and
// wall types, lintels, guard-rails and claustra. Types live in doc.lib; elements refer to them by id (sec / blk / rail ...).
// Everything here is modelling data: the structural calculation uses beam and column types as minimum sections.
(function () {
  const A = window.App, $ = id => document.getElementById(id), L = A.lib = {}, esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cm = v => Math.round(v * 1000) / 10, f2 = v => A.fmt(v, 2), r3 = v => Math.round(v * 1000) / 1000;

  // ---------- catalogues ----------
  // Masonry units: name, length L, height H, thickness e (m), kind, wall weight w (kN/m2 of wall, mortar included, without plaster), colour.
  A.BLOCKS = {
    bc10: ['Bloc béton creux 10', 0.40, 0.20, 0.10, 'creux', 1.4, [0.66, 0.66, 0.64]], bc15: ['Bloc béton creux 15 (parpaing)', 0.40, 0.20, 0.15, 'creux', 1.9, [0.66, 0.66, 0.64]], bc20: ['Bloc béton creux 20', 0.40, 0.20, 0.20, 'creux', 2.5, [0.66, 0.66, 0.64]],
    bc15l: ['Bloc béton creux 15 (50 × 20)', 0.50, 0.20, 0.15, 'creux', 1.9, [0.66, 0.66, 0.64]], bc20l: ['Bloc béton creux 20 (50 × 20)', 0.50, 0.20, 0.20, 'creux', 2.5, [0.66, 0.66, 0.64]],
    bp15: ['Bloc béton plein 15', 0.40, 0.20, 0.15, 'plein', 3.4, [0.60, 0.60, 0.60]], bp20: ['Bloc béton plein 20', 0.40, 0.20, 0.20, 'plein', 4.4, [0.60, 0.60, 0.60]],
    bcc10: ['Béton cellulaire 10', 0.60, 0.25, 0.10, 'cellulaire', 0.6, [0.86, 0.86, 0.84]], bcc20: ['Béton cellulaire 20', 0.60, 0.25, 0.20, 'cellulaire', 1.2, [0.86, 0.86, 0.84]],
    bcp: ['Brique cuite pleine 10,5', 0.22, 0.065, 0.105, 'plein', 1.9, [0.72, 0.36, 0.26]], bcr10: ['Brique creuse 8 trous 10', 0.50, 0.20, 0.10, 'creux', 0.9, [0.76, 0.42, 0.30]], bcr15: ['Brique creuse 12 trous 15', 0.50, 0.20, 0.15, 'creux', 1.2, [0.76, 0.42, 0.30]], bcr20: ['Brique creuse 20', 0.50, 0.20, 0.20, 'creux', 1.6, [0.76, 0.42, 0.30]],
    bmo30: ['Brique alvéolaire monomur 30', 0.50, 0.25, 0.30, 'alvéolaire', 2.1, [0.78, 0.50, 0.36]], btc: ['Bloc de terre comprimée (BTC)', 0.295, 0.09, 0.14, 'plein', 2.8, [0.66, 0.42, 0.28]],
    lat: ['Latérite taillée', 0.40, 0.20, 0.20, 'plein', 4.2, [0.62, 0.34, 0.22]], pier: ['Pierre taillée / moellon', 0.40, 0.20, 0.20, 'plein', 4.8, [0.62, 0.58, 0.52]] };
  const MATS = [['c20', 'Béton C20/25', 'beton', 20, 25, [0.64, 0.65, 0.66]], ['c25', 'Béton C25/30', 'beton', 25, 25, [0.62, 0.63, 0.65]], ['c30', 'Béton C30/37', 'beton', 30, 25, [0.58, 0.59, 0.61]],
    ['a500', 'Acier HA FeE500', 'acier', 500, 78.5, [0.45, 0.48, 0.52]], ['s235', 'Acier de charpente S235', 'acier', 235, 78.5, [0.40, 0.44, 0.50]], ['bois', 'Bois résineux C24', 'bois', 24, 4.2, [0.62, 0.45, 0.28]], ['boisd', 'Bois dur (iroko, azobé)', 'bois', 30, 8.0, [0.45, 0.30, 0.18]],
    ['verre', 'Verre feuilleté', 'verre', 0, 25, [0.60, 0.80, 0.92]], ['mac', 'Maçonnerie enduite', 'maconnerie', 0, 18, [0.92, 0.90, 0.85]]];
  const KINDS = { beton: 'Béton armé', acier: 'Acier', bois: 'Bois', verre: 'Verre', maconnerie: 'Maçonnerie' };
  L.KINDS = KINDS;
  const SEL = {
    shape: [['rect', 'Rectangulaire'], ['circ', 'Circulaire']], slabKind: [['pleine', 'Dalle pleine'], ['corpscreux', 'Plancher à corps creux'], ['nervure', 'Dalle nervurée']],
    footKind: [['isolee', 'Semelle isolée'], ['filante', 'Semelle filante'], ['radier', 'Radier nervuré']], railKind: [['barreaudage', 'Barreaudage vertical'], ['balustres', 'Balustres en béton'], ['lisses', 'Lisses horizontales'], ['verre', 'Verre'], ['plein', 'Garde-corps plein (acrotère)']],
    motif: [['damier', 'Damier'], ['barreaux', 'Barreaux verticaux'], ['croix', 'Croisillons']] };
  // Families: label, fields [key, label, type, options], default section, short name
  const FAM = {
    beam: { n: 'Poutres', f: [['n', 'Nom', 'text'], ['b', 'Base b (cm)', 'cm'], ['h', 'Hauteur h (cm)', 'cm'], ['mat', 'Matériau', 'mat']], defs: [{ b: 0.20, h: 0.30 }, { b: 0.20, h: 0.35 }, { b: 0.25, h: 0.40 }, { b: 0.30, h: 0.50 }], mk: { b: 0.2, h: 0.35, mat: 'c25' }, nm: s => `Poutre ${cm(s.b)} × ${cm(s.h)}` },
    col: { n: 'Poteaux', f: [['n', 'Nom', 'text'], ['shape', 'Forme', 'sel', 'shape'], ['b', 'Côté a ou Ø (cm)', 'cm'], ['h', 'Côté b (cm)', 'cm'], ['mat', 'Matériau', 'mat']], defs: [{ shape: 'rect', b: 0.20, h: 0.20 }, { shape: 'rect', b: 0.25, h: 0.25 }, { shape: 'rect', b: 0.30, h: 0.30 }, { shape: 'circ', b: 0.30, h: 0.30 }], mk: { shape: 'rect', b: 0.25, h: 0.25, mat: 'c25' }, nm: s => s.shape === 'circ' ? `Poteau Ø${cm(s.b)}` : `Poteau ${cm(s.b)} × ${cm(s.h)}` },
    slab: { n: 'Dalles et planchers', f: [['n', 'Nom', 'text'], ['kind', 'Type', 'sel', 'slabKind'], ['e', 'Épaisseur (cm)', 'cm'], ['fixed', 'Imposée au calcul', 'bool'], ['mat', 'Matériau', 'mat']], defs: [{ kind: 'pleine', e: 0.12 }, { kind: 'pleine', e: 0.15 }, { kind: 'corpscreux', e: 0.20 }], mk: { kind: 'pleine', e: 0.15, fixed: false, mat: 'c25' }, nm: s => `${(SEL.slabKind.find(k => k[0] === s.kind) || [0, 'Dalle'])[1]} ${cm(s.e)}` },
    foot: { n: 'Fondations', f: [['n', 'Nom', 'text'], ['kind', 'Type', 'sel', 'footKind'], ['b', 'Largeur imposée (cm, 0 = auto)', 'cm'], ['mat', 'Matériau', 'mat']], defs: [{ kind: 'isolee', b: 0 }, { kind: 'filante', b: 0 }, { kind: 'radier', b: 0 }], mk: { kind: 'isolee', b: 0, mat: 'c25' }, nm: s => (SEL.footKind.find(k => k[0] === s.kind) || [0, 'Fondation'])[1] + (s.b ? ' ' + cm(s.b) : ' (auto)') },
    voile: { n: 'Voiles', f: [['n', 'Nom', 'text'], ['e', 'Épaisseur (cm)', 'cm'], ['mat', 'Matériau', 'mat']], defs: [{ e: 0.15 }, { e: 0.20 }, { e: 0.25 }], mk: { e: 0.2, mat: 'c25' }, nm: s => `Voile e = ${cm(s.e)}` },
    wall: { n: 'Murs (blocs et briques)', f: [['n', 'Nom', 'text'], ['blk', 'Bloc', 'blk'], ['ens', 'Enduit par face (cm)', 'cm'], ['joint', 'Joint (cm)', 'cm'], ['lint', 'Linteaux', 'bool']], defs: [{ blk: 'bc15', ens: 0.015, joint: 0.01, lint: true }, { blk: 'bc20', ens: 0.015, joint: 0.01, lint: true }, { blk: 'bcr15', ens: 0.015, joint: 0.01, lint: true }, { blk: 'bcp', ens: 0.015, joint: 0.01, lint: true }, { blk: 'btc', ens: 0, joint: 0.01, lint: true }], mk: { blk: 'bc15', ens: 0.015, joint: 0.01, lint: true }, nm: s => 'Mur ' + ((L.block(s.blk) || { n: 'bloc' }).n) },
    lintel: { n: 'Linteaux', f: [['n', 'Nom', 'text'], ['h', 'Hauteur (cm)', 'cm'], ['app', 'Appui de chaque côté (cm)', 'cm'], ['mat', 'Matériau', 'mat']], defs: [{ h: 0.20, app: 0.25 }, { h: 0.25, app: 0.30 }], mk: { h: 0.2, app: 0.25, mat: 'c25' }, nm: s => `Linteau h = ${cm(s.h)}, appui ${cm(s.app)}` },
    rail: { n: 'Garde-corps et balustrades', f: [['n', 'Nom', 'text'], ['kind', 'Type', 'sel', 'railKind'], ['h', 'Hauteur (cm)', 'cm'], ['esp', 'Vide entre barres (cm)', 'cm'], ['sec', 'Barre (mm)', 'mm'], ['post', 'Entraxe poteaux (cm)', 'cm'], ['mat', 'Matériau', 'mat']], defs: [{ kind: 'barreaudage', h: 1.0, esp: 0.11, sec: 0.016, post: 1.2, mat: 's235' }, { kind: 'balustres', h: 1.0, esp: 0.11, sec: 0.06, post: 1.5, mat: 'c25' }, { kind: 'lisses', h: 1.0, esp: 0.11, sec: 0.02, post: 1.2, mat: 'a500' }, { kind: 'verre', h: 1.0, esp: 0, sec: 0.012, post: 1.5, mat: 'verre' }, { kind: 'plein', h: 1.0, esp: 0, sec: 0.15, post: 0, mat: 'c25' }], mk: { kind: 'barreaudage', h: 1.0, esp: 0.11, sec: 0.016, post: 1.2, mat: 's235' }, nm: s => (SEL.railKind.find(k => k[0] === s.kind) || [0, 'Garde-corps'])[1] },
    claustra: { n: 'Claustras', f: [['n', 'Nom', 'text'], ['motif', 'Motif', 'sel', 'motif'], ['mod', 'Module (cm)', 'cm'], ['e', 'Épaisseur (cm)', 'cm'], ['mat', 'Matériau', 'mat']], defs: [{ motif: 'damier', mod: 0.20, e: 0.10 }, { motif: 'barreaux', mod: 0.10, e: 0.10 }, { motif: 'croix', mod: 0.20, e: 0.10 }], mk: { motif: 'damier', mod: 0.2, e: 0.1, mat: 'mac' }, nm: s => `Claustra ${(SEL.motif.find(k => k[0] === s.motif) || [0, ''])[1].toLowerCase()} ${cm(s.mod)}` } };
  L.FAM = FAM;
  A.libFix = d => { const lib = d.lib = d.lib || {};
    lib.mat = lib.mat && lib.mat.length ? lib.mat : MATS.map(([id, n, k, fc, rho, c]) => ({ id, n, k, fc, rho, c }));
    lib.sec = lib.sec || []; lib.blk = lib.blk || []; lib.act = lib.act || {};
    Object.keys(FAM).forEach(k => { if (!lib.sec.some(s => s.f === k)) FAM[k].defs.forEach((x, i) => { const s = Object.assign({ id: k + (i + 1), f: k }, FAM[k].mk, x); s.n = FAM[k].nm(s); lib.sec.push(s); });
      if (!(k in lib.act) || (lib.act[k] && !lib.sec.some(s => s.id === lib.act[k]))) lib.act[k] = k === 'wall' ? '' : (lib.sec.find(s => s.f === k) || {}).id; });
    return d; };

  // ---------- lookups ----------
  L.sec = id => A.doc.lib.sec.find(s => s.id === id) || null;
  L.mat = id => A.doc.lib.mat.find(m => m.id === id) || { id, n: 'Béton', k: 'beton', fc: 25, rho: 25, c: [0.62, 0.63, 0.65] };
  L.active = f => L.sec(A.doc.lib.act[f]);
  L.block = id => { const c = ((A.doc && A.doc.lib && A.doc.lib.blk) || []).find(b => b.id === id); if (c) return c; const b = A.BLOCKS[id]; return b ? { id, n: b[0], L: b[1], H: b[2], e: b[3], k: b[4], w: b[5], c: b[6] } : null; };
  L.blocks = () => Object.keys(A.BLOCKS).map(L.block).concat(A.doc.lib.blk);
  L.color = id => L.mat(id).c;
  // Wall type -> unit and thickness of the finished wall (block + plaster on both faces)
  L.wallType = w => { const s = w.wt ? L.sec(w.wt) : null; return s && L.block(s.blk) ? { s, b: L.block(s.blk) } : null; };
  L.wallThickness = s => { const b = L.block(s.blk); return b ? r3(b.e + 2 * (s.ens || 0)) : 0.2; };
  // Section minima handed to the structural calculation (beams: b, h; columns: equivalent square side)
  L.colSide = c => { const d = A.colDims(c); return d.shape === 'circ' ? d.b * Math.sqrt(Math.PI) / 2 : Math.sqrt(d.b * d.h); };

  // ---------- quantities (all levels) ----------
  L.quantities = () => { const q = { blocks: {}, lintels: { n: 0, len: 0, vol: 0 }, rails: { len: 0, n: 0 }, claustra: { area: 0, n: 0 }, voiles: { len: 0, vol: 0, area: 0 }, plaster: 0, walls: 0 };
    for (let lv = 0; lv < A.nLevels(); lv++) A.withLevel(lv, () => A.doc.items.filter(A.shown).forEach(it => {
      if (it.t === 'wall') { const wt = L.wallType(it), len = A.dist(it.a, it.b), ops = A.openings(it); let area = len * it.h; ops.forEach(o => { area -= o.w * Math.min(o.h, it.h - o.sill); }); area = Math.max(0, area); q.walls++;
        if (wt) { const b = wt.b, j = wt.s.joint || 0.01, unit = (b.L + j) * (b.H + j), n = Math.ceil(area / unit * 1.05), mortar = area * b.e * (1 - b.L * b.H / unit), o = q.blocks[b.id] = q.blocks[b.id] || { b, area: 0, n: 0, mortar: 0, plaster: 0, w: 0 }; o.area += area; o.n += n; o.mortar += mortar; const pl = area * 2 * (wt.s.ens > 0 ? 1 : 0); o.plaster += pl; q.plaster += pl; o.w += area * b.w;
          if (wt.s.lint !== false) { const ls = L.active('lintel'); ops.filter(o => o.t !== 'claustra' || true).forEach(o => { const lw = o.w + 2 * (ls ? ls.app : 0.25); q.lintels.n++; q.lintels.len += lw; q.lintels.vol += lw * b.e * (ls ? ls.h : 0.2); }); } } }
      else if (it.t === 'rail') { q.rails.n++; q.rails.len += A.dist(it.a, it.b); }
      else if (it.t === 'voile') { const len = A.dist(it.a, it.b), h = it.h || A.doc.defaults.h; q.voiles.len += len; q.voiles.area += len * h; q.voiles.vol += len * h * it.th; }
      else if (it.t === 'claustra') { q.claustra.n++; q.claustra.area += it.w * it.h; } }));
    return q; };

  // ---------- editing the library ----------
  L.setActive = (f, id) => A.edit(d => { d.lib.act[f] = id; if (f === 'foot') { const s = d.lib.sec.find(x => x.id === id); if (s) d.struct.p.found = { isolee: 'isolees', filante: 'filantes', radier: 'radier' }[s.kind] || 'auto'; } });
  L.add = f => A.edit(d => { const s = Object.assign({ id: f + A.uid(), f }, FAM[f].mk); s.n = FAM[f].nm(s); d.lib.sec.push(s); d.lib.act[f] = s.id; });
  L.remove = id => A.edit(d => { const s = d.lib.sec.find(x => x.id === id); if (!s || d.lib.sec.filter(x => x.f === s.f).length < 2) return; d.lib.sec = d.lib.sec.filter(x => x.id !== id); if (d.lib.act[s.f] === id) d.lib.act[s.f] = s.f === 'wall' ? '' : d.lib.sec.find(x => x.f === s.f).id;
    d.items.forEach(i => { if (i.sec === id) delete i.sec; if (i.wt === id) delete i.wt; if (i.rt === id) delete i.rt; if (i.ct === id) delete i.ct; }); });
  L.update = (id, k, v) => A.edit(d => { const s = d.lib.sec.find(x => x.id === id); if (!s) return; s[k] = v; if (FAM[s.f].nm && k !== 'n') { /* keep a custom name */ if (!s.custom) s.n = FAM[s.f].nm(s); } if (k === 'n') s.custom = true;
    if (s.f === 'wall') d.items.forEach(w => { if (w.t === 'wall' && w.wt === id) w.th = L.wallThicknessIn(d, s); });
    if (s.f === 'voile') d.items.forEach(w => { if (w.t === 'voile' && w.rt === id) w.th = s.e; }); });
  L.wallThicknessIn = (d, s) => { const o = A.doc; A.doc = d; try { return L.wallThickness(s); } finally { A.doc = o; } };
  // wall / voile / rail / column / beam created with the active type
  L.walls = {};
  A.applyWallType = (w, id) => { const s = id ? L.sec(id) : null; if (!s) { delete w.wt; return; } w.wt = id; w.th = L.wallThickness(s); };

  // ---------- previews (SVG) ----------
  const T = (x, y, s, a = 'middle', c = 'currentColor', z = 11) => `<text x="${x}" y="${y}" font-size="${z}" text-anchor="${a}" fill="${c}">${s}</text>`;
  const R = (x, y, w, h, fill, st = 'currentColor', sw = 1) => `<rect x="${x}" y="${y}" width="${Math.max(0, w)}" height="${Math.max(0, h)}" fill="${fill}" stroke="${st}" stroke-width="${sw}"/>`;
  const Ln = (x1, y1, x2, y2, c = 'currentColor', sw = 1, extra = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${sw}" ${extra}/>`;
  const dimH = (x1, x2, y, s) => Ln(x1, y, x2, y, '#e5b044', 1) + Ln(x1, y - 4, x1, y + 4, '#e5b044') + Ln(x2, y - 4, x2, y + 4, '#e5b044') + T((x1 + x2) / 2, y - 5, s, 'middle', '#e5b044');
  const dimV = (x, y1, y2, s) => Ln(x, y1, x, y2, '#e5b044', 1) + Ln(x - 4, y1, x + 4, y1, '#e5b044') + Ln(x - 4, y2, x + 4, y2, '#e5b044') + T(x - 6, (y1 + y2) / 2 + 4, s, 'end', '#e5b044');
  const rgb = c => `rgb(${c.map(v => Math.round(v * 255)).join(',')})`;
  const svg = (w, h, body) => `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px;color:var(--ink)" role="img">${body}</svg>`;
  const hatch = '<defs><pattern id="ph" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#8fa0bb" stroke-width="1"/></pattern></defs>';
  L.preview = {
    beam: s => { const k = 180 / Math.max(s.b, s.h, 0.3), w = s.b * k, h = s.h * k, x = 120 - w / 2, y = 24; return svg(260, h + 60, R(x, y, w, h, rgb(L.color(s.mat))) + dimH(x, x + w, y + h + 20, cm(s.b) + ' cm') + dimV(x - 14, y, y + h, cm(s.h) + ' cm') + T(130, h + 52, L.mat(s.mat).n, 'middle', '#8fa0bb')); },
    col: s => { const k = 160 / Math.max(s.b, s.h, 0.3), w = s.b * k, h = (s.shape === 'circ' ? s.b : s.h) * k, x = 120 - w / 2, y = 24, sh = s.shape === 'circ' ? `<circle cx="120" cy="${y + h / 2}" r="${w / 2}" fill="${rgb(L.color(s.mat))}" stroke="currentColor"/>` : R(x, y, w, h, rgb(L.color(s.mat)));
      return svg(260, h + 60, sh + dimH(x, x + w, y + h + 20, (s.shape === 'circ' ? 'Ø ' : '') + cm(s.b) + ' cm') + (s.shape === 'circ' ? '' : dimV(x - 14, y, y + h, cm(s.h) + ' cm')) + T(130, h + 52, L.mat(s.mat).n, 'middle', '#8fa0bb')); },
    slab: s => { const k = 300 / 100, t = Math.max(6, s.e * 100 * 2.2); let b = hatch + R(10, 40, 240, t, rgb(L.color(s.mat)));
      if (s.kind === 'corpscreux') { const tt = 4 * 2.2; b = hatch + R(10, 40, 240, tt, rgb(L.color(s.mat))); for (let i = 0; i < 4; i++) b += R(20 + i * 58, 40 + tt, 44, t - tt, '#b9744f') + R(10 + i * 58 + 0, 40 + tt, 10, t - tt, rgb(L.color(s.mat))); }
      if (s.kind === 'nervure') { const tt = 6 * 2.2; b = hatch + R(10, 40, 240, tt, rgb(L.color(s.mat))); for (let i = 0; i < 4; i++) b += R(20 + i * 58, 40 + tt, 14, t - tt, rgb(L.color(s.mat))); }
      return svg(260, t + 90, b + dimV(8, 40, 40 + t, cm(s.e) + ' cm') + T(130, 40 + t + 40, 'Coupe sur 1 m', 'middle', '#8fa0bb')); },
    foot: s => { const k = s.kind, base = '<line x1="10" y1="60" x2="250" y2="60" stroke="currentColor" stroke-width="1.6"/>' + T(12, 54, 'T.N.', 'start', '#8fa0bb', 10);
      if (k === 'radier') return svg(260, 150, hatch + base + R(10, 60, 240, 80, 'url(#ph)', 'none') + R(30, 100, 200, 26, rgb(L.color(s.mat))) + [60, 130, 200].map(x => R(x - 7, 78, 14, 22, rgb(L.color(s.mat)))).join('') + [60, 130, 200].map(x => R(x - 9, 40, 18, 38, '#fff', 'currentColor', 0.8)).join('') + T(130, 142, 'Radier nervuré sous les poteaux', 'middle', '#8fa0bb'));
      const w = k === 'filante' ? 220 : 100, x = 130 - w / 2; return svg(260, 150, hatch + base + R(10, 60, 240, 80, 'url(#ph)', 'none') + R(x, 100, w, 26, rgb(L.color(s.mat))) + R(110, 60, 40, 40, rgb(L.color(s.mat))) + R(104, 126, 52, 5, '#f6f6f6', 'currentColor', 0.8) + T(130, 144, k === 'filante' ? 'Semelle filante' : 'Semelle isolée' + (s.b ? ' ' + cm(s.b) + ' cm' : ' (dimensions calculées)'), 'middle', '#8fa0bb')); },
    voile: s => { const t = Math.max(8, s.e * 100 * 2.4); return svg(260, t + 80, hatch + R(10, 30, 240, t, 'url(#ph)', 'currentColor', 1.2) + dimV(8, 30, 30 + t, cm(s.e) + ' cm') + T(130, 30 + t + 34, 'Voile en béton armé, vue en plan', 'middle', '#8fa0bb')); },
    wall: s => { const b = L.block(s.blk); if (!b) return svg(260, 60, T(130, 30, 'Mur courant (épaisseur libre)', 'middle', '#8fa0bb')); const j = s.joint || 0.01, k = Math.min(48 / b.H, 120 / b.L / 1.4, 260), sc = 150 / 1.6, cw = (b.L + j) * sc, ch = (b.H + j) * sc, W = 150, H = 100; let body = '';
      for (let r = 0; r * ch < H; r++) for (let c = -1; c * cw < W; c++) { const x = c * cw + (r % 2 ? cw / 2 : 0), y = H - (r + 1) * ch; body += R(Math.max(x, 0) + 90, Math.max(y, 0) + 20, Math.min(x + cw - j * sc, W) - Math.max(x, 0), Math.min(ch - j * sc, y + ch - Math.max(y, 0)), rgb(b.c), '#444', 0.5); }
      const bx = 14, by = 40, bw = 56, bh = Math.max(8, 56 * b.H / b.L);
      return svg(260, 150, R(bx, by, bw, bh, rgb(b.c)) + dimH(bx, bx + bw, by + bh + 16, cm(b.L) + ' cm') + dimV(bx - 4, by, by + bh, cm(b.H) + ' cm') + T(bx + bw / 2, by - 6, 'e = ' + cm(b.e) + ' cm', 'middle', '#e5b044') + body + T(165, 140, 'Appareillage à joints décalés', 'middle', '#8fa0bb') + T(14, 112, b.k, 'start', '#8fa0bb', 10) + T(14, 126, f2(1 / ((b.L + j) * (b.H + j))) + ' blocs/m²', 'start', '#8fa0bb', 10)); },
    lintel: s => svg(260, 150, R(10, 20, 240, 110, '#d9cdb6', 'currentColor', 1) + R(80, 60, 100, 70, '#0e1420', 'currentColor', 1) + R(80 - s.app * 100 * 0.8, 60 - s.h * 100 * 1.2, 100 + 2 * s.app * 100 * 0.8, s.h * 100 * 1.2, rgb(L.color(s.mat)), 'currentColor', 1.2) + dimV(8, 60 - s.h * 120, 60, cm(s.h) + ' cm') + dimH(80 - s.app * 80, 80, 140, 'appui ' + cm(s.app))),
    rail: s => { const h = Math.min(100, s.h * 100), y0 = 120, W = 240, n = s.kind === 'plein' ? 0 : Math.max(1, Math.floor(W / Math.max(10, s.esp * 100 * 3))); let b = Ln(10, y0, 250, y0, 'currentColor', 1.6) + R(10, y0 - h, 240, 4, rgb(L.color(s.mat)));
      if (s.kind === 'plein') b += R(10, y0 - h, 240, h, rgb(L.color(s.mat))); else if (s.kind === 'verre') b += R(10, y0 - h + 4, 240, h - 4, 'rgba(150,200,235,.35)') ; else if (s.kind === 'lisses') for (let i = 1; i < 5; i++) b += Ln(10, y0 - h + 4 + i * (h - 4) / 5, 250, y0 - h + 4 + i * (h - 4) / 5, rgb(L.color(s.mat)), 2); else for (let i = 0; i <= n; i++) b += Ln(10 + i * W / n, y0 - h + 4, 10 + i * W / n, y0, rgb(L.color(s.mat)), s.kind === 'balustres' ? 5 : 2);
      if (s.post) for (let x = 10; x <= 250; x += Math.max(40, s.post * 100 * 0.8)) b += R(x - 3, y0 - h, 6, h, rgb(L.color(s.mat))); return svg(260, 160, b + dimV(8, y0 - h, y0, cm(s.h) + ' cm') + (s.esp ? T(130, 148, 'vide entre barres ' + cm(s.esp) + ' cm' + (s.esp > 0.11 ? ' (> 11 cm : non conforme)' : ''), 'middle', s.esp > 0.11 ? '#ff8a5c' : '#8fa0bb', 10) : '') + T(130, 12, s.h < 1 ? 'Hauteur < 1,00 m : non conforme' : '', 'middle', '#ff8a5c', 10)); },
    claustra: s => { const m = Math.max(10, s.mod * 100 * 1.6), nx = Math.floor(220 / m), ny = Math.floor(100 / m); let b = ''; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const x = 20 + i * m, y = 20 + j * m, on = s.motif === 'damier' ? (i + j) % 2 === 0 : s.motif === 'barreaux' ? i % 2 === 0 : (i + j) % 3 !== 0; if (on) b += R(x, y, m, m, rgb(L.color(s.mat)), '#555', 0.6); }
      return svg(260, 150, b + dimH(20, 20 + m, 142, cm(s.mod) + ' cm') + T(180, 142, 'e = ' + cm(s.e) + ' cm', 'middle', '#8fa0bb')); } };

  // ---------- the tab ----------
  const box = $('lib'); let cur = 'mat', selRow = {};
  const NAV = [['mat', 'Matériaux'], ['beam', 'Poutres'], ['col', 'Poteaux'], ['slab', 'Dalles et planchers'], ['foot', 'Fondations'], ['voile', 'Voiles'], ['wall', 'Murs (blocs, briques)'], ['blk', 'Catalogue de blocs'], ['lintel', 'Linteaux'], ['rail', 'Garde-corps'], ['claustra', 'Claustras'], ['qty', 'Métré maçonnerie']];
  const matOpts = (id, kinds) => A.doc.lib.mat.filter(m => !kinds || kinds.includes(m.k)).map(m => `<option value="${m.id}"${m.id === id ? ' selected' : ''}>${esc(m.n)}</option>`).join('');
  const cell = (s, fd) => { const [k, , t, o] = fd, v = s[k], id = `data-id="${s.id}" data-k="${k}"`;
    if (t === 'text') return `<input ${id} value="${esc(v || '')}" aria-label="Nom">`;
    if (t === 'cm') return `<input type="number" step="0.5" min="0" ${id} value="${cm(v || 0)}"${k === 'h' && s.shape === 'circ' ? ' disabled' : ''}>`;
    if (t === 'mm') return `<input type="number" step="1" min="0" ${id} value="${Math.round((v || 0) * 1000)}">`;
    if (t === 'bool') return `<input type="checkbox" ${id}${v ? ' checked' : ''}>`;
    if (t === 'sel') return `<select ${id}>${SEL[o].map(([a, n]) => `<option value="${a}"${a === v ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
    if (t === 'blk') return `<select ${id}>${L.blocks().map(b => `<option value="${b.id}"${b.id === v ? ' selected' : ''}>${esc(b.n)} — ${cm(b.L)}×${cm(b.H)}×${cm(b.e)}</option>`).join('')}</select>`;
    if (t === 'mat') return `<select ${id}>${matOpts(v)}</select>`; return ''; };
  const famView = f => { const F = FAM[f], list = A.doc.lib.sec.filter(s => s.f === f), act = A.doc.lib.act[f], sel = L.sec(selRow[f]) || L.sec(act) || list[0];
    const head = '<th>Actif</th>' + F.f.map(x => `<th>${x[1]}</th>`).join('') + '<th></th>';
    const rows = list.map(s => `<tr class="${s.id === sel.id ? 'sel' : ''}" data-row="${s.id}"><td><input type="radio" name="act-${f}" data-act="${s.id}"${s.id === act ? ' checked' : ''} aria-label="Type actif"></td>${F.f.map(x => `<td>${cell(s, x)}</td>`).join('')}<td><button data-del="${s.id}" title="Supprimer" aria-label="Supprimer"${list.length < 2 ? ' disabled' : ''}>✕</button></td></tr>`).join('');
    const notes = { beam: 'Le type actif sert aux nouvelles poutres. Au calcul, la section d\'une poutre n\'est jamais inférieure à son type.', col: 'Le type actif sert aux nouveaux poteaux. Au calcul, un poteau rectangulaire ou circulaire est traité en section carrée équivalente de même aire, jamais plus petite que son type.',
      slab: 'Cochez « Imposée au calcul » pour que l\'épaisseur du type soit un minimum du dimensionnement des dalles.', foot: 'Le type actif choisit le mode de fondation du calcul (semelles isolées, filantes ou radier). Une largeur non nulle impose une largeur minimale aux semelles isolées.',
      voile: 'Les voiles sont modélisés (plan, 3D, métré) ; leur contribution au contreventement n\'est pas encore prise en compte dans le calcul.', wall: 'Le type actif sert aux nouveaux murs : l\'épaisseur du mur est celle du bloc plus l\'enduit sur chaque face. Les linteaux se posent au-dessus des ouvertures.',
      lintel: 'Le type actif sert à tous les linteaux des murs en blocs.', rail: 'Normes courantes : hauteur au moins 1,00 m, vide entre barres au plus 11 cm.', claustra: 'Le claustra se pose comme une fenêtre (outil Claustra) dans un mur.' };
    return `<h2>${F.n}</h2><div class="libgrid"><div><table class="libt"><tr>${head}</tr>${rows}</table><button class="wide" data-new="${f}">+ Nouveau type</button><p class="muted">${notes[f] || ''}</p></div><div class="libprev">${L.preview[f] ? L.preview[f](sel) : ''}</div></div>`; };
  const matView = () => { const rows = A.doc.lib.mat.map(m => `<tr><td><input data-m="${m.id}" data-k="n" value="${esc(m.n)}"></td><td><select data-m="${m.id}" data-k="k">${Object.keys(KINDS).map(k => `<option value="${k}"${k === m.k ? ' selected' : ''}>${KINDS[k]}</option>`).join('')}</select></td><td><input type="number" data-m="${m.id}" data-k="fc" value="${m.fc}" title="fc28 (MPa) pour le béton, fe ou fy pour l'acier"></td><td><input type="number" step="0.5" data-m="${m.id}" data-k="rho" value="${m.rho}"></td><td><input type="color" data-m="${m.id}" data-k="c" value="#${m.c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}"></td></tr>`).join('');
    return `<h2>Matériaux</h2><table class="libt"><tr><th>Nom</th><th>Famille</th><th>fc28 / fe (MPa)</th><th>Poids volumique (kN/m³)</th><th>Couleur 3D</th></tr>${rows}</table><button class="wide" data-newmat="1">+ Matériau</button><p class="muted">Les matériaux servent aux poutres, poteaux, dalles, fondations, voiles, linteaux, garde-corps et claustras. Le calcul au BAEL ne traite que le béton armé : un élément en acier ou en bois est modélisé mais signalé comme non dimensionné.</p>`; };
  const blkView = () => { const rows = L.blocks().map(b => { const custom = A.doc.lib.blk.some(x => x.id === b.id); return `<tr><td>${esc(b.n)}</td><td>${cm(b.L)} × ${cm(b.H)} × ${cm(b.e)}</td><td>${b.k}</td><td>${f2(b.w)}</td><td>${f2(1 / ((b.L + 0.01) * (b.H + 0.01)))}</td><td>${custom ? `<button data-delblk="${b.id}" aria-label="Supprimer">✕</button>` : ''}</td></tr>`; }).join('');
    return `<h2>Catalogue de blocs et de briques</h2><table class="libt"><tr><th>Bloc</th><th>L × H × e (cm)</th><th>Type</th><th>Poids du mur (kN/m²)</th><th>Blocs par m² (joint 1 cm)</th><th></th></tr>${rows}</table>
      <h2>Ajouter un bloc personnalisé</h2><div class="libform"><input id="nbN" placeholder="Nom"><input id="nbL" type="number" placeholder="L (cm)"><input id="nbH" type="number" placeholder="H (cm)"><input id="nbE" type="number" placeholder="e (cm)"><input id="nbW" type="number" step="0.1" placeholder="kN/m²"><button data-addblk="1">Ajouter</button></div><p class="muted">L = longueur, H = hauteur, e = épaisseur du bloc. Exemple : bloc de 15 → 40 × 20 × 15 (longueur 40 cm, hauteur 20 cm, épaisseur 15 cm).</p>`; };
  const qtyView = () => { const q = L.quantities(), rows = Object.values(q.blocks).map(o => `<tr><td>${esc(o.b.n)}</td><td>${f2(o.area)}</td><td>${o.n}</td><td>${f2(o.mortar)}</td><td>${f2(o.plaster)}</td><td>${f2(o.w)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Aucun mur en blocs : choisissez un type de mur actif puis dessinez (ou sélectionnez un mur et choisissez son type).</td></tr>';
    return `<h2>Métré de maçonnerie (tous niveaux)</h2><table class="libt"><tr><th>Bloc</th><th>Surface nette (m²)</th><th>Nombre de blocs (+5 %)</th><th>Mortier (m³)</th><th>Enduit (m²)</th><th>Poids des murs (kN)</th></tr>${rows}</table>
      <table class="libt"><tr><th>Ouvrage</th><th>Quantité</th><th>Détail</th></tr><tr><td>Linteaux</td><td>${q.lintels.n}</td><td>${f2(q.lintels.len)} m linéaires, béton ${f2(q.lintels.vol)} m³</td></tr><tr><td>Garde-corps</td><td>${q.rails.n}</td><td>${f2(q.rails.len)} m</td></tr><tr><td>Claustras</td><td>${q.claustra.n}</td><td>${f2(q.claustra.area)} m²</td></tr><tr><td>Voiles</td><td>${f2(q.voiles.len)} m</td><td>${f2(q.voiles.area)} m², béton ${f2(q.voiles.vol)} m³</td></tr></table>
      <p class="muted">Quantités par niveau puis cumulées (les éléments « tous niveaux » comptent à chaque étage). Nombre de blocs = surface nette / (L + joint)(H + joint) majoré de 5 % pour les chutes ; mortier = volume des joints.</p>`; };
  L.render = () => { if (!box || A.mode !== 'elem') return; const nav = $('libNav'), main = $('libMain');
    nav.innerHTML = NAV.map(([k, n]) => `<button data-nav="${k}" class="${k === cur ? 'on' : ''}">${n}</button>`).join('') + '<button data-go="stairs">Escalier →</button>';
    main.innerHTML = cur === 'mat' ? matView() : cur === 'blk' ? blkView() : cur === 'qty' ? qtyView() : famView(cur); };
  if (box) {
    box.addEventListener('click', e => { const t = e.target.closest('button,tr[data-row],input[data-act]'); if (!t) return; const d = t.dataset;
      if (d.nav) { cur = d.nav; L.render(); } else if (d.go) A.setMode('stairs'); else if (d.new) L.add(d.new); else if (d.del) L.remove(d.del); else if (d.act) L.setActive(cur, d.act);
      else if (d.newmat) A.edit(dd => { dd.lib.mat.push({ id: 'm' + A.uid(), n: 'Nouveau matériau', k: 'beton', fc: 25, rho: 25, c: [0.6, 0.6, 0.6] }); });
      else if (d.delblk) A.edit(dd => { dd.lib.blk = dd.lib.blk.filter(b => b.id !== d.delblk); });
      else if (d.addblk) { const g = id => $(id).value, Lc = parseFloat(g('nbL')) / 100, Hc = parseFloat(g('nbH')) / 100, Ec = parseFloat(g('nbE')) / 100; if (g('nbN').trim() && Lc > 0 && Hc > 0 && Ec > 0) A.edit(dd => { dd.lib.blk.push({ id: 'x' + A.uid(), n: g('nbN').trim(), L: Lc, H: Hc, e: Ec, k: 'plein', w: parseFloat(g('nbW')) || 2, c: [0.7, 0.6, 0.5] }); }); }
      else if (d.row && !e.target.closest('input,select,button')) { selRow[cur] = d.row; L.render(); } });
    box.addEventListener('change', e => { const t = e.target, d = t.dataset;
      if (d.m) { A.edit(dd => { const m = dd.lib.mat.find(x => x.id === d.m); if (!m) return; if (d.k === 'c') m.c = [1, 3, 5].map(i => parseInt(t.value.slice(i, i + 2), 16) / 255); else if (d.k === 'n' || d.k === 'k') m[d.k] = t.value; else m[d.k] = parseFloat(t.value) || 0; }); return; }
      if (!d.id) return; const s = L.sec(d.id); if (!s) return; const fd = FAM[s.f].f.find(x => x[0] === d.k); let v = t.value;
      if (fd[2] === 'cm') v = Math.max(0, (parseFloat(v) || 0) / 100); else if (fd[2] === 'mm') v = Math.max(0, (parseFloat(v) || 0) / 1000); else if (fd[2] === 'bool') v = t.checked;
      selRow[s.f] = s.id; L.update(d.id, d.k, v); });
  }
  A.on(L.render);
  L.go = k => { cur = k; L.render(); };

  // ---------- properties of the selected elements (called by the Properties panel) ----------
  const sels = (box, label, opts, val, set) => { const r = document.createElement('label'); r.className = 'row'; r.innerHTML = `<span>${label}</span>`; const s = document.createElement('select'); s.innerHTML = opts; s.value = val || ''; s.onchange = () => set(s.value); r.appendChild(s); box.appendChild(r); };
  const note = (box, text, warn) => { const p = document.createElement('p'); p.className = 'muted'; if (warn) p.style.color = '#ff8a5c'; p.textContent = text; box.appendChild(p); };
  const typeOpts = (f, none) => (none ? `<option value="">${none}</option>` : '') + A.doc.lib.sec.filter(s => s.f === f).map(s => `<option value="${s.id}">${esc(s.n)}</option>`).join('');
  L.props = (box, sel, field) => { const one = sel.length === 1 ? sel[0] : null, upd = (it, fn) => A.edit(d => fn(d.items.find(i => i.id === it.id)));
    if (one) {
      if (one.t === 'wall') { sels(box, 'Type de mur', typeOpts('wall', 'Mur libre'), one.wt, v => upd(one, x => A.applyWallType(x, v)));
        const wt = L.wallType(one); if (wt) { const len = A.dist(one.a, one.b), ops = A.openings(one); let area = len * one.h; ops.forEach(o => { area -= o.w * Math.min(o.h, one.h - o.sill); }); area = Math.max(0, area); const j = wt.s.joint || 0.01, n = Math.ceil(area / ((wt.b.L + j) * (wt.b.H + j)) * 1.05);
          note(box, `${wt.b.n} : ${cm(wt.b.L)} × ${cm(wt.b.H)} × ${cm(wt.b.e)} cm, enduit ${cm(wt.s.ens)} cm par face. Surface nette ${f2(area)} m², environ ${n} blocs, ${ops.length} linteau(x).`); } }
      if (one.t === 'col') sels(box, 'Type de poteau', typeOpts('col', 'Section libre'), one.sec, v => upd(one, x => { if (v) { x.sec = v; x.a = r3(L.colSide(Object.assign({}, x, { sec: v }))); } else delete x.sec; }));
      if (one.t === 'beam') sels(box, 'Type de poutre', typeOpts('beam', 'Calculée'), one.sec, v => upd(one, x => { if (v) x.sec = v; else delete x.sec; }));
      if (one.t === 'voile') { sels(box, 'Type de voile', typeOpts('voile'), one.rt, v => upd(one, x => { x.rt = v; x.th = L.sec(v).e; })); box.appendChild(field('Hauteur (m)', one.h || A.doc.defaults.h, 0.05, (v, d) => { d.items.find(i => i.id === one.id).h = v; })); note(box, 'Longueur : ' + A.fmt(A.dist(one.a, one.b)) + ' m, épaisseur ' + cm(one.th) + ' cm'); }
      if (one.t === 'rail') { sels(box, 'Type de garde-corps', typeOpts('rail'), one.rt, v => upd(one, x => { x.rt = v; })); const s = L.sec(one.rt); if (s) { if (s.h < 1) note(box, 'Hauteur de ' + cm(s.h) + ' cm : au moins 1,00 m exigé.', true); if (s.esp > 0.11) note(box, 'Vide de ' + cm(s.esp) + ' cm entre barres : 11 cm au plus exigé.', true); note(box, 'Longueur : ' + A.fmt(A.dist(one.a, one.b)) + ' m'); } }
      if (one.t === 'stair') { const c = A.stairs.calcItem(one); note(box, `${(A.stairs.KINDS.find(k => k[0] === (one.par || {}).kind) || [0, 'Escalier'])[1]} : ${c.n} contremarches de ${f2(c.hr * 100)} cm, giron ${cm((one.par || {}).g || 0.28)} cm, emmarchement ${cm((one.par || {}).w || 1)} cm.`); c.msgs.filter(m => m[0] === 'warn').forEach(m => note(box, m[1], true));
        const b = document.createElement('button'); b.className = 'wide'; b.textContent = 'Modifier dans l\'onglet Escalier'; b.onclick = () => A.stairs.edit(one.id); box.appendChild(b); }
      if (one.t === 'claustra') sels(box, 'Type de claustra', typeOpts('claustra'), one.ct, v => upd(one, x => { x.ct = v; })); }
    if (A.nLevels() > 1) { const d = document.createElement('div'); d.className = 'lvbox'; d.innerHTML = '<span>Niveaux</span>' + Array.from({ length: A.nLevels() }, (_, i) => `<label><input type="checkbox" data-lv="${i}"${sel.every(x => A.atLevel(x, i)) ? ' checked' : ''}> ${A.levelName(i)}</label>`).join('');
      d.onchange = e => { const i = +e.target.dataset.lv, on = e.target.checked; A.edit(dd => sel.forEach(s => { const x = dd.items.find(q => q.id === s.id); if (!x) return; const all = Array.from({ length: A.nLevels() }, (_, k) => k), cur = x.lv ? x.lv.slice() : all, nx = on ? [...new Set([...cur, i])].sort() : cur.filter(k => k !== i); if (!nx.length) return; if (nx.length === all.length) delete x.lv; else x.lv = nx; })); };
      box.appendChild(d); }
  };
  // active types, shown when nothing is selected
  L.activeProps = box => { [['wall', 'Mur', 'Mur libre'], ['beam', 'Poutre', null], ['col', 'Poteau', null], ['voile', 'Voile', null], ['rail', 'Garde-corps', null], ['claustra', 'Claustra', null]].forEach(([f, n, none]) => sels(box, n, typeOpts(f, none), A.doc.lib.act[f], v => L.setActive(f, v))); };
})();
