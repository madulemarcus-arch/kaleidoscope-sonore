const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
// Wide screens: the side menu has every screen of « Plus » (except « Dû à Starlink »), in titled groups; hidden entries and empty groups follow the profile. Fictitious data only.
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
const vis=()=>p.evaluate(()=>[...document.querySelectorAll('#side nav [data-v]')].filter(b=>!b.hidden).map(b=>b.dataset.v));
const heads=()=>p.evaluate(()=>[...document.querySelectorAll('#side nav .sgrp')].filter(h=>!h.hidden).map(h=>h.textContent));
const want=['home','clients','subs','relances','clientstats','invoices','quotes','contracts','payments','deposits','impayes','importc','importf','stock','inventory','reorder','livraisons','installs','technicians','suppliers','finance','daily','expenses','reports','rapportmois','journal','profile','settings'];
let v=await vis();
ok('administrator: all the screens of « Plus » are in the side menu',want.every(x=>v.includes(x)),want.filter(x=>!v.includes(x)).join(','));
ok('« Dû à Starlink » is not in the side menu',!v.includes('starlink'));
ok('4 group titles',(await heads()).join('|')==='Ventes et paiements|Terrain et stock|Gestion|Application',(await heads()).join('|'));
// every entry opens a screen of its own
const bad=[];for(const x of want){await p.evaluate(x=>document.querySelector('#side [data-v='+x+']').click(),x);await p.waitForTimeout(150);const ok2=await p.evaluate(x=>App.state.view===x&&document.getElementById('view').innerText.length>10,x);if(!ok2)bad.push(x)}
ok('each entry opens its screen',bad.length===0,bad.join(','));
ok('the current entry is highlighted',await p.evaluate(()=>document.querySelector('#side [data-v=settings]').classList.contains('on')));
// a seller does not see what is not his, and a group without entry disappears
await p.evaluate(()=>{App.db.settings.users=[{id:'u1',name:'Vic',role:'vendeur',active:true}];App.user=App.db.settings.users[0];App.applyRole()});await p.waitForTimeout(200);
v=await vis();const h=await heads();
ok('seller: no finance, settings, journal, imports, deposits',!['finance','settings','journal','importc','importf','deposits','daily'].some(x=>v.includes(x))&&v.includes('invoices')&&v.includes('profile'),v.join(','));
ok('seller: the « Gestion » title disappears with its entries',!h.includes('Gestion')&&h.includes('Ventes et paiements'),h.join('|'));
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
