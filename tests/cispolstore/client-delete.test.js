const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const p=await (await b.newContext({...devices['Pixel 5']})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{const t=App.today();['Ann','Bob','Cleo','Dan'].forEach((n,i)=>App.db.clients.push({id:'c'+i,code:'CL-'+i,type:'gere',first:n,last:'X',name:n+' X',phone:'',address:'',acc:'ACC'+i,subs:[],created:t,note:''}));
App.db.invoices.push({id:'i1',number:'F1',type:'materiel',clientId:'c1',date:t,currency:'USD',lines:[{pid:'',desc:'x',qty:1,price:5,cost:0}],created:t});App.save();App.go('clients')});
await p.waitForTimeout(300);
await p.click('[data-act=cl_sel]');await p.click('[data-act=cl_pick][data-id=c0]');await p.click('[data-act=cl_pick][data-id=c1]');await p.click('[data-act=cl_pick][data-id=c2]');
ok('counter 3',/Supprimer \(3\)/.test(await p.innerText('#clbar')));
await p.click('[data-act=delclients]');await p.waitForTimeout(400);
ok('Ann and Cleo deleted, Bob (has invoice) kept, Dan untouched',await p.evaluate(()=>App.db.clients.map(c=>c.id).sort().join()==='c1,c3'));
await p.click('#undogo');await p.waitForTimeout(300);ok('undo restores',await p.evaluate(()=>App.db.clients.length===4));
// roles: comptable cannot see the selection button
await p.evaluate(()=>{App.db.settings.users=[{id:'c',name:'C',role:'comptable',active:true,salt:'s',hash:'h'}];App.user=App.db.settings.users[0];App.go('clients')});await p.waitForTimeout(300);
ok('comptable: no delete selection',!(await p.$('[data-act=cl_sel]')));
console.log(errs);await b.close();process.exit(f?1:0)})();
