const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
// Starlink « payment processed » and « service reactivated » e-mails: recognised, close the alert, listed in the « Réglés » tab. Fictitious data only.
const A='ACC-DF-30000001-11111-11',B='ACC-DF-30000002-22222-22';
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
const R=await p.evaluate(([A,B])=>{const P=App.slmail.parse;return[
 P({subject:'Paiement traité',text:`Nous avons traité votre paiement.\nNuméro de compte ${A}\nMontant du paiement CDF 55 000,00`}),
 P({subject:'Votre paiement Starlink a été reçu',text:`Merci pour votre paiement. Compte ${B}`}),
 P({subject:'Échec du paiement Starlink',text:`Échec de paiement\nNuméro de compte ${A}\nMontant du paiement CDF 1 000,00`}),
 P({subject:'Le service Starlink a été réactivé',text:`Nous réactivons le service pour votre compte ${B}.`}),
 P({subject:'Rappel de paiement automatique',text:`Paiement programmé\nCompte ${A}\nSolde actuel CDF 55 000,00`})]},[A,B]);
ok('« paiement traité » recognised with its amount',R[0].kind==='paye'&&R[0].acc===A&&R[0].amount===55000,JSON.stringify(R[0]));
ok('« paiement reçu » recognised',R[1].kind==='paye'&&R[1].acc===B,JSON.stringify(R[1]));
ok('a failed payment is still a failed payment, a reactivation still a reactivation, a reminder still a reminder',R[2].kind==='echec'&&R[3].kind==='actif'&&R[4].kind==='programme',R.map(x=>x.kind).join());
await p.evaluate(([A,B])=>{App.db.clients.push({id:'ca',type:'gere',first:'Anne',last:'Test',name:'Anne Test',phone:'0810000001',code:'CL-A',acc:A},{id:'cb',type:'gere',first:'Ben',last:'Test',name:'Ben Test',phone:'0810000002',code:'CL-B',acc:B});
 const T=Date.parse('2026-10-19T08:00:00Z'),I=App.slmail.ingest;
 I({id:'m1',ts:T,subject:'Échec du paiement Starlink',text:`Échec de paiement\nNuméro de compte ${A}\nMontant du paiement CDF 55 000,00`},'x@example.test');
 I({id:'m2',ts:T,subject:'Service Starlink suspendu',text:`Votre service Starlink a été suspendu, compte ${B}.`},'x@example.test');
 I({id:'m3',ts:T+3600e3,subject:'Paiement traité',text:`Nous avons traité votre paiement.\nNuméro de compte ${A}\nMontant du paiement CDF 55 000,00`},'x@example.test');
 I({id:'m4',ts:T+7200e3,subject:'Le service Starlink a été réactivé',text:`Nous réactivons le service pour votre compte ${B}.`},'x@example.test');
 App.save();App.go('slmail')},[A,B]);await p.waitForTimeout(500);
ok('processed payment and reactivation close the alerts of the clients',await p.evaluate(()=>App.client('ca').slm.state==='paye'&&App.client('cb').slm.state==='actif'&&App.slmail.alerts().length===0));
let txt=await p.innerText('#view');
ok('the « Réglés » tab shows the count',/Réglés \(2\)/.test(txt),txt.slice(0,300));
await p.click('[data-act=slm_tab][data-v=regles]');await p.waitForTimeout(300);txt=await p.innerText('#view');
ok('« Réglés » lists the processed payment (with amount) and the reactivated service with the client names',/Paiement traité/.test(txt)&&/55\s?000/.test(txt)&&/Service|Réactivé/.test(txt)&&/Anne Test/.test(txt)&&/Ben Test/.test(txt),txt.slice(0,600));
await p.evaluate(()=>App.go('client',{id:'ca'}));await p.waitForTimeout(400);
ok('client file shows « Paiement traité »',/Paiement traité/.test(await p.innerText('#view')));
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
