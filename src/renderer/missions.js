// DoneDog — vue Missions : chrono cumulatif freelance (état + DOM).
// Logique pure dans missions-core.js (globals). Le chien s'abonne via onMissionEvent.

let missionStore = { version: 1, missions: [], running: null };
let missionTick = null;      // setInterval 1s : affichage live + persistance lastTickAt
let idlePoll = null;         // setInterval 30s : nudge inactivité
let lastPersistTick = 0;
let idleArmed = true;        // se réarme quand l'utilisateur revient
let longFired = false;       // session:long déjà signalé pour la session en cours
let missionContainer = null; // set par renderMissions()
const missionBus = [];

// -- events --
function onMissionEvent(cb) { missionBus.push(cb); }
function emitMission(event, payload) {
  for (const cb of missionBus) { try { cb(event, payload || {}); } catch {} }
}

// -- persistance --
function saveMissions() { window.taskdog.saveMissions(missionStore); }
function newId(prefix) {
  const u = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID() : String(Date.now()) + Math.random();
  return prefix + u.replace(/-/g, '').slice(0, 6);
}

function normalizeBilling(b) {
  b = b || {};
  const type = ['hours', 'hourly', 'fixed'].includes(b.type) ? b.type : 'hours';
  return {
    type,
    rate: type === 'hourly' ? (Number(b.rate) || 0) : null,
    price: type === 'fixed' ? (Number(b.price) || 0) : null,
    currency: 'EUR'
  };
}

async function missionsInit() {
  const loaded = await window.taskdog.loadMissions();
  missionStore = (loaded && Array.isArray(loaded.missions)) ? loaded : { version: 1, missions: [], running: null };
  if (!missionStore.version) missionStore.version = 1;
  if (!Array.isArray(missionStore.missions)) missionStore.missions = [];
  // Récupération crash : un chrono tournait quand l'app est morte.
  if (missionStore.running) {
    const r = missionStore.running;
    const mission = missionStore.missions.find(m => m.id === r.missionId);
    const lastTick = Date.parse(r.lastTickAt || r.startedAt);
    const sess = recoverRunning(r, lastTick);
    missionStore.running = null;
    if (mission && sess) {
      sess.id = newId('s_');
      mission.sessions.push(sess);
      emitMission('crash:recovered', { mission, seconds: sess.seconds });
    }
    saveMissions();
  }
}

// -- chrono --
function runningMissionId() { return missionStore.running ? missionStore.running.missionId : null; }
function missionsIsRunning() { return !!missionStore.running; }

function daysSinceLastSession(mission) {
  const dates = (mission.sessions || []).map(s => s.date).filter(Boolean).sort();
  if (!dates.length) return 0;
  const [y, mo, dd] = dates[dates.length - 1].split('-').map(Number);
  const lastMs = new Date(y, mo - 1, dd).getTime();
  const now = new Date();
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((todayMs - lastMs) / 86400000);
}

function beginRunning(missionId) {
  const iso = new Date().toISOString();
  missionStore.running = { missionId, startedAt: iso, lastTickAt: iso };
  longFired = false;
  lastPersistTick = Date.now();
  startTickLoops();
}

function startChrono(missionId) {
  const target = missionStore.missions.find(m => m.id === missionId);
  if (!target) return;
  if (runningMissionId() === missionId) return;         // déjà en cours
  const switching = missionsIsRunning();
  const from = switching ? missionStore.missions.find(m => m.id === runningMissionId()) : null;
  if (switching) stopChrono(true);                       // handoff : sauve l'ancienne session
  const gap = daysSinceLastSession(target);
  beginRunning(missionId);
  saveMissions();
  if (switching) emitMission('chrono:switch', { from, to: target });
  else emitMission('chrono:start', { mission: target });
  if (gap >= 2) emitMission('day:gap', { mission: target, days: gap });
  renderMissionsIfVisible();
}

