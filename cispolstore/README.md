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

Quand un client demande seulement la facture et peut ne pas prendre le produit, cochez **⏳ Facture en attente** à la création. La facture est remise au client (prix complet) mais **rien n'est déduit du stock**, elle **ne compte ni dans les ventes, ni dans les rapports, ni dans les impayés** (filtre « En attente » dans la liste des factures), et l'abonnement ou l'installation liés ne sont pas appliqués. Sur sa page : **✅ Le client prend le produit** valide la vente (le stock est déduit, l'abonnement renouvelé, l'installation créée) puis ouvre l'encaissement ; **✖ Le client n'en veut plus** annule la facture sans toucher au stock.

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

## Petits effets (design étape 4c)

- **Confettis** 🎉 quand une facture est soldée (paiement complet, prix négocié), après un import réussi (clients ou factures), quand l'objectif du mois est atteint et quand une réussite est débloquée. Ils sont désactivés si l'appareil demande de réduire les animations.
- **Salutation selon l'heure** : Bonjour ☀️ / Bon après-midi 🌤️ / Bonsoir 🌙 dans l'en-tête de l'accueil.
- **Réussites** 🏆 : pastilles « 10 / 50 / 100 / 250 clients » et « … factures » sur l'accueil (la prochaine à débloquer est en grisé). Les réussites déjà atteintes à l'ouverture ne déclenchent pas de confettis.
- **Compteurs animés** : le chiffre d'affaires et les indicateurs de l'accueil montent jusqu'à leur valeur (attribut `data-count`, géré par `js/effects.js`).
- **Vibration légère** (8 ms) sur la barre du bas et le bouton +, si le téléphone le permet.

## Thèmes et couleurs (design étape 5)

- **Thème Noir** (écrans OLED) en plus d'Automatique, Clair et Sombre : fond noir pur, cartes très sombres.
- **Couleur de l'application** : orange (par défaut), bleu, vert, violet, rose ou or. Elle colore les boutons, le bouton ＋ et les éléments actifs. L'aperçu est immédiat dans la fenêtre ; « Annuler » rétablit la couleur précédente.
- Réglages dans **Plus › Paramètres › Application › Modifier**. Thème et couleur restent propres à chaque appareil (ils ne sont pas synchronisés).
