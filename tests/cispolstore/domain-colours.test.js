const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const p=await (await b.newContext({...devices['Pixel 5']})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
const dom=()=>p.evaluate(()=>document.documentElement.dataset.dom||'');
const exp={home:'',clients:'clients',finance:'finance',stock:'stock',subs:'subs',invoices:'invoices',more:'',settings:'',impayes:'finance',suppliers:'stock'};
for(const [v,e] of Object.entries(exp)){await p.evaluate(v=>App.go(v),v);await p.waitForTimeout(250);ok('view '+v+' -> '+(e||'none'),(await dom())===e);}
await p.evaluate(()=>App.go('finance'));await p.waitForTimeout(500);
const c=await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--dom').trim());ok('finance --dom green',c==='#169c5b',c);
await p.screenshot({path:'dom-finance.png'});
await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(500);await p.screenshot({path:'dom-clients.png'});
await p.evaluate(()=>App.go('stock'));await p.waitForTimeout(500);await p.screenshot({path:'dom-stock.png'});
await p.evaluate(()=>{document.documentElement.dataset.theme='dark';App.go('subs')});await p.waitForTimeout(500);await p.screenshot({path:'dom-subs-dark.png'});
console.log(errs);await b.close();process.exit(f?1:0)})();
