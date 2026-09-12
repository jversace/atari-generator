// preload.js — Pont sécurisé entre le renderer (page web) et le processus
// principal (accès disque). On n'expose que des fonctions précises, jamais
// tout ipcRenderer ou tout Node.js.
//
// IMPORTANT : Electron sandboxe les scripts preload par défaut (depuis la
// v20) — require('fs')/require('path') n'y sont PAS disponibles, seul
// require('electron') l'est. Tout accès disque (y compris lire un simple
// fichier JSON comme translations.json) doit donc passer par un appel IPC
// vers le processus principal, jamais par un require() direct ici.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  exportPNG: (dataUrl) => ipcRenderer.invoke('export-png', dataUrl),
  saveProject: (jsonString) => ipcRenderer.invoke('save-project', jsonString),
  loadProject: () => ipcRenderer.invoke('load-project'),
  // Le menu "Fichier" envoie les mêmes actions que les boutons du panneau
  // (voir main.js -> sendAction, et main-renderer.js -> onMenuAction).
  onMenuAction: (callback) => ipcRenderer.on('menu-action', (event, action) => callback(action)),
  // Options d'export (cases à cocher du menu Options > Options d'export),
  // persistées côté main.js.
  getExportOptions: () => ipcRenderer.invoke('get-export-options'),
  onExportOptionsChanged: (callback) => ipcRenderer.on('export-options-changed', (event, options) => callback(options)),
  // Langue courante (menu Options > Langue) et dictionnaire de traduction,
  // tous deux lus côté main.js (voir get-language / get-translations).
  getLanguage: () => ipcRenderer.invoke('get-language'),
  onLanguageChanged: (callback) => ipcRenderer.on('language-changed', (event, lang) => callback(lang)),
  getTranslations: () => ipcRenderer.invoke('get-translations'),
  // Modèle de référence (menu Options > Modèle), persisté côté main.js.
  // La confirmation ("les cotes vont être réinitialisées") est gérée
  // côté main.js AVANT l'envoi de cet événement.
  getModel: () => ipcRenderer.invoke('get-model'),
  onModelChanged: (callback) => ipcRenderer.on('model-changed', (event, modelId) => callback(modelId))
});
