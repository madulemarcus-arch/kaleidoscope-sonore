const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5'],acceptDownloads:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(600);await p.click('[data-lk=skip]').catch(()=>{});
const banner=async v=>{await p.evaluate(v=>App.go(v),v);await p.waitForTimeout(500);return p.evaluate(()=>{const e=document.querySelector('.bkban');return e?e.innerText.replace(/\n/g,' | '):''})};
ok('no banner on empty app',(await banner('home'))==='');
await p.evaluate(()=>{const t=App.today();App.db.clients.push({id:'c1',code:'CL-1',type:'mat',first:'Jean',last:'K',name:'Jean K',phone:'1',created:t,subs:[]});App.db.products.push({id:'p1',name:'R',cat:'Routeurs',price:40,cost:25,qty:10,min:2});App.createInvoice({type:'materiel',clientId:'c1',currency:'USD',payMode:'Cash',date:App.today(),lines:[{pid:'p1',desc:'R',qty:1,price:40,cost:25}],payAmount:40},0);App.save()});
let t=await banner('home');ok('banner when never backed up',/Aucune sauvegarde faite/.test(t),t);
ok('banner on Finance too',/Aucune sauvegarde/.test(await banner('finance')));
ok('no banner on invoices (not a main screen)',(await banner('invoices'))==='');
await p.evaluate(()=>{App.db.settings.lastBackup=App.addDays(App.today(),-5);App.save()});t=await banner('home');ok('banner 5 days',/il y a 5 jours/.test(t),t);
await p.click('[data-act=bk_snooze]');await p.waitForTimeout(400);ok('snooze hides it today',(await banner('home'))==='');
await p.evaluate(()=>{delete App.db.settings.bkSnooze;App.db.settings.backupDays=7;App.save()});ok('threshold 7 days hides at 5',(await banner('home'))==='');
await p.evaluate(()=>{App.db.settings.backupDays=0;App.db.settings.lastBackup='';App.save()});ok('reminder off',(await banner('home'))==='');
await p.evaluate(()=>{delete App.db.settings.backupDays;App.save()});
// backup + verification
const dl=p.waitForEvent('download').catch(()=>null);await p.evaluate(()=>{navigator.canShare=undefined;});
await p.evaluate(()=>App.go('home'));await p.waitForTimeout(400);await p.click('.bkban [data-act=backup]');const d=await dl;await p.waitForTimeout(600);
ok('download produced',!!d);const toast=await p.evaluate(()=>(document.querySelector('#toast')||document.body).innerText);ok('toast says verified',/vérifiée ✔ \(1 clients, 1 factures\)/.test(toast),toast.slice(0,120).replace(/\n/g,' '));
ok('banner gone after backup',(await banner('home'))==='');
const good=await p.evaluate(()=>JSON.stringify(App.exportData()));
ok('verifyBackup ok on same data',await p.evaluate(t=>App.verifyBackup(t).ok,good));
ok('verifyBackup flags a truncated backup',await p.evaluate(t=>{const o=JSON.parse(t);o.invoices=[];return !App.verifyBackup(JSON.stringify(o)).ok},good));
// settings rows
await p.evaluate(()=>App.go('settings'));await p.waitForTimeout(600);await p.evaluate(()=>{const s=document.querySelector('details,.fold');});
const hasRows=await p.evaluate(()=>/Tester une sauvegarde/.test(document.body.innerHTML)&&!!document.getElementById('s_bkdays'));ok('settings rows present',hasRows);
await p.evaluate(()=>{const s=document.getElementById('s_bkdays');s.value='14';s.dispatchEvent(new Event('change',{bubbles:true}))});await p.waitForTimeout(200);ok('reminder delay saved',await p.evaluate(()=>App.db.settings.backupDays===14));
// test tool
const pick=async txt=>{const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.evaluate(()=>App.actions.bk_test())]);await fc.setFiles({name:'sauv.json',mimeType:'application/json',buffer:Buffer.from(txt)});await p.waitForTimeout(600);return p.innerText('dialog')};
let m=await pick(good);ok('same backup: lisible et à jour',/Lisible et à jour/.test(m),m.slice(0,200).replace(/\n/g,' '));ok('shows counts',/Factures[\s\S]*1 \/ 1/.test(m));
ok('nothing replaced by testing',await p.evaluate(()=>App.db.invoices.length===1));await p.keyboard.press('Escape');await p.waitForTimeout(300);
const old=await p.evaluate(t=>{const o=JSON.parse(t);o.invoices=[];o.payments=[];return JSON.stringify(o)},good);
m=await pick(old);ok('older backup flagged',/Plus ancienne/.test(m)&&/il manque/.test(m),m.slice(0,160).replace(/\n/g,' '));
await p.click('#dok');await p.waitForTimeout(800);ok('restore from tested file works',await p.evaluate(()=>App.db.invoices.length===0&&App.db.clients.length===1));
m=await pick('{"hello":1}');ok('garbage file rejected',/n'est pas une sauvegarde/.test(m));await p.keyboard.press('Escape');
m=await pick('pas du json');ok('non-json rejected',/n'est pas une sauvegarde/.test(m));await p.keyboard.press('Escape');
// vendeur: no banner, no test
await p.evaluate(()=>{App.db.settings.lastBackup='';App.db.settings.users=[{id:'v',name:'Vic',role:'vendeur',active:true,salt:'s',hash:'h'}];App.user=App.db.settings.users[0];App.applyRole&&App.applyRole();});
ok('vendeur sees no backup banner',(await banner('home'))==='');
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
