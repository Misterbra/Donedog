// TaskDog v4 — chien de bureau : parkour, zoomies, niche, os enterrés,
// cerveau contextuel (fenêtres ↔ tâches ↔ journal), todo vocale, XP.

const SCALE = 5;
const DOG_W = SPRITE_W * SCALE;
const DOG_H = SPRITE_H * SCALE;
const GROUND_MARGIN = 4;
const GRAVITY = 0.004;           // px/ms²

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const hit = document.getElementById('hit');
const bubble = document.getElementById('bubble');
const woufEl = document.getElementById('wouf');
const taskInput = document.getElementById('task-input');
const taskList = document.getElementById('task-list');
const taskCount = document.getElementById('task-count');
const bubbleTitle = document.getElementById('bubble-title');
const dogLevelEl = document.getElementById('dog-level');
const btnHead = document.getElementById('btn-head');
const reportEl = document.getElementById('report');

let tasks = [];
let settings = { xp: 0, journal: {} };
let soundFiles = [];
let platforms = [];
let desktopIcons = [];
let headImg = null;
let tidyRun = null;
let appTitles = [];
let lastRoast = 0;
let lastLinkQuip = 0;
let taskLinks = {};              // taskId -> { since } : il t'a vu bosser dessus
let zoomiesUntil = 0;
let flipStart = 0;
let clickTimes = [];
let pendingClickTimer = null;
let mounds = [];                 // os enterrés {x}
let lastFetch = 0;
let jdirty = false;
let lastMouse = { x: -9999, y: -9999, t: 0 };
let sysInfo = null;              // uptime, RAM, disque
let batteryInfo = null;
let fgPrev = '';
let switchTimes = [];            // changements de fenêtre (fenêtre glissante 10 min)
let fgTaskSec = {};              // taskId -> secondes de focus réel sur une fenêtre liée
let fgTaskWin = {};
let activeTask = null;           // le chrono en cours { id, text, deadlineAt, total, fired }
const activityTracker = DoneDogActivity.createActivityTracker();
let observedIdleSeconds = 0;
let lastRoastedVisit = -1;
let lastTrickAt = 0;
let lastBipedAt = 0;
let lastZoomiesAt = 0;
let skin = SKINS.dog;            // 'dog' ou 'human' (l'humain à 4 pattes)

function setSkin(name) {
  skin = SKINS[name] || SKINS.dog;
  settings.skin = SKINS[name] ? name : 'dog';
  window.currentSkinName = settings.skin;   // les banques de phrases s'adaptent au skin
  window.taskdog.saveSettings(settings);
  showQuip(t(
    name === 'human'
      ? 'Voilà. Un humain à quatre pattes. T’es content ? Moi ça me va, je juge pas.'
      : 'Wouf. Retour du professionnel.',
    name === 'human'
      ? 'There. A human on all fours. Happy now? Fine by me, I don’t judge.'
      : 'Woof. The professional is back.'
  ), 3500);
}

// ---------- Canvas ----------
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

const groundY = () => canvas.height - GROUND_MARGIN;
const nicheX = () => canvas.width - NICHE_W * SCALE - 24;

// ---------- Le chien ----------
const IDLE = 'idle', WALK = 'walk', SIT = 'sit', SLEEP = 'sleep',
      BARK = 'bark', DRAG = 'drag', FALL = 'fall', TALK = 'talk',
      JUMP = 'jump', ZOOM = 'zoomies', FETCH = 'fetch', DIG = 'dig',
      MOTIV = 'motivate', SNIFF = 'sniff', PLAY = 'play';

let muteUntil = 0;               // le bâton a parlé
const stick = { x: 0, y: 0 };
let stickDrag = null;

const dog = {
  x: Math.max(40, window.innerWidth * 0.3),
  feetY: 0,
  dir: 1,
  state: IDLE,
  stateUntil: 0,
  phase: 0,
  vx: 0,
  vy: 0,
  platformId: 'ground',
  lastInteraction: performance.now(),
  lastJump: 0,
  lastQuip: 0,
  mission: null,                 // { targetX, onArrive }
  fetch: null,                   // { phase: 'leave'|'away'|'return', until, targetX }
  hasBone: false,
  hidden: false,
  trick: null,                   // { kind: 'biped'|'shake', start }
  stumbleAt: 0,
  stretchUntil: 0
};
dog.feetY = groundY();

let censorFx = null;             // mosaïque de censure sur le numéro raté { start, until }
let puddleFx = null;             // la flaque de l'incident censuré { x, y, start, until }
let interludeFx = null;          // mire TV « incident canin » { start, until, x }
let lastInterlude = 0;

function setState(s, durationMs) {
  dog.state = s;
  dog.stateUntil = performance.now() + (durationMs || 0);
}

function surfaceUnder() {
  if (dog.platformId === 'ground') return { id: 'ground', x1: 0, x2: canvas.width, y: groundY() };
  return platforms.find(p => p.id === dog.platformId) || null;
}

function centerX() { return dog.x + DOG_W / 2; }
function pending() { return tasks.filter(t => !t.done); }
function journal() { return settings.journal; }

function pickNextState() {
  const now = performance.now();
  if (quietDuringFocus()) { setState(SIT, 5000); return; }
  if (observedIdleSeconds >= 120 && dog.platformId === 'ground') { goSleepAtNiche(); return; }
  if (dog.platformId === 'ground' && now - lastFetch > 300000 && Math.random() < 0.07) { startFetch(); return; }
  // garantie parkour : s'il y a une fenêtre posable et qu'il n'a pas sauté
  // depuis 90 s, il y va, point.
  if (platforms.length && now - dog.lastJump > 90000 && maybeJump(true)) return;
  if (maybeJump()) return;
  const r = Math.random();
  if (r < 0.04 && dog.platformId === 'ground' && now - lastZoomiesAt >= 90000) {
    startZoomies(false);    // ça le prend, comme ça, sans raison
  } else if (r < 0.32) {
    dog.dir = Math.random() < 0.5 ? -1 : 1;
    setState(WALK, 3000 + Math.random() * 5000);
  } else if (r < 0.48) {
    goExplore();       // il part découvrir un truc et le renifle
  } else if (r < 0.56 && now - lastTrickAt >= 60000) {
    // un numéro : tentative de bipédie (qui dégénère derrière une censure) ou secouage de chien mouillé
    const biped = dog.platformId === 'ground' && now - lastBipedAt >= 480000 && Math.random() < 0.55;
    lastTrickAt = now;
    if (biped) lastBipedAt = now;
    dog.trick = { kind: biped ? 'biped' : 'shake', start: now };
    setState(PLAY, dog.trick.kind === 'biped' ? 3800 : 1100);
    if (Math.random() < 0.35) dogQuip('play', 2200);
  } else if (r >= 0.56 && r < 0.58 && dog.platformId === 'ground' && now - lastInterlude > 480000) {
    startInterlude();  // mire TV : incident canin, merci de patienter
  } else if (r < 0.75) {
    setState(IDLE, 3000 + Math.random() * 4000);
  } else {
    setState(SIT, 5000 + Math.random() * 7000);
  }
}

// ---------- Exploration : il va renifler les points d'intérêt ----------
function goExplore() {
  const spots = [
    Math.random() * (canvas.width - DOG_W),          // un coin au hasard
    Math.random() * (canvas.width - DOG_W),
    stick.x - 40                                     // le fouet (il se méfie)
  ];
  for (const m of mounds) spots.push(m.x - DOG_W / 2);   // ses os enterrés
  const target = Math.min(Math.max(spots[Math.floor(Math.random() * spots.length)], 0), canvas.width - DOG_W);
  dog.mission = {
    targetX: target,
    onArrive: () => {
      setState(SNIFF, 1200 + Math.random() * 1200);
      if (Math.random() < 0.25) dogQuip('sniff', 2500);
    }
  };
  setState(WALK, 60000);
}

// ---------- Sommeil : il se pose où il est ----------
function goSleepAtNiche() {
  setState(SLEEP, 0);
}

// ---------- Mission "os" (hors écran) ----------
function startFetch() {
  lastFetch = performance.now();
  const leftDist = dog.x, rightDist = canvas.width - dog.x;
  const exitX = leftDist < rightDist ? -DOG_W - 20 : canvas.width + 20;
  dog.fetch = { phase: 'leave', until: 0, exitX };
  dog.dir = exitX < 0 ? -1 : 1;
  setState(FETCH, 0);
}

function tickFetch(now, dt) {
  const f = dog.fetch;
  if (f.phase === 'leave') {
    dog.x += dog.dir * dt * 0.07;
    if (dog.x < -DOG_W - 10 || dog.x > canvas.width + 10) {
      f.phase = 'away';
      f.until = now + 5000 + Math.random() * 10000;
      dog.hidden = true;
    }
  } else if (f.phase === 'away') {
    if (now >= f.until) {
      f.phase = 'return';
      dog.hidden = false;
      dog.hasBone = true;
      dog.dir *= -1;
      f.targetX = 80 + Math.random() * (canvas.width - 300);
    }
  } else if (f.phase === 'return') {
    dog.x += dog.dir * dt * 0.07;
    if (Math.abs(dog.x - f.targetX) < 14) {
      dog.fetch = null;
      setState(DIG, 2600);
    } else {
      dog.dir = f.targetX > dog.x ? 1 : -1;
    }
  }
}

function finishDig() {
  dog.hasBone = false;
  mounds.push({ x: centerX() });
  if (mounds.length > 6) mounds.shift();
  dogQuip('bury', 3200);
}
PHRASES_DATA.fr.bury = [
  'Un os. Enterré. Emplacement confidentiel.',
  'J’ai investi. Ne pose pas de questions.',
  'Ça, c’est fait. Contrairement à d’autres choses ici.'
];
PHRASES_DATA.en.bury = [
  'A bone. Buried. Location confidential.',
  'I invested. Don’t ask questions.',
  'That’s done. Unlike some other things around here.'
];

// ---------- Parkour ----------
function maybeJump(force = false) {
  const now = performance.now();
  if (!force && (now - dog.lastJump < 20000 || Math.random() < 0.4)) return false;
  const cx = centerX();
  const reach = force ? 480 : 340;
  const candidates = platforms.filter(p => {
    if (p.id === dog.platformId) return false;
    const dy = dog.feetY - p.y;
    // sauteur cartoon : il monte très haut, c'est le but
    if (force ? (dy < -300 || dy > 640) : (dy <= 60 || dy > 560)) return false;
    const nearX = Math.min(Math.max(cx, p.x1), p.x2);
    return Math.abs(nearX - cx) < reach && (p.x2 - p.x1) > DOG_W + 30;
  });
  if (!candidates.length) return false;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  const tx = Math.min(Math.max(dog.x, target.x1 + 10), target.x2 - DOG_W - 10);
  jumpTo(tx, target.y);
  if (force && Math.random() < 0.6) flipStart = now;
  if (!force) dogQuip('jump', 1400);
  return true;
}

function hopInPlace() {
  dog.vy = -Math.sqrt(2 * GRAVITY * (70 + Math.random() * 70));
  dog.vx = dog.dir * 0.12;
  dog.platformId = null;
  flipStart = performance.now();
  setState(JUMP, 0);
}

function jumpTo(tx, ty) {
  const dh = Math.max(dog.feetY - ty, 10);
  const vy0 = -Math.sqrt(2 * GRAVITY * (dh + 60));
  const tApex = -vy0 / GRAVITY;
  const apexH = (vy0 * vy0) / (2 * GRAVITY);
  const tFall = Math.sqrt(Math.max(2 * (apexH - dh), 1) / GRAVITY);
  const T = tApex + tFall;
  dog.vy = vy0;
  dog.vx = (tx - dog.x) / T;
  dog.dir = dog.vx >= 0 ? 1 : -1;
  dog.platformId = null;
  dog.lastJump = performance.now();
  setState(JUMP, 0);
}

