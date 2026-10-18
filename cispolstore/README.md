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
| `js/invoices.js` | Factures (4 types, gabarit imprimé type Word), PDF/Word/impression, paiements, dépenses |
| `js/reports.js` | Tableau de bord, calendrier des abonnements, rapports |
| `js/settings.js` | Entreprise, taux, sécurité, sauvegarde / restauration / CSV |
| `js/sync.js` | Synchronisation entre appareils (chiffrée, fusion enregistrement par enregistrement) |
| `js/export.js` | Tableaux partagés, export Excel (.xlsx) généré sans bibliothèque |
| `js/roles.js` | Profils (administrateur, comptable, vendeur, technicien, livreur), code PIN personnel, écrans et actions autorisés |
| `js/delivery.js` | Livraisons : planification, suivi, encaissement à la livraison, vue du livreur |
| `js/techs.js` | Techniciens et collaborateurs (liste, fiche, interventions liées aux installations) |
| `js/plans.js` | Tarifs d'abonnement : prix client, coût Starlink et marge |
| `js/daily.js` | Clôture du jour : récapitulatif, cash attendu, écart, WhatsApp |
| `js/penalties.js` | Pénalités Starlink : enregistrement, paiement signalé, relance, effet sur les bénéfices |
| `js/unpaid.js` | Impayés : factures à encaisser, ancienneté, relance WhatsApp |
| `js/finance.js` | Onglet Finance : journal des entrées et sorties d'argent |
| `js/monthly.js` | Rapport mensuel : résumé du mois à partager, copier ou imprimer |
| `js/remind.js` | Rappels WhatsApp d'échéance (liste « Rappels » et messages modifiables) |
| `js/drive.js` | Sauvegardes datées sur Google Drive (manuelles ou automatiques) |
| `sync/supabase.sql` | Script à exécuter une fois dans le projet Supabase |
| `sw.js` | Cache hors connexion (**incrémenter `CACHE` à chaque publication** : c'est ce qui déclenche le message « Nouvelle version disponible ») |

## Règles métier

- **Type de client** : *géré* (kit + abonnement), *abonnement seulement*, *kit / matériel seulement*, *installation uniquement*. Il se choisit à la création et **se change ensuite** depuis la fiche du client (Infos → **Changer**), sans rien perdre : l'ACC, les dates d'abonnement et le kit restent enregistrés (cachés quand ils ne s'appliquent pas) et les factures et paiements ne bougent pas. « Abonnement seulement » est un client géré (ACC, dates, sursis, rappels) dont on ne vend pas le kit : le champ du kit n'est pas demandé. La liste des clients a un filtre **📶 Abonnement seul**.
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

**Afficher les paramètres** (administrateur) : une fois la synchronisation active, Paramètres → Synchronisation → **Afficher les paramètres** montre l'URL du projet, la clé publique et le nom d'espace, avec un bouton **Copier** pour chacun, afin de connecter un autre appareil (CISPOLstore Manager ou WiFi Zone Manager, avec le nom d'espace `wifizone`). La phrase secrète n'est enregistrée nulle part : elle ne peut pas être affichée.

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

## Achats (Factures → Achats)

Dans l'onglet **Factures**, le bouton **🛍️ Achats** (à côté de **🧾 Ventes**) liste tout ce que l'entreprise a acheté. **+ Nouvel achat** (aussi dans le bouton **＋ Action rapide**) demande :
- **chez qui** : un fournisseur de la liste, ou un nom à saisir (le fournisseur est alors ajouté automatiquement à Stock → Fournisseurs) ;
- **ce qui a été acheté** : un ou plusieurs articles (description, quantité, prix unitaire), avec le **total** calculé en direct ;
- la date, la devise ($ ou CDF), **payé par** (Cash, M-Pesa, banque…), le **n° de facture / bon** du fournisseur et une note.

Un achat s'ouvre en détail (**Modifier**, **Supprimer** réservé à l'administrateur), apparaît dans la **page du fournisseur**, dans **Finance** et la **clôture du jour** comme **sortie d'argent** (type « Achat », avec son mode de paiement), et s'exporte en CSV. Les achats sont réservés aux profils qui voient les coûts (administrateur, comptable) et se synchronisent comme le reste. Pour de la marchandise qui doit entrer dans le stock, utilisez plutôt **Stock → Entrée** (une seule des deux écritures, pour ne pas compter deux fois).

## Vrai chiffre d'affaires : installations et abonnements mis à part

Sur une facture, l'argent n'est pas tout à CISPOLstore : les **frais d'installation** vont aux techniciens et l'**abonnement** à Starlink. Seuls les **kits, le matériel et les accessoires** sont le revenu de CISPOLstore. L'application sépare donc les trois :
- **Facture** : un encadré « 🧮 Répartition de cette facture » montre l'installation, l'abonnement et le revenu CISPOLstore (les lignes « Installation… » et « Abonnement… » saisies sans produit du stock). Si le prix a été négocié à la baisse, les montants d'installation et d'abonnement restent fixes : la remise réduit le revenu CISPOLstore.
- **Finance → 🧮 Où va l'argent encaissé** : sur la période, encaissé − installations − abonnements = **chiffre d'affaires CISPOLstore** (au prorata quand le client paie en plusieurs fois, dans la devise du paiement).
- **Caisse** : l'installation et l'abonnement sont des **sorties** (« Installation » au nom du technicien, « Abonnement » Starlink) qui réduisent la caisse estimée et le cash attendu de la clôture du jour. Deux cases (Finance → En caisse) permettent de les retirer ou non de la caisse ; réglages partagés entre appareils.
- **Accueil, rapport du mois, Rapports** : « Total facturé » (comme avant) et **« CA réel »** (sans abonnements ni installations). Le bénéfice net garde son calcul habituel.

## Formulaires en feuille (design étape 4b)

Les formulaires s'ouvrent comme des **feuilles** montant du bas de l'écran : **poignée** (tirez-la vers le bas pour fermer), bouton **✕**, titre plus grand, champs plus hauts et arrondis, boutons **Annuler / Enregistrer** toujours visibles en bas.
- **Dates rapides** sous chaque champ date : **Aujourd'hui**, **Hier**, **−7 j** (le bouton actif est surligné).
- **− / +** autour des quantités (facture, entrée de stock, achat), sans descendre sous 0.
- Les montants ouvrent le clavier numérique du téléphone.

## Listes (design étape 4a)

- **Clients** : lettres d'**index collantes** (A, B, C…), pastille d'état colorée avec le **délai** (« dans 12 j », « sursis · 3 j », « depuis 63 j »), liseré de couleur à gauche, **ACC en police à chasse fixe**, message d'accueil avec bouton quand la liste est vide.
- **Glisser une ligne vers la gauche** (téléphone) pour faire apparaître les actions rapides : **📞 Appeler**, **💬 WhatsApp**, **📋 Copier l'ACC**, **🔄 Renouveler** ; sur ordinateur, elles apparaissent au survol. Toucher une ligne ouverte la referme ; la sélection pour supprimer reste inchangée.
- **Factures** : regroupées par jour (« Aujourd'hui », « Hier », date), pastille et liseré selon l'état, et en glissant : **💰 Encaisser** (si un reste est dû) et **🖨️ Imprimer**.

## Graphiques (design étape 3)

Une petite boîte à outils de graphiques sans bibliothèque (`js/charts.js`), aux couleurs du thème (clair et sombre) : **anneaux**, **barres** (une ou deux séries) et **barres horizontales**. **Touchez** une barre, une part d'anneau ou une ligne de légende pour lire sa valeur.
- **Accueil** : barres des ventes facturées de la période (la dernière barre en couleur pleine).
- **Finance** : barres **entrées / sorties** par jour (par mois si la période est longue), anneau **« Où va l'argent encaissé »** (CA CISPOLstore, installations, abonnements) et anneau des **entrées par mode de paiement**.
- **Rapports** : barres des ventes (Ventes), anneau des dépenses par catégorie (Dépenses), anneau coût / dépenses / bénéfice net (Bénéfices), anneau actifs / sursis / inactifs (Abonnements), anneau des types de clients (Clients) et barres horizontales des **produits au stock le plus bas** (Stock).

## Nouvel accueil (design étape 2)

- **Carte principale** : le **CA réel** de la période (kits et matériel, sans abonnements ni installations), qui s'anime à l'ouverture, avec la **comparaison au même moment de la période précédente** (« ▲ 12 % vs le mois dernier »), une **courbe** des ventes et les filtres Aujourd'hui / Semaine / Mois / Année. Le taux du jour est en haut à droite.
- **Objectif du mois** : sur « Ce mois », un **anneau** montre l'avancement vers l'objectif (touchez-le pour le fixer ou le changer ; l'objectif est partagé entre les appareils).
- **Quatre tuiles d'action** : Facture, Encaisser, Client, Renouveler (seulement celles permises par le profil).
- **Abonnements** : une barre colorée actifs / sursis / inactifs avec les expirations proches (touchez pour ouvrir la liste).
- **Bien démarrer** (administrateur) : liste à cocher (code PIN, sauvegarde, infos légales, clients et stock) avec barre de progression, qui disparaît quand tout est fait ; **À faire** regroupe alertes d'abonnements, factures en attente et impayés.
- Les chiffres de Finances (total facturé, bénéfice net, dépenses, marge) défilent en cartes, puis le graphique des ventes, le stock et les renouvellements. Un profil sans accès à la finance voit ses clients actifs à la place du CA.

## Design (étape 1 : identité)

Police **Inter** embarquée (`fonts/`, licence OFL, fonctionne hors connexion), en-tête en dégradé marine aux reflets orange et jaune du logo, titres entiers (la recherche et le cadenas restent visibles, la **synchronisation** et le **thème** sont dans le menu **⋯**), barre du bas à cinq places égales avec l'onglet actif en pastille, bouton **＋ flottant à droite** (il ne masque plus « Finance »), cartes et boutons plus arrondis avec ombres douces, filtres et pastilles plus lisibles, icônes du menu **Plus** colorées par domaine, apparition douce des écrans, mode sombre assorti. Le libellé « Installation » de la fiche client devient « Référence ».

## Importer des clients (Excel ou CSV)

**Plus → Importer des clients**, ou le bouton **📥 Importer des clients (Excel)** en bas de l'onglet Clients, ou Paramètres → Données (administrateur). Choisissez un fichier **.xlsx** (ou .csv) : il est lu dans l'appareil, rien n'est envoyé sur internet.
- L'application reconnaît les colonnes d'après leur titre (nom, ACC, téléphone, abonnement, date de paiement, date d'expiration, solde dû, référence, observation, n°) ; vous pouvez corriger l'association dans « Colonnes reconnues ».
- **Comparaison avec vos clients** : le compte **ACC** identifie un kit. Même ACC déjà dans l'application = « déjà présent » (jamais ajouté deux fois). **Même nom mais ACC différent = un autre kit : il est gardé** (le client est ajouté une deuxième fois avec son propre ACC). Un client saisi à la main avec le même nom mais **sans ACC** est signalé « à vérifier » : vous choisissez *Ne pas ajouter*, *Ajouter* ou *Compléter la fiche existante* (ajoute l'ACC, la formule et les dates sans créer de doublon).
- **Référence** : le champ « Référence / adresse d'installation » reprend la colonne « Reference » du fichier ; pour un client créé par un ancien import (ACC dans ce champ), un nouvel import propose « Mettre à jour : référence » ; une référence saisie à la main n'est pas touchée.
- **Orthographe des noms** : les noms sont repris **exactement comme dans le fichier** (majuscules, minuscules, espaces simples). Un client créé par un ancien import dont le nom avait été réécrit se voit proposer « Rétablir le nom » lors d'un nouvel import du même fichier ; un client dont vous avez corrigé vous-même le nom n'est pas touché.
- **Mise à jour des dates** : un client déjà présent (même ACC) dont le fichier contient un paiement **plus récent** voit ses dates mises à jour (« Mettre à jour : dates », proposé par défaut) : la période précédente est gardée dans l'historique de l'abonnement comme pour un renouvellement, sans créer de facture. Dates identiques ou plus anciennes dans le fichier : rien n'est changé (« Ne rien changer »). Le choix se fait ligne par ligne.
- **Liste à valider** : tous les clients du fichier, avec filtres (Tous, Nouveaux, Déjà présents, À vérifier, Même nom) ; chaque ligne a un choix *Ajouter / Ne pas ajouter*, et deux boutons pour tout ajouter ou ne rien ajouter. Rien n'est créé avant « Ajouter N clients ».
- Chaque ligne ajoutée devient un **client géré** : prénom / nom, téléphone (0 ajouté devant les numéros à 9 chiffres), **ACC (champ « ACC »)**, la colonne « Reference » du fichier dans le champ « **Référence / adresse d'installation** », formule, **date de début = date de paiement**, **durée = date d'expiration − date de paiement**. Sans dates, le client est « sans abonnement ». Les formules inconnues sont créées avec leur prix (**Illimité 70 $, 250 Go 40 $** ; pour une autre formule, prix déduit des soldes dus), modifiable avant l'import ; coût Starlink à 0, à régler dans Paramètres → formules).
- La **note** reçoit « Importé depuis Excel », avec les observations « désactivé / bloqué », les **soldes dus** (aucune facture créée), les dates à vérifier et le n° du fichier.
- Après l'import, une barre **Annuler l'import** remet tout comme avant. Réimporter le même fichier n'ajoute rien.

## Supprimer plusieurs clients

**Clients → ☑ Sélectionner pour supprimer** (administrateur) : cochez les clients, **Tout** coche ceux du filtre affiché, puis **🗑 Supprimer (N)**. Les clients qui ont des factures ou des paiements sont conservés ; une barre **Annuler** remet les clients supprimés.

## Importer des factures (Word)

**Plus → Importer des factures**, ou le bouton **📥 Importer des factures (Word / PDF)** en bas de l'onglet Factures, ou Paramètres → Données (administrateur). Choisissez un ou plusieurs fichiers **Word (.docx) ou PDF** de factures : l'application lit le **numéro**, la **date**, le **client** (nom, code, adresse), les **lignes** (référence, description, prix, quantité) et le **total**, vérifie les calculs, puis affiche un aperçu par facture. Les PDF sont lus avec le composant **pdf.js** (dossier `vendor/`, licence Apache 2.0, chargé seulement quand un PDF est choisi, ensuite disponible hors connexion) ; les PDF **scannés** (images) ne sont pas lisibles. Sont reconnues les factures au modèle CISPOLstore (tableau Référence / Description / P.U. / Qté / Montant, « FACTURE N° … A : client ») et la facture « une ligne par compte ACC » de l'application (le **montant payé** et le mode indiqués dans le document sont préremplis).
- **Numéro** : chaque facture reçoit un **nouveau numéro de l'application** (dans l'ordre des dates) ; le numéro d'origine (même s'il est répété sur plusieurs fichiers) et le code client d'origine sont notés dans la note de la facture.
- **Client** : retrouvé par son code d'origine ou par son nom ; sinon **créé automatiquement** (client géré, matériel ou installation selon le contenu, code d'origine noté dans la fiche).
- **Paiement** : à chaque import, vous choisissez pour chaque facture *Impayée* ou *Payée* avec le mode (Cash, M-Pesa…), ou « Tout marquer payé / impayé ». Une facture payée crée un paiement du total à la date de la facture.
- **Type** déduit des lignes (matériel, abonnement, installation ou facture complète) ; les lignes d'installation et d'abonnement alimentent la **répartition** et le **CA réel**. Le stock n'est pas touché, le coût des marchandises est à 0.
- Une facture déjà importée (même numéro, date, client et total) est ignorée ; même client et même montant à une autre date : « doublon possible ». Barre **Annuler l'import** après l'ajout.

## Abonnements : compteurs cliquables

Dans **Abonnements**, touchez **Actifs**, **En sursis** ou **Inactifs** : la liste des clients de cette catégorie s'affiche juste en dessous (nom, formule, téléphone, date de fin ; « dans N jours » pour les actifs, « jusqu'au… » pour le sursis, « fin le… » pour les inactifs). Touchez un client pour ouvrir sa fiche, retouchez le compteur pour fermer la liste.

