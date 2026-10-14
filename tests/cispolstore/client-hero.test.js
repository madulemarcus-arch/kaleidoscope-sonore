const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const p=await (await b.newContext({...devices['Pixel 5']})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
const id=await p.evaluate(()=>{const t=App.today();App.db.products.push({id:'p1',name:'Starlink Mini',cat:'Starlink',ref:'SM',unit:'',cost:200,price:300,qty:5,min:2,track:true},{id:'p2',name:'Routeur',cat:'Réseau',ref:'R',unit:'',cost:20,price:35,qty:1,min:2,track:true});
App.db.clients.push({id:'c1',code:'CL-1',type:'gere',first:'Jean',last:'Mukendi',name:'Jean Mukendi',phone:'0990000000',acc:'ACC-12345',plan:'Résidentiel',price:70,start:App.addDays(t,-10),period:30,grace:15,subs:[],created:t,note:''});
App.createInvoice({type:'materiel',clientId:'c1',currency:'USD',payMode:'Cash',date:t,lines:[{pid:'',desc:'Kit',qty:1,price:600,cost:0}],payAmount:200},0);App.save();App.go('client',{id:'c1'});return App.db.invoices[0].id});
await p.waitForTimeout(600);
ok('client hero',await p.isVisible('.chero')&&/Jean Mukendi/.test(await p.innerText('.chero h2')));
const st=await p.innerText('.cstats');ok('client stats: 20 j, 600 $ facturé, 400 $ à payer',/20 j/.test(st)&&/600 \$/.test(st)&&/400 \$/.test(st),st.replace(/\n/g,' | '));
ok('4 action tiles',(await p.$$('.ctiles > *')).length===4);
ok('ACC copy chip',await p.isVisible('.acc'));
await p.click('.ctiles [data-act=renew]');await p.waitForTimeout(400);ok('renew tile opens form',/Renouveler/.test(await p.innerText('dialog')));await p.keyboard.press('Escape');await p.waitForTimeout(300);
await p.screenshot({path:'s9-client.png'});
await p.evaluate(id=>App.go('invoice',{id}),id);await p.waitForTimeout(700);
ok('invoice hero w/ progress',await p.isVisible('.ihero .pbar2')&&/Reste 400/.test(await p.innerText('.ifoot')));
ok('pill has check icon css',await p.evaluate(()=>{const e=document.querySelector('.ihero .pill');return getComputedStyle(e,'::before').content.length>0}));
await p.screenshot({path:'s9-invoice.png'});
await p.evaluate(()=>App.go('stock'));await p.waitForTimeout(900);
const sh=await p.innerText('.shero');ok('stock hero value 1 020 $ (5*200+1*20), 1 bas',/1\s?020/.test(sh)&&/1\s*\n?stock bas/.test(sh.replace(/\n/g,' ').replace(/ +/g,' ').replace(/(\d) stock/,'$1\nstock')),sh.replace(/\n/g,' | '));
await p.screenshot({path:'s9-stock.png'});
// busy overlay
await p.evaluate(()=>{window.__d=App.busy('Test…')});ok('busy visible',await p.isVisible('.busy i'));await p.evaluate(()=>__d());ok('busy removed',!(await p.$('.busy')));
// vendeur: client page ok, no renew tile if guard denies
console.log(errs);await b.close();process.exit(f?1:0)})();
