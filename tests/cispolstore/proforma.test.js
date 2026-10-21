const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
// Fictitious data only: the repository is public.
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{const t=App.today();App.db.clients.push({id:'cx1',code:'CL-X1',type:'mat',first:'Marie',last:'Exemple',name:'Marie Exemple',phone:'0810000001',created:t,subs:[]});
  App.db.products.push({id:'p1',name:'Routeur',cat:'Routeurs',price:40,cost:25,qty:10,min:2,ref:'RX'});App.save();App.go('invoices')});await p.waitForTimeout(400);
ok('Factures: « Nouveau pro forma » button',/Nouveau pro forma/.test(await p.innerText('#view')));
await p.click('[data-act=newpro]');await p.waitForTimeout(300);
ok('the type choice says it is for a pro forma',/Pro forma : choisissez le type/.test(await p.innerText('dialog')));
await p.click('[data-act=invtype][data-t=materiel]');await p.waitForTimeout(400);
ok('the form opens with « Pro forma » ticked, payment hidden and the button renamed',await p.evaluate(()=>document.getElementById('f_pf').checked&&document.getElementById('paycard').hidden&&document.getElementById('dok').textContent==='Créer le pro forma'));
await p.evaluate(()=>{const s=document.getElementById('f_cl');s.value='cx1';s.dispatchEvent(new Event('change'));const pr=document.getElementById('f_prod');pr.value='p1';pr.dispatchEvent(new Event('change'));document.getElementById('f_qty').value=2;document.getElementById('f_add').click()});await p.waitForTimeout(200);
await p.click('#dok');await p.waitForTimeout(700);
const a=await p.evaluate(()=>({pf:App.db.proformas.map(x=>({n:x.number,t:App.invTotal(x),s:x.status,c:x.currency})),inv:App.db.invoices.length,pay:App.db.payments.length,qty:App.prod('p1').qty,moves:App.db.moves.length}));
ok('a pro forma PRO-YYYY-0001 is stored, nothing else changes (no invoice, no payment, no stock movement)',a.pf.length===1&&/^PRO-\d{4}-0001$/.test(a.pf[0].n)&&a.pf[0].t===80&&a.pf[0].s==='open'&&a.inv===0&&a.pay===0&&a.qty===10&&a.moves===0,JSON.stringify(a));
ok('the detail opens right after (print, PDF, WhatsApp, convert)',/Transformer en facture/.test(await p.innerText('dialog'))&&/Imprimer/.test(await p.innerText('dialog')));
await p.evaluate(()=>App.close());await p.waitForTimeout(200);
ok('« Pro forma (1) » chip lists it, and the invoice totals ignore it',/Pro forma \(1\)/.test(await p.innerText('#view'))&&/PRO-\d{4}-0001/.test(await p.innerText('#ilist'))&&await p.evaluate(()=>App.db.invoices.length)===0);
const doc=await p.evaluate(()=>App.proDoc(App.db.proformas[0],'',''));
ok('printed document: « FACTURE PRO FORMA », total and sentence adapted, line reference P0001, no payment QR',/FACTURE PRO FORMA/.test(doc)&&/TOTAL PRO FORMA/.test(doc)&&/facture pro forma à la somme/.test(doc)&&/Document sans valeur de facture/.test(doc)&&/P0001|RX/.test(doc)&&!/class="qr"/.test(doc)&&!/NET À PAYER/.test(doc));
ok('file name: client first, then « Pro forma » and the number',await p.evaluate(()=>App.proFileName(App.db.proformas[0]))===`Marie Exemple - Pro forma ${a.pf[0].n}`);
// convert: same invoice form, lines already there, normal rules (payment, stock)
await p.click('[data-act=pro_open]');await p.waitForTimeout(300);await p.click('[data-act=pro_convert]');await p.waitForTimeout(500);
ok('conversion opens the invoice form with the pro forma lines and no pro forma box',await p.evaluate(()=>!document.getElementById('f_pf')&&/Routeur/.test(document.getElementById('cart').innerText)&&document.getElementById('f_cl').value==='cx1'&&document.getElementById('dok').textContent==='Créer la facture'));
await p.click('#p_all');await p.click('#dok');await p.waitForTimeout(800);
const c=await p.evaluate(()=>({inv:App.db.invoices.map(i=>({n:i.number,t:App.invTotal(i)})),pf:App.db.proformas[0],pay:App.db.payments.length,qty:App.prod('p1').qty}));
ok('the invoice is created with its own FAC number, paid, stock deducted; the pro forma becomes « Facturé » and points to it',c.inv.length===1&&/^FAC-/.test(c.inv[0].n)&&c.inv[0].t===80&&c.pay===1&&c.qty===8&&c.pf.status==='converted'&&c.pf.invoiceId===(await p.evaluate(()=>App.db.invoices[0].id)),JSON.stringify(c));
// a second one is numbered 0002; a converted one cannot be converted twice; delete
await p.evaluate(()=>{const o=App.db.proformas[0];App.db.proformas.push({...o,id:'pfx',number:'PRO-'+o.date.slice(0,4)+'-0002',status:'open',invoiceId:''});App.save();App.go('invoices')});await p.waitForTimeout(300);
await p.evaluate(()=>App.actions.pro_convert({id:App.db.proformas[0].id}));await p.waitForTimeout(300);
ok('a pro forma already invoiced cannot be converted again',await p.evaluate(()=>!document.querySelector('dialog').open));
await p.evaluate(()=>App.actions.pro_del({id:'pfx'}));await p.waitForTimeout(200);
ok('delete removes the pro forma only',await p.evaluate(()=>App.db.proformas.length===1&&App.db.invoices.length===1));
// a regular invoice is unchanged (no pro forma ticked)
await p.evaluate(()=>App.invoiceForm('materiel',{}));await p.waitForTimeout(300);
ok('regular invoice form: box present, unticked, payment card visible',await p.evaluate(()=>{const x=document.getElementById('f_pf');return x&&!x.checked&&!document.getElementById('paycard').hidden&&document.getElementById('dok').textContent==='Créer la facture'}));
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
