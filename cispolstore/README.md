# CISPOLstore Manager

Application de gestion d'entreprise pour CISPOLstore : clients, comptes Starlink (ACC), abonnements, paiements, factures, stock, fournisseurs, installations, dépenses, bénéfices et rapports. Sans serveur ni dépendance : HTML + CSS + JavaScript, installable sur Android (PWA), utilisable hors connexion.

## Lancer

- En ligne : publication automatique sur GitHub Pages (`.github/workflows/pages.yml`, source *GitHub Actions*), puis Chrome Android → ⋮ → **Installer l'application**.
- En local : `python3 -m http.server 8000` dans ce dossier, puis http://localhost:8000.
- Pas de suite de tests : vérifier à la main (clients, factures, stock, rapports, impression).

## Mise en page

- **Téléphone** (< 1024 px) : menu du bas, bouton « + » central, tableaux en cartes.
- **Ordinateur** (≥ 1024 px) : menu latéral avec toutes les sections et un bouton « Action rapide », contenu plus large, tableau de bord sur deux colonnes, listes sur deux colonnes.

## Organisation du code

| Fichier | Rôle |
|---|---|
| `index.html`, `style.css` | Structure et thèmes clair / sombre (palette du logo) |
| `js/core.js` | Données (`App.db`), stockage, migration, règles métier (abonnements, factures, stock, montants en lettres) |
| `js/ui.js` | Navigation, modales, thème, **PIN**, recherche globale, bouton « + » |
| `js/clients.js` | Liste, création par type, fiche client, renouvellement |
| `js/stock.js` | Produits, entrées/sorties, câble en mètres, fournisseurs, installations |
| `js/invoices.js` | Factures (4 types), PDF/Word/impression, paiements, dépenses |
| `js/reports.js` | Tableau de bord, calendrier des abonnements, rapports |
| `js/settings.js` | Entreprise, taux, sécurité, sauvegarde / restauration / CSV |
| `js/sync.js` | Synchronisation entre appareils (chiffrée, fusion enregistrement par enregistrement) |
| `js/export.js` | Tableaux partagés, export Excel (.xlsx) généré sans bibliothèque |
| `js/roles.js` | Profils (administrateur, comptable, vendeur, technicien, livreur), code PIN personnel, écrans et actions autorisés |
| `js/delivery.js` | Livraisons : planification, suivi, encaissement à la livraison, vue du livreur |
| `js/techs.js` | Techniciens et collaborateurs (liste, fiche, interventions liées aux installations) |
| `js/plans.js` | Tarifs d'abonnement : prix client, coût Starlink et marge |
| `js/penalties.js` | Pénalités Starlink : enregistrement, paiement signalé, relance, effet sur les bénéfices |
| `js/unpaid.js` | Impayés : factures à encaisser, ancienneté, relance WhatsApp |
| `js/finance.js` | Onglet Finance : journal des entrées et sorties d'argent |
| `js/monthly.js` | Rapport mensuel : résumé du mois à partager, copier ou imprimer |
| `js/remind.js` | Rappels WhatsApp d'échéance (liste « Rappels » et messages modifiables) |
| `js/drive.js` | Sauvegardes datées sur Google Drive (manuelles ou automatiques) |
| `sync/supabase.sql` | Script à exécuter une fois dans le projet Supabase |
| `sw.js` | Cache hors connexion (**incrémenter `CACHE` à chaque publication** : c'est ce qui déclenche le message « Nouvelle version disponible ») |

## Règles métier

- **Type de client** choisi à la création, non modifiable : *géré*, *matériel uniquement*, *installation uniquement*.
- **Abonnement** : fin = début + durée (30 jours par défaut) ; sursis = du lendemain de la fin à fin + sursis (15 jours par défaut, réglable par client). Statut automatique : actif → en sursis → inactif.
- **Renouvellement** : nouvelle période à partir de la fin actuelle (ou d'aujourd'hui si le client est inactif), avec facture et paiement optionnels.
- **Factures** : numéro `FAC-AAAA-0001` automatique et sans doublon ; les lignes du stock font sortir le stock (câble en mètres). Montant en lettres et équivalent CDF (taux réglable). Export PDF (via l'impression du navigateur), Word (.doc) et impression.
- **Stock** : entrées / sorties journalisées, fournisseurs, alertes de stock bas, câble restant sur le tableau de bord.
- **Bénéfice** = prix de vente − prix d'achat (par ligne) − dépenses. Les montants des rapports sont convertis en dollars.
- **Nouveau client depuis une facture** : bouton « ＋ Nouveau client » dans le formulaire de facture (sans perdre la facture en cours). Pour une facture d'abonnement, seuls les clients gérés sont proposés et la ligne d'abonnement reprend l'offre et le prix du client.
- **Partage** : « Partager l'application » (menu Plus et Paramètres) ouvre le partage Android avec le lien de l'application.
- **Recherche globale** : nom, code client, ACC (même partiel), téléphone, adresse, numéro de série, facture, produit, fournisseur.

## Mises à jour

L'application installée se met à jour seule depuis le lien : au démarrage (et toutes les 30 minutes), le navigateur compare `sw.js` ; s'il a changé, la nouvelle version est téléchargée en arrière-plan et un message « Nouvelle version disponible » propose d'actualiser. Ne plus modifier `id` ni `start_url` dans `manifest.webmanifest` (ils définissent l'identité de l'application installée).

Icônes : `icon-192.png` et `icon-512.png` sont transparentes (logo et texte seulement, sans fond), sans icône « maskable ».

## Données et sécurité

- Les données restent dans la mémoire de l'appareil (`localStorage` + copie IndexedDB restaurée automatiquement ; stockage persistant demandé au navigateur). **Sauvegarde / Restaurer** reste disponible (partage Android : WhatsApp, Drive…).
- Le **PIN à 4 chiffres** verrouille l'écran de l'application (verrouillage automatique réglable, code de récupération remis à la création). Ce n'est pas un chiffrement des données.
- Les anciennes données de la version 1 (`cispolstore-v1`) et ses sauvegardes `.json` sont importées automatiquement.

## Synchronisation entre appareils (optionnelle)

Un projet Supabase gratuit, créé par vous, sert de boîte aux lettres : Paramètres → Synchronisation → Configurer (étapes affichées dans l'application). Le script `sync/supabase.sql` ne crée qu'une table fermée au public et trois fonctions (lire, vérifier la version, écrire).

- Les données sont **chiffrées sur l'appareil** (AES-GCM, clé dérivée de la phrase secrète par PBKDF2) avant l'envoi : le serveur ne voit qu'un bloc illisible. La phrase secrète n'est jamais envoyée et ne peut pas être récupérée.
- **Fusion** enregistrement par enregistrement par rapport à la dernière synchronisation : des modifications faites hors connexion sur plusieurs appareils se combinent (ajouts, suppressions, champs différents d'une même fiche, stock additionné). Même champ modifié des deux côtés : l'appareil qui synchronise en dernier l'emporte.
- Deux factures créées hors connexion avec le même numéro : la plus récente est **renumérotée** automatiquement.
- Chaque appareil garde son PIN, son thème et son verrouillage. L'icône ☁️ de l'en-tête indique l'état ; la synchronisation se fait au démarrage, après chaque modification, au retour de connexion et toutes les 90 secondes.
- Test : script SQL vérifié sur PostgreSQL 16 (rôle `anon` sans accès direct à la table) et scénario à deux appareils validé ; non essayé avec un vrai projet Supabase.

## Profils et livraisons

Paramètres → **Utilisateurs et profils → Activer** : vous devenez l'administrateur (votre PIN actuel est conservé) puis créez un profil par personne, avec son nom, son **code PIN à 4 chiffres** (unique) et son profil :

| Profil | Voit / peut faire |
| --- | --- |
| Administrateur | Tout, y compris suppression, réglages, synchronisation, sauvegardes et gestion des profils |
| Comptable | Factures, paiements, impayés, dépenses, rapports, stock, fournisseurs ; ni suppression ni réglages |
| Vendeur | Clients, abonnements, factures, paiements, livraisons ; ni coûts, ni bénéfices, ni dépenses, ni réglages |
| Technicien | **Une seule fenêtre** « Mes interventions » : ses installations (client, adresse, appel, itinéraire) et un bouton pour enregistrer une installation (son nom est fixé). Aucun menu |
| Livreur | **Une seule fenêtre** « Mes livraisons » : pour chacune le client, l'adresse, le colis, 📞 Appeler, 🗺️ Itinéraire et **✓ Livré / ✗ Non livré** (avec motif). Aucun menu, aucun prix, aucune facture |

À l'ouverture et après verrouillage, chacun entre son PIN : le profil correspondant est ouvert (le bouton 🔒 permet de changer de profil). Chacun change son PIN dans Plus → Mon profil. Un administrateur oublié se récupère avec son code de récupération ; les autres profils sont réinitialisés par l'administrateur. Les profils se synchronisent entre appareils (ils ne sont pas dans les sauvegardes). **Limite :** les profils règlent l'affichage et les actions ; les données restent présentes sur l'appareil et, avec la synchronisation, quiconque connaît la phrase secrète peut les lire. Ne donnez la phrase secrète qu'aux personnes de confiance.

**Recommandé : seuls les administrateurs connaissent la phrase secrète.** L'administrateur configure lui-même l'appareil de chaque employé : il l'installe, ouvre Paramètres → Synchronisation (réservé à l'administrateur, champ de phrase masqué) et saisit l'URL, la clé et la phrase. Les profils arrivent alors par la synchronisation et l'appareil demande le PIN de l'employé. L'appareil ne garde que la clé dérivée de la phrase, jamais la phrase elle-même, et l'employé ne voit ni la synchronisation ni les réglages. Une application installée ou réinstallée sans cette configuration reste vide : elle ne peut pas relire les données. Si un employé part, supprimez son profil et, si l'appareil a été perdu ou prêté, changez la phrase secrète (nouvel espace de synchronisation).

Livraisons (Plus → Livraisons, ou « 🚚 Livraison » depuis une facture) : client, facture liée, adresse et téléphone préremplis, livreur, statut (À livrer, En route, Livrée, Échec). Le livreur n'a que « Livré » ou « Non livré ». Si, à la création, vous répondez « Oui » à « Le livreur encaisse la facture ? », il voit « À encaisser : X » et saisit le montant à la livraison : le paiement est enregistré sur la facture. Pour le technicien, le champ « Fiche technicien liée » du profil relie la personne à sa fiche de la liste Techniciens.

## Techniciens

Plus → **Techniciens** répertorie les techniciens, installateurs, revendeurs et partenaires (nom, téléphone, rôle, zone, spécialité, actif/inactif). Dans « Nouvelle installation » et dans une facture d'installation, le champ Technicien propose la liste (la saisie libre reste possible) ; la fiche du technicien affiche ses interventions et leur valeur. Renommer un technicien met à jour ses installations. Commission : par technicien, **en pourcentage** du prix de l'installation ou **en montant fixe** par intervention. La fiche affiche la commission à payer et déjà payée ; « Payer la commission » fige les montants et enregistre une dépense (catégorie « Commission technicien »), ce qui garde les bénéfices exacts. Synchronisé entre appareils.

## Affichage et rappels de configuration

Le menu **Plus** est groupé (Ventes et clients, Terrain et stock, Gestion, Application). Dans **Paramètres**, les sections longues (Partager, Tarifs d'abonnement, Messages WhatsApp, Synchronisation, Google Drive, Données) sont repliées par défaut. Sur l'accueil, l'administrateur voit un rappel tant qu'il n'a pas défini de **code PIN**, fait une **sauvegarde** (ou si la dernière date de plus de 7 jours) ou renseigné **RCCM / ID Nat. / N° Impôt**.

## Finance et reçus

**Onglet Finance** (administrateur et comptable, barre du bas et menu latéral) : tout l'argent qui entre et qui sort sur la période choisie (jour, semaine, mois, année, dates libres). **Entrées** : paiements des clients et pénalités payées. **Sorties** : dépenses, commissions des techniciens et achats de stock (case à décocher : ils ne sont pas des dépenses du bénéfice, qui compte déjà le coût des marchandises vendues). Cartes Entrées / Sorties / Solde, tableau **par mode de paiement** (Cash, M-Pesa, Airtel…) et **par devise** (francs et dollars réellement encaissés), puis la liste jour par jour ; filtres Entrées / Sorties et par mode ; export CSV, impression, feuille « Finance » de l'export Excel. Chaque montant est converti avec le taux de son propre enregistrement. Les dépenses ont maintenant un champ « Payé par » ; les anciennes apparaissent en « Non précisé ».

**Preuve de paiement** : la facture (écran, impression / PDF, Word) contient un bloc **PAIEMENTS REÇUS** : date, mode, référence, montant reçu (avec le montant et le taux si payé dans l'autre devise) et **reste après chaque paiement**, ainsi que « FACTURE SOLDÉE le … » ou « Total payé / Reste à payer ». Chaque paiement a un **reçu** imprimable (🧾 sur la facture et dans Paiements, ou juste après l'enregistrement) : numéro (ex. FAC-2026-0002-P2), nom du client, montant en lettres, état de la facture et cases de signature.

## Supprimer des factures

Réservé à l'administrateur. Une facture se supprime depuis sa page (« Supprimer la facture »), ou **plusieurs à la fois** depuis la liste : **☑ Sélectionner pour supprimer**, toucher les factures (ou « Tout »), puis **🗑 Supprimer**. Une confirmation rappelle les conséquences : le **stock est remis**, les **paiements et installations liés sont supprimés**, les livraisons liées sont détachées, et un **renouvellement d'abonnement** fait par cette facture est annulé (le client retrouve sa période précédente). Une barre **« Annuler »** reste affichée 12 secondes pour tout rétablir. Les numéros de facture ne sont **jamais réutilisés** (pas de doublon possible, même entre appareils) : la numérotation garde donc un trou à la place de la facture supprimée.

## Taux de change

Le taux USD / CDF change souvent. Il se modifie en un geste : le bouton **💱 1 $ = … CDF** de l'accueil, ou Paramètres → Taux, ou le champ « Taux du jour » des formulaires de facture et de paiement (le taux saisi devient alors le taux du jour). Chaque **facture**, **paiement**, **dépense** et **pénalité** garde **son propre taux**, enregistré à sa création : changer le taux ensuite ne modifie ni les anciennes factures imprimées, ni les rapports des mois passés. Une facture antidatée propose le taux en vigueur à sa date (historique des changements conservé). À la mise à jour, les enregistrements existants reçoivent le taux du moment (leur taux d'origine n'étant pas connu) ; ils sont ensuite figés.

## Rapport mensuel

Plus → **Rapport mensuel** (administrateur et comptable) : résumé d'un mois, avec les flèches ‹ › pour changer de mois. Il rassemble le chiffre d'affaires, le coût, la marge brute, les dépenses par catégorie et le bénéfice net ; les abonnements (renouvellements, montant, marge, actifs / sursis / inactifs, à renouveler d'ici la fin du mois) ; les ventes de matériel, installations, nouveaux clients et livraisons ; les impayés à ce jour et ceux du mois, les pénalités payées et à payer ; le stock bas. Boutons : **Partager sur WhatsApp** (texte prêt à envoyer), **Copier le texte**, **Imprimer / PDF**.

## Tarifs d'abonnement et marge

Paramètres → **Tarifs d'abonnement** : pour chaque type d'abonnement, le **prix client** (proposé à la création du client) et le **coût Starlink** (ce qui est reversé à Starlink). Par défaut : Résidentiel 70 $ / 64 $, soit **6 $ de marge**. Chaque facture d'abonnement reçoit automatiquement le coût du type d'abonnement (converti dans la devise de la facture), donc la marge entre dans les bénéfices et dans le rapport « Abonnements » (colonne Marge). La fiche client affiche coût et marge. Le bouton « Recalculer » applique le coût aux anciennes factures d'abonnement qui n'en avaient pas.

## Pénalités

Fiche client → onglet **Abonnement** → **+ Pénalité** : montant (en $ ou CDF), motif (retard, réactivation…), date, et **part reversée à Starlink** (par défaut tout le montant, donc sans marge). Une pénalité est « À payer » jusqu'à ce que **✓ Payée** soit touché (date et mode de paiement) : le statut apparaît sur la fiche, dans l'historique du client et dans l'Excel. Les pénalités à payer figurent dans **Impayés** (total et bandeau d'accueil) avec un bouton 💬 de relance WhatsApp (message modifiable). Une pénalité payée compte dans le chiffre d'affaires de la date de paiement, et la part reversée à Starlink dans le coût : seule la différence est du bénéfice.

## Impayés

Plus → **Impayés** liste les factures dont le solde n'est pas réglé, de la plus ancienne à la plus récente, avec le total à encaisser (en dollars), la part de plus de 30 jours et l'ancienneté de chaque facture (orange après 30 jours, rouge après 60). **💰** ouvre le paiement de la facture ; **💬** ouvre WhatsApp avec le message de relance (modifiable dans Paramètres, mots `{solde} {numero} {date}`) et note la date de relance. Un bandeau « Impayés » apparaît aussi sur l'accueil.

## Rappels WhatsApp

Abonnements → **Rappels WhatsApp** liste les clients gérés dont l'abonnement finit dans 7 jours ou moins, en sursis, ou inactifs depuis moins de 30 jours. Le bouton « WhatsApp » ouvre la conversation avec le message déjà écrit (c'est l'utilisateur qui l'envoie) et note la date du rappel (la ligne reste grisée 2 jours). Les trois messages (bientôt expiré, sursis, inactif) se modifient dans Paramètres et se synchronisent entre appareils ; mots remplacés : `{prenom} {nom} {fin} {sursis} {jours} {entreprise} {acc}`.

## Sauvegarde Google Drive (optionnelle)

Complète la synchronisation Supabase (qui reste active) : deux fichiers `cispolstore-AAAA-MM-JJ` (`.json` pour restaurer, `.xlsx` Excel pour lire) sont déposés dans le dossier Drive « CISPOLstore sauvegardes » (les 30 plus récents de chaque type sont gardés, les autres vont à la corbeille Drive). Paramètres → Sauvegarde Google Drive :

1. Sur console.cloud.google.com : créer un projet, activer **Google Drive API**, configurer l'écran de consentement OAuth (portée `drive.file` ; type **Interne** avec un compte Google Workspace, sinon **Externe** et **publié en production**), puis créer un **ID client OAuth** de type Application Web avec l'origine autorisée `https://madulemarcus-arch.github.io`.
2. Coller l'ID client dans l'application, puis se connecter à Google.
3. Choisir la fréquence automatique : **une fois par jour (recommandé)**, toutes les 6 heures, toutes les heures, ou **manuelle seulement**. La sauvegarde automatique est **discrète** : elle ne part que s'il y a eu des changements, après **1 minute sans aucune activité**, jamais pendant qu'un formulaire est ouvert ni dans les 2 premières minutes après l'ouverture, sans fenêtre ni message. Options : « Seulement en Wi-Fi », « Envoyer aussi l'Excel » (en automatique, une seule fois par jour). Si Google demande de se reconnecter, l'application n'insiste pas : elle réessaie au plus toutes les 6 heures, affiche un simple rappel sur l'accueil de l'administrateur, et « Pas maintenant » le masque 24 heures. « Restaurer depuis Drive » recharge une sauvegarde (le code PIN de l'appareil est conservé).

Limites : l'application ne voit que les fichiers qu'elle a créés (`drive.file`) ; les sauvegardes sont du JSON lisible (non chiffré) ; l'autorisation silencieuse peut demander une reconnexion. Le service worker ne met jamais en cache les appels vers Google ou Supabase.

## Prévu plus tard

Rappels WhatsApp automatiques (un lien de rappel prérempli existe déjà sur la fiche client), Mobile Money, WiFi Zone (tickets, Mikrotik), profils utilisateurs (comptable, technicien, vendeur).
