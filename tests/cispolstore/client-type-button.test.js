const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const p=await (await b.newContext({...devices['Pixel 5']})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
const cl=()=>p.evaluate(()=>{const c=App.db.clients.find(x=>x.id==='c1');return c&&{type:c.type,abo:!!c.aboOnly,acc:c.acc,start:c.start,kit:c.kit}});
await p.evaluate(()=>{const t=App.today();App.db.clients.push({id:'c1',code:'CL-1',type:'gere',first:'Jean',last:'Mukendi',name:'Jean Mukendi',phone:'0990000000',acc:'ACC-777',kit:'Starlink Mini',serial:'SN1',plan:'Résidentiel',price:70,start:t,period:30,grace:15,subs:[],created:t,note:''});App.save();App.go('client',{id:'c1'})});await p.waitForTimeout(600);
ok('hero has visible type button',await p.isVisible('.chero .typebtn')&&/Changer/.test(await p.innerText('.chero .typebtn')));await p.screenshot({path:'t14-hero.png'});
await p.click('.chero .typebtn');await p.waitForTimeout(300);ok('dialog has 4 types',(await p.$$('#f_ct option')).length===4);
await p.selectOption('#f_ct','mat');await p.click('#dok');await p.waitForTimeout(500);
let c=await cl();ok('géré -> kit seulement (data kept)',c.type==='mat'&&!c.abo&&c.acc==='ACC-777'&&c.kit==='Starlink Mini'&&/Matériel uniquement/.test(await p.innerText('#view')));
ok('no subscription for kit-only',!(await p.evaluate(()=>!!App.sub(App.client('c1')))));
await p.click('.chero .typebtn');await p.selectOption('#f_ct','abo');await p.click('#dok');await p.waitForTimeout(600);
c=await cl();ok('kit -> abonnement seulement (back to gere + flag, ACC kept)',c.type==='gere'&&c.abo&&c.acc==='ACC-777'&&/Abonnement seulement/.test(await p.innerText('#view')));
ok('subscription tracked again',await p.evaluate(()=>!!App.sub(App.client('c1'))));
// edit form for abo-only hides kit fields but keeps stored kit
await p.click('[data-act=editclient]');await p.waitForTimeout(400);ok('abo-only form: no kit/serial inputs, has ACC',!(await p.$('#f_kit'))&&!!(await p.$('#f_acc')));await p.click('#dok');await p.waitForTimeout(400);
c=await cl();ok('saving the form keeps the kit model',c.kit==='Starlink Mini');
ok('edit form has Type button',await (async()=>{await p.click('[data-act=editclient]');await p.waitForTimeout(400);const v=await p.isVisible('dialog .typebtn');await p.keyboard.press('Escape');await p.waitForTimeout(300);return v})());
await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(500);ok('no Type action in the row swipe',(await p.$$('#clist .swa .sw')).length>0&&!(await p.$$('#clist .sw-type')).length&&!/🔁/.test(await p.innerText('#clist')));ok('build shown',await p.evaluate(()=>{App.go('more');return true}));await p.waitForTimeout(400);ok('Plus shows the current build',await p.evaluate(()=>document.querySelector('#view').innerText.includes('build '+App.BUILD)));
// filter chip
await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(500);await p.click('[data-act=clfilter][data-f=abo]');await p.waitForTimeout(300);ok('filter Abonnement seul lists the client',/Jean Mukendi/.test(await p.innerText('#clist')));
await p.click('[data-act=clfilter][data-f=gere]');await p.waitForTimeout(300);ok('Gérés filter also includes abo-only',/Jean Mukendi/.test(await p.innerText('#clist')));
// log
ok('history logged',await p.evaluate(()=>App.db.log.some(l=>/Type modifié/.test(l.text||l.msg||JSON.stringify(l)))));
// new client chooser has abo option
await p.evaluate(()=>App.clientForm());await p.waitForTimeout(300);ok('chooser offers Abonnement seulement',/Abonnement seulement/.test(await p.innerText('dialog')));
await p.click('[data-act=cf_type][data-t=abo]');await p.waitForTimeout(300);ok('new abo-only form title + no kit',/Abonnement seulement/.test(await p.innerText('dialog'))&&!(await p.$('#f_kit')));await p.keyboard.press('Escape');
// vendeur
await p.evaluate(()=>{App.db.settings.users=[{id:'v',name:'Vic',role:'vendeur',active:true,salt:'s',hash:'h'}];App.user=App.db.settings.users[0];App.applyRole&&App.applyRole();App.go('client',{id:'c1'})});await p.waitForTimeout(500);
await p.click('.chero .typebtn');await p.waitForTimeout(300);await p.selectOption('#f_ct','gere');await p.click('#dok');await p.waitForTimeout(400);c=await cl();ok('vendeur can change type',c.type==='gere'&&!c.abo);
console.log(errs);await b.close();process.exit(f?1:0)})();
