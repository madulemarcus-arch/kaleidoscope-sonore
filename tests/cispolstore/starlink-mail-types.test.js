// Starlink e-mails: two more types are understood — « Urgent : payez votre facture maintenant pour éviter une suspension » (overdue payment)
// and « Données prioritaires » (information only). Fictitious account numbers and addresses only (built on the structure of the real e-mails).
const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
const A='ACC-DF-10000031-31313-31',B='ACC-DF-10000032-32323-32',U='ACC-DF-10000033-33333-33';
const retard=a=>`Réglez maintenant\nVotre paiement Starlink est en retard. Pour éviter une suspension, veuillez régler\ndès que possible.\n\nLa bonne nouvelle, c’est que vous pouvez payer instantanément sans vous\nconnecter en cliquant sur le lien ci-dessous. Une fois le paiement validé, votre\nabonnement sera automatiquement renouvelé pour un mois.\n\nPayer maintenant\n\nRemarque : vous devrez peut-être mettre à jour le mode de paiement associé à\nvotre compte pour rester connecté à l’avenir.\n\nCe message a été envoyé à l'adresse x@example.test pour le compte${a}.`;
const donnees=(a,sub)=>`Données prioritaires - 80 % de données consommées\nAbonnement ${sub}\nUtilisation des données 40,04 Go/50 Go\n\nD’après nos informations, vous n’êtes actuellement pas abonné à l’achat\nautomatique de données supplémentaires.\n\nAjouter des données\n\nCe message a été envoyé à l'adresse x@example.test pour le compte${a}.`;
const SUB_R='Urgent : payez votre facture maintenant pour éviter une suspension',SUB_D='Données prioritaires - 80 % de données consommées',SUB_D2='50 Go de données Données prioritaires ajoutées',SUB_M='Vous avez un nouveau message',SUB_X='Offre spéciale Starlink Mini',SUB_A='Confirmation d’activation du service',SUB_T='Nouveau message de Starlink';
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
const T0=Date.parse('2026-11-12T08:00:00Z'),H=3600e3;
// ---- parsing
const SL='SL-DF-10000099-99999-99';
const P=await p.evaluate(ms=>ms.map(m=>App.slmail.parse(m)),[{subject:SUB_R,text:retard(A)},{subject:SUB_D,text:donnees(B,SL)},{subject:SUB_D2,text:donnees(B,SL)},{subject:SUB_M,text:'Un membre de notre équipe a répondu à votre demande d’assistance n° TIK-DF-12997522-82281-87. Compte'+A},{subject:SUB_X,text:'Promotion. Compte'+A},{subject:SUB_A,text:'Vous avez activé votre service Starlink ! Compte'+B},{subject:SUB_T,text:'Enregistrement de vos informations d’identification. Compte'+B}]);
ok('overdue payment: kind « retard », the account is read (glued to the word before it)',P[0].kind==='retard'&&P[0].acc===A,JSON.stringify(P[0]));
ok('priority data (80 %): kind « donnees », the account is the ACC (not the SL- subscription number)',P[1].kind==='donnees'&&P[1].acc===B,JSON.stringify(P[1]));
ok('priority data added (50 Go): also information',P[2].kind==='donnees');
ok('support ticket message: kind « ticket »; activation confirmation: kind « activation »; an unknown subject stays unknown',P[3].kind==='ticket'&&P[5].kind==='activation'&&P[6].kind==='ticket'&&P[4].kind==='',JSON.stringify(P.slice(3)));
// ---- applied to the clients
await p.evaluate(([A,B])=>{App.db.clients.push({id:'ca',type:'gere',first:'Ana',last:'Retard',name:'Ana Retard',phone:'0810000031',code:'CL-A',acc:A},{id:'cb',type:'gere',first:'Ben',last:'Donnees',name:'Ben Donnees',phone:'0810000032',code:'CL-B',acc:B});App.db.slmail=[];App.save()},[A,B]);
const ing=(sub,txt,ts,id)=>p.evaluate(([sub,txt,ts,id])=>{const e=App.slmail.ingest({id,rid:'<'+id+'@x>',subject:sub,text:txt,ts},'a@example.test');return e?{kind:e.kind,res:e.res,clientId:e.clientId}:null},[sub,txt,ts,id]);
const e1=await ing(SUB_R,retard(A),T0,'r1');
ok('overdue payment applied to the client: state « retard », alert « Paiement en retard »',e1&&e1.res==='ok'&&e1.clientId==='ca'&&await p.evaluate(()=>App.client('ca').slm.state==='retard'&&App.slmail.alerts().map(c=>c.id).includes('ca')));
const e2=await ing(SUB_D,donnees(B,'SL-DF-10000099-99999-99'),T0+H,'d1');
ok('priority data e-mail: recorded as information, the client is not touched',e2&&e2.kind==='donnees'&&e2.res==='info'&&await p.evaluate(()=>!App.client('cb').slm&&!App.slmail.alerts().some(c=>c.id==='cb')));
const e3=await ing(SUB_D2,donnees(U,'SL-DF-10000098-98989-98'),T0+2*H,'d2');
ok('priority data for an account that is not in the client list: no « compte inconnu » line, nothing to do',e3&&e3.res==='info'&&await p.evaluate(()=>App.slmail.unknown().length===0));
await p.evaluate(()=>App.go('slmail'));await p.waitForTimeout(500);
const txt=await p.innerText('#view');
ok('alerts screen shows the overdue payment, counted with « suspension imminente »',/Paiement en retard/.test(txt)&&await p.evaluate(()=>{const c=[...document.querySelectorAll('.cstats > div')].find(d=>/suspension imminente/.test(d.textContent));return !!c&&c.querySelector('b').textContent==='1'}));
await p.evaluate(()=>App.actions.slm_tab({v:'journal'}));await p.waitForTimeout(300);
ok('journal: the information e-mails are listed with their subject, as information',/ℹ️ Données prioritaires/.test(await p.innerText('#view'))&&/Information : aucune alerte/.test(await p.innerText('#view')));
// a payment closes the overdue alert, like for the other alerts
const e4=await ing('Paiement traité','Nous avons bien reçu votre paiement. Compte'+A+'.',T0+3*H,'p1');
ok('a payment e-mail closes the overdue payment alert',e4&&e4.kind==='paye'&&await p.evaluate(()=>!App.slmail.alerts().some(c=>c.id==='ca')));
// ---- e-mails stored as « non reconnu » before: tried again from their subject
const n=await p.evaluate(([A,B,sr,sd,sx,sm,T0])=>{App.db.clients.push({id:'cc',type:'gere',first:'Cléo',last:'Ancien',name:'Cléo Ancien',phone:'0810000034',code:'CL-C',acc:'ACC-DF-10000034-34343-34'});
  const old=(id,subject,ts,acc)=>({id:'a@example.test:'+id,ts,acc,kind:'',amount:0,cur:'',days:0,subject,mailbox:'a@example.test',res:'inconnu'});
  App.db.slmail=[old('o1',sr,T0+10*3600e3,'ACC-DF-10000034-34343-34'),old('o2',sd,T0+11*3600e3,B),old('o3',sx,T0+12*3600e3,A),old('o4',sm,T0+13*3600e3,A)];
  const k=App.slmail.reclass();return{k,log:App.db.slmail.map(e=>[e.id.split(':')[1],e.kind,e.res].join('|')),state:(App.client('cc').slm||{}).state}},[A,B,SUB_R,SUB_D,SUB_X,SUB_M,T0]);
ok('old « non reconnu » entries are re-read from their subject (3 of 4), the unknown one stays',n.k===3&&JSON.stringify(n.log)==='["o1|retard|ok","o2|donnees|info","o3||inconnu","o4|ticket|info"]',JSON.stringify(n));
ok('the re-read overdue payment now alerts its client',n.state==='retard');
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
