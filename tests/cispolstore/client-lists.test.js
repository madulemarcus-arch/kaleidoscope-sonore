const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5'],hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});await p.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.resolve()},configurable:true}));
await p.evaluate(()=>App.go('importc'));await p.waitForTimeout(300);await p.setInputFiles('#im_file',require('../fixtures').csvFile(80));await p.waitForTimeout(1500);await p.click('[data-act=imp_go]');await p.waitForTimeout(700);
await p.evaluate(()=>{const t=App.today();const c=App.db.clients[3];App.createInvoice({type:'materiel',clientId:c.id,currency:'USD',payMode:'Cash',date:t,lines:[{pid:'',desc:'Kit',qty:1,price:450,cost:0}],payAmount:100},0);
App.createInvoice({type:'materiel',clientId:c.id,currency:'USD',payMode:'Cash',date:App.addDays(t,-1),lines:[{pid:'',desc:'Câble',qty:1,price:40,cost:0}],payAmount:40},0);App.save();App.go('clients')});await p.waitForTimeout(500);
ok('letter headers + rows',(await p.$$('#clist .lh')).length>3&&(await p.$$('#clist .swr')).length>50);
ok('row shows ACC in mono, days and pill',await p.evaluate(()=>!!document.querySelector('#clist .mono')&&!!document.querySelector('#clist .end small')));
// swipe the first row with a phone: simulate touch via CDP
await p.evaluate(()=>{const el=document.querySelector('#clist .swr .item');const r=el.getBoundingClientRect(),y=r.top+r.height/2,x0=r.right-30;
const mk=(type,x)=>new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[new Touch({identifier:1,target:el,clientX:x,clientY:y})],changedTouches:[new Touch({identifier:1,target:el,clientX:x,clientY:y})]});
el.dispatchEvent(mk('touchstart',x0));for(let k=1;k<=8;k++)el.dispatchEvent(mk('touchmove',x0-k*18));el.dispatchEvent(mk('touchend',x0-144));});await p.waitForTimeout(400);
ok('swipe opens the actions',await p.evaluate(()=>!!document.querySelector('#clist .swr.open')));
ok('actions: call, WhatsApp, copy ACC, renew',await p.evaluate(()=>{const r=document.querySelector('#clist .swr.open');return !!r.querySelector('.sw-call')&&!!r.querySelector('.sw-wa')&&!!r.querySelector('.sw-copy')&&!!r.querySelector('.sw-renew')}));
ok('swipe did not open the client',await p.evaluate(()=>App.state.view==='clients'));
await p.click('#clist .swr.open .sw-copy');await p.waitForTimeout(200);ok('copy ACC shows a toast',/Copié/.test(await p.innerText('#toast')));
// tap on an open row closes it instead of navigating
await p.evaluate(()=>{document.querySelector('#clist .swr').classList.add('open')});await p.click('#clist .swr.open > .item',{position:{x:330,y:20}}).catch(()=>{});await p.waitForTimeout(200);
ok('tap on an open row only closes it',await p.evaluate(()=>App.state.view==='clients'&&!document.querySelector('#clist .swr.open')));
await p.click('#clist .swr .item');await p.waitForTimeout(300);ok('tap on a row opens the client',await p.evaluate(()=>App.state.view==='client'));
// invoices list
await p.evaluate(()=>App.go('invoices'));await p.waitForTimeout(400);
ok('invoice rows grouped by day (Aujourd\'hui / Hier)',/Aujourd'hui/i.test(await p.innerText('#ilist'))&&/Hier/i.test(await p.innerText('#ilist')));
ok('unpaid invoice has an Encaisser action',await p.evaluate(()=>!!document.querySelector('#ilist .sw-pay')));
// selection mode keeps working
await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(300);await p.click('[data-act=cl_sel]');ok('selection mode: plain rows',await p.evaluate(()=>!document.querySelector('#clist .swr')&&document.querySelectorAll('#clist .item.rw').length>50));
// empty state
await p.evaluate(()=>{App.db.clients=[];App.save();App.go('clients')});await p.waitForTimeout(300);ok('empty state with button',/Aucun client pour le moment/.test(await p.innerText('#clist'))&&!!(await p.$('#clist [data-act=newclient]')));
console.log(errs);await b.close();process.exit(f?1:0)})();
