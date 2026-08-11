// main.js — Processus principal Electron.
// Gère la fenêtre de l'application, le menu, et les opérations fichiers
// (export PNG, sauvegarde/chargement de projet) qui doivent passer par
// Node.js.

const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const pkg = require('./package.json');
const translations = require('./src/translations.json');

const APP_NAME = (pkg.build && pkg.build.productName) || pkg.name;

let mainWindow;

// --- Configuration persistée (dernier répertoire, options d'export, langue)
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
  { constructionMode: false, includeGrid: false, transparentBackground: false },
  config.exportOptions || {}
);
config.language = config.language || 'en'; // anglais par défaut

function rememberDir(filePath) {
  config.lastDir = path.dirname(filePath);
  saveConfig(config);
}

// Chemin par défaut proposé dans les boîtes de dialogue : dernier
// répertoire utilisé (mémorisé) + nom de fichier par défaut.
function defaultPathFor(filename) {
  return config.lastDir ? path.join(config.lastDir, filename) : filename;
}

// --- Traduction (labels du menu natif + titres de boîtes de dialogue) ----
function t(key, vars) {
  let str = (translations[config.language] && translations[config.language][key]) || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, v);
  }
  return str;
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
    title: t('menu.help.about', { app: APP_NAME }),
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
  homepage: pkg.homepage,
  language: config.language
}));

ipcMain.handle('get-export-options', () => config.exportOptions);
ipcMain.handle('get-language', () => config.language);
ipcMain.handle('get-translations', () => translations);

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

  const setLanguage = (lang) => () => {
    if (config.language === lang) return;
    config.language = lang;
    saveConfig(config);
    if (mainWindow) mainWindow.webContents.send('language-changed', lang);
    buildMenu(); // reconstruit le menu avec les nouveaux libellés
  };

  const template = [
    {
      label: t('menu.file'),
      submenu: [
        { label: t('menu.file.export'), click: sendAction('export-png') },
        { label: t('menu.file.saveActive'), accelerator: 'CmdOrCtrl+S', click: sendAction('save-project') },
        { label: t('menu.file.saveAll'), click: sendAction('save-project-all') },
        { label: t('menu.file.load'), accelerator: 'CmdOrCtrl+O', click: sendAction('load-project') },
        { type: 'separator' },
        { label: t('menu.file.reset'), click: sendAction('reset') },
        { type: 'separator' },
        { role: 'quit', label: t('menu.file.quit') }
      ]
    },
    {
      label: t('menu.options'),
      submenu: [
        {
          label: t('menu.options.export'),
          submenu: [
            {
              label: t('menu.options.constructionMode'),
              type: 'checkbox',
              checked: config.exportOptions.constructionMode,
              click: toggleExportOption('constructionMode')
            },
            {
              label: t('menu.options.includeGrid'),
              type: 'checkbox',
              checked: config.exportOptions.includeGrid,
              click: toggleExportOption('includeGrid')
            },
            {
              label: t('menu.options.transparentBg'),
              type: 'checkbox',
              checked: config.exportOptions.transparentBackground,
              click: toggleExportOption('transparentBackground')
            }
          ]
        },
        {
          label: t('menu.options.language'),
          submenu: [
            {
              label: t('menu.options.language.en'),
              type: 'radio',
              checked: config.language === 'en',
              click: setLanguage('en')
            },
            {
              label: t('menu.options.language.fr'),
              type: 'radio',
              checked: config.language === 'fr',
              click: setLanguage('fr')
            }
          ]
        }
      ]
    },
    {
      label: t('menu.view'),
      submenu: [
        { role: 'reload', label: t('menu.view.reload') },
        { role: 'forceReload', label: t('menu.view.forceReload') },
        { role: 'toggleDevTools', label: t('menu.view.devTools') },
        { type: 'separator' },
        { role: 'resetZoom', label: t('menu.view.actualSize') },
        { role: 'zoomIn', label: t('menu.view.zoomIn') },
        { role: 'zoomOut', label: t('menu.view.zoomOut') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t('menu.view.fullscreen') }
      ]
    },
    {
      label: t('menu.window'),
      submenu: [
        { role: 'minimize', label: t('menu.window.minimize') },
        { role: 'close', label: t('menu.window.close') }
      ]
    },
    {
      label: t('menu.help'),
      submenu: [
        {
          label: t('menu.help.docs'),
          click: () => { if (pkg.homepage) shell.openExternal(pkg.homepage); }
        },
        { type: 'separator' },
        { label: t('menu.help.about', { app: APP_NAME }), click: openAboutWindow }
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
  // Réactivées temporairement le temps de confirmer le correctif i18n —
  // recommente cette ligne une fois que tout s'affiche correctement.
  mainWindow.webContents.openDevTools();
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
    title: t('dialog.exportPng.title'),
    defaultPath: defaultPathFor('atari.png'),
    filters: [{ name: 'PNG', extensions: ['png'] }]
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
    title: t('dialog.saveProject.title'),
    defaultPath: defaultPathFor('projet.atari.json'),
    filters: [{ name: 'Atari project', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { ok: false };

  fs.writeFileSync(filePath, jsonString, 'utf-8');
  rememberDir(filePath);
  return { ok: true, filePath };
});

// --- Chargement de projet ----------------------------------------------
ipcMain.handle('load-project', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: t('dialog.loadProject.title'),
    defaultPath: config.lastDir || undefined,
    filters: [{ name: 'Atari project', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (canceled || filePaths.length === 0) return { ok: false };

  const content = fs.readFileSync(filePaths[0], 'utf-8');
  rememberDir(filePaths[0]);
  return { ok: true, content };
});
