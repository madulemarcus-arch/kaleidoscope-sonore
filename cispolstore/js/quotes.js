// Quotes (devis): numbered DEV-YYYY-NNNN, printable / PDF / WhatsApp, accepted or refused, then converted into an invoice.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const CUR = [['USD', 'Dollar ($)'], ['CDF', 'Franc congolais (CDF)']];
  const list = () => (App.db.quotes = App.db.quotes || []);
  const st = { f: 'open' };
  App.quoteTotal = q => (q.lines || []).reduce((a, l) => a + l.qty * l.price, 0);
  App.quoteStatus = q => q.status === 'open' && q.until && q.until < App.today() ? 'expired' : q.status;
  const STAT = { open: ['En attente', 'warn'], accepted: ['Accepté', 'ok'], refused: ['Refusé', 'bad'], converted: ['Facturé', 'ok'], expired: ['Expiré', 'bad'] };
  App.quoteOpenCount = () => list().filter(q => q.status === 'open').length;
  const qname = q => q.clientId ? App.cname(App.client(q.clientId)) : (q.name || 'Client de passage');
  const nextNo = date => { const y = (date || App.today()).slice(0, 4); let m = 0; list().forEach(q => { const x = /^DEV-(\d{4})-(\d+)$/.exec(q.no || ''); if (x && x[1] === y) m = Math.max(m, +x[2]); }); return `DEV-${y}-${String(m + 1).padStart(4, '0')}`; };

  // ---------- list ----------
  App.views.quotes = () => {
    const all = list().slice().sort((a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0)), usd = q => App.usd(App.quoteTotal(q), q.currency, q);
    const open = all.filter(q => q.status === 'open'), openTot = open.reduce((a, q) => a + usd(q), 0), conv = all.filter(q => q.status === 'converted').length, dec = all.filter(q => q.status !== 'open').length;
    const shown = all.filter(q => st.f === 'all' || (st.f === 'open' ? q.status === 'open' : st.f === 'done' ? q.status === 'converted' : q.status === 'refused' || q.status === 'accepted'));
    const row = q => { const s = STAT[App.quoteStatus(q)];
      return `<button class="item" data-act="quote_open" data-id="${q.id}"><span class="avatar ${s[1]}">📝</span><div class="grow"><b>${esc(q.no)}</b><small>${esc(qname(q))} · ${App.fdate(q.date)}${q.until ? ' · valable jusqu\'au ' + App.fdate(q.until) : ''}</small></div><div class="end"><b>${App.fmt(App.quoteTotal(q), q.currency)}</b><span class="pill ${s[1]}">${s[0]}</span></div></button>`; };
    return {
      title: 'Devis', sub: `${open.length} en attente`, back: 'more', nav: 'more',
      html: `<section class="hero dhero"><div class="hero-top"><div><small>📝 Devis en attente de réponse</small><div class="hero-num" data-count="${openTot}">${App.fmt(openTot)}</div></div></div>
          <div class="cstats"><div><b>${open.length}</b><small>en attente</small></div><div><b>${conv}</b><small>facturé(s)</small></div><div><b>${dec ? Math.round(conv / dec * 100) : 0} %</b><small>transformés</small></div></div></section>
        <div class="bar"><button class="btn" data-act="quote_new">+ Nouveau devis</button></div>
        <div class="chips">${[['open', 'En attente'], ['accepted', 'Acceptés / refusés'], ['done', 'Facturés'], ['all', 'Tous']].map(([k, t]) => `<button class="chip ${st.f === k ? 'on' : ''}" data-act="quote_f" data-f="${k}">${t}</button>`).join('')}</div>
        ${shown.length ? `<div class="list">${shown.map(row).join('')}</div>` : `<div class="empty big"><div class="ei">📝</div><b>Aucun devis</b><p class="mut">Créez un devis, le client l'accepte, puis transformez-le en facture en un tap.</p></div>`}`
    };
  };
  App.actions.quote_f = d => { st.f = d.f; App.refresh(); };

  // ---------- create / edit ----------
  let qd = null;
  const cur = () => App.v('q_cur') || 'USD';
  const draw = () => { const t = qd.lines.reduce((a, l) => a + l.qty * l.price, 0);
    $('q_cart').innerHTML = (qd.lines.length ? `<div class="list">${qd.lines.map((l, k) => `<div class="item"><div class="grow"><b>${esc(l.desc)}</b><small>${App.nf(l.qty, 2)} × ${App.fmt(l.price, cur())}</small></div><b>${App.fmt(l.qty * l.price, cur())}</b><button type="button" class="btn sm del" data-act="q_rmline" data-i="${k}">✕</button></div>`).join('')}</div><div class="spread" style="margin-top:8px"><b>Total</b><b style="font-size:18px">${App.fmt(t, cur())}</b></div>` : '<div class="empty">Aucune ligne : ajoutez un article ci-dessous.</div>'); };
  App.actions.q_rmline = d => { qd.lines.splice(+d.i, 1); draw(); };
  App.quoteForm = (q, cid) => {
    const isNew = !q, t = App.today(), S = App.db.settings;
    q = q || { clientId: cid || '', name: '', date: t, until: App.addDays(t, 15), currency: 'USD', lines: [], note: '' };
    qd = { lines: q.lines.map(l => ({ ...l })) };
    const valid = q.until ? Math.max(0, App.diff(q.date, q.until)) : 0;
    App.modal(isNew ? 'Nouveau devis' : 'Modifier ' + q.no,
      `${App.clientFinder('q_cl')}${F.sel('q_cl', 'Client', App.clientOpts('Client de passage / prospect'), q.clientId)}${F.text('q_name', 'Nom du prospect (si pas encore client)', q.name || '')}
       <div class="row">${F.date('q_date', 'Date', q.date)}${F.num('q_valid', 'Valable (jours)', valid, 'min="0"')}</div>
       ${F.sel('q_cur', 'Devise', CUR, q.currency)}
       <h2 class="sec">Lignes du devis</h2><div id="q_cart"></div>
       <div class="card" style="margin-top:10px">${F.sel('q_prod', 'Article du stock / catalogue', [['', '— Ligne libre —'], ...App.db.products.map(p => [p.id, p.name])], '')}${F.text('q_desc', 'Désignation', '')}
         <div class="row">${F.num('q_qty', 'Quantité', 1, 'min="0"')}${F.num('q_price', 'Prix unitaire', '')}<div style="flex:none;min-width:auto;align-self:end"><button type="button" class="btn" id="q_add">Ajouter</button></div></div></div>
       ${F.area('q_note', 'Note / conditions (facultatif)', q.note || '', 'rows="2"')}`,
      () => { if (!qd.lines.length) { App.toast('Ajoutez au moins une ligne'); return false; }
        const cl = App.v('q_cl'), name = App.v('q_name').trim(); if (!cl && !name) { App.toast('Choisissez un client ou saisissez un nom'); return false; }
        const date = App.v('q_date') || t, days = Math.max(0, Math.round(App.n('q_valid')));
        const o = { clientId: cl, name: cl ? '' : name, date, until: days ? App.addDays(date, days) : '', currency: App.v('q_cur'), lines: qd.lines, note: App.v('q_note') };
        if (isNew) { Object.assign(q, o, { id: App.uid(), ts: Date.now(), no: nextNo(date), status: 'open', rate: App.rate() }); list().push(q); if (cl) App.log(cl, `Devis ${q.no} : ${App.fmt(App.quoteTotal(q), q.currency)}`); }
        else Object.assign(q, o);
        App.save(); App.toast(isNew ? 'Devis créé : ' + q.no : 'Devis modifié'); App.refresh(); if (isNew) setTimeout(() => App.actions.quote_open({ id: q.id }), 80); },
      isNew ? 'Créer le devis' : 'Enregistrer');
    App.wireClientFinder('q_cl', s => App.clientOpts('Client de passage / prospect', null, s));
    $('q_prod').onchange = () => { const p = App.prod($('q_prod').value); if (p) { $('q_desc').value = p.name; $('q_price').value = App.conv(p.price, 'USD', cur(), q.rate || App.rate()); } };
    $('q_cur').onchange = () => { qd.lines.forEach(l => { l.price = App.conv(l.price, qd.cur || 'USD', cur(), q.rate || App.rate()); }); qd.cur = cur(); draw(); };
    qd.cur = q.currency;
    $('q_add').onclick = () => { const p = App.prod($('q_prod').value), desc = App.v('q_desc') || (p && p.name), qty = App.n('q_qty'), price = App.n('q_price');
      if (!desc) return App.toast('Saisissez une désignation'); if (!(qty > 0)) return App.toast('Quantité invalide'); if (!(price >= 0) || $('q_price').value === '') return App.toast('Saisissez le prix');
      qd.lines.push({ pid: p ? p.id : '', desc, qty, price, unit: p && p.unit === 'm' ? 'm' : '' }); $('q_prod').value = ''; $('q_desc').value = ''; $('q_price').value = ''; $('q_qty').value = 1; draw(); };
    draw();
  };
  App.actions.quote_new = d => App.quoteForm(null, d && d.cid);

  // ---------- printable document ----------
  App.quoteDoc = (q, logo, stamp) => {
    const K = App.docKit, co = App.db.settings.company, c = q.clientId ? App.client(q.clientId) : null, e = App.esc, cu = q.currency === 'CDF' ? 'CDF' : 'USD', tot = App.quoteTotal(q);
    const rows = q.lines.map(l => `<tr><td>${e(l.desc)}</td><td class="r">${K.money(l.price, cu)}</td><td class="r">${App.nf(l.qty, 2)}${l.unit ? ' ' + e(l.unit) : ''}</td><td class="r">${K.money(l.qty * l.price, cu)}</td></tr>`).join('');
    return `<div class="paper">${K.head(co, logo)}
      ${K.boxes('DEVIS', [['Numéro', `<b>${e(q.no)}</b>`], ['Date', App.fdate(q.date)], q.until && ['Valable jusqu\'au', App.fdate(q.until)], co.city && ['Lieu', e(co.city)]], 'CLIENT', [['Nom', `<b>${e(qname(q))}</b>`], c && ['Code Client', e(c.code)], c && (c.address || c.installAddr) && ['Adresse', e(c.address || c.installAddr)], c && c.phone && ['Téléphone', e(c.phone)]])}
      <table class="items"><thead><tr><th>Description</th><th class="r" style="width:18%">P.U. (${cu})</th><th class="r" style="width:9%">Qté</th><th class="r" style="width:22%">Montant (${cu})</th></tr></thead><tbody>${rows}</tbody></table>
      <table class="tots"><tr class="net"><td>TOTAL DU DEVIS :</td><td>${K.money(tot, cu)}</td></tr></table>
      <div class="wb"><b>Arrêté le présent devis à la somme de : ${e(App.amountWords(tot, cu))}</b>.${q.note ? '<br>' + e(q.note) : ''}<br><i>Devis sans valeur de facture. Prix valables jusqu'à la date indiquée, sous réserve de disponibilité du stock.</i></div>
      <table class="sg"><tr><td class="ln">Bon pour accord (client)</td><td class="gp"></td><td class="s2"><img src="${e(stamp || 'stamp.png')}" alt=""></td></tr><tr><td></td><td class="gp"></td><td class="ln">${e(co.name)}</td></tr></table>${K.foot(stamp, true)}</div>`; };
  App.actions.quote_print = async x => { const q = list().find(y => y.id === x.id); if (q) App.docKit.print('Devis ' + q.no, App.quoteDoc(q, await App.docKit.logoData(), await App.docKit.stampData())); };
  App.actions.quote_pdf = async x => { const q = list().find(y => y.id === x.id); if (q) App.sharePdf(`Devis-${q.no}.pdf`, App.quoteDoc(q, await App.docKit.logoData(), await App.docKit.stampData())); };
  App.actions.quote_wa = x => { const q = list().find(y => y.id === x.id), c = q && q.clientId && App.client(q.clientId); if (!q) return; const co = App.db.settings.company;
    const txt = `Bonjour ${(c && c.first) || qname(q)},\nVoici notre devis ${q.no} : ${q.lines.map(l => `${l.desc} × ${App.nf(l.qty, 2)}`).join(', ')}.\nTotal : ${App.fmt(App.quoteTotal(q), q.currency)}${q.until ? ' (valable jusqu\'au ' + App.fdate(q.until) + ')' : ''}.\n${co.name}`;
    if (c && c.phone) window.open(App.waUrl(c.phone, txt), '_blank', 'noopener'); else window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener'); };

  // ---------- detail ----------
  App.actions.quote_open = x => {
    const q = list().find(y => y.id === x.id); if (!q) return; const s = STAT[App.quoteStatus(q)], inv = q.invoiceId && App.invoice(q.invoiceId), live = q.status === 'open' || q.status === 'accepted' || q.status === 'refused';
    App.modal('Devis ' + q.no,
      `<div class="card" style="margin:0 0 10px"><div class="spread"><b>${esc(qname(q))}</b><span class="pill ${s[1]}">${s[0]}</span></div><div class="mut">${App.fdate(q.date)}${q.until ? ' · valable jusqu\'au ' + App.fdate(q.until) : ''}</div>
        <div class="list" style="margin-top:8px">${q.lines.map(l => `<div class="spread"><span>${esc(l.desc)} <small class="mut">× ${App.nf(l.qty, 2)}</small></span><b>${App.fmt(l.qty * l.price, q.currency)}</b></div>`).join('')}</div>
        <div class="spread" style="margin-top:8px"><b>Total</b><b style="font-size:20px">${App.fmt(App.quoteTotal(q), q.currency)}</b></div>${q.note ? `<div class="mut" style="margin-top:6px">${esc(q.note)}</div>` : ''}</div>
       <div class="bar noprint"><button type="button" class="btn sec" data-act="quote_print" data-id="${q.id}">🖨️ Imprimer</button><button type="button" class="btn sec" data-act="quote_pdf" data-id="${q.id}">📤 PDF</button><button type="button" class="btn sec" data-act="quote_wa" data-id="${q.id}">💬 WhatsApp</button></div>
       ${inv ? `<div class="bar"><button type="button" class="btn" data-act="go" data-v="invoice" data-id="${inv.id}">🧾 Voir la facture ${esc(inv.number)}</button></div>` : ''}
       ${live ? `<div class="bar">${q.status !== 'accepted' ? `<button type="button" class="btn sec" data-act="quote_set" data-id="${q.id}" data-s="accepted">👍 Accepté</button>` : ''}${q.status !== 'refused' ? `<button type="button" class="btn sec" data-act="quote_set" data-id="${q.id}" data-s="refused">👎 Refusé</button>` : ''}${q.status !== 'open' ? `<button type="button" class="btn sec" data-act="quote_set" data-id="${q.id}" data-s="open">↺ En attente</button>` : ''}</div>
       <div class="bar"><button type="button" class="btn" data-act="quote_convert" data-id="${q.id}">🧾 Transformer en facture</button></div><div class="bar"><button type="button" class="btn sm sec" data-act="quote_edit" data-id="${q.id}">✏️ Modifier</button><button type="button" class="btn sm sec" data-act="quote_dup" data-id="${q.id}">⎘ Dupliquer</button><button type="button" class="btn sm sec" data-act="quote_del" data-id="${q.id}">🗑 Supprimer</button></div>` : `<div class="bar"><button type="button" class="btn sm sec" data-act="quote_dup" data-id="${q.id}">⎘ Dupliquer</button></div>`}`);
  };
  App.actions.quote_set = x => { const q = list().find(y => y.id === x.id); if (!q) return; q.status = x.s; App.save(); App.close(); App.refresh(); App.toast(STAT[x.s][0]); };
  App.actions.quote_edit = x => { const q = list().find(y => y.id === x.id); if (q) { App.close(); setTimeout(() => App.quoteForm(q), 30); } };
  App.actions.quote_dup = x => { const q = list().find(y => y.id === x.id); if (!q) return; const t = App.today(), n = { ...q, lines: q.lines.map(l => ({ ...l })), id: App.uid(), ts: Date.now(), no: nextNo(t), date: t, until: q.until ? App.addDays(t, Math.max(0, App.diff(q.date, q.until))) : '', status: 'open', invoiceId: '' };
    list().push(n); App.save(); App.close(); App.refresh(); App.toast('Devis dupliqué : ' + n.no); };
  App.actions.quote_del = x => { const q = list().find(y => y.id === x.id); if (!q) return; if (!App.confirm(`Supprimer le devis ${q.no} ?`)) return; App.db.quotes = list().filter(y => y !== q); App.save(); App.close(); App.refresh(); };

  // ---------- convert into an invoice ----------
  App.actions.quote_convert = x => {
    const q = list().find(y => y.id === x.id); if (!q) return; const tot = App.quoteTotal(q), hasSub = q.lines.some(l => /^abonnement/i.test(l.desc)), hasInst = q.lines.some(l => /install/i.test(l.desc));
    App.close();
    setTimeout(() => App.modal('Transformer en facture', `<p class="mut" style="margin-top:0">${esc(q.no)} · ${esc(qname(q))} · <b>${App.fmt(tot, q.currency)}</b>. Le stock sera déduit comme pour une vente normale.</p>
      <div class="row">${F.num('qv_paid', `Payé maintenant (${q.currency === 'CDF' ? 'CDF' : '$'})`, '', 'placeholder="0 = facture impayée"')}${F.sel('qv_mode', 'Mode de paiement', App.PAY_MODES, 'Cash')}</div>
      <label class="chk" style="display:block;margin-top:8px"><input type="checkbox" id="qv_pend"> ⏳ Facture en attente (le client n'a pas encore pris le produit : rien n'est déduit du stock)</label>`,
      () => { const paid = Math.min(App.n('qv_paid'), tot), pend = $('qv_pend').checked, t = App.today();
        const inv = App.createInvoice({ type: hasSub && hasInst || (hasSub || hasInst) && q.lines.length > 1 ? 'complete' : hasSub ? 'abonnement' : hasInst ? 'installation' : 'materiel', clientId: q.clientId || '', currency: q.currency, payMode: App.v('qv_mode'), date: t, rate: q.rate, lines: q.lines.map(l => ({ pid: l.pid || '', desc: l.desc, qty: l.qty, price: l.price, unit: l.unit || '', cost: l.pid && App.prod(l.pid) ? App.conv(App.prod(l.pid).cost, 'USD', q.currency, q.rate) : 0 })), note: 'Devis ' + q.no + (!q.clientId && q.name ? ' · ' + q.name : ''), pending: pend || undefined, payAmount: paid > 0 && !pend ? paid : 0 }, 0);
        q.status = 'converted'; q.invoiceId = inv.id; App.save(); App.toast('Facture créée : ' + inv.number); App.go('invoice', { id: inv.id }); App.celebrate && App.celebrate(); }, 'Créer la facture'), 40);
  };
})();
