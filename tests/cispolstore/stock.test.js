const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const p=await (await b.newContext({...devices['Pixel 5']})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
const iid=await p.evaluate(()=>{const t=App.today();App.db.products.push({id:'p1',name:'Starlink Mini',cat:'Kits Starlink',ref:'SM',unit:'pièce',cost:200,price:300,qty:5,min:2,entry:t},{id:'p2',name:'Câble Cat6',cat:'Câbles',ref:'',unit:'m',cost:1,price:2,qty:60,min:20,entry:t},{id:'p3',name:'Routeur',cat:'Routeurs',ref:'',unit:'pièce',cost:20,price:35,qty:1,min:2,entry:t},{id:'p4',name:'Injecteur',cat:'Injecteurs PoE',ref:'',unit:'pièce',cost:5,price:9,qty:0,min:1,entry:t},{id:'p5',name:'Pose',cat:'Service',ref:'',unit:'pièce',cost:0,price:50,qty:0,min:0,entry:t});
App.db.clients.push({id:'c1',code:'CL-1',type:'mat',first:'Jean',last:'M',name:'Jean M',phone:'1',created:t,note:''});
App.move({pid:'p1',qty:5,cost:200,date:t,note:'Stock initial',purchase:true});
App.createInvoice({type:'materiel',clientId:'c1',currency:'USD',payMode:'Cash',date:t,lines:[{pid:'p1',desc:'Starlink Mini',qty:2,price:300,cost:200}],payAmount:600},0);App.save();App.go('stock');return App.db.invoices[0].id});
await p.waitForTimeout(800);
const names=()=>p.$$eval('#plist .item b:first-child',e=>e.map(x=>x.textContent).filter(t=>!/FC|\$/.test(t)));
ok('hero stat buttons',(await p.$$('.cstats > button')).length===4);
await p.click('.cstats [data-f=low]');await p.waitForTimeout(500);let n=await p.innerText('#plist');ok('click Stock bas -> low list (Routeur, Injecteur)',/Routeur/.test(n)&&/Injecteur/.test(n)&&!/Starlink Mini/.test(n)&&!/Câble/.test(n));
await p.click('.cstats [data-f=out]');await p.waitForTimeout(400);n=await p.innerText('#plist');ok('click Épuisés -> Injecteur only',/Injecteur/.test(n)&&!/Routeur/.test(n));
await p.click('.cstats [data-f=all]');await p.waitForTimeout(400);ok('click Produits -> all 5',(await p.$$('#plist > .list > .item')).length===5);
// home links
await p.evaluate(()=>App.go('home'));await p.waitForTimeout(700);
await p.click('.stat.tap[data-p*=Câbles]');await p.waitForTimeout(500);n=await p.innerText('#plist');ok('home Câble card -> Câbles only',/Câble Cat6/.test(n)&&!/Routeur/.test(n));
await p.evaluate(()=>App.go('home'));await p.waitForTimeout(600);await p.click('.stat.tap[data-p*=low]');await p.waitForTimeout(500);n=await p.innerText('#plist');ok('home Stock bas card -> low list',/Routeur/.test(n)&&!/Câble/.test(n));
// product report
await p.evaluate(()=>App.go('stock',{f:'all'}));await p.waitForTimeout(500);
await p.click('#plist .item:has-text("Starlink Mini") .grow');await p.waitForTimeout(600);
let h=await p.innerText('.shero');ok('product report: 8 en stock, 2 vendu, 600 $',/\b8\b/.test(h)&&/2\n?vendu/.test(h.replace(/\n/g,'\n'))&&/600/.test(h),h.replace(/\n/g,' | '));
ok('tabs + chart',(await p.$$('.tabs button')).length===3&&await p.isVisible('.cwrap'));
await p.screenshot({path:'s11-product.png'});
await p.click('[data-act=prtab][data-t=sales]');await p.waitForTimeout(300);ok('sales tab lists invoice',/FAC-/.test(await p.innerText('#view')));
await p.click('[data-act=prtab][data-t=moves]');await p.waitForTimeout(300);ok('moves tab shows entrée + sortie',/Entrée/.test(await p.innerText('#view'))&&/Sortie/.test(await p.innerText('#view')));
await p.click('[data-act=prtab][data-t=sales] ,.tabs button:nth-child(2)');await p.click('#view .item');await p.waitForTimeout(500);ok('sale row opens the invoice',await p.evaluate(()=>App.state.view==='invoice'));
// buttons on the list rows still work: ＋ opens stock-in form
await p.evaluate(()=>App.go('stock',{f:'all'}));await p.waitForTimeout(500);await p.click('#plist .item:has-text("Routeur") [data-act=stin]');await p.waitForTimeout(400);ok('＋ button still opens entry form (not the report)',/Entrée de stock/.test(await p.innerText('dialog')));await p.keyboard.press('Escape');
// vendeur: report ok, no cost
await p.evaluate(()=>{App.db.settings.users=[{id:'v',name:'Vic',role:'vendeur',active:true,salt:'s',hash:'h'}];App.user=App.db.settings.users[0];App.applyRole&&App.applyRole();App.go('product',{id:'p1'})});await p.waitForTimeout(500);
const vt=await p.innerText('#view');ok('vendeur can open report, no costs',/Starlink Mini/.test(vt)&&!/Prix d'achat/.test(vt)&&!/marge/.test(vt),vt.slice(0,80).replace(/\n/g,' '));
console.log(errs);await b.close();process.exit(f?1:0)})();