function landCheck(prevFeetY) {
  if (dog.vy <= 0) return false;
  const cx = centerX();
  let best = null;
  for (const p of platforms) {
    if (cx < p.x1 - 6 || cx > p.x2 + 6) continue;
    if (prevFeetY <= p.y + 2 && dog.feetY >= p.y) {
      if (!best || p.y < best.y) best = p;
    }
  }
  if (!best && dog.feetY >= groundY()) best = { id: 'ground', y: groundY() };
  if (!best) return false;
  dog.feetY = best.y;
  dog.platformId = best.id;
  dog.vy = 0;
  dog.vx = 0;
  flipStart = 0;
  spawnDust();
  if (performance.now() < zoomiesUntil) setState(ZOOM, 0);
  else setState(IDLE, 400 + Math.random() * 600);
  return true;
}

window.taskdog.onPlatforms((list) => {
  platforms = list;
  if (dog.platformId && dog.platformId !== 'ground' && ![DRAG, JUMP, FALL].includes(dog.state)) {
    const p = platforms.find(q => q.id === dog.platformId);
    const cx = centerX();
    if (!p || Math.abs(p.y - dog.feetY) > 6 || cx < p.x1 - 10 || cx > p.x2 + 10) {
      dog.platformId = null;
      dog.vy = 0;
      setState(FALL, 0);
    } else {
      dog.feetY = p.y;
    }
  }
});

window.taskdog.onIcons((list) => { desktopIcons = list; });

// ---------- Cerveau : apps, roasts, liens tâches ↔ fenêtres, journal ----------
function observeApps(payload, now = performance.now()) {
  if (!document.body.dataset.ready) return;
  const titles = payload.titles || [];
  const fg = payload.fg || '';
  appTitles = titles;
  const pend = pending();

  observedIdleSeconds = Number.isFinite(payload.idleSeconds) ? Math.max(0, payload.idleSeconds) : 0;
  const detector = APP_DETECTORS.find(d => d.test.test(fg));
  const activity = activityTracker.sample({ now, title: fg, idleSeconds: observedIdleSeconds, key: detector?.key });
  accumulateAppTime(journal(), titles, activity.seconds);
  accumulateFocus(journal(), fg, activity.seconds);
  if (fg && fg !== fgPrev && !activity.away) {
    noteSwitch(journal());
    switchTimes.push(now);
  }
  fgPrev = fg;
  if (dog.state === SLEEP && observedIdleSeconds < 2) wake(false);
  switchTimes = switchTimes.filter(t => now - t < 600000);
  // focus réel sur une fenêtre qui parle d'une tâche
  const fgLink = findTaskWindowLink(pend, fg ? [fg] : []);
  if (fgLink) {
    fgTaskSec[fgLink.task.id] = (fgTaskSec[fgLink.task.id] || 0) + activity.seconds;
    fgTaskWin[fgLink.task.id] = fg;
  }
  jdirty = true;

  // il repère que tu bosses (enfin) sur une tâche
  if (now - lastLinkQuip > 600000 && canAmbientComment(now)) {
    const link = activity.seconds > 0 ? fgLink : null;
    if (link && !taskLinks[link.task.id]) {
      taskLinks[link.task.id] = { since: Date.now() };
      lastLinkQuip = now;
      wake(false);
      setState(BARK, 900);
      showQuip(linkQuip(link), 5200);
    } else if (link) {
      taskLinks[link.task.id].lastSeen = Date.now();
    }
  }

  // New foreground-only statistics stay separate from old presence-based data.
  const j = journalToday(journal());
  if (!j.visits) j.visits = {};
  if (activity.started) j.visits[activity.key] = (j.visits[activity.key] || 0) + 1;
  if (activity.ended) {
    const { key, seconds } = activity.ended;
    const p = settings.focusPatterns[key] || { n: 0, total: 0 };
    p.n++; p.total += seconds / 60;
    settings.focusPatterns[key] = p;
  }

  // ---- records personnels (annoncés une fois par jour) ----
  const rec = settings.records;
  const distraction = minutesOf(j, x => x.procrastination);
  if (distraction >= 30 && distraction > (rec.focusDistraction?.value || 0)) {
    const announce = rec.focusDistraction?.announcedDay !== todayKey() && rec.focusDistraction?.value > 0;
    rec.focusDistraction = { value: distraction, announcedDay: announce ? todayKey() : rec.focusDistraction?.announcedDay };
    if (announce && canAmbientComment(now)) {
      const m = recordRoast('distraction', distraction);
      showQuip(m, 5000);
      speak(m);
    }
  }

  // ---- roast composé : app de procrastination qui vient de s'ouvrir ----
  const roastCd = settings.presence === 'chatty' ? 90000 : 180000;
  if (now - lastRoast > roastCd && canAmbientComment(now) && pend.length) {
    const key = detector?.procrastination && activity.sessionSeconds >= 45
      && activity.visit !== lastRoastedVisit && !fgLink ? activity.key : null;
    if (key) {
      lastRoastedVisit = activity.visit;
      lastRoast = now;
      j.roasts = (j.roasts || 0) + 1;
      wake(false);
      setState(BARK, 1200);
      const facts = buildFacts(key);
      const p = settings.focusPatterns[key];
      const txt = (p && p.n >= 3 && Math.random() < 0.3)
        ? patternRoast(facts.appLabel, Math.round(p.total / p.n))
        : composeRoast(facts, settings.saidRoasts);
      jdirty = true;
      showQuip(txt, Math.max(3800, txt.length * 62));
      speak(txt);
    }
  }
}
window.taskdog.onApps(payload => observeApps(payload));

// Toutes les données croisées disponibles sur CE moment précis.
function buildFacts(key) {
  const jj = journalToday(journal());
  const pend = pending();
  const fgMin = (k) => Math.round(((jj.fg || {})[k] || 0) / 60);
  const days = Object.keys(journal()).sort();
  let yesterdayAppMin = 0, worstDay = null;
  for (let i = 0; i < days.length - 1; i++) {
    const dj = journal()[days[i]];
    const m = Math.round(((dj.fg || {})[key] || 0) / 60);
    if (i === days.length - 2) yesterdayAppMin = m;
    if (m >= 30 && (!worstDay || m > worstDay.min)) worstDay = { label: frDay(days[i]), min: m };
  }
  const p = settings.focusPatterns[key];
  const ot = oldestTask(pend);
  return {
    appKey: key,
    appLabel: APP_LABELS[currentLang()][key] || key,
    openCount: (jj.visits || {})[key] || 1,
    appMinToday: fgMin(key),
    avgSession: p && p.n ? Math.round(p.total / p.n) : 0,
    sessionCount: p ? p.n : 0,
    oldestTask: ot ? { text: shortText(ot.t.text), days: ot.days } : null,
    pendingCount: pend.length,
    doneToday: jj.done || 0,
    hour: new Date().getHours(),
    yesterdayAppMin,
    worstDay,
    switches10: switchTimes.length,
    distractionToday: minutesOf(jj, x => x.procrastination),
    chronoActive: !!activeTask,
    chronoTask: activeTask ? shortText(activeTask.text, 22) : '',
    escalation: Math.min(Math.floor(((jj.roasts || 1) - 1) / 2), 2),
    record: null
  };
}

function frDay(iso) {
  const names = currentLang() === 'fr'
    ? ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[new Date(iso + 'T12:00:00').getDay()];
}

function topFgTask() {
  let best = null;
  for (const id of Object.keys(fgTaskSec)) {
    const t = tasks.find(x => String(x.id) === id && !x.done);
    if (t && (!best || fgTaskSec[id] > best.sec)) best = { task: t, sec: fgTaskSec[id], win: fgTaskWin[id] || '' };
  }
  return best && best.sec >= 720
    ? { task: best.task, minutes: Math.round(best.sec / 60), win: best.win }
    : null;
}

setInterval(() => {
  if (jdirty) { jdirty = false; window.taskdog.saveSettings(settings); }
}, 45000);

// ---------- Zoomies (3 clics rapides) ----------
function startZoomies(userInitiated = true) {
  closeBubble();
  wake();
  zoomiesUntil = performance.now() + 5000 + Math.random() * 3000;
  lastZoomiesAt = performance.now();
  dog.dir = Math.random() < 0.5 ? -1 : 1;
  dog.mission = null;
  dog.fetch = null;
  dog.hidden = false;
  journalToday(journal()).zoomies++;
  jdirty = true;
  setState(ZOOM, 0);
  if (userInitiated || canAmbientComment(performance.now(), true)) {
    dogQuip('zoomies', 2500);
    playSound('zoomies');
  }
  spawnHearts(4);
}

// ---------- Particules ----------
let particles = [];
function spawnDust() {
  for (let i = 0; i < 5; i++) {
    particles.push({
      type: 'dust',
      x: centerX() + (Math.random() - 0.5) * DOG_W * 0.7,
      y: dog.feetY - 3,
      vx: (Math.random() - 0.5) * 0.06,
      vy: -Math.random() * 0.03,
      life: 500 + Math.random() * 300,
      t: 0
    });
  }
}
function spawnHearts(n = 3) {
  for (let i = 0; i < n; i++) {
    particles.push({
      type: 'heart',
      x: dog.x + DOG_W * 0.6 + (Math.random() - 0.5) * 30,
      y: dog.feetY - DOG_H,
      vx: (Math.random() - 0.5) * 0.02,
      vy: -0.04 - Math.random() * 0.03,
      life: 1200,
      t: 0
    });
  }
}
function spawnSparkle(x, y) {
  particles.push({ type: 'spark', x, y, vx: 0, vy: -0.02, life: 700, t: 0 });
}

function drawHeart(x, y, s) {
  ctx.fillStyle = '#e04141';
  ctx.fillRect(x, y, s, s); ctx.fillRect(x + 2 * s, y, s, s);
  ctx.fillRect(x - s, y + s, 4 * s, s);
  ctx.fillRect(x, y + 2 * s, 2 * s, s);
  ctx.fillRect(x + s / 2, y + 3 * s, s, s);
}

function drawParticles(dt) {
  particles = particles.filter(p => (p.t += dt) < p.life);
  for (const p of particles) {
    const k = 1 - p.t / p.life;
    if (p.type === 'collar') p.vy += dt * 0.00045;
    if (p.type === 'pee') {
      p.vy += dt * 0.0004;
      if (p.floorY && p.y >= p.floorY) { p.y = p.floorY; p.vx *= 0.6; p.vy = 0; }
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    ctx.globalAlpha = k;
    if (p.type === 'dust') {
      ctx.fillStyle = '#c9baa5';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 + (1 - k) * 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'heart') {
      drawHeart(p.x, p.y, 3);
    } else if (p.type === 'collar') {
      // le collier expulsé, qui tournoie avec la dignité qui reste
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.t / 90);
      ctx.strokeStyle = PALETTE.r;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(-1, 4, 3, 3);   // la médaille
      ctx.restore();
    } else if (p.type === 'pee') {
      ctx.fillStyle = '#e8c93a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(p.x - 4, p.y - 1, 8, 2);
      ctx.fillRect(p.x - 1, p.y - 4, 2, 8);
    }
  }
  ctx.globalAlpha = 1;
}

