// Dashboard, subscriptions calendar and reports.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc;
  const gere = () => App.db.clients.filter(c => c.type === 'gere');
  const periodChips = (act, cur, extra = '') => `<div class="chips">${App.PERIODS.map(([k, t]) => `<button class="chip ${cur === k ? 'on' : ''}" data-act="${act}" data-p="${k}">${t}</button>`).join('')}${extra}</div>`;

  // Totals of invoices / expenses inside a date range, all in USD
  const finance = r => {
    const inv = App.db.invoices.filter(i => App.live(i) && App.inRange(i.date, r));
    const ca0 = inv.reduce((a, i) => a + App.usd(App.invAgreed(i), i.currency, i), 0);
    const cost0 = inv.reduce((a, i) => a + App.usd(App.invCost(i), i.currency, i), 0);
    const pen = App.db.penalties.filter(p => p.paid && App.inRange(p.paid, r));
    const penIn = pen.reduce((a, p) => a + App.usd(p.amount, p.currency, p), 0), penCost = pen.reduce((a, p) => a + App.usd(p.cost, p.currency, p), 0);
    const exp = App.db.expenses.filter(e => App.inRange(e.date, r)).reduce((a, e) => a + App.usd(e.amount, e.currency, e), 0);
    // paid penalties are income, and what is passed on to Starlink is a cost: only the difference is profit
    const ca = ca0 + penIn, cost = cost0 + penCost;
    // real revenue: without the installation fees (technicians) and the subscriptions (Starlink) that only pass through the invoice
    const real = inv.reduce((a, i) => a + App.usd(App.invSplit(i).own, i.currency, i), 0);
    return { inv, ca, cost, margin: ca - cost, exp, net: ca - cost - exp, penIn, penCost, real };
  };

  App.finance = finance;

  // ---------- Dashboard ----------
  let dper = 'month';
  const chartData = per => {
    const t = App.today(), r = App.range(per), inv = App.db.invoices.filter(i => App.live(i) && App.inRange(i.date, r));
    const val = i => App.usd(App.invAgreed(i), i.currency, i);
    let buckets;
    if (per === 'day') { buckets = Array.from({ length: 24 }, (_, h) => ({ l: h % 3 === 0 ? h + 'h' : '', t: h + ' h', v: 0 })); inv.forEach(i => { buckets[i.ts ? new Date(i.ts).getHours() : 12].v += val(i); }); }
    else if (per === 'week') { buckets = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((l, i) => ({ l, t: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][i], v: 0 })); inv.forEach(i => { buckets[App.diff(r[0], i.date)].v += val(i); }); }
    else if (per === 'month') { const n = App.diff(r[0], r[1]) + 1; buckets = Array.from({ length: n }, (_, d) => ({ l: (d + 1) % 5 === 1 ? String(d + 1) : '', t: App.fdate(App.addDays(r[0], d)), v: 0 })); inv.forEach(i => { buckets[+i.date.slice(8) - 1].v += val(i); }); }
    else { buckets = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((l, i) => ({ l, t: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][i], v: 0 })); inv.forEach(i => { buckets[+i.date.slice(5, 7) - 1].v += val(i); }); }
    return buckets;
  };
  App.views.home = () => {
    const db = App.db, S = db.settings, g = gere(), t = App.today();
    const subs = g.map(c => ({ c, s: App.sub(c) })).filter(x => x.s);
    const n = k => subs.filter(x => x.s.status === k).length;
    const soon = subs.filter(x => x.s.status === 'actif' && x.s.left <= 7), today = subs.filter(x => x.s.end === t), becomeInactive = subs.filter(x => x.s.gEnd === App.addDays(t, -1) || (x.s.status === 'inactif' && x.s.left === -1));
    const f = finance(App.range(dper)), bars = chartData(dper), max = Math.max(...bars.map(b => b.v), 1);
    const cable = db.products.filter(p => p.unit === 'm' && App.tracked(p)).reduce((a, p) => a + p.qty, 0);
    const low = db.products.filter(p => App.tracked(p) && p.qty <= (p.min || 0)).length;
    const urgent = subs.filter(x => x.s.status !== 'inactif' ? x.s.left <= 7 : x.s.left >= -1).sort((a, b) => (a.s.status === 'actif' ? a.s.left : a.s.status === 'sursis' ? a.s.left - 100 : -200) - (b.s.status === 'actif' ? b.s.left : b.s.status === 'sursis' ? b.s.left - 100 : -200)).slice(0, 8);
    // things the administrator should still set up (shown until done)
    const setup = [];
    if (App.role() === App.ROLES.admin) {
      const lastB = [S.lastBackup, App.drive && App.drive.lastDate()].filter(Boolean).sort().pop(), age = lastB ? -App.diff(lastB, t) : null, co = S.company;
      if (App.drive && App.drive.needsAttention()) setup.push(['☁️', 'Sauvegarde Google Drive : reconnexion nécessaire (Paramètres → Sauvegarde Google Drive). Elle ne se fait pas toute seule.']);
    }
    const setupAlerts = setup.map(([ico, txt]) => `<button class="item" data-act="go" data-v="settings"><span class="avatar warn" style="width:36px;height:36px;font-size:16px">${ico}</span><div class="grow"><b style="white-space:normal">${txt}</b></div><span class="mut">›</span></button>`);
    const alert = (ico, txt, cls) => `<button class="item" data-act="go" data-v="subs"><span class="avatar ${cls}" style="width:36px;height:36px;font-size:16px">${ico}</span><div class="grow"><b style="white-space:normal">${txt}</b></div><span class="mut">›</span></button>`;
    const alerts = [soon.length && alert('⚠️', `${soon.length} abonnement(s) expirent bientôt (≤ 7 jours).`, 'warn'), n('sursis') && alert('🟠', `${n('sursis')} client(s) sont actuellement en sursis.`, 'warn'), becomeInactive.length && alert('🔴', `${becomeInactive.length} client(s) deviennent inactifs aujourd'hui.`, 'bad')].filter(Boolean).concat(setupAlerts);
    // hero: real revenue of the period compared with the same stretch of the previous one, monthly goal ring, sparkline
    const per = dper, R = App.range(per), el = Math.max(0, App.diff(R[0], t)), fin = App.can('finance');
    const prevR = (() => { let a0; if (per === 'day') a0 = App.addDays(R[0], -1); else if (per === 'week') a0 = App.addDays(R[0], -7); else if (per === 'month') a0 = App.iso(new Date(+R[0].slice(0, 4), +R[0].slice(5, 7) - 2, 1)); else a0 = `${+R[0].slice(0, 4) - 1}-01-01`;
      let e0 = per === 'day' ? a0 : App.addDays(a0, el); const cap = per === 'month' ? App.addDays(R[0], -1) : per === 'year' ? `${+R[0].slice(0, 4) - 1}-12-31` : null; if (cap && e0 > cap) e0 = cap; return [a0, e0]; })();
    const prevReal = fin ? finance(prevR).real : 0, delta = prevReal > 0 ? (f.real - prevReal) / prevReal * 100 : null, PL = { day: 'hier', week: 'la semaine dernière', month: 'le mois dernier', year: "l'an dernier" }[per], PN = { day: "aujourd'hui", week: 'cette semaine', month: 'ce mois', year: 'cette année' }[per];
    const goal = +S.goal || 0, pct = goal ? Math.min(100, Math.round(f.real / goal * 100)) : 0;
    const spark = (() => { const v = bars.map(x => x.v), n2 = v.length; if (n2 < 2) return ''; const W = 200, H = 46, mx = Math.max(...v, 1), pts = v.map((y, i) => [Math.round(i / (n2 - 1) * W * 10) / 10, Math.round((H - 4 - y / mx * (H - 10)) * 10) / 10]), line = pts.map(q => q.join(',')).join(' ');
      return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><polygon points="0,${H} ${line} ${W},${H}" fill="url(#sg)"/><polyline points="${line}" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`; })();
    const ring = per === 'month' && fin ? (goal ? `<button class="ring" data-act="goal_edit" aria-label="Objectif du mois"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="7"/><circle cx="32" cy="32" r="27" fill="none" stroke="#f6c453" stroke-width="7" stroke-linecap="round" stroke-dasharray="${Math.round(pct * 1.696)} 170" transform="rotate(-90 32 32)"/></svg><b>${pct}%</b></button>` : `<button class="ring none" data-act="goal_edit"><span>🎯</span><small>Objectif</small></button>`) : '';
    const tot = n('actif') + n('sursis') + n('inactif');
    const pendHtml = App.canView('invoices') && App.stalePending().length ? `<button class="item" data-act="pend_go" style="margin-bottom:12px"><span class="avatar warn">⏳</span><div class="grow"><b>${App.stalePending().length} facture(s) en attente depuis 3 jours ou plus</b><small>Le client prend-il le produit ? Valider ou annuler</small></div><span class="mut">›</span></button>` : '';
    const unpaidHtml = App.unpaidTotal() > 0.004 ? `<button class="item" data-act="go" data-v="impayes" style="margin-bottom:12px"><span class="avatar warn">🧾</span><div class="grow"><b>Impayés : ${App.fmt(App.unpaidTotal())}</b><small>Voir et relancer</small></div><span class="mut">›</span></button>` : '';
    // start-up checklist (administrator): shown until everything is done
    const co2 = S.company, lastB2 = [S.lastBackup, App.drive && App.drive.lastDate()].filter(Boolean).sort().pop(), age2 = lastB2 ? -App.diff(lastB2, t) : null;
    const steps = App.role() === App.ROLES.admin ? [[App.hasPin(), '🔐', 'Code PIN', "Protégez l'application"], [age2 !== null && age2 <= 7, '💾', 'Sauvegarde', age2 === null ? 'Aucune sauvegarde faite' : `Dernière il y a ${age2} j`], [!!(co2.rccm || co2.idnat || co2.impot), '📄', 'Infos légales', 'RCCM, ID Nat., N° Impôt sur les factures'], [db.clients.length > 0 && db.products.length > 0, '📦', 'Clients et stock', 'Ajoutez vos clients et vos produits']] : [];
    const doneN = steps.filter(x => x[0]).length;
    const startCard = steps.length && doneN < steps.length ? `<div class="card start"><div class="spread"><b>🚀 Bien démarrer</b><span class="mut">${doneN}/${steps.length}</span></div><div class="pbar2"><i style="width:${Math.round(doneN / steps.length * 100)}%"></i></div>${steps.map(([ok2, ico, t1, t2]) => `<button class="step ${ok2 ? 'done' : ''}" data-act="go" data-v="${t1 === 'Clients et stock' ? 'clients' : 'settings'}"><span class="chk">${ok2 ? '✓' : ico}</span><div class="grow"><b>${t1}</b><small>${t2}</small></div></button>`).join('')}</div>` : '';
    const QA = [['q_invoice', '🧾', 'Facture', '#e4572e'], ['newpay', '💰', 'Encaisser', '#1f9d55'], ['q_client', '👤', 'Client', '#2f7de1'], ['q_renew', '📡', 'Renouveler', '#7c5cff']].filter(x => App.guard(x[0]));
    const todo = alerts.length || pendHtml || unpaidHtml;
    return {
      title: 'Accueil', nav: 'home',
      html: `<section class="hero">
          <div class="hero-top"><div><small>Bonjour, ${esc(App.multi() && App.user ? App.user.name : S.company.name)} 👋</small><div class="hero-date">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div><button class="chip hero-chip" data-act="rate_edit">💱 1 $ = ${App.nf(App.rate(), 0)} CDF</button></div>
          ${fin ? `<div class="hero-main"><div><small>✅ CA réel · ${PN}</small><div class="hero-num" data-count="${f.real}">${App.fmt(f.real)}</div>${delta === null ? `<span class="delta flat">kits et matériel (hors abonnements et installations)</span>` : `<span class="delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(delta))} % vs ${PL}</span>`}</div>${ring}</div>${spark}${periodChips('dper', dper)}`
          : `<div class="hero-main"><div><small>📡 Clients actifs</small><div class="hero-num">${n('actif')}</div><span class="delta flat">sur ${db.clients.length} clients</span></div></div>`}
        </section>
        <div class="search"><input readonly placeholder="Rechercher client, ACC, facture, matériel…" data-act="search"></div>
        ${QA.length ? `<div class="qa">${QA.map(([act, ico, t1, col]) => `<button data-act="${act}" style="--qc:${col}"><span>${ico}</span>${t1}</button>`).join('')}</div>` : ''}
        ${tot ? `<button class="card pulse" data-act="go" data-v="subs"><div class="spread"><b>📡 Abonnements</b><span class="mut">${db.clients.length} clients · voir ›</span></div><div class="pbar">${n('actif') ? `<i class="a" style="flex:${n('actif')}"></i>` : ''}${n('sursis') ? `<i class="s" style="flex:${n('sursis')}"></i>` : ''}${n('inactif') ? `<i class="x" style="flex:${n('inactif')}"></i>` : ''}</div><div class="plegend"><span><i class="a"></i>${n('actif')} actifs</span><span><i class="s"></i>${n('sursis')} en sursis</span><span><i class="x"></i>${n('inactif')} inactifs</span>${soon.length ? `<span class="warn">⏰ ${soon.length} expirent bientôt</span>` : ''}${today.length ? `<span class="bad">⚠️ ${today.length} aujourd'hui</span>` : ''}</div></button>` : ''}
        <div class="dash"><div style="grid-area:a">${startCard}${todo ? `<h2 class="sec">À faire</h2><div class="list">${alerts.join('')}${pendHtml}${unpaidHtml}</div>` : ''}</div>
        <div style="grid-area:b"${fin ? '' : ' hidden'}><h2 class="sec">Finances · ${PN}</h2>
        <div class="kpis"><div class="stat"><small>💰 Total facturé</small><b>${App.fmt(f.ca)}</b></div><div class="stat"><small>📈 Bénéfice net</small><b class="${f.net >= 0 ? 'ok' : 'bad'}">${App.fmt(f.net)}</b></div><div class="stat"><small>💸 Dépenses</small><b>${App.fmt(f.exp)}</b></div><div class="stat"><small>Marge brute</small><b>${App.fmt(f.margin)}</b></div></div>
        ${App.chart.bars(bars, { title: 'Ventes facturées', sub: PN })}
        </div><div style="grid-area:c"><h2 class="sec">Stock</h2><div class="grid two"><button class="stat" data-act="go" data-v="stock" style="text-align:left;font:inherit;color:inherit;cursor:pointer"><small>📦 Produits</small><b>${db.products.length}</b>${low ? `<small class="warn">${low} en stock bas</small>` : ''}</button><div class="stat"><small>📏 Câble restant</small><b>${App.nf(cable, 2)} m</b></div></div>
        </div><div style="grid-area:d">${urgent.length ? `<h2 class="sec">Renouvellements à traiter<button class="more" data-act="go" data-v="subs">Tout voir</button></h2><div class="list">${urgent.map(({ c, s }) => `<button class="item" data-act="go" data-v="client" data-id="${c.id}"><span class="avatar ${{ actif: 'ok', sursis: 'warn', inactif: 'bad' }[s.status]}">${esc(App.initials(c))}</span><div class="grow"><b>${esc(App.cname(c))}</b><small>Fin ${App.fdate(s.end)}${s.status === 'sursis' ? ' · sursis → ' + App.fdate(s.gEnd) : ''}</small></div><div class="end">${App.pill(s.status)}</div></button>`).join('')}</div>` : ''}
        </div></div>
        ${App.hasData(db) ? '' : `<div class="card" style="margin-top:14px"><b>Bienvenue 👋</b><p class="mut">Commencez par ajouter vos produits dans <b>Stock</b>, puis créez vos clients avec le bouton <b>+</b>.</p></div>`}`,
      after: () => { const el0 = document.querySelector('[data-count]'); if (!el0 || window.matchMedia('(prefers-reduced-motion:reduce)').matches) return; const to = +el0.dataset.count, t0 = performance.now(); const step = now => { const k = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - k, 3); el0.textContent = App.fmt(to * e); if (k < 1 && document.body.contains(el0)) requestAnimationFrame(step); else el0.textContent = App.fmt(to); }; requestAnimationFrame(step); }
    };
  };
  App.actions.goal_edit = () => App.modal('Objectif du mois', `<p class="mut" style="margin-top:0">Chiffre d'affaires réel visé ce mois-ci (kits et matériel, en dollars). Il s'affiche en anneau sur l'accueil.</p>${App.f.num('g_goal', 'Objectif ($)', App.db.settings.goal || '', 'placeholder="Ex. 3000"')}`, () => { App.db.settings.goal = Math.max(0, App.n('g_goal')); App.save(); App.refresh(); });
  App.actions.dper = d => { dper = d.p; App.refresh(); };

  // ---------- Subscriptions calendar ----------
  const cal = (() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth(), sel: App.today() }; })();
  const dayEvents = day => {
    const ev = [];
    gere().forEach(c => { const s = App.sub(c); if (!s) return;
      if (s.end === day) ev.push({ c, k: 'ok', t: 'Fin de l\'abonnement' });
      if (s.grace && day >= s.gStart && day <= s.gEnd) ev.push({ c, k: 'warn', t: `Sursis (jusqu'au ${App.fdate(s.gEnd)})` });
      if (App.addDays(s.gEnd, 1) === day) ev.push({ c, k: 'bad', t: 'Devient inactif' }); });
    return ev;
  };
  // the clients behind one of the three counters (Actifs / En sursis / Inactifs)
  const statusList = (subs, k) => { const l = subs.filter(x => x.s.status === k).sort((a, b) => k === 'inactif' ? b.s.end.localeCompare(a.s.end) : k === 'sursis' ? a.s.gEnd.localeCompare(b.s.gEnd) : a.s.left - b.s.left), T = { actif: 'Clients actifs', sursis: 'Clients en sursis', inactif: 'Clients inactifs' }[k], col = { actif: 'ok', sursis: 'warn', inactif: 'bad' }[k];
    return `<h2 class="sec" id="sub_list">${T} <span class="more">${l.length}</span></h2>${l.length ? `<div class="list">${l.map(({ c, s }) => `<button class="item" data-act="go" data-v="client" data-id="${c.id}"><span class="avatar ${col}">${esc(App.initials(c))}</span><div class="grow"><b>${esc(App.cname(c))}</b><small>${esc(c.plan || '')}${c.phone ? ' · ' + esc(c.phone) : ''}</small></div><div class="end"><b>${k === 'sursis' ? 'jusqu\'au ' + App.fdate(s.gEnd) : (k === 'inactif' ? 'fin le ' : '') + App.fdate(s.end)}</b>${k === 'actif' ? `<span class="mut">dans ${s.left} j</span>` : ''}</div></button>`).join('')}</div>` : '<div class="empty">Aucun client dans cette catégorie.</div>'}`; };
  App.views.subs = () => {
    const g = gere(), subs = g.map(c => ({ c, s: App.sub(c) })).filter(x => x.s), n = k => subs.filter(x => x.s.status === k).length;
    const first = new Date(cal.y, cal.m, 1), lead = (first.getDay() + 6) % 7, days = new Date(cal.y, cal.m + 1, 0).getDate(), t = App.today();
    let cells = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<div class="h">${x}</div>`).join('') + '<i></i>'.repeat(lead);
    for (let d = 1; d <= days; d++) {
      const iso = App.iso(new Date(cal.y, cal.m, d)), ev = dayEvents(iso), kinds = [...new Set(ev.map(e => e.k))];
      cells += `<button class="${iso === t ? 'today' : ''} ${iso === cal.sel ? 'sel' : ''}" data-act="calday" data-d="${iso}">${d}<span class="d">${kinds.map(k => `<i style="background:var(--${k})"></i>`).join('')}</span></button>`;
    }
    const evs = dayEvents(cal.sel);
    const upcoming = subs.filter(x => x.s.status === 'actif' && x.s.left <= 30).sort((a, b) => a.s.left - b.s.left);
    return {
      title: 'Abonnements', back: 'more', nav: 'more',
      html: `<div class="grid" style="grid-template-columns:repeat(3,1fr)">${[['actif', 'ok', 'Actifs'], ['sursis', 'warn', 'En sursis'], ['inactif', 'bad', 'Inactifs']].map(([k, col, t]) => `<button class="stat tap ${cal.f === k ? 'on' : ''}" data-act="subshow" data-v="${k}"><small><span class="dot" style="background:var(--${col})"></span>${t}</small><b>${n(k)}</b><small>${cal.f === k ? 'fermer ✕' : 'voir la liste ›'}</small></button>`).join('')}</div>
        ${cal.f ? statusList(subs, cal.f) : ''}
        <div class="bar" style="margin-bottom:12px"><button class="btn" data-act="go" data-v="rappels">📲 Rappels WhatsApp</button></div>
        <div class="card"><div class="spread" style="margin-bottom:8px"><button class="btn sm sec" data-act="calnav" data-n="-1">‹</button><b>${first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</b><button class="btn sm sec" data-act="calnav" data-n="1">›</button></div><div class="cal">${cells}</div>
          <div class="legend"><span><i style="background:var(--ok)"></i>Fin d'abonnement</span><span><i style="background:var(--warn)"></i>Période de sursis</span><span><i style="background:var(--bad)"></i>Passage à inactif</span></div></div>
        <h2 class="sec">${App.fdate(cal.sel)}</h2>${evs.length ? `<div class="list">${evs.map(e => `<button class="item" data-act="go" data-v="client" data-id="${e.c.id}"><span class="avatar ${e.k}">${esc(App.initials(e.c))}</span><div class="grow"><b>${esc(App.cname(e.c))}</b><small>${e.t}</small></div><span class="mut">›</span></button>`).join('')}</div>` : '<div class="empty">Aucun événement ce jour.</div>'}
        <h2 class="sec">Renouvellements à venir (30 jours)</h2>${upcoming.length ? `<div class="list">${upcoming.map(({ c, s }) => `<button class="item" data-act="go" data-v="client" data-id="${c.id}"><span class="avatar ok">${esc(App.initials(c))}</span><div class="grow"><b>${esc(App.cname(c))}</b><small>${esc(c.plan || '')}</small></div><div class="end"><b>${App.fdate(s.end)}</b><span class="mut">dans ${s.left} j</span></div></button>`).join('')}</div>` : '<div class="empty">Aucun renouvellement dans les 30 prochains jours.</div>'}`
    };
  };
  App.actions.subshow = d => { cal.f = cal.f === d.v ? '' : d.v; App.refresh(); const el = document.getElementById('sub_list'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  App.actions.calday = d => { cal.sel = d.d; App.refresh(); };
  App.actions.calnav = d => { const x = new Date(cal.y, cal.m + +d.n, 1); cal.y = x.getFullYear(); cal.m = x.getMonth(); App.refresh(); };

  // ---------- Reports ----------
  const rs = { tab: 'ventes', per: 'month', from: App.today().slice(0, 8) + '01', to: App.today() };
  const TABS = [['ventes', 'Ventes'], ['abos', 'Abonnements'], ['inst', 'Installations'], ['mat', 'Matériel'], ['benef', 'Bénéfices'], ['dep', 'Dépenses'], ['stock', 'Stock'], ['clients', 'Clients']];
  const rng = () => rs.per === 'custom' ? [rs.from, rs.to] : App.range(rs.per);
  const money = 'm';
  const REP = {
    ventes: r => { const inv = App.db.invoices.filter(i => App.live(i) && App.inRange(i.date, r)).sort((a, b) => b.date.localeCompare(a.date)), f = finance(r), due = inv.reduce((a, i) => a + App.usd(App.invDue(i), i.currency, i), 0);
      return { cards: [['Factures', inv.length], ['Chiffre d\'affaires', f.ca, money], ['Reste à encaisser', due, money]], head: ['Date', 'Facture', 'Client', 'Type', 'Total ($)', 'Reste ($)'], fmt: [4, 5], rows: inv.map(i => [i.date, i.number, App.cname(App.client(i.clientId)), App.invTypes[i.type], App.usd(App.invTotal(i), i.currency, i), App.usd(App.invDue(i), i.currency, i)]) }; },
    abos: r => { const lines = []; App.db.invoices.filter(i => App.live(i) && App.inRange(i.date, r)).forEach(i => i.lines.forEach(l => { if (/^abonnement/i.test(l.desc)) lines.push([i.date, i.number, App.cname(App.client(i.clientId)), l.desc, App.usd(l.qty * l.price, i.currency, i), App.usd(l.qty * (l.price - (l.cost || 0)), i.currency)]); }));
      const g = gere().map(c => App.sub(c)).filter(Boolean), n = k => g.filter(s => s.status === k).length;
      return { cards: [['Renouvellements facturés', lines.length], ['Revenus abonnements', lines.reduce((a, x) => a + x[4], 0), money], ['Marge abonnements', lines.reduce((a, x) => a + x[5], 0), money], ['Actifs / sursis / inactifs', `${n('actif')} / ${n('sursis')} / ${n('inactif')}`]], head: ['Date', 'Facture', 'Client', 'Désignation', 'Montant ($)', 'Marge ($)'], fmt: [4, 5], rows: lines.sort((a, b) => b[0].localeCompare(a[0])) }; },
    inst: r => { const l = App.db.installs.filter(x => App.inRange(x.date, r)).sort((a, b) => b.date.localeCompare(a.date));
      return { cards: [['Installations', l.length], ['Revenus', l.reduce((a, x) => a + (x.price || 0), 0), money]], head: ['Date', 'Client', 'Type', 'Technicien', 'Prix ($)'], fmt: [4], rows: l.map(x => [x.date, App.cname(App.client(x.clientId)), x.kind, x.tech || '', x.price || 0]) }; },
    mat: r => { const by = {}; App.db.invoices.filter(i => App.live(i) && App.inRange(i.date, r)).forEach(i => i.lines.forEach(l => { if (!l.pid) return; const o = by[l.pid] = by[l.pid] || { name: l.desc, unit: l.unit, q: 0, rev: 0, cost: 0 }; o.q += l.qty; o.rev += App.usd(l.qty * l.price, i.currency, i); o.cost += App.usd(l.qty * (l.cost || 0), i.currency, i); }));
      const rows = Object.values(by).sort((a, b) => b.rev - a.rev).map(o => [o.name, o.q + (o.unit ? ' ' + o.unit : ''), o.rev, o.rev - o.cost]);
      return { cards: [['Articles vendus', rows.length], ['Ventes matériel', rows.reduce((a, x) => a + x[2], 0), money], ['Marge', rows.reduce((a, x) => a + x[3], 0), money]], head: ['Article', 'Quantité', 'Ventes ($)', 'Marge ($)'], fmt: [2, 3], rows }; },
    benef: r => { const f = finance(r);
      return { cards: [['Chiffre d\'affaires (total facturé)', f.ca, money], ['CA réel (kits, matériel : sans abonnements ni installations)', f.real, money], ['Coût des marchandises', f.cost, money], ['Marge brute', f.margin, money], ['Dépenses', f.exp, money], ['Bénéfice net', f.net, money]], head: ['Facture', 'Date', 'Vente ($)', 'Coût ($)', 'Bénéfice ($)'], fmt: [2, 3, 4], rows: f.inv.sort((a, b) => b.date.localeCompare(a.date)).map(i => { const v = App.usd(App.invTotal(i), i.currency, i), c = App.usd(App.invCost(i), i.currency, i); return [i.number, i.date, v, c, v - c]; }).concat(App.db.penalties.filter(p => p.paid && App.inRange(p.paid, r)).map(p => { const v = App.usd(p.amount, p.currency, p), c = App.usd(p.cost, p.currency, p); return ['Pénalité · ' + App.cname(App.client(p.clientId)), p.paid, v, c, v - c]; })) }; },
    dep: r => { const l = App.db.expenses.filter(e => App.inRange(e.date, r)).sort((a, b) => b.date.localeCompare(a.date)), by = {}; l.forEach(e => { by[e.cat] = (by[e.cat] || 0) + App.usd(e.amount, e.currency, e); });
      return { cards: [['Dépenses', l.reduce((a, e) => a + App.usd(e.amount, e.currency, e), 0), money], ...Object.entries(by).map(([k, v]) => [k, v, money])], head: ['Date', 'Libellé', 'Catégorie', 'Montant ($)'], fmt: [3], rows: l.map(e => [e.date, e.label, e.cat, App.usd(e.amount, e.currency, e)]) }; },
    stock: () => { const p = App.db.products.filter(App.tracked), val = p.reduce((a, x) => a + x.qty * x.cost, 0), sale = p.reduce((a, x) => a + x.qty * x.price, 0);
      return { cards: [['Produits suivis', p.length], ['Valeur (achat)', val, money], ['Valeur (vente)', sale, money], ['Stock bas', p.filter(x => x.qty <= (x.min || 0)).length]], head: ['Produit', 'Catégorie', 'Quantité', 'Valeur achat ($)'], fmt: [3], rows: p.sort((a, b) => a.name.localeCompare(b.name)).map(x => [x.name, x.cat, x.qty + (x.unit === 'm' ? ' m' : ''), x.qty * x.cost]) }; },
    clients: r => { const c = App.db.clients, tot = {}; App.db.invoices.filter(App.live).forEach(i => { tot[i.clientId] = (tot[i.clientId] || 0) + App.usd(App.invAgreed(i), i.currency, i); });
      return { cards: [['Clients', c.length], ['Gérés', c.filter(x => x.type === 'gere').length], ['Matériel / Installation', `${c.filter(x => x.type === 'mat').length} / ${c.filter(x => x.type === 'install').length}`], ['Nouveaux (période)', c.filter(x => App.inRange(x.created || '', r)).length]], head: ['Client', 'Type', 'Statut', 'Total facturé ($)'], fmt: [3], rows: c.map(x => [App.cname(x), App.TYPES[x.type], App.sub(x) ? App.STATUS[App.sub(x).status][0] : '—', tot[x.id] || 0]).sort((a, b) => b[3] - a[3]) }; }
  };
  const lastReport = { head: [], rows: [] };
  // a picture for each report tab
  const chartFor = (tab, r) => {
    const db = App.db, C = App.chart;
    if (tab === 'ventes') { const rows = db.invoices.filter(i => App.live(i) && App.inRange(i.date, r)).map(i => ({ date: i.date, v: App.usd(App.invAgreed(i), i.currency, i) })), it = C.series(r, rows); return rows.length ? C.bars(it, { title: 'Ventes facturées', hl: false }) : ''; }
    if (tab === 'dep') { const by = {}; db.expenses.filter(e => App.inRange(e.date, r)).forEach(e => { by[e.cat] = (by[e.cat] || 0) + App.usd(e.amount, e.currency, e); }); return C.donut(Object.entries(by).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })), { sub: 'dépenses' }); }
    if (tab === 'benef') { const f = finance(r); return C.donut([{ label: 'Bénéfice net', value: Math.max(0, f.net), color: 'var(--ok)' }, { label: 'Coût des marchandises', value: f.cost, color: 'var(--bad)' }, { label: 'Dépenses', value: f.exp, color: 'var(--warn)' }], { top: App.fmt(f.ca), sub: 'chiffre d\'affaires' }); }
    if (tab === 'abos') { const s = gere().map(c => App.sub(c)).filter(Boolean), k = x => s.filter(y => y.status === x).length; return C.donut([{ label: 'Actifs', value: k('actif'), color: 'var(--ok)' }, { label: 'En sursis', value: k('sursis'), color: 'var(--warn)' }, { label: 'Inactifs', value: k('inactif'), color: 'var(--bad)' }], { top: String(s.length), sub: 'abonnements', fmt: v => String(v) }); }
    if (tab === 'clients') { const by = {}; db.clients.forEach(c => { by[c.type] = (by[c.type] || 0) + 1; }); return C.donut(Object.entries(by).map(([t, value]) => ({ label: App.TYPES[t] || t, value })), { top: String(db.clients.length), sub: 'clients', fmt: v => String(v) }); }
    if (tab === 'stock') { const l = db.products.filter(p => App.tracked(p)).map(p => ({ p, ratio: p.qty / Math.max(p.min || 1, 1) })).sort((a, b) => a.ratio - b.ratio).slice(0, 8); return l.length ? `<h2 class="sec">Stock le plus bas</h2>` + C.hbars(l.map(({ p }) => ({ label: p.name, v: p.qty, max: Math.max(p.qty, (p.min || 1) * 3), note: `seuil d'alerte : ${App.nf(p.min || 0, 0)}`, color: p.qty <= (p.min || 0) ? 'linear-gradient(90deg,#f59a9a,var(--bad))' : 'linear-gradient(90deg,#5fd89b,var(--ok))' })), { fmt: v => App.nf(v, 2) }) : ''; }
    return '';
  };
  App.views.reports = () => {
    const r = rng(), rep = REP[rs.tab](r), noPer = rs.tab === 'stock';
    Object.assign(lastReport, rep);
    const show = (v, i) => rep.fmt && rep.fmt.includes(i) ? App.fmt(v) : /^\d{4}-\d{2}-\d{2}$/.test(v) ? App.fdate(v) : esc(v);
    return {
      title: 'Rapports', back: 'more', nav: 'more',
      html: `<div class="tabs">${TABS.map(([k, t]) => `<button class="${rs.tab === k ? 'on' : ''}" data-act="reptab" data-t="${k}">${t}</button>`).join('')}</div>
        ${noPer ? '' : `${periodChips('repper', rs.per, `<button class="chip ${rs.per === 'custom' ? 'on' : ''}" data-act="repper" data-p="custom">Personnalisée</button>`)}${rs.per === 'custom' ? `<div class="row"><div><label class="l">Du</label><input type="date" id="r_from" value="${rs.from}"></div><div><label class="l">Au</label><input type="date" id="r_to" value="${rs.to}"></div></div>` : ''}<div class="mut" style="margin:6px 0">Période : ${App.fdate(r[0])} → ${App.fdate(r[1])}</div>`}
        <div class="grid">${rep.cards.map(([l, v, m]) => `<div class="stat"><small>${esc(l)}</small><b>${m ? App.fmt(v) : esc(v)}</b></div>`).join('')}</div>
        ${chartFor(rs.tab, r)}
        <div class="bar"><button class="btn sec" data-act="repcsv">⬇ Exporter CSV</button></div>
        ${rep.rows.length ? `<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr>${rep.head.map(h => `<th style="text-align:left;padding:9px 10px;color:var(--mut);font-size:12px;white-space:nowrap">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rep.rows.slice(0, 300).map(row => `<tr>${row.map((v, i) => `<td style="padding:8px 10px;border-top:1px solid var(--line);${rep.fmt && rep.fmt.includes(i) ? 'text-align:right;white-space:nowrap' : ''}">${show(v, i)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<div class="empty">Aucune donnée sur cette période.</div>'}`,
      after: () => { ['r_from', 'r_to'].forEach(id => { if ($(id)) $(id).onchange = () => { rs.from = $('r_from').value || rs.from; rs.to = $('r_to').value || rs.to; App.refresh(); }; }); }
    };
  };
  App.actions.reptab = d => { rs.tab = d.t; App.refresh(); };
  App.actions.repper = d => { rs.per = d.p; App.refresh(); };
  App.actions.repcsv = () => App.download(`cispolstore-rapport-${rs.tab}-${App.today()}.csv`, App.csv([lastReport.head, ...lastReport.rows]), 'text/csv');
})();
