# Archi 2D

Logiciel de dessin de plans d'architecture, web installable (PWA), hors connexion, sans dépendance ni build. Projet en étapes : plan 2D (fait) → vue 3D automatique (fait) → rendu : matériaux, toiture, mobilier, soleil (fait) → dimensionnement BAEL (fait) → plans de ferraillage (fait).

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
| U | Meuble (choisir le type en haut, cliquer pour poser, X : tourner de 90°) |
| P / B | Poteau / Poutre dessinée à la main (les poutres sous les murs se déduisent des poteaux) |
| T | Texte |
| O / G / S | Orthogonal / Grille / Accrochage aux points (Maj : orthogonal temporaire) |
| H | Tout voir (en 3D : vue isométrique) |
| 2 / 3 / 4 | Passer en dessin 2D / vue 3D / plans de ferraillage (en 3D : H = isométrique, T = dessus ; Échap = retour au 2D) |
| Suppr, Ctrl+Z, Ctrl+Y, Ctrl+A, Ctrl+S | Supprimer, annuler, rétablir, tout sélectionner, enregistrer |

Molette = zoom ; clic droit, clic milieu ou Espace + glisser = déplacer la vue ; deux doigts = zoom et déplacement sur tablette.

## Modèle de données (prêt pour la 3D)

Mètres, y vers le haut. Chaque mur porte `th` (épaisseur) et `h` (hauteur) ; portes et fenêtres référencent leur mur (`wall`, `pos`, `w`, `h`, `sill`). Le plan est enregistré automatiquement dans le navigateur et exportable en `.archi.json`, en DXF (millimètres, un calque DXF par calque) et en PNG.

## Vue 3D

Le bouton « 3D » (ou la touche 3) construit le bâtiment à partir du plan : chaque mur prend son épaisseur et sa hauteur, les portes et fenêtres percent le mur (allège et hauteur respectées), les fenêtres reçoivent une vitre, et une dalle est posée sous le plan. Glisser = tourner, Maj ou clic droit + glisser = déplacer, molette ou deux doigts = zoom. Boutons : isométrique, dessus, face, image PNG. Le maillage est produit par `js/mesh.js` (testable seul), le rendu WebGL par `js/view3d.js`. Le plan 2D reste la seule source : toute modification se répercute dans la 3D.

## Rendu (matériaux, toiture, mobilier, soleil)

- **Mobilier** : lit, table, chaise, canapé, armoire, bureau, plan de cuisine, lavabo, WC, douche, baignoire (calque « Mobilier »). Posés en 2D (outil U), déplaçables, avec largeur, profondeur, hauteur et rotation modifiables dans le panneau.
- **Matériaux** : un matériau par défaut pour tous les murs (crépi, brique, pierre, bois, béton, peinture) et un matériau propre à chaque mur (en 2D, panneau Propriétés). Le sol se choisit dans le panneau de rendu (carrelage, parquet, béton).
- **Toiture** : aucune, toit plat (dalle de 20 cm) ou deux pentes (faîtage dans le sens de la plus grande dimension), avec pente, débord et matériau (tuile, tôle, ardoise, dalle). La toiture couvre le rectangle englobant des murs ; mettez « Aucune » pour voir l'intérieur.
- **Soleil** : curseur d'heure de 6 h à 18 h (l'est est à droite du plan, le nord vers le haut) et ombres portées sur le sol, les meubles et le terrain.
- **Image HD** : export PNG de la 3D au double de la taille de l'écran.

Les réglages de rendu sont enregistrés avec le plan (`doc.render`). Les murs d'un plan ancien reçoivent des valeurs par défaut à l'ouverture.

## Dimensionnement BAEL (pré-dimensionnement)

Pour une structure poteaux-poutres-dalles en béton armé avec remplissage en maçonnerie. Le panneau « Structure (BAEL) » (à droite, en 2D) regroupe les données et les boutons.

