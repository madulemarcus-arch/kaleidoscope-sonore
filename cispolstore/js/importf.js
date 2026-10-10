// Import old invoices from Word (.docx) files: reads number, date, client, lines and total, shows a preview, then creates the invoices
// (new application number, client found or created, paid or unpaid as chosen). Nothing leaves the device.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, T = App.impTools;
  const fi = { docs: [], err: '', ov: new Map(), pay: new Map() };

  // ---------- reading a .docx ----------
  const money = s => { s = String(s || '').replace(/[\s ]/g, '').replace(/[^\d.,-]/g, ''); if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(',', '.'); const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };
  const isoDate = (d, m, y) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const parseDocx = async (file) => {
    const read = await T.unzip(await file.arrayBuffer()), src = await read('word/document.xml'); if (!src) throw new Error('Fichier Word illisible.');
    const doc = T.xml(src), W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const textOf = p => { let s = ''; (function walk(n) { for (const c of n.childNodes) { if (c.nodeType !== 1) continue; if (c.localName === 't') s += c.textContent; else if (c.localName === 'tab') s += '\t'; else if (c.localName === 'br' || c.localName === 'cr') s += '\n'; else walk(c); } })(p); return s; };
    const inFallback = n => { for (let a = n.parentNode; a; a = a.parentNode) if (a.localName === 'Fallback') return true; return false; };
    const paras = [...doc.getElementsByTagNameNS(W, 'p')].filter(p => !inFallback(p)).map(textOf), text = paras.join('\n');
    const d = { name: file.name, issues: [], lines: [] };
    d.number = (text.match(/Num[ée]ro\s*:\s*([A-Za-z]*\d+)/) || [])[1] || '';
    const dm = text.match(/Date\s*:\s*(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/); d.date = dm ? isoDate(dm[1], dm[2], dm[3]) : '';
    d.client = ((text.match(/Nom\s*:\s*([^\n]*?)(?=Code\s*Client|Adresse|\n|$)/i) || [])[1] || '').trim();
    d.code = ((text.match(/Code\s*Client\s*:\s*([0-9A-Za-z-]+?)(?=Adresse|\s|$)/i) || [])[1] || '').trim();
    d.address = ((text.match(/Adresse[\s ]*:\s*([^\n]*)/) || [])[1] || '').trim();
    // the items table: header Référence | Description | P.U. | Qté | Montant
    for (const tbl of doc.getElementsByTagNameNS(W, 'tbl')) {
      const rows = [...tbl.getElementsByTagNameNS(W, 'tr')].map(r => [...r.getElementsByTagNameNS(W, 'tc')].map(c => [...c.getElementsByTagNameNS(W, 'p')].map(textOf).join(' ').replace(/\s+/g, ' ').trim()));
      const h = rows[0] || []; if (!(h.length >= 4 && /r[ée]f/i.test(h[0]) && /desc/i.test(h[1] || ''))) continue;
      d.currency = /CDF/i.test(h.join(' ')) ? 'CDF' : 'USD';
      rows.slice(1).forEach(r => { if (r.length < 5 || !r[1]) return; const price = money(r[2]), qty = money(r[3]) || 1, amt = money(r[4]); d.lines.push({ ref: r[0], desc: r[1], price, qty, amt }); });
      break;
    }
    const tm = text.match(/Total\s*TTC\s*:?\s*([\d\s .,]+?)\s*(?:\$|USD|CDF)/i); d.total = tm ? money(tm[1]) : 0;
    return finish(d);
  };
  // checks shared by Word and PDF
  const finish = d => {
    d.calc = d.lines.reduce((a, l) => a + l.qty * l.price, 0);
    if (!d.number) d.issues.push('numéro non trouvé'); if (!d.date) d.issues.push('date non trouvée'); if (!d.client) d.issues.push('client non trouvé'); if (!d.lines.length) d.issues.push('aucune ligne de produit');
    if (d.total && Math.abs(d.total - d.calc) > 0.5) d.issues.push(`total du document ${App.fmt(d.total, d.currency)} ≠ somme des lignes ${App.fmt(d.calc, d.currency)}`);
    d.lines.forEach(l => { if (Math.abs(l.qty * l.price - l.amt) > 0.5) d.issues.push(`ligne « ${l.desc} » : montant ${l.amt} ≠ ${l.qty} × ${l.price}`); });
    return d;
  };

  // ---------- reading a PDF (pdf.js, loaded only when a PDF is chosen) ----------
  const loadPdfjs = () => window.pdfjsLib ? Promise.resolve(window.pdfjsLib) : new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'vendor/pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; res(window.pdfjsLib); };
    s.onerror = () => rej(new Error('Le lecteur de PDF ne s\'est pas chargé (connexion nécessaire la première fois).')); document.head.appendChild(s);
  });
  // the text of the PDF as lines: items sharing the same height are joined from left to right
  const pdfLines = async buf => {
    const lib = await loadPdfjs(), pdf = await lib.getDocument({ data: new Uint8Array(buf) }).promise, out = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const items = (await (await pdf.getPage(n)).getTextContent()).items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width })).sort((a, b) => b.y - a.y || a.x - b.x), rows = [];
      items.forEach(i => { const r = rows.find(r => Math.abs(r.y - i.y) < 3); if (r) r.it.push(i); else rows.push({ y: i.y, it: [i] }); });
      rows.sort((a, b) => b.y - a.y).forEach(r => { r.it.sort((a, b) => a.x - b.x); let t = ''; r.it.forEach((i, k) => { const p = r.it[k - 1]; t += (k && i.x - (p.x + p.w) > 1.5 ? ' ' : '') + i.s; }); out.push(t.replace(/\s+/g, ' ').trim()); });
    }
    return out;
  };
  const dateIso = s => { const m = String(s || '').match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/); return m ? isoDate(m[1], m[2], m[3]) : ''; };
  const parsePdf = async file => {
    const lines = await pdfLines(await file.arrayBuffer()), text = lines.join('\n'), d = { name: file.name, issues: [], lines: [] };
    if (!text.trim()) throw new Error(`« ${file.name} » : PDF sans texte (image scannée) : non lisible.`);
    d.number = (text.match(/(?:FACTURE\s*N°|Num[ée]ro\s*:?)\s*([A-Za-z]*\d+)/i) || [])[1] || '';
    d.date = dateIso((text.match(/\bDate\s*:\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/) || [])[1]);
    d.client = ((text.match(/\bNom\s*:\s*(.+?)(?=\s+Code\s*[Cc]lient|\s+Adresse|$)/m) || text.match(/\bA\s*:\s*(\S.*)$/m) || [])[1] || '').trim();
    d.code = ((text.match(/Code\s*[Cc]lient\s*:?\s*([0-9A-Za-z-]+)/) || [])[1] || '').trim();
    d.address = ((text.match(/Adresse\s*:\s*(.+)$/m) || [])[1] || '').trim();
    d.currency = /\bCDF\b/.test(lines.filter(l => /total|montant/i.test(l)).join(' ')) && !/\$|USD/.test(lines.filter(l => /total/i.test(l)).join(' ')) ? 'CDF' : 'USD';
    const num = s => money(s), norm = l => l.replace(/(\d)\s*,\s*(\d)/g, '$1,$2').replace(/(\d)\s+(\$|USD)/g, '$1$2');
    lines.forEach(raw => {
      const l = norm(raw); let m;
      if ((m = l.match(/^(P\d+)\s+(.+?)\s+(\d[\d\s.,]*?)\s*(?:\$|USD)\s+(\d+(?:[.,]\d+)?)\s+(\d[\d\s.,]*?)\s*(?:\$|USD)?$/i))) d.lines.push({ ref: m[1], desc: m[2].trim(), price: num(m[3]), qty: num(m[4]) || 1, amt: num(m[5]) });
      // invoice with one row per Starlink account: holder | ACC | plan | start | end | amount
      else if ((m = l.match(/^(.+?)\s+(ACC-[A-Z0-9-]+)\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d[\d\s.,]*?)\s*(?:\$|USD)/))) { const a = num(m[6]); d.lines.push({ ref: '', desc: `${m[3].trim()} — ${m[1].trim()} (${m[2]}) ${m[4]} → ${m[5]}`, price: a, qty: 1, amt: a, acc: m[2], start: dateIso(m[4]), end: dateIso(m[5]) }); }
    });
    const tot = [...norm(text).matchAll(/\bTotal\s*(?:TTC)?\s*:?\s*(\d[\d\s.,]*?)\s*(\$|USD|CDF)/gi)].pop(); d.total = tot ? num(tot[1]) : 0;
    const pm = norm(text).match(/MONTANT\s*PAY[ÉE]\s*:?\s*(\d[\d\s.,]*?)\s*(?:\$|USD|CDF)/i); if (pm) { d.paid = num(pm[1]); const mode = (text.match(/Pay[ée]\s*par\s*:?\s*(.+)/i) || [])[1] || ''; d.mode = /esp/i.test(mode) ? 'Cash' : /m-?pesa/i.test(mode) ? 'M-Pesa' : /airtel/i.test(mode) ? 'Airtel Money' : /orange/i.test(mode) ? 'Orange Money' : /banque|virement/i.test(mode) ? 'Banque' : 'Cash'; }
    return finish(d);
  };

  // ---------- comparison with the application ----------
  const typeOf = lines => { const ins = lines.some(l => /install/i.test(l.desc)), sub = lines.some(l => /^abonnement/i.test(l.desc) && !/install/i.test(l.desc)), other = lines.some(l => !/install/i.test(l.desc) && !/^abonnement/i.test(l.desc)); return other ? (ins || sub ? 'complete' : 'materiel') : sub && ins ? 'complete' : sub ? 'abonnement' : 'installation'; };
  const keyOf = d => [d.number, d.date, Math.round(d.calc * 100), T.norm(d.client)].join('|');
  const findClient = d => App.db.clients.find(c => d.code && new RegExp("Code d'origine : " + d.code.replace(/[^\w-]/g, '') + '\\b').test(c.note || '')) || App.db.clients.find(c => T.norm(App.cname(c)) === T.norm(d.client));
  const analyse = () => fi.docs.map((d, i) => {
    const key = keyOf(d), c = d.client ? findClient(d) : null, known = App.db.invoices.some(x => x.origin === key);
    const same = App.db.invoices.filter(x => c && x.clientId === c.id && Math.abs(App.invTotal(x) - d.calc) < 0.01 && x.date !== d.date).length + fi.docs.filter((o, j) => j < i && T.norm(o.client) === T.norm(d.client) && Math.abs(o.calc - d.calc) < 0.01).length;
    const num = fi.docs.filter(o => o.number && o.number === d.number).length;
    const bad = d.issues.some(x => /non trouv|aucune ligne/.test(x)), act = fi.ov.get(i) || (known || bad ? 'skip' : 'import');
    return { i, d, key, c, known, maybe: same > 0, dupNum: num > 1, type: typeOf(d.lines), act: known || bad ? 'skip' : act, pay: fi.pay.get(i) || (d.paid && d.paid >= d.calc - 0.01 ? d.mode || 'Cash' : '') };
  });

  // ---------- screen ----------
  const bind = () => {
    const f = $('if_file'); if (f) f.onchange = async () => {
      fi.err = ''; const list = [...f.files], docs = [];
      for (const file of list) {
        try {
          if (/\.pdf$/i.test(file.name)) docs.push(await parsePdf(file));
          else if (/\.docx$/i.test(file.name)) { if (typeof DecompressionStream === 'undefined') throw new Error('Ce navigateur ne sait pas lire les fichiers Word.'); docs.push(await parseDocx(file)); }
          else throw new Error(`« ${file.name} » : seuls les fichiers Word (.docx) et PDF sont lus.`);
        } catch (e) { fi.err += (fi.err ? '\n' : '') + (e.message || 'Fichier illisible.'); }
      }
      if (docs.length) { fi.docs = fi.docs.concat(docs); } App.refresh();
    };
    document.querySelectorAll('[data-ifa]').forEach(el => el.onchange = () => { fi.ov.set(+el.dataset.ifa, el.value); App.refresh(); });
    document.querySelectorAll('[data-ifp]').forEach(el => el.onchange = () => { fi.pay.set(+el.dataset.ifp, el.value); App.refresh(); });
  };
  App.views.importf = () => {
    const back = { title: 'Importer des factures', sub: 'Word (.docx) ou PDF', back: 'settings', nav: 'more' };
    const pick = `<label class="btn" style="cursor:pointer;display:inline-block">📄 Choisir les factures (Word ou PDF)<input type="file" id="if_file" accept=".docx,.pdf" multiple hidden></label>`;
    const err = fi.err ? `<p class="bad" style="white-space:pre-line">${esc(fi.err)}</p>` : '';
    if (!fi.docs.length) return { ...back, html: `<div class="card"><p style="margin-top:0">Choisissez une ou plusieurs <b>factures Word (.docx) ou PDF</b> : l'application lit le numéro, la date, le client, les lignes et le total, les compare avec ce qui existe déjà, puis vous montre un aperçu. Rien n'est créé avant votre confirmation, et vous pourrez annuler juste après.</p>${pick}${err}<p class="mut" style="font-size:13px;margin-bottom:0">Les PDF ne peuvent pas être lus : utilisez le fichier Word d'origine.</p></div>`, after: bind };
    const a = analyse(), todo = a.filter(x => x.act === 'import'), missing = todo.filter(x => !x.pay).length;
    const PAYOPTS = x => `<option value="" ${!x.pay ? 'selected' : ''}>Paiement ?</option><option value="unpaid" ${x.pay === 'unpaid' ? 'selected' : ''}>Impayée</option>${App.PAY_MODES.map(m => `<option value="${esc(m)}" ${x.pay === m ? 'selected' : ''}>Payée · ${esc(m)}</option>`).join('')}`;
    const card = x => { const d = x.d; return `<div class="card" style="margin-bottom:10px${x.act === 'skip' ? ';opacity:.6' : ''}"><div class="spread"><b>${esc(d.client || '?')}</b><b>${App.fmt(d.calc, d.currency || 'USD')}</b></div>
      <small class="mut">${esc(d.name)} · n° d'origine ${esc(d.number || '?')}${x.dupNum ? ' <span class="warn">(même numéro que d\'autres fichiers)</span>' : ''} · ${d.date ? App.fdate(d.date) : 'sans date'} · ${App.invTypes[x.type]}</small>
      <small class="${x.c ? 'ok' : 'warn'}" style="display:block">${x.c ? 'Client existant : ' + esc(App.cname(x.c)) + ' (' + esc(x.c.code) + ')' : 'Nouveau client créé : ' + esc(d.client) + (d.code ? ' (code d\'origine ' + esc(d.code) + ')' : '')}</small>
      <div style="margin:6px 0">${d.lines.map(l => `<small style="display:block">• ${esc(l.desc)} — ${App.nf(l.qty, 2)} × ${App.fmt(l.price, d.currency)}</small>`).join('')}</div>
      ${d.paid ? `<small class="ok" style="display:block">Le document indique un montant payé de ${App.fmt(d.paid, d.currency)}.</small>` : ''}${x.known ? '<small class="warn" style="display:block">Déjà importée.</small>' : ''}${x.maybe ? '<small class="warn" style="display:block">Même client et même montant qu\'une autre facture : doublon possible.</small>' : ''}${d.issues.map(m => `<small class="warn" style="display:block">⚠ ${esc(m)}</small>`).join('')}
      <div class="row" style="margin-top:8px"><div class="fld"><select data-ifa="${x.i}" ${x.known ? 'disabled' : ''}><option value="import" ${x.act === 'import' ? 'selected' : ''}>Importer</option><option value="skip" ${x.act === 'skip' ? 'selected' : ''}>Ne pas importer</option></select></div>${x.act === 'import' ? `<div class="fld"><select data-ifp="${x.i}">${PAYOPTS(x)}</select></div>` : ''}</div></div>`; };
    return { ...back, html: `<div class="card"><div class="spread"><b>${a.length} facture(s) lue(s)</b><span>${pick}</span></div>${err}</div>
      <div class="bar" style="margin:8px 0"><button class="btn sm sec" data-act="imp_fall" data-v="Cash">☑ Tout marquer payé (Cash)</button><button class="btn sm sec" data-act="imp_fall" data-v="unpaid">Tout marquer impayé</button><button class="btn sm sec" data-act="imp_fclear">Vider la liste</button></div>
      ${a.map(card).join('')}
      <div class="bar" style="position:sticky;bottom:78px"><button class="btn" data-act="imp_fgo" ${todo.length && !missing ? '' : 'disabled style="opacity:.5"'}>✔ Importer ${todo.length} facture(s)${missing ? ` (${missing} sans choix de paiement)` : ''}</button></div>`, after: bind };
  };
  App.actions.imp_fall = d => { analyse().forEach(x => { if (x.act === 'import') fi.pay.set(x.i, d.v); }); App.refresh(); };
  App.actions.imp_fclear = () => { fi.docs = []; fi.ov = new Map(); fi.pay = new Map(); fi.err = ''; App.refresh(); };

  // ---------- the import itself ----------
  App.actions.imp_fgo = () => {
    const db = App.db, S = db.settings, a = analyse().filter(x => x.act === 'import'); if (!a.length || a.some(x => !x.pay)) return;
    const snap = JSON.parse(JSON.stringify({ clients: db.clients, invoices: db.invoices, payments: db.payments, log: db.log, invSeq: S.invSeq || {}, seq: S.clientSeq })), today = App.today(); let created = 0, newClients = 0;
    a.slice().sort((x, y) => (x.d.date || '').localeCompare(y.d.date || '') || x.i - y.i).forEach(x => {
      const d = x.d; let c = x.c || db.clients.find(k => T.norm(App.cname(k)) === T.norm(d.client) && /Importé depuis une facture/.test(k.note || ''));
      if (!c) { const nm = d.client.replace(/\s+/g, ' ').trim(), parts = nm.split(' '); c = { id: App.uid(), code: App.nextClientCode(), type: ['abonnement', 'complete'].includes(x.type) ? 'gere' : x.type === 'materiel' ? 'mat' : 'install', first: parts[0], last: parts.slice(1).join(' '), name: nm, phone: '', phone2: '', address: d.address, city: '', quarter: '', installAddr: '', acc: '', serial: '', kit: '', plan: '', price: 0, payMode: 'Cash', start: '', period: S.period, grace: S.grace, note: `Importé depuis une facture Word${d.code ? `\nCode d'origine : ${d.code}` : ''}`, article: '', subs: [], created: today }; db.clients.push(c); App.log(c.id, 'Client créé (import de facture)'); newClients++; }
      const paid = x.pay !== 'unpaid', inv = { type: x.type, clientId: c.id, currency: d.currency || 'USD', payMode: paid ? x.pay : 'Cash', date: d.date || today, lines: d.lines.map(l => ({ pid: '', ref: l.ref, desc: l.desc, qty: l.qty, price: l.price, cost: 0 })), note: `Importée du fichier ${d.name} (n° d'origine ${d.number}${d.code ? ', code client ' + d.code : ''})`, origin: x.key, payAmount: paid ? d.calc : 0 };
      App.createInvoice(inv, 0); created++;
    });
    App.stampRates(); App.save(); const had = fi.docs.length; fi.docs = []; fi.ov = new Map(); fi.pay = new Map();
    App.undoBar(`${created} facture(s) importée(s)${newClients ? `, ${newClients} client(s) créé(s)` : ''}`, () => { db.clients = snap.clients; db.invoices = snap.invoices; db.payments = snap.payments; db.log = snap.log; S.invSeq = snap.invSeq; S.clientSeq = snap.seq; App.save(); App.refresh(); App.toast('Import annulé'); }, 'Annuler l\'import');
    App.go('invoices'); App.celebrate();
  };
})();
