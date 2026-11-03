const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, dialog, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { WindowWatcher, watcherScriptPath } = require('./native/window-watcher');
const { createJsonStore } = require('./json-store');

let win = null;
let tray = null;
let rebuildTray = () => {};

// le nom d'affichage a changé (TaskSlave) mais les données restent au même endroit
app.setPath('userData', path.join(app.getPath('appData'), 'taskdog'));

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// ---------- Fichiers ----------
const userFile = (name) => path.join(app.getPath('userData'), name);
const soundsDir = path.join(__dirname, '..', 'assets', 'sounds');

const store = createJsonStore({
  validators: {
    'tasks.json': value => Array.isArray(value) && value.every(task => task && typeof task.text === 'string'),
    'missions.json': value => value && Array.isArray(value.missions) && value.missions.every(m => m && Array.isArray(m.sessions))
  },
  onStatus: status => {
    if (win && !win.isDestroyed()) win.webContents.send('storage:status', status);
  }
});
const readJson = store.read;
const writeJson = store.write;

// ---------- Helper Win32 (PowerShell persistant) ----------
const watcher = new WindowWatcher(watcherScriptPath({
  isPackaged: app.isPackaged, resourcesPath: process.resourcesPath, sourceDir: __dirname
}), {
  onFailure: error => console.warn('Détection des fenêtres indisponible, nouvelle tentative :', error?.message)
});

// ---------- Conversions écran ----------
function dispInfo() {
  const d = screen.getPrimaryDisplay();
  return { s: d.scaleFactor, wa: d.workArea };
}

let ownHwnd = 0;

// ---------- Plateformes (fenêtres ouvertes) ----------
let polling = false;
async function pollWindows() {
  if (polling || !win || win.isDestroyed() || !win.isVisible()) return;
  polling = true;
  const res = await watcher.call({ op: 'windows' });
  polling = false;
  if (!res || !res.ok || !Array.isArray(res.data) || !win || win.isDestroyed()) return;
  const { s, wa } = dispInfo();
  win.webContents.send('apps', {
    titles: res.data.map(w => w.title), fg: res.fg || '',
    idleSeconds: powerMonitor.getSystemIdleTime()
  });
  const platforms = res.data
    .filter(w => Number(w.h) !== ownHwnd)
    .map(w => ({
      id: String(w.h),
      title: w.title,
      x1: w.l / s - wa.x,
      x2: w.r / s - wa.x,
      y: w.t / s - wa.y
    }))
    .filter(p => p.y > 45 && p.y < wa.height - 80 && (p.x2 - p.x1) >= 160);
  win.webContents.send('platforms', platforms);
}

// ---------- Desktop icons (names only, for the quips) ----------
const TIDY_DIRS = { fr: '🐕 Rangé par TaskDog', en: '🐕 Tidied by DoneDog' };
const TIDY_DIR_NAMES = new Set(Object.values(TIDY_DIRS));
const desktopPath = () => app.getPath('desktop');
const lang = () => (readJson(userFile('settings.json'), {}).language === 'fr' ? 'fr' : 'en');

function pollIcons() {
  if (!win || win.isDestroyed()) return;
  try {
    const names = fs.readdirSync(desktopPath())
      .filter(n => !n.startsWith('.') && n.toLowerCase() !== 'desktop.ini' && !TIDY_DIR_NAMES.has(n))
      .map(n => ({ name: n.replace(/\.(lnk|url)$/i, '') }));
    win.webContents.send('icons', names);
  } catch {}
}

// ---------- Tidy-up: moves desktop files into sorted folders ----------
const CATEGORIES = {
  fr: [
    ['Images', ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic', 'arw', 'raw']],
    ['Documents', ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'odt', 'csv', 'rtf']],
    ['Vidéos', ['mp4', 'mov', 'avi', 'mkv', 'webm']],
    ['Audio', ['mp3', 'wav', 'flac', 'ogg', 'm4a']],
    ['Archives', ['zip', 'rar', '7z', 'tar', 'gz', 'iso']],
    ['Installeurs', ['exe', 'msi', 'apk']],
    ['Code', ['js', 'ts', 'py', 'html', 'css', 'json', 'sh', 'bat', 'ipynb']]
  ],
  en: [
    ['Images', ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic', 'arw', 'raw']],
    ['Documents', ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'odt', 'csv', 'rtf']],
    ['Videos', ['mp4', 'mov', 'avi', 'mkv', 'webm']],
    ['Audio', ['mp3', 'wav', 'flac', 'ogg', 'm4a']],
    ['Archives', ['zip', 'rar', '7z', 'tar', 'gz', 'iso']],
    ['Installers', ['exe', 'msi', 'apk']],
    ['Code', ['js', 'ts', 'py', 'html', 'css', 'json', 'sh', 'bat', 'ipynb']]
  ]
};

