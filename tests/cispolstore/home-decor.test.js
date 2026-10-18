const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>App.go('home'));await p.waitForTimeout(500);
const img=async seed=>Buffer.from(await p.evaluate(s=>{const c=document.createElement('canvas');c.width=3000;c.height=2200;const g=c.getContext('2d');let r=s;const rnd=()=>(r=(r*16807)%2147483647)/2147483647;for(let i=0;i<4000;i++){g.fillStyle=`rgb(${rnd()*255|0},${rnd()*255|0},${rnd()*255|0})`;g.fillRect(rnd()*3000,rnd()*2200,40+rnd()*200,40+rnd()*200)}return c.toDataURL('image/jpeg',.95).split(',')[1]},seed),'base64');
const heroCls=()=>p.evaluate(()=>document.querySelector('#view .hero').className);
ok('default decor: no extra class',!/decor-/.test(await heroCls()));
// built-in scenes
for(const d of ['sunset','night','aurora']){await p.evaluate(d=>App.actions.decor_set({d}),d);await p.waitForTimeout(300);ok('scene '+d+' on the card',(await heroCls()).includes('decor-'+d)&&await p.evaluate(d=>App.db.settings.decor===d,d))}
// bundled Starlink photos
await p.evaluate(()=>App.actions.decor_set({d:'starlink'}));await p.waitForTimeout(1500);
await p.waitForTimeout(500);
ok('Starlink decor: small photo cards pass over the card (not one big photo)',await p.evaluate(()=>{const h=document.querySelector('#view .hero'),t=[...h.querySelectorAll('.hbg .hcard')];if(!t.length)return false;const hw=h.getBoundingClientRect().width;return h.classList.contains('decor-starlink')&&t.every(x=>x.getBoundingClientRect().width<hw*0.6)&&t.every(x=>/photos\/starlink-\d\.jpg/.test(x.style.backgroundImage))}));
// every direction really moves the cards the right way
const snap=()=>p.evaluate(()=>{const h=document.querySelector('.hero').getBoundingClientRect();return [...document.querySelectorAll('.hero .hcard')].map(c=>{const r=c.getBoundingClientRect();return {x:r.x+r.width/2-h.x-h.width/2,y:r.y+r.height/2-h.y-h.height/2,ok:r.right>h.x&&r.left<h.right&&r.bottom>h.y&&r.top<h.bottom}})});
for(const dir of ['ltr','rtl','ttb','btt','center']){await p.evaluate(d=>App.photo.next(d),dir);await p.waitForTimeout(1500);const a1=await snap();await p.waitForTimeout(350);const a2=await snap();
 let dx=0,dy=0,dist=0,n=0;a1.forEach((c,i)=>{const d=a2[i];if(d&&c.ok&&d.ok){dx+=d.x-c.x;dy+=d.y-c.y;dist+=Math.hypot(d.x,d.y)-Math.hypot(c.x,c.y);n++}});
 const good=n>0&&(dir==='ltr'?dx>0&&Math.abs(dx)>Math.abs(dy):dir==='rtl'?dx<0&&Math.abs(dx)>Math.abs(dy):dir==='ttb'?dy>0&&Math.abs(dy)>Math.abs(dx):dir==='btt'?dy<0&&Math.abs(dy)>Math.abs(dx):dist>0);
 ok('direction '+dir+': the cards move the right way',good,`n=${n} dx=${dx.toFixed(0)} dy=${dy.toFixed(0)} dist=${dist.toFixed(0)}`)}
