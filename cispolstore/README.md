# CISPOLstore Manager

Application de gestion d'entreprise pour CISPOLstore : clients, comptes Starlink (ACC), abonnements, paiements, factures, stock, fournisseurs, installations, dépenses, bénéfices et rapports. Sans serveur ni dépendance : HTML + CSS + JavaScript, installable sur Android (PWA), utilisable hors connexion.

## Lancer

- En ligne : publication automatique sur GitHub Pages (`.github/workflows/pages.yml`, source *GitHub Actions*), puis Chrome Android → ⋮ → **Installer l'application**.
- En local : `python3 -m http.server 8000` dans ce dossier, puis http://localhost:8000.
- Pas de suite de tests : vérifier à la main (clients, factures, stock, rapports, impression).

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
| `sw.js` | Cache hors connexion (incrémenter `CACHE` à chaque changement de fichier) |

## Règles métier

- **Type de client** choisi à la création, non modifiable : *géré*, *matériel uniquement*, *installation uniquement*.
- **Abonnement** : fin = début + durée (30 jours par défaut) ; sursis = du lendemain de la fin à fin + sursis (15 jours par défaut, réglable par client). Statut automatique : actif → en sursis → inactif.
- **Renouvellement** : nouvelle période à partir de la fin actuelle (ou d'aujourd'hui si le client est inactif), avec facture et paiement optionnels.
- **Factures** : numéro `FAC-AAAA-0001` automatique et sans doublon ; les lignes du stock font sortir le stock (câble en mètres). Montant en lettres et équivalent CDF (taux réglable). Export PDF (via l'impression du navigateur), Word (.doc) et impression.
- **Stock** : entrées / sorties journalisées, fournisseurs, alertes de stock bas, câble restant sur le tableau de bord.
- **Bénéfice** = prix de vente − prix d'achat (par ligne) − dépenses. Les montants des rapports sont convertis en dollars.
- **Recherche globale** : nom, code client, ACC (même partiel), téléphone, adresse, numéro de série, facture, produit, fournisseur.

## Données et sécurité

- Les données restent dans la mémoire de l'appareil (`localStorage` + copie IndexedDB restaurée automatiquement ; stockage persistant demandé au navigateur). Pas de synchronisation entre appareils : utiliser **Sauvegarde / Restaurer** (partage Android : WhatsApp, Drive…).
- Le **PIN à 4 chiffres** verrouille l'écran de l'application (verrouillage automatique réglable, code de récupération remis à la création). Ce n'est pas un chiffrement des données.
- Les anciennes données de la version 1 (`cispolstore-v1`) et ses sauvegardes `.json` sont importées automatiquement.

## Prévu plus tard

Rappels WhatsApp automatiques (un lien de rappel prérempli existe déjà sur la fiche client), Mobile Money, WiFi Zone (tickets, Mikrotik), synchronisation cloud et profils utilisateurs (comptable, technicien, vendeur).
