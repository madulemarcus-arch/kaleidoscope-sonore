const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
// Fictitious account numbers and mailboxes only: the repository is public.
const X='ACC-DF-10000001-11111-11',Y='ACC-DF-10000002-22222-22',Z='ACC-DF-10000003-33333-33',W='ACC-DF-10000004-44444-44',V='ACC-DF-10000007-77777-77';
const T0=Date.parse('2026-10-19T08:00:00Z'),MIN=60e3;
const cut=a=>a.replace(/(\d+-)(\d+-\d+)$/,'$1\n   $2'); // the real e-mails cut the number at a hyphen
const body={
 echec:(a,amt)=>`Échec de paiement\nVotre paiement a échoué et nécessite votre attention.\n\n  Numéro de compte   ${a}\n\n  Montant du paiement   CDF ${amt}\n\nVotre paiement a échoué parce que le montant dépassait la limite disponible.\n\nCe message a été envoyé à l'adresse x@example.test pour le compte ${cut(a)}.`,
 avis:a=>`Avis de suspension\n${a}\n\nVotre compte sera suspendu dans 1 jour. Veuillez prendre des mesures pour éviter l’interruption de votre service Starlink.\n\nCe message a été envoyé à l'adresse x@example.test pour le compteACC-DF-10000002-\n22222-22.`,
 suspendu:a=>`Service suspendu\nVotre service Starlink a été suspendu en raison d’un solde impayé relatif au compte ${cut(a)}.\n\nVeuillez modifier vos données de facturation.`,
 prog:(a,amt)=>`Paiement programmé\nLe paiement automatique de votre service mensuel est programmé pour le 19/10/2026.\n\nPériode du relevé 19/10/2026 - 18/11/2026\n\nSolde actuel CDF ${amt}\n\nConnectez-vous à votre compte pour vérifier votre paiement.\n\nCe message a été envoyé à l'adresse x@example.test pour le compte${a.slice(0,16)}\n${a.slice(16)}.`,
 actif:a=>`Service réactivé\nNous réactivons le service pour votre compte ${cut(a)}.`
};
const msg=(id,subject,text,ts,from='Starlink <no-reply@starlink.com>')=>({id,internalDate:String(ts),payload:{mimeType:'multipart/alternative',headers:[{name:'From',value:from},{name:'Subject',value:subject}],parts:[{mimeType:'text/plain',body:{data:Buffer.from(text,'utf8').toString('base64url')}}]}});
const BOX={
 'a@example.test':[ // newest first, like Gmail
  msg('a7','Échec du paiement Starlink',body.echec(V,'55 000,00'),T0+20*MIN),
  msg('a6','Rappel de paiement automatique',body.prog(V,'55 000,00'),T0+15*MIN),
  msg('a5','Rappel de paiement automatique',body.prog(Y,'143 999,99'),T0+30*MIN),
  msg('a4','Échec du paiement Starlink',body.echec(Z,'87 000,00'),T0+240*MIN),
  msg('a3','Suspension de votre service Starlink',body.avis(Y),T0+60*MIN),
  msg('a2','Échec du paiement Starlink',body.echec(X,'61 008,07'),T0+9*MIN),
  msg('a1','Échec du paiement Starlink',body.echec(X,'157 661,28'),T0)],
 'b@example.test':[
  msg('b7','Rappel de paiement automatique',body.prog(Y,'97 500,09'),T0+500*MIN),
  msg('b6','Promotion Starlink','Bonne affaire !',T0+300*MIN),
  msg('b5','Échec du paiement Starlink',body.echec(W,'10 000,00'),T0+250*MIN),
  msg('b4','Facture disponible',`Votre facture est prête pour le compte ${Y}.`,T0+200*MIN),
  msg('b3','Le service Starlink a été réactivé',body.actif(X),T0+180*MIN),
  msg('b2','Service Starlink suspendu',body.suspendu(Y),T0+120*MIN),
  msg('b1','Échec du paiement Starlink',body.echec(X,'61 008,07'),T0+9*MIN+10e3)] // the same notice, forwarded: counted once
};
BOX['c@example.test']=[ // a third mailbox: the same notice as a4 (Starlink writes to every contact address) and an account we do not know
  msg('c2','Service Starlink suspendu',body.suspendu('ACC-DF-10000006-66666-66'),T0+260*MIN),
  msg('c1','Échec du paiement Starlink',body.echec(Z,'87 000,00'),T0+241*MIN)];