// ---------- Boucle ----------
let lastT = performance.now();
function tick(now) {
  const dt = Math.min(50, now - lastT);
  lastT = now;
  dog.phase += dt / 1000;

  const bubbleOpen = !bubble.classList.contains('hidden');
  const surf = surfaceUnder();
  if (quietDuringFocus() && !tidyRun && [WALK, ZOOM, PLAY, MOTIV, SNIFF].includes(dog.state)) {
    dog.mission = null;
    dog.trick = null;
    zoomiesUntil = 0;
    setState(SIT, 5000);
  }

  // le fouet touche le chien pendant que tu l'agites → SLAAHH + cri
  if (stickDrag && !dog.hidden && now - lastWhipHit > 650) {
    const tip = whipTrail[0] || stick;
    const inDog = (p) => p.x > dog.x - 10 && p.x < dog.x + DOG_W + 10
      && p.y > dog.feetY - DOG_H - 20 && p.y < dog.feetY + 12;
    if (inDog(tip) || inDog(stick)) whipTouch();
  }

  if (dog.state === WALK) {
    const speed = tidyRun ? 0.14 : (dog.mission ? 0.07 : 0.045);
    dog.x += dog.dir * dt * speed;
    const min = surf ? surf.x1 + 4 : 0;
    const max = (surf ? surf.x2 : canvas.width) - DOG_W - 4;
    if (tidyRun) {
      if (Math.abs(dog.x - tidyRun.targetX) < 12) setState(IDLE, 200);
      dog.dir = tidyRun.targetX > dog.x ? 1 : -1;
      dog.x = Math.min(Math.max(dog.x, 0), canvas.width - DOG_W);
    } else if (dog.mission) {
      dog.dir = dog.mission.targetX > dog.x ? 1 : -1;
      if (Math.abs(dog.x - dog.mission.targetX) < 14) {
        const m = dog.mission;
        dog.mission = null;
        m.onArrive();
      }
    } else if (dog.x <= min || dog.x >= max) {
      if (dog.platformId !== 'ground' && Math.random() < 0.4) {
        dog.platformId = null;
        dog.vy = 0;
        setState(FALL, 0);
      } else {
        dog.x = Math.min(Math.max(dog.x, min), max);
        dog.dir *= -1;
      }
    } else if (!dog.mission && Math.random() < dt / 150000 && now - dog.stumbleAt > 60000) {
      // trébuchement : personne n'est parfait, surtout pas lui
      dog.stumbleAt = now;
      spawnDust();
      if (Math.random() < 0.4) dogQuip('stumble', 2200);
    }
  }

  if (dog.state === FETCH) tickFetch(now, dt);

  if (dog.state === DIG) {
    if (Math.random() < dt / 180) spawnDust();
    if (now >= dog.stateUntil) { finishDig(); setState(IDLE, 800); }
  }

  if (dog.state === PLAY && dog.trick) {
    if (dog.trick.kind === 'shake' && Math.random() < dt / 200) spawnDust();
    if (dog.trick.kind === 'biped') {
      const tt = now - dog.trick.start;
      if (tt >= 1400 && !dog.trick.censored) {
        // il bascule → censure immédiate, le fail n'existera jamais officiellement
        dog.trick.censored = true;
        censorFx = { start: now, until: dog.stateUntil + 400 };
      }
      // derrière la mosaïque ça se débat : la poussière gicle des bords
      if (dog.trick.censored && Math.random() < dt / 70) spawnCensorDust();
      if (dog.trick.censored && tt >= 1900 && !dog.trick.collarOff) {
        // il se déshabille : le collier est expulsé du cadre
        dog.trick.collarOff = true;
        spawnCollarToss();
      }
      if (dog.trick.collarOff && tt >= 2300) {
        // et là-dessous, il pisse. La mosaïque ne contient pas tout.
        if (!puddleFx) puddleFx = { x: centerX(), y: dog.feetY, start: now, until: censorFx.until + 6500 };
        if (Math.random() < dt / 60) spawnPeeLeak();
      }
    }
    if (now >= dog.stateUntil) {
      if (dog.trick.kind === 'biped') {
        spawnDust();
        dogQuip('trickfall', 3000);
        dog.trick = null;
        setState(SIT, 2200);   // assis, impeccable, comme si de rien n'était
      } else {
        dog.trick = null;
      }
    }
  }

  if (dog.state === SNIFF && Math.random() < dt / 300) {
    // petits nuages au bout du museau
    particles.push({
      type: 'dust',
      x: dog.x + (dog.dir === 1 ? DOG_W - 4 : 4) + (Math.random() - 0.5) * 8,
      y: dog.feetY - DOG_H * 0.55,
      vx: dog.dir * 0.02,
      vy: -0.015,
      life: 350,
      t: 0
    });
  }

  if (dog.state === ZOOM) {
    dog.x += dog.dir * dt * 0.28;
    const zmin = surf ? surf.x1 : 0;
    const zmax = (surf ? surf.x2 : canvas.width) - DOG_W;
    if (dog.x <= zmin || dog.x >= zmax) {
      dog.x = Math.min(Math.max(dog.x, Math.min(zmin, zmax)), Math.max(zmin, zmax));
      dog.dir *= -1;
      spawnDust();
    }
    if (Math.random() < dt / 900) {
      if (!maybeJump(true)) hopInPlace();
    }
    if (now > zoomiesUntil) {
      zoomiesUntil = 0;
      setState(SIT, 2800);
      dogQuip('pant', 2800);
    }
  }

  if (dog.state === FALL || dog.state === JUMP) {
    const prevFeetY = dog.feetY;
    dog.vy += GRAVITY * dt;
    dog.feetY += dog.vy * dt;
    dog.x += (dog.vx || 0) * dt;
    dog.x = Math.min(Math.max(dog.x, 0), canvas.width - DOG_W);
    landCheck(prevFeetY);
  }

  if (![DRAG, JUMP, FALL, FETCH].includes(dog.state) && dog.platformId !== 'ground' && !surf) {
    dog.platformId = null;
    dog.vy = 0;
    setState(FALL, 0);
  }

  if (![DRAG, FALL, SLEEP, TALK, JUMP, ZOOM, FETCH, DIG].includes(dog.state) && now >= dog.stateUntil) {
    if (tidyRun) setState(WALK, 9999);
    else if (dog.mission) setState(WALK, 60000);
    else if (bubbleOpen) setState(SIT, 5000);
    else pickNextState();
  }
  if (bubbleOpen && dog.state === WALK && !tidyRun && !dog.mission) setState(SIT, 5000);

  // vanne ambiante — contextuelle si possible (sauf s'il a pris un coup de bâton)
  if (canAmbientComment(now) &&
      now - dog.lastInteraction > 30000 && now - dog.lastQuip > 75000 && Math.random() < dt / 25000) {
    dog.lastQuip = now;
    const r = Math.random();
    if (r < 0.12) {
      // son mantra. Il s'assoit, il le récite. Il ne l'explique jamais.
      setState(SIT, 3200);
      dogSay('mantra');
    } else if (r < 0.3) {
      // coaching de rue, debout sur les pattes arrière
      const text = randPhrase('motivation');
      showQuip(text, Math.max(3500, text.length * 70));
      setState(MOTIV, 3400);
      if (Math.random() < 0.6) speak(text);
    } else {
      const ctxQuip = chooseContextQuip({
        titles: fgPrev ? [fgPrev] : [], pending: pending(), windowsCount: appTitles.length,
        journal: journal(), sys: sysInfo, battery: batteryInfo,
        switches10: switchTimes.length, fgTask: topFgTask()
      });
      if (ctxQuip && r < 0.75) {
        showQuip(ctxQuip.text, Math.max(3200, ctxQuip.text.length * 65));
        if (ctxQuip.intel && Math.random() < 0.45) speak(ctxQuip.text, null, { local: ctxQuip.private });
        else playSound('bored');
      } else if (desktopIcons.length && r < 0.85) {
        const icon = desktopIcons[Math.floor(Math.random() * desktopIcons.length)];
        showQuip(iconQuip(icon.name), 3500);
        playSound('bored');
      } else if (!settings.petName && Math.random() < 0.25) {
        showQuip(t('Toujours pas de nom, au fait. Je réponds à « le chien ». C’est un choix.',
                   'Still no name, by the way. I answer to “the dog”. It’s a lifestyle.'), 4200);
      } else {
        dogSay('bored');
      }
    }
  }

  draw(now, dt);
  positionHit();
  positionStickHit();
  tickTimer();
  if (bubbleOpen) updatePresenceStatus();
  if (!woufEl.classList.contains('hidden')) positionWouf();   // la bulle suit le chien
  if (bubbleOpen) positionBubble();
  requestAnimationFrame(tick);
}

// ---------- Rendu ----------
function isAlert(now) {
  if (![IDLE, WALK, SIT].includes(dog.state)) return false;
  if (now - lastMouse.t > 2500) return false;
  const d = Math.hypot(lastMouse.x - centerX(), lastMouse.y - (dog.feetY - DOG_H / 2));
  return d < 230 && d > 30;
}

function draw(now, dt) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // monticules d'os enterrés
  for (const m of mounds) {
    ctx.fillStyle = '#a5825d';
    ctx.beginPath();
    ctx.ellipse(m.x, groundY() - 2, 16, 6, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#8a6b4a';
    ctx.fillRect(m.x - 6, groundY() - 8, 4, 2);
    ctx.fillRect(m.x + 2, groundY() - 7, 5, 2);
  }

  drawStick();
  drawPuddle(now);

  if (!dog.hidden) {
    drawDog(now);
    drawCensor(now);
  }

  if (dog.state === SLEEP) drawZzz(now);
  drawParticles(dt);
  drawInterlude(now);
}

