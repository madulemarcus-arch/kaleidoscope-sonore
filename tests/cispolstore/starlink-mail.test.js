const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
// Fictitious account numbers and mailboxes only: the repository is public.
const X='ACC-DF-10000001-11111-11',Y='ACC-DF-10000002-22222-22',Z='ACC-DF-10000003-33333-33',W='ACC-DF-10000004-44444-44';
const T0=Date.parse('2026-10-19T08:00:00Z'),MIN=60e3;
const cut=a=>a.replace(/(\d+-)(\d+-\d+)$/,'$1\n   $2'); // the real e-mails cut the number at a hyphen
const body={
 echec:(a,amt)=>`Échec de paiement\nVotre paiement a échoué et nécessite votre attention.\n\n  Numéro de compte   ${a}\n\n  Montant du paiement   CDF ${amt}\n\nVotre paiement a échoué parce que le montant dépassait la limite disponible.\n\nCe message a été envoyé à l'adresse x@example.test pour le compte ${cut(a)}.`,
 avis:a=>`Avis de suspension\n${a}\n\nVotre compte sera suspendu dans 1 jour. Veuillez prendre des mesures pour éviter l’interruption de votre service Starlink.\n\nCe message a été envoyé à l'adresse x@example.test pour le compteACC-DF-10000002-\n22222-22.`,
 suspendu:a=>`Service suspendu\nVotre service Starlink a été suspendu en raison d’un solde impayé relatif au compte ${cut(a)}.\n\nVeuillez modifier vos données de facturation.`,
 actif:a=>`Service réactivé\nNous réactivons le service pour votre compte ${cut(a)}.`
};
const msg=(id,subject,text,ts,from='Starlink <no-reply@starlink.com>')=>({id,internalDate:String(ts),payload:{mimeType:'multipart/alternative',headers:[{name:'From',value:from},{name:'Subject',value:subject}],parts:[{mimeType:'text/plain',body:{data:Buffer.from(text,'utf8').toString('base64url')}}]}});
const BOX={
 'a@example.test':[ // newest first, like Gmail
  msg('a4','Échec du paiement Starlink',body.echec(Z,'87 000,00'),T0+240*MIN),
  msg('a3','Suspension de votre service Starlink',body.avis(Y),T0+60*MIN),
  msg('a2','Échec du paiement Starlink',body.echec(X,'61 008,07'),T0+9*MIN),
  msg('a1','Échec du paiement Starlink',body.echec(X,'157 661,28'),T0)],
 'b@example.test':[
  msg('b6','Promotion Starlink','Bonne affaire !',T0+300*MIN),
  msg('b5','Échec du paiement Starlink',body.echec(W,'10 000,00'),T0+250*MIN),
  msg('b4','Facture disponible',`Votre facture est prête pour le compte ${Y}.`,T0+200*MIN),
  msg('b3','Le service Starlink a été réactivé',body.actif(X),T0+180*MIN),
  msg('b2','Service Starlink suspendu',body.suspendu(Y),T0+120*MIN),
  msg('b1','Échec du paiement Starlink',body.echec(X,'61 008,07'),T0+9*MIN+10e3)] // the same notice, forwarded: counted once
};
BOX['b@example.test'].push(msg('b0','Newsletter','x',T0,'Autre <news@example.test>'));
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
let calls=0;
await ctx.route('https://gmail.googleapis.com/**',async r=>{calls++;const u=new URL(r.request().url()),who=(r.request().headers().authorization||'').replace('Bearer tok-',''),box=BOX[who];
 const json=o=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(o)});
 if(!box)return r.fulfill({status:401,body:'{}'});
 if(u.pathname.endsWith('/profile'))return json({emailAddress:who});
 if(u.pathname.endsWith('/messages'))return json({messages:box.map(m=>({id:m.id}))});
 const id=u.pathname.split('/').pop();return json(box.find(m=>m.id===id))});
