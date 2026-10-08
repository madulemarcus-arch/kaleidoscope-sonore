# Caisse locale CISPOLstore — contexte du projet

Ce fichier est lu à chaque séance. Il décrit le métier, le réseau, les règles des tickets,
les pièges déjà rencontrés et la suite du travail. **Lis-le en entier avant de toucher au code.**

Langue : réponds et écris l'interface **en français simple**. Le gérant n'est pas développeur :
explique chaque étape concrète (où cliquer, quelle commande taper), une commande à la fois.

---

## 1. Le métier

- **CISPOLstore** (Kinshasa, RDC) vend des kits Starlink et exploite une **WiFi Zone** payante.
- Les clients achètent un **ticket** (un code) et se connectent au WiFi via un portail captif.
- Monnaie : **franc congolais (FC)**, affiché `1 000 FC` (espace des milliers, pas de décimales).
- Utilisateurs de la caisse : le **gérant** (propriétaire) et un ou plusieurs **vendeurs**.
- Contraintes du terrain : coupures de courant fréquentes, Internet par Starlink uniquement
  (peut tomber), vente surtout depuis des téléphones Android.

Forfaits actuels (prix modifiables par le gérant) :

| id | Nom      | Durée     | Prix      | Profil MikroTik | Couleur |
|----|----------|-----------|-----------|-----------------|---------|
| V  | Visiteur | 6 heures  | 500 FC    | `Visiteur-6H`   | vert    |
| J  | Jour     | 24 heures | 1 000 FC  | `Jour-24H`      | bleu    |
| S  | Semaine  | 7 jours   | 7 000 FC  | `Semaine-7J`    | orange  |
| M  | Mois     | 30 jours  | 30 000 FC | `Mois-30J`      | violet  |

Débit de tous les forfaits : `rate-limit=20M/100M` (montant/descendant).

## 2. Le réseau (site principal)

