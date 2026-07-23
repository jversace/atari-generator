// preload.js — Pont sécurisé entre le renderer (page web) et le processus
// principal (accès disque). On n'expose que des fonctions précises, jamais
// tout ipcRenderer ou tout Node.js.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  exportPNG: (dataUrl) => ipcRenderer.invoke('export-png', dataUrl),
  saveProject: (jsonString) => ipcRenderer.invoke('save-project', jsonString),
  loadProject: () => ipcRenderer.invoke('load-project'),
  // Le menu "Fichier" envoie les mêmes actions que les boutons du panneau
  // (voir main.js -> sendAction, et main-renderer.js -> onMenuAction).
  onMenuAction: (callback) => ipcRenderer.on('menu-action', (event, action) => callback(action))
});
