const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
// Fictitious data only: the repository is public.
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const errs=[];
const widths=async vw=>{const p=await (await b.newContext({viewport:{width:vw,height:900}})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
 await p.evaluate(()=>{const t=App.today();for(let i=0;i<12;i++)App.db.clients.push({id:'d'+i,code:'CL-00'+(10+i),type:'gere',first:'Alice',last:'Exemple'+String.fromCharCode(65+(i%3)),name:'Alice Exemple'+String.fromCharCode(65+(i%3)),phone:'+2438162394'+(10+i),acc:'ACC-DF-14235056-36007-3'+(i%10),created:t,subs:[],start:App.addDays(t,-27),period:30,plan:'Résidentiel',slm:{state:'echec',ts:Date.now()}});App.save();App.go('clients')});await p.waitForTimeout(700);
 const w=await p.evaluate(()=>[...document.querySelectorAll('#clist .list > .swr, #clist .list > .item')].map(e=>Math.round(e.getBoundingClientRect().width)));await p.context().close();return w};
const a=await widths(1370), c=await widths(1920), d=await widths(1100);
ok('window of 1370 px: all the client cards have the same width (no squeezed column)',new Set(a).size===1,a.join(','));
ok('every card is at least 500 px wide on a desktop window (name and number stay readable)',[a,c,d].every(w=>Math.min(...w)>=500),[a,c,d].map(w=>Math.min(...w)).join(','));
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
