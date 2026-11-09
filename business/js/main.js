// Shell: router, navigation (bottom tabs on phone, side menu on desktop), home screen, "More" menu, service worker.
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money;
  // id → [label, icon, module needed (null = always), step of the roadmap that delivers the screen]
  const SCREENS = {
    home: ['Accueil', '🏠', null, 1], clients: [null, '👥', null, 2], sales: ['Ventes', '🧾', 'sales', 4], stock: ['Stock', '📦', 'stock', 3], suppliers: ['Fournisseurs', '🏭', ['stock', 'purchases'], 3], money: ['Argent', '💰', null, 5],
    services: ['Services', '🛠️', 'services', 7], subs: [null, '🔁', 'subs', 7], rental: ['Location', '🔑', 'rental', 7], delivery: ['Livraisons', '🚚', 'delivery', 7],
    interventions: ['Interventions', '🧰', 'interventions', 7], contracts: ['Contrats', '📄', 'contracts', 7], purchases: ['Achats', '🛒', 'purchases', 7],
    cash: ['Caisse', '🏧', 'cash', 5], team: ['Équipe', '🧑‍💼', 'team', 6], settings: ['Réglages', '⚙️', null, 1]
  };
  App.screens = SCREENS;
  const label = id => id === 'clients' ? App.cap(App.vocab('client', true)) : id === 'subs' ? App.cap(App.vocab('sub', true)) : SCREENS[id][0];
  const enabled = id => !SCREENS[id][2] || [].concat(SCREENS[id][2]).some(App.mod);
  App.quick = [ // quick-create entries (+ button); other modules push theirs
    { label: () => 'Nouveau ' + App.vocab('client'), mod: null, to: 'clients' }, { label: () => 'Nouvelle facture', mod: 'sales', to: 'sales' },
    { label: () => 'Nouveau ' + App.vocab('product'), mod: 'stock', to: 'stock' }, { label: () => 'Nouvelle dépense', mod: null, to: 'money' }
  ];

  // ---------- routing ----------
  let cur = 'home';
  App.go = (id, params) => { if (id !== 'more' && (!SCREENS[id] || !enabled(id))) id = 'home'; const h = '#/' + id; if (location.hash === h) { cur = id; App.render(params); } else { App.params = params; location.hash = h; } };
  const fromHash = () => { const m = location.hash.match(/^#\/(\w+)/); return m ? m[1] : 'home'; };
  window.addEventListener('hashchange', () => { cur = fromHash(); App.render(App.params); App.params = null; });

  const tabsFor = () => { const mid = ['sales', 'stock', 'money'].filter(enabled).slice(0, 2); return ['home', 'clients', ...mid, 'more']; };
  const navBtn = (id, on) => '<button data-go="' + id + '" class="' + (on ? 'on' : '') + '"' + (on ? ' aria-current="page"' : '') + '><i aria-hidden="true">' + (id === 'more' ? '☰' : SCREENS[id][1]) + '</i><span>' + esc(id === 'more' ? 'Plus' : label(id)) + '</span></button>';
  const drawNav = () => {
    const t = tabsFor(), moreOn = !t.includes(cur) && cur !== 'more';
    App.$('#tabs').innerHTML = t.map(id => navBtn(id, id === cur || (id === 'more' && (cur === 'more' || moreOn)))).join('');
    App.$('#side').innerHTML = '<div class="brand">' + (App.set().logo ? '<img alt="" src="' + App.set().logo + '">' : '<b>CB</b>') + '<span>' + esc(App.set().name || 'CISPOLstore Business') + '</span></div>' + Object.keys(SCREENS).filter(enabled).filter(id => id !== 'settings').map(id => navBtn(id, id === cur)).join('') + '<div class="grow"></div>' + navBtn('settings', cur === 'settings');
    const r = App.set().rate;
    App.$('#top').innerHTML = '<h1 id="ttl"></h1><button class="chip" id="ratechip" aria-label="Modifier le taux de change">1 ' + esc(App.set().currency) + ' = ' + esc(String(r).replace(/\B(?=(\d{3})+$)/g, ' ')) + ' ' + esc(App.set().cur2) + '</button><button class="icon" data-go="settings" aria-label="Réglages">⚙️</button>';
    App.$('#ratechip').onclick = ui.rateSheet;
  };

  App.render = params => {
    if (!App.set().setup) { if (!App.$('.wizard')) App.wizard(); }
    drawNav();
    const id = cur === 'more' ? 'more' : (enabled(cur) ? cur : 'home'), v = App.views[id] || stub(id), el = App.$('#view');
    App.$('#ttl').textContent = id === 'more' ? 'Plus' : id === 'home' ? (App.set().name || 'Accueil') : (v.title || label(id));
    document.title = (id === 'home' ? '' : (id === 'more' ? 'Plus' : label(id)) + ' · ') + (App.set().name || 'CISPOLstore Business');
    el.innerHTML = ''; v.render(el, params || {}); el.scrollTop = 0;
    App.$('#fab').hidden = !(['home', 'clients', 'sales', 'stock', 'money'].includes(id) && App.set().setup);
  };
  const stub = id => ({ title: label(id), render(el) { el.innerHTML = '<div class="page"><div class="empty"><div class="big">' + SCREENS[id][1] + '</div><h2>' + esc(label(id)) + '</h2><p class="muted">Cet écran arrive à l\'étape ' + SCREENS[id][3] + ' du développement.</p></div></div>'; } });

  document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { e.preventDefault(); App.go(b.dataset.go, b.dataset.tab ? { tab: b.dataset.tab } : undefined); } });
  App.$('#fab').onclick = () => {
    const items = App.quick.filter(q => !q.mod || App.mod(q.mod));
    const sh = ui.sheet({ title: 'Ajouter', html: '<div class="quick">' + items.map((q, i) => '<button class="btn ghost big" data-q="' + i + '">' + esc(q.label()) + '</button>').join('') + '</div>', noFocus: true });
    sh.el.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const q = items[+b.dataset.q]; sh.close(); q.run ? q.run() : App.go(q.to, { add: 1 }); });
  };

  // ---------- home ----------
  const monthSum = offset => { // invoiced in the current / previous month, in the main currency
    const d = new Date(); d.setMonth(d.getMonth() - offset); const key = App.isoDate(d).slice(0, 7);
    return App.db.invoices.filter(i => !i.cancelled && (i.date || '').startsWith(key)).reduce((a, i) => a + (App.sales ? App.sales.main(i, i.total) : +i.total || 0), 0);
  };
  const todo = () => {
    const s = App.set(), t = [];
    if (!s.legal.some(l => l.v)) t.push(['Compléter les infos légales (RCCM, impôt…)', 'settings']);
    if (!s.logo) t.push(['Ajouter le logo de l\'entreprise', 'settings']);
    if (App.mod('sales') && App.sales && App.sales.unpaidList().length) t.push([App.sales.unpaidList().length + ' facture(s) impayée(s) : ' + App.money.main(App.sales.unpaidTotal()), 'sales', { tab: 'unpaid' }]);
    if (!s.lastBackup) t.push(['Faire une première sauvegarde', 'settings']);
    return t;
  };
  App.views.home = {
    render(el) {
      const s = App.set(), cm = monthSum(0), pm = monthSum(1), diff = pm ? Math.round((cm - pm) / pm * 100) : null;
      const tiles = App.quick.filter(q => !q.mod || App.mod(q.mod)).map((q, i) => '<button class="tile" data-q="' + i + '">' + esc(q.label()) + '</button>').join('');
      const start = [[App.cap(App.vocab('client')) + ' ajouté', App.db.clients.length > 0, 'clients'], ['Logo importé', !!s.logo, 'settings'], ['Infos légales remplies', s.legal.some(l => l.v), 'settings']];
      if (App.mod('stock')) start.push([App.cap(App.vocab('product')) + ' ajouté', App.db.products.length > 0, 'stock']);
      const done = start.filter(x => x[1]).length, td = todo();
      el.innerHTML = '<div class="page home"><section class="hero"><small>Chiffre d\'affaires du mois</small><div class="amt">' + M.main(cm) + '</div><div class="sub">≈ ' + M.second(cm) + (diff == null ? '' : ' · <b class="' + (diff >= 0 ? 'up' : 'down') + '">' + (diff >= 0 ? '▲ +' : '▼ ') + diff + ' %</b> vs mois précédent') + '</div>' + (s.goal > 0 ? '<div class="goalbar"><i style="width:' + Math.min(100, Math.round(cm / s.goal * 100)) + '%"></i></div><div class="sub">Objectif ' + M.main(s.goal) + ' · ' + Math.round(cm / s.goal * 100) + ' %</div>' : '') + '</section>' +
        '<section class="tiles">' + tiles + '</section>' +
        (done < start.length ? '<section class="card"><h3>Bien démarrer <small>' + done + '/' + start.length + '</small></h3><ul class="check">' + start.map(x => '<li class="' + (x[1] ? 'ok' : '') + '"><button data-go="' + x[2] + '">' + (x[1] ? '✔' : '○') + ' ' + esc(x[0]) + '</button></li>').join('') + '</ul></section>' : '') +
        (td.length ? '<section class="card"><h3>À faire</h3><ul class="check">' + td.map(x => '<li><button data-go="' + x[1] + '"' + (x[2] ? ' data-tab="' + x[2].tab + '"' : '') + '>⚠ ' + esc(x[0]) + '</button></li>').join('') + '</ul></section>' : '') + '</div>';
      const items = App.quick.filter(q => !q.mod || App.mod(q.mod));
      el.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const q = items[+b.dataset.q]; q.run ? q.run() : App.go(q.to, { add: 1 }); });
    }
  };
  App.views.more = {
    render(el) {
      const ids = Object.keys(SCREENS).filter(enabled).filter(id => id !== 'home');
      el.innerHTML = '<div class="page"><div class="grid">' + ids.map(id => '<button class="tile big" data-go="' + id + '"><i>' + SCREENS[id][1] + '</i><span>' + esc(label(id)) + '</span></button>').join('') + '</div><p class="muted center">CISPOLstore Business · ' + esc(App.BUILD) + '</p></div>';
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
