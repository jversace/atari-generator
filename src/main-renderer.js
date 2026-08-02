import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { buildMannequin, tiltQuaternionFromCurve } from './mannequin.js';
import { defaultParams, controlSchema, getPath, setPath } from './params.js';

// ------------------------------------------------------------------
// Scène, caméra, rendu
// ------------------------------------------------------------------
const viewport = document.getElementById('viewport');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b2b2b);

const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 3000);
camera.position.set(170, 140, 230);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
viewport.appendChild(renderer.domElement);

function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', resize);

// ------------------------------------------------------------------
// Options d'export (menu Fichier > Options d'export), persistées côté
// main.js — on récupère l'état initial puis on écoute les changements
// (la case peut être cochée/décochée à tout moment pendant que l'appli
// tourne).
// ------------------------------------------------------------------
let exportOptions = { constructionMode: false, includeGrid: false };
window.api.getExportOptions().then((opts) => { if (opts) exportOptions = opts; });
window.api.onExportOptionsChanged((opts) => { exportOptions = opts; });

// ------------------------------------------------------------------
// Focale (FOV) — potentiomètre en surimpression sur le viewport
// ------------------------------------------------------------------
const fovRange = document.getElementById('fovRange');
const fovValue = document.getElementById('fovValue');
fovRange.addEventListener('input', () => {
  camera.fov = parseFloat(fovRange.value);
  camera.updateProjectionMatrix();
  fovValue.textContent = `${fovRange.value}°`;
});

scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(150, 300, 200);
scene.add(sun);

const grid = new THREE.GridHelper(400, 40, 0x555555, 0x3a3a3a);
scene.add(grid);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 95, 0);
orbit.enableDamping = true;

const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.addEventListener('dragging-changed', (e) => { orbit.enabled = !e.value; });
scene.add(transformControls.getHelper ? transformControls.getHelper() : transformControls);

// ------------------------------------------------------------------
// État de l'application
// ------------------------------------------------------------------
let params = defaultParams();
let mannequin = buildMannequin(params);
scene.add(mannequin.root);

let mode = 'edit';          // 'edit' | 'pose' | 'spine'
let poseTransformMode = 'rotate'; // 'rotate' | 'translate' (bascule T / R)
let selectedEntry = null;   // entrée du registre ou de spineHandles actuellement saisie

setSpineHandlesVisible(false);

// ------------------------------------------------------------------
// Génération du panneau de contrôle à partir du schéma déclaratif
// ------------------------------------------------------------------
const controlsRoot = document.getElementById('controls');

function buildControlsUI() {
  controlsRoot.innerHTML = '';
  for (const group of controlSchema) {
    const title = document.createElement('div');
    title.className = 'group-title';
    title.textContent = group.group;
    controlsRoot.appendChild(title);

    for (const field of group.fields) {
      const row = document.createElement('div');
      row.className = 'control-row';

      const label = document.createElement('label');
      const valueSpan = document.createElement('span');
      valueSpan.textContent = getPath(params, field.path).toFixed(1);
      label.textContent = field.label + ' ';
      label.appendChild(valueSpan);

      const input = document.createElement('input');
      input.type = 'range';
      input.min = field.min;
      input.max = field.max;
      input.step = field.step;
      input.value = getPath(params, field.path);

      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        setPath(params, field.path, v);
        valueSpan.textContent = v.toFixed(1);
        rebuild();
      });

      row.appendChild(label);
      row.appendChild(input);
      controlsRoot.appendChild(row);
    }
  }
}
buildControlsUI();

// ------------------------------------------------------------------
// (Re)construction du mannequin — appelée à chaque changement de cote.
// Les poses enregistrées dans params.pose sont réappliquées automatique-
// ment car mannequin.js les relit à chaque construction.
// ------------------------------------------------------------------
function disposeObject(obj) {
  obj.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material?.dispose();
    }
  });
}

function rebuild() {
  const wasSelectedId = selectedEntry ? selectedEntry.id : null;
  transformControls.detach();

  scene.remove(mannequin.root);
  disposeObject(mannequin.root);

  mannequin = buildMannequin(params);
  scene.add(mannequin.root);
  setSpineHandlesVisible(mode === 'spine');

  if (wasSelectedId) selectById(wasSelectedId);
}

// ------------------------------------------------------------------
// Sélection (mode Posture et mode Colonne)
// ------------------------------------------------------------------
function tagMeshes() {
  for (const entry of mannequin.registry) {
    entry.object.traverse((child) => { if (child.isMesh) child.userData.entryId = entry.id; });
  }
  for (const entry of mannequin.spineHandles) {
    entry.object.userData.entryId = entry.id;
  }
}

function setSpineHandlesVisible(visible) {
  for (const h of mannequin.spineHandles) h.object.visible = visible;
}