function stopChrono(silent) {
  if (!missionStore.running) return;
  const r = missionStore.running;
  const mission = missionStore.missions.find(m => m.id === r.missionId);
  const startMs = Date.parse(r.startedAt);
  const now = Date.now();
  const seconds = Math.max(0, Math.round((now - startMs) / 1000));
  missionStore.running = null;
  stopTickLoops();
  if (mission && seconds >= 1) {
    mission.sessions.push({
      id: newId('s_'), date: localDate(startMs), start: r.startedAt,
      end: new Date(now).toISOString(), seconds, manual: false, note: ''
    });
    if (!silent) {
      emitMission(seconds < 60 ? 'session:short' : 'chrono:stop', { mission, seconds });
      const th = totalSeconds(mission, null, now) / 3600;
      if (typeof mission.soldHours === 'number' && mission.soldHours > 0 && th > mission.soldHours) {
        emitMission('budget:over', { mission, totalHours: th });
      }
    }
  }
  saveMissions();
  renderMissionsIfVisible();
}

function startTickLoops() {
  stopTickLoops();
  missionTick = setInterval(() => {
    if (!missionStore.running) return;
    const now = Date.now();
    if (now - lastPersistTick > 20000) {
      missionStore.running.lastTickAt = new Date(now).toISOString();
      saveMissions();
      lastPersistTick = now;
    }
    if (!longFired) {
      const el = (now - Date.parse(missionStore.running.startedAt)) / 1000;
      if (el > 4 * 3600) {
        longFired = true;
        const mission = missionStore.missions.find(m => m.id === missionStore.running.missionId);
        if (mission) emitMission('session:long', { mission, seconds: el });
      }
    }
    updateLiveDisplay();
  }, 1000);
  idlePoll = setInterval(pollIdle, 30000);
}
function stopTickLoops() {
  if (missionTick) clearInterval(missionTick);
  if (idlePoll) clearInterval(idlePoll);
  missionTick = null; idlePoll = null;
}

async function pollIdle() {
  if (!missionStore.running) return;
  let idle = 0;
  try { idle = await window.taskdog.idleSeconds(); } catch { return; }
  const limit = (window.__missionIdleNudgeMin || 20) * 60;
  if (idle >= limit && idleArmed) {
    idleArmed = false;
    const mission = missionStore.missions.find(m => m.id === missionStore.running.missionId);
    if (mission) emitMission('idle:nudge', { mission });
  } else if (idle < 60) {
    idleArmed = true; // l'utilisateur est revenu
  }
}

