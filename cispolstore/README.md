# CISPOLstore – Gestion

Application de gestion d'entreprise (un seul fichier `index.html`, sans dépendance, sans build). Les données sont stockées dans le navigateur (`localStorage`).

## Lancer

Ouvrir `cispolstore/index.html` dans un navigateur, ou `python3 -m http.server 8000` puis http://localhost:8000/cispolstore/.

## Fonctions

- **Tableau de bord** : CA, marge, dépenses, bénéfice net du mois, créances, valeur du stock, graphique 6 mois, alertes de stock bas, meilleures ventes.
- **Produits & stock** : catalogue (Starlink, routeurs/WiFi, accessoires, abonnements, services), prix d'achat/vente, seuil d'alerte.
- **Ventes** : panier multi-articles, client, paiement partiel, encaissement des restes à payer, reçu imprimable, décrémentation automatique du stock.
- **Clients** : fiche, historique d'achats, montant dû.
- **Dépenses** : par catégorie.
- **Export** : CSV par section, sauvegarde/restauration JSON complète, devise modifiable (FCFA par défaut).

Pensez à faire une sauvegarde JSON régulièrement : les données ne sont que dans ce navigateur.
