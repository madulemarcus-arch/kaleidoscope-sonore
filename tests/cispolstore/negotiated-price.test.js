const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');
let f=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const p=await (await b.newContext({...devices['Pixel 5']})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{document.addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{const d=document.querySelector('dialog');if(d&&d.open&&/Envoyez le reçu au client/.test(d.textContent))d.close()}).observe(document,{subtree:true,childList:true,attributes:true,characterData:true}))}); // these tests are not about the receipt window: close it as soon as it opens
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{const t=App.today();App.db.clients.push({id:'c1',code:'CL-1',type:'mat',first:'Awa',last:'Diop',name:'Awa Diop',phone:'1',subs:[],created:t});App.save();App.invoiceForm('materiel')});
await p.selectOption('#f_cl','c1');await p.fill('#f_desc','Kit');await p.fill('#f_price','100');await p.click('#f_add');
ok('neg hidden when full',!(await p.isVisible('#f_neg')));
await p.fill('#f_paid','80');ok('neg visible when less',await p.isVisible('#f_neg'));await p.check('#f_neg');ok('stays checked',await p.isChecked('#f_neg'));
await p.click('#dok');await p.waitForTimeout(300);
const r=await p.evaluate(()=>{const i=App.db.invoices[0];return{ag:i.agreed,due:App.invDue(i),st:App.invStatus(i),tot:App.invTotal(i),doc:App.invoiceDoc(i)}});
ok('agreed 80, due 0, paid status',r.ag===80&&r.due===0&&r.st==='paid');ok('printed total stays 100',/100,00 \$|100 \$|\$100/.test(r.doc.replace(/ | /g,' '))&&!/PAIEMENTS|Reste|Solde|Montant payé/.test(r.doc));
ok('report revenue uses 80',await p.evaluate(()=>App.usd(App.invAgreed(App.db.invoices[0]),'USD',App.db.invoices[0])===80));
// old invoice via payment form
await p.evaluate(()=>{const i=App.createInvoice({type:'materiel',clientId:'c1',currency:'USD',payMode:'Cash',lines:[{pid:'',desc:'Y',qty:1,price:200,cost:0}]},0);window.__i=i.id;App.save();App.go('invoice',{id:i.id})});
await p.click('[data-act=newpay]');await p.fill('#f_amt','150');ok('neg offered',await p.isVisible('#f_neg'));await p.check('#f_neg');await p.click('#dok');await p.waitForTimeout(300);
ok('old invoice settled at 150',await p.evaluate(()=>{const i=App.invoice(window.__i);return i.agreed===150&&App.invDue(i)===0&&App.invTotal(i)===200}));
console.log(errs);await b.close();process.exit(f?1:0)})();