// -- CRUD --
function createMission({ client, name, soldHours, billing }) {
  const m = {
    id: newId('m_'),
    client: (client || '').trim() || 'Client',
    name: (name || '').trim() || 'Mission',
    soldHours: (typeof soldHours === 'number' && soldHours > 0) ? soldHours : null,
    billing: normalizeBilling(billing),
    status: 'active', createdAt: new Date().toISOString(), finishedAt: null, sessions: []
  };
  missionStore.missions.push(m);
  saveMissions();
  renderMissionsIfVisible();
  return m;
}
function updateMission(id, patch) {
  const m = missionStore.missions.find(x => x.id === id);
  if (!m) return;
  if (patch.client != null) m.client = patch.client.trim() || m.client;
  if (patch.name != null) m.name = patch.name.trim() || m.name;
  if ('soldHours' in patch) m.soldHours = (typeof patch.soldHours === 'number' && patch.soldHours > 0) ? patch.soldHours : null;
  if (patch.billing) m.billing = normalizeBilling(patch.billing);
  saveMissions();
  renderMissionsIfVisible();
}
function deleteMission(id) {
  if (runningMissionId() === id) stopChrono(true);
  missionStore.missions = missionStore.missions.filter(x => x.id !== id);
  saveMissions();
  renderMissionsIfVisible();
}
function addManualSession(id, { seconds, date, note, start, end }) {
  const m = missionStore.missions.find(x => x.id === id);
  if (!m || !(seconds > 0)) return;
  m.sessions.push({
    id: newId('s_'), date: date || localDate(Date.now()),
    start: start || null, end: end || null,
    seconds: Math.round(seconds), manual: true, note: (note || '').trim()
  });
  saveMissions();
  emitMission('session:manual', { mission: m, seconds: Math.round(seconds) });
  renderMissionsIfVisible();
}
function editSession(missionId, sessionId, patch) {
  const m = missionStore.missions.find(x => x.id === missionId);
  if (!m) return;
  const s = m.sessions.find(x => x.id === sessionId);
  if (!s) return;
  if ('seconds' in patch && patch.seconds > 0) s.seconds = Math.round(patch.seconds);
  if (patch.date) s.date = patch.date;
  if ('note' in patch) s.note = (patch.note || '').trim();
  saveMissions();
  renderMissionsIfVisible();
}
function deleteSession(missionId, sessionId) {
  const m = missionStore.missions.find(x => x.id === missionId);
  if (!m) return;
  m.sessions = m.sessions.filter(x => x.id !== sessionId);
  saveMissions();
  renderMissionsIfVisible();
}
function finishMission(id) {
  const m = missionStore.missions.find(x => x.id === id);
  if (!m) return null;
  if (runningMissionId() === id) stopChrono(true);
  m.status = 'done';
  m.finishedAt = new Date().toISOString();
  saveMissions();
  const th = totalSeconds(m, null, Date.now()) / 3600;
  emitMission('mission:done', { mission: m, totalHours: th, soldHours: m.soldHours });
  renderMissionsIfVisible();
  return m;
}
function reopenMission(id) {
  const m = missionStore.missions.find(x => x.id === id);
  if (!m) return;
  m.status = 'active'; m.finishedAt = null;
  saveMissions();
  renderMissionsIfVisible();
}