// the direction is drawn at random, never twice in a row
await p.evaluate(()=>{App.photo.dirs.length=0;for(let i=0;i<16;i++)App.photo.next()});
const dirs=await p.evaluate(()=>App.photo.dirs.slice());
ok('random directions: at least 4 different kinds in 16 passes',new Set(dirs).size>=4,dirs.join(','));
ok('never the same direction twice in a row',dirs.every((d,i)=>i===0||d!==dirs[i-1]));
ok('bundled photos are light (< 300 Ko in total) and all load',await p.evaluate(async()=>{let t=0;for(let i=1;i<=4;i++){const r=await fetch('photos/starlink-'+i+'.jpg');if(!r.ok)return false;t+=(await r.blob()).size}return t<300000}));
await p.evaluate(()=>App.actions.decor_set({d:'aurora'}));await p.waitForTimeout(300);
// photos need a photo first
await p.evaluate(()=>App.actions.decor_set({d:'photos'}));await p.waitForTimeout(200);
ok('"Mes photos" refused without a photo',await p.evaluate(()=>App.db.settings.decor==='aurora'));
// the settings card
await p.evaluate(()=>{document.getElementById('view').insertAdjacentHTML('beforeend',App.photoCard())});await p.waitForTimeout(400);
ok('card offers camera and gallery/Drive',(await p.innerText('#view')).includes('Prendre une photo')&&(await p.innerText('#view')).includes('Galerie ou Drive'));
ok('card shows the six decors',(await p.$$('#view [data-act=decor_set]')).length===6);
// add a first photo
const b1=await img(7);ok('test photo is heavy',b1.length>500000,b1.length+' o');
const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.click('#view [data-act=ph_add]:not([data-cam])')]);
await fc.setFiles({name:'IMG_1.jpg',mimeType:'image/jpeg',buffer:b1});await p.waitForTimeout(1800);
ok('photo added and "Mes photos" selected',await p.evaluate(()=>App.db.settings.bgs.length===1&&App.db.settings.decor==='photos'));
const st=await p.evaluate(()=>App.photo.stats());ok('stored shrunk (< 250 Ko)',st.n===1&&st.bytes<250000&&st.bytes>5000,JSON.stringify(st));
const dim=await p.evaluate(async()=>{const bm=await createImageBitmap(await App.photo.get(App.db.settings.bgs[0]));return Math.max(bm.width,bm.height)});ok('longest side is 1280 px',dim===1280,String(dim));
await p.evaluate(()=>App.go('home'));await p.waitForTimeout(1800);
ok('user photo shown on a card behind the animation',await p.evaluate(()=>{const h=document.querySelector('#view .hero'),bg=h.querySelector('.hbg'),sk=h.querySelector('.hsky');return !!bg&&/blob:/.test(bg.querySelector('.hcard').style.backgroundImage)&&(!sk||+getComputedStyle(sk).zIndex>+getComputedStyle(bg).zIndex)}));
ok('hero text above the photo and clickable',await p.evaluate(()=>{const n=document.querySelector('.hero .hero-num'),r=n.getBoundingClientRect(),e=document.elementFromPoint(r.x+4,r.y+4);return !e.closest('.hbg')&&!e.classList.contains('hsky')}));
// second photo -> slideshow
const b2=await img(99);await p.evaluate(()=>{document.getElementById('view').insertAdjacentHTML('beforeend',App.photoCard())});await p.waitForTimeout(300);
const [fc2]=await Promise.all([p.waitForEvent('filechooser'),p.click('#view [data-act=ph_add]:not([data-cam])')]);await fc2.setFiles({name:'IMG_2.jpg',mimeType:'image/jpeg',buffer:b2});await p.waitForTimeout(1800);
ok('two photos stored',await p.evaluate(()=>App.db.settings.bgs.length===2));
await p.evaluate(()=>App.go('home'));await p.waitForTimeout(1200);
ok('with two photos, cards show them in turn',await p.evaluate(()=>{const us=[...document.querySelectorAll('.hero .hcard')].map(x=>x.style.backgroundImage);return us.length>=2&&us.every(u=>/blob:/.test(u))}));
// lighten
const before=(await p.evaluate(()=>App.photo.stats())).bytes;
await p.evaluate(()=>App.actions.ph_shrink());await p.waitForTimeout(2500);
const after=(await p.evaluate(()=>App.photo.stats())).bytes;ok('lighten makes them smaller',after<before,before+' -> '+after);
const dim2=await p.evaluate(async()=>{const bm=await createImageBitmap(await App.photo.get(App.db.settings.bgs[0]));return Math.max(bm.width,bm.height)});ok('lightened to 800 px',dim2===800,String(dim2));
// delete one, then the last one -> back to the default decor
await p.evaluate(()=>App.photo.del(App.db.settings.bgs[0]));ok('one photo left',await p.evaluate(()=>App.db.settings.bgs.length===1));
await p.evaluate(()=>App.actions.ph_del({id:App.db.settings.bgs[0]}));await p.waitForTimeout(800);
ok('no photo left: default decor, nothing stored',await p.evaluate(async()=>App.db.settings.decor==='def'&&(await App.photo.stats()).n===0));
await p.evaluate(()=>App.go('home'));await p.waitForTimeout(500);
ok('card back to normal',!(await heroCls()).includes('decor-')&&await p.evaluate(()=>!document.querySelector('.hero .hbg')));
// clear all
await p.evaluate(async()=>{const bl=await (await fetch('icon-192.png')).blob();await App.photo.add(bl);await App.photo.add(bl);App.db.settings.decor='photos';await App.actions.ph_clear()});await p.waitForTimeout(800);
ok('clear all',await p.evaluate(async()=>(await App.photo.stats()).n===0&&App.db.settings.bgs.length===0&&App.db.settings.decor==='def'));
// 8 photos at most
let opened=false;p.once('filechooser',()=>{opened=true});await p.evaluate(()=>{App.db.settings.bgs=Array.from({length:8},(_, i)=>'x'+i)});await p.evaluate(()=>App.actions.ph_add({}));await p.waitForTimeout(600);
ok('limit of 8 photos: the picker does not open',!opened);
ok('no page errors',errs.length===0,errs.join('|'));
await b.close();console.log(f?`${f} FAIL`:'ALL PASS');process.exit(f?1:0)})();
