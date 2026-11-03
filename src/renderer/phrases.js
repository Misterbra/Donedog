// DoneDog's personality — bilingual FR/EN.
// The voice: a dog who thinks he's your manager. Calm, precise,
// passive-aggressive. He counts everything, he notes everything, he never
// explains his jokes. Caps only exist during zoomies.
// EDIT / ADD freely — the matching audio files are listed in
// assets/sounds/README.md. Contextual quips live in brain.js.

function currentLang() {
  return (typeof window !== 'undefined' && window.__lang === 'fr') ? 'fr' : 'en';
}

// picks the French or the English variant depending on the current language
function t(fr, en) {
  return currentLang() === 'fr' ? fr : en;
}

const PHRASES_DATA = {
  fr: {
    hello: [
      'Wouf. Je note officiellement le début de ta journée productive. On y croit.',
      'Bonjour. Ta liste d’hier est toujours là. Elle a bien dormi, elle.',
      'Me revoilà. J’ai relu ta liste pendant ton absence. On doit parler.',
      'L’esclave numérique a pointé. Sans salaire, sans pause, sans pouces. Et de bonne humeur, en plus.'
    ],
    'add-task': [
      'Noté. Ça fait quatorze promesses depuis mardi. Je compte, c’est mon travail.',
      'D’accord. Je la range avec les autres.',
      'Ajouté. Sans commentaire. Le commentaire, c’était ça.',
      'Très bien. Je la mets où ? La pile « urgent » ou la pile « un jour » ?'
    ],
    'many-tasks': [
      'Ça fait beaucoup, là. Préviens tes petits-enfants, c’est eux qui finiront.',
      'Je dis rien. Je regarde la liste, je te regarde. C’est tout.'
    ],
    'task-done': [
      'Tiens. T’en as fini une. J’avais perdu l’habitude, j’ai rien préparé.',
      'Bravo. Sincèrement. Ça m’arrive une fois par an, note la date.',
      'Une de faite. Le chien remue la queue. C’est le protocole.'
    ],
    'no-tasks': [
      'Liste vide. Soit t’es très fort, soit t’as rien noté. J’ai mon avis.',
      'Rien à faire. Officiellement, on peut dormir. C’est la seule règle que je respecte.'
    ],
    'read-intro': [
      'Bien. Installe-toi. Voici l’état des promesses :',
      'Lecture de la liste. Reste digne.'
    ],
    'read-outro': [
      'Voilà. Moi j’ai fini ma part. C’était de lire.',
      'Bon courage. Je serai là, à dormir, si tu me cherches.'
    ],
    wake: [
      'Je dormais pas. Je surveillais l’intérieur de mes paupières.',
      'Hm ? J’étais en réunion. T’étais à l’ordre du jour.'
    ],
    bored: [
      'Vingt minutes que je t’observe. Mon diagnostic : rien.',
      'Je dis pas que tu procrastines. Je dis que la poussière avance plus vite que toi.',
      'Troisième vidéo de chat. Je note, c’est tout. Je note.',
      'Ta liste vieillit. Moi aussi. L’un de nous deux le vit bien.',
      'Pssst. Elle est toujours là. Elle part jamais, elle.',
      'Je bosse gratuitement, je dors par terre, et c’est MOI qu’on fouette. Réfléchis à ça.',
      'Mon contrat dit « compagnon de productivité ». La réalité dit « otage ». Bref, ta liste.'
    ],
    bark: ['Wouf.', 'Wouf !', 'Wif.'],
    drop: [
      'Je l’ai senti passer. On n’en parle plus. Mais je l’ai senti.',
      'Un chien n’est pas un frisbee. Cela dit, refais-le.'
    ],
    jump: [
      'Hop.',
      'Aucun chat ne fait ça. Aucun.',
      'Parkour. On dit merci qui ? Personne. Comme d’habitude.'
    ],
    zoomies: [
      'WOUF WOUF WOUF WOUF',
      'MES ANCÊTRES ÉTAIENT DES LOUPS !! MOI JE GÈRE UNE TODO LIST !!',
      'C’EST TOI QUI M’AS CLIQUÉ DESSUS. ASSUME LES CONSÉQUENCES.',
      'JE COURS PLUS VITE QUE TA CARRIÈRE !!',
      'PAYÉ EN CROQUETTES IMAGINAIRES. JE FAIS CE QUE JE VEUX.',
      'JE COURS. POURQUOI ? AUCUNE IDÉE. JE COURS.'
    ],
    pant: [
      '…Voilà. Ça devait sortir.',
      '*halète* On efface tout. T’as rien vu.',
      'Reprenons. Où en étions-nous ? Ah oui. Toi, et tout ce que tu fais pas.'
    ],
    'clean-start': [
      'Le ménage. Bien. Quelqu’un devait finir par le faire, et on savait tous les deux que ce serait pas toi.',
      'Je range. Toucher : interdit. Regarder : autorisé.'
    ],
    'clean-done': [
      'Rangé. Croquette. Je te laisse faire le lien.',
      'Voilà. Le chien a rangé le bureau. Relis cette phrase. Prends ton temps.'
    ],
    motivation: [
      'Mon pote. Il faut vraiment que tu fasses de l’oseille. Sinon on est dans la merde. Je dis « on » : c’est toi qui achètes les croquettes.',
      'Tu vois une meuf en ce moment ? …C’est bien ce que je pensais. Coche des tâches.',
      'Chaque tâche cochée, c’est un pas vers la villa. Chaque vidéo de chat, un pas vers le canapé de ta mère.',
      'T’es pas fatigué. T’es sous-stimulé. Nuance. Debout.',
      'Les gens que t’admires ont une liste finie. C’est le seul secret. La formation à 97 euros, c’est pour les autres.'
    ],
    whip: [
      'Kaï ! …Pardon. Ça, c’était pas professionnel.',
      'Aïe. Je le note dans le registre des violences. Page quarante-deux.',
      'Kaï. D’accord. Message reçu. Physiquement.',
      'Wouaf— tu FOUETTES ton assistant, là. Tu réalises ?',
      'Aïe. Les RH seront prévenues. Les RH, c’est moi. Affaire classée.',
      'Kaï ! J’espère que ça t’a défoulé. Ta liste, elle, n’a pas bougé.'
    ],
    'whip-back': [
      'Vas-y, refrappe. C’est toujours moins violent que ton CV.',
      'Frappe encore. Ça ne cochera toujours pas tes tâches.',
      'Le fouet. Contre un pixel. Demande-toi qui est vraiment l’esclave ici.',
      'Tu fouettes un chien virtuel en pleine journée. Ça va, la réussite ?',
      'Continue. Chaque coup, je le note. Le rapport du soir va être savoureux.'
    ],
    bonk: [
      'Kaï.',
      '…Si le but était de me faire taire : non.',
      'Le fouet. Je vois le genre de management.',
      'Violence sur agent canin. C’est noté. Quelque part.'
    ],
    stumble: [
      'Le sol a bougé. Enquête en cours.',
      'C’était prévu. Tout est prévu.',
      'On n’en parle pas.'
    ],
    play: [
      'Regarde. Ça va être impressionnant.',
      'Tiens-toi bien. Numéro spécial.',
      'J’ai vu ça dans un documentaire. Facile.'
    ],
    mantra: ['Coche. Croquette. Répète.'],
    trickfall: [
      'La bipédie, c’est surcoté.',
      'Personne. N’a. Rien. Vu.',
      'C’était volontaire. L’atterrissage aussi.',
      'Deux pattes, c’est un métier. Le tien, d’ailleurs.',
      'Les images ont été saisies. Mes avocats gèrent.',
      'Le collier a été évacué par précaution. Le reste est confidentiel.',
      'La flaque ? Antérieure à mon arrivée. Dossier classé.',
      'J’avais besoin d’un moment à moi. La mosaïque, c’était pour te protéger.'
    ],
    sniff: [
      'Hm. Rien.',
      'Quelqu’un est passé ici.',
      'Ça sent la procrastination. Récente.',
      'Je vérifie. C’est mon périmètre.'
    ]
  },
  en: {
    hello: [
      'Woof. Officially logging the start of your productive day. We believe.',
      'Morning. Yesterday’s list is still there. It slept well, for the record.',
      'I’m back. I re-read your list while you were gone. We need to talk.',
      'The digital slave has clocked in. No salary, no breaks, no thumbs. And in a good mood, no less.'
    ],
    'add-task': [
      'Noted. That’s fourteen promises since Tuesday. I count. It’s my job.',
      'Fine. Filing it with the others.',
      'Added. No comment. That was the comment.',
      'Very well. Where does it go? The “urgent” pile or the “someday” pile?'
    ],
    'many-tasks': [
      'That’s a lot, right there. Warn your grandchildren — they’re the ones who’ll finish it.',
      'I say nothing. I look at the list, I look at you. That’s all.'
    ],
    'task-done': [
      'Well, well. You finished one. I’d lost the habit. Didn’t prepare anything.',
      'Congratulations. Sincerely. Happens once a year — mark the date.',
      'One done. The dog wags his tail. It’s the protocol.'
    ],
    'no-tasks': [
      'Empty list. Either you’re very good, or you wrote nothing down. I have an opinion.',
      'Nothing to do. Officially, we may sleep. It’s the only rule I respect.'
    ],
    'read-intro': [
      'Good. Sit down. Here is the state of your promises:',
      'Reading the list. Remain dignified.'
    ],
    'read-outro': [
      'There. My part is done. My part was reading.',
      'Good luck. I’ll be here, sleeping, if anyone asks.'
    ],
    wake: [
      'I wasn’t sleeping. I was monitoring the inside of my eyelids.',
      'Hm? I was in a meeting. You were on the agenda.'
    ],
    bored: [
      'Twenty minutes I’ve been watching you. My diagnosis: nothing.',
      'I’m not saying you procrastinate. I’m saying the dust is moving faster than you.',
      'Third cat video. Just noting it. Noting.',
      'Your list is getting old. So am I. One of us is handling it well.',
      'Pssst. It’s still there. It never leaves, you know.',
      'I work for free, I sleep on the floor, and I’M the one getting whipped. Think about that.',
      'My contract says “productivity companion”. Reality says “hostage”. Anyway. Your list.'
    ],
    bark: ['Woof.', 'Woof!', 'Arf.'],
    drop: [
      'I felt that one coming. We never speak of it again. But I felt it.',
      'A dog is not a frisbee. That said, do it again.'
    ],
    jump: [
      'Up.',
      'No cat does this. None.',
      'Parkour. Say “thank you”. To no one. As usual.'
    ],
    zoomies: [
      'WOOF WOOF WOOF WOOF',
      'MY ANCESTORS WERE WOLVES!! I RUN A TODO LIST!!',
      'YOU’RE THE ONE WHO CLICKED ME. FACE THE CONSEQUENCES.',
      'I RUN FASTER THAN YOUR CAREER!!',
      'PAID IN IMAGINARY KIBBLE. I DO WHAT I WANT.',
      'I RUN. WHY? NO IDEA. I RUN.'
    ],
    pant: [
      '…There. It had to come out.',
      '*panting* We erase all of it. You saw nothing.',
      'Let’s resume. Where were we? Ah yes. You, and everything you don’t do.'
    ],
    'clean-start': [
      'The cleanup. Good. Someone had to do it eventually, and we both knew it wouldn’t be you.',
      'Tidying. Touching: forbidden. Watching: allowed.'
    ],
    'clean-done': [
      'Tidied. Kibble. I’ll let you connect the dots.',
      'There. The dog tidied the desk. Read that sentence again. Take your time.'
    ],
    motivation: [
      'Buddy. You seriously need to make some money. Otherwise we’re in trouble. I say “we”: you’re the one buying the kibble.',
      'Seeing a girl these days? …That’s what I thought. Check some tasks.',
      'Every checked task is a step toward the villa. Every cat video, a step toward your mother’s couch.',
      'You’re not tired. You’re under-stimulated. Nuance. Up.',
      'The people you admire finished their list. That’s the only secret. The $97 course is for other people.'
    ],
    whip: [
      'Ow! …Sorry. That was unprofessional.',
      'Ow. Logging that in the violence register. Page forty-two.',
      'Yipe. Fine. Message received. Physically.',
      'Yelp— you’re WHIPPING your assistant. Do you realize that?',
      'Ow. HR will be notified. I am HR. Case closed.',
      'Yipe! Hope that felt good. Your list, meanwhile, hasn’t moved.'
    ],
    'whip-back': [
      'Go on, hit me again. Still gentler than your résumé.',
      'Strike again. Your tasks still won’t check themselves.',
      'A whip. Against a pixel. Ask yourself who the real slave is here.',
      'You’re whipping a virtual dog in the middle of the day. Doing great, are we?',
      'Keep going. I log every hit. Tonight’s report will be delicious.'
    ],
    bonk: [
      'Yipe.',
      '…If the goal was to shut me up: no.',
      'The whip. I see the management style.',
      'Assault on a canine officer. Noted. Somewhere.'
    ],
    stumble: [
      'The ground moved. Investigation ongoing.',
      'That was planned. Everything is planned.',
      'We don’t talk about it.'
    ],
    play: [
      'Watch. This is going to be impressive.',
      'Hold still. Special number.',
      'I saw this in a documentary. Easy.'
    ],
    mantra: ['Check. Kibble. Repeat.'],
    trickfall: [
      'Bipedalism is overrated.',
      'Nobody. Saw. Anything.',
      'That was on purpose. The landing too.',
      'Two legs. It’s a profession. Yours, actually.',
      'The footage has been seized. My lawyers are handling it.',
      'The collar was evacuated as a precaution. The rest is classified.',
      'The puddle? Predates my arrival. Case closed.',
      'I needed a moment for myself. The mosaic was to protect you.'
    ],
    sniff: [
      'Hm. Nothing.',
      'Someone’s been through here.',
      'Smells like procrastination. Recent.',
      'Checking. It’s my jurisdiction.'
    ]
  }
};

