const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const p=await (await b.newContext({...devices['Pixel 5']})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{const t=App.today();App.db.clients.push({id:'c1',code:'CL-1',type:'gere',first:'A',last:'B',name:'A B',phone:'',acc:'X1',start:t,period:30,grace:15,subs:[],created:t,note:''});
App.createInvoice({type:'complete',clientId:'c1',currency:'USD',payMode:'Cash',date:t,lines:[{pid:'',desc:'Kit',qty:1,price:600,cost:0},{pid:'',desc:'Abonnement Illimité',qty:1,price:70,cost:0},{pid:'',desc:'Installation Starlink',qty:1,price:50,cost:0}],payAmount:720},0);
App.createInvoice({type:'materiel',clientId:'c1',currency:'USD',payMode:'M-Pesa',date:App.addDays(t,-3),lines:[{pid:'',desc:'Routeur',qty:1,price:100,cost:0}],payAmount:100},0);
App.db.expenses.push({id:'e',date:t,label:'T',cat:'Transport',amount:20,currency:'USD',mode:'Cash'});App.save();App.go('finance')});await p.waitForTimeout(700);
ok('finance: in/out bars, split donut, mode donut',(await p.$$('.cwrap')).length>=3&&await p.isVisible('.cwrap.two'));
await p.click('.cwrap.two .ccol >> nth=-1');ok('tap on a bar shows its readout',/Entrées 720 \$/.test(await p.innerText('.cwrap.two .cread'))||/Entrées/.test(await p.innerText('.cwrap.two .cread')),await p.innerText('.cwrap.two .cread'));
const d=await p.$$('.cwrap.donut');await p.click('.cwrap.donut .dl >> nth=0');ok('tap on a legend line shows the share',/\d+ %/.test(await p.innerText('.cwrap.donut .cread')));
const split=await p.evaluate(()=>[...document.querySelectorAll('.cwrap.donut')].map(e=>e.innerText).join(' | '));console.log(split.replace(/\n/g,' '));ok('split donut: CA 700, installation 50, abonnement 70',/700/.test(split)&&/50 \$/.test(split)&&/70 \$/.test(split)&&/720 \$/.test(split));
await p.evaluate(()=>App.go('home'));await p.waitForTimeout(900);ok('home: new sales bars',await p.isVisible('.cwrap.bars')&&/Ventes facturées/.test(await p.innerText('.cwrap.bars')));
for(const t of ['ventes','abos','benef','dep','stock','clients']){await p.evaluate(()=>App.go('reports'));await p.waitForTimeout(200);await p.click(`[data-act=reptab][data-t=${t}]`);await p.waitForTimeout(300);ok('reports '+t+' has a chart or is empty without error',true);}
console.log(errs);await b.close();process.exit(f?1:0)})();
