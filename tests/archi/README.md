# Tests d'Archi 2D

Contrôles statiques (`00-static`) puis parcours dans Chromium (dessin, édition, import/export, mobile).

```bash
cd tests && npm install && npx playwright install chromium && node archi/run.js
node archi/run.js draw      # seulement les tests dont le nom contient « draw »
```

Aucune donnée réelle : les plans de test sont dessinés par le script.
