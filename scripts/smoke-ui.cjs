// Exercise the real renderer in an isolated, invisible Electron window.
// No user data, window watcher, online voice or desktop files are accessed.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const output = path.join(root, 'dist', 'qa-ui');
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, 'profile'));
app.disableHardwareAcceleration();

let storedTasks = [];
let storedSettings = { language: 'fr', muted: true, xp: 0 };
let storedMissions = { version: 1, missions: [], running: null };
let storageStatus = [];
for (const [channel, callback] of Object.entries({
  'tasks:load': () => storedTasks,
  'settings:load': () => storedSettings,
  'missions:load': () => storedMissions,
  'sounds:list': () => [], 'head:get': () => null, 'sys:info': () => null,
  'sys:idleSeconds': () => 0, 'tts:speak': () => null,
  'app:version': () => require('../package.json').version,
  'storage:status': () => storageStatus,
  'storage:retry': () => { storageStatus = []; return storageStatus; },
  'settings:language': (_, language) => { storedSettings.language = language; return true; }
})) ipcMain.handle(channel, callback);
ipcMain.on('tasks:save', (_, data) => { storedTasks = data; });
ipcMain.on('settings:save', (_, data) => { storedSettings = data; });
ipcMain.on('missions:save', (_, data) => { storedMissions = data; });
for (const name of ['mouse:ignore', 'window:blur']) ipcMain.on(name, () => {});

let win;
const errors = [];
const timeout = setTimeout(() => { console.error('UI smoke test timed out'); app.exit(1); }, 45000);
async function page(fn) { return win.webContents.executeJavaScript(`(${fn.toString()})()`); }
async function snapshot(name) {
  await page(() => { positionBubble(); document.body.style.background = '#dce5df'; });
  await page(async () => { await new Promise(r => setTimeout(r, 280)); });
  const bounds = await page(() => {
    const b = bubble.getBoundingClientRect();
    return { x: Math.floor(b.x), y: Math.floor(b.y), width: Math.ceil(b.width), height: Math.ceil(b.height) };
  });
  const shot = await win.webContents.capturePage(bounds);
  fs.writeFileSync(path.join(output, name + '.png'), shot.toPNG());
}

