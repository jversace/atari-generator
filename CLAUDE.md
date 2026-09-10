# CLAUDE.md — Contexte projet pour Claude

Ce fichier récapitule les spécifications (telles que corrigées au fil des
échanges, pas la première version) et fait le lien avec le code généré.
Objectif : ne pas avoir à rétro-ingénierer le projet à chaque nouvelle
demande. À tenir à jour à chaque évolution notable.

**Branche de travail : `DEV`.** Ne jamais commit/push sur `main` sauf
demande explicite. Vérifier avec `git ls-remote origin refs/heads/main`
qu'elle n'a pas bougé après chaque push.

## 1. Le projet en une phrase

Générateur d'« atari » (mannequin filaire articulé façon croquis
d'anatomie, + modèle de main séparé) pour dessinateurs, en application
Windows autonome. Stack : **Electron + Three.js, sans bundler** (ES
modules natifs + import map, voir §3).

## 2. Structure des fichiers

```
main.js                 Processus principal Electron : fenêtre, menu, IPC
                         (export PNG, save/load, config persistée)
preload.js               Pont contextBridge fenêtre principale (voir §3.3)
about-preload.js         Pont contextBridge fenêtre "À propos"
about.html                Contenu de la fenêtre "À propos" (section libre
                         "#extra" à la fin, prévue pour être complétée par
                         l'utilisateur)
index.html                Page unique : barre d'onglets + 2 panneaux
                         parallèles (Corps / Main), import map Three.js
style.css                  Styles partagés des deux onglets (sélecteurs
                         combinés #id1, #id2 plutôt que des classes)
package.json              version/author/license/homepage utilisés par le
                         menu natif et la fenêtre À propos (voir §7)
build/icon.ico, icon.png   Icône app (icon.ico multi-résolution pour
                         Windows, icon.png réutilisé par about.html)
scripts/copy-vendor.js     Copie 3 fichiers Three.js hors de node_modules
                         après npm install (voir §3.1 — IMPORTANT)

src/
  translations.json        Dictionnaire i18n EN/FR (voir §8)
  app-controller.js         Coordonne les 2 onglets : registerTab(),
                         routage des actions du menu natif, détection de
                         format au chargement, sauvegarde combinée, i18n
                         (t(), applyStaticTranslations) — voir §5, §8
  geometry.js                Fabriques géométriques génériques réutilisées
                         par le corps ET la main (frustum, ellipsoïde,
                         segment de membre, sphère, tétraèdre, contours) —
                         voir §6
  params.js / mannequin.js / main-renderer.js
                            Onglet Corps : paramètres+schéma / hiérarchie
                         3D / scène+UI+export (voir §4)
  hand-params.js / hand-model.js / hand-renderer.js
                            Onglet Main : mêmes rôles que ci-dessus,
                         pour la main (voir §9)
```

## 3. Pièges d'infrastructure déjà rencontrés (ne pas régresser)

Ce sont des bugs réels, déjà corrigés, dont la cause n'est pas évidente —
si un comportement similaire réapparaît après une modification, penser à
ces causes en premier.

### 3.1 electron-builder exclut `node_modules/*/examples` par défaut
`OrbitControls.js` et `TransformControls.js` vivent dans
`node_modules/three/examples/jsm/controls/`. electron-builder exclut
**par défaut, sans possibilité simple de l'annuler**, tout dossier nommé
`examples`/`example` dans les dépendances (pour ne pas embarquer les
démos de chaque librairie) — invisible avec `npm start` (qui lit
`node_modules` directement) mais absent de l'exécutable packagé
(`ERR_FILE_NOT_FOUND` au lancement).
→ **Solution en place** : `scripts/copy-vendor.js` copie les 3 fichiers
nécessaires (`three.module.js`, `OrbitControls.js`, `TransformControls.js`)
dans `vendor/three/` (hors `node_modules`, donc jamais filtré), lancé
automatiquement via `postinstall` dans `package.json`. L'import map
d'`index.html` pointe vers `vendor/`, pas `node_modules/`. `package.json`
→ `build.files` n'inclut **pas** `node_modules/**/*` (plus nécessaire).

