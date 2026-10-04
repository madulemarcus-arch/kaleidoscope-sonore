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
  - *Gérés par nous* : prénom + nom, numéro de compte Starlink (ACC), adresse de l'installation, type d'abonnement, début et fin d'abonnement, montant et périodicité. Après la date de fin, un **sursis de 15 jours** s'applique (statuts : actif → sursis → expiré, avec date de fin du sursis). Bouton **Renouveler** : enregistre le paiement (compté dans le chiffre d'affaires) et avance l'échéance. Les échéances à 7 jours ou en retard apparaissent sur le tableau de bord.
- **Dépenses** : par catégorie.
- **Export** : CSV par section, sauvegarde/restauration JSON complète, devise modifiable (FCFA par défaut).
- **Logo et couleurs** : bouton « 🎨 Logo » — le logo s'affiche en en-tête et les couleurs de l'application sont reprises de l'image.

Pensez à faire une sauvegarde JSON régulièrement : les données ne sont que dans ce navigateur.
