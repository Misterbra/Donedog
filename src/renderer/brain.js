// TaskDog's brain — bilingual FR/EN.
// He reads the TITLES of your windows (nothing else), cross-references them
// with your tasks, keeps a daily journal, and draws observations from it.
// Voice: calm, precise, passive-aggressive manager. He notes everything.
//
// ADD YOUR DETECTORS here. Placeholders: {t}=title excerpt,
// {n}=pending tasks, {h}=hour, {w}=window count.

const APP_DETECTORS = [
  {
    key: 'youtube', procrastination: true,
    test: /^(.*?) - YouTube/i,
    quips: {
      fr: [
        '« {t} ». Ta liste a {n} tâches, et toi t’as des priorités fascinantes.',
        'L’algorithme te connaît mieux que ta mère. Et lui au moins, il te fait bosser. Pour lui.',
        '« {t} ». Mets-le sur ton CV, tant qu’à faire.'
      ],
      en: [
        '“{t}”. Your list has {n} tasks, and you have fascinating priorities.',
        'The algorithm knows you better than your mother does. And at least she makes you work. For her.',
        '“{t}”. Put it on your résumé, while you’re at it.'
      ]
    }
  },
  {
    key: 'netflix', procrastination: true,
    test: /Netflix/i,
    quips: {
      fr: [
        'Netflix à {h}. Courageux, pour quelqu’un dont la doyenne des tâches va fêter son anniversaire.',
        'Un épisode. « Un ». J’ai un carnet entier de ce mensonge.'
      ],
      en: [
        'Netflix at {h}. Brave, for someone whose oldest task is about to celebrate a birthday.',
        'One episode. “One”. I have a whole notebook of that lie.'
      ]
    }
  },
  {
    key: 'streaming', procrastination: true,
    test: /(Prime Video|Disney\+|Crunchyroll|Canal\+|MyTF1|Hulu|Max\b)/i,
    quips: {
      fr: [
        'Encore une série. Ta vie aussi a un scénario, mais personne l’écrit.',
        'Saison 4 épisode 9. Ta todo list, elle, est bloquée au pilote.'
      ],
      en: [
        'Another series. Your life has a storyline too, but nobody is writing it.',
        'Season 4, episode 9. Your todo list, meanwhile, is still stuck at the pilot.'
      ]
    }
  },
  {
    key: 'tiktok', procrastination: true,
    test: /TikTok/i,
    quips: {
      fr: [
        'TikTok. Rendez-vous dans une heure : cerveau liquéfié, tâches intactes.',
        'Des inconnus dansent, et toi tu coules. Wouf.'
      ],
      en: [
        'TikTok. See you in an hour: brain liquefied, tasks intact.',
        'Strangers are dancing, and you’re sinking. Woof.'
      ]
    }
  },
  {
    key: 'twitter', procrastination: true,
    test: /(Twitter| \/ X -|^X -| sur X| on X)/i,
    quips: {
      fr: [
        'X. Trente minutes de gens énervés. Ta liste, elle, est juste déçue.',
        'Poste « la discipline change une vie ». Ça fera un truc de fait aujourd’hui.'
      ],
      en: [
        'X. Thirty minutes of angry people. Your list, meanwhile, is just disappointed.',
        'Post “discipline changes everything”. That’ll be one thing done today.'
      ]
    }
  },
  {
    key: 'instagram', procrastination: true,
    test: /Instagram/i,
    quips: {
      fr: [
        'Instagram. Des gens beaux qui mentent, regardés par un type qui procrastine. L’économie moderne.',
        'Tu scrolles des vies parfaites, allongé sur ta todo list. Poétique.',
        'Double-tape. Voilà. C’est ça, ton output du jour.'
      ],
      en: [
        'Instagram. Beautiful people lying, watched by a guy procrastinating. The modern economy.',
        'You scroll perfect lives, lying down on your todo list. Poetic.',
        'Double-tap. There. That’s your output for the day.'
      ]
    }
  },
  {
    key: 'facebook', procrastination: true,
    test: /Facebook/i,
    quips: {
      fr: [
        'Facebook. T’espionnes des gens du collège. Certains ont réussi. Ferme, vite.',
        'T’es sur Facebook. Même ta mère y va plus.'
      ],
      en: [
        'Facebook. You’re spying on people from middle school. Some made it. Close it, quickly.',
        'You’re on Facebook. Even your mom moved on.'
      ]
    }
  },
  {
    key: 'reddit', procrastination: true,
    test: /Reddit/i,
    quips: {
      fr: [
        'Reddit. « Je fais des recherches. » Quarante minutes. Sur des chats.',
        'Tu lis des inconnus débattre. Ta liste aussi aimerait un peu de ce temps de parole.'
      ],
      en: [
        'Reddit. “I’m doing research.” Forty minutes. About cats.',
        'You watch strangers argue. Your list would like some of that speaking time too.'
      ]
    }
  },
  {
    key: 'twitch', procrastination: true,
    test: /Twitch/i,
    quips: {
      fr: [
        'Twitch. Tu regardes quelqu’un vivre sa vie en direct. La tienne est en pause.',
        'Lui il stream, toi tu regardes, ta liste pourrit. Chacun son rôle.'
      ],
      en: [
        'Twitch. You watch someone live their life in real time. Yours is on pause.',
        'He streams, you watch, your list rots. Everyone has a role.'
      ]
    }
  },
  {
    key: 'linkedin',
    test: /LinkedIn/i,
    quips: {
      fr: [
        'LinkedIn. Tout le monde ment, mais avec des mots-clés. Retourne bosser, futur « visionnaire ».',
        '« Fier d’annoncer »… que t’as {n} tâches pas faites. Poste ça, pour voir.'
      ],
      en: [
        'LinkedIn. Everyone lies, but with keywords. Get back to work, future “visionary”.',
        '“Proud to announce”… that you have {n} unfinished tasks. Post that, let’s see.'
      ]
    }
  },
  {
    key: 'shopping', procrastination: true,
    test: /(Amazon|AliExpress|Temu|Shein|eBay|Etsy|Wish|Vinted|Leboncoin|Cdiscount)/i,
    quips: {
      fr: [
        'Encore un panier. T’achètes de la dopamine avec livraison en 48h.',
        'Le colis arrivera avant ta première coche du jour. Pari tenu ?'
      ],
      en: [
        'Another cart. You’re buying dopamine with 48-hour delivery.',
        'The parcel will arrive before your first checkmark of the day. Any takers?'
      ]
    }
  },
  {
    key: 'dating', procrastination: true,
    test: /(Tinder|Bumble|Hinge|Match|OkCupid|Meetic|Fruitz)/i,
    quips: {
      fr: [
        'Tinder. Coche des tâches. Statistiquement, ça matchera plus.',
        'Tu swipes. Ta liste aussi rêve d’un match, à l’occasion.'
      ],
      en: [
        'Tinder. Check some tasks. Statistically, that matches more.',
        'You swipe. Your list also dreams of a match, once in a while.'
      ]
    }
  },
  {
    key: 'adult', procrastination: true,
    test: /(Pornhub|XVideos|xHamster|OnlyFans)/i,
    quips: {
      fr: [
        'Je n’ai rien vu. Le rapport non plus. Ça fera une croquette, pour mon silence.',
        'Bon. On va appeler ça une pause « bien-être ». Retour au travail.'
      ],
      en: [
        'I saw nothing. The report didn’t either. That’s worth a kibble, for my silence.',
        'Fine. We’ll call it a “wellness” break. Back to work.'
      ]
    }
  },
  {
    key: 'game', procrastination: true,
    test: /(Steam|Epic Games|Fortnite|League of Legends|Valorant|Minecraft|Rocket League)/i,
    quips: {
      fr: [
        'Une partie. « Une ». Ce mot n’a jamais voulu dire un.',
        '{n} tâches en attente et toi t’es en ranked. Le vrai elo, c’est ta liste.'
      ],
      en: [
        'One game. “One”. That word has never meant one.',
        '{n} tasks pending and you’re in ranked. The real elo is your list.'
      ]
    }
  },
  {
    key: 'travel',
    test: /(Booking|Airbnb|Skyscanner|Kayak)/i,
    quips: {
      fr: [
        'Tu planifies des vacances « méritées ». Le verbe est au futur. Très au futur.'
      ],
      en: [
        'You’re planning “well-deserved” vacations. The verb is in the future tense. Very far in the future.'
      ]
    }
  },
  {
    key: 'ai',
    test: /(Claude|ChatGPT|Gemini|Copilot|Mistral)/i,
    quips: {
      fr: [
        'Encore une IA au travail. Toi tu « supervises ». Superviser, c’est regarder, mais en anglais.',
        'Tu délègues à une IA devant ton chien virtuel. Réfléchis à la chaîne de commandement.'
      ],
      en: [
        'Another AI at work. And you “supervise”. Supervising is just watching, but in Latin.',
        'You delegate to an AI in front of your virtual dog. Think about the chain of command.'
      ]
    }
  },
  {
    key: 'code', work: true,
    test: /(Visual Studio Code|Cursor|IntelliJ|PyCharm|WebStorm)/i,
    quips: {
      fr: [
        'Du code. Un side project, je suppose. Le troisième. Les deux autres, je les enterre où ?',
        'VS Code ouvert depuis un moment. Le curseur clignote. Lui aussi, il attend.'
      ],
      en: [
        'Code. A side project, I assume. The third one. Where am I supposed to bury the other two?',
        'VS Code has been open for a while. The cursor is blinking. It’s waiting too.'
      ]
    }
  },
  {
    key: 'docs', work: true,
    test: /(Notion|Google Docs|Obsidian|OneNote)/i,
    quips: {
      fr: [
        'Notion. Organiser l’organisation de l’organisation. À un moment, il faudra FAIRE.'
      ],
      en: [
        'Notion. Organizing the organization of the organization. At some point you’ll have to DO.'
      ]
    }
  },
  {
    key: 'excel', work: true,
    test: /(Excel|Google Sheets)/i,
    quips: {
      fr: [
        'Excel. Personne l’ouvre pour le plaisir. Mes condoléances, bon courage.'
      ],
      en: [
        'Excel. Nobody opens it for fun. My condolences, good luck.'
      ]
    }
  },
  {
    key: 'mail', work: true,
    test: /(Gmail|Outlook|Inbox|Boîte de réception)/i,
    quips: {
      fr: [
        'Quatrième relecture du même mail. Envoie. C’est un mail, pas un testament.'
      ],
      en: [
        'Fourth proofread of the same email. Send it. It’s an email, not a will.'
      ]
    }
  },
  {
    key: 'chat',
    test: /(WhatsApp|Discord|Telegram|Messenger|Slack)/i,
    quips: {
      fr: [
        '{t}. « Je réponds vite fait. » C’était il y a quarante minutes, l’ami.'
      ],
      en: [
        '{t}. “Quick reply.” That was forty minutes ago, buddy.'
      ]
    }
  },
  {
    key: 'creative', work: true,
    test: /(Photoshop|Blender|Premiere|After Effects|Figma|DaVinci)/i,
    quips: {
      fr: [
        'Un dernier petit ajustement. Le quarantième. J’ai compté.'
      ],
      en: [
        'One last tiny adjustment. The fortieth. I counted.'
      ]
    }
  }
];

