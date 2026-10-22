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

## NZIMBU (`nzimbu/index.html`)

Application personnelle indépendante (page `index.html`, animations dans `fx.js`, fichiers d'installation hors ligne). Les montants sont saisis en dollars (USD) et convertis automatiquement en francs congolais (taux en ligne, modifiable à la main). Fonctions : suivi des entrées et sorties avec bilan et graphique mois par mois, dettes (« je dois » / « on me doit ») avec remboursements partiels, et répartition 50-30-20 (besoins / envies / épargne et dettes) avec catégories de dépenses personnalisables, rappels d'échéance des dettes taux de change propre à chaque opération rappel de sauvegarde et code secret à 4 chiffres, avec un ciel doré animé, des compteurs et des confettis (réglage Animation : normale, calme ou aucune) (verrouillage de l'écran, sans chiffrement des données). Les données restent dans le navigateur (`localStorage`), avec export/import JSON. Installable sur téléphone et utilisable hors ligne (à servir en https ou sur localhost).