## Voir tous les mouvements (Finance)

Dans **Finance**, touchez la case **⬇ Entrées**, **⬆ Sorties** ou **Solde** : la liste des **Mouvements** s'affiche directement, filtrée sur les entrées, les sorties ou tout (jusqu'à 1 000 lignes, jour par jour). La case choisie est encadrée ; retouchez **Solde** pour tout revoir.

## Caisse (Finance → En caisse)

- **Noter le montant en caisse** : comptez ce qu'il y a dans la caisse et écrivez-le (dollars et/ou francs, date, note). L'application garde l'historique des comptages et affiche la **caisse estimée maintenant** : le dernier montant noté, puis les entrées et sorties en **Cash** des jours suivants (paiements, dépenses, achats). À chaque nouveau comptage, l'**écart** avec ce qui était attendu est enregistré (OK ou écart en $ / CDF). Le comptage est réputé fait en fin de journée : seuls les mouvements des jours suivants sont ajoutés. Seul l'administrateur peut supprimer un comptage.
- **Frais d'installation hors de la caisse** : les techniciens sont payés directement avec l'argent encaissé. Pour chaque paiement d'une facture qui contient une ligne « Installation », la part des frais d'installation (au prorata si le client paie en plusieurs fois, dans la devise du paiement) est donc comptée comme une **sortie « Installation »** (nom du technicien, même mode de paiement) : elle apparaît dans les mouvements de Finance, réduit la caisse estimée et le **cash attendu** de la clôture du jour. La case **« Retirer les frais d'installation de la caisse »** désactive ce calcul (réglage partagé entre appareils).

## Finance et reçus

