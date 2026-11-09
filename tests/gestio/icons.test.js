const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const p=await (await b.newContext({...devices['Pixel 5']})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(600);await p.click('[data-lk=skip]').catch(()=>{});await p.waitForTimeout(500);
ok('5 SVG icons in bottom bar',(await p.$$('#bottom svg.ic')).length===5,String((await p.$$('#bottom svg.ic')).length));
ok('no emoji left in the bar',!(await p.innerText('#bottom')).match(/[🏠👥🏦📦☰]/u));
await p.click('#bottom [data-nav=clients]');await p.waitForTimeout(300);await p.screenshot({path:'ic-clients.png',clip:{x:0,y:1720,width:1080,height:280}}).catch(()=>{});
const an=await p.evaluate(()=>getComputedStyle(document.querySelector('#bottom [data-nav=clients].on .ic')).animationName);ok('active icon animates',/icpop/.test(an),an);
await p.waitForTimeout(800);await p.screenshot({path:'ic-bar.png'});
for(const v of ['stock','finance','home']){await p.click(`#bottom [data-nav=${v}]`).catch(()=>{});await p.waitForTimeout(250);}
const m=await (await b.newContext({...devices['Pixel 5'],reducedMotion:'reduce'})).newPage();await m.goto(BASE + '/index.html');await m.waitForTimeout(600);await m.click('[data-lk=skip]').catch(()=>{});await m.waitForTimeout(400);await m.click('#bottom [data-nav=clients]');await m.waitForTimeout(200);
ok('reduced motion: no animation',(await m.evaluate(()=>getComputedStyle(document.querySelector('#bottom [data-nav=clients].on .ic')).animationName))==='none');
const d=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();await d.goto(BASE + '/index.html');await d.waitForTimeout(600);await d.click('[data-lk=skip]').catch(()=>{});await d.waitForTimeout(500);ok('side menu uses SVG for home/clients/stock/finance',(await d.$$('#side svg.ic')).length>=4);await d.screenshot({path:'ic-side.png',clip:{x:0,y:0,width:260,height:420}});
console.log(errs);await b.close();process.exit(f?1:0)})();
