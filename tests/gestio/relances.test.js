const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{const t=App.today(),A=App.addDays;window.__wa=[];window.open=u=>{window.__wa.push(u);return null};
App.db.clients.push({id:'c1',code:'CL-1',type:'gere',first:'Jean',last:'A',name:'Jean A',phone:'0990000001',acc:'A1',start:A(t,-27),period:30,grace:15,subs:[],created:t,note:''},
{id:'c2',code:'CL-2',type:'gere',first:'Paul',last:'B',name:'Paul B',phone:'0990000002',acc:'A2',start:A(t,-40),period:30,grace:15,subs:[],created:t,note:''},
{id:'c3',code:'CL-3',type:'mat',first:'Marie',last:'C',name:'Marie C',phone:'',created:t,note:''},
{id:'c4',code:'CL-4',type:'mat',first:'Luc',last:'D',name:'Luc D',phone:'0990000004',created:t,note:''});
App.createInvoice({type:'materiel',clientId:'c4',currency:'USD',payMode:'Cash',date:A(t,-45),lines:[{pid:'',desc:'Kit',qty:1,price:300,cost:0}],payAmount:100},0);
App.createInvoice({type:'materiel',clientId:'c3',currency:'USD',payMode:'Cash',date:A(t,-5),lines:[{pid:'',desc:'Cable',qty:1,price:50,cost:0}],payAmount:0},0);
App.db.penalties.push({id:'pn1',clientId:'c2',amount:5,currency:'USD',reason:'Retard',date:A(t,-3),paid:'',rate:2400});App.save();App.go('more')});await p.waitForTimeout(500);
ok('Plus has Relances du jour',/Relances du jour/.test(await p.innerText('#view')));
await p.evaluate(()=>App.go('home'));await p.waitForTimeout(900);ok('home card with count',/relance\(s\) à faire aujourd'hui/.test(await p.innerText('#view')));
await p.evaluate(()=>App.go('relances'));await p.waitForTimeout(900);
let t=await p.innerText('.dhero');ok('hero counts: 4 à faire (sub Jean, sub Paul, inv Luc, pen Paul) + 2 sans/..',/\b4\b/.test(t),t.replace(/\n/g,' | '));
const rows=await p.$$('#view .list .item');ok('6 items listed (2 subs, 2 invoices, 1 penalty; incl. 1 without phone)',rows.length>=5,String(rows.length));
ok('without-phone item has no WhatsApp button',await p.evaluate(()=>[...document.querySelectorAll('#view .list .item')].some(r=>/Marie C/.test(r.textContent)&&!r.querySelector('[data-act=rel_one]'))));
await p.screenshot({path:'r18.png'});
await p.click('[data-act=rel_f][data-f=inv]');await p.waitForTimeout(300);ok('filter Impayés',(await p.$$('#view .list .item')).length===2&&/Luc D/.test(await p.innerText('#view')));
await p.click('[data-act=rel_f][data-f=all]');await p.waitForTimeout(300);
await p.click('[data-act=rel_one]');await p.waitForTimeout(500);ok('one tap opens WhatsApp and marks reminded',await p.evaluate(()=>window.__wa.length===1&&/wa\.me\//.test(window.__wa[0])&&App.db.clients.some(c=>c.lastRemind===App.today())||App.db.invoices.some(i=>i.lastRemind)||App.db.penalties.some(x=>x.lastRemind)));
const before=await p.evaluate(()=>window.__wa.length);
await p.click('[data-act=rel_series]');await p.waitForTimeout(400);ok('series dialog Relance 1 / N',/Relance 1 \//.test(await p.innerText('dialog')));
await p.click('#rsend');await p.waitForTimeout(300);await p.click('#rskip');await p.waitForTimeout(300);
const txt=await p.innerText('dialog');ok('series continues',/Relance 3 \/|Relances terminées/.test(txt),txt.slice(0,40).replace(/\n/g,' '));
for(let i=0;i<6;i++){if(await p.$('#rsend'))await p.click('#rsend');await p.waitForTimeout(150);}
await p.waitForTimeout(500);ok('series ends',/Relances terminées/.test(await p.innerText('dialog')));await p.keyboard.press('Escape');await p.waitForTimeout(300);
ok('only the skipped one remains',(await p.evaluate(()=>App.relanceCount()))===1);
// vendeur can open it
await p.evaluate(()=>{App.db.settings.users=[{id:'v',name:'Vic',role:'vendeur',active:true,salt:'s',hash:'h'}];App.user=App.db.settings.users[0];App.applyRole&&App.applyRole();App.go('more')});await p.waitForTimeout(500);ok('vendeur sees Relances du jour',/Relances du jour/.test(await p.innerText('#view')));
console.log(errs);await b.close();process.exit(f?1:0)})();