// True facts, dropped without warning.
const DOG_FACTS = {
  fr: [
    'Fait : un chien moyen comprend cent cinquante mots. Moi, je lis tes fenêtres. Fais le calcul.',
    'Fait : un border collie peut mémoriser mille objets. Moi, chaque tâche que tu repousses.',
    'Fait : les chiens sentent le stress dans la sueur. Pas besoin, moi. J’ai ta todo list.',
    'Fait : ton cerveau met vingt-trois minutes à se reconcentrer après une distraction. Je dis ça, je surveille tes onglets.'
  ],
  en: [
    'Fact: the average dog understands a hundred and fifty words. Me, I read your windows. Do the math.',
    'Fact: a border collie can memorize a thousand objects. Me: every task you postpone.',
    'Fact: dogs smell stress in sweat. I don’t need to. I have your todo list.',
    'Fact: your brain needs twenty-three minutes to refocus after a distraction. Just saying. I monitor your tabs.'
  ]
};

// ---------- Situations (time of day, workload, stale tasks) ----------
function situationCandidates(pending, windowsCount) {
  const out = [];
  const now = new Date();
  const h = now.getHours();
  const day = now.getDay();
  const fr = currentLang() === 'fr';
  const h12 = ((h + 11) % 12) + 1;
  const ampm = h < 12 ? 'a.m.' : 'p.m.';
  const heure = fr ? `${h}h` : `${h12} ${ampm}`;

  if (h >= 23 || h < 5) out.push({ key: 'latenight', text: fr
    ? `Il est ${h}h. Je suis une application, et même moi je trouve ça déraisonnable.`
    : `It’s ${h12} ${ampm}. I’m an app, and even I find this unreasonable.` });
  if (h >= 12 && h < 14 && pending.length) out.push({ key: 'lunch', text: fr
    ? 'Va manger. La liste sera encore là. Elle part jamais, elle.'
    : 'Go eat. The list will still be here. It never leaves, you know.' });
  if (day === 1 && h < 12) out.push({ key: 'monday', text: fr
    ? 'Lundi. Nouveau toi. Même liste que l’ancien toi, par contre.'
    : 'Monday. New you. Same list as old you, though.' });
  if (day === 5 && h >= 16) out.push({ key: 'friday', text: fr
    ? `Vendredi, ${h}h. Statistiquement, c’est terminé. On se dit à lundi.`
    : `Friday, ${h12} ${ampm}. Statistically, it’s over. See you Monday.` });
  if (windowsCount >= 12) out.push({ key: 'windows', text: fr
    ? `${windowsCount} fenêtres ouvertes. Il y en a forcément une où tu travailles. Forcément.`
    : `${windowsCount} windows open. One of them has to be work. Has to.` });

  const oldest = oldestTask(pending);
  if (oldest && oldest.days >= 3) {
    out.push({ key: 'oldtask', text: fr
      ? `« ${shortText(oldest.t.text)} », jour ${oldest.days}. Je commence à m’attacher à elle. On la garde ?`
      : `“${shortText(oldest.t.text)}”, day ${oldest.days}. I’m starting to get attached to it. Are we keeping it?` });
  }
  if (Math.random() < 0.25) out.push({ key: 'fact', text: randOf(fr ? DOG_FACTS.fr : DOG_FACTS.en) });
  return out;
}

