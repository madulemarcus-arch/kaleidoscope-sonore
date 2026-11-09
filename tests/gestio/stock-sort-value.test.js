const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
// « Trier par valeur » on the Stock screen: biggest stock value first, with each product's value and share. Fictitious data only.
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const p=await (await b.newContext({...devices['Pixel 5']})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{App.db.products.length=0;App.db.products.push(
 {id:'a',name:'Alpha câble',cat:'Câble',unit:'m',qty:100,cost:2,price:3,min:0},        // 200
 {id:'b',name:'Beta kit',cat:'Kit',qty:10,cost:300,price:400,min:0},                  // 3000
 {id:'c',name:'Gamma routeur',cat:'Routeur',qty:5,cost:100,price:150,min:0},          // 500
 {id:'d',name:'Delta abonnement',cat:'Abonnement',qty:0,cost:0,price:70,min:0});App.save();App.go('stock',{f:'all'})});await p.waitForTimeout(500);
const names=async()=>p.$$eval('#plist .item b:first-child',e=>e.map(x=>x.textContent.trim()).filter(t=>!/^Valeur/.test(t)));
ok('default order: by name',(await names()).join('|').startsWith('Alpha câble|Beta kit|Delta abonnement|Gamma routeur'),(await names()).join('|'));
ok('the button is offered',await p.isVisible('[data-act=stsort]'));
await p.click('[data-act=stsort]');await p.waitForTimeout(400);
const n=await names();
ok('sorted by value: kit (3 000) > routeur (500) > câble (200); the subscription has no stock value',n[0]==='Beta kit'&&n[1]==='Gamma routeur'&&n[2]==='Alpha câble',n.join('|'));
const t=await p.innerText('#plist');
ok('each product shows its value and its share of the total (3 000 / 3 700 = 81,1 %)',/Valeur : .*3\s?000/.test(t)&&/81[.,]1 % du stock/.test(t),t.slice(0,300));
ok('the button looks pressed',await p.getAttribute('[data-act=stsort]','aria-pressed')==='true');
await p.click('[data-act=stsort]');await p.waitForTimeout(400);
ok('second tap: back to the name order, no value line',(await names())[0]==='Alpha câble'&&!/% du stock/.test(await p.innerText('#plist')));
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
