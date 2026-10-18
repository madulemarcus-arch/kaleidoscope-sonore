const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>App.go('home'));await p.waitForTimeout(600);
ok('sky canvas shown on the dashboard',await p.evaluate(()=>{const c=document.getElementById('sky');return !!c&&!c.hidden}));
ok('sky is behind the content and ignores taps',await p.evaluate(()=>{const c=getComputedStyle(document.getElementById('sky'));return c.pointerEvents==='none'&&c.position==='fixed'&&+c.zIndex<+getComputedStyle(document.getElementById('view')).zIndex}));
// something is actually drawn
await p.waitForTimeout(500);
ok('stars are drawn',await p.evaluate(()=>{const c=document.getElementById('sky'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<d.length;i+=4)if(d[i]>0)return true;return false}));
// other screens: hidden
await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(300);
ok('hidden on other screens',await p.evaluate(()=>document.getElementById('sky').hidden));
await p.evaluate(()=>App.go('home'));await p.waitForTimeout(300);
ok('back on the dashboard',await p.evaluate(()=>!document.getElementById('sky').hidden));
// switch off from Apparence
await p.evaluate(()=>{App.actions.sky_set({s:'0'})});await p.waitForTimeout(300);
ok('off: setting saved and canvas hidden',await p.evaluate(()=>App.db.settings.sky===false&&document.getElementById('sky').hidden));
await p.evaluate(()=>{App.go('home')});await p.waitForTimeout(300);
ok('off: stays hidden on the dashboard',await p.evaluate(()=>document.getElementById('sky').hidden));
await p.evaluate(()=>{App.actions.sky_set({s:'1'})});await p.waitForTimeout(300);
ok('on again',await p.evaluate(()=>App.db.settings.sky===true&&!document.getElementById('sky').hidden));
ok('Apparence card has the two choices',await p.evaluate(()=>/Fond animé/.test(App.appearanceCard())&&/Fond fixe/.test(App.appearanceCard())));
await b.close();
// reduced motion: never started
const b2=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const c2=await b2.newContext({...devices['Pixel 5'],reducedMotion:'reduce'});const q=await c2.newPage();
await q.goto(BASE + '/index.html');await q.waitForTimeout(500);await q.click('[data-lk=skip]').catch(()=>{});await q.evaluate(()=>App.go('home'));await q.waitForTimeout(500);
ok('reduced motion: no animation',await q.evaluate(()=>{const c=document.getElementById('sky');return !c||c.hidden}));
await b2.close();
ok('no page errors',errs.length===0,errs.join('|'));
console.log(f?`${f} FAIL`:'ALL PASS');process.exit(f?1:0)})();
