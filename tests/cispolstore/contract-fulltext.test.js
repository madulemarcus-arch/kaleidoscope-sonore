const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{App.go('contracts')});await p.waitForTimeout(500);
await p.click('[data-act=ct_new]');await p.waitForTimeout(400);
await p.selectOption('#ct_type','cgu');await p.waitForTimeout(200);
await p.evaluate(()=>{[...document.querySelectorAll('dialog button')].find(b=>/Créer le contrat/.test(b.textContent)).click()});await p.waitForTimeout(800);
// the detail opens by itself after creation: the whole text is in it
const n=await p.evaluate(()=>App.db.contracts[0].body.match(/^Article \d+ –/gm).length);
ok('full text block present',await p.isVisible('#ct_full'));
const txt=await p.evaluate(()=>document.getElementById('ct_full').innerText);
ok('every article title shown',(txt.match(/^Article \d+ –/gm)||[]).length===n&&n>=10,String(n));
ok('article text shown too',/Wi-Fi|Utilisateur/.test(txt)&&txt.length>1500,String(txt.length));
ok('no raw placeholder left',!/\{\{/.test(txt));
await p.keyboard.press('Escape');await p.waitForTimeout(300);
// from the list
await p.evaluate(()=>{App.go('contracts')});await p.waitForTimeout(400);
await p.click('[data-act=ct_open]');await p.waitForTimeout(400);
ok('clicking a contract in the list shows the text',await p.isVisible('#ct_full')&&(await p.evaluate(()=>document.getElementById('ct_full').innerText)).length>1500);
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
