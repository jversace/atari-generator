// about-preload.js — Pont sécurisé pour la fenêtre "À propos".
// Les infos viennent de package.json (voir main.js, handler 'get-about-info') :
// modifie package.json pour changer le nom, la version, l'auteur ou le lien
// GitHub — pas besoin de toucher à ce fichier.

const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('aboutAPI', {
  getInfo: () => ipcRenderer.invoke('get-about-info')
});

// Même dictionnaire que la fenêtre principale (voir preload.js), lu une
// fois de façon synchrone.
const translations = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'src', 'translations.json'), 'utf-8')
);
contextBridge.exposeInMainWorld('i18nData', translations);