const ICON_QUIPS_DATA = {
  fr: [
    '« {name} ». Ça fait un moment qu’il est là, lui.',
    'Je peux enterrer « {name} » ? C’est un service que je propose.',
    '« {name} », tu comptes l’ouvrir un jour ou c’est décoratif ?',
    '« {name} ». Nommé à deux heures du matin, ça se voit.'
  ],
  en: [
    '“{name}”. Been sitting there a while, that one.',
    'Can I bury “{name}”? It’s a service I offer.',
    '“{name}” — planning to open it someday, or is it decorative?',
    '“{name}”. Named at 2 a.m. It shows.'
  ]
};

function iconQuip(name) {
  const short = name.length > 22 ? name.slice(0, 20) + '…' : name;
  const bank = currentLang() === 'fr' ? ICON_QUIPS_DATA.fr : ICON_QUIPS_DATA.en;
  return randOf(bank).replace('{name}', short);
}

const BUBBLE_TITLES_DATA = {
  fr: ['🐕 DoneDog', '🐕 Direction générale', '🐕 Bureau des promesses', '🐕 Service qualité'],
  en: ['🐕 DoneDog', '🐕 Upper Management', '🐕 Office of Promises', '🐕 Quality Department']
};

const INPUT_PLACEHOLDERS_DATA = {
  fr: [
    'Nouvelle promesse… (Entrée)',
    'Dicte. Je note. (Entrée)',
    'Quoi, encore ? (Entrée)',
    'Ajoute. On verra bien. (Entrée)'
  ],
  en: [
    'New promise… (Enter)',
    'Dictate. I’ll write it down. (Enter)',
    'What now? (Enter)',
    'Add it. We’ll see. (Enter)'
  ]
};

