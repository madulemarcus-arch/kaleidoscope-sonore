// Invoices (4 types, automatic numbering, PDF/Word/print), payments and expenses.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const CUR = [['USD', 'Dollar ($)'], ['CDF', 'Franc congolais (CDF)']];

  // ---------- Creation (shared with subscription renewal) ----------
  // stock leaves when the sale is real (at creation, or when a pending invoice is validated)
  App.invMoves = inv => inv.lines.forEach(l => { const p = l.pid && App.prod(l.pid); if (p && App.tracked(p)) App.move({ pid: p.id, qty: -l.qty, invoiceId: inv.id, clientId: inv.clientId, date: inv.date, note: 'Facture ' + inv.number }); });
  // subscription renewal + installation record that a sale triggers (kept in inv.fx while the invoice is pending)
  App.applyFx = (inv, fx) => {
    const db = App.db, c = App.client(inv.clientId), date = inv.date;
    if (fx.renewed && c) {
      inv.renew = { prev: fx.prevSub, ns: fx.renewed.ns, date };
      if (c.start) (c.subs = c.subs || []).push({ start: c.start, days: c.period || fx.renewed.days, price: c.price || 0, date });
      Object.assign(c, { start: fx.renewed.ns, period: fx.renewed.days }); App.log(c.id, `Abonnement renouvelé : ${App.fdate(fx.renewed.ns)} → ${App.fdate(fx.renewed.end)}`);
    }
    if (fx.inst && inv.clientId) { db.installs.push({ id: App.uid(), clientId: inv.clientId, date, kind: 'Installation Starlink', tech: fx.inst.tech, techId: App.techId(fx.inst.tech), price: App.conv(fx.inst.fee, inv.currency, 'USD', inv.rate), materials: fx.inst.mats, invoiceId: inv.id, obs: fx.inst.obs }); App.log(inv.clientId, 'Installation facturée ' + inv.number); }
  };
  App.validateInvoice = id => { const i = App.invoice(id); if (!i || !i.pending) return; const fx = i.fx || {}; delete i.pending; delete i.fx; i.validated = App.today(); App.invMoves(i); App.applyFx(i, fx); App.log(i.clientId, `Vente validée : ${i.number}`); App.save(); };
  App.createInvoice = (inv, paid = 0) => {
    const db = App.db, date = inv.date || App.today();
    Object.assign(inv, { id: App.uid(), number: App.nextInvNumber(date.slice(0, 4)), date, ts: Date.now(), note: inv.note || '', rate: +inv.rate > 0 ? +inv.rate : App.rateOn(date) });
    App.costSubLines(inv);
    db.invoices.push(inv);
    if (!inv.pending) App.invMoves(inv);
    const pa = +inv.payAmount > 0 ? { amount: +inv.payAmount, cur: inv.payCur || inv.currency, ref: inv.payRef || '' } : paid > 0 ? { amount: paid, cur: inv.currency, ref: '' } : null;
    delete inv.payAmount; delete inv.payCur; delete inv.payRef;
    if (pa) db.payments.push({ id: App.uid(), date, clientId: inv.clientId, invoiceId: inv.id, amount: pa.amount, currency: pa.cur, rate: inv.rate, mode: inv.payMode, ref: pa.ref, comment: '' });
    App.log(inv.clientId, `Facture ${inv.number} : ${App.fmt(App.invTotal(inv), inv.currency)}`);
    return inv;
  };

  // ---------- Invoice list ----------
  // pending invoices left undecided for a few days: the client should either take the product or drop it
  const PEND_DAYS = 3, pendAge = i => Math.max(0, App.diff(i.date, App.today()));
  App.stalePending = () => App.db.invoices.filter(i => i.pending && pendAge(i) >= PEND_DAYS).sort((a, b) => a.date.localeCompare(b.date));
  App.actions.pend_go = () => { st.f = 'pending'; App.go('invoices'); };
  const st = { f: 'all', q: '', sel: false, picked: new Set() };
  const visibleInvoices = () => { const q = st.q.toLowerCase(); return App.db.invoices.filter(i => (st.f === 'all' || App.invStatus(i) === st.f) && (!q || (i.number + ' ' + App.cname(App.client(i.clientId))).toLowerCase().includes(q))).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)); };
  const drawList = () => {
    const l = visibleInvoices();
    if ($('ibar')) $('ibar').innerHTML = !App.guard('delinvs') ? '' : st.sel ? `<button class="btn sm sec" data-act="inv_all">☑ Tout</button><button class="btn sm del" data-act="delinvs">🗑 Supprimer (${st.picked.size})</button><button class="btn sm sec" data-act="inv_sel">Terminer</button>` : '<button class="btn sm sec" data-act="inv_sel">☑ Sélectionner pour supprimer</button>';
    $('ilist').innerHTML = l.length ? `<div class="list">${l.map(i => { const [t, k] = App.INV[App.invStatus(i)]; return `<button class="item" data-act="${st.sel ? 'inv_pick' : 'go'}" data-v="invoice" data-id="${i.id}">${st.sel ? `<span style="font-size:20px">${st.picked.has(i.id) ? '☑️' : '⬜'}</span>` : ''}<div class="grow"><b>${esc(i.number)}</b><small>${esc(App.cname(App.client(i.clientId)))} · ${App.fdate(i.date)} · ${App.invTypes[i.type]}${i.pending ? ` · <span class="${pendAge(i) >= PEND_DAYS ? 'bad' : 'warn'}">⏳ ${pendAge(i)} j</span>` : ''}</small></div><div class="end"><b>${App.fmt(App.invTotal(i), i.currency)}</b><span class="pill ${k}">${t}</span></div></button>`; }).join('')}</div>` : '<div class="empty">Aucune facture.</div>';
  };
  App.views.invoices = () => {
    const db = App.db, tot = db.invoices.filter(App.live).reduce((a, i) => a + App.usd(App.invAgreed(i), i.currency, i), 0), due = db.invoices.reduce((a, i) => a + App.usd(App.invDue(i), i.currency, i), 0);
    return {
      title: 'Factures', sub: `${db.invoices.length} facture(s)`, back: 'more', nav: 'more',
      html: `<div class="grid two"><div class="stat"><small>Total facturé</small><b>${App.fmt(tot)}</b></div><div class="stat"><small>Reste à encaisser</small><b class="${due ? 'warn' : ''}">${App.fmt(due)}</b></div></div>
        <div class="search"><input id="iq" placeholder="Rechercher un numéro, un client…" value="${esc(st.q)}" autocomplete="off"></div>
        <div class="chips">${[['all', 'Toutes'], ['unpaid', 'Impayées'], ['part', 'Partielles'], ['paid', 'Payées'], ['pending', 'En attente']].map(([k, t]) => `<button class="chip ${st.f === k ? 'on' : ''}" data-act="invfilter" data-f="${k}">${t}</button>`).join('')}</div>
        <div class="bar" id="ibar" style="margin-bottom:6px"></div><div id="ilist"></div><button class="btn full" data-act="newinv" style="margin-top:14px">+ Nouvelle facture</button>`,
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
      if (!draft.paidTouched) $('f_paid').value = t ? round(App.conv(t, cur(), $('f_pcur').value, frate()), $('f_pcur').value) : '';
      paySync();
    };
    const round = (n, c) => c === 'CDF' ? Math.round(n) : Math.round(n * 100) / 100;
    const paySync = () => {
      if (!$('p_sum')) return;
      const c = cur(), pc = $('f_pcur').value, rate = frate(), tot = total(), given = App.n('f_paid'), gInv = App.conv(given, pc, c, rate);
      $('p_total').textContent = App.fmt(tot, c) + (pc !== c ? ' ≈ ' + App.fmt(App.conv(tot, c, pc, rate), pc) : '');
      const el = $('p_sum'); const canNeg = given > 0 && gInv < tot - 0.004; $('p_negw').style.display = canNeg ? '' : 'none'; if (!canNeg) $('f_neg').checked = false;
      if (!(given > 0)) { el.className = 'warn'; el.textContent = tot ? `Aucun paiement enregistré : la facture restera impayée (reste ${App.fmt(tot, c)}).` : ''; }
      else if (gInv >= tot - 0.004) { el.className = 'ok'; el.textContent = '✅ Payée en totalité' + (gInv - tot > 0.004 ? ` · À rendre au client : ${App.fmt(round(App.conv(gInv - tot, c, pc, rate), pc), pc)}` : ''); }
      else { el.className = 'warn'; el.textContent = `Le client a donné ${App.fmt(given, pc)} · Reste à payer : ${App.fmt(tot - gInv, c)}` + ($('f_neg').checked ? ' → sera soldée au prix convenu' : ''); }
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
       <div class="row">${F.date('f_date', 'Date', App.today())}${F.sel('f_cur', 'Devise', CUR, 'USD')}</div>
       ${F.num('f_rate', 'Taux du jour (1 $ = … CDF)', App.rate(), 'min="1" step="1"')}<p class="mut" style="font-size:12px;margin:2px 0 0">Le taux est enregistré sur cette facture. Si vous le changez ici, il devient le taux du jour.</p>
       <h2 class="sec">Lignes de la facture</h2><div id="cart"></div>
       <div class="card" style="margin-top:10px">
         ${F.sel('f_prod', 'Article du stock / catalogue', [['', '— Ligne libre —'], ...db.products.map(p => [p.id, p.name + (App.tracked(p) ? ` (${App.nf(p.qty, 2)}${p.unit === 'm' ? ' m' : ''})` : '')])], '')}
         ${F.text('f_desc', 'Désignation', '')}
         <div class="row">${F.num('f_qty', 'Quantité', 1, 'min="0"')}${F.num('f_price', 'Prix unitaire', '')}<div style="flex:none;min-width:auto;align-self:end"><button type="button" class="btn" id="f_add">Ajouter</button></div></div>
         <div class="bar"><button type="button" class="btn sm sec" id="f_addsub">＋ Abonnement</button><button type="button" class="btn sm sec" id="f_addinst">＋ Installation</button></div></div>
       ${renewBlock}${instBlock}
       <label class="chk" style="display:block;margin-top:14px;padding:10px;border:2px dashed var(--acc);border-radius:10px"><input type="checkbox" id="f_pend"> <b>⏳ Facture en attente</b> : le client demande seulement la facture et n'a pas encore pris le produit. Rien n'est déduit du stock ni compté dans les ventes jusqu'à la validation.</label>
       <div class="card" id="paycard" style="margin-top:14px;border:2px solid var(--acc)">
         <h2 class="sec" style="margin:0 0 6px">💰 Paiement du client</h2>
         <div class="spread"><span>Total à payer</span><b id="p_total" style="font-size:18px"></b></div>
         <div class="row">${F.num('f_paid', 'Le client a donné', '')}${F.sel('f_pcur', 'En', CUR, 'USD')}</div>
         <div class="bar"><button type="button" class="btn sm sec" id="p_all">Tout payé</button><button type="button" class="btn sm sec" id="p_half">La moitié</button><button type="button" class="btn sm sec" id="p_none">Rien pour l'instant</button></div>
         <div class="row">${F.sel('f_pay', 'Mode de paiement', App.PAY_MODES, 'Cash')}${F.text('f_ref', 'Référence (n° transaction)', '')}</div>
         <div id="p_sum" style="margin-top:8px;font-weight:700"></div>
         <label id="p_negw" class="chk" style="display:none;margin-top:8px"><input type="checkbox" id="f_neg"> Le client a marchandé : ce qu'il a donné est le prix convenu (facture soldée, la facture imprimée reste au prix complet)</label>
       </div>`,
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
        const total = lines.reduce((a, l) => a + l.qty * l.price, 0);
        const rate = frate(); if (rate !== App.rate()) App.setRate(rate);
        const pc = App.v('f_pcur') || curr, given = App.n('f_paid'), gInv = App.conv(given, pc, curr, rate), payAmount = given > 0 ? (gInv > total ? round(App.conv(total, curr, pc, rate), pc) : given) : 0;
        const prevSub = c ? { start: c.start || '', period: c.period, price: c.price } : null;
        const pend = !!($('f_pend') && $('f_pend').checked), inv = App.createInvoice({ type, clientId: cid, currency: curr, payMode: mode, date, lines, rate, pending: pend || undefined, payAmount: pend ? 0 : payAmount, payCur: pc, payRef: App.v('f_ref') }, 0);
        const fx = { renewed, prevSub };
        if (['installation', 'complete'].includes(type) && cid) {
          const fee = lines.filter(l => !l.pid && /install/i.test(l.desc)).reduce((a, l) => a + l.qty * l.price, 0);
          const mats = lines.filter(l => l.pid && App.tracked(App.prod(l.pid))).map(l => ({ pid: l.pid, qty: l.qty }));
          if (fee > 0 || type === 'installation') fx.inst = { fee, mats, tech: App.v('f_tech'), obs: App.v('f_obs') };
        }
        if (inv.pending) inv.fx = fx; else App.applyFx(inv, fx);
        if (!pend && $('f_neg') && $('f_neg').checked && gInv > 0 && gInv < total - 0.004) { inv.agreed = Math.round(gInv * 100) / 100; App.log(cid, `Prix négocié sur ${inv.number} : ${App.fmt(inv.agreed, curr)} au lieu de ${App.fmt(total, curr)}`); }
        App.save(); App.toast('Facture ' + inv.number + (pend ? ' créée — en attente' : ' créée')); App.go('invoice', { id: inv.id });
        const np = db.payments.find(x => x.invoiceId === inv.id);
        if (np) App.undoBar('Paiement enregistré : ' + App.fmt(np.amount, np.currency), () => App.actions.recprint({ id: np.id }), '🧾 Imprimer le reçu');
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
    const frate = () => +$('f_rate').value > 0 ? +$('f_rate').value : App.rate();
    $('f_rate').onchange = () => { autoSub(); draw(); };
    $('f_date').onchange = () => { const r = App.rateOn($('f_date').value || App.today()); $('f_rate').value = r; autoSub(); draw(); };
    $('f_prod').onchange = () => { const p = App.prod($('f_prod').value); if (p) { $('f_desc').value = p.name; $('f_price').value = App.conv(p.price, 'USD', cur(), frate()); } };
    // subscription invoice: the line follows the chosen client's plan and price
    const autoSub = () => {
      if (type !== 'abonnement') return;
      draft.lines = draft.lines.filter(l => !l.auto); const c = App.client(App.v('f_cl'));
      if (c && c.type === 'gere' && c.price > 0) draft.lines.unshift({ auto: true, pid: '', desc: 'Abonnement ' + (c.plan || 'Starlink'), qty: 1, price: App.conv(c.price, 'USD', cur(), frate()), cost: 0, unit: '' });
      else if (c) $('f_addsub').click();
    };
    $('f_cl').addEventListener('change', () => { autoSub(); draw(); });
    $('f_cur').onchange = () => { $('f_pcur').value = cur(); draft.paidTouched = false; autoSub(); draw(); };
    $('f_add').onclick = () => {
      const p = App.prod($('f_prod').value), desc = App.v('f_desc') || (p && p.name), qty = App.n('f_qty');
      if (!desc || qty <= 0) return App.toast('Désignation et quantité requises');
      if (p && App.tracked(p)) { const inCart = draft.lines.filter(l => l.pid === p.id).reduce((a, l) => a + l.qty, 0); if (inCart + qty > p.qty && !App.confirm(`Stock insuffisant (${App.nf(p.qty, 2)}). Continuer quand même ?`)) return; }
      draft.lines.push({ pid: p ? p.id : '', desc, qty, price: App.n('f_price'), cost: p ? App.conv(p.cost, 'USD', cur(), frate()) : 0, unit: p ? (p.unit === 'm' ? 'm' : '') : '' });
      $('f_prod').value = ''; $('f_desc').value = ''; $('f_price').value = ''; $('f_qty').value = 1; draw();
    };
    $('f_addsub').onclick = () => { const c = App.client(App.v('f_cl')); $('f_prod').value = ''; $('f_desc').value = 'Abonnement ' + ((c && c.plan) || 'Starlink'); $('f_qty').value = 1; $('f_price').value = c && c.price ? App.conv(c.price, 'USD', cur(), frate()) : ''; $('f_price').focus(); };
    $('f_addinst').onclick = () => { $('f_prod').value = ''; $('f_desc').value = 'Installation Starlink'; $('f_qty').value = 1; $('f_price').value = ''; $('f_price').focus(); };
    $('f_pend').onchange = () => { $('paycard').style.display = $('f_pend').checked ? 'none' : ''; }; $('f_neg').onchange = paySync; $('f_paid').oninput = () => { draft.paidTouched = true; paySync(); };
    $('f_pcur').onchange = () => { draft.paidTouched = false; draw(); };
    $('p_all').onclick = () => { draft.paidTouched = true; $('f_paid').value = round(App.conv(total(), cur(), $('f_pcur').value, frate()), $('f_pcur').value); paySync(); };
    $('p_half').onclick = () => { draft.paidTouched = true; $('f_paid').value = round(App.conv(total() / 2, cur(), $('f_pcur').value, frate()), $('f_pcur').value); paySync(); };
    $('p_none').onclick = () => { draft.paidTouched = true; $('f_paid').value = 0; paySync(); };
    if (type === 'abonnement') autoSub();
    if (type === 'installation') $('f_addinst').click();
    draw();
  };
  App.actions.rmline = d => { draft.lines.splice(+d.i, 1); const ev = new Event('change'); $('f_cur').dispatchEvent(ev); };

  // ---------- Invoice document (screen, print, Word) ----------
  // payments of an invoice in the order they were received, with the balance left after each one
  App.invPayments = i => {
    let left = App.invTotal(i);
    return App.db.payments.map((p, k) => ({ p, k })).filter(x => x.p.invoiceId === i.id).sort((a, b) => a.p.date.localeCompare(b.p.date) || a.k - b.k).map(({ p }, n) => {
      const inInv = App.conv(p.amount, p.currency, i.currency, App.rateOf(p)); left = Math.max(0, left - inInv);
      return { p, n: n + 1, inInv, left, other: p.currency !== i.currency };
    });
  };
  // receipt number: invoice number + order of the payment ("FAC-2026-0002-P2")
  App.receiptNo = p => { const i = App.invoice(p.invoiceId); if (!i) return 'REC-' + (p.date || '').replace(/-/g, '') + '-' + String(p.id).slice(-4).toUpperCase(); const x = App.invPayments(i).find(y => y.p === p); return i.number + '-P' + (x ? x.n : 1); };

  const PAPER_CSS = `body{font:13px/1.4 Arial,sans-serif;color:#111;margin:18px}.paper .hd{display:flex;justify-content:space-between;gap:12px;border-bottom:3px solid #1e3f60;padding-bottom:10px}.paper .hd img{height:56px}.paper .co{text-align:right;font-size:12px}.paper .two{display:flex;gap:12px;margin:12px 0}.paper .box{border:1px solid #1e3f60;flex:1}.paper .box h4{margin:0;padding:4px 8px;background:#1e3f60;color:#fff;font-size:13px}.paper .box dl{margin:0;padding:6px 8px}.paper .box dl div{display:flex !important;gap:8px}.paper .box dt{width:90px;color:#555}.paper .box dd{margin:0}.paper table{width:100%;border-collapse:collapse}.paper th{background:#1e3f60;color:#fff;padding:6px;text-align:left}.paper td{padding:6px;border-bottom:1px solid #ccd}.paper .r{text-align:right}.paper .tot{margin-left:auto;width:300px;margin-top:8px}.paper .tot div{display:flex;justify-content:space-between;padding:3px 0}.paper .tot .g{font-weight:bold;font-size:15px;color:#d5522f;border-top:1px solid #1e3f60}.paper .words{margin-top:12px;font-style:italic}.paper .thx{text-align:center;color:#1e3f60;margin-top:16px;font-weight:bold}.paper .pay{margin-top:14px}.paper .pay h4{margin:0 0 4px;color:#1e3f60}.paper .pay td,.paper .pay th{font-size:12px}.paper .sold{display:inline-block;margin-top:8px;padding:3px 10px;border:2px solid #1d8a4f;color:#1d8a4f;font-weight:bold;transform:rotate(-3deg)}.paper .sig{display:flex;gap:30px;margin-top:34px}.paper .sig div{flex:1;border-top:1px solid #555;padding-top:4px;text-align:center;font-size:12px;color:#555}.paper .rc{border:2px solid #1e3f60;padding:14px;margin-top:14px;font-size:15px;line-height:1.7}.paper .rc b.big{font-size:20px;color:#d5522f}`;
  App.invoiceDoc = (i, logo) => {
    const co = App.db.settings.company, c = App.client(i.clientId), tot = App.invTotal(i), other = i.currency === 'USD' ? 'CDF' : 'USD';
    const legal = [co.rccm && 'RCCM : ' + co.rccm, co.idnat && 'ID. Nat. : ' + co.idnat, co.impot && 'N° Impôt : ' + co.impot].filter(Boolean);
    const dl = (k, v) => `<div style="display:contents"><dt>${k}</dt><dd>${v}</dd></div>`;
    return `<div class="paper"><div class="hd"><div><img src="${esc(logo || co.logo || 'logo.png')}" alt=""><div><b>${esc(co.name)}</b></div></div>
      <div class="co"><b>Siège social :</b> ${esc(co.address)}<br>Tél : ${esc(co.phone)}<br>${esc(co.email)}${legal.length ? '<br>' + legal.map(esc).join('<br>') : ''}</div></div>
      <div class="two"><div class="box"><h4>FACTURE</h4><dl>${dl('Numéro', `<b>${esc(i.number)}</b>`)}${dl('Date', App.fdate(i.date))}${dl('Devise', i.currency === 'CDF' ? 'CDF' : 'USD')}${dl('Payé par', esc(i.payMode))}</dl></div>
      <div class="box"><h4>CLIENT</h4><dl>${dl('Nom', `<b style="font-size:1.1em">${esc(App.cname(c))}</b>`)}${dl('Code', esc(c ? c.code : '—'))}${dl('Adresse', esc(c ? (c.address || c.installAddr || '—') : '—'))}${dl('Téléphone', esc(c ? (c.phone || '—') : '—'))}</dl></div></div>
      <table><thead><tr><th>Produit / Description</th><th class="r">Qté</th><th class="r">PU (${i.currency === 'CDF' ? 'CDF' : '$'})</th><th class="r">Montant (${i.currency === 'CDF' ? 'CDF' : '$'})</th></tr></thead><tbody>${i.lines.map(l => `<tr><td>${esc(l.desc)}</td><td class="r">${App.nf(l.qty, 2)}${l.unit ? ' ' + esc(l.unit) : ''}</td><td class="r">${App.nf(l.price, 2)}</td><td class="r">${App.nf(l.qty * l.price, 2)}</td></tr>`).join('')}</tbody></table>
      <div class="tot"><div class="g"><span>Total :</span><span>${App.fmt(tot, i.currency)}</span></div>
      <div style="font-size:12px;color:#555"><span>Taux appliqué (1 $) :</span><span>${App.nf(App.rateOf(i), 0)} CDF</span></div><div style="font-size:12px;color:#555"><span>Équivalent en ${other} :</span><span>${App.fmt(App.conv(tot, i.currency, other, App.rateOf(i)), other)}</span></div></div>
      <div class="words">Arrêtée la présente facture à la somme de : <b>${esc(App.amountWords(tot, i.currency))}</b>.</div><div class="thx">MERCI POUR VOTRE CONFIANCE</div></div>`;
  };
  // ---------- Payment receipt ----------
  App.receiptDoc = (p, logo) => {
    const co = App.db.settings.company, c = App.client(p.clientId), i = App.invoice(p.invoiceId), legal = [co.rccm && 'RCCM : ' + co.rccm, co.idnat && 'ID. Nat. : ' + co.idnat, co.impot && 'N° Impôt : ' + co.impot].filter(Boolean);
    const dl = (k, v) => `<div style="display:contents"><dt>${k}</dt><dd>${v}</dd></div>`;
    let after = '';
    if (i) { const x = App.invPayments(i).find(y => y.p === p), tot = App.invTotal(i), paid = App.invPaid(i), due = Math.max(0, tot - paid);
      after = `<div class="two"><div class="box"><h4>FACTURE ${esc(i.number)}</h4><dl>${dl('Date', App.fdate(i.date))}${dl('Total', App.fmt(tot, i.currency))}${dl('Déjà payé', App.fmt(paid, i.currency))}${dl('Reste', `<b>${App.fmt(due, i.currency)}</b>`)}</dl></div></div>${x && x.left <= 0.004 ? '<div class="sold">FACTURE SOLDÉE</div>' : ''}`; }
    return `<div class="paper"><div class="hd"><div><img src="${esc(logo || co.logo || 'logo.png')}" alt=""><div><b>${esc(co.name)}</b></div></div>
      <div class="co"><b>Siège social :</b> ${esc(co.address)}<br>Tél : ${esc(co.phone)}<br>${esc(co.email)}${legal.length ? '<br>' + legal.map(esc).join('<br>') : ''}</div></div>
      <div class="two"><div class="box"><h4>REÇU DE PAIEMENT</h4><dl>${dl('N°', `<b>${esc(App.receiptNo(p))}</b>`)}${dl('Date', App.fdate(p.date))}${dl('Mode', esc(p.mode))}${p.ref ? dl('Référence', esc(p.ref)) : ''}</dl></div>
      <div class="box"><h4>CLIENT</h4><dl>${dl('Nom', `<b style="font-size:1.1em">${esc(App.cname(c))}</b>`)}${dl('Code', esc(c ? c.code : '—'))}${dl('Téléphone', esc(c ? (c.phone || '—') : '—'))}</dl></div></div>
      <div class="rc">Nous avons reçu de <b>${esc(App.cname(c))}</b> la somme de <b class="big">${App.fmt(p.amount, p.currency)}</b> <i>(${esc(App.amountWords(p.amount, p.currency))})</i>${i ? ` en paiement de la facture <b>${esc(i.number)}</b>` : ''}${p.comment ? ` — ${esc(p.comment)}` : ''}.</div>
      ${after}<div class="sig"><div>Le client</div><div>${esc(co.name)}</div></div><div class="thx">MERCI POUR VOTRE CONFIANCE</div></div>`;
  };
  const printRaw = async (title, html) => {
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    f.srcdoc = `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><style>${PAPER_CSS}</style>${html}`;
    f.onload = () => setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { App.toast('Impression indisponible'); } setTimeout(() => f.remove(), 60000); }, 400);
    document.body.appendChild(f);
  };
  App.actions.recprint = async d => { const p = App.db.payments.find(x => x.id === d.id); if (p) printRaw('Reçu ' + App.receiptNo(p), App.receiptDoc(p, await logoData())); };
  App.actions.recword = async d => { const p = App.db.payments.find(x => x.id === d.id); if (!p) return; const no = App.receiptNo(p);
    App.download(`Reçu-${no}.doc`, `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Reçu ${esc(no)}</title><style>${PAPER_CSS}</style></head><body>${App.receiptDoc(p, await logoData())}</body></html>`, 'application/msword'); };

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
      title: 'Facture', sub: i.number, back: 'invoices', nav: 'more',
      html: `<div class="spread" style="margin-bottom:10px"><span class="pill ${k}">${t}</span><span class="mut">${App.invTypes[i.type]}</span></div>
        <div class="card" style="margin-bottom:10px"><div class="spread"><span>Total de la facture imprimée</span><b>${App.fmt(App.invTotal(i), i.currency)}</b></div>${App.invAgreed(i) < App.invTotal(i) - 0.004 ? `<div class="spread"><span>Prix convenu (négocié)</span><b>${App.fmt(App.invAgreed(i), i.currency)}</b></div>` : ''}<div class="spread"><span>Reçu du client</span><b class="ok">${App.fmt(App.invPaid(i), i.currency)}</b></div><div class="spread"><span>Reste à payer</span><b class="${due > 0.004 ? 'bad' : 'ok'}">${App.fmt(due, i.currency)}</b></div></div>
        ${i.pending ? `<div class="card noprint" style="margin-bottom:10px;border:2px solid var(--warn,#e8a317)"><b>⏳ Facture en attente</b><p class="mut" style="margin:6px 0">Le client a la facture mais la vente n'est pas encore faite : le stock n'est pas déduit, rien n'est compté dans les ventes ni dans les impayés.</p><div class="bar"><button class="btn" data-act="invvalid" data-id="${i.id}">✅ Le client prend le produit</button><button class="btn del" data-act="invcancel" data-id="${i.id}">✖ Le client n'en veut plus</button></div></div>` : ''}
        <div class="bar noprint"><button class="btn sec" data-act="dl_fromInv" data-id="${i.id}">🚚 Livraison</button>${due > 0.004 ? `<button class="btn" data-act="newpay" data-iid="${i.id}">💰 Encaisser (${App.fmt(due, i.currency)})</button>` : ''}${due > 0.004 && App.invPaid(i) > 0.004 ? `<button class="btn sec" data-act="invneg" data-id="${i.id}">🤝 Solder au prix négocié</button>` : ''}${App.invAgreed(i) < App.invTotal(i) - 0.004 ? `<button class="btn sec" data-act="invunneg" data-id="${i.id}">↩ Annuler le prix négocié</button>` : ''}<button class="btn sec" data-act="invpdf" data-id="${i.id}">📄 PDF</button><button class="btn sec" data-act="invprint" data-id="${i.id}">🖨️ Imprimer</button><button class="btn sec" data-act="invword" data-id="${i.id}">📝 Word</button></div>
        ${App.invoiceDoc(i)}
        ${pays.length ? `<h2 class="sec noprint">Paiements reçus</h2><div class="list noprint">${App.invPayments(i).map(({ p: x, n, left }) => `<div class="item"><div class="grow"><b>${App.fdate(x.date)} · ${esc(x.mode)}</b><small>${esc(App.receiptNo(x))}${x.ref ? ' · ' + esc(x.ref) : ''} · reste ${App.fmt(left, i.currency)}</small></div><b class="ok">${App.fmt(x.amount, x.currency)}</b><button class="btn sm sec" data-act="recprint" data-id="${x.id}" title="Imprimer le reçu">🧾</button></div>`).join('')}</div>` : ''}
        <div class="bar" style="margin-top:14px">${i.clientId ? `<button class="btn sec" data-act="go" data-v="client" data-id="${i.clientId}">Voir le client</button>` : ''}<button class="btn del" data-act="delinv" data-id="${i.id}">Supprimer la facture</button></div>`
    };
  };
  App.actions.invpdf = d => { App.toast('Choisissez « Enregistrer au format PDF »'); printDoc(App.invoice(d.id)); };
  App.actions.invprint = d => printDoc(App.invoice(d.id));
  App.actions.invword = d => wordDoc(App.invoice(d.id));
  // Removes invoices (stock put back, linked payments / installations removed, a renewal undone) with a 12-second "Annuler" bar
  App.removeInvoices = ids => {
    const db = App.db, list = ids.map(App.invoice).filter(Boolean); if (!list.length) return;
    const snap = JSON.parse(JSON.stringify({ invoices: db.invoices, payments: db.payments, installs: db.installs, products: db.products, moves: db.moves, clients: db.clients, deliveries: db.deliveries }));
    const manual = [];
    list.forEach(i => {
      if (!i.pending) i.lines.forEach(l => { const p = l.pid && App.prod(l.pid); if (p && App.tracked(p)) App.move({ pid: p.id, qty: l.qty, invoiceId: '', clientId: i.clientId, note: 'Annulation ' + i.number }); }); // a pending invoice never took stock
      const c = App.client(i.clientId), r = i.renew;
      if (r && c && c.start === r.ns && r.prev) { // this invoice renewed the subscription: give the previous period back
        c.start = r.prev.start; if (r.prev.period) c.period = r.prev.period; if (r.prev.price != null) c.price = r.prev.price;
        const k = (c.subs || []).map(x => x.date + '|' + x.start).lastIndexOf(r.date + '|' + r.prev.start); if (k >= 0) c.subs.splice(k, 1);
      } else if (!i.pending && (/abonnement/i.test(i.type) || i.type === 'complete')) manual.push(i.number);
      db.payments = db.payments.filter(p => p.invoiceId !== i.id); db.installs = db.installs.filter(x => x.invoiceId !== i.id);
      (db.deliveries || []).forEach(d => { if (d.invoiceId === i.id) { d.invoiceId = ''; d.collect = false; } });
      db.invoices = db.invoices.filter(x => x !== i); App.log(i.clientId, `Facture ${i.number} supprimée`);
    });
    App.save();
    const label = list.length === 1 ? 'Facture ' + list[0].number + ' supprimée' : list.length + ' factures supprimées';
    App.undoBar(label + (manual.length ? ' · vérifiez la période d\'abonnement du client' : ''), () => { ['invoices', 'payments', 'installs', 'products', 'moves', 'clients', 'deliveries'].forEach(k => { db[k] = snap[k]; }); App.save(); App.toast('Suppression annulée'); App.refresh(); });
  };
  App.actions.delinv = d => {
    const i = App.invoice(d.id); if (!i || !App.confirm(`Supprimer la facture ${i.number} ? Le stock sera remis et ses paiements supprimés.`)) return;
    App.removeInvoices([i.id]); App.go('invoices', {}, true);
  };
  // multiple selection in the invoice list
  App.actions.inv_sel = () => { st.sel = !st.sel; st.picked = new Set(); drawList(); };
  App.actions.inv_pick = d => { st.picked.has(d.id) ? st.picked.delete(d.id) : st.picked.add(d.id); drawList(); };
  App.actions.inv_all = () => { const all = visibleInvoices(); const full = all.every(i => st.picked.has(i.id)); all.forEach(i => full ? st.picked.delete(i.id) : st.picked.add(i.id)); drawList(); };
  App.actions.delinvs = () => {
    const ids = [...st.picked].filter(id => App.invoice(id)); if (!ids.length) return App.toast('Aucune facture sélectionnée');
    if (!App.confirm(`Supprimer ${ids.length} facture(s) ? Le stock sera remis et leurs paiements supprimés.`)) return;
    st.sel = false; st.picked = new Set(); App.removeInvoices(ids); drawList();
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
       ${F.num('f_rate', 'Taux du jour (1 $ = … CDF)', App.rate(), 'min="1" step="1"')}
       ${F.text('f_ref', 'Référence (n° transaction)', '')}${F.text('f_com', 'Commentaire', '')}`,
      () => {
        let amt = App.n('f_amt'); if (amt <= 0) { App.toast('Montant invalide'); return false; }
        const i = App.invoice(App.v('f_inv')), cid = App.v('f_cl') || (i ? i.clientId : ''), rate = App.n('f_rate') > 0 ? Math.round(App.n('f_rate')) : App.rate();
        if (i && App.conv(amt, App.v('f_cur'), i.currency, rate) > App.invDue(i) + 0.004 && App.invDue(i) > 0.004) amt = Math.round(App.conv(App.invDue(i), i.currency, App.v('f_cur'), rate) * 100) / 100; // never record more than the balance
        if (rate !== App.rate()) App.setRate(rate);
        db.payments.push({ id: App.uid(), date: App.v('f_date') || App.today(), clientId: cid, invoiceId: i ? i.id : '', amount: amt, currency: App.v('f_cur'), rate, mode: App.v('f_mode'), ref: App.v('f_ref'), comment: App.v('f_com') });
        App.log(cid, `Paiement ${App.fmt(amt, App.v('f_cur'))} (${App.v('f_mode')})${i ? ' · ' + i.number : ''}`);
        if (i && $('f_neg').checked && !$('pp_negw').style.display) { i.agreed = Math.round(App.invPaid(i) * 100) / 100; App.log(cid, `Prix négocié sur ${i.number} : ${App.fmt(i.agreed, i.currency)} au lieu de ${App.fmt(App.invTotal(i), i.currency)}`); }
        const np = db.payments[db.payments.length - 1]; App.save(); App.refresh();
        App.undoBar('Paiement enregistré : ' + App.fmt(amt, App.v('f_cur')), () => App.actions.recprint({ id: np.id }), '🧾 Imprimer le reçu');
      }, 'Enregistrer le paiement');
    // live balance + quick buttons (works for old invoices too)
    const box = document.createElement('div'); box.className = 'fld'; box.innerHTML = '<div class="bar"><button class="btn sec sm" type="button" id="pp_all">Tout le reste</button><button class="btn sec sm" type="button" id="pp_half">Moitié</button></div><div id="pp_msg" class="muted" style="margin-top:6px"></div><label id="pp_negw" class="chk" style="display:none;margin-top:6px"><input type="checkbox" id="f_neg"> Le client a marchandé : solder la facture avec ce paiement (prix convenu)</label>';
    $('f_amt').closest('.row').before(box);
    const ppSync = () => { const i = App.invoice($('f_inv').value), a = App.n('f_amt'); if (!i) { $('pp_msg').textContent = ''; $('pp_negw').style.display = 'none'; return; } const d = App.invDue(i), g = App.conv(a, App.v('f_cur'), i.currency, App.rateOf(i)), left = d - g; $('pp_negw').style.display = left > 0.004 ? '' : 'none'; if (left <= 0.004) $('f_neg').checked = false; $('pp_msg').textContent = left > 0.004 ? `Reste après ce paiement : ${App.fmt(left, i.currency)}` : left < -0.004 ? `Trop perçu : ${App.fmt(-left, i.currency)} à rendre au client (le solde sera ramené à 0)` : '✅ La facture sera soldée'; };
    const ppFill = k => { const i = App.invoice($('f_inv').value); if (!i) return App.toast('Choisissez d\'abord une facture'); $('f_cur').value = i.currency; $('f_amt').value = Math.round(App.invDue(i) * k * 100) / 100; ppSync(); };
    $('pp_all').onclick = () => ppFill(1); $('pp_half').onclick = () => ppFill(.5); $('f_amt').oninput = ppSync; $('f_cur').onchange = ppSync; ppSync();
    $('f_cl').onchange = () => { $('f_inv').innerHTML = App.opts(invOpts($('f_cl').value)); };
    $('f_inv').onchange = () => { const i = App.invoice($('f_inv').value); if (i) { $('f_amt').value = App.invDue(i); $('f_cur').value = i.currency; if (!$('f_cl').value) $('f_cl').value = i.clientId; } ppSync(); };
  };
  // negotiated price on an existing invoice: what was already received becomes the agreed price
  App.actions.invneg = d => { const i = App.invoice(d.id); if (!i) return; const p = Math.round(App.invPaid(i) * 100) / 100;
    if (!App.confirm(`Le client a marchandé ? Le prix convenu devient ${App.fmt(p, i.currency)} (déjà reçu) et la facture est soldée. La facture imprimée garde son prix complet de ${App.fmt(App.invTotal(i), i.currency)}.`)) return;
    i.agreed = p; App.log(i.clientId, `Prix négocié sur ${i.number} : ${App.fmt(p, i.currency)} au lieu de ${App.fmt(App.invTotal(i), i.currency)}`); App.save(); App.refresh(); };
  App.actions.invunneg = d => { const i = App.invoice(d.id); if (!i) return; delete i.agreed; App.save(); App.refresh(); App.toast('Prix négocié annulé'); };
  App.actions.invvalid = d => { const i = App.invoice(d.id); if (!i) return; if (!App.confirm(`Valider la vente ${i.number} ? Le stock sera déduit et la facture comptera dans les ventes.`)) return; App.validateInvoice(i.id); App.refresh(); if (App.invDue(i) > 0.004) App.paymentForm({ invoiceId: i.id }); };
  App.actions.invcancel = d => { const i = App.invoice(d.id); if (!i || !i.pending) return; if (!App.confirm(`Annuler la facture ${i.number} ? Le client ne prend pas le produit : rien n'a été déduit du stock.`)) return; App.removeInvoices([i.id]); App.go('invoices'); };
  App.actions.newpay = d => App.paymentForm({ clientId: d.cid, invoiceId: d.iid });

  const pq = { mode: 'all' };
  App.views.payments = () => {
    const all = App.db.payments.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)), l = all.filter(p => pq.mode === 'all' || p.mode === pq.mode);
    const by = {}; all.forEach(p => { by[p.mode] = (by[p.mode] || 0) + App.usd(p.amount, p.currency, p); });
    return {
      title: 'Paiements', sub: `${all.length} paiement(s)`, back: 'more', nav: 'more',
      html: `<div class="bar"><button class="btn" data-act="newpay">+ Paiement</button></div>
        <div class="chips"><button class="chip ${pq.mode === 'all' ? 'on' : ''}" data-act="paymode" data-m="all">Tous</button>${App.PAY_MODES.filter(m => by[m]).map(m => `<button class="chip ${pq.mode === m ? 'on' : ''}" data-act="paymode" data-m="${esc(m)}">${esc(m)} · ${App.fmt(by[m])}</button>`).join('')}</div>
        ${l.length ? `<div class="list">${l.map(p => { const i = App.invoice(p.invoiceId); return `<div class="item"><div class="grow"><b>${esc(App.cname(App.client(p.clientId)))}</b><small>${App.fdate(p.date)} · ${esc(p.mode)}${i ? ' · ' + esc(i.number) : ''}${p.ref ? ' · ' + esc(p.ref) : ''}</small></div><b class="ok">${App.fmt(p.amount, p.currency)}</b><button class="btn sm sec" data-act="recprint" data-id="${p.id}" title="Imprimer le reçu">🧾</button><button class="btn sm del" data-act="delpay" data-id="${p.id}">✕</button></div>`; }).join('')}</div>` : '<div class="empty">Aucun paiement.</div>'}`
    };
  };
  App.actions.paymode = d => { pq.mode = d.m; App.refresh(); };
  App.actions.delpay = d => { if (!App.confirm('Supprimer ce paiement ?')) return; App.db.payments = App.db.payments.filter(p => p.id !== d.id); App.save(); App.refresh(); };

  // ---------- Expenses ----------
  App.views.expenses = () => {
    const l = App.db.expenses.slice().sort((a, b) => b.date.localeCompare(a.date)), m = App.today().slice(0, 7), mt = l.filter(e => e.date.startsWith(m)).reduce((a, e) => a + App.usd(e.amount, e.currency, e), 0);
    return {
      title: 'Dépenses', sub: `Ce mois : ${App.fmt(mt)}`, back: 'more', nav: 'more',
      html: `<div class="bar"><button class="btn" data-act="newexp">+ Dépense</button><button class="btn sec" data-csv="depenses">CSV</button></div>` + (l.length ? `<div class="list">${l.map(e => `<div class="item"><div class="grow"><b>${esc(e.label)}</b><small>${App.fdate(e.date)} · ${esc(e.cat)}${e.mode ? ' · ' + esc(e.mode) : ''}</small></div><b>${App.fmt(e.amount, e.currency)}</b><button class="btn sm del" data-act="delexp" data-id="${e.id}">✕</button></div>`).join('')}</div>` : '<div class="empty">Aucune dépense.</div>')
    };
  };
  App.actions.newexp = () => App.modal('Nouvelle dépense', `${F.text('f_label', 'Libellé', '')}${F.sel('f_cat', 'Catégorie', App.EXP_CATS)}<div class="row">${F.num('f_amt', 'Montant', '')}${F.sel('f_cur', 'Devise', CUR, 'USD')}</div><div class="row">${F.date('f_date', 'Date', App.today())}${F.sel('f_mode', 'Payé par', App.PAY_MODES, 'Cash')}</div>`, () => {
    if (!App.v('f_label') || App.n('f_amt') <= 0) { App.toast('Libellé et montant requis'); return false; }
    App.db.expenses.push({ id: App.uid(), label: App.v('f_label'), cat: App.v('f_cat'), amount: App.n('f_amt'), currency: App.v('f_cur'), mode: App.v('f_mode'), date: App.v('f_date') || App.today() }); App.save(); App.refresh();
  });
  App.actions.delexp = d => { if (!App.confirm('Supprimer cette dépense ?')) return; App.db.expenses = App.db.expenses.filter(e => e.id !== d.id); App.save(); App.refresh(); };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-csv="depenses"]'); if (!b) return;
    App.download(`cispolstore-depenses-${App.today()}.csv`, App.csv([['Date', 'Libellé', 'Catégorie', 'Montant', 'Devise'], ...App.db.expenses.map(x => [x.date, x.label, x.cat, x.amount, x.currency])]), 'text/csv');
  });
})();