function findEntryById(id) {
  return mannequin.registry.find(e => e.id === id) ||
         mannequin.spineHandles.find(e => e.id === id) || null;
}

function selectById(id) {
  const entry = findEntryById(id);
  if (!entry) return;
  attachSelection(entry);
}

function attachSelection(entry) {
  selectedEntry = entry;
  if (mannequin.spineHandles.includes(entry)) {
    transformControls.attach(entry.object);
    transformControls.setMode('translate');
    transformControls.showX = false;
    transformControls.showY = false;
    transformControls.showZ = true;
  } else {
    transformControls.showX = true;
    transformControls.showY = true;
    transformControls.showZ = true;
    const wantsTranslate = entry.kind === 'both' && poseTransformMode === 'translate';
    transformControls.setMode(wantsTranslate ? 'translate' : 'rotate');
    transformControls.attach(entry.object);
  }
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (mode === 'edit') return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  // Le pointeur survole déjà une poignée de la gizmo actuellement affichée
  // (TransformControls met .axis à jour en continu sur les déplacements de
  // souris, avant même le clic) : on laisse le glisser habituel se faire,
  // on ne touche à rien.
  if (selectedEntry && transformControls.axis) return;

  tagMeshes();
  const pool = mode === 'spine'
    ? mannequin.spineHandles.map(h => h.object)
    : [mannequin.root];
  const hits = raycaster.intersectObjects(pool, true);
  const hit = hits.find(h => h.object.userData.entryId);

  if (hit) {
    const entry = findEntryById(hit.object.userData.entryId);
    if (entry && entry !== selectedEntry) {
      // On intercepte cet appui (phase de capture, voir plus bas) pour
      // basculer la sélection AVANT que la gizmo de l'ancien élément ne
      // traite ce même clic comme le début d'un glisser.
      event.stopPropagation();
      attachSelection(entry);
    }
    // Si c'est déjà l'élément sélectionné, on ne fait rien ici : l'événement
    // continue normalement vers la gizmo pour un glisser classique.
  } else {
    // Clic dans le vide : on désélectionne (comme dans la plupart des
    // logiciels 3D), MAIS sans bloquer la propagation — sinon OrbitControls
    // ne reçoit jamais l'événement et la caméra devient impossible à
    // orbiter dès qu'on est en mode Posture/Colonne.
    transformControls.detach();
    selectedEntry = null;
  }
}, true); // phase de CAPTURE : s'exécute avant le gestionnaire interne de la gizmo

// Clic droit = désélectionner (raccourci alternatif rapide)
renderer.domElement.addEventListener('contextmenu', (event) => {
  if (mode === 'edit') return;
  event.preventDefault();
  transformControls.detach();
  selectedEntry = null;
});

// Rafraîchissement temps réel pendant le glisser
transformControls.addEventListener('objectChange', () => {
  if (!selectedEntry) return;

  if (mannequin.spineHandles.includes(selectedEntry)) {
    // Poignée de courbure de la colonne : mise à jour légère (pas de
    // reconstruction complète), voir buildMannequin() / spineControl.
    setPath(params, selectedEntry.paramPath, selectedEntry.object.position.z);
    const { curve, spineTube, pelvis, thorax, hasPelvisOverride, hasThoraxOverride } = mannequin.spineControl;
    const newTubeGeo = new THREE.TubeGeometry(curve, 20, 1.1, 6, false);
    spineTube.geometry.dispose();
    spineTube.geometry = newTubeGeo;
    const tubeEdges = spineTube.children.find(c => c.isLineSegments);
    if (tubeEdges) {
      tubeEdges.geometry.dispose();
      tubeEdges.geometry = new THREE.EdgesGeometry(newTubeGeo, 15);
    }
    if (!hasPelvisOverride) {
      pelvis.quaternion.copy(tiltQuaternionFromCurve(curve, 0, 0.4));
    }
    if (!hasThoraxOverride) {
      thorax.position.copy(curve.getPoint(1));
      thorax.quaternion.copy(tiltQuaternionFromCurve(curve, 1, 1));
    }
  } else {
    // Mode posture : la hiérarchie parent/enfant fait déjà tout le
    // travail visuel ; on se contente d'enregistrer la pose pour qu'elle
    // survive à une future édition de cote (rebuild()).
    const o = selectedEntry.object;
    const rec = params.pose[selectedEntry.id] = params.pose[selectedEntry.id] || {};
    rec.x = o.rotation.x; rec.y = o.rotation.y; rec.z = o.rotation.z;
    if (selectedEntry.kind === 'both') {
      rec.px = o.position.x; rec.py = o.position.y; rec.pz = o.position.z;
    }
  }
});

window.addEventListener('keydown', (e) => {
  if (mode !== 'pose' || !selectedEntry || selectedEntry.kind !== 'both') return;
  if (e.key.toLowerCase() === 't') { poseTransformMode = 'translate'; transformControls.setMode('translate'); }
  if (e.key.toLowerCase() === 'r') { poseTransformMode = 'rotate'; transformControls.setMode('rotate'); }
});

