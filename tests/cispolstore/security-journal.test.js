// Security events in the activity journal: wrong codes, PIN changes, exports, restore keeps the journal, red alert, admin only.
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8774';
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }), p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const pin = async d => { for (const c of d) await p.click(`#lock [data-k="${c}"]`); await p.waitForTimeout(250); };
  const sec = () => p.evaluate(() => (App.db.audit || []).filter(e => e.kind === 'sec').map(e => e.text));
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  // PIN creation is logged
  await p.evaluate(() => App.showLock('new1', 'setup')); await p.waitForTimeout(200); await pin('246810'); await pin('246810'); await p.waitForTimeout(300); await p.click('[data-lk=recdone]'); await p.waitForTimeout(300);
  ok('PIN creation logged', (await sec()).includes('a défini le code PIN'), JSON.stringify(await sec()));
  // wrong codes
  await p.evaluate(() => App.showLock('enter', 'unlock')); await p.waitForTimeout(200);
  await pin('111111'); await pin('111111'); await pin('111111'); await p.waitForTimeout(300);
  let t = await sec(); const fails = t.filter(x => /incorrect/.test(x));
  ok('3 wrong codes -> 3 journal entries, the third mentions the delay', fails.length === 3 && /essai 1\)/.test(fails[0]) && /essai 3, blocage 30 s/.test(fails[2]), JSON.stringify(fails));
  ok('wrong-code entries are attributed to the lock screen, not a person', await p.evaluate(() => App.db.audit.filter(e => e.fail).every(e => e.by === 'Écran de verrouillage' && e.role === 'lock')));
  await p.evaluate(() => localStorage.setItem('cispol.pinfail', JSON.stringify({ n: 3, until: 0 }))); // let the delay pass
  await pin('246810'); await p.waitForTimeout(400);
  ok('opening after 3 failures is logged', (await sec()).some(x => /Ouverture réussie après 3 mauvais essai/.test(x)));
  ok('a cancelled change does not clear the counter', await p.evaluate(async () => { localStorage.setItem('cispol.pinfail', JSON.stringify({ n: 2, until: 0 })); App.showLock('enter', 'change'); document.querySelector('#lock [data-lk=cancel]').click(); return JSON.parse(localStorage.getItem('cispol.pinfail')).n === 2; }));
  await p.evaluate(() => localStorage.removeItem('cispol.pinfail'));
  // journal view: red alert + filter (admin)
  await p.evaluate(() => App.go('journal')); await p.waitForTimeout(600); t = await p.innerText('#view');
  ok('journal shows the red alert with the number of wrong codes', /3 mauvais essai\(s\) de code cette semaine/.test(t), t.slice(0, 160).replace(/\n/g, ' | '));
  await p.click('[data-act=jr_f][data-k=kind][data-v=sec]'); await p.waitForTimeout(400); t = await p.innerText('#view');
  ok('Sécurité filter lists the PIN events only', /Code PIN incorrect/.test(t) && !/a créé/.test(t) && /Écran de verrouillage/.test(t));
  // PIN change and removal
  await p.evaluate(() => App.showLock('enter', 'change')); await p.waitForTimeout(200); await pin('246810'); await pin('135790'); await pin('135790'); await p.waitForTimeout(300); await p.click('[data-lk=recdone]'); await p.waitForTimeout(300);
  ok('PIN change logged', (await sec()).includes('a changé le code PIN'));
  await p.evaluate(() => App.showLock('enter', 'remove')); await p.waitForTimeout(200); await pin('135790'); await p.waitForTimeout(300);
  ok('PIN removal logged', (await sec()).includes('a désactivé le code PIN'));
  // exports
  await p.evaluate(() => { App.download = () => {}; App.actions.csvdo({ k: 'clients' }); App.actions.xlsx(); });
  t = await sec(); ok('CSV and Excel exports logged', t.includes('a exporté les clients en CSV') && t.includes('a exporté les données en Excel'), JSON.stringify(t.slice(-3)));
  // restore keeps the phone's own journal
  const kept = await p.evaluate(async () => { const n0 = App.db.audit.length; const old = JSON.stringify({ ...App.exportData(), audit: [] }); App.restoreData(old); return { n0, n1: (App.db.audit || []).length, still: (App.db.audit || []).some(e => e.kind === 'sec' && /défini le code PIN/.test(e.text)), restored: App.db.audit.some(e => /restauré une sauvegarde/.test(e.text)) }; });
  ok('restoring an old backup never erases the journal of this phone', kept.still && kept.restored && kept.n1 > kept.n0, JSON.stringify(kept));
  // admin only
  await p.evaluate(() => { App.db.settings.users = [{ id: 'a', name: 'Admin', role: 'admin', active: true, pin: { salt: 's', hash: 'h' } }, { id: 'v', name: 'Vic', role: 'vendeur', active: true, pin: { salt: 's2', hash: 'h' } }]; App.user = App.db.settings.users[1]; App.applyRole && App.applyRole(); });
  ok('a vendeur cannot open the journal', await p.evaluate(() => !App.canView('journal')));
  ok('no page errors', errs.length === 0, errs.join('|')); await b.close(); process.exit(f ? 1 : 0);
})();
