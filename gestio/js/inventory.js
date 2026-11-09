// Physical stock count (inventaire) and supplier purchase orders (bon de commande) for what is running low.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const counts = () => (App.db.counts = App.db.counts || []), orders = () => (App.db.orders = App.db.orders || []);
  const unit = p => p && p.unit === 'm' ? ' m' : '';
  const val = (p, n) => n * (App.can('costs') ? +p.cost || 0 : +p.price || 0);
  const seq = (arr, prefix, date) => { const y = (date || App.today()).slice(0, 4), re = new RegExp('^' + prefix + '-' + y + '-(\\d+)$'); let m = 0; arr.forEach(x => { const r = re.exec(x.no || ''); if (r) m = Math.max(m, +r[1]); }); return `${prefix}-${y}-${String(m + 1).padStart(4, '0')}`; };
  const rnd = n => Math.round(n * 1000) / 1000;
  const draftOf = () => counts().find(c => c.status === 'draft');
  const tracked = () => App.db.products.filter(App.tracked).sort((a, b) => a.name.localeCompare(b.name));

  // ---------- history ----------
  App.views.inventory = () => {
    const l = counts().filter(c => c.status === 'done').sort((a, b) => b.ts - a.ts), last = l[0], dr = draftOf();
    const gap = c => c.lines.reduce((a, x) => a + (App.db.products.length ? (App.prod(x.pid) ? val(App.prod(x.pid), x.counted - x.theo) : 0) : 0), 0);
    return {
      title: 'Inventaire', sub: last ? 'Dernier : ' + App.fdate(last.date) : 'Comptage physique du stock', back: 'stock', nav: 'stock',
      html: `<section class="hero shero"><div class="hero-top"><div><small>📋 Dernier écart de stock</small><div class="hero-num" data-count="${last ? gap(last) : 0}">${App.fmt(last ? gap(last) : 0)}</div></div></div>
          <div class="cstats"><div><b>${l.length}</b><small>inventaire(s)</small></div><div><b>${last ? last.lines.filter(x => x.counted !== x.theo).length : 0}</b><small>écart(s) au dernier</small></div><div><b>${last ? Math.max(0, App.diff(last.date, App.today())) + ' j' : '—'}</b><small>depuis le dernier</small></div></div></section>
        <div class="bar"><button class="btn" data-act="inv_start">${dr ? '▶ Reprendre l\'inventaire en cours' : '+ Nouvel inventaire'}</button></div>
        <p class="mut" style="font-size:13px;margin:0 0 10px">Comptez ce qu'il y a vraiment en rayon : l'application compare avec le stock théorique, montre les écarts (manques et surplus) et peut corriger le stock.</p>
        ${l.length ? `<div class="list">${l.map(c => { const g = gap(c), n = c.lines.filter(x => x.counted !== x.theo).length;
          return `<button class="item" data-act="inv_open" data-id="${c.id}"><span class="avatar ${n ? 'warn' : 'ok'}">📋</span><div class="grow"><b>${esc(c.no)}</b><small>${App.fdate(c.date)} · ${c.lines.length} produit(s) comptés · ${n ? n + ' écart(s)' : 'aucun écart'}${c.applied ? ' · stock corrigé' : ''}</small></div><div class="end"><b class="${g < -0.004 ? 'bad' : g > 0.004 ? 'ok' : ''}">${g > 0.004 ? '+' : ''}${App.fmt(g)}</b></div></button>`; }).join('')}</div>` : '<div class="empty big"><div class="ei">📋</div><b>Aucun inventaire</b><p class="mut">Faites le premier pour découvrir les écarts de votre stock.</p></div>'}`
    };
  };
  App.actions.inv_start = () => {
    if (!App.can('stockedit')) return App.toast('Action réservée au gérant ou au comptable');
    if (!draftOf()) { counts().push({ id: App.uid(), ts: Date.now(), date: App.today(), status: 'draft', no: seq(counts(), 'INV'), lines: [] }); App.save(); }
    App.go('invcount');
  };

  // ---------- counting screen ----------
  const cs = { q: '' };
  App.views.invcount = () => {
    const dr = draftOf(); if (!dr) return { title: 'Inventaire', back: 'inventory', nav: 'stock', html: '<div class="empty">Aucun inventaire en cours.</div>' };
    const P = tracked();
    return {
      title: 'Comptage ' + dr.no, sub: 'Saisissez la quantité réelle', back: 'inventory', nav: 'stock',
      html: `<section class="hero shero"><div class="hero-top"><div><small>📋 Produits comptés</small><div class="hero-num" id="ic_done">0</div></div></div><div class="cstats"><div><b id="ic_tot">${P.length}</b><small>à compter</small></div><div><b id="ic_gap">0</b><small>écart(s)</small></div><div><b id="ic_val">0 $</b><small>valeur des écarts</small></div></div></section>
        <div class="search"><input id="ic_q" placeholder="Rechercher un produit…" value="${esc(cs.q)}" autocomplete="off"></div>
        <div id="ic_list"></div>
        <div class="bar" style="margin-top:14px"><button class="btn" data-act="inv_finish">✅ Terminer l'inventaire</button><button class="btn sec" data-act="inv_cancel">Abandonner</button></div>`,
      after: () => {
        const find = id => dr.lines.find(x => x.pid === id), got = () => dr.lines.filter(x => x.counted != null);
        const stats = () => { const g = got().filter(x => rnd(x.counted - App.prod(x.pid).qty) !== 0); $('ic_done').textContent = got().length; $('ic_gap').textContent = g.length; const v = g.reduce((a, x) => a + val(App.prod(x.pid), x.counted - App.prod(x.pid).qty), 0); $('ic_val').textContent = App.fmt(v); $('ic_val').className = v < -0.004 ? 'bad' : ''; };
        const rows = () => { const q = cs.q.toLowerCase(), l = P.filter(p => !q || (p.name + ' ' + (p.ref || '')).toLowerCase().includes(q));
          $('ic_list').innerHTML = l.length ? `<div class="list">${l.map(p => { const x = find(p.id), c = x && x.counted != null ? x.counted : '';
            return `<div class="item" data-pid="${p.id}"><div class="grow"><b>${esc(p.name)}</b><small>Théorique : ${App.nf(p.qty, 2)}${unit(p)}${p.ref ? ' · ' + esc(p.ref) : ''}</small></div><span class="ic-gap" style="min-width:46px;text-align:right;font-weight:800"></span><input class="ic-in" inputmode="decimal" type="number" min="0" step="any" style="width:84px" placeholder="—" value="${c}" aria-label="Quantité comptée ${esc(p.name)}"></div>`; }).join('')}</div>` : '<div class="empty">Aucun produit trouvé.</div>';
          document.querySelectorAll('#ic_list .item').forEach(r => { const upd = () => { const p = App.prod(r.dataset.pid), x = find(p.id), g = r.querySelector('.ic-gap'); if (!x || x.counted == null) { g.textContent = ''; return; } const d = rnd(x.counted - p.qty); g.textContent = d === 0 ? '✓' : (d > 0 ? '+' : '') + App.nf(d, 2); g.className = 'ic-gap ' + (d === 0 ? 'ok' : d < 0 ? 'bad' : 'warn'); }; upd();
            r.querySelector('input').oninput = e => { const p = App.prod(r.dataset.pid); let x = find(p.id), v = e.target.value; if (v === '') { if (x) x.counted = null; } else { if (!x) { x = { pid: p.id, name: p.name, counted: null }; dr.lines.push(x); } x.counted = Math.max(0, +v || 0); } upd(); stats(); App.save(); }; }); };
        $('ic_q').oninput = e => { cs.q = e.target.value; rows(); }; rows(); stats();
      }
    };
  };

  App.actions.inv_cancel = () => { const dr = draftOf(); if (!dr || !App.confirm('Abandonner cet inventaire ? Les quantités saisies seront perdues.')) return; App.db.counts = counts().filter(c => c !== dr); App.save(); App.go('inventory'); };
  App.actions.inv_finish = () => {
    const dr = draftOf(); if (!dr) return; const got = dr.lines.filter(x => x.counted != null);
    if (!got.length) return App.toast('Comptez au moins un produit');
    const gaps = got.filter(x => rnd(x.counted - App.prod(x.pid).qty) !== 0), notC = tracked().length - got.length, tot = gaps.reduce((a, x) => a + val(App.prod(x.pid), x.counted - App.prod(x.pid).qty), 0);
    App.modal('Terminer l\'inventaire', `<p class="mut" style="margin-top:0">${got.length} produit(s) comptés${notC ? ` · <b>${notC}</b> non comptés (ils ne seront pas touchés)` : ''}.</p>
      ${gaps.length ? `<div class="list">${gaps.map(x => { const p = App.prod(x.pid), d = rnd(x.counted - p.qty); return `<div class="item"><div class="grow"><b>${esc(p.name)}</b><small>Théorique ${App.nf(p.qty, 2)} → compté ${App.nf(x.counted, 2)}</small></div><b class="${d < 0 ? 'bad' : 'ok'}">${d > 0 ? '+' : ''}${App.nf(d, 2)}${unit(p)}</b></div>`; }).join('')}</div><div class="spread" style="margin:8px 0"><b>Valeur des écarts</b><b class="${tot < 0 ? 'bad' : 'ok'}">${App.fmt(tot)}</b></div>` : '<div class="card ok">✅ Aucun écart : le stock correspond au comptage.</div>'}
      <label class="chk" style="display:block;margin-top:8px"><input type="checkbox" id="iv_apply" ${gaps.length ? 'checked' : 'disabled'}> Corriger le stock avec les quantités comptées</label>`,
      () => { const d = draftOf(); if (!d) return; const apply = $('iv_apply').checked, date = App.today(), lines = got.map(x => { const p = App.prod(x.pid); return { pid: p.id, name: p.name, theo: p.qty, counted: x.counted, cost: +p.cost || 0, price: +p.price || 0 }; });
        if (apply) lines.forEach(x => { const df = rnd(x.counted - x.theo); if (df !== 0) App.move({ pid: x.pid, qty: df, date, purchase: false, note: 'Inventaire ' + d.no }); });
        Object.assign(d, { status: 'done', date, ts: Date.now(), lines, applied: apply }); App.save(); App.toast('Inventaire enregistré'); App.go('inventory'); if (!gaps.length && App.celebrate) App.celebrate(); }, 'Enregistrer l\'inventaire');
  };

  // ---------- detail / print ----------
  App.inventoryDoc = (c, logo, stamp) => { const K = App.docKit, co = App.db.settings.company, e = App.esc, gaps = c.lines.filter(x => x.counted !== x.theo);
    const rows = c.lines.map(x => { const d = rnd(x.counted - x.theo), v = d * (App.can('costs') ? x.cost : x.price); return `<tr><td>${e(x.name)}</td><td class="r">${App.nf(x.theo, 2)}</td><td class="r">${App.nf(x.counted, 2)}</td><td class="r"><b>${d > 0 ? '+' : ''}${App.nf(d, 2)}</b></td><td class="r">${d ? K.money(v, 'USD') : '—'}</td></tr>`; }).join('');
    const tot = c.lines.reduce((a, x) => a + (x.counted - x.theo) * (App.can('costs') ? x.cost : x.price), 0);
    return `<div class="paper">${K.head(co, logo)}${K.boxes('INVENTAIRE', [['N°', `<b>${e(c.no)}</b>`], ['Date', App.fdate(c.date)]], 'RÉSULTAT', [['Produits comptés', String(c.lines.length)], ['Écarts', String(gaps.length)], ['Stock corrigé', c.applied ? 'Oui' : 'Non']])}
      <table class="items"><thead><tr><th>Produit</th><th class="r" style="width:14%">Théorique</th><th class="r" style="width:14%">Compté</th><th class="r" style="width:14%">Écart</th><th class="r" style="width:20%">Valeur</th></tr></thead><tbody>${rows}</tbody></table>
      <table class="tots"><tr class="net"><td>VALEUR DES ÉCARTS :</td><td>${K.money(tot, 'USD')}</td></tr></table>${K.foot(stamp, true)}</div>`; };
  App.actions.inv_open = x => { const c = counts().find(y => y.id === x.id); if (!c) return; const gaps = c.lines.filter(l => l.counted !== l.theo);
    App.modal('Inventaire ' + c.no, `<p class="mut" style="margin-top:0">${App.fdate(c.date)} · ${c.lines.length} produit(s) comptés${c.applied ? ' · stock corrigé' : ' · stock non modifié'}</p>
      ${gaps.length ? `<div class="list">${gaps.map(l => { const d = rnd(l.counted - l.theo); return `<div class="item"><div class="grow"><b>${esc(l.name)}</b><small>Théorique ${App.nf(l.theo, 2)} → compté ${App.nf(l.counted, 2)}</small></div><b class="${d < 0 ? 'bad' : 'ok'}">${d > 0 ? '+' : ''}${App.nf(d, 2)}</b></div>`; }).join('')}</div>` : '<div class="card ok">✅ Aucun écart.</div>'}
      <div class="bar noprint"><button type="button" class="btn sec" data-act="inv_print" data-id="${c.id}">🖨️ Imprimer</button><button type="button" class="btn sec" data-act="inv_pdf" data-id="${c.id}">📤 PDF</button></div>`); };
  App.actions.inv_print = async x => { const c = counts().find(y => y.id === x.id); if (c) App.docKit.print('Inventaire ' + c.no, App.inventoryDoc(c, await App.docKit.logoData(), await App.docKit.stampData())); };
  App.actions.inv_pdf = async x => { const c = counts().find(y => y.id === x.id); if (c) App.sharePdf(`Inventaire-${c.no}.pdf`, App.inventoryDoc(c, await App.docKit.logoData(), await App.docKit.stampData())); };

  // ---------- products to reorder + purchase orders ----------
  const lowList = () => tracked().filter(p => (+p.min || 0) > 0 && p.qty <= p.min);
  App.reorderCount = () => lowList().length;
  const suggest = p => Math.max(1, Math.ceil((+p.min || 0) * 2 - p.qty));
  const supName = id => id ? (App.supplier(id) || {}).name || 'Fournisseur' : 'Sans fournisseur';
  App.views.reorder = () => {
    const low = lowList(), groups = {}; low.forEach(p => (groups[p.supplierId || ''] = groups[p.supplierId || ''] || []).push(p));
    const os = orders().slice().sort((a, b) => b.ts - a.ts);
    return {
      title: 'À commander', sub: `${low.length} produit(s) en stock bas`, back: 'stock', nav: 'stock',
      html: `<section class="hero shero"><div class="hero-top"><div><small>🛒 Produits à recommander</small><div class="hero-num" data-count="${low.length}" data-int="1">${low.length}</div></div></div><div class="cstats"><div><b>${Object.keys(groups).length}</b><small>fournisseur(s)</small></div><div><b>${os.filter(o => o.status === 'sent').length}</b><small>commande(s) en cours</small></div><div><b>${os.length}</b><small>bon(s) émis</small></div></div></section>
        <p class="mut" style="font-size:13px;margin:0 0 10px">Les produits dont le stock est au minimum ou en dessous sont regroupés par fournisseur. Ajustez les quantités puis créez le bon de commande. (Fixez un « stock minimum » sur chaque produit pour qu'il apparaisse ici.)</p>
        ${low.length ? Object.entries(groups).map(([sid, l]) => `<h2 class="sec">🚚 ${esc(supName(sid))}</h2><div class="list" data-grp="${esc(sid)}">${l.map(p => `<div class="item" data-pid="${p.id}"><input type="checkbox" class="ro-chk" checked style="width:auto" aria-label="Commander ${esc(p.name)}"><div class="grow"><b>${esc(p.name)}</b><small>En stock ${App.nf(p.qty, 2)} · minimum ${App.nf(p.min, 2)}${unit(p)}</small></div><input class="ro-qty" type="number" min="1" step="any" inputmode="decimal" value="${suggest(p)}" style="width:76px" aria-label="Quantité"></div>`).join('')}</div><div class="bar"><button class="btn sm" data-act="ro_make" data-s="${esc(sid)}">📄 Créer le bon de commande</button></div>`).join('') : '<div class="empty big"><div class="ei">✅</div><b>Rien à commander</b><p class="mut">Aucun produit n\'a atteint son stock minimum.</p></div>'}
        ${os.length ? `<h2 class="sec">Bons de commande</h2><div class="list">${os.map(o => `<button class="item" data-act="ro_open" data-id="${o.id}"><span class="avatar ${o.status === 'received' ? 'ok' : 'warn'}">📄</span><div class="grow"><b>${esc(o.no)}</b><small>${esc(supName(o.supplierId))} · ${App.fdate(o.date)} · ${o.lines.length} article(s)</small></div><span class="pill ${o.status === 'received' ? 'ok' : 'warn'}">${o.status === 'received' ? 'Reçu' : 'Commandé'}</span></button>`).join('')}</div>` : ''}`
    };
  };
  App.actions.ro_make = x => {
    if (!App.can('stockedit')) return App.toast('Action réservée au gérant ou au comptable');
    const sid = x.s || '', lines = []; document.querySelectorAll('[data-grp]').forEach(g => { if (g.dataset.grp !== sid) return; g.querySelectorAll('.item').forEach(r => { if (!r.querySelector('.ro-chk').checked) return; const p = App.prod(r.dataset.pid), q = +r.querySelector('.ro-qty').value; if (p && q > 0) lines.push({ pid: p.id, desc: p.name, ref: p.ref || '', qty: q, unit: p.unit === 'm' ? 'm' : '' }); }); });
    if (!lines.length) return App.toast('Cochez au moins un produit');
    const o = { id: App.uid(), ts: Date.now(), date: App.today(), no: seq(orders(), 'BC'), supplierId: sid, lines, status: 'sent' }; orders().push(o); App.save(); App.toast('Bon de commande ' + o.no); App.refresh(); setTimeout(() => App.actions.ro_open({ id: o.id }), 80);
  };
  App.orderDoc = (o, logo, stamp) => { const K = App.docKit, co = App.db.settings.company, e = App.esc, s = App.supplier(o.supplierId);
    const rows = o.lines.map(l => `<tr><td>${e(l.ref || '—')}</td><td>${e(l.desc)}</td><td class="r">${App.nf(l.qty, 2)}${l.unit ? ' ' + e(l.unit) : ''}</td></tr>`).join('');
    return `<div class="paper">${K.head(co, logo)}${K.boxes('BON DE COMMANDE', [['Numéro', `<b>${e(o.no)}</b>`], ['Date', App.fdate(o.date)], co.city && ['Lieu', e(co.city)]], 'FOURNISSEUR', [['Nom', `<b>${e(supName(o.supplierId))}</b>`], s && s.phone && ['Téléphone', e(s.phone)], s && s.address && ['Adresse', e(s.address)]])}
      <table class="items"><thead><tr><th style="width:18%">Référence</th><th>Désignation</th><th class="r" style="width:18%">Quantité</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="wb">Merci de confirmer la disponibilité, le prix et le délai de livraison.</div>
      <table class="sg"><tr><td></td><td class="gp"></td><td class="s2"><img src="${e(stamp || 'stamp.png')}" alt=""></td></tr><tr><td class="ln">Le fournisseur</td><td class="gp"></td><td class="ln">${e(co.name)}</td></tr></table>${K.foot(stamp, true)}</div>`; };
  App.actions.ro_open = x => { const o = orders().find(y => y.id === x.id); if (!o) return;
    App.modal('Bon de commande ' + o.no, `<div class="card" style="margin:0 0 10px"><div class="spread"><b>${esc(supName(o.supplierId))}</b><span class="pill ${o.status === 'received' ? 'ok' : 'warn'}">${o.status === 'received' ? 'Reçu' : 'Commandé'}</span></div><div class="mut">${App.fdate(o.date)}</div>${o.lines.map(l => `<div class="spread"><span>${esc(l.desc)}</span><b>× ${App.nf(l.qty, 2)}${l.unit ? ' ' + l.unit : ''}</b></div>`).join('')}</div>
      <div class="bar noprint"><button type="button" class="btn sec" data-act="ro_print" data-id="${o.id}">🖨️ Imprimer</button><button type="button" class="btn sec" data-act="ro_pdf" data-id="${o.id}">📤 PDF</button><button type="button" class="btn sec" data-act="ro_wa" data-id="${o.id}">💬 WhatsApp</button></div>
      <div class="bar">${o.status === 'sent' ? `<button type="button" class="btn" data-act="ro_recv" data-id="${o.id}">📦 Marquer comme reçu</button>` : `<button type="button" class="btn sec" data-act="ro_recv" data-id="${o.id}" data-undo="1">↺ Remettre « Commandé »</button>`}<button type="button" class="btn sm sec" data-act="ro_cancel" data-id="${o.id}">🗑 Supprimer</button></div>`); };
  App.actions.ro_print = async x => { const o = orders().find(y => y.id === x.id); if (o) App.docKit.print('Bon de commande ' + o.no, App.orderDoc(o, await App.docKit.logoData(), await App.docKit.stampData())); };
  App.actions.ro_pdf = async x => { const o = orders().find(y => y.id === x.id); if (o) App.sharePdf(`Bon-de-commande-${o.no}.pdf`, App.orderDoc(o, await App.docKit.logoData(), await App.docKit.stampData())); };
  App.actions.ro_wa = x => { const o = orders().find(y => y.id === x.id); if (!o) return; const s = App.supplier(o.supplierId), co = App.db.settings.company;
    const txt = `Bonjour${s ? ' ' + s.name : ''},\nBon de commande ${o.no} de ${co.name} :\n${o.lines.map(l => `• ${l.desc} × ${App.nf(l.qty, 2)}${l.unit ? ' ' + l.unit : ''}`).join('\n')}\nMerci de confirmer la disponibilité, le prix et le délai.`;
    window.open(s && s.phone ? App.waUrl(s.phone, txt) : 'https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener'); };
  App.actions.ro_recv = x => { const o = orders().find(y => y.id === x.id); if (!o) return; o.status = x.undo ? 'sent' : 'received'; App.save(); App.close(); App.refresh(); App.toast(x.undo ? 'Remis en « Commandé »' : 'Reçu : pensez à enregistrer l\'achat (Entrée de stock)'); };
  App.actions.ro_cancel = x => { const o = orders().find(y => y.id === x.id); if (!o || !App.confirm(`Supprimer le bon ${o.no} ?`)) return; App.db.orders = orders().filter(y => y !== o); App.save(); App.close(); App.refresh(); };
})();
