// preload.js — Pont sécurisé entre le renderer (page web) et le processus
// principal (accès disque). On n'expose que des fonctions précises, jamais
// tout ipcRenderer ou tout Node.js.

const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

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
  // Langue courante (menu Options > Langue), persistée côté main.js.
  getLanguage: () => ipcRenderer.invoke('get-language'),
  onLanguageChanged: (callback) => ipcRenderer.on('language-changed', (event, lang) => callback(lang))
});

// Dictionnaire de traduction : lu une fois, de façon SYNCHRONE (le preload
// a accès à Node/fs), et exposé tel quel — évite un fetch() asynchrone
// côté renderer pour un simple fichier JSON local.
const translations = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'src', 'translations.json'), 'utf-8')
);
contextBridge.exposeInMainWorld('i18nData', translations);
