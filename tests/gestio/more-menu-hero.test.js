const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const p=await (await b.newContext({...devices['Pixel 5']})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>App.go('more'));await p.waitForTimeout(500);
let t=await p.innerText('.phero');ok('Plus hero: company, role, 3 badges',/Administrateur/.test(t)&&(await p.$$('.phero .sbadge')).length===3&&/Sans PIN/.test(t)&&/Aucune sauvegarde/.test(t),t.replace(/\n/g,' | '));
await p.screenshot({path:'s10-more.png'});
await p.click('.phero [data-act=pinset]');await p.waitForTimeout(500);ok('Sans PIN badge starts PIN setup',await p.evaluate(()=>!document.getElementById('lock').hidden));
await p.evaluate(()=>{document.getElementById('lock').hidden=true});
await p.evaluate(()=>{App.db.settings.lastBackup=App.today();App.go('settings')});await p.waitForTimeout(500);
t=await p.innerText('.phero');ok('Settings hero, backup today',/Sauvegardé aujourd'hui/.test(t),t.replace(/\n/g,' | '));await p.screenshot({path:'s10-settings.png'});
// vendeur: badges not clickable for backup
await p.evaluate(()=>{App.db.settings.users=[{id:'v',name:'Vic',role:'vendeur',active:true,salt:'s',hash:'h'}];App.user=App.db.settings.users[0];App.applyRole&&App.applyRole();App.go('more')});await p.waitForTimeout(500);
ok('vendeur: hero shows role, no action buttons',/Vendeur/.test(await p.innerText('.phero'))&&(await p.$$('.phero button.sbadge')).length===0);
console.log(errs);await b.close();process.exit(f?1:0)})();
