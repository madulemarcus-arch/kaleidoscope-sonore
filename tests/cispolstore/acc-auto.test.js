const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
// Automatic link of an unknown ACC (read in a Starlink e-mail) to the client it belongs to, from the attached invoice. Fictitious data only: the repository is public.
const A1='ACC-DF-20000001-11111-11',A2='ACC-DF-20000002-22222-22',A3='ACC-DF-20000003-33333-33',A4='ACC-DF-20000004-44444-44',A5='ACC-DF-20000005-55555-55';
const { invoicePdf } = require('./pdf-fixture');
const T0=Date.parse('2026-10-19T08:00:00Z'),MIN=60e3;
const PDFS={
 att1:invoicePdf({name:'Nadia Bamba',acc:A1,serial:'KIT0000000000AA1'}),
 att2:invoicePdf({name:'Quelqu Un Autre',acc:A2,serial:'KIT7777777777ZZ9'}),
 att3:invoicePdf({name:'Lea Dupont',acc:A3,serial:'KIT0000000000AA3'}),
 att4:invoicePdf({name:'Mukendi Dieudonne Pierre',acc:A4,serial:'KIT0000000000AA4'})};
const echec=a=>`Échec de paiement\nVotre paiement a échoué.\n\n  Numéro de compte   ${a}\n\n  Montant du paiement   CDF 50 000,00\n\nCe message a été envoyé à l'adresse x@example.test pour le compte ${a}.`;
const msg=(id,text,ts,att)=>{const m={id,internalDate:String(ts),payload:{mimeType:'multipart/mixed',headers:[{name:'From',value:'Starlink <no-reply@starlink.com>'},{name:'Subject',value:'Échec du paiement Starlink'}],parts:[{mimeType:'text/plain',body:{data:Buffer.from(text,'utf8').toString('base64url')}}]}};
 if(att)m.payload.parts.push({filename:'INV-DF-COD-000001-00001-01.pdf',mimeType:'application/pdf',body:{attachmentId:att,size:PDFS[att].length}});return m};
const BOX={'a@example.test':[msg('m1',echec(A1),T0,'att1'),msg('m2',echec(A2),T0+MIN,'att2'),msg('m3',echec(A3),T0+2*MIN,'att3'),msg('m4',echec(A4),T0+3*MIN,'att4'),msg('m5',echec(A5),T0+4*MIN,null)]};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
let reads=0;
await ctx.route('https://gmail.googleapis.com/**',async r=>{const u=new URL(r.request().url()),box=BOX[(r.request().headers().authorization||'').replace('Bearer tok-','')];
 const json=o=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(o)});
 if(!box)return r.fulfill({status:401,body:'{}'});
 if(u.pathname.endsWith('/profile'))return json({emailAddress:'a@example.test'});
 if(u.pathname.endsWith('/messages'))return json({messages:box.map(m=>({id:m.id}))});
 const at=/\/attachments\/(att\d)$/.exec(u.pathname);if(at){reads++;return json({data:PDFS[at[1]].toString('base64').replace(/\+/g,'-').replace(/\//g,'_')})}
 return json(box.find(m=>m.id===u.pathname.split('/').pop()))});
await p.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:c=>({requestAccessToken:()=>setTimeout(()=>c.callback({access_token:'tok-'+(c.login_hint||'a@example.test'),expires_in:3600}),5)}),revoke:()=>{}}}}});
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{App.db.clients.push(
 {id:'c1',type:'gere',first:'Bamba',last:'Nadia',name:'Bamba Nadia',phone:'0810000001',code:'CL-1'},                       // same words, other order
 {id:'c2',type:'gere',first:'Tom',last:'Kasa',name:'Tom Kasa',phone:'0810000002',code:'CL-2',serial:'KIT7777777777ZZ9'}, // known by the kit serial only
 {id:'c3',type:'gere',first:'Lea',last:'Dupont',name:'Lea Dupont',phone:'0810000003',code:'CL-3'},
 {id:'c4',type:'gere',first:'Lea',last:'Dupont',name:'Lea Dupont',phone:'0810000004',code:'CL-4'},                          // homonym: ambiguous
 {id:'c5',type:'gere',first:'Dieudonné',last:'Mukendi',name:'Dieudonné Mukendi',phone:'0810000005',code:'CL-5'},          // close name only
 {id:'c6',type:'gere',first:'Déjà',last:'Lié',name:'Déjà Lié',phone:'0810000006',code:'CL-6',acc:'ACC-DF-20000099-99999-99'});App.save()});
