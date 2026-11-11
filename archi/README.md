# Archi 2D

Logiciel de dessin de plans d'architecture, web installable (PWA), hors connexion, sans dépendance ni build. Projet en étapes : plan 2D (fait) → vue 3D automatique (fait) → rendu → dimensionnement (BAEL).

## Lancer

Ouvrir `archi/index.html` dans un navigateur récent, ou `python3 -m http.server 8000` à la racine puis http://localhost:8000/archi/.

## Outils et raccourcis

| Touche | Outil / action |
|---|---|
| V | Sélection : glisser pour déplacer, poignées carrées pour étirer (les murs voisins suivent) |
| M | Mur (chaîné ; tapez une longueur puis Entrée) |
| L | Ligne |
| R | Pièce rectangulaire (4 murs ; tapez `4x3` puis Entrée) |
| D / F | Porte / Fenêtre (X : inverser le côté) |
| C | Cote (3 clics : deux points, puis la ligne de cote) |
| T | Texte |
| O / G / S | Orthogonal / Grille / Accrochage aux points (Maj : orthogonal temporaire) |
| H | Tout voir (en 3D : vue isométrique) |
| 2 / 3 | Passer en dessin 2D / en vue 3D (en 3D : T = vue de dessus, Échap = retour au 2D) |
| Suppr, Ctrl+Z, Ctrl+Y, Ctrl+A, Ctrl+S | Supprimer, annuler, rétablir, tout sélectionner, enregistrer |

Molette = zoom ; clic droit, clic milieu ou Espace + glisser = déplacer la vue ; deux doigts = zoom et déplacement sur tablette.

## Modèle de données (prêt pour la 3D)

Mètres, y vers le haut. Chaque mur porte `th` (épaisseur) et `h` (hauteur) ; portes et fenêtres référencent leur mur (`wall`, `pos`, `w`, `h`, `sill`). Le plan est enregistré automatiquement dans le navigateur et exportable en `.archi.json`, en DXF (millimètres, un calque DXF par calque) et en PNG.

## Vue 3D

Le bouton « 3D » (ou la touche 3) construit le bâtiment à partir du plan : chaque mur prend son épaisseur et sa hauteur, les portes et fenêtres percent le mur (allège et hauteur respectées), les fenêtres reçoivent une vitre, et une dalle est posée sous le plan. Glisser = tourner, Maj ou clic droit + glisser = déplacer, molette ou deux doigts = zoom. Boutons : isométrique, dessus, face, image PNG. Le maillage est produit par `js/mesh.js` (testable seul), le rendu WebGL par `js/view3d.js`. Le plan 2D reste la seule source : toute modification se répercute dans la 3D.

## Étapes suivantes

1. Matériaux, toiture, mobilier, lumière, rendu. 2. Pré-dimensionnement BAEL (descente de charges, poutres, poteaux, dalles, fondations), à valider par un ingénieur.
