# Kaléidoscope sonore

Une page web interactive : dessinez à la souris ou au doigt, le tracé est reproduit en symétrie radiale et chaque mouvement joue une note (gamme pentatonique).

## Lancer

Aucune installation : ouvrez `index.html` dans un navigateur récent.

## Commandes

| Touche | Action |
| ------ | ------ |
| `C` | Effacer le dessin |
| `S` | Enregistrer en PNG |
| `M` | Activer / couper le son |
| `2`–`9` | Choisir le nombre d'axes de symétrie |

Le panneau du bas permet aussi de régler la symétrie (2 à 16), la taille du pinceau, la couleur (arc-en-ciel ou fixe) et l'effet miroir.

## Fonctionnement du son

- Plus le tracé est proche du centre, plus la note est aiguë (3 octaves à partir de sol 3).
- La position horizontale règle le panoramique stéréo.
- Un pinceau épais (> 10) utilise un timbre triangle au lieu d'une sinusoïde.

## NZIMBU (`budget/index.html`)

Application personnelle indépendante, dans un seul fichier. Les montants sont saisis en dollars (USD) et convertis automatiquement en francs congolais (taux en ligne, modifiable à la main). Fonctions : suivi des entrées et sorties du mois, dettes (« je dois » / « on me doit ») avec remboursements partiels, et répartition 50-30-20 (besoins / envies / épargne et dettes). Les données restent dans le navigateur (`localStorage`), avec export/import JSON.