function drawDog(now) {
  ctx.save();

  const sleeping = dog.state === SLEEP;
  const biped = dog.state === MOTIV || (dog.state === PLAY && dog.trick && dog.trick.kind === 'biped');
  const spriteH = sleeping ? skin.sleepH : (biped ? skin.tallH : SPRITE_H);
  const topY = dog.feetY - spriteH * SCALE;
  const alert = isAlert(now);

  // déshabillé derrière la censure : pelage et vêtements passent couleur peau,
  // la mosaïque n'échantillonne plus que du rose
  const undressed = dog.state === PLAY && dog.trick && dog.trick.kind === 'biped' && dog.trick.collarOff;
  const savedPal = undressed ? { ...PALETTE } : null;
  if (undressed) Object.assign(PALETTE, NUDE_PALETTE);

  if (alert && [IDLE, SIT].includes(dog.state)) {
    dog.dir = lastMouse.x >= centerX() ? 1 : -1;   // il te suit du regard
  }

  // ombre douce en dégradé
  const sh = ctx.createRadialGradient(centerX(), dog.feetY - 1, 2, centerX(), dog.feetY - 1, DOG_W * 0.42);
  sh.addColorStop(0, 'rgba(0,0,0,0.28)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.save();
  ctx.translate(centerX(), dog.feetY - 1);
  ctx.scale(1, 0.14);
  ctx.beginPath();
  ctx.arc(0, 0, DOG_W * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.translate(dog.x, topY);
  if (dog.dir === -1) {
    ctx.translate(DOG_W, 0);
    ctx.scale(-1, 1);
  }

  if (flipStart && [JUMP, FALL].includes(dog.state)) {
    const p = Math.min((now - flipStart) / 600, 1);
    ctx.translate(DOG_W / 2, DOG_H / 2);
    ctx.rotate(-p * Math.PI * 2);
    ctx.translate(-DOG_W / 2, -DOG_H / 2);
    if (p >= 1) flipStart = 0;
  }

  // trébuchement : plongeon avant bref pendant la marche
  if (now - dog.stumbleAt < 450) {
    const p = (now - dog.stumbleAt) / 450;
    ctx.translate(DOG_W * 0.8, DOG_H);
    ctx.rotate(Math.sin(p * Math.PI) * 0.22);
    ctx.translate(-DOG_W * 0.8, -DOG_H);
  }

  // étirement au réveil
  if (now < dog.stretchUntil) {
    ctx.translate(DOG_W * 0.2, DOG_H);
    ctx.rotate(-0.12);
    ctx.translate(-DOG_W * 0.2, -DOG_H);
  }

  if (dog.state === PLAY && dog.trick) {
    const t = now - dog.trick.start;
    if (dog.trick.kind === 'shake') {
      // secouage de chien mouillé
      ctx.translate(DOG_W / 2, DOG_H);
      ctx.rotate(Math.sin(t / 25) * 0.12);
      ctx.translate(-DOG_W / 2, -DOG_H);
    } else {
      // tentative de bipédie : il vacille… puis ça dégénère derrière la censure
      const h = skin.tallH * SCALE;
      if (t < 1400) {
        const wob = Math.sin(t / 90) * Math.min(t / 1400, 1) * 0.15;
        ctx.translate(DOG_W / 2, h);
        ctx.rotate(wob);
        ctx.translate(-DOG_W / 2, -h);
      } else {
        // on ne verra qu'une mosaïque, alors autant se lâcher :
        // vrilles, soubresauts, écrasements — le chaos intégral
        const c = t - 1400;
        ctx.translate(DOG_W / 2 + Math.sin(c / 23) * 8, h * 0.55 + Math.sin(c / 17) * 6);
        ctx.rotate(c * 0.013 + Math.sin(c / 47) * 1.1);
        const j = 1 + Math.sin(c / 31) * 0.22;
        ctx.scale(j, 2 - j);
        ctx.translate(-DOG_W / 2, -h * 0.55);
      }
    }
  }

  const airborne = [JUMP, FALL, DRAG].includes(dog.state);
  const moving = [WALK, ZOOM, FETCH].includes(dog.state);
  const bob = (moving && Math.sin(dog.phase * 12) > 0) ? 1 : 0;
  const talking = dog.speaking || [BARK, TALK, ZOOM].includes(dog.state);
  const digging = dog.state === DIG;

  if (sleeping) {
    paintMatrix(ctx, skin.sleep, SCALE, 0, 0);
    if (headImg) drawHead(...skin.headSleep);
  } else if (biped) {
    paintMatrix(ctx, skin.tall, SCALE, 0, 0);
    if (skin.articulated) {
      // motivation : index levé de prêcheur ; chute : bras qui moulinent
      drawHumanArmsStanding(ctx, SCALE, now, dog.state === PLAY);
    }
    if (headImg) drawHead(...skin.headTall);
    if (dog.state === MOTIV && Math.sin(dog.phase * 16) > 0) {
      paintPixels(ctx, skin.dogFace ? [[11, 4, 'k'], [12, 5, 'k']] : skin.mouthSit, SCALE);
    }
  } else if (dog.state === SIT || (dog.state === TALK && !bubble.classList.contains('hidden'))) {
    paintMatrix(ctx, skin.sit, SCALE, 0, 0);
    if (skin.tail) paintPixels(ctx, Math.sin(dog.phase * (alert ? 14 : 8)) > 0 ? TAIL_SIT_A : TAIL_SIT_B, SCALE);
    if (alert && skin.ears) paintPixels(ctx, EARS_UP, SCALE);
    if (headImg) drawHead(...skin.headSit);
    if (talking && Math.sin(dog.phase * 16) > 0) paintPixels(ctx, skin.mouthSit, SCALE);
  } else {
    const dy = digging ? 1 : bob;
    if (skin.articulated && (moving || digging)) {
      // le torse tangue autour des hanches, en phase avec les appuis :
      // les épaules plongent à chaque main plantée — l'effort se voit
      ctx.save();
      ctx.translate(6 * SCALE, 8 * SCALE);
      ctx.rotate(Math.sin(dog.phase * 7) * 0.055);
      ctx.translate(-6 * SCALE, -8 * SCALE);
      paintMatrix(ctx, skin.stand, SCALE, 0, dy);
      ctx.restore();
    } else {
      paintMatrix(ctx, skin.stand, SCALE, 0, dy);
    }
    if (skin.articulated) {
      // membres articulés : cinématique continue (coudes, genoux), pas des frames
      drawHumanLimbs(ctx, SCALE, (moving || digging) ? dog.phase * 7 : 0, dy);
    }
    if (skin.tail) {
      // queue : wag fluide en 4 poses, rapide quand il est content/alerte
      const tailSpeed = talking || alert || dog.hasBone ? 14 : 5;
      const tailPose = TAIL_POSES[Math.floor(dog.phase * tailSpeed) % TAIL_POSES.length];
      paintPixels(ctx, tailPose, SCALE, 0, dy);
    }
    const swing = airborne ? 2
      : dog.state === ZOOM ? Math.round(Math.sin(dog.phase * 24) * 2)
      : digging ? Math.round(Math.sin(dog.phase * 20) * 2)
      : moving ? Math.round(Math.sin(dog.phase * 12) * 2) : 0;
    if (!skin.fullBody) paintLegs(ctx, SCALE, swing, dy, skin.legStyle);
    if (alert && skin.ears) paintPixels(ctx, EARS_UP, SCALE, 0, dy);
    if (dog.hasBone) paintPixels(ctx, BONE_MOUTH, SCALE, 0, dy);
    if (headImg) drawHead(skin.headStand[0], skin.headStand[1] + dy, skin.headStand[2]);
    if (talking && Math.sin(dog.phase * 16) > 0) paintPixels(ctx, skin.mouth, SCALE, 0, dy);
    const blinking = !headImg && !alert && Math.sin(dog.phase * 0.9) > 0.985;
    if (blinking) paintPixels(ctx, skin.blink, SCALE, 0, dy);
    if (!headImg && !blinking && skin.dogFace) {
      // étincelle dans l'oeil + joue rosée
      ctx.fillStyle = '#fff6e8';
      ctx.fillRect(19 * SCALE + SCALE * 0.55, (3 + dy) * SCALE + SCALE * 0.1, SCALE * 0.35, SCALE * 0.35);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = PALETTE.e;
      ctx.fillRect(17 * SCALE, (4 + dy) * SCALE, SCALE, SCALE * 0.6);
      ctx.globalAlpha = 1;
    }
  }

  if (savedPal) Object.assign(PALETTE, savedPal);
  ctx.restore();
}

function drawHead(gx, gy, size) {
  ctx.imageSmoothingEnabled = true;   // photo nette, pas pixelisée
  ctx.drawImage(headImg, gx * SCALE, gy * SCALE, size * SCALE, size * SCALE);
  ctx.imageSmoothingEnabled = false;
}

function drawZzz(now) {
  ctx.fillStyle = 'rgba(80, 70, 120, 0.85)';
  ctx.font = 'bold 16px "Courier New", monospace';
  const t = (now / 900) % 3;
  for (let i = 0; i < 3; i++) {
    const p = (t + i) % 3;
    const zx = dog.x + DOG_W * (dog.dir === 1 ? 0.85 : 0.15) + p * 8 * (dog.dir === 1 ? 1 : -1);
    const zy = dog.feetY - SLEEP_H * SCALE - 6 - p * 14;
    ctx.globalAlpha = 1 - p / 3;
    ctx.fillText('z', zx, zy);
  }
  ctx.globalAlpha = 1;
}

// ---------- Censure : mosaïque blanche sur le numéro raté ----------
// On échantillonne ce qui vient d'être dessiné (le chien en pleine vrille),
// on le réduit en gros blocs, on blanchit : on devine que ça se débat, sans
// jamais rien voir. « Personne. N'a. Rien. Vu. »
const censCanvas = document.createElement('canvas');

function censorBox() {
  const h = Math.max(skin.tallH, SPRITE_H) * SCALE + 14;
  return {
    x: Math.max(0, dog.x - 14),
    y: Math.max(0, dog.feetY - h),
    w: Math.min(DOG_W + 28, canvas.width - Math.max(0, dog.x - 14)),
    h: Math.min(h + 6, canvas.height - Math.max(0, dog.feetY - h))
  };
}

function spawnCensorDust() {
  const b = censorBox();
  for (let i = 0; i < 3; i++) {
    const left = Math.random() < 0.5;
    particles.push({
      type: 'dust',
      x: left ? b.x - 2 : b.x + b.w + 2,
      y: b.y + b.h * (0.35 + Math.random() * 0.6),
      vx: (left ? -1 : 1) * (0.04 + Math.random() * 0.06),
      vy: -0.01 - Math.random() * 0.03,
      life: 450 + Math.random() * 300,
      t: 0
    });
  }
}

function spawnCollarToss() {
  const b = censorBox();
  particles.push({
    type: 'collar',
    x: b.x + b.w * 0.5,
    y: b.y + 6,
    vx: (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.04),
    vy: -0.16 - Math.random() * 0.05,
    life: 1600,
    t: 0
  });
}

function spawnPeeLeak() {
  // ça fuit par les bords bas de la mosaïque — elle ne contient pas tout
  const b = censorBox();
  const left = Math.random() < 0.5;
  for (let i = 0; i < 2; i++) {
    particles.push({
      type: 'pee',
      x: left ? b.x + 3 : b.x + b.w - 3,
      y: b.y + b.h * (0.68 + Math.random() * 0.18),
      vx: (left ? -1 : 1) * (0.05 + Math.random() * 0.05),
      vy: -0.04 - Math.random() * 0.02,
      floorY: dog.feetY - 1,
      life: 900,
      t: 0
    });
  }
}

function drawPuddle(now) {
  if (!puddleFx) return;
  if (now >= puddleFx.until) { puddleFx = null; return; }
  const age = now - puddleFx.start;
  const r = Math.min(1, age / 1600) * DOG_W * 0.55;
  const alpha = Math.min(1, age / 600, (puddleFx.until - now) / 2500) * 0.55;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#e8c93a';
  ctx.beginPath();
  ctx.ellipse(puddleFx.x, puddleFx.y - 2, r, Math.max(2, r * 0.16), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha * 0.6;
  ctx.strokeStyle = '#c9a92c';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawCensor(now) {
  if (!censorFx) return;
  if (now >= censorFx.until) { censorFx = null; return; }
  const alpha = Math.min((now - censorFx.start) / 120, (censorFx.until - now) / 350, 1);
  const b = censorBox();
  const block = 9;   // taille des pavés de la mosaïque
  censCanvas.width = Math.max(2, Math.round(b.w / block));
  censCanvas.height = Math.max(2, Math.round(b.h / block));
  const cc = censCanvas.getContext('2d');
  cc.imageSmoothingEnabled = true;
  cc.clearRect(0, 0, censCanvas.width, censCanvas.height);
  cc.drawImage(canvas, b.x, b.y, b.w, b.h, 0, 0, censCanvas.width, censCanvas.height);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 10);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(censCanvas, 0, 0, censCanvas.width, censCanvas.height, b.x, b.y, b.w, b.h);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';   // voile blanc, mais on devine le rose
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.restore();

  // le tampon officiel
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(b.x + b.w / 2, b.y + b.h * 0.4);
  ctx.rotate(-0.13);
  ctx.font = 'bold 11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(190, 40, 40, 0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(-36, -11, 72, 17);
  ctx.fillStyle = 'rgba(190, 40, 40, 0.9)';
  ctx.fillText(t('CENSURÉ', 'CENSORED'), 0, 2);
  ctx.restore();
}

// ---------- Interlude : mire TV « incident canin » ----------
// Une mire couleur tombe sur lui, on patiente, elle se lève : il est ailleurs,
// assis, et on ne reviendra pas sur l'incident.
function startInterlude() {
  lastInterlude = performance.now();
  interludeFx = { start: lastInterlude, until: lastInterlude + 2800, x: centerX() };
  setState(SIT, 2800);
}

function drawInterlude(now) {
  if (!interludeFx) return;
  if (now >= interludeFx.until) {
    // le panneau se lève : il a changé de place, évidemment
    dog.x = 40 + Math.random() * Math.max(60, canvas.width - DOG_W - 120);
    dog.dir = Math.random() < 0.5 ? -1 : 1;
    setState(SIT, 2200);
    dogQuip('interlude', 3400);
    interludeFx = null;
    return;
  }
  const el = now - interludeFx.start;
  const alpha = Math.min(el / 140, (interludeFx.until - now) / 140, 1);
  const w = DOG_W * 2.1;
  const h = Math.max(skin.tallH, SPRITE_H) * SCALE + 30;
  const x = Math.min(Math.max(interludeFx.x - w / 2, 4), canvas.width - w - 4);
  const y = dog.feetY - h + 6;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.clip();
  const bars = ['#c8c8c8', '#c8c832', '#32c8c8', '#32c832', '#c832c8', '#c83232', '#3232c8'];
  const bw = w / bars.length;
  bars.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x + i * bw, y, bw + 1, h); });
  ctx.fillStyle = 'rgba(20, 18, 30, 0.92)';
  ctx.fillRect(x, y + h - 30, w, 30);
  ctx.fillStyle = '#f5efe2';
  ctx.font = 'bold 11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('INTERLUDE', x + w / 2, y + h - 17);
  ctx.font = '9px "Courier New", monospace';
  ctx.fillText(t('Incident canin. Merci de patienter.', 'Canine incident. Please stand by.'), x + w / 2, y + h - 6);
  ctx.restore();
}

