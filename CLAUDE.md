# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

Kaléidoscope sonore : page web interactive où le tracé à la souris/au doigt est reproduit en symétrie radiale et joue des notes (gamme pentatonique). Tout le projet tient dans `index.html` (HTML + CSS + JS inline), sans dépendance externe, sans build, sans tests ni linter.

## Lancer

- Ouvrir `index.html` directement dans un navigateur récent, ou servir le dossier : `python3 -m http.server 8000` puis http://localhost:8000.
- Pas de suite de tests : vérifier manuellement dans le navigateur (dessin, son, raccourcis, redimensionnement de la fenêtre, export PNG).

## Architecture (`index.html`)

Le script est une IIFE découpée en sections commentées `// ---------- X ----------`, qui partagent un seul objet `state` (sym, size, rainbow, mirror, sound, color, hue, drawing, last, drawn) :

- **Canvas** : le contexte est mis à l'échelle par `dpr` (plafonné à 2), donc tout le dessin se fait en pixels CSS (`W`, `H`). `resize()` recopie l'ancien bitmap en pixels physiques pour garder le dessin centré ; `clearCanvas()` réinitialise temporairement la transformation. `strokeSymmetric()` translate au centre, fait tourner chaque segment `state.sym` fois (et ajoute le reflet en inversant y si `mirror`), puis trace le tout en un seul `stroke()` avec `globalCompositeOperation = 'lighter'` (effet lumineux par addition).
- **Sound** : l'`AudioContext` est créé à la demande au premier `pointerdown` (politique d'autoplay des navigateurs), avec un gain maître et un delay à rétroaction. `playNote()` est limité à une note toutes les 70 ms ; la distance au centre donne l'une des 15 notes (3 octaves pentatoniques à partir de sol 3, 196 Hz) ; le décalage horizontal `dx` donne le panoramique stéréo ; si `size > 10`, l'oscillateur passe en `triangle`.
- **Input** : Pointer Events (souris + tactile, `setPointerCapture`). L'épaisseur du trait diminue avec la vitesse ; la teinte arc-en-ciel avance à chaque mouvement.
- **Controls** : `toggle(btnId, stateKey)` synchronise `state` et `aria-pressed` (le CSS stylise les boutons actifs via `aria-pressed`). Choisir une couleur fixe désactive l'arc-en-ciel. Les raccourcis clavier sont ignorés quand le focus est dans un `<input>`.

## Points à garder synchronisés

- La couleur de fond `#07070d` est codée en dur à trois endroits : la variable CSS `--bg`, `resize()` et `clearCanvas()`.
- Les raccourcis clavier (C, S, M, 2–9) sont décrits à quatre endroits : le gestionnaire `keydown`, le texte d'accueil `#hint`, les `title` des boutons et le tableau du `README.md`.
- Les bornes des réglages (symétrie 2–16, pinceau 1–20) sont fixées dans les attributs `min`/`max` des `<input type=range>` et reprises dans le README.

## Conventions

- Textes de l'interface, README et messages de commit en **français** ; commentaires du code en **anglais**.
- Style JS compact : `const $ = id => document.getElementById(id)`, plusieurs instructions courtes par ligne, aucun framework.

## CISPOLstore Manager (`cispolstore/`) : tests

- Les tests automatiques sont dans `tests/` (voir `tests/README.md`) : `cd tests && npm install && npx playwright install chromium && node run.js`. Ils tournent aussi sur GitHub (`.github/workflows/tests.yml`) à chaque push / pull request.
- À chaque version : `CACHE` dans `cispolstore/sw.js` et `App.BUILD` dans `cispolstore/js/core.js` doivent rester égaux, et tout nouveau fichier `js/` doit être ajouté à `index.html` ET à la liste `FILES` de `sw.js` (le test statique le vérifie).
- Pas de données réelles de clients dans les tests : utiliser `tests/fixtures.js`.
- Publication Android : `play/` (guide, fiche du Play Store, captures générées avec des données fictives). Le manifeste, `privacy.html` et les raccourcis `?go=<écran>` de `cispolstore/` sont vérifiés par les tests.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

## CISPOLstore Business (`business/`) : application générale

