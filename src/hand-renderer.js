import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { buildHand } from './hand-model.js';
import { defaultHandParams, handControlSchema, getPath, setPath } from './hand-params.js';
import { registerTab, triggerSmartLoad } from './app-controller.js';

// ------------------------------------------------------------------
// Scène, caméra, rendu — indépendants de l'onglet Corps (sa propre
// caméra, son propre canvas) pour ne pas perdre le cadrage de l'un en
// naviguant dans l'autre.
// ------------------------------------------------------------------
const viewport = document.getElementById('handViewport');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b2b2b);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
camera.position.set(22, 18, 28);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
viewport.appendChild(renderer.domElement);

function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', resize);

// Options d'export (partagées avec l'onglet Corps, mêmes réglages).
let exportOptions = { constructionMode: false, includeGrid: false };
window.api.getExportOptions().then((opts) => { if (opts) exportOptions = opts; });
window.api.onExportOptionsChanged((opts) => { exportOptions = opts; });

// Focale (FOV) — potentiomètre en surimpression, comme pour le corps.
const fovRange = document.getElementById('handFovRange');
const fovValue = document.getElementById('handFovValue');
fovRange.addEventListener('input', () => {
  camera.fov = parseFloat(fovRange.value);
  camera.updateProjectionMatrix();
  fovValue.textContent = `${fovRange.value}°`;
});

scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(20, 40, 25);
scene.add(sun);

const grid = new THREE.GridHelper(60, 30, 0x555555, 0x3a3a3a);
scene.add(grid);
const EXPORT_GRID_GRAY = 0x999999; // ~40% de noir, comme pour le corps
const exportGrid = new THREE.GridHelper(60, 30, EXPORT_GRID_GRAY, EXPORT_GRID_GRAY);
exportGrid.visible = false;
scene.add(exportGrid);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 6, 0);
orbit.enableDamping = true;

const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.addEventListener('dragging-changed', (e) => { orbit.enabled = !e.value; });
scene.add(transformControls.getHelper ? transformControls.getHelper() : transformControls);

// ------------------------------------------------------------------
// État de l'application
// ------------------------------------------------------------------
let params = defaultHandParams();
let hand = buildHand(params);
scene.add(hand.root);

let mode = 'edit';        // 'edit' | 'pose' (pas de mode "colonne" pour la main)
let poseTransformMode = 'rotate';
let selectedEntry = null;
let isActive = false;     // l'onglet Main démarre masqué (Corps est actif par défaut)

// ------------------------------------------------------------------
// Panneau de contrôle (généré depuis le schéma, identique au corps)
// ------------------------------------------------------------------
const controlsRoot = document.getElementById('handControls');