PHRASES_DATA.fr.interlude = [
  'Reprise. On ne reviendra pas sur l’incident.',
  'Merci d’avoir patienté. L’enquête interne conclut : rien à signaler.',
  'Problème technique. Réglé. Ne pose pas de questions.'
];
PHRASES_DATA.en.interlude = [
  'Back on air. We will not be discussing the incident.',
  'Thank you for waiting. Internal investigation concludes: nothing to report.',
  'Technical issue. Resolved. Don’t ask questions.'
];

// ---------- Le fouet (outil de management) ----------
const whipTrail = [];            // lanière : traîne derrière le curseur
let whipCrack = null;            // animation du claquement { start, from, to }
let lastWhipHit = 0;

// -- sons synthétisés (pas besoin de fichier) --
let audioCtx = null;
function ac() { return audioCtx || (audioCtx = new AudioContext()); }

function playSlash() {
  if (settings.muted || soundVolume() === 0) return;
  // "slaahh" : bouffée de bruit filtrée qui descend, attaque sèche
  const c = ac(), t = c.currentTime, dur = 0.22;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(6500, t);
  bp.frequency.exponentialRampToValueAtTime(900, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(Math.max(0.001, soundVolume() * 0.8), t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.00001, soundVolume() * 0.01), t + dur);
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t);
}

function speakYelp(text) {
  if (settings.muted) return;
  // le cri coupe tout ce qui était en train de parler
  stopAllAudio();
  const u = new SpeechSynthesisUtterance(text || t('Kaï !', 'Ow!'));
  u.lang = currentLang() === 'fr' ? 'fr-FR' : 'en-US';
  if (frVoice) u.voice = frVoice;
  u.rate = 1.2;
  u.pitch = 1.35;
  u.volume = soundVolume();
  speechSynthesis.speak(u);
}

// touché pendant que tu agites le fouet : slash + cri + il détale
function whipTouch() {
  lastWhipHit = performance.now();
  playSlash();
  whipCrack = {
    start: performance.now(),
    from: { x: stick.x, y: stick.y },
    to: { x: centerX(), y: dog.feetY - DOG_H + 8 }
  };
  if (Math.random() < 0.35) {
    // il rend le coup : contre-roast calme et sec
    const clap = randPhrase('whip-back');
    showQuip(clap, Math.max(2800, clap.length * 60));
    speak(clap);
  } else {
    const cry = randPhrase('whip');
    showQuip(cry, Math.max(2400, cry.length * 60));
    playSound('yelp').then(p => { if (!p) speakYelp(cry); });
  }
  wake();
  for (let i = 0; i < 4; i++) {
    particles.push({
      type: 'spark',
      x: centerX() + (Math.random() - 0.5) * 40,
      y: dog.feetY - DOG_H,
      vx: (Math.random() - 0.5) * 0.08,
      vy: -0.05 - Math.random() * 0.03,
      life: 700,
      t: 0
    });
  }
  // petit bond de fuite, dos au fouet
  dog.dir = stick.x > centerX() ? -1 : 1;
  dog.vy = -Math.sqrt(2 * GRAVITY * 55);
  dog.vx = dog.dir * 0.22;
  dog.platformId = null;
  dog.mission = null;
  setState(JUMP, 0);
}

function resetStick() {
  stick.x = Math.max(60, canvas.width - 120);
  stick.y = groundY() - 10;
  whipTrail.length = 0;
}

function drawStick() {
  if (whipCrack) { drawCrack(); return; }
  if (stickDrag) { drawWhipDragged(); return; }
  // au repos : fouet lové en boucles de cuir + manche bois
  ctx.save();
  ctx.translate(stick.x, stick.y - 4);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#5a3a20';
  ctx.lineWidth = 4;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 15 - i * 4, 8.5 - i * 2.2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#8a5a33';   // reflet sur le cuir
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(0, -1, 15 - i * 4, 8.5 - i * 2.2, 0, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  // le bout de la lanière qui dépasse, avec sa mèche claire
  ctx.strokeStyle = '#5a3a20';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(13, 5);
  ctx.quadraticCurveTo(24, 10, 29, 4);
  ctx.stroke();
  ctx.fillStyle = '#e8dcc0';
  ctx.fillRect(28, 2, 5, 3);
  // manche bois planté dans les boucles
  ctx.save();
  ctx.rotate(-0.85);
  ctx.fillStyle = '#3b2b1f';
  ctx.fillRect(-3, -24, 7, 24);
  ctx.fillStyle = '#8a5a33';
  ctx.fillRect(-1, -21, 2, 19);
  ctx.fillStyle = '#3b2b1f';
  ctx.fillRect(-5, -28, 11, 5);   // pommeau
  ctx.restore();
  ctx.restore();
}

function drawWhipDragged() {
  // physique de corde : chaque maillon suit le précédent + gravité
  let px = stick.x, py = stick.y;
  for (let i = whipTrail.length - 1; i >= 0; i--) {
    const p = whipTrail[i];
    p.x += (px - p.x) * 0.3;
    p.y += (py - p.y) * 0.3 + 1.1;
    px = p.x; py = p.y;
  }
  // lanière effilée : cuir sombre au manche, mèche claire au bout
  const pts = [{ x: stick.x, y: stick.y }].concat([...whipTrail].reverse());
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 1; i < pts.length; i++) {
    const k = i / pts.length;
    ctx.strokeStyle = i === pts.length - 1 ? '#e8dcc0' : (k < 0.35 ? '#4a2f18' : '#6e4526');
    ctx.lineWidth = Math.max(1, 6 * (1 - k));
    ctx.beginPath();
    ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
    ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  // manche orienté dans le sens du geste, pommeau vers l'extérieur
  const first = whipTrail[whipTrail.length - 1] || { x: stick.x, y: stick.y + 10 };
  const ang = Math.atan2(stick.y - first.y, stick.x - first.x);
  ctx.save();
  ctx.translate(stick.x, stick.y);
  ctx.rotate(ang);
  ctx.fillStyle = '#3b2b1f';
  ctx.fillRect(-4, -4, 26, 8);
  ctx.fillStyle = '#8a5a33';
  ctx.fillRect(-2, -3, 21, 3);
  ctx.fillStyle = '#3b2b1f';
  ctx.fillRect(21, -6, 6, 12);   // pommeau
  ctx.restore();
}

function drawCrack() {
  const p = (performance.now() - whipCrack.start) / 320;
  if (p >= 1) { whipCrack = null; return; }
  const { from, to } = whipCrack;
  ctx.lineCap = 'round';
  const N = 20;
  let prev = null;
  for (let i = 0; i <= N; i++) {
    const k = i / N;
    const x = from.x + (to.x - from.x) * k;
    const amp = (1 - p) * 34 * Math.sin(k * Math.PI * 3.5 + p * 26);
    const y = from.y + (to.y - from.y) * k + amp * (1 - k * 0.5);
    if (prev) {
      ctx.strokeStyle = k > 0.9 ? '#e8dcc0' : (k < 0.3 ? '#4a2f18' : '#6e4526');
      ctx.lineWidth = Math.max(1, 6.5 * (1 - k));
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    prev = { x, y };
  }
  // étoile d'impact + traits radiaux
  if (p < 0.5) {
    const a0 = 1 - p * 2;
    ctx.strokeStyle = `rgba(255,255,255,${a0})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(to.x + Math.cos(a) * 6, to.y + Math.sin(a) * 6);
      ctx.lineTo(to.x + Math.cos(a) * (15 + 20 * p), to.y + Math.sin(a) * (15 + 20 * p));
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(255,240,180,${a0})`;
    ctx.beginPath();
    ctx.arc(to.x, to.y, 9 * (1 - p), 0, Math.PI * 2);
    ctx.fill();
  }
  // CRAC ! façon BD, contour blanc
  ctx.font = 'bold 21px "Segoe UI", sans-serif';
  ctx.globalAlpha = 1 - p * p;
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#fff';
  const crackText = t('CRAC !', 'CRACK!');
  ctx.strokeText(crackText, to.x - 30, to.y - 26);
  ctx.fillStyle = '#3b2b1f';
  ctx.fillText(crackText, to.x - 30, to.y - 26);
  ctx.globalAlpha = 1;
}

const stickHit = document.getElementById('stick-hit');
function positionStickHit() {
  stickHit.style.transform = `translate(${stick.x - 30}px, ${stick.y - 14}px)`;
}

stickHit.addEventListener('pointerdown', (e) => {
  stickDrag = { dx: e.clientX - stick.x, dy: e.clientY - stick.y };
  whipTrail.length = 0;
  for (let i = 0; i < 16; i++) whipTrail.push({ x: stick.x, y: stick.y + i * 3 });
  stickHit.setPointerCapture(e.pointerId);
});
stickHit.addEventListener('pointermove', (e) => {
  if (!stickDrag) return;
  stick.x = e.clientX - stickDrag.dx;
  stick.y = e.clientY - stickDrag.dy;
});
stickHit.addEventListener('pointerup', () => {
  if (!stickDrag) return;
  stickDrag = null;
  const onDog = !dog.hidden
    && stick.x > dog.x - 25 && stick.x < dog.x + DOG_W + 25
    && stick.y > dog.feetY - DOG_H - 40 && stick.y < dog.feetY + 20;
  if (onDog) {
    whipCrack = {
      start: performance.now(),
      from: { x: stick.x - (stick.x > centerX() ? -160 : 160), y: stick.y - 120 },
      to: { x: centerX() + DOG_W * 0.25 * dog.dir, y: dog.feetY - DOG_H + 8 }
    };
    bonk();
  } else {
    stick.y = groundY() - 10;   // il retombe au sol
    whipTrail.length = 0;
  }
});

function bonk() {
  // le coup ne le fait plus taire — il le prend personnellement, c'est tout
  stopAllAudio();
  dogQuip('bonk', 3000);
  for (let i = 0; i < 6; i++) {
    particles.push({
      type: 'spark',
      x: dog.x + DOG_W * 0.7 + (Math.random() - 0.5) * 40,
      y: dog.feetY - DOG_H - 5,
      vx: (Math.random() - 0.5) * 0.08,
      vy: -0.05 - Math.random() * 0.04,
      life: 800,
      t: 0
    });
  }
  dog.lastInteraction = performance.now();
  dog.mission = null;
  dog.fetch = null;
  dog.hidden = false;
  dog.dir = stick.x > centerX() ? -1 : 1;   // il te tourne le dos
  setState(SIT, 6000);
  resetStick();
}

// ---------- Zone cliquable ----------
function positionHit() {
  if (dog.hidden) {
    hit.style.transform = 'translate(-600px, -600px)';
    return;
  }
  const h = (dog.state === SLEEP ? SLEEP_H : SPRITE_H) * SCALE;
  hit.style.transform = `translate(${dog.x}px, ${dog.feetY - h}px)`;
  hit.style.width = DOG_W + 'px';
  hit.style.height = h + 'px';
}

// ---------- Souris ----------
let hoverCount = 0;
function hoverEnter() { hoverCount++; window.taskdog.setIgnoreMouse(false); }
function hoverLeave() {
  hoverCount = Math.max(0, hoverCount - 1);
  if (hoverCount === 0) window.taskdog.setIgnoreMouse(true);
}
for (const el of [hit, bubble, stickHit]) {
  el.addEventListener('pointerenter', hoverEnter);
  el.addEventListener('pointerleave', hoverLeave);
}
document.addEventListener('mousemove', (e) => {
  lastMouse = { x: e.clientX, y: e.clientY, t: performance.now() };
});

// ---------- Drag & clic ----------
let dragInfo = null;
hit.addEventListener('pointerdown', (e) => {
  wake();
  dragInfo = { startX: e.clientX, startY: e.clientY, dogX: dog.x, dogY: dog.feetY, moved: false };
  hit.setPointerCapture(e.pointerId);
});
hit.addEventListener('pointermove', (e) => {
  if (!dragInfo) return;
  const dx = e.clientX - dragInfo.startX;
  const dy = e.clientY - dragInfo.startY;
  if (!dragInfo.moved && Math.hypot(dx, dy) > 6) {
    dragInfo.moved = true;
    dog.mission = null;
    dog.fetch = null;
    setState(DRAG, 0);
    closeBubble();
  }
  if (dragInfo.moved) {
    dog.x = Math.min(Math.max(dragInfo.dogX + dx, 0), canvas.width - DOG_W);
    dog.feetY = Math.min(Math.max(dragInfo.dogY + dy, DOG_H), groundY());
  }
});
hit.addEventListener('pointerup', () => {
  if (!dragInfo) return;
  const wasDrag = dragInfo.moved;
  dragInfo = null;
  if (wasDrag) {
    dog.platformId = null;
    dog.vy = 0;
    dog.vx = 0;
    setState(FALL, 0);
    if (Math.random() < 0.35) dogSay('drop');
  } else {
    const now = performance.now();
    clickTimes = clickTimes.filter(t => now - t < 1600);
    clickTimes.push(now);
    clearTimeout(pendingClickTimer);
    if (clickTimes.length >= 3) {
      clickTimes = [];
      startZoomies();   // 3 clics rapides : il pète un câble
    } else {
      // on attend un instant : peut-être qu'un triple-clic arrive
      pendingClickTimer = setTimeout(() => toggleBubble(), 340);
    }
  }
});

// ---------- Bulle ----------
function positionBubble() {
  const bw = bubble.offsetWidth;
  const bh = bubble.offsetHeight;
  const left = Math.max(12, Math.min(dog.x + DOG_W / 2 - bw / 2, canvas.width - bw - 12));
  let bottom = canvas.height - dog.feetY + DOG_H + 14;
  bottom = Math.max(12, Math.min(bottom, canvas.height - bh - 12));
  bubble.style.left = left + 'px';
  bubble.style.bottom = bottom + 'px';
}

async function toggleBubble() {
  wake();
  if (bubble.classList.contains('hidden')) {
    soundFiles = await window.taskdog.listSounds();
    bubbleTitle.textContent = settings.petName || 'DoneDog';
    reportEl.classList.add('hidden');
    updateLevelUI();
    bubble.classList.remove('hidden');
    hit.setAttribute('aria-expanded', 'true');
    setState(SIT, 5000);
    renderTasks();
    positionBubble();
    document.getElementById(settingsOpen ? 'presence-select' : settings.activeTab === 'missions' ? 'tab-missions' : 'task-input').focus();
  } else {
    closeBubble();
  }
}

function closeBubble() {
  if (bubble.classList.contains('hidden')) return;
  bubble.classList.add('hidden');
  hit.setAttribute('aria-expanded', 'false');
  window.taskdog.blurWindow();
}

// ---------- Le baptême : tu le nommes, il a un avis ----------
function nameReaction(name) {
  const n = name.trim();
  if (/rex|medor|médor|rantanplan|milou|idefix|idéfix|buddy|fido|snoopy|scooby|pluto|lassie/i.test(n)) {
    return t(
      `« ${n} ». Un classique. J’allais dire un cliché, mais je suis payé en croquettes imaginaires, je me tais.`,
      `“${n}”. A classic. I was going to say a cliché, but I’m paid in imaginary kibble, so I’ll keep quiet.`
    );
  }
  if (n.length <= 3) {
    return t(
      `« ${n} ». Court. Efficace. Comme mes pauses. Va pour ${n}.`,
      `“${n}”. Short. Efficient. Like my breaks. ${n} it is.`
    );
  }
  if (/[0-9]/.test(n)) {
    return t(
      `« ${n} ». Avec des chiffres. Je suis un être vivant, pas un mot de passe. …Adopté quand même.`,
      `“${n}”. With numbers. I’m a living being, not a password. …Adopted anyway.`
    );
  }
  if (/chef|boss|patron|master|chief|sir|king/i.test(n)) {
    return t(
      `« ${n} ». Enfin quelqu’un qui reconnaît la hiérarchie réelle ici.`,
      `“${n}”. Finally someone who acknowledges the real hierarchy here.`
    );
  }
  return t(
    `« ${n} », donc. J’ai connu pire. Moi, avant, c’était : rien. Va pour ${n}.`,
    `“${n}”, then. I’ve had worse. Before, I was called: nothing. ${n} it is.`
  );
}

document.getElementById('btn-rename').addEventListener('click', () => {
  const input = document.createElement('input');
  input.className = 'rename-input';
  input.maxLength = 20;
  input.placeholder = t('Son nom…', 'His name…');
  input.setAttribute('aria-label', t('Nom du personnage', 'Character name'));
  input.value = settings.petName || '';
  bubbleTitle.replaceChildren(input);
  input.focus();
  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    const name = input.value.trim();
    if (name) {
      settings.petName = name;
      window.taskdog.saveSettings(settings);
      window.petName = name;
      const reaction = nameReaction(name);
      showQuip(reaction, Math.max(3500, reaction.length * 60));
      speak(reaction);
      spawnHearts(5);
      setState(BARK, 1000);
    }
    bubbleTitle.textContent = settings.petName || 'DoneDog';
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') { input.value = ''; commit(); }
    e.stopPropagation();
  });
  input.addEventListener('blur', commit);
});

