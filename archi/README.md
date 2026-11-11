# Archi 2D

Logiciel de dessin de plans d'architecture, web installable (PWA), hors connexion, sans dépendance ni build. Étape 1 d'un projet plus large : plan 2D → modèle 3D automatique → rendu → dimensionnement (BAEL).

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
| H | Tout voir |
| Suppr, Ctrl+Z, Ctrl+Y, Ctrl+A, Ctrl+S | Supprimer, annuler, rétablir, tout sélectionner, enregistrer |

Molette = zoom ; clic droit, clic milieu ou Espace + glisser = déplacer la vue ; deux doigts = zoom et déplacement sur tablette.

## Modèle de données (prêt pour la 3D)

Mètres, y vers le haut. Chaque mur porte `th` (épaisseur) et `h` (hauteur) ; portes et fenêtres référencent leur mur (`wall`, `pos`, `w`, `h`, `sill`). Le plan est enregistré automatiquement dans le navigateur et exportable en `.archi.json`, en DXF (millimètres, un calque DXF par calque) et en PNG.

## Étapes suivantes

1. Vue 3D automatique à partir des murs et ouvertures. 2. Matériaux, mobilier, lumière, rendu. 3. Pré-dimensionnement BAEL (descente de charges, poutres, poteaux, dalles, fondations), à valider par un ingénieur.
