// Payers and the kits they pay for: a politician, an organisation or a big client who offers (or pays) kits used by other people, the beneficiaries.
// A beneficiary keeps his own file (name, optional phone, ACC, subscription, installation place); it is linked to the payer by `payerId`.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const CAT = { politicien: ['🏛️', 'Politicien'], organisation: ['⛪', 'Organisation'], entreprise: ['🏢', 'Entreprise'], particulier: ['👤', 'Particulier'] };
  App.PAYCAT = CAT;
  const nrm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const byName = (a, b) => App.cname(a).localeCompare(App.cname(b));
  const kitsOf = id => App.db.clients.filter(c => c.payerId === id && c.id !== id).sort(byName);
  App.kitsOf = kitsOf;
  App.isPayer = c => !!c && (!!c.payer || App.db.clients.some(x => x.payerId === c.id));
  App.payerOf = c => c && c.payerId ? App.client(c.payerId) || null : null;
  App.catOf = c => CAT[c.payCat] || ['🎁', 'Payeur'];
  App.kitPlace = c => [c.city, c.quarter].filter(Boolean).join(' / ') + (c.installAddr ? (c.city || c.quarter ? ' · ' : '') + c.installAddr : '');
  // subscription state of a group of kits: running, expiring within 7 days or in grace, over, none yet
  const grp = list => { const r = { n: list.length, ok: 0, soon: 0, off: 0, none: 0 }; list.forEach(c => { const s = App.sub(c); if (!s) r.none++; else if (s.status === 'inactif') r.off++; else if (s.status === 'sursis' || s.left <= 7) r.soon++; else r.ok++; }); return r; };
  App.kitStats = grp;
  const pl = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
  const grpText = g => g.n ? `${pl(g.ok, 'actif')} · ${pl(g.soon, 'bientôt expiré')} · ${pl(g.off, 'inactif')}${g.none ? ` · ${g.none} sans abonnement` : ''}` : "aucun kit pour l'instant";
  const tone = c => { const s = App.sub(c); return s ? { actif: 'ok', sursis: 'warn', inactif: 'bad' }[s.status] : 'mut'; };
  const dayTxt = (s) => s.status === 'actif' ? (s.left === 0 ? "aujourd'hui" : `${s.left} j`) : s.status === 'sursis' ? `sursis · ${s.left} j` : `−${-s.left} j`;
  const goTab = (id, tab) => esc(JSON.stringify({ id, tab }));

  // ---------- Kits tab on the payer's file ----------
  const kf = {};  // city filter per payer
  const kitRow = k => { const s = App.sub(k), who = k.subBy === 'self' ? '👤 Abonnement payé par lui' : '🎁 Abonnement payé par le payeur', contact = k.phone ? ' · 📞 ' + esc(k.phone) : ' · ☎ via le payeur';
    return `<div class="item rw" role="button" tabindex="0" data-act="go" data-v="client" data-id="${k.id}"><span class="avatar ${tone(k)}">${esc(App.initials(k))}</span><div class="grow"><b>${esc(App.cname(k))}</b><small>📍 ${esc(App.kitPlace(k) || 'Lieu non précisé')}</small><small class="mut">${who}${contact}</small></div><div class="end">${s ? `${App.pill(s.status)}<small class="${tone(k)}">${dayTxt(s)}</small>` : '<span class="pill">Sans abonnement</span>'}</div></div>`; };
  App.kitsTab = c => {
    const all = kitsOf(c.id), city = k => k.city || 'Sans ville', cities = {}; all.forEach(k => { cities[city(k)] = (cities[city(k)] || 0) + 1; });
    const f = cities[kf[c.id]] ? kf[c.id] : '', list = f ? all.filter(k => city(k) === f) : all, g = grp(all);
    return `<div class="card"><b>${g.n} kit(s)</b><div class="mut" style="font-size:13px">${esc(grpText(g))}</div></div>
      <div class="bar" style="flex-wrap:wrap"><button class="btn sm" data-act="kit_add" data-id="${c.id}">➕ Ajouter un bénéficiaire</button><button class="btn sm sec" data-act="kit_many" data-id="${c.id}">📋 Ajouter plusieurs</button><button class="btn sm sec" data-act="kit_link" data-id="${c.id}">🔗 Lier un client existant</button></div>
      ${Object.keys(cities).length > 1 ? `<div class="chips" style="flex-wrap:wrap;overflow:visible"><button class="chip ${f ? '' : 'on'}" data-act="kit_city" data-id="${c.id}" data-city="">Tous (${all.length})</button>${Object.keys(cities).sort().map(x => `<button class="chip ${f === x ? 'on' : ''}" data-act="kit_city" data-id="${c.id}" data-city="${esc(x)}">📍 ${esc(x)} (${cities[x]})</button>`).join('')}</div>` : ''}
      ${list.length ? `<div class="list">${list.map(kitRow).join('')}</div>` : '<div class="empty">Aucun bénéficiaire pour le moment. Ajoutez le premier kit.</div>'}`;
  };
  App.actions.kit_city = d => { kf[d.id] = d.city || ''; App.refresh(); };
  App.actions.kit_add = d => { const p = App.client(d.id); if (p) App.clientForm(null, 'gere', false, { payerId: p.id, subBy: 'payer' }); };
  App.actions.kit_unlink = d => { const c = App.client(d.id), p = App.payerOf(c); if (!c || !p) return; if (!App.confirm(`Détacher ${App.cname(c)} de son payeur ${App.cname(p)} ? Sa fiche, son abonnement et ses paiements ne changent pas.`)) return;
    c.payerId = ''; c.subBy = ''; App.log(c.id, `Détaché du payeur ${App.cname(p)}`); App.save(); App.refresh(); App.toast('Bénéficiaire détaché'); };

  // link an existing client to this payer (search, then tap)
  App.actions.kit_link = d => { const p = App.client(d.id); if (!p) return;
    const l = App.db.clients.filter(c => c.id !== p.id && c.payerId !== p.id && !(p.payerId === c.id)).sort(byName);
    App.modal('Lier un client existant', `<p class="mut" style="margin:0 0 8px">Choisissez le client qui utilise un kit payé par <b>${esc(App.cname(p))}</b>.</p><input id="kl_q" placeholder="Chercher un client, un ACC, un téléphone…" autocomplete="off" style="margin-bottom:8px"><div class="list" id="kl_l" style="max-height:50vh;overflow:auto">${l.length ? l.map(c => { const o = App.payerOf(c); return `<button type="button" class="item" data-act="kit_linkto" data-id="${c.id}" data-pid="${p.id}" data-n="${esc(nrm([App.cname(c), c.acc, c.phone, c.code, App.kitPlace(c)].join(' ')))}"><span class="avatar ${tone(c)}">${esc(App.initials(c))}</span><div class="grow"><b>${esc(App.cname(c))}</b><small>${esc([c.acc, App.kitPlace(c), o ? 'déjà payé par ' + App.cname(o) : ''].filter(Boolean).join(' · ') || App.typeName(c))}</small></div></button>`; }).join('') : '<div class="empty">Aucun autre client.</div>'}</div>`);
    const q = $('kl_q'); if (q) q.oninput = () => { const v = nrm(q.value).trim(); document.querySelectorAll('#kl_l [data-n]').forEach(b => { b.hidden = !!v && !b.dataset.n.includes(v); }); }; };
  App.actions.kit_linkto = d => { const c = App.client(d.id), p = App.client(d.pid); if (!c || !p || c.id === p.id) return;
    if (p.payerId === c.id) return App.toast(`${App.cname(c)} est déjà le payeur de ${App.cname(p)}`);
    if (kitsOf(c.id).length) return App.toast(`${App.cname(c)} est lui-même un payeur : détachez d'abord ses bénéficiaires`);
    c.payerId = p.id; if (!c.subBy) c.subBy = 'payer'; p.payer = true; App.log(c.id, `Kit lié au payeur ${App.cname(p)}`); App.log(p.id, `Bénéficiaire ajouté : ${App.cname(c)}`); App.save(); App.close(); App.refresh(); App.toast('Client lié'); };

  // several kits at once: one block per kit, only the name or the ACC is required
  const fld = (lbl, cls, x = '') => `<div class="fld"><label class="l">${lbl}</label><input class="${cls}" ${x}></div>`;
  const kmRow = () => `<div class="card km" style="padding:10px;margin:8px 0"><div class="row">${fld('Nom', 'km_n')}${fld('Téléphone (facultatif)', 'km_p', 'type="tel" inputmode="tel"')}</div><div class="row">${fld('Lieu (ville / quartier)', 'km_l')}${fld('ACC', 'km_a', 'autocapitalize="characters"')}</div></div>`;
  App.actions.kit_many = d => { const p = App.client(d.id); if (!p) return; const S = App.db.settings;
    App.modal('Ajouter plusieurs · ' + App.cname(p),
      `<p class="mut" style="margin:0 0 6px">Un bloc par kit. Seul le nom ou l'ACC est obligatoire ; laissez le téléphone vide si le contact passe par le payeur ou un représentant.</p><div id="km_rows">${[0, 1, 2, 3].map(kmRow).join('')}</div><div class="bar"><button type="button" class="btn sec sm" id="km_more">+ Ajouter un kit</button></div>
       ${F.sel('km_by', 'Abonnement pris en charge par', [['payer', '🎁 Le payeur'], ['self', '👤 Le bénéficiaire']], 'payer')}
       <div class="row">${F.date('km_start', "Début de l'abonnement", App.today())}${F.num('km_period', 'Durée (jours)', S.period, 'min="1"')}</div>
       <p class="mut" style="font-size:12px;margin:0">Videz la date si l'abonnement ne démarre pas tout de suite : le kit sera créé « sans abonnement ».</p>`,
      () => { const rows = [...document.querySelectorAll('#km_rows .km')].map(r => ({ n: r.querySelector('.km_n').value.trim(), p: r.querySelector('.km_p').value.trim(), l: r.querySelector('.km_l').value.trim(), a: r.querySelector('.km_a').value.trim().toUpperCase() })).filter(r => r.n || r.a);
        if (!rows.length) { App.toast("Saisissez au moins un nom ou un ACC"); return false; }
        const start = App.v('km_start'), period = Math.max(1, Math.round(App.n('km_period')) || S.period), by = App.v('km_by') || 'payer', known = new Set(App.db.clients.map(c => String(c.acc || '').toUpperCase()).filter(Boolean)); let made = 0, dup = 0;
        rows.forEach(r => { if (r.a && known.has(r.a)) { dup++; return; } if (r.a) known.add(r.a);
          const name = r.n || ('Kit ' + r.a), parts = name.split(/\s+/), place = r.l.split(/\s*[\/,;]\s*/).filter(Boolean);
          const c = { id: App.uid(), code: App.nextClientCode(), type: 'gere', aboOnly: false, first: parts[0] || '', last: parts.slice(1).join(' '), name, phone: r.p, phone2: '', address: '', city: place[0] || '', quarter: place.slice(1).join(' / '), installAddr: '', acc: r.a, serial: '', kit: '', plan: '', price: '', payMode: 'Cash', start: start || '', period, grace: S.grace, note: '', article: '', subs: [], created: App.today(), payerId: p.id, subBy: by };
          App.db.clients.push(c); App.log(c.id, `Client créé (kit offert · payeur ${App.cname(p)})`); made++; });
        if (!made) { App.toast(dup === 1 ? 'Cet ACC existe déjà' : 'Ces ACC existent déjà'); return false; }
        p.payer = true; App.log(p.id, `${made} bénéficiaire(s) ajouté(s)`); App.save(); App.refresh(); App.toast(`${made} bénéficiaire(s) créé(s)${dup ? ` · ${dup} ACC déjà existant(s) ignoré(s)` : ''}`); },
      'Créer');
    $('km_more').onclick = () => { $('km_rows').insertAdjacentHTML('beforeend', kmRow()); }; };

  // ---------- « Gros clients » list: every payer with the state of his kits ----------
  const st = { cat: 'all', q: '' };
  const catKey = p => CAT[p.payCat] ? p.payCat : 'autre';
  const drawList = () => {
    const el = $('plist'); if (!el) return;
    const q = nrm(st.q).trim(), rows = App.db.clients.filter(App.isPayer).filter(p => (st.cat === 'all' || catKey(p) === st.cat) && (!q || nrm([App.cname(p), p.code, p.phone, p.city, p.quarter].join(' ')).includes(q)))
      .map(p => ({ p, g: grp(kitsOf(p.id)) })).sort((a, b) => b.g.n - a.g.n || byName(a.p, b.p));
    el.innerHTML = rows.length ? `<div class="list">${rows.map(({ p, g }) => `<div class="item rw" role="button" tabindex="0" data-act="go" data-v="client" data-p="${goTab(p.id, 'kits')}"><span class="avatar">${App.catOf(p)[0]}</span><div class="grow"><b>${esc(App.cname(p))}</b><small>${esc(App.catOf(p)[1])} · ${esc(grpText(g))}</small></div><div class="end"><b>${g.n}</b><small class="mut">kits</small></div></div>`).join('')}</div>`
      : `<div class="empty big"><div class="ei">🎁</div><b>${App.db.clients.some(App.isPayer) ? 'Aucun payeur pour ce filtre' : 'Aucun payeur pour le moment'}</b><p>${App.db.clients.some(App.isPayer) ? 'Essayez un autre filtre ou une autre recherche.' : 'Un payeur est un client (politicien, organisation, gros client) qui paie ou offre des kits à d’autres. Créez-le, puis ajoutez ses bénéficiaires.'}</p></div>`;
  };
  App.views.payeurs = () => {
    const payers = App.db.clients.filter(App.isPayer), all = payers.map(p => grp(kitsOf(p.id))), sum = k => all.reduce((a, g) => a + g[k], 0);
    const cnt = {}; payers.forEach(p => { cnt[catKey(p)] = (cnt[catKey(p)] || 0) + 1; });
    const chips = [['all', `Tous (${payers.length})`], ...Object.keys(CAT).filter(k => cnt[k]).map(k => [k, `${CAT[k][0]} ${CAT[k][1]}s (${cnt[k]})`]), ...(cnt.autre ? [['autre', `🎁 Autres (${cnt.autre})`]] : [])];
    const card = (v, l, k = '') => `<div class="card" style="padding:10px 14px"><b style="font-size:22px" class="${k}">${v}</b><br><small class="mut">${l}</small></div>`;
    return {
      title: 'Gros clients', sub: 'Payeurs de kits', back: 'more', nav: 'more',
      html: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">${card(payers.length, 'payeurs')}${card(sum('n'), 'kits offerts')}${card(sum('soon'), 'bientôt expirés', sum('soon') ? 'warn' : '')}${card(sum('off'), 'inactifs', sum('off') ? 'bad' : '')}</div>
        <div class="chips" style="flex-wrap:wrap;overflow:visible">${chips.map(([k, t]) => `<button class="chip ${st.cat === k ? 'on' : ''}" data-act="pay_cat" data-k="${k}">${t}</button>`).join('')}</div>
        <div class="search" style="margin:8px 0"><input id="pq" placeholder="Chercher un payeur…" value="${esc(st.q)}" autocomplete="off"></div>
        <div id="plist"></div><button class="btn full" data-act="payer_new" style="margin-top:14px">➕ Nouveau payeur</button>
        <p class="mut" style="font-size:13px;margin-top:10px">Touchez un payeur pour ouvrir sa fiche (onglet « Kits »).</p>`,
      after: () => { drawList(); if ($('pq')) $('pq').oninput = e => { st.q = e.target.value; drawList(); }; }
    };
  };
  App.actions.pay_cat = d => { st.cat = d.k; App.refresh(); };
  App.actions.payer_new = () => App.clientForm(null, 'mat', false, { payer: true });
})();
