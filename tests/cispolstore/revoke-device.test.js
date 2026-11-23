// Revoking a lost phone: devices are listed, the manager revokes one, it erases itself at its next synchronisation and says so; a fake Supabase in memory.
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8774';
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }), store = {}, errs = [];
  const server = async route => {
    const fn = route.request().url().split('/rpc/')[1], q = JSON.parse(route.request().postData() || '{}'), r = store[q.p_ws], json = (o, st = 200) => route.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(o) });
    if (r && r.token !== q.p_token) return json({ message: 'forbidden' }, 400);
    if (fn === 'cispol_head') return json(r ? { exists: true, version: r.version } : { exists: false });
    if (fn === 'cispol_pull') return json(r ? { exists: true, version: r.version, blob: r.blob } : { exists: false });
    if (fn === 'cispol_push') { if (!r) { store[q.p_ws] = { token: q.p_token, version: 1, blob: q.p_blob }; return json({ ok: true, version: 1 }); } if (r.version !== q.p_base) return json({ ok: false, version: r.version }); r.blob = q.p_blob; r.version++; return json({ ok: true, version: r.version }); }
    json({ message: 'unknown' }, 404);
  };
  const phone = async () => {
    const ctx = await b.newContext({ ...devices['Pixel 5'], serviceWorkers: 'block' }), p = await ctx.newPage(); await ctx.route('https://fake.supabase.co/**', server);
    p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Téléphone de Vic' : undefined));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {}); return p;
  };
  const conn = p => p.evaluate(() => App.sync.connect({ url: 'https://fake.supabase.co', anon: 'sb_publishable_test', ws: 'espace', pass: 'phrase-secrete-123' }));
  const A = await phone(), B = await phone(), C = await phone();
  await A.evaluate(() => { App.db.clients.push({ id: 'k1', code: 'K1', first: 'Awa', last: 'K', name: 'Awa K', phone: '1', subs: [], type: 'mat', created: App.today(), note: '' }); App.save(); });
  await conn(A); await conn(B); await conn(C); await A.evaluate(() => App.sync.now());
  ok('three phones are listed with names, none revoked', await A.evaluate(() => App.db.devices.length === 3 && App.db.devices.every(d => d.name && !d.revoked)));
  const idB = await B.evaluate(() => localStorage.getItem('cispol.devid')), idC = await C.evaluate(() => localStorage.getItem('cispol.devid')), idA = await A.evaluate(() => localStorage.getItem('cispol.devid'));
  ok('each phone has its own device id', new Set([idA, idB, idC]).size === 3 && await A.evaluate(ids => ids.every(i => App.db.devices.some(d => d.id === i)), [idA, idB, idC]));
  // the manager screen
  await A.evaluate(() => App.actions.syncdev()); await A.waitForTimeout(300);
  let t = await A.innerText('#dlg'); ok('screen lists the 3 devices, the current one marked', (t.match(/Autorisé/g) || []).length === 3 && /cet appareil/.test(t) && /Révoquer/.test(t) && /reste hors connexion/.test(t));
  ok('the current phone cannot be revoked (no button on it)', await A.locator('#dlg [data-act=syncrevoke]').count() === 2);
  await A.evaluate(id => App.actions.syncrename({ id }), idB); await A.waitForTimeout(300);
  ok('a device can be renamed', await A.evaluate(id => App.db.devices.find(d => d.id === id).name === 'Téléphone de Vic', idB));
  // revoke B: nothing happens to B until it synchronises
  await A.evaluate(id => App.actions.syncrevoke({ id }), idB); await A.waitForTimeout(600);
  ok('B is marked revoked on A and the journal says it', await A.evaluate(id => App.db.devices.find(d => d.id === id).revoked > 0 && App.db.audit.some(e => /a révoqué l'appareil « Téléphone de Vic »/.test(e.text)), idB));
  ok('B has its data until it goes online', await B.evaluate(() => !!localStorage.getItem('cispolstore-v2') && !window.__wiped));
  const r = await B.evaluate(() => App.sync.now()); await B.waitForTimeout(500);
  ok('B synchronises, sees it is revoked and erases itself', r === 'Appareil révoqué' && await B.evaluate(() => window.__wiped === true && !localStorage.getItem('cispolstore-v2') && !localStorage.getItem('cispolstore-sync')));
  ok('B shows the "Appareil révoqué" screen and keeps only its device id', /Appareil révoqué/.test(await B.innerText('body')) && await B.evaluate(id => localStorage.getItem('cispol.devid') === id && Object.keys(localStorage).filter(k => /^cispol/.test(k)).length === 1, idB));
  ok('nothing of B was sent after the revocation (the clients of A are untouched)', await A.evaluate(() => App.sync.now().then(() => App.db.clients.length === 1)));
  ok('A learns that B was wiped', await A.evaluate(id => { const d = App.db.devices.find(x => x.id === id); return d.revoked > 0 && d.wiped > 0; }, idB));
  await A.evaluate(() => App.actions.syncdev()); await A.waitForTimeout(300);
  t = await A.innerText('#dlg'); ok('the screen shows « Effacé le » for B, without a Rétablir button for it', /Effacé le/.test(t) && await A.locator('#dlg [data-act=syncrestore]').count() === 0);
  // a revoked phone that reconnects is wiped again (it stays revoked)
  await B.reload({ waitUntil: 'load' }); await B.waitForTimeout(500); await B.click('[data-lk=skip]').catch(() => {});
  const again = await conn(B).catch(e => 'ERR ' + e.message); await B.waitForTimeout(500);
  ok('B reconnecting with the passphrase is revoked again and erased again', again === 'Appareil révoqué' && await B.evaluate(() => window.__wiped === true && !localStorage.getItem('cispolstore-v2')) && /Appareil révoqué/.test(await B.innerText('body')), String(again));
  // revoke then restore C before it synchronises
  await A.evaluate(id => App.actions.syncrevoke({ id }), idC); await A.waitForTimeout(500); await A.evaluate(id => App.actions.syncrestore({ id }), idC); await A.waitForTimeout(500);
  ok('C revoked then restored in time: not revoked any more', await A.evaluate(id => App.db.devices.find(d => d.id === id).revoked === 0 && App.db.audit.some(e => /a rétabli l'appareil/.test(e.text)), idC));
  await C.evaluate(() => App.sync.now()); await C.waitForTimeout(400);
  ok('C keeps its data and is not wiped', await C.evaluate(() => !window.__wiped && App.db.clients.length === 1 && !!localStorage.getItem('cispolstore-v2')));
  // restoring a backup never un-revokes
  ok('restoring an old backup keeps the list of devices', await A.evaluate(() => { const n = App.db.devices.length, old = JSON.stringify({ ...App.exportData(), devices: [] }); App.restoreData(old); return App.db.devices.length === n; }));
  ok('only the manager can run the actions (vendeur refused)', await A.evaluate(() => { App.db.settings.users = [{ id: 'a', name: 'A', role: 'admin', active: true, pin: { salt: 's', hash: 'h' } }, { id: 'v', name: 'V', role: 'vendeur', active: true, pin: { salt: 's2', hash: 'h' } }]; App.user = App.db.settings.users[1]; return !App.guard('syncrevoke') && !App.guard('syncdev') && !App.guard('syncrestore'); }));
  ok('no page errors', errs.length === 0, errs.join('|')); await b.close(); process.exit(f ? 1 : 0);
})();