function categoryOf(name) {
  const ext = path.extname(name).slice(1).toLowerCase();
  if (!ext || ['lnk', 'url'].includes(ext)) return null;   // raccourcis : pas touche
  for (const [cat, exts] of CATEGORIES[lang()]) if (exts.includes(ext)) return cat;
  return lang() === 'fr' ? 'Autres' : 'Others';
}

let tidying = false;
async function tidyDesktop() {
  if (tidying) return { ok: false, error: lang() === 'fr' ? 'déjà en cours' : 'already running' };
  const tidyDirName = TIDY_DIRS[lang()];
  const desk = desktopPath();
  let entries;
  try { entries = fs.readdirSync(desk, { withFileTypes: true }); }
  catch { return { ok: false, error: lang() === 'fr' ? 'bureau inaccessible' : 'desktop unreachable' }; }
  const files = entries.filter(e => e.isFile()
    && !e.name.startsWith('.')
    && e.name.toLowerCase() !== 'desktop.ini'
    && categoryOf(e.name));
  if (!files.length) return { ok: false, error: lang() === 'fr'
    ? 'rien à ranger (que des dossiers et raccourcis)'
    : 'nothing to tidy (only folders and shortcuts)' };

  tidying = true;
  const moves = [];
  let k = 0;
  for (const f of files) {
    const destDir = path.join(desk, tidyDirName, categoryOf(f.name));
    try {
      fs.mkdirSync(destDir, { recursive: true });
      const { name: base, ext } = path.parse(f.name);
      let dest = path.join(destDir, f.name);
      for (let n = 2; fs.existsSync(dest); n++) dest = path.join(destDir, `${base} (${n})${ext}`);
      fs.renameSync(path.join(desk, f.name), dest);
      moves.push({ from: path.join(desk, f.name), to: dest });
      if (win && !win.isDestroyed()) {
        win.webContents.send('tidy:step', { k: ++k, total: files.length, name: f.name });
      }
      await new Promise(r => setTimeout(r, 350));
    } catch {}
  }
  writeJson(userFile('tidy-backup.json'), { when: new Date().toISOString(), moves });
  tidying = false;
  if (win && !win.isDestroyed()) win.webContents.send('tidy:done', { count: moves.length });
  pollIcons();
  return moves.length
    ? { ok: true, count: moves.length }
    : { ok: false, error: lang() === 'fr' ? 'aucun fichier déplacé' : 'no files moved' };
}

async function untidyDesktop() {
  const backup = readJson(userFile('tidy-backup.json'), null);
  if (!backup || !Array.isArray(backup.moves)) return { ok: false, error: lang() === 'fr' ? 'pas de sauvegarde' : 'no backup' };
  let n = 0;
  for (const m of [...backup.moves].reverse()) {
    try {
      if (fs.existsSync(m.to) && !fs.existsSync(m.from)) { fs.renameSync(m.to, m.from); n++; }
    } catch {}
  }
  pollIcons();
  return { ok: true, count: n };
}

// ---------- Voix dynamique : Gemini TTS + cache local ----------
// Chaque phrase n'est générée qu'UNE fois (cache sha1), rotation de clés,
// plafond quotidien. Si tout échoue -> le renderer retombe sur la voix Windows.
const crypto = require('crypto');
const GEMINI_KEYS = readJson(app.isPackaged ? userFile('gemini-keys.json') : path.join(__dirname, '..', 'gemini-keys.json'), []);
const TTS_STYLE = {
  fr: 'Parle en français. Voix grave, fatiguée, pince-sans-rire, débit posé, '
    + 'comme un vieux manager blasé qui a tout vu. Ne surjoue pas. Dis : ',
  en: 'Speak in English. Deep, tired, deadpan voice, unhurried delivery, '
    + 'like an old jaded manager who has seen it all. Do not overact. Say: '
};
let keyIdx = 0;
let ttsUsage = readJson(userFile('tts-usage.json'), { day: '', count: 0 });