// -- CSV --
function csvCell(v) {
  v = String(v == null ? '' : v);
  return /[";\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function missionsCsv(list) {
  const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const rows = [['client', 'mission', 'date', 'jour', 'debut', 'fin', 'heures', 'manuel', 'note']];
  for (const m of list) {
    for (const s of m.sessions) {
      let wd = '';
      if (s.date) { const [y, mo, dd] = s.date.split('-').map(Number); wd = days[(new Date(y, mo - 1, dd).getDay() + 6) % 7]; }
      const clk = ts => ts ? new Date(ts).toLocaleTimeString() : '';
      rows.push([m.client, m.name, s.date || '', wd, clk(s.start), clk(s.end),
        (s.seconds / 3600).toFixed(2), s.manual ? 'oui' : '', s.note || '']);
    }
  }
  return rows.map(r => r.map(csvCell).join(';')).join('\r\n');
}
async function exportMissions(list, name) {
  return await window.taskdog.exportMissionsCsv(missionsCsv(list), name || 'missions.csv');
}

// ============================ RENDU ============================
let expandedId = null;
let showNewForm = false;
let historyOpen = false;
let editingSessionId = null;
let editingMissionId = null;

function activeMissions() { return missionStore.missions.filter(m => m.status === 'active'); }
function doneMissions() { return missionStore.missions.filter(m => m.status === 'done'); }

function mondayMsOfThisWeek() {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return monday.getTime();
}

function weekTotalSeconds() {
  const mondayMs = mondayMsOfThisWeek();
  let sum = 0;
  for (const m of missionStore.missions) {
    for (const s of m.sessions) {
      if (!s.date) continue;
      const [y, mo, dd] = s.date.split('-').map(Number);
      if (new Date(y, mo - 1, dd).getTime() >= mondayMs) sum += (s.seconds || 0);
    }
  }
  return sum;
}

function el(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

function renderMissions(container) {
  missionContainer = container;
  container.innerHTML = '';

  const wk = el('div'); wk.id = 'missions-week-total';
  wk.textContent = t(`⏱ ${formatHM(weekTotalSeconds())} cette semaine`, `⏱ ${formatHM(weekTotalSeconds())} this week`);
  container.appendChild(wk);

  const actives = activeMissions();
  if (!actives.length && !showNewForm) {
    container.appendChild(el('div', 'm-sub', t('Crée une mission pour suivre le temps passé sur un projet, comparer tes heures au budget et exporter les sessions.', 'Create a mission to track project time, compare it with your budget and export your sessions.')));
  }
  for (const m of actives) container.appendChild(renderRow(m));

  const addBtn = el('button', 'm-btn primary', showNewForm ? t('× Annuler', '× Cancel') : t('+ Nouvelle mission', '+ New mission'));
  addBtn.style.width = '100%'; addBtn.style.marginTop = '4px';
  addBtn.addEventListener('click', () => { showNewForm = !showNewForm; renderMissions(container); });
  container.appendChild(addBtn);
  if (showNewForm) container.appendChild(renderNewForm(container));

  const done = doneMissions();
  if (done.length) {
    const h = el('button', 'history-h',
      (historyOpen ? '▾ ' : '▸ ') + t(`Terminées (${done.length})`, `Done (${done.length})`));
    h.setAttribute('aria-expanded', String(historyOpen));
    h.addEventListener('click', () => { historyOpen = !historyOpen; renderMissions(container); });
    container.appendChild(h);
    if (historyOpen) for (const m of done) container.appendChild(renderRow(m));
  }
}

function renderRow(m) {
  const now = Date.now();
  const secs = totalSeconds(m, missionStore.running, now);
  const running = runningMissionId() === m.id;
  const row = el('div', 'mission-row' + (running ? ' running' : ''));
  row.dataset.id = m.id;

  const head = el('div', 'm-head');
  head.appendChild(el('span', 'm-dot'));
  const detailsButton = el('button', 'm-title', (expandedId === m.id ? '▾ ' : '▸ ') + `${m.client} — ${m.name}`);
  detailsButton.setAttribute('aria-expanded', String(expandedId === m.id));
  detailsButton.title = t('Voir les détails et les sessions', 'View details and sessions');
  head.appendChild(detailsButton);
  if (running) { const live = el('span', 'm-live'); live.dataset.live = m.id; live.textContent = formatClock(secs); head.appendChild(live); }
  if (m.status === 'active') {
    const play = el('button', 'm-btn', running ? t('Arrêter', 'Stop') : t('Démarrer', 'Start'));
    play.title = running ? t('Couper le chrono', 'Stop the timer') : t('Démarrer le chrono', 'Start the timer');
    play.addEventListener('click', (e) => { e.stopPropagation(); running ? stopChrono(false) : startChrono(m.id); });
    head.appendChild(play);
  }
  row.appendChild(head);

  // barre réel / vendu
  const bar = el('div', 'm-bar'); const fill = el('i');
  const hrs = secs / 3600;
  if (typeof m.soldHours === 'number' && m.soldHours > 0) {
    const pct = Math.min(100, (hrs / m.soldHours) * 100);
    fill.style.width = pct + '%';
    if (hrs > m.soldHours) bar.classList.add('over');
    else if (pct >= 85) bar.classList.add('warn');
  } else { fill.style.width = '0%'; }
  bar.appendChild(fill); row.appendChild(bar);

  const sub = el('div', 'm-sub');
  sub.dataset.sub = m.id;
  sub.textContent = subText(m, secs);
  row.appendChild(sub);

  detailsButton.addEventListener('click', () => { expandedId = expandedId === m.id ? null : m.id; renderMissions(missionContainer); });
  if (expandedId === m.id) row.appendChild(renderDetail(m));
  return row;
}

function subText(m, secs) {
  const hrs = secs / 3600;
  const sold = (typeof m.soldHours === 'number' && m.soldHours > 0) ? m.soldHours + 'h' : '—';
  let s = t(`${formatHM(secs)} effectuées · ${sold} prévues`, `${formatHM(secs)} tracked · ${sold} planned`);
  const b = m.billing || {};
  if (b.type === 'hourly') s += `  ·  ${Math.round(revenue(m, hrs))}€`;
  else if (b.type === 'fixed') s += `  ·  ${b.price}€ (${effectiveRate(m, hrs) ? Math.round(effectiveRate(m, hrs)) + '€/h' : '—'})`;
  return s;
}

function updateLiveDisplay() {
  if (!missionContainer || missionContainer.classList.contains('hidden') || !missionStore.running) return;
  const id = runningMissionId();
  const m = missionStore.missions.find(x => x.id === id);
  if (!m) return;
  const secs = totalSeconds(m, missionStore.running, Date.now());
  const live = missionContainer.querySelector(`[data-live="${id}"]`);
  if (live) live.textContent = formatClock(secs);
  const sub = missionContainer.querySelector(`[data-sub="${id}"]`);
  if (sub) sub.textContent = subText(m, secs);
}

function currentWeekSessions(m) {
  const mondayMs = mondayMsOfThisWeek();
  return m.sessions.filter(s => {
    if (!s.date) return false;
    const [y, mo, dd] = s.date.split('-').map(Number);
    return new Date(y, mo - 1, dd).getTime() >= mondayMs;
  });
}

function buildMissionForm(prefill, submitLabel, onSubmit) {
  const p = prefill || {};
  const pb = p.billing || {};
  const f = el('form', 'm-form');
  const client = el('input'); client.placeholder = t('Client', 'Client'); client.value = p.client || '';
  const name = el('input'); name.placeholder = t('Nom de la mission', 'Mission name'); name.value = p.name || '';
  name.required = true;
  const sold = el('input'); sold.type = 'number'; sold.min = '0'; sold.placeholder = t('Heures vendues', 'Sold hours');
  sold.step = '0.25';
  if (p.soldHours) sold.value = p.soldHours;
  const type = el('select');
  [['hours', t('Heures seules', 'Hours only')], ['hourly', t('Régie (€/h)', 'Hourly (€/h)')], ['fixed', t('Forfait (€)', 'Fixed price (€)')]]
    .forEach(([v, lbl]) => { const o = el('option', null, lbl); o.value = v; type.appendChild(o); });
  type.value = ['hours', 'hourly', 'fixed'].includes(pb.type) ? pb.type : 'hours';
  const money = el('input'); money.type = 'number'; money.min = '0';
  money.step = '0.01';
  const moneyField = labelledField(t('Tarif (€)', 'Price (€)'), money);
  if (pb.type === 'hourly' && pb.rate) money.value = pb.rate;
  if (pb.type === 'fixed' && pb.price) money.value = pb.price;
  const syncMoney = () => {
    moneyField.classList.toggle('hidden', type.value === 'hours');
    money.disabled = type.value === 'hours';
    moneyField.firstChild.textContent = type.value === 'fixed' ? t('Prix total (€)', 'Total price (€)') : t('Tarif horaire (€)', 'Hourly rate (€)');
    money.placeholder = type.value === 'fixed' ? t('Prix total (€)', 'Total price (€)') : t('€/h', '€/h');
  };
  syncMoney();
  type.addEventListener('change', syncMoney);
  const row1 = el('div', 'row'); row1.append(labelledField(t('Client (facultatif)', 'Client (optional)'), client), labelledField(t('Nom de la mission', 'Mission name'), name));
  const row2 = el('div', 'row'); row2.append(labelledField(t('Heures prévues', 'Planned hours'), sold), labelledField(t('Facturation', 'Billing'), type), moneyField);
  const submit = el('button', 'm-btn primary', submitLabel);
  submit.type = 'submit';
  const error = el('p', 'm-error'); error.setAttribute('role', 'alert');
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!name.value.trim()) { error.textContent = t('Donne un nom à cette mission.', 'Give this mission a name.'); name.focus(); return; }
    const billing = { type: type.value };
    if (type.value === 'hourly') billing.rate = Number(money.value) || 0;
    if (type.value === 'fixed') billing.price = Number(money.value) || 0;
    onSubmit({ client: client.value, name: name.value, soldHours: Number(sold.value) || null, billing });
  });
  f.append(row1, row2, error, submit);
  return f;
}

