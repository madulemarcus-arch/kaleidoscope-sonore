const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
// Fictitious data only: the repository is public.
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{window.__u='';window.open=u=>{window.__u=u};window.__shared=[];
  App.db.clients.push({id:'cr1',code:'CL-R1',type:'mat',first:'Marie',last:'Exemple',name:'Marie Exemple',phone:'0810000001',created:App.today(),subs:[]});
  const i1=App.createInvoice({type:'materiel',clientId:'cr1',currency:'USD',payMode:'Cash',lines:[{desc:'Routeur',qty:1,price:100,cost:0}]},0);window.__i1=i1.id;
  // an old payment (recorded before this feature): never flagged
  App.db.payments.push({id:'old1',date:App.today(),clientId:'cr1',invoiceId:'',amount:5,currency:'USD',rate:2400,mode:'Cash',ref:'',comment:''});
  App.save();App.paymentForm({invoiceId:i1.id})});await p.waitForTimeout(400);
await p.evaluate(()=>{document.getElementById('f_amt').value=40});await p.click('#dok');await p.waitForTimeout(700);
const dlg=await p.innerText('dialog');
ok('right after the payment, a big window asks to send the receipt (amount, client, invoice, number)',/Paiement enregistré/.test(dlg)&&/Envoyez le reçu au client/.test(dlg)&&/Marie Exemple/.test(dlg)&&/40,00 \$|\$40|40/.test(dlg)&&/FAC-\d{4}-\d{4}/.test(dlg)&&/-P1/.test(dlg),dlg.slice(0,300));
ok('three ways to send it: PDF, WhatsApp message, print',/Envoyer le reçu \(PDF\)/.test(dlg)&&/Message WhatsApp/.test(dlg)&&/Imprimer le reçu/.test(dlg));
ok('the payment is flagged « à envoyer »',await p.evaluate(()=>App.rcptTodo().length===1&&App.rcptTodo()[0].amount===40));
await p.evaluate(()=>App.close());await p.waitForTimeout(200);
await p.evaluate(()=>App.go('home'));await p.waitForTimeout(700);
ok('dashboard: a red « 1 reçu à envoyer aux clients » card',/1 reçu à envoyer aux clients/.test(await p.innerText('#view')));
await p.click('[data-act=rcpt_go]');await p.waitForTimeout(500);
ok('the card opens the invoice list on « Reçus à envoyer », showing the invoice with its red pill',/Reçus à envoyer \(1\)/.test(await p.innerText('#view'))&&/Reçu à envoyer/.test(await p.innerText('#ilist'))&&(await p.$$('#ilist .item')).length===1);
await p.evaluate(()=>App.go('invoice',{id:window.__i1}));await p.waitForTimeout(500);
const v=await p.innerText('#view');
ok('invoice screen: big banner « Reçu à envoyer au client » and « Reçu à envoyer » on the payment line',/Reçu à envoyer au client/.test(v)&&(v.match(/Reçu à envoyer/g)||[]).length>=2,v.slice(0,200));
await p.evaluate(()=>App.go('payments'));await p.waitForTimeout(400);
const pv=await p.innerText('#view');
ok('payments screen: the new payment is flagged, the old one is not',(pv.match(/Reçu à envoyer/g)||[]).length===1&&!/Reçu envoyé/.test(pv));
// WhatsApp message marks it as sent
await p.evaluate(()=>App.go('invoice',{id:window.__i1}));await p.waitForTimeout(400);
await p.click('.card [data-act=recwa]');await p.waitForTimeout(400);
const u=decodeURIComponent(await p.evaluate(()=>window.__u));
ok('WhatsApp message to the client: payment, invoice, receipt number, balance',/wa\.me/.test(u)&&/Marie/.test(u)&&/40/.test(u)&&/Reçu n°/.test(u)&&/Reste à payer/.test(u),u.slice(0,250));
ok('after sending: no more alert, the line says « Reçu envoyé »',await p.evaluate(()=>App.rcptTodo().length===0&&App.db.payments.filter(x=>x.rcpt==='sent').length===1)&&!/Reçu à envoyer au client/.test(await p.innerText('#view'))&&/Reçu envoyé/.test(await p.innerText('#view')));
await p.evaluate(()=>App.go('home'));await p.waitForTimeout(600);
ok('dashboard card is gone',!/reçu à envoyer aux clients/.test(await p.innerText('#view')));
// second payment: sharing the PDF counts too; « pas de reçu » dismisses
await p.evaluate(()=>{App.sharePdf=async()=>{window.__shared.push(1)};App.paymentForm({invoiceId:window.__i1})});await p.waitForTimeout(400);
await p.evaluate(()=>{document.getElementById('f_amt').value=10});await p.click('#dok');await p.waitForTimeout(600);
await p.click('dialog [data-act=recshare]');await p.waitForTimeout(500);
ok('« Envoyer le reçu (PDF) » marks the receipt as sent',await p.evaluate(()=>App.rcptTodo().length===0&&window.__shared.length===1));
await p.evaluate(()=>{App.close();App.paymentForm({invoiceId:window.__i1})});await p.waitForTimeout(400);
await p.evaluate(()=>{document.getElementById('f_amt').value=5});await p.click('#dok');await p.waitForTimeout(600);await p.evaluate(()=>App.close());
await p.evaluate(()=>App.actions.recskip({id:App.rcptTodo()[0].id}));await p.waitForTimeout(300);
ok('« Pas de reçu » removes the alert without marking it sent',await p.evaluate(()=>App.rcptTodo().length===0&&App.db.payments.some(x=>x.rcpt==='skip')));
ok('a payment recorded with the invoice is flagged too',await p.evaluate(()=>{const i=App.createInvoice({type:'materiel',clientId:'cr1',currency:'USD',payMode:'Cash',lines:[{desc:'Câble',qty:1,price:20,cost:0}]},20);return App.rcptTodo().length===1&&App.rcptTodo()[0].invoiceId===i.id}));
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