function oldestTask(pending) {
  return pending
    .map(t => ({ t, days: Math.floor((Date.now() - new Date(t.createdAt).getTime()) / 86400000) }))
    .sort((a, b) => b.days - a.days)[0] || null;
}

function shortText(s, max = 30) {
  return s.length > max ? s.slice(0, max - 2) + '…' : s;
}

function fillTemplate(tpl, extracted, pending, windowsCount) {
  const tt = (extracted || '').trim();
  const h = new Date().getHours();
  const fr = currentLang() === 'fr';
  const h12 = ((h + 11) % 12) + 1;
  const ampm = h < 12 ? 'a.m.' : 'p.m.';
  return tpl
    .replace('{t}', shortText(tt, 45))
    .replace('{n}', pending.length)
    .replace('{h}', fr ? `${h}h` : `${h12} ${ampm}`)
    .replace('{w}', windowsCount);
}

const _recentKeys = [];
function _remember(key) {
  _recentKeys.push(key);
  if (_recentKeys.length > 4) _recentKeys.shift();
}

// ---------- Task ↔ window link ----------
const STOPWORDS = new Set([
  'pour', 'avec', 'dans', 'les', 'des', 'une', 'sur', 'faire', 'finir',
  'avant', 'chez', 'mon', 'ma', 'mes', 'ton', 'son', 'leur', 'cette',
  'que', 'qui', 'pas', 'plus', 'tout', 'tous', 'bien', 'voir', 'aussi',
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'file', 'nouveau',
  'then', 'have', 'will', 'your', 'mine', 'their', 'them', 'they',
  'when', 'what', 'some', 'just', 'very', 'into', 'onto', 'over',
  'under', 'about', 'after', 'before', 'make', 'made', 'need', 'want'
]);

