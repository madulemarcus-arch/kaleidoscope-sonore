// Invoices (4 types, automatic numbering, PDF/Word/print), payments and expenses.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const CUR = [['USD', 'Dollar ($)'], ['CDF', 'Franc congolais (CDF)']];

  // ---------- Creation (shared with subscription renewal) ----------
  App.createInvoice = (inv, paid = 0) => {
    const db = App.db, date = inv.date || App.today();
    Object.assign(inv, { id: App.uid(), number: App.nextInvNumber(date.slice(0, 4)), date, ts: Date.now(), note: inv.note || '' });
    App.costSubLines(inv);
    db.invoices.push(inv);
    inv.lines.forEach(l => { const p = l.pid && App.prod(l.pid); if (p && App.tracked(p)) App.move({ pid: p.id, qty: -l.qty, invoiceId: inv.id, clientId: inv.clientId, date, note: 'Facture ' + inv.number }); });
    if (paid > 0) db.payments.push({ id: App.uid(), date, clientId: inv.clientId, invoiceId: inv.id, amount: paid, currency: inv.currency, mode: inv.payMode, ref: '', comment: '' });
    App.log(inv.clientId, `Facture ${inv.number} : ${App.fmt(App.invTotal(inv), inv.currency)}`);
    return inv;
  };

  // ---------- Invoice list ----------
  const st = { f: 'all', q: '' };
  const drawList = () => {
    const q = st.q.toLowerCase();
    const l = App.db.invoices.filter(i => (st.f === 'all' || App.invStatus(i) === st.f) && (!q || (i.number + ' ' + App.cname(App.client(i.clientId))).toLowerCase().includes(q))).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
    $('ilist').innerHTML = l.length ? `<div class="list">${l.map(i => { const [t, k] = App.INV[App.invStatus(i)]; return `<button class="item" data-act="go" data-v="invoice" data-id="${i.id}"><div class="grow"><b>${esc(i.number)}</b><small>${esc(App.cname(App.client(i.clientId)))} · ${App.fdate(i.date)} · ${App.invTypes[i.type]}</small></div><div class="end"><b>${App.fmt(App.invTotal(i), i.currency)}</b><span class="pill ${k}">${t}</span></div></button>`; }).join('')}</div>` : '<div class="empty">Aucune facture.</div>';
  };
  App.views.invoices = () => {
    const db = App.db, tot = db.invoices.reduce((a, i) => a + App.usd(App.invTotal(i), i.currency), 0), due = db.invoices.reduce((a, i) => a + App.usd(App.invDue(i), i.currency), 0);
    return {
      title: 'Factures', sub: `${db.invoices.length} facture(s)`, back: 'more', nav: 'more',
      html: `<div class="grid two"><div class="stat"><small>Total facturé</small><b>${App.fmt(tot)}</b></div><div class="stat"><small>Reste à encaisser</small><b class="${due ? 'warn' : ''}">${App.fmt(due)}</b></div></div>
        <div class="search"><input id="iq" placeholder="Rechercher un numéro, un client…" value="${esc(st.q)}" autocomplete="off"></div>
        <div class="chips">${[['all', 'Toutes'], ['unpaid', 'Impayées'], ['part', 'Partielles'], ['paid', 'Payées']].map(([k, t]) => `<button class="chip ${st.f === k ? 'on' : ''}" data-act="invfilter" data-f="${k}">${t}</button>`).join('')}</div>
        <div id="ilist"></div><button class="btn full" data-act="newinv" style="margin-top:14px">+ Nouvelle facture</button>`,
      after: () => { drawList(); $('iq').oninput = e => { st.q = e.target.value; drawList(); }; }
    };
  };
  App.actions.invfilter = d => { st.f = d.f; App.refresh(); };
  App.actions.newinv = d => App.invoiceStart(d.cid);

  // ---------- New invoice: type then form ----------
  const TYPE_INFO = [['materiel', '📦', 'Matériel uniquement', 'Starlink, câble, routeur…'], ['abonnement', '📡', 'Abonnement uniquement', "Facture d'abonnement Starlink"], ['installation', '🔧', 'Installation uniquement', 'Main-d\'œuvre et configuration'], ['complete', '🧾', 'Facture complète', 'Kit + installation + abonnement + accessoires']];
  App.invoiceStart = cid => App.modal('Choisissez le type de facture', TYPE_INFO.map(([k, i, t, s]) => `<button class="opt" data-act="invtype" data-t="${k}" data-cid="${cid || ''}"><span class="ico">${i}</span><span><b>${t}</b><small>${s}</small></span></button>`).join(''));
  App.actions.invtype = d => App.invoiceForm(d.t, { clientId: d.cid });

  let draft = null;
  const needsClient = t => t !== 'materiel';
  App.invoiceForm = (type, pre = {}) => {
    const db = App.db, S = db.settings;
    draft = { type, lines: [], paidTouched: false };
    const total = () => draft.lines.reduce((a, l) => a + l.qty * l.price, 0);
    const cur = () => App.v('f_cur') || 'USD';
    const draw = () => {
      const t = total();
      $('cart').innerHTML = draft.lines.length ? `<div class="list">${draft.lines.map((l, k) => `<div class="item"><div class="grow"><b>${esc(l.desc)}</b><small>${l.qty} ${esc(l.unit || '')} × ${App.fmt(l.price, cur())}</small></div><b>${App.fmt(l.qty * l.price, cur())}</b><button type="button" class="btn sm del" data-act="rmline" data-i="${k}">✕</button></div>`).join('')}<div class="item"><div class="grow"><b>Total</b></div><b>${App.fmt(t, cur())}</b></div></div>` : '<div class="empty" style="padding:10px">Aucune ligne. Ajoutez un article ci-dessous.</div>';
      if (!draft.paidTouched) $('f_paid').value = t || '';
    };
    const clientSel = () => App.clientOpts(needsClient(type) ? '— Choisir un client —' : 'Client de passage', type === 'abonnement' ? ['gere'] : null);
    const cl = clientSel();
    const qcType = type === 'abonnement' ? 'gere' : type === 'installation' ? 'install' : type === 'materiel' ? 'mat' : 'gere';
    const quick = `<div class="bar" style="margin-top:6px"><button type="button" class="btn sm sec" id="qc_open">＋ Nouveau client</button></div>
       <div class="card" id="qc" hidden style="margin:8px 0">
         <b>Nouveau client</b>
         ${type === 'abonnement' ? '' : F.sel('qc_type', 'Type de client', [['gere', 'Géré par CISPOLstore'], ['mat', 'Matériel uniquement'], ['install', 'Installation uniquement']], qcType)}
         <div class="row">${F.text('qc_first', 'Prénom', '')}${F.text('qc_last', 'Nom', '')}</div>
         ${F.text('qc_phone', 'Téléphone', '', 'type="tel" inputmode="tel"')}
         <div id="qc_gere">${F.text('qc_acc', 'Compte Starlink (ACC)', '', 'autocapitalize="characters"')}<div class="row">${F.text('qc_plan', "Type d'abonnement", '', 'list="qc_pl"')}${F.num('qc_price', 'Prix ($)', '')}${F.date('qc_start', "Début", App.today())}</div>${F.list('qc_pl', App.PLANS)}</div>
         <div class="bar" style="margin-top:12px"><button type="button" class="btn" id="qc_save">Enregistrer le client</button><button type="button" class="btn sec" id="qc_cancel">Annuler</button></div></div>`;
    const renewBlock = ['abonnement', 'complete'].includes(type) ? `<label class="l" id="renwrap"><input type="checkbox" id="f_renew" checked style="width:auto"> Renouveler l'abonnement du client (nouvelle période) — décochez pour facturer la période en cours</label>` : '';
    const instBlock = ['installation', 'complete'].includes(type) ? `<div class="row">${F.text('f_tech', 'Technicien', '', 'list="techlist" autocomplete="off"')}${F.list('techlist', App.techNames())}${F.text('f_obs', 'Observations', '')}</div>` : '';
    App.modal('Nouvelle facture · ' + App.invTypes[type],
      `${F.sel('f_cl', 'Client', cl, pre.clientId || '')}${quick}
       <div class="row">${F.date('f_date', 'Date', App.today())}${F.sel('f_cur', 'Devise', CUR, 'USD')}${F.sel('f_pay', 'Mode de paiement', App.PAY_MODES, 'Cash')}</div>
       <h2 class="sec">Lignes de la facture</h2><div id="cart"></div>
       <div class="card" style="margin-top:10px">
         ${F.sel('f_prod', 'Article du stock / catalogue', [['', '— Ligne libre —'], ...db.products.map(p => [p.id, p.name + (App.tracked(p) ? ` (${App.nf(p.qty, 2)}${p.unit === 'm' ? ' m' : ''})` : '')])], '')}
         ${F.text('f_desc', 'Désignation', '')}
         <div class="row">${F.num('f_qty', 'Quantité', 1, 'min="0"')}${F.num('f_price', 'Prix unitaire', '')}<div style="flex:none;min-width:auto;align-self:end"><button type="button" class="btn" id="f_add">Ajouter</button></div></div>
         <div class="bar"><button type="button" class="btn sm sec" id="f_addsub">＋ Abonnement</button><button type="button" class="btn sm sec" id="f_addinst">＋ Installation</button></div></div>
       ${renewBlock}${instBlock}
       ${F.num('f_paid', 'Montant payé maintenant', '')}`,
      () => {
        const cid = App.v('f_cl'), c = App.client(cid);
        if (needsClient(type) && !cid) { App.toast('Choisissez un client'); return false; }
        if (!draft.lines.length) { App.toast('Ajoutez au moins une ligne'); return false; }
        const date = App.v('f_date') || App.today(), curr = cur(), mode = App.v('f_pay');
        let lines = draft.lines.map(l => { const { auto, ...r } = l; return r; });
        let renewed = null;
        if ($('f_renew') && $('f_renew').checked && c && c.type === 'gere') {
          const s = App.sub(c), ns = s && s.status !== 'inactif' ? s.end : date, days = c.period || S.period, end = App.addDays(ns, days);
          lines.forEach(l => { if (/^abonnement/i.test(l.desc) && !l.desc.includes('(')) l.desc += ` (${App.fdate(ns)} → ${App.fdate(end)})`; });
          renewed = { ns, days, end };
        } else if (c && c.type === 'gere' && App.sub(c)) {
          const s = App.sub(c); // not renewing: the invoice covers the current period
          lines.forEach(l => { if (/^abonnement/i.test(l.desc) && !l.desc.includes('(')) l.desc += ` (${App.fdate(s.start)} → ${App.fdate(s.end)})`; });
        }
        const total = lines.reduce((a, l) => a + l.qty * l.price, 0), paid = Math.min(App.n('f_paid'), total);
        const inv = App.createInvoice({ type, clientId: cid, currency: curr, payMode: mode, date, lines }, paid);
        if (renewed && c) {
          if (c.start) (c.subs = c.subs || []).push({ start: c.start, days: c.period || renewed.days, price: c.price || 0, date });
          Object.assign(c, { start: renewed.ns, period: renewed.days }); App.log(c.id, `Abonnement renouvelé : ${App.fdate(renewed.ns)} → ${App.fdate(renewed.end)}`);
        }
        if (['installation', 'complete'].includes(type) && cid) {
          const fee = lines.filter(l => !l.pid && /install/i.test(l.desc)).reduce((a, l) => a + l.qty * l.price, 0);
          const mats = lines.filter(l => l.pid && App.tracked(App.prod(l.pid))).map(l => ({ pid: l.pid, qty: l.qty }));
          if (fee > 0 || type === 'installation') { db.installs.push({ id: App.uid(), clientId: cid, date, kind: 'Installation Starlink', tech: App.v('f_tech'), techId: App.techId(App.v('f_tech')), price: App.usd(fee, curr), materials: mats, invoiceId: inv.id, obs: App.v('f_obs') }); App.log(cid, 'Installation facturée ' + inv.number); }
        }
        App.save(); App.toast('Facture ' + inv.number + ' créée'); App.go('invoice', { id: inv.id });
      }, 'Créer la facture');
    // renewal is on by default only when the client already had a subscription invoice
    const syncRenew = () => { const cb = $('f_renew'); if (cb) cb.checked = db.invoices.some(i => i.clientId === App.v('f_cl') && i.lines.some(l => /^abonnement/i.test(l.desc))); };
    $('f_cl').addEventListener('change', syncRenew); syncRenew();
    // quick client creation without leaving the invoice
    const qcSync = () => { $('qc_gere').hidden = ($('qc_type') ? $('qc_type').value : 'gere') !== 'gere'; };
    if ($('qc_type')) $('qc_type').onchange = qcSync; qcSync();
    $('qc_open').onclick = () => { $('qc').hidden = false; $('qc_open').hidden = true; $('qc_first').focus(); };
    const qcClose = () => { $('qc').hidden = true; $('qc_open').hidden = false; };
    $('qc_cancel').onclick = qcClose;
    $('qc').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (e.target.tagName !== 'BUTTON') $('qc_save').click(); } });
    $('qc_save').onclick = () => {
      const first = App.v('qc_first'), last = App.v('qc_last'); if (!first && !last) return App.toast('Saisissez au moins un nom');
      const t = $('qc_type') ? $('qc_type').value : 'gere';
      const c = { id: App.uid(), code: App.nextClientCode(), type: t, first, last, name: (first + ' ' + last).trim(), phone: App.v('qc_phone'), phone2: '', address: '', city: '', quarter: '', installAddr: '', acc: '', serial: '', kit: '', plan: '', price: 0, payMode: 'Cash', start: '', period: S.period, grace: S.grace, note: '', article: '', created: App.today(), subs: [] };
      if (t === 'gere') Object.assign(c, { acc: App.v('qc_acc'), plan: App.v('qc_plan'), price: App.n('qc_price'), start: App.v('qc_start') || App.today() });
      db.clients.push(c); App.log(c.id, 'Client créé (' + App.TYPES[t] + ')'); App.save();
      $('f_cl').innerHTML = App.opts(clientSel()); $('f_cl').value = c.id; $('f_cl').dispatchEvent(new Event('change'));
      ['qc_first', 'qc_last', 'qc_phone', 'qc_acc', 'qc_plan', 'qc_price'].forEach(i => { $(i).value = ''; }); qcClose(); App.toast('Client ajouté : ' + App.cname(c));
    };
    // behaviour
    $('f_prod').onchange = () => { const p = App.prod($('f_prod').value); if (p) { $('f_desc').value = p.name; $('f_price').value = App.conv(p.price, 'USD', cur()); } };
    // subscription invoice: the line follows the chosen client's plan and price
    const autoSub = () => {
      if (type !== 'abonnement') return;
      draft.lines = draft.lines.filter(l => !l.auto); const c = App.client(App.v('f_cl'));
      if (c && c.type === 'gere' && c.price > 0) draft.lines.unshift({ auto: true, pid: '', desc: 'Abonnement ' + (c.plan || 'Starlink'), qty: 1, price: App.conv(c.price, 'USD', cur()), cost: 0, unit: '' });
      else if (c) $('f_addsub').click();
    };
    $('f_cl').addEventListener('change', () => { autoSub(); draw(); });
    $('f_cur').onchange = () => { autoSub(); draw(); };
    $('f_add').onclick = () => {
      const p = App.prod($('f_prod').value), desc = App.v('f_desc') || (p && p.name), qty = App.n('f_qty');
      if (!desc || qty <= 0) return App.toast('Désignation et quantité requises');
      if (p && App.tracked(p)) { const inCart = draft.lines.filter(l => l.pid === p.id).reduce((a, l) => a + l.qty, 0); if (inCart + qty > p.qty && !App.confirm(`Stock insuffisant (${App.nf(p.qty, 2)}). Continuer quand même ?`)) return; }
      draft.lines.push({ pid: p ? p.id : '', desc, qty, price: App.n('f_price'), cost: p ? App.conv(p.cost, 'USD', cur()) : 0, unit: p ? (p.unit === 'm' ? 'm' : '') : '' });
      $('f_prod').value = ''; $('f_desc').value = ''; $('f_price').value = ''; $('f_qty').value = 1; draw();
    };
    $('f_addsub').onclick = () => { const c = App.client(App.v('f_cl')); $('f_prod').value = ''; $('f_desc').value = 'Abonnement ' + ((c && c.plan) || 'Starlink'); $('f_qty').value = 1; $('f_price').value = c && c.price ? App.conv(c.price, 'USD', cur()) : ''; $('f_price').focus(); };
    $('f_addinst').onclick = () => { $('f_prod').value = ''; $('f_desc').value = 'Installation Starlink'; $('f_qty').value = 1; $('f_price').value = ''; $('f_price').focus(); };
    $('f_paid').oninput = () => { draft.paidTouched = true; };
    if (type === 'abonnement') autoSub();
    if (type === 'installation') $('f_addinst').click();
    draw();
  };
  App.actions.rmline = d => { draft.lines.splice(+d.i, 1); const ev = new Event('change'); $('f_cur').dispatchEvent(ev); };

  // ---------- Invoice document (screen, print, Word) ----------
  const PAPER_CSS = `body{font:13px/1.4 Arial,sans-serif;color:#111;margin:18px}.paper .hd{display:flex;justify-content:space-between;gap:12px;border-bottom:3px solid #1e3f60;padding-bottom:10px}.paper .hd img{height:56px}.paper .co{text-align:right;font-size:12px}.paper .two{display:flex;gap:12px;margin:12px 0}.paper .box{border:1px solid #1e3f60;flex:1}.paper .box h4{margin:0;padding:4px 8px;background:#1e3f60;color:#fff;font-size:13px}.paper .box dl{margin:0;padding:6px 8px}.paper .box dl div{display:flex !important;gap:8px}.paper .box dt{width:90px;color:#555}.paper .box dd{margin:0}.paper table{width:100%;border-collapse:collapse}.paper th{background:#1e3f60;color:#fff;padding:6px;text-align:left}.paper td{padding:6px;border-bottom:1px solid #ccd}.paper .r{text-align:right}.paper .tot{margin-left:auto;width:300px;margin-top:8px}.paper .tot div{display:flex;justify-content:space-between;padding:3px 0}.paper .tot .g{font-weight:bold;font-size:15px;color:#d5522f;border-top:1px solid #1e3f60}.paper .words{margin-top:12px;font-style:italic}.paper .thx{text-align:center;color:#1e3f60;margin-top:16px;font-weight:bold}`;
  App.invoiceDoc = (i, logo) => {
    const co = App.db.settings.company, c = App.client(i.clientId), tot = App.invTotal(i), paid = App.invPaid(i), due = Math.max(0, tot - paid), other = i.currency === 'USD' ? 'CDF' : 'USD';
    const legal = [co.rccm && 'RCCM : ' + co.rccm, co.idnat && 'ID. Nat. : ' + co.idnat, co.impot && 'N° Impôt : ' + co.impot].filter(Boolean);
    const dl = (k, v) => `<div style="display:contents"><dt>${k}</dt><dd>${v}</dd></div>`;
    return `<div class="paper"><div class="hd"><div><img src="${esc(logo || co.logo || 'logo.png')}" alt=""><div><b>${esc(co.name)}</b></div></div>
      <div class="co"><b>Siège social :</b> ${esc(co.address)}<br>Tél : ${esc(co.phone)}<br>${esc(co.email)}${legal.length ? '<br>' + legal.map(esc).join('<br>') : ''}</div></div>
      <div class="two"><div class="box"><h4>FACTURE</h4><dl>${dl('Numéro', `<b>${esc(i.number)}</b>`)}${dl('Date', App.fdate(i.date))}${dl('Devise', i.currency === 'CDF' ? 'CDF' : 'USD')}${dl('Payé par', esc(i.payMode))}</dl></div>
      <div class="box"><h4>CLIENT</h4><dl>${dl('Nom', esc(App.cname(c)))}${dl('Code', esc(c ? c.code : '—'))}${dl('Adresse', esc(c ? (c.address || c.installAddr || '—') : '—'))}${dl('Téléphone', esc(c ? (c.phone || '—') : '—'))}</dl></div></div>
      <table><thead><tr><th>Produit / Description</th><th class="r">Qté</th><th class="r">PU (${i.currency === 'CDF' ? 'CDF' : '$'})</th><th class="r">Montant (${i.currency === 'CDF' ? 'CDF' : '$'})</th></tr></thead><tbody>${i.lines.map(l => `<tr><td>${esc(l.desc)}</td><td class="r">${App.nf(l.qty, 2)}${l.unit ? ' ' + esc(l.unit) : ''}</td><td class="r">${App.nf(l.price, 2)}</td><td class="r">${App.nf(l.qty * l.price, 2)}</td></tr>`).join('')}</tbody></table>
      <div class="tot"><div class="g"><span>Total :</span><span>${App.fmt(tot, i.currency)}</span></div><div><span>Montant payé :</span><span>${App.fmt(paid, i.currency)}</span></div><div><span>Solde :</span><span>${App.fmt(due, i.currency)}</span></div>
      <div style="font-size:12px;color:#555"><span>Taux du jour (1 $) :</span><span>${App.nf(App.rate(), 0)} CDF</span></div><div style="font-size:12px;color:#555"><span>Équivalent en ${other} :</span><span>${App.fmt(App.conv(tot, i.currency, other), other)}</span></div></div>
      <div class="words">Arrêtée la présente facture à la somme de : <b>${esc(App.amountWords(tot, i.currency))}</b>.</div><div class="thx">MERCI POUR VOTRE CONFIANCE</div></div>`;
  };
  const logoData = async () => {
    const co = App.db.settings.company; if ((co.logo || '').startsWith('data:')) return co.logo;
    try { const b = await (await fetch('logo.png')).blob(); return await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); } catch (e) { return ''; }
  };
  const printDoc = async inv => {
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    f.srcdoc = `<!doctype html><meta charset="utf-8"><title>${esc(inv.number)}</title><style>${PAPER_CSS}</style>${App.invoiceDoc(inv, await logoData())}`;
    f.onload = () => setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { App.toast('Impression indisponible'); } setTimeout(() => f.remove(), 60000); }, 400);
    document.body.appendChild(f);
  };
  const wordDoc = async inv => {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(inv.number)}</title><style>${PAPER_CSS}</style></head><body>${App.invoiceDoc(inv, await logoData())}</body></html>`;
    App.download(`${inv.number}.doc`, html, 'application/msword');
  };

  App.views.invoice = p => {
    const i = App.invoice(p.id); if (!i) return { title: 'Facture', back: 'invoices', html: '<div class="empty">Facture introuvable.</div>' };
    const [t, k] = App.INV[App.invStatus(i)], due = App.invDue(i), pays = App.db.payments.filter(x => x.invoiceId === i.id);
    return {
      title: i.number, sub: 'Aperçu de la facture', back: 'invoices', nav: 'more',
      html: `<div class="spread" style="margin-bottom:10px"><span class="pill ${k}">${t}</span><span class="mut">${App.invTypes[i.type]}</span></div>
        <div class="bar noprint">${due > 0.004 ? `<button class="btn" data-act="newpay" data-iid="${i.id}">💰 Encaisser (${App.fmt(due, i.currency)})</button>` : ''}<button class="btn sec" data-act="invpdf" data-id="${i.id}">📄 PDF</button><button class="btn sec" data-act="invprint" data-id="${i.id}">🖨️ Imprimer</button><button class="btn sec" data-act="invword" data-id="${i.id}">📝 Word</button></div>
        ${App.invoiceDoc(i)}
        ${pays.length ? `<h2 class="sec">Paiements reçus</h2><div class="list">${pays.map(x => `<div class="item"><div class="grow"><b>${App.fdate(x.date)} · ${esc(x.mode)}</b><small>${esc(x.ref || x.comment || '')}</small></div><b class="ok">${App.fmt(x.amount, x.currency)}</b></div>`).join('')}</div>` : ''}
        <div class="bar" style="margin-top:14px">${i.clientId ? `<button class="btn sec" data-act="go" data-v="client" data-id="${i.clientId}">Voir le client</button>` : ''}<button class="btn del" data-act="delinv" data-id="${i.id}">Supprimer la facture</button></div>`
    };
  };
  App.actions.invpdf = d => { App.toast('Choisissez « Enregistrer au format PDF »'); printDoc(App.invoice(d.id)); };
  App.actions.invprint = d => printDoc(App.invoice(d.id));
  App.actions.invword = d => wordDoc(App.invoice(d.id));
  App.actions.delinv = d => {
    const i = App.invoice(d.id); if (!App.confirm(`Supprimer la facture ${i.number} ? Le stock sera remis et ses paiements supprimés.`)) return;
    i.lines.forEach(l => { const p = l.pid && App.prod(l.pid); if (p && App.tracked(p)) App.move({ pid: p.id, qty: l.qty, invoiceId: '', clientId: i.clientId, note: 'Annulation ' + i.number }); });
    const db = App.db; db.invoices = db.invoices.filter(x => x !== i); db.payments = db.payments.filter(p => p.invoiceId !== i.id); db.installs = db.installs.filter(x => x.invoiceId !== i.id);
    App.log(i.clientId, `Facture ${i.number} supprimée`); App.save(); App.toast('Facture supprimée'); App.go('invoices', {}, true);
  };

  // ---------- Payments ----------
  App.paymentForm = (pre = {}) => {
    const db = App.db;
    const invOpts = cid => [['', '— Sans facture —'], ...db.invoices.filter(i => App.invDue(i) > 0.004 && (!cid || i.clientId === cid)).map(i => [i.id, `${i.number} · ${App.cname(App.client(i.clientId))} · reste ${App.fmt(App.invDue(i), i.currency)}`])];
    const inv0 = App.invoice(pre.invoiceId), cid0 = pre.clientId || (inv0 && inv0.clientId) || '';
    App.modal('Nouveau paiement',
      `${F.sel('f_cl', 'Client', App.clientOpts('— Aucun —'), cid0)}${F.sel('f_inv', 'Facture', invOpts(cid0), pre.invoiceId || '')}
       <div class="row">${F.num('f_amt', 'Montant', inv0 ? App.invDue(inv0) : '')}${F.sel('f_cur', 'Devise', CUR, inv0 ? inv0.currency : 'USD')}</div>
       <div class="row">${F.date('f_date', 'Date', App.today())}${F.sel('f_mode', 'Mode de paiement', App.PAY_MODES, 'Cash')}</div>
       ${F.text('f_ref', 'Référence (n° transaction)', '')}${F.text('f_com', 'Commentaire', '')}`,
      () => {
        const amt = App.n('f_amt'); if (amt <= 0) { App.toast('Montant invalide'); return false; }
        const i = App.invoice(App.v('f_inv')), cid = App.v('f_cl') || (i ? i.clientId : '');
        db.payments.push({ id: App.uid(), date: App.v('f_date') || App.today(), clientId: cid, invoiceId: i ? i.id : '', amount: amt, currency: i ? i.currency : App.v('f_cur'), mode: App.v('f_mode'), ref: App.v('f_ref'), comment: App.v('f_com') });
        App.log(cid, `Paiement ${App.fmt(amt, i ? i.currency : App.v('f_cur'))} (${App.v('f_mode')})${i ? ' · ' + i.number : ''}`);
        App.save(); App.toast('Paiement enregistré'); App.refresh();
      }, 'Enregistrer le paiement');
    $('f_cl').onchange = () => { $('f_inv').innerHTML = App.opts(invOpts($('f_cl').value)); };
    $('f_inv').onchange = () => { const i = App.invoice($('f_inv').value); if (i) { $('f_amt').value = App.invDue(i); $('f_cur').value = i.currency; if (!$('f_cl').value) $('f_cl').value = i.clientId; } };
  };
  App.actions.newpay = d => App.paymentForm({ clientId: d.cid, invoiceId: d.iid });

  const pq = { mode: 'all' };
  App.views.payments = () => {
    const all = App.db.payments.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)), l = all.filter(p => pq.mode === 'all' || p.mode === pq.mode);
    const by = {}; all.forEach(p => { by[p.mode] = (by[p.mode] || 0) + App.usd(p.amount, p.currency); });
    return {
      title: 'Paiements', sub: `${all.length} paiement(s)`, back: 'more', nav: 'more',
      html: `<div class="bar"><button class="btn" data-act="newpay">+ Paiement</button></div>
        <div class="chips"><button class="chip ${pq.mode === 'all' ? 'on' : ''}" data-act="paymode" data-m="all">Tous</button>${App.PAY_MODES.filter(m => by[m]).map(m => `<button class="chip ${pq.mode === m ? 'on' : ''}" data-act="paymode" data-m="${esc(m)}">${esc(m)} · ${App.fmt(by[m])}</button>`).join('')}</div>
        ${l.length ? `<div class="list">${l.map(p => { const i = App.invoice(p.invoiceId); return `<div class="item"><div class="grow"><b>${esc(App.cname(App.client(p.clientId)))}</b><small>${App.fdate(p.date)} · ${esc(p.mode)}${i ? ' · ' + esc(i.number) : ''}${p.ref ? ' · ' + esc(p.ref) : ''}</small></div><b class="ok">${App.fmt(p.amount, p.currency)}</b><button class="btn sm del" data-act="delpay" data-id="${p.id}">✕</button></div>`; }).join('')}</div>` : '<div class="empty">Aucun paiement.</div>'}`
    };
  };
  App.actions.paymode = d => { pq.mode = d.m; App.refresh(); };
  App.actions.delpay = d => { if (!App.confirm('Supprimer ce paiement ?')) return; App.db.payments = App.db.payments.filter(p => p.id !== d.id); App.save(); App.refresh(); };

  // ---------- Expenses ----------
  App.views.expenses = () => {
    const l = App.db.expenses.slice().sort((a, b) => b.date.localeCompare(a.date)), m = App.today().slice(0, 7), mt = l.filter(e => e.date.startsWith(m)).reduce((a, e) => a + App.usd(e.amount, e.currency), 0);
    return {
      title: 'Dépenses', sub: `Ce mois : ${App.fmt(mt)}`, back: 'more', nav: 'more',
      html: `<div class="bar"><button class="btn" data-act="newexp">+ Dépense</button><button class="btn sec" data-csv="depenses">CSV</button></div>` + (l.length ? `<div class="list">${l.map(e => `<div class="item"><div class="grow"><b>${esc(e.label)}</b><small>${App.fdate(e.date)} · ${esc(e.cat)}</small></div><b>${App.fmt(e.amount, e.currency)}</b><button class="btn sm del" data-act="delexp" data-id="${e.id}">✕</button></div>`).join('')}</div>` : '<div class="empty">Aucune dépense.</div>')
    };
  };
  App.actions.newexp = () => App.modal('Nouvelle dépense', `${F.text('f_label', 'Libellé', '')}${F.sel('f_cat', 'Catégorie', App.EXP_CATS)}<div class="row">${F.num('f_amt', 'Montant', '')}${F.sel('f_cur', 'Devise', CUR, 'USD')}</div>${F.date('f_date', 'Date', App.today())}`, () => {
    if (!App.v('f_label') || App.n('f_amt') <= 0) { App.toast('Libellé et montant requis'); return false; }
    App.db.expenses.push({ id: App.uid(), label: App.v('f_label'), cat: App.v('f_cat'), amount: App.n('f_amt'), currency: App.v('f_cur'), date: App.v('f_date') || App.today() }); App.save(); App.refresh();
  });
  App.actions.delexp = d => { if (!App.confirm('Supprimer cette dépense ?')) return; App.db.expenses = App.db.expenses.filter(e => e.id !== d.id); App.save(); App.refresh(); };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-csv="depenses"]'); if (!b) return;
    App.download(`cispolstore-depenses-${App.today()}.csv`, App.csv([['Date', 'Libellé', 'Catégorie', 'Montant', 'Devise'], ...App.db.expenses.map(x => [x.date, x.label, x.cat, x.amount, x.currency])]), 'text/csv');
  });
})();