await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(500);
await p.evaluate(()=>document.querySelector('[data-fold=slmail]').setAttribute('open',''));
await p.click('[data-act=slm_setup]');await p.waitForTimeout(300);await p.fill('#slm_cid','123456789-test.apps.googleusercontent.com');await p.click('#dlg .btn:not(.sec):not(.del)');await p.waitForTimeout(400);
await p.click('[data-act=slm_add]');await p.waitForTimeout(300);await p.fill('#slm_email','a@example.test');await p.click('#dok');await p.waitForTimeout(3500);
const S=await p.evaluate(()=>{const g=i=>App.client(i);return{c1:g('c1').acc,c2:g('c2').acc,c3:g('c3').acc,c4:g('c4').acc,c5:g('c5').acc,h1:g('c1').accAuto&&g('c1').accAuto.how,h2:g('c2').accAuto&&g('c2').accAuto.how,st1:(g('c1').slm||{}).state,unk:App.slmail.unknown().map(o=>o.acc),sug:App.slmail.unknown().map(o=>[o.acc,(o.events.map(e=>e.sug).find(Boolean)||{}).id||''].join('>')),log:App.db.slmail.map(e=>[e.id,e.res].join('|'))}});
ok('same full name (word order and case ignored), one client: linked at once',S.c1===A1&&S.h1==='nom identique',JSON.stringify(S));
ok('kit serial of the invoice found on one client whose name differs: linked at once',S.c2===A2&&S.h2==='numéro de série du kit');
ok('the waiting e-mail is applied to the client right away (payment failed)',S.st1==='echec'&&S.log.includes('a@example.test:m1|ok'),S.log.join(' '));
ok('two clients with the same name: nothing linked (stays to check)',!S.c3&&!S.c4&&S.unk.includes(A3));
ok('close name only: not linked, offered as a suggestion',!S.c5&&S.sug.includes(A4+'>c5'),JSON.stringify(S.sug));
ok('e-mail without invoice: nothing linked, no error',S.unk.includes(A5)&&S.unk.length===3,JSON.stringify(S.unk));
ok('a client that already has an ACC is never touched',await p.evaluate(()=>App.client('c6').acc)==='ACC-DF-20000099-99999-99');
// ---- screens
await p.evaluate(()=>App.go('slmail'));await p.waitForTimeout(500);await p.click('[data-act=slm_tab][data-v=todo]');await p.waitForTimeout(300);
let txt=await p.innerText('#view');
ok('À vérifier: the automatic links are listed with how they were recognised, and can be confirmed or undone',/lié automatiquement|Lien automatique|reconnu par/i.test(txt)&&/nom identique/.test(txt)&&/numéro de série/.test(txt)&&!!(await p.$('[data-act=slm_ok]'))&&!!(await p.$('[data-act=slm_unlink]')),txt.slice(0,400));
ok('the invoice name and the suggestion appear on the unknown ACC',/Mukendi Dieudonne Pierre/.test(txt)&&/C'est peut-être/.test(txt)&&!!(await p.$('[data-act=slm_sug]')));
// ---- confirm one, undo the other
await p.click('[data-act=slm_ok][data-id=c1]');await p.waitForTimeout(300);
ok('« C\'est bon » confirms: the link stays and leaves the list',await p.evaluate(()=>App.client('c1').acc)===A1&&await p.evaluate(()=>App.slmail.autoLinked().map(c=>c.id).join())==='c2');
await p.click('[data-act=slm_unlink][data-id=c2]');await p.waitForTimeout(400);
const U=await p.evaluate(A2=>({acc:App.client('c2').acc||'',auto:!!App.client('c2').accAuto,st:(App.client('c2').slm||{}).state||'',unk:App.slmail.unknown().some(o=>o.acc===A2)}),A2);
ok('undo: the client has no ACC again, its e-mail state is restored, the ACC is back in the list',!U.acc&&!U.auto&&!U.st&&U.unk,JSON.stringify(U));
await p.evaluate(()=>App.slmail.check(true));await p.waitForTimeout(2500);
ok('after an undo the same ACC is not linked again automatically',!(await p.evaluate(()=>App.client('c2').acc)));
// ---- accept the suggestion
await p.evaluate(()=>App.go('slmail'));await p.waitForTimeout(400);await p.click('[data-act=slm_tab][data-v=todo]');await p.waitForTimeout(300);
await p.click('[data-act=slm_sug]');await p.waitForTimeout(500);
ok('« Lier à … » on a suggestion links that client and applies the e-mail',await p.evaluate(()=>App.client('c5').acc)===A4&&await p.evaluate(()=>(App.client('c5').slm||{}).state)==='echec');
// ---- no invoice is read twice
const r0=reads;await p.evaluate(()=>App.slmail.check(true));await p.waitForTimeout(2000);
ok('invoices are not downloaded again at every check',reads===r0,reads+' vs '+r0);
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
