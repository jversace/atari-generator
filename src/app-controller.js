// app-controller.js — Coordonne les onglets "Corps" et "Main" sans que
// leur code respectif (main-renderer.js / hand-renderer.js) n'ait besoin
// de se connaître l'un l'autre : chacun s'enregistre via registerTab()
// avec une petite API commune, et ce fichier route les actions du menu
// natif (main.js) vers le bon onglet.
//
// C'est aussi ici que vit la détection de format au chargement (corps
// seul / main seule / les 2 / ancien fichier corps sans enveloppe) et la
// sauvegarde combinée — la seule vraie nouveauté transverse aux 2 onglets.

const tabs = {}; // nom -> { setActive, doExportPNG, doSaveProject, doReset, getParams, loadParams }
let activeTab = 'body';

export function registerTab(name, api) {
  tabs[name] = api;
}

export function getActiveTab() {
  return activeTab;
}

export function setActiveTab(name) {
  if (!tabs[name] || activeTab === name) return;
  activeTab = name;
  for (const [key, api] of Object.entries(tabs)) {
    api.setActive(key === name);
  }
  document.querySelectorAll('.tab-button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.hidden = panel.dataset.tab !== name;
  });
}

// --- Détection de format d'un fichier projet ------------------------------
// - Ancien format (corps seul, sans enveloppe) : détecté par la présence
//   d'une clé propre au corps (thorax/pelvis/upperArm) — reste compatible
//   avec tous les fichiers des versions précédentes.
// - Nouveaux formats : enveloppés dans { atariKind: 'hand' | 'combined', ... }.
function detectFormat(json) {
  if (!json || typeof json !== 'object') return null;
  if (json.atariKind === 'combined') return 'combined';
  if (json.atariKind === 'hand') return 'hand';
  if (json.thorax || json.pelvis || json.upperArm) return 'body';
  return null;
}

async function doLoadProjectSmart() {
  const res = await window.api.loadProject();
  if (!res.ok) return;

  let json;
  try {
    json = JSON.parse(res.content);
  } catch (err) {
    console.error('Fichier de projet invalide (JSON illisible) :', err);
    return;
  }

  const format = detectFormat(json);
  if (format === 'body') {
    tabs.body.loadParams(json);
    setActiveTab('body');
  } else if (format === 'hand') {
    tabs.hand.loadParams(json.hand);
    setActiveTab('hand');
  } else if (format === 'combined') {
    tabs.body.loadParams(json.body);
    tabs.hand.loadParams(json.hand);
    // On reste sur l'onglet déjà actif : les deux ont été chargés.
  } else {
    console.error('Format de fichier projet non reconnu.');
  }
}

async function doSaveAll() {
  const json = {
    atariKind: 'combined',
    body: tabs.body.getParams(),
    hand: tabs.hand.getParams(),
  };
  await window.api.saveProject(JSON.stringify(json, null, 2));
}

// Déclencheur partagé par le bouton "Charger" de CHAQUE onglet et par le
// menu Fichier > Charger : un seul point d'entrée, un seul comportement.
export function triggerSmartLoad() {
  doLoadProjectSmart();
}

// --- Routage des actions du menu natif (main.js) --------------------------
window.api.onMenuAction((action) => {
  if (action === 'load-project') { doLoadProjectSmart(); return; }
  if (action === 'save-project-all') { doSaveAll(); return; }

  const api = tabs[activeTab];
  if (!api) return;
  if (action === 'export-png') api.doExportPNG();
  if (action === 'save-project') api.doSaveProject();
  if (action === 'reset') api.doReset();
});

// --- Barre d'onglets --------------------------------------------------------
document.querySelectorAll('.tab-button').forEach((btn) => {
  btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
});
