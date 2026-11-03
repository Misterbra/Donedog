// Pixel art du chien — dessiné en matrices de caractères, rendu sur canvas.
// '.' = transparent | o = contour | b = corps | d = poil sombre (dos, pattes fond)
// c = crème | k = noir (oeil/nez/bouche) | r = collier | p = langue
// e = intérieur d'oreille rose | w = poitrail clair

const PALETTE = {
  o: '#3b2b1f',
  b: '#d99a55',
  d: '#b8763a',
  c: '#f6e7c9',
  k: '#1c1c1c',
  r: '#e04141',   // couleur du collier — change avec le niveau
  p: '#f28bb1',
  e: '#f2a9b8',
  w: '#fff6e8',
  s: '#e8b48c',   // peau (skin humain)
  t: '#4a7fd0',   // chemise
  q: '#4a5d76'    // pantalon — assez clair pour que la bosse des fesses se lise
};

// Tenue d'Adam — pendant le numéro censuré, pelage et vêtements virent
// couleur peau : la mosaïque n'échantillonne plus que du rose. On devine.
const NUDE_PALETTE = {
  o: '#8a5f43',
  b: '#eec39a',
  d: '#d9a878',
  c: '#f6d7b8',
  w: '#f9e2cc',
  r: '#eec39a',   // le collier n'est plus là
  t: '#e8b48c',   // la chemise non plus
  q: '#e8b48c',   // le pantalon non plus
  z: '#c99770'
};

const SPRITE_W = 24;

// Corps debout (tête à droite), sans pattes ni queue — rangées y0..y9.
// Les pattes (y10..y13) et la queue sont dessinées par code pour l'animation.
const BODY_STAND = [
  '................o...o...',
  '...............oeo.oeo..',
  '...............obbbbbbo.',
  '..............obbbbkbbo.',
  '..............obbbbbccck',
  '...oddddddddddbbbbbccco.',
  '..obdddddddddbrrbbo.....',
  '..obbbbbbbbbbbbwo.......',
  '..obbccccccccwwo........',
  '..obbbbbbbbbbbbo........'
];

// Assis (tête à droite), matrice complète y0..y13.
const BODY_SIT = [
  '................o...o...',
  '...............oeo.oeo..',
  '...............obbbbbbo.',
  '..............obbbbkbbo.',
  '..............obbbbbccck',
  '..............obbbbccco.',
  '.............orrbbo.....',
  '...........oobbbbwo.....',
  '.....ooooooodbbbbbo.....',
  '...obdddddddbbbbbbo.....',
  '..obbbbbbbbbbbbbbbo.....',
  '..obbbbbbbbbbbbbbbo.....',
  '..obbccccccbbobbo.......',
  '...oooooooooo.oo........'
];

// Couché / endormi (tête à droite), 6 rangées, à poser au sol.
const BODY_SLEEP = [
  '...............oo..oo...',
  '....ooooooo...obbbbbbo..',
  '..obdddddddddbbbbkkbbo..',
  '.obbbbbbbbbbbbbbbbbbccck',
  '.obbccccccccccbbbbbbcco.',
  '.oooooooooooooooooooooo.'
];

// Queue (blob bouclé) — pixels [x, y, couleur], deux positions pour le wag.
const TAIL_UP = [
  [2, 2, 'o'], [3, 2, 'o'],
  [1, 3, 'o'], [2, 3, 'b'], [3, 3, 'd'], [4, 3, 'o'],
  [2, 4, 'o'], [3, 4, 'b']
];
const TAIL_DOWN = TAIL_UP.map(([x, y, c]) => [x, y + 1, c]);

// Queue au sol pour la pose assise (wag gauche/droite).
const TAIL_SIT_A = [[0, 12, 'o'], [1, 12, 'b'], [2, 12, 'o']];
const TAIL_SIT_B = [[1, 12, 'o'], [2, 12, 'b'], [3, 12, 'o']];

// Surcouches : bouche ouverte (aboiement / lecture) et clignement d'oeil.
const MOUTH_OPEN = [[19, 5, 'k'], [20, 5, 'k'], [21, 5, 'k'], [20, 6, 'p']];
const EYE_BLINK = [[19, 3, 'b']];

// Pattes debout : xHanche + near (premier plan) / far (arrière-plan sombre).
// Trot : groupe 0 et groupe 1 se balancent en opposition.
const LEGS = [
  { x: 3,  near: true,  group: 0 },
  { x: 11, near: false, group: 0 },
  { x: 5,  near: false, group: 1 },
  { x: 13, near: true,  group: 1 }
];

