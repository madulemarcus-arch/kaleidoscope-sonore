const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.addInitScript(()=>{document.addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{const d=document.querySelector('dialog');if(d&&d.open&&/Envoyez le reçu au client/.test(d.textContent))d.close()}).observe(document,{subtree:true,childList:true,attributes:true,characterData:true}))}); // these tests are not about the receipt window: close it as soon as it opens
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{const t=App.today();App.db.clients.push({id:'c1',code:'CL-1',type:'gere',first:'A',last:'B',name:'A B',phone:'',acc:'X1',start:t,period:30,grace:15,subs:[],created:t,note:''});App.db.settings.goal=5000;App.save();
App.createInvoice({type:'materiel',clientId:'c1',currency:'USD',payMode:'Cash',date:t,lines:[{pid:'',desc:'Kit',qty:1,price:600,cost:0}],payAmount:100},0);
window.__c=0;const o=App.celebrate;App.celebrate=function(m){window.__c++;return o.apply(this,arguments)};App.go('home')});await p.waitForTimeout(1200);
let v=await p.innerText('#view');
ok('greeting by time',/^(Bonjour ☀️|Bon après-midi 🌤️|Bonsoir 🌙), /.test(v.trim())||/(Bonjour ☀️|Bon après-midi 🌤️|Bonsoir 🌙)/.test(v));
ok('count-up ends on exact value',/600 \$/.test(v));
ok('badges row with next badge dimmed',(await p.$$('.bdg')).length===2&&(await p.$$('.bdg.on')).length===0);
ok('first visit silent (no confetti)',await p.evaluate(()=>__c===0));
// goal reached -> confetti once
await p.evaluate(()=>{App.db.settings.goal=500;App.refresh()});await p.waitForTimeout(500);
ok('goal reached triggers confetti',await p.evaluate(()=>__c===1)&&await p.isVisible('#confetti'));
await p.waitForTimeout(2000);ok('confetti removed after',!(await p.$('#confetti')));
await p.evaluate(()=>App.refresh());await p.waitForTimeout(400);ok('goal confetti only once',await p.evaluate(()=>__c===1));
// milestone
await p.evaluate(()=>{for(let i=0;i<10;i++)App.db.clients.push({id:'x'+i,code:'X'+i,type:'mat',first:'N',last:''+i,name:'N'+i,phone:'',subs:[],created:App.today(),note:''});App.save();App.refresh()});await p.waitForTimeout(500);
ok('10 clients badge earned + confetti',await p.evaluate(()=>__c===2)&&(await p.$$('.bdg.on')).length===1);
// full payment -> confetti ; partial -> none
await p.evaluate(()=>{window.__c=0;const i=App.db.invoices[0];App.go('invoice',{id:i.id});});await p.waitForTimeout(400);
await p.evaluate(()=>{const i=App.db.invoices[0];App.paymentForm({invoiceId:i.id})});await p.waitForTimeout(400);
await p.fill('#f_amt','100');await p.click('#dok');await p.waitForTimeout(300);ok('partial payment: no confetti',await p.evaluate(()=>__c===0));
await p.evaluate(()=>{const i=App.db.invoices[0];App.paymentForm({invoiceId:i.id})});await p.waitForTimeout(400);
await p.click('#pp_all');await p.click('#dok');await p.waitForTimeout(400);ok('settling payment: confetti',await p.evaluate(()=>__c===1));
await p.waitForTimeout(2000);
// reduced motion: no canvas
const p2=await (await b.newContext({...devices['Pixel 5'],reducedMotion:'reduce'})).newPage();await p2.goto(BASE + '/index.html');await p2.waitForTimeout(500);
await p2.evaluate(()=>App.celebrate());await p2.waitForTimeout(200);ok('reduced motion: no confetti',!(await p2.$('#confetti')));
// tick on nav
await p.evaluate(()=>{window.__v=0;navigator.vibrate=()=>{window.__v++;return true}});await p.click('#bottom a, #bottom button');ok('haptic tick on nav',await p.evaluate(()=>__v>=1));
console.log(errs);await b.close();process.exit(f?1:0)})();
