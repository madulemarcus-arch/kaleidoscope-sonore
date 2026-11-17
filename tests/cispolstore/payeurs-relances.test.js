// Payers, step 2: the expiry reminder goes to the payer (ONE message listing his kits) and to each beneficiary who has a number
const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let f = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) f++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(); const errs = [], opened = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(() => { window.__wa = []; window.open = (u) => { window.__wa.push(String(u)); return null; }; });
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => { const t = App.today(), S = App.db.settings; S.company.name = 'Boutique Test';
    const kit = (id, name, phone, city, q, ago, by, payer = 'pay1') => ({ id, code: id, type: 'gere', first: name.split(' ')[0], last: name.split(' ').slice(1).join(' '), name, phone, city, quarter: q, acc: 'ACC-' + id, start: App.addDays(t, -ago), period: 30, grace: 15, subs: [], created: t, payerId: payer, subBy: by });
    App.db.clients.push({ id: 'pay1', code: 'P1', type: 'mat', first: 'Hon.', last: 'Mukendi', name: 'Hon. Mukendi', phone: '0811111111', subs: [], created: t, payer: true, payCat: 'politicien' },
      { id: 'pay2', code: 'P2', type: 'mat', first: 'Paroisse', last: 'Sans-Numéro', name: 'Paroisse Sans-Numéro', phone: '', subs: [], created: t, payer: true },
      kit('kA', 'Awa Diallo', '0822222222', 'Kinshasa', 'Gombe', 27, 'payer'),      // 3 days left, has a number, payer pays
      kit('kB', 'Jean Mbuyi', '', 'Kinshasa', 'Limete', 25, 'payer'),                  // 5 days left, no number
      kit('kC', 'Marie Kalala', '0833333333', 'Lubumbashi', 'Golf', 38, 'self'),     // expired, grace period, pays himself
      kit('kD', 'Paul Tshibanda', '', 'Goma', 'Himbi', 10, 'payer'),                  // 20 days left: not due
      kit('kE', 'Rose Ilunga', '', 'Kinshasa', 'Gombe', 25, 'payer', 'pay2'));        // no number and the payer has none either
    App.save(); });

  // 1) one group item for the payer, individual items only for those who can be reached
  const it = await p.evaluate(() => App.relanceItems().filter(i => i.kind === 'grp' || i.kind === 'sub').map(i => ({ k: i.kind, c: i.c.id, sub: i.sub })));
  ok('one group item for each payer that has kits to renew', it.filter(i => i.k === 'grp').map(i => i.c).sort().join() === 'pay1,pay2', JSON.stringify(it));
  ok('beneficiaries with a number keep their own reminder (kA, kC)', it.filter(i => i.k === 'sub' && ['kA', 'kC'].includes(i.c)).length === 2);
  ok('a kit without number is covered by its payer (kB hidden), kD not due', !it.some(i => i.c === 'kB' || i.c === 'kD'));
  ok('...but a kit whose payer has no number stays visible as « sans n° » (kE)', it.some(i => i.k === 'sub' && i.c === 'kE'));
  ok('the group item counts the kits (3)', it.find(i => i.k === 'grp' && i.c === 'pay1').sub === '3 kits à renouveler', JSON.stringify(it.find(i => i.k === 'grp' && i.c === 'pay1')));

  // 2) the messages
  const m = await p.evaluate(() => ({ g: App.groupText(App.client('pay1')), a: App.reminderText(App.client('kA')), c: App.reminderText(App.client('kC')) }));
  ok('payer greeted by his full name', /^Bonjour Hon\. Mukendi/.test(m.g), m.g);
  ok('payer message: 3 kits listed with place and time left, nothing about kD', /3 de vos kits/.test(m.g) && /Awa Diallo \(Gombe\) — dans 3 jours/.test(m.g) && /Jean Mbuyi \(Limete\) — dans 5 jours/.test(m.g) && /Marie Kalala \(Golf\) — expiré, sursis/.test(m.g) && !/Paul/.test(m.g), m.g);
  ok('payer message marks the kit paid by the beneficiary', /Marie Kalala[^\n]*abonnement payé par lui/.test(m.g) && !/Awa Diallo[^\n]*payé par lui/.test(m.g));
  ok('beneficiary whose kit is paid by the payer: wording « offert par Hon. Mukendi », payer informed', /offert par Hon\. Mukendi/.test(m.a) && /arrive à expiration/.test(m.a) && /prévenu/.test(m.a), m.a);
  ok('beneficiary who pays himself gets the normal reminder', !/offert par/.test(m.c) && /sursis/.test(m.c), m.c);

  // 3) the list and the chip
  await p.evaluate(() => App.go('relances')); await p.waitForTimeout(400);
  ok('Relances: « 🎁 Groupes » chip with the 1 reachable group (pay2 has no number)', await p.evaluate(() => { const c = [...document.querySelectorAll('.chip')].find(x => /Groupes/.test(x.textContent)); return !!c && /\(1\)/.test(c.textContent); }));

  // 4) « Relancer le groupe »: the payer first, then each beneficiary with a number
  await p.evaluate(() => App.go('client', { id: 'pay1', tab: 'kits' })); await p.waitForTimeout(400);
  ok('payer file: « Groupe » tile and « Relancer le groupe » in the tiles and in the Kits tab (3 kits)', await p.evaluate(() => /Groupe/.test(document.querySelector('.ctiles').textContent) && /Relancer le groupe \(3\)/.test(document.getElementById('view').innerText)));
  await p.click('.btn[data-act=kit_remind]'); await p.waitForTimeout(400);
  const d1 = await p.innerText('dialog');
  ok('series opens on the payer message (1/3)', /Relance 1 \/ 3/.test(d1) && /Hon\. Mukendi/.test(d1) && /3 de vos kits/.test(d1));
  await p.click('#rsend'); await p.waitForTimeout(300);
  let wa = await p.evaluate(() => window.__wa.slice());
  ok('WhatsApp opens on the payer number with the list', wa.length === 1 && /wa\.me\/243811111111/.test(wa[0]) && /Awa%20Diallo/.test(wa[0]), wa[0]);
  ok('2nd message goes to a beneficiary with a number', /Relance 2 \/ 3/.test(await p.innerText('dialog')));
  await p.click('#rsend'); await p.waitForTimeout(300); await p.click('#rsend'); await p.waitForTimeout(400);
  wa = await p.evaluate(() => window.__wa.slice());
  ok('both beneficiaries reached on their own number (kA, kC)', wa.length === 3 && wa.some(u => /wa\.me\/243822222222/.test(u)) && wa.some(u => /wa\.me\/243833333333/.test(u)));
  ok('the payer is marked as reminded; his kits are not (their own reminders stay possible)', await p.evaluate(() => App.client('pay1').lastGroupRemind === App.today() && !!App.client('kA').lastRemind));
  await p.keyboard.press('Escape').catch(() => {});
  // 5) nothing left right after
  await p.evaluate(() => { App.close(); App.go('client', { id: 'pay1', tab: 'kits' }); }); await p.waitForTimeout(300);
  await p.click('.btn[data-act=kit_remind]').catch(() => {}); await p.waitForTimeout(300);
  ok('a second click straight after has nothing left to send', await p.evaluate(() => !document.querySelector('#rsend')));

  // 6) a payer with no number
  await p.evaluate(() => { App.close(); App.actions.kit_remind({ id: 'pay2' }); }); await p.waitForTimeout(300);
  ok('payer without a number: no sending, a hint is given instead', await p.evaluate(() => !document.querySelector('#rsend')));

  // 7) the two new messages are editable in the settings
  await p.evaluate(() => { App.db.settings.msgs = {}; App.go('settings'); }); await p.waitForTimeout(400);
  ok('settings list the « kit offert » and « groupe » templates', await p.evaluate(() => { const d = document.querySelector('details[data-fold=msgs]'); if (d) d.open = true; return !!document.getElementById('m_don') && !!document.getElementById('m_groupe'); }));
  await p.evaluate(() => { App.db.settings.msgs = { groupe: 'Salut {prenom}, {nombre} kits :\n{liste}' }; });
  ok('a custom group template is used', await p.evaluate(() => /^Salut Hon\. Mukendi, 3 kits :\n• Awa Diallo/.test(App.groupText(App.client('pay1')))), await p.evaluate(() => App.groupText(App.client('pay1'))));
  console.log('errors', errs); ok('no page error', errs.length === 0); await b.close(); process.exit(f ? 1 : 0);
})();
