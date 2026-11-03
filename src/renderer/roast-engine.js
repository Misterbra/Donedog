// DoneDog's roast engine — bilingual FR/EN.
// Quips combine an opener, one observation or memory, and a punchline.
// A 240-character ceiling and 30-day memory keep them brief and varied.
//
// Inputs: the journal (14 d), learned patterns, records, context.

// ---------- Openers (by same-day recidivism) ----------
const OPENERS = {
  fr: {
    first: ['{app}.', 'Tiens. {app}.', '{app}, donc.'],
    again: ['Encore {app}.', '{app}. Encore.', 'Re-{app}.'],
    serial: ['{app}. {count}e fois aujourd’hui.', '{count}e {app} de la journée. Je compte, c’est mon travail.']
  },
  en: {
    first: ['{app}.', 'Well, {app}.', '{app}, then.'],
    again: ['{app} again.', '{app}. Again.', 'Re-{app}.'],
    serial: ['{app}. Time #{count} today.', '#{count} {app} of the day. I count. It’s my job.']
  }
};

// ---------- Measured data (the numeric jab) ----------
// Each entry: { need: (facts) => bool, text: (facts) => string }
const DATA_JABS = [
  {
    need: f => f.appMinToday >= 10,
    text: f => t(
      `Environ ${f.appMinToday} minutes au premier plan aujourd’hui.`,
      `About ${f.appMinToday} minutes in the foreground today.`
    )
  },
  {
    need: f => f.avgSession >= 8 && f.sessionCount >= 3,
    text: f => t(
      `Moyenne chez toi : ${f.avgSession} minutes par visite. À tout à l’heure, donc.`,
      `Your average: ${f.avgSession} minutes per visit. See you soon, then.`
    )
  },
  {
    need: f => f.oldestTask && f.oldestTask.days >= 2,
    text: f => t(
      `Pendant ce temps, « ${f.oldestTask.text} » vieillit. Jour ${f.oldestTask.days}.`,
      `Meanwhile, “${f.oldestTask.text}” is getting old. Day ${f.oldestTask.days}.`
    )
  },
  {
    need: f => f.pendingCount >= 3,
    text: f => t(
      `${f.pendingCount} tâches en attente. Aucune ne se coche par la pensée, j’ai vérifié.`,
      `${f.pendingCount} tasks pending. None of them checks itself off. I verified.`
    )
  },
  {
    need: f => f.doneToday === 0 && f.hour >= 14,
    text: f => t(
      `Il est ${f.hour}h. Tâches cochées aujourd’hui : zéro.`,
      `It’s ${f.hour} p.m. Tasks checked today: zero.`
    )
  },
  {
    need: f => f.yesterdayAppMin >= 20,
    text: f => t(
      `Hier : ${f.yesterdayAppMin} minutes au même endroit. C’est plus une habitude, c’est une résidence.`,
      `Yesterday: ${f.yesterdayAppMin} minutes in the same place. That’s not a habit anymore, that’s a residence.`
    )
  },
  {
    need: f => f.switches10 >= 20,
    text: f => t(
      `${f.switches10} changements de fenêtre en dix minutes, en plus.`,
      `${f.switches10} window switches in ten minutes, on top of that.`
    )
  },
  {
    need: f => f.distractionToday >= 45,
    text: f => t(
      `Apps de loisir au premier plan : ${f.distractionToday} minutes aujourd’hui.`,
      `Leisure apps in front: ${f.distractionToday} minutes today.`
    )
  },
  {
    need: f => f.chronoActive,
    text: f => t(
      `Le chrono de « ${f.chronoTask} » tourne toujours. On y retourne ?`,
      `The timer for “${f.chronoTask}” is still running. Back to it?`
    )
  }
];

