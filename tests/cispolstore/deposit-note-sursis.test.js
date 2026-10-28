const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
// « Nouveau dépôt client »: the note is filled in with « À payer avant le <end of the client's grace period> ». Fictitious data only.
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
const D=await p.evaluate(()=>{const t=App.today(),a=n=>App.addDays(t,n);App.db.clients.push(
 {id:'c1',code:'CL-1',type:'gere',first:'Ana',last:'Sursis',name:'Ana Sursis',phone:'0991',subs:[],created:t,start:a(-33),period:30,grace:5},   // ended 3 days ago, grace until +2
 {id:'c2',code:'CL-2',type:'gere',first:'Bob',last:'Actif',name:'Bob Actif',phone:'0992',subs:[],created:t,start:a(-10),period:30,grace:7},     // active, ends +20, grace until +27
 {id:'c3',code:'CL-3',type:'gere',first:'Cléo',last:'Inactive',name:'Cléo Inactive',phone:'0993',subs:[],created:t,start:a(-90),period:30,grace:5},// long over
 {id:'c4',code:'CL-4',type:'gere',first:'Dan',last:'Sansabo',name:'Dan Sansabo',phone:'0994',subs:[],created:t});App.save();
 return {g1:App.fdate(App.sub(App.client('c1')).gEnd),g2:App.fdate(App.sub(App.client('c2')).gEnd)}});
await p.evaluate(()=>App.go('deposits'));await p.waitForTimeout(500);
await p.click('[data-act=dep_new]');await p.waitForTimeout(400);
const note=()=>p.inputValue('#f_dn');
ok('no client chosen yet: the note is empty',await note()==='');
await p.selectOption('#f_dc','c1');await p.waitForTimeout(150);
ok('client in grace period: « À payer avant le » + end of the grace period ('+D.g1+')',await note()==='À payer avant le '+D.g1,await note());
await p.selectOption('#f_dc','c2');await p.waitForTimeout(150);
ok('another client: the note follows (end of grace '+D.g2+')',await note()==='À payer avant le '+D.g2,await note());
await p.selectOption('#f_dc','c3');await p.waitForTimeout(150);
ok('client already inactive (grace over): no date offered, the note is cleared',await note()==='',await note());
await p.selectOption('#f_dc','c4');await p.waitForTimeout(150);
ok('client without subscription: note stays empty',await note()==='');
await p.selectOption('#f_dc','c1');await p.waitForTimeout(150);await p.fill('#f_dn','à payer à Starlink le 15');await p.selectOption('#f_dc','c2');await p.waitForTimeout(150);
ok('a note written by hand is never overwritten',await note()==='à payer à Starlink le 15',await note());
// the search box selects the single match and fills the note too
await p.fill('#f_dn','');await p.selectOption('#f_dc','');await p.fill('#f_dq','Sursis');await p.waitForTimeout(300);
ok('search with a single match: client selected and note filled',await p.inputValue('#f_dc')==='c1'&&await note()==='À payer avant le '+D.g1,await note());
// the note is saved with the deposit
await p.fill('#f_da','70');await p.click('#dok');await p.waitForTimeout(800);
ok('the note is saved on the deposit',await p.evaluate(g=>App.db.deposits&&App.db.deposits.some(d=>d.clientId==='c1'&&d.note==='À payer avant le '+g)||Object.values(App.db).some(v=>Array.isArray(v)&&v.some(d=>d&&d.clientId==='c1'&&d.note==='À payer avant le '+g)),D.g1));
// ---- deposits ALREADY in the list (written before, without a note): the deadline shows at once, nothing is rewritten
await p.evaluate(()=>{const t=App.today();App.db.deposits=[
 {id:'d1',clientId:'c2',date:t,amount:50,currency:'USD',mode:'Cash',purpose:'Abonnement Starlink',note:'',ref:'',uses:[],rate:2000,no:'D-1'},                 // waiting, no note
 {id:'d2',clientId:'c1',date:t,amount:40,currency:'USD',mode:'Cash',purpose:'Abonnement Starlink',note:'note de la main',ref:'',uses:[],rate:2000,no:'D-2'}, // waiting, own note
 {id:'d3',clientId:'c1',date:t,amount:30,currency:'USD',mode:'Cash',purpose:'Abonnement Starlink',note:'',ref:'',uses:[{id:'u1',date:t,amount:30,type:'paid',mode:'Cash',note:''}],rate:2000,no:'D-3'}, // fully paid
 {id:'d4',clientId:'c3',date:t,amount:20,currency:'USD',mode:'Cash',purpose:'Abonnement Starlink',note:'',ref:'',uses:[],rate:2000,no:'D-4'}];       // inactive client
 App.save();App.go('deposits')});await p.waitForTimeout(400);await p.click('[data-act=dep_f][data-f=all]');await p.waitForTimeout(400);
const rowTxt=id=>p.$eval('[data-act=dep_open][data-id='+id+']',e=>e.innerText);
ok('existing deposit without note, client active: « À payer avant le '+D.g2+' » appears at once',(await rowTxt('d1')).includes('À payer avant le '+D.g2),await rowTxt('d1'));
ok('existing deposit with its own note: the note is kept, no automatic date',(await rowTxt('d2')).includes('note de la main')&&!(await rowTxt('d2')).includes('À payer avant'));
ok('deposit already fully paid: no deadline',!(await rowTxt('d3')).includes('À payer avant'));
ok('client already inactive: no deadline',!(await rowTxt('d4')).includes('À payer avant'));
ok('nothing was written into the stored deposits',await p.evaluate(()=>App.db.deposits.every(d=>d.id==='d2'?d.note==='note de la main':!d.note)));
await p.click('[data-act=dep_open][data-id=d1]');await p.waitForTimeout(300);
ok('the deposit window shows the deadline too',(await p.innerText('dialog')).includes('À payer avant le '+D.g2));
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
