// The invoice shown ON SCREEN (the final invoice) must carry the stamp imported in « Informations de l'entreprise », not the original one. Fictitious data only.
const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
await p.evaluate(()=>App.actions.setco());await p.waitForTimeout(300);
await p.setInputFiles('#s_stamp',{name:'sceau.png',mimeType:'image/png',buffer:png});await p.waitForTimeout(600);
await p.keyboard.press('Escape');await p.waitForTimeout(200);
const id=await p.evaluate(()=>{const t=App.today();App.db.clients.push({id:'c9',code:'CL-9',type:'passage',first:'Ana',last:'Test',name:'Ana Test',phone:'1',subs:[],created:t});const i=App.createInvoice({type:'vente',clientId:'c9',currency:'USD',payMode:'Cash',date:t,lines:[{pid:'',desc:'Article test',qty:1,price:5,cost:0,unit:''}]},0,false);App.save();return i.id});
await p.evaluate(i=>App.go('invoice',{id:i}),id);await p.waitForTimeout(500);
const src=await p.$eval('.paper .foot td.r img',e=>e.getAttribute('src'));
ok('invoice screen: footer shows the IMPORTED stamp (data URL), not stamp.png',/^data:image\/png/.test(src)&&!/stamp\.png/.test(src),src.slice(0,40));
ok('same data as the saved company stamp',src===await p.evaluate(()=>App.db.settings.company.stamp));
await p.evaluate(()=>{App.db.settings.company.stamp='';App.save();});
await p.evaluate(i=>App.go('invoice',{id:i}),id);await p.waitForTimeout(400);
ok('without an imported stamp: original stamp.png as before',/stamp\.png/.test(await p.$eval('.paper .foot td.r img',e=>e.getAttribute('src'))));
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
