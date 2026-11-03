// Small, explicit controls for the desktop companion. All preferences stay local.
let settingsOpen = false;
let lastCommentAt = 0;
let storageNotices = [];

function showStorageStatus(status) {
  storageNotices = status;
  const panel = document.getElementById('storage-notice');
  panel.classList.toggle('hidden', status.length === 0);
  const failed = status.some(item => item.kind === 'save-failed');
  const unreadable = status.some(item => item.kind === 'unreadable');
  const files = [...new Set(status.map(item => item.file))].join(', ');
  document.getElementById('storage-message').textContent = !status.length ? '' : (failed
    ? t('Sauvegarde impossible. Garde DoneDog ouvert, vérifie l’espace disque et les droits du dossier, puis réessaie. ', 'Could not save. Keep DoneDog open, check free disk space and folder permissions, then retry. ')
    : unreadable
      ? t('Des données sont illisibles et aucune copie de secours valide n’a pu être lue. Les fichiers endommagés sont conservés. ', 'Some data could not be read and no valid backup could be loaded. Damaged files are preserved. ')
      : t('Une copie de secours a été récupérée. Vérifie tes dernières modifications ; les fichiers endommagés sont conservés. ', 'A backup was recovered. Check your latest changes; damaged files are preserved. ')) + files;
  const retry = document.getElementById('storage-retry');
  retry.classList.toggle('hidden', !failed);
  retry.textContent = t('Réessayer la sauvegarde', 'Retry saving');
  if (status.length && document.body.dataset.ready && bubble.classList.contains('hidden')) toggleBubble();
  positionBubble();
}

window.taskdog.onStorageStatus(showStorageStatus);
document.getElementById('storage-retry').addEventListener('click', async () => showStorageStatus(await window.taskdog.retryStorage()));

function quietDuringFocus() {
  return settings.quietDuringFocus !== false && (!!activeTask || missionsIsRunning());
}

function canAmbientComment(now = performance.now(), ignoreMotion = false) {
  if (settings.presence === 'quiet' || quietDuringFocus()) return false;
  if (observedIdleSeconds >= 120) return false;
  if (!bubble.classList.contains('hidden') || dog.hidden || dog.speaking) return false;
  if ((!ignoreMotion && [SLEEP, DRAG, JUMP, FALL, FETCH, DIG, ZOOM, PLAY].includes(dog.state)) || tidyRun) return false;
  const cooldown = settings.presence === 'chatty' ? 90000 : 180000;
  return now > muteUntil && now - lastCommentAt >= cooldown;
}

function soundVolume() {
  return typeof settings.volume === 'number' ? Math.max(0, Math.min(1, settings.volume)) : 0.65;
}

function updatePresenceStatus() {
  const status = document.getElementById('presence-status');
  const text = quietDuringFocus()
    ? t('Concentration · je reste tranquille pendant le chrono.', 'Focus · I’ll stay quiet while your timer runs.')
    : settings.presence === 'quiet'
      ? t('Discret · je réagis à tes actions.', 'Quiet · I react to your actions.')
      : settings.presence === 'chatty'
        ? t('Bavard · les commentaires sont activés.', 'Chatty · spontaneous comments are on.')
        : t('Complice · un peu de caractère, un peu de calme.', 'Companion · a little attitude, a little peace.');
  if (status.textContent !== text) status.textContent = text;
}

function syncCompanionSettings() {
  document.getElementById('presence-select').value = settings.presence || 'companion';
  document.getElementById('quiet-focus').checked = settings.quietDuringFocus !== false;
  document.getElementById('sound-enabled').checked = !settings.muted;
  document.getElementById('volume').value = Math.round(soundVolume() * 100);
  document.getElementById('volume-value').value = Math.round(soundVolume() * 100) + ' %';
  document.getElementById('volume').disabled = !!settings.muted;
  document.getElementById('skin-select').value = settings.skin || 'dog';
  document.getElementById('language-select').value = currentLang();
  document.getElementById('presence-description').textContent = settings.presence === 'quiet'
    ? t('Il répond quand tu interagis avec lui, sans commentaires spontanés.', 'He responds to your actions, without spontaneous comments.')
    : settings.presence === 'chatty'
      ? t('Des remarques plus fréquentes, avec une pause entre deux interventions.', 'More frequent comments, with a break between remarks.')
      : t('Des remarques espacées et un chien qui te laisse travailler.', 'Occasional remarks, with room to get your work done.');
  updatePresenceStatus();
}