document.getElementById('btn-close').addEventListener('click', closeBubble);
hit.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBubble(); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBubble(); });
window.addEventListener('blur', () => { if (!dragInfo) closeBubble(); });

// ---------- Tâches + XP + journal ----------
function persist() { window.taskdog.saveTasks(tasks); }

function updateLevelUI() {
  const lvl = levelFromXp(settings.xp);
  const titles = levelTitles();
  dogLevelEl.textContent = t(
    `Niv. ${lvl} · ${titles[lvl - 1]} · ${settings.xp} XP`,
    `Lvl. ${lvl} · ${titles[lvl - 1]} · ${settings.xp} XP`
  );
  PALETTE.r = COLLAR_COLORS[Math.min(lvl - 1, COLLAR_COLORS.length - 1)];
  btnHead.textContent = headImg ? t('Rétablir le visage', 'Reset face') : t('Changer le visage', 'Custom face');
  btnHead.title = headImg
    ? t('Remettre la vraie tête', 'Bring back the real face')
    : t('Mettre ta photo comme tête', 'Use your photo as his face');
}

function gainXp(amount) {
  const before = levelFromXp(settings.xp);
  settings.xp += amount;
  const after = levelFromXp(settings.xp);
  window.taskdog.saveSettings(settings);
  updateLevelUI();
  if (after > before) {
    showQuip(levelUpPhrase(after), 4000);
    playSound('level-up');
    spawnHearts(8);
    setState(BARK, 1200);
  }
}

function renderTasks() {
  taskList.innerHTML = '';
  if (!tasks.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = t('Une chose à terminer ? Ajoute-la ici. Tu pourras lancer son chrono, puis la cocher.', 'Something to finish? Add it here, start its timer, then check it off.');
    taskList.appendChild(empty);
  }
  document.getElementById('btn-clear-done').classList.toggle('hidden', !tasks.some(task => task.done));
  const sorted = [...tasks].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
  for (const task of sorted) {
    const li = document.createElement('li');
    li.className = task.done ? 'done' : '';
    if (activeTask && activeTask.id === task.id) li.classList.add('active-timer');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = task.done;
    cb.setAttribute('aria-label', t('Terminer : ', 'Complete: ') + task.text);
    cb.addEventListener('change', () => {
      task.done = cb.checked;
      persist();
      renderTasks();
      if (task.done) {
        journalToday(journal()).done++;
        noteDoneHour(journal());
        jdirty = true;
        // streak : jours consécutifs avec au moins une coche
        const st = settings.streak;
        const today = todayKey();
        if (st.lastDoneDay !== today) {
          const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          st.current = st.lastDoneDay === yesterday ? st.current + 1 : 1;
          st.lastDoneDay = today;
          if (st.current > (st.best || 0)) st.best = st.current;
          if (st.current >= 3) {
            const m = recordRoast('streak', st.current);
            setTimeout(() => { showQuip(m, 4500); speak(m); }, 5000);
          }
        }
        if (activeTask && activeTask.id === task.id) {
          onActiveTaskDone(task);
        } else {
          dogSay('task-done');
        }
        spawnHearts(3);
        gainXp(10);
        // il t'a vu bosser dessus : il le dit, avec les minutes à l'appui
        const link = taskLinks[task.id];
        if (link) {
          const minutes = Math.round((fgTaskSec[task.id] || 0) / 60);
          setTimeout(() => showQuip(linkDoneQuip(minutes), 4500), 2600);
          delete taskLinks[task.id];
        }
      }
    });

    const span = document.createElement('span');
    span.textContent = task.text;

    li.append(cb, span);

    if (!task.done) {
      if (activeTask && activeTask.id === task.id && Date.now() > activeTask.deadlineAt) {
        // temps écoulé : on solde — fait, rab, ou échec constaté
        const doneBtn = document.createElement('button');
        doneBtn.className = 'start';
        doneBtn.textContent = t('Terminé', 'Done');
        doneBtn.title = t('C’est fait (en retard, mais fait)', 'It’s done (late, but done)');
        doneBtn.addEventListener('click', () => {
          cb.checked = true;
          cb.dispatchEvent(new Event('change'));
        });
        const more = document.createElement('button');
        more.className = 'start';
        more.textContent = '+10 min';
        more.title = t('Encore 10 minutes (il le note)', 'Another 10 minutes (he’ll note it)');
        more.addEventListener('click', () => {
          activeTask.deadlineAt = Date.now() + 600000;
          delete activeTask.fired.two;
          delete activeTask.fired.up;
          delete activeTask.fired.confronted;
          settings.activeTask = activeTask;
          window.taskdog.saveSettings(settings);
          timerEl.classList.remove('late');
          showQuip(t('Dix minutes de rab. Le mot « deadline » perd son sens, mais je note.', 'Ten more minutes. The word “deadline” is losing all meaning, but noted.'), 3800);
          renderTasks();
        });
        const fail = document.createElement('button');
        fail.className = 'start stop';
        fail.textContent = t('Arrêter', 'Stop');
        fail.title = t('Arrêter le chrono (la tâche reste sur la liste)', 'Stop the timer (the task stays on the list)');
        fail.addEventListener('click', () => cancelActiveTask());
        li.append(doneBtn, more, fail);
      } else if (activeTask && activeTask.id === task.id) {
        // chrono en cours sur cette tâche : remise à zéro ou annulation
        const restart = document.createElement('button');
        restart.className = 'start';
        restart.textContent = t('Repartir', 'Restart');
        restart.title = t(`Remettre le chrono à zéro (${activeTask.total} min)`, `Restart the timer (${activeTask.total} min)`);
        restart.addEventListener('click', () => {
          const total = activeTask.total;
          startTask(task, total);
          showQuip(t(`Remise à zéro. ${total} minutes. On efface, on ne pardonne pas.`, `Back to zero. ${total} minutes. We erase, we don’t forgive.`), 3500);
          renderTasks();
        });
        const stop = document.createElement('button');
        stop.className = 'start stop';
        stop.textContent = t('Arrêter', 'Stop');
        stop.title = t('Annuler le chrono', 'Cancel the timer');
        stop.addEventListener('click', () => cancelActiveTask());
        li.append(restart, stop);
      } else {
        const play = document.createElement('button');
        play.className = 'start';
        play.textContent = t('Chrono', 'Timer');
        play.title = t('Choisir une durée pour cette tâche', 'Choose a timer duration for this task');
        play.addEventListener('click', () => {
          const old = li.querySelector('.picker');
          if (old) { old.remove(); return; }
          const picker = document.createElement('div');
          picker.className = 'picker';
          for (const [label, min] of (currentLang() === 'fr'
            ? [['25 min', 25], ['45 min', 45], ['1 h', 60], ['2 h', 120]]
            : [['25 min', 25], ['45 min', 45], ['1 hr', 60], ['2 hrs', 120]])) {
            const b = document.createElement('button');
            b.textContent = label;
            b.addEventListener('click', () => { startTask(task, min); renderTasks(); });
            picker.appendChild(b);
          }
          li.appendChild(picker);
          positionBubble();
        });
        li.appendChild(play);
      }
    }

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕';
    del.title = t('Supprimer', 'Delete');
    del.setAttribute('aria-label', t('Supprimer : ', 'Delete: ') + task.text);
    del.addEventListener('click', () => {
      if (activeTask && activeTask.id === task.id) clearActiveTask();
      tasks = tasks.filter(x => x.id !== task.id);
      persist();
      renderTasks();
    });
    li.appendChild(del);

    taskList.appendChild(li);
  }
  const pend = pending().length;
  taskCount.textContent = currentLang() === 'fr'
    ? (pend === 0 ? 'Rien à faire 🦴' : `${pend} tâche${pend > 1 ? 's' : ''} à faire`)
    : (pend === 0 ? 'Nothing to do 🦴' : `${pend} task${pend > 1 ? 's' : ''} to do`);
}