// Fictitious invoice PDF built like Starlink's (Type0 / Identity-H font with a ToUnicode map, Flate streams, one text object per line)
const { makePdf } = require('./pdf-fixture');
const PDF=makePdf(['Attn: Alice Exemple','Emplacement : 1.2345,2.3456','Ville Test, Province Test','Facture','INV-DF-COD-000001-00001-01','Compte client: '+V,'Résidentiel | (lundi 19 octobre 2026 - mercredi 18 novembre 2026) 1 CDF 50 000,00','GB-EXEMPLE KIT123456789ABC','Prix total CDF 55 000,00']);
BOX['a@example.test'].find(m=>m.id==='a6').payload.parts.push({filename:'INV-DF-COD-000001-00001-01.pdf',mimeType:'application/pdf',body:{attachmentId:'att1',size:PDF.length}});
BOX['b@example.test'].push(msg('b0','Newsletter','x',T0,'Autre <news@example.test>'));
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
let calls=0,qmode='',qLeft=0;
await ctx.route('https://gmail.googleapis.com/**',async r=>{calls++;const u=new URL(r.request().url()),who=(r.request().headers().authorization||'').replace('Bearer tok-',''),box=BOX[who];
 const json=o=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(o)});
 if(!box)return r.fulfill({status:401,body:'{}'});
 if(u.pathname.endsWith('/profile'))return json({emailAddress:who});
 if(u.pathname.endsWith('/messages'))return json({messages:box.map(m=>({id:m.id}))});
 if((qmode==='all'||(qmode==='some'&&qLeft>0))&&/\/messages\/./.test(u.pathname)){qLeft--;return r.fulfill({status:429,contentType:'application/json',headers:{'retry-after':'1'},body:JSON.stringify({error:{code:429,message:"Quota exceeded for quota metric 'Total Query Cost' and limit 'Units per minute per user'",errors:[{reason:'rateLimitExceeded'}]}})})}
 if(/\/attachments\/att1$/.test(u.pathname))return json({data:PDF.toString('base64').replace(/\+/g,'-').replace(/\//g,'_')});
 const id=u.pathname.split('/').pop();return json(box.find(m=>m.id===id))});
await p.addInitScript(()=>{window.__pick='a@example.test';window.google={accounts:{oauth2:{initTokenClient:c=>({requestAccessToken:()=>setTimeout(()=>{if((window.__fail||[]).includes(c.login_hint))return c.error_callback({type:'popup_failed_to_open'});c.callback({access_token:'tok-'+(c.login_hint||window.__pick),expires_in:3600})},5)}),revoke:()=>{}}}}});
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
// ---- reading one e-mail (no network)
const P=await p.evaluate(([bodyEchec,bodyAvis,bodySusp,bodyAct,bodyProg])=>{const P=App.slmail.parse;return[P({subject:'Échec du paiement Starlink',text:bodyEchec}),P({subject:'Suspension de votre service Starlink',text:bodyAvis}),P({subject:'Service Starlink suspendu',text:bodySusp}),P({subject:'Le service Starlink a été réactivé',text:bodyAct}),P({subject:'Autre',text:'rien'}),P({subject:'Échec du paiement Starlink',text:'Numéro de compte ACC-DF-10000001-11111-11\nMontant du paiement USD 1,234.50'}),P({subject:'Rappel de paiement automatique',text:bodyProg})]},[body.echec(X,'157 661,28'),body.avis(Y),body.suspendu(Y),body.actif(X),body.prog(Y,'143 999,99')]);
ok('failed payment: kind, ACC cut by a line break, amount in CDF',P[0].kind==='echec'&&P[0].acc===X&&P[0].amount===157661.28&&P[0].cur==='CDF',JSON.stringify(P[0]));
ok('suspension notice: ACC glued to the previous word',P[1].kind==='avis'&&P[1].acc===Y&&P[1].days===1,JSON.stringify(P[1]));
ok('suspended and reactivated recognised',P[2].kind==='suspendu'&&P[2].acc===Y&&P[3].kind==='actif'&&P[3].acc===X);
ok('payment reminder: next debit date, statement period and amount read (ACC glued and cut)',P[6].kind==='programme'&&P[6].acc===Y&&P[6].due==='2026-10-19'&&P[6].from==='2026-10-19'&&P[6].to==='2026-11-18'&&P[6].amount===143999.99&&P[6].cur==='CDF',JSON.stringify(P[6]));
ok('unknown e-mail: no kind, no ACC; English amount format read',P[4].kind===''&&P[4].acc===''&&P[5].amount===1234.5&&P[5].cur==='USD',JSON.stringify(P[5]));
// ---- clients
await p.evaluate(([X,Y,W])=>{App.db.clients.push({id:'cm',type:'gere',first:'Marie',last:'Test',name:'Marie Test',phone:'0810000001',code:'CL-M',acc:X.replace('ACC-DF-','ACC DF ')},{id:'cp',type:'gere',first:'Paul',last:'Test',name:'Paul Test',phone:'0810000002',code:'CL-P',acc:Y},{id:'cw1',type:'gere',name:'Double 1',code:'CL-W1',acc:W},{id:'cw2',type:'gere',name:'Double 2',code:'CL-W2',acc:W});App.save()},[X,Y,W]);
// ---- settings: configure, add the two mailboxes
await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(500);
await p.evaluate(()=>document.querySelector('[data-fold=slmail]').setAttribute('open',''));
ok('Clients screen: E-mails Starlink panel with Configurer',await p.isVisible('[data-act=slm_setup]'));
await p.click('[data-act=slm_setup]');await p.waitForTimeout(300);await p.fill('#slm_cid','invalide');await p.click('#dlg .btn:not(.sec):not(.del)');
ok('invalid client id refused (wrong format), with the expected format explained',/n'a pas le format/.test(await p.innerText('#slm_msg'))&&/123456789012-abc123/.test(await p.innerText('#slm_msg')));
await p.fill('#slm_cid','abc.apps.googleusercontent.com');await p.click('#dlg .btn:not(.sec):not(.del)');
ok('an ID without the numeric project prefix is refused too (typical truncated paste)',/n'a pas le format/.test(await p.innerText('#slm_msg'))&&await p.isVisible('#slm_cid'));
await p.fill('#slm_cid',' 123456789-test.apps.googleusercontent.com ');await p.click('#dlg .btn:not(.sec):not(.del)');await p.waitForTimeout(400);
ok('configured: add button shown',await p.isVisible('[data-act=slm_add]'));
ok('the card shows the whole Google ID (trimmed) with a « Copier » button, and the hint about « OAuth client was not found »',await p.evaluate(()=>{const t=document.getElementById('view').textContent,b=document.querySelector('[data-act=copy][data-t="123456789-test.apps.googleusercontent.com"]');return t.includes('123456789-test.apps.googleusercontent.com')&&!!b&&/OAuth client was not found/.test(t)}));
await p.click('[data-act=slm_add]');await p.waitForTimeout(300);
ok('add window: type the address, or pick an account of the device',await p.isVisible('#slm_email')&&await p.isVisible('[data-act=slm_chooser]'));
await p.fill('#slm_email','not-an-address');await p.click('#dok');await p.waitForTimeout(200);
ok('invalid address: message, window stays open',/adresse e-mail valide/.test(await p.innerText('#slm_msg'))&&await p.isVisible('#slm_email'));
await p.fill('#slm_email','a@example.test');await p.click('#dok');await p.waitForTimeout(1500);
await p.evaluate(()=>{window.__pick='b@example.test'});
await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(400);await p.evaluate(()=>document.querySelector('[data-fold=slmail]').setAttribute('open',''));
await p.click('[data-act=slm_add]');await p.waitForTimeout(300);await p.click('[data-act=slm_chooser]');await p.waitForTimeout(1800);
await p.evaluate(()=>{window.__pick='c@example.test'});
await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(400);await p.evaluate(()=>document.querySelector('[data-fold=slmail]').setAttribute('open',''));
await p.click('[data-act=slm_add]');await p.waitForTimeout(300);await p.fill('#slm_email','C@Example.test ');await p.click('#dok');await p.waitForTimeout(1800);
const st=await p.evaluate(()=>({acc:JSON.parse(localStorage.getItem('cispolstore-gmail')).accounts.map(a=>a.email),log:App.db.slmail.map(e=>[e.id,e.res,e.kind].join('|')),cl:Object.fromEntries(['cm','cp','cw1','cw2'].map(i=>[i,(App.client(i).slm||{}).state||'']))}));
ok('three mailboxes linked',st.acc.join(',')==='a@example.test,b@example.test,c@example.test',st.acc.join(','));
const al4=await p.evaluate(()=>App.db.slmail.find(e=>e.id==='a@example.test:a4'));
ok('same notice in two mailboxes: one entry, the other mailbox remembered',!!al4&&(al4.also||[]).join()==='c@example.test'&&!(await p.evaluate(()=>App.db.slmail.some(e=>e.id==='c@example.test:c1'))));
ok('newest e-mail wins whatever the reading order (Marie reactivated, Paul suspended)',st.cl.cm==='actif'&&st.cl.cp==='suspendu',JSON.stringify(st.cl));
ok('older e-mail kept as "ancien" (a1 older than a2), not applied',st.log.some(x=>/:a1\|ancien/.test(x))&&st.log.some(x=>/:a3\|ok/.test(x)),st.log.join(' '));
ok('forwarded duplicate counted once (b1 absent), newsletter and promotion ignored',!st.log.some(x=>/:b1\|/.test(x))&&!st.log.some(x=>/:b[06]\|/.test(x)),st.log.join(' '));
ok('unknown ACC -> sans-client, shared ACC -> ambigu, unknown type -> inconnu',st.log.includes('a@example.test:a4|sans-client|echec')&&st.log.includes('b@example.test:b5|ambigu|echec')&&st.log.some(x=>/:b4\|inconnu/.test(x)),st.log.join(' '));
const sp=await p.evaluate(()=>({p:App.client('cp').slp,s:App.client('cp').slm.state,m:App.client('cm').slp,al:App.slmail.count()}));
ok('payment reminder stored apart: newest (b7, 97 500,09) wins and Paul stays suspended',sp.p&&sp.p.amount===97500.09&&sp.p.due==='2026-10-19'&&sp.s==='suspendu',JSON.stringify(sp));
ok('payment reminder is not an alert',sp.al===1&&!sp.m);
ok('ambiguous ACC changed neither client',st.cl.cw1===''&&st.cl.cw2==='');
// ---- second reading: nothing new, nothing doubled
const n0=await p.evaluate(()=>App.db.slmail.length);await p.evaluate(()=>App.slmail.check(true));await p.waitForTimeout(1500);
ok('second reading: no duplicate in the journal',await p.evaluate(()=>App.db.slmail.length)===n0);
// ---- screens
await p.evaluate(()=>App.go('slmail'));await p.waitForTimeout(600);
let txt=await p.innerText('#view');
ok('Alertes Starlink: Paul listed with his ACC, Marie (reactivated) not',/Paul Test/.test(txt)&&/Suspendu/.test(txt)&&!/Marie Test/.test(txt)&&/ACC-DF-10000002-22222-22/.test(txt));
await p.click('[data-act=slm_tab][data-v=todo]');await p.waitForTimeout(300);txt=await p.innerText('#view');
ok('À vérifier: one line per unknown ACC (not registered, shared by two clients) plus the unrecognised e-mail',/À vérifier \(5\)/.test(txt)&&(txt.match(/Non enregistré/g)||[]).length===3&&/Plusieurs clients/.test(txt)&&/E-mails non reconnus \(1\)/.test(txt),txt.slice(0,300));
ok('unknown ACC line shows how many e-mails and which mailboxes (Z: a and c)',/2? ?e-mail\(s\) · boîte\(s\) : a@example\.test, c@example\.test/.test(txt)||/boîte\(s\) : a@example\.test, c@example\.test/.test(txt),txt.slice(0,700));
await p.click('[data-act=slm_tab][data-v=journal]');await p.waitForTimeout(300);
ok('Journal lists the e-mails with their mailbox',/a@example\.test/.test(await p.innerText('#view'))&&/b@example\.test/.test(await p.innerText('#view')));
await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(500);
ok('client list: badge on Paul only',/Suspendu/.test(await p.innerText('#clist'))&&(await p.innerText('#clist')).match(/Suspendu/g).length===1);
ok('Clients screen: alert line for the clients to follow',/1 client\(s\) Starlink à suivre/.test(await p.innerText('#view')));
await p.evaluate(()=>App.go('home'));await p.waitForTimeout(600);
ok('home: nothing about Starlink e-mails on the dashboard',!/Starlink à suivre|E-mails Starlink/.test(await p.innerText('#view')));
await p.evaluate(()=>App.go('client',{id:'cp'}));await p.waitForTimeout(500);
ok('client file (Infos) shows the e-mail status and the next debit',/E-mail Starlink/.test(await p.innerText('#view'))&&/Suspendu/.test(await p.innerText('#view'))&&/Prélèvement Starlink/.test(await p.innerText('#view'))&&/19\/10\/2026/.test(await p.innerText('#view')));
// ---- WhatsApp message, resolve, undo
await p.evaluate(()=>App.go('slmail'));await p.waitForTimeout(500);await p.evaluate(()=>{window.__u='';window.open=u=>{window.__u=u}});
await p.click('[data-act=slm_tab][data-v=alerts]');await p.waitForTimeout(300);await p.click('[data-act=slm_wa]');const wa=decodeURIComponent(await p.evaluate(()=>window.__u));
ok('WhatsApp message to the client mentions the suspension',/wa\.me/.test(wa)&&/suspendu/.test(wa)&&/Paul/.test(wa),wa.slice(0,120));
await p.click('[data-act=slm_tab][data-v=journal]');await p.waitForTimeout(300);
await p.click('[data-act=slm_undo][data-id="b@example.test:b2"]');await p.waitForTimeout(400);
ok('undo restores the previous state (suspended -> suspension notice a3)',await p.evaluate(()=>App.client('cp').slm.state)==='avis');
// ---- link an unknown ACC to a client / create a client with the ACC filled in
await p.evaluate(()=>{App.db.clients.push({id:'cu',type:'gere',first:'Uma',last:'Test',name:'Uma Test',phone:'0810000009',code:'CL-U'});App.save();App.go('slmail')});await p.waitForTimeout(500);
await p.click('[data-act=slm_tab][data-v=todo]');await p.waitForTimeout(300);
await p.click('[data-act=slm_new][data-acc="%s"]'.replace('%s',Z));await p.waitForTimeout(400);
ok('"Nouveau client" opens the form with the ACC already filled in',await p.evaluate(()=>document.getElementById('f_acc')&&document.getElementById('f_acc').value)===Z);
await p.evaluate(()=>App.close());await p.waitForTimeout(300);
await p.click('[data-act=slm_link][data-acc="%s"]'.replace('%s','ACC-DF-10000006-66666-66'));await p.waitForTimeout(400);
await p.fill('#slm_q','Uma');await p.waitForTimeout(300);
ok('picker filters the clients',(await p.$$('[data-act=slm_pick]')).length===1);
await p.click('[data-act=slm_pick][data-id=cu]');await p.waitForTimeout(500);
const lk=await p.evaluate(()=>({acc:App.client('cu').acc,st:(App.client('cu').slm||{}).state,left:App.slmail.unknown().length}));
ok('linking sets the client ACC and applies the waiting e-mails at once (suspended)',lk.acc==='ACC-DF-10000006-66666-66'&&lk.st==='suspendu',JSON.stringify(lk));
ok('the linked ACC leaves the "À vérifier" list',lk.left===3,JSON.stringify(lk));
await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(500);
ok('Clients screen: line for unknown ACC still to link',/compte\(s\) Starlink \(ACC\) vu\(s\) dans vos e-mails/.test(await p.innerText('#view')));
// ---- rematch once the client has the ACC
await p.evaluate(([Z])=>{App.db.clients.push({id:'cz',type:'gere',name:'Zed Test',code:'CL-Z',acc:Z});App.save()},[Z]);
await p.evaluate(()=>App.slmail.check(true));await p.waitForTimeout(1500);
ok('an e-mail waiting for its client is applied once the ACC exists',await p.evaluate(()=>(App.client('cz').slm||{}).state)==='echec'&&await p.evaluate(()=>App.db.slmail.find(e=>e.id==='a@example.test:a4').res)==='ok');
await p.evaluate(()=>App.slmail.check(true));
await p.evaluate(()=>App.actions.slm_done({id:'cz'}));ok('"Réglé" closes the alert',await p.evaluate(()=>App.client('cz').slm.state)==='actif');
// ---- create the missing clients in one go (ambiguous ACC are left alone)
await p.evaluate(()=>App.go('slmail'));await p.waitForTimeout(500);await p.click('[data-act=slm_tab][data-v=todo]');await p.waitForTimeout(300);
ok('button to create the missing client appears',/Créer le client manquant/.test(await p.innerText('#view')),(await p.innerText('#view')).slice(0,200));
await p.evaluate(()=>{window.confirm=()=>true});
await p.evaluate(()=>App.actions.slm_createall());await p.waitForTimeout(500);
const cr=await p.evaluate(V=>{const c=App.db.clients.find(x=>x.acc===V);return c&&{name:c.name,start:c.start,period:c.period,st:(c.slm||{}).state,fromMail:c.fromMail,left:App.slmail.unknown().length}},V);
ok('client created from the e-mails with ACC, subscription dates and Starlink state',!!cr&&/^Compte /.test(cr.name)&&cr.start==='2026-10-19'&&cr.period===30&&cr.st==='echec'&&cr.fromMail===true,JSON.stringify(cr));
ok('only the ambiguous ACC remains in "À vérifier"',cr&&cr.left===1,JSON.stringify(cr));
// ---- fill the created client from the invoice PDF attached to the payment reminder
const tx=await p.evaluate(async b64=>App.pdfText(Uint8Array.from(atob(b64),c=>c.charCodeAt(0))),PDF.toString('base64'));
ok('PDF reader: lines of the invoice, accents and spaces kept',/^Attn: Alice Exemple$/m.test(tx)&&/Résidentiel \| \(lundi 19 octobre 2026/.test(tx)&&/Prix total CDF 55 000,00/.test(tx),tx.slice(0,200));
const iv=await p.evaluate(t=>App.slmail.invoice(t),tx);
ok('invoice fields: name, place, GPS, plan, period, kit, amount',iv.name==='Alice Exemple'&&iv.place==='Ville Test, Province Test'&&iv.gps==='1.2345,2.3456'&&iv.plan==='Résidentiel'&&iv.from==='2026-10-19'&&iv.to==='2026-11-18'&&iv.serial==='KIT123456789ABC'&&iv.kit==='GB-EXEMPLE'&&iv.amount===55000&&iv.cur==='CDF'&&iv.acc===V,JSON.stringify(iv));
await p.evaluate(()=>App.go('slmail'));await p.waitForTimeout(500);await p.click('[data-act=slm_tab][data-v=todo]');await p.waitForTimeout(300);
ok('button to complete the client from the invoice appears (1 client waiting)',/Compléter 1 fiche\(s\) depuis les factures PDF/.test(await p.innerText('#view')));
await p.click('[data-act=slm_pdf]');await p.waitForTimeout(1500);
const pc=await p.evaluate(V=>{const c=App.db.clients.find(x=>x.acc===V);return{name:c.name,first:c.first,last:c.last,city:c.city,addr:c.address,gps:c.installAddr,serial:c.serial,plan:c.plan,price:c.price,chk:c.nameCheck,done:c.pdfDone,left:App.slmail.pending().length}},V);
ok('client completed from the PDF: name, locality, position, kit serial, plan and its price',pc.name==='Alice Exemple'&&pc.first==='Alice'&&pc.last==='Exemple'&&pc.city==='Ville Test'&&pc.addr==='Ville Test, Province Test'&&pc.gps==='GPS 1.2345,2.3456'&&pc.serial==='KIT123456789ABC'&&pc.plan==='Résidentiel'&&pc.price===70&&pc.done===true&&pc.left===0,JSON.stringify(pc));
ok('the name read on the invoice is flagged to be checked',pc.chk===true);
await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(500);
ok('client list: « Nom à valider » badge',/Nom à valider/.test(await p.innerText('#clist')));
await p.evaluate(V=>App.go('client',{id:App.db.clients.find(x=>x.acc===V).id}),V);await p.waitForTimeout(500);
await p.click('[data-act=slm_valid]');await p.waitForTimeout(400);
ok('"C\'est bon" validates the name',await p.evaluate(V=>!App.db.clients.find(x=>x.acc===V).nameCheck,V));
// ---- nothing is read when the app opens; opening Clients reads quietly
await p.evaluate(()=>{const k='cispolstore-gmail',c=JSON.parse(localStorage.getItem(k));c.lastCheck=0;localStorage.setItem(k,JSON.stringify(c))});
const c0=calls;await p.reload();await p.waitForTimeout(6000);
ok('nothing is read when the app opens (dashboard untouched)',calls===c0);
await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(3500);
ok('opening Clients reads the mailboxes quietly (no window)',calls>c0&&await p.evaluate(()=>JSON.parse(localStorage.getItem('cispolstore-gmail')).lastCheck)>0);
// ---- popup blocked (typical on a phone): a clear, lasting message instead of a toast that vanishes
await p.evaluate(async()=>{const o=google.accounts.oauth2,orig=o.initTokenClient;o.initTokenClient=c=>({requestAccessToken:()=>setTimeout(()=>c.error_callback({type:'popup_failed_to_open'}),5)});await App.actions.slm_chooser();o.initTokenClient=orig});await p.waitForTimeout(400);
ok('blocked Google window: lasting explanation in the e-mail card',await p.evaluate(()=>/fenêtres surgissantes/.test(App.slmail.error))&&/fenêtres surgissantes/.test(await p.evaluate(()=>document.getElementById('view').textContent)));
// ---- address typed but Google signs in to another account: clear message, nothing linked
await p.evaluate(()=>{const o=google.accounts.oauth2;o.__orig=o.initTokenClient;o.initTokenClient=c=>({requestAccessToken:()=>setTimeout(()=>c.callback({access_token:'tok-a@example.test',expires_in:3600}),5)});App.actions.slm_add()});await p.waitForTimeout(300);
await p.fill('#slm_email','d@example.test');await p.click('#dok');await p.waitForTimeout(800);
ok('typed address but Google signed in to another account: clear message, nothing linked',await p.evaluate(()=>/Mauvais compte Google/.test(App.slmail.error)&&JSON.parse(localStorage.getItem('cispolstore-gmail')).accounts.length===3));
await p.evaluate(()=>{google.accounts.oauth2.initTokenClient=google.accounts.oauth2.__orig});
// ---- the mailboxes follow the data (synced settings): the phone shows the same mailboxes as the computer
const g1=await p.evaluate(()=>App.db.settings.gmail);
ok('mailboxes, client ID and frequency are published in the synced settings (no token in them)',g1&&g1.accounts.length===3&&g1.accounts.includes('a@example.test')&&g1.t>0&&!/tok-/.test(JSON.stringify(g1)),JSON.stringify(g1));
// ---- reading frequency: 1 / 2 times a day, or only by hand
await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(600);
ok('« Lecture automatique » choice in the e-mail card, 2 times a day by default',await p.evaluate(()=>{const s=document.getElementById('slm_every');return !!s&&s.value==='12'&&[...s.options].length===3}));
await p.evaluate(()=>{const d=document.querySelector('details[data-fold=slmail]');if(d)d.open=true});await p.waitForTimeout(200);
ok('phone layout: the explanation keeps the full width (not squeezed into a column by the select)',await p.evaluate(()=>{const g=document.getElementById('slm_every').closest('.item').querySelector('.grow').getBoundingClientRect();return g.width>200&&g.height<140}));
const pick=async v=>{await p.evaluate(()=>{const d=document.querySelector('details[data-fold=slmail]');if(d)d.open=true});await p.selectOption('#slm_every',v)};
const setLast=async h=>{await p.evaluate(h=>{const k='cispolstore-gmail',c=JSON.parse(localStorage.getItem(k));c.lastCheck=Date.now()-h*3600e3;localStorage.setItem(k,JSON.stringify(c))},h)};
const reopen=async()=>{await p.reload();await p.waitForTimeout(800);await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(3200)};
await pick('0');await p.waitForTimeout(300);
ok('« manual only » is saved on this device and published for the other devices',await p.evaluate(()=>App.db.settings.gmail.every===0&&JSON.parse(localStorage.getItem('cispolstore-gmail')).every===0));
await setLast(100);let c1=calls;await reopen();
ok('manual only: opening Clients reads nothing, even after 100 hours',calls===c1);
await pick('12');await p.waitForTimeout(300);await setLast(3);c1=calls;await reopen();
ok('2 times a day: 3 hours after the last reading, nothing is read',calls===c1);
await setLast(13);c1=calls;await reopen();
ok('2 times a day: 13 hours after the last reading, opening Clients reads',calls>c1);
await pick('24');await p.waitForTimeout(300);await setLast(13);c1=calls;await reopen();
ok('1 time a day: 13 hours after, nothing is read; 25 hours after, it reads',calls===c1&&await (async()=>{await setLast(25);const c2=calls;await reopen();return calls>c2})());
// ---- a second device: it adopts the mailboxes published by the first one; a removal travels too
await p.evaluate(()=>{localStorage.setItem('cispolstore-gmail',JSON.stringify({accounts:[]}));App.db.settings.gmail={t:Date.now()+5000,clientId:'123-test.apps.googleusercontent.com',every:0,accounts:['a@example.test','b@example.test','c@example.test','d@example.test']};App.save()});
await p.reload();await p.waitForTimeout(800);await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(800);
const dv=await p.evaluate(()=>JSON.parse(localStorage.getItem('cispolstore-gmail')));
ok('a device with no mailbox adopts the 4 published ones, the Google client ID and the chosen frequency',dv.accounts.map(a=>a.email).join()==='a@example.test,b@example.test,c@example.test,d@example.test'&&dv.every===0&&dv.clientId==='123-test.apps.googleusercontent.com',JSON.stringify(dv));
ok('the adopted mailboxes are listed in the e-mail card',/d@example\.test/.test(await p.evaluate(()=>document.getElementById('view').textContent)));
await p.evaluate(()=>{App.db.settings.gmail={t:Date.now()+9000,clientId:'123-test.apps.googleusercontent.com',every:12,accounts:['a@example.test','b@example.test','c@example.test']};App.save()});
await p.reload();await p.waitForTimeout(800);await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(800);
ok('a mailbox removed on the other device disappears here too',await p.evaluate(()=>JSON.parse(localStorage.getItem('cispolstore-gmail')).accounts.length)===3);
// ---- one mailbox needs a new Google sign-in on this device (window blocked): the others are read, that one gets its own « Reconnecter » button
await p.evaluate(()=>{window.__fail=['c@example.test'];App.go('clients')});await p.waitForTimeout(500);
await p.evaluate(()=>document.querySelector('details[data-fold=slmail]').open=true);
await p.evaluate(()=>App.slmail.check(true));await p.waitForTimeout(1500);
const rc=await p.evaluate(()=>({btn:[...document.querySelectorAll('[data-act=slm_reconnect]')].map(b=>b.dataset.v),txt:document.getElementById('view').textContent,errs:JSON.parse(localStorage.getItem('cispolstore-gmail')).accounts.map(a=>a.err||'')}));
ok('a mailbox that cannot sign in here is flagged, the others are fine',rc.errs.join()===',,reconnect',rc.errs.join());
ok('only that mailbox gets a « Reconnecter » button, with an explanation that does not point to « Vérifier maintenant »',rc.btn.join()==='2'&&/touchez « Reconnecter »/.test(rc.txt));
await p.evaluate(()=>{window.__fail=[]});
await p.click('[data-act=slm_reconnect]');await p.waitForTimeout(1500);
ok('« Reconnecter » signs in (window opened straight from the tap) and the mailbox is read again',await p.evaluate(()=>JSON.parse(localStorage.getItem('cispolstore-gmail')).accounts.every(a=>!a.err)&&document.querySelectorAll('[data-act=slm_reconnect]').length===0));
// ---- a device that cannot sign in to a mailbox leaves it to the other devices (their alerts arrive through the sync)
await p.reload();await p.waitForTimeout(800);
await p.evaluate(()=>{window.__fail=['c@example.test'];App.go('clients')});await p.waitForTimeout(500);
await p.evaluate(()=>{const d=document.querySelector('details[data-fold=slmail]');if(d)d.open=true});
await p.evaluate(()=>App.slmail.check(true));await p.waitForTimeout(1500);
ok('mailbox c fails here again: « Reconnecter » and « Ne pas lire ici » are offered',await p.evaluate(()=>document.querySelectorAll('[data-act=slm_reconnect]').length===1&&document.querySelectorAll('[data-act=slm_skip]').length===1));
await p.click('[data-act=slm_skip]');await p.waitForTimeout(500);
const sk=await p.evaluate(()=>({acc:JSON.parse(localStorage.getItem('cispolstore-gmail')).accounts.map(a=>(a.skip?'S':'-')+(a.err?'E':'-')).join(),shared:App.db.settings.gmail.accounts.length,txt:document.getElementById('view').textContent,head:document.querySelector('details[data-fold=slmail] summary').textContent}));
ok('« Ne pas lire ici »: kept on this device only, the shared list is untouched, the warning is gone',sk.acc==='--,--,S-'&&sk.shared===3&&/Lue par vos autres appareils/.test(sk.txt)&&!/reconnexion nécessaire/i.test(sk.head),JSON.stringify([sk.acc,sk.shared,sk.head]));
await p.evaluate(()=>App.slmail.check(true));await p.waitForTimeout(1500);
ok('the next readings skip that mailbox without any error',await p.evaluate(()=>App.slmail.error==='')&&await p.evaluate(()=>JSON.parse(localStorage.getItem('cispolstore-gmail')).accounts.every(a=>!a.err)));
await p.evaluate(()=>{window.__fail=[]});await p.click('[data-act=slm_skip]');await p.waitForTimeout(400);
await p.evaluate(()=>App.slmail.check(true));await p.waitForTimeout(1500);
ok('« Lire ici » puts the mailbox back: it is read again here',await p.evaluate(()=>JSON.parse(localStorage.getItem('cispolstore-gmail')).accounts.every(a=>!a.skip&&!a.err)));
// ---- Gmail slows the reading down (quota): retry, keep the progress, resume
const reset=async()=>{await p.evaluate(()=>{App.db.slmail=[];App.db.clients.forEach(c=>{delete c.slm;delete c.slp});const k='cispolstore-gmail',c=JSON.parse(localStorage.getItem(k));c.accounts.forEach(a=>{delete a.last;delete a.seen;delete a.err});c.lastCheck=Date.now();localStorage.setItem(k,JSON.stringify(c));App.save()});await p.reload();await p.waitForTimeout(1000);await p.evaluate(()=>{App.slmail.delay=()=>Promise.resolve();App.slmail.pace=0})};
await reset();qmode='some';qLeft=3;await p.evaluate(()=>App.slmail.check(true));await p.waitForTimeout(1500);
ok('Gmail asks to slow down: the reading retries and still reads everything',await p.evaluate(()=>App.db.slmail.length)===n0&&await p.evaluate(()=>JSON.parse(localStorage.getItem('cispolstore-gmail')).accounts.every(a=>!a.err)),String(await p.evaluate(()=>App.db.slmail.length))+'/'+n0);
await reset();qmode='all';await p.evaluate(()=>App.slmail.check(true));await p.waitForTimeout(1500);
const q=await p.evaluate(()=>({n:App.db.slmail.length,errs:JSON.parse(localStorage.getItem('cispolstore-gmail')).accounts.map(a=>a.err||'')}));
ok('quota never lifts: no crash, clear message, nothing lost',q.n<n0&&q.errs.every(e=>/limite le débit/.test(e)),JSON.stringify(q));
qmode='';await p.evaluate(()=>App.slmail.check(true));await p.waitForTimeout(1500);
ok('next reading resumes and completes',await p.evaluate(()=>App.db.slmail.length)===n0&&await p.evaluate(()=>JSON.parse(localStorage.getItem('cispolstore-gmail')).accounts.every(a=>!a.err)));
// ---- remove a mailbox
await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(400);await p.evaluate(()=>document.querySelector('[data-fold=slmail]').setAttribute('open',''));
await p.click('[data-act=slm_remove][data-v="1"]');await p.waitForTimeout(300);
ok('mailbox removed, alerts kept',await p.evaluate(()=>JSON.parse(localStorage.getItem('cispolstore-gmail')).accounts.length)===2&&await p.evaluate(()=>App.db.slmail.length)>0);
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
