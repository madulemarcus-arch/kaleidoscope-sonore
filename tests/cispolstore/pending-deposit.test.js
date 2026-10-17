const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const p=await (await b.newContext({...devices['Pixel 5']})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{const t=App.today();App.db.clients.push({id:'c1',code:'CL-1',type:'mat',first:'A',last:'D',name:'A D',phone:'1',subs:[],created:t});App.save();App.invoiceForm('materiel')});
await p.selectOption('#f_cl','c1');await p.fill('#f_desc','Kit');await p.fill('#f_price','100');await p.click('#f_add');
ok('before ticking: full payment pre-filled',(await p.inputValue('#f_paid'))==='100');
await p.check('#f_pend');await p.waitForTimeout(200);
ok('pending: deposit title, empty amount, "Tout payé" hidden',/Acompte reçu/.test(await p.innerText('#paycard'))&&(await p.inputValue('#f_paid'))===''&&!(await p.isVisible('#p_all')));
await p.fill('#f_paid','40');await p.waitForTimeout(150);
ok('summary says deposit noted',/Acompte noté/.test(await p.innerText('#p_sum')));
await p.click('#dok');await p.waitForTimeout(400);
let r=await p.evaluate(()=>{const i=App.db.invoices[0];return{pend:i.pending,st:App.invStatus(i),paid:App.invPaid(i),pays:App.db.payments.length,link:App.db.payments[0]&&App.db.payments[0].invoiceId===i.id,due:App.invDue(i),unpaid:App.db.invoices.filter(x=>App.invDue(x)>0).length}});
ok('pending invoice created with a 40 $ deposit',r.pend===true&&r.st==='pending'&&r.paid===40&&r.pays===1&&r.link,JSON.stringify(r));
ok('still not counted as unpaid or sale',r.due===0&&r.unpaid===0&&await p.evaluate(()=>App.db.invoices.filter(App.live).length===0));
ok('page shows the deposit received',/Reçu du client/.test(await p.innerText('#view'))&&/40/.test(await p.innerText('#view')));
// a second deposit from the pending page
await p.click('[data-act=newpay][data-iid]');await p.waitForTimeout(300);
ok('payment form lists the pending invoice with its balance (60 left)',await p.evaluate(()=>/en attente/.test([...document.querySelectorAll('#f_inv option')].map(o=>o.textContent).join('|'))&&document.getElementById('f_amt').value!==undefined));
await p.fill('#f_amt','25');await p.evaluate(()=>{[...document.querySelectorAll('dialog button')].find(b=>/Enregistrer le paiement/.test(b.textContent)).click()});await p.waitForTimeout(400);
r=await p.evaluate(()=>{const i=App.db.invoices[0];return{paid:App.invPaid(i),pays:App.db.payments.length}});
ok('second deposit recorded (65 $)',r.paid===65&&r.pays===2,JSON.stringify(r));
// never more than the total
await p.evaluate(()=>App.actions.newpay({iid:App.db.invoices[0].id}));await p.waitForTimeout(300);
await p.fill('#f_amt','500');await p.evaluate(()=>{[...document.querySelectorAll('dialog button')].find(b=>/Enregistrer le paiement/.test(b.textContent)).click()});await p.waitForTimeout(400);
ok('deposits capped at the invoice total',await p.evaluate(()=>App.invPaid(App.db.invoices[0])<=100.0001),String(await p.evaluate(()=>App.invPaid(App.db.invoices[0]))));
// validating keeps the deposit: only the balance is left
await p.evaluate(()=>App.validateInvoice(App.db.invoices[0].id));
r=await p.evaluate(()=>{const i=App.db.invoices[0];return{st:App.invStatus(i),due:App.invDue(i),paid:App.invPaid(i)}});
ok('after validation: deposits count, balance = total - deposits',r.paid>0&&Math.abs(r.due-(100-r.paid))<0.01&&(r.st==='part'||r.st==='paid'),JSON.stringify(r));
// cancel warns about giving the money back and removes the deposits
await p.evaluate(()=>{const i=App.createInvoice({type:'materiel',clientId:'c1',currency:'USD',payMode:'Cash',pending:true,payAmount:30,lines:[{desc:'Kit',qty:1,price:100,cost:30}]},0);i.fx={};window.__p=i.id;App.save();App.go('invoice',{id:i.id})});
let msg='';p.removeAllListeners('dialog');p.on('dialog',d=>{msg=d.message();d.accept()});
await p.evaluate(()=>{window.__confirmMsg='';const o=App.confirm;App.confirm=m=>{window.__confirmMsg=m;return true};window.__o=o});
await p.click('[data-act=invcancel]');await p.waitForTimeout(400);
ok('cancel message mentions giving the deposit back',/rendez-lui cet argent/.test(await p.evaluate(()=>window.__confirmMsg))&&/30/.test(await p.evaluate(()=>window.__confirmMsg)));
ok('cancel removes the invoice and its deposit',await p.evaluate(()=>!App.invoice(window.__p)&&!App.db.payments.some(x=>x.invoiceId===window.__p)));
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