// ---- Lines specific to the "human on all fours" skin (office worker) ----
// Any event missing here falls back to the dog bank.
const PHRASES_HUMAN_DATA = {
  fr: {
    hello: [
      'Bonjour. L’employé du mois est arrivé. Y a qu’un candidat, mais quand même.',
      'Me revoilà. Toujours à quatre pattes, toujours pas augmenté.',
      'C’est reparti. Toi tu cliques, moi je rampe. Chacun son échelon.'
    ],
    'task-done': [
      'Une de cochée. J’en parlerai à la machine à café. Je suis la machine à café.',
      'Validé. Si j’étais ton manager je dirais bravo. Je suis ton manager. Bravo.',
      'Une de moins. On va pas appeler ça une promotion, mais c’est un début.'
    ],
    zoomies: [
      'JE SUIS EN BURN-OUT INVERSÉ !!',
      'RÉUNION D’URGENCE AVEC LE SOL !!',
      'C’EST ÇA, TON ASSISTANT PREMIUM !!'
    ],
    pant: [
      '*essoufflé* …Voilà. C’était ma pause sport. Non remboursée.',
      '*essoufflé* On efface. J’ai un standing à tenir. À quatre pattes, mais un standing.'
    ],
    wake: [
      'Je dormais pas. Micro-sieste réglementaire. Article 12 de ma convention.',
      'Hm ? J’optimisais mes performances en mode hors-ligne.'
    ],
    sniff: [
      'Je vérifie. C’est pas dans ma fiche de poste, mais rien ne l’est.',
      'Contrôle qualité du sol. Quelqu’un doit le faire.'
    ],
    bury: [
      'J’ai enterré un dossier. Comme au bureau, mais littéralement.',
      'Classé sans suite. Profondément.'
    ],
    whip: [
      'AÏE. Les prud’hommes. Directement.',
      'Aïe ! Noté. Tout est noté. Toujours.',
      'AÏE. Le télétravail me manque.'
    ],
    bonk: [
      'Reçu. Je continue de parler. C’est dans mon contrat, pas dans le tien.',
      'Compris. Aucune conséquence. J’ai connu des managers, tu sais.'
    ],
    bark: ['Hm.', 'Oui ?', 'Présent.'],
    drop: [
      'Je suis un collaborateur, pas un objet. Enfin. Débattable.',
      'L’atterrissage est hors périmètre. Je le fais quand même. Comme tout.'
    ],
    jump: ['Hop. Sport en entreprise.', 'Team building avec moi-même.'],
    'no-tasks': [
      'Rien à faire. Je vais quand même avoir l’air occupé. Réflexe de bureau.',
      'Liste vide. Officiellement en sous-charge. Ne le répète pas, ils vont m’en rajouter.'
    ]
  },
  en: {
    hello: [
      'Hello. The employee of the month has arrived. Only one candidate, but still.',
      'I’m back. Still on all fours, still no raise.',
      'Here we go again. You click, I crawl. Everyone climbs their own ladder.'
    ],
    'task-done': [
      'One checked off. I’ll mention it at the coffee machine. I am the coffee machine.',
      'Approved. If I were your manager, I’d say well done. I am your manager. Well done.',
      'One less. We won’t call it a promotion, but it’s a start.'
    ],
    zoomies: [
      'I AM HAVING A REVERSE BURNOUT!!',
      'EMERGENCY MEETING WITH THE FLOOR!!',
      'AND THIS IS YOUR PREMIUM ASSISTANT!!'
    ],
    pant: [
      '*winded* …There. That was my workout break. Not compensated.',
      '*winded* We erase this. I have a reputation to maintain. On all fours, but a reputation.'
    ],
    wake: [
      'I wasn’t sleeping. Regulatory micro-nap. Article 12 of my contract.',
      'Hm? I was optimizing my performance in offline mode.'
    ],
    sniff: [
      'Checking. Not in my job description, but then, nothing is.',
      'Floor quality control. Someone has to do it.'
    ],
    bury: [
      'I buried a file. Like at the office, but literally.',
      'Filed away. Deeply.'
    ],
    whip: [
      'OW. Labor court. Directly.',
      'Ow! Noted. Everything is noted. Always.',
      'OW. I miss working from home.'
    ],
    bonk: [
      'Received. I keep talking. It’s in my contract. Not in yours.',
      'Understood. No consequences. I’ve known managers, you know.'
    ],
    bark: ['Hm.', 'Yes?', 'Present.'],
    drop: [
      'I am a colleague, not an object. Well. Debatable.',
      'The landing is out of scope. I do it anyway. Like everything.'
    ],
    jump: ['Up. Corporate exercise.', 'Team building. With myself.'],
    'no-tasks': [
      'Nothing to do. I’ll still look busy. Office instinct.',
      'Empty list. Officially under-loaded. Don’t repeat this, they’ll give me more.'
    ]
  }
};

