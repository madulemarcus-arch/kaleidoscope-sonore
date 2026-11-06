const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
const doc=await p.evaluate(async()=>{const co=App.db.settings.company;co.name='Autre Entreprise SARL';co.logo='';co.stamp='';const t=App.today();App.db.clients.push({id:'c9',code:'CL-9',type:'passage',first:'A',last:'B',name:'A B',phone:'1',subs:[],created:t});const i=App.createInvoice({type:'vente',clientId:'c9',currency:'USD',payMode:'Cash',date:t,lines:[{pid:'',desc:'x',qty:1,price:5,cost:0,unit:''}]},0,false);return{made:App.docKit.made(),css:App.docKit.DOC_CSS(),inv:App.invoiceDoc(i,'',await App.docKit.stampData())};});
ok('credit line names the application',/CISPOLstore Manager/.test(doc.made)&&/class="made"/.test(doc.made));
ok('credit style is part of the document CSS',/\.made\{/.test(doc.css));
ok('credit does not depend on the company name',!/Autre Entreprise/.test(doc.made));
// PDF path: the rendered host carries the line
const pdf=await p.evaluate(async()=>{let seen='';const orig=document.body.appendChild.bind(document.body);document.body.appendChild=n=>{if(n.innerHTML&&n.innerHTML.includes('class="made"'))seen='yes';return orig(n);};try{await App.sharePdf('t.pdf','<div class="paper">x</div>');}catch(e){}document.body.appendChild=orig;return seen;});
ok('PDF rendering includes the credit line',pdf==='yes');
// print path: iframe source carries the line
const pr=await p.evaluate(async()=>{let src='';const orig=document.body.appendChild.bind(document.body);document.body.appendChild=n=>{if(n.tagName==='IFRAME'&&n.srcdoc)src=n.srcdoc;return orig(n);};App.docKit.print('t','<div class="paper">x</div>');await new Promise(r=>setTimeout(r,100));document.body.appendChild=orig;return src;});
ok('printed document includes the credit line',/Document généré par l'application CISPOLstore Manager/.test(pr));
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
