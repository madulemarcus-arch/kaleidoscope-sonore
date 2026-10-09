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
| ⚙️ Réglages | Nom, taux 1 $ = … FC, forfaits et prix (ajout, modification, suppression), **synchronisation**, **code PIN**, sauvegarde / restauration |

## Règles
- Les ventes sont en francs (FC). Le bénéfice s'affiche aussi en dollars au taux du jour.
- Le cash attendu = ventes en Cash − dépenses payées en Cash, par devise.
- Les données sont dans le navigateur de l'appareil (`localStorage`, clé `wifizone-v1`). **Faites une sauvegarde régulière** (Réglages) : l'accueil le rappelle après 3 jours.
- Forfaits par défaut (repris de `caisse-locale`) : Visiteur 6 h 500 FC, Jour 24 h 1 000 FC, Semaine 7 j 7 000 FC, Mois 30 j 30 000 FC.

## Synchronisation entre téléphones

Réglages → **Synchronisation entre téléphones** → Configurer (ou le bouton ☁️ de l'en-tête). Plusieurs téléphones partagent les mêmes ventes, dépenses, clôtures, forfaits, nom et taux ; les modifications faites hors connexion sur plusieurs téléphones sont **fusionnées** enregistrement par enregistrement (rien n'est écrasé), y compris les suppressions. Le code PIN reste propre à chaque téléphone.

- **Même serveur que CISPOLstore Manager** : si la synchronisation de CISPOLstore Manager est déjà configurée, saisissez la même URL Supabase et la même clé publique, avec le **nom d'espace `wifizone`** (différent de celui de CISPOLstore) : aucun nouveau script SQL à exécuter. Sinon, suivre les 4 étapes affichées dans la fenêtre de configuration (script `sync/supabase.sql`, bouton « Copier le script SQL »).
- **Chiffrement** : tout est chiffré sur le téléphone (AES-GCM, clé dérivée de la phrase secrète, 8 caractères minimum) avant l'envoi ; Supabase ne stocke qu'un bloc illisible. **Notez la phrase secrète** : elle ne peut pas être récupérée.
- Sur chaque autre téléphone, saisir **exactement les mêmes 4 valeurs** (URL, clé, nom d'espace, phrase secrète). Un nom d'espace déjà utilisé avec une autre phrase est refusé.
- Synchronisation automatique 4 secondes après chaque modification, au retour dans l'application, au retour de la connexion et toutes les 90 secondes ; bouton « Synchroniser maintenant ». Le bouton ☁️ indique l'état (☁️ à jour, 🔄 en cours, 📴 hors connexion, ⚠️ erreur).
- Déconnecter garde toutes les données sur le téléphone.

## Code PIN

Réglages → Sécurité → **Créer un code PIN** (4 chiffres, saisi deux fois). L'application demande le code à l'ouverture et se reverrouille quand on la quitte (dès la sortie, après 2 min ou 10 min, au choix) ; bouton **🔒 Verrouiller** pour le faire à la main. Après 5 erreurs, attente de 30 secondes. Le code est stocké sous forme d'empreinte (SHA-256 avec sel), jamais en clair, et **n'est pas inclus dans les sauvegardes** : restaurer une sauvegarde garde le code de l'appareil. Changer ou supprimer le code demande le code actuel. **Code oublié** : seule issue, effacer les données de l'application sur l'appareil puis restaurer la dernière sauvegarde. Le code protège l'accès à l'écran, pas le contenu du stockage du navigateur.

## Code
Palette identique aux outils WiFi (`caisse-locale`) : marine #0a1f44, bleu #1b5fc1, forfaits vert / bleu / orange / violet.
Section `views.*` (écrans), `A` (actions), `db` (données), `modal`. Commentaires en anglais, textes en français. Incrémenter `CACHE` dans `sw.js` à chaque modification de l'application.
