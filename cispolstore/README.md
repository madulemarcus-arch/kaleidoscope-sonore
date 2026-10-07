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
| `js/techs.js` | Techniciens et collaborateurs (liste, fiche, interventions liées aux installations) |
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

## Techniciens

Plus → **Techniciens** répertorie les techniciens, installateurs, revendeurs et partenaires (nom, téléphone, rôle, zone, spécialité, actif/inactif). Dans « Nouvelle installation » et dans une facture d'installation, le champ Technicien propose la liste (la saisie libre reste possible) ; la fiche du technicien affiche ses interventions et leur valeur. Renommer un technicien met à jour ses installations. Synchronisé entre appareils.

## Rappels WhatsApp

Abonnements → **Rappels WhatsApp** liste les clients gérés dont l'abonnement finit dans 7 jours ou moins, en sursis, ou inactifs depuis moins de 30 jours. Le bouton « WhatsApp » ouvre la conversation avec le message déjà écrit (c'est l'utilisateur qui l'envoie) et note la date du rappel (la ligne reste grisée 2 jours). Les trois messages (bientôt expiré, sursis, inactif) se modifient dans Paramètres et se synchronisent entre appareils ; mots remplacés : `{prenom} {nom} {fin} {sursis} {jours} {entreprise} {acc}`.

## Sauvegarde Google Drive (optionnelle)

Complète la synchronisation Supabase (qui reste active) : deux fichiers `cispolstore-AAAA-MM-JJ` (`.json` pour restaurer, `.xlsx` Excel pour lire) sont déposés dans le dossier Drive « CISPOLstore sauvegardes » (les 30 plus récents de chaque type sont gardés, les autres vont à la corbeille Drive). Paramètres → Sauvegarde Google Drive :

1. Sur console.cloud.google.com : créer un projet, activer **Google Drive API**, configurer l'écran de consentement OAuth (portée `drive.file` ; type **Interne** avec un compte Google Workspace, sinon **Externe** et **publié en production**), puis créer un **ID client OAuth** de type Application Web avec l'origine autorisée `https://madulemarcus-arch.github.io`.
2. Coller l'ID client dans l'application, puis se connecter à Google.
3. Choisir la fréquence automatique (toutes les heures, 6 h, 24 h, seulement s'il y a eu des changements, application ouverte). « Restaurer depuis Drive » recharge une sauvegarde (le code PIN de l'appareil est conservé).

Limites : l'application ne voit que les fichiers qu'elle a créés (`drive.file`) ; les sauvegardes sont du JSON lisible (non chiffré) ; l'autorisation silencieuse peut demander une reconnexion. Le service worker ne met jamais en cache les appels vers Google ou Supabase.

## Prévu plus tard

Rappels WhatsApp automatiques (un lien de rappel prérempli existe déjà sur la fiche client), Mobile Money, WiFi Zone (tickets, Mikrotik), profils utilisateurs (comptable, technicien, vendeur).