- Routeur : **MikroTik RB4011iGS+**, **RouterOS 7.24.4**, identité `CISPOLstore-WiFiZone`.
- `ether1` = WAN Starlink (DHCP, **CGNAT : pas d'IP publique**).
- `ether2`–`ether9` = `bridge-hotspot`, réseau clients **10.10.0.0/22**, passerelle `10.10.0.1`.
  Points d'accès WiFi en mode AP, réseau ouvert « MALWEKA WIFI zone » / « CISPOLstore ».
- `ether10` = réseau **ADMIN 192.168.88.0/24**, routeur `192.168.88.1`.
  **L'ordinateur de caisse est sur ether10 en 192.168.88.2** (bail DHCP statique).
- Hotspot : serveur `hotspot-cispol`, profil `hsprof-cispol`, nom DNS `wifi.cispol`,
  pages `hotspot/login.html` (portail CISPOLstore, connexion par code unique) et `hotspot/alogin.html`.
- Le **device-mode** a été passé en `advanced` avec `hotspot=yes` (obligatoire depuis RouterOS 7.17).
- Accès à distance : **Back To Home** (WireGuard), puis appli MikroTik ou Winbox sur 192.168.88.1.
- DNS statique `caisse.cispol` → 192.168.88.2. Walled garden + règle de pare-feu permettent aux
  téléphones du WiFi clients d'ouvrir `http://caisse.cispol:8080` sans ticket.

Second site (**ne pas modifier sans demande explicite**) : **MALWEKA**, RB951Ui-2HnD (mipsbe,
128 Mo RAM), RouterOS 7.21.3. Ses tickets sont gérés par **Wizone** (portail redirigé vers
server.wizone.net, utilisateurs hotspot avec `limit-uptime`). Ne jamais y installer les scripts du RB4011.

## 3. Règles des tickets (CRITIQUES)

Un ticket = un utilisateur `/ip hotspot user` sur le RB4011 :

- `name` = `password` = **le code**, en MAJUSCULES, 6 caractères : 1re lettre = forfait (V/J/S/M),
  puis 5 caractères de l'alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sans 0, O, 1, I).
- `profile` = le profil du forfait, `server` = `hotspot-cispol`.
- **Le champ `comment` doit rester VIDE à la création.** C'est le script `on-login` du profil qui
  y écrit `exp=<secondes epoch>` à la première connexion. Un commentaire non vide = ticket sans fin.
- La durée est **en temps réel** depuis la première connexion (pas du temps connecté) ;
  `limit-uptime` n'est **pas** utilisé sur le RB4011.

Automatismes déjà installés sur le routeur (ne pas les casser) :

- `on-login` de chaque profil : écrit `exp=` si le commentaire est vide, puis ferme les autres
  sessions et cookies du même code ayant une autre adresse MAC (gestion des MAC aléatoires).
- Profils : `shared-users=2` (volontaire : laisse la nouvelle connexion entrer avant que l'ancienne
  soit fermée), `keepalive-timeout=1m`.
- Script `cispol-expiration`, toutes les minutes : supprime les tickets dont `exp` est dépassé
  (ne fait rien si l'horloge est avant septembre 2026, c.-à-d. non synchronisée).
- Script `cispol-un-appareil`, toutes les 10 s : un seul appareil par code, garde le plus récent.
- Script `cispol-generer` : générateur de lots en ligne de commande (écrit `dernier-lot.txt`).
- Anti-partage : mangle `change-ttl set:1` vers les clients + raw prerouting drop TTL 63 et 127.

## 4. L'application actuelle (dans ce dossier)

Caisse **locale, hors ligne**, Node.js **18+ sans aucune dépendance npm** (l'installation
sur place se fait sans Internet fiable : garde zéro dépendance sauf raison forte, et demande d'abord).

- `server.js` : serveur HTTP + API JSON + stockage + client REST MikroTik.
- `public/index.html` : interface (une seule page, téléphone d'abord, polices système, thème clair/sombre).
- `public/imprimer.html` : planche A4 de 40 tickets (`?lot=<id>` charge un lot).
- `config.json` (créé depuis `config.exemple.json`) : PIN, forfaits, accès routeur. **Jamais commité.**
- `donnees/caisse.json` : toutes les données ; écriture atomique (fichier .tmp + rename) ;
  une copie par jour `sauvegarde-AAAA-MM-JJ.json`.
- `routeur-caisse.rsc` : préparation du routeur. `demarrer-caisse.bat` (Windows), `caisse.service` (Pi).
- `tests/` : faux MikroTik (`fake-mikrotik.js`, port 18080, `caisse`/`secret`), `config.test.json`,
  `test-api.js` (tests de bout en bout). Variables `CAISSE_CONFIG` et `CAISSE_DONNEES` pour les tests.

Modèle de données (`donnees/caisse.json`) :
`tickets[code] = {code, forfait, statut:"stock"|"vendu", source:"direct"|"imprime", lot, ajouteLe,
venduLe, vendeur, prix, client}`, `lots[] = {id, forfait, nombre, creeLe, par}`, `prix{id:FC}`.

API (cookie de session `caisse_sid`, rôles `gerant` / `vendeur`) :
`POST /api/connexion {pin}`, `POST /api/deconnexion`, `GET /api/etat`,
`POST /api/vendre {forfait, client}` (crée le code sur le routeur puis enregistre la vente),
`POST /api/vendre-imprime {code}` (fonctionne sans routeur), `POST /api/annuler {code}` (gérant ;
vente directe = suppression du code sur le routeur), `POST /api/lots {forfait, nombre}` (gérant),
`GET /api/lot?id=`, `POST /api/prix`, `GET /api/rapport?periode=jour|semaine|mois`,
`GET /api/export?periode=` (CSV ; `;` séparateur, BOM UTF-8 pour Excel), `GET /api/clients`,
`POST /api/clients/deconnecter {id}`, `GET /api/routeur`.

Accès au routeur : **API REST RouterOS** via le service `www` (HTTP, `http://192.168.88.1/rest/...`),
authentification Basic avec l'utilisateur `caisse` (groupe `caisse`, policy `read,write,api,rest-api`,
`address=192.168.88.0/24`). `www` est restreint à `192.168.88.0/24`.
REST : GET liste, PUT crée, PATCH modifie, DELETE supprime ; les valeurs reviennent en chaînes ;
`.id` du type `*1A`. Erreurs ≥ 400 avec `{error, message, detail}`.

## 5. Pièges déjà rencontrés (ne pas les reproduire)

1. **Import .rsc** : un bloc `{ ... }` multi-lignes comme valeur de propriété (`on-login={...}`)
   provoque `syntax error`. Toujours écrire ces valeurs en **chaîne entre guillemets**, une seule
   ligne, avec `\"` et `\$` échappés. Un import qui échoue n'applique **rien** (analyse avant exécution).
2. **Dates** : `:totime` ne relit pas une chaîne `[:timestamp]` (format `2961w05:12:49.13…`).
   Stocker les échéances en **secondes epoch** (`[:tonum [:timestamp]]`).
3. **Anti-partage** : en chaîne `forward`, le TTL est déjà décrémenté (64→63, 128→127) :
   une règle `ttl=equal:63` y bloque **tous** les clients. Ces règles vont en **raw/prerouting**.
4. **Device-mode** : sans `hotspot=yes`, le hotspot est `inactivated, not allowed by device-mode`.
5. Le dossier `hotspot/` n'est créé que par `/ip hotspot reset-html` (demande une confirmation `y`).
6. Le terminal Winbox perd des lignes quand on colle un long bloc : fournir des fichiers `.rsc`
   à importer, ou **une commande à la fois**.
7. **Mikhmon** écrit son propre commentaire dans les tickets → ils n'expireraient jamais. Ne pas l'utiliser tel quel.
8. Le **téléphone du vendeur** sur le WiFi clients est capturé par le portail : d'où le walled garden.
9. Fuseau horaire : forcer `time-zone-autodetect=no time-zone-name=Africa/Kinshasa`
   (la détection automatique se trompe avec l'IP Starlink).
10. Un **ordinateur portable** est conseillé comme serveur : batterie = onduleur, horloge à pile
    (un Raspberry Pi sans pile RTC perd l'heure hors ligne → ventes mal datées).

## 6. Règles de travail

- **Routeur réel : lecture d'abord.** Avant toute écriture sur le vrai RB4011, teste
  `GET /rest/system/identity` et montre le résultat. **Demande toujours l'accord du gérant**
  avant une commande qui crée, modifie ou supprime quelque chose sur le routeur réel,
  et ne touche jamais aux scripts, profils, pare-feu ou au hotspot existants sans accord explicite.
- Développe et teste d'abord contre `tests/fake-mikrotik.js` ; ajoute au faux routeur ce qui manque.
- Après chaque changement : `node tests/test-api.js` doit passer ; ajoute un test par nouvelle fonction.
- Garde l'interface en français, téléphone d'abord, gros boutons, aucun chargement depuis Internet
  (pas de CDN, pas de Google Fonts) : la caisse doit marcher hors ligne.
- Ne casse pas le format de `donnees/caisse.json` : si tu le fais évoluer, écris une migration
  au démarrage et garde une copie avant migration.
- Mets à jour `LISEZ-MOI.txt` à chaque changement visible par le gérant.
- Ne mets jamais de mot de passe ou de PIN réel dans le code, les tests ou les commits.

## 7. Feuille de route (dans cet ordre, valider chaque étape avec le gérant)

1. **Mise en service réelle** : aider à installer sur l'ordinateur de caisse, tester contre le vrai
   RB4011 (identité → liste des clients → création d'UN ticket de test puis suppression),
   corriger ce qui diffère du faux routeur (droits du groupe `caisse`, format des réponses).
2. **Clôture de caisse journalière** : le vendeur saisit l'argent compté ; la caisse compare au total
   attendu, enregistre l'écart, et bloque la journée (consultable par le gérant).
3. **Gestion des vendeurs dans l'interface** (gérant) : ajouter/retirer un vendeur, changer un PIN,
   sans éditer `config.json` à la main. PIN stockés hachés (scrypt de Node, avec sel).
4. **Journal d'audit** : qui a vendu, annulé, créé un lot, changé un prix, avec l'heure.
5. **Application installable (PWA)** : manifeste + service worker servis par la caisse, icône à
   l'écran d'accueil, page « caisse injoignable » claire si le Wi-Fi coupe.
6. **Synchronisation facultative** vers un stockage en ligne quand Internet revient
   (rapport consultable à distance) — à discuter avant de commencer ; la caisse reste maître.
7. **Multi-sites** (plus tard) : un fichier de configuration par routeur, sans jamais toucher MALWEKA
   sans accord.

## 8. Commandes utiles

```bash
node server.js                         # démarrer la caisse (port 8080 par défaut)
node tests/test-api.js                 # tests de bout en bout (faux MikroTik + caisse)
node tests/fake-mikrotik.js            # faux routeur seul, port 18080
CAISSE_CONFIG=tests/config.test.json node server.js   # caisse branchée sur le faux routeur (port 18090)
```
