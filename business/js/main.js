// Shell: router, navigation (bottom tabs on phone, side menu on desktop), home screen, "More" menu, global search, service worker.
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money;
  // id → [label, emoji, module needed (null = always), step of the roadmap that delivers the screen]; the navigation icon has the same name as the id
  const SCREENS = {
    home: ['Accueil', '🏠', null, 1], clients: [null, '👥', null, 2], sales: ['Ventes', '🧾', 'sales', 4], stock: ['Stock', '📦', 'stock', 3], suppliers: ['Fournisseurs', '🏭', ['stock', 'purchases'], 3], money: ['Finances', '💰', null, 5],
    services: ['Services', '🛠️', 'services', 7], subs: [null, '🔁', 'subs', 7], rental: ['Location', '🔑', 'rental', 7], delivery: ['Livraisons', '🚚', 'delivery', 7],
    interventions: ['Interventions', '🧰', 'interventions', 7], contracts: ['Contrats', '📄', 'contracts', 7], purchases: ['Achats', '🛒', 'purchases', 7],
    cash: ['Caisse', '🏧', 'cash', 5], team: ['Équipe', '🧑‍💼', 'team', 6], data: ['Données et sécurité', '💾', null, 6], settings: ['Réglages', '⚙️', null, 1]
  };
  App.screens = SCREENS;
  const label = id => id === 'clients' ? App.cap(App.vocab('client', true)) : id === 'subs' ? App.cap(App.vocab('sub', true)) : SCREENS[id][0];
  const enabled = id => (!SCREENS[id][2] || [].concat(SCREENS[id][2]).some(App.mod)) && (!App.canView || App.canView(id));
  // quick-create entries (+ button and home tiles); qc = tile colour, ic = tile symbol. Other modules push theirs.
  App.quick = [
    { label: () => 'Nouveau ' + App.vocab('client'), mod: null, to: 'clients', qc: '#2f7de1', ic: '👤', short: () => App.cap(App.vocab('client')) },
    { label: () => 'Nouvelle facture', mod: 'sales', to: 'sales', qc: '#e4572e', ic: '🧾', short: () => 'Facture' },
    { label: () => 'Nouveau ' + App.vocab('product'), mod: 'stock', to: 'stock', qc: '#d9822b', ic: '📦', short: () => App.cap(App.vocab('product')) },
    { label: () => 'Nouvelle dépense', mod: null, to: 'money', qc: '#d64545', ic: '💸', short: () => 'Dépense' }
  ];
  const tiles = () => { // four tiles on the home screen: invoice, collect, client, then the next available action
    const list = App.quick.filter(q => !q.mod || App.mod(q.mod)), inv = list.find(q => q.to === 'sales'), cli = list.find(q => q.to === 'clients'), rest = list.filter(q => q !== inv && q !== cli);
    const collect = App.mod('sales') && App.canView('sales') ? { label: () => 'Encaisser', short: () => 'Encaisser', qc: '#1f9d55', ic: '💰', run: () => App.go('sales', { tab: 'unpaid' }) } : null;
    return [inv, collect, cli, ...rest].filter(Boolean).slice(0, 4);
  };

  // ---------- routing ----------
  let cur = 'home'; App.current = () => cur;
  App.go = (id, params) => { if (id !== 'more' && (!SCREENS[id] || !enabled(id))) id = 'home'; const h = '#/' + id; if (location.hash === h) { cur = id; App.render(params); } else { App.params = params; location.hash = h; } };
  const fromHash = () => { const m = location.hash.match(/^#\/(\w+)/); return m ? m[1] : 'home'; };
  window.addEventListener('hashchange', () => { cur = fromHash(); App.render(App.params); App.params = null; });

  const tabsFor = () => { const mid = ['sales', 'stock', 'money'].filter(enabled).slice(0, 2); return ['home', 'clients', ...mid, 'more']; };
  const navBtn = (id, on) => '<button data-go="' + id + '" class="' + (on ? 'on' : '') + '"' + (on ? ' aria-current="page"' : '') + '><i aria-hidden="true">' + App.icon(id) + '</i><span>' + esc(id === 'more' ? 'Plus' : label(id)) + '</span></button>';
  const logoSrc = () => App.set().logo || 'icons/logo.svg';
  const rateChip = cls => '<button class="' + cls + '" id="ratechip" aria-label="Modifier le taux de change">1 ' + esc(M.info(App.set().currency)[0]) + ' = ' + esc(String(App.set().rate).replace(/\B(?=(\d{3})+$)/g, ' ')) + ' ' + esc(M.info(App.set().cur2)[0]) + '</button>';
  const drawNav = id => {
    const t = tabsFor(), moreOn = !t.includes(cur) && cur !== 'more';
    App.$('#tabs').innerHTML = t.map(x => navBtn(x, x === cur || (x === 'more' && (cur === 'more' || moreOn)))).join('');
    App.$('#side').innerHTML = '<div class="brand"><img alt="" src="' + esc(logoSrc()) + '"><span>' + esc(App.set().name || App.NAME) + '</span></div>' + Object.keys(SCREENS).filter(enabled).filter(x => x !== 'settings').map(x => navBtn(x, x === cur)).join('') + '<div class="grow"></div>' + (enabled('settings') ? navBtn('settings', cur === 'settings') : '');
    App.$('#top').innerHTML = '<img class="logo" alt="" src="' + esc(logoSrc()) + '"><h1 id="ttl"></h1>' + (id === 'home' ? '' : rateChip('chip')) +
      '<button class="ib" id="gsbtn" aria-label="Rechercher">🔎</button>' + (App.syncConfigured && App.syncConfigured() ? '<button class="ib" id="syncbtn" aria-label="Synchroniser">' + App.sync.icon() + '</button>' : '') + (App.db.users.length ? '<button class="ib" id="lockbtn" aria-label="Verrouiller">🔒</button>' : '') + (App.canView('settings') ? '<button class="ib" data-go="settings" aria-label="Réglages">⚙️</button>' : '');
    const sb = App.$('#syncbtn'); if (sb) sb.onclick = async () => { App.toast('Synchronisation…'); App.toast(await App.sync.now()); }; const lb = App.$('#lockbtn'); if (lb) lb.onclick = () => App.roles.lock();
    App.$('#gsbtn').onclick = () => App.openSearch(); const rc = App.$('#ratechip'); if (rc) rc.onclick = ui.rateSheet;
  };
  // chip colours in the top bar need their own look (the home chip lives in the hero)
  const st0 = document.createElement('style'); st0.textContent = '#top .chip{border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.14);color:#fff;border-radius:99px;padding:6px 11px;font-size:.78rem;font-weight:600;white-space:nowrap}.tile.big i .ic .s{stroke:#fff}.tile.big i .ic .f{fill:rgba(255,255,255,.25)}.tile.big i .ic{width:24px;height:24px}'; document.head.appendChild(st0);

  App.render = params => {
    if (!App.set().setup) { if (!App.$('.wizard')) App.wizard(); }
    if (App.roles && App.roles.isLocked()) { App.$('#view').innerHTML = ''; return; } // nothing visible behind the lock screen
    const id = cur === 'more' ? 'more' : (enabled(cur) ? cur : 'home'), v = App.views[id] || stub(id), el = App.$('#view');
    drawNav(id);
    App.$('#ttl').textContent = id === 'more' ? 'Plus' : id === 'home' ? (App.set().name || 'Accueil') : (v.title || label(id));
    document.title = (id === 'home' ? '' : (id === 'more' ? 'Plus' : label(id)) + ' · ') + (App.set().name || App.NAME);
    el.innerHTML = ''; v.render(el, params || {}); el.scrollTop = 0; if (App.fx) el.querySelectorAll('.hero').forEach(h => App.fx.sky(h));
    App.$('#fab').hidden = !(['home', 'clients', 'sales', 'stock', 'money'].includes(id) && App.set().setup);
  };
  const stub = id => ({ title: label(id), render(el) { el.innerHTML = '<div class="page"><div class="empty"><div class="big">' + SCREENS[id][1] + '</div><h2>' + esc(label(id)) + '</h2><p class="muted">Cet écran arrive à l\'étape ' + SCREENS[id][3] + ' du développement.</p></div></div>'; } });

  document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { e.preventDefault(); App.fx && App.fx.tick(); App.go(b.dataset.go, b.dataset.tab ? { tab: b.dataset.tab } : undefined); } });
  App.$('#fab').onclick = () => {
    const items = App.quick.filter(q => !q.mod || App.mod(q.mod));
    const sh = ui.sheet({ title: 'Ajouter', html: '<div class="quick">' + items.map((q, i) => '<button class="btn ghost big" data-q="' + i + '">' + esc(q.label()) + '</button>').join('') + '</div>', noFocus: true });
    sh.el.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const q = items[+b.dataset.q]; sh.close(); q.run ? q.run() : App.go(q.to, { add: 1 }); });
  };

  // ---------- global search: clients, products, suppliers, invoices ----------
  App.openSearch = () => {
    const sh = ui.sheet({ title: 'Rechercher', wide: true, html: '<input type="search" id="gsq" placeholder="Nom, code, téléphone, facture, produit…" autocomplete="off"><div id="gsr" class="muted">Tapez pour chercher dans toute l\'application.</div>' });
    const q = sh.q('#gsq'), box = sh.q('#gsr'), open = fn => { sh.close(); setTimeout(fn, 220); };
    const draw = () => {
      const r = App.search(q.value); if (!q.value.trim()) { box.className = 'muted'; box.textContent = 'Tapez pour chercher dans toute l\'application.'; return; }
      const groups = [['clients', App.cap(App.vocab('client', true)), x => x.name, x => x.code + (x.phone ? ' · ' + x.phone : ''), x => App.clients.profile(x.id)], ['products', App.cap(App.vocab('product', true)), x => x.name, x => x.code + (x.cat ? ' · ' + x.cat : ''), x => App.stock.report(x.id)], ['suppliers', 'Fournisseurs', x => x.name, x => x.code + (x.phone ? ' · ' + x.phone : ''), x => App.suppliers.profile(x.id)], ['invoices', 'Factures', x => x.number, x => App.sales.cname(x) + ' · ' + App.fmtDate(x.date), x => App.sales.profile(x.id)]].filter(g => r[g[0]].length && (g[0] !== 'products' && g[0] !== 'suppliers' || App.mod('stock') || App.mod('purchases')) && (g[0] !== 'invoices' || App.mod('sales')));
      box.className = ''; box.innerHTML = groups.length ? groups.map(g => '<h4>' + esc(g[1]) + ' (' + r[g[0]].length + ')</h4><div class="list">' + r[g[0]].slice(0, 6).map(x => '<div class="swr" style="--n:0"><div class="item" data-g="' + g[0] + '|' + x.id + '" role="button" tabindex="0"><span class="tx"><b>' + esc(g[2](x)) + '</b><small>' + esc(g[3](x)) + '</small></span></div></div>').join('') + '</div>').join('') : '<p class="muted">Aucun résultat.</p>';
      box.querySelectorAll('[data-g]').forEach(i => i.onclick = () => { const [k, id] = i.dataset.g.split('|'), g = groups.find(y => y[0] === k), x = r[k].find(y => y.id === id); open(() => g[4](x)); });
    };
    q.oninput = draw;
  };

  // ---------- home ----------
  const hs = { p: 'month', counted: '' };
  const PERIODS = [['today', 'Aujourd\'hui'], ['week', 'Cette semaine'], ['month', 'Ce mois'], ['year', 'Cette année']];
  const revenue = r => App.db.invoices.filter(i => !i.cancelled && App.fin.inR(i.date || '', r)).reduce((a, i) => a + (App.sales ? App.sales.main(i, i.total) : +i.total || 0), 0);
  const spark = () => { // last 30 days of invoicing as a soft area
    const days = Array.from({ length: 30 }, (_, k) => App.addDays(App.today(), k - 29)), raw = days.map(d => App.db.invoices.filter(i => !i.cancelled && i.date === d).reduce((a, i) => a + (App.sales ? App.sales.main(i, i.total) : 0), 0)), v = raw.map((x, k) => (raw[Math.max(0, k - 2)] + raw[Math.max(0, k - 1)] + x + raw[Math.min(29, k + 1)] + raw[Math.min(29, k + 2)]) / 5), mx = Math.max(...v, 1e-9);
    if (!v.some(x => x > 0)) return ''; const pts = v.map((x, k) => [k * 10, 40 - x / mx * 34]); const line = pts.map((p, k) => (k ? 'L' : 'M') + p[0] + ' ' + p[1].toFixed(1)).join(' ');
    return '<svg class="spark" viewBox="0 0 290 44" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="spg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><path d="' + line + ' L290 44 L0 44Z" fill="url(#spg)"/><path d="' + line + '" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  };
  App.goalSheet = () => {
    const s = App.set(); ui.sheet({ title: 'Objectif du mois', html: '<p class="muted">Chiffre d\'affaires visé par mois, en ' + esc(s.currency) + '. Il s\'affiche sur l\'accueil et dans les rapports.</p>' + ui.field('Objectif', ui.input('goal', s.goal || '', { num: 1 })),
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: sh => { s.goal = ui.read(sh.body).goal || 0; App.save(); App.render(); } }] });
  };
  const todo = () => {
    const s = App.set(), t = [];
    if (!s.legal.some(l => l.v)) t.push(['Compléter les infos légales (RCCM, impôt…)', 'settings']);
    if (!s.logo) t.push(['Ajouter le logo de l\'entreprise', 'settings']);
    if (App.mod('sales') && App.sales && App.sales.unpaidList().length) t.push([App.sales.unpaidList().length + ' facture(s) impayée(s) : ' + App.money.main(App.sales.unpaidTotal()), 'sales', { tab: 'unpaid' }]);
    if (!s.lastBackup || Date.now() - s.lastBackup > 7 * 864e5) t.push([s.lastBackup ? 'Sauvegarde ancienne (plus de 7 jours)' : 'Faire une première sauvegarde', 'data']);
    if (!App.db.users.length && App.can('settings')) t.push(['Protéger l\'application avec un PIN', 'data']);
    return t;
  };
  App.views.home = {
    render(el) {
      const s = App.set(), r = App.fin.range(hs.p), cur0 = revenue(r), prev = revenue(App.fin.prevRange(r)), diff = prev ? Math.round((cur0 - prev) / prev * 100) : null, now = new Date(), hr = now.getHours();
      const greet = (hr < 5 || hr >= 19 ? 'Bonsoir 🌙' : hr < 12 ? 'Bonjour ☀️' : 'Bonjour') + (s.name ? ', ' + s.name : '') + ' 👋', dateTxt = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, c => c.toUpperCase());
      const gp = hs.p === 'month' && s.goal > 0 ? Math.round(cur0 / s.goal * 100) : null, circ = 2 * Math.PI * 30;
      const ring = hs.p !== 'month' ? '' : gp != null ? '<button class="ring" id="goal" aria-label="Modifier l\'objectif"><svg viewBox="0 0 76 76"><circle cx="38" cy="38" r="30" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="7"/><circle cx="38" cy="38" r="30" fill="none" stroke="' + (gp >= 100 ? '#9be7b3' : '#f6c453') + '" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (circ * Math.min(gp, 100) / 100).toFixed(1) + ' ' + circ.toFixed(1) + '"/></svg><b>' + gp + ' %</b></button>' : '<button class="ring none" id="goal"><span>🎯</span><small>Objectif</small></button>';
      const q = tiles(), start = [[App.cap(App.vocab('client')) + ' ajouté', App.db.clients.length > 0, 'clients', '👥'], ['Logo importé', !!s.logo, 'settings', '🖼️'], ['Infos légales remplies', s.legal.some(l => l.v), 'settings', '📋']];
      if (App.mod('stock')) start.push([App.cap(App.vocab('product')) + ' ajouté', App.db.products.length > 0, 'stock', '📦']);
      const done = start.filter(x => x[1]).length, td = todo(), cnt = [['clients', '👥', App.db.clients.length + ' ' + App.vocab('client', App.db.clients.length !== 1)]]; if (App.mod('sales')) cnt.push(['sales', '🧾', App.db.invoices.length + ' facture' + (App.db.invoices.length !== 1 ? 's' : '')]); if (App.mod('stock')) cnt.push(['stock', '📦', App.db.products.length + ' ' + App.vocab('product', App.db.products.length !== 1)]);
      el.innerHTML = '<div class="page home"><section class="hero"><div class="hero-top"><div><div class="hello">' + esc(greet) + '</div><div class="hero-date">' + esc(dateTxt) + '</div></div>' + rateChip('rate') + '</div>' +
        '<div class="hero-main"><div><small>Chiffre d\'affaires · ' + esc(r.label) + '</small><div class="amt" id="amt">' + M.main(cur0) + '</div><div class="sub">≈ ' + M.second(cur0) + (diff == null ? '' : ' <span class="delta ' + (diff >= 0 ? 'up' : 'down') + '">' + (diff >= 0 ? '▲ +' : '▼ ') + diff + ' %</span>') + '</div></div>' + ring + '</div>' + spark() +
        '<div class="chips" id="per">' + PERIODS.map(p => '<button data-p="' + p[0] + '" class="' + (hs.p === p[0] ? 'on' : '') + '">' + p[1] + '</button>').join('') + '</div></section>' +
        '<button class="gs" id="gs"><span aria-hidden="true">🔎</span> Rechercher ' + esc(App.vocab('client')) + ', facture, ' + esc(App.vocab('product')) + '…</button>' +
        '<section class="qa">' + q.map((x, i) => '<button data-q="' + i + '"><span style="--qc:' + x.qc + '">' + x.ic + '</span>' + esc(x.short ? x.short() : x.label()) + '</button>').join('') + '</section>' +
        '<div class="cnts">' + cnt.map(c => '<button data-go="' + c[0] + '"><i>' + c[1] + '</i>' + esc(c[2]) + '</button>').join('') + '</div>' +
        (done < start.length ? '<section class="card start"><h3>🚀 Bien démarrer <small>' + done + '/' + start.length + '</small></h3><div class="pbar2"><i style="width:' + Math.round(done / start.length * 100) + '%"></i></div>' + start.map(x => '<button class="step ' + (x[1] ? 'done' : '') + '" data-go="' + x[2] + '"><span class="chk">' + (x[1] ? '✔' : x[3]) + '</span><span><b>' + esc(x[0]) + '</b></span></button>').join('') + '</section>' : '') +
        (td.length ? '<section class="card"><h3>À faire</h3><ul class="check">' + td.map(x => '<li><button data-go="' + x[1] + '"' + (x[2] ? ' data-tab="' + x[2].tab + '"' : '') + '>⚠ ' + esc(x[0]) + '</button></li>').join('') + '</ul></section>' : '') + '</div>';
      // sky behind the hero, count-up on the first display of each period
      App.fx.sky(el.querySelector('.hero')); const amt = el.querySelector('#amt'), key = hs.p; if (hs.counted !== key) { hs.counted = key; App.fx.countUp(amt, cur0, M.main); }
      el.querySelectorAll('#per [data-p]').forEach(b => b.onclick = () => { hs.p = b.dataset.p; App.fx.tick(); App.views.home.render(el); });
      el.querySelector('#gs').onclick = () => App.openSearch(); const g = el.querySelector('#goal'); g && (g.onclick = App.goalSheet); const rc = el.querySelector('#ratechip'); rc && (rc.onclick = ui.rateSheet);
      el.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { App.fx.tick(); const x = q[+b.dataset.q]; x.run ? x.run() : App.go(x.to, { add: 1 }); });
      if (hs.p === 'month' && s.goal > 0 && cur0 >= s.goal && s.goalHit !== r.from.slice(0, 7)) { s.goalHit = r.from.slice(0, 7); App.save(); setTimeout(() => App.fx.celebrate('Objectif du mois atteint ! 🎉'), 400); }
    }
  };
  App.views.more = {
    render(el) {
      // Screens already in the bottom bar are not repeated; the rest is grouped by what the user is doing.
      const inBar = tabsFor(), ids = Object.keys(SCREENS).filter(enabled).filter(id => id !== 'home' && !inBar.includes(id));
      const GROUPS = [['Vendre', ['sales', 'services', 'interventions', 'subs', 'rental', 'delivery', 'contracts']], ['Gérer', ['stock', 'suppliers', 'purchases', 'money', 'cash', 'team']], ['Réglages', ['data', 'settings']]];
      const HINT = { services: 'Prestations', interventions: 'Visites', money: 'Dépenses, rapports', cash: 'Comptage du jour', data: 'Sauvegarde, PIN' };
      const tile = id => '<button class="tile big" data-go="' + id + '"><i>' + App.icon(id) + '</i><span>' + esc(label(id)) + '</span>' + (HINT[id] ? '<small class="muted">' + esc(HINT[id]) + '</small>' : '') + '</button>';
      const used = new Set(), html = GROUPS.map(([t, list]) => { const l = list.filter(id => ids.includes(id)); l.forEach(id => used.add(id)); return l.length ? '<h3 class="grp">' + t + '</h3><div class="grid">' + l.map(tile).join('') + '</div>' : ''; }).join('');
      const rest = ids.filter(id => !used.has(id)); // any screen added later still shows up
      el.innerHTML = '<div class="page">' + html + (rest.length ? '<h3 class="grp">Autres</h3><div class="grid">' + rest.map(tile).join('') + '</div>' : '') + '<p class="muted center">' + esc(App.NAME) + ' · ' + esc(App.BUILD) + '</p></div>';
    }
  };

  // ---------- service worker + update notice ----------
  const sw = () => {
    if (!('serviceWorker' in navigator) || !/^https?:/.test(location.protocol)) return;
    navigator.serviceWorker.register('sw.js').then(reg => {
      const ask = w => App.toast('Nouvelle version disponible', '', { label: 'Mettre à jour', fn: () => w.postMessage('skipWaiting') });
      if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
      reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w); }); });
    }).catch(() => { });
    let reloading = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
  };

  App.on('settings', () => App.render());
  App.on('rate', () => App.render());
  App.ready.then(() => {
    ui.applyTheme(); cur = fromHash();
    const go = new URLSearchParams(location.search).get('go'); if (go && SCREENS[go]) cur = go; // home-screen shortcuts
    App.render(); sw(); document.documentElement.dataset.ready = '1';
  });
})();