function addTask(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  tasks.push({ id: Date.now() + Math.random(), text: trimmed, done: false, createdAt: new Date().toISOString() });
  persist();
  renderTasks();
  journalToday(journal()).added++;
  jdirty = true;
  dogSay(pending().length >= 6 ? 'many-tasks' : 'add-task');
}

taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addTask(taskInput.value);
    taskInput.value = '';
  }
});
document.getElementById('btn-add').addEventListener('click', () => {
  addTask(taskInput.value);
  taskInput.value = '';
  taskInput.focus();
});

document.getElementById('btn-speak').addEventListener('click', speakTasks);
document.getElementById('btn-clear-done').addEventListener('click', () => {
  tasks = tasks.filter(t => !t.done);
  persist();
  renderTasks();
});

// ---------- Chrono de tâche : tu la démarres, il te lâche plus ----------
const timerEl = document.getElementById('timer');
const timerText = document.getElementById('timer-text');

function startTask(task, minutes) {
  activeTask = {
    id: task.id, text: task.text,
    startedAt: Date.now(),
    deadlineAt: Date.now() + minutes * 60000,
    total: minutes,
    fired: {}
  };
  settings.activeTask = activeTask;
  window.taskdog.saveSettings(settings);
  closeBubble();
  timerEl.classList.remove('hidden');
  const msg = t(
    `« ${shortText(task.text)} ». ${minutes} minutes. Je chronomètre, et je n’oublie jamais.`,
    `“${shortText(task.text)}”. ${minutes} minutes. I’m timing this, and I never forget.`
  );
  showQuip(msg, 4500);
  speak(msg);
  setState(BARK, 1000);
}

function clearActiveTask() {
  activeTask = null;
  settings.activeTask = null;
  window.taskdog.saveSettings(settings);
  timerEl.classList.add('hidden');
  timerEl.classList.remove('late');
}

function cancelActiveTask() {
  // temps écoulé ≠ abandon : on ne t'accuse que de ce que tu as vraiment fait
  const expired = activeTask && Date.now() > activeTask.deadlineAt;
  const msg = expired
    ? t('Temps écoulé, zéro coche. Je l’écris tel quel. La tâche, elle, ne bouge pas.',
        'Time’s up, zero checkmarks. I’m writing it down exactly like that. The task, meanwhile, isn’t going anywhere.')
    : t('Abandon du chrono. Noté. Dans le grand livre.',
        'Timer abandoned. Noted. In the big book.');
  clearActiveTask();
  showQuip(msg, 3500);
  speak(msg);
  renderTasks();
}

document.getElementById('timer-cancel').addEventListener('click', (e) => {
  e.stopPropagation();
  cancelActiveTask();
});
timerEl.addEventListener('click', () => {
  if (bubble.classList.contains('hidden')) toggleBubble();
});
timerEl.addEventListener('pointerenter', hoverEnter);
timerEl.addEventListener('pointerleave', hoverLeave);

function fireMilestone(key, text, doSpeak) {
  if (activeTask.fired[key]) return;
  activeTask.fired[key] = true;
  settings.activeTask = activeTask;
  window.taskdog.saveSettings(settings);
  showQuip(text, 3500);
  if (doSpeak) speak(text);
  setState(BARK, 900);
}

function tickTimer() {
  if (!activeTask) return;
  const left = activeTask.deadlineAt - Date.now();
  const mm = Math.max(0, Math.floor(left / 60000));
  const ss = Math.max(0, Math.floor((left % 60000) / 1000));
  timerText.textContent = `⏱ ${mm}:${String(ss).padStart(2, '0')} · ${shortText(activeTask.text, 24)}`;
  timerEl.classList.toggle('late', left <= 0);
  // le chip suit le chien
  const w = timerEl.offsetWidth || 140;
  timerEl.style.left = Math.min(Math.max(centerX() - w / 2, 8), canvas.width - w - 8) + 'px';
  timerEl.style.bottom = (canvas.height - dog.feetY + DOG_H + 40) + 'px';

  if (left <= activeTask.total * 30000 && left > 0) fireMilestone('half',
    t('Moitié du temps. Fais le point : panique ou déni ?', 'Half the time is gone. Check in with yourself: panic or denial?'), false);
  if (left <= 600000 && left > 0 && activeTask.total > 15) fireMilestone('ten',
    t('Dix minutes. C’est maintenant que les légendes naissent. Ou pas.', 'Ten minutes. This is where legends are born. Or not.'), true);
  if (left <= 120000 && left > 0) fireMilestone('two',
    t('Deux minutes. Je remue la queue par politesse.', 'Two minutes. I’m wagging my tail out of politeness.'), true);
  if (left <= 0) {
    fireMilestone('up', t(
      `Temps écoulé pour « ${shortText(activeTask.text)} ». Regarde-moi et dis-moi ce qu’on écrit dans le rapport.`,
      `Time’s up for “${shortText(activeTask.text)}”. Look me in the eye and tell me what we write in the report.`
    ), true);
    if (activeTask.fired.up && !activeTask.fired.confronted) {
      activeTask.fired.confronted = true;
      renderTasks();   // les boutons de la ligne passent en mode « temps écoulé »
      if (bubble.classList.contains('hidden')) toggleBubble();
    }
  }
}

function onActiveTaskDone(task) {
  const inTime = Date.now() <= activeTask.deadlineAt;
  const minutes = Math.round((Date.now() - activeTask.startedAt) / 60000);
  clearActiveTask();
  if (inTime) {
    const j = journalToday(journal());
    j.focusWins = (j.focusWins || 0) + 1;
    jdirty = true;
    gainXp(15);   // bonus chrono, en plus des 10 de base
    spawnHearts(10);
    const msg = currentLang() === 'fr'
      ? `Fini en ${minutes} minutes, dans les temps. Là, tout de suite, je suis fier.`
      : `Done in ${minutes} minutes, on time. Right now, I’m proud.`;
    showQuip(msg, 4500);
    speak(msg);
  } else {
    const msg = currentLang() === 'fr'
      ? 'Fini. En retard, mais fini. On prend.'
      : 'Done. Late, but done. We’ll take it.';
    showQuip(msg, 3500);
    speak(msg);
  }
}

// ---------- Rapport du jour ----------
document.getElementById('btn-report').addEventListener('click', () => {
  if (reportEl.classList.contains('hidden')) {
    reportEl.textContent = buildReport(journal(), pending()).join('\n');
    reportEl.classList.remove('hidden');
    speak(reportSummarySpeech(journal(), pending()));
  } else {
    reportEl.classList.add('hidden');
  }
  document.getElementById('btn-report').setAttribute('aria-expanded', String(!reportEl.classList.contains('hidden')));
  positionBubble();
});

// ---------- Rangement ----------
async function startTidy() {
  closeBubble();
  await dogSay('clean-start', { tts: true });
  const res = await window.taskdog.tidyDesktop();
  if (!res || !res.ok) {
    showQuip(t('Je n’atteins pas tes fichiers. ', 'I can’t reach your files. ') + '(' + (res && res.error || 'error') + ')', 3500);
    tidyRun = null;
  }
}
window.taskdog.onTidyAsk(() => startTidy());

window.taskdog.onTidyStep((step) => {
  tidyRun = { targetX: Math.random() * (canvas.width - DOG_W) };
  setState(WALK, 9999);
  showQuip(t(`📦 « ${step.name} » — rangé. (${step.k}/${step.total})`, `📦 “${step.name}” — tidied. (${step.k}/${step.total})`), 1200);
  spawnSparkle(centerX(), dog.feetY - DOG_H - 8);
});
window.taskdog.onTidyDone(({ count }) => {
  tidyRun = null;
  journalToday(journal()).cleans++;
  jdirty = true;
  setState(BARK, 1200);
  spawnHearts(5);
  dogSay('clean-done', { tts: true });
});