function labelledField(text, input) {
  const label = el('label');
  label.append(el('span', null, text), input);
  return label;
}

function renderNewForm(container) {
  return buildMissionForm(null, t('Créer', 'Create'), (vals) => {
    createMission(vals);
    showNewForm = false;
    renderMissions(container);
  });
}

function renderDetail(m) {
  const d = el('div', 'm-detail');

  // Grille semaine (semaine courante)
  const wkSecs = perWeekday(currentWeekSessions(m));
  const week = el('div', 'm-week');
  const labels = t('L,M,Me,J,V,S,D', 'M,T,W,T,F,S,S').split(',');
  const max = Math.max(1, ...wkSecs);
  wkSecs.forEach((sec, i) => {
    const col = el('div', 'd');
    const bar = el('div', 'bar'); const fill = el('i'); fill.style.height = Math.round((sec / max) * 100) + '%'; bar.appendChild(fill);
    col.appendChild(bar);
    col.appendChild(el('span', null, labels[i]));
    col.appendChild(el('b', null, sec ? formatHM(sec) : '·'));
    week.appendChild(col);
  });
  d.appendChild(week);

  // Ajout manuel
  const addWrap = el('div', 'm-form');
  const dur = el('input'); dur.placeholder = t('Durée (1h30, 90m…)', 'Duration (1h30, 90m…)');
  const day = el('input'); day.type = 'date'; day.value = localDate(Date.now());
  const note = el('input'); note.placeholder = t('Note (ex: hors écran)', 'Note (e.g. off-screen)');
  const addBtn = el('button', 'm-btn', t('+ Ajouter du temps', '+ Add time'));
  const error = el('p', 'm-error'); error.setAttribute('role', 'alert');
  addBtn.addEventListener('click', () => {
    const secs = parseDuration(dur.value);
    if (!secs) { error.textContent = t('Indique une durée, par exemple 1h30 ou 90m.', 'Enter a duration, for example 1h30 or 90m.'); dur.focus(); return; }
    addManualSession(m.id, { seconds: secs, date: day.value || localDate(Date.now()), note: note.value });
  });
  const rowA = el('div', 'row'); rowA.append(labelledField(t('Durée', 'Duration'), dur), labelledField(t('Date', 'Date'), day));
  addWrap.append(rowA, labelledField(t('Note (facultative)', 'Note (optional)'), note), error, addBtn);
  d.appendChild(addWrap);

  // Sessions (les plus récentes d'abord)
  const list = [...m.sessions].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  for (const s of list.slice(0, 30)) {
    const line = el('div', 'm-sess');
    if (editingSessionId === s.id) {
      const inp = el('input'); inp.value = formatHM(s.seconds); inp.style.flex = '1';
      inp.title = t('Durée (1h30, 90m…)', 'Duration (1h30, 90m…)');
      inp.setAttribute('aria-label', inp.title);
      const save = el('button', 'm-btn primary', t('Enregistrer', 'Save'));
      save.addEventListener('click', () => {
        const secs = parseDuration(inp.value);
        if (secs) { editingSessionId = null; editSession(m.id, s.id, { seconds: secs }); }
        else { inp.style.borderColor = '#e04141'; }
      });
      const cancel = el('button', 'm-btn', t('Annuler', 'Cancel'));
      cancel.addEventListener('click', () => { editingSessionId = null; renderMissions(missionContainer); });
      line.append(inp, save, cancel);
      d.appendChild(line);
      continue;
    }
    line.appendChild(el('span', 'grow', `${s.date}  ${s.seconds < 60 ? s.seconds + ' s' : formatHM(s.seconds)}`));
    if (s.manual) line.appendChild(el('span', 'badge', t('Manuel', 'Manual')));
    if (s.note) line.appendChild(el('span', 'badge', s.note.slice(0, 14)));
    const edit = el('button', 'm-btn', t('Modifier', 'Edit'));
    edit.title = t('Corriger la durée', 'Fix the duration');
    edit.addEventListener('click', () => { editingSessionId = s.id; renderMissions(missionContainer); });
    const del = el('button', 'm-btn danger', '✕');
    del.setAttribute('aria-label', t('Supprimer cette session', 'Delete this session'));
    del.addEventListener('click', () => deleteSession(m.id, s.id));
    line.append(edit, del);
    d.appendChild(line);
  }

  d.appendChild(renderDetailActions(m));
  return d;
}

