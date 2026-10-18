const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{const t=App.today();App.db.clients.push({id:'c1',code:'CL-1',type:'gere',first:'Anne',last:'Test',name:'Anne Test',phone:'',acc:'X1',start:t,period:30,grace:15,subs:[],created:t,note:''});App.save();App.go('client',{id:'c1'})});await p.waitForTimeout(500);
// a big "phone" photo (about 3000 px, noisy so that it weighs several hundred Ko)
const b64=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=3000;c.height=2200;const g=c.getContext('2d');for(let i=0;i<4000;i++){g.fillStyle=`rgb(${Math.random()*255|0},${Math.random()*255|0},${Math.random()*255|0})`;g.fillRect(Math.random()*3000,Math.random()*2200,40+Math.random()*200,40+Math.random()*200)}return c.toDataURL('image/jpeg',.95).split(',')[1]});
const buf=Buffer.from(b64,'base64');
ok('test photo is heavy',buf.length>500000,buf.length+' o');
ok('no photo yet: camera badge on the avatar',await p.evaluate(()=>!!document.querySelector('button.avatar.big.noph')));
await p.click('button.avatar.big');await p.waitForTimeout(300);
ok('photo dialog offers camera and gallery/Drive',(await p.innerText('#dlg')).includes('Prendre une photo')&&(await p.innerText('#dlg')).includes('Galerie ou Drive'));
const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.click('#dlg [data-act=ph_pick]:not([data-cam])')]);
ok('picker accepts images',await fc.isMultiple()===false);
await fc.setFiles({name:'IMG_1.jpg',mimeType:'image/jpeg',buffer:buf});await p.waitForTimeout(1500);
ok('client flagged with a photo',await p.evaluate(()=>App.client('c1').ph===1));
const st=await p.evaluate(()=>App.photo.stats());
ok('stored shrunk (< 150 Ko)',st.n===1&&st.bytes<150000&&st.bytes>2000,JSON.stringify(st));
ok('avatar shows the photo',await p.evaluate(()=>{const a=document.querySelector('button.avatar.big');return a.classList.contains('hasph')&&/blob:/.test(a.style.backgroundImage)}));
const dim=await p.evaluate(async()=>{const bm=await createImageBitmap(await App.photo.get('c1'));return Math.max(bm.width,bm.height)});
ok('longest side is 800 px',dim===800,String(dim));
// client list shows it too
await p.evaluate(()=>App.go('clients'));await p.waitForTimeout(700);
ok('list avatar shows the photo',await p.evaluate(()=>!!document.querySelector('#clist .avatar.hasph')));
// settings card + lighten
await p.evaluate(()=>{document.getElementById('view').insertAdjacentHTML('beforeend',App.photoCard())});await p.waitForTimeout(500);
ok('space counter filled',/1 photo · \d+ Ko/.test(await p.innerText('[data-phstats]')),await p.innerText('[data-phstats]'));
await p.evaluate(()=>App.actions.ph_shrink());await p.waitForTimeout(1500);
const st2=await p.evaluate(()=>App.photo.stats());
ok('lighten makes the photo smaller',st2.n===1&&st2.bytes<st.bytes,st.bytes+' -> '+st2.bytes);
const dim2=await p.evaluate(async()=>{const bm=await createImageBitmap(await App.photo.get('c1'));return Math.max(bm.width,bm.height)});
ok('lightened to 480 px',dim2===480,String(dim2));
// remove
await p.evaluate(()=>App.go('client',{id:'c1'}));await p.waitForTimeout(400);
await p.evaluate(()=>App.actions.ph_rm({id:'c1'}));await p.waitForTimeout(600);
ok('removed: flag and file gone',await p.evaluate(async()=>!App.client('c1').ph&&(await App.photo.stats()).n===0));
// deleting a client deletes the photo
await p.evaluate(async()=>{const bl=await (await fetch('icon-192.png')).blob();await App.photo.set('c1',bl);App.client('c1').ph=1;App.save()});
ok('photo stored again',await p.evaluate(async()=>(await App.photo.stats()).n===1));
await p.evaluate(()=>App.actions.delclient({id:'c1'}));await p.waitForTimeout(600);
ok('deleting the client deletes the photo',await p.evaluate(async()=>!App.client('c1')&&(await App.photo.stats()).n===0));
// clear all
await p.evaluate(async()=>{const t=App.today();App.db.clients.push({id:'c2',code:'CL-2',type:'mat',first:'B',last:'C',name:'B C',phone:'',subs:[],created:t,note:'',ph:1});const bl=await (await fetch('icon-192.png')).blob();await App.photo.set('c2',bl);App.actions.ph_clear()});await p.waitForTimeout(600);
ok('clear all removes every photo and flag',await p.evaluate(async()=>(await App.photo.stats()).n===0&&!App.client('c2').ph));
ok('no page errors',errs.length===0,errs.join('|'));
await b.close();console.log(f?`${f} FAIL`:'ALL PASS');process.exit(f?1:0)})();