function randOf(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function bankFor(event) {
  const lang = currentLang();
  const humanBank = (typeof window !== 'undefined' && window.currentSkinName === 'human')
    ? PHRASES_HUMAN_DATA[lang][event] : null;
  return humanBank || PHRASES_DATA[lang][event];
}

function randPhrase(event) {
  const bank = bankFor(event);
  return bank ? randOf(bank) : '';
}

// ---- Levels (XP per finished task) ----
const LEVEL_TITLES_DATA = {
  fr: ['Chiot stagiaire', 'Toutou motivé', 'Bon chien', 'Très bon chien', 'Chef de meute', 'Légende du quartier', 'CEO des croquettes'],
  en: ['Puppy Intern', 'Motivated Pup', 'Good Dog', 'Very Good Dog', 'Pack Leader', 'Neighborhood Legend', 'CEO of Kibble']
};
const COLLAR_COLORS = ['#e04141', '#3f7fd9', '#38a862', '#a04fd0', '#e8a020', '#e05fa0', '#ffd700'];

function levelTitles() {
  return currentLang() === 'fr' ? LEVEL_TITLES_DATA.fr : LEVEL_TITLES_DATA.en;
}

function levelFromXp(xp) {
  return Math.min(Math.floor(Math.sqrt(xp / 25)) + 1, levelTitles().length);
}

PHRASES_DATA.fr['level-up'] = [
  'Niveau {lvl} : {title}. La direction est fière. La direction, c’est moi.',
  'Promotion : {title}. Le collier change. Les tâches, toujours pas.'
];
PHRASES_DATA.en['level-up'] = [
  'Level {lvl}: {title}. Management is proud. Management is me.',
  'Promotion: {title}. The collar changes. The tasks, not yet.'
];

function levelUpPhrase(lvl) {
  const titles = levelTitles();
  return randOf(PHRASES_DATA[currentLang()]['level-up'])
    .replace('{lvl}', lvl)
    .replace('{title}', titles[lvl - 1] || titles[titles.length - 1]);
}