function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function taskKeywords(text) {
  return normalize(text).split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !STOPWORDS.has(w));
}

// Returns { task, title, kw } if an open window "talks about" a task.
function findTaskWindowLink(pending, titles) {
  const normTitles = titles.map(t => ({ raw: t, norm: normalize(t) }));
  for (const task of pending) {
    for (const kw of taskKeywords(task.text)) {
      const hit = normTitles.find(w => w.norm.includes(kw));
      if (hit) return { task, title: hit.raw, kw };
    }
  }
  return null;
}

const LINK_QUIPS = {
  fr: [
    'Je vois « {win} ». Ça ressemble fort à « {task} ». Il est {hm}, je note que tu t’y mets.',
    '« {win} » ouvert. La tâche « {task} » a donc un espoir. Je m’assois, je regarde.',
    'Tiens. « {win} ». Et « {task} » dans la liste. Coïncidence ? Je note l’heure : {hm}.'
  ],
  en: [
    'I see “{win}”. Looks a lot like “{task}”. It’s {hm} — noting that you’re getting to it.',
    '“{win}” is open. The task “{task}” therefore has hope. I’ll sit. I’ll watch.',
    'Well, well. “{win}”. And “{task}” on the list. Coincidence? Logging the time: {hm}.'
  ]
};