function showSettings(open) {
  settingsOpen = open;
  document.getElementById('settings-view').classList.toggle('hidden', !open);
  document.getElementById('work-view').classList.toggle('hidden', open);
  document.getElementById('btn-settings').setAttribute('aria-expanded', String(open));
  bubble.classList.toggle('missions-open', !open && settings.activeTab === 'missions');
  if (open) syncCompanionSettings();
  positionBubble();
  document.getElementById(open ? 'presence-select' : (settings.activeTab === 'missions' ? 'tab-missions' : 'task-input')).focus();
}

function applyCompanionTexts() {
  const labels = {
    'btn-settings': ['Réglages', 'Settings'], 'btn-add': ['Ajouter', 'Add'],
    'tab-tasks': ['Tâches', 'Tasks'], 'tab-missions': ['Missions', 'Missions'],
    'btn-speak': ['Lire à voix haute', 'Read aloud'], 'btn-report': ['Bilan du jour', 'Daily report'],
    'btn-clear-done': ['Effacer les tâches terminées', 'Clear completed tasks'],
    'task-label': ['Nouvelle tâche', 'New task'],
    'welcome-title': ['Ton collègue a quatre pattes. Et un avis.', 'Your coworker has four paws. And opinions.'],
    'welcome-copy': ['Ajoute une tâche, choisis un chrono, puis coche quand c’est fini. Je compte, c’est mon travail.', 'Add a task, choose a timer, then check it off. I count. It’s my job.'],
    'btn-welcome': ['C’est parti', 'Let’s start'],
    'settings-title': ['À chacun son chien', 'Make yourself at home'],
    'presence-label': ['Présence', 'Presence'],
    'quiet-focus-label': ['Rester calme pendant les chronos', 'Stay quiet during timers'],
    'quiet-focus-description': ['Pas de balade ni de remarque spontanée. Les alertes du chrono restent actives.', 'No roaming or spontaneous remarks. Timer alerts still work.'],
    'sound-label': ['Voix et bruitages', 'Voice and sounds'], 'volume-label': ['Volume', 'Volume'],
    'skin-label': ['Personnage', 'Character'], 'btn-rename': ['Lui donner un nom', 'Give him a name'],
    'language-label': ['Langue', 'Language'],
    'language-description': ['Changement immédiat. Les tâches et les chronos restent en place.', 'Applies immediately. Tasks and timers stay in place.'],
    'help-title': ['Comment ça marche ?', 'How it works'],
    'help-click': ['Clique sur le chien pour ouvrir ou fermer ce panneau. Échap le ferme aussi.', 'Click the dog to open or close this panel. Escape closes it too.'],
    'help-drag': ['Glisse le chien pour le déplacer. Trois clics rapides : il se défoule.', 'Drag the dog to move him. Three quick clicks let him run wild.'],
    'help-mission': ['Tâches : quoi finir aujourd’hui. Missions : temps passé par client, budget et historique.', 'Tasks: what to finish today. Missions: time per client, budget and history.'],
    'help-observation': ['Je repère les titres des fenêtres, dont l’onglet affiché du navigateur. Je ne lis ni les pages ni les autres onglets. Un titre donne un indice, pas la preuve que tu procrastines.', 'I notice window titles, including the browser’s displayed tab. I read neither pages nor other tabs. A title is a clue, not proof that you’re procrastinating.'],
    'help-behavior': ['Je me promène entre deux actions, je me pose pendant les chronos et je dors après 2 minutes sans clavier ni souris. Les numéros sont espacés ; le gag censuré ne revient pas avant 8 minutes.', 'I roam between actions, settle during timers, and sleep after 2 minutes without keyboard or mouse input. Tricks are spaced out; the censored gag cannot repeat within 8 minutes.'],
    'help-whip': ['Le petit fouet au sol se glisse jusqu’au chien. Il aura un commentaire.', 'Drag the little whip from the floor to the dog. He’ll have a comment.'],
    'help-tray': ['L’icône DoneDog près de l’horloge Windows permet de le cacher, le quitter ou activer le démarrage automatique.', 'Use DoneDog’s icon by the Windows clock to hide him, quit, or enable startup at login.'],
    'privacy-note': ['Tâches, missions et habitudes sont enregistrées sur ce PC. Les titres de fenêtres servent aux remarques. La météo utilise une localisation approximative par IP ; la voix en ligne est optionnelle.', 'Tasks, missions and habits are stored on this PC. Window titles inform his remarks. Weather uses approximate IP location; online voice is optional.'],
    'btn-back': ['Retour au travail', 'Back to work']
  };
  for (const [id, pair] of Object.entries(labels)) document.getElementById(id).textContent = t(...pair);
  const presence = document.getElementById('presence-select');
  [['quiet', 'Discret', 'Quiet'], ['companion', 'Complice', 'Companion'], ['chatty', 'Bavard', 'Chatty']]
    .forEach(([value, fr, en]) => { presence.querySelector(`[value="${value}"]`).textContent = t(fr, en); });
  const skins = document.getElementById('skin-select');
  skins.options[0].textContent = t('Chien', 'Dog');
  skins.options[1].textContent = t('Humain à quatre pattes', 'Human on all fours');
  taskInput.placeholder = t('Qu’est-ce que tu veux terminer ?', 'What do you want to finish?');
  hit.setAttribute('aria-label', t('Ouvrir DoneDog', 'Open DoneDog'));
  document.getElementById('btn-close').setAttribute('aria-label', t('Fermer', 'Close'));
  document.getElementById('timer-cancel').setAttribute('aria-label', t('Arrêter le chrono', 'Stop the timer'));
  document.getElementById('tabs').setAttribute('aria-label', t('Espace de travail', 'Workspace'));
  syncCompanionSettings();
}

