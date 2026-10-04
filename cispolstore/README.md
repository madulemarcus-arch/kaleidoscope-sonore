# CISPOLstore – Gestion

Application de gestion d'entreprise (un seul fichier `index.html`, sans dépendance, sans build). Les données sont stockées dans le navigateur (`localStorage`).

## Lancer

Ouvrir `cispolstore/index.html` dans un navigateur, ou `python3 -m http.server 8000` puis http://localhost:8000/cispolstore/.

## Fonctions

- **Tableau de bord** : CA, marge, dépenses, bénéfice net du mois, créances, valeur du stock, graphique 6 mois, alertes de stock bas, meilleures ventes.
- **Produits & stock** : catalogue (Starlink, routeurs/WiFi, accessoires, abonnements, services), prix d'achat/vente, seuil d'alerte.
- **Ventes** : panier multi-articles, client, paiement partiel, encaissement des restes à payer, reçu imprimable, décrémentation automatique du stock.
- **Clients** (deux catégories) :
  - *Matériel seulement* : nom, téléphone, article acheté.
  - *Gérés par nous* : prénom + nom, numéro de compte Starlink (ACC), adresse de l'installation, type d'abonnement, début et fin d'abonnement, montant et périodicité. Après la date de fin, un **sursis** s'applique (15 jours par défaut, modifiable pour chaque abonné) (statuts : actif → sursis → expiré, avec date de fin du sursis). Bouton **Renouveler** : enregistre le paiement (compté dans le chiffre d'affaires) et avance l'échéance. Les échéances à 7 jours ou en retard apparaissent sur le tableau de bord.
- **Dépenses** : par catégorie.
- **Export** : CSV par section, sauvegarde/restauration JSON complète, devise modifiable (FCFA par défaut).
- **Identité visuelle** : logo CISPOLstore en en-tête et comme icône ; couleurs de l'application tirées du logo (bleu marine #1E3F60, orange #D5522F, jaune #E5B044).

Pensez à faire une sauvegarde JSON régulièrement : les données ne sont que dans ce navigateur.

## Utiliser sur Android

L'application est une PWA : interface adaptée au téléphone (tableaux en cartes, boutons tactiles, numéros cliquables pour appeler), installable sur l'écran d'accueil et utilisable hors connexion.

1. Publier l'application sur une adresse https (le workflow `.github/workflows/pages.yml` la publie sur GitHub Pages après fusion sur `main` ; activer au préalable *Settings → Pages → Source : GitHub Actions*).
2. Ouvrir l'adresse dans **Chrome** sur Android → menu ⋮ → **Installer l'application** (ou *Ajouter à l'écran d'accueil*).

Les données restent sur chaque appareil (pas de synchronisation) : utiliser « Sauvegarde » / « Restaurer » pour les transférer d'un appareil à l'autre.