function linkQuip(link) {
  const d = new Date();
  const fr = currentLang() === 'fr';
  const hm = fr
    ? `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`
    : `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  return randOf(currentLang() === 'fr' ? LINK_QUIPS.fr : LINK_QUIPS.en)
    .replace('{win}', shortText(link.title, 35))
    .replace('{task}', shortText(link.task.text))
    .replace('{hm}', hm);
}

function linkDoneQuip(minutes) {
  if (currentLang() === 'fr') {
    if (minutes < 1) return 'Coché. Peu de temps à l’écran, mais je ne vois pas tout. Bien joué.';
    return `Vu. ${minutes} minute${minutes > 1 ? 's' : ''} sur une fenêtre liée à cette tâche. Et maintenant la coche. Propre.`;
  }
  if (minutes < 1) return 'Checked. Little screen time, but I don’t see everything. Nicely done.';
  return `Seen. ${minutes} minute${minutes > 1 ? 's' : ''} on a related window. And now a checkmark. Nice.`;
}

// ---------- Ambient contextual quip ----------
function chooseContextQuip(ctx) {
  const { titles = [], pending = [], windowsCount = 0 } = ctx;
  // priority to the numbered remarks: that's where he impresses
  const intel = intelCandidates(ctx).filter(c => !_recentKeys.includes(c.key));
  if (intel.length && Math.random() < 0.65) {
    const pick = randOf(intel);
    _remember(pick.key);
    return pick;
  }
  const candidates = [];
  for (const d of APP_DETECTORS) {
    // Leisure-app remarks use the sustained-foreground trigger in the renderer.
    if (d.procrastination) continue;
    if (_recentKeys.includes(d.key)) continue;
    for (const title of titles) {
      const m = title.match(d.test);
      if (m) {
        candidates.push({ key: d.key, text: fillTemplate(randOf(d.quips[currentLang()]), m[1], pending, windowsCount) });
        break;
      }
    }
  }
  for (const c of situationCandidates(pending, windowsCount)) {
    if (!_recentKeys.includes(c.key)) candidates.push(c);
  }
  if (!candidates.length) return null;
  const pick = randOf(candidates);
  _remember(pick.key);
  return pick;
}

// Immediate roast when a procrastination app just opened.
function detectProcrastinationStart(prevTitles, titles, pending) {
  if (!pending.length) return null;
  for (const d of APP_DETECTORS) {
    if (!d.procrastination) continue;
    const nowMatch = titles.find(t => d.test.test(t));
    if (!nowMatch) continue;
    if (prevTitles.some(t => d.test.test(t))) continue;
    const m = nowMatch.match(d.test);
    _remember(d.key);
    return { key: d.key, text: fillTemplate(randOf(d.quips[currentLang()]), m && m[1], pending, titles.length) };
  }
  return null;
}

// ---------- Daily journal ----------
function todayKey() { return new Date().toISOString().slice(0, 10); }

function journalToday(journal) {
  const k = todayKey();
  if (!journal[k]) journal[k] = { added: 0, done: 0, zoomies: 0, cleans: 0, apps: {} };
  // keep 14 days max
  for (const key of Object.keys(journal)) {
    if (Object.keys(journal).length <= 14) break;
    if (key !== k) delete journal[key];
  }
  return journal[k];
}

// Accumulates time (seconds) spent per detected app. Called on every poll.
function accumulateAppTime(journal, titles, seconds) {
  const j = journalToday(journal);
  for (const d of APP_DETECTORS) {
    if (titles.some(t => d.test.test(t))) {
      j.apps[d.key] = (j.apps[d.key] || 0) + seconds;
    }
  }
}

// ---------- Real focus (active window, measured per second) ----------
function accumulateFocus(journal, fgTitle, seconds) {
  if (!fgTitle) return;
  const j = journalToday(journal);
  if (!j.fg) j.fg = {};
  for (const d of APP_DETECTORS) {
    if (d.test.test(fgTitle)) {
      j.fg[d.key] = (j.fg[d.key] || 0) + seconds;
      return;
    }
  }
  j.fg.autre = (j.fg.autre || 0) + seconds;
}

function noteSwitch(journal) {
  const j = journalToday(journal);
  j.switches = (j.switches || 0) + 1;
}

function noteDoneHour(journal) {
  const j = journalToday(journal);
  if (!j.doneByHour) j.doneByHour = {};
  const h = new Date().getHours();
  j.doneByHour[h] = (j.doneByHour[h] || 0) + 1;
}

// ---------- Numbered, cross-referenced, precise remarks ----------
function intelCandidates({ journal, pending = [], sys, battery, switches10, fgTask }) {
  const out = [];
  if (!journal) return out;
  const fr = currentLang() === 'fr';
  const j = journalToday(journal);
  const fg = j.fg || {};
  const fgMin = (key) => Math.round((fg[key] || 0) / 60);

  let topProc = null;
  for (const d of APP_DETECTORS) {
    if (d.procrastination && fgMin(d.key) >= 8 && (!topProc || fgMin(d.key) > fgMin(topProc.key))) topProc = d;
  }
  if (topProc) {
    out.push({ key: 'i-proc', intel: true, text: fr
      ? `Environ ${fgMin(topProc.key)} minutes sur ${APP_LABELS.fr[topProc.key]} au premier plan. Pause ou boulot ? Toi seul sais.`
      : `About ${fgMin(topProc.key)} minutes with ${APP_LABELS.en[topProc.key]} in front. Break or work? Only you know.` });
  }

  const workMin = APP_DETECTORS.filter(d => d.work).reduce((s, d) => s + fgMin(d.key), 0);
  if (workMin >= 30 && j.done === 0 && pending.length) {
    out.push({ key: 'i-work0', intel: true, text: fr
      ? `${workMin} minutes dans tes outils de travail, zéro coche. Une tâche finie à valider ?`
      : `${workMin} minutes in work tools, zero checkmarks. Anything finished that needs checking off?` });
  }

  if (switches10 >= 20) {
    out.push({ key: 'i-switch', intel: true, text: fr
      ? `${switches10} changements de fenêtre en dix minutes. Un écureuil tiendrait mieux en place.`
      : `${switches10} window switches in ten minutes. A squirrel would hold still better.` });
  }

  if (sys) {
    if (sys.uptimeH >= 7) out.push({ key: 'i-uptime', intel: true, text: fr
      ? `Ce PC tourne depuis ${Math.round(sys.uptimeH)} heures. Si tu es là depuis aussi longtemps, pause. Même moi je m’assois.`
      : `This PC has been running for ${Math.round(sys.uptimeH)} hours. If you have too, take a break. Even I sit down.` });
    if (sys.freeMemGb != null && sys.totalMemGb && sys.freeMemGb / sys.totalMemGb < 0.12) {
      out.push({ key: 'i-ram', intel: true, text: fr
        ? `${sys.freeMemGb} Go de RAM libre sur ${Math.round(sys.totalMemGb)}. Ferme des onglets. Choisis avec ton cœur.`
        : `${sys.freeMemGb} GB of RAM free out of ${Math.round(sys.totalMemGb)}. Close some tabs. Choose with your heart.` });
    }
    if (sys.diskFreeGb != null && sys.diskFreeGb < 30) {
      out.push({ key: 'i-disk', intel: true, text: fr
        ? `${sys.diskFreeGb} Go libres sur C. Je n’enterre plus rien là-dedans.`
        : `${sys.diskFreeGb} GB free on C:. I’m not burying anything in there anymore.` });
    }
  }

  if (battery && battery.level <= 0.25 && !battery.charging) {
    out.push({ key: 'i-batt', intel: true, text: fr
      ? `${Math.round(battery.level * 100)} % de batterie, pas branché. On vit dangereusement.`
      : `${Math.round(battery.level * 100)}% battery, unplugged. We’re living dangerously.` });
  }

  if (sys && sys.bootToday && sys.bootH >= 10) {
    out.push({ key: 'i-boot', intel: true, text: fr
      ? `PC allumé à ${sys.bootH}h${String(sys.bootM).padStart(2, '0')}. Les marchés ouvrent sans toi, mais ils pensent à toi.`
      : `PC turned on at ${sys.bootH}:${String(sys.bootM).padStart(2, '0')} a.m. The markets open without you, but they think of you.` });
  }
  if (sys && sys.gameLaunchers >= 3) {
    out.push({ key: 'i-launchers', intel: true, text: fr
      ? `${sys.gameLaunchers} launchers de jeux installés. À un moment, c’est plus du loisir, c’est une collection.`
      : `${sys.gameLaunchers} game launchers installed. Past a certain point it’s not a hobby anymore, it’s a collection.` });
  }
  if (sys && sys.weather) {
    if (sys.weather.rain && pending.length) {
      out.push({ key: 'i-rain', intel: true, text: fr
        ? 'Il pleut. Dehors est annulé. Zéro excuse, donc : coche.'
        : 'It’s raining. Outside is cancelled. Zero excuses, therefore: check something.' });
    } else if (sys.weather.temp >= 26) {
      // API always returns Celsius; EN displays °F
      const temp = fr ? sys.weather.temp : Math.round(sys.weather.temp * 9 / 5 + 32);
      out.push({ key: 'i-sun', intel: true, text: fr
        ? `${temp}° dehors. Tu le sauras par la fenêtre. La mienne.`
        : `${temp}°F outside. You’ll find out through the window. My window.` });
    }
  }

  // trend over the journal history
  const days = Object.keys(journal).sort().slice(-4, -1);
  if (days.length === 3 && days.every(k => (journal[k].done || 0) === 0) && j.done === 0) {
    out.push({ key: 'i-trend', intel: true, text: fr
      ? 'Trois jours, zéro coche. À ce stade c’est plus une baisse de régime, c’est une tradition.'
      : 'Three days, zero checks. At this point it’s not a slump anymore, it’s a tradition.' });
  }

  // your productive slot, computed from your real checkmarks
  const hourAgg = {};
  for (const k of Object.keys(journal)) {
    const dbh = journal[k].doneByHour || {};
    for (const h of Object.keys(dbh)) hourAgg[h] = (hourAgg[h] || 0) + dbh[h];
  }
  const topHour = Object.entries(hourAgg).sort((a, b) => b[1] - a[1])[0];
  if (topHour && topHour[1] >= 3) {
    out.push({ key: 'i-hour', intel: true, text: fr
      ? `Statistiquement, tu coches surtout vers ${topHour[0]}h. C’est ton créneau. Défends-le.`
      : `Statistically, you check things around ${topHour[0]}:00. That’s your slot. Defend it.` });
  }

  const urgent = pending.find(t => /\b(urgent|asap|vite|deadline|demain|tomorrow|today)\b/i.test(t.text)
    && (Date.now() - new Date(t.createdAt).getTime()) > 86400000);
  if (urgent) {
    const d = Math.floor((Date.now() - new Date(urgent.createdAt).getTime()) / 86400000);
    out.push({ key: 'i-urgent', intel: true, text: fr
      ? `« ${shortText(urgent.text)} » contient le mot urgent. Jour ${d}. Les mots ont perdu leur sens.`
      : `“${shortText(urgent.text)}” contains the word urgent. Day ${d}. Words have lost all meaning.` });
  }

  if (fgTask && fgTask.minutes >= 12) {
    // private: quotes a window title → local voice only, never Gemini
    out.push({ key: 'i-fgtask', intel: true, private: true, text: fr
      ? `${fgTask.minutes} minutes de focus sur « ${shortText(fgTask.win, 30)} ». La tâche « ${shortText(fgTask.task.text)} » sent la coche imminente. Je prépare le tampon.`
      : `${fgTask.minutes} minutes of focus on “${shortText(fgTask.win, 30)}”. The task “${shortText(fgTask.task.text)}” smells like an imminent checkmark. Preparing the stamp.` });
  }

  return out;
}

const APP_LABELS = {
  fr: {
    youtube: 'YouTube', netflix: 'Netflix', tiktok: 'TikTok', twitter: 'X',
    instagram: 'Instagram', facebook: 'Facebook', reddit: 'Reddit', twitch: 'Twitch',
    linkedin: 'LinkedIn', shopping: 'Shopping', dating: 'Dating', adult: '…bref',
    streaming: 'Streaming', travel: 'Voyages', game: 'Jeux', ai: 'IA', code: 'Code',
    docs: 'Notes', excel: 'Tableurs', mail: 'Mails', chat: 'Messageries', creative: 'Créa'
  },
  en: {
    youtube: 'YouTube', netflix: 'Netflix', tiktok: 'TikTok', twitter: 'X',
    instagram: 'Instagram', facebook: 'Facebook', reddit: 'Reddit', twitch: 'Twitch',
    linkedin: 'LinkedIn', shopping: 'Shopping', dating: 'Dating apps', adult: '…anyway',
    streaming: 'Streaming', travel: 'Travel', game: 'Games', ai: 'AI', code: 'Code',
    docs: 'Notes', excel: 'Spreadsheets', mail: 'Email', chat: 'Chat apps', creative: 'Creative'
  }
};

function minutesOf(j, filter) {
  return Math.round(APP_DETECTORS
    .filter(filter)
    .reduce((s, d) => s + ((j.fg || {})[d.key] || 0), 0) / 60);
}

function buildReport(journal, pending) {
  const fr = currentLang() === 'fr';
  const j = journalToday(journal);
  const distraction = minutesOf(j, d => d.procrastination);
  const work = minutesOf(j, d => d.work);
  const labels = APP_LABELS[currentLang()];
  const pet = (typeof window !== 'undefined' && window.petName) || (fr ? 'le chien' : 'the dog');
  const lines = [fr ? `Rapport du jour — établi par ${pet}.` : `Daily report — compiled by ${pet}.`];
  lines.push(fr
    ? `Tâches : ${j.added} ajoutée${j.added > 1 ? 's' : ''}, ${j.done} cochée${j.done > 1 ? 's' : ''}, ${pending.length} en attente.`
    : `Tasks: ${j.added} added, ${j.done} checked, ${pending.length} pending.`);
  const topApp = Object.entries(j.apps).sort((a, b) => b[1] - a[1])[0];
  if (topApp) lines.push(fr
    ? `App la plus vue : ${labels[topApp[0]] || topApp[0]}, ${Math.round(topApp[1] / 60)} min.`
    : `Most visible app: ${labels[topApp[0]] || topApp[0]}, ${Math.round(topApp[1] / 60)} min.`);
  const jfg = j.fg || {};
  const topFocus = Object.entries(jfg).filter(([k]) => k !== 'autre').sort((a, b) => b[1] - a[1])[0];
  if (topFocus && topFocus[1] > 120) {
    lines.push(fr
      ? `Au premier plan : ${labels[topFocus[0]] || topFocus[0]}, environ ${Math.round(topFocus[1] / 60)} min.`
      : `In the foreground: ${labels[topFocus[0]] || topFocus[0]}, about ${Math.round(topFocus[1] / 60)} min.`);
  }
  if (j.switches) lines.push(fr ? `Changements de fenêtre : ${j.switches}.` : `Window switches: ${j.switches}.`);
  if (j.focusWins) lines.push(fr ? `Chronos gagnés : ${j.focusWins}. 🏆` : `Timers won: ${j.focusWins}. 🏆`);
  if (distraction) lines.push(fr ? `Sites / apps de loisir au premier plan : ${distraction} min (peuvent aussi servir au travail).` : `Leisure sites / apps in front: ${distraction} min (may also be used for work).`);
  if (work) lines.push(fr ? `Outils de travail au premier plan : ${work} min.` : `Work tools in front: ${work} min.`);
  const oldest = oldestTask(pending);
  if (oldest && oldest.days >= 1) lines.push(fr
    ? `Doyenne de la liste : « ${shortText(oldest.t.text)} », ${oldest.days} jour${oldest.days > 1 ? 's' : ''}.`
    : `Oldest task on the list: “${shortText(oldest.t.text)}”, ${oldest.days} day${oldest.days > 1 ? 's' : ''}.`);
  if (j.zoomies) lines.push(fr ? `Crises de zoomies : ${j.zoomies}. Aucune excuse.` : `Zoomie episodes: ${j.zoomies}. No excuse.`);
  if (j.cleans) lines.push(fr ? `Bureaux rangés : ${j.cleans}. Par moi.` : `Desks tidied: ${j.cleans}. By me.`);
  lines.push(verdictLine(j, distraction, work));
  lines.push(fr ? 'Je compte. C’est mon travail.' : 'I count. It’s my job.');
  return lines;
}

function verdictLine(j, distraction, work) {
  if (currentLang() === 'fr') {
    if (j.done === 0 && distraction > 30) return 'Verdict : demain, peut-être. Sans conviction.';
    if (j.done === 0) return 'Verdict : zéro cochée. Le chien a vu, le chien se tait.';
    if (j.done >= 3 || (work > distraction && j.done > 0)) return 'Verdict : jour rare. Encadre-le.';
    return 'Verdict : correct. Sans plus.';
  }
  if (j.done === 0 && distraction > 30) return 'Verdict: tomorrow, maybe. No conviction behind it.';
  if (j.done === 0) return 'Verdict: zero checked. The dog saw, the dog says nothing.';
  if (j.done >= 3 || (work > distraction && j.done > 0)) return 'Verdict: rare day. Frame it.';
  return 'Verdict: acceptable. Barely.';
}

function reportSummarySpeech(journal, pending) {
  const fr = currentLang() === 'fr';
  const j = journalToday(journal);
  const distraction = minutesOf(j, d => d.procrastination);
  let s = fr
    ? `Rapport. ${j.added} tâches ajoutées, ${j.done} cochées, ${pending.length} en attente.`
    : `Report. ${j.added} tasks added, ${j.done} checked, ${pending.length} pending.`;
  if (distraction) s += fr ? ` Apps classées loisir au premier plan : environ ${distraction} minutes.` : `Apps classified as leisure in front: about ${distraction} minutes.`;
  s += ' ' + verdictLine(j, distraction, minutesOf(j, d => d.work));
  return s;
}
