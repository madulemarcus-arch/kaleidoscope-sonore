// Starlink e-mails, « tidy » setting: once a notice has been understood, its e-mail is marked as read and archived in Gmail (never deleted).
// Off by default (read-only scope); on: scope gmail.modify, only the understood Starlink e-mails are touched. Fictitious data only.
const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
const acc=n=>`ACC-DF-100000${n}-${n}${n}${n}${n}${n}-${n}${n}`;
const body={
 echec:(a,amt)=>`Échec de paiement\nVotre paiement a échoué et nécessite votre attention.\n\n  Numéro de compte   ${a}\n\n  Montant du paiement   CDF ${amt}\n\nCe message a été envoyé à l'adresse x@example.test pour le compte ${a}.`,
 suspendu:a=>`Service suspendu\nVotre service Starlink a été suspendu en raison d’un solde impayé relatif au compte ${a}.\n\nVeuillez modifier vos données de facturation.`
};
const T0=Date.parse('2026-10-19T08:00:00Z'),MIN=60e3;
const msg=(id,subject,text,ts,from='Starlink <no-reply@starlink.com>')=>({id,internalDate:String(ts),payload:{mimeType:'multipart/alternative',headers:[{name:'From',value:from},{name:'Subject',value:subject}],parts:[{mimeType:'text/plain',body:{data:Buffer.from(text,'utf8').toString('base64url')}}]}});
const MAIL='a@example.test';
const BOX={[MAIL]:[
  msg('t3','Newsletter','Rien à voir',T0+3*MIN,'Autre <news@example.test>'),
  msg('t2','Promotion Starlink','Bonne affaire !',T0+2*MIN),
  msg('t1','Échec du paiement Starlink',body.echec(acc(1),'10 000,00'),T0+MIN)]};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
const modified=[];let deny=false,deleteCalls=0;
await ctx.route('https://gmail.googleapis.com/**',async r=>{const u=new URL(r.request().url()),who=(r.request().headers().authorization||'').replace('Bearer tok-',''),box=BOX[who];
 const json=o=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(o)});
 if(!box)return r.fulfill({status:401,body:'{}'});
 if(r.request().method()==='DELETE'||/\/trash$|\/batchDelete$/.test(u.pathname)){deleteCalls++;return json({})}
 if(u.pathname.endsWith('/modify')){modified.push({id:u.pathname.split('/').slice(-2)[0],body:JSON.parse(r.request().postData()||'{}'),method:r.request().method()});
  if(deny)return r.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:{code:403,message:'Request had insufficient authentication scopes.',errors:[{reason:'insufficientPermissions'}]}})});
  return json({id:u.pathname.split('/').slice(-2)[0]})}
 if(u.pathname.endsWith('/profile'))return json({emailAddress:who});
 if(u.pathname.endsWith('/messages'))return json({messages:box.map(m=>({id:m.id}))});
 const id=u.pathname.split('/').pop();return json(box.find(m=>m.id===id))});
await p.addInitScript(()=>{window.__scopes=[];window.google={accounts:{oauth2:{initTokenClient:c=>({requestAccessToken:()=>setTimeout(()=>{window.__scopes.push(c.scope);c.callback({access_token:'tok-'+(c.login_hint||'a@example.test'),expires_in:3600})},5)}),revoke:()=>{}}}}});
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(m=>localStorage.setItem('cispolstore-gmail',JSON.stringify({clientId:'123456789-test.apps.googleusercontent.com',accounts:[{email:m}]})),MAIL);
await p.reload();await p.waitForTimeout(600);await p.click('[data-lk=skip]',{timeout:1500}).catch(()=>{});
const cfg=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('cispolstore-gmail')));
const scopes=()=>p.evaluate(()=>window.__scopes.slice());
const check=async()=>{await p.evaluate(()=>App.slmail.check(true));await p.waitForTimeout(900)};
const openCard=async()=>{await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(500);await p.evaluate(()=>document.querySelector('[data-fold=slmail]').setAttribute('open',''))};
// ---- default: read-only, nothing touched in Gmail
await check();
ok('default: the notice is read',await p.evaluate(()=>App.db.slmail.length)===1);
ok('default: read-only scope, no change made in Gmail',modified.length===0&&(await scopes()).every(s=>/gmail\.readonly$/.test(s))&&(await scopes()).length>0,JSON.stringify(await scopes()));
await openCard();
ok('the card offers the setting, « Ne rien changer » by default',await p.isVisible('#slm_tidy')&&await p.inputValue('#slm_tidy')==='0');
ok('the card says the e-mail is archived, never deleted',/jamais supprimé/.test(await p.innerText('#view')));
// ---- turn it on: Google must be asked again with the wider scope
BOX[MAIL].unshift(msg('t4','Service Starlink suspendu',body.suspendu(acc(2)),T0+10*MIN),msg('t5','Échec du paiement Starlink',body.echec(acc(3),'20 000,00'),T0+11*MIN),
  msg('t0','Urgent : payez votre facture maintenant pour éviter une suspension','Pour le compte '+acc(8)+' : texte d\'un type que l\'application ne connaît pas.',T0+12*MIN)); // an unknown type of notice, with an account number
