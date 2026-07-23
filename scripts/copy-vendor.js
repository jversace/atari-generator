// scripts/copy-vendor.js — Copie les 3 fichiers Three.js dont l'appli a
// besoin depuis node_modules vers vendor/three/.
//
// Pourquoi : electron-builder exclut par défaut, dans TOUT paquet de
// node_modules, tout dossier nommé "examples" (pensé pour ne pas
// embarquer les démos/tests des dépendances). Or OrbitControls.js et
// TransformControls.js vivent justement dans
// node_modules/three/examples/jsm/controls/ — ils étaient donc
// silencieusement absents de l'exécutable final (`npm run dist`), alors
// que `npm start` fonctionne car il lit directement node_modules.
//
// En les copiant dans vendor/ (un dossier normal du projet, hors
// node_modules), ils échappent à cette règle d'exclusion et sont
// embarqués comme n'importe quel autre fichier du projet.
//
// Ce script tourne automatiquement après `npm install` (voir
// package.json -> scripts.postinstall). Tu peux aussi le relancer à la
// main avec `npm run vendor` si besoin.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'node_modules', 'three');
const destDir = path.join(root, 'vendor', 'three');

const files = [
  { from: path.join(srcDir, 'build', 'three.module.js'), to: path.join(destDir, 'three.module.js') },
  { from: path.join(srcDir, 'examples', 'jsm', 'controls', 'OrbitControls.js'), to: path.join(destDir, 'OrbitControls.js') },
  { from: path.join(srcDir, 'examples', 'jsm', 'controls', 'TransformControls.js'), to: path.join(destDir, 'TransformControls.js') },
];

fs.mkdirSync(destDir, { recursive: true });

let ok = true;
for (const f of files) {
  if (!fs.existsSync(f.from)) {
    console.error(`[copy-vendor] Introuvable : ${f.from} — as-tu bien fait "npm install" ?`);
    ok = false;
    continue;
  }
  fs.copyFileSync(f.from, f.to);
  console.log(`[copy-vendor] ${path.relative(root, f.from)} -> ${path.relative(root, f.to)}`);
}

if (!ok) process.exit(1);
