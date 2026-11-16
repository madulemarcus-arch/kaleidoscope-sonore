// End-of-service thank-you message: friendly text, reminder on the dashboard, list in "Relances du jour", client sheet button
const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); const ctx = await b.newContext({ ...devices['Pixel 5'] }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500); await p.click('[data-lk=skip]').catch(() => {});
  await p.evaluate(() => { const t = App.today(), d = App.db; d.settings.company.name = 'Boutique Test';
    d.clients.push({ id: 'c1', code: 'CL-1', type: 'gere', first: 'Awa', last: 'D', name: 'Awa D', phone: '0812345678', subs: [], created: t }, { id: 'c2', code: 'CL-2', type: 'gere', first: 'Bob', last: 'K', name: 'Bob K', phone: '', subs: [], created: t }, { id: 'c3', code: 'CL-3', type: 'gere', first: 'Cleo', last: 'M', name: 'Cleo M', phone: '0899999999', subs: [], created: t }, { id: 'c4', code: 'CL-4', type: 'gere', first: 'Old', last: 'Z', name: 'Old Z', phone: '0877777777', subs: [], created: t });
    d.installs.push({ id: 'in1', clientId: 'c1', date: App.addDays(t, -1), kind: 'Installation Starlink' }, { id: 'in4', clientId: 'c4', date: App.addDays(t, -60), kind: 'Installation Starlink' });
    d.invoices.push({ id: 'i2', number: 'FAC-2026-0002', type: 'materiel', clientId: 'c2', date: App.addDays(t, -3), currency: 'USD', lines: [{ desc: 'X', qty: 1, price: 50 }], created: t });
    d.payments.push({ id: 'p2', date: App.addDays(t, -2), clientId: 'c2', invoiceId: 'i2', amount: 50, currency: 'USD', mode: 'Cash', ref: '', comment: '' });
    d.deliveries.push({ id: 'd3', clientId: 'c3', status: 'done', doneAt: t, date: t, items: 'Kit' }); App.save(); });
  ok('3 clients are due (install, paid invoice, delivery); the 60-day-old one is not', await p.evaluate(() => App.thanksDue().map(x => x.c.id).sort().join() === 'c1,c2,c3'));
  const txt = await p.evaluate(() => App.thanksText(App.client('c1')));
  ok('friendly text: full name in bold italic, thanks for choosing the company, enjoy the service, stays short', /Bonjour \*_Awa D_\*/.test(txt) && /Merci d'avoir choisi Boutique Test/.test(txt) && /profitez-en/.test(txt) && txt.length < 400, txt);
  await p.evaluate(() => App.go('home')); await p.waitForTimeout(300); const home = (await p.innerText('#view')).replace(/\n/g, ' ');
  ok('dashboard reminder: 3 clients have not received the end-of-service message', /3 clients n'ont pas encore reçu le message de fin de service/.test(home), home.slice(0, 200));
  await p.click('[data-act=thx_go]'); await p.waitForTimeout(300);
  const rel = (await p.innerText('#view')).replace(/\n/g, ' ');
  ok("Relances du jour opens on the 💛 filter with the 3 clients", /Remerciements \(2\)/.test(rel) && /Awa D/.test(rel) && /Bob K/.test(rel) && /Cleo M/.test(rel) && !/Old Z/.test(rel));
  ok('thank-you items do not count as regular reminders', await p.evaluate(() => App.relanceCount() === 0));
  await p.evaluate(() => document.querySelector('[data-act=rel_one]').click()); await p.waitForTimeout(250);
  const pv = await p.evaluate(() => document.getElementById('dlg').innerText.replace(/\n/g, ' '));
  ok('a preview opens first, with the client name and the message', /Cleo M/.test(pv) && /Bonjour Cleo/.test(pv) && /Merci d'avoir choisi Boutique Test/.test(pv), pv.slice(0, 160));
  ok('nothing is marked before sending', await p.evaluate(() => !App.client('c3').thanksAt));
  const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 10000 }).catch(() => null), p.click('#tsend')]);
  ok('WhatsApp opens with the thank-you text, client marked', !!pop && await p.evaluate(() => App.client('c3').thanksAt === App.today()));
  ok('the client leaves the list once thanked', await p.evaluate(() => App.thanksDue().length === 2));
  await p.evaluate(() => document.querySelector('[data-act=thx_skip]').click()); await p.waitForTimeout(200);
  ok('"no message" mark removes a client without sending', await p.evaluate(() => App.thanksDue().length === 1));
  await p.evaluate(() => { const c = App.client('c2'); App.db.installs.push({ id: 'in5', clientId: 'c2', date: App.today(), kind: 'Installation Starlink' }); c.thanksAt = App.addDays(App.today(), -1); App.save(); });
  ok('a newer service makes the client due again', await p.evaluate(() => App.thanksDue().some(x => x.c.id === 'c2')));
  await p.evaluate(() => { delete App.client('c1').thanksAt; App.go('client', { id: 'c1' }); }); await p.waitForTimeout(300);
  ok('client sheet: 💛 Merci tile while the client is due', await p.evaluate(() => !!document.querySelector('.ctiles [data-act=thx_send][data-id=c1]')));
  await p.evaluate(() => App.go('client', { id: 'c1', tab: 'hist' })); await p.waitForTimeout(300);
  ok('history tab: manual 💛 end-of-service button', await p.evaluate(() => !!document.querySelector('#view .bar [data-act=thx_send][data-id=c1]')));
  await p.evaluate(() => { App.db.settings.msgs = { merci: 'Merci {prenom} !' }; });
  ok('message is editable in settings (template merci)', await p.evaluate(() => App.thanksText(App.client('c1')) === 'Merci *_Awa D_* !'));
  await p.evaluate(() => { delete App.db.settings.msgs; App.go('settings'); }); await p.waitForTimeout(300); await p.evaluate(() => { const f = document.querySelector('[data-fold=msgs], [data-id=msgs]'); if (f) f.click(); });
  ok('settings list the new template', await p.evaluate(() => !!document.getElementById('m_merci') || /Remerciement de fin de service/.test(document.body.innerText)));
  // social links appended at the end + live preview in settings
  await p.evaluate(() => { App.db.settings.company.socials = { facebook: 'https://facebook.com/boutique', instagram: 'instagram.com/boutique ', tiktok: '', whatsapp: '+243 814 048 480' }; });
  const tx2 = await p.evaluate(() => App.thanksText(App.client('c1')));
  ok('social links are added at the end of the message, one per line, blanks ignored', /À très bientôt ! Boutique Test\n\nFaites un tour sur nos réseaux :\n📘 Facebook : https:\/\/facebook\.com\/boutique\n📸 Instagram : https:\/\/instagram\.com\/boutique\n💬 WhatsApp : https:\/\/wa\.me\/243814048480$/.test(tx2), tx2.slice(-140));
  await p.evaluate(() => { App.db.settings.company.socials = {}; });
  ok('no links = no extra block', !/réseaux/.test(await p.evaluate(() => App.thanksText(App.client('c1')))));
  await p.evaluate(() => { App.go('settings'); }); await p.waitForTimeout(300); await p.evaluate(() => { const d = document.querySelector('details[data-fold=msgs]'); if (d) d.open = true; }); await p.waitForTimeout(250);
  const hasField = await p.evaluate(() => ['facebook', 'instagram', 'tiktok', 'youtube', 'whatsapp', 'linkedin', 'x', 'site'].every(k => !!document.getElementById('soc_' + k)) && !!document.getElementById('thx_prev'));
  ok('settings: one field per social network, and the preview box', hasField);
  if (hasField) { await p.fill('#soc_tiktok', 'tiktok.com/@boutique'); await p.waitForTimeout(250);
    const pt = await p.innerText('#thx_prev'); ok('preview shows a real client name and updates live with the links', /Aperçu avec/.test(pt) && /Bonjour /.test(pt) && /TikTok : https:\/\/tiktok\.com\/@boutique/.test(pt), pt.slice(0, 200)); }
  // receipt-style document: letterhead, client box, text, social links, stamp
  const doc = await p.evaluate(() => { App.db.settings.company.socials = { facebook: 'https://facebook.com/boutique' }; return App.thanksDoc(App.client('c1'), 'logo.png', 'stamp.png'); });
  ok('document uses the receipt model: letterhead (logo), REMERCIEMENT + CLIENT boxes, stamp', /logo\.png/.test(doc) && />REMERCIEMENT</.test(doc) && />CLIENT</.test(doc) && /stamp\.png/.test(doc) && /class="paper"/.test(doc));
  ok('document: the social link starts with the brand logo (inline SVG, Facebook blue)', /<svg[^>]*fill="#0866FF"[^>]*><path d="M9\.101/.test(doc));
  ok('settings fields carry the brand logos', await p.evaluate(() => { App.go('settings'); const d = document.querySelector('details[data-fold=msgs]'); if (d) d.open = true; return document.querySelectorAll('label[for^=soc_] svg').length === 8; }));
  ok('document: client name, thank-you text without emoji, social links, company name under the stamp', /Awa D/.test(doc) && /Merci d&#39;avoir choisi Boutique Test|Merci d'avoir choisi Boutique Test/.test(doc) && !/😊/.test(doc) && /Faites un tour sur nos réseaux/.test(doc) && /facebook\.com\/boutique/.test(doc) && /class="ln">Boutique Test</.test(doc));
  await p.evaluate(() => { App.db.settings.company.socials = {}; App.thanksPreview(App.client('c1')); }); await p.waitForTimeout(200);
  ok('preview offers PDF and print with letterhead and stamp', await p.evaluate(() => !!document.querySelector('#dlg [data-act=thx_pdf]') && !!document.querySelector('#dlg [data-act=thx_print]')));
  // visibility: permanent entries, whatever the number of clients to thank
  await p.evaluate(() => { App.db.clients.forEach(c => { c.thanksAt = App.today(); }); App.db.installs.forEach(x => { x.date = App.addDays(App.today(), -90); }); App.db.deliveries.forEach(x => { x.doneAt = App.addDays(App.today(), -90); x.date = x.doneAt; }); App.go('home'); }); await p.waitForTimeout(300);
  ok('none to thank: the 💛 card stays on the dashboard (quiet version)', await p.evaluate(() => App.thanksCount() === 0 && /Message de fin de service/.test(document.getElementById('view').innerText) && !!document.querySelector('#view [data-act=thx_go]')));
  await p.evaluate(() => App.go('more')); await p.waitForTimeout(300);
  ok('Plus menu: permanent « Message de fin de service » entry', await p.evaluate(() => !!document.querySelector('#view [data-act=thx_go]') && /Message de fin de service/.test(document.getElementById('view').innerText)));
  await p.evaluate(() => document.querySelector('#view [data-act=thx_go]').click()); await p.waitForTimeout(300);
  ok('the entry opens the 💛 list with a « Remercier un autre client » button', await p.evaluate(() => !!document.querySelector('[data-act=thx_pick]')));
  await p.evaluate(() => document.querySelector('[data-act=thx_pick]').click()); await p.waitForTimeout(250);
  ok('the picker lists the clients with a phone, searchable', await p.evaluate(() => { const n = document.querySelectorAll('#thx_l [data-act=thx_send]').length; const q = document.getElementById('thx_q'); q.value = 'awa'; q.dispatchEvent(new Event('input')); const v = [...document.querySelectorAll('#thx_l [data-act=thx_send]')].filter(b => !b.hidden).length; return n >= 3 && v === 1; }));
  await p.evaluate(() => document.querySelector('#thx_l [data-act=thx_send]:not([hidden])').click()); await p.waitForTimeout(250);
  ok('choosing a client opens the message preview', await p.evaluate(() => /Message de fin de service/.test(document.getElementById('dlg').innerText) && /Bonjour Awa/.test(document.getElementById('dlg').innerText)));
  await p.keyboard.press('Escape');
  // « 💛 Merci » tab on the client file, next to Abonnement / Factures / …
  await p.evaluate(() => { const c = App.db.clients.find(x => x.phone && x.type === 'gere') || App.db.clients.find(x => x.phone); window.__tc = c.id; App.go('client', { id: c.id, tab: 'thx' }); }); await p.waitForTimeout(350);
  ok('client file has a « 💛 Merci » tab', await p.evaluate(() => [...document.querySelectorAll('.tabs button')].some(b => /Merci/.test(b.textContent))));
  ok('the tab shows the status, the message and the send / PDF / print buttons', await p.evaluate(() => { const v = document.getElementById('view'); return /Message de fin de service/.test(v.innerText) && /Bonjour/.test(v.innerText) && !!v.querySelector('[data-act=thx_send]') && !!v.querySelector('[data-act=thx_pdf]') && !!v.querySelector('[data-act=thx_print]'); }));
  await p.evaluate(() => document.querySelector('#view [data-act=thx_send]').click()); await p.waitForTimeout(250);
  ok('the tab button opens the message preview', await p.evaluate(() => /Message de fin de service/.test(document.getElementById('dlg').innerText)));
  await p.keyboard.press('Escape');
  // the thank-you differs for a purchase, an installation and the complete service
  const kinds = await p.evaluate(() => { const mk = t => ({ id: 'k_' + t, code: 'K-' + t, type: t, first: 'Awa', last: 'Diallo', name: 'Awa Diallo', phone: '0812345678', subs: [] }); const r = {}; ['mat', 'install', 'gere'].forEach(t => { const c = mk(t); App.db.clients.push(c); r[t] = { k: App.thanksKind(c), n: App.thanksKindName(c), txt: App.thanksText(c), doc: App.thanksDoc(c, '', '') }; }); return r; });
  ok('kinds: mat → achat, install → install, gere → complet', kinds.mat.k === 'achat' && kinds.install.k === 'install' && kinds.gere.k === 'complet');
  ok('3 different messages (achat / installation / service complet)', new Set([kinds.mat.txt, kinds.install.txt, kinds.gere.txt]).size === 3 && /achat/.test(kinds.mat.txt) && /installation/i.test(kinds.install.txt) && /Bonjour \*_Awa Diallo_\*/.test(kinds.gere.txt));
  ok('document subject follows the kind', /Merci pour votre achat/.test(kinds.mat.doc) && /Installation terminée/.test(kinds.install.doc) && /Fin de service/.test(kinds.gere.doc));
  await p.evaluate(() => App.go('client', { id: 'k_mat', tab: 'thx' })); await p.waitForTimeout(300);
  ok('client tab names the kind', await p.evaluate(() => /Achat/.test(document.getElementById('view').innerText)));
  await p.evaluate(() => { App.db.settings.msgs = { ...(App.db.settings.msgs || {}), merci_achat: 'Achat OK {prenom}' }; });
  ok('each kind has its own editable template', await p.evaluate(() => App.thanksText(App.client('k_mat')).startsWith('Achat OK *_Awa Diallo_*') && !/Achat OK/.test(App.thanksText(App.client('k_install')))));
  // artistic document: full name in bold italic (greeting and client box), « Merci ! » title, gold frame
  const art = await p.evaluate(() => { const c = App.client('k_gere'); c.last = 'Diallo Mukendi'; c.name = 'Awa Diallo Mukendi'; const h = App.thanksDoc(c, '', ''); return { h, txt: App.thanksHtml(c) }; });
  ok('document: full name in bold italic in the greeting and in the client box', /<b><i[^>]*>Awa Diallo Mukendi<\/i><\/b>/.test(art.h) && /Nom :?[\s\S]{0,80}<b><i>Awa Diallo Mukendi<\/i><\/b>|<b><i>Awa Diallo Mukendi<\/i><\/b>/.test(art.h) && (art.h.match(/Awa Diallo Mukendi/g) || []).length >= 2);
  ok('document: « Merci ! » title and decorative frame', /Merci&nbsp;!/.test(art.h) && /❦/.test(art.h) && /e5b044/i.test(art.h));
  ok('previews show the name in bold italic (no asterisks)', /<b><i>Awa Diallo Mukendi<\/i><\/b>/.test(art.txt) && !/\*_/.test(art.txt));
  console.log('errors', errs); ok('no page error', errs.length === 0); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); await b.close(); process.exit(fails ? 1 : 0);
})();
