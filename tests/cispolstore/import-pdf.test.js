const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
const { makePdf, invoicePdf } = require('./pdf-fixture');
// Fictitious names and account numbers only: the repository is public.
const A='ACC-DF-20000001-11111-11',B='ACC-DF-20000002-22222-22',C='ACC-DF-20000003-33333-33',D='ACC-DF-20000004-44444-44';
const file=(name,buffer)=>({name,mimeType:'application/pdf',buffer});
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(([B,C])=>{const t=App.today();
  // B: an existing client with a name of his own and a blank file; C: two clients share the same ACC
  App.db.clients.push({id:'ib',code:'CL-B',type:'gere',first:'Bob',last:'Modele',name:'Bob Modele',phone:'0810000002',acc:B,city:'',address:'',installAddr:'',serial:'',plan:'',price:0,created:t,subs:[]});
  App.db.clients.push({id:'ic1',code:'CL-C1',type:'gere',first:'Carl',last:'Un',name:'Carl Un',phone:'0810000003',acc:C,created:t,subs:[]});
  App.db.clients.push({id:'ic2',code:'CL-C2',type:'gere',first:'Carl',last:'Deux',name:'Carl Deux',phone:'0810000004',acc:C,created:t,subs:[]});
  App.save();App.go('clients')},[B,C]);await p.waitForTimeout(500);
ok('Clients: « Importer des factures Starlink (PDF) » button',/Importer des factures Starlink \(PDF\)/.test(await p.innerText('#view')));
const n0=await p.evaluate(()=>App.db.clients.length);
await p.setInputFiles('#sp_file',[
  file('old.pdf',invoicePdf({name:'Alice Exemple',acc:A,from:'lundi 19 septembre 2026',to:'mardi 19 octobre 2026',place:'Ville Ancienne, Province Test',serial:'KITOLD000000001'})),
  file('new.pdf',invoicePdf({name:'Alice Exemple',acc:A,from:'lundi 19 octobre 2026',to:'mercredi 18 novembre 2026'})),
  file('bob.pdf',invoicePdf({name:'Robert Facture',acc:B,place:'Port Test, Province Deux',gps:'5.5,6.6',serial:'KITBOB000000002'})),
  file('carl.pdf',invoicePdf({name:'Carl Facture',acc:C})),
  file('autre.pdf',makePdf(['Relevé de compte','rien de Starlink ici']))]);await p.waitForTimeout(1800);
const dlg=await p.innerText('dialog');
ok('preview: 3 accounts recognised, 1 file not recognised, nothing saved yet',/3 compte\(s\) Starlink reconnu\(s\)/.test(dlg)&&/1 fichier\(s\) non reconnu\(s\)/.test(dlg)&&await p.evaluate(()=>App.db.clients.length)===n0,dlg.slice(0,300));
ok('preview rows: new client, file to complete, shared ACC ignored',/Alice Exemple/.test(dlg)&&/Nouveau client/.test(dlg)&&/Complète la fiche/.test(dlg)&&/fiche « Bob Modele »/.test(dlg)&&/Plusieurs clients : ignoré/.test(dlg));
ok('button « Importer (2) » (the shared ACC is not counted)',/Importer \(2\)/.test(await p.innerText('#dok')));
await p.click('#dok');await p.waitForTimeout(600);
const r=await p.evaluate(([A,B,C])=>{const g=a=>App.db.clients.filter(c=>c.acc===a);const al=g(A)[0],bo=g(B)[0];return{n:App.db.clients.length,al:al&&{name:al.name,first:al.first,last:al.last,city:al.city,gps:al.installAddr,serial:al.serial,plan:al.plan,price:al.price,start:al.start,period:al.period,chk:al.nameCheck,pdf:al.fromPdf,done:al.pdfDone,type:al.type},bo:{name:bo.name,first:bo.first,city:bo.city,addr:bo.address,serial:bo.serial,plan:bo.plan,chk:!!bo.nameCheck,phone:bo.phone},c:g(C).map(c=>c.name+'|'+(c.pdfDone?'x':'-'))}},[A,B,C]);
ok('new client created from the NEWEST invoice of the account (name, locality, GPS, kit serial, plan + catalogue price, period)',r.n===n0+1&&r.al&&r.al.name==='Alice Exemple'&&r.al.first==='Alice'&&r.al.last==='Exemple'&&r.al.city==='Ville Test'&&r.al.gps==='GPS 1.2345,2.3456'&&r.al.serial==='KIT123456789ABC'&&r.al.plan==='Résidentiel'&&r.al.price===70&&r.al.start==='2026-10-19'&&r.al.period===30&&r.al.type==='gere'&&r.al.pdf===true,JSON.stringify(r.al));
ok('the name read is flagged « à valider »',r.al.chk===true);
ok('existing client: blanks filled, his own name and phone untouched',r.bo.name==='Bob Modele'&&r.bo.first==='Bob'&&r.bo.phone==='0810000002'&&r.bo.city==='Port Test'&&r.bo.addr==='Port Test, Province Deux'&&r.bo.serial==='KITBOB000000002'&&r.bo.plan==='Résidentiel'&&r.bo.chk===false,JSON.stringify(r.bo));
ok('the two clients sharing an ACC are left alone',r.c.join()==='Carl Un|-,Carl Deux|-',r.c.join());
// importing the same files again creates nothing new and keeps what was typed
await p.evaluate(()=>{const c=App.db.clients.find(x=>x.name==='Alice Exemple');c.phone='0810000009';c.city='Ville Corrigee';App.save();App.go('clients')});await p.waitForTimeout(400);
await p.setInputFiles('#sp_file',[file('new.pdf',invoicePdf({name:'Alice Exemple',acc:A,from:'lundi 19 octobre 2026',to:'mercredi 18 novembre 2026'}))]);await p.waitForTimeout(1500);
ok('second import of the same account: « Complète la fiche », no duplicate',/Complète la fiche/.test(await p.innerText('dialog'))&&!/Nouveau client/.test(await p.innerText('dialog')));
await p.click('#dok');await p.waitForTimeout(500);
ok('nothing duplicated, what the user typed is kept',await p.evaluate(()=>App.db.clients.filter(c=>c.name==='Alice Exemple').length===1&&App.db.clients.find(c=>c.name==='Alice Exemple').phone==='0810000009'&&App.db.clients.find(c=>c.name==='Alice Exemple').city==='Ville Corrigee'));
// nothing recognised: a message, no window with an import button
await p.evaluate(()=>{App.close();App.go('clients')});await p.waitForTimeout(400);
await p.setInputFiles('#sp_file',[file('rien.pdf',makePdf(['Autre document']))]);await p.waitForTimeout(1200);
const cN=await p.evaluate(()=>App.db.clients.length);
ok('files that are not Starlink invoices: clear message, no window, nothing created',/Aucune facture Starlink reconnue/.test(await p.textContent('#toast'))&&await p.evaluate(()=>!document.querySelector('dialog').open)&&cN===await p.evaluate(()=>App.db.clients.length));
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
