const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
const go=async(S)=>{await p.evaluate(S=>{Object.assign(App.db.settings,S);App.save();App.go('home')},S);await p.waitForTimeout(1300)};
const st=()=>p.evaluate(()=>App.sky.stats());
const vars=()=>p.evaluate(()=>{const h=document.querySelector('#view .hero').style;return{a:h.getPropertyValue('--fa'),b:h.getPropertyValue('--fb'),c:h.getPropertyValue('--fc'),t:h.getPropertyValue('--tempo')}});
// ---- one palette per decor, shared by the CSS, the sky and the photo cards
const PAL=await p.evaluate(()=>App.fx.PAL);
ok('five palettes of three shades',Object.keys(PAL).length===5&&Object.values(PAL).every(x=>x.a&&x.b&&x.c));
for(const d of ['def','sunset','night','aurora','starlink']){
  await go({decor:d,fx:'balanced',bgs:[]});const v=await vars(),s=await st(),P=PAL[d];
  ok('decor '+d+': the card variables use its palette',v.a===P.a&&v.b===P.b&&v.c===P.c,JSON.stringify(v));
  ok('decor '+d+': the glows of the sky use the same palette',JSON.stringify(s.glow)===JSON.stringify([P.a,P.b,P.c]),JSON.stringify(s.glow));
}
// the photo cards take their glow from the palette of the decor
await go({decor:'starlink',fx:'balanced'});await p.waitForTimeout(1200);
ok('starlink: card glows come from the palette',await p.evaluate(()=>{const P=App.fx.PAL.starlink,all=[P.a,P.b,P.c],cs=[...document.querySelectorAll('.hero .hcard')];return cs.length>0&&cs.every(c=>all.includes(c.style.getPropertyValue('--gc')))}));
// ---- rhythm: one tempo for everything
const lv={};for(const k of ['calm','balanced','intense']){await go({decor:'def',fx:k});lv[k]={s:await st(),v:await vars()}}
ok('tempo grows with the level (calm < balanced < intense)',lv.calm.s.tempo<lv.balanced.s.tempo&&lv.balanced.s.tempo<lv.intense.s.tempo,[lv.calm.s.tempo,lv.balanced.s.tempo,lv.intense.s.tempo].join('<'));
ok('the CSS tempo is the same number as the sky tempo',['calm','balanced','intense'].every(k=>+lv[k].v.t===lv[k].s.tempo));
ok('scenes are rarer when calm and more frequent when intense',lv.calm.s.gap>lv.balanced.s.gap&&lv.balanced.s.gap>lv.intense.s.gap);
// ---- quantity: one density for stars, links and soft lights
ok('stars: calm < balanced < intense',lv.calm.s.stars<lv.balanced.s.stars&&lv.balanced.s.stars<lv.intense.s.stars,[lv.calm.s.stars,lv.balanced.s.stars,lv.intense.s.stars].join('<'));
ok('network links follow the same density',lv.calm.s.link<=lv.balanced.s.link&&lv.balanced.s.link<=lv.intense.s.link);
ok('soft lights follow the same density',lv.calm.s.bokeh<=lv.balanced.s.bokeh&&lv.balanced.s.bokeh<=lv.intense.s.bokeh);
// photos on screen lower the quantity of particles, so that the card is never overloaded
await go({decor:'def',fx:'balanced'});const noPh=(await st()).stars;
await go({decor:'starlink',fx:'balanced'});const withPh=(await st()).stars;
ok('with photos the sky is calmer (fewer stars)',withPh<noPh,noPh+' -> '+withPh);
// ---- the user choice
await p.evaluate(()=>{document.getElementById('view').insertAdjacentHTML('beforeend',App.photoCard())});await p.waitForTimeout(300);
ok('three ambiance chips in the settings card',(await p.$$('#view [data-act=fx_set]')).length===3);
await p.evaluate(()=>App.actions.fx_set({f:'calm'}));await p.waitForTimeout(400);
ok('choosing "Calme" is saved and applied',await p.evaluate(()=>App.db.settings.fx==='calm'&&App.fx.level().tempo<1));
await p.evaluate(()=>App.actions.fx_set({f:'nope'}));ok('an unknown ambiance is ignored',await p.evaluate(()=>App.db.settings.fx==='calm'));
ok('the ambiance is kept when a backup is restored',await p.evaluate(async()=>/fx: keep\.fx/.test(await (await fetch('js/settings.js')).text())));
ok('default ambiance is "Équilibrée"',await p.evaluate(()=>{delete App.db.settings.fx;return App.fx.level().tempo===1}));
ok('no page errors',errs.length===0,errs.join('|'));
await b.close();console.log(f?`${f} FAIL`:'ALL PASS');process.exit(f?1:0)})();
