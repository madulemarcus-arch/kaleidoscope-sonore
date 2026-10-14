# Tests de CISPOLstore Manager

Deux niveaux, lancés ensemble par `run.js` :

- **`00-static.test.js`** (sans navigateur) : syntaxe de chaque script, chaque `<script>` de `index.html` est mis en cache par `sw.js`, aucun fichier `js/` oublié, `CACHE` de `sw.js` égal à `cispolstore-<BUILD>` de `js/core.js`, manifeste valide.
- **`*.test.js`** (navigateur) : parcours complets dans Chromium avec Playwright (devis, factures, paiements, stock, rôles, relances, sauvegarde…). Chaque fichier ouvre l'application neuve, fabrique ses propres données et affiche `PASS` / `FAIL` par vérification.

## Lancer

```bash
cd tests
npm install                      # une seule fois
npx playwright install chromium  # une seule fois (ou CHROMIUM_PATH=/chemin/vers/chromium)
node run.js                      # tous les tests
node run.js quotes payments      # seulement les fichiers dont le nom contient ces mots
VERBOSE=1 node run.js backup     # tout afficher pour un test qui échoue
```

`run.js` sert le dossier `cispolstore/` sur un port libre et lance 3 tests en parallèle (`TEST_PARALLEL=n` pour changer, `TEST_TIMEOUT=ms` par fichier, 120 s par défaut). Code de sortie 0 = tout passe.

## Écrire un test

Copier un fichier existant (par ex. `quotes.test.js`) : `BASE_URL` vient de l'environnement, les données se créent avec `page.evaluate(() => App.db…)`, les dates se calculent avec `App.today()` / `App.addDays` pour que le test ne dépende pas du jour où il tourne. Pour importer une liste de clients, utiliser `fixtures.js` (données fictives). **Aucune donnée réelle de client dans les tests.**

## Intégration continue

`.github/workflows/tests.yml` lance `node run.js` sur chaque *push* vers `main` et chaque *pull request* qui touche `cispolstore/` ou `tests/`.