await p.addInitScript(()=>{window.__pick='a@example.test';window.google={accounts:{oauth2:{initTokenClient:c=>({requestAccessToken:()=>setTimeout(()=>c.callback({access_token:'tok-'+(c.login_hint||window.__pick),expires_in:3600}),5)}),revoke:()=>{}}}}});
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
// ---- reading one e-mail (no network)
const P=await p.evaluate(([bodyEchec,bodyAvis,bodySusp,bodyAct])=>{const P=App.slmail.parse;return[P({subject:'Échec du paiement Starlink',text:bodyEchec}),P({subject:'Suspension de votre service Starlink',text:bodyAvis}),P({subject:'Service Starlink suspendu',text:bodySusp}),P({subject:'Le service Starlink a été réactivé',text:bodyAct}),P({subject:'Autre',text:'rien'}),P({subject:'Échec du paiement Starlink',text:'Numéro de compte ACC-DF-10000001-11111-11\nMontant du paiement USD 1,234.50'})]},[body.echec(X,'157 661,28'),body.avis(Y),body.suspendu(Y),body.actif(X)]);
ok('failed payment: kind, ACC cut by a line break, amount in CDF',P[0].kind==='echec'&&P[0].acc===X&&P[0].amount===157661.28&&P[0].cur==='CDF',JSON.stringify(P[0]));
ok('suspension notice: ACC glued to the previous word',P[1].kind==='avis'&&P[1].acc===Y&&P[1].days===1,JSON.stringify(P[1]));
ok('suspended and reactivated recognised',P[2].kind==='suspendu'&&P[2].acc===Y&&P[3].kind==='actif'&&P[3].acc===X);
ok('unknown e-mail: no kind, no ACC; English amount format read',P[4].kind===''&&P[4].acc===''&&P[5].amount===1234.5&&P[5].cur==='USD',JSON.stringify(P[5]));
// ---- clients
await p.evaluate(([X,Y,W])=>{App.db.clients.push({id:'cm',type:'gere',first:'Marie',last:'Test',name:'Marie Test',phone:'0810000001',code:'CL-M',acc:X.replace('ACC-DF-','ACC DF ')},{id:'cp',type:'gere',first:'Paul',last:'Test',name:'Paul Test',phone:'0810000002',code:'CL-P',acc:Y},{id:'cw1',type:'gere',name:'Double 1',code:'CL-W1',acc:W},{id:'cw2',type:'gere',name:'Double 2',code:'CL-W2',acc:W});App.save()},[X,Y,W]);
// ---- settings: configure, add the two mailboxes
await p.evaluate(()=>App.go('settings'));await p.waitForTimeout(500);
await p.evaluate(()=>document.querySelector('[data-fold=slmail]').setAttribute('open',''));
ok('settings: E-mails Starlink card with Configurer',await p.isVisible('[data-act=slm_setup]'));
await p.click('[data-act=slm_setup]');await p.waitForTimeout(300);await p.fill('#slm_cid','invalide');await p.click('#dlg .btn:not(.sec):not(.del)');
ok('invalid client id refused',/ne ressemble pas/.test(await p.innerText('#slm_msg')));
await p.fill('#slm_cid','123456789-test.apps.googleusercontent.com');await p.click('#dlg .btn:not(.sec):not(.del)');await p.waitForTimeout(400);
ok('configured: add button shown',await p.isVisible('[data-act=slm_add]'));
await p.click('[data-act=slm_add]');await p.waitForTimeout(1500);
await p.evaluate(()=>{window.__pick='b@example.test'});
await p.evaluate(()=>App.go('settings'));await p.waitForTimeout(400);await p.evaluate(()=>document.querySelector('[data-fold=slmail]').setAttribute('open',''));
await p.click('[data-act=slm_add]');await p.waitForTimeout(1800);
const st=await p.evaluate(()=>({acc:JSON.parse(localStorage.getItem('cispolstore-gmail')).accounts.map(a=>a.email),log:App.db.slmail.map(e=>[e.id,e.res,e.kind].join('|')),cl:Object.fromEntries(['cm','cp','cw1','cw2'].map(i=>[i,(App.client(i).slm||{}).state||'']))}));
ok('two mailboxes linked',st.acc.join(',')==='a@example.test,b@example.test',st.acc.join(','));
ok('newest e-mail wins whatever the reading order (Marie reactivated, Paul suspended)',st.cl.cm==='actif'&&st.cl.cp==='suspendu',JSON.stringify(st.cl));
ok('older e-mail kept as "ancien" (a1 older than a2), not applied',st.log.some(x=>/:a1\|ancien/.test(x))&&st.log.some(x=>/:a3\|ok/.test(x)),st.log.join(' '));
ok('forwarded duplicate counted once (b1 absent), newsletter and promotion ignored',!st.log.some(x=>/:b1\|/.test(x))&&!st.log.some(x=>/:b[06]\|/.test(x)),st.log.join(' '));
ok('unknown ACC -> sans-client, shared ACC -> ambigu, unknown type -> inconnu',st.log.includes('a@example.test:a4|sans-client|echec')&&st.log.includes('b@example.test:b5|ambigu|echec')&&st.log.some(x=>/:b4\|inconnu/.test(x)),st.log.join(' '));
ok('ambiguous ACC changed neither client',st.cl.cw1===''&&st.cl.cw2==='');
// ---- second reading: nothing new, nothing doubled
const n0=await p.evaluate(()=>App.db.slmail.length);await p.evaluate(()=>App.slmail.check(true));await p.waitForTimeout(1500);
ok('second reading: no duplicate in the journal',await p.evaluate(()=>App.db.slmail.length)===n0);
// ---- screens
await p.evaluate(()=>App.go('slmail'));await p.waitForTimeout(600);
let txt=await p.innerText('#view');
ok('Alertes Starlink: Paul listed with his ACC, Marie (reactivated) not',/Paul Test/.test(txt)&&/Suspendu/.test(txt)&&!/Marie Test/.test(txt)&&/ACC-DF-10000002-22222-22/.test(txt));
await p.click('[data-act=slm_tab][data-v=todo]');await p.waitForTimeout(300);txt=await p.innerText('#view');
ok('À vérifier: 3 e-mails (sans client, ambigu, inconnu)',/À vérifier \(3\)/.test(txt)&&/Aucun client avec cet ACC/.test(txt)&&/Plusieurs clients ont cet ACC/.test(txt)&&/non reconnu/.test(txt));
await p.click('[data-act=slm_tab][data-v=journal]');await p.waitForTimeout(300);
ok('Journal lists the e-mails with their mailbox',/a@example\.test/.test(await p.innerText('#view'))&&/b@example\.test/.test(await p.innerText('#view')));
await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(500);
ok('client list: badge on Paul only',/Suspendu/.test(await p.innerText('#clist'))&&(await p.innerText('#clist')).match(/Suspendu/g).length===1);
await p.evaluate(()=>App.go('home'));await p.waitForTimeout(600);
ok('home: Starlink alert in "À faire"',/1 client\(s\) Starlink à suivre/.test(await p.innerText('#view')));
await p.evaluate(()=>App.go('client',{id:'cp'}));await p.waitForTimeout(500);
ok('client file (Infos) shows the e-mail status',/E-mail Starlink/.test(await p.innerText('#view'))&&/Suspendu/.test(await p.innerText('#view')));
// ---- WhatsApp message, resolve, undo
await p.evaluate(()=>App.go('slmail'));await p.waitForTimeout(500);await p.evaluate(()=>{window.__u='';window.open=u=>{window.__u=u}});
await p.click('[data-act=slm_tab][data-v=alerts]');await p.waitForTimeout(300);await p.click('[data-act=slm_wa]');const wa=decodeURIComponent(await p.evaluate(()=>window.__u));
ok('WhatsApp message to the client mentions the suspension',/wa\.me/.test(wa)&&/suspendu/.test(wa)&&/Paul/.test(wa),wa.slice(0,120));
await p.click('[data-act=slm_tab][data-v=journal]');await p.waitForTimeout(300);
await p.click('[data-act=slm_undo][data-id="b@example.test:b2"]');await p.waitForTimeout(400);
ok('undo restores the previous state (suspended -> suspension notice a3)',await p.evaluate(()=>App.client('cp').slm.state)==='avis');
// ---- rematch once the client has the ACC
await p.evaluate(([Z])=>{App.db.clients.push({id:'cz',type:'gere',name:'Zed Test',code:'CL-Z',acc:Z});App.save()},[Z]);
await p.evaluate(()=>App.slmail.check(true));await p.waitForTimeout(1500);
ok('an e-mail waiting for its client is applied once the ACC exists',await p.evaluate(()=>(App.client('cz').slm||{}).state)==='echec'&&await p.evaluate(()=>App.db.slmail.find(e=>e.id==='a@example.test:a4').res)==='ok');
await p.evaluate(()=>App.slmail.check(true));
await p.evaluate(()=>App.actions.slm_done({id:'cz'}));ok('"Réglé" closes the alert',await p.evaluate(()=>App.client('cz').slm.state)==='actif');
// ---- remove a mailbox
await p.evaluate(()=>App.go('settings'));await p.waitForTimeout(400);await p.evaluate(()=>document.querySelector('[data-fold=slmail]').setAttribute('open',''));
await p.click('[data-act=slm_remove][data-v="1"]');await p.waitForTimeout(300);
ok('mailbox removed, alerts kept',await p.evaluate(()=>JSON.parse(localStorage.getItem('cispolstore-gmail')).accounts.length)===1&&await p.evaluate(()=>App.db.slmail.length)>0);
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
