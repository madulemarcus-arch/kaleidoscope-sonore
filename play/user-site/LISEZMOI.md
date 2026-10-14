# Dépôt « madulemarcus-arch.github.io » (site racine)

Android vérifie le lien entre l'application du Play Store et le site web grâce au fichier
`https://madulemarcus-arch.github.io/.well-known/assetlinks.json`. Ce fichier doit se trouver à la **racine** du site,
donc dans un dépôt GitHub spécial nommé exactement `madulemarcus-arch.github.io`.

Contenu à y mettre :

- `.nojekyll` (sinon GitHub Pages cache le dossier `.well-known`)
- `index.html` (redirige vers CISPOLstore Manager)
- `.well-known/assetlinks.json` : le modèle `assetlinks.json.modele` rempli avec les **vraies empreintes SHA-256**
  (voir `../README.md`, étape 4). Tant que ce fichier n'existe pas, l'application s'ouvre mais affiche une barre d'adresse.

Le même fichier servira plus tard à WiFi Zone Manager : on ajoutera simplement un deuxième bloc (autre `package_name`).