- Application de gestion générale (tous secteurs), même esprit que `cispolstore/` mais sans rien de Starlink. Tests : `cd tests && node business/run.js` (voir `tests/business/README.md`), workflow `.github/workflows/tests-business.yml`.
- Mêmes règles : `CACHE` dans `business/sw.js` = `App.BUILD` dans `business/js/core.js` ; tout nouveau fichier `js/` va dans `index.html` ET dans `FILES` de `sw.js` ; ne jamais changer `id` ni `start_url` du manifeste.
- Étapes : 1 socle (fait) · 2 clients (fait) · 3 stock/fournisseurs (fait) · 4 factures/paiements/impression (fait) · 5 finance/caisse/rapports (fait) · 6 profils/sauvegarde/synchro (fait ; Google Drive optionnel reporté) · 7 modules optionnels (fait).
- Règle de reprise : on reprend de CISPOLstore Manager les principes utiles à tous les secteurs (abonnements libres, coût reversé à un fournisseur, relances, impayés, clôture, rôles…) ; on laisse seulement ce qui est propre à Starlink (ACC, pénalités, kits, lecteur de courriels, décor).
- Design (identité reprise de CISPOLstore Manager) : palette marine `#12365d` / orange `#d5522f` / jaune `#e5b044`, police Inter (`business/fonts/`), en-tête en dégradé, menu du bas aux icônes bicolores animées (`js/icons.js`), héros « verre » avec ciel animé, anneau d'objectif et confettis (`js/fx.js`), clavier PIN rond. Les variables de couleur sont dans `:root` de `css/app.css` ; la marque est `icons/logo.svg` (les PNG de l'application en sont générés).

## Archi 2D (`archi/`) : plans d'architecture

- Logiciel de dessin 2D (murs, portes, fenêtres, cotes, calques, export DXF/PNG/JSON), PWA sans dépendance. Étapes prévues : 1 dessin 2D (fait) · 2 vue 3D automatique (fait : `js/mesh.js` + `js/view3d.js`, WebGL sans bibliothèque) · 3 rendu (fait : matériaux, toiture, mobilier, soleil et ombres portées par projection au sol avec pochoir ; réglages dans `doc.render`, complétés par `A.ensureDoc`) · 4 dimensionnement BAEL (fait : `js/struct.js`, poteaux/poutres/dalles/semelles isolées ; descente de charges par niveau (`result.columns[].levels` : parts G et Q des réactions séparées par linéarité, loi de dégression `S.degression`, sections non décroissantes vers le bas ; testée dans `tests/archi/descente.test.js`) ; radier nervuré (`S.raft` : plancher renversé sous la pression nette qu = ΣNu/S, choisi quand les semelles isolées couvrent ≥ 50 % de l'emprise ou par le paramètre `found`, testé à la main dans `tests/archi/raft.test.js`) ; semelles filantes sous les files de poteaux (`S.strip`, choix automatique selon l'espacement des semelles isolées ou paramètre `found`, testées à la main dans `tests/archi/strip.test.js`) ; poutres continues par files alignées (`S.chains`, `S.continuous` : forfaitaire sinon Caquot, testées à la main dans `tests/archi/continuous.test.js`) ; formules vérifiées à la main dans `tests/archi/struct.test.js` ; les résultats sont dans `doc.struct.result`, périmés dès que `S.sig` change). Pré-dimensionnement seulement : l'interface et la note de calcul rappellent qu'un ingénieur doit valider. Plans de ferraillage (fait : `js/rebar.js`, mode « Ferraillage » touche 4) : modèle des barres (`R.model`, longueurs et poids vérifiés à la main dans `tests/archi/rebar.test.js`), dessins SVG par élément, métré et export HTML ; conventions de crochets et d'enrobage écrites en tête de `rebar.js` et dans les notes des plans. Tests : `cd tests && node archi/run.js`, workflow `.github/workflows/tests-archi.yml`.
- Mêmes règles que les autres applications : `CACHE` dans `archi/sw.js` = `App.BUILD` dans `archi/js/core.js` ; tout nouveau fichier `js/` va dans `index.html` ET dans `FILES` de `sw.js` ; ne jamais changer `id` ni `start_url` du manifeste.
- Unités : mètres, y vers le haut ; l'export DXF est en millimètres. Les raccourcis (V, M, L, R, D, F, C, U, P, B, T, O, G, S, H, et 2/3/4 pour changer de mode) sont décrits dans `tools.js` (`A.TOOLS` et le gestionnaire `keydown`), `archi/README.md` et les `title` des boutons.