1. **Poteaux** : « Placer les poteaux automatiquement » les pose aux coins et extrémités des murs et le long des murs longs (portée maximale réglable, 4,5 m par défaut), ou outil Poteau (P).
2. **Poutres** : déduites des poteaux alignés sur un mur ; poutres supplémentaires avec l'outil Poutre (B) entre deux poteaux. Des poutres alignées qui se rejoignent sur un poteau forment une **poutre continue** (une seule section pour toute la file).
3. **Dalles** : chaque rectangle fermé par des poutres est un panneau (les côtés peuvent comporter plusieurs poutres).
4. **Données** : béton fc28, acier FeE400/500, contrainte admissible du sol, nombre de niveaux, plancher haut (dalle terrasse ou charpente légère), usage (Q), revêtements (G). Maçonnerie : 2,8 kN/m² de mur, réduite des ouvertures.
5. **Calculer** : le plan se couvre des sections (poteaux, poutres), de l'épaisseur des dalles et des semelles (pointillés). « Appliquer les sections aux poteaux » les reporte dans le modèle et la 3D. « Note de calcul » produit un fichier HTML imprimable (hypothèses, tableaux, remarques).

**Ce que le calcul fait (BAEL 91 révisé 99, ELU et ELS)** : combinaisons 1,35 G + 1,5 Q et G + Q. Dalles : épaisseur minimale (lx/40 ou lx/30, au moins 12 cm) puis vérification en flexion et à l'effort tranchant, moments par l'annexe E3 (ν = 0), armatures de travée et de chapeaux. Poutres : charges équivalentes des dalles (triangle, trapèze), poids propre et maçonnerie ; poutres continues par la **méthode forfaitaire** (BAEL B.6.2,21 : appuis de rive 0,15 M0, appui central 0,6 M0 pour 2 travées, 0,5 puis 0,4 M0 au-delà, moments de travée par Mt + (Mw + Me)/2 ≥ max(1,05 ; 1 + 0,3α) M0, tranchant majoré de 10 ou 15 % sur le premier appui intermédiaire) quand Q ≤ 2G et que les portées voisines sont dans un rapport de 0,8 à 1,25, sinon par la **méthode de Caquot** (B.6.2,22 : portées fictives l' = L ou 0,8 L, travée chargée et voisines à 1,35 G) ; section la plus petite qui passe en flexion simple (travée et appuis) sans armatures comprimées et au cisaillement, cadres HA6. Les réactions aux poteaux viennent de cette analyse (continuité comprise).

**Descente de charges par niveau** : le nombre de niveaux (planchers) est un paramètre ; le dernier plancher est la toiture (dalle terrasse ou charpente légère), les autres sont des planchers courants identiques. Pour chaque poteau, du haut vers le bas, le calcul additionne au pied de chaque niveau les réactions des poutres de ce niveau (parts permanente G et d'exploitation Q séparées : les réactions sont linéaires en fonction des charges, donc la part G vaut la réaction à vide divisée par 1,35 et la part Q la réaction due aux seules charges d'exploitation divisée par 1,5) et le poids propre du tronçon de poteau avec sa propre section. Les charges d'exploitation des planchers sont cumulées avec la **loi de dégression NF P06-001** : Q0 + (3 + n)/(2n) · (Q1 + … + Qn) pour n ≥ 5 planchers sous la toiture (par exemple 0,8 pour n = 5, 0,65 pour n = 10), sans réduction en dessous ; la case « Dégression des charges d'exploitation » du panneau Structure la désactive. La section de chaque niveau est choisie par la vérification B.8.4 sur la charge cumulée de son pied et n'est jamais inférieure à celle du niveau supérieur (poteaux en escalier). Nu = 1,35 ΣG + 1,5 ΣQ et Ns = ΣG + ΣQ au pied du niveau du bas servent aux fondations. Le tableau complet est dans la note de calcul (section 4) et dans la vue « Descente de charges » du mode Ferraillage. Poteaux : méthode forfaitaire B.8.4 (élancement, flambement, armatures minimale et maximale). Semelles isolées carrées : surface selon le sol, hauteur et aciers par la méthode des bielles (maximum ELU et ELS fissuration préjudiciable). **Semelles filantes** sous une file de poteaux alignés : choisies automatiquement quand deux semelles isolées voisines laissent moins de 25 cm entre elles (menu « Fondations » : automatique, toujours isolées ou toujours filantes). La semelle est centrée sur la résultante des charges de service (pression du sol uniforme), longue de deux fois la distance à la résultante plus 25 cm de débord ; sa largeur vient de 1,1·Ns/(σ·L) (au moins a + 30 cm). Sens longitudinal : poutre continue renversée (méthode forfaitaire ou Caquot ; débords en console), aciers inférieurs sous les poteaux et supérieurs entre eux. Sens transversal : deux consoles de (B − 25 cm)/2, hauteur par la méthode des bielles puis vérifiée au cisaillement (τu ≤ 0,07 fc28/γb, sans armatures d'effort tranchant). Aciers = max(ELU, ELS fissuration préjudiciable, section minimale). Un poteau commun à deux semelles qui se croisent répartit sa charge au prorata des réactions de ses poutres ; le détail du nœud d'angle reste à étudier. **Radier nervuré** : retenu automatiquement quand les semelles isolées couvriraient au moins la moitié de l'emprise du bâtiment (sol faible, charges fortes), ou à la demande (menu « Fondations » : Radier nervuré) ; il demande au moins un panneau de dalle fermé par des poutres, sinon le calcul revient aux semelles avec un avertissement. Dalle rectangulaire centrée sur la résultante des charges de service, débordant de 0,5 m (augmenté par pas de 25 cm, jusqu'à 3 m, tant que la pression du sol dépasse l'admissible) ; pression nette ELU qu = ΣNu / S (le poids propre du radier est repris directement par le sol, la pression de service l'inclut). Il est calculé comme un plancher renversé : panneaux de dalle par l'annexe E3 (épaisseur ≥ lx/20 et ≥ 20 cm, flexion et cisaillement), nervures sous les files de poutres en poutres continues (forfaitaire ou Caquot, charges équivalentes des panneaux et du débord, section ≥ 30 × 40 cm, hauteur ≥ L/8 et ≥ dalle + 20 cm), console de débord. Aciers de travée en face supérieure, chapeaux sur nervures en face inférieure.

**Limites** : pré-dimensionnement seulement, à vérifier et valider par un ingénieur structure avant toute exécution. Non traités : séisme, vent, poinçonnement, flèche des poutres, charges concentrées sur les poutres, nœuds poutre-poteau (moments transmis aux poteaux), dégression des charges d'exploitation, poinçonnement des poteaux sur le radier, tassements différentiels, soulèvement et étanchéité du radier, semelles filantes sous murs porteurs sans poteaux (les chevauchements de semelles filantes parallèles sont signalés), charpente, escaliers, balcons, sol multicouche. Cadre rectangulaire seulement pour les dalles.

**Nœuds poutre-poteau** : une poutre qui s'arrête sur un poteau sans poutre alignée de l'autre côté (poteau de rive ou d'angle) lui transmet son moment d'appui de rive (0,15 M0 en forfaitaire ou en Caquot) ; réparti par moitié entre le poteau au-dessus et le poteau au-dessous de chaque plancher, en totalité vers le premier poteau sous la toiture ; deux poutres perpendiculaires (angle) donnent une flexion déviée, traitée par l'excentricité équivalente e0 = e_grand + 0,7·e_petit. Ces poteaux sont calculés en **flexion composée** par l'équilibre de la section (béton parabole-rectangle, acier bilinéaire, pivots B et C, deux lits d'acier, minimum de section par dichotomie), avec l'excentricité additionnelle ea = max(2 cm ; l0/250) et le second ordre e2 = 3·lf²·(2 + α·φ)/(10⁴·h), φ = 2 (BAEL A.4.3,5) ; la section retenue est la plus petite qui passe aussi en compression centrée (B.8.4). Les poteaux continus (poutres alignées des deux côtés) ne reçoivent pas de moment de rive, mais le **déséquilibre sous chargement alterné** : une travée chargée à 1,35 G + 1,5 Q et la voisine à 1,35 G ont des moments d'encastrement p·L²/12 différents ; le plus défavorable des deux cas, ΔM, est réparti entre les poutres et les poteaux (au-dessus et au-dessous du plancher) au prorata des rigidités I/L (une seule distribution, extrémités éloignées encastrées ; poutres : b·h³/12 / portée, poteaux : a⁴/12 / hauteur d'étage ; pas de poteau au-dessus sous la toiture). Pour un tronçon, le moment retenu est la plus forte des parts des deux planchers qui l'encadrent. Il s'ajoute au moment de rive éventuel de l'autre sens et passe dans la même flexion composée (excentricités additionnelle et du second ordre). **Ancrage** : les barres de poutre (inférieures, de montage, chapeaux) sont ancrées par crochet à 180° dans le poteau ; la longueur droite 0,4·ls (ls = Ø·fe/(4τs), τs = 0,6·ψs²·ft28) plus l'enrobage de 3 cm donne la largeur de poteau requise, arrondie à 5 cm ; l'insuffisance et le cas d'une poutre plus large que le poteau sont signalés par un avertissement, un tableau (note de calcul, section 4 bis) et un dessin du nœud. Pas d'agrandissement automatique : c'est à vous de réduire le diamètre, d'élargir le poteau ou de prévoir des barres en U.

## Plans de ferraillage

Après le calcul, le bouton « Ferraillage » (ou la touche 4) affiche, pour chaque élément, le plan d'armatures et son tableau de nomenclature :

- **Plan de repérage** : poteaux, poutres, semelles et dalles avec leurs repères et leurs sections.
- **Poutres** : coupe longitudinale (barres inférieures, montage, chapeaux sur chaque appui, cadres, moments d'appui et de travée, rappel de la continuité) et coupes en travée et sur appui. Un chapeau sur un appui intermédiaire se poursuit dans la travée voisine (seule sa part est comptée), un chapeau de rive est ancré par un crochet.
- **Nœuds** : un dessin par poteau de rive ou d'angle (et, pour un poteau continu, un dessin avec le déséquilibre ΔM et sa part reprise ; poteau, tronçon de poutre, barres inférieures et supérieures traversant le poteau et se retournant en crochet, cadres dans le nœud, vérification de l'ancrage en rouge ou en vert, moment transmis et aciers de flexion composée) et un tableau d'ancrage.
- **Poteaux** : élévation avec la semelle (barres, équerre de pied, cadres) et coupe transversale (barres réparties dans le carré). Pour un bâtiment à plusieurs niveaux, la nomenclature compte un tronçon par niveau (barres avec recouvrement de ls au niveau supérieur, cadres, section propre) et le métré compte le béton de tous les niveaux ; le dessin montre le tronçon du rez-de-chaussée.
- **Semelles** : vue en plan du quadrillage et coupe ; pour une semelle filante, plan, coupe longitudinale (aciers inférieurs et supérieurs, équerres) et coupe transversale.
- **Radier** : plan d'ensemble (panneaux, nervures, poteaux, débord), un dessin par nervure (dessinée retournée, comme une poutre) et par panneau de dalle (lit supérieur de travée, chapeaux inférieurs), avec nomenclature ; le métré compte le radier à part.
- **Dalles** : vue en plan des lits inférieurs dans les deux sens et des chapeaux sur appuis.
- **Nomenclature et métré** : béton (m³), acier (kg) et ratio kg/m³ par ouvrage, longueurs et poids par diamètre.

« Exporter tous les plans » produit un fichier HTML (une page par élément, format A4 paysage) à ouvrir et imprimer en PDF depuis le navigateur. Les plans sont périmés (bandeau d'alerte) dès que le plan 2D change : un bouton relance le calcul.

Conventions : enrobage 3 cm (5 cm pour les semelles, sur béton de propreté de 5 cm) ; crochet à 180° développé 20 Ø, équerre 12 Ø, crochets de cadres 10 Ø ; scellement droit ls = Ø fe / (4 τs), τs = 0,6 ψs² ft28 ; chapeaux de poutre sur 0,25 L, de dalle sur 0,2 de la portée ; poids 0,00617 Ø² kg/m. Les plans sont des plans de principe tirés du pré-dimensionnement : ni détail des nœuds, ni arrêts de barres, ni pertes de façonnage ; à vérifier et valider par un ingénieur structure.

## Étapes suivantes

1. Flèche des poutres, moments des nœuds par une analyse de portique complète (rigidités réelles, plusieurs distributions), poinçonnement et radier plat (dalle champignon), charges différentes par niveau.
