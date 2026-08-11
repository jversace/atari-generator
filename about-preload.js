// about-preload.js — Pont sécurisé pour la fenêtre "À propos".
// Les infos viennent de package.json (voir main.js, handler 'get-about-info') :
// modifie package.json pour changer le nom, la version, l'auteur ou le lien
// GitHub — pas besoin de toucher à ce fichier.
//
// Comme preload.js : Electron sandboxe les scripts preload par défaut,
// require('fs')/require('path') n'y sont pas disponibles — tout passe par
// IPC.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aboutAPI', {
  getInfo: () => ipcRenderer.invoke('get-about-info'),
  getTranslations: () => ipcRenderer.invoke('get-translations')
});
