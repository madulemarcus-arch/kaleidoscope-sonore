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
    installation: { label: 'Installation et maintenance', icon: '🔧', title: 'CONTRAT D\'INSTALLATION ET DE MAINTENANCE', a: ['LE PRESTATAIRE', 'le Prestataire'], b: ['LE CLIENT', 'le Client'], term: 12, who: 'client',
      fields: [['kind', 'Prestations', 'sel', 'both', [['both', 'Installation et maintenance'], ['install', 'Installation seule'], ['maint', 'Maintenance seule']]], ['equip', 'Équipement concerné', 'text', 'Kit Starlink'], ['site', 'Site d\'installation', 'text', ''], ['amount', 'Prix de l\'installation', 'num', ''], ['pct', 'Acompte à la signature (%)', 'num', 50], ['when', 'Installation prévue le', 'date', ''], ['maint', 'Redevance de maintenance', 'num', 0], ['per', 'Redevance payable', 'sel', 'mois', [['mois', 'par mois'], ['an', 'par an']]], ['delay', 'Délai de dépannage (heures ouvrables)', 'num', 48], ['visits', 'Visites préventives par an', 'num', 1], ['warranty', 'Garantie des travaux (mois)', 'num', 3]] },
    prestataire: { label: 'Technicien indépendant / prestataire', icon: '🛠️', title: 'CONTRAT DE PRESTATION DE SERVICES (TECHNICIEN INDÉPENDANT)', a: ['LE DONNEUR D\'ORDRE', 'le Donneur d\'ordre'], b: ['LE PRESTATAIRE', 'le Prestataire'], term: 0, who: 'person',
      fields: [['missions', 'Missions confiées', 'text', 'Installation, dépannage et maintenance d\'équipements Internet'], ['zone', 'Zone d\'intervention', 'text', ''], ['mode', 'Rémunération', 'sel', 'intervention', [['intervention', 'Par intervention (tarif)'], ['forfait', 'Forfait mensuel']]], ['amount', 'Tarif par intervention ou forfait mensuel', 'num', ''], ['pay', 'Délai de paiement après validation (jours)', 'num', 7], ['repair', 'Reprise des malfaçons (jours)', 'num', 30], ['nosol', 'Non-sollicitation après la fin (mois)', 'num', 6], ['notice', 'Préavis de résiliation (jours)', 'num', 15], ['nif', 'N° d\'identification fiscale (s\'il en a un)', 'text', '']] },
    dette: { label: 'Reconnaissance de dette (échéancier)', icon: '🧾', title: 'RECONNAISSANCE DE DETTE AVEC ÉCHÉANCIER DE REMBOURSEMENT', a: ['LE CRÉANCIER', 'le Créancier'], b: ['LE DÉBITEUR', 'le Débiteur'], term: 0, who: 'client', noTerm: true,
      fields: [['invid', 'Facture impayée concernée (facultatif : remplit le montant et l\'origine)', 'sel', '', [['', '— Aucune —']]], ['amount', 'Montant total de la dette', 'num', ''], ['origin', 'Origine de la dette', 'text', ''], ['deposit', 'Versement à la signature (0 = aucun)', 'num', 0], ['count', 'Nombre de versements', 'num', 6], ['freq', 'Rythme', 'sel', 'month', [['month', 'Mensuel'], ['fortnight', 'Tous les 15 jours'], ['week', 'Hebdomadaire']]], ['first', 'Date du premier versement', 'date', ''], ['interest', 'Intérêt (% par mois, 0 = aucun)', 'num', 0], ['penalty', 'Pénalité de retard (% de l\'échéance)', 'num', 5], ['grace', 'Délai de grâce (jours)', 'num', 5], ['strikes', 'Échéances impayées avant déchéance du terme', 'num', 2], ['warn', 'Avertissement avant déchéance (jours)', 'num', 7], ['surety', 'Caution : nom, adresse, téléphone (facultatif)', 'text', '']] },
    cgu: { label: 'Conditions d\'utilisation du Wi-Fi', icon: '📶', title: 'CONDITIONS D\'UTILISATION DU SERVICE WI-FI (WIFI ZONE)', a: ['LE FOURNISSEUR', 'le Fournisseur'], b: ['L\'UTILISATEUR', 'l\'Utilisateur'], term: 0, who: 'none', noTerm: true,
      fields: [['point', 'Point de vente / zone (facultatif)', 'text', ''], ['devices', 'Appareils par ticket', 'sel', 'one', [['one', 'Un seul appareil'], ['many', 'Plusieurs appareils (selon le ticket)']]], ['startmode', 'La durée du ticket commence', 'sel', 'first', [['first', 'À la première connexion'], ['sale', 'À la vente du ticket']]], ['keep', 'Conservation des données de connexion (mois)', 'num', 12], ['claim', 'Délai de réclamation (heures)', 'num', 24], ['contact', 'Contact pour les réclamations (vide = téléphone de l\'entreprise)', 'text', ''], ['extra', 'Interdiction supplémentaire propre au point de vente (facultatif)', 'text', '']] },
    confidentialite: { label: 'Confidentialité (NDA)', icon: '🤐', title: 'ACCORD DE CONFIDENTIALITÉ', a: ['LE DIVULGATEUR', 'le Divulgateur'], b: ['LE DESTINATAIRE', 'le Destinataire'], term: 0, who: 'person',
      fields: [['motif', 'Motif de la communication', 'text', 'Collaboration commerciale ou technique avec CISPOLstore'], ['after', 'Confidentialité après la fin (années)', 'num', 3], ['restit', 'Restitution ou destruction des informations (jours)', 'num', 7], ['penalty', 'Pénalité par manquement (0 = aucune)', 'num', 0]] },
    hebergement: { label: 'Hébergement d\'une borne Wi-Fi', icon: '📡', title: 'CONTRAT D\'HÉBERGEMENT D\'UNE BORNE WI-FI', a: ['LE PROPRIÉTAIRE', 'le Propriétaire'], b: ['L\'HÔTE', 'l\'Hôte'], term: 0, who: 'person',
      fields: [['equip', 'Équipement installé', 'text', 'Borne Wi-Fi WiFi Zone (routeur et antenne)'], ['site', 'Adresse du local', 'text', ''], ['power', 'Indemnité mensuelle pour l\'électricité et l\'emplacement (0 = aucune)', 'num', 5], ['benefit', 'Avantage de l\'Hôte', 'sel', 'free', [['free', 'Accès Wi-Fi gratuit pour lui et son personnel'], ['pct', 'Part (%) des ventes de tickets de la borne'], ['fixed', 'Montant fixe par mois'], ['none', 'Aucun avantage']]], ['benval', 'Valeur de l\'avantage (% ou montant fixe selon le choix)', 'num', 10], ['fix', 'Délai de dépannage (heures ouvrables)', 'num', 48], ['notice', 'Préavis de fin (jours)', 'num', 15], ['restit', 'Restitution du matériel après la fin (heures)', 'num', 48], ['landlord', 'L\'Hôte est locataire du local', 'sel', 'no', [['no', 'Non (propriétaire du local)'], ['yes', 'Oui (accord écrit du bailleur requis)']]]] },
    revendeur: { label: 'Revendeur de tickets WiFi Zone', icon: '🎟️', title: 'CONTRAT DE REVENTE DE TICKETS WI-FI (WIFI ZONE)', a: ['LE FOURNISSEUR', 'le Fournisseur'], b: ['LE REVENDEUR', 'le Revendeur'], term: 0, who: 'person',
      fields: [['zone', 'Point de vente / zone', 'text', ''], ['amount', 'Remise du Revendeur (% du prix public)', 'num', 10], ['pay', 'Versement des fonds', 'sel', 'week', [['week', 'Chaque semaine (le lundi)'], ['order', 'À chaque nouvelle remise de tickets'], ['day', 'Chaque jour']]], ['cap', 'Plafond de stock confié (valeur)', 'num', 200], ['deposit', 'Caution (0 = aucune)', 'num', 0], ['defect', 'Délai pour signaler un ticket défectueux (heures)', 'num', 48], ['notice', 'Préavis de fin (jours)', 'num', 7], ['settle', 'Solde de tout compte après la fin (heures)', 'num', 48]] },
    apporteur: { label: 'Apporteur d\'affaires / agent', icon: '🤝', title: 'CONTRAT D\'AGENT COMMERCIAL / APPORTEUR D\'AFFAIRES', a: ['LE DONNEUR D\'ORDRE', 'le Donneur d\'ordre'], b: ['L\'AGENT', 'l\'Agent'], term: 0, who: 'person',
      fields: [['role', 'Rôle', 'sel', 'apporteur', [['apporteur', 'Apporteur d\'affaires (recommande et transmet des contacts)'], ['agent', 'Agent commercial (négocie au nom de CISPOLstore)']]], ['products', 'Produits et services concernés', 'text', 'Abonnements Starlink, matériel, installation, tickets Wi-Fi'], ['zone', 'Zone', 'text', ''], ['kind', 'Commission', 'sel', 'pct', [['pct', 'Pourcentage des montants encaissés'], ['fixed', 'Montant fixe par vente']]], ['amount', 'Taux (%) ou montant fixe', 'num', ''], ['renew', 'Renouvellements payés (mois, 0 = premier paiement seulement)', 'num', 0], ['payDays', 'Paiement après encaissement (jours)', 'num', 7], ['notice', 'Préavis de fin (jours)', 'num', 30]] },
    mandat: { label: 'Mandat de gestion de fonds', icon: '💼', title: 'CONTRAT DE MANDAT DE GESTION DE FONDS', a: ['LE MANDATAIRE', 'le Mandataire'], b: ['LE MANDANT', 'le Mandant'], term: 0, who: 'client',
      fields: [['purpose', 'Objet des paiements', 'text', 'Abonnement Starlink'], ['amount', 'Montant remis', 'num', ''], ['fee', 'Frais de gestion fixes (par paiement effectué)', 'num', 0], ['restit', 'Délai de restitution du solde (jours)', 'num', 7], ['acc', 'Compte Starlink concerné (ACC)', 'text', '']] },
    travail: { label: 'Contrat de travail / vendeur', icon: '👔', title: 'CONTRAT DE TRAVAIL', a: ['L\'EMPLOYEUR', 'l\'Employeur'], b: ['L\'EMPLOYÉ(E)', 'l\'Employé(e)'], term: 6, who: 'person',
      fields: [['job', 'Poste / fonction', 'text', 'Vendeur'], ['amount', 'Salaire mensuel', 'num', ''], ['payday', 'Jour de paie (du mois)', 'num', 30], ['commission', 'Commission / prime (facultatif)', 'text', ''], ['trial', 'Période d\'essai (jours)', 'num', 30], ['hours', 'Horaires de travail', 'text', 'Du lundi au samedi, de 8 h à 17 h'], ['place', 'Lieu de travail', 'text', ''], ['motif', 'Motif du CDD (obligatoire si une durée est indiquée)', 'text', '']] },
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
  const SKEL = 'Article 1 – Objet\n\nArticle 2 – Prix\n\nArticle 3 – Durée\n\nArticle 4 – Litiges';
  const twoTexts = type => type !== 'libre' && !/^m:/.test(type); // built-in types keep two texts: the proposed one and your own
  const bodyFor = c => c.type === 'libre' ? (c.f || {}).body || '' : /^m:/.test(c.type) ? (models().find(x => 'm:' + x.id === c.type) || c.mt || {}).body || c.body || '' : gen(c);

  const partyOf = c => { if (T(c).who === 'none') return { name: (c.f && c.f.point) || 'Tous les points de vente', phone: '', address: '', idno: '' };
    const cl = c.clientId ? App.client(c.clientId) : null, p = c.party || {};
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
    if (c.type === 'installation') {
      const hasI = f.kind !== 'maint', hasM = f.kind !== 'install', dep = Math.round((f.amount || 0) * (f.pct || 0)) / 100, per = f.per === 'an' ? 'an' : 'mois';
      const what = f.kind === 'maint' ? 'la maintenance' : f.kind === 'install' ? 'l\'installation' : 'l\'installation et la maintenance';
      return art([
        ['Objet', `Le Prestataire fournit au Client ${what} de l'équipement suivant : ${f.equip || 'à préciser'}${f.site ? `, à l'adresse : ${f.site}` : ''}.`],
        ['Prestations', `${hasI ? 'L\'installation comprend la pose de l\'antenne, le câblage, la configuration du routeur et les tests de connexion. ' : ''}${hasM ? `La maintenance comprend le dépannage${f.visits > 0 ? ` et ${f.visits} visite${f.visits > 1 ? 's' : ''} préventive${f.visits > 1 ? 's' : ''} par an` : ''}.` : ''}`.trim()],
        ['Obligations du Client', 'Le Client donne l\'accès au site et fournit l\'alimentation électrique. Il obtient l\'accord du propriétaire pour la pose du matériel et assure un accès sûr au toit ou au point d\'installation. Il signale toute panne sans délai.'],
        ['Prix et paiement', `${hasI ? `Le prix de l'installation est de ${money(f.amount, cu)} (${word(f.amount, cu)}). ${f.pct > 0 ? `Un acompte de ${f.pct} %, soit ${money(dep, cu)}, est versé à la signature ; le solde est payable à la réception des travaux. ` : 'Le prix est payable à la réception des travaux. '}` : ''}${hasM && f.maint > 0 ? `La redevance de maintenance est de ${money(f.maint, cu)} par ${per}, payable d'avance. ` : ''}${co.payTerms || ''}`.trim()],
        ['Délais', `${hasI ? `L'installation est prévue ${f.when ? 'le ' + App.fdate(f.when) : 'à une date convenue entre les parties'}. ` : ''}${hasM ? `Pour un dépannage, le Prestataire intervient dans un délai de ${f.delay || 48} heures ouvrables à compter du signalement par le Client (message compris), hors cas de force majeure.` : ''}`.trim()],
        ['Réception des travaux', hasI ? 'À la fin de l\'installation, le Client confirme la réception par signature ou par message. Il signale ses réserves dans les 48 heures ; passé ce délai, les travaux sont réputés conformes.' : 'Après chaque intervention, le Client confirme la bonne exécution par signature ou par message. Il signale ses réserves dans les 48 heures.'],
        ['Garantie des travaux', `Les travaux sont garantis ${f.warranty > 0 ? f.warranty + ' mois' : 'selon les usages'}. La garantie ne couvre pas la foudre, les surtensions, l'humidité, les chocs, le vol, le vandalisme, le déplacement du matériel, ni l'intervention d'un tiers non autorisé.`],
        ['Matériel', 'Le matériel acheté auprès du Prestataire suit son contrat de vente séparé. Le matériel appartenant au Client reste sous sa responsabilité.'],
        ['Interventions hors contrat', 'Toute intervention non prévue au présent contrat est facturée. Les frais de déplacement sont indiqués au Client avant l\'intervention.'],
        ['Responsabilité', 'Le Prestataire est tenu à une obligation de moyens. Il n\'est pas responsable des dommages indirects ni des pertes d\'exploitation. Le Client répond de la sécurité du site et de ses occupants.'],
        ['Durée et résiliation', `Le contrat prend effet le ${App.fdate(c.start)}, ${termText(c)}. ${hasM ? 'La maintenance peut être résiliée par chaque partie par écrit (message compris) avec un préavis de 30 jours. ' : ''}${hasI ? 'L\'installation prend fin à la réception des travaux.' : ''}`.trim()],
        ['Données personnelles', 'Les informations du Client servent uniquement à l\'exécution du contrat et ne sont pas transmises à des tiers, sauf obligation légale.'],
        ['Litiges', law]]);
    }
    if (c.type === 'prestataire') {
      const m = f.mode === 'forfait';
      return art([
        ['Objet', `Le Donneur d'ordre confie au Prestataire, qui l'accepte, les missions suivantes : ${f.missions || 'à préciser'}${f.zone ? `, dans la zone suivante : ${f.zone}` : ''}.`],
        ['Indépendance', 'Le Prestataire exerce ses missions de façon indépendante. Il organise librement son travail, ses horaires et ses moyens. Le présent contrat ne crée aucun lien de subordination et n\'est pas un contrat de travail. Le Prestataire peut travailler pour d\'autres clients.'],
        ['Statut du Prestataire', `Le Prestataire déclare exercer à titre indépendant, en personne, et être en situation régulière en République démocratique du Congo${f.nif ? ` (identification fiscale : ${f.nif})` : ''}. Il informe sans délai le Donneur d'ordre de tout changement de sa situation.`],
        ['Missions', 'Chaque intervention fait l\'objet d\'un bon d\'intervention (écrit ou message) précisant le client, l\'adresse, la prestation attendue et le délai. Le Prestataire peut refuser une mission proposée ; une fois acceptée, il l\'exécute.'],
        ['Rémunération', `Le Prestataire est rémunéré ${m ? `par un forfait de ${money(f.amount, cu)} (${word(f.amount, cu)}) par mois` : `par intervention, au tarif de ${money(f.amount, cu)} (${word(f.amount, cu)}) par intervention`}. Le paiement intervient dans un délai de ${f.pay || 7} jours après validation du bon d'intervention.`],
        ['Moyens et matériel', 'Le Prestataire utilise ses propres outils et son propre matériel de travail. Le matériel et les pièces confiés par le Donneur d\'ordre sont inventoriés, utilisés pour les seules missions prévues et restitués sur demande.'],
        ['Qualité et sécurité', `Le Prestataire respecte les règles de l'art et les consignes d'installation du fabricant. Il prend toutes les mesures de sécurité nécessaires, notamment pour les travaux en hauteur. Il reprend gratuitement toute malfaçon signalée dans les ${f.repair || 30} jours suivant l'intervention.`],
        ['Exécution personnelle', 'Le Prestataire exécute lui-même les missions. Il ne les confie pas à un tiers sans l\'accord écrit du Donneur d\'ordre ; s\'il y est autorisé, il reste responsable de ce tiers.'],
        ['Responsabilité et assurance', 'Le Prestataire répond de ses fautes et des dommages qu\'il cause aux clients ou à leurs biens. Il est invité à souscrire une assurance couvrant son activité.'],
        ['Obligations sociales et fiscales', 'Le Prestataire déclare et paie lui-même ses impôts, ses cotisations et ses charges. Le Donneur d\'ordre ne lui verse aucun salaire ni avantage de travailleur.'],
        ['Confidentialité et données des clients', 'Le Prestataire garde confidentielles les informations des clients et du Donneur d\'ordre (identités, adresses, comptes, prix). Il les utilise uniquement pour la mission, ne les conserve pas et ne les réutilise pas après la fin du contrat.'],
        ['Non-sollicitation', `Pendant la durée du contrat et ${f.nosol || 6} mois après, le Prestataire ne démarche pas, pour son propre compte, les clients du Donneur d'ordre rencontrés à l'occasion des missions.`],
        ['Durée et résiliation', `Le contrat prend effet le ${App.fdate(c.start)}, ${termText(c)}. Chaque partie peut y mettre fin par écrit (message compris) avec un préavis de ${f.notice || 15} jours. Une faute grave permet la résiliation immédiate.`],
        ['Données personnelles', 'Les informations du Prestataire servent uniquement à la gestion du contrat et ne sont pas transmises à des tiers, sauf obligation légale.'],
        ['Litiges', law]]);
    }
    if (c.type === 'dette') {
      const n = Math.max(1, Math.round(f.count) || 1), dep = Math.min(f.deposit || 0, f.amount || 0), rest = Math.round(((f.amount || 0) - dep) * 100) / 100, base = Math.floor(rest / n * 100) / 100;
      const first = f.first || App.addDays(c.date, 30), nth = k => f.freq === 'week' ? App.addDays(first, 7 * k) : f.freq === 'fortnight' ? App.addDays(first, 14 * k) : addMonths(first, k);
      let left = rest; const rows = []; for (let k = 0; k < n; k++) { const x = k === n - 1 ? Math.round(left * 100) / 100 : base; left = Math.round((left - x) * 100) / 100; rows.push(`${k + 1}. ${App.fdate(nth(k))} : ${money(x, cu)} (solde restant : ${money(Math.max(0, left), cu)})`); }
      const rhythm = { month: 'mensuels', fortnight: 'tous les 15 jours', week: 'hebdomadaires' }[f.freq] || 'mensuels';
      const list = [
        ['Reconnaissance de la dette', `Le Débiteur reconnaît devoir au Créancier la somme de ${money(f.amount, cu)} (${word(f.amount, cu)}), qu'il s'engage à lui rembourser selon les conditions ci-après.`],
        ['Origine de la dette', `Cette dette résulte de : ${f.origin || 'à préciser'}. Le Débiteur confirme que le montant est exact, qu'il est dû et qu'il ne le conteste pas.`],
        ['Versement initial', dep > 0 ? `Un versement de ${money(dep, cu)} (${word(dep, cu)}) est effectué à la signature ; il est déduit de la dette.` : 'Aucun versement n\'est effectué à la signature.'],
        ['Échéancier', `Le Débiteur rembourse ${dep > 0 ? 'le solde de ' + money(rest, cu) : 'la totalité de la dette'} en ${n} versement${n > 1 ? 's' : ''} ${rhythm}, le premier le ${App.fdate(first)}, selon le tableau suivant. Le dernier versement est ajusté pour solder exactement la dette.\n${rows.join('\n')}`],
        ['Mode de paiement', 'Les versements se font en espèces dans la Caisse, par Mobile Money ou par virement, au choix du Débiteur. Chaque versement donne lieu à un reçu remis au Débiteur. Seul le reçu (ou la preuve du virement) fait foi du paiement.'],
        ['Intérêts', f.interest > 0 ? `Un intérêt de ${f.interest} % par mois s'applique sur le solde restant dû avant chaque versement et se paie avec l'échéance.` : 'Aucun intérêt n\'est dû sur la dette tant que les échéances sont payées à la date prévue.'],
        ['Retard de paiement', f.penalty > 0 ? `Passé un délai de grâce de ${f.grace || 0} jours, tout retard entraîne une pénalité de ${f.penalty} % du montant de l'échéance en retard, sans mise en demeure préalable. Le Créancier peut aussi suspendre toute nouvelle vente ou prestation tant que l'échéance en retard n'est pas payée.` : 'Le Créancier peut suspendre toute nouvelle vente ou prestation tant qu\'une échéance en retard n\'est pas payée.'],
        ['Déchéance du terme', `Si ${f.strikes || 2} échéances ne sont pas payées à leur date, ou si le Débiteur disparaît, cesse son activité ou donne de fausses informations, la totalité du solde devient immédiatement exigible, après un message d'avertissement resté sans effet pendant ${f.warn || 7} jours.`],
        ['Paiement anticipé', 'Le Débiteur peut rembourser tout ou partie de la dette à l\'avance, sans frais. Les sommes versées en plus de l\'échéance réduisent les dernières échéances.']];
      if (f.surety) list.push(['Garantie', `Pour garantir le paiement, ${f.surety} se porte caution solidaire du Débiteur pour le montant de la dette. La caution signe le présent acte pour accepter.`]);
      list.push(
        ['Frais de recouvrement', 'En cas de poursuite, les frais raisonnables de recouvrement sont à la charge du Débiteur, dans la limite permise par la loi.'],
        ['Communication', 'Les parties communiquent par téléphone, WhatsApp ou message, aux numéros indiqués au présent acte. Tout changement d\'adresse ou de numéro est signalé sans délai.'],
        ['Données personnelles', 'Les informations du Débiteur ne servent qu\'à la gestion de la dette et au recouvrement ; elles ne sont pas transmises à des tiers, sauf obligation légale ou poursuite.'],
        ['Litiges', law],
        ['Mention manuscrite', `Le Débiteur écrit de sa main « Lu et approuvé, bon pour reconnaissance de dette de ${word(f.amount, cu)} » et signe.${f.surety ? ' La caution écrit la même mention, avec le montant garanti.' : ''}`]);
      return art(list);
    }
    if (c.type === 'cgu') {
      const co2 = co.phone || '', contact = f.contact || co2 || 'le point de vente';
      return art([
        ['Objet', `Les présentes conditions encadrent l'utilisation du service d'accès Internet WiFi Zone, fourni par ${co.name || 'CISPOLstore'} (« le Fournisseur ») à toute personne qui se connecte (« l'Utilisateur »)${f.point ? ' depuis le point de vente : ' + f.point : ''}. En se connectant, l'Utilisateur déclare les avoir lues et acceptées.`],
        ['Le service', 'Le Fournisseur donne un accès Internet par ticket prépayé, pour la durée ou le volume indiqués sur le ticket. Les tarifs et les vitesses sont affichés au point de vente. Le service est fourni « en l\'état » : il dépend du réseau satellitaire Starlink, de l\'électricité, de la météo et du nombre d\'utilisateurs connectés.'],
        ['Ticket', `Le ticket est personnel et valable pour ${f.devices === 'many' ? 'le nombre d\'appareils indiqué sur le ticket' : 'un seul appareil'}. Il est prépayé, non remboursable et non échangeable une fois activé. La durée commence ${f.startmode === 'sale' ? 'à la vente du ticket' : 'à la première connexion'}, sauf indication contraire sur le ticket. Un ticket perdu ou partagé n'est pas remplacé.`],
        ['Usage autorisé', 'L\'Utilisateur utilise le service pour un usage normal : navigation, messagerie, réseaux sociaux, courrier, appels en ligne.'],
        ['Usages interdits', `Il est interdit : de consulter, diffuser ou stocker des contenus illégaux (pédopornographie, incitation à la haine ou à la violence) ; de commettre des fraudes, du piratage ou des attaques informatiques ; d'envoyer des messages en masse non sollicités ; de porter atteinte à la vie privée ou à l'honneur d'autrui ; de revendre ou partager le ticket ; de saturer le réseau (téléchargements massifs, sauf offre le permettant) ; de contourner les limites techniques du service${f.extra ? ' ; ' + f.extra.replace(/[.;\s]+$/, '') : ''}.`],
        ['Responsabilité de l\'Utilisateur', 'L\'Utilisateur répond de ce qu\'il fait avec sa connexion. Il protège ses mots de passe et ses appareils. Le Fournisseur n\'est pas responsable de ce que l\'Utilisateur consulte, publie ou télécharge.'],
        ['Sécurité', 'Le réseau Wi-Fi public n\'est pas un réseau sécurisé. L\'Utilisateur évite d\'y saisir des informations sensibles (comptes bancaires, mots de passe) sans protection. Le Fournisseur ne garantit pas la confidentialité de ce qui circule sur le réseau.'],
        ['Données personnelles', `Le Fournisseur peut enregistrer des informations techniques de connexion (identifiant du ticket, adresse de l'appareil, date et durée) pour le fonctionnement du service, la sécurité et ses obligations légales. Ces données ne sont ni vendues ni utilisées pour de la publicité. Elles sont conservées ${f.keep > 0 ? f.keep + ' mois' : 'le temps strictement nécessaire'} puis supprimées, sauf demande d'une autorité compétente.`],
        ['Suspension et coupure', 'Le Fournisseur peut limiter, suspendre ou couper l\'accès sans remboursement en cas de violation des présentes conditions, d\'abus ou d\'atteinte au réseau, et peut transmettre les informations nécessaires aux autorités compétentes lorsque la loi l\'exige.'],
        ['Limitation de responsabilité', 'Le Fournisseur ne garantit ni une disponibilité continue, ni une vitesse précise. Il n\'est pas responsable des interruptions, des pertes de données, ni des dommages indirects (perte de revenus, de temps d\'utilisation, de clientèle). Sa responsabilité, si elle était retenue, est limitée au prix du ticket concerné.'],
        ['Service client', `Les réclamations se font auprès du point de vente ou au ${contact}, sous ${f.claim || 24} heures après le problème.`],
        ['Modification', 'Le Fournisseur peut modifier les présentes conditions ; la version affichée au moment de la connexion s\'applique.'],
        ['Droit applicable', law.replace('Les parties s\'efforcent de régler à l\'amiable tout différend lié au présent contrat.', 'Les différends sont d\'abord réglés à l\'amiable.').replace('il relève', 'ils relèvent')]]);
    }
    if (c.type === 'confidentialite') {
      const pen = f.penalty > 0 ? ` Une pénalité de ${money(f.penalty, cu)} (${word(f.penalty, cu)}) par manquement constaté est due, sans préjudice de dommages-intérêts supplémentaires si le préjudice est plus élevé.` : '';
      return art([
        ['Objet', `Le présent accord protège les informations confidentielles que ${a} (CISPOLstore) communique au Destinataire pour le motif suivant : ${f.motif || 'à préciser'}.`],
        ['Informations confidentielles', 'Sont confidentielles toutes les informations non publiques communiquées à l\'oral, par écrit, par message ou par accès à un système : listes et coordonnées de clients, prix et marges, fournisseurs et conditions d\'achat, comptes et codes d\'accès, méthodes techniques, configurations réseau, chiffres de vente, projets et contrats. Les informations qui ont un caractère confidentiel évident le sont même sans mention écrite.'],
        ['Exceptions', 'Ne sont pas confidentielles les informations qui sont déjà publiques sans faute du Destinataire, qu\'il connaissait légitimement avant, qu\'un tiers autorisé lui a remises, ou qu\'il a développées seul sans utiliser les informations reçues. Le Destinataire doit pouvoir le prouver.'],
        ['Obligations du Destinataire', 'Le Destinataire utilise les informations pour le seul motif indiqué à l\'article 1. Il les garde secrètes avec le même soin que ses propres secrets, et au moins avec un soin raisonnable. Il ne les copie pas, ne les photographie pas, ne les transfère pas vers un compte ou un téléphone personnel, sauf nécessité du motif.'],
        ['Personnes autorisées', 'Le Destinataire ne partage les informations qu\'avec les personnes qui doivent les connaître pour le motif, et qui sont tenues par une obligation de confidentialité au moins équivalente. Il répond de leurs manquements.'],
        ['Données personnelles', 'Les données personnelles (noms, téléphones, adresses, comptes des clients) ne sont traitées que pour le motif de l\'article 1, conformément à la loi congolaise sur la protection des données. Le Destinataire les protège, ne les vend pas et ne contacte pas les personnes concernées pour son propre compte.'],
        ['Propriété', 'Les informations restent la propriété du Divulgateur. Le présent accord ne donne aucun droit d\'usage, de licence ou de propriété sur elles, ni sur les marques WiFi Zone et CISPOLstore.'],
        ['Obligation légale de divulguer', 'Si une autorité compétente l\'oblige à divulguer des informations, le Destinataire prévient le Divulgateur sans délai (sauf interdiction légale) et ne divulgue que le minimum exigé.'],
        ['Restitution et destruction', `Sur simple demande, ou à la fin de l'accord, le Destinataire rend ou détruit toutes les informations et leurs copies (papier, messages, fichiers) sous ${f.restit || 7} jours et le confirme par écrit.`],
        ['Incident', 'Le Destinataire informe le Divulgateur sans délai de toute perte, vol, fuite ou usage non autorisé, et coopère pour en limiter les effets.'],
        ['Durée', `L'accord prend effet le ${App.fdate(c.start)}, ${termText(c)}. L'obligation de confidentialité continue ${f.after > 0 ? f.after + ' an' + (f.after > 1 ? 's' : '') : 'sans délai supplémentaire'} après la fin de l'accord, et sans limite de durée pour les données personnelles et les secrets commerciaux.`],
        ['Sanctions', `Tout manquement peut engager la responsabilité du Destinataire.${pen} Le Divulgateur peut aussi demander au juge de faire cesser l'usage ou la divulgation.`],
        ['Litiges', law]]);
    }
    if (c.type === 'hebergement') {
      const bv = f.benval || 0, paid = f.benefit === 'pct' || f.benefit === 'fixed';
      const adv = f.benefit === 'pct' ? `L'Hôte reçoit ${bv} % du prix des tickets vendus par la borne, versés chaque mois sur relevé des ventes remis par ${a}.` : f.benefit === 'fixed' ? `L'Hôte reçoit ${money(bv, cu)} (${word(bv, cu)}) par mois, versés à la fin de chaque mois.` : f.benefit === 'none' ? 'L\'Hôte ne reçoit aucun avantage particulier au titre du présent contrat.' : 'L\'Hôte bénéficie d\'un accès gratuit au Wi-Fi pour lui-même et son personnel, sans autre rémunération.';
      return art([
        ['Objet', `${A} installe chez l'Hôte, qui l'accepte, l'équipement suivant : ${f.equip || 'à préciser'}${f.site ? ', à l\'adresse : ' + f.site : ''}. L'emplacement exact est choisi d'un commun accord.`],
        ['Propriété du matériel', `Le matériel reste en tout temps la propriété de ${A}. Il ne peut être ni vendu, ni prêté, ni gagé, ni saisi au titre des dettes de l'Hôte. Chaque pièce est notée sur un inventaire signé (désignation, numéro de série, état).`],
        ['Installation', `${A} installe et configure le matériel à ses frais. L'Hôte donne l'accès aux lieux et l'autorisation nécessaire.${f.landlord === 'yes' ? ' L\'Hôte étant locataire, il obtient l\'accord écrit de son bailleur avant l\'installation et le remet à ' + a + '.' : ''} Une fois l'installation terminée, les deux parties signent un constat de mise en service.`],
        ['Électricité et emplacement', `L'Hôte fournit l'électricité nécessaire et un emplacement sûr, aéré et à l'abri de l'humidité. ${f.power > 0 ? `Une indemnité mensuelle de ${money(f.power, cu)} (${word(f.power, cu)}) lui est versée pour l'électricité et l'emplacement.` : 'Il ne perçoit aucune indemnité à ce titre.'}`],
        ['Garde et sécurité du matériel', 'L\'Hôte garde le matériel avec la diligence d\'un bon père de famille. Il ne le déplace pas, ne l\'ouvre pas, ne le débranche pas et ne le modifie pas, et ne laisse personne y toucher sans l\'accord du Propriétaire. En cas de perte, de vol ou de dommage dû à sa faute, il rembourse la valeur du matériel indiquée dans l\'inventaire.'],
        ['Exploitation du service', `${A} gère seul le service : tickets, tarifs, vitesses, ventes et encaissements. L'Hôte ne vend et n'encaisse rien pour le compte du Propriétaire, sauf s'il signe aussi un contrat de revendeur.`],
        ['Avantage de l\'Hôte', `${adv}${paid ? ' Aucun avantage n\'est dû pour la période où la borne est hors service plus de 7 jours de suite par la faute de l\'Hôte.' : ''}`],
        ['Maintenance', `${A} assure le suivi, les mises à jour et le dépannage dans un délai de ${f.fix || 48} heures ouvrables après le signalement. L'Hôte signale toute panne par message. Les réparations sont à la charge du Propriétaire, sauf dommage dû à l'Hôte ou à ses clients.`],
        ['Accès', `${A} (ses techniciens) peut entrer dans les lieux aux heures d'ouverture pour contrôler, réparer ou reprendre le matériel, avec un avertissement préalable raisonnable.`],
        ['Usage licite', `L'Hôte laisse ${a} appliquer les règles du service et n'utilise pas la borne pour un usage illicite. ${A} peut couper l'accès en cas d'abus constaté.`],
        ['Données et confidentialité', `L'Hôte n'a aucun accès aux données de connexion des utilisateurs, ne les copie pas et ne les utilise pas. Il garde confidentielles les informations techniques et commerciales du Propriétaire.`],
        ['Responsabilité', `${A} n'est pas responsable des dommages indirects ni des pertes d'exploitation de l'Hôte liés à une panne ou à une interruption. L'Hôte répond de la sécurité de ses locaux et de ses clients.`],
        ['Durée', `Le contrat prend effet le ${App.fdate(c.start)}, ${termText(c)}.`],
        ['Fin du contrat et reprise du matériel', `Chaque partie peut y mettre fin avec un préavis écrit de ${f.notice || 15} jours (un message suffit). ${A} peut y mettre fin sans délai en cas de manquement grave. À la fin, l'Hôte rend le matériel en bon état dans les ${f.restit || 48} heures, contre un reçu de restitution.`],
        ['Litiges', law]]);
    }
    if (c.type === 'revendeur') {
      const per = { week: 'chaque semaine, le lundi', order: 'à chaque nouvelle remise de tickets', day: 'chaque jour' }[f.pay] || 'chaque semaine, le lundi';
      const list = [
        ['Objet', `${A} confie au Revendeur, à titre non exclusif, la vente de tickets d'accès Internet WiFi Zone (codes prépayés)${f.zone ? ', dans la zone suivante : ' + f.zone : ''}.`],
        ['Statut du Revendeur', `Le Revendeur agit en son nom propre et à ses risques. Il n'est ni employé, ni associé, ni mandataire de ${A}. Il ne peut pas engager ${A} envers des tiers.`],
        ['Tickets confiés', `${A} remet les tickets au Revendeur. Chaque remise est consignée sur un bordereau (date, quantité, type de ticket, valeur) signé par les deux parties. Les tickets restent la propriété de ${A} tant qu'ils ne sont pas vendus et payés.`],
        ['Prix de vente et remise', `Le Revendeur vend chaque ticket au prix public fixé par ${A}. Il garde une remise de ${f.amount} % du prix public sur chaque ticket vendu. Il ne peut ni vendre au-dessus du prix public, ni accorder de rabais sans accord écrit de ${A}.`],
        ['Remise des fonds', `Le Revendeur reverse à ${A} le produit des ventes, déduction faite de sa remise, ${per}, dans la Caisse ou par Mobile Money. Un reçu est établi à chaque versement.`],
        ['Responsabilité du stock', `Le Revendeur répond des tickets qui lui sont confiés, depuis la remise jusqu'à la vente. Les tickets perdus, volés ou vendus sans versement sont dus à ${A} au prix public, sauf cas de force majeure prouvé.`],
        ['Plafond de stock', `Le stock confié au Revendeur ne dépasse pas ${money(f.cap, cu)} (${word(f.cap, cu)}) de valeur à la fois. Une nouvelle remise n'est faite que si les versements précédents sont à jour.`]];
      if (f.deposit > 0) list.push(['Caution', `Le Revendeur verse une caution de ${money(f.deposit, cu)} (${word(f.deposit, cu)}) à la signature. Elle garantit les sommes dues à ${A}. Elle est rendue à la fin du contrat, après le décompte final et déduction faite des sommes restant dues.`]);
      list.push(
        ['Compte rendu et inventaire', `Le Revendeur donne chaque semaine l'état de ses ventes et de son stock. ${A} peut faire un inventaire à tout moment, avec un préavis raisonnable. Tout écart est réglé au plus tard à l'inventaire suivant.`],
        ['Tickets défectueux', `Un ticket qui ne fonctionne pas est remplacé s'il est signalé sous ${f.defect || 48} heures. Le Revendeur le rend à ${A}, qui le contrôle avant remplacement. Un ticket déjà utilisé n'est pas remplacé.`],
        ['Comportement et marque', 'Le Revendeur présente l\'offre de façon exacte, sans promesse mensongère sur la vitesse ou la couverture. Il n\'utilise le nom et le logo WiFi Zone que pour signaler son point de vente.'],
        ['Données des clients', `Le Revendeur ne conserve aucune donnée personnelle des acheteurs et ne les utilise à aucune autre fin. Il garde le secret sur les informations commerciales de ${A}.`],
        ['Durée', `Le contrat prend effet le ${App.fdate(c.start)}, ${termText(c)}.`],
        ['Fin du contrat', `Chaque partie peut y mettre fin avec un préavis écrit de ${f.notice || 7} jours (un message suffit). ${A} peut y mettre fin sans délai en cas de vente au-dessus du prix, de fonds non versés ou de manquement grave.`],
        ['Solde de tout compte', `À la fin du contrat, le Revendeur rend les tickets invendus et verse les sommes dues sous ${f.settle || 48} heures. ${A} lui remet un décompte final signé.`],
        ['Litiges', law]);
      return art(list);
    }
    if (c.type === 'apporteur') {
      const ag = f.role === 'agent', pct = f.kind !== 'fixed';
      const base = f.renew > 0 ? `au titre du premier paiement du client et de ses renouvellements pendant ${f.renew} mois` : 'au titre du premier paiement du client';
      return art([
        ['Objet', `Le Donneur d'ordre charge l'Agent, qui l'accepte, ${ag ? 'de présenter, négocier et faire souscrire ses produits et services au nom et pour le compte du Donneur d\'ordre' : 'de présenter et recommander ses produits et services, et de lui transmettre les coordonnées de clients intéressés'}${f.zone ? `, dans la zone suivante : ${f.zone}` : ''}.`],
        ['Indépendance', 'L\'Agent exerce son activité de façon indépendante. Il organise librement son temps et ses moyens. Le présent contrat ne crée aucun lien de subordination et n\'est pas un contrat de travail. L\'Agent peut exercer d\'autres activités.'],
        ['Produits et services', `Les produits et services concernés sont : ${f.products || 'ceux communiqués par le Donneur d\'ordre'}. Le présent contrat est non exclusif : le Donneur d'ordre peut vendre directement et travailler avec d'autres agents dans la même zone.`],
        ['Prix et engagements', 'L\'Agent applique uniquement les tarifs et conditions communiqués par le Donneur d\'ordre. Il ne consent aucune remise, ne fait aucune promesse et n\'engage le Donneur d\'ordre sur rien sans son accord écrit (message compris). Toute vente ou souscription est acceptée par le Donneur d\'ordre.'],
        ['Commission', `${pct ? `L'Agent perçoit une commission de ${f.amount} %, calculée sur les montants réellement encaissés par le Donneur d'ordre, ${base}.` : `L'Agent perçoit une commission fixe de ${money(f.amount, cu)} (${word(f.amount, cu)}) par vente encaissée, ${base}.`} Aucune commission n'est due sur une vente non payée ou annulée.`],
        ['Droit à la commission', 'La commission est due lorsque : le client a été signalé au Donneur d\'ordre par message avant la vente, la vente est conclue et le paiement est encaissé. Le Donneur d\'ordre tient un registre des clients apportés par l\'Agent et l\'informe de ceux qui sont déjà clients.'],
        ['Paiement des commissions', `Le Donneur d'ordre paie la commission dans un délai de ${f.payDays || 7} jours après l'encaissement du paiement du client, et envoie à l'Agent le détail correspondant (client, montant encaissé, commission).`],
        ['Interdiction d\'encaisser', 'L\'Agent ne reçoit aucun paiement d\'un client au nom du Donneur d\'ordre, sauf mandat écrit. Si un client lui remet de l\'argent, il le transmet immédiatement au Donneur d\'ordre et l\'en informe.'],
        ['Obligations de l\'agent', 'L\'Agent donne des informations exactes, ne fait aucune fausse promesse, respecte la loi, protège l\'image du Donneur d\'ordre et ne dénigre ni lui ni ses produits.'],
        ['Obligations du donneur d\'ordre', 'Le Donneur d\'ordre remet à l\'Agent les tarifs, la documentation et les informations utiles, l\'informe sans délai de l\'acceptation ou du refus d\'une vente, et lui verse ses commissions à l\'échéance.'],
        ['Confidentialité et données des clients', 'L\'Agent garde confidentielles les informations du Donneur d\'ordre (prix, clients, conditions) et celles des clients. Il les utilise uniquement pour l\'exécution du contrat et ne les conserve pas après sa fin.'],
        ['Fin de la relation', `Le contrat prend effet le ${App.fdate(c.start)}, ${termText(c)}. Chaque partie peut y mettre fin par écrit (message compris) avec un préavis de ${f.notice || 30} jours. Les commissions sur les ventes conclues avant la fin restent dues. Une faute grave permet la résiliation immédiate.`],
        ['Obligations sociales et fiscales', 'L\'Agent déclare et paie lui-même ses impôts et ses charges. Le Donneur d\'ordre ne lui verse aucun salaire ni avantage de travailleur.'],
        ['Données personnelles', 'Les informations de l\'Agent servent uniquement à la gestion du contrat et ne sont pas transmises à des tiers, sauf obligation légale.'],
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
        ['Engagement', `L'Employeur engage l'Employé(e) en qualité de « ${f.job || '—'} »${f.place ? `, lieu de travail : ${f.place}` : ''}. L'Employé(e) exerce ses fonctions sous l'autorité de l'Employeur et selon ses instructions.`],
        ['Nature et durée', cdd ? `Le contrat est conclu à durée déterminée, ${termText(c)}, pour le motif suivant : ${f.motif || '—'}. Il prend effet le ${App.fdate(c.start)}.` : `Le contrat est conclu à durée indéterminée et prend effet le ${App.fdate(c.start)}.`],
        ['Période d\'essai', f.trial > 0 ? `Le contrat comporte une période d'essai de ${f.trial} jours, constatée par le présent écrit. Pendant l'essai, chaque partie peut y mettre fin avec le préavis prévu par la loi, sans indemnité.` : 'Le contrat ne comporte pas de période d\'essai.'],
        ['Rémunération', `L'Employé(e) perçoit un salaire mensuel de ${money(f.amount, cu)} (${word(f.amount, cu)}), payable au plus tard le ${f.payday || 30} de chaque mois. Les retenues légales sont opérées conformément à la loi.`],
        ['Commission ou prime', f.commission ? `L'Employé(e) perçoit en plus : ${f.commission}. La commission est calculée sur les ventes réellement encaissées et payée avec le salaire du mois suivant.` : 'Le contrat ne prévoit ni commission ni prime, sauf accord écrit ultérieur.'],
        ['Horaires', `${f.hours || 'Selon l\'organisation de l\'entreprise'}, dans le respect de la durée légale du travail. Les heures supplémentaires sont effectuées sur demande de l'Employeur et rémunérées conformément à la loi.`],
        ['Caisse et encaissements', 'L\'Employé(e) enregistre chaque vente dans l\'application et remet les encaissements à l\'Employeur à la clôture de chaque journée. Il n\'utilise jamais l\'argent de la caisse pour ses besoins personnels. Tout écart de caisse est signalé le jour même. Aucune somme n\'est retenue sur le salaire sans respecter les règles légales.'],
        ['Stock, tickets et matériel confiés', 'Les tickets Wi-Fi, produits et matériel confiés à l\'Employé(e) sont inventoriés à sa prise de fonction et à son départ. L\'Employé(e) en répond en cas de perte ou de dommage dû à sa faute, et restitue le tout à la fin du contrat.'],
        ['Confidentialité', 'L\'Employé(e) garde confidentielles les informations de l\'entreprise : clients, prix, comptes, codes d\'accès, documents. Cette obligation continue après la fin du contrat.'],
        ['Usage de l\'application', 'L\'Employé(e) utilise l\'application avec son code PIN personnel et ne le communique à personne. Ses actions sont enregistrées dans le journal d\'activité de l\'entreprise.'],
        ['Obligations de l\'employeur', 'L\'Employeur verse le salaire à l\'échéance, assure des conditions de travail correctes et respecte les déclarations et obligations prévues par la loi.'],
        ['Congés et absences', 'Les congés sont accordés conformément à la loi. Toute absence est signalée à l\'Employeur dans les 48 heures avec son motif.'],
        ['Fin du contrat', 'Chaque partie peut y mettre fin dans le respect du préavis prévu par le Code du travail. Une faute grave permet la rupture sans préavis, dans les conditions légales. À la fin du contrat, l\'Employé(e) restitue la caisse, le stock, le matériel et ses accès.'],
        ['Données personnelles et litiges', `L'Employeur traite les données de l'Employé(e) uniquement pour la gestion du contrat. Les litiges relèvent du tribunal du travail compétent de ${city}, après tentative de règlement amiable.`]]);
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
      if (type === 'dette' && ex.first === undefined) ex.first = App.addDays(t0, 30);
      if (type === 'travail' && ex.place === undefined) ex.place = S.company.city || ''; if (type === 'abonnement' && ex.grace === undefined) ex.grace = S.grace || 15;
      $('ct_f').innerHTML = fieldHtml(t, null, ex); if (t.noTerm) $('ct_termrow').style.display = 'none'; else $('ct_termrow').style.display = ''; $('ct_clrow').style.display = t.who === 'person' || t.who === 'none' ? 'none' : ''; $('ct_party').style.display = t.who === 'none' ? 'none' : ''; if ($('ct_srcrow')) $('ct_srcrow').style.display = twoTexts(type) ? '' : 'none'; $('ct_months').value = type === c.type ? c.months : t.term; };
    App.modal(isNew ? 'Nouveau contrat' : 'Modifier ' + c.no,
      `${isNew ? F.sel('ct_type', 'Type de contrat', [...Object.entries(TYPES).map(([k, t]) => [k, t.icon + ' ' + t.label]), ...models().map(m => ['m:' + m.id, (m.icon || '📄') + ' ' + m.name + ' (mon modèle)'])], c.type) : `<p class="mut" style="margin-top:0">${T(c).icon} ${esc(T(c).label)}</p>`}
       ${isNew ? `<div id="ct_srcrow">${F.sel('ct_src', 'Texte du contrat', [['auto', 'Texte proposé (déjà rédigé, modifiable)'], ['perso', 'Mon propre texte (je le rédige moi-même)']], 'auto')}</div>` : ''}
       <div id="ct_clrow">${App.clientFinder('ct_cl')}${F.sel('ct_cl', 'Client', App.clientOpts('— Autre (saisir ci-dessous) —'), c.clientId)}</div>
       <div id="ct_party" ${cl0 ? 'hidden' : ''}>${F.text('ct_pname', 'Nom complet', (c.party || {}).name || '')}${F.text('ct_pidno', 'N° pièce d\'identité (facultatif)', (c.party || {}).idno || '')}<div class="row">${F.text('ct_pphone', 'Téléphone', (c.party || {}).phone || '')}${F.text('ct_paddr', 'Adresse', (c.party || {}).address || '')}</div></div>
       <div class="row">${F.date('ct_date', 'Date de signature', c.date)}${F.date('ct_start', 'Début', c.start)}</div>
       <div id="ct_termrow" class="row">${F.num('ct_months', 'Durée (mois, 0 = indéterminée)', c.months, 'min="0"')}${F.sel('ct_cur', 'Devise', CUR, c.currency)}</div>
       ${F.text('ct_rep', 'Représenté(e) par (côté société, facultatif)', c.rep || '')}
       <div id="ct_f"></div>
       ${isNew ? '' : `<label class="chk" style="display:block;margin-top:8px"><input type="checkbox" id="ct_regen"> Régénérer le texte du contrat depuis le modèle (efface vos modifications du texte)</label>`}`,
      () => { const type = isNew ? App.v('ct_type') : c.type, t = tdef(type), f = {};
        t.fields.forEach(([k, l, kind]) => { const raw = $('cf_' + k).value; f[k] = kind === 'num' ? (raw === '' ? '' : Math.max(0, +raw || 0)) : String(raw).trim(); });
        const cl = t.who === 'person' || t.who === 'none' ? '' : App.v('ct_cl'), p = { name: App.v('ct_pname').trim(), idno: App.v('ct_pidno').trim(), phone: App.v('ct_pphone').trim(), address: App.v('ct_paddr').trim() };
        if (!cl && !p.name && t.who !== 'none') { App.toast(t.who === 'person' ? (type === 'travail' ? 'Saisissez le nom de l\'employé(e)' : type === 'apporteur' ? 'Saisissez le nom de l\'apporteur' : type === 'revendeur' ? 'Saisissez le nom du revendeur' : type === 'hebergement' ? 'Saisissez le nom de l\'hôte' : type === 'confidentialite' ? 'Saisissez le nom du destinataire' : 'Saisissez le nom du prestataire') : 'Choisissez un client ou saisissez un nom'); return false; }
        if (type === 'libre' && !f.body) { App.toast('Écrivez le texte du contrat'); return false; }
        if ((type === 'materiel' || type === 'travail' || type === 'abonnement' || type === 'fournisseur' || type === 'mandat' || type === 'prestataire' || type === 'apporteur' || type === 'revendeur' || type === 'dette') && !(f.amount > 0)) { App.toast(type === 'dette' ? 'Saisissez le montant de la dette' : type === 'travail' ? 'Saisissez le salaire' : type === 'apporteur' ? 'Saisissez la commission' : type === 'revendeur' ? 'Saisissez la remise du revendeur' : 'Saisissez le montant'); return false; }
        if (type === 'dette' && (f.deposit >= f.amount || !(f.count >= 1))) { App.toast(f.deposit >= f.amount ? 'Le versement à la signature doit être inférieur à la dette' : 'Indiquez au moins 1 versement'); return false; }
        if (type === 'installation' && (f.kind === 'maint' ? !(f.maint > 0) : !(f.amount > 0))) { App.toast(f.kind === 'maint' ? 'Saisissez la redevance de maintenance' : 'Saisissez le prix de l\'installation'); return false; }
        if (type === 'travail' && Math.round(App.n('ct_months')) > 0 && !f.motif) { App.toast('Un CDD exige un motif : saisissez-le, ou mettez la durée à 0 (CDI)'); return false; }
        const date = App.v('ct_date') || t0, start = App.v('ct_start') || date, months = t.noTerm ? 0 : Math.max(0, Math.round(App.n('ct_months')));
        const o = { type, clientId: cl, party: cl ? {} : p, date, start, months, end: endOf(start, months), currency: App.v('ct_cur') || 'USD', rep: App.v('ct_rep').trim(), f };
        if (isNew) { Object.assign(c, o, { id: App.uid(), ts: Date.now(), no: nextNo(date), status: 'draft' }); if (/^m:/.test(type)) { const m = models().find(x => 'm:' + x.id === type); c.mt = { name: m.name, icon: m.icon, title: m.title, a: m.a, b: m.b, body: m.body }; } c.body = bodyFor(c); if (twoTexts(type)) { const own = $('ct_src') && $('ct_src').value === 'perso'; c.src = own ? 'perso' : 'auto'; if (own) { c.alt = c.body; c.body = SKEL; } else c.alt = SKEL; } list().push(c); if (cl) App.log(cl, `Contrat ${c.no} : ${t.label}`); }
        else { Object.assign(c, o); if ($('ct_regen') && $('ct_regen').checked) { if (twoTexts(type) && c.src === 'perso') c.alt = bodyFor(c); else c.body = bodyFor(c); } else if (type === 'libre') c.body = f.body; }
        App.save(); App.toast(isNew ? 'Contrat créé : ' + c.no : 'Contrat modifié'); App.refresh(); if (isNew) setTimeout(() => App.actions[c.src === 'perso' ? 'ct_text' : 'ct_open']({ id: c.id }), 80); },
      isNew ? 'Créer le contrat' : 'Enregistrer');
    // debt: pick one of the client's unpaid invoices to fill the amount and the origin
    let debtFill = null;
    const wireDebt = ex => { const sel = $('cf_invid'); if (!sel) return;
      debtFill = () => { const cid = App.v('ct_cl'), keep = sel.value || ex.invid || '', rows = App.db.invoices.filter(i => App.invDue(i) > 0.004 && (!cid || i.clientId === cid)); sel.innerHTML = App.opts([['', '— Aucune —'], ...rows.map(i => [i.id, `${i.number} · ${App.cname(App.client(i.clientId))} · reste ${App.fmt(App.invDue(i), i.currency)}`])], keep); if (keep && [...sel.options].some(o => o.value === keep)) sel.value = keep; };
      debtFill();
      sel.onchange = () => { const i = App.invoice(sel.value); if (!i) return; if (i.clientId && $('ct_cl').value !== i.clientId) { $('ct_cl').value = i.clientId; $('ct_cl').dispatchEvent(new Event('change')); debtFill(); sel.value = i.id; }
        $('cf_amount').value = Math.round(App.invDue(i) * 100) / 100; $('cf_origin').value = `Facture ${i.number} du ${App.fdate(i.date)}`; if ($('ct_cur')) $('ct_cur').value = i.currency === 'CDF' ? 'CDF' : 'USD'; }; };
    const renderAll = type => { debtFill = null; render(type); if (type === 'dette') wireDebt(type === c.type ? c.f || {} : {}); };
    renderAll(c.type);
    if ($('ct_type')) $('ct_type').onchange = () => renderAll($('ct_type').value);
    $('ct_cl').addEventListener('change', () => { if (debtFill) debtFill(); });
    App.wireClientFinder('ct_cl', s => App.clientOpts('— Autre (saisir ci-dessous) —', null, s));
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
      ${t.who === 'none' ? `<p class="ctp" style="margin-top:12px"><b>Fournisseur :</b> ${e(co.name)}${co.address ? ', ' + e(co.address) : ''}${co.phone ? ' · Tél. ' + e(co.phone) : ''}</p>` : `<p class="ctp" style="margin-top:12px"><b>Entre les soussignés :</b></p>${parties}<p class="ctp"><b>Il a été convenu ce qui suit :</b></p>`}
      ${blocks}
      ${t.who === 'none' ? `<p class="ctp" style="margin-top:14px"><i>Version en vigueur à partir du ${App.fdate(c.start)}. En se connectant, l'Utilisateur accepte ces conditions.</i></p>${K.foot(stamp, true)}</div>` : `<p class="ctp" style="margin-top:14px">Fait à ${e(co.city || 'Kinshasa')}, le ${App.fdate(c.date)}, en deux exemplaires originaux.</p>
      <table class="sg ctsg"><tr><td class="ln">${e(t.b[0])}<br><small>Lu et approuvé, bon pour accord</small></td><td class="gp"></td><td class="s2"><img src="${e(stamp || 'stamp.png')}" alt=""></td></tr><tr><td></td><td class="gp"></td><td class="ln">${e(t.a[0])}<br><small>${e(co.name)}${c.rep ? ' · ' + e(c.rep) : ''}</small></td></tr></table>${K.foot(stamp, true)}</div>`}`; };
  App.actions.ct_print = async x => { const c = list().find(y => y.id === x.id); if (c) App.docKit.print('Contrat ' + c.no, App.contractDoc(c, await App.docKit.logoData(), await App.docKit.stampData())); };
  App.actions.ct_pdf = async x => { const c = list().find(y => y.id === x.id); if (c) App.sharePdf(`Contrat-${c.no}.pdf`, App.contractDoc(c, await App.docKit.logoData(), await App.docKit.stampData())); };
  App.actions.ct_wa = x => { const c = list().find(y => y.id === x.id); if (!c) return; const p = partyOf(c), co = App.db.settings.company, t = T(c);
    if (t.who === 'none') return window.open('https://wa.me/?text=' + encodeURIComponent(`Conditions d'utilisation du Wi-Fi ${c.no} en vigueur depuis le ${App.fdate(c.start)}.\n${co.name}`), '_blank', 'noopener');
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
       ${twoTexts(c.type) ? `<div class="spread" style="margin:0 0 8px"><span class="mut">Texte en vigueur : <b>${c.src === 'perso' ? 'mon propre texte' : 'texte proposé'}</b></span><button type="button" class="btn sm sec" data-act="ct_swap" data-id="${c.id}">⇄ ${c.src === 'perso' ? 'Utiliser le texte proposé' : 'Utiliser mon propre texte'}</button></div>` : ''}<div class="bar"><button type="button" class="btn sec" data-act="ct_text" data-id="${c.id}">📝 Articles : lire, ajouter, modifier</button></div>
       ${c.status === 'draft' ? `<div class="bar"><button type="button" class="btn" data-act="ct_set" data-id="${c.id}" data-s="active">✅ Signé : mettre en cours</button></div>` : ''}
       ${c.status === 'active' ? `<div class="bar"><button type="button" class="btn sec" data-act="ct_set" data-id="${c.id}" data-s="ended">🏁 Terminé</button><button type="button" class="btn sec" data-act="ct_set" data-id="${c.id}" data-s="cancelled">⛔ Résilié</button>${c.end ? `<button type="button" class="btn" data-act="ct_renew" data-id="${c.id}">🔁 Renouveler</button>` : ''}</div>` : ''}
       ${c.status !== 'draft' && c.status !== 'active' ? `<div class="bar"><button type="button" class="btn sec" data-act="ct_set" data-id="${c.id}" data-s="active">↺ Remettre en cours</button></div>` : ''}
       <div class="bar"><button type="button" class="btn sm sec" data-act="ct_edit" data-id="${c.id}">✏️ Modifier</button><button type="button" class="btn sm sec" data-act="ct_dup" data-id="${c.id}">⎘ Dupliquer</button><button type="button" class="btn sm sec" data-act="ct_tomodel" data-id="${c.id}">📚 Enregistrer comme modèle</button>${c.clientId ? `<button type="button" class="btn sm sec" data-act="go" data-v="client" data-id="${c.clientId}">👤 Client</button>` : ''}<button type="button" class="btn sm sec" data-act="ct_del" data-id="${c.id}">🗑 Supprimer</button></div>`);
  };
  App.actions.ct_set = x => { const c = list().find(y => y.id === x.id); if (!c) return; c.status = x.s; if (c.clientId) App.log(c.clientId, `Contrat ${c.no} : ${STAT[x.s][0].toLowerCase()}`); App.save(); App.close(); App.refresh(); App.toast(STAT[x.s][0]); };
  // every built-in contract keeps two texts: the proposed one and your own; this swaps which one is in force
  App.actions.ct_swap = x => { const c = list().find(y => y.id === x.id); if (!c || !twoTexts(c.type)) return;
    const cur = c.body; c.body = c.alt || SKEL; c.alt = cur; c.src = c.src === 'perso' ? 'auto' : 'perso'; App.save(); App.close(); App.refresh();
    App.toast(c.src === 'perso' ? 'Mon propre texte en vigueur' : 'Texte proposé en vigueur');
    setTimeout(() => App.actions[c.src === 'perso' && c.body === SKEL ? 'ct_text' : 'ct_open']({ id: c.id }), 80); };
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
  App.actions.ct_renew = x => { const c = list().find(y => y.id === x.id); if (!c || !c.end) return; const start = App.addDays(c.end, 1), n = copyOf(c, { date: App.today(), start, end: endOf(start, c.months) }); if (!twoTexts(c.type)) n.body = c.body; else if (c.src === 'perso') { n.body = c.body; n.alt = gen(n); } else { n.body = gen(n); n.alt = c.alt || SKEL; }
    c.status = 'ended'; list().push(n); if (c.clientId) App.log(c.clientId, `Contrat ${c.no} renouvelé : ${n.no}`); App.save(); App.close(); App.refresh(); App.toast('Contrat renouvelé : ' + n.no); setTimeout(() => App.actions.ct_open({ id: n.id }), 80); };
  App.actions.ct_del = x => { const c = list().find(y => y.id === x.id); if (!c) return; if (!App.confirm(`Supprimer le contrat ${c.no} ?`)) return; App.db.contracts = list().filter(y => y !== c); App.save(); App.close(); App.refresh(); };
})();