**Onglet Finance** (administrateur et comptable, barre du bas et menu latéral) : tout l'argent qui entre et qui sort sur la période choisie (jour, semaine, mois, année, dates libres). **Entrées** : paiements des clients et pénalités payées. **Sorties** : dépenses, commissions des techniciens et achats de stock (case à décocher : ils ne sont pas des dépenses du bénéfice, qui compte déjà le coût des marchandises vendues). Cartes Entrées / Sorties / Solde, tableau **par mode de paiement** (Cash, M-Pesa, Airtel…) et **par devise** (francs et dollars réellement encaissés), puis la liste jour par jour ; filtres Entrées / Sorties et par mode ; export CSV, impression, feuille « Finance » de l'export Excel. Chaque montant est converti avec le taux de son propre enregistrement. Les dépenses ont maintenant un champ « Payé par » ; les anciennes apparaissent en « Non précisé ».

**Paiement du client à la création d'une facture** : le bloc **💰 Paiement du client** du formulaire demande « Le client a donné » (montant et devise, par défaut le total de la facture). Boutons rapides **Tout payé / Moitié / Rien payé**, mode de paiement et référence ; l'écran affiche en direct le **reste à payer** ou la **monnaie à rendre** (le paiement enregistré est plafonné au total). Un paiement en francs est enregistré en francs, au taux de la facture. Après la création, une barre propose d'imprimer le reçu, et la page de la facture résume Total / Reçu du client / Reste à payer.

**Anciennes factures** : sur la page d'une facture non soldée, le bouton **💰 Encaisser** ouvre le formulaire de paiement avec les boutons **Tout le reste / Moitié**, le reste à payer en direct et la devise au choix ; un paiement ne dépasse jamais le solde. La page de chaque facture (anciennes comprises) affiche Total / Reçu du client / Reste à payer.

