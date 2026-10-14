const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{const t=App.today();window.__wa=[];window.open=u=>{window.__wa.push(u);return null};App.db.clients.push({id:'c1',code:'CL-1',type:'gere',first:'Jean',last:'K',name:'Jean K',phone:'0991',address:'Av. Test 1',acc:'ACC-1',plan:'Illimité',price:70,created:t,subs:[]});App.save();App.go('more')});await p.waitForTimeout(500);
ok('Plus has Contrats',/Contrats/.test(await p.innerText('#view')));
await p.evaluate(()=>App.go('contracts'));await p.waitForTimeout(400);
await p.click('[data-act=ct_new]');await p.waitForTimeout(400);
await p.evaluate(()=>{[...document.querySelectorAll('dialog button')].find(b=>/Créer le contrat/.test(b.textContent)).click()});await p.waitForTimeout(300);
ok('refuses empty contract',await p.evaluate(()=>App.db.contracts.length===0));
await p.selectOption('#ct_cl','c1');ok('client prefills plan and price',await p.inputValue('#cf_plan')==='Illimité'&&await p.inputValue('#cf_amount')==='70');
await p.fill('#ct_months','6');
await p.evaluate(()=>{[...document.querySelectorAll('dialog button')].find(b=>/Créer le contrat/.test(b.textContent)).click()});await p.waitForTimeout(800);
const c=await p.evaluate(()=>{const c=App.db.contracts[0];return {n:App.db.contracts.length,no:c.no,st:c.status,body:c.body,end:c.end,start:c.start,t:c.type}});
ok('created CTR-0001 as draft',c.n===1&&/^CTR-\d{4}-0001$/.test(c.no)&&c.st==='draft');
ok('abonnement text mentions price, plan and 6 mois',/Article 1 – Objet/.test(c.body)&&/70\s\$/.test(c.body)&&/Illimité/.test(c.body)&&/6 mois/.test(c.body),c.body.slice(0,200));
ok('end date is about 6 months after start',await p.evaluate(()=>{const c=App.db.contracts[0],d=App.diff(c.start,c.end);return d>=180&&d<=183}));
ok('detail opens after create',/Contrat CTR-/.test(await p.innerText('dialog')));
const doc=await p.evaluate(()=>App.contractDoc(App.db.contracts[0],'','stamp.png'));
ok('document has title, parties, articles and signatures',/CONTRAT D&#39;ABONNEMENT INTERNET|CONTRAT D'ABONNEMENT INTERNET/.test(doc)&&/LE PRESTATAIRE/.test(doc)&&/LE CLIENT/.test(doc)&&/Jean K/.test(doc)&&/Article 4/.test(doc)&&/Lu et approuvé/.test(doc));
await p.click('[data-act=ct_wa]');ok('WhatsApp link',await p.evaluate(()=>window.__wa.length===1&&/wa\.me\//.test(window.__wa[0])));
await p.click('[data-act=ct_pdf]');await p.waitForTimeout(1500);
await p.evaluate(()=>App.actions.ct_open({id:App.db.contracts[0].id}));await p.waitForTimeout(300);
await p.click('[data-act=ct_set][data-s=active]');await p.waitForTimeout(400);ok('signed -> active',await p.evaluate(()=>App.db.contracts[0].status==='active'&&App.contractCount()===1));
// article editor
await p.evaluate(()=>App.actions.ct_open({id:App.db.contracts[0].id}));await p.waitForTimeout(300);
await p.click('[data-act=ct_text]');await p.waitForTimeout(500);
const n0=await p.evaluate(()=>document.querySelectorAll('#ct_arts textarea').length);ok('editor lists the generated articles',n0===10,String(n0));
await p.click('[data-act=ct_add]');await p.waitForTimeout(200);
await p.evaluate(()=>{const t=[...document.querySelectorAll('#ct_arts input[data-af=t]')].pop(),x=[...document.querySelectorAll('#ct_arts textarea')].pop();t.value='Clause spéciale';x.value='Texte PERSO pour {{client}}'});
await p.selectOption('#ct_lib','1');await p.waitForTimeout(200);
ok('library article appended',await p.evaluate(()=>[...document.querySelectorAll('#ct_arts input[data-af=t]')].pop().value==='Force majeure'));
await p.click('[data-act=ct_up][data-i="11"]');await p.waitForTimeout(200);
ok('move up swaps the last two',await p.evaluate(()=>{const v=[...document.querySelectorAll('#ct_arts input[data-af=t]')].map(i=>i.value);return v[10]==='Force majeure'&&v[11]==='Clause spéciale'}));
await p.click('[data-act=ct_rm][data-i="0"]');await p.waitForTimeout(200);
ok('remove drops one article',await p.evaluate(()=>document.querySelectorAll('#ct_arts textarea').length===11));
await p.evaluate(()=>{[...document.querySelectorAll('dialog button')].find(b=>/Enregistrer/.test(b.textContent)).click()});await p.waitForTimeout(600);
const bd=await p.evaluate(()=>App.db.contracts[0].body);
ok('saved body is renumbered from 1 to 11 without gaps',[1,2,3,4,5,6,7,8,9,10,11].every(n=>new RegExp('Article '+n+' – ').test(bd))&&!/Article 12 –/.test(bd)&&!/Article 1 – Objet/.test(bd),bd.slice(0,80));
ok('new article is in the document with the client name',await p.evaluate(()=>/Clause spéciale/.test(App.contractDoc(App.db.contracts[0],'','s'))&&/Texte PERSO pour Jean K/.test(App.contractDoc(App.db.contracts[0],'','s'))));
await p.keyboard.press('Escape');await p.waitForTimeout(200);
// client sheet shows the contract
await p.evaluate(()=>App.go('client',{id:'c1',tab:'fac'}));await p.waitForTimeout(500);ok('client sheet lists the contract',/CTR-/.test(await p.innerText('#view')));
// other types
const gens=await p.evaluate(()=>Object.keys(App.contractTypes));
ok('5 contract types',gens.length===5&&['abonnement','fournisseur','materiel','travail','libre'].every(k=>gens.includes(k)),gens.join(','));
async function create(type,fill,extra){await p.evaluate(()=>App.go('contracts'));await p.waitForTimeout(300);await p.click('[data-act=ct_new]');await p.waitForTimeout(300);await p.selectOption('#ct_type',type);await p.waitForTimeout(200);
 if(extra&&extra.client)await p.selectOption('#ct_cl',extra.client);else{await p.fill('#ct_pname',extra&&extra.name||'Marie T');}
 for(const [k,v] of Object.entries(fill)){const el=await p.$('#cf_'+k);if(el){const tag=await el.evaluate(e=>e.tagName);if(tag==='SELECT')await p.selectOption('#cf_'+k,v);else await p.fill('#cf_'+k,String(v));}}
 await p.evaluate(()=>{[...document.querySelectorAll('dialog button')].find(b=>/Créer le contrat/.test(b.textContent)).click()});await p.waitForTimeout(700);
 const r=await p.evaluate(()=>{const c=App.db.contracts[App.db.contracts.length-1];return {no:c.no,type:c.type,body:c.body,months:c.months,end:c.end}});await p.keyboard.press('Escape');await p.waitForTimeout(200);return r;}
const f1=await create('fournisseur',{plan:'Starlink Standard',usage:'revente',amount:120,advance:2,fee:50,notice:45},{client:'c1'});
ok('fournisseur: revente clause, advance and notice',/revendre l'accès/.test(f1.body)&&/2 mois d'avance/.test(f1.body)&&/45 jours/.test(f1.body)&&/50\s\$/.test(f1.body),f1.body.slice(0,120));
const m1=await create('materiel',{items:'Routeur X × 2',amount:300,deposit:100,warranty:6});
ok('materiel: no term, balance 200 and warranty 6 mois',m1.months===0&&m1.end===''&&/200\s\$/.test(m1.body)&&/garanti 6 mois/.test(m1.body)&&/Routeur X/.test(m1.body),m1.body.slice(0,160));
const t1=await create('travail',{job:'Vendeur',amount:250,trial:20,hours:'8h-16h',commission:'2 % des ventes'},{name:'Paul M'});
ok('travail: poste, salary, trial and commission',/Vendeur/.test(t1.body)&&/250\s\$/.test(t1.body)&&/20 jours/.test(t1.body)&&/2 % des ventes/.test(t1.body)&&/durée indéterminée/.test(t1.body),t1.body.slice(0,120));
const l1=await create('libre',{title:'Accord de partenariat',amount:500,body:'Article 1 – Objet\nCe contrat lie {{client}} et {{societe}} le {{date}} pour {{montant}}.'},{name:'Zoé B'});
ok('libre: body kept as written',/\{\{client\}\}/.test(l1.body));
const ld=await p.evaluate(()=>App.contractDoc(App.db.contracts.find(c=>c.type==='libre'),'','s'));
ok('libre: placeholders replaced and custom title',/Zoé B/.test(ld)&&/CISPOLstore/.test(ld)&&!/\{\{/.test(ld)&&/ACCORD DE PARTENARIAT/.test(ld)&&/500\s\$/.test(ld));
ok('numbers increase',await p.evaluate(()=>App.db.contracts.map(c=>c.no.slice(-4)).join()==='0001,0002,0003,0004,0005'));
// expiry alerts + renewal
await p.evaluate(()=>{const c=App.db.contracts[0];c.status='active';c.start=App.addDays(App.today(),-350);c.months=12;c.end=App.addDays(App.today(),15);App.save()});
ok('expiring contract flagged soon',await p.evaluate(()=>App.contractStatus(App.db.contracts[0])==='soon'&&App.contractAlerts().length===1));
await p.evaluate(()=>App.go('home'));await p.waitForTimeout(900);ok('home card for contracts to renew',/1 contrat à renouveler/.test(await p.innerText('#view')));
await p.evaluate(()=>App.actions.ct_open({id:App.db.contracts[0].id}));await p.waitForTimeout(300);
await p.click('[data-act=ct_renew]');await p.waitForTimeout(700);
const rn=await p.evaluate(()=>({n:App.db.contracts.length,o:App.db.contracts[0].status,nw:App.db.contracts[App.db.contracts.length-1]}));
ok('renewal creates a draft starting after the old end and ends the old one',rn.n===6&&rn.o==='ended'&&rn.nw.status==='draft'&&rn.nw.start===await p.evaluate(()=>App.addDays(App.db.contracts[0].end,1)));
await p.keyboard.press('Escape');await p.waitForTimeout(200);
// delete + journal + backup + roles
await p.evaluate(()=>App.actions.ct_del({id:App.db.contracts[5].id}));await p.waitForTimeout(300);ok('deleted',await p.evaluate(()=>App.db.contracts.length===5));
ok('sync and backup include contracts',await p.evaluate(async()=>/'contracts'/.test(await (await fetch('js/sync.js')).text())&&/'contracts'/.test(await (await fetch('js/backup.js')).text())));
await p.evaluate(()=>{App.db.settings.users=[{id:'v',name:'Vend',role:'vendeur',active:true,salt:'s',hash:'h'}];App.user=App.db.settings.users[0];App.applyRole&&App.applyRole();});
ok('vendeur cannot view contracts',await p.evaluate(()=>!App.canView('contracts')));
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
