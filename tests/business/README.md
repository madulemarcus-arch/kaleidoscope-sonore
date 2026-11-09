# Tests de CISPOLstore Business

```bash
cd tests && npm install && npx playwright install chromium && node business/run.js
node business/run.js wizard money   # seulement les fichiers dont le nom contient un de ces mots
```

Un fichier `*.test.js` par fonctionnalité ; `00-static` vérifie `BUILD` = `CACHE`, la liste des fichiers de `index.html` et `sw.js`, le manifeste. Données fictives uniquement. Sans Playwright 1.56 : `CHROMIUM_PATH=/chemin/vers/chrome`.
