const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5'],colorScheme:'dark'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
const root=a=>p.evaluate(a=>document.documentElement.dataset[a]||'',a);
await p.evaluate(()=>App.go('more'));await p.waitForTimeout(500);
ok('Apparence card in Plus with 4 modes',(await p.$$('#view [data-act=theme_set]')).length===4&&(await p.$$('#view [data-act=accent_set]')).length===6);
ok('Auto (phone dark) -> dark',await root('theme')==='dark'&&(await p.getAttribute('[data-act=theme_set][data-t=auto]','aria-pressed'))==='true');
await p.click('[data-act=theme_set][data-t=light]');await p.waitForTimeout(300);ok('Clair',await root('theme')==='light'&&await root('black')==='');
await p.click('[data-act=theme_set][data-t=dark]');await p.waitForTimeout(300);ok('Sombre',await root('theme')==='dark'&&await root('black')==='');
await p.click('[data-act=theme_set][data-t=black]');await p.waitForTimeout(700);ok('Noir',await root('theme')==='dark'&&await root('black')==='1'&&await p.evaluate(()=>getComputedStyle(document.body).backgroundColor==='rgb(0, 0, 0)'));
await p.click('[data-act=accent_set][data-a=violet]');await p.waitForTimeout(300);ok('accent violet',await root('accent')==='violet');
await p.screenshot({path:'a12-more.png',fullPage:false});
await p.click('[data-act=theme_set][data-t=auto]');await p.waitForTimeout(300);ok('Auto again',await p.evaluate(()=>App.db.settings.theme==='auto'));
await p.evaluate(()=>App.go('settings'));await p.waitForTimeout(500);ok('Apparence card also in Paramètres',(await p.$$('#view [data-act=theme_set]')).length===4);
// vendeur can change theme
await p.evaluate(()=>{App.db.settings.users=[{id:'v',name:'Vic',role:'vendeur',active:true,salt:'s',hash:'h'}];App.user=App.db.settings.users[0];App.applyRole&&App.applyRole();App.go('more')});await p.waitForTimeout(500);
await p.click('[data-act=theme_set][data-t=light]');await p.waitForTimeout(300);ok('vendeur can switch theme',await root('theme')==='light');
console.log(errs);await b.close();process.exit(f?1:0)})();
