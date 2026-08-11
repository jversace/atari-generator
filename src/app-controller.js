// app-controller.js — Coordonne les onglets "Corps" et "Main" sans que
// leur code respectif (main-renderer.js / hand-renderer.js) n'ait besoin
// de se connaître l'un l'autre : chacun s'enregistre via registerTab()
// avec une petite API commune, et ce fichier route les actions du menu
// natif (main.js) vers le bon onglet.
//
// C'est aussi ici que vit la détection de format au chargement (corps
// seul / main seule / les 2 / ancien fichier corps sans enveloppe), la
// sauvegarde combinée, et le cœur de l'internationalisation (t(), et la
// synchronisation avec la langue choisie dans le menu natif Options >
// Langue, dont main.js reste la seule source de vérité persistée).

const tabs = {}; // nom -> { setActive, doExportPNG, doSaveProject, doReset, getParams, loadParams, refreshLanguage }
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

  // L'affichage doit changer AVANT setActive() : chaque onglet appelle
  // resize() en devenant actif, qui lit clientWidth/clientHeight du
  // panneau — s'il est encore masqué à ce moment (display:none via
  // [hidden]), ces valeurs sont nulles et le canvas se retrouve
  // redimensionné à 0x0 (plus rien ne s'affiche, y compris en revenant
  // ensuite sur l'autre onglet).
  document.querySelectorAll('.tab-button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.hidden = panel.dataset.tab !== name;
  });

  for (const [key, api] of Object.entries(tabs)) {
    api.setActive(key === name);
  }
}

// --- Internationalisation --------------------------------------------------
// Dictionnaire ET langue courante lus via IPC (main.js -> get-translations /
// get-language) : le preload est sandboxé par défaut et n'a pas accès à
// fs/path pour lire le JSON lui-même (voir preload.js).
//
// Défensif à dessein : main-renderer.js et hand-renderer.js IMPORTENT ce
// module — si son évaluation de haut niveau lève une exception (IPC en
// échec...), les deux onglets ne se chargeraient plus du tout (ni le
// rendu 3D, ni les libellés). Mieux vaut retomber sur l'anglais brut/les
// clés que de tout bloquer.
let translations = {};
export let currentLang = 'en';
try {
  translations = await window.api.getTranslations();
  currentLang = await window.api.getLanguage();
  if (!translations[currentLang]) currentLang = 'en';
} catch (err) {
  console.error('Could not load translations/language, defaulting to English:', err);
}

export function t(key, vars) {
  let str = (translations[currentLang] && translations[currentLang][key]) || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, v);
  }
  return str;
}

function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
}
applyStaticTranslations();

window.api.onLanguageChanged((lang) => {
  currentLang = lang;
  applyStaticTranslations();
  for (const api of Object.values(tabs)) {
    api.refreshLanguage?.();
  }
});

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
    console.error('Invalid project file (unreadable JSON):', err);
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
    console.error('Unrecognized project file format.');
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
