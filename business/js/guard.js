// Sécurité & gardiennage (module « Gardiennage »): the guarded sites (a customer, a number of agents, a monthly price per agent), the monthly bills and the agents' salaries. A bill is one ordinary invoice (source
// « Sécurité ») per site and per month, so the cash drawer, the unpaid list, the journal and the profit stay right; the number of agents and the price are copied into the bill (changing the site never rewrites a past
// month). Uncovered agent-days are deducted (a negative line: price ÷ 30 per agent-day). Paying an agent for a month is a real expense (« Salaires agents », cancellable, once per agent and month). Agents are the
// employees of the application. Operations are never edited, only cancelled. Nothing derived is stored: what is left to bill for a month, the balance of a bill, the late bills, the margin, the report.
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money, A = App.sales, C = App.clients, F = App.fin, ST = App.staff, norm = C.norm, db = () => App.db;
  const SG = App.guard = {};
  const sites = () => db().sgSites, bills = () => db().sgBills, ops = () => db().sgOps, cur = () => db().settings.currency, rd = n => M.round(n, cur()), num = v => parseFloat(String(v).replace(',', '.')) || 0, r2 = n => Math.round(n * 100) / 100, live = x => x.status !== 'Annulé';
  SG.cfg = () => Object.assign({ lateDays: 30 }, db().settings.sg || {}); SG.site = id => sites().find(s => s.id === id); SG.billOf = id => bills().find(b => b.id === id);
  const client = id => db().clients.find(c => c.id === id), cname = id => client(id) ? client(id).name : '(supprimé)', inv = b => { const i = b && b.invoiceId && A.get(b.invoiceId); return i && A.live(i) ? i : null; }, sname = id => SG.site(id) ? SG.site(id).name : '(supprimé)';
  const expense = (cat, amount, mode, date, note) => { const e = { id: App.uid(), at: Date.now(), amount, currency: cur(), rate: db().settings.rate, category: cat, mode, supplierId: '', date, note }; if (!F.cats().includes(cat)) F.cats().push(cat); db().expenses.push(e); return e.id; };
  const dropExp = id => { if (id) db().expenses = db().expenses.filter(e => e.id !== id); };
  SG.thisMonth = () => App.today().slice(0, 7); SG.prevMonth = () => { const [y, m] = App.today().split('-').map(Number); return m === 1 ? (y - 1) + '-12' : y + '-' + String(m - 1).padStart(2, '0'); }; SG.label = m => String(m).split('-').reverse().join('/'); const okMonth = m => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

  // ---------- sites ----------
  SG.saveSite = (f, id) => {
    const name = String(f.name || '').trim(), cl = client(f.clientId); if (!name) return { err: 'Donnez un nom au site' }; if (!cl) return { err: 'Choisissez le client' }; const agents = Math.round(num(f.agents)), rate = num(f.rate); if (!(agents >= 1 && agents <= 500)) return { err: 'Nombre d\'agents entre 1 et 500' }; if (!(rate > 0)) return { err: 'Indiquez le prix par agent et par mois' };
    if (sites().some(s => s.id !== id && s.clientId === cl.id && norm(s.name) === norm(name))) return { err: 'Ce site existe déjà pour ce client' }; const start = f.start || App.today(); const rec = { name, clientId: cl.id, address: String(f.address || '').trim(), agents, rate, start, active: f.active !== false };
    let s = id ? SG.site(id) : null; if (s) Object.assign(s, rec); else { s = { id: App.uid(), ...rec }; sites().push(s); } App.log('guard.site', s.name); App.save(); return s;
  };
  SG.deleteSite = s => { if (bills().some(b => b.siteId === s.id)) return 'bills'; db().sgSites = sites().filter(x => x.id !== s.id); App.save(); return true; };
  SG.toBill = m => sites().filter(s => s.active && s.start.slice(0, 7) <= m && !bills().some(b => live(b) && b.siteId === s.id && b.month === m));
  SG.monthly = () => rd(sites().filter(s => s.active).reduce((a, s) => a + s.agents * s.rate, 0));

  // ---------- bills ----------
  SG.bill = f => {
    const s = SG.site(f.siteId); if (!s) return { err: 'Choisissez le site' }; if (!s.active) return { err: 'Site inactif' }; const m = String(f.month || '').trim(); if (!okMonth(m)) return { err: 'Mois invalide' }; if (m > SG.thisMonth()) return { err: 'Mois futur' }; if (m < s.start.slice(0, 7)) return { err: 'Avant le début du contrat' };
    if (bills().some(b => live(b) && b.siteId === s.id && b.month === m)) return { err: 'Ce mois est déjà facturé' }; if (!client(s.clientId)) return { err: 'Client introuvable' };
    const abs = Math.max(0, num(f.absDays)), extra = num(f.extra), base = rd(s.agents * s.rate), ded = rd(Math.min(base, s.rate / 30 * abs)), total = rd(base - ded + extra); if (!(total > 0)) return { err: 'Total nul' }; const paid = num(f.paid); if (paid < 0 || paid > total + 0.004) return { err: 'Montant invalide' };
    const L = [{ pid: '', desc: 'Gardiennage ' + s.name + ' · ' + SG.label(m), qty: s.agents, price: s.rate, cost: 0 }]; if (ded > 0) L.push({ pid: '', desc: 'Jours non couverts (' + abs + ' agent-jour(s))', qty: 1, price: -ded, cost: 0 }); if (extra) L.push({ pid: '', desc: String(f.extraDesc || '').trim() || 'Supplément', qty: 1, price: extra, cost: 0 });
    const b = { id: App.uid(), number: A.nextNo('SG', 'sg', () => bills()), date: App.today(), at: Date.now(), siteId: s.id, clientId: s.clientId, month: m, agents: s.agents, rate: s.rate, absDays: abs, extra, status: 'Valide', note: f.note || '' };
    const i = A.createInvoice({ clientId: s.clientId, lines: L, paid: 0, mode: f.mode || db().settings.modes[0], date: App.today(), source: 'Sécurité', note: b.number + ' · ' + s.name }); b.invoiceId = i.id; if (paid > 0) A.addPayment(i, { amount: paid, currency: i.currency, mode: f.mode || db().settings.modes[0], date: App.today(), note: 'Acompte' }, true);
    bills().push(b); App.log('guard.bill', b.number + ' ' + total); App.save(); return b;
  };
  SG.billAll = m => { let n = 0; const errs = []; SG.toBill(m).forEach(s => { const r = SG.bill({ siteId: s.id, month: m }); if (r.err) errs.push(s.name + ' : ' + r.err); else n++; }); return { n, errs }; };
  SG.stat = b => { const i = inv(b); return i ? { total: A.main(i, i.total), paid: A.main(i, A.paid(i)), due: A.main(i, A.due(i)), inv: i } : { total: 0, paid: 0, due: 0, inv: null }; };
  SG.late = b => live(b) && SG.stat(b).due > 0.004 && App.diff(b.date, App.today()) > SG.cfg().lateDays;
  SG.cancel = b => { if (!live(b)) return false; const i = inv(b); if (i && A.paid(i) > 0) return 'paid'; if (i) i.cancelled = true; b.status = 'Annulé'; App.log('guard.cancel', b.number); App.save(); return true; };

  // ---------- agents' salaries ----------
  SG.paySalary = f => {
    const a = ST.get(f.agentId); if (!a) return { err: 'Choisissez l\'agent' }; const m = String(f.month || '').trim(); if (!okMonth(m)) return { err: 'Mois invalide' }; if (m > SG.thisMonth()) return { err: 'Mois futur' }; const amount = rd(num(f.amount)); if (!(amount > 0)) return { err: 'Indiquez le montant' };
    if (ops().some(o => live(o) && o.agentId === a.id && o.month === m)) return { err: 'Ce mois est déjà payé à cet agent' }; const o = { id: App.uid(), number: A.nextNo('PG', 'pg', () => ops()), date: f.date || App.today(), at: Date.now(), agentId: a.id, month: m, amount, mode: f.mode || db().settings.modes[0], status: 'Valide', note: f.note || '' };
    o.expenseId = expense('Salaires agents', amount, o.mode, o.date, a.name + ' · ' + SG.label(m) + ' · ' + o.number); ops().push(o); App.log('guard.pay', o.number + ' ' + a.name); App.save(); return o;
  };
  SG.cancelOp = o => { if (!live(o)) return false; dropExp(o.expenseId); o.status = 'Annulé'; App.save(); return true; };

  // ---------- report, to-do ----------
  SG.report = r => {
    const bs = bills().filter(b => live(b) && F.inR(b.date, r)), os = ops().filter(o => live(o) && F.inR(o.date, r)), by = {}; let billed = 0, due = 0; bs.forEach(b => { const s = SG.stat(b); billed += s.total; due += s.due; const k = by[b.siteId] = by[b.siteId] || { name: sname(b.siteId), v: 0 }; k.v += s.total; });
    const sal = os.reduce((a, o) => a + o.amount, 0), act = sites().filter(s => s.active);
    return { n: bs.length, billed: rd(billed), collected: rd(billed - due), due: rd(due), salaries: rd(sal), margin: rd(billed - sal), by: Object.values(by).sort((a, b) => b.v - a.v), sites: act.length, agents: act.reduce((a, s) => a + s.agents, 0), monthly: SG.monthly(), toBill: SG.toBill(SG.prevMonth()).length, late: bills().filter(SG.late).length, unpaid: rd(bills().filter(live).reduce((a, b) => a + SG.stat(b).due, 0)) };
  };
  SG.reportText = r => { const c = SG.report(r), s = db().settings; return 'Rapport gardiennage — ' + s.name + ' · ' + r.label + '\n• Facturé : ' + M.main(c.billed) + ' (' + c.n + ' facture(s))\n• Encaissé : ' + M.main(c.collected) + '\n• Salaires payés : ' + M.main(c.salaries) + '\n• Marge : ' + M.main(c.margin) + (c.unpaid > 0.004 ? '\n• À encaisser : ' + M.main(c.unpaid) : ''); };
  SG.todo = () => {
    const t = []; if (!App.mod('guard')) return t; const R = SG.report({ from: '9999-12-30', to: '9999-12-31', label: '' }); if (R.toBill) t.push([R.toBill + ' site(s) à facturer pour ' + SG.label(SG.prevMonth()), 'guard', { tab: 'bills', m: SG.prevMonth() }]); if (R.late) t.push([R.late + ' facture(s) en retard de paiement', 'guard', { tab: 'bills' }]); if (!sites().length) t.push(['Ajoutez vos sites gardés', 'guard', { tab: 'sites' }]); return t;
  };
  const wa = (ph, text) => window.open('https://wa.me/' + (ph ? C.intl(ph) : '') + '?text=' + encodeURIComponent(text), '_blank');
  SG.msg = b => { const o = db().settings, s = SG.stat(b), cl = client(b.clientId) || {}; return { ph: cl.phone || '', text: 'Bonjour ' + (cl.name || '') + ',\nla facture ' + b.number + ' (gardiennage ' + sname(b.siteId) + ', ' + SG.label(b.month) + ') reste à payer : ' + M.main(s.due) + '.\nMerci.\n' + o.name + (o.phone ? ' · ' + o.phone : '') }; };
  SG.print = b => { const s = SG.stat(b); A.printHtml(A.page('Facture ' + b.number, cname(b.clientId) + ' · ' + sname(b.siteId) + ' · ' + SG.label(b.month), '<p>' + b.agents + ' agent(s) × ' + esc(M.main(b.rate)) + (b.absDays ? ' − ' + b.absDays + ' agent-jour(s) non couvert(s)' : '') + '</p><p><b>Total : ' + esc(M.main(s.total)) + '</b> · payé ' + esc(M.main(s.paid)) + ' · reste ' + esc(M.main(s.due)) + '</p>')); };

  // ---------- forms ----------
  const after = msg => { App.toast(msg); App.render(); }, ERR = r => { if (r && r.err) { App.toast(r.err, 'err'); return true; } return false; };
  const clientOpts = () => [['', '— Choisir —'], ...db().clients.slice().sort((a, b) => norm(a.name).localeCompare(norm(b.name))).map(c => [c.id, c.name])], siteOpts = () => [['', '— Choisir —'], ...sites().filter(s => s.active).map(s => [s.id, s.name + ' · ' + cname(s.clientId)])];
  SG.siteForm = id => {
    const s = id && SG.site(id), sh = ui.sheet({ title: s ? s.name : 'Nouveau site', html: '<div id="sf">' + ui.field('Nom du site *', ui.input('name', s && s.name)) + ui.field('Client *', ui.select('clientId', clientOpts(), s ? s.clientId : '')) + ui.field('Adresse', ui.input('address', s && s.address)) + '<div class="row2">' + ui.field('Agents *', ui.input('agents', s ? s.agents : '', { num: 1 })) + ui.field('Prix par agent / mois *', ui.input('rate', s ? s.rate : '', { num: 1 })) + '</div>' + ui.field('Début du contrat', ui.dateField('start', s ? s.start : App.today())) + '<label class="chk"><input type="checkbox" id="sa"' + (!s || s.active ? ' checked' : '') + '> Contrat actif</label></div>', actions: [...(s ? [{ label: 'Supprimer', cls: 'ghost', fn: async () => { if (await ui.confirm('Supprimer ' + s.name + ' ?', 'Supprimer', true)) { const r = SG.deleteSite(s); if (r === 'bills') App.toast('Des factures existent : désactivez plutôt le site', 'err'); else { after('Site supprimé'); sh.close(); } } return false; } }] : []), { label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: x => { const f = ui.read(sh.q('#sf')); f.active = sh.q('#sa').checked; const r = SG.saveSite(f, id); if (ERR(r)) return false; after(r.name + ' enregistré'); } }] });
  };
  SG.billForm = (siteId, month) => {
    const sh = ui.sheet({ title: 'Facture du mois', html: '<div id="bf">' + ui.field('Site *', ui.select('siteId', siteOpts(), siteId || '')) + ui.field('Mois *', ui.input('month', month || SG.prevMonth())) + '<p class="muted">Format AAAA-MM.</p><div class="row2">' + ui.field('Agent-jours non couverts', ui.input('absDays', '', { num: 1 })) + ui.field('Supplément', ui.input('extra', '', { num: 1 })) + '</div><div class="row2">' + ui.field('Acompte', ui.input('paid', '', { num: 1 })) + ui.field('Mode', ui.select('mode', db().settings.modes, db().settings.modes[0])) + '</div></div>', actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Facturer', cls: 'primary', fn: x => { const r = SG.bill(ui.read(sh.q('#bf'))); if (ERR(r)) return false; after(r.number + ' créée'); } }] });
  };
  SG.salaryForm = () => {
    const sh = ui.sheet({ title: 'Salaire d\'un agent', html: '<div id="pf">' + ui.field('Agent *', ui.select('agentId', ST.opts('— Choisir —'), '')) + '<div class="row2">' + ui.field('Mois *', ui.input('month', SG.prevMonth())) + ui.field('Montant *', ui.input('amount', '', { num: 1 })) + '</div>' + ui.field('Mode', ui.select('mode', db().settings.modes, db().settings.modes[0])) + '</div>', actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Payer', cls: 'primary', fn: x => { const r = SG.paySalary(ui.read(sh.q('#pf'))); if (ERR(r)) return false; after(r.number + ' · ' + M.main(r.amount)); } }] });
  };
  const menu = (title, its) => { const m = ui.sheet({ title, html: '<div class="list">' + its.map((x, k) => '<div class="item" data-m="' + k + '" role="button" tabindex="0"><span class="tx"><b>' + esc(x[0]) + '</b></span></div>').join('') + '</div>' }); m.body.querySelectorAll('[data-m]').forEach(e => e.onclick = () => { m.close(); setTimeout(its[+e.dataset.m][1], 220); }); };
  SG.billMenu = id => {
    const b = SG.billOf(id); if (!b) return; const s = SG.stat(b);
    menu(b.number + ' · ' + sname(b.siteId), [['💳 Encaisser', () => s.inv && A.payForm(s.inv.id), !!s.inv && s.due > 0.004 && App.can('pay')], ['💬 Rappel de paiement', () => { const m = SG.msg(b); wa(m.ph, m.text); }, live(b) && s.due > 0.004], ['🖨️ Imprimer', () => SG.print(b), live(b)], ['🧾 Voir la facture', () => s.inv && A.profile(s.inv.id), !!s.inv], ['❌ Annuler la facture', async () => { if (await ui.confirm('Annuler ' + b.number + ' ?', 'Annuler', true)) { const r = SG.cancel(b); if (r === 'paid') App.toast('Un paiement existe : supprimez d\'abord les paiements', 'err'); else after('Facture annulée'); } }, live(b) && App.can('delete')]].filter(x => x[2]).map(x => [x[0], x[1]]));
  };

  // ---------- screen ----------
  const row = (id, ic, title, sub, end, attr) => '<div class="swr" style="--n:0"><div class="item" ' + attr + '="' + id + '" role="button" tabindex="0"><span class="av">' + ic + '</span><span class="tx"><b>' + esc(title) + '</b><small>' + sub + '</small></span><span class="end">' + end + '</span></div></div>', pill = (t, tone) => '<span class="pill ' + (tone || '') + '">' + esc(t) + '</span>';
  const st = { tab: 'sites', m: '' };
  const tabSites = tab => {
    tab.innerHTML = '<div class="tools">' + (App.can('cash') ? '<button class="btn primary" id="ns">+ Site</button>' : '') + '</div><div class="stats card"><div><b>' + sites().filter(s => s.active).length + '</b><small>sites</small></div><div><b>' + sites().filter(s => s.active).reduce((a, s) => a + s.agents, 0) + '</b><small>agents</small></div><div><b>' + esc(M.main(SG.monthly())) + '</b><small>par mois</small></div></div>' + (sites().length ? '<div class="list">' + sites().map(s => row(s.id, '🛡️', s.name, esc(cname(s.clientId)) + ' · ' + s.agents + ' agent(s) × ' + esc(M.main(s.rate)), '<b>' + esc(M.main(s.agents * s.rate)) + '</b> ' + (s.active ? '' : pill('Inactif', 'bad')), 'data-s')).join('') + '</div>' : ui.empty('🛡️', 'Aucun site', 'Ajoutez un site gardé : client, nombre d\'agents, prix mensuel.', App.can('cash') ? { label: '+ Site', to: '#ns' } : null));
    if (tab.querySelector('#ns')) tab.querySelector('#ns').onclick = () => SG.siteForm(); tab.querySelectorAll('[data-s]').forEach(i => i.onclick = () => App.can('cash') && SG.siteForm(i.dataset.s));
  };
  const tabBills = tab => {
    const m = st.m || SG.prevMonth(), todo = SG.toBill(m), l = bills().slice().sort((a, b) => b.at - a.at);
    tab.innerHTML = '<div class="tools">' + (App.can('sell') ? '<button class="btn primary" id="nb">+ Facture</button><button class="btn ghost" id="ba">Facturer ' + esc(SG.label(m)) + ' (' + todo.length + ')</button>' : '') + '</div><div class="seg" id="mm">' + [[SG.prevMonth(), 'Mois dernier'], [SG.thisMonth(), 'Ce mois']].map(x => '<button data-mo="' + x[0] + '" class="' + (m === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>' + (l.length ? '<div class="list">' + l.map(b => { const s = SG.stat(b); return row(b.id, '🧾', b.number + ' · ' + sname(b.siteId), esc(SG.label(b.month)) + ' · ' + esc(cname(b.clientId)) + (SG.late(b) ? ' · ⚠️ retard' : ''), (s.due > 0.004 && live(b) ? '<b class="bad">' + esc(M.main(s.due)) + '</b> ' : '<b>' + esc(M.main(s.total)) + '</b> ') + (live(b) ? '' : pill('Annulée', 'bad')), 'data-b'); }).join('') + '</div>' : ui.empty('🧾', 'Aucune facture', 'Facturez le mois : une facture par site.', null));
    const q2 = x => tab.querySelector(x); if (q2('#nb')) { q2('#nb').onclick = () => SG.billForm('', m); q2('#ba').onclick = () => { const r = SG.billAll(m); if (r.errs.length) App.toast(r.errs[0], 'err'); after(r.n + ' facture(s) créée(s)'); }; } tab.querySelectorAll('[data-mo]').forEach(b => b.onclick = () => { st.m = b.dataset.mo; tabBills(tab); }); tab.querySelectorAll('[data-b]').forEach(i => i.onclick = () => SG.billMenu(i.dataset.b));
  };
  const tabAgents = tab => {
    const l = ops().slice().sort((a, b) => b.at - a.at); tab.innerHTML = '<div class="tools">' + (App.can('cash') ? '<button class="btn primary" id="np">+ Salaire</button>' : '') + '</div>' + (l.length ? '<div class="list">' + l.map(o => row(o.id, '👮', o.number + ' · ' + (ST.get(o.agentId) || { name: '(supprimé)' }).name, esc(SG.label(o.month)), '<b>' + esc(M.main(o.amount)) + '</b> ' + (live(o) ? '' : pill('Annulé', 'bad')), 'data-o')).join('') + '</div>' : ui.empty('👮', 'Aucun salaire payé', 'Enregistrez le salaire d\'un agent : c\'est une dépense.', null));
    if (tab.querySelector('#np')) tab.querySelector('#np').onclick = () => SG.salaryForm(); tab.querySelectorAll('[data-o]').forEach(i => i.onclick = () => { const o = ops().find(x => x.id === i.dataset.o); if (o && live(o) && App.can('delete')) menu('Salaire ' + o.number, [['❌ Annuler ce paiement', async () => { if (await ui.confirm('Annuler ' + o.number + ' ?', 'Annuler', true)) { SG.cancelOp(o); after('Paiement annulé'); } }]]); });
  };
  const tabRep = tab => {
    const r = F.range(F.state.r), c = SG.report(r);
    tab.innerHTML = F.rangeChips() + '<section class="hero"><small>Facturé · ' + esc(r.label) + '</small><div class="amt">' + M.main(c.billed) + '</div><div class="sub">' + c.n + ' facture(s) · marge ' + esc(M.main(c.margin)) + '</div></section><div class="stats card"><div><b>' + esc(M.main(c.collected)) + '</b><small>encaissé</small></div><div><b>' + esc(M.main(c.salaries)) + '</b><small>salaires</small></div><div class="' + (c.unpaid > 0.004 ? 'bad' : '') + '"><b>' + esc(M.main(c.unpaid)) + '</b><small>à encaisser</small></div></div><section class="card"><h3>Par site</h3><div class="list">' + (c.by.length ? c.by.map(x => '<div class="item"><span class="av">🛡️</span><span class="tx"><b>' + esc(x.name) + '</b></span><span class="end"><b>' + esc(M.main(x.v)) + '</b></span></div>').join('') : '<p class="muted center">Aucune facture.</p>') + '</div></section><div class="tools"><button class="btn ghost" id="rc">Copier</button><button class="btn ghost" id="rw">💬 WhatsApp</button></div>';
    tab.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { F.state.r = b.dataset.r; tabRep(tab); });
    tab.querySelector('#rc').onclick = () => (navigator.clipboard ? navigator.clipboard.writeText(SG.reportText(r)) : Promise.reject()).then(() => App.toast('Copié'), () => App.toast('Copie impossible', 'err')); tab.querySelector('#rw').onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent(SG.reportText(r)), '_blank');
  };
  App.views.guard = { title: 'Gardiennage', render(el, params) {
    if (params && params.tab) st.tab = params.tab; if (params && params.m) st.m = params.m; const tabs = [['sites', 'Sites'], ['bills', 'Factures'], ['agents', 'Agents'], ...(App.can('reports') ? [['rep', 'Rapport']] : [])]; if (!tabs.some(t => t[0] === st.tab)) st.tab = 'sites';
    el.innerHTML = '<div class="page"><div class="seg" id="sgtabs">' + tabs.map(t => '<button data-t="' + t[0] + '" class="' + (st.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div><div id="sgtab" class="page" style="padding:0"></div></div>';
    el.querySelectorAll('#sgtabs button').forEach(b => b.onclick = () => { st.tab = b.dataset.t; App.views.guard.render(el); });
    ({ sites: tabSites, bills: tabBills, agents: tabAgents, rep: tabRep })[st.tab](el.querySelector('#sgtab'));
  } };
  App.quick.push({ label: () => 'Facture gardiennage', mod: 'guard', to: 'guard', qc: '#1e3a5f', ic: '🛡️', short: () => 'Gardiennage', run: () => { App.go('guard', { tab: 'bills' }); setTimeout(() => SG.billForm('', SG.prevMonth()), 200); } });
})();