function wavFromPcm(raw, rate) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + raw.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36);
  h.writeUInt32LE(raw.length, 40);
  return Buffer.concat([h, raw]);
}

ipcMain.handle('tts:speak', async (e, text) => {
  try {
    if (!GEMINI_KEYS.length || !text || text.length > 260) return null;
    const cacheDir = path.join(app.getPath('userData'), 'tts-cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    const file = path.join(cacheDir, crypto.createHash('sha1').update(text).digest('hex').slice(0, 20) + '.wav');
    if (fs.existsSync(file)) {
      return 'data:audio/wav;base64,' + fs.readFileSync(file).toString('base64');
    }
    const day = new Date().toISOString().slice(0, 10);
    if (ttsUsage.day !== day) ttsUsage = { day, count: 0 };
    if (ttsUsage.count >= 40) return null;   // 3 clés × 15/jour, on garde une marge

    const body = JSON.stringify({
      contents: [{ parts: [{ text: TTS_STYLE[lang()] + '« ' + text + ' »' }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Algenib' } } }
      }
    });

    for (let a = 0; a < GEMINI_KEYS.length; a++) {
      const key = GEMINI_KEYS[(keyIdx + a) % GEMINI_KEYS.length];
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=' + key,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(15000) }
      );
      if (res.status === 429) continue;   // rotation de clé
      if (!res.ok) return null;
      const data = await res.json();
      const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (!part) return null;
      keyIdx = (keyIdx + a) % GEMINI_KEYS.length;
      const raw = Buffer.from(part.inlineData.data, 'base64');
      const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1] || 24000);
      const wav = wavFromPcm(raw, rate);
      fs.writeFileSync(file, wav);
      ttsUsage.count++;
      writeJson(userFile('tts-usage.json'), ttsUsage);
      return 'data:audio/wav;base64,' + wav.toString('base64');
    }
    return null;
  } catch { return null; }
});