async function changeLanguage(language) {
  if (!['fr', 'en'].includes(language)) return;
  stopAllAudio();
  settings.language = language;
  window.__lang = language;
  document.documentElement.lang = language;
  await window.taskdog.setLanguage(language);
  window.taskdog.saveSettings(settings);
  pickVoice();
  applyStaticTexts();
  applyCompanionTexts();
  showStorageStatus(storageNotices);
  updateLevelUI();
  renderTasks();
  setMissionTab(settings.activeTab || 'tasks');
  if (settingsOpen) showSettings(true);
}

async function initCompanionUI() {
  if (!['quiet', 'companion', 'chatty'].includes(settings.presence)) settings.presence = 'companion';
  applyCompanionTexts();
  const version = await window.taskdog.getVersion();
  document.getElementById('app-version').textContent = 'DoneDog · v' + version;
  lastCommentAt = performance.now();
  document.getElementById('welcome').classList.toggle('hidden', settings.welcomeSeen === true);
  if (!settings.welcomeSeen) await toggleBubble();
  showStorageStatus(await window.taskdog.storageStatus());
  if (storageNotices.length && bubble.classList.contains('hidden')) await toggleBubble();
}

document.getElementById('btn-settings').addEventListener('click', () => showSettings(!settingsOpen));
document.getElementById('btn-back').addEventListener('click', () => showSettings(false));
document.getElementById('btn-welcome').addEventListener('click', () => {
  settings.welcomeSeen = true;
  window.taskdog.saveSettings(settings);
  document.getElementById('welcome').classList.add('hidden');
  taskInput.focus();
  positionBubble();
});
document.getElementById('presence-select').addEventListener('change', (e) => {
  settings.presence = e.target.value;
  window.taskdog.saveSettings(settings);
  syncCompanionSettings();
});
document.getElementById('quiet-focus').addEventListener('change', (e) => {
  settings.quietDuringFocus = e.target.checked;
  window.taskdog.saveSettings(settings);
  syncCompanionSettings();
});
document.getElementById('sound-enabled').addEventListener('change', (e) => {
  settings.muted = !e.target.checked;
  if (settings.muted) stopAllAudio();
  window.taskdog.saveSettings(settings);
  syncCompanionSettings();
});
document.getElementById('volume').addEventListener('input', (e) => {
  settings.volume = Number(e.target.value) / 100;
  if (currentAudio) currentAudio.volume = soundVolume();
  document.getElementById('volume-value').value = e.target.value + ' %';
});
document.getElementById('volume').addEventListener('change', () => window.taskdog.saveSettings(settings));
document.getElementById('skin-select').addEventListener('change', (e) => { setSkin(e.target.value); updateLevelUI(); });
document.getElementById('language-select').addEventListener('change', (e) => changeLanguage(e.target.value));
document.getElementById('tabs').addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const name = e.key === 'Home' ? 'tasks' : e.key === 'End' ? 'missions' : settings.activeTab === 'missions' ? 'tasks' : 'missions';
  setMissionTab(name);
  document.getElementById('tab-' + name).focus();
});
