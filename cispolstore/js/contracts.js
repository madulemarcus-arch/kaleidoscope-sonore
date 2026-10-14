// Contracts: numbered CTR-YYYY-NNNN, generated from a model (subscription, Starlink access provider, equipment sale/installation, employment, free text),
// editable, printable / PDF / WhatsApp, with a status (draft, running, ended, cancelled) and an end-date alert.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const list = () => (App.db.contracts = App.db.contracts || []);
  const st = { f: 'all' };
  const CUR = [['USD', 'Dollar ($)'], ['CDF', 'Franc congolais (CDF)']];
  const STAT = { draft: ['Brouillon', 'warn'], active: ['En cours', 'ok'], ended: ['Terminé', ''], cancelled: ['Résilié', 'bad'], expired: ['Échu', 'bad'], soon: ['Bientôt échu', 'warn'] };
  const money = (n, cur) => App.docKit.money(n, cur === 'CDF' ? 'CDF' : 'USD');
  const addMonths = (d, n) => { const [y, m, j] = d.split('-').map(Number), t = new Date(Date.UTC(y, m - 1 + n, 1)), last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); t.setUTCDate(Math.min(j, last)); return t.toISOString().slice(0, 10); };
  const endOf = (start, months) => months > 0 ? App.addDays(addMonths(start, months), -1) : '';
  const word = (n, cur) => App.amountWords(n, cur === 'CDF' ? 'CDF' : 'USD').toLowerCase();

  // ---------- models ----------
  // fields: [key, label, kind(text|num|date|sel|area), default, options]
  const TYPES = {
    abonnement: { label: 'Abonnement client', icon: '📡', title: 'CONTRAT D\'ABONNEMENT INTERNET', a: ['LE PRESTATAIRE', 'le Prestataire'], b: ['LE CLIENT', 'le Client'], term: 12, who: 'client',
      fields: [['plan', 'Formule / forfait', 'text', 'Illimité'], ['amount', 'Prix par période de 30 jours', 'num', 70], ['grace', 'Délai de grâce (jours)', 'num', 15], ['equipMode', 'Matériel', 'sel', 'client', [['client', 'Déjà possédé par le client'], ['vendu', 'Vendu au client'], ['loue', 'Loué (reste à CISPOLstore)']]], ['equip', 'Désignation du matériel', 'text', 'Kit Starlink (antenne, routeur, câble)'], ['site', 'Adresse d\'installation', 'text', ''], ['acc', 'Compte Starlink (ACC)', 'text', '']] },
    fournisseur: { label: 'Fourniture Internet Starlink', icon: '🛰️', title: 'CONTRAT DE FOURNITURE D\'ACCÈS INTERNET PAR SATELLITE (STARLINK)', a: ['LE FOURNISSEUR', 'le Fournisseur'], b: ['LE CLIENT', 'le Client'], term: 12, who: 'client',
      fields: [['plan', 'Offre / débit', 'text', 'Starlink Standard, illimité'], ['usage', 'Usage', 'sel', 'pro', [['perso', 'Résidentiel / personnel'], ['pro', 'Professionnel (entreprise, bureau)'], ['revente', 'Revente d\'accès (cybercafé, zone Wi-Fi)']]], ['amount', 'Redevance mensuelle', 'num', 100], ['advance', 'Mois payés d\'avance', 'num', 1], ['fee', 'Frais d\'installation / mise en service', 'num', 0], ['notice', 'Préavis de résiliation (jours)', 'num', 30], ['site', 'Site d\'installation', 'text', ''], ['acc', 'Compte Starlink (ACC)', 'text', '']] },
    materiel: { label: 'Vente / installation de matériel', icon: '🧰', title: 'CONTRAT DE VENTE ET D\'INSTALLATION DE MATÉRIEL', a: ['LE VENDEUR', 'le Vendeur'], b: ['L\'ACHETEUR', 'l\'Acheteur'], term: 0, who: 'client', noTerm: true,
      fields: [['items', 'Matériel et quantités', 'area', 'Kit Starlink Standard × 1\nRouteur Wi-Fi × 1'], ['amount', 'Prix total', 'num', ''], ['deposit', 'Acompte versé', 'num', 0], ['delivery', 'Livraison / installation prévue le', 'date', ''], ['install', 'Installation incluse', 'sel', 'oui', [['oui', 'Oui, installation incluse'], ['non', 'Non, livraison seule']]], ['warranty', 'Garantie (mois)', 'num', 12], ['site', 'Lieu de livraison / d\'installation', 'text', '']] },
    mandat: { label: 'Mandat de gestion de fonds', icon: '💼', title: 'CONTRAT DE MANDAT DE GESTION DE FONDS', a: ['LE MANDATAIRE', 'le Mandataire'], b: ['LE MANDANT', 'le Mandant'], term: 0, who: 'client',
      fields: [['purpose', 'Objet des paiements', 'text', 'Abonnement Starlink'], ['amount', 'Montant remis', 'num', ''], ['fee', 'Frais de gestion fixes (par paiement effectué)', 'num', 0], ['restit', 'Délai de restitution du solde (jours)', 'num', 7], ['acc', 'Compte Starlink concerné (ACC)', 'text', '']] },
    travail: { label: 'Contrat de travail / vendeur', icon: '👔', title: 'CONTRAT DE TRAVAIL', a: ['L\'EMPLOYEUR', 'l\'Employeur'], b: ['L\'EMPLOYÉ(E)', 'l\'Employé(e)'], term: 0, who: 'person',
      fields: [['job', 'Poste / fonction', 'text', 'Vendeur'], ['amount', 'Salaire mensuel', 'num', ''], ['commission', 'Commission / prime (facultatif)', 'text', ''], ['trial', 'Période d\'essai (jours)', 'num', 30], ['hours', 'Horaires de travail', 'text', 'Du lundi au samedi, de 8 h à 17 h'], ['place', 'Lieu de travail', 'text', '']] },
    libre: { label: 'Contrat libre', icon: '📄', title: 'CONTRAT', a: ['PARTIE 1', 'la Première partie'], b: ['PARTIE 2', 'la Seconde partie'], term: 0, who: 'client', free: true,
      fields: [['title', 'Titre du contrat', 'text', 'CONTRAT'], ['amount', 'Montant (facultatif)', 'num', ''], ['body', 'Texte du contrat', 'area', 'Article 1 – Objet\n\nArticle 2 – Prix\n\nArticle 3 – Durée\n\nArticle 4 – Litiges']] }
  };
  App.contractTypes = TYPES;
  // your own models (db.cmodels): a title, party labels, default term and a body of articles with {{fields}}
  const models = () => (App.db.cmodels = App.db.cmodels || []);
  const MODEL_FIELDS = [['amount', 'Montant (facultatif)', 'num', ''], ['object', 'Objet / précisions (facultatif)', 'text', '']];
  const synth = m => ({ label: m.name, icon: m.icon || '📄', title: m.title || String(m.name || 'CONTRAT').toUpperCase(), a: [m.a || 'PARTIE 1', (m.a || 'la première partie').toLowerCase()], b: [m.b || 'PARTIE 2', (m.b || 'la seconde partie').toLowerCase()], term: m.months || 0, who: 'client', fields: MODEL_FIELDS });
  const tdef = key => TYPES[key] || (/^m:/.test(key) ? (m => m && synth(m))(models().find(x => 'm:' + x.id === key)) : null);
  const T = c => TYPES[c.type] || synth(c.mt || { name: 'Contrat', title: 'CONTRAT' });
  const bodyFor = c => c.type === 'libre' ? (c.f || {}).body || '' : /^m:/.test(c.type) ? (models().find(x => 'm:' + x.id === c.type) || c.mt || {}).body || c.body || '' : gen(c);

  const partyOf = c => { const cl = c.clientId ? App.client(c.clientId) : null, p = c.party || {};
    return { name: cl ? App.cname(cl) : (p.name || ''), phone: (cl && cl.phone) || p.phone || '', address: (cl && (cl.address || cl.installAddr)) || p.address || '', idno: p.idno || '' }; };
  const cname = c => partyOf(c).name || '—';
  const pDesc = (p, rep) => [p.name, p.idno && 'pièce d\'identité n° ' + p.idno, p.address && 'demeurant à ' + p.address, p.phone && 'tél. ' + p.phone, rep && 'représenté(e) par ' + rep].filter(Boolean).join(', ');
  const nextNo = date => { const y = (date || App.today()).slice(0, 4); let m = 0; list().forEach(c => { const x = /^CTR-(\d{4})-(\d+)$/.exec(c.no || ''); if (x && x[1] === y) m = Math.max(m, +x[2]); }); return `CTR-${y}-${String(m + 1).padStart(4, '0')}`; };
  App.contractStatus = c => c.status !== 'active' || !c.end ? c.status : c.end < App.today() ? 'expired' : App.diff(App.today(), c.end) <= 30 ? 'soon' : 'active';
  App.contractAlerts = () => list().filter(c => ['expired', 'soon'].includes(App.contractStatus(c)));
  App.contractCount = () => list().filter(c => c.status === 'active').length;

  // ---------- text generation ----------
  const art = (items) => items.map(([t, x], i) => `Article ${i + 1} – ${t}\n${x}`).join('\n\n');
  const termText = c => c.months > 0 ? `pour une durée de ${c.months} mois, jusqu'au ${App.fdate(c.end)}` : 'pour une durée indéterminée';
  const gen = c => {
    const co = App.db.settings.company, S = App.db.settings, f = c.f || {}, cu = c.currency, a = T(c).a[1], b = T(c).b[1], A = a[0].toUpperCase() + a.slice(1), B = b[0].toUpperCase() + b.slice(1), city = co.city || 'Kinshasa';
    const law = `Les parties s'efforcent de régler à l'amiable tout différend lié au présent contrat. À défaut, il relève des juridictions compétentes de ${city}, selon le droit en vigueur en République démocratique du Congo.`;
    if (c.type === 'abonnement') {
      const eq = f.equipMode === 'vendu' ? `Le matériel (${f.equip || 'à préciser'}) est vendu au Client et facturé séparément ; il devient sa propriété après paiement intégral.` : f.equipMode === 'loue' ? `Le matériel (${f.equip || 'à préciser'}) est mis à disposition du Client et reste la propriété du Prestataire. Le Client le garde en bon état, ne le prête ni ne le déplace sans accord, rembourse sa valeur en cas de perte ou de dommage qui lui est imputable, et le restitue à la fin du contrat.` : `Le Client utilise son propre matériel (${f.equip || 'à préciser'}). Le Prestataire n'est pas responsable de sa panne ni de son remplacement.`;
      return art([
        ['Objet', `${A} fournit au Client un accès à Internet par satellite Starlink${f.site ? ' à l\'adresse suivante : ' + f.site : ''}, selon la formule « ${f.plan || '—'} »${f.acc ? ` (compte Starlink n° ${f.acc})` : ''}.`],
        ['Matériel', eq],
        ['Durée', `Le contrat prend effet le ${App.fdate(c.start)}, ${termText(c)}.${c.months > 0 ? ' Il peut être renouvelé par accord écrit des parties (un message du Client suffit).' : ''}`],
        ['Prix et paiement', `Le Client paie ${money(f.amount, cu)} (${word(f.amount, cu)}) par période de 30 jours, d'avance. ${co.payTerms || 'Le paiement se fait en espèces, par Mobile Money ou par virement.'} Un délai de grâce de ${f.grace || 0} jours est accordé après l'échéance ; au-delà, le service peut être suspendu jusqu'au paiement, et des pénalités de retard selon le barème communiqué peuvent s'appliquer.`],
        ['Obligations du Prestataire', `${A} met le service en route, assure l'assistance technique dans des délais raisonnables et informe le Client de toute interruption prévisible.`],
        ['Obligations du Client', 'Le Client utilise le service de façon licite, ne partage pas son accès sans accord, protège le matériel, signale toute panne rapidement et prévient le Prestataire en cas de déménagement.'],
        ['Suspension et résiliation', `Chaque partie peut résilier le contrat par écrit (message compris) avec un préavis de 30 jours. Le Prestataire peut suspendre ou résilier sans préavis en cas d'impayé persistant ou d'usage illicite. Les sommes déjà dues restent exigibles.`],
        ['Responsabilité', `Le service dépend du réseau Starlink et de conditions extérieures (météo, électricité, force majeure). ${A} ne garantit pas une disponibilité continue et n'est pas responsable des pertes indirectes liées à une interruption.`],
        ['Données personnelles', 'Les informations du Client servent uniquement à la gestion de son abonnement et ne sont pas transmises à des tiers, sauf obligation légale.'],
        ['Litiges', law]]);
    }
    if (c.type === 'fournisseur') {
      const rev = f.usage === 'revente' ? `Le Client est autorisé à revendre l'accès à ses propres usagers (cybercafé, zone Wi-Fi). Il reste seul responsable de leurs usages, respecte la loi et les conditions du réseau Starlink, et ne cède pas l'accès à un autre revendeur sans accord écrit du Fournisseur.` : f.usage === 'pro' ? 'Le service est destiné à un usage professionnel du Client et de son personnel.' : 'Le service est destiné à un usage personnel et familial.';
      return art([
        ['Objet', `${A} fournit au Client un service d'accès à Internet par le réseau satellitaire Starlink, formule « ${f.plan || '—'} »${f.site ? `, sur le site : ${f.site}` : ''}${f.acc ? ` (compte Starlink n° ${f.acc})` : ''}.`],
        ['Nature du service', `${A} active, configure et suit l'accès, et assure le support technique. ${A} s'engage à faire de son mieux pour maintenir le service, sans garantir une disponibilité ininterrompue : celle-ci dépend du réseau Starlink, de la météo, de l'alimentation électrique et du site d'installation.`],
        ['Mise en service', f.fee > 0 ? `Les frais d'installation et de mise en service s'élèvent à ${money(f.fee, cu)} (${word(f.fee, cu)}), payables avant l'intervention.` : 'La mise en service est effectuée sans frais d\'installation supplémentaires.'],
        ['Redevance et facturation', `Le Client paie une redevance mensuelle de ${money(f.amount, cu)} (${word(f.amount, cu)}), ${f.advance > 0 ? `payable ${f.advance} mois d'avance` : 'payable à l\'échéance'}. ${co.payTerms || 'Le paiement se fait en espèces, par Mobile Money ou par virement.'} Toute facture impayée à l'échéance peut entraîner la suspension du service après rappel.`],
        ['Durée et renouvellement', `Le contrat prend effet le ${App.fdate(c.start)}, ${termText(c)}.${c.months > 0 ? ' À son terme, il est reconduit pour des périodes identiques, sauf dénonciation avec le préavis prévu.' : ''}`],
        ['Usage', rev],
        ['Obligations du Client', 'Le Client paie aux échéances, utilise le service de façon licite (aucun contenu illégal, aucune activité frauduleuse), protège le matériel et garde l\'accès confidentiel.'],
        ['Suspension', `${A} peut suspendre le service en cas d'impayé, d'usage illicite ou d'atteinte au réseau, jusqu'à régularisation.`],
        ['Résiliation', `Chaque partie peut résilier le contrat par écrit avec un préavis de ${f.notice || 30} jours. Les redevances échues restent dues ; aucune redevance déjà payée pour la période en cours n'est remboursée, sauf accord.`],
        ['Responsabilité', `${A} n'est pas responsable des dommages indirects ni des pertes d'exploitation liés à une interruption, ni des cas de force majeure.`],
        ['Données personnelles', 'Les informations du Client servent uniquement à l\'exécution du contrat et ne sont pas transmises à des tiers, sauf obligation légale.'],
        ['Litiges', law]]);
    }
    if (c.type === 'mandat') {
      const lim = '10 000 $ américains (ou l\'équivalent en francs congolais au taux du jour)';
      return art([
        ['Objet', `Le Mandant confie au Mandataire des fonds${f.amount > 0 ? ` d'un montant de ${money(f.amount, cu)} (${word(f.amount, cu)})` : ''} pour payer, en son nom et pour son compte : ${f.purpose || 'les paiements convenus'}${f.acc ? ` (compte Starlink n° ${f.acc})` : ''}. ${A} accepte ce mandat.`],
        ['Pouvoirs du mandataire', `${A} ne peut utiliser les fonds que pour les paiements prévus à l'article 1. Il ne peut pas les employer pour ses propres besoins, ni les prêter, ni les confier à un tiers autrement que pour exécuter le paiement.`],
        ['Remise des fonds', `Chaque remise de fonds fait l'objet d'un reçu écrit (papier ou message) indiquant le montant, la date et le mode de paiement (espèces, M-Pesa, Airtel Money, Orange Money ou banque). Les fonds sont reçus dans la caisse du Mandataire.`],
        ['Vigilance sur les montants', `Lorsque le total des fonds remis par ${b} dépasse ${lim}, ${a} peut exiger une pièce d'identité valable et un justificatif de l'origine des fonds, et peut refuser ou suspendre l'opération à défaut. Ces vérifications sont faites dans l'intérêt des deux parties.`],
        ['Exécution des paiements', `${A} effectue les paiements aux échéances indiquées par ${b} ou résultant du service concerné, et lui envoie la preuve de chaque paiement (reçu ou message).`],
        ['Frais', `${A} perçoit des frais de gestion fixes de ${money(f.fee || 0, cu)} par paiement effectué. Les éventuels frais de transfert ou de change réellement supportés sont indiqués au Mandant et déduits des fonds, sur justificatif.`],
        ['Compte rendu', `${A} envoie au Mandant, chaque mois et à tout moment sur demande, la situation de ses fonds : montants reçus, paiements effectués, frais déduits et solde.`],
        ['Séparation des fonds', `Les fonds du Mandant sont inscrits à part dans la comptabilité du Mandataire (registre des fonds en attente) et ne sont pas mélangés avec ses propres recettes.`],
        ['Solde et restitution', `Le solde est restitué au Mandant sur simple demande, dans un délai de ${f.restit || 7} jours, par le mode de paiement choisi, après déduction des frais dus.`],
        ['Fonds insuffisants', `${A} n'avance jamais d'argent. Si les fonds sont insuffisants, il en informe ${b} sans délai et n'est pas responsable de la suspension du service qui en résulte.`],
        ['Responsabilité', `${A} répond de ses fautes dans l'exécution du mandat. Il ne répond pas des changements de prix, de tarif ou de taux de change décidés par des tiers, ni des cas de force majeure.`],
        ['Durée et révocation', `Le mandat prend effet le ${App.fdate(c.start)}, ${termText(c)}. ${B} peut le révoquer à tout moment par écrit (message compris) ; ${a} rend alors compte immédiatement et restitue le solde dans le délai prévu à l'article 9. ${A} peut y renoncer avec un préavis de 15 jours.`],
        ['Données personnelles', `Les informations du Mandant servent uniquement à l'exécution du mandat et ne sont pas transmises à des tiers, sauf obligation légale ou nécessité du paiement.`],
        ['Litiges', law]]);
    }
    if (c.type === 'materiel') {
      const solde = Math.max(0, (f.amount || 0) - (f.deposit || 0));
      return art([
        ['Objet', `${A} vend à ${b} le matériel suivant :\n${f.items || '—'}${f.install === 'oui' ? '\nL\'installation et la mise en service sont comprises.' : ''}`],
        ['Prix et paiement', `Le prix total est de ${money(f.amount, cu)} (${word(f.amount, cu)}). ${f.deposit > 0 ? `Un acompte de ${money(f.deposit, cu)} est versé à la signature ; le solde, soit ${money(solde, cu)}, est payable ${f.delivery ? 'au plus tard à la livraison' : 'à la livraison'}.` : 'Le prix est payable à la livraison.'} ${co.payTerms || ''}`.trim()],
        ['Livraison' + (f.install === 'oui' ? ' et installation' : ''), `${f.delivery ? `Prévue le ${App.fdate(f.delivery)}` : 'La date est convenue entre les parties'}${f.site ? `, à l'adresse suivante : ${f.site}` : ''}. Un retard raisonnable n'ouvre pas droit à indemnité.`],
        ['Réception', 'À la livraison, l\'Acheteur vérifie le matériel. Toute anomalie apparente est signalée immédiatement, sinon le matériel est réputé conforme.'],
        ['Garantie', `Le matériel est garanti ${f.warranty > 0 ? f.warranty + ' mois' : 'selon les conditions du fabricant'} contre les défauts de fabrication. La garantie ne couvre pas la foudre, les surtensions, l'humidité, les chocs, une mauvaise utilisation ni l'intervention d'un tiers non autorisé.`],
        ['Réserve de propriété', 'Le matériel reste la propriété du Vendeur jusqu\'au paiement complet du prix.'],
        ['Données personnelles', 'Les informations de l\'Acheteur servent uniquement à l\'exécution du contrat (vente, livraison, garantie) et ne sont pas transmises à des tiers, sauf obligation légale.'],
        ['Litiges', law]]);
    }
    if (c.type === 'travail') {
      const cdd = c.months > 0;
      return art([
        ['Engagement', `${A} engage ${b} en qualité de « ${f.job || '—'} »${f.place ? `, lieu de travail : ${f.place}` : ''}. ${B} exerce ses fonctions sous l'autorité de l'Employeur et selon ses instructions.`],
        ['Durée', `Le contrat est conclu ${cdd ? 'à durée déterminée, ' + termText(c) : 'à durée indéterminée'} et prend effet le ${App.fdate(c.start)}. ${f.trial > 0 ? `Il comporte une période d'essai de ${f.trial} jours, pendant laquelle chaque partie peut y mettre fin sans indemnité.` : ''}`.trim()],
        ['Rémunération', `${B} perçoit un salaire mensuel de ${money(f.amount, cu)} (${word(f.amount, cu)}), payable à la fin de chaque mois${f.commission ? `. Commission / prime : ${f.commission}` : ''}. Les retenues légales sont opérées conformément à la loi.`],
        ['Horaires', `${f.hours || 'Selon l\'organisation de l\'entreprise'}, dans le respect de la durée légale du travail.`],
        ['Obligations de l\'employé(e)', `${B} exécute ses tâches avec loyauté et sérieux, soigne le matériel et les marchandises qui lui sont confiés, rend compte fidèlement des encaissements et du stock, et respecte la confidentialité des informations de l'entreprise (clients, prix, comptes), y compris après la fin du contrat.`],
        ['Obligations de l\'employeur', `${A} verse le salaire à l'échéance, assure des conditions de travail correctes et accorde les congés et absences prévus par la loi.`],
        ['Fin du contrat', `${cdd ? 'Le contrat prend fin à son terme.' : 'Chaque partie peut y mettre fin par écrit.'} Un préavis est observé conformément au Code du travail. Une faute grave permet la rupture sans préavis, dans les conditions légales.`],
        ['Données personnelles', `${A} traite les données personnelles de ${b} uniquement pour la gestion du contrat de travail (paie, déclarations, dossier du personnel), conformément à la loi, et ne les transmet pas à des tiers sauf obligation légale.`],
        ['Droit applicable et litiges', `Le présent contrat est régi par la législation du travail en vigueur en République démocratique du Congo. Les litiges relèvent du tribunal du travail compétent de ${city}, après tentative de règlement amiable.`]]);
    }
    return '';
  };
  App.contractText = gen;
  const fill = (txt, c) => { const co = App.db.settings.company, p = partyOf(c); return String(txt || '').replace(/\{\{(\w+)\}\}/g, (m, k) => ({ client: p.name, societe: co.name, date: App.fdate(c.date), montant: c.f && c.f.amount ? money(c.f.amount, c.currency) : '', adresse: p.address, telephone: p.phone, debut: c.start ? App.fdate(c.start) : '', fin: c.end ? App.fdate(c.end) : '', objet: (c.f && c.f.object) || '', duree: c.months > 0 ? c.months + ' mois' : 'durée indéterminée' }[k] ?? m)); };

  // ---------- list ----------
  App.views.contracts = () => {
    const all = list().slice().sort((a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0)), run = all.filter(c => c.status === 'active'), alerts = App.contractAlerts();
    const shown = all.filter(c => st.f === 'all' || (st.f === 'active' ? c.status === 'active' : st.f === 'soon' ? alerts.includes(c) : st.f === 'draft' ? c.status === 'draft' : c.status === 'ended' || c.status === 'cancelled'));
    const row = c => { const s = STAT[App.contractStatus(c)], t = T(c);
      return `<button class="item" data-act="ct_open" data-id="${c.id}"><span class="avatar ${s[1]}">${t.icon}</span><div class="grow"><b>${esc(c.no)} · ${esc(t.label)}</b><small>${esc(cname(c))} · ${App.fdate(c.date)}${c.end ? ' · jusqu\'au ' + App.fdate(c.end) : ''}</small></div><div class="end">${c.f && c.f.amount ? `<b>${App.fmt(c.f.amount, c.currency)}</b>` : ''}<span class="pill ${s[1]}">${s[0]}</span></div></button>`; };
    return {
      title: 'Contrats', sub: `${run.length} en cours`, back: 'more', nav: 'more',
      html: `<section class="hero dhero"><div class="hero-top"><div><small>📄 Contrats en cours</small><div class="hero-num" data-count="${run.length}">${run.length}</div></div></div>
          <div class="cstats"><div><b>${alerts.length}</b><small>à renouveler</small></div><div><b>${all.filter(c => c.status === 'draft').length}</b><small>brouillon(s)</small></div><div><b>${all.length}</b><small>au total</small></div></div></section>
        <div class="bar"><button class="btn" data-act="ct_new">+ Nouveau contrat</button><button class="btn sec" data-act="cm_list">📚 Mes modèles</button></div>
        <div class="chips">${[['all', 'Tous'], ['active', 'En cours'], ['soon', 'À renouveler'], ['draft', 'Brouillons'], ['done', 'Terminés']].map(([k, t]) => `<button class="chip ${st.f === k ? 'on' : ''}" data-act="ct_f" data-f="${k}">${t}</button>`).join('')}</div>
        ${shown.length ? `<div class="list">${shown.map(row).join('')}</div>` : `<div class="empty big"><div class="ei">📄</div><b>Aucun contrat</b><p class="mut">Créez un contrat d'abonnement, de fourniture Starlink, de vente de matériel, de travail ou un contrat libre : le texte est généré, vous le modifiez, puis vous l'imprimez ou l'envoyez en PDF.</p></div>`}`
    };
  };
  App.actions.ct_f = d => { st.f = d.f; App.refresh(); };
  // block shown on a client sheet
  App.contractsBlock = c => { if (!App.canView('contracts')) return ''; const l = list().filter(x => x.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date));
    return `<h2 class="sec">Contrats</h2><div class="bar"><button class="btn sm" data-act="ct_new" data-cid="${c.id}">+ Nouveau contrat</button></div>${l.length ? `<div class="list">${l.map(x => { const s = STAT[App.contractStatus(x)]; return `<button class="item" data-act="ct_open" data-id="${x.id}"><span class="avatar ${s[1]}">${T(x).icon}</span><div class="grow"><b>${esc(x.no)}</b><small>${esc(T(x).label)} · ${App.fdate(x.date)}</small></div><span class="pill ${s[1]}">${s[0]}</span></button>`; }).join('')}</div>` : '<div class="empty">Aucun contrat pour ce client.</div>'}`; };

  // ---------- create / edit ----------
  const fieldHtml = (t, f, ex) => t.fields.map(([k, l, kind, def, opts]) => { const v = ex && ex[k] !== undefined ? ex[k] : def, id = 'cf_' + k;
    return kind === 'sel' ? F.sel(id, l, opts, v) : kind === 'num' ? F.num(id, l, v) : kind === 'date' ? F.date(id, l, v) : kind === 'area' ? F.area(id, l, v, `rows="${k === 'body' ? 10 : 3}"`) : F.text(id, l, v); }).join('');
  App.contractForm = (c, cid) => {
    const isNew = !c, t0 = App.today(), S = App.db.settings;
    c = c || { type: 'abonnement', clientId: cid || '', party: {}, date: t0, start: t0, months: TYPES.abonnement.term, currency: 'USD', rep: '', f: {} };
    const cl0 = c.clientId && App.client(c.clientId);
    const render = type => { const t = tdef(type), ex = type === c.type ? { ...c.f } : {}, cl = App.client(App.v('ct_cl') || c.clientId);
      if (cl) { if (ex.site === undefined) ex.site = cl.installAddr || cl.address || ''; if (ex.acc === undefined) ex.acc = cl.acc || ''; if ((type === 'abonnement' || type === 'fournisseur') && cl.type === 'gere') { if (ex.plan === undefined && cl.plan) ex.plan = cl.plan; if (ex.amount === undefined && cl.price) ex.amount = cl.price; } }
      if (type === 'travail' && ex.place === undefined) ex.place = S.company.city || ''; if (type === 'abonnement' && ex.grace === undefined) ex.grace = S.grace || 15;
      $('ct_f').innerHTML = fieldHtml(t, null, ex); if (t.noTerm) $('ct_termrow').style.display = 'none'; else $('ct_termrow').style.display = ''; $('ct_clrow').style.display = t.who === 'person' ? 'none' : ''; $('ct_months').value = type === c.type ? c.months : t.term; };
    App.modal(isNew ? 'Nouveau contrat' : 'Modifier ' + c.no,
      `${isNew ? F.sel('ct_type', 'Type de contrat', [...Object.entries(TYPES).map(([k, t]) => [k, t.icon + ' ' + t.label]), ...models().map(m => ['m:' + m.id, (m.icon || '📄') + ' ' + m.name + ' (mon modèle)'])], c.type) : `<p class="mut" style="margin-top:0">${T(c).icon} ${esc(T(c).label)}</p>`}
       <div id="ct_clrow">${F.sel('ct_cl', 'Client', App.clientOpts('— Autre (saisir ci-dessous) —'), c.clientId)}</div>
       <div id="ct_party" ${cl0 ? 'hidden' : ''}>${F.text('ct_pname', 'Nom complet', (c.party || {}).name || '')}${F.text('ct_pidno', 'N° pièce d\'identité (facultatif)', (c.party || {}).idno || '')}<div class="row">${F.text('ct_pphone', 'Téléphone', (c.party || {}).phone || '')}${F.text('ct_paddr', 'Adresse', (c.party || {}).address || '')}</div></div>
       <div class="row">${F.date('ct_date', 'Date de signature', c.date)}${F.date('ct_start', 'Début', c.start)}</div>
       <div id="ct_termrow" class="row">${F.num('ct_months', 'Durée (mois, 0 = indéterminée)', c.months, 'min="0"')}${F.sel('ct_cur', 'Devise', CUR, c.currency)}</div>
       ${F.text('ct_rep', 'Représenté(e) par (côté société, facultatif)', c.rep || '')}
       <div id="ct_f"></div>
       ${isNew ? '' : `<label class="chk" style="display:block;margin-top:8px"><input type="checkbox" id="ct_regen"> Régénérer le texte du contrat depuis le modèle (efface vos modifications du texte)</label>`}`,
      () => { const type = isNew ? App.v('ct_type') : c.type, t = tdef(type), f = {};
        t.fields.forEach(([k, l, kind]) => { const raw = $('cf_' + k).value; f[k] = kind === 'num' ? (raw === '' ? '' : Math.max(0, +raw || 0)) : String(raw).trim(); });
        const cl = t.who === 'person' ? '' : App.v('ct_cl'), p = { name: App.v('ct_pname').trim(), idno: App.v('ct_pidno').trim(), phone: App.v('ct_pphone').trim(), address: App.v('ct_paddr').trim() };
        if (!cl && !p.name) { App.toast(t.who === 'person' ? 'Saisissez le nom de l\'employé(e)' : 'Choisissez un client ou saisissez un nom'); return false; }
        if (type === 'libre' && !f.body) { App.toast('Écrivez le texte du contrat'); return false; }
        if ((type === 'materiel' || type === 'travail' || type === 'abonnement' || type === 'fournisseur' || type === 'mandat') && !(f.amount > 0)) { App.toast(type === 'travail' ? 'Saisissez le salaire' : 'Saisissez le montant'); return false; }
        const date = App.v('ct_date') || t0, start = App.v('ct_start') || date, months = t.noTerm ? 0 : Math.max(0, Math.round(App.n('ct_months')));
        const o = { type, clientId: cl, party: cl ? {} : p, date, start, months, end: endOf(start, months), currency: App.v('ct_cur') || 'USD', rep: App.v('ct_rep').trim(), f };
        if (isNew) { Object.assign(c, o, { id: App.uid(), ts: Date.now(), no: nextNo(date), status: 'draft' }); if (/^m:/.test(type)) { const m = models().find(x => 'm:' + x.id === type); c.mt = { name: m.name, icon: m.icon, title: m.title, a: m.a, b: m.b, body: m.body }; } c.body = bodyFor(c); list().push(c); if (cl) App.log(cl, `Contrat ${c.no} : ${t.label}`); }
        else { Object.assign(c, o); if ($('ct_regen') && $('ct_regen').checked) c.body = bodyFor(c); else if (type === 'libre') c.body = f.body; }
        App.save(); App.toast(isNew ? 'Contrat créé : ' + c.no : 'Contrat modifié'); App.refresh(); if (isNew) setTimeout(() => App.actions.ct_open({ id: c.id }), 80); },
      isNew ? 'Créer le contrat' : 'Enregistrer');
    render(c.type);
    if ($('ct_type')) $('ct_type').onchange = () => render($('ct_type').value);
    $('ct_cl').onchange = () => { const cl = App.client($('ct_cl').value); $('ct_party').hidden = !!cl; if (cl) { const s = $('cf_site'), a = $('cf_acc'); if (s && !s.value) s.value = cl.installAddr || cl.address || ''; if (a && !a.value) a.value = cl.acc || ''; const pl = $('cf_plan'); if (pl && cl.plan && !pl.value) pl.value = cl.plan; } };
  };
  App.actions.ct_new = d => App.contractForm(null, d && d.cid);

  // ---------- printable document ----------
  App.contractDoc = (c, logo, stamp) => {
    const K = App.docKit, co = App.db.settings.company, e = esc, t = T(c), p = partyOf(c), title = c.type === 'libre' && c.f && c.f.title ? c.f.title.toUpperCase() : t.title;
    const blocks = fill(c.body, c).split(/\n{2,}/).map(b => b.trim()).filter(Boolean).map(b => { const [h, ...r] = b.split('\n'); return /^article\b/i.test(h) ? `<div class="ctt">${e(h)}</div>${r.length ? `<p class="ctp">${e(r.join('\n')).replace(/\n/g, '<br>')}</p>` : ''}` : `<p class="ctp">${e(b).replace(/\n/g, '<br>')}</p>`; }).join('');
    const parties = K.boxes(t.a[0], [['', `<b>${e(co.name)}</b>`], co.address && ['Siège', e(co.address)], co.rccm && ['RCCM', e(co.rccm)], co.idnat && ['Id. Nat.', e(co.idnat)], co.phone && ['Tél.', e(co.phone)], c.rep && ['Représentée par', e(c.rep)]], t.b[0], [['', `<b>${e(p.name)}</b>`], p.idno && ['Pièce d\'identité', e(p.idno)], p.address && ['Adresse', e(p.address)], p.phone && ['Tél.', e(p.phone)]]);
    return `<div class="paper">${K.head(co, logo)}
      <div class="cttl">${e(title)}</div><div class="ctno">N° ${e(c.no)} · ${e(co.city || 'Kinshasa')}, le ${App.fdate(c.date)}</div>
      <p class="ctp" style="margin-top:12px"><b>Entre les soussignés :</b></p>${parties}<p class="ctp"><b>Il a été convenu ce qui suit :</b></p>
      ${blocks}
      <p class="ctp" style="margin-top:14px">Fait à ${e(co.city || 'Kinshasa')}, le ${App.fdate(c.date)}, en deux exemplaires originaux.</p>
      <table class="sg ctsg"><tr><td class="ln">${e(t.b[0])}<br><small>Lu et approuvé, bon pour accord</small></td><td class="gp"></td><td class="s2"><img src="${e(stamp || 'stamp.png')}" alt=""></td></tr><tr><td></td><td class="gp"></td><td class="ln">${e(t.a[0])}<br><small>${e(co.name)}${c.rep ? ' · ' + e(c.rep) : ''}</small></td></tr></table>${K.foot(stamp, true)}</div>`; };
  App.actions.ct_print = async x => { const c = list().find(y => y.id === x.id); if (c) App.docKit.print('Contrat ' + c.no, App.contractDoc(c, await App.docKit.logoData(), await App.docKit.stampData())); };
  App.actions.ct_pdf = async x => { const c = list().find(y => y.id === x.id); if (c) App.sharePdf(`Contrat-${c.no}.pdf`, App.contractDoc(c, await App.docKit.logoData(), await App.docKit.stampData())); };
  App.actions.ct_wa = x => { const c = list().find(y => y.id === x.id); if (!c) return; const p = partyOf(c), co = App.db.settings.company, t = T(c);
    const txt = `Bonjour ${p.name},\nVoici votre contrat ${c.no} (${t.label}) du ${App.fdate(c.date)}${c.end ? ', valable jusqu\'au ' + App.fdate(c.end) : ''}.${c.f && c.f.amount ? '\nMontant : ' + App.fmt(c.f.amount, c.currency) : ''}\nMerci de le lire puis de nous confirmer votre accord.\n${co.name}`;
    if (p.phone) window.open(App.waUrl(p.phone, txt), '_blank', 'noopener'); else window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener'); };

  // ---------- detail ----------
  App.actions.ct_open = x => {
    const c = list().find(y => y.id === x.id); if (!c) return; const s = STAT[App.contractStatus(c)], t = T(c), p = partyOf(c);
    App.modal('Contrat ' + c.no,
      `<div class="card" style="margin:0 0 10px"><div class="spread"><b>${t.icon} ${esc(t.label)}</b><span class="pill ${s[1]}">${s[0]}</span></div>
        <div class="mut">${esc(p.name)}${p.phone ? ' · ' + esc(p.phone) : ''}</div><div class="mut">Signé le ${App.fdate(c.date)} · du ${App.fdate(c.start)}${c.end ? ' au ' + App.fdate(c.end) : ' (durée indéterminée)'}</div>
        ${c.f && c.f.amount ? `<div class="spread" style="margin-top:8px"><span>Montant</span><b style="font-size:18px">${App.fmt(c.f.amount, c.currency)}</b></div>` : ''}</div>
       <div class="bar noprint"><button type="button" class="btn sec" data-act="ct_print" data-id="${c.id}">🖨️ Imprimer</button><button type="button" class="btn sec" data-act="ct_pdf" data-id="${c.id}">📤 PDF</button><button type="button" class="btn sec" data-act="ct_wa" data-id="${c.id}">💬 WhatsApp</button></div>
       <div class="bar"><button type="button" class="btn sec" data-act="ct_text" data-id="${c.id}">📝 Articles : lire, ajouter, modifier</button></div>
       ${c.status === 'draft' ? `<div class="bar"><button type="button" class="btn" data-act="ct_set" data-id="${c.id}" data-s="active">✅ Signé : mettre en cours</button></div>` : ''}
       ${c.status === 'active' ? `<div class="bar"><button type="button" class="btn sec" data-act="ct_set" data-id="${c.id}" data-s="ended">🏁 Terminé</button><button type="button" class="btn sec" data-act="ct_set" data-id="${c.id}" data-s="cancelled">⛔ Résilié</button>${c.end ? `<button type="button" class="btn" data-act="ct_renew" data-id="${c.id}">🔁 Renouveler</button>` : ''}</div>` : ''}
       ${c.status !== 'draft' && c.status !== 'active' ? `<div class="bar"><button type="button" class="btn sec" data-act="ct_set" data-id="${c.id}" data-s="active">↺ Remettre en cours</button></div>` : ''}
       <div class="bar"><button type="button" class="btn sm sec" data-act="ct_edit" data-id="${c.id}">✏️ Modifier</button><button type="button" class="btn sm sec" data-act="ct_dup" data-id="${c.id}">⎘ Dupliquer</button><button type="button" class="btn sm sec" data-act="ct_tomodel" data-id="${c.id}">📚 Enregistrer comme modèle</button>${c.clientId ? `<button type="button" class="btn sm sec" data-act="go" data-v="client" data-id="${c.clientId}">👤 Client</button>` : ''}<button type="button" class="btn sm sec" data-act="ct_del" data-id="${c.id}">🗑 Supprimer</button></div>`);
  };
  App.actions.ct_set = x => { const c = list().find(y => y.id === x.id); if (!c) return; c.status = x.s; if (c.clientId) App.log(c.clientId, `Contrat ${c.no} : ${STAT[x.s][0].toLowerCase()}`); App.save(); App.close(); App.refresh(); App.toast(STAT[x.s][0]); };
  App.actions.ct_edit = x => { const c = list().find(y => y.id === x.id); if (c) { App.close(); setTimeout(() => App.contractForm(c), 30); } };
  // ---------- article editor: add / remove / move articles, numbering is automatic ----------
  const LIB = [
    ['Confidentialité', 'Chaque partie garde confidentielles les informations reçues de l\'autre (clients, prix, comptes, documents) et ne les communique à aucun tiers sans accord écrit, y compris après la fin du contrat.'],
    ['Force majeure', 'Aucune partie n\'est responsable d\'un retard ou d\'un manquement causé par un événement échappant à son contrôle (catastrophe naturelle, coupure d\'électricité ou de réseau prolongée, troubles, décision des autorités). Les obligations sont suspendues le temps de l\'événement.'],
    ['Pénalités de retard', 'Tout retard de paiement de plus de 7 jours après l\'échéance peut donner lieu à une pénalité selon le barème communiqué par CISPOLstore, sans mise en demeure préalable, sans préjudice du droit de suspendre le service.'],
    ['Résiliation pour faute', 'En cas de manquement grave d\'une partie à ses obligations, non réparé dans les 8 jours suivant un avertissement écrit (message compris), l\'autre partie peut résilier le contrat sans préavis.'],
    ['Modification du contrat', 'Toute modification du présent contrat fait l\'objet d\'un avenant écrit et signé (ou accepté par message) des deux parties.'],
    ['Notifications', 'Les avis et rappels sont valablement envoyés par message WhatsApp, SMS, e-mail ou remise en main propre aux coordonnées indiquées en tête du contrat. Chaque partie signale tout changement de coordonnées.'],
    ['Intégralité de l\'accord', 'Le présent contrat exprime l\'accord complet des parties sur son objet et remplace tout engagement oral ou écrit antérieur.'],
    ['Cession', 'Le contrat est personnel : le Client ne peut le céder ou le transférer à un tiers sans l\'accord écrit de l\'autre partie.']
  ];
  let ed = null;
  const parseBody = body => String(body || '').split(/\n{2,}/).map(b => b.trim()).filter(Boolean).map(b => { const [h, ...r] = b.split('\n'), m = /^article\s*\d*\s*[–—-]?\s*(.*)$/i.exec(h); return m ? { t: m[1].trim(), x: r.join('\n').trim() } : { t: '', x: b }; });
  const buildBody = items => { let n = 0; return items.filter(i => i.t.trim() || i.x.trim()).map(i => i.t.trim() ? `Article ${++n} – ${i.t.trim()}${i.x.trim() ? '\n' + i.x.trim() : ''}` : i.x.trim()).join('\n\n'); };
  const edSync = () => { document.querySelectorAll('#ct_arts [data-ai]').forEach(el => { const it = ed.items[+el.dataset.ai]; if (it) it[el.dataset.af] = el.value; }); };
  const edDraw = () => { let n = 0;
    $('ct_arts').innerHTML = ed.items.length ? ed.items.map((it, i) => `<div class="card" style="margin:0 0 8px"><div class="spread"><b>${it.t !== '' || it.new ? `Article ${++n}` : 'Texte libre'}</b><span><button type="button" class="btn sm sec" data-act="ct_up" data-i="${i}" ${i ? '' : 'disabled'}>↑</button> <button type="button" class="btn sm sec" data-act="ct_dn" data-i="${i}" ${i < ed.items.length - 1 ? '' : 'disabled'}>↓</button> <button type="button" class="btn sm del" data-act="ct_rm" data-i="${i}">✕</button></span></div>
      ${it.t !== '' || it.new ? `<input data-ai="${i}" data-af="t" value="${esc(it.t)}" placeholder="Titre de l'article (ex. Durée)" style="width:100%;margin:6px 0">` : ''}<textarea data-ai="${i}" data-af="x" rows="${Math.min(8, Math.max(3, Math.ceil((it.x || '').length / 55)))}" style="width:100%" placeholder="Texte de l'article">${esc(it.x)}</textarea></div>`).join('') : '<div class="empty">Aucun article : ajoutez-en avec les boutons ci-dessus.</div>'; };
  const edMove = (i, d) => { edSync(); const j = i + d; if (j < 0 || j >= ed.items.length) return; [ed.items[i], ed.items[j]] = [ed.items[j], ed.items[i]]; edDraw(); };
  App.actions.ct_up = d => edMove(+d.i, -1);
  App.actions.ct_dn = d => edMove(+d.i, 1);
  App.actions.ct_rm = d => { edSync(); ed.items.splice(+d.i, 1); edDraw(); };
  App.actions.ct_add = () => { edSync(); ed.items.push({ t: '', x: '', new: true }); edDraw(); const l = document.querySelectorAll('#ct_arts input[data-af=t]'); if (l.length) l[l.length - 1].focus(); };
  const openArticles = (title, head, body, onSave) => { ed = { items: parseBody(body) };
    App.modal(title, `${head}<div class="bar"><button type="button" class="btn" data-act="ct_add">+ Nouvel article</button></div>
       ${F.sel('ct_lib', 'Ou ajouter un article type', [['', '— Choisir —'], ...LIB.map((a, i) => [String(i), a[0]])], '')}
       <div id="ct_arts" style="margin-top:10px"></div>`, () => { edSync(); return onSave(buildBody(ed.items)); }, 'Enregistrer');
    edDraw(); $('ct_lib').onchange = () => { const a = LIB[+$('ct_lib').value]; if (!a) return; edSync(); ed.items.push({ t: a[0], x: a[1] }); $('ct_lib').value = ''; edDraw(); App.toast('Article ajouté : ' + a[0]); }; };
  const HELP = 'Champs automatiques : {{client}}, {{societe}}, {{date}}, {{montant}}, {{adresse}}, {{telephone}}, {{debut}}, {{fin}}, {{duree}}, {{objet}}.';
  App.actions.ct_text = x => { const c = list().find(y => y.id === x.id); if (!c) return; App.close();
    setTimeout(() => openArticles('Articles du contrat ' + c.no, `<p class="mut" style="margin-top:0">Ajoutez, déplacez ou supprimez des articles : la numérotation se refait toute seule. ${HELP} Modèle indicatif : faites-le relire par un juriste avant tout engagement important.</p>`, c.body,
      body => { c.body = body; if (c.type === 'libre') c.f = { ...c.f, body }; App.save(); App.toast('Articles enregistrés'); App.refresh(); setTimeout(() => App.actions.ct_open({ id: c.id }), 80); }), 40); };

  // ---------- my own models ----------
  const ICONS = ['📄', '🏠', '🤝', '🛠️', '🚚', '🛒', '💼', '🔒', '📡', '🧾', '👔', '🎓'];
  const cmList = () => App.modal('Mes modèles de contrat',
    `<p class="mut" style="margin-top:0">Vos modèles apparaissent dans « Type de contrat » quand vous créez un contrat. Astuce : sur un contrat existant, « Enregistrer comme modèle ».</p>
     <div class="bar"><button type="button" class="btn" data-act="cm_new">+ Nouveau modèle</button></div>
     ${models().length ? `<div class="list">${models().map(m => `<div class="item"><span class="avatar">${esc(m.icon || '📄')}</span><div class="grow"><b>${esc(m.name)}</b><small>${parseBody(m.body).filter(i => i.t).length} article(s) · ${esc(m.title || '')}</small></div><button type="button" class="btn sm sec" data-act="cm_edit" data-id="${m.id}">✏️</button> <button type="button" class="btn sm sec" data-act="cm_del" data-id="${m.id}">🗑</button></div>`).join('')}</div>` : '<div class="empty">Aucun modèle pour le moment.</div>'}`);
  App.actions.cm_list = () => { App.close(); setTimeout(cmList, 40); };
  const cmForm = (m, isNew) => { App.close();
    setTimeout(() => openArticles(isNew ? 'Nouveau modèle' : 'Modèle : ' + m.name,
      `${F.text('cm_name', 'Nom du modèle', m.name)}${F.sel('cm_icon', 'Icône', ICONS.map(i => [i, i]), m.icon || '📄')}${F.text('cm_title', 'Titre sur le document (ex. CONTRAT DE LOCATION)', m.title || '')}
       <div class="row">${F.text('cm_a', 'Partie 1 (ex. LE BAILLEUR)', m.a || '')}${F.text('cm_b', 'Partie 2 (ex. LE LOCATAIRE)', m.b || '')}</div>${F.num('cm_months', 'Durée par défaut (mois, 0 = indéterminée)', m.months || 0, 'min="0"')}
       <p class="mut">${HELP}</p>`, m.body,
      body => { const name = App.v('cm_name').trim(); if (!name) { App.toast('Donnez un nom au modèle'); return false; }
        Object.assign(m, { name, icon: App.v('cm_icon') || '📄', title: App.v('cm_title').trim(), a: App.v('cm_a').trim().toUpperCase(), b: App.v('cm_b').trim().toUpperCase(), months: Math.max(0, Math.round(App.n('cm_months'))), body });
        if (isNew) models().push(m); App.save(); App.toast('Modèle enregistré : ' + name); setTimeout(cmList, 80); }), 40); };
  App.actions.cm_new = () => cmForm({ id: App.uid(), ts: Date.now(), name: '', icon: '📄', title: '', a: 'LE PRESTATAIRE', b: 'LE CLIENT', months: 0, body: 'Article 1 – Objet\n\nArticle 2 – Prix\n\nArticle 3 – Durée\n\nArticle 4 – Litiges' }, true);
  App.actions.cm_edit = x => { const m = models().find(y => y.id === x.id); if (m) cmForm(m, false); };
  App.actions.cm_del = x => { const m = models().find(y => y.id === x.id); if (!m || !App.confirm(`Supprimer le modèle « ${m.name} » ? Les contrats déjà créés avec ce modèle sont conservés.`)) return; App.db.cmodels = models().filter(y => y !== m); App.save(); App.close(); setTimeout(cmList, 40); };
  App.actions.ct_tomodel = x => { const c = list().find(y => y.id === x.id); if (!c) return; const t = T(c);
    const m = { id: App.uid(), ts: Date.now(), name: t.label + ' (modèle)', icon: t.icon, title: c.type === 'libre' && c.f && c.f.title ? c.f.title : t.title, a: t.a[0], b: t.b[0], months: c.months || 0, body: c.body };
    App.toast('Remplacez les noms et montants par {{client}}, {{montant}}… puis enregistrez'); cmForm(m, true); };
  const copyOf = (c, over) => { const n = { ...c, party: { ...(c.party || {}) }, f: { ...(c.f || {}) }, id: App.uid(), ts: Date.now(), status: 'draft', ...over }; n.no = nextNo(n.date); return n; };
  App.actions.ct_dup = x => { const c = list().find(y => y.id === x.id); if (!c) return; const t = App.today(), n = copyOf(c, { date: t, start: t, end: endOf(t, c.months) }); list().push(n); App.save(); App.close(); App.refresh(); App.toast('Contrat dupliqué : ' + n.no); };
  App.actions.ct_renew = x => { const c = list().find(y => y.id === x.id); if (!c || !c.end) return; const start = App.addDays(c.end, 1), n = copyOf(c, { date: App.today(), start, end: endOf(start, c.months) }); n.body = c.type === 'libre' || /^m:/.test(c.type) ? c.body : gen(n);
    c.status = 'ended'; list().push(n); if (c.clientId) App.log(c.clientId, `Contrat ${c.no} renouvelé : ${n.no}`); App.save(); App.close(); App.refresh(); App.toast('Contrat renouvelé : ' + n.no); setTimeout(() => App.actions.ct_open({ id: n.id }), 80); };
  App.actions.ct_del = x => { const c = list().find(y => y.id === x.id); if (!c) return; if (!App.confirm(`Supprimer le contrat ${c.no} ?`)) return; App.db.contracts = list().filter(y => y !== c); App.save(); App.close(); App.refresh(); };
})();
