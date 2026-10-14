const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{window.__wa=[];window.open=u=>{window.__wa.push(u);return null};App.db.suppliers.push({id:'s1',name:'Tech Import',phone:'0990001'});
App.db.products.push({id:'p1',name:'Routeur X',cat:'Routeurs',price:40,cost:25,qty:10,min:5,unit:'',ref:'RX',supplierId:'s1'},{id:'p2',name:'Câble',cat:'Câbles',price:2,cost:1,qty:50,min:10,unit:'m',supplierId:'s1'},{id:'p3',name:'Antenne',cat:'Antennes',price:30,cost:20,qty:3,min:5,unit:'',supplierId:''},{id:'p4',name:'Hébergement',cat:'Service',price:5,cost:0,qty:0,min:0});App.save();App.go('more')});await p.waitForTimeout(500);
let t=await p.innerText('#view');ok('Plus has Inventaire and À commander',/Inventaire/.test(t)&&/À commander/.test(t));
await p.evaluate(()=>App.go('stock'));await p.waitForTimeout(700);ok('stock has buttons (1 to order)',/Inventaire/.test(await p.innerText('#view'))&&/À commander \(1\)/.test(await p.innerText('#view')));
await p.evaluate(()=>App.go('home'));await p.waitForTimeout(900);ok('home card to order',/1 produit\(s\) à commander/.test(await p.innerText('#view')));
// inventory
await p.evaluate(()=>App.go('inventory'));await p.waitForTimeout(500);await p.click('[data-act=inv_start]');await p.waitForTimeout(600);
ok('count screen, service product excluded',(await p.$$('#ic_list .item')).length===3);
const inp=await p.$$('#ic_list .ic-in');await inp[0].fill('4');await inp[1].fill('50');await inp[2].fill('9');await p.waitForTimeout(300);
t=await p.innerText('.hero');ok('stats: 3 counted, 2 gaps',/3[\s\S]*2/.test(t),t.replace(/\n/g,' | '));
ok('draft persisted',await p.evaluate(()=>App.db.counts[0].lines.length===3));
await p.fill('#ic_q','câb');await p.waitForTimeout(200);ok('search filters',(await p.$$('#ic_list .item')).length===1);await p.fill('#ic_q','');await p.waitForTimeout(200);
await p.click('[data-act=inv_finish]');await p.waitForTimeout(500);ok('summary lists gaps',/Routeur X/.test(await p.innerText('dialog'))&&/Antenne/.test(await p.innerText('dialog'))&&!/Câble/.test(await p.innerText('dialog')));
await p.evaluate(()=>{[...document.querySelectorAll('dialog button')].find(b=>/Enregistrer l'inventaire/.test(b.textContent)).click()});await p.waitForTimeout(800);
const r=await p.evaluate(()=>({q1:App.prod('p1').qty,q3:App.prod('p3').qty,mv:App.db.moves.filter(m=>/Inventaire/.test(m.note)).length,c:App.db.counts[0],led:App.ledger().filter(x=>x.type==='Achat stock').length}));
ok('stock corrected',r.q1===9&&r.q3===4&&r.mv===2,JSON.stringify({q1:r.q1,q3:r.q3,mv:r.mv}));ok('inventory done+applied',r.c.status==='done'&&r.c.applied&&/^INV-\d{4}-0001$/.test(r.c.no));
ok('adjustments are not purchases in the cash journal',r.led===0);
ok('history shows it',/INV-/.test(await p.innerText('#view')));
await p.click('[data-act=inv_open]');await p.waitForTimeout(300);ok('detail opens',/Antenne/.test(await p.innerText('dialog')));
const doc=await p.evaluate(()=>App.inventoryDoc(App.db.counts[0],'','stamp.png'));ok('doc',/INVENTAIRE/.test(doc)&&/Routeur X/.test(doc));
await p.click('[data-act=inv_pdf]');await p.waitForTimeout(1200);await p.keyboard.press('Escape');await p.waitForTimeout(200);
// reorder
await p.evaluate(()=>App.go('reorder'));await p.waitForTimeout(600);
ok('reorder: antenne (now 4 <= 5) grouped under Sans fournisseur',/Sans fournisseur/.test(await p.innerText('#view'))&&/Antenne/.test(await p.innerText('#view')));
ok('suggested qty = 2*5-4 = 6',await p.inputValue('.ro-qty')==='6');
await p.click('[data-act=ro_make]');await p.waitForTimeout(600);
ok('order created BC-',await p.evaluate(()=>App.db.orders.length===1&&/^BC-\d{4}-0001$/.test(App.db.orders[0].no)&&App.db.orders[0].lines[0].qty===6));
ok('order detail',/Bon de commande BC-/.test(await p.innerText('dialog')));
await p.click('[data-act=ro_wa]');ok('whatsapp',await p.evaluate(()=>window.__wa.length===1));
const od=await p.evaluate(()=>App.orderDoc(App.db.orders[0],'','stamp.png'));ok('order doc',/BON DE COMMANDE/.test(od)&&/Antenne/.test(od));
await p.click('[data-act=ro_recv]');await p.waitForTimeout(500);ok('marked received',await p.evaluate(()=>App.db.orders[0].status==='received'));
// vendeur
await p.evaluate(()=>{App.db.settings.users=[{id:'v',name:'Vic',role:'vendeur',active:true,salt:'s',hash:'h'}];App.user=App.db.settings.users[0];App.applyRole&&App.applyRole();});
ok('vendeur cannot view inventory/reorder',await p.evaluate(()=>!App.canView('inventory')&&!App.canView('reorder')));
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
