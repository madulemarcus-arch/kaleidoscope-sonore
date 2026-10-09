# WiFi Zone Manager

Application web installable (PWA) pour gérer **WiFi Zone** : ventes de tickets, dépenses, clôture du jour et rapport du mois. Un seul fichier `index.html`, sans serveur, sans dépendance, utilisable hors connexion. Elle est indépendante de CISPOLstore Manager (autres données, autre icône) et de `caisse-simple/` / `caisse-locale/`.

Adresse une fois publiée : `https://madulemarcus-arch.github.io/kaleidoscope-sonore/wifizone/`. Sur Android : menu du navigateur → « Installer l'application ».

## Lancer en local
`python3 -m http.server 8000` dans ce dossier, puis http://localhost:8000. Pas de tests automatisés : vérifier à la main.

## Écrans
| Onglet | Rôle |
|---|---|
| 🏠 Accueil | Ventes, dépenses et bénéfice (aujourd'hui, 7 jours, mois), par forfait et par mode de paiement |
| 🎫 Vendre | Choisir le forfait, la quantité et le mode (Cash, M-Pesa, Airtel Money…), enregistrer ; liste des ventes du jour (✕ pour corriger) |
| 💸 Dépenses | Abonnement Starlink, électricité, salaire… en FC ou en $ (le taux du jour est figé dans chaque dépense) |
| 🌙 Clôture | Cash attendu en caisse, cash compté, écart, note ; envoi WhatsApp, copie, impression |
| 📊 Rapport | Mois par mois : par forfait, par catégorie de dépense, jour par jour ; WhatsApp, CSV, impression |
| ⚙️ Réglages | Nom, taux 1 $ = … FC, forfaits et prix (ajout, modification, suppression), **code PIN**, sauvegarde / restauration |

## Règles
- Les ventes sont en francs (FC). Le bénéfice s'affiche aussi en dollars au taux du jour.
- Le cash attendu = ventes en Cash − dépenses payées en Cash, par devise.
- Les données sont dans le navigateur de l'appareil (`localStorage`, clé `wifizone-v1`). **Faites une sauvegarde régulière** (Réglages) : l'accueil le rappelle après 3 jours.
- Forfaits par défaut (repris de `caisse-locale`) : Visiteur 6 h 500 FC, Jour 24 h 1 000 FC, Semaine 7 j 7 000 FC, Mois 30 j 30 000 FC.

## Code PIN

Réglages → Sécurité → **Créer un code PIN** (4 chiffres, saisi deux fois). L'application demande le code à l'ouverture et se reverrouille quand on la quitte (dès la sortie, après 2 min ou 10 min, au choix) ; bouton **🔒 Verrouiller** pour le faire à la main. Après 5 erreurs, attente de 30 secondes. Le code est stocké sous forme d'empreinte (SHA-256 avec sel), jamais en clair, et **n'est pas inclus dans les sauvegardes** : restaurer une sauvegarde garde le code de l'appareil. Changer ou supprimer le code demande le code actuel. **Code oublié** : seule issue, effacer les données de l'application sur l'appareil puis restaurer la dernière sauvegarde. Le code protège l'accès à l'écran, pas le contenu du stockage du navigateur.

## Code
Palette identique aux outils WiFi (`caisse-locale`) : marine #0a1f44, bleu #1b5fc1, forfaits vert / bleu / orange / violet.
Section `views.*` (écrans), `A` (actions), `db` (données), `modal`. Commentaires en anglais, textes en français. Incrémenter `CACHE` dans `sw.js` à chaque modification de l'application.
