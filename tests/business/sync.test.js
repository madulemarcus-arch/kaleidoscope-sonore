// Two "phones" and a fake Supabase (the three RPC functions, in memory): encrypted blob, merge record by record, conflicts, renumbering.
const { chromium } = require('playwright'), { check } = require('./helper');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] }), store = {}, errors = [];
  const server = async route => {
    const fn = route.request().url().split('/rpc/')[1], b = JSON.parse(route.request().postData() || '{}'), r = store[b.p_ws], json = (o, st = 200) => route.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(o) });
    if (r && r.token !== b.p_token) return json({ message: 'forbidden' }, 400);
    if (fn === 'biz_head') return json(r ? { exists: true, version: r.version } : { exists: false });
    if (fn === 'biz_pull') return json(r ? { exists: true, version: r.version, blob: r.blob } : { exists: false });
    if (fn === 'biz_push') { if (!r) { store[b.p_ws] = { token: b.p_token, version: 1, blob: b.p_blob }; return json({ ok: true, version: 1 }); } if (r.version !== b.p_base) return json({ ok: false, version: r.version }); r.blob = b.p_blob; r.version++; return json({ ok: true, version: r.version }); }
    json({ message: 'unknown' }, 404);
  };
  const phone = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' }), p = await ctx.newPage(); await ctx.route('https://fake.supabase.co/**', server);
    p.on('pageerror', e => errors.push(String(e))); await p.goto(process.env.BASE_URL + '/index.html'); await p.waitForSelector('html[data-ready="1"]');
    await p.fill('.wizard input[name=name]', 'Ets Sync'); for (let i = 0; i < 3; i++) await p.click('[data-next]'); await p.waitForSelector('.wizard', { state: 'detached' }); return p;
  };
  const conn = (p, pass) => p.evaluate(pass => App.sync.connect({ url: 'https://fake.supabase.co', anon: 'sb_publishable_test', ws: 'Mon Espace', pass }), pass || 'phrase-secrete-123');
  const A = await phone(), B = await phone();
  await A.evaluate(() => { App.db.clients.push({ id: 'ca', code: 'CL-0001', name: 'Alice Test001', phone: '', type: 'Particulier', created: '2026-01-01', fields: {} }); App.db.products.push({ id: 'p1', code: 'PR-0001', name: 'Riz', cat: 'Général', unit: 'kg', track: true, qty: 100, min: 5, cost: 1, price: 2, fields: {}, supplierId: '' }); App.db.settings.city = 'Lubumbashi'; App.db.settings.theme = 'dark'; App.db.settings.seq.client = 1; App.db.settings.seq.product = 1; App.save(); });
  const r1 = await conn(A); check('A : première synchronisation envoyée', r1 === 'Envoyé' || r1.includes('Envoy'), r1);
  const blob = store['mon-espace'].blob, plain = Buffer.from(blob, 'base64').toString('latin1');
  check('le serveur ne stocke qu\'un bloc chiffré (rien de lisible)', !plain.includes('Alice') && !plain.includes('Lubumbashi') && !blob.includes('Alice') && blob.length > 100);
  check('l\'espace est normalisé (mon-espace)', Object.keys(store).join() === 'mon-espace');
  // B joins with the same 4 values
  const wrong = await B.evaluate(() => App.sync.connect({ url: 'https://fake.supabase.co', anon: 'sb_publishable_test', ws: 'mon-espace', pass: 'mauvaise-phrase-1' }).then(() => 'ok', e => e.message));
  check('mauvaise phrase secrète refusée', wrong.includes('autre phrase secrète'), wrong);
  await conn(B); check('B reçoit les clients, produits et réglages de A', await B.evaluate(() => App.db.clients.some(c => c.name === 'Alice Test001') && App.db.products.length === 1 && App.db.settings.city === 'Lubumbashi'));
  check('le thème reste propre à chaque appareil', await B.evaluate(() => App.db.settings.theme !== 'dark') && await A.evaluate(() => App.db.settings.theme === 'dark'));
  // offline edits on both phones, then sync both ways
  await A.evaluate(() => { App.db.clients.push({ id: 'cc', code: 'CL-0002', name: 'Chloé Test', phone: '', type: 'Particulier', created: '2026-01-02', fields: {} }); App.stock.move({ pid: 'p1', qty: -2, type: 'sale' }); App.db.invoices.push({ id: 'ia', number: 'FAC-2026-0001', clientId: 'ca', date: '2026-11-02', currency: 'USD', rate: 2800, lines: [{ desc: 'x', qty: 1, price: 10, cost: 0 }], sub: 10, total: 10, disc: {}, fields: {} }); App.save(); });
  await B.evaluate(() => { App.db.clients.push({ id: 'cb', code: 'CL-0002', name: 'Bob Test', phone: '', type: 'Particulier', created: '2026-01-02', fields: {} }); App.stock.move({ pid: 'p1', qty: -3, type: 'sale' }); App.db.invoices.push({ id: 'ib', number: 'FAC-2026-0001', clientId: 'cb', date: '2026-11-03', currency: 'USD', rate: 2800, lines: [{ desc: 'y', qty: 1, price: 20, cost: 0 }], sub: 20, total: 20, disc: {}, fields: {} }); App.db.clients.find(c => c.id === 'ca').phone = '0810000000'; App.save(); });
  await A.evaluate(() => App.sync.now()); await B.evaluate(() => App.sync.now()); await A.evaluate(() => App.sync.now()); await B.evaluate(() => App.sync.now());
  const sa = await A.evaluate(() => ({ clients: App.db.clients.map(c => c.name).sort(), qty: App.stock.get('p1').qty, inv: App.db.invoices.map(i => i.number).sort(), moves: App.db.movements.length, phone: App.db.clients.find(c => c.id === 'ca').phone, codes: App.db.clients.map(c => c.code).sort() }));
  const sb = await B.evaluate(() => ({ clients: App.db.clients.map(c => c.name).sort(), qty: App.stock.get('p1').qty, inv: App.db.invoices.map(i => i.number).sort(), moves: App.db.movements.length, codes: App.db.clients.map(c => c.code).sort() }));
  check('fusion : les deux téléphones ont les mêmes 3 clients', JSON.stringify(sa.clients) === JSON.stringify(sb.clients) && sa.clients.length === 3, JSON.stringify([sa.clients, sb.clients]));
  check('fusion du stock : 100 − 2 − 3 = 95 des deux côtés', sa.qty === 95 && sb.qty === 95, sa.qty + ' / ' + sb.qty);
  check('mouvements des deux appareils conservés', sa.moves === 2 && sb.moves === 2);
  check('modification faite sur B (téléphone d\'Alice) reçue par A', sa.phone === '0810000000');
  check('numéros de facture en double renumérotés (0001 et 0002)', sa.inv.length === 2 && new Set(sa.inv).size === 2 && JSON.stringify(sa.inv) === JSON.stringify(sb.inv), JSON.stringify([sa.inv, sb.inv]));
  check('codes client en double renumérotés', new Set(sa.codes).size === 3 && JSON.stringify(sa.codes) === JSON.stringify(sb.codes), JSON.stringify([sa.codes, sb.codes]));
  check('compteurs de numérotation fusionnés (max)', await A.evaluate(() => App.db.settings.seq.client >= 3));
  // deletion on one side propagates
  await B.evaluate(() => { App.db.clients = App.db.clients.filter(c => c.id !== 'cb'); App.save(); }); await B.evaluate(() => App.sync.now()); await A.evaluate(() => App.sync.now());
  check('suppression propagée', await A.evaluate(() => !App.db.clients.some(c => c.id === 'cb')));
  check('rien à envoyer : « Déjà à jour »', (await A.evaluate(() => App.sync.now())).includes('jour'));
  // disconnect keeps the data
  await A.evaluate(() => App.sync.disconnect()); check('déconnexion : données conservées', await A.evaluate(() => App.db.clients.length === 2 && !App.syncConfigured()));
  // sync card in the data screen
  await B.evaluate(() => App.go('data')); await B.waitForSelector('#syncbox .card'); check('carte de synchronisation affichée', (await B.textContent('#syncbox')).includes('Active') && (await B.textContent('#syncbox')).includes('mon-espace'));
  check('aucune erreur JS', errors.length === 0, errors.join(' | ')); await browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