// ---------- Bonus : météo + launchers de jeux (pour les vannes) ----------
let weatherCache = { at: 0, data: null };
async function getWeather() {
  if (Date.now() - weatherCache.at < 3600000) return weatherCache.data;
  try {
    // on ne sauvegarde et on ne relit que des coordonnées valides — sinon un
    // échec ipapi écrivait {} une fois et condamnait la météo pour toujours
    let geo = readJson(userFile('geo.json'), null);
    if (!geo || typeof geo.lat !== 'number' || typeof geo.lon !== 'number') {
      const r = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(8000) });
      const g = await r.json();
      if (typeof g.latitude !== 'number' || typeof g.longitude !== 'number') throw new Error('geolocation unavailable');
      geo = { lat: g.latitude, lon: g.longitude };
      writeJson(userFile('geo.json'), geo);
    }
    const r2 = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,weather_code`, { signal: AbortSignal.timeout(8000) });
    const w = await r2.json();
    if (typeof w.current?.temperature_2m !== 'number') throw new Error('weather unavailable');
    const code = w.current.weather_code ?? 0;
    weatherCache = {
      at: Date.now(),
      data: { temp: Math.round(w.current.temperature_2m), rain: code >= 51 && code <= 99 }
    };
  } catch { weatherCache = { at: Date.now(), data: null }; }
  return weatherCache.data;
}

let gameLaunchers = 0;
function scanLaunchers() {
  const names = ['steam', 'epic games', 'riot', 'battle.net', 'gog galaxy', 'ubisoft connect', 'ea app'];
  const dirs = [
    path.join(process.env.PROGRAMDATA || '', 'Microsoft/Windows/Start Menu/Programs'),
    path.join(app.getPath('appData'), 'Microsoft/Windows/Start Menu/Programs')
  ];
  const found = new Set();
  const walk = (dir, depth) => {
    if (depth > 2) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e2 of entries) {
      const lower = e2.name.toLowerCase();
      for (const n of names) if (lower.includes(n)) found.add(n);
      if (e2.isDirectory()) walk(path.join(dir, e2.name), depth + 1);
    }
  };
  for (const d of dirs) walk(d, 0);
  gameLaunchers = found.size;
}

// ---------- Tête custom ----------
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp' };

function findHeadFile() {
  try {
    const f = fs.readdirSync(app.getPath('userData')).find(n => n.startsWith('head.'));
    return f ? userFile(f) : null;
  } catch { return null; }
}

function headDataUrl() {
  const file = findHeadFile();
  if (!file) return null;
  const ext = path.extname(file).slice(1).toLowerCase();
  try {
    return `data:${MIME[ext] || 'image/png'};base64,${fs.readFileSync(file).toString('base64')}`;
  } catch { return null; }
}

async function pickHead() {
  const fr = lang() === 'fr';
  const r = await dialog.showOpenDialog(win, {
    title: fr ? 'Choisis la nouvelle tête du chien' : 'Choose the dog’s new face',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: Object.keys(MIME) }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  const src = r.filePaths[0];
  const ext = path.extname(src).slice(1).toLowerCase();
  clearHead();
  fs.copyFileSync(src, userFile('head.' + (MIME[ext] ? ext : 'png')));
  return headDataUrl();
}

function clearHead() {
  const file = findHeadFile();
  if (file) { try { fs.unlinkSync(file); } catch {} }
}

// ---------- Fenêtre ----------
function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();

  win = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    title: 'DoneDog',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  win.webContents.session.setPermissionCheckHandler(() => false);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => {
    win.showInactive();
    try { ownHwnd = Number(win.getNativeWindowHandle().readBigUInt64LE(0)); } catch {}
  });

  screen.on('display-metrics-changed', () => {
    const wa = screen.getPrimaryDisplay().workArea;
    win.setBounds({ x: wa.x, y: wa.y, width: wa.width, height: wa.height });
  });
}

// ---------- Tray ----------
function createTray() {
  let icon;
  try {
    icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray.png'));
    if (icon.isEmpty()) throw new Error('empty');
  } catch { icon = nativeImage.createEmpty(); }
  tray = new Tray(icon);

  const rebuild = rebuildTray = () => {
    const fr = lang() === 'fr';
    tray.setToolTip(fr ? 'DoneDog — je compte, c’est mon travail.' : 'DoneDog — I count. It’s my job.');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: `DoneDog · v${app.getVersion()}`, enabled: false },
      { label: fr ? 'Ouvrir les tâches' : 'Open tasks', click: () => { win.showInactive(); win.webContents.send('panel:open', 'tasks'); } },
      { label: fr ? 'Réglages et aide' : 'Settings and help', click: () => { win.showInactive(); win.webContents.send('panel:open', 'settings'); } },
      { type: 'separator' },
      {
        label: fr ? '🌐 English' : '🌐 Français',
        click: () => {
          win.webContents.send('language:set', fr ? 'en' : 'fr');
        }
      },
      { type: 'separator' },
      {
        label: win.isVisible() ? (fr ? 'Cacher le chien' : 'Hide the dog') : (fr ? 'Montrer le chien' : 'Show the dog'),
        click: () => { win.isVisible() ? win.hide() : win.showInactive(); rebuild(); }
      },
      {
        label: fr ? '🔊 Lire mes tâches' : '🔊 Read my tasks',
        click: () => { if (!win.isVisible()) win.showInactive(); win.webContents.send('speak-tasks'); }
      },
      { type: 'separator' },
      { label: fr ? '🖼️ Changer la tête du chien' : '🖼️ Change the dog’s face', click: async () => { const d = await pickHead(); win.webContents.send('head', d); } },
      { label: fr ? '🐕 Remettre la vraie tête' : '🐕 Bring back the real face', click: () => { clearHead(); win.webContents.send('head', null); } },
      { type: 'separator' },
      {
        label: fr ? '🧍 Humain à 4 pattes' : '🧍 Human on all fours',
        type: 'checkbox',
        checked: readJson(userFile('settings.json'), {}).skin === 'human',
        click: (item) => win.webContents.send('skin:set', item.checked ? 'human' : 'dog')
      },
      {
        label: fr ? '🔇 Mode silencieux' : '🔇 Silent mode',
        type: 'checkbox',
        checked: readJson(userFile('settings.json'), {}).muted === true,
        click: (item) => win.webContents.send('muted:set', item.checked)
      },
      {
        label: fr ? 'Lancer au démarrage de Windows' : 'Launch at Windows startup',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked })
      },
      { type: 'separator' },
      { label: fr ? 'Quitter' : 'Quit', click: () => app.quit() }
    ]));
  };
  rebuild();
  tray.on('click', () => { if (!win.isVisible()) { win.showInactive(); rebuild(); } });
}

// ---------- Cycle de vie ----------
app.whenReady().then(() => {
  try { fs.mkdirSync(soundsDir, { recursive: true }); } catch {}
  createWindow();
  createTray();
  watcher.start();
  setTimeout(scanLaunchers, 8000);
  setInterval(pollWindows, 1600);
  setTimeout(pollIcons, 4000);
  setInterval(pollIcons, 90000);
});

app.on('second-instance', () => { if (win) win.showInactive(); });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => watcher.stop());

// ---------- IPC ----------
ipcMain.handle('storage:status', () => store.status());
ipcMain.handle('storage:retry', () => store.retry());
ipcMain.handle('tasks:load', () => readJson(userFile('tasks.json'), []));
ipcMain.on('tasks:save', (e, tasks) => writeJson(userFile('tasks.json'), tasks));
ipcMain.handle('missions:load', () => readJson(userFile('missions.json'), { version: 1, missions: [], running: null }));
ipcMain.on('missions:save', (e, data) => writeJson(userFile('missions.json'), data));
ipcMain.handle('sys:idleSeconds', () => { try { return powerMonitor.getSystemIdleTime(); } catch { return 0; } });
ipcMain.handle('missions:exportCsv', async (e, csv, suggestedName) => {
  const fr = lang() === 'fr';
  const r = await dialog.showSaveDialog(win, {
    title: fr ? 'Exporter les sessions en CSV' : 'Export sessions to CSV',
    defaultPath: suggestedName || 'missions.csv',
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (r.canceled || !r.filePath) return false;
  try { fs.writeFileSync(r.filePath, '﻿' + csv, 'utf8'); return true; } // BOM = Excel FR happy
  catch { return false; }
});
ipcMain.handle('settings:load', () => readJson(userFile('settings.json'), { xp: 0 }));
ipcMain.on('settings:save', (e, s) => {
  const previous = readJson(userFile('settings.json'), {});
  if (!writeJson(userFile('settings.json'), s)) return;
  if (['language', 'muted', 'skin'].some(key => previous[key] !== s[key])) rebuildTray();
});
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('settings:language', (e, language) => {
  if (!['fr', 'en'].includes(language)) return false;
  const s = readJson(userFile('settings.json'), {});
  s.language = language;
  if (!writeJson(userFile('settings.json'), s)) return false;
  rebuildTray();
  return true;
});
ipcMain.handle('sounds:list', () => {
  // relative paths with the language folder: 'fr/hello.wav', 'en/wake.wav', ...
  const walk = (rel) => {
    let entries;
    try { entries = fs.readdirSync(path.join(soundsDir, rel), { withFileTypes: true }); } catch { return []; }
    const out = [];
    for (const e of entries) {
      const relPath = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) out.push(...walk(relPath));
      else if (/\.(mp3|wav|ogg)$/i.test(e.name)) out.push(relPath);
    }
    return out;
  };
  return walk('');
});
ipcMain.on('mouse:ignore', (e, ignore) => { if (win) win.setIgnoreMouseEvents(ignore, { forward: true }); });
ipcMain.on('window:blur', () => { if (win) win.blur(); });
ipcMain.on('app:quit', () => app.quit());
ipcMain.handle('desktop:tidy', () => tidyDesktop());
ipcMain.handle('desktop:untidy', () => untidyDesktop());
ipcMain.handle('sys:info', async () => {
  let diskFreeGb = null;
  try {
    const s = fs.statfsSync('C:\\');
    diskFreeGb = Math.round(s.bsize * s.bavail / 1e9);
  } catch {}
  const boot = new Date(Date.now() - os.uptime() * 1000);
  return {
    uptimeH: Math.round(os.uptime() / 360) / 10,
    freeMemGb: Math.round(os.freemem() / 1e8) / 10,
    totalMemGb: Math.round(os.totalmem() / 1e8) / 10,
    diskFreeGb,
    bootH: boot.getHours(),
    bootM: boot.getMinutes(),
    bootToday: boot.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10),
    gameLaunchers,
    weather: await getWeather()
  };
});
ipcMain.handle('head:get', () => headDataUrl());
ipcMain.handle('head:pick', () => pickHead());
ipcMain.handle('head:clear', () => { clearHead(); return null; });