await p.selectOption('#slm_tidy','1');await p.waitForTimeout(400);
ok('setting saved (and shared with the other devices)',(await cfg()).tidy===true&&await p.evaluate(()=>App.db.settings.gmail.tidy)===true);
ok('the mailbox asks to be reconnected, to grant the new permission',await p.isVisible('[data-act=slm_reconnect]'));
await p.click('[data-act=slm_reconnect]');await p.waitForTimeout(1500);
const sc=await scopes();
ok('Google is asked for gmail.modify once the setting is on',/gmail\.modify$/.test(sc[sc.length-1]),sc.join(' | '));
ok('the two new notices and the unknown one are read (the unknown one is shown as « non reconnu »)',await p.evaluate(()=>App.db.slmail.length)===4&&await p.evaluate(()=>App.db.slmail.filter(e=>!e.kind).length)===1);
ok('they are marked as read and archived (UNREAD and INBOX removed), and only they',JSON.stringify(modified.map(m=>m.id).sort())==='["t4","t5"]'&&modified.every(m=>m.method==='POST'&&JSON.stringify(m.body.removeLabelIds)==='["UNREAD","INBOX"]'&&!m.body.addLabelIds),JSON.stringify(modified));
ok('the promotion, the other sender and the notice of an UNKNOWN type are left in the inbox; nothing is ever deleted or trashed',!modified.some(m=>['t0','t2','t3'].includes(m.id))&&deleteCalls===0);
ok('no warning on the card when the permission is granted',!(await cfg()).accounts[0].tidyErr);
// ---- Google refuses the modification (scope missing in the console): the reading goes on, a warning explains what to do, no retry storm
deny=true;modified.length=0;
BOX[MAIL].unshift(msg('t6','Échec du paiement Starlink',body.echec(acc(4),'30 000,00'),T0+20*MIN),msg('t7','Service Starlink suspendu',body.suspendu(acc(5)),T0+21*MIN));
await check();
ok('refused modification: the notices are still read',await p.evaluate(()=>App.db.slmail.length)===6);
ok('only one attempt is made, then it stops for this reading',modified.length===1,String(modified.length));
await openCard();
ok('the card explains how to fix it (gmail.modify in the Google console, then Reconnecter)',/gmail\.modify/.test(await p.innerText('#view'))&&/Reconnecter/.test(await p.innerText('#view')));
ok('the account is not shown in error because of it',!(await cfg()).accounts[0].err);
// ---- permission granted again: warning cleared, tidy resumes
deny=false;modified.length=0;
BOX[MAIL].unshift(msg('t8','Échec du paiement Starlink',body.echec(acc(6),'40 000,00'),T0+30*MIN));
await check();
ok('permission back: the new notice is tidied and the warning disappears',JSON.stringify(modified.map(m=>m.id))==='["t8"]'&&!(await cfg()).accounts[0].tidyErr,JSON.stringify(modified));
// ---- turn it off: read-only again
await openCard();await p.selectOption('#slm_tidy','0');await p.waitForTimeout(300);
ok('turned off: saved, warning gone',(await cfg()).tidy===false&&!(await cfg()).accounts[0].tidyErr);
modified.length=0;BOX[MAIL].unshift(msg('t9','Échec du paiement Starlink',body.echec(acc(7),'50 000,00'),T0+40*MIN));
await check();
const sc2=await scopes();
ok('turned off: back to the read-only scope and nothing is changed in Gmail',/gmail\.readonly$/.test(sc2[sc2.length-1])&&modified.length===0&&await p.evaluate(()=>App.db.slmail.length)===8,sc2.join(' | ')+' '+modified.length);
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
