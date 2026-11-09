// Client statistics: average value, best clients, subscription churn (who left, who stayed, who came back), loyalty and sleeping clients.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc;
  const st = { per: 90 };
  const M = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  // subscription periods of a client, oldest first: the renewals already made plus the current one
  const periodsOf = c => { const S = App.db.settings, grace = Number.isFinite(c.grace) ? c.grace : S.grace, l = (c.subs || []).filter(p => p && p.start).map(p => ({ start: p.start, days: +p.days || +c.period || S.period }));
    if (c.start) l.push({ start: c.start, days: +c.period || S.period }); l.sort((a, b) => a.start.localeCompare(b.start));
    return l.map(p => ({ start: p.start, lastDay: App.addDays(p.start, p.days + grace) })); };
  // still a subscriber (running or in grace period) on that day?
  const activeAt = (ps, d) => ps.some(p => d >= p.start && d <= p.lastDay);
  const lapses = (ps, t) => ps.map((p, i) => ({ p, n: ps[i + 1] })).filter(x => (!x.n || x.n.start > x.p.lastDay) && App.addDays(x.p.lastDay, 1) <= t).map(x => App.addDays(x.p.lastDay, 1));

  App.clientStats = days => {
    const db = App.db, t = App.today(), from = App.addDays(t, -(days - 1)), usd = i => App.usd(App.invAgreed(i), i.currency, i);
    const life = {}, per = {}, n = {}, last = {}; let ca = 0, nInv = 0;
    db.invoices.filter(i => App.live(i) && i.clientId && App.client(i.clientId)).forEach(i => { const v = usd(i); life[i.clientId] = (life[i.clientId] || 0) + v; n[i.clientId] = (n[i.clientId] || 0) + 1; if (!last[i.clientId] || i.date > last[i.clientId]) last[i.clientId] = i.date;
      if (App.inRange(i.date, [from, t])) { per[i.clientId] = (per[i.clientId] || 0) + v; ca += v; nInv++; } });
    const buyers = Object.keys(per), ever = Object.keys(life), loyal = ever.filter(k => n[k] >= 2).length;
    const top = Object.entries(per).sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ c: App.client(id), v, life: life[id] }));
    // subscription churn over the period
    const gere = db.clients.filter(c => c.type === 'gere' && (c.start || (c.subs || []).length)), P = new Map(gere.map(c => [c.id, periodsOf(c)]));
    const base = gere.filter(c => activeAt(P.get(c.id), from)), lost = base.filter(c => !activeAt(P.get(c.id), t)), kept = base.length - lost.length;
    const back = gere.filter(c => { const ps = P.get(c.id); return !activeAt(ps, from) && activeAt(ps, t) && ps.some(p => p.start < from); });
    const risk = gere.map(c => ({ c, s: App.sub(c) })).filter(x => x.s && (x.s.status === 'sursis' || (x.s.status === 'actif' && x.s.left <= 7)));
    // new / lost per month, last 6 months
    const y = +t.slice(0, 4), m = +t.slice(5, 7) - 1, months = [];
    for (let k = 5; k >= 0; k--) { const d = new Date(y, m - k, 1), key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); months.push({ key, l: M[d.getMonth()], t: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }), v: 0, v2: 0 }); }
    const slot = d => months.find(x => x.key === (d || '').slice(0, 7));
    db.clients.forEach(c => { const s = slot(c.created); if (s) s.v++; });
    gere.forEach(c => lapses(P.get(c.id), t).forEach(d => { const s = slot(d); if (s) s.v2++; }));
    const sleepFrom = App.addDays(t, -90), sleeping = ever.filter(k => last[k] < sleepFrom && !(P.has(k) && activeAt(P.get(k), t))).map(k => ({ c: App.client(k), v: life[k], last: last[k] })).sort((a, b) => b.v - a.v);
    return { from, to: t, ca, nInv, buyers: buyers.length, avgClient: buyers.length ? ca / buyers.length : 0, basket: nInv ? ca / nInv : 0, loyal, ever: ever.length, loyalPct: ever.length ? Math.round(loyal / ever.length * 100) : 0,
      top, top5: top.slice(0, 5).reduce((a, x) => a + x.v, 0), lifeAvg: ever.length ? ever.reduce((a, k) => a + life[k], 0) / ever.length : 0,
      churn: { base: base.length, lost: lost.length, kept, back: back.length, rate: base.length ? Math.round(lost.length / base.length * 100) : null, lostList: lost, backList: back }, risk, months, sleeping,
      newClients: db.clients.filter(c => c.created && App.inRange(c.created, [from, t])).length };
  };

  App.views.clientstats = () => {
    const s = App.clientStats(st.per), C = App.chart, f = App.fmt, pct = (a, b) => b ? Math.round(a / b * 100) : 0;
    const chip = (k, t) => `<button class="chip ${st.per === k ? 'on' : ''}" data-act="cs_per" data-p="${k}">${t}</button>`;
    const row = (x, i) => `<button class="item" data-act="go" data-v="client" data-id="${x.c.id}"><span class="avatar ${i < 3 ? 'warn' : ''}">${['🥇', '🥈', '🥉'][i] || i + 1}</span><div class="grow"><b>${esc(App.cname(x.c))}</b><small>${pct(x.v, s.ca)} % du chiffre d'affaires · depuis toujours : ${f(x.life)}</small></div><div class="end"><b>${f(x.v)}</b></div></button>`;
    const ch = s.churn, hasMonths = s.months.some(x => x.v || x.v2);
    return {
      title: 'Stats clients', sub: `du ${App.fdate(s.from)} au ${App.fdate(s.to)}`, back: 'clients', nav: 'clients',
      html: `<div class="chips">${chip(30, '30 jours')}${chip(90, '3 mois')}${chip(365, '12 mois')}</div>
        <section class="hero dhero"><div class="hero-top"><div><small>👥 Valeur moyenne par client</small><div class="hero-num" data-count="${s.avgClient}">${f(s.avgClient)}</div></div></div>
          <div class="cstats"><div><b>${f(s.basket)}</b><small>panier moyen</small></div><div><b>${s.buyers}</b><small>client(s) ayant acheté</small></div><div><b>${s.loyalPct} %</b><small>fidèles (2 achats ou +)</small></div></div></section>
        <h2 class="sec">📡 Abonnements : qui part, qui reste</h2>
        <div class="grid"><div class="stat"><small>Taux de départ</small><b class="${ch.rate > 20 ? 'bad' : ch.rate > 0 ? 'warn' : 'ok'}">${ch.rate === null ? '—' : ch.rate + ' %'}</b></div><div class="stat"><small>Clients perdus</small><b class="${ch.lost ? 'bad' : ''}">${ch.lost}</b></div><div class="stat"><small>Restés abonnés</small><b class="ok">${ch.kept}</b></div><div class="stat"><small>Réactivés</small><b>${ch.back}</b></div></div>
        <p class="mut" style="font-size:13px;margin:6px 0 10px">${ch.base ? `Sur <b>${ch.base}</b> abonné(s) actifs au début de la période, <b>${ch.lost}</b> ne le sont plus (abonnement expiré, sursis dépassé).` : 'Aucun abonné actif au début de la période.'} ${ch.back ? `<b>${ch.back}</b> ancien(s) client(s) sont revenus.` : ''}</p>
        ${hasMonths ? C.bars(s.months, { two: true, hl: false, names: ['Nouveaux', 'Perdus'], fmt: v => String(Math.round(v)), title: 'Nouveaux clients et abonnements perdus', sub: '🟢 nouveaux · 🔴 perdus (6 derniers mois)' }) : ''}
        ${s.risk.length ? `<button class="item" data-act="go" data-v="relances" style="margin:10px 0"><span class="avatar warn">⚠️</span><div class="grow"><b>${s.risk.length} abonné(s) à risque</b><small>En sursis ou qui expirent dans 7 jours : relancez-les avant qu'ils partent</small></div><span class="mut">›</span></button>` : ''}
        ${ch.lostList.length ? `<h2 class="sec">Perdus sur la période</h2><div class="list">${ch.lostList.slice(0, 8).map(c => `<button class="item" data-act="go" data-v="client" data-id="${c.id}"><span class="avatar bad">${esc(App.initials(c))}</span><div class="grow"><b>${esc(App.cname(c))}</b><small>${esc(c.plan || '')}${c.phone ? ' · ' + esc(c.phone) : ''}</small></div><span class="mut">›</span></button>`).join('')}</div>` : ''}
        <h2 class="sec">🏆 Meilleurs clients</h2>
        ${s.top.length ? `<p class="mut" style="font-size:13px;margin:0 0 8px">Les 5 premiers font <b>${pct(s.top5, s.ca)} %</b> du chiffre d'affaires de la période (${f(s.ca)}). Valeur moyenne depuis toujours : <b>${f(s.lifeAvg)}</b> par client.</p><div class="list">${s.top.slice(0, 10).map(row).join('')}</div>` : '<div class="empty">Aucune vente sur cette période.</div>'}
        ${s.sleeping.length ? `<h2 class="sec">😴 Clients endormis</h2><p class="mut" style="font-size:13px;margin:0 0 8px">Pas d'achat depuis plus de 3 mois : une relance peut les ramener (${s.sleeping.length} au total).</p><div class="list">${s.sleeping.slice(0, 6).map(x => `<button class="item" data-act="go" data-v="client" data-id="${x.c.id}"><span class="avatar">${esc(App.initials(x.c))}</span><div class="grow"><b>${esc(App.cname(x.c))}</b><small>Dernier achat : ${App.fdate(x.last)}</small></div><div class="end"><b>${f(x.v)}</b><small class="mut">depuis toujours</small></div></button>`).join('')}</div>` : ''}`
    };
  };
  App.actions.cs_per = d => { st.per = +d.p; App.refresh(); };
})();