// ---------- Punchlines (by escalation level of the day) ----------
const PUNCHES = {
  fr: {
    0: [
      'Je note. Le dossier s’épaissit.',
      'Aucun jugement. C’est faux, mais aucun d’exprimé.',
      'Prends ton temps. C’est ce que tu fais de mieux.',
      'Continue. Je m’occupe de la honte pour deux.'
    ],
    1: [
      'T’es pas en pause. T’es en fuite, avec un abonnement.',
      'Même tes onglets sont fatigués de toi.',
      'Ta liste te survivra. Elle a le temps, elle.',
      'Ta prochaine tâche attend. Elle commence à connaître le papier peint.',
      'Ton focus est parti chercher des cigarettes. Il reviendra pas.'
    ],
    2: [
      'Ta procrastination est ponctuelle. Je lui mettrais presque un chrono.',
      'Cinq minutes sur une tâche ? Je peux surveiller. C’est littéralement mon métier.',
      'T’as transformé « plus tard » en projet de vie. Respect. Enfin, non.',
      'Une tâche, cinq minutes. Même moi je peux rester assis jusque-là.',
      'Ferme cet onglet ou je le raconte dans le rapport, avec les minutes et tout.'
    ]
  },
  en: {
    0: [
      'Noted. The file is getting thicker.',
      'No judgment. That’s false, but none was expressed.',
      'Take your time. It’s what you do best.',
      'Carry on. I’ll handle the shame for both of us.'
    ],
    1: [
      'You’re not on a break. You’re on the run, with a subscription.',
      'Even your tabs are tired of you.',
      'Your list will outlive you. It has the time.',
      'Your next task is waiting. It’s getting familiar with the wallpaper.',
      'Your focus left to buy cigarettes. It’s not coming back.'
    ],
    2: [
      'Your procrastination is punctual. I’d almost give it a timer.',
      'Five minutes on a task? I can watch. It’s literally my job.',
      'You turned “later” into a life project. Respect. Well, no.',
      'One task, five minutes. Even I can sit still for that long.',
      'Close this tab or it goes in the report, minutes included.'
    ]
  }
};

// ---------- Callbacks (he digs up your past) ----------
const CALLBACKS = [
  {
    need: f => f.worstDay && f.worstDay.min >= 30,
    text: f => t(
      `${f.worstDay.label}, t’y as laissé ${f.worstDay.min} minutes. On rejoue le match ?`,
      `On ${f.worstDay.label}, you left ${f.worstDay.min} minutes there. Rematch?`
    )
  },
  {
    need: f => f.record && f.record.kind === 'distraction',
    text: f => t(
      `Record personnel en vue, d’ailleurs : ${f.record.value} minutes. Champion.`,
      `Personal record incoming, by the way: ${f.record.value} minutes. Champion.`
    )
  }
];

// ---------- Anti-repetition (30 days) ----------
function _hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return String(h);
}

function _fresh(said, text) {
  const h = _hash(text);
  if (said[h] && Date.now() - said[h] < 30 * 86400000) return false;
  said[h] = Date.now();
  // purge
  for (const k of Object.keys(said)) {
    if (Date.now() - said[k] > 30 * 86400000) delete said[k];
  }
  return true;
}

// ---------- The composer ----------
// facts: see buildFacts() in renderer. said: settings.saidRoasts (persisted).
function composeRoast(facts, said) {
  const lang = currentLang();
  const openerBank = facts.openCount >= 3 ? OPENERS[lang].serial : facts.openCount === 2 ? OPENERS[lang].again : OPENERS[lang].first;
  const tier = Math.min(facts.escalation, 2);

  for (let attempt = 0; attempt < 6; attempt++) {
    const opener = randOf(openerBank)
      .replace('{app}', facts.appLabel)
      .replace('{count}', facts.openCount);
    const jabs = DATA_JABS.filter(j => { try { return j.need(facts); } catch { return false; } });
    const jab = jabs.length ? randOf(jabs).text(facts) : '';
    const punch = randOf(PUNCHES[lang][tier]);
    const cbs = CALLBACKS.filter(c => { try { return c.need(facts); } catch { return false; } });
    const callback = (cbs.length && Math.random() < 0.35) ? randOf(cbs).text(facts) : '';

    // One observation, one punchline: memories replace facts instead of piling on.
    const observation = callback || jab;
    let text = [opener, observation, punch].filter(Boolean).join(' ');
    if (text.length > 240) text = [opener, punch].join(' ');
    if (_fresh(said, observation + '|' + punch)) return text;
  }
  // everything has been said: he points it out (and it's a quip in itself)
  return t(
    `${facts.appLabel}. J’ai épuisé mes commentaires. C’est toi qui me rends répétitif.`,
    `${facts.appLabel}. I’ve run out of comments. You’re the one making me repetitive.`
  );
}

