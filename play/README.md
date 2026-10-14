# Publier CISPOLstore Manager sur le Google Play Store

Guide pas à pas, du compte développeur à la mise en ligne. L'application reste la même : le Play Store reçoit une « enveloppe Android » (technologie *Trusted Web Activity*) qui ouvre votre application web, **hors connexion comprise**. Conséquence très pratique : **quand je modifie l'application, vos utilisateurs ont la nouvelle version tout de suite**, sans republier sur le Play Store.

**Décisions prises** : CISPOLstore Manager en premier · application **gratuite** pour votre équipe (pas de licences, pas de paiement dans l'application) · adresse `https://madulemarcus-arch.github.io/kaleidoscope-sonore/` conservée.

## Ce qui est déjà prêt dans ce dossier

| Élément | Où |
|---|---|
| Application prête pour Android (icône « adaptative », raccourcis longs appuis : Relances, Clients, Factures, Devis, catégories) | `cispolstore/manifest.webmanifest` |
| Politique de confidentialité (obligatoire) | `https://madulemarcus-arch.github.io/kaleidoscope-sonore/privacy.html` (et lien dans Paramètres) |
| Textes de la fiche, réponses aux questionnaires | `fiche-play-store.md` |
| 7 captures d'écran (fausses données), image de présentation 1024×500, icône 512 | `captures/` |
| Modèle du fichier de vérification Android | `assetlinks.json.modele`, `user-site/` |

Nom de l'application sur Android : **CISPOLstore Manager** · identifiant du paquet : `com.cispolstore.manager` (à ne plus changer ensuite).

---

## Étape 1 : créer le compte développeur Google Play (vous)

1. Allez sur <https://play.google.com/console/signup>, connectez-vous avec le compte Google que vous voulez utiliser **pour toujours** pour l'application (de préférence un compte dédié à l'entreprise).
2. Choisissez **compte personnel** (le plus simple) ou **compte organisation** (demande en plus un numéro D-U-N-S).
3. Payez les **25 $, une seule fois**, valables pour **toutes** vos applications (CISPOLstore Manager, puis WiFi Zone Manager). Il faut une carte bancaire internationale (Visa / Mastercard) ; Mobile Money n'est pas accepté.
4. Vérifiez votre identité (pièce d'identité officielle, adresse, numéro de téléphone, e-mail). La vérification peut prendre quelques jours.
5. **Pays pris en charge** : Google publie la liste des pays où l'on peut s'inscrire comme développeur. Vérifiez que la République démocratique du Congo y figure au moment de l'inscription. Si elle n'y est pas, ou si un blocage apparaît, dites-le-moi : je vous proposerai des solutions (par exemple distribuer l'application directement en fichier, sans Play Store).

> ⚠️ **Règle importante pour les comptes personnels récents** : avant de pouvoir publier pour tout le monde, il faut faire un **test fermé avec au moins 12 testeurs pendant 14 jours consécutifs** (les testeurs sont vos amis, collègues, clients : il leur suffit d'avoir un compte Google et d'installer l'application). Vérifiez le chiffre exact dans la console, Google le modifie parfois. Commencez à recruter vos testeurs dès maintenant (leurs adresses Gmail).

## Étape 2 : fabriquer le paquet Android (moi, puis vous)

C'est un outil gratuit de Microsoft, **PWABuilder**, qui fabrique le paquet à partir de l'adresse de l'application :

1. Allez sur <https://www.pwabuilder.com>, collez `https://madulemarcus-arch.github.io/kaleidoscope-sonore/` et lancez l'analyse. Le manifeste est déjà complet.
2. Cliquez sur **Package for stores › Android** puis **Generate Package**, avec ces réglages :
   - *Package ID* : `com.cispolstore.manager`
   - *App name* : `CISPOLstore Manager` · *Launcher name* : `CISPOL Manager`
   - *App version* : `1.0.0` · *Version code* : `1`
   - *Host* : `madulemarcus-arch.github.io` · *Start URL* : `/kaleidoscope-sonore/index.html?source=pwa`
   - *Display mode* : Standalone · *Notification delegation* : désactivé · *Signing key* : **Create new**
3. Téléchargez le fichier `.zip`. Il contient : un fichier **`.aab`** (celui qu'on envoie à Google), un `.apk` (pour tester sur un téléphone), une **clé de signature** (`.keystore`) et ses mots de passe, un `assetlinks.json`.
4. 🔐 **Gardez la clé et ses mots de passe en lieu sûr** (copie hors du téléphone, par exemple votre Drive personnel) : sans elle, vous ne pourrez plus publier de mises à jour de l'enveloppe Android. Ne les envoyez à personne, y compris à moi.

## Étape 3 : créer l'application dans la console et la téléverser (vous)

1. Console Play › **Créer une application** : nom `CISPOLstore Manager`, langue **Français**, type **Application**, **Gratuite**. Cochez les déclarations.
2. Rubrique **Tests › Test interne** (ou test fermé) › **Créer une version** › téléversez le fichier `.aab`. Laissez **Play App Signing** activé (c'est le choix par défaut, il protège votre application si vous perdez la clé).
3. Remplissez **Présence sur le Store** avec `fiche-play-store.md` et les images de `captures/` (icône, image de présentation, captures).
4. Remplissez **Contenu de l'application** (confidentialité, publicités, public cible 18+, classification, sécurité des données) : toutes les réponses sont dans `fiche-play-store.md`.

## Étape 4 : supprimer la barre d'adresse (moi, avec vous)

Android n'enlève la barre d'adresse que s'il peut vérifier que le site et l'application appartiennent au même propriétaire. Il lit pour cela un fichier à l'adresse :

`https://madulemarcus-arch.github.io/.well-known/assetlinks.json`

Ce fichier doit être à la **racine** du site, donc dans un dépôt GitHub spécial nommé exactement **`madulemarcus-arch.github.io`** (modèle dans `user-site/`).

1. Dans la console : **Configuration › Intégrité de l'application › Signature d'application** : copiez l'**empreinte du certificat SHA-256** (une longue suite du type `AB:CD:12:…`). S'il y en a deux (clé de signature et clé de téléversement), copiez les deux.
2. **Envoyez-moi cette empreinte** (ce n'est pas un secret : elle est publique par nature). Je crée le dépôt `madulemarcus-arch.github.io` avec le fichier `.well-known/assetlinks.json` rempli et je l'active.
3. On vérifie ensemble (quelques minutes plus tard) : <https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://madulemarcus-arch.github.io&relation=delegate_permission/common.handle_all_urls> doit montrer l'identifiant `com.cispolstore.manager`.

Sans ce fichier, l'application fonctionne mais affiche une barre d'adresse en haut. Ce n'est pas bloquant pour passer le test.

## Étape 5 : test fermé, puis production

1. **Tests › Test fermé** : créez la liste de testeurs (adresses Gmail), publiez la version, envoyez le lien d'invitation. Les testeurs acceptent et installent. Gardez-les **14 jours de suite**.
2. Rubrique **Production** : après la période de test, la console propose **Demander l'accès à la production** (un court questionnaire sur le test).
3. Envoyez la version en production. Google la vérifie (de quelques heures à quelques jours). L'application est ensuite visible sur le Play Store.

## Après la publication

- **Mises à jour de l'application** : rien à faire sur le Play Store. Quand je fusionne une amélioration, elle arrive chez tous les utilisateurs au prochain lancement (l'application affiche « nouvelle version disponible »).
- **Republier le paquet Android** : seulement si l'enveloppe Android change (nouvelle icône, nouveau nom, etc.).
- **WiFi Zone Manager** : même méthode, nouvel identifiant `com.cispolstore.wifizone`, **sans repayer les 25 $**. Il suffira d'ajouter un second bloc dans `assetlinks.json`.
- **Licences / paiement dans l'application** : non prévus (application gratuite pour votre équipe). Si un jour vous voulez vendre l'accès à d'autres boutiques, ce sera une nouvelle étape : Google impose son propre système de paiement pour les achats dans les applications.

## En cas de problème

| Problème | Réponse |
|---|---|
| « Cette application n'est pas installable » dans PWABuilder | Ouvrir l'adresse dans Chrome sur téléphone, vérifier que l'application se charge ; me le dire. |
| La barre d'adresse reste visible | Le fichier `assetlinks.json` n'est pas encore en ligne ou l'empreinte est incorrecte (étape 4). |
| Google refuse le téléversement (« clé déjà utilisée », « version code ») | Augmenter le *Version code* (2, 3…) et régénérer le paquet. |
| Google refuse l'application pour « contenu minimal » / « application web » | Me transmettre le message exact : je renforce la fiche et les captures. |

## Régénérer les captures

Les images viennent de `generer-captures.js` (données **fictives**, aucune donnée de vos clients) :
`cd tests && npm install && npx playwright install chromium`, puis `node play/generer-captures.js` depuis la racine du dépôt.