**Facture imprimée = prix complet** : ce que le client reçoit (écran, PDF, Word, impression) montre toujours le **total de la facture**, sans paiement ni reste. Ce que le client a réellement donné s'enregistre à part, dans le système, avec un **reçu** imprimable par paiement (🧾, numéro du type FAC-2026-0002-P2, montant en lettres). Si le client **marchande**, cochez « Le client a marchandé » (à la création, ou dans « Encaisser » sur une ancienne facture, ou le bouton **🤝 Solder au prix négocié** sur la page d'une facture déjà partiellement payée ; « ↩ Annuler le prix négocié » le retire) : le montant donné devient le **prix convenu**, la facture est soldée, la facture imprimée garde son prix complet, et les rapports (chiffre d'affaires, bénéfices) comptent le prix convenu. La page de la facture affiche le total imprimé, le prix convenu, le reçu et le reste.

## Supprimer des factures

Réservé à l'administrateur. Une facture se supprime depuis sa page (« Supprimer la facture »), ou **plusieurs à la fois** depuis la liste : **☑ Sélectionner pour supprimer**, toucher les factures (ou « Tout »), puis **🗑 Supprimer**. Une confirmation rappelle les conséquences : le **stock est remis**, les **paiements et installations liés sont supprimés**, les livraisons liées sont détachées, et un **renouvellement d'abonnement** fait par cette facture est annulé (le client retrouve sa période précédente). Une barre **« Annuler »** reste affichée 12 secondes pour tout rétablir. Les numéros de facture ne sont **jamais réutilisés** (pas de doublon possible, même entre appareils) : la numérotation garde donc un trou à la place de la facture supprimée.

## Taux de change

Le taux USD / CDF change souvent. Il se modifie en un geste : le bouton **💱 1 $ = … CDF** de l'accueil, ou Paramètres → Taux, ou le champ « Taux du jour » des formulaires de facture et de paiement (le taux saisi devient alors le taux du jour). Chaque **facture**, **paiement**, **dépense** et **pénalité** garde **son propre taux**, enregistré à sa création : changer le taux ensuite ne modifie ni les anciennes factures imprimées, ni les rapports des mois passés. Une facture antidatée propose le taux en vigueur à sa date (historique des changements conservé). À la mise à jour, les enregistrements existants reçoivent le taux du moment (leur taux d'origine n'étant pas connu) ; ils sont ensuite figés.

## Facture imprimée (modèle Word de l'entreprise)

La facture imprimée (impression, PDF, Word) reprend le modèle de la facture Word : en-tête avec logo, **CISPOL STORE** et le sous-titre ; RCCM / Id. Nat. / N° Impôt à gauche et siège social / contact / téléphone à droite ; deux cases **FACTURE** (numéro, date, lieu) et **CLIENT** (nom, code client, adresse, téléphone) ; tableau **Référence | Description | P.U. | Qté | Montant** à en-tête bleu marine ; **Total TTC** et bandeau **NET À PAYER** ; encadré orange avec le **montant en lettres** et le **mode de règlement** ; **MERCI POUR VOTRE CONFIANCE** avec le **tampon** rond de l'entreprise. Polices et couleurs : Cambria, bleu #1A365D, orange #DD6B20. Les reçus de paiement utilisent la même présentation, avec le **logo** en en-tête et le **cachet** rond placé **au-dessus de la ligne de signature « CISPOLstore »** (à droite de « Le client »). L'impression attend que le logo et le cachet soient chargés avant de s'ouvrir, pour qu'ils ne manquent plus sur un téléphone lent.

Paramètres → Entreprise : *Sous-titre*, *Ville* (case « Lieu ») et *Mode de règlement* de la facture se modifient (valeurs par défaut : « SOLUTIONS TECHNOLOGIQUES ET CONNECTIVITE », « Kinshasa », « Virement bancaire ou espèces. »). La colonne *Référence* reprend la référence du produit en stock (« — » sinon). Le tampon est le fichier `stamp.png` (fond transparent). Comme avant, la facture imprimée montre toujours le prix complet, sans paiement ni reste.

## Facture en attente

Quand un client demande seulement la facture et peut ne pas prendre le produit, cochez **⏳ Facture en attente** à la création. La facture est remise au client (prix complet) mais **rien n'est déduit du stock**, elle **ne compte ni dans les ventes, ni dans les rapports, ni dans les impayés** (filtre « En attente » dans la liste des factures), et l'abonnement ou l'installation liés ne sont pas appliqués. Sur sa page : **✅ Le client prend le produit** valide la vente (le stock est déduit, l'abonnement renouvelé, l'installation créée) puis ouvre l'encaissement ; **✖ Le client n'en veut plus** annule la facture sans toucher au stock. Si le client a déjà donné de l'argent, saisissez-le dans le cadre **« Acompte reçu du client »** à la création (champ « Le client a donné », vide par défaut) ou plus tard avec **💰 Recevoir un acompte** sur la page de la facture : l'acompte entre dans la caisse mais pas dans les ventes tant que la vente n'est pas validée ; à la validation, il reste à encaisser le solde. Si le client n'en veut plus, l'application rappelle de lui rendre l'acompte et le retire de la caisse. Dans la liste, glissez une facture en attente vers la gauche : **🗑 Supprimer** apparaît directement.

**Rappel** : une facture en attente depuis **3 jours ou plus** fait apparaître sur l'accueil l'alerte « ⏳ N facture(s) en attente » (un toucher ouvre la liste filtrée). Dans la liste, chaque facture en attente affiche son ancienneté (⏳ 5 j, en rouge à partir de 3 jours).

## Clôture du jour

Plus → **🌙 Clôture du jour** (administrateur et comptable). Pour la date choisie (aujourd'hui par défaut, boutons Veille / Lendemain ou calendrier) : **entrées et sorties**, détail **par mode de paiement** (Cash, M-Pesa, Airtel…) et par devise, factures émises et ce qui **reste à encaisser**, livraisons faites, puis le **cash attendu en caisse** (cash encaissé − cash payé, en dollars et en francs). Saisissez le cash réellement compté et appuyez sur **Clôturer la journée** : l'**écart** est enregistré (avec une note facultative) et visible dans « Dernières clôtures » ; « Rouvrir » annule la clôture. Le récapitulatif s'envoie par **WhatsApp**, se copie ou s'imprime. Les clôtures sont sauvegardées et synchronisées comme le reste.

## Rapport mensuel

Plus → **Rapport mensuel** (administrateur et comptable) : résumé d'un mois, avec les flèches ‹ › pour changer de mois. Il rassemble le chiffre d'affaires, le coût, la marge brute, les dépenses par catégorie et le bénéfice net ; les abonnements (renouvellements, montant, marge, actifs / sursis / inactifs, à renouveler d'ici la fin du mois) ; les ventes de matériel, installations, nouveaux clients et livraisons ; les impayés à ce jour et ceux du mois, les pénalités payées et à payer ; le stock bas. Boutons : **Partager sur WhatsApp** (texte prêt à envoyer), **Copier le texte**, **Imprimer / PDF**.

## Tarifs d'abonnement et marge

Paramètres → **Tarifs d'abonnement** : pour chaque type d'abonnement, le **prix client** (proposé à la création du client) et le **coût Starlink** (ce qui est reversé à Starlink). Par défaut : Résidentiel 70 $ / 64 $, soit **6 $ de marge**. Chaque facture d'abonnement reçoit automatiquement le coût du type d'abonnement (converti dans la devise de la facture), donc la marge entre dans les bénéfices et dans le rapport « Abonnements » (colonne Marge). La fiche client affiche coût et marge. Le bouton « Recalculer » applique le coût aux anciennes factures d'abonnement qui n'en avaient pas.

## Pénalités

Fiche client → onglet **Abonnement** → **+ Pénalité** : montant (en $ ou CDF), motif (retard, réactivation…), date, et **part reversée à Starlink** (par défaut tout le montant, donc sans marge). Une pénalité est « À payer » jusqu'à ce que **✓ Payée** soit touché (date et mode de paiement) : le statut apparaît sur la fiche, dans l'historique du client et dans l'Excel. Les pénalités à payer figurent dans **Impayés** (total et bandeau d'accueil) avec un bouton 💬 de relance WhatsApp (message modifiable). Une pénalité payée compte dans le chiffre d'affaires de la date de paiement, et la part reversée à Starlink dans le coût : seule la différence est du bénéfice.

## Impayés

Plus → **Impayés** liste les factures dont le solde n'est pas réglé, de la plus ancienne à la plus récente, avec le total à encaisser (en dollars), la part de plus de 30 jours et l'ancienneté de chaque facture (orange après 30 jours, rouge après 60). **💰** ouvre le paiement de la facture ; **💬** ouvre WhatsApp avec le message de relance (modifiable dans Paramètres, mots `{solde} {numero} {date}`) et note la date de relance. Un bandeau « Impayés » apparaît aussi sur l'accueil.

## Relance en série des impayés

Sur l'écran **Impayés**, le bloc **💬 Relance en série** parcourt les clients à relancer, du plus ancien impayé au plus récent (téléphone connu, pas relancés depuis 2 jours). Pour chacun, le montant et le message prêt s'affichent : **Envoyer sur WhatsApp** ouvre la conversation avec le message (il ne reste qu'à l'envoyer), marque la facture comme relancée et passe au suivant ; **Passer** saute le client. Les factures en attente ne sont pas relancées.

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

## Décor de l'accueil (photos)

- Réglages → « Décor de l'accueil » : le fond de la carte du montant peut être le décor par défaut, une scène intégrée (🌅 Coucher de soleil, 🌌 Nuit, 💚 Aurore) ou **Mes photos**. Le décor s'affiche **derrière l'animation** (étoiles, satellites…) et le texte reste lisible grâce à un voile sombre.
- **🛰️ Starlink** : 4 photos fournies avec l'application (parabole Starlink, kit, antenne extérieure sur son mât, routeur et switch), dans `cispolstore/photos/` (environ 170 Ko au total, mises en cache par le service worker : elles marchent hors connexion). Ce sont de **petites cartes photo** qui passent l'une derrière l'autre (jamais une seule photo plein cadre), derrière l'animation. **Le sens change au hasard à chaque passage**, jamais deux fois le même d'affilée : de gauche à droite, de droite à gauche, de haut en bas, de bas en haut, ou depuis le centre (les cartes grossissent et partent dans toutes les directions). Si l'appareil demande de réduire les animations, les cartes restent fixes. Les photos sont recadrées pour ne montrer ni personne, ni adresse, ni intérieur de client : n'en ajouter que dans le même esprit, ce dépôt est public.
- **Mes photos** : « 📷 Prendre une photo » (appareil photo) ou « 🖼️ Galerie ou Drive » (le sélecteur du téléphone propose la galerie, Google Drive et les autres dossiers). 8 photos au maximum ; elles passent de la même façon, dans un sens tiré au hasard.
- Chaque photo est **réduite sur le téléphone** (1280 px, JPEG, environ 100 Ko) avant d'être enregistrée, dans sa propre base IndexedDB (`js/photos.js`), jamais dans les données principales (limitées à environ 5 Mo).
- Elles restent **sur cet appareil** : pas dans les sauvegardes ni la synchronisation (trop lourdes). Le choix du décor est conservé lors d'une restauration.
- La carte affiche l'espace utilisé ; **Alléger les photos** les réduit à 800 px avec une qualité plus basse, **Tout supprimer** les efface.

## Petits effets (design étape 4c)

- **Confettis** 🎉 quand une facture est soldée (paiement complet, prix négocié), après un import réussi (clients ou factures), quand l'objectif du mois est atteint et quand une réussite est débloquée. Ils sont désactivés si l'appareil demande de réduire les animations.
- **Salutation selon l'heure** : Bonjour ☀️ / Bon après-midi 🌤️ / Bonsoir 🌙 dans l'en-tête de l'accueil.
- **Réussites** 🏆 : pastilles « 10 / 50 / 100 / 250 clients » et « … factures » sur l'accueil (la prochaine à débloquer est en grisé). Les réussites déjà atteintes à l'ouverture ne déclenchent pas de confettis.
- **Compteurs animés** : le chiffre d'affaires et les indicateurs de l'accueil montent jusqu'à leur valeur (attribut `data-count`, géré par `js/effects.js`).
- **Vibration légère** (8 ms) sur la barre du bas et le bouton +, si le téléphone le permet.
- **Fond animé** ✨ sur l'accueil : étoiles qui scintillent vite et dérivent, halos de couleur en mouvement et, toutes les quelques secondes, une scène différente tirée au hasard (jamais deux fois la même d'affilée) : train de satellites type Starlink, pluie d'étoiles filantes, comète, ondes WiFi qui s'élargissent ou vague de lumière qui balaie les étoiles. Dessiné sur deux petits canvas qui partagent une seule boucle (`js/effects.js`, ~30 images/s) : un derrière le contenu et un dans la carte du chiffre d'affaires (le montant), où les étoiles et les satellites sont bien visibles, sous le texte, sans effet sur les clics, les impressions ni les PDF. Il s'arrête sur les autres écrans, quand l'application passe en arrière-plan, en mode économie de données ou si l'appareil demande de réduire les animations. Interrupteur « ✨ Fond animé / Fond fixe » dans Apparence (réglage propre à l'appareil, conservé lors d'une restauration).

## Thèmes et couleurs (design étape 5)

- **Thème Noir** (écrans OLED) en plus d'Automatique, Clair et Sombre : fond noir pur, cartes très sombres.
- **Couleur de l'application** : orange (par défaut), bleu, vert, violet, rose ou or. Elle colore les boutons, le bouton ＋ et les éléments actifs. L'aperçu est immédiat dans la fenêtre ; « Annuler » rétablit la couleur précédente.
- Réglages dans **Plus › Paramètres › Application › Modifier**. Thème et couleur restent propres à chaque appareil (ils ne sont pas synchronisés).

## Couleurs par domaine (design étape 6)

Chaque rubrique prend sa couleur : **Clients** en bleu, **Finance** en vert (entrées/sorties, caisse, clôture, paiements, dépenses, impayés, rapports), **Stock** en ambre (fournisseurs, achats, installations), **Abonnements** en violet (rappels), **Factures** en orange. Cette couleur teinte la lueur de l'en-tête, la barre des titres de section, le filtre actif, le liseré des cartes de chiffres, le fond de page (très léger) et l'onglet actif du bas. L'accueil et le menu Plus gardent la couleur d'accent choisie dans les paramètres ; les boutons d'action suivent toujours cette couleur d'accent. Les vues sont associées à leur domaine dans `render()` de `js/ui.js`.

## Documents imprimés (design étape 7)

- **QR code sur la facture** (en bas, à côté du cachet) : le client le scanne, WhatsApp s'ouvre vers le numéro de l'entreprise avec « Bonjour, je règle la facture FAC-… (montant) » déjà écrit, pour payer ou envoyer sa preuve. Il n'apparaît que si le téléphone de l'entreprise est renseigné (Paramètres). Générateur embarqué : `vendor/qrcode.js` (qrcode-generator, licence MIT).
- **Cachet plus marqué** : légèrement incliné, contraste et couleurs renforcés, sur la facture et le reçu.
- **📤 Partager en PDF** : bouton sur la facture et sur chaque paiement (reçu). Il crée un vrai fichier PDF et ouvre le partage du téléphone (WhatsApp, e-mail…) ; sur ordinateur, le fichier est téléchargé. Code dans `js/share.js` (sans bibliothèque : le document est dessiné en image puis placé dans un PDF A4, donc le texte du PDF n'est pas sélectionnable). Les boutons Imprimer et Word restent inchangés.

## Ordinateur (design étape 8)

- **Accueil sur trois colonnes** (écrans de 1280 px et plus) : à faire / bien démarrer · finances · renouvellements et stock. Les listes de clients, de factures et de paiements passent sur trois colonnes, avec des lignes plus compactes.
- **Actions au survol** : sur ordinateur, les actions rapides d'un client (Appeler, WhatsApp, Copier l'ACC, Renouveler) apparaissent en petits boutons ronds quand la souris passe sur la ligne (info-bulle au survol), au lieu de faire glisser la ligne.
- **Raccourcis clavier** (ignorés quand on écrit dans un champ, dans une fenêtre ouverte ou sur l'écran verrouillé, et limités aux droits du profil) :
  - `/` ou `Ctrl`+`K` : rechercher · `?` : aide · `Échap` : fermer
  - `F` nouvelle facture · `C` nouveau client · `P` encaisser · `R` renouveler · `N` menu d'action rapide
  - `G` puis `H` accueil, `C` clients, `A` abonnements, `S` stock, `F` factures, `P` paiements, `B` finance, `I` impayés
  - L'aide est aussi dans le menu de gauche (« Raccourcis clavier »). Code : `js/keys.js`.

## Fiches et finitions (design étape 9)

- **Pastilles d'état avec icône** : ✓ (actif, payée), ⏳ (en sursis, partielle, en attente), ✕ (inactif, impayée), partout dans l'application.
- **Fiche client** : en-tête en dégradé avec avatar, statut, code, ACC à copier d'un toucher, trois chiffres clés (jours d'abonnement restants, total facturé, reste à payer) et tuiles Appeler / WhatsApp / Facture / Renouveler.
- **Détail d'une facture** : en-tête avec le total, une barre de progression des paiements reçus, le reste à payer et un lien vers le client.
- **Stock** : en-tête avec la valeur du stock (prix d'achat, ou prix de vente pour les profils sans accès aux coûts), le nombre de produits, de produits en stock bas et de produits suivis.
- **Indicateur de chargement** (`App.busy`) pendant la lecture des fichiers d'import et la création d'un PDF.
- **Effet au toucher** sur les cartes cliquables, les puces, les onglets et les étapes (désactivé si l'appareil demande de réduire les animations).

## Plus et Paramètres (design étape 10)

Les écrans **Plus** et **Paramètres** commencent par un en-tête : logo et nom de l'entreprise, profil connecté avec son rôle, et trois pastilles d'état : **PIN** (protégé ou non), **sauvegarde** (récente en vert, ancienne ou absente en jaune) et **synchronisation**. Un toucher sur « Sans PIN » ou sur la sauvegarde lance directement l'action (réservé à l'administrateur). Code : `App.profileHero` dans `js/settings.js`.

## Stock cliquable et rapport par produit

- **Résumé du Stock cliquable** : les pastilles Produits, Stock bas, En stock et Épuisés filtrent la liste en dessous (comme Actifs / Sursis / Inactifs dans Abonnements). Une rangée de filtres (Tous, En stock, Stock bas, Épuisés, Sans stock) permet de changer ensuite.
- **Accueil** : les cartes Produits, Stock bas et Câble restant ouvrent le Stock déjà filtré.
- **Rapport du produit** : un toucher sur un produit (Starlink Mini, câble…) ouvre sa fiche : stock actuel et minimum, quantités vendues, chiffre d'affaires, marge (profils autorisés), entrées/sorties, graphique des 6 derniers mois, liste des ventes (chaque ligne ouvre la facture) et historique des mouvements, avec les boutons Entrée / Sortie / Modifier. Les boutons ＋ － ✎ de la liste restent utilisables.

## Apparence : Auto, Clair, Sombre, Noir

Une carte **Apparence** est affichée dans **Plus** et dans **Paramètres** : quatre puces (🌓 Auto, ☀️ Clair, 🌙 Sombre, ⚫ Noir) et les couleurs d'accent. Le choix s'applique tout de suite et reste propre à l'appareil. « Auto » suit le réglage du téléphone ; « Noir » donne un fond noir pur (écrans OLED). Tous les profils (vendeur, comptable…) peuvent la modifier ; le bouton ☀️/🌙 du menu ⋯ reste disponible pour basculer vite entre clair et sombre.

### Où changer le type d'un client (visible partout)

Un bouton jaune **« Changer ▾ »** est affiché sous le nom du client dans l'en-tête de sa fiche, en haut du formulaire « Modifier », et dans la liste des clients : sous le statut de chaque ligne s'affiche le type (si le client n'a pas d'abonnement). Il n'y a pas de bouton « Type » dans les actions qui apparaissent en glissant la ligne. Le numéro de version de l'application (« build v74 ») est affiché en bas de l'écran Plus et dans l'en-tête de Paramètres : il permet de vérifier que la dernière version est bien chargée (`App.BUILD` dans `js/core.js`, à garder égal à `CACHE` de `sw.js`).

## Icônes colorées et animées (barre du bas et menu de gauche)

Accueil, Clients, Finance, Stock, Plus (et Installations, Livraisons pour les profils concernés) ont des icônes SVG à deux tons, chacune dans la couleur de sa rubrique (`js/icons.js`). L'onglet actif a un petit rebond et l'icône se redessine ; sans animation si l'appareil demande de réduire les animations. Le menu de gauche de l'ordinateur reprend les mêmes icônes pour Accueil, Clients, Finance et Stock.

## Fonds en attente (dépôts des clients)

Pour l'argent qu'un client a **déjà versé** et que vous **gardez en attendant de payer pour lui** (abonnement Starlink, commande, installation…).

- **Où** : Plus → **💼 Fonds en attente** (réservé à l'administrateur et au comptable) ; bouton ＋ → **Nouveau dépôt client** ; onglet **Dépôts** de la fiche d'un client ; carte « Fonds en attente » dans « À faire » sur l'accueil quand il y a de l'argent à payer.
- **Un dépôt** : client, montant (dollars ou francs), pour payer quoi (Abonnement Starlink, Kit / matériel, Installation, Commande en cours, Autre), reçu par quel mode, date, référence, note. États : *En attente*, *Partiel*, *Payé*, *Remboursé*.
- **Payer pour le client** : enregistre le paiement (total ou partiel, avec le mode, la date, la note, la référence) ; le reste diminue. Pour un abonnement d'un client géré, on peut ouvrir ensuite le renouvellement. **Rendre au client** : même chose pour un remboursement. On ne peut pas payer plus que le reste.
- **Compta** : un dépôt est de l'argent des clients, **pas du chiffre d'affaires ni du bénéfice**. Il entre dans la caisse (Finance, caisse estimée, clôture du jour : entrée « Dépôt client ») quand il est reçu, et sort (« Dépôt payé » ou « Dépôt remboursé ») quand vous payez ou rendez. La carte de l'accueil et l'en-tête de la page donnent le total encore à payer (en dollars, les francs étant convertis au taux du dépôt).
- Les dépôts sont synchronisés entre appareils et inclus dans la sauvegarde. Code : `js/deposits.js`.

### Reçu de dépôt (étape 1 des améliorations)

Dans le détail d'un dépôt (Plus → Fonds en attente → toucher un dépôt) : **🧾 Reçu** (impression) et **📤 PDF** (partage par WhatsApp, e-mail…). Le document, avec le logo et le cachet, porte un numéro **DEP-AAAA-NNNN** (attribué à la création du dépôt), le client, la somme en chiffres et en lettres, ce qu'elle doit payer, la liste de ce qui a déjà été payé ou rendu pour le client, et le **reste détenu** (ou « tout est réglé »). On peut le remettre au client à la réception de l'argent, puis de nouveau à jour après chaque paiement.

## Relances du jour (étape 2 des améliorations)

Menu **Plus → Relances du jour** : un seul écran regroupe les abonnements à renouveler, les factures impayées et les pénalités à relancer. Les filtres Tout / Abonnements / Impayés / Pénalités affichent chacun leur compteur.

- Le bouton 💬 d'une ligne ouvre WhatsApp avec le message déjà écrit (les modèles se modifient dans Paramètres).
- **Tout relancer en série** déroule les clients un par un (« Relance 2 / 5 ») : Envoyer sur WhatsApp ou Passer.
- Un client relancé depuis moins de 2 jours est mis de côté. Les clients sans numéro sont comptés à part.
- L'accueil affiche « N relance(s) à faire aujourd'hui » dans « À faire ».

## Dû à Starlink (étape 3 des améliorations)

Menu **Plus → Dû à Starlink** (administrateur et comptable) : suit l'argent des abonnements encaissé auprès des clients, qui doit être reversé à Starlink.

- **Encaissé pour Starlink** = part « abonnement » de chaque paiement + part Starlink des pénalités payées, mois par mois.
- **Reversements** : le bouton « + Reversement à Starlink » (montant prérempli avec le reste dû) enregistre chaque somme envoyée. Le **reste à reverser** = encaissé − reversé (ou « avance » s'il est négatif).
- Un reversement peut être modifié ou supprimé. Il apparaît dans le journal de caisse seulement si les abonnements ne sont pas déjà retirés de la caisse (réglage de Finance), pour ne pas compter deux fois.
- L'accueil affiche « Dû à Starlink : X $ » dans « À faire » tant qu'il reste une somme à reverser.

## Dépôt client : recherche et clients gérés seulement

Dans « Nouveau dépôt client », un champ **Rechercher un client** (nom, compte ACC, téléphone, sans tenir compte des accents) filtre la liste, et seuls les **clients gérés par CISPOLstore** y apparaissent. Quand un seul client correspond, il est choisi automatiquement.

## Devis (étape 4 des améliorations)

Menu **Plus → Devis** : créez un devis numéroté `DEV-AAAA-NNNN` pour un client ou un prospect (nom libre), avec des lignes tirées du stock ou libres, une devise et une durée de validité (15 jours par défaut).

- **Imprimer / PDF / WhatsApp** : le document reprend l'en-tête de vos factures, avec « Bon pour accord » et le tampon.
- **Statuts** : En attente, Accepté, Refusé, Facturé ; un devis en attente dont la date de validité est passée s'affiche « Expiré ».
- **Transformer en facture** : une facture est créée avec les mêmes lignes (stock déduit comme pour une vente normale, ou « en attente » si coché). On peut saisir un acompte payé. Le devis passe à « Facturé » et garde le lien vers la facture.
- Modifier, dupliquer, supprimer. L'accueil signale les devis en attente de réponse.

## Inventaire du stock et bons de commande (étape 5 des améliorations)

**Stock → 📋 Inventaire** (administrateur et comptable) :

- **Comptage** : l'écran liste les produits suivis en stock ; saisissez la quantité réellement en rayon. L'écart avec le stock théorique s'affiche tout de suite (✓, +2, −3), avec le nombre d'écarts et leur valeur. Le comptage est enregistré au fur et à mesure et peut être repris plus tard.
- **Terminer** : un récapitulatif montre les manques et surplus. On peut corriger le stock avec les quantités comptées : les ajustements apparaissent dans les mouvements avec la note « Inventaire INV-AAAA-NNNN » et ne comptent pas comme des achats dans la caisse. Les produits non comptés ne sont pas touchés.
- **Historique** : chaque inventaire (numéroté `INV-AAAA-NNNN`) peut être consulté, imprimé ou envoyé en PDF.

**Stock → 🛒 À commander** : les produits dont le stock est au minimum (ou en dessous) sont regroupés par fournisseur, avec une quantité suggérée (2 × le minimum − le stock). Cochez, ajustez, puis « Créer le bon de commande » (`BC-AAAA-NNNN`) : impression, PDF ou WhatsApp au fournisseur, puis « Marquer comme reçu ». Seuls les produits ayant un **stock minimum** défini apparaissent. L'accueil signale les produits à commander.

## Journal d'activité (étape 6 des améliorations)

**Plus → Journal d'activité** (administrateur seulement) : qui a créé, modifié, supprimé ou encaissé quoi, et à quelle heure.

- Le journal compare les données à chaque enregistrement : il couvre donc tous les écrans (clients, factures, paiements, dépenses, produits, achats, dépôts, pénalités, devis, reversements Starlink, inventaires, clôtures…), le taux du jour, les profils et les restaurations de sauvegarde.
- Chaque ligne indique la personne (profil actif), son rôle, l'heure et le détail : « Marie a supprimé la facture FAC-2026-0003 (Jean K · 120 $) ». Pour une modification, le détail montre l'ancienne et la nouvelle valeur (Prix : 40 → 45).
- Filtres : type d'action (créations, modifications, suppressions, encaissements, connexions), période (aujourd'hui, 7 / 30 jours, tout), personne, et recherche libre. Le haut de l'écran signale le profil le plus actif et le nombre de suppressions de la semaine.
- Les changements de stock dus aux ventes ne sont pas comptés comme des modifications de produit (ils ont leur historique de mouvements). Le journal garde les 3 000 dernières actions, reste sur l'appareil et fait partie de la sauvegarde.

## Sauvegarde plus visible et test de restauration (étape 7 des améliorations)

- **Bandeau de rappel** : sur les écrans principaux (Accueil, Clients, Finance, Stock, Plus), un bandeau « Sauvegarde : il y a 9 jours » avec un bouton « Sauvegarder » apparaît quand la dernière sauvegarde (fichier ou Google Drive) est trop ancienne ou absente. Le ✕ le repousse à demain. Le délai se règle dans Paramètres → Données → « Rappel de sauvegarde » (tous les jours, 3, 7, 14 jours ou jamais ; 3 jours par défaut). Il n'est montré qu'au profil qui peut sauvegarder.
- **Sauvegarde vérifiée** : à chaque sauvegarde, le fichier est relu et comparé aux données de l'écran ; le message confirme « Sauvegarde créée et vérifiée ✔ (N clients, M factures) » ou avertit si elle est incomplète.
- **Tester une sauvegarde** (Paramètres → Données, administrateur) : on choisit un fichier .json ; l'application dit s'il est lisible, le compare aux données actuelles (clients, factures, paiements… fichier / actuel, total facturé, dernière facture et dernier paiement), signale s'il est plus ancien et repère les liens cassés, **sans rien remplacer**. Un bouton permet ensuite de restaurer ce fichier.
- **Correction** : l'ancienneté de la dernière sauvegarde était calculée avec le mauvais signe, si bien que l'alerte « sauvegarde ancienne » (Accueil, Paramètres) ne se déclenchait jamais. C'est corrigé.

## Statistiques clients (étape 9 des améliorations)

**Plus → Statistiques clients** (ou le bouton « 📊 Statistiques clients » en bas de l'écran Clients ; administrateur et comptable) : trois périodes au choix (30 jours, 3 mois, 12 mois).

- **Valeur moyenne par client** = chiffre d'affaires de la période ÷ nombre de clients qui ont acheté ; en dessous : panier moyen (par facture), nombre d'acheteurs et part de clients **fidèles** (2 achats ou plus).
- **Abonnements : qui part, qui reste** : à partir de l'historique des renouvellements, l'application reconstitue qui était abonné (période en cours ou sursis) au début de la période. **Taux de départ** = abonnés perdus ÷ abonnés du début ; sont aussi comptés ceux qui sont restés et les anciens **réactivés**. Un graphique montre, sur 6 mois, les nouveaux clients et les abonnements perdus. La liste des clients perdus et un raccourci vers les relances pour les abonnés **à risque** (sursis ou fin dans 7 jours) complètent le tout.
- **Meilleurs clients** : top 10 de la période avec leur part du chiffre d'affaires et leur valeur depuis toujours ; part des 5 premiers ; valeur moyenne depuis toujours.
- **Clients endormis** : sans achat depuis plus de 3 mois (et sans abonnement en cours), classés par valeur, pour les relancer.

## Export pour le comptable et rapport mensuel complet (étape 10 des améliorations)

Sur l'écran **Plus → Rapport mensuel** (administrateur et comptable), choisir le mois puis :

- **📊 Excel pour le comptable** : un classeur `.xlsx` mis en forme (en-têtes colorés, volets figés, filtres, vraies dates, montants en $ et en CDF, formules de totaux recalculées à l'ouverture, prêt à imprimer en A4) avec six feuilles : **Résumé** (activité du mois, encaissements par mode, sorties par type, situation à ce jour : impayés, fonds de clients en attente, dû à Starlink, valeur du stock), **Ventes** (factures du mois : total, payé, reste, équivalent $), **Journal de caisse** (toutes les entrées et sorties, avec totaux SUMIF et solde), **Dépenses**, **Impayés** (âge en jours) et **Stock valorisé** (quantité × prix d'achat / de vente).
- **📄 Rapport complet en PDF** : plusieurs pages A4 avec l'en-tête de l'entreprise : chiffres clés, courbe des ventes par jour, finances, abonnements, meilleurs clients du mois, argent encaissé et dépensé, dépenses par catégorie, situation à ce jour, plus gros impayés, stock bas, signature et tampon. Partage direct (WhatsApp, e-mail) ou téléchargement.

Le bouton « Imprimer » du rapport reste disponible. Les anciens exports (CSV, Excel simple dans Paramètres) ne changent pas.

## Application Android et Play Store (étape 11 des améliorations)

L'application est prête pour être publiée sur le Google Play Store sous forme d'enveloppe Android (Trusted Web Activity) qui ouvre l'application web, hors connexion comprise :

- **Manifeste complet** : icône « adaptative » (`icon-maskable-512.png`), catégories, et **raccourcis** du menu de l'icône (Relances du jour, Clients, Factures, Devis) grâce au paramètre d'adresse `?go=<écran>` (ignoré si le profil n'a pas le droit de voir l'écran).
- **Politique de confidentialité** (`privacy.html`, exigée par Google) : liée depuis Paramètres → Données.
- **Dossier `play/`** (hors du site publié) : guide pas à pas en français (`play/README.md`), textes de la fiche et réponses aux questionnaires (`play/fiche-play-store.md`), 7 captures d'écran et image de présentation générées avec des données fictives (`play/generer-captures.js`), modèle de `assetlinks.json`.
- Application **gratuite**, sans licences ni paiement intégré.

## Contrats

Plus → **Contrats** (administrateur et comptable) ; aussi depuis la fiche d'un client (onglet Factures → « + Nouveau contrat »).

- **5 modèles** : *Abonnement client* (matériel client / vendu / loué, délai de grâce, durée), *Fourniture Internet Starlink* (CISPOLstore fournisseur d'accès : offre, usage personnel / professionnel / revente d'accès, redevance, mois d'avance, frais de mise en service, préavis), *Vente / installation de matériel* (acompte, solde, livraison, garantie, réserve de propriété), *Contrat de travail / vendeur* (poste, salaire, essai, horaires, commission ; CDD si une durée est indiquée), *Contrat libre* (votre texte, avec `{{client}}`, `{{societe}}`, `{{date}}`, `{{montant}}`, `{{adresse}}`, `{{telephone}}`, `{{debut}}`, `{{fin}}`).
- Numéros `CTR-AAAA-NNNN`. Le texte (articles) est généré à partir de la fiche, puis **modifiable** (« Articles : lire, ajouter, modifier ») : bouton **+ Nouvel article**, liste d'**articles types** (confidentialité, force majeure, pénalités de retard, résiliation pour faute, modification du contrat, notifications, intégralité de l'accord, cession), flèches ↑ ↓ pour les déplacer, ✕ pour les supprimer ; **la numérotation se refait automatiquement**. « Modifier » peut régénérer tout le texte depuis le modèle.
- **Tout le texte au même endroit** : un clic sur un contrat (liste ou fiche client) ouvre sa fiche avec, juste sous le résumé, le bloc « 📜 Texte complet du contrat » (tous les articles, champs automatiques remplis) ; les boutons Imprimer / PDF / WhatsApp restent au-dessus.
- Statuts : brouillon → **en cours** (signé) → terminé / résilié. Un contrat en cours dont l'échéance est dans moins de 30 jours (ou dépassée) apparaît dans « À faire » sur l'accueil ; **Renouveler** crée le contrat suivant à la fin de l'ancien.
- Impression, **PDF**, **WhatsApp** ; en-tête, cachet et signatures comme les factures et les devis.
- Les contrats sont dans la sauvegarde, la synchronisation et le journal d'activité.
- ⚠️ Les modèles sont **indicatifs** (droit congolais, formulations générales) : faites-les relire par un juriste avant de les utiliser pour un engagement important.

### Mes propres modèles de contrat

Contrats → **📚 Mes modèles** (ou, sur un contrat existant, **Enregistrer comme modèle**) : créez autant de types de contrat que vous voulez (location, partenariat, sous-traitance…).
- Un modèle = un **nom**, une icône, le **titre** du document, les deux **parties** (ex. LE BAILLEUR / LE LOCATAIRE), une **durée par défaut** et des **articles** (mêmes boutons que pour un contrat : + Nouvel article, articles types, ↑ ↓ ✕, numérotation automatique).
- Champs automatiques dans le texte : `{{client}}`, `{{societe}}`, `{{date}}`, `{{montant}}`, `{{adresse}}`, `{{telephone}}`, `{{debut}}`, `{{fin}}`, `{{duree}}`, `{{objet}}`.
- Vos modèles apparaissent dans « Type de contrat » (« … (mon modèle) ») ; le contrat créé garde une copie du texte : modifier ou supprimer le modèle ne change pas les contrats déjà faits.
- Les modèles sont dans la sauvegarde, la synchronisation et le journal d'activité.

### Deux textes pour chaque contrat

Pour chaque contrat intégré (abonnement, fourniture Starlink, matériel, mandat, travail), l'application garde **toujours deux textes** : le **texte proposé** (déjà rédigé) et **mon propre texte** (que vous rédigez).
- À la création : choix « Texte du contrat » → *Texte proposé* ou *Mon propre texte* (l'éditeur d'articles s'ouvre alors tout de suite sur un plan vide : Objet, Prix, Durée, Litiges).
- Sur un contrat : **⇄ Utiliser mon propre texte / Utiliser le texte proposé** bascule d'un texte à l'autre sans rien perdre ; le texte en vigueur est indiqué, c'est lui qui est imprimé, envoyé en PDF et par WhatsApp.
- « Renouveler » garde le texte en vigueur (le vôtre ou le proposé) et prépare un texte proposé à jour de l'autre côté.
- Les contrats libres et vos propres modèles sont déjà « votre texte » : pas de bascule.

### Contrat d'installation et de maintenance

Contrats → Nouveau contrat → **Installation et maintenance** (13 articles, deux textes comme les autres contrats intégrés).
- Prestations au choix : **installation et maintenance**, installation seule ou maintenance seule : les articles s'adaptent (acompte et réception pour l'installation ; redevance, délai de dépannage et visites préventives pour la maintenance).
- Valeurs par défaut modifiables : acompte 50 %, dépannage sous 48 heures ouvrables, garantie des travaux 3 mois, 1 visite préventive par an, préavis de maintenance 30 jours.
- Le site d'installation se préremplit depuis la fiche du client. Le prix de l'installation (ou la redevance, pour une maintenance seule) est obligatoire.

### Contrat de travail / vendeur (renforcé)

Contrats → Nouveau contrat → **Contrat de travail / vendeur** (14 articles, deux textes comme les autres contrats intégrés) : engagement, nature et durée, **période d'essai écrite (30 jours par défaut)**, rémunération (**paie le 30** par défaut), commission sur les **ventes réellement encaissées**, horaires, **caisse et encaissements**, stock / tickets / matériel confiés, confidentialité, usage de l'application (PIN personnel, journal d'activité), obligations de l'employeur, congés et absences, fin du contrat, données personnelles et litiges.
- Durée par défaut **6 mois (CDD)** : un **motif** est alors obligatoire (temps déterminé, ouvrage, remplacement…). Mettre la durée à **0** pour un **CDI** (obligatoire pour un poste permanent).
- Aucune retenue automatique sur le salaire pour les écarts de caisse.
- ⚠️ À faire confirmer par un avocat ou l'inspection du travail : durée maximale d'un CDD, durées exactes de la période d'essai et préavis (le texte renvoie au Code du travail sans chiffre).

### Contrat de prestation de services : technicien indépendant

Contrats → Nouveau contrat → **Technicien indépendant / prestataire** (15 articles, deux textes comme les autres contrats intégrés). Le prestataire est une **personne seule** (nom, pièce d'identité, adresse, téléphone ; identification fiscale facultative), pas une entreprise.
- Rémunération au choix : **par intervention** (tarif) ou **forfait mensuel** ; paiement sous **7 jours** après validation du bon d'intervention.
- Indépendance (aucun lien de subordination), exécution personnelle des missions, bon d'intervention, moyens propres, qualité et sécurité, **reprise des malfaçons sous 30 jours**, obligations sociales et fiscales à sa charge, confidentialité et données des clients, **non-sollicitation 6 mois** après la fin, **préavis 15 jours**.
- ⚠️ À faire confirmer par un avocat : le champ d'application de la loi 17/001 sur la sous-traitance (débattu pour un prestataire seul), le risque de requalification en contrat de travail si le technicien travaille sous les ordres et horaires de CISPOLstore, et la validité de la non-sollicitation après la fin du contrat.

### Contrat d'apporteur d'affaires / agent commercial

Contrats → Nouveau contrat → **Apporteur d'affaires / agent** (15 articles, deux textes comme les autres contrats intégrés). L'intermédiaire est une **personne seule**.
- Rôle au choix : **apporteur d'affaires** (par défaut : il recommande et transmet des contacts) ou **agent commercial** (il négocie au nom de CISPOLstore, sans jamais engager l'entreprise sans accord écrit).
- Commission au choix : **pourcentage** des montants encaissés (par défaut) ou **montant fixe** par vente ; sur le **premier paiement** du client seulement (par défaut), ou aussi sur ses renouvellements pendant N mois.
- Commission **payée dans les 7 jours après l'encaissement** du client (pas de relevé mensuel), avec le détail envoyé à l'intermédiaire. Aucune commission sur une vente non payée ou annulée.
- Contrat **non exclusif**, **interdiction d'encaisser** l'argent des clients (sauf mandat écrit), indépendance, confidentialité, préavis de **30 jours** (les commissions des ventes conclues avant la fin restent dues).
- ⚠️ À faire confirmer par un avocat : les règles de l'Acte uniforme OHADA sur le droit commercial général concernant l'agent commercial (rémunération, fin du contrat, indemnité éventuelle), non vérifiées dans le détail.

### Contrat de revendeur de tickets WiFi Zone

Contrats → Nouveau contrat → **Revendeur de tickets WiFi Zone** (15 articles, 16 avec caution, deux textes comme les autres contrats intégrés). Le revendeur est une **personne seule** (nom, téléphone, adresse saisis dans le formulaire).
- **Remise** du revendeur en % du prix public (10 % par défaut), vente **au prix public uniquement**, pas de rabais sans accord écrit.
- **Tickets confiés** sur bordereau signé, propriété de CISPOLstore tant qu'ils ne sont pas vendus et payés ; le revendeur répond des tickets perdus, volés ou vendus sans versement.
- **Versement des fonds** au choix : chaque semaine le lundi (par défaut), à chaque nouvelle remise de tickets, ou chaque jour ; dans la Caisse ou par Mobile Money, avec reçu.
- **Plafond de stock** confié (200 $ par défaut) ; **caution** facultative (0 = aucune, sinon un article « Caution » est ajouté, rendue à la fin après décompte).
- Compte rendu hebdomadaire, inventaire à tout moment, **ticket défectueux** à signaler sous 48 h, préavis de **7 jours**, solde de tout compte sous 48 h, aucune donnée d'acheteur conservée.

### Contrat d'hébergement d'une borne Wi-Fi

Contrats → Nouveau contrat → **Hébergement d'une borne Wi-Fi** (15 articles, deux textes comme les autres contrats intégrés). L'hôte (commerçant ou particulier qui accueille la borne WiFi Zone) est une **personne seule** (nom, téléphone, adresse saisis dans le formulaire) ; l'adresse du local se saisit dans le champ « Adresse du local ».
- Le **matériel reste la propriété de CISPOLstore** (insaisissable pour les dettes de l'hôte), inventaire signé, constat de mise en service ; l'hôte rembourse le matériel perdu, volé ou abîmé par sa faute.
- **Électricité et emplacement** : indemnité mensuelle (5 $ par défaut, 0 = aucune).
- **Avantage de l'hôte** au choix : accès Wi-Fi gratuit (par défaut), part en % des ventes de tickets de la borne, montant fixe par mois, ou aucun ; l'avantage n'est pas dû pendant plus de 7 jours de panne par la faute de l'hôte (part ou montant fixe).
- Dépannage sous **48 h ouvrables**, préavis de **15 jours**, restitution du matériel sous **48 h**, aucune caution. Option « l'hôte est locataire » : ajoute l'obligation d'obtenir l'accord écrit du bailleur.
- L'hôte ne vend ni n'encaisse rien (sauf contrat de revendeur séparé) et n'a aucun accès aux données de connexion.
- ⚠️ À faire confirmer par un avocat : la protection du matériel contre les créanciers de l'hôte (insaisissabilité) et le rôle du bailleur si l'hôte est locataire.

### Accord de confidentialité (NDA)

Contrats → Nouveau contrat → **Confidentialité (NDA)** (13 articles, deux textes comme les autres contrats intégrés). Le destinataire est une **personne seule** (employé, technicien, partenaire : nom, téléphone, adresse saisis dans le formulaire) ; CISPOLstore est le **divulgateur** (accord à sens unique).
- **Motif** de la communication libre (par défaut « Collaboration commerciale ou technique avec CISPOLstore »).
- Informations visées : clients, prix et marges, fournisseurs, comptes et codes d'accès, méthodes techniques, chiffres de vente, projets et contrats ; exceptions classiques (déjà public, déjà connu, reçu d'un tiers, développé seul).
- Interdiction de copier ou transférer vers un compte personnel, personnes autorisées limitées, données personnelles protégées, divulgation légale encadrée.
- **Restitution ou destruction** sous 7 jours (réglable), **confidentialité 3 ans après la fin** (réglable ; sans limite pour les données personnelles et les secrets commerciaux), pénalité facultative par manquement (0 = aucune).
- ⚠️ À faire confirmer par un avocat : la durée de 3 ans après la fin, la validité de la pénalité (le juge peut la réduire) et la conformité avec le Code du numérique pour les données personnelles.

### Nom du fichier d'une facture

Quand vous **partagez en PDF**, **enregistrez en Word** ou **imprimez en PDF** une facture, le fichier porte le **nom du client** puis le numéro de la facture (par exemple « Marie Kabasele - FAC-0012.pdf »). Les caractères interdits dans un nom de fichier sont retirés.

### Conditions d'utilisation du Wi-Fi

Contrats → Nouveau contrat → **Conditions d'utilisation du Wi-Fi** (13 articles, deux textes comme les autres contrats intégrés). Ce n'est **pas un contrat signé** : c'est le texte que les clients de WiFi Zone acceptent en se connectant (page de connexion, affiche au point de vente, dos du ticket). Il n'a ni client, ni durée, ni signature ; le document imprimé porte « Version en vigueur à partir du … » et la mention d'acceptation par la connexion.
- Réglages : point de vente ou zone (facultatif, affiché dans la liste), **un seul appareil** par ticket (ou plusieurs), durée du ticket qui commence à la **première connexion** (ou à la vente), conservation des données de connexion **12 mois**, délai de réclamation **24 h**, contact de réclamation (téléphone de l'entreprise par défaut), interdiction supplémentaire propre au point de vente (facultative).
- Contenu : service fourni « en l'état », ticket prépayé non remboursable, usages autorisés et interdits, responsabilité de l'utilisateur, réseau public non sécurisé, données personnelles non vendues, coupure sans remboursement en cas d'abus, responsabilité limitée au prix du ticket.
- ⚠️ À faire confirmer par un avocat : la conformité avec le Code du numérique (conservation des données de connexion, durée de 12 mois), la validité de la limitation de responsabilité et la valeur de l'acceptation par simple connexion.

### Reconnaissance de dette avec échéancier

Contrats → Nouveau contrat → **Reconnaissance de dette (échéancier)** (14 articles, 15 avec caution, deux textes comme les autres contrats intégrés). Le débiteur est un **client de l'application** ou une personne saisie à la main ; CISPOLstore est le créancier.
- **Facture impayée** (facultatif) : la liste montre les factures impayées du client choisi ; en en choisissant une, le client, le montant restant dû, la devise et l'origine (« Facture … du … ») se remplissent tout seuls.
- **Échéancier calculé** par l'application : nombre de versements (6 par défaut), rythme (mensuel, tous les 15 jours ou hebdomadaire), date du premier versement (30 jours après la signature par défaut) et **versement à la signature** facultatif ; le tableau indique la date, le montant et le solde restant de chaque échéance, et la dernière échéance solde exactement la dette.
- **Intérêt** : aucun par défaut (réglable en % par mois). **Pénalité de retard** de 5 % de l'échéance après 5 jours de grâce, **déchéance du terme** après 2 échéances impayées et 7 jours d'avertissement (tout réglable).
- Remboursement anticipé sans frais, frais de recouvrement, **caution** facultative (un article de plus), mention manuscrite « Lu et approuvé, bon pour reconnaissance de dette de … ».
- Le suivi automatique des remboursements (échéances payées ou en retard, alertes) n'existe pas encore : les versements s'enregistrent comme d'habitude dans les paiements.
- ⚠️ À faire confirmer par un avocat : le plafond légal des intérêts (usure) avant d'en demander, la validité de la pénalité et de la clause de déchéance, et l'intérêt d'une légalisation chez un notaire pour les gros montants.

### Location de matériel avec caution

Contrats → Nouveau contrat → **Location de matériel (avec caution)** (14 articles, 15 avec option d'achat, deux textes comme les autres contrats intégrés). Le locataire est un **client de l'application** ou une personne saisie à la main ; CISPOLstore est le loueur. Durée de 6 mois par défaut (modifiable, 0 = indéterminée).
- **Matériel** : désignation avec numéros de série (champ libre) et **valeur de remplacement** (obligatoire) ; lieu d'utilisation repris de l'adresse du client.
- **Loyer** obligatoire, par mois (ou par semaine), payable d'avance.
- **Caution** : vide = égale à la valeur du matériel ; rendue sous 7 jours après contrôle de la restitution, déduction faite des sommes dues.
- Dépannage sous 48 h ouvrables, vol déclaré sous 24 h, perte/vol/dommages remboursés à la valeur de l'inventaire diminuée de l'usure normale.
- Retard : 5 jours de grâce, pénalité de 5 % du loyer, reprise du matériel après 2 loyers impayés et 7 jours d'avertissement ; préavis de 15 jours, restitution sous 48 h.
- **Option d'achat** facultative (prix et part des loyers déduite du prix) : un article de plus.
- Le suivi du stock (matériel sorti en location, remis en stock à la restitution) n'existe pas encore.
- ⚠️ À faire confirmer par un avocat : la qualification du contrat (louage de choses), la validité de la clause de reprise du matériel sans décision de justice et de la pénalité.

## Recherche d'un client dans les formulaires

Dans les formulaires **Nouvelle facture**, **Nouveau paiement**, **Nouveau devis** et **Nouveau contrat**, un champ **« Rechercher un client »** se trouve au-dessus de la liste des clients : tapez une partie du **nom**, du **téléphone**, du **compte ACC** ou du **code client** (les majuscules et les accents sont ignorés) et la liste se réduit. S'il n'y a qu'un seul résultat, il est choisi tout de suite ; plusieurs résultats sont comptés sous le champ (« 2 clients trouvés »), « Aucun client trouvé » sinon. Une facture d'abonnement ne propose que les clients gérés par CISPOLstore.
