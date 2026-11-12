const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5'],acceptDownloads:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE + '/index.html');await p.waitForTimeout(600);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{const t=App.today();App.db.clients.push({id:'c1',code:'CL-1',type:'mat',first:'Jean',last:'Confidentiel',name:'Jean Confidentiel',phone:'1',created:t,subs:[]});App.save()});
// crypto round trip
const rt=await p.evaluate(async()=>{const e=await App.bkEncrypt('{"v":2,"x":"secret"}','motdepasse');return {enc:App.bkEncrypted(e),leak:/secret/.test(e),back:await App.bkDecrypt(e,'motdepasse'),bad:await App.bkDecrypt(e,'faux').then(()=>false,()=>true)}});
ok('encrypted text is recognised',rt.enc);ok('plain text not visible in ciphertext',!rt.leak);ok('right password decrypts',rt.back==='{"v":2,"x":"secret"}');ok('wrong password refused',rt.bad);
ok('plain backup is not flagged encrypted',await p.evaluate(()=>!App.bkEncrypted(JSON.stringify(App.exportData()))));
// settings row
await p.evaluate(()=>App.go('settings'));await p.waitForTimeout(600);
ok('settings offers to encrypt',await p.evaluate(()=>/Chiffrer les sauvegardes/.test(document.body.innerHTML)&&!!document.querySelector('[data-act=bk_enc_on]')));
// activation: short and mismatching passwords refused
await p.evaluate(()=>{App.actions.bk_enc_on()});await p.waitForTimeout(300);
await p.fill('#bk_pw','abc');await p.fill('#bk_pw2','abc');await p.click('#dok');await p.waitForTimeout(200);
ok('short password refused',await p.evaluate(()=>/6 caractères/.test(document.getElementById('bk_err').textContent)&&!App.db.settings.bkEnc));
await p.fill('#bk_pw','secret123');await p.fill('#bk_pw2','secret124');await p.click('#dok');await p.waitForTimeout(200);
ok('different confirmation refused',await p.evaluate(()=>/différents/.test(document.getElementById('bk_err').textContent)&&!App.db.settings.bkEnc));
await p.fill('#bk_pw','secret123');await p.fill('#bk_pw2','secret123');await p.click('#dok');await p.waitForTimeout(500);
ok('protection enabled',await p.evaluate(()=>App.db.settings.bkEnc===true));
ok('password is never stored',await p.evaluate(()=>!/secret123/.test(JSON.stringify(App.db))&&!/secret123/.test(JSON.stringify(Object.assign({},localStorage)))));
// file backup is encrypted
await p.evaluate(()=>{navigator.canShare=undefined});
const dl=p.waitForEvent('download');await p.evaluate(()=>App.actions.backup());const d=await dl;await p.waitForTimeout(500);
const txt=require('fs').readFileSync(await d.path(),'utf8');
ok('downloaded backup is encrypted',/cispolstore-enc1/.test(txt)&&!/Confidentiel/.test(txt));
ok('lastBackup updated',await p.evaluate(()=>App.db.settings.lastBackup===App.today()));
// restore in the same session: the password is remembered, no question
await p.evaluate(()=>{App.db.clients=[];App.save()});p.on('dialog',x=>x.accept());
await p.evaluate(t=>{App.restoreData(t)},txt);await p.waitForTimeout(900);
ok('same session: restores without asking again',await p.evaluate(()=>App.db.clients.length===1&&App.db.clients[0].name==='Jean Confidentiel'));
// new session (page reloaded): the password is asked, wrong then right
await p.reload();await p.waitForFunction(()=>window.App&&App.db);await p.waitForTimeout(400);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{App.db.clients=[];App.save()});
await p.evaluate(t=>{App.restoreData(t)},txt);await p.waitForTimeout(400);
ok('new session: restore asks the password',await p.evaluate(()=>!!document.getElementById('bk_pw')&&document.getElementById('dlg').open));
await p.fill('#bk_pw','mauvais1');await p.click('#dok');await p.waitForTimeout(600);
ok('wrong password asks again',await p.evaluate(()=>/incorrect/.test(document.getElementById('dlg').innerText)&&App.db.clients.length===0));
await p.fill('#bk_pw','secret123');await p.click('#dok');await p.waitForTimeout(900);
ok('right password restores the data',await p.evaluate(()=>App.db.clients.length===1&&App.db.clients[0].name==='Jean Confidentiel'));
// test tool also opens encrypted files
await p.evaluate(()=>{App.go('settings')});await p.waitForTimeout(400);
const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.evaluate(()=>App.actions.bk_test())]);await fc.setFiles({name:'sauv.json',mimeType:'application/json',buffer:Buffer.from(txt)});await p.waitForTimeout(600);
const m=await p.evaluate(()=>document.getElementById('dlg').innerText);
ok('test tool opens encrypted file (password remembered this session)',/Lisible|Test de la sauvegarde/.test(m),m.slice(0,80).replace(/\n/g,' '));
await p.keyboard.press('Escape');await p.waitForTimeout(200);
// automatic Drive backup never writes plain text when protection is on and no password in memory
const silent=await p.evaluate(async()=>{try{return {ok:true,t:await App.bkProtect('x',true)}}catch(e){return {ok:false,code:e.code}}});
ok('silent protect works while password is in memory',silent.ok);
await p.reload();await p.waitForFunction(()=>window.App&&App.db);await p.waitForTimeout(400);await p.click('[data-lk=skip]').catch(()=>{});
const silent2=await p.evaluate(async()=>{try{await App.bkProtect('x',true);return 'plain-or-enc'}catch(e){return e.code}});
ok('after reload, automatic backup is refused instead of writing plain text',silent2==='bkpass',String(silent2));
// disable
await p.evaluate(()=>App.go('settings'));await p.waitForTimeout(500);
await p.evaluate(()=>App.actions.bk_enc_off());await p.waitForTimeout(300);
ok('protection can be turned off',await p.evaluate(()=>App.db.settings.bkEnc===false));
ok('plain restore still works',await p.evaluate(async()=>await App.bkOpen('{"v":2}')==='{"v":2}'));
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
