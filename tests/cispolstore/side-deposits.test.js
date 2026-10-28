const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
// Wide screens: « Fonds en attente » (the list of the deposits, not only « + Nouveau dépôt ») is in the side menu. Fictitious data only.
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{const t=App.today();App.db.clients.push({id:'c1',code:'CL-1',type:'gere',first:'Ana',last:'Exemple',name:'Ana Exemple',phone:'0991',subs:[],created:t,start:App.addDays(t,-33),period:30,grace:5});
 App.db.deposits=[{id:'d1',clientId:'c1',date:t,amount:70,currency:'USD',mode:'Cash',purpose:'Abonnement Starlink',note:'',ref:'',uses:[],rate:2000,no:'D-1'}];App.save();App.go('home')});await p.waitForTimeout(500);
const btn='#side [data-act=go][data-v=deposits]';
ok('the side menu has « Fonds en attente »',await p.isVisible(btn)&&/Fonds en attente/.test(await p.innerText(btn)));
await p.click(btn);await p.waitForTimeout(500);
const t=await p.innerText('#view');
ok('a click opens the list of the deposits (with the client and the deadline), not only the add form',/Ana Exemple/.test(t)&&/À payer avant le/.test(t)&&/Nouveau dépôt client/.test(t),t.replace(/\n/g,' | ').slice(0,300));
ok('the entry is highlighted while on that screen',await p.evaluate(s=>document.querySelector(s).classList.contains('on'),btn));
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