function buildControlsUI() {
  controlsRoot.innerHTML = '';
  for (const group of handControlSchema) {
    const title = document.createElement('div');
    title.className = 'group-title';
    title.textContent = group.group;
    controlsRoot.appendChild(title);

    for (const field of group.fields) {
      const row = document.createElement('div');
      row.className = 'control-row';

      const label = document.createElement('label');
      const valueSpan = document.createElement('span');
      valueSpan.textContent = getPath(params, field.path).toFixed(2);
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
        valueSpan.textContent = v.toFixed(2);
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
// (Re)construction — identique au principe du corps.
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

  scene.remove(hand.root);
  disposeObject(hand.root);

  hand = buildHand(params);
  scene.add(hand.root);

  if (wasSelectedId) selectById(wasSelectedId);
}

// ------------------------------------------------------------------
// Sélection (mode Posture)
// ------------------------------------------------------------------
function tagMeshes() {
  for (const entry of hand.registry) {
    entry.object.traverse((child) => { if (child.isMesh) child.userData.entryId = entry.id; });
  }
}

function findEntryById(id) {
  return hand.registry.find(e => e.id === id) || null;
}

function selectById(id) {
  const entry = findEntryById(id);
  if (!entry) return;
  attachSelection(entry);
}

function attachSelection(entry) {
  selectedEntry = entry;
  transformControls.showX = true;
  transformControls.showY = true;
  transformControls.showZ = true;
  const wantsTranslate = entry.kind === 'both' && poseTransformMode === 'translate';
  transformControls.setMode(wantsTranslate ? 'translate' : 'rotate');
  transformControls.attach(entry.object);
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (mode === 'edit') return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  if (selectedEntry && transformControls.axis) return;

  tagMeshes();
  const hits = raycaster.intersectObjects([hand.root], true);
  const hit = hits.find(h => h.object.userData.entryId);

  if (hit) {
    const entry = findEntryById(hit.object.userData.entryId);
    if (entry && entry !== selectedEntry) {
      event.stopPropagation();
      attachSelection(entry);
    }
  } else {
    transformControls.detach();
    selectedEntry = null;
  }
}, true);

renderer.domElement.addEventListener('contextmenu', (event) => {
  if (mode === 'edit') return;
  event.preventDefault();
  transformControls.detach();
  selectedEntry = null;
});

transformControls.addEventListener('objectChange', () => {
  if (!selectedEntry) return;
  const o = selectedEntry.object;
  const rec = params.pose[selectedEntry.id] = params.pose[selectedEntry.id] || {};
  rec.x = o.rotation.x; rec.y = o.rotation.y; rec.z = o.rotation.z;
  if (selectedEntry.kind === 'both') {
    rec.px = o.position.x; rec.py = o.position.y; rec.pz = o.position.z;
  }
});

window.addEventListener('keydown', (e) => {
  if (!isActive || mode !== 'pose' || !selectedEntry || selectedEntry.kind !== 'both') return;
  if (e.key.toLowerCase() === 't') { poseTransformMode = 'translate'; transformControls.setMode('translate'); }
  if (e.key.toLowerCase() === 'r') { poseTransformMode = 'rotate'; transformControls.setMode('rotate'); }
});

// ------------------------------------------------------------------
// Barre de modes (Édition / Posture)
// ------------------------------------------------------------------
const btnEdit = document.getElementById('btnHandEditMode');
const btnPose = document.getElementById('btnHandPoseMode');
const poseHint = document.getElementById('handPoseHint');

function setMode(next) {
  mode = next;
  transformControls.detach();
  selectedEntry = null;

  [btnEdit, btnPose].forEach(b => b.classList.remove('active'));
  poseHint.hidden = mode !== 'pose';
  controlsRoot.style.display = mode === 'edit' ? '' : 'none';

  if (mode === 'edit') btnEdit.classList.add('active');
  if (mode === 'pose') btnPose.classList.add('active');
}
btnEdit.addEventListener('click', () => setMode('edit'));
btnPose.addEventListener('click', () => setMode('pose'));

// ------------------------------------------------------------------
// Bascule main droite / main gauche
// ------------------------------------------------------------------
const btnHandedness = document.getElementById('btnHandedness');
function updateHandednessLabel() {
  btnHandedness.textContent = params.handedness === 'right'
    ? '🖐️ Main droite (cliquer pour gauche)'
    : '🖐️ Main gauche (cliquer pour droite)';
}
btnHandedness.addEventListener('click', () => {
  params.handedness = params.handedness === 'right' ? 'left' : 'right';
  updateHandednessLabel();
  rebuild();
});
updateHandednessLabel();

// ------------------------------------------------------------------
// Export PNG — même principe que le corps (transparence en mode traits
// de construction, grille claire optionnelle).
// ------------------------------------------------------------------
async function doExportPNG() {
  const prevBg = scene.background;
  const prevGridVisible = grid.visible;
  scene.background = new THREE.Color(0xffffff);
  grid.visible = false;
  exportGrid.visible = exportOptions.includeGrid;
  transformControls.detach();

  const restoreMaterials = [];
  if (exportOptions.constructionMode) {
    hand.root.traverse((obj) => {
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
  exportGrid.visible = false;
  restoreMaterials.forEach(({ mat, transparent, opacity, depthWrite }) => {
    mat.transparent = transparent;
    mat.opacity = opacity;
    mat.depthWrite = depthWrite;
    mat.needsUpdate = true;
  });

  await window.api.exportPNG(dataUrl);
}
document.getElementById('btnHandExport').addEventListener('click', doExportPNG);

// ------------------------------------------------------------------
// Sauvegarde / chargement — le chargement passe par le déclencheur
// partagé (détection auto du format) ; l'enregistrement reste local à
// cet onglet, comme demandé.
// ------------------------------------------------------------------
async function doSaveProject() {
  await window.api.saveProject(JSON.stringify({ atariKind: 'hand', hand: params }, null, 2));
}
document.getElementById('btnHandSave').addEventListener('click', doSaveProject);
document.getElementById('btnHandLoad').addEventListener('click', triggerSmartLoad);

function loadParams(loaded) {
  params = { ...defaultHandParams(), ...loaded, pose: loaded.pose || {} };
  buildControlsUI();
  updateHandednessLabel();
  rebuild();
}

function doReset() {
  params = defaultHandParams();
  buildControlsUI();
  updateHandednessLabel();
  rebuild();
}
document.getElementById('btnHandReset').addEventListener('click', doReset);

// ------------------------------------------------------------------
// Enregistrement auprès du contrôleur d'onglets
// ------------------------------------------------------------------
registerTab('hand', {
  setActive(active) {
    isActive = active;
    if (active) resize();
  },
  doExportPNG,
  doSaveProject,
  doReset,
  getParams: () => params,
  loadParams,
});

// ------------------------------------------------------------------
// Boucle de rendu (en pause tant que l'onglet n'est pas actif)
// ------------------------------------------------------------------
resize();
function animate() {
  requestAnimationFrame(animate);
  if (!isActive) return;
  orbit.update();
  renderer.render(scene, camera);
}
animate();
