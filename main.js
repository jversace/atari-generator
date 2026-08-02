// main.js — Processus principal Electron.
// Gère la fenêtre de l'application, le menu, et les opérations fichiers
// (export PNG, sauvegarde/chargement de projet) qui doivent passer par
// Node.js.

const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const pkg = require('./package.json');

const APP_NAME = (pkg.build && pkg.build.productName) || pkg.name;

let mainWindow;

// --- Mémorisation du dernier répertoire utilisé --------------------------
// Persisté dans le dossier de données utilisateur de l'app (survit aux
// redémarrages), pas dans le projet lui-même.
const configPath = path.join(app.getPath('userData'), 'atari-generator-config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config), 'utf-8');
  } catch (err) {
    console.error('Impossible d\'enregistrer la configuration :', err);
  }
}

let config = loadConfig();
config.exportOptions = Object.assign(
  { constructionMode: false, includeGrid: false },
  config.exportOptions || {}
);

function rememberDir(filePath) {
  config.lastDir = path.dirname(filePath);
  saveConfig(config);
}

// Chemin par défaut proposé dans les boîtes de dialogue : dernier
// répertoire utilisé (mémorisé) + nom de fichier par défaut.
function defaultPathFor(filename) {
  return config.lastDir ? path.join(config.lastDir, filename) : filename;
}

// --- Fenêtre "À propos" ---------------------------------------------------
let aboutWindow = null;

function openAboutWindow() {
  if (aboutWindow) { aboutWindow.focus(); return; }

  aboutWindow = new BrowserWindow({
    width: 380,
    height: 420,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWindow,
    modal: true,
    title: `À propos de ${APP_NAME}`,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'about-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  aboutWindow.setMenuBarVisibility(false);
  aboutWindow.loadFile('about.html');
  aboutWindow.on('closed', () => { aboutWindow = null; });
}

// Les infos affichées dans about.html sont lues d'ici — pas besoin de
// toucher à main.js pour changer le contenu, seulement about.html.
ipcMain.handle('get-about-info', () => ({
  name: APP_NAME,
  version: pkg.version,
  author: pkg.author,
  license: pkg.license,
  homepage: pkg.homepage
}));

ipcMain.handle('get-export-options', () => config.exportOptions);

// --- Menu ------------------------------------------------------------
function buildMenu() {
  const sendAction = (action) => () => {
    if (mainWindow) mainWindow.webContents.send('menu-action', action);
  };

  const toggleExportOption = (key) => (menuItem) => {
    config.exportOptions[key] = menuItem.checked;
    saveConfig(config);
    if (mainWindow) mainWindow.webContents.send('export-options-changed', config.exportOptions);
  };

  const template = [
    {
      label: 'Fichier',
      submenu: [
        { label: 'Exporter en PNG…', click: sendAction('export-png') },
        {
          label: 'Options d\'export',
          submenu: [
            {
              label: 'Mode traits de construction',
              type: 'checkbox',
              checked: config.exportOptions.constructionMode,
              click: toggleExportOption('constructionMode')
            },
            {
              label: 'Inclure le plan',
              type: 'checkbox',
              checked: config.exportOptions.includeGrid,
              click: toggleExportOption('includeGrid')
            }
          ]
        },
        { label: 'Enregistrer le projet…', accelerator: 'CmdOrCtrl+S', click: sendAction('save-project') },
        { label: 'Charger un projet…', accelerator: 'CmdOrCtrl+O', click: sendAction('load-project') },
        { type: 'separator' },
        { label: 'Réinitialiser', click: sendAction('reset') },
        { type: 'separator' },
        { role: 'quit', label: 'Quitter' }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Recharger' },
        { role: 'forceReload', label: 'Forcer le rechargement' },
        { role: 'toggleDevTools', label: 'Outils de développement' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Taille réelle' },
        { role: 'zoomIn', label: 'Zoom avant' },
        { role: 'zoomOut', label: 'Zoom arrière' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein écran' }
      ]
    },
    {
      label: 'Fenêtre',
      submenu: [
        { role: 'minimize', label: 'Réduire' },
        { role: 'close', label: 'Fermer' }
      ]
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'Documentation',
          click: () => { if (pkg.homepage) shell.openExternal(pkg.homepage); }
        },
        { type: 'separator' },
        { label: `À propos de ${APP_NAME}`, click: openAboutWindow }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#2b2b2b',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    title: `${APP_NAME} — v${pkg.version}`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // index.html a son propre <title> statique : on l'empêche d'écraser le
  // titre (nom + version) qu'on vient de définir ci-dessus.
  mainWindow.on('page-title-updated', (event) => event.preventDefault());

  mainWindow.loadFile('index.html');
  // Décommente la ligne suivante si tu as besoin de déboguer à nouveau :
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- Export PNG -------------------------------------------------------
// Le renderer envoie une dataURL (image/png). On demande où l'enregistrer
// puis on écrit les octets sur disque.
ipcMain.handle('export-png', async (event, dataUrl) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter en PNG',
    defaultPath: defaultPathFor('atari.png'),
    filters: [{ name: 'Images PNG', extensions: ['png'] }]
  });
  if (canceled || !filePath) return { ok: false };

  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  rememberDir(filePath);
  return { ok: true, filePath };
});

// --- Sauvegarde de projet (JSON des paramètres) ------------------------
ipcMain.handle('save-project', async (event, jsonString) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer le projet',
    defaultPath: defaultPathFor('projet.atari.json'),
    filters: [{ name: 'Projet Atari', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { ok: false };

  fs.writeFileSync(filePath, jsonString, 'utf-8');
  rememberDir(filePath);
  return { ok: true, filePath };
});

// --- Chargement de projet ----------------------------------------------
ipcMain.handle('load-project', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Charger un projet',
    defaultPath: config.lastDir || undefined,
    filters: [{ name: 'Projet Atari', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (canceled || filePaths.length === 0) return { ok: false };

  const content = fs.readFileSync(filePaths[0], 'utf-8');
  rememberDir(filePaths[0]);
  return { ok: true, content };
});