### 3.2 Import map obligatoire, et pourquoi
Pas de bundler ⇒ les imports ES modules doivent résoudre en vrais
chemins. Mais `OrbitControls.js`/`TransformControls.js` font eux-mêmes,
en interne, `import ... from 'three'` (spécificateur nu) — le navigateur
ne peut pas le résoudre sans table de correspondance. D'où l'import map
dans `index.html` (clés exactes = les specifiers utilisés dans le code,
valeurs = chemins vers `vendor/three/...`).

### 3.3 Preload sandboxé : pas de `fs`/`path`
Depuis Electron 20, les scripts preload sont **sandboxés par défaut** :
seul `require('electron')` fonctionne, PAS `require('fs')`/`require('path')`.
Un `require('fs')` dans `preload.js` fait planter tout le script preload
**silencieusement** (pas d'erreur visible avant l'ouverture des
DevTools) → `window.api` reste `undefined` → tout le reste casse en
cascade (fenêtre vide, libellés vides). Toute lecture disque depuis le
renderer doit passer par un appel IPC vers `main.js` (qui, lui, tourne
dans le processus principal Node complet). C'est pour ça que
`translations.json` est lu dans `main.js` et exposé via IPC
(`get-translations`), pas lu directement dans `preload.js`.

### 3.4 `TransformControls` récent : `getHelper()`
Depuis three.js r170, `TransformControls` ne s'ajoute plus directement à
la scène : il faut `scene.add(transformControls.getHelper())`. Le code
actuel gère les deux cas (`transformControls.getHelper ? ... : ...`) par
prudence, mais `package.json` épingle `three@^0.170.0` — ne pas descendre
en dessous sans réajuster ce point.

### 3.5 `mesh.position = unVector3` lève une erreur
Les modules ES sont en mode strict : réassigner `object.position` (au
lieu de faire `.set()` ou de muter en place) lève un `TypeError`
("Cannot assign to read only property"), silencieux en script classique
mais bloquant ici. Toujours `.position.set(x,y,z)` ou construire l'objet
avec la bonne position dès le départ.

### 3.6 Bascule d'onglet : redimensionner APRÈS avoir démasqué
Dans `app-controller.js` → `setActiveTab()` : retirer l'attribut
`hidden` du panneau **avant** d'appeler `api.setActive(true)` (qui
déclenche un `resize()`). Sinon `clientWidth/clientHeight` valent 0
(panneau encore `display:none`) → canvas redimensionné à 0×0 → plus rien
ne s'affiche, y compris en revenant sur l'autre onglet ensuite. Un garde-
fou défensif existe aussi dans chaque `resize()` (ignore si w/h == 0),
mais l'ordre reste la vraie correction.

### 3.7 `npm run dist` sous Windows : symlinks
`electron-builder` télécharge `winCodeSign` (utils de signature) même
pour un build Windows-only, et son extraction échoue sur un compte
Windows standard (`Cannot create symbolic link` — droit
`SeCreateSymbolicLinkPrivilege` manquant). Solutions : activer le Mode
développeur Windows, OU lancer le terminal en administrateur, OU
`set CSC_IDENTITY_AUTO_DISCOVERY=false`. Rien à corriger dans le code.

## 4. Onglet Corps — spécification géométrique

Toutes les cotes ci-dessous sont réglables en temps réel (`src/params.js`
→ `controlSchema`, plages doublées par rapport aux valeurs par défaut :
mini ≈ défaut/2, maxi ≈ défaut×2). Unités arbitraires ~cm.