const LEG_TOP = 10;
const LEG_BOTTOM = 13;
const SPRITE_H = 14;
const SLEEP_H = BODY_SLEEP.length;

function paintMatrix(ctx, matrix, scale, ox = 0, oy = 0) {
  for (let y = 0; y < matrix.length; y++) {
    const row = matrix[y];
    for (let x = 0; x < row.length; x++) {
      const color = PALETTE[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect((x + ox) * scale, (y + oy) * scale, scale, scale);
    }
  }
}

function paintPixels(ctx, pixels, scale, ox = 0, oy = 0) {
  for (const [x, y, c] of pixels) {
    ctx.fillStyle = PALETTE[c];
    ctx.fillRect((x + ox) * scale, (y + oy) * scale, scale, scale);
  }
}

// Queue : 4 positions pour un vrai wag fluide (haut, milieu, bas, milieu).
const TAIL_LOW = TAIL_UP.map(([x, y, c]) => [x, y + 2, c]);
const TAIL_POSES = [TAIL_UP, TAIL_DOWN, TAIL_LOW, TAIL_DOWN];

// Oreilles dressées (quand ton curseur s'approche : il te regarde).
const EARS_UP = [[16, -1, 'o'], [20, -1, 'o']];

// Os dans la gueule (retour de mission hors écran).
const BONE_MOUTH = [
  [21, 4, 'w'], [21, 6, 'w'], [22, 5, 'w'], [23, 5, 'w'],
  [24, 5, 'w'], [25, 4, 'w'], [25, 6, 'w']
];

// La niche — palette à elle (le rouge du collier change avec le niveau,
// pas la maison). x = ouverture sombre.
const NICHE_PALETTE = {
  o: '#3b2b1f',
  m: '#a04439',   // bardeaux clairs
  M: '#7d3129',   // bardeaux sombres (alternance)
  n: '#c94f43',   // murs
  N: '#b34237',   // rainure des planches
  x: '#241812',   // intérieur
  w: '#f4ecd8'    // os au-dessus de la porte
};

const NICHE = [
  '..........oo..........',
  '........ooMMoo........',
  '......ooMMmmMMoo......',
  '....ooMMmmmmmmMMoo....',
  '..ooMMmmmmmmmmmmMMoo..',
  'ooMMmmmmmmmmmmmmmmMMoo',
  'onnnnNnnnnnnnnnNnnnnno',
  'onnnnNnnnwwwwnnNnnnnno',
  'onnnnNnnxxxxxxnnNnnnno',
  'onnnnNnxxxxxxxxnNnnnno',
  'onnnnNnxxxxxxxxnNnnnno',
  'onnnnNnxxxxxxxxnNnnnno',
  'onnnnNnxxxxxxxxnNnnnno',
  'oooooooooooooooooooooo'
];
const NICHE_W = 22, NICHE_H = NICHE.length;

function paintNiche(ctx, scale, ox, oy) {
  for (let y = 0; y < NICHE.length; y++) {
    const row = NICHE[y];
    for (let x = 0; x < row.length; x++) {
      const color = NICHE_PALETTE[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
  }
}

// Debout sur les pattes arrière (pour te faire la morale), 14x18.
const STAND_TALL = [
  '....o...o.....',
  '...oeo.oeo....',
  '...obbbbbbo...',
  '..obbbbkbbo...',
  '..obbbbbccck..',
  '..obbbbccco...',
  '...orrbbo.....',
  '..obbbbbbo....',
  '.obbbobbbo....',
  '.obo.obbbo....',
  '....obbbwo....',
  '....obbbbo....',
  '...obbbbbbo...',
  '..obbbbbbbbo..',
  '..obbbbbbbbo..',
  '..obbccccbbo..',
  '...obbo.obo...',
  '...oo...oo....'
];
const TALL_H = STAND_TALL.length;

function paintLegs(ctx, scale, swing, oy = 0, style = null) {
  for (const leg of LEGS) {
    const front = leg.x >= 11;
    const offset = swing === 0 ? 0 : Math.round(swing * (leg.group === 0 ? 1 : -1));
    const x = leg.x + offset;
    if (style) {
      ctx.fillStyle = front
        ? (leg.near ? style.frontNear : style.frontFar)
        : (leg.near ? style.backNear : style.backFar);
    } else {
      ctx.fillStyle = leg.near ? PALETTE.b : PALETTE.d;
    }
    for (let y = LEG_TOP; y < LEG_BOTTOM; y++) {
      ctx.fillRect(x * scale, (y + oy) * scale, 2 * scale, scale);
    }
    ctx.fillStyle = style ? (front ? style.frontFoot : style.backFoot) : PALETTE.o;
    ctx.fillRect(x * scale, (LEG_BOTTOM + oy) * scale, 2 * scale, scale);
  }
}

// ---------- Skin "humain à 4 pattes" ----------
// Un collègue en chemise qui rampe sur ton bureau. Aucune explication.
// u = peau ombre (bras arrière-plan) | z = pantalon ombre (jambe arrière-plan)
PALETTE.u = '#c99770';
PALETTE.z = '#2c3947';

// Haut du corps (tête + torse), commun à toutes les frames de crawl.
// Vraie physiologie du rampeur : fesses en l'air (point culminant), creux
// profond au milieu du dos, omoplates qui ressortent en bosse, ventre qui
// pend, tête cassée vers le haut. Personne ne devrait marcher comme ça.
const HUMAN_TOP = [
  '.................ooooo..',
  '................oosssso.',
  '................ossskso.',
  '.....oo.........osssso..',
  '....oqqo.........ossso..',
  '...oqqqqo......otttsso..',
  '...oqqqqtto..otttttso...',
  '....oqqttttttttttttso...',
  '.....oqtttttttttttso....',
  '......ootttttttttoo.....',
  '........oooooooo........'
];

// Cycle de crawl contralatéral (comme un vrai humain à 4 pattes) :
// A : main proche AVANT plantée + genou proche ARRIÈRE / opposés pour le lointain
// N : transition, main proche décollée du sol
// B : inverse de A
const HUMAN_CRAWL_A = HUMAN_TOP.concat([
  '...ooooooooooouu..ss....',
  '....qq..zz....uu..ss....',
  '....qq..zz....uu..ss....',
  '...qqq..zz....uu..ss....',
  'kkqqq...zz....uu..ss....',
  'ooooo...oo....uu..ss....'
]);

const HUMAN_CRAWL_N = HUMAN_TOP.concat([
  '...ooooooooooo.uuss.....',
  '....qqq.zz.....uuss.....',
  '....qqq.zz.....uuss.....',
  '..qqqqq.zz.....uuss.....',
  'kkqqqq..zz.....uu.s.....',
  'oooooo..oo.....uu.......'
]);

const HUMAN_CRAWL_B = HUMAN_TOP.concat([
  '...oooooooooooss..uu....',
  '....zz..qq....ss..uu....',
  '....zz..qq....ss..uu....',
  '...zzz..qq....ss..uu....',
  '..zzz..qqq....ss..uu....',
  '.oooo..ooo....ss..uu....'
]);

const HUMAN_CRAWL_FRAMES = [HUMAN_CRAWL_A, HUMAN_CRAWL_N, HUMAN_CRAWL_B, HUMAN_CRAWL_N];

// Assis sur les talons, mains sur les cuisses. Il attend tes ordres.
const HUMAN_SIT = [
  '..............ooooo.....',
  '..............oossso....',
  '..............ooskso....',
  '..............osssso....',
  '...............osso.....',
  '..............otttto....',
  '..............ottttto...',
  '..............ottttto...',
  '.............otttttto...',
  '.............oqqssqqo...',
  '............oqqqqqqo....',
  '............ozzzzzzo....',
  '...........oqqzzzzkko...',
  '...........ooooooooo....'
];

// À plat ventre. La journée a gagné.
const HUMAN_SLEEP = [
  '.................ooooo..',
  '.................osssso.',
  '..ottttttttttttttossso..',
  '.koqqqqqqqqtttttttosso..',
  '.oooooooooooooooooooo...'
];

// Debout. Uniquement pour te faire la morale.
const HUMAN_TALL = [
  '..............ooooo.....',
  '..............oossso....',
  '..............ooskso....',
  '..............osssso....',
  '...............osso.....',
  '..............otttto....',
  '.............otttttto...',
  '.............otttttto...',
  '.............otttttto...',
  '.............otttttto...',
  '.............oqqqqqqo...',
  '.............oqqqqqqo...',
  '..............oqqqqo....',
  '..............oqo.oqo...',
  '..............oqo.oqo...',
  '..............oqo.oqo...',
  '..............okko.okko.'
];

// ---------- Membres articulés (humain v3) ----------
// Segment "pixelisé" : on avance le long de la ligne en posant des carrés.
function drawPixelSeg(ctx, x1, y1, x2, y2, color, px) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(2, Math.ceil(dist / (px * 0.5)));
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    ctx.fillRect(
      Math.round((x1 + (x2 - x1) * k) / px) * px - px / 2,
      Math.round((y1 + (y2 - y1) * k) / px) * px - px / 2,
      px, px
    );
  }
}

// Membre 2 segments : épaule/hanche -> coude/genou -> main/pied.
function drawLimb(ctx, sx, sy, ex, ey, hx, hy, color, endColor, px) {
  drawPixelSeg(ctx, sx, sy, ex, ey, color, px);
  drawPixelSeg(ctx, ex, ey, hx, hy, color, px);
  ctx.fillStyle = endColor;
  ctx.fillRect(hx - px * 0.8, hy - px * 0.5, px * 1.6, px);
}

// Crawl contralatéral fluide : bras et jambes opposés, mains qui se
// décollent du sol en phase de balancement, genoux qui glissent.
function drawHumanLimbs(ctx, S, phase, oy) {
  const ground = 13.6 * S + oy * S;
  const armLen = { x: 2.2 * S, lift: 1.7 * S };
  const legAmp = 1.5 * S;

  const limbs = [
    // [type, ancreX, ancreY, phase, near] — bras aux épaules (basses, à
    // l'avant), cuisses sous les fesses (hautes, à l'arrière)
    ['arm', 15.4 * S, 8.0 * S, Math.PI, false],
    ['leg', 6.8 * S, 8.2 * S, 0, false],
    ['arm', 17.4 * S, 8.0 * S, 0, true],
    ['leg', 5.4 * S, 8.0 * S, Math.PI, true]
  ];
  for (const [type, ax, ayRaw, ph, near] of limbs) {
    const ay = ayRaw + oy * S;
    const sw = Math.sin(phase + ph);
    if (type === 'arm') {
      const hx = ax + sw * armLen.x;
      const hy = ground - Math.max(0, Math.sin(phase + ph + Math.PI / 2)) * armLen.lift * (phase ? 1 : 0);
      const ex = (ax + hx) / 2 - 0.9 * S;   // coude vers l'arrière
      const ey = (ay + hy) / 2;
      drawLimb(ctx, ax, ay, ex, ey, hx, hy, near ? PALETTE.s : PALETTE.u, near ? '#c98b62' : '#b0805a', S);
    } else {
      const kx = ax + sw * legAmp;
      const ky = ground - 0.5 * S;
      const fx = kx - 2.6 * S;              // tibia replié vers l'arrière
      const fy = ground;
      drawLimb(ctx, ax, ay, kx, ky, fx, fy, near ? PALETTE.q : PALETTE.z, '#23262b', S);
    }
  }
}

// Bras qui moulinent (chute) ou bras levé qui fait la leçon (motivation).
function drawHumanArmsStanding(ctx, S, t, flailing) {
  const shoulder = { x: 16.5 * S, y: 6.5 * S };
  if (flailing) {
    for (const off of [0, Math.PI * 0.7]) {
      const a = t / 60 + off;
      drawPixelSeg(ctx, shoulder.x, shoulder.y,
        shoulder.x + Math.cos(a) * 3.5 * S, shoulder.y + Math.sin(a) * 3.5 * S,
        PALETTE.s, S);
    }
  } else {
    // index levé, léger balancement de prêcheur
    const a = -1.15 + Math.sin(t / 300) * 0.12;
    const ex = shoulder.x + Math.cos(a) * 2.2 * S;
    const ey = shoulder.y + Math.sin(a) * 2.2 * S;
    drawLimb(ctx, shoulder.x, shoulder.y, ex, ey, ex + 0.8 * S, ey - 1.8 * S, PALETTE.s, '#c98b62', S);
  }
}

const SKINS = {
  dog: {
    stand: BODY_STAND, sit: BODY_SIT, sleep: BODY_SLEEP, tall: STAND_TALL,
    sleepH: BODY_SLEEP.length, tallH: STAND_TALL.length,
    fullBody: false, tail: true, ears: true, dogFace: true, boneDy: 0,
    mouth: MOUTH_OPEN, mouthSit: MOUTH_OPEN, blink: EYE_BLINK, legStyle: null,
    headStand: [13, -1, 11], headSit: [13, -1, 11], headSleep: [14, -2, 9], headTall: [2, -1, 11]
  },
  human: {
    stand: HUMAN_TOP, articulated: true, sit: HUMAN_SIT, sleep: HUMAN_SLEEP, tall: HUMAN_TALL,
    sleepH: HUMAN_SLEEP.length, tallH: HUMAN_TALL.length,
    fullBody: true, tail: false, ears: false, dogFace: false, boneDy: -1,
    mouth: [[20, 3, 'k']], mouthSit: [[17, 3, 'k']], blink: [[20, 2, 's']], legStyle: null,
    headStand: [15, -2, 9], headSit: [13, -2, 8], headSleep: [16, -2, 8], headTall: [13, -2, 8]
  }
};
