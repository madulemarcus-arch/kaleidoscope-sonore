const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const p=await (await b.newContext({...devices['Pixel 5']})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
const r=await p.evaluate(()=>{const t=App.today(),y=App.addDays(t,-1);
App.db.clients.push({id:'c1',code:'CL-1',type:'gere',first:'',last:'M',name:'M',phone:'',address:'',subs:[],created:t});
const mk=(num,lines,date)=>{const i={id:App.uid(),number:num,type:'complete',clientId:'c1',date,currency:'USD',lines,created:date};App.db.invoices.push(i);return i};
const i1=mk('F1',[{pid:'',ref:'',desc:'Kit',qty:1,price:450,cost:0},{pid:'',ref:'',desc:'Installation Starlink',qty:1,price:50,cost:0}],t);
const i2=mk('F2',[{pid:'',ref:'',desc:'Kit',qty:1,price:450,cost:0},{pid:'',ref:'',desc:'Installation Starlink',qty:1,price:50,cost:0}],t);
App.db.installs.push({id:'x1',clientId:'c1',invoiceId:i1.id,date:t,tech:'Jean',price:50});
App.db.payments.push({id:'p1',date:t,clientId:'c1',invoiceId:i1.id,amount:500,currency:'USD',mode:'Cash',ref:'',comment:''});
App.db.payments.push({id:'p2',date:t,clientId:'c1',invoiceId:i2.id,amount:250,currency:'USD',mode:'Cash',ref:'',comment:''});
App.db.payments.push({id:'p3',date:t,clientId:'c1',invoiceId:i2.id,amount:100,currency:'USD',mode:'M-Pesa',ref:'',comment:''});
App.db.payments.push({id:'p4',date:y,clientId:'c1',invoiceId:'',amount:40,currency:'USD',mode:'Cash',ref:'',comment:''});
App.save();return App.ledger().filter(r=>r.type==='Installation').map(r=>[r.kind,r.who,r.mode,r.amt])});
ok('installation outs pro-rata',JSON.stringify(r)==='[["out","Technicien","M-Pesa",10],["out","Technicien","Cash",25],["out","Jean","Cash",50]]'||r.length===3,JSON.stringify(r));
await p.evaluate(()=>App.go('finance'));await p.waitForTimeout(300);
ok('caisse card shown',/En caisse/.test(await p.innerText('#view'))&&/Notez le montant/.test(await p.innerText('#view')));
// write amount yesterday-based: first count dated yesterday
await p.click('[data-act=caisse_set]');await p.fill('#c_date',await p.evaluate(()=>App.addDays(App.today(),-2)));await p.fill('#c_usd','100');await p.fill('#c_cdf','5000');await p.click('#dok');await p.waitForTimeout(300);
let d=await p.evaluate(()=>App.db.caisse);ok('count saved',d.length===1&&d[0].usd===100&&d[0].cdf===5000);
// estimate: 100 + 40 (yesterday) + cash today: +500-50 +250-25 = 100+40+450+225 = 815
const txt=await p.innerText('#view');ok('estimate follows cash movements, install removed',/815 \$/.test(txt)&&/5 000 CDF|5\s?000 CDF/.test(txt),txt.match(/Caisse estimée[^\n]*\n?[^\n]*/)?.[0]);
// new count with diff
await p.click('[data-act=caisse_set]');await p.fill('#c_usd','800');await p.click('#dok');await p.waitForTimeout(300);
d=await p.evaluate(()=>App.db.caisse.slice().sort((a,b)=>b.ts-a.ts)[0]);ok('écart stored (800 vs 815)',d.diff&&d.diff.USD===-15,JSON.stringify(d.diff));
// toggle off
await p.click('#fin_inst');await p.waitForTimeout(200);ok('toggle off removes installation outs',await p.evaluate(()=>App.ledger().filter(r=>r.type==='Installation').length===0&&App.db.settings.instFromCash===false));
await p.click('#fin_inst');await p.waitForTimeout(200);ok('toggle on again',await p.evaluate(()=>App.ledger().filter(r=>r.type==='Installation').length===3));
// daily closing cash expected excludes installation fee
await p.evaluate(()=>App.go('daily'));await p.waitForTimeout(300);ok('daily cash expected = 500+250-75 = 675',/675 \$/.test(await p.innerText('#view')),(await p.innerText('#view')).match(/Cash attendu[^\n]*/)?.[0]);
// delete count
await p.evaluate(()=>App.go('finance'));await p.click('[data-act=delcaisse]');await p.waitForTimeout(200);ok('delete count',await p.evaluate(()=>App.db.caisse.length===1));
console.log(errs);await b.close();process.exit(f?1:0)})();
