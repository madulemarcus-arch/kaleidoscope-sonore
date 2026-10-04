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
