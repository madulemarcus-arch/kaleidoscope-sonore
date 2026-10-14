const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const p=await (await b.newContext({...devices['Pixel 5']})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
const db=()=>p.evaluate(()=>JSON.parse(JSON.stringify(App.db)));
await p.evaluate(()=>App.go('invoices'));await p.waitForTimeout(200);
ok('tabs shown',/Achats/.test(await p.innerText('#view'))&&/Ventes/.test(await p.innerText('#view')));
await p.click('[data-act=invtab][data-v=buy]');ok('empty achats',/Aucun achat/.test(await p.innerText('#view')));
await p.click('[data-act=newbuy]');
await p.click('#dok');ok('refuses without items',/au moins un article/.test(await p.innerText('#toast')));
await p.fill('#l_d0','Kit Starlink Mini');await p.fill('#l_q0','2');await p.fill('#l_p0','300');
await p.click('#dok');ok('refuses without supplier',/chez qui/.test(await p.innerText('#toast')));
await p.click('[data-act=buyadd]');ok('second row, first kept',(await p.inputValue('#l_d0'))==='Kit Starlink Mini'&&await p.isVisible('#l_d1'));
await p.fill('#l_d1','Câble 50 m');await p.fill('#l_q1','3');await p.fill('#l_p1','25');
ok('live total',/675/.test(await p.innerText('#b_tot')));
await p.fill('#f_supn','Mercantile');await p.fill('#f_ref','BL-77');await p.click('#dok');await p.waitForTimeout(250);
let d=await db();const pu=d.purchases[0];
ok('purchase saved',d.purchases.length===1&&pu.items.length===2&&pu.currency==='USD'&&pu.mode==='Cash'&&pu.ref==='BL-77');
ok('supplier auto-created',d.suppliers.length===1&&d.suppliers[0].name==='Mercantile'&&pu.supplierId===d.suppliers[0].id);
ok('rate stamped',+pu.rate>0);
ok('list shows supplier+total',/Mercantile/.test(await p.innerText('#view'))&&/675/.test(await p.innerText('#view')));
// second purchase same supplier name (case) CDF
await p.click('[data-act=newbuy]');await p.fill('#f_supn','mercantile');await p.selectOption('#f_cur','CDF');await p.fill('#l_d0','Transport');await p.fill('#l_p0','12000');await p.click('#dok');await p.waitForTimeout(250);
d=await db();ok('same supplier reused',d.suppliers.length===1&&d.purchases.length===2&&d.purchases.find(x=>x.currency==='CDF'));
// detail
await p.click('[data-act=go][data-v=purchase]');await p.waitForTimeout(200);ok('detail shows',/Ce qui a été acheté/.test(await p.innerText('#view')));
// edit
await p.click('[data-act=editbuy]');await p.fill('#l_p0','10000');await p.click('#dok');await p.waitForTimeout(250);d=await db();ok('edited',d.purchases.some(x=>x.items[0].price===10000));
// finance ledger
const led=await p.evaluate(()=>App.ledger().filter(r=>r.type==='Achat').map(r=>[r.kind,r.who,Math.round(r.usd*100)/100]));
ok('ledger has 2 sorties',led.length===2&&led.every(r=>r[0]==='out'&&r[1]==='Mercantile'),JSON.stringify(led));
// supplier page
await p.evaluate(id=>App.go('supplier',{id}),d.suppliers[0].id);await p.waitForTimeout(200);ok('supplier page lists purchases',/Achats enregistrés/.test(await p.innerText('#view')));
// export tables
ok('export has achats',await p.evaluate(()=>{const t=App.tables?App.tables():null;return t?!!t.achats:'n/a'}));
// csv
await p.evaluate(()=>App.go('invoices'));const dl=p.waitForEvent('download');await p.click('[data-act=buycsv]');const x=await dl;ok('csv',/achats.*\.csv/.test(x.suggestedFilename()));
// delete
await p.evaluate(()=>App.go('invoices'));await p.click('[data-act=go][data-v=purchase]');await p.click('[data-act=delbuy]');await p.waitForTimeout(250);d=await db();ok('deleted',d.purchases.length===1);
// roles
await p.evaluate(()=>{App.db.settings.users=[{id:'v',name:'V',role:'vendeur',active:true,salt:'s',hash:'h'},{id:'c',name:'C',role:'comptable',active:true,salt:'s',hash:'h'}];App.user=App.db.settings.users[0];App.applyRole&&App.applyRole();});
ok('vendeur: no costs, no purchase view',await p.evaluate(()=>!App.can('costs')&&!App.canView('purchase')));
await p.evaluate(()=>{App.user=App.db.settings.users[1];});ok('comptable can see purchase',await p.evaluate(()=>App.canView('purchase')&&App.can('costs')));
console.log(errs);await b.close();process.exit(f?1:0)})();