app.whenReady().then(async () => {
  win = new BrowserWindow({ show: false, width: 1100, height: 900, webPreferences: {
    preload: path.join(root, 'src', 'preload.js'), offscreen: true, backgroundThrottling: false,
    contextIsolation: true, nodeIntegration: false
  } });
  win.webContents.on('console-message', (_event, details) => {
    if (details.level === 'error') errors.push(details.message);
  });
  await win.loadFile(path.join(root, 'src', 'renderer', 'index.html'));
  await page(async () => {
    window.addEventListener('error', e => console.error(e.message));
    window.addEventListener('unhandledrejection', e => console.error(String(e.reason)));
    for (let i = 0; i < 100 && !document.body.dataset.ready; i++) await new Promise(r => setTimeout(r, 20));
  });
  assert.equal(await page(() => document.getElementById('app-version').textContent), 'DoneDog · v' + require('../package.json').version);
  assert.equal(await page(() => bubble.classList.contains('hidden')), false, 'Welcome panel opens on first launch');
  assert.equal(await page(() => document.getElementById('tab-tasks').textContent), 'Tâches');
  await snapshot('welcome-fr');
  await page(() => {
    document.getElementById('btn-welcome').click();
    taskInput.value = 'Préparer la maquette'; document.getElementById('btn-add').click();
    taskInput.value = 'Envoyer le devis'; taskInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  assert.equal(await page(() => tasks.length), 2, 'Add tasks through both controls');
  assert.equal(await page(() => taskList.querySelectorAll('li').length), 2, 'Tasks render without translation collisions');
  await page(() => {
    taskList.querySelector('button.start').click();
    taskList.querySelector('.picker button').click();
  });
  assert.equal(await page(() => activeTask.total), 25);
  assert.equal(await page(() => quietDuringFocus()), true);
  assert.equal(await page(() => canAmbientComment(performance.now() + 3600000)), false, 'No spontaneous remarks during focus');
  await page(async () => { await toggleBubble(); });
  await snapshot('tasks-fr');
  await page(() => {
    const check = taskList.querySelector('input[type="checkbox"]');
    check.checked = true; check.dispatchEvent(new Event('change'));
  });
  assert.equal(await page(() => activeTask), null, 'Completing a task finishes its timer');
  assert.equal(await page(() => tasks.filter(task => task.done).length), 1);
  assert.equal(await page(() => taskCount.textContent), '1 tâche à faire');
  await page(() => {
    document.getElementById('btn-settings').click();
    const presence = document.getElementById('presence-select'); presence.value = 'quiet'; presence.dispatchEvent(new Event('change'));
  });
  assert.equal(await page(() => canAmbientComment(performance.now() + 3600000)), false, 'Quiet mode suppresses ambient remarks');
  await snapshot('settings-fr');
  await page(async () => {
    await changeLanguage('en');
    showSettings(false); setMissionTab('missions');
    document.querySelector('#missions-view > button.primary').click();
  });
  assert.equal(await page(() => document.getElementById('tab-tasks').textContent), 'Tasks');
  await page(() => {
    const form = document.querySelector('#missions-view form');
    const fields = form.querySelectorAll('input');
    fields[0].value = 'Studio'; fields[1].value = 'Website'; fields[2].value = '8';
    form.requestSubmit();
  });
  assert.equal(await page(() => missionStore.missions.length), 1, 'Mission form creates a project');
  await page(() => document.querySelector('.mission-row .m-btn').click());
  const startedAt = await page(() => missionStore.running.startedAt);
  await page(async () => { await changeLanguage('fr'); });
  assert.equal(await page(() => missionStore.running.startedAt), startedAt, 'Language switch preserves live mission');
  await page(() => {
    missionStore.running.startedAt = new Date(Date.now() - 30000).toISOString();
    document.querySelector('.mission-row .m-btn').click();
    document.querySelector('.mission-row .m-title').click();
  });
  assert.equal(await page(() => missionStore.missions[0].sessions.length), 1, 'Short work sessions are saved');
  await snapshot('missions-fr');
  // Sound callbacks must not reset an airborne or dragged character to idle.
  assert.equal(await page(async () => {
    const RealAudio = window.Audio;
    const previousMuted = settings.muted;
    window.Audio = class { constructor() { window.testSound = this; } play() { this.onplay(); return Promise.resolve(); } pause() {} };
    soundFiles = ['fr/yelp.wav']; settings.muted = false;
    dog.state = JUMP;
    const sound = playSound('yelp');
    const during = dog.state;
    dog.state = DRAG;
    window.testSound.onended();
    await sound;
    const after = dog.state;
    window.Audio = RealAudio; settings.muted = previousMuted; soundFiles = []; setState(IDLE, 10000);
    return during === JUMP && after === DRAG;
  }), true, 'Speech preserves motion');
  await page(() => {
    const originalContext = window.AudioContext;
    window.AudioContext = class { constructor() { throw new Error('Zero volume must not start a sound'); } };
    settings.volume = 0; settings.muted = false;
    playSlash();
    window.AudioContext = originalContext; settings.volume = 0.65; settings.muted = true;
  });
  await page(() => {
    whipCrack = { start: performance.now(), from: { x: 40, y: 40 }, to: { x: 80, y: 80 } };
    drawCrack();
    whipCrack = null;
  });
  win.setSize(420, 600);
  await page(async () => { await new Promise(r => setTimeout(r, 100)); showSettings(true); positionBubble(); });
  assert.equal(await page(() => {
    const b = bubble.getBoundingClientRect();
    return b.x >= 0 && b.y >= 0 && b.right <= innerWidth && b.bottom <= innerHeight && bubble.scrollWidth <= bubble.clientWidth;
  }), true, 'Small-screen settings remain in the viewport without horizontal overflow');
  await snapshot('settings-small-fr');
  storageStatus = [{ file: 'tasks.json', kind: 'save-failed' }];
  win.webContents.send('storage:status', storageStatus);
  await page(async () => { await new Promise(r => setTimeout(r, 50)); });
  assert.equal(await page(() => document.getElementById('storage-notice').classList.contains('hidden')), false);
  assert.match(await page(() => document.getElementById('storage-message').textContent), /Sauvegarde impossible/);
  await snapshot('storage-warning-fr');
  await page(async () => {
    document.getElementById('storage-retry').click();
    await new Promise(r => setTimeout(r, 50));
  });
  assert.equal(await page(() => document.getElementById('storage-notice').classList.contains('hidden')), true, 'Retry clears a resolved save error');
  await page(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(await page(() => bubble.classList.contains('hidden')), true, 'Escape closes panel');
  await page(async () => { await toggleBubble(); showSettings(false); setMissionTab('tasks'); });
  assert.equal(await page(() => {
    const originalNow = performance.now.bind(performance);
    const originalRandom = Math.random;
    let clock = 600000;
    try {
      Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
      Math.random = () => 0.52;
      settings.quietDuringFocus = false;
      observedIdleSeconds = 0; dog.platformId = 'ground'; platforms = [];
      lastBipedAt = 0; lastTrickAt = 0;
      pickNextState();
      const first = dog.trick.kind;
      clock += 90000;
      pickNextState();
      const second = dog.trick.kind;
      dog.trick = null; clock += 10000;
      pickNextState();
      const third = dog.state;
      observedIdleSeconds = 120;
      pickNextState();
      return first === 'biped' && second === 'shake' && third !== PLAY && dog.state === SLEEP;
    } finally {
      Object.defineProperty(performance, 'now', { configurable: true, value: originalNow });
      Math.random = originalRandom; observedIdleSeconds = 0;
      dog.trick = null; setState(IDLE, 10000);
    }
  }), true, 'Tricks cannot repeat rapidly, the censored gag waits eight minutes, and PC inactivity allows sleep');
  assert.equal(await page(() => {
    settings.presence = 'companion'; settings.muted = true;
    bubble.classList.add('hidden'); dog.speaking = false;
    lastCommentAt = 0; lastRoast = 0;
    let clock = 1000000;
    const background = { titles: ['Video - YouTube - Opera', 'Notes'], fg: 'Notes', idleSeconds: 0 };
    for (let i = 0; i < 40; i++) observeApps(background, clock += 1600);
    const noBackgroundRoast = lastRoast === 0;
    const foreground = { ...background, fg: 'Video - YouTube - Opera' };
    for (let i = 0; i < 20; i++) observeApps(foreground, clock += 1600);
    const noPrematureRoast = lastRoast === 0;
    for (let i = 0; i < 20; i++) observeApps(foreground, clock += 1600);
    const sustainedRoast = lastRoast > 0;
    const roastAt = lastRoast;
    for (let i = 0; i < 160; i++) observeApps(foreground, clock += 1600);
    const oncePerVisit = lastRoast === roastAt;
    setState(SLEEP, 0);
    observeApps(background, clock += 1600);
    const wakesOnReturn = dog.state !== SLEEP;
    settings.presence = 'quiet';
    window.taskdog.saveSettings(settings);
    return noBackgroundRoast && noPrematureRoast && sustainedRoast && oncePerVisit && wakesOnReturn;
  }), true, 'Background tabs cause no roast; sustained foreground use can trigger one, once per visit; returning wakes the dog');
  const loaded = new Promise(resolve => win.webContents.once('did-finish-load', resolve));
  win.webContents.reload();
  await loaded;
  await page(async () => {
    for (let i = 0; i < 100 && !document.body.dataset.ready; i++) await new Promise(r => setTimeout(r, 20));
  });
  assert.equal(await page(() => settings.presence), 'quiet', 'Preferences survive reload');
  assert.equal(await page(() => tasks.length), 2, 'Tasks survive reload');
  assert.equal(await page(() => document.getElementById('welcome').classList.contains('hidden')), true, 'Welcome dismissed only once');
  assert.deepEqual(errors, [], 'No renderer errors');
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: true, screenshots: 6, errors, storedTasks: storedTasks.length, storedMissions: storedMissions.missions.length }, null, 2));
  console.log('PASS: real renderer, bilingual task/timer/mission flows, presence, audio, persistence and small-screen layout.');
  clearTimeout(timeout); app.exit(0);
}).catch(error => { console.error(error); clearTimeout(timeout); app.exit(1); });
