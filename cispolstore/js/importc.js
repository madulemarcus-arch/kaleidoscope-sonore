// Import clients from an Excel (.xlsx) or CSV file: read the columns, show a preview, then add everyone at once (with an "Annuler" bar).
// The .xlsx is read in the browser without any library (zip + XML), so nothing leaves the device.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc;
  const td = new TextDecoder();
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

  // ---------- .xlsx reader ----------
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
  const FIELDS = [['name', 'Nom du client', ['nom', 'colonne1', 'client', 'name', 'noms']], ['acc', 'Compte Starlink (ACC)', ['acc', 'compte']], ['phone', 'Téléphone', ['telephone', 'tel', 'phone', 'mobile', 'gsm']], ['plan', 'Abonnement', ['abonnement', 'formule', 'plan', 'forfait']], ['start', 'Date de paiement / début', ['date de paiement', 'paiement', 'debut', 'date debut']], ['end', "Date d'expiration / fin", ['expiration', 'fin', 'echeance']], ['balance', 'Solde dû', ['solde', 'reste', 'du']], ['ref', 'Référence', ['reference', 'ref']], ['obs', 'Observation', ['observation', 'remarque', 'etat']], ['num', 'N° (ordre)', ['n', 'no', 'num', 'numero']]];
  const im = { sheets: null, si: 0, hdr: 0, map: {}, prices: {}, skipDup: true, name: '', err: '' };
  const cellText = c => c == null ? '' : typeof c === 'object' ? c.iso : String(c).trim();
  const headerRow = rows => { const i = rows.findIndex(r => r.filter(c => typeof c === 'string' && c.trim()).length >= 3); return i < 0 ? 0 : i; };
  const autoMap = headers => {
    const map = {}, used = new Set();
    FIELDS.forEach(([k, , keys]) => { const n = headers.map(norm); let at = -1;
      for (const key of keys) { at = n.findIndex((h, i) => !used.has(i) && (h === key || h.split(' ').includes(key) || (key.length > 3 && h.includes(key)))); if (at >= 0) break; }
      if (at >= 0) { map[k] = at; used.add(at); } });
    return map;
  };
  const sheet = () => im.sheets && im.sheets[im.si];
  const setSheet = i => { im.si = i; const s = sheet(); im.hdr = headerRow(s.rows); im.map = autoMap((s.rows[im.hdr] || []).map(cellText)); im.prices = {}; };
  const toIso = c => { if (c == null || c === '') return ''; if (typeof c === 'object') return c.iso; const s = String(c).trim(); let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`; m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/); if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; } return ''; };
  const num = c => { if (typeof c === 'number') return c; const s = String(c == null ? '' : c).replace(/[\s ]/g, '').replace(/[A-Za-z$]+/g, '').replace(',', '.'); const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };
  const fixName = s => { s = s.replace(/\s+/g, ' ').trim(); return s === s.toUpperCase() || s === s.toLowerCase() ? s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()) : s; };
  const fixPhone = c => { let d = String(c == null ? '' : c).replace(/\D/g, ''); if (d.length === 12 && d.startsWith('243')) d = '0' + d.slice(3); else if (d.length === 9 && /^[89]/.test(d)) d = '0' + d; return d; };
  const planName = s => { const n = norm(s); if (!n) return ''; if (/^(illimite|ilimite|illimited|unlimited)/.test(n)) return 'Illimité'; if (/^bloqu/.test(n)) return ''; const m = n.match(/^(\d+) ?(go|gb)$/); if (m) return m[1] + ' Go'; return s.trim().replace(/^./, x => x.toUpperCase()); };

  // everything the preview and the import need, computed from the current sheet and mapping
  const analyse = () => {
    const s = sheet(), S = App.db.settings, M = im.map, rows = s.rows.slice(im.hdr + 1), get = (r, k) => M[k] == null ? null : r[M[k]];
    const have = new Map(App.db.clients.filter(c => c.acc).map(c => [String(c.acc).trim().toUpperCase(), c]));
    const out = { recs: [], n: 0, noName: 0, known: 0, merged: 0, sameName: 0, noSub: 0, oddDates: 0, plans: {}, balances: 0 }, seen = new Map();
    rows.forEach(r => {
      const raw = cellText(get(r, 'name')); if (!raw) { if (r.some(c => c != null && c !== '')) out.noName++; return; }
      out.n++;
      const acc = cellText(get(r, 'acc')).toUpperCase(), start = toIso(get(r, 'start')), end = toIso(get(r, 'end')), obs = cellText(get(r, 'obs')), bal = num(get(r, 'balance'));
      let plan = planName(cellText(get(r, 'plan'))), period = S.period, odd = false;
      let st0 = start; if (start && end) { const d = App.diff(start, end); if (d >= 1 && d <= 400) period = d; else { odd = true; st0 = App.addDays(end, -S.period); } }
      const name = fixName(raw), parts = name.split(' '), blocked = /^bloqu/.test(norm(cellText(get(r, 'plan')))) || /bloqu/.test(norm(obs)) || /desactiv/.test(norm(obs));
      const notes = []; if (blocked) notes.push('Starlink : compte désactivé ou bloqué'); if (bal > 0) notes.push(`Solde dû à l'import : ${App.fmt(bal, 'CDF')}`); if (odd) notes.push(`Dates à vérifier : début ${start} et fin ${end} incohérents, début recalculé`); const num0 = cellText(get(r, 'num')); if (num0) notes.push(`N° Excel : ${num0}`);
      const rec = { num: parseFloat(num0) || 1e9, first: parts[0], last: parts.slice(1).join(' '), name, phone: fixPhone(get(r, 'phone')), acc, plan, start: st0, period, ref: cellText(get(r, 'ref')), notes, hasSub: !!st0, bal, odd };
      if (rec.hasSub && !plan) rec.plan = '';
      if (acc && seen.has(acc)) { const o = seen.get(acc); if (rec.hasSub && !o.hasSub) { out.recs[out.recs.indexOf(o)] = rec; seen.set(acc, rec); } out.merged++; return; }
      if (acc) seen.set(acc, rec);
      if (acc && have.has(acc)) { rec.exists = true; out.known++; }
      out.recs.push(rec);
    });
    const names = new Map(); out.recs.forEach(r => { const k = norm(r.name); names.set(k, (names.get(k) || 0) + 1); }); out.recs.forEach(r => { if (names.get(norm(r.name)) > 1) { r.same = true; } }); out.sameName = out.recs.filter(r => r.same).length;
    out.recs.forEach(r => { if (!r.hasSub) out.noSub++; if (r.odd) out.oddDates++; if (r.bal > 0) out.balances++; if (r.plan) { const p = out.plans[r.plan] = out.plans[r.plan] || { n: 0, bal: [] }; p.n++; if (r.bal > 0) p.bal.push(r.bal); } });
    const rate = App.rate();
    Object.entries(out.plans).forEach(([k, p]) => { const ex = (S.plans || {})[k]; p.exists = !!ex; const m = p.bal.slice().sort((a, b) => a - b)[Math.floor(p.bal.length / 2)]; p.guess = ex ? ex.price : m ? Math.round(m / rate * 2) / 2 : 0; });
    out.todo = out.recs.filter(r => !(im.skipDup && r.exists));
    return out;
  };

  // ---------- screen ----------
  App.views.importc = () => {
    const back = { title: 'Importer des clients', sub: 'Excel (.xlsx) ou CSV', back: 'settings', nav: 'more' };
    const pick = `<div class="card"><p style="margin-top:0">Choisissez votre fichier de clients : l'application lit les colonnes, vous montre un aperçu, puis ajoute tout le monde d'un coup. Rien n'est créé avant votre confirmation, et vous pourrez annuler juste après.</p><label class="btn" style="cursor:pointer;display:inline-block">📄 Choisir le fichier<input type="file" id="im_file" accept=".xlsx,.csv,.txt" hidden></label>${im.err ? `<p class="bad" style="margin-bottom:0">${esc(im.err)}</p>` : ''}</div>`;
    if (!im.sheets) return { ...back, html: pick, after: bind };
    const s = sheet(), heads = (s.rows[im.hdr] || []).map(cellText), a = analyse();
    const opts = k => `<option value="">— aucune —</option>${heads.map((h, i) => h ? `<option value="${i}" ${im.map[k] === i ? 'selected' : ''}>${esc(h)}</option>` : '').join('')}`;
    const mapUi = FIELDS.map(([k, t]) => `<div class="fld"><label class="l">${t}</label><select data-imk="${k}">${opts(k)}</select></div>`).join('');
    const plans = Object.entries(a.plans).map(([k, p]) => `<div class="item"><div class="grow"><b>${esc(k)}</b><small>${p.n} client(s)${p.exists ? ' · formule déjà dans l\'application' : ' · nouvelle formule'}</small></div><div style="width:130px"><label class="l" style="margin:0">Prix ($/mois)</label><input type="number" inputmode="decimal" min="0" step="any" data-imp="${esc(k)}" value="${im.prices[k] != null ? im.prices[k] : p.guess || ''}" ${p.exists ? 'disabled' : ''}></div></div>`).join('');
    const sample = a.todo.slice(0, 6).map(r => `<div class="item"><div class="grow"><b>${esc(r.name)}</b><small>${esc(r.phone || 'sans téléphone')} · ${esc(r.acc || 'sans ACC')}${r.plan ? ' · ' + esc(r.plan) : ''}</small>${r.hasSub ? `<small>${App.fdate(r.start)} → ${App.fdate(App.addDays(r.start, r.period))}</small>` : '<small>sans abonnement en cours</small>'}</div></div>`).join('');
    return { ...back, html: `<div class="card"><div class="spread"><b>${esc(im.name)}</b><label class="btn sm sec" style="cursor:pointer">Changer<input type="file" id="im_file" accept=".xlsx,.csv,.txt" hidden></label></div>${im.sheets.length > 1 ? `<div class="fld"><label class="l">Feuille</label><select id="im_sheet">${im.sheets.map((x, i) => `<option value="${i}" ${i === im.si ? 'selected' : ''}>${esc(x.name)} (${x.rows.length} lignes)</option>`).join('')}</select></div>` : ''}</div>
      <h2 class="sec">Résultat de la lecture</h2><div class="grid" style="grid-template-columns:repeat(3,1fr)"><div class="stat"><small>Clients lus</small><b>${a.n}</b></div><div class="stat"><small>À ajouter</small><b class="ok">${a.todo.length}</b></div><div class="stat"><small>Déjà présents</small><b>${a.known}</b></div></div>
      <div class="list" style="margin-top:10px"><div class="item"><div class="grow"><b>Avec abonnement (dates)</b></div><b>${a.recs.filter(r => r.hasSub).length}</b></div><div class="item"><div class="grow"><b>Sans abonnement en cours</b><small>ajoutés avec leur compte Starlink, sans date</small></div><b>${a.noSub}</b></div>${a.merged ? `<div class="item"><div class="grow"><b>Lignes en double (même ACC)</b><small>fusionnées</small></div><b>${a.merged}</b></div>` : ''}${a.sameName ? `<div class="item"><div class="grow"><b>Même nom, ACC différents</b><small>probablement plusieurs kits : tous ajoutés</small></div><b>${a.sameName}</b></div>` : ''}${a.oddDates ? `<div class="item"><div class="grow"><b class="warn">Dates à vérifier</b><small>notées dans la fiche du client</small></div><b>${a.oddDates}</b></div>` : ''}${a.balances ? `<div class="item"><div class="grow"><b>Soldes dus notés</b><small>dans la fiche du client (pas de facture créée)</small></div><b>${a.balances}</b></div>` : ''}${a.noName ? `<div class="item"><div class="grow"><b>Lignes sans nom</b><small>ignorées</small></div><b>${a.noName}</b></div>` : ''}</div>
      ${Object.keys(a.plans).length ? `<h2 class="sec">Formules d'abonnement</h2><div class="list">${plans}</div><p class="mut" style="font-size:13px">Prix proposé d'après les soldes dus du fichier (en CDF au taux du jour) : corrigez-le si besoin. Le coût Starlink de la formule se règle ensuite dans Paramètres → formules.</p>` : ''}
      <h2 class="sec">Aperçu</h2><div class="list">${sample || '<div class="empty">Aucun client à ajouter.</div>'}</div>
      ${App.fold('immap', 'Colonnes reconnues (modifier si besoin)', mapUi)}
      <label class="l" style="margin:12px 0"><input type="checkbox" id="im_skip" ${im.skipDup ? 'checked' : ''} style="width:auto"> Ignorer les clients déjà dans l'application (même compte ACC)</label>
      <div class="bar"><button class="btn" data-act="imp_go" ${a.todo.length ? '' : 'disabled style="opacity:.5"'}>✔ Ajouter ${a.todo.length} client(s)</button></div>`, after: bind };
  };
  const bind = () => {
    const f = $('im_file'); if (f) f.onchange = async () => {
      const file = f.files[0]; if (!file) return; im.err = '';
      try {
        if (/\.xls$/i.test(file.name)) throw new Error("Ce format ancien (.xls) n'est pas lu : enregistrez-le en .xlsx (Excel → Enregistrer sous).");
        if (/\.csv$|\.txt$/i.test(file.name)) im.sheets = readCsv(await file.text()); else { if (typeof DecompressionStream === 'undefined') throw new Error("Ce navigateur ne sait pas lire les fichiers Excel : exportez le fichier en CSV."); im.sheets = await readXlsx(await file.arrayBuffer()); }
        im.sheets = im.sheets.filter(x => x.rows.length); if (!im.sheets.length) throw new Error('Fichier vide.');
        im.name = file.name; const best = im.sheets.findIndex(x => /client/i.test(x.name)); setSheet(best >= 0 ? best : im.sheets.map(x => x.rows.length).indexOf(Math.max(...im.sheets.map(x => x.rows.length))));
        if (im.map.name == null) im.err = "La colonne des noms n'a pas été reconnue : choisissez-la dans « Colonnes reconnues ».";
      } catch (e) { im.sheets = null; im.err = e.message || 'Fichier illisible.'; }
      App.refresh();
    };
    const sh = $('im_sheet'); if (sh) sh.onchange = () => { setSheet(+sh.value); App.refresh(); };
    document.querySelectorAll('[data-imk]').forEach(el => el.onchange = () => { im.map[el.dataset.imk] = el.value === '' ? null : +el.value; App.refresh(); });
    document.querySelectorAll('[data-imp]').forEach(el => el.oninput = () => { im.prices[el.dataset.imp] = el.value; });
    const sk = $('im_skip'); if (sk) sk.onchange = () => { im.skipDup = sk.checked; App.refresh(); };
  };

  // ---------- the import itself ----------
  App.actions.imp_go = () => {
    const a = analyse(), db = App.db, S = db.settings; if (!a.todo.length) return;
    const snap = { n: db.clients.length, seq: S.clientSeq, plans: JSON.parse(JSON.stringify(S.plans || {})) }, today = App.today();
    S.plans = S.plans || {}; Object.entries(a.plans).forEach(([k, p]) => { if (!S.plans[k]) S.plans[k] = { price: Math.max(0, +(im.prices[k] != null ? im.prices[k] : p.guess) || 0), cost: 0 }; });
    const ids = []; a.todo.slice().sort((x, y) => x.num - y.num).forEach(r => {
      const price = r.plan ? (S.plans[r.plan] || {}).price || 0 : 0;
      const c = { id: App.uid(), code: App.nextClientCode(), type: 'gere', first: r.first, last: r.last, name: r.name, phone: r.phone, phone2: '', address: '', city: '', quarter: '', installAddr: r.ref, acc: r.acc, serial: '', kit: '', plan: r.plan, price, payMode: 'Cash', start: r.hasSub ? r.start : '', period: r.period, grace: S.grace, note: ['Importé depuis Excel'].concat(r.notes).join('\n'), article: '', subs: [], created: today };
      db.clients.push(c); ids.push(c.id); App.log(c.id, 'Client importé (Excel)');
    });
    App.save(); im.sheets = null; im.name = '';
    App.undoBar(`${ids.length} client(s) importé(s)`, () => { db.clients = db.clients.filter(c => !ids.includes(c.id)); db.log = db.log.filter(l => !ids.includes(l.clientId)); S.clientSeq = snap.seq; S.plans = snap.plans; App.save(); App.refresh(); App.toast('Import annulé'); }, 'Annuler l\'import');
    App.go('clients');
  };
})();
