const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
// Amounts in words on the invoice use the Belgian / Congolese forms: septante, nonante (quatre-vingt stays).
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const p=await (await b.newContext()).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);
const W=await p.evaluate(()=>[70,71,72,75,77,79,90,91,92,99,80,81,85,60,61,69,170,190,200,280,1070,90000,70000,71000,95,10,16,17].map(n=>[n,App.words(n)]));
const exp={70:'septante',71:'septante et un',72:'septante-deux',75:'septante-cinq',77:'septante-sept',79:'septante-neuf',90:'nonante',91:'nonante et un',92:'nonante-deux',99:'nonante-neuf',80:'quatre-vingts',81:'quatre-vingt-un',85:'quatre-vingt-cinq',60:'soixante',61:'soixante et un',69:'soixante-neuf',170:'cent septante',190:'cent nonante',200:'deux cents',280:'deux cent quatre-vingts',1070:'mille septante',90000:'nonante mille',70000:'septante mille',71000:'septante et un mille',95:'nonante-cinq',10:'dix',16:'seize',17:'dix-sept'};
W.forEach(([n,w])=>ok(n+' -> '+exp[n],w===exp[n],w));
const A=await p.evaluate(()=>App.amountWords(70,'USD'));
ok('invoice amount in words uses septante and never soixante-dix / quatre-vingt-dix',/septante/i.test(A)&&!/soixante-dix|quatre-vingt-dix/.test(A),A);
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
