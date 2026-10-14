// Génère les images de la fiche Play Store à partir de données FICTIVES : 7 captures de téléphone et le graphique de présentation.
//   cd tests && npm install && npx playwright install chromium     (une seule fois)
//   node play/generer-captures.js                                    (depuis la racine du dépôt)
const { chromium } = require(require.resolve('playwright', { paths: [__dirname + '/../tests', __dirname, process.cwd()] }));
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', 'cispolstore'), OUT = path.join(__dirname, 'captures');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
const seed = () => {
  const t = App.today(), A = App.addDays, S = App.db.settings; S.lastBackup = t; S.period = 30; S.grace = 15;
  const N = ['Aline Kabasele', 'Bruno Mbuyi', 'Cécile Ngoy', 'David Kasongo', 'Esther Lumbu', 'Félix Tshimanga', 'Grâce Mwamba', 'Hervé Kalala', 'Irène Ilunga', 'Joël Banza', 'Karine Mutombo', 'Léon Kabongo'];
  const starts = [-10, -27, -33, -14, -60, 0, -22, -40, -5, -75, -18, -29], plans = ['Illimité', 'Résidentiel', 'Illimité', '250 Go'];
  N.forEach((n, i) => { const [first, last] = n.split(' '); const g = i !== 5 && i !== 7;
    App.db.clients.push({ id: 'c' + i, code: 'CL-' + String(i + 1).padStart(4, '0'), type: g ? 'gere' : 'mat', first, last, name: n, phone: '08' + String(14000000 + i * 91234).slice(0, 8), acc: g ? 'ACC-' + String(10000 + i * 777) : '', plan: g ? plans[i % 4] : '', price: g ? [70, 40, 70, 25][i % 4] : 0, start: g ? A(t, starts[i]) : undefined, period: 30, created: A(t, -150 + i * 9), subs: g ? [-100, -70].map(d => ({ start: A(t, d + starts[i] + 10), days: 30, price: 70, date: A(t, d) })) : [], note: '' }); });
  App.db.products.push({ id: 'p1', name: 'Starlink Mini (kit)', cat: 'Kits Starlink', price: 450, cost: 380, qty: 6, min: 3, ref: 'SL-MINI' }, { id: 'p2', name: 'Starlink Standard (kit)', cat: 'Kits Starlink', price: 520, cost: 440, qty: 2, min: 3, ref: 'SL-STD' }, { id: 'p3', name: 'Routeur Wi-Fi 6', cat: 'Routeurs', price: 55, cost: 38, qty: 14, min: 4, ref: 'RT-W6' }, { id: 'p4', name: 'Câble 30 m', cat: 'Câbles', price: 60, cost: 40, qty: 9, min: 5, ref: 'CB-30' }, { id: 'p5', name: 'Injecteur PoE', cat: 'Injecteurs PoE', price: 25, cost: 14, qty: 3, min: 5, ref: 'PoE-1' });
  const inv = (c, d, lines, paid) => App.createInvoice({ type: 'materiel', clientId: c, currency: 'USD', payMode: ['Cash', 'M-Pesa', 'Airtel Money', 'Banque'][paid % 4], date: d, lines, payAmount: paid }, 0);
  const day = n => { const d = A(t, -n); return d.slice(0, 7) === t.slice(0, 7) ? d : t.slice(0, 7) + '-01'; };
  inv('c5', day(1), [{ pid: 'p1', desc: 'Starlink Mini (kit)', qty: 1, price: 450, cost: 380 }, { pid: 'p4', desc: 'Câble 30 m', qty: 1, price: 60, cost: 40 }], 510);
  inv('c7', day(2), [{ pid: 'p3', desc: 'Routeur Wi-Fi 6', qty: 2, price: 55, cost: 38 }], 60);
  inv('c0', day(3), [{ pid: '', desc: 'Abonnement Illimité', qty: 1, price: 70, cost: 64 }], 70);
  inv('c1', day(4), [{ pid: '', desc: 'Abonnement Résidentiel', qty: 1, price: 40, cost: 34 }], 40);
  inv('c2', day(6), [{ pid: 'p2', desc: 'Starlink Standard (kit)', qty: 1, price: 520, cost: 440 }], 300);
  inv('c3', day(8), [{ pid: 'p5', desc: 'Injecteur PoE', qty: 2, price: 25, cost: 14 }], 50);
  inv('c6', day(9), [{ pid: '', desc: 'Abonnement Illimité', qty: 1, price: 70, cost: 64 }], 70);
  App.db.expenses.push({ id: 'e1', date: day(2), label: 'Transport', amount: 15, currency: 'USD', cat: 'Transport', mode: 'Cash' }, { id: 'e2', date: day(5), label: 'Loyer du local', amount: 240000, currency: 'CDF', cat: 'Loyer', mode: 'Banque', rate: 2400 });
  App.db.penalties.push({ id: 'pn1', clientId: 'c4', amount: 5, currency: 'USD', reason: 'Retard de paiement', date: A(t, -3), paid: '', rate: 2400, cost: 5 });
  App.db.quotes = [{ id: 'q1', no: 'DEV-2026-0001', clientId: 'c9', date: t, until: A(t, 14), currency: 'USD', lines: [{ desc: 'Starlink Mini (kit)', qty: 1, price: 450 }], status: 'open', rate: 2400 }];
  App.save();
};
(async () => {
  await new Promise(r => server.listen(0, r)); const base = 'http://localhost:' + server.address().port;
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await b.newContext({ viewport: { width: 392, height: 780 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true, locale: 'fr-FR' }), p = await ctx.newPage();
  await p.goto(base + '/index.html'); await p.waitForTimeout(600); await p.click('[data-lk=skip]', { timeout: 2000 }).catch(() => {});
  await p.evaluate(seed);
  const shots = [['home', '1-accueil'], ['clients', '2-clients'], [['client', { id: 'c0' }], '3-fiche-client'], ['relances', '4-relances'], ['clientstats', '5-statistiques'], ['finance', '6-finance'], ['stock', '7-stock']];
  for (const [view, name] of shots) {
    await p.evaluate(v => (Array.isArray(v) ? App.go(v[0], v[1]) : App.go(v)), view); await p.waitForTimeout(1500);
    await p.evaluate(() => { document.querySelectorAll('#toast,.toast').forEach(e => e.remove()); window.scrollTo(0, 0); }); await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(OUT, name + '.png') }); console.log('capture', name);
  }
  // feature graphic 1024x500 (the home capture inside a phone frame)
  const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const g = await (await b.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 })).newPage();
  await g.setContent(`<style>*{box-sizing:border-box}body{margin:0;width:1024px;height:500px;overflow:hidden;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:linear-gradient(120deg,#0d2a4a 0%,#12365d 45%,#1e5aa8 100%);color:#fff;position:relative}
  .glow{position:absolute;right:-80px;top:-120px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(229,176,68,.55),transparent 68%)}
  .logo{position:absolute;left:56px;top:34px;width:118px;background:#fff;border-radius:18px;padding:8px}
  h1{position:absolute;left:56px;top:166px;margin:0;font-size:46px;line-height:1.08;width:400px;font-weight:800;letter-spacing:-.5px}
  p{position:absolute;left:56px;top:290px;margin:0;font-size:21px;line-height:1.45;width:390px;opacity:.92}
  .tags{position:absolute;left:56px;top:420px;display:flex;gap:8px;width:400px;flex-wrap:wrap}.tags span{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);padding:6px 13px;border-radius:99px;font-size:15px}
  .ph{position:absolute;right:54px;top:40px;width:236px;height:470px;border-radius:30px;background:#000;padding:8px;box-shadow:0 24px 60px rgba(0,0,0,.5)}.ph img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:23px;display:block}
  .ph2{right:296px;top:86px;transform:scale(.88);opacity:.96}</style>
  <div class="glow"></div><img class="logo" src="${b64(path.join(ROOT, 'logo.png'))}"><h1>CISPOLstore Manager</h1><p>Clients, abonnements Starlink, stock, factures et finances : tout votre commerce dans votre poche.</p><div class="tags"><span>Fonctionne hors connexion</span><span>Factures PDF</span><span>Relances WhatsApp</span></div>
  <div class="ph ph2"><img src="${b64(path.join(OUT, '4-relances.png'))}"></div><div class="ph"><img src="${b64(path.join(OUT, '1-accueil.png'))}"></div>`);
  await g.waitForTimeout(500); await g.screenshot({ path: path.join(OUT, 'graphique-1024x500.png') }); console.log('graphique 1024x500');
  fs.copyFileSync(path.join(ROOT, 'icon-512.png'), path.join(OUT, 'icone-512.png'));
  await b.close(); server.close();
})();
