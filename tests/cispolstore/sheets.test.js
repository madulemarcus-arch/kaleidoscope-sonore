const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5'],hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{const t=App.today();App.db.clients.push({id:'c1',code:'CL-1',type:'gere',first:'Ann',last:'X',name:'Ann X',phone:'0812',acc:'A1',start:t,period:30,grace:15,subs:[],created:t,note:''});
App.db.products.push({id:'p1',name:'Kit',cat:'Kits Starlink',ref:'P1',unit:'pièce',qty:5,cost:300,price:450,min:1});
App.createInvoice({type:'materiel',clientId:'c1',currency:'USD',payMode:'Cash',date:t,lines:[{pid:'',desc:'Kit',qty:1,price:450,cost:0}],payAmount:100},0);App.save();App.go('invoices')});await p.waitForTimeout(400);
await p.evaluate(()=>App.paymentForm?App.paymentForm({}):App.actions.newpay({}));await p.waitForTimeout(400);
ok('sheet has grab handle and close button',await p.isVisible('dialog .grab')&&await p.isVisible('dialog .dclose'));
ok('date field has quick buttons',(await p.$$('dialog .qd button')).length===3);
await p.click('dialog .qd button >> nth=1');const hier=await p.evaluate(()=>App.addDays(App.today(),-1));ok('"Hier" fills the date',(await p.inputValue('dialog input[type=date]'))===hier);
ok('active quick button highlighted',await p.evaluate(()=>document.querySelectorAll('dialog .qd button.on').length===1&&document.querySelector('dialog .qd button.on').textContent==='Hier'));
await p.screenshot({path:'tour3/s_pay.png'});
await p.click('dialog .dclose');ok('close button closes',!(await p.isVisible('dialog')));
// quantity stepper (invoice line form)
await p.evaluate(()=>App.invoiceForm('materiel'));await p.waitForTimeout(500);
ok('quantity has − and +',(await p.$$('dialog .stp')).length>=1);
const q0=await p.inputValue('#f_qty');await p.click('dialog .stp button >> nth=1');ok('+ increases the quantity',+(await p.inputValue('#f_qty'))===+q0+1);await p.click('dialog .stp button >> nth=0');await p.click('dialog .stp button >> nth=0');await p.click('dialog .stp button >> nth=0');ok('− never goes below 0',+(await p.inputValue('#f_qty'))===0);
await p.screenshot({path:'tour3/s_inv.png'});
// drag down to close
await p.evaluate(()=>{document.getElementById('dlg').scrollTop=0;const el=document.querySelector('dialog .grab');const mk=(type,y)=>new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[new Touch({identifier:1,target:el,clientX:100,clientY:y})],changedTouches:[new Touch({identifier:1,target:el,clientX:100,clientY:y})]});
el.dispatchEvent(mk('touchstart',300));for(let k=1;k<=6;k++)el.dispatchEvent(mk('touchmove',300+k*30));el.dispatchEvent(mk('touchend',480));});await p.waitForTimeout(300);
ok('drag down closes the sheet',!(await p.isVisible('dialog')));
// purchase form: re-opened while open keeps working
await p.evaluate(()=>App.actions.newbuy());await p.waitForTimeout(300);await p.click('[data-act=buyadd]');await p.waitForTimeout(300);ok('purchase form re-render keeps steppers',(await p.$$('dialog .stp')).length>=2);
console.log(errs);await b.close();process.exit(f?1:0)})();
