// Administrative letters: a model is filled in a few seconds (recipient + 2-3 fields), the text is generated, editable,
// printable / PDF / WhatsApp, listed on the client's file. Fictitious data only.
const BASE = process.env.BASE_URL || 'http://localhost:8774';
const { chromium, devices } = require('playwright');let f=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(x?' '+x:''));if(!c)f++};
(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(BASE + '/index.html');await p.waitForTimeout(500);await p.click('[data-lk=skip]').catch(()=>{});
await p.evaluate(()=>{const t=App.today();App.db.clients.push({id:'cl1',code:'CL-L1',type:'gere',name:'Joseph Mbuyi',phone:'0810000011',address:'Av. du Test 12, Kinshasa',created:t,subs:[]});App.save();App.go('letters')});await p.waitForTimeout(400);
ok('the Lettres screen opens and is empty',/Aucune lettre/.test(await p.innerText('#view')));
ok('the menu offers « Lettres »',await p.evaluate(()=>{App.go('more');return true})&&(await p.waitForTimeout(300),/Lettres/.test(await p.innerText('#view'))));
await p.evaluate(()=>App.go('letters'));await p.waitForTimeout(300);
await p.click('[data-act=lt_new]');await p.waitForTimeout(400);
ok('all the models are offered',await p.evaluate(()=>[...document.querySelectorAll('#lt_type option')].length===Object.keys(App.letterTypes).length&&Object.keys(App.letterTypes).length>=12));
const create=async()=>{await p.evaluate(()=>{[...document.querySelectorAll('dialog button')].find(b=>/Créer la lettre/.test(b.textContent)).click()});await p.waitForTimeout(700)};
await create();ok('refuses without a recipient',await p.evaluate(()=>App.db.letters.length===0));
await p.selectOption('#lt_cl','cl1');await p.dispatchEvent('#lt_cl','change');await p.fill('#lf_ref','Facture FAC-2026-0042');await create();
ok('refuses a formal notice without an amount',await p.evaluate(()=>App.db.letters.length===0));
await p.fill('#lf_amount','150');await p.fill('#lf_days','5');await create();
let c=await p.evaluate(()=>App.db.letters[0]);
ok('created: numbered LET-YYYY-0001, linked to the client',c&&/^LET-\d{4}-0001$/.test(c.no)&&c.clientId==='cl1'&&c.type==='mise');
const t=await p.evaluate(()=>App.letterText(App.db.letters[0]));
ok('generated text: amount, reference, delay, subject',/150/.test(t.body)&&/FAC-2026-0042/.test(t.body)&&/5 jours/.test(t.body)&&/Mise en demeure/.test(t.subject),JSON.stringify(t));
ok('the detail window opens with print / PDF / WhatsApp',await p.isVisible('[data-act=lt_print]')&&await p.isVisible('[data-act=lt_pdf]')&&await p.isVisible('[data-act=lt_wa]'));
const html=await p.evaluate(()=>App.letterDoc(App.db.letters[0],'','stamp.png'));
ok('printable letter: recipient, subject, reference, signature block (Pour la société / Nom / Fonction / Signature et cachet)',/Joseph Mbuyi/.test(html)&&/Objet :<\/b><\/td><td[^>]*><b>Mise en demeure/.test(html)&&/LET-\d{4}-0001/.test(html)&&/Pour CISPOLstore|Pour /.test(html)&&/Signature et cachet/.test(html)&&/Fonction :/.test(html)&&/À l(?:'|&#39;)attention de :/.test(html)&&/Av\. du Test 12/.test(html));
// layout of the model letter (FONER): shifted recipient block, bold subject, indented greeting and first paragraph, standard closing, signature block on the right
ok('layout: shifted recipient (45 %), bold subject, indented greeting, first paragraph indented, closing formula added when missing',/margin:18px 0 0 45%/.test(html)&&/<b>Objet :<\/b>/.test(html)&&/margin:14px 0 6px 45%/.test(html)&&/text-indent:45%/.test(html)&&/salutations distinguées/.test(html)&&/margin:16px 0 0 62%/.test(html)&&/class="lsj"[^>]*width:58%/.test(html));
const subjHtml=await p.evaluate(()=>{const c=App.db.letters[0];c.subject='Réponse à la demande des prix n°028/FONER/CGPMP/2026 Fourniture d’une connexion internet pour l’Espace Grand Kasaï';const h=App.letterDoc(c,'','');delete c.subject;return h+'<style>'+App.docKit.DOC_CSS()+'</style>'});
const p2=await ctx.newPage();await p2.setContent('<body style="margin:0"><div style="width:794px">'+subjHtml+'</div></body>');
const sj=await p2.evaluate(()=>{const t=document.querySelector('.lsj'),r=t.getBoundingClientRect(),c=t.querySelectorAll('td')[1],h=parseFloat(getComputedStyle(c).lineHeight)||16;return{w:r.width,page:document.querySelector('.paper').getBoundingClientRect().width,lines:Math.round(c.getBoundingClientRect().height/h)}});await p2.close();
ok('a long subject wraps near the middle of the page instead of one very long line',sj.w<sj.page*0.62&&sj.lines>=2,JSON.stringify(sj));
const lay=await p.evaluate(()=>{const c=App.db.letters[0];c.body='Madame, Monsieur,\n\nIntro.\n\n# Nos avantages :\n\n1. **Rappel** — texte un.\n2. **Dépannage** — texte deux.\n\nVeuillez agréer, Madame, Monsieur, nos salutations.';c.rep='Marie Test, Directrice';const h=App.letterDoc(c,'','');delete c.body;return h});
ok('headings (#) in bold, numbered list with bold lead-ins, closing shifted and not duplicated, Nom / Fonction filled from « Signée par »',/<b>Nos avantages :<\/b>/.test(lay)&&/<table class="ltl">/.test(lay)&&/<b>Rappel<\/b>/.test(lay)&&/margin:6px 0 14px 45%/.test(lay)&&(lay.match(/salutations/g)||[]).length===1&&/Nom : Marie Test/.test(lay)&&/Fonction : Directrice/.test(lay));
// edit the text by hand
await p.evaluate(()=>App.actions.lt_text({id:App.db.letters[0].id}));await p.waitForTimeout(500);
await p.fill('#lt_body','Premier paragraphe modifié.\n\nSecond paragraphe.');await p.evaluate(()=>{[...document.querySelectorAll('dialog button')].find(b=>/Enregistrer/.test(b.textContent)).click()});await p.waitForTimeout(500);
ok('the text can be edited by hand and is kept',await p.evaluate(()=>App.letterText(App.db.letters[0]).body==='Premier paragraphe modifié.\n\nSecond paragraphe.')&&/Second paragraphe/.test(await p.evaluate(()=>App.letterDoc(App.db.letters[0],'',''))));
// free recipient + another model
await p.evaluate(()=>{App.close();App.letterForm(null)});await p.waitForTimeout(300);
await p.selectOption('#lt_type','travail');await p.waitForTimeout(250);
ok('for an employee letter the client chooser is hidden and a name is asked',!(await p.isVisible('#lt_cl'))&&await p.isVisible('#lt_pname'));
await p.fill('#lt_pname','Marie Test');await p.fill('#lf_job','Technicienne');await p.fill('#lf_since','2025-03-01');await create();
const w=await p.evaluate(()=>App.db.letters[1]);
ok('second letter numbered 0002, free recipient, text mentions the job',await p.evaluate(()=>{const w=App.db.letters[1],t=App.letterText(w).body;return /-0002$/.test(w.no)&&!w.clientId&&w.party.name==='Marie Test'&&/Technicienne/.test(t)&&/Marie Test/.test(t)}));
// payment receipt in CDF
await p.evaluate(()=>{App.close();App.letterForm(null,'cl1')});await p.waitForTimeout(300);
await p.selectOption('#lt_type','quittance');await p.waitForTimeout(250);await p.selectOption('#lt_cur','CDF');await p.fill('#lf_amount','50000');await create();
ok('receipt in francs: amount written in letters',await p.evaluate(()=>/cinquante mille/i.test(App.letterText(App.db.letters[2]).body)&&/CDF|FC/.test(App.letterText(App.db.letters[2]).body)));
// the client's sheet lists the client's letters
await p.evaluate(()=>{App.close();App.go('client',{id:'cl1'})});await p.waitForTimeout(400);await p.evaluate(()=>{const b=[...document.querySelectorAll('[data-act=cltab]')].find(x=>x.dataset.t==='fac'||/Factures/.test(x.textContent));if(b)b.click()});await p.waitForTimeout(400);
ok('the client sheet shows its 2 letters',(await p.innerText('#view')).match(/LET-\d{4}-000[13]/g)?.length>=2);
// WhatsApp opens with the client's number
await p.evaluate(()=>{window.__w=[];window.open=u=>{window.__w.push(u)}});await p.evaluate(()=>App.actions.lt_wa({id:App.db.letters[0].id}));
ok('WhatsApp link goes to the client\'s number',await p.evaluate(()=>/wa\.me\/\d+/.test(window.__w[0]||'')));
// duplicate and delete
await p.evaluate(()=>App.actions.lt_dup({id:App.db.letters[0].id}));ok('duplicate gets the next number',await p.evaluate(()=>App.db.letters.length===4&&/-0004$/.test(App.db.letters[3].no)));
await p.evaluate(()=>App.actions.lt_del({id:App.db.letters[3].id}));ok('delete removes it',await p.evaluate(()=>App.db.letters.length===3));
// letter to an authority (« À l'Honorable… »): same letterhead as the contracts and invoices
await p.evaluate(()=>{App.close();App.letterForm(null)});await p.waitForTimeout(300);
await p.selectOption('#lt_type','arrieres');await p.waitForTimeout(250);
ok('authority model: asks for the greeting, number of kits, amount, delay and the copy line',await p.inputValue('#lf_titre')==="À l'Honorable"&&await p.inputValue('#lf_appel')==='Honorable'&&await p.isVisible('#lf_kits')&&await p.isVisible('#lf_amount')&&await p.inputValue('#lf_days')==='8'&&/^Archives /.test(await p.inputValue('#lf_copy')));
await p.fill('#lt_pname','Francis ILUNGA');await p.fill('#lt_paddr','Territoire de Kole, Province du Sankuru');await p.fill('#lt_rep','Test Gérant, Gérant');
await p.fill('#lf_kits','17');await p.fill('#lf_place','dans le territoire de Kole');await p.fill('#lf_period','3 mois');await p.fill('#lf_amount','1190');await create();
const h=await p.evaluate(()=>{const c=App.db.letters[3];return{html:App.letterDoc(c,'logo.png','stamp.png'),text:App.letterText(c),head:App.docKit.head(App.db.settings.company,'logo.png'),ct:(()=>{App.db.contracts.push({id:'x',type:'libre',clientId:'',party:{name:'Z'},date:App.today(),start:App.today(),months:0,end:'',currency:'USD',rep:'',f:{body:'Texte',title:'T'},body:'Texte',no:'CTR-2026-0001',status:'draft'});return App.contractDoc(App.db.contracts[0],'logo.png','stamp.png')})()}});
ok('recipient line « À l\'Honorable Francis ILUNGA », address, subject, N/Réf',/À l(?:'|&#39;|&apos;)Honorable Francis ILUNGA/.test(h.html)&&/Territoire de Kole/.test(h.html)&&/Objet :<\/b><\/td><td[^>]*><b>Non-paiement des abonnements Starlink/.test(h.html)&&/N\/Réf : LET-\d{4}-0004\//.test(h.html),JSON.stringify([/À l'Honorable Francis ILUNGA/.test(h.html),/Territoire de Kole/.test(h.html),/Objet : Non-paiement/.test(h.html),(h.html.match(/N.Réf[^<]*/)||[])[0]]));
ok('text: 17 kits, Kole, amount, the three points, closing formula, copy line',/17 kits Starlink/.test(h.text.body)&&/territoire de Kole/.test(h.text.body)&&/1\s190/.test(h.text.body)&&/^1\. /m.test(h.text.body)&&/^3\. /m.test(h.text.body)&&/très haute considération/.test(h.text.body)&&/Copie pour information : Archives/.test(h.html));
ok('same letterhead as the contracts and invoices (same document header)',h.html.includes(h.head)&&h.ct.includes(h.head));
ok('the signer is remembered for the next letter',await p.evaluate(()=>{App.letterForm(null);return document.getElementById('lt_rep').value==='Test Gérant, Gérant'}));
// « Autorités » category: the three official-letter models, with their own filter and counter
await p.evaluate(()=>{App.go('letters')});await p.waitForTimeout(400);
ok('authority models are in the « Autorités » category, the others are not',await p.evaluate(()=>['autorite','arrieres','demande'].every(k=>App.letterTypes[k].cat==='auth')&&['travail','convocation','avertissement','libre'].every(k=>App.letterTypes[k].cat==='person')&&App.letterTypes.mise.cat==='client'));
ok('the list has an « Autorités » filter and an « autorités » counter',/Autorités/.test(await p.innerText('.chips'))&&/autorités/.test(await p.innerText('.cstats')));
await p.evaluate(()=>{App.actions.lt_f({f:'auth'})});await p.waitForTimeout(300);
ok('the Autorités filter shows only the letter to the Honorable (1 of 4)',await p.evaluate(()=>document.querySelectorAll('#view .list .item').length===1)&&/Francis ILUNGA/.test(await p.innerText('#view .list')));
await p.evaluate(()=>{App.actions.lt_f({f:'all'})});
// model « Réponse à une demande de prix » (letter to FONER): in the Autorités category, advantages as a numbered list with bold lead-ins
await p.evaluate(()=>{App.close();App.letterForm(null)});await p.waitForTimeout(300);
await p.selectOption('#lt_type','prix');await p.waitForTimeout(250);
await p.fill('#lt_pname','FONDS NATIONAL D\'ENTRETIEN ROUTIER (FONER)');await p.fill('#lt_paddr','CGPMP — Tour D, Croisement OUA-Massamba, Ngaliema, Kinshasa');
await p.fill('#lf_ref','n°028/FONER/CGPMP/2026');await p.fill('#lf_about','Fourniture d\'une connexion internet pour l\'Espace Grand Kasaï');await create();
const px=await p.evaluate(()=>{const c=App.db.letters[App.db.letters.length-1];return{cat:App.letterTypes[c.type].cat,t:App.letterText(c),html:App.letterDoc(c,'','')}});
ok('FONER model: category Autorités, subject with the request number and the object',px.cat==='auth'&&/^Réponse à la demande des prix n°028\/FONER\/CGPMP\/2026 – Fourniture d/.test(px.t.subject),px.t.subject);
ok('body: « Nos avantages » (4 numbered points) and « Notre engagement », pro-forma mentioned, standard closing',/# Nos avantages :/.test(px.t.body)&&(px.t.body.match(/^\d\. \*\*/gm)||[]).length===4&&/# Notre engagement :/.test(px.t.body)&&/ci-joint notre facture pro-forma/.test(px.t.body)&&/salutations distinguées/.test(px.t.body));
ok('printed: attention block, bold headings and list, same layout',/À l(?:'|&#39;)attention de :/.test(px.html)&&/<b>Nos avantages :<\/b>/.test(px.html)&&/<b>Rappel d(?:'|&#39;)échéance<\/b>/.test(px.html)&&/<b>Notre engagement :<\/b>/.test(px.html));
// model « Décharge de responsabilité – matériel installé » : presentation of the company, 3+ months unpaid, responsibility declined for the equipment
await p.evaluate(()=>{App.close();App.letterForm(null)});await p.waitForTimeout(300);
await p.selectOption('#lt_type','decharge_mat');await p.waitForTimeout(250);
ok('the model asks for kits, place, months (3 by default), optional amount and delay',await p.isVisible('#lf_kits')&&await p.inputValue('#lf_months')==='3'&&await p.isVisible('#lf_amount')&&await p.isVisible('#lt_cur')&&await p.inputValue('#lf_days')==='8');
await p.fill('#lt_pname','Francis ILUNGA');await p.fill('#lt_paddr','Territoire de Kole, Province du Sankuru');await p.fill('#lf_kits','17');await p.fill('#lf_place','dans le territoire de Kole');await create();
const dm=await p.evaluate(()=>{const c=App.db.letters[App.db.letters.length-1];return{cat:App.letterTypes[c.type].cat,t:App.letterText(c),html:App.letterDoc(c,'','')}});
ok('created without an amount (optional), in the Autorités category',dm.cat==='auth'&&!/montant total/.test(dm.t.body));
ok('the letter presents the company (« est une société spécialisée dans la vente et l\'installation de kits Starlink »)',/est une société spécialisée dans la vente et l'installation de kits Starlink/.test(dm.t.body));
ok('17 kits installed in Kole, more than 3 months later the subscriptions are still unpaid',/17 kits Starlink que nos équipes ont installés dans le territoire de Kole/.test(dm.t.body)&&/plus de 3 mois après cette installation.*ne sont toujours pas payés/.test(dm.t.body));
ok('declines all responsibility for the equipment and for the service interruption; payment is the subscriber\'s',/décline toute responsabilité relative au matériel installé/.test(dm.t.body)&&/décline toute responsabilité quant à la suspension/.test(dm.t.body)&&/relève exclusivement du souscripteur/.test(dm.t.body)&&/très haute considération/.test(dm.t.body));
ok('printed with the Honorable line and the numbered points',/À l(?:'|&#39;)Honorable Francis ILUNGA/.test(dm.html)&&/class="ltl"/.test(dm.html)&&/Décharge de responsabilité de/.test(dm.html));
await p.evaluate(()=>{const c=App.db.letters[App.db.letters.length-1];c.f.amount=1190;});
ok('an amount, when given, is written in the letter',await p.evaluate(()=>/pour un montant total de 1\s190/.test(App.letterText(App.db.letters[App.db.letters.length-1]).body)));
// « Ordre de mission »: who goes where, when, why, transport, expenses; no courtesy closing formula
await p.evaluate(()=>{App.close();App.letterForm(null)});await p.waitForTimeout(300);
await p.selectOption('#lt_type','mission');await p.waitForTimeout(250);
ok('mission order asks for job, destination, purpose, dates (today +3 days by default), transport, companion and expenses',await p.isVisible('#lf_job')&&await p.isVisible('#lf_place')&&await p.isVisible('#lf_why')&&await p.inputValue('#lf_from')===await p.evaluate(()=>App.today())&&await p.inputValue('#lf_to')===await p.evaluate(()=>App.addDays(App.today(),3))&&await p.inputValue('#lf_transport')==='Véhicule de la société'&&await p.isVisible('#lf_team')&&await p.isVisible('#lf_amount')&&await p.isVisible('#lt_cur'));
await p.fill('#lt_pname','Marie Test');await p.fill('#lf_place','Kole, province du Sankuru');await p.fill('#lf_team','Jean Essai, aide-technicien');await p.fill('#lf_amount','200');await p.selectOption('#lt_cur','USD');await create();
const om=await p.evaluate(()=>{const c=App.db.letters[App.db.letters.length-1];return{t:App.letterText(c),html:App.letterDoc(c,'','')}});
ok('subject and order: names the person, job, destination, purpose',/^Ordre de mission – Kole, province du Sankuru$/.test(om.t.subject)&&/ordonnons à Marie Test, Technicien, de se rendre à Kole, province du Sankuru du /.test(om.t.body)&&/en vue de : Installation et maintenance de kits Starlink/.test(om.t.body));
ok('transport, companion and expenses (200 $, borne by the company) as numbered points',/^1\. \*\*Moyen de transport\*\* — Véhicule de la société ;/m.test(om.t.body)&&/^2\. \*\*Accompagné\(e\) de\*\* — Jean Essai/m.test(om.t.body)&&/^3\. \*\*Frais de mission\*\* — 200\s\$, pris en charge par/m.test(om.t.body));
ok('authorities asked to assist; valid for the duration of the mission',/autorités civiles, militaires et coutumières sont priées/.test(om.t.body)&&/valable pour la durée de la mission/.test(om.t.body));
ok('no courtesy closing formula added to an order, but the signature block is there',!/salutations distinguées/.test(om.html)&&/Signature et cachet/.test(om.html)&&/<b>Moyen de transport<\/b>/.test(om.html));
await p.evaluate(()=>{const c=App.db.letters[App.db.letters.length-1];c.f.team='';c.f.amount='';});
ok('without a companion or expenses the points renumber (1 transport, 2 expenses « selon les modalités convenues »)',await p.evaluate(()=>{const b=App.letterText(App.db.letters[App.db.letters.length-1]).body;return /^1\. \*\*Moyen de transport/m.test(b)&&/^2\. \*\*Frais de mission\*\* — selon les modalités convenues/m.test(b)&&!/Accompagné/.test(b)}));
ok('backup and sync know the letters',await p.evaluate(()=>JSON.stringify(App.db).includes('"letters"')));
ok('no page errors',errs.length===0,errs.join('|'));await b.close();process.exit(f?1:0)})();
