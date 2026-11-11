const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page; await setup(p, { activity: 'commerce' });
  check('sans profil : application ouverte', !(await p.isVisible('#lock')) && await p.evaluate(() => App.can('delete') && App.canView('settings')));
  const r = await p.evaluate(async () => { try { await App.roles.addUser('Vendeur', 'seller', '1234'); return 'no'; } catch (e) { return e.message; } });
  check('le premier profil doit être administrateur', r.includes('administrateur'));
  const res = await p.evaluate(async () => { const r = await App.roles.addUser('Marie Admin', 'admin', '4321'); return { code: r.code, u: App.db.users[0] }; });
  check('code de récupération XXXX-XXXX-XXXX', /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(res.code), res.code);
  check('PIN stocké haché, jamais en clair', res.u.hash.length === 64 && !JSON.stringify(res.u).includes('4321'));
  check('PIN invalide refusé', await p.evaluate(async () => { try { await App.roles.addUser('X', 'seller', '12'); return false; } catch (e) { return true; } }));
  await p.evaluate(async () => { await App.roles.addUser('Paul Vendeur', 'seller', '1111'); await App.roles.addUser('Lea Compta', 'accountant', '2222'); await App.roles.addUser('Luc Livreur', 'driver', '3333'); App.flush(); });
  // restart: the lock screen must come first
  await t.reload(); check('verrouillé au démarrage', await p.isVisible('#lock') && (await p.textContent('#view')) === '');
  check('liste des profils', (await p.locator('#lock [data-u]').count()) === 4);
  await p.click('#lock [data-u]:has-text("Marie")'); await p.fill('#lpin', '0000'); await p.click('#lgo'); check('PIN incorrect refusé', (await p.textContent('#lmsg')).includes('incorrect') && await p.isVisible('#lock'));
  await p.fill('#lpin', '4321'); await p.keyboard.press('Enter'); await p.waitForSelector('#lock', { state: 'hidden' });
  check('PIN correct : application déverrouillée', (await p.textContent('#ttl')) === 'Ets Test' && await p.evaluate(() => App.user.name === 'Marie Admin'));
  check('administrateur : tout autorisé', await p.evaluate(() => App.can('delete') && App.can('team') && App.canView('settings') && App.canView('money')));
  // limit of the last admin
  check('le dernier administrateur ne peut pas être supprimé', await p.evaluate(() => App.roles.removeUser(App.db.users[0].id) === false));
  // seller
  await p.click('#lockbtn'); await p.click('#lock [data-u]:has-text("Paul")'); await p.fill('#lpin', '1111'); await p.click('#lgo'); await p.waitForSelector('#lock', { state: 'hidden' });
  check('vendeur : pas de Réglages ni d\'Argent', await p.evaluate(() => !App.canView('settings') && !App.canView('money') && !App.canView('cash') && App.canView('sales')));
  check('vendeur : pas de bouton Réglages', (await p.locator('#top [data-go=settings]').count()) === 0);
  check('vendeur : peut vendre et encaisser mais pas supprimer ni voir les coûts', await p.evaluate(() => App.can('sell') && App.can('pay') && !App.can('delete') && !App.can('costs') && !App.can('expense') && !App.can('export')));
  await p.evaluate(() => App.fin.expenseForm()); check('dépense refusée au vendeur', await p.isVisible('.toast.err') && !(await p.isVisible('.sheet')));
  await p.evaluate(() => { App.db.products.push({ id: 'p1', code: 'PR-1', name: 'Riz', cat: 'Général', unit: 'kg', track: true, qty: 5, min: 1, cost: 1, price: 2, fields: {}, supplierId: '' }); App.stock.form('p1'); });
  check('fiche produit refusée au vendeur (pas de droit sur le stock)', await p.isVisible('.toast.err') && !(await p.isVisible('.sheet')));
  await p.evaluate(() => App.stock.report('p1')); await p.waitForSelector('.sheet-wrap.on');
  check('vendeur : prix d\'achat et marge masqués dans le rapport produit', !(await p.textContent('.sheet dl.kv')).includes('Prix d\'achat') && !(await p.textContent('.sheet dl.kv')).includes('Marge') && (await p.textContent('.sheet dl.kv')).includes('Prix de vente'));
  await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  await p.evaluate(() => { App.user = App.db.users.find(u => u.role === 'accountant'); App.stock.report('p1'); }); await p.waitForSelector('.sheet-wrap.on');
  check('comptable : voit le prix d\'achat', (await p.textContent('.sheet dl.kv')).includes('Prix d\'achat')); await p.keyboard.press('Escape'); await p.waitForSelector('.sheet-wrap', { state: 'detached' });
  await p.evaluate(() => { App.user = App.db.users.find(u => u.role === 'seller'); });
  await p.evaluate(() => { window.location.hash = '#/money'; }); await p.waitForTimeout(200); check('écran Argent inaccessible par l\'adresse', (await p.textContent('#ttl')) !== 'Argent');
  // driver and accountant
  check('profils : livreur et comptable', await p.evaluate(async () => { const R = App.roles; const k = r => { App.user = App.db.users.find(u => u.role === r); return [App.can('pay'), App.can('costs'), App.can('reports'), App.canView('delivery'), App.canView('money')]; }; const d = k('driver'), a = k('accountant'); return JSON.stringify(d) === '[true,false,false,true,false]' && JSON.stringify(a) === '[true,true,true,true,true]'; }));
  // audit journal records who did what
  await p.evaluate(() => { App.user = App.db.users.find(u => u.role === 'admin'); }); check('journal : connexions et auteur enregistrés', await p.evaluate(() => App.db.log.some(l => l.a === 'login' && l.u === 'Marie Admin') && App.db.log.some(l => l.a === 'login.fail')));
  // lockout after 5 failures
  await p.evaluate(() => App.roles.lock()); await p.click('#lock [data-u]:has-text("Marie")'); for (let i = 0; i < 5; i++) { await p.fill('#lpin', '9999'); await p.click('#lgo'); await p.waitForTimeout(60); }
  check('5 échecs : blocage temporaire', (await p.textContent('#lmsg')).includes('patientez'));
  // recovery with the code
  await p.click('#lback'); await p.click('#lock [data-u]:has-text("Marie")'); await p.click('#lforgot'); await p.fill('#lcode', 'AAAA-AAAA-AAAA'); await p.fill('#lnew', '7777'); await p.click('#lok'); check('mauvais code de récupération refusé', (await p.textContent('#lmsg')).includes('incorrect'));
  await p.fill('#lcode', res.code.toLowerCase()); await p.selectOption('#lwho', { label: 'Marie Admin' }); await p.fill('#lnew', '7777'); await p.click('#lok'); await p.waitForSelector('#lock [data-u]');
  check('code de récupération : PIN réinitialisé', await p.evaluate(async () => { const u = App.db.users[0]; return (await App.roles.hash(u.salt, '7777')) === u.hash; }));
  // auto-lock setting is per device
  check('verrouillage automatique propre à l\'appareil', await p.evaluate(() => { App.roles.setLockMin(15); return JSON.parse(localStorage.getItem('biz.dev')).lockMin === 15 && App.roles.lockMin() === 15 && !JSON.stringify(App.db).includes('lockMin'); }));
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | ')); await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