// "Record broken" quip — special event, top priority.
function recordRoast(kind, value) {
  if (kind === 'distraction') {
    return t(
      `🏆 Record personnel battu : ${value} minutes de distraction en une journée. On encadre ? Je propose qu’on encadre.`,
      `🏆 Personal record broken: ${value} minutes of distraction in one day. Shall we frame it? I suggest we frame it.`
    );
  }
  if (kind === 'switches') {
    return t(
      `🏆 Nouveau record : ${value} changements de fenêtre en dix minutes. Un colibri, mais sans le charme.`,
      `🏆 New record: ${value} window switches in ten minutes. A hummingbird, minus the charm.`
    );
  }
  if (kind === 'streak') {
    return t(
      `🔥 ${value} jours d’affilée avec au moins une tâche cochée. Là, sincèrement : bien. Continue, je m’habitue au luxe.`,
      `🔥 ${value} days in a row with at least one task checked. Honestly: good. Keep going, I’m getting used to the luxury.`
    );
  }
  return null;
}

// Learned pattern: announces the expected duration when an app opens.
function patternRoast(appLabel, avgMin) {
  return t(
    `${appLabel}. Statistiquement, chez toi, c’est ${avgMin} minutes. Je lance le sablier mental.`,
    `${appLabel}. Statistically, at your place, that’s ${avgMin} minutes. Starting the mental hourglass.`
  );
}

// Missions freelance — le chien clashe, plusieurs variantes tirées au sort.
function missionRoast(kind, data) {
  data = data || {};
  const name = data.mission ? `${data.mission.client}` : '';
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const H = (sec) => (typeof formatHM === 'function' ? formatHM(sec) : Math.round(sec / 3600) + 'h');
  const BANK = {
    'chrono:start': [
      t('Ah, un éclair de motivation. Prends un ticket, ça arrive rarement.', 'Ah, a flash of motivation. Take a ticket, it’s rare.'),
      t('On y retourne. Je note tout, comme d’habitude.', 'Back at it. I log everything, as usual.')
    ],
    'chrono:switch': [
      t(`On lâche ${data.from ? data.from.client : 'l’autre'} comme une vieille chaussette. Bonjour ${data.to ? data.to.client : 'la suite'}.`,
        `Dropping ${data.from ? data.from.client : 'the other one'} like an old sock. Hello ${data.to ? data.to.client : 'next'}.`)
    ],
    'chrono:stop': [
      t('Coupé. J’ai tout compté. Chaque seconde. Oui, même celles-là.', 'Stopped. I counted everything. Every second. Yes, those too.')
    ],
    'session:short': [
      t('Une petite session. Elle compte quand même. Je note.', 'A short session. It still counts. Logged.')
    ],
    'session:long': [
      t('Quatre heures sans bouger. Ton dos te déteste, et moi aussi.', 'Four hours without moving. Your back hates you, and so do I.')
    ],
    'session:manual': [
      t('« Du temps hors écran ». Bien sûr. Et moi j’ai un master. Je note quand même.', '“Off-screen time.” Sure. And I have a master’s. Logging it anyway.')
    ],
    'idle:nudge': [
      t('T’as pas oublié de couper le chrono ? Parce que là, visuellement, tu fous pas grand-chose.', 'Did you forget to stop the timer? Because visually, you’re doing nothing.')
    ],
    'crash:recovered': [
      t('Tu m’as tué chrono en main. J’ai tout sauvé. Contrairement à toi, moi je bosse.', 'You killed me mid-timer. I saved it all. Unlike you, I work.')
    ],
    'day:gap': [
      t(`${data.days || 3} jours sans un regard pour ${name}. Le client, lui, a une bonne mémoire.`, `${data.days || 3} days without a glance at ${name}. The client, though, remembers.`)
    ],
    'budget:over': [
      t(`${name} : t’as dépassé le vendu. À partir d’ici c’est du bénévolat, mais avec le sourire.`, `${name}: you’re past what you sold. From here it’s volunteering, but with a smile.`)
    ]
  };
  if (kind === 'mission:done') {
    const sold = data.soldHours, real = data.totalHours || 0;
    if (typeof sold === 'number' && sold > 0 && real > sold * 1.1) {
      return t(`Vendu ${sold}h, fait ${H(real * 3600)}. T’es généreux. Trop. C’est un problème.`,
               `Sold ${sold}h, did ${H(real * 3600)}. You’re generous. Too generous. That’s a problem.`);
    }
    return t(`${H(real * 3600)} au compteur. Dans les clous, pour une fois. J’ai cru que t’y arriverais jamais.`,
             `${H(real * 3600)} logged. On budget, for once. I thought you’d never make it.`);
  }
  const bank = BANK[kind];
  return bank ? pick(bank) : null;
}
