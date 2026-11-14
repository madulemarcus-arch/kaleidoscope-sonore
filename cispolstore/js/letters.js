// Administrative letters: numbered LET-YYYY-NNNN, generated from a ready-made model that is filled in a few seconds
// (recipient, date, one or two fields), editable, printable / PDF / WhatsApp, kept in the client's file.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const list = () => (App.db.letters = App.db.letters || []);
  const st = { f: 'all' };
  const CUR = [['USD', 'Dollar ($)'], ['CDF', 'Franc congolais (CDF)']];
  const money = (n, cur) => App.docKit.money(n, cur === 'CDF' ? 'CDF' : 'USD');
  const co = () => App.db.settings.company;
  const city = () => co().city || 'Kinshasa';

  // ---------- models ----------
  // f: quick fields [key, label, kind(text|num|date|area), default] ; subject(c) and body(c) build the text from c (c.f = the fields, c.cur = currency)
  const d = (c, k) => c.f[k] ? App.fdate(c.f[k]) : '…';
  const TYPES = {
    mise: { label: 'Mise en demeure de payer', icon: '⚠️', cat: 'client', money: true,
      f: [['ref', 'Facture / référence', 'text', ''], ['amount', 'Montant dû', 'num', ''], ['days', 'Délai accordé (jours)', 'num', 8]],
      subject: c => `Mise en demeure de payer${c.f.ref ? ' – ' + c.f.ref : ''}`,
      body: c => `Madame, Monsieur,\n\nSauf erreur de notre part, la somme de ${money(c.f.amount, c.cur)}${c.f.ref ? ` au titre de ${c.f.ref}` : ''} reste due à ce jour malgré nos précédents rappels.\n\nNous vous mettons donc en demeure de régler cette somme dans un délai de ${c.f.days || 8} jours à compter de la réception de la présente.\n\nÀ défaut, nous serons contraints de suspendre le service et d'engager les démarches de recouvrement utiles, sans autre avis.\n\nNous restons à votre disposition pour convenir d'un échéancier si vous rencontrez une difficulté.` },
    relance: { label: 'Rappel de paiement (amiable)', icon: '💬', cat: 'client', money: true,
      f: [['ref', 'Facture / référence', 'text', ''], ['amount', 'Montant dû', 'num', ''], ['due', 'Échéance', 'date', '']],
      subject: c => `Rappel de paiement${c.f.ref ? ' – ' + c.f.ref : ''}`,
      body: c => `Madame, Monsieur,\n\nNous nous permettons de vous rappeler que ${c.f.ref ? `la facture ${c.f.ref}` : 'votre facture'}, d'un montant de ${money(c.f.amount, c.cur)}, était à régler${c.f.due ? ` le ${d(c, 'due')}` : ''}.\n\nSi votre règlement a été effectué entre-temps, nous vous prions de ne pas tenir compte de ce courrier. Dans le cas contraire, nous vous remercions de bien vouloir y procéder dès que possible.\n\nNous vous remercions de votre confiance.` },
    quittance: { label: 'Reçu / attestation de paiement', icon: '🧾', cat: 'client', money: true,
      f: [['amount', 'Montant reçu', 'num', ''], ['paid', 'Date du paiement', 'date', ''], ['mode', 'Mode de paiement', 'text', 'Espèces'], ['object', 'Pour', 'text', 'abonnement Internet']],
      subject: () => 'Attestation de paiement',
      body: c => `Nous soussignés, ${co().name}, attestons avoir reçu de ${c.who.name}, le ${d(c, 'paid')}, la somme de ${money(c.f.amount, c.cur)} (${App.amountWords(c.f.amount, c.cur === 'CDF' ? 'CDF' : 'USD').toLowerCase()}), par ${c.f.mode || 'paiement'}, pour ${c.f.object || 'le service fourni'}.\n\nLa présente attestation est délivrée pour servir et valoir ce que de droit.` },
    service: { label: 'Attestation d\'abonnement / de service', icon: '📡', cat: 'client',
      f: [['since', 'Abonné depuis le', 'date', ''], ['plan', 'Formule', 'text', ''], ['site', 'Adresse d\'installation', 'text', '']],
      subject: () => 'Attestation de service',
      body: c => `Nous soussignés, ${co().name}, attestons que ${c.who.name}${c.who.address ? `, domicilié(e) à ${c.who.address}` : ''}, est abonné(e) à notre service d'accès Internet${c.f.plan ? ` (formule ${c.f.plan})` : ''}${c.f.since ? ` depuis le ${d(c, 'since')}` : ''}${c.f.site ? `, installé à ${c.f.site}` : ''}.\n\nLe service est à jour à la date de la présente.\n\nLa présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.` },
    suspension: { label: 'Avis de suspension du service', icon: '⛔', cat: 'client',
      f: [['on', 'Date de suspension', 'date', ''], ['reason', 'Motif', 'text', 'non-paiement de l\'abonnement'], ['amount', 'Montant à régler (facultatif)', 'num', '']],
      subject: () => 'Avis de suspension du service',
      body: c => `Madame, Monsieur,\n\nNous vous informons que votre service sera suspendu à compter du ${d(c, 'on')}, pour le motif suivant : ${c.f.reason || '…'}.${c.f.amount > 0 ? `\n\nPour le rétablir, il vous suffit de régler la somme de ${money(c.f.amount, c.cur)}.` : ''}\n\nLe service sera rétabli dès que votre situation sera régularisée.\n\nNous restons à votre écoute.` },
    resiliation: { label: 'Confirmation de résiliation', icon: '🏁', cat: 'client',
      f: [['on', 'Date de fin du service', 'date', ''], ['note', 'Remarque (facultatif)', 'text', '']],
      subject: () => 'Confirmation de résiliation de votre abonnement',
      body: c => `Madame, Monsieur,\n\nNous accusons réception de votre demande et confirmons la résiliation de votre abonnement à compter du ${d(c, 'on')}.${c.f.note ? '\n\n' + c.f.note : ''}\n\nNous vous remercions de la confiance que vous nous avez accordée et restons à votre disposition si vous souhaitez reprendre le service.` },
    echeancier: { label: 'Accord d\'échéancier de paiement', icon: '🗓️', cat: 'client', money: true,
      f: [['amount', 'Montant total dû', 'num', ''], ['count', 'Nombre de versements', 'num', 3], ['first', 'Premier versement le', 'date', '']],
      subject: () => 'Accord d\'échéancier de paiement',
      body: c => `Madame, Monsieur,\n\nSuite à votre demande, nous acceptons que vous régliez la somme de ${money(c.f.amount, c.cur)} en ${c.f.count || 1} versement(s)${c.f.count > 0 && c.f.amount > 0 ? ` d'environ ${money(Math.round(c.f.amount / c.f.count * 100) / 100, c.cur)} chacun` : ''}, le premier le ${d(c, 'first')}, puis à intervalles réguliers d'un mois.\n\nLe service est maintenu tant que les échéances sont respectées. En cas de retard, le solde deviendra immédiatement exigible.\n\nMerci de nous confirmer votre accord en retournant la présente signée.` },
    bienvenue: { label: 'Lettre de bienvenue', icon: '👋', cat: 'client',
      f: [['plan', 'Formule', 'text', ''], ['site', 'Adresse d\'installation', 'text', '']],
      subject: () => 'Bienvenue',
      body: c => `Madame, Monsieur,\n\nNous vous souhaitons la bienvenue parmi nos clients${c.f.plan ? ` et vous confirmons votre abonnement à la formule ${c.f.plan}` : ''}${c.f.site ? `, installée à ${c.f.site}` : ''}.\n\nPour toute question ou assistance, vous pouvez nous joindre${co().phone ? ' au ' + co().phone : ''}.\n\nNous vous remercions de votre confiance.` },
    decharge: { label: 'Décharge de remise de matériel', icon: '📦', cat: 'client',
      f: [['items', 'Matériel remis', 'area', ''], ['on', 'Date de remise', 'date', '']],
      subject: () => 'Décharge de remise de matériel',
      body: c => `Je soussigné(e), ${c.who.name}${c.who.phone ? ` (tél. ${c.who.phone})` : ''}, reconnais avoir reçu de ${co().name}, le ${d(c, 'on')}, le matériel suivant, en bon état :\n\n${c.f.items || '…'}\n\nJe m'engage à en prendre soin.` },
    travail: { label: 'Attestation de travail', icon: '👔', cat: 'person',
      f: [['job', 'Fonction', 'text', ''], ['since', 'Employé(e) depuis le', 'date', ''], ['until', 'Jusqu\'au (vide = toujours en poste)', 'date', '']],
      subject: () => 'Attestation de travail',
      body: c => `Nous soussignés, ${co().name}, attestons que ${c.who.name} ${c.f.until ? 'a travaillé' : 'travaille'} au sein de notre société en qualité de ${c.f.job || '…'}${c.f.since ? ` depuis le ${d(c, 'since')}` : ''}${c.f.until ? ` jusqu'au ${d(c, 'until')}` : ''}.\n\nLa présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.` },
    convocation: { label: 'Convocation', icon: '📣', cat: 'person',
      f: [['on', 'Date du rendez-vous', 'date', ''], ['hour', 'Heure', 'text', '10h00'], ['place', 'Lieu', 'text', ''], ['why', 'Objet de la convocation', 'text', '']],
      subject: c => `Convocation${c.f.why ? ' – ' + c.f.why : ''}`,
      body: c => `Madame, Monsieur,\n\nVous êtes prié(e) de vous présenter le ${d(c, 'on')} à ${c.f.hour || '…'}, ${c.f.place ? 'à ' + c.f.place : 'à notre siège'}${c.f.why ? `, pour : ${c.f.why}` : ''}.\n\nVotre présence est requise. En cas d'empêchement, merci de nous prévenir au plus tôt.` },
    avertissement: { label: 'Avertissement', icon: '🟠', cat: 'person',
      f: [['facts', 'Faits reprochés', 'area', ''], ['on', 'Date des faits', 'date', '']],
      subject: () => 'Avertissement',
      body: c => `Madame, Monsieur,\n\nNous avons constaté, le ${d(c, 'on')}, les faits suivants :\n\n${c.f.facts || '…'}\n\nCes faits constituent un manquement à vos obligations. Nous vous adressons le présent avertissement et vous invitons à respecter désormais les règles de la société. En cas de récidive, d'autres mesures pourront être prises.` },
    autorite: { label: 'Lettre à une autorité (Honorable…)', icon: '🎩', cat: 'person', hon: true,
      f: [['titre', 'Formule en tête du destinataire', 'text', 'À l\'Honorable'], ['appel', 'Appellation', 'text', 'Honorable'], ['about', 'Objet', 'text', ''], ['text', 'Texte de la lettre', 'area', ''], ['copy', 'Copie pour information', 'text', () => 'Archives ' + co().name]],
      subject: c => c.f.about || '',
      body: c => `${c.f.appel || 'Honorable'},\n\n${c.f.text || '…'}\n\nDans l'attente d'une suite favorable, nous vous prions d'agréer, ${c.f.appel || 'Honorable'}, l'expression de notre très haute considération.` },
    arrieres: { label: 'Abonnements impayés – décharge (à une autorité)', icon: '🎩', cat: 'person', hon: true, money: true,
      f: [['titre', 'Formule en tête du destinataire', 'text', 'À l\'Honorable'], ['appel', 'Appellation', 'text', 'Honorable'], ['kits', 'Nombre de kits installés', 'num', ''], ['place', 'Lieu des installations', 'text', 'dans le territoire de …'], ['period', 'Période non réglée', 'text', '… mois / depuis le …'], ['amount', 'Montant total des arriérés', 'num', ''], ['days', 'Délai de régularisation (jours)', 'num', 8], ['copy', 'Copie pour information', 'text', () => 'Archives ' + co().name]],
      subject: () => `Non-paiement des abonnements Starlink – Décharge de responsabilité de ${co().name}`,
      body: c => { const a = c.f.appel || 'Honorable', n = co().name; return `${a},\n\nNous avons l'honneur de nous adresser à votre haute personnalité, au sujet des ${c.f.kits || '…'} kits Starlink installés par nos équipes ${c.f.place || '…'}, afin de mettre fin à la situation de coupure totale de réseau que connaissait cette zone.\n\nNous tenons d'abord à vous exprimer notre profonde gratitude pour la confiance placée en ${n} ainsi que pour l'accueil réservé à nos équipes lors de cette mission.\n\nToutefois, nous constatons, à ce jour, que les abonnements mensuels afférents à ces kits n'ont pas été réglés pour la période de ${c.f.period || '…'}, pour un montant total de ${money(c.f.amount, c.cur)}. Or, le règlement régulier de ces abonnements conditionne la continuité du service Internet fourni par Starlink.\n\nEn conséquence, nous avons l'honneur de porter à votre connaissance ce qui suit :\n\n1. ${n} décline toute responsabilité quant à la suspension, l'interruption ou la résiliation du service Internet, ainsi qu'à toutes les conséquences, directes ou indirectes, qui en découleraient pour les utilisateurs de ces kits ;\n2. ${n} ne saurait être tenue pour responsable des désagréments ou préjudices résultant du défaut de paiement des abonnements, celui-ci relevant exclusivement du souscripteur ;\n3. La reprise normale du service demeure subordonnée à la régularisation préalable des arriérés d'abonnement.\n\nDans un esprit de collaboration, nous vous invitons à bien vouloir procéder à la régularisation de cette situation dans un délai de ${c.f.days || '…'} jours à compter de la réception de la présente. Nous restons, par ailleurs, entièrement disponibles pour examiner avec vous toute modalité pratique de règlement.\n\nDans l'attente d'une suite favorable, nous vous prions d'agréer, ${a}, l'expression de notre très haute considération.`; } },
    demande: { label: 'Demande / lettre à une administration', icon: '🏛️', cat: 'person',
      f: [['about', 'Objet de la demande', 'text', ''], ['text', 'Votre demande', 'area', '']],
      subject: c => c.f.about || 'Demande',
      body: c => `Madame, Monsieur,\n\n${c.f.text || 'J\'ai l\'honneur de solliciter de votre bienveillance…'}\n\nDans l'attente d'une suite favorable, nous vous prions d'agréer, Madame, Monsieur, l'expression de notre considération distinguée.` },
    libre: { label: 'Lettre libre', icon: '✉️', cat: 'person',
      f: [['about', 'Objet', 'text', ''], ['text', 'Texte de la lettre', 'area', '']],
      subject: c => c.f.about || '',
      body: c => c.f.text || '' }
  };
  const T = c => TYPES[c.type] || TYPES.libre;
  const nextNo = date => { const y = (date || App.today()).slice(0, 4); let m = 0; list().forEach(c => { const x = /^LET-(\d{4})-(\d+)$/.exec(c.no || ''); if (x && x[1] === y) m = Math.max(m, +x[2]); }); return `LET-${y}-${String(m + 1).padStart(4, '0')}`; };
  // recipient of a letter: the client's file, or the details typed in
  const whoOf = c => { const cl = c.clientId && App.client(c.clientId); return cl ? { name: App.cname(cl), phone: cl.phone || '', address: cl.address || cl.installAddr || '' } : { name: (c.party || {}).name || '—', phone: (c.party || {}).phone || '', address: (c.party || {}).address || '' }; };
  const ctx = c => ({ ...c, who: whoOf(c), cur: c.currency || 'USD', f: c.f || {} });
  App.letterTypes = TYPES;
  App.letterText = c => { const x = ctx(c); return { subject: c.subject !== undefined ? c.subject : T(c).subject(x), body: c.body !== undefined ? c.body : T(c).body(x) }; };

  // ---------- list ----------
  App.views.letters = () => {
    const all = list().slice().sort((a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0)), shown = all.filter(c => st.f === 'all' || T(c).cat === st.f);
    const row = c => `<button class="item" data-act="lt_open" data-id="${c.id}"><span class="avatar">${T(c).icon}</span><div class="grow"><b>${esc(c.no)} · ${esc(T(c).label)}</b><small>${esc(whoOf(c).name)} · ${App.fdate(c.date)}</small></div></button>`;
    return {
      title: 'Lettres', sub: `${all.length} lettre(s)`, back: 'more', nav: 'more',
      html: `<section class="hero dhero"><div class="hero-top"><div><small>✉️ Lettres administratives</small><div class="hero-num" data-count="${all.length}">${all.length}</div></div></div>
          <div class="cstats"><div><b>${all.filter(c => T(c).cat === 'client').length}</b><small>aux clients</small></div><div><b>${all.filter(c => T(c).cat === 'person').length}</b><small>autres</small></div><div><b>${all.filter(c => c.date === App.today()).length}</b><small>aujourd'hui</small></div></div></section>
        <div class="bar"><button class="btn" data-act="lt_new">+ Nouvelle lettre</button></div>
        <div class="chips">${[['all', 'Toutes'], ['client', 'Aux clients'], ['person', 'Autres']].map(([k, t]) => `<button class="chip ${st.f === k ? 'on' : ''}" data-act="lt_f" data-f="${k}">${t}</button>`).join('')}</div>
        ${shown.length ? `<div class="list">${shown.map(row).join('')}</div>` : `<div class="empty big"><div class="ei">✉️</div><b>Aucune lettre</b><p class="mut">Choisissez un modèle (mise en demeure, rappel de paiement, attestation, suspension, résiliation, convocation…), remplissez deux ou trois champs : la lettre est prête à imprimer ou à envoyer.</p></div>`}`
    };
  };
  App.actions.lt_f = x => { st.f = x.f; App.refresh(); };
  // block shown on a client sheet
  App.lettersBlock = c => { if (!App.canView('letters')) return ''; const l = list().filter(x => x.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date));
    return `<h2 class="sec">Lettres</h2><div class="bar"><button class="btn sm" data-act="lt_new" data-cid="${c.id}">+ Nouvelle lettre</button></div>${l.length ? `<div class="list">${l.map(x => `<button class="item" data-act="lt_open" data-id="${x.id}"><span class="avatar">${T(x).icon}</span><div class="grow"><b>${esc(x.no)}</b><small>${esc(T(x).label)} · ${App.fdate(x.date)}</small></div></button>`).join('')}</div>` : '<div class="empty">Aucune lettre pour ce client.</div>'}`; };

  // ---------- create / edit ----------
  const fieldHtml = (t, ex) => t.f.map(([k, l, kind, def]) => { const v = ex && ex[k] !== undefined ? ex[k] : typeof def === 'function' ? def() : def, id = 'lf_' + k;
    return kind === 'num' ? F.num(id, l, v) : kind === 'date' ? F.date(id, l, v) : kind === 'area' ? F.area(id, l, v, 'rows="4"') : F.text(id, l, v); }).join('');
  App.letterForm = (c, cid) => {
    const isNew = !c, t0 = App.today();
    c = c || { type: 'mise', clientId: cid || '', party: {}, date: t0, currency: 'USD', f: {}, rep: (list().slice().reverse().find(x => x.rep) || {}).rep || '' };
    const render = type => { const t = TYPES[type], ex = type === c.type ? { ...c.f } : {}, cl = App.client(App.v('lt_cl') || c.clientId);
      if (cl) { if (ex.plan === undefined && cl.plan) ex.plan = cl.plan; if (ex.site === undefined) ex.site = cl.installAddr || cl.address || ''; if (ex.since === undefined && cl.start) ex.since = cl.start; }
      if (ex.paid === undefined) ex.paid = t0; if (ex.first === undefined) ex.first = App.addDays(t0, 30); if (ex.on === undefined) ex.on = App.addDays(t0, type === 'suspension' || type === 'resiliation' ? 0 : 3);
      $('lt_f').innerHTML = fieldHtml(t, ex); $('lt_clrow').style.display = t.cat === 'client' ? '' : 'none'; $('lt_party').hidden = t.cat === 'client' && !!App.client($('lt_cl').value); $('lt_curRow').style.display = t.money ? '' : 'none'; };
    App.modal(isNew ? 'Nouvelle lettre' : 'Modifier ' + c.no,
      `${isNew ? F.sel('lt_type', 'Modèle de lettre', Object.entries(TYPES).map(([k, t]) => [k, t.icon + ' ' + t.label]), c.type) : `<p class="mut" style="margin-top:0">${T(c).icon} ${esc(T(c).label)}</p>`}
       <div id="lt_clrow">${App.clientFinder('lt_cl')}${F.sel('lt_cl', 'Destinataire (client)', App.clientOpts('— Autre (saisir ci-dessous) —'), c.clientId)}</div>
       <div id="lt_party" ${c.clientId ? 'hidden' : ''}>${F.text('lt_pname', 'Nom du destinataire', (c.party || {}).name || '')}<div class="row">${F.text('lt_pphone', 'Téléphone', (c.party || {}).phone || '')}${F.text('lt_paddr', 'Adresse', (c.party || {}).address || '')}</div></div>
       <div class="row">${F.date('lt_date', 'Date de la lettre', c.date)}<div id="lt_curRow">${F.sel('lt_cur', 'Devise', CUR, c.currency)}</div></div>
       <div id="lt_f"></div>
       ${F.text('lt_rep', 'Signée par (nom et fonction, facultatif)', c.rep || '')}
       ${isNew ? '' : `<label class="chk" style="display:block;margin-top:8px"><input type="checkbox" id="lt_regen"> Régénérer le texte depuis le modèle (efface vos modifications du texte)</label>`}`,
      () => { const type = isNew ? App.v('lt_type') : c.type, t = TYPES[type], f = {};
        t.f.forEach(([k, l, kind]) => { const raw = $('lf_' + k).value; f[k] = kind === 'num' ? (raw === '' ? '' : Math.max(0, +raw || 0)) : String(raw).trim(); });
        const cl = t.cat === 'client' ? App.v('lt_cl') : '', p = { name: App.v('lt_pname'), phone: App.v('lt_pphone'), address: App.v('lt_paddr') };
        if (!cl && !p.name) { App.toast('Choisissez un client ou saisissez le nom du destinataire'); return false; }
        if (t.money && !(f.amount > 0)) { App.toast('Saisissez le montant'); return false; }
        const date = App.v('lt_date') || t0, o = { type, clientId: cl, party: cl ? {} : p, date, currency: App.v('lt_cur') || 'USD', rep: App.v('lt_rep'), f };
        if (isNew) { Object.assign(c, o, { id: App.uid(), ts: Date.now(), no: nextNo(date) }); list().push(c); if (cl) App.log(cl, `Lettre ${c.no} : ${t.label}`); }
        else { Object.assign(c, o); if ($('lt_regen') && $('lt_regen').checked) { delete c.body; delete c.subject; } }
        App.save(); App.toast(isNew ? 'Lettre créée : ' + c.no : 'Lettre modifiée'); App.refresh(); if (isNew) setTimeout(() => App.actions.lt_open({ id: c.id }), 80); },
      isNew ? 'Créer la lettre' : 'Enregistrer');
    render(c.type);
    if ($('lt_type')) $('lt_type').onchange = () => { $('lt_f').innerHTML = ''; render($('lt_type').value); };
    App.wireClientFinder('lt_cl', s => App.clientOpts('— Autre (saisir ci-dessous) —', null, s));
    $('lt_cl').onchange = () => { const cl = App.client($('lt_cl').value); $('lt_party').hidden = !!cl; if (cl) { const pl = $('lf_plan'), s = $('lf_site'), sn = $('lf_since'); if (pl && cl.plan && !pl.value) pl.value = cl.plan; if (s && !s.value) s.value = cl.installAddr || cl.address || ''; if (sn && !sn.value && cl.start) sn.value = cl.start; } };
  };
  App.actions.lt_new = x => App.letterForm(null, x && x.cid);

  // ---------- printable document ----------
  // layout of the model letter: date on the right, recipient block shifted to the right, bold subject, greeting and first paragraph shifted,
  // bold headings, numbered list, closing formula shifted, signature block on the right (Pour <société> / Nom / Fonction / Signature et cachet)
  const IND = '45%';
  const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const bodyHtml = body => {
    const paras = String(body || '').split(/\n{2,}/).map(b => b.trim()).filter(Boolean); let first = true;
    return paras.map((b, i) => {
      const lines = b.split('\n');
      if (i === 0 && lines.length === 1 && b.length < 70 && /,$/.test(b)) return `<p class="ctp" style="margin:14px 0 6px ${IND};text-align:left">${inline(b)}</p>`; // greeting
      if (/^#\s/.test(b)) return `<p class="ctp" style="margin:12px 0 3px;text-align:left"><b>${inline(b.replace(/^#\s+/, ''))}</b></p>`; // heading
      if (/^\d+\.\s/.test(lines[0])) return `<table class="ltl">${lines.map(l => { const m = /^(\d+)\.\s+(.*)$/.exec(l); return m ? `<tr><td class="n">${m[1]}.</td><td>${inline(m[2])}</td></tr>` : `<tr><td></td><td>${inline(l)}</td></tr>`; }).join('')}</table>`; // numbered list
      const closing = i === paras.length - 1 && /agr[ée]er|salutations/i.test(b), ti = first && i <= 1 && !closing ? `text-indent:${IND};` : ''; first = false;
      return `<p class="ctp" style="margin:6px 0 ${closing ? '14px' : '6px'}${closing ? ' ' + IND : ''};text-align:left;${ti}">${inline(b).replace(/\n/g, '<br>')}</p>`; }).join(''); };
  App.letterDoc = (c, logo, stamp) => {
    const K = App.docKit, e = esc, w = whoOf(c), x = App.letterText(c), hon = T(c).hon && c.f.titre, rep = String(c.rep || '').split(/\s*,\s*/), repName = rep.slice(0, -1).join(', ') || rep[0] || '', repJob = rep.length > 1 ? rep[rep.length - 1] : '';
    return `<div class="paper"><style>.ltl{width:100%;margin:2px 0 6px 6px;border-collapse:collapse}.ltl td{padding:2px 0;vertical-align:top;text-align:left;line-height:1.45}.ltl td.n{width:1.1cm}</style>${K.head(co(), logo)}
      <table style="width:100%;margin-top:8px"><tr><td style="font-size:9pt;color:#4A5568">N/Réf : ${e(c.no)}/${e(co().name)}/${c.date.slice(0, 4)}</td><td style="text-align:right">${e(city())}, le ${App.fdate(c.date)}</td></tr></table>
      <p class="ctp" style="margin:18px 0 0 ${IND};text-align:left">${hon ? `<b>${e(c.f.titre)} ${e(w.name)}</b>` : `À l'attention de :<br><b>${e(w.name)}</b>`}${w.address ? '<br>' + e(w.address) : ''}${w.phone ? '<br>Tél. ' + e(w.phone) : ''}</p>
      ${x.subject ? `<table class="lsj" style="margin-top:16px;width:58%"><tr><td style="width:1.6cm;vertical-align:top"><b>Objet :</b></td><td style="vertical-align:top"><b>${e(x.subject)}</b></td></tr></table>` : ''}
      <div style="margin-top:6px">${bodyHtml(c.type !== 'libre' && !/agr[ée]er|salutations/i.test(x.body) ? x.body + '\n\nVeuillez agréer, Madame, Monsieur, l\'expression de nos salutations distinguées.' : x.body)}</div>
      <div style="margin:16px 0 0 62%;page-break-inside:avoid;text-align:left"><b>Pour ${e(co().name)}</b><br><br>Nom : ${repName ? e(repName) : '……………………………'}<br>Fonction : ${repJob ? e(repJob) : '……………………………'}<div style="height:3.2cm;margin-top:8px"><img src="${e(stamp || 'stamp.png')}" alt="" style="height:3cm;width:3cm;transform:rotate(-6deg);filter:contrast(1.35) saturate(1.5)"></div><span style="font-size:9.5pt">Signature et cachet</span></div>
      ${c.f && c.f.copy ? `<p class="ctp" style="margin-top:10px;text-align:left"><i>Copie pour information : ${e(c.f.copy)}</i></p>` : ''}${K.foot(stamp, true)}</div>`; };
  App.letterFileName = c => App.docName(whoOf(c).name, 'Lettre ' + c.no);
  App.actions.lt_print = async x => { const c = list().find(y => y.id === x.id); if (c) App.docKit.print(App.letterFileName(c), App.letterDoc(c, await App.docKit.logoData(), await App.docKit.stampData())); };
  App.actions.lt_pdf = async x => { const c = list().find(y => y.id === x.id); if (c) App.sharePdf(`${App.letterFileName(c)}.pdf`, App.letterDoc(c, await App.docKit.logoData(), await App.docKit.stampData())); };
  App.actions.lt_wa = x => { const c = list().find(y => y.id === x.id); if (!c) return; const w = whoOf(c), t = App.letterText(c), txt = `${w.name !== '—' ? 'Bonjour ' + w.name + ',\n' : ''}${t.subject ? t.subject + '\n\n' : ''}${t.body}\n\n${co().name}`;
    if (w.phone) window.open(App.waUrl(w.phone, txt), '_blank', 'noopener'); else window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener'); };

  // ---------- detail ----------
  App.actions.lt_open = x => {
    const c = list().find(y => y.id === x.id); if (!c) return; const w = whoOf(c), t = App.letterText(c);
    App.modal('Lettre ' + c.no,
      `<div class="card" style="margin:0 0 10px"><div class="spread"><b>${T(c).icon} ${esc(T(c).label)}</b></div><div class="mut">${esc(w.name)}${w.phone ? ' · ' + esc(w.phone) : ''} · ${App.fdate(c.date)}</div></div>
       <div class="bar noprint"><button type="button" class="btn sec" data-act="lt_print" data-id="${c.id}">🖨️ Imprimer</button><button type="button" class="btn sec" data-act="lt_pdf" data-id="${c.id}">📤 PDF</button><button type="button" class="btn sec" data-act="lt_wa" data-id="${c.id}">💬 WhatsApp</button></div>
       <div class="card" style="margin:0 0 10px"><b>${esc(t.subject || 'Lettre')}</b><div style="white-space:pre-wrap;margin-top:6px">${esc(t.body)}</div></div>
       <div class="bar"><button type="button" class="btn sec" data-act="lt_text" data-id="${c.id}">📝 Modifier le texte</button></div>
       <div class="bar"><button type="button" class="btn sm sec" data-act="lt_edit" data-id="${c.id}">✏️ Modifier les champs</button><button type="button" class="btn sm sec" data-act="lt_dup" data-id="${c.id}">⎘ Dupliquer</button>${c.clientId ? `<button type="button" class="btn sm sec" data-act="go" data-v="client" data-id="${c.clientId}">👤 Client</button>` : ''}<button type="button" class="btn sm sec" data-act="lt_del" data-id="${c.id}">🗑 Supprimer</button></div>`);
  };
  App.actions.lt_edit = x => { const c = list().find(y => y.id === x.id); if (c) { App.close(); setTimeout(() => App.letterForm(c), 30); } };
  App.actions.lt_text = x => { const c = list().find(y => y.id === x.id); if (!c) return; const t = App.letterText(c); App.close();
    setTimeout(() => App.modal('Texte de la lettre ' + c.no, `${F.text('lt_subj', 'Objet', t.subject)}${F.area('lt_body', 'Texte', t.body, 'rows="14"')}<p class="mut">Séparez les paragraphes par une ligne vide.</p>`,
      () => { c.subject = App.v('lt_subj'); c.body = $('lt_body').value.trim(); App.save(); App.toast('Texte enregistré'); App.refresh(); setTimeout(() => App.actions.lt_open({ id: c.id }), 80); }), 40); };
  App.actions.lt_dup = x => { const c = list().find(y => y.id === x.id); if (!c) return; const t = App.today(), n = { ...c, party: { ...(c.party || {}) }, f: { ...(c.f || {}) }, id: App.uid(), ts: Date.now(), date: t, no: nextNo(t) };
    list().push(n); if (c.clientId) App.log(c.clientId, `Lettre ${n.no} : ${T(n).label}`); App.save(); App.close(); App.refresh(); App.toast('Lettre dupliquée : ' + n.no); };
  App.actions.lt_del = x => { const c = list().find(y => y.id === x.id); if (!c) return; if (!App.confirm(`Supprimer la lettre ${c.no} ?`)) return; App.db.letters = list().filter(y => y !== c); App.save(); App.close(); App.refresh(); App.toast('Lettre supprimée'); };
})();