function renderDetailActions(m) {
  const wrap = el('div', 'm-form');
  if (editingMissionId === m.id) {
    wrap.appendChild(buildMissionForm(m, t('Enregistrer', 'Save'), (vals) => {
      updateMission(m.id, vals); editingMissionId = null; renderMissions(missionContainer);
    }));
    const cancel = el('button', 'm-btn', t('× Annuler', '× Cancel'));
    cancel.addEventListener('click', () => { editingMissionId = null; renderMissions(missionContainer); });
    wrap.appendChild(cancel);
    return wrap;
  }
  const now = Date.now();
  const hrs = totalSeconds(m, missionStore.running, now) / 3600;

  // Récap chiffré
  const recap = el('div', 'm-sub');
  const sold = (typeof m.soldHours === 'number' && m.soldHours > 0) ? m.soldHours : null;
  let line = t(`Réel ${formatHM(hrs * 3600)}`, `Actual ${formatHM(hrs * 3600)}`);
  if (sold) {
    const over = hrs - sold;
    const pct = Math.round((over / sold) * 100);
    line += ` · ${t('vendu', 'sold')} ${sold}h · ${over >= 0 ? '+' : ''}${formatHM(Math.abs(over) * 3600)} (${pct >= 0 ? '+' : ''}${pct}%)`;
  }
  const b = m.billing || {};
  if (b.type === 'hourly') line += ` · ${Math.round(revenue(m, hrs))}€`;
  else if (b.type === 'fixed') line += ` · ${b.price}€ → ${effectiveRate(m, hrs) ? Math.round(effectiveRate(m, hrs)) : '—'}€/h`;
  recap.textContent = line;
  wrap.appendChild(recap);

  const row = el('div', 'row');
  const editBtn = el('button', 'm-btn', t('Modifier la mission', 'Edit mission'));
  editBtn.addEventListener('click', () => { editingMissionId = m.id; renderMissions(missionContainer); });
  const csvBtn = el('button', 'm-btn', t('Exporter en CSV', 'Export CSV'));
  csvBtn.addEventListener('click', () => exportMissions([m], `${m.client}-${m.name}.csv`.replace(/[^\w.-]+/g, '_')));
  row.append(editBtn, csvBtn);
  wrap.appendChild(row);

  const row2 = el('div', 'row');
  if (m.status === 'active') {
    const fin = el('button', 'm-btn primary', t('Terminer la mission', 'Complete mission'));
    fin.addEventListener('click', () => { finishMission(m.id); });
    row2.appendChild(fin);
  } else {
    const re = el('button', 'm-btn', t('↩ Rouvrir', '↩ Reopen'));
    re.addEventListener('click', () => reopenMission(m.id));
    row2.appendChild(re);
  }
  const del = el('button', 'm-btn danger', t('Supprimer', 'Delete'));
  del.addEventListener('click', () => { if (confirm(t('Supprimer cette mission et son historique ?', 'Delete this mission and its history?'))) deleteMission(m.id); });
  row2.appendChild(del);
  wrap.appendChild(row2);

  return wrap;
}

function renderMissionsIfVisible() {
  if (missionContainer && !missionContainer.classList.contains('hidden')) renderMissions(missionContainer);
}