// ---------- Tête custom ----------
function prepareHead(dataUrl) {
  // photo nette, recadrée en rond (pas de pixelisation)
  return new Promise((resolve) => {
    if (!dataUrl) return resolve(null);
    const img = new Image();
    img.onload = () => {
      const N = 128;
      const off = document.createElement('canvas');
      off.width = N; off.height = N;
      const c = off.getContext('2d');
      c.beginPath();
      c.arc(N / 2, N / 2, N / 2, 0, Math.PI * 2);
      c.clip();
      const s = Math.min(img.width, img.height);
      c.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, N, N);
      resolve(off);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function setHead(dataUrl) {
  headImg = await prepareHead(dataUrl);
  updateLevelUI();
  if (headImg) { showQuip(t('Nouvelle tête. Le contrat ne mentionnait pas le vol d’identité. Mais bon.', 'New face. The contract never mentioned identity theft. But fine.'), 3500); setState(BARK, 900); }
}

btnHead.addEventListener('click', async () => {
  if (headImg) {
    await window.taskdog.clearHead();
    headImg = null;
    updateLevelUI();
    showQuip(t('Ah. Me revoilà.', 'Ah. Me again.'), 2500);
  } else {
    const d = await window.taskdog.pickHead();
    if (d) setHead(d);
  }
});
window.taskdog.onHead((d) => setHead(d));

window.taskdog.onSkin((name) => { setSkin(name); syncCompanionSettings(); updateLevelUI(); });
window.taskdog.onLanguage((language) => changeLanguage(language));
window.taskdog.onOpenPanel(async (view) => {
  if (bubble.classList.contains('hidden')) await toggleBubble();
  if (view === 'settings') showSettings(true);
  else { showSettings(false); setMissionTab('tasks'); taskInput.focus(); }
});

// ---------- Mode silencieux (menu tray) ----------
window.taskdog.onMuted((v) => {
  settings.muted = v;
  syncCompanionSettings();
  window.taskdog.saveSettings(settings);
  if (v) {
    stopAllAudio();
    showQuip('…', 1500);
  } else {
    showQuip(t('Wouf. Je disais donc.', 'Woof. As I was saying.'), 2500);
  }
});

// ---------- Sons + vannes ----------
function soundsFor(event) {
  const langDir = currentLang() + '/';
  return soundFiles.filter(f => {
    if (!f.startsWith(langDir)) return false;
    const base = f.slice(langDir.length).replace(/\.(mp3|wav|ogg)$/i, '');
    return base === event || base.startsWith(event + '-');
  });
}

let currentAudio = null;
let audioGen = 0;   // verrou anti-superposition : chaque prise de parole invalide les précédentes

// règle absolue : jamais deux voix en même temps
function stopAllAudio() {
  audioGen++;
  dog.speaking = false;
  try { speechSynthesis.cancel(); } catch {}
  if (currentAudio) {
    try { currentAudio.pause(); } catch {}
    currentAudio = null;
  }
}

function playSound(event) {
  return new Promise((resolve) => {
    if (settings.muted) return resolve(true);   // silencieux : on ne joue rien, et pas de TTS de repli
    const files = soundsFor(event);
    if (!files.length) return resolve(false);
    stopAllAudio();
    const rel = files[Math.floor(Math.random() * files.length)];
    const a = new Audio('../../assets/sounds/' + rel.split('/').map(encodeURIComponent).join('/'));
    currentAudio = a;
    const generation = audioGen;
    a.volume = soundVolume();
    a.onplay = () => { if (generation === audioGen) { dog.speaking = true; lastCommentAt = performance.now(); } };
    a.onended = () => { if (generation === audioGen) dog.speaking = false; resolve(true); };
    a.onerror = () => { if (generation === audioGen) dog.speaking = false; resolve(false); };
    a.play().catch(() => resolve(false));
  });
}

function showQuip(text, ms = 2600) {
  lastCommentAt = performance.now();
  woufEl.textContent = text;
  woufEl.classList.remove('hidden');
  positionWouf();
  clearTimeout(showQuip._t);
  showQuip._t = setTimeout(() => woufEl.classList.add('hidden'), ms);
}

function positionWouf() {
  const w = woufEl.offsetWidth || 80;
  const left = Math.min(Math.max(centerX() - w / 2, 8), canvas.width - w - 8);
  woufEl.style.left = left + 'px';
  woufEl.style.bottom = (canvas.height - dog.feetY + DOG_H + 6) + 'px';
}

function dogQuip(event, ms) {
  if (['play', 'sniff', 'bury', 'jump', 'stumble', 'trickfall', 'pant', 'interlude'].includes(event)
      && !canAmbientComment(performance.now(), true)) return;
  const text = randPhrase(event);
  if (text) showQuip(text, ms || Math.max(2200, text.length * 65));
}

async function dogSay(event, { tts = false } = {}) {
  wake(false);
  const hasAudio = !settings.muted && soundsFor(event).length > 0;
  if (hasAudio) {
    await playSound(event);
  } else {
    const text = randPhrase(event);
    if (text) showQuip(text, Math.max(2200, text.length * 65));
    setState(BARK, 900);
    if (tts && text) speak(text);
  }
}

function wake(userAction = true) {
  // seule une vraie action de l'utilisateur compte comme interaction —
  // sinon le chien remettait lui-même à zéro le timer des vannes ambiantes
  if (userAction) dog.lastInteraction = performance.now();
  if (dog.state === SLEEP) {
    setState(IDLE, 800);
    dog.stretchUntil = performance.now() + 750;   // il s'étire avant tout
    dogQuip('wake', 3000);
    playSound('wake');
  }
}

// ---------- Voice ----------
let frVoice = null;
let frVoiceIsMale = false;
function pickVoice() {
  const fr = currentLang() === 'fr';
  const voices = speechSynthesis.getVoices()
    .filter(v => v.lang && v.lang.toLowerCase().startsWith(fr ? 'fr' : 'en'));
  const male = voices.find(v => fr
    ? /paul|guy|claude|thierry|nicolas|antoine|henri|david|homme|male/i.test(v.name)
    : /david|mark|guy|alex|daniel|george|james|fred|ralph|male|homme/i.test(v.name));
  frVoice = male || voices[0] || null;
  frVoiceIsMale = !!male;
}
speechSynthesis.addEventListener('voiceschanged', pickVoice);
pickVoice();

// UNE seule identité vocale : la voix Gemini (Algenib). Repli Windows
// uniquement si voix masculine dispo, ou si l'utilisateur a explicitement
// demandé la lecture (force) — sinon la bulle texte suffit.
async function speak(text, onDone, opts = {}) {
  if (settings.muted) { if (onDone) onDone(); return; }
  stopAllAudio();
  const myGen = audioGen;

  // opts.local : la phrase cite un titre de fenêtre — elle ne sort pas de la
  // machine, voix Windows uniquement
  if (text.length < 220 && !opts.local) {
    let dataUrl = null;
    try {
      dataUrl = await Promise.race([
        window.taskdog.ttsSpeak(text),
        new Promise(r => setTimeout(() => r(null), 6500))
      ]);
    } catch {}
    if (myGen !== audioGen) { if (onDone) onDone(); return; }   // doublé par une autre voix
    if (settings.muted) { if (onDone) onDone(); return; }
    if (dataUrl) {
      const a = new Audio(dataUrl);
      currentAudio = a;
      a.volume = soundVolume();
      a.onplay = () => { if (myGen === audioGen) { dog.speaking = true; lastCommentAt = performance.now(); } };
      a.onended = () => { if (myGen !== audioGen) return; dog.speaking = false; if (onDone) onDone(); };
      a.onerror = () => { if (myGen !== audioGen) return; dog.speaking = false; if (onDone) onDone(); };
      a.play().catch(() => { if (onDone) onDone(); });
      return;
    }
  }

  // repli : jamais de voix féminine sur un personnage masculin
  if (!frVoiceIsMale && !opts.force) { if (onDone) onDone(); return; }

  const u = new SpeechSynthesisUtterance(text);
  u.lang = currentLang() === 'fr' ? 'fr-FR' : 'en-US';
  if (frVoice) u.voice = frVoice;
  u.rate = 1.02;
  u.pitch = 0.85;
  u.volume = soundVolume();
  u.onstart = () => { if (myGen === audioGen) { dog.speaking = true; lastCommentAt = performance.now(); } };
  u.onend = () => { if (myGen !== audioGen) return; dog.speaking = false; if (onDone) onDone(); };
  u.onerror = () => { if (myGen === audioGen) dog.speaking = false; };
  speechSynthesis.speak(u);
}

async function speakTasks() {
  wake();
  if (settings.muted) {
    showQuip(t('Mode silencieux. C’est toi qui l’as voulu.', 'Silent mode. That was your call.'), 3000);
    return;
  }
  const pend = pending();
  if (!pend.length) return dogSay('no-tasks', { tts: true });
  const introPlayed = await playSound('read-intro');
  const intro = introPlayed ? '' : randPhrase('read-intro') + ' ';
  const list = pend.map((t, i) => `${i + 1} : ${t.text}`).join('. ') + '.';
  // lecture explicitement demandée : on autorise le repli vocal quel qu'il soit
  speak(intro + list, async () => {
    const outroPlayed = await playSound('read-outro');
    if (!outroPlayed) speak(randPhrase('read-outro'), null, { force: true });
  }, { force: true });
}

// Static texts of the bubble, re-applied when the language changes (full reload).
function applyStaticTexts() {
  const fr = currentLang() === 'fr';
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.title = v; };
  set('hit', fr ? 'Clique-moi ! (glisse pour me déplacer, 3 clics = zoomies)' : 'Click me! (drag to move me, 3 clicks = zoomies)');
  set('stick-hit', fr ? 'Le fouet. Frappe le chien avec. Il le prendra personnellement.' : 'The whip. Hit the dog with it. He will take it personally.');
  set('timer', fr ? 'Chrono en cours — clique pour ouvrir la liste' : 'Timer running — click to open the list');
  set('timer-cancel', fr ? 'Abandonner (il le notera)' : 'Give up (he will note it)');
  set('btn-rename', fr ? 'Donne-lui un nom' : 'Give him a name');
  set('btn-close', fr ? 'Fermer' : 'Close');
  set('btn-add', fr ? 'Ajouter la tâche' : 'Add the task');
  set('btn-report', fr ? 'Rapport du jour : tâches, temps par app, verdict' : 'Daily report: tasks, time per app, verdict');
  set('btn-head', fr ? 'Mettre ta photo comme tête' : 'Use your photo as his face');
  set('btn-clear-done', fr ? 'Supprimer les tâches finies' : 'Delete finished tasks');
  set('btn-speak', fr ? 'Il te lit tes tâches' : 'He reads your tasks out loud');
  document.getElementById('btn-speak').textContent = fr ? '🔊 Lis' : '🔊 Read';
  set('tab-tasks', fr ? 'Tes tâches du jour' : 'Your daily tasks');
  set('tab-missions', fr ? 'Tes missions freelance : chrono, budget, historique' : 'Your freelance missions: timer, budget, history');
}

window.taskdog.onSpeakTasks(() => speakTasks());

// ---------- Onglets Tâches / Missions ----------
function setMissionTab(name) {
  const isM = name === 'missions';
  settings.activeTab = isM ? 'missions' : 'tasks';
  window.taskdog.saveSettings(settings);
  document.getElementById('tab-tasks').classList.toggle('active', !isM);
  document.getElementById('tab-missions').classList.toggle('active', isM);
  document.getElementById('tab-tasks').setAttribute('aria-selected', String(!isM));
  document.getElementById('tab-missions').setAttribute('aria-selected', String(isM));
  document.getElementById('tab-tasks').tabIndex = isM ? -1 : 0;
  document.getElementById('tab-missions').tabIndex = isM ? 0 : -1;
  document.getElementById('tasks-view').classList.toggle('hidden', isM);
  bubble.classList.toggle('missions-open', isM && !settingsOpen);
  document.getElementById('view-description').textContent = isM
    ? t('Temps passé par client, heures prévues et historique des sessions.', 'Time per client, planned hours and session history.')
    : t('Une tâche, un chrono si tu veux, une coche quand c’est fait.', 'One task, an optional timer, one checkmark when it’s done.');
  document.querySelector('.input-row').classList.toggle('hidden', isM);
  taskList.classList.toggle('hidden', isM);
  if (isM) reportEl.classList.add('hidden');
  const mv = document.getElementById('missions-view');
  mv.classList.toggle('hidden', !isM);
  if (isM) renderMissions(mv);
  positionBubble();
}
document.getElementById('tab-tasks').addEventListener('click', () => setMissionTab('tasks'));
document.getElementById('tab-missions').addEventListener('click', () => setMissionTab('missions'));

// Le chien réagit aux événements de missions (jamais d'action sur l'inactivité).
function handleMissionEvent(event, data) {
  const line = missionRoast(event, data);
  if (!line) return;
  const important = event === 'mission:done' || event === 'budget:over' || event === 'crash:recovered';
  if (event === 'idle:nudge') { showQuip(line, 5000); return; }
  showQuip(line, important ? 5000 : 3600);
  if (important) speak(line);
}

// ---------- Init ----------
(async () => {
  tasks = await window.taskdog.loadTasks();
  settings = await window.taskdog.loadSettings();
  if (!settings.journal) settings.journal = {};
  if (typeof settings.xp !== 'number') settings.xp = 0;
  if (!settings.saidRoasts) settings.saidRoasts = {};
  if (!settings.patterns) settings.patterns = {};
  if (!settings.focusPatterns) settings.focusPatterns = {};
  if (!settings.records) settings.records = {};
  if (!settings.streak) settings.streak = { current: 0, best: 0, lastDoneDay: null };
  if (settings.language !== 'fr' && settings.language !== 'en') settings.language = 'en';
  window.__lang = settings.language;
  document.documentElement.lang = settings.language;
  applyStaticTexts();
  soundFiles = await window.taskdog.listSounds();
  const head = await window.taskdog.getHead();
  if (head) await setHead(head);
  if (settings.skin && SKINS[settings.skin]) skin = SKINS[settings.skin];
  window.currentSkinName = settings.skin || 'dog';
  window.petName = settings.petName || null;

  // chrono en cours avant fermeture ? on reprend ou on constate le décès
  if (settings.activeTask) {
    if (settings.activeTask.deadlineAt > Date.now()) {
      activeTask = settings.activeTask;
      timerEl.classList.remove('hidden');
    } else {
      settings.activeTask = null;
      window.taskdog.saveSettings(settings);
      setTimeout(() => showQuip(t('Il y avait un chrono. Il est mort pendant mon absence. Paix à lui.',
                                  'There was a timer. It died while I was away. Rest in peace.'), 4000), 3000);
    }
  }

  // surveillance système : batterie + machine
  if (navigator.getBattery) {
    navigator.getBattery().then(b => {
      const update = () => { batteryInfo = { level: b.level, charging: b.charging }; };
      update();
      b.addEventListener('levelchange', update);
      b.addEventListener('chargingchange', update);
    }).catch(() => {});
  }
  const pollSys = async () => { try { sysInfo = await window.taskdog.sysInfo(); } catch {} };
  pollSys();
  setInterval(pollSys, 300000);

  updateLevelUI();
  renderTasks();
  window.__missionIdleNudgeMin = settings.missionIdleNudgeMin || 20;
  await missionsInit();
  onMissionEvent(handleMissionEvent);
  setMissionTab(settings.activeTab === 'missions' ? 'missions' : 'tasks');
  resetStick();
  setState(IDLE, 1200);
  requestAnimationFrame(tick);
  await initCompanionUI();
  document.body.dataset.ready = 'true';
  setTimeout(() => dogSay('hello'), 1500);
})();
