const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const p=await (await b.newContext({...devices['Pixel 5']})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{const t=App.today();App.db.clients.push({id:'c1',code:'CL-1',type:'gere',first:'Jean',last:'Mukendi',name:'Jean Mukendi',phone:'09',acc:'ACC-1',plan:'Résidentiel',price:70,start:t,period:30,grace:15,subs:[],created:t,note:''},{id:'c2',code:'CL-2',type:'gere',first:'Paul',last:'K',name:'Paul K',phone:'08',created:t,note:''});App.save();App.go('more')});await p.waitForTimeout(500);
ok('Plus has Fonds en attente',/Fonds en attente/.test(await p.innerText('#view')));
await p.click('[data-act=go][data-v=deposits]');await p.waitForTimeout(500);ok('empty state',/Aucun fonds en attente/.test(await p.innerText('#view')));
await p.click('[data-act=dep_new]');await p.waitForTimeout(300);await p.selectOption('#f_dc','c1');await p.fill('#f_da','70');await p.fill('#f_dn','à payer à Starlink');await p.click('#dok');await p.waitForTimeout(1200);
ok('deposit recorded: hero 70 $',/70 \$/.test(await p.innerText('.dhero'))&&await p.evaluate(()=>App.db.deposits.length===1&&App.db.deposits[0].amount===70));
await p.screenshot({path:'d16-list.png'});
// second deposit in CDF
await p.click('[data-act=dep_new]');await p.waitForTimeout(300);await p.selectOption('#f_dc','c2');await p.selectOption('#f_dcur','CDF');await p.fill('#f_da','24000');await p.selectOption('#f_dp','Commande en cours');await p.click('#dok');await p.waitForTimeout(1200);
ok('held total converts CDF (24000/2400=10 $) -> 80 $',/80 \$/.test(await p.innerText('.dhero')),(await p.innerText('.dhero')).replace(/\n/g,' | '));
// finance: deposits in the cash journal
const fin=await p.evaluate(()=>App.ledger().filter(r=>r.type==='Dépôt client').length);ok('ledger has 2 deposit entries',fin===2);
// pay for client partially
await p.click('#view .item:has-text("Jean Mukendi")');await p.waitForTimeout(400);ok('detail dialog with actions',/Payer pour le client/.test(await p.innerText('dialog'))&&/Rendre au client/.test(await p.innerText('dialog')));
await p.click('[data-act=dep_use]');await p.waitForTimeout(300);await p.fill('#f_ua','40');await p.fill('#f_un','Starlink');await p.click('#dok');await p.waitForTimeout(500);
ok('after paying 40: balance 30 (total 40 $ held)',await p.evaluate(()=>{const d=App.db.deposits[0];return App.depBalance(d)===30&&App.depStatus(d)==='part'}));
ok('ledger out row for payment',await p.evaluate(()=>App.ledger().some(r=>r.type==='Dépôt payé'&&r.amt===40&&r.kind==='out')));
await p.click('#view .item:has-text("Jean Mukendi")');await p.waitForTimeout(300);await p.click('[data-act=dep_use]');await p.waitForTimeout(300);await p.fill('#f_ua','99');await p.click('#dok');await p.waitForTimeout(300);ok('cannot pay more than balance',await p.evaluate(()=>App.db.deposits[0].uses.length===1));await p.keyboard.press('Escape');await p.waitForTimeout(300);
// refund rest
await p.click('#view .item:has-text("Jean Mukendi")');await p.waitForTimeout(300);await p.click('[data-act=dep_refund]');await p.waitForTimeout(300);await p.click('#dok');await p.waitForTimeout(500);
ok('refund the rest -> balance 0, status done',await p.evaluate(()=>{const d=App.db.deposits[0];return App.depBalance(d)===0&&App.depStatus(d)==='done'}));
await p.click('[data-act=dep_f][data-f=done]');await p.waitForTimeout(300);ok('filter Payés/rendus shows it',/Jean Mukendi/.test(await p.innerText('#view')));
// client tab + hero stat
await p.evaluate(()=>App.go('client',{id:'c2',tab:'dep'}));await p.waitForTimeout(500);ok('client Dépôts tab',/Nouveau dépôt/.test(await p.innerText('#view'))&&/Commande en cours/.test(await p.innerText('#view')));
ok('hero stat dépôt en attente (10 $)',/10 \$\s*\n?\s*dépôt en attente/.test(await p.innerText('.cstats')),(await p.innerText('.cstats')).replace(/\n/g,' | '));
// home card
await p.evaluate(()=>App.go('home'));await p.waitForTimeout(800);ok('home card Fonds en attente',/Fonds en attente : 10 \$/.test(await p.innerText('#view')));
// quick menu
await p.evaluate(()=>App.actions.quick());await p.waitForTimeout(300);ok('quick menu has Nouveau dépôt client',/Nouveau dépôt client/.test(await p.innerText('dialog')));await p.keyboard.press('Escape');
// delete
await p.evaluate(()=>App.go('deposits'));await p.waitForTimeout(400);
// vendeur: no access
await p.evaluate(()=>{App.db.settings.users=[{id:'v',name:'Vic',role:'vendeur',active:true,salt:'s',hash:'h'}];App.user=App.db.settings.users[0];App.applyRole&&App.applyRole();App.go('more')});await p.waitForTimeout(500);
ok('vendeur: no Fonds en attente in Plus',!/Fonds en attente/.test(await p.innerText('#view')));
await p.evaluate(()=>App.go('client',{id:'c2'}));await p.waitForTimeout(400);ok('vendeur: no Dépôts tab',!/Dépôts/.test(await p.innerText('.tabs')));
ok('vendeur: form refused',await p.evaluate(()=>{App.depositForm();return !document.querySelector('dialog[open]')}));
console.log(errs);await b.close();process.exit(f?1:0)})();