- **Membres** (bras/avant-bras/cuisses/tibias/cou) : segments "fil de
  fer" = cylindres fins (`geometry.js` → `createLimbSegment`), 2 segments
  par membre séparés par une **sphère d'articulation**
  (`createJointSphere`). Chaque segment expose une ancre `distal` sur
  laquelle le suivant s'accroche : changer une longueur ne fait que
  **translater** la suite de la chaîne (jamais la déformer) — c'est ce
  mécanisme (position d'ancrage, pas de recalcul manuel) qui garantit la
  propagation demandée dans le cahier des charges initial.
- **Tête** : ovaloïde = sphère basse résolution mise à l'échelle
  (`createEllipsoid`).
- **Cou/colonne** : fil de fer à double courbure = courbe de Bézier
  cubique (`THREE.CubicBezierCurve3`), 2 points de contrôle = les 2
  courbures (lombaire `spine.curve1`, thoracique `spine.curve2`). ⚠️
  `spine.length` ne représente QUE l'espace lombaire visible entre
  bassin et thorax, pas la colonne entière — le thorax porte sa propre
  hauteur pour la portion thoracique (un second cylindre rigide, la
  "portion thoracique", continue la colonne à travers le thorax jusqu'au
  cou, voir `mannequin.js` → `thoracicSpine`). Erreur commise puis
  corrigée : au départ `spine.length` couvrait toute la colonne, donnant
  un espace bassin/thorax bien trop grand même au minimum du slider.
- **Colonne accrochée par la face arrière** : le tube de la colonne et le
  volume du thorax sont décalés en Z pour que la colonne semble passer
  DERRIÈRE la cage thoracique (pas en son centre) — voir
  `pelvisBackOffset` et `thoraxMesh.position.z` dans `mannequin.js`.
- **Couplage courbure ↔ inclinaison** : propriété des courbes de Bézier
  cubiques : la tangente en t=0 ne dépend QUE du 1er point de contrôle,
  celle en t=1 QUE du dernier — donc `spine.curve1` incline le **bassin**
  et `spine.curve2` incline le **thorax**, indépendamment, sans double
  comptage. Voir `tiltQuaternionFromCurve()` (exportée par
  `mannequin.js`, réutilisée en direct pendant le glisser des poignées
  dans `main-renderer.js`). Amorti (facteur 0.4 pour le bassin) pour
  rester plausible aux valeurs extrêmes.
- **Thorax** : volume à 8 sommets, haut (large) ≠ bas (étroit) —
  `createFrustumBox(topWidth, topDepth, botWidth, botDepth, height)`.
- **Bassin** : ⚠️ **approximation** — 2 volumes empilés (`wedge` = coin
  bas qui s'évase, `iliacBox` = boîte iliaque au-dessus), PAS le solide
  exact à 10 sommets (pavé + triangle) du cahier des charges initial.
  Void visuel proche, géométrie interne différente — limite documentée
  dans le README, jamais redemandée depuis.
- **Mains/pieds** (bout des membres du corps — **différent** du modèle de
  main détaillé de l'onglet Main) : pavés simples (`createFlatBlock`).
- **Épaules/bras — pose de repos** : bras à l'horizontale, dans le
  prolongement direct de l'épaule (T-pose), pas relâchés vers le bas.
  Angle par défaut `upperArm` : `rotation.z = -side * degToRad(90)`. Une
  version antérieure (calcul d'angle erroné, ~100°) faisait pointer les
  bras vers l'intérieur du thorax — corrigé.
- **Position des épaules** : `side * thorax.topWidth/2 * 1.02`,
  `thorax.height * 0.86` (pas 0.97 — trop proche du cou, faisait
  paraître les bras "rattachés à la colonne").
- **Position des hanches** : `side * pelvis.topWidth/2 * 0.95` (ancrées
  sur la largeur iliaque, la partie la plus large du bassin — pas
  `botWidth`, qui les rapprochait trop de l'axe).
- **Mode Édition des cotes** / **Mode Posture** (sélection + glisser
  gauche = déplacer/pivoter, `T`/`R` pour bascule translater/pivoter ;
  bassin et thorax seuls autorisent la translation, le reste ne fait que
  pivoter) / **Mode Colonne (Bézier)** (2 poignées oranges, propres à
  l'onglet Corps — pas d'équivalent dans l'onglet Main).
- **Sélection en mode Posture** : logique en phase de capture (avant que
  la gizmo de `TransformControls` ne s'approprie le clic) — clic sur une
  AUTRE partie bascule la sélection ; clic dans le vide désélectionne
  SANS `stopPropagation()` (sinon ça bloque aussi `OrbitControls`, qui
  écoute le même événement — bug déjà rencontré : plus de contrôle
  caméra en mode Posture).

## 5. Architecture à onglets (Corps / Main)

Deux scènes/caméras/`OrbitControls`/`TransformControls` **entièrement
indépendantes** (chacune garde son cadrage en changeant d'onglet), pas de
scène partagée. `src/app-controller.js` coordonne sans que les deux
onglets se connaissent :
- `registerTab(name, api)` — chaque renderer s'enregistre avec
  `{ setActive, doExportPNG, doSaveProject, doReset, getParams,
  loadParams, refreshLanguage }`.
- Le bouton "Charger" de CHAQUE onglet ET le menu Fichier > Charger
  passent par le même point d'entrée (`triggerSmartLoad`) → détection de
  format (voir §7) → bascule automatiquement sur le bon onglet.
- Export/Enregistrer (bouton ou menu) agissent sur l'**onglet actif**
  uniquement ; "Enregistrer tout" (menu seulement) combine les deux.

## 6. Rendu "traits de construction" (fond transparent, contour seul)

Concept central : chaque mesh "plein" est marqué `mesh.userData.isSolid
= true` (voir `geometry.js`). À l'export en mode traits de construction
(`main-renderer.js`/`hand-renderer.js` → `doExportPNG`), on ne masque
JAMAIS ces meshes (`visible = false`) — on rend leur remplissage
transparent (`material.transparent = true; opacity = 0; depthWrite =
false; needsUpdate = true`) puis on restaure après le rendu. `depthWrite
= false` est essentiel : sans ça, un remplissage invisible masquerait
quand même ce qu'il y a derrière lui dans le tampon de profondeur
(leçon apprise en pratique, pas évidente a priori).

**Contours** : deux techniques selon la forme, ne pas les confondre.
- **Formes à arêtes vives** (boîtes trapézoïdales) → `EdgesGeometry`
  automatique (`createEdgeOverlay`, `markSolidWithEdges`). Fonctionne
  bien : les angles sont détectés au-delà d'un seuil.
- **Formes rondes** (sphères, cylindres) → **PAS** d'`EdgesGeometry`
  (une surface lisse n'a par définition presque aucune arête détectable
  au-delà d'un seuil raisonnable — c'est le bug de "la tête invisible" :
  contour quasi vide). À la place, contours **explicites** : 3 grands
  cercles perpendiculaires façon planisphère pour les sphères/ovoïdes
  (`createSphereContour`), 2 cercles + quelques lignes verticales pour
  les cylindres (`createCylinderContour`) — inspirés de schémas de
  dessin technique classiques.
- **Grille d'export claire** : `GridHelper` fige ses couleurs à la
  construction (pas de `material.color` à changer après coup) → une
  SECONDE instance dédiée à l'export, gris 40 % (`0x999999`), masquée en
  permanence sauf pendant l'export si l'option est cochée.
- **Fond transparent** : `WebGLRenderer({ alpha: true })` (sinon le canvas
  n'a pas de canal alpha, quoi qu'on fasse par ailleurs) +
  `scene.background = null` + `renderer.setClearAlpha(0)` pendant
  l'export, restaurés après.
- **Résolution d'export** : ×4 par rapport à la taille affichée du
  viewport (`EXPORT_RESOLUTION_SCALE`, en tête de
  `main-renderer.js`/`hand-renderer.js`). `renderer.setSize(w*4, h*4,
  false)` juste avant le rendu puis restauration à la taille normale —
  le `false` (3ᵉ argument) est important : il change la résolution
  interne du canvas SANS toucher à sa taille CSS affichée à l'écran.

## 7. Formats de fichiers projet (JSON)

- **Corps seul** : objet PLAT (`{ head, neck, thorax, pelvis, spine,
  upperArm, forearm, hand, thigh, shin, foot, joints, pose }`), **sans
  enveloppe** — format historique, volontairement inchangé pour rester
  compatible avec tous les fichiers déjà générés.
- **Main seule** : `{ atariKind: 'hand', hand: {...} }`.
- **Combiné** : `{ atariKind: 'combined', body: {...}, hand: {...} }`.
- Détection au chargement (`app-controller.js` → `detectFormat`) :
  présence de `thorax`/`pelvis`/`upperArm` à la racine ⇒ corps seul
  (ancien format) ; sinon `atariKind` fait foi.
- `params.pose` (dans chaque objet corps/main) stocke les rotations
  (et positions pour bassin/thorax/tarse) posées en mode Posture, réappliquées
  à chaque reconstruction — c'est ce qui permet de définir une posture
  par défaut au démarrage (voir `defaultParams()`/`defaultHandParams()`,
  déjà fait une fois sur demande explicite avec un fichier projet fourni).

## 8. Internationalisation (EN/FR)

- `src/translations.json` : dictionnaire plat par langue, clés stables
  utilisées telles quelles comme identifiants (pas de restructuration
  prévue). Convention pour les sliders : `field.<field.path>` (ex.
  `field.head.width`) et `group.<group.key>` (ex. `group.thorax`) — le
  `key` de chaque groupe est défini dans `params.js`/`hand-params.js` à
  côté du `group` (libellé français d'origine, gardé comme repère de
  lecture mais plus affiché tel quel).
- **Langue par défaut : anglais.** Persistée côté `main.js` (même
  mécanisme que le dernier répertoire / options d'export), changée via
  le menu natif **Options > Langue** (boutons radio) — pas de sélecteur
  côté interface web.
- `main.js` reconstruit le menu natif (`buildMenu()`) à chaque
  changement de langue ; côté renderer, `app-controller.js` réapplique
  les traductions statiques (`[data-i18n]`/`[data-i18n-html]` dans le
  HTML) et appelle `refreshLanguage()` sur chaque onglet enregistré
  (qui reconstruit son panneau de sliders avec les nouveaux libellés).
- Le dictionnaire ET la langue courante sont lus via **IPC**
  (`get-translations`, `get-language`) depuis `main.js` — jamais lus
  directement dans un preload (voir §3.3).
- Chargement défensif à dessein dans `app-controller.js` (try/catch,
  repli sur l'anglais) : ce module est importé par les deux renderers,
  une exception non gérée ici ferait planter les deux onglets en cascade.

## 9. Onglet Main — spécification géométrique

`hand-params.js` (params + schéma) / `hand-model.js` (hiérarchie) /
`hand-renderer.js` (scène/UI/export, mêmes principes que le corps mais
sans mode Colonne). Repères locaux : **X** = largeur (pouce↔auriculaire),
**Y** = poignet→doigts (axe d'extension, comme les membres du corps),
**Z** = épaisseur (paume↔dos de la main).

- **Tarse** : volume à 8 sommets — réutilise directement
  `createFrustumBox` (même code que le thorax/bassin, juste avec les
  axes width/depth/height réinterprétés). Extrémité doigts (haut, large)
  ↔ extrémité poignet (bas, réduite du ratio réglable `tarsus.ratio`).
- **Pouce** : tétraèdre irrégulier + 2 cylindres (phalanges), accroché au
  flanc du tarse. Reconstruit plusieurs fois sur retours précis — la
  version actuelle (`hand-model.js`, section pouce) respecte :
  1. Le flanc du tarse est **conique** (pas un plan vertical) : chaque
     sommet du triangle de base est calculé à la largeur ET l'épaisseur
     RÉELLES du tarse à sa propre hauteur (`halfWidthAt(y)`,
     `halfThickAt(y)`, interpolation linéaire poignet↔doigts) — pas sur
     un plan fixe. C'est ce qui les rend réellement parallèles/flush.
  2. La face "du dessus" (celle qui accueille la phalange) est bornée
     par l'**épaisseur** du tarse à cette hauteur, PAS sa largeur (erreur
     initiale : confusion entre les deux axes).
  3. Le triangle ne dépasse pas la **moitié** de la longueur du tarse ;
     sa pointe reste côté poignet (pivot de rotation en mode Posture).
  4. La phalange part à **45°** de l'axe des doigts (`rotation.z =
     -degToRad(45)`), pas 90° — et son point d'accroche sur la face
     supérieure est décalé du centre vers le sommet extérieur (70 % du
     chemin), pas centré.
- **Doigts** (×4 : pinky/ring/middle/index, répartis en X sur le sommet
  du tarse) : chacun 3 cylindres (phalanges), directement enchaînés —
  **pas de sphère d'articulation** entre elles (contrairement au corps :
  non demandé dans le cahier des charges de la main, différence
  assumée). Un seul réglage longueur+diamètre par doigt (pas par
  phalange) : répartition fixe `[0.44, 0.30, 0.26]` de la longueur totale
  et facteurs de diamètre `[1, 0.85, 0.7]` (proximale→distale, la
  dernière toujours la plus petite — exigence explicite). Voir
  `splitPhalanges()`/`buildPhalanxChain()` dans `hand-model.js`, mêmes
  fractions `[0.55, 0.45]`/`[1, 0.82]` pour le pouce (2 segments).
- **Main gauche/droite** : bouton de bascule, symétrie pure —
  `root.scale.x = -1` pour la main gauche. Fonctionne sans souci de sens
  des faces car tous les matériaux de volume sont en `THREE.DoubleSide`.

## 10. Menu natif (`main.js` → `buildMenu()`)

Entièrement personnalisé (pas de menu par défaut d'Electron) : **Fichier
· Options · Affichage · Fenêtre · Aide**. Piège déjà rencontré : à un
moment j'ai reconstruit le menu en ne gardant QUE Fichier+Aide en
pensant répondre à "supprime le menu Édition" — corrigé depuis (Édition
n'existe plus, mais Affichage/Fenêtre ont été restaurés).

- **Fichier** : Exporter en PNG, Enregistrer l'onglet actif (`Ctrl+S`),
  Enregistrer tout (corps+main), Charger un projet (`Ctrl+O`, détection
  de format auto), Réinitialiser, Quitter.
- **Options** : sous-menu "Options d'export" (3 cases à cocher
  persistées : mode traits de construction, inclure le plan, fond
  transparent) + sous-menu "Langue" (radio EN/FR).
- **Affichage** / **Fenêtre** : rôles standards Electron (reload,
  devtools, zoom, plein écran / réduire, fermer).
- **Aide** : Documentation (ouvre `pkg.homepage` dans le navigateur
  externe), À propos (fenêtre modale `about.html`, contenu tiré de
  `package.json` — voir §11).
- Les actions Fichier sont envoyées au renderer via
  `mainWindow.webContents.send('menu-action', <action>)` et routées côté
  `app-controller.js` (pas directement dans `main-renderer.js` — voir §5).

## 11. Métadonnées, licence, distribution

- `package.json` : `author` (Julien Versace), `license` (LGPL-3.0),
  `homepage` (lien GitHub, alimente le menu Aide > Documentation ET la
  fenêtre À propos) — modifier ce fichier suffit, rien à toucher ailleurs.
- `LICENCE.txt` (nom choisi par l'utilisateur, orthographe anglaise) :
  texte complet LGPL-3.0 (incorpore le texte GPL-3.0 par référence, comme
  l'exige la FSF).
- Icône : `build/icon.ico` (multi-résolution 16→256px, format .ico
  obligatoire pour Windows) référencée à la fois dans `package.json` →
  `build.win.icon` (exécutable/installeur) et `main.js` (fenêtre en dev).
  Remplacer directement le fichier suffit.
- Config persistée (dernier répertoire, options d'export, langue) : JSON
  dans `app.getPath('userData')`, PAS dans le dépôt/projet.
- `npm run dist` → NSIS Windows via electron-builder (voir §3.7 pour le
  souci de symlinks déjà rencontré).

## 12. Ce qui a été explicitement demandé puis retiré/simplifié

Pour éviter de re-proposer des choses déjà écartées :
- Fichier de licence : GPL/LGPL uniquement (three.js et Electron sont
  tous deux MIT — permissif, donc aucune contrainte de licence côté
  dépendances, l'utilisateur a le libre choix).
- Pas de limites d'angle sur les articulations (corps ni main) — une
  articulation peut en théorie pivoter au-delà du réalisme anatomique ;
  jamais demandé de contrainte.
- `thumb.base.width`/`thumb.base.length` (sliders) : supprimés — la base
  du pouce est désormais entièrement dérivée des cotes du tarse (§9),
  plus de réglage indépendant.
- Registre des parties sélectionnables (`registry[].label` dans
  `mannequin.js`/`hand-model.js`) : jamais affiché dans l'UI (pas de
  tooltip/texte de sélection) — labels présents mais non traduits, pas
  un oubli.

## 13. Historique de collaboration (pertinent pour le style de travail)

- Le dépôt GitHub (`jversace/atari-generator`) a une branche `main`
  (stable) et `DEV` (travail en cours). Claude a un token d'accès
  fine-grained temporaire fourni par l'utilisateur pour pousser
  directement sur `DEV` — toujours vérifier après coup que `main` n'a
  pas bougé (`git ls-remote origin refs/heads/main`).
- L'utilisateur teste sur une vraie machine Windows après chaque lot de
  changements (le bac à sable de développement n'a pas d'accès npm ni
  d'environnement graphique) — les retours de bugs sont donc toujours
  des observations réelles, à prendre au sérieux même quand la cause
  n'est pas évidente à la lecture du code (cf. §3, plusieurs bugs
  n'avaient pas de cause visible en relisant le code sans le message
  d'erreur exact des DevTools).
