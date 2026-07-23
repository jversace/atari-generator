# Atari Generator — prototype

Générateur de mannequin filaire paramétrable (Three.js + Electron).

## 1. Prérequis

- [Node.js](https://nodejs.org) (version 18 ou plus récente) installé sur Windows.
  Vérifie avec `node -v` dans une invite de commande.

## 2. Installation

Ouvre une invite de commande dans le dossier du projet, puis :

```
npm install
```

Cela télécharge Three.js, Electron et electron-builder (peut prendre quelques
minutes la première fois, Electron pèse ~150 Mo). `npm install` copie aussi
automatiquement 3 fichiers de Three.js dans `vendor/` (voir encadré
ci-dessous) — si jamais ça n'arrive pas tout seul, relance-le à la main avec
`npm run vendor`.

> **Pourquoi un dossier `vendor/` ?** electron-builder exclut par défaut,
> dans toutes les dépendances de `node_modules`, tout sous-dossier nommé
> `examples` (pour ne pas embarquer les démos/tests de chaque librairie).
> C'est justement là que vivent `OrbitControls.js` et
> `TransformControls.js` dans Three.js — ils étaient donc invisibles à
> l'exécutable final (`npm run dist`) alors que `npm start` fonctionnait
> très bien (il lit `node_modules` directement, sans cette règle
> d'exclusion). En les copiant dans `vendor/`, un dossier normal du
> projet, ils sont embarqués comme n'importe quel autre fichier.

## 3. Lancer l'application en développement

```
npm start
```

Une fenêtre s'ouvre avec le mannequin par défaut, le viewport 3D à gauche et
le panneau de contrôle à droite.

- **Souris dans le viewport** : clic gauche + glisser = orbiter la caméra,
  molette = zoomer, clic droit + glisser = déplacer la caméra (pan) —
  comportement standard d'`OrbitControls`.
- **Édition des cotes** : les sliders modifient le mannequin en temps réel.
- **Mode posture** : clique sur une articulation/un volume puis glisse pour
  la faire pivoter (ou `T` pour translater le bassin/thorax, `R` pour
  repasser en rotation).
- **Colonne (Bézier)** : fait apparaître 2 poignées oranges à glisser pour
  régler les 2 courbures de la colonne.
- **Export PNG** / **Enregistrer / Charger le projet** : au clic, une boîte
  de dialogue Windows s'ouvre pour choisir l'emplacement.

## 4. Générer un .exe Windows autonome

```
npm run dist
```

Le fichier d'installation se trouve ensuite dans `dist/`. `electron-builder`
télécharge les binaires Electron nécessaires lors de la première exécution
(connexion internet requise).

## 5. Où retoucher le code

- `src/params.js` — la liste des cotes réglables (pour ajouter un slider,
  ajoute une ligne dans `controlSchema`, plus le champ correspondant dans
  `defaultParams()`).
- `src/geometry.js` — les formes de base (volumes, segments, sphères).
- `src/mannequin.js` — assemble la hiérarchie complète (c'est ici que se
  trouve toute la logique anatomique : positions des épaules/hanches,
  orientation par défaut, etc.)
- `src/main-renderer.js` — scène 3D, panneau, sélection, export, fichiers.
- `package.json` — nom, **version**, auteur, licence et lien `homepage`
  (à remplacer par l'URL de ton dépôt GitHub) : tout ça alimente
  automatiquement la barre de titre et la fenêtre "À propos", pas besoin
  de modifier `main.js` pour ça.
- `about.html` — le contenu de la fenêtre "À propos" (menu Aide). Le nom,
  la version, l'auteur, la licence et le lien GitHub s'y remplissent tout
  seuls (lus depuis `package.json`) ; ajoute ce que tu veux dans la
  section `#extra` en bas du fichier.
- `build/icon.ico` / `build/icon.png` — icône de l'application (voir
  section suivante pour la remplacer).

### Icône de l'application

- Fichier attendu : `build/icon.ico`, format `.ico`, multi-résolution
  (16, 24, 32, 48, 64, 128, 256 px dans le même fichier).
- Une icône de substitution est déjà en place (le mannequin filaire) —
  remplace-la simplement par la tienne, rien d'autre à modifier.
- `build/icon.png` (256×256) est utilisé séparément par la fenêtre
  "À propos" ; pense à le remplacer aussi si tu changes l'icône.

## 6. Limites connues de ce prototype (pistes d'amélioration)

- Le pelvis est une approximation à 2 volumes empilés (boîte + coin) plutôt
  que le solide exact à 10 sommets décrit dans le cahier des charges — le
  rendu visuel est proche mais la géométrie interne est simplifiée.
- La pose de repos par défaut (angles des bras/jambes au chargement) est
  approximative ; à ajuster en mode Posture.
- Le mode Posture ne permet de translater librement que le bassin et le
  thorax (le reste — tête, mains, pieds, coudes, genoux — ne fait que
  pivoter), pour rester cohérent avec des segments de longueur fixe.
- Pas de limites d'angle (une articulation peut donc, en théorie, pivoter
  au-delà de ce qu'un vrai coude ferait) — à ajouter si besoin dans
  `attachSelection`/`objectChange` (clamp des valeurs d'Euler).