// ------------------------------------------------------------------
// Barre de modes
// ------------------------------------------------------------------
const btnEdit = document.getElementById('btnEditMode');
const btnPose = document.getElementById('btnPoseMode');
const btnSpine = document.getElementById('btnSpineMode');
const poseHint = document.getElementById('poseHint');
const spineHint = document.getElementById('spineHint');

function setMode(next) {
  mode = next;
  transformControls.detach();
  selectedEntry = null;

  [btnEdit, btnPose, btnSpine].forEach(b => b.classList.remove('active'));
  poseHint.hidden = mode !== 'pose';
  spineHint.hidden = mode !== 'spine';
  setSpineHandlesVisible(mode === 'spine');
  controlsRoot.style.display = mode === 'edit' ? '' : 'none';

  if (mode === 'edit') btnEdit.classList.add('active');
  if (mode === 'pose') btnPose.classList.add('active');
  if (mode === 'spine') btnSpine.classList.add('active');
}
btnEdit.addEventListener('click', () => setMode('edit'));
btnPose.addEventListener('click', () => setMode('pose'));
btnSpine.addEventListener('click', () => setMode('spine'));

// ------------------------------------------------------------------
// Export PNG (fond blanc, structure en noir)
// ------------------------------------------------------------------
async function doExportPNG() {
  const prevBg = scene.background;
  const prevGridVisible = grid.visible;
  const prevVisible = mannequin.spineHandles.map(h => h.object.visible);
  setSpineHandlesVisible(false);
  scene.background = new THREE.Color(0xffffff);
  grid.visible = exportOptions.includeGrid;
  transformControls.detach();

  // Mode traits de construction : tout reste affiché (têtes, volumes,
  // articulations, membres), mais le REMPLISSAGE de chaque forme pleine
  // devient transparent — ne restent visibles que les contours/arêtes
  // noirs, et ce qu'il y a derrière (ex. la colonne à travers le thorax).
  // depthWrite:false est essentiel : sans ça, un remplissage invisible
  // masquerait quand même ce qui est derrière lui dans le tampon de
  // profondeur (transparent ≠ invisible pour le depth-buffer par défaut).
  const restoreMaterials = [];
  if (exportOptions.constructionMode) {
    mannequin.root.traverse((obj) => {
      if (obj.isMesh && obj.userData.isSolid) {
        const mat = obj.material;
        restoreMaterials.push({ mat, transparent: mat.transparent, opacity: mat.opacity, depthWrite: mat.depthWrite });
        mat.transparent = true;
        mat.opacity = 0;
        mat.depthWrite = false;
        mat.needsUpdate = true;
      }
    });
  }

  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL('image/png');

  scene.background = prevBg;
  grid.visible = prevGridVisible;
  restoreMaterials.forEach(({ mat, transparent, opacity, depthWrite }) => {
    mat.transparent = transparent;
    mat.opacity = opacity;
    mat.depthWrite = depthWrite;
    mat.needsUpdate = true;
  });
  mannequin.spineHandles.forEach((h, i) => { h.object.visible = prevVisible[i]; });

  await window.api.exportPNG(dataUrl);
}
document.getElementById('btnExport').addEventListener('click', doExportPNG);

// ------------------------------------------------------------------
// Sauvegarde / chargement de projet (JSON des paramètres)
// ------------------------------------------------------------------
async function doSaveProject() {
  await window.api.saveProject(JSON.stringify(params, null, 2));
}
document.getElementById('btnSave').addEventListener('click', doSaveProject);

async function doLoadProject() {
  const res = await window.api.loadProject();
  if (!res.ok) return;
  try {
    const loaded = JSON.parse(res.content);
    params = { ...defaultParams(), ...loaded, pose: loaded.pose || {} };
    buildControlsUI();
    rebuild();
  } catch (err) {
    console.error('Fichier de projet invalide :', err);
  }
}
document.getElementById('btnLoad').addEventListener('click', doLoadProject);

function doReset() {
  params = defaultParams();
  buildControlsUI();
  rebuild();
}
document.getElementById('btnReset').addEventListener('click', doReset);

// ------------------------------------------------------------------
// Menu natif "Fichier" (main.js) — déclenche exactement les mêmes actions
// que les boutons du panneau.
// ------------------------------------------------------------------
window.api.onMenuAction((action) => {
  if (action === 'export-png') doExportPNG();
  if (action === 'save-project') doSaveProject();
  if (action === 'load-project') doLoadProject();
  if (action === 'reset') doReset();
});

// ------------------------------------------------------------------
// Boucle de rendu
// ------------------------------------------------------------------
resize();
function animate() {
  requestAnimationFrame(animate);
  orbit.update();
  renderer.render(scene, camera);
}
animate();
