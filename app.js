'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const CW = 960;   // logical canvas width
const CH = 540;   // logical canvas height
const GY = 435;   // y of the ground surface (Hera stands here)

const GRAVITY      = 1400;   // px/s²
const JUMP_MIN_VY  = -580;   // instant tap
const JUMP_MAX_VY  = -980;   // full-charge (hold MAX_CHARGE seconds)
const MAX_CHARGE   = 0.55;   // seconds to reach full charge

const MAX_STAMINA  = 100;
const START_STAMINA = 80;
const DRAIN_PER_S  = 3;
const CORRECT_GAIN = 20;
const WRONG_LOSS   = 15;
const LOW_THRESH   = 25;

const SCORE_PER_S  = 1;
const KICK_SCORE   = 25;
const CORRECT_SCORE = 50;

const HERA_W = 55;
const HERA_H = 90;
const HERA_X = 190;

// Hera's transparent atlas is packed at gameplay resolution: 4 x 5 cells.
// Every pose uses the same torso/ground registration, including airborne
// poses whose feet lift within the cell. No baked-in impact effects.
const HERA_FRAMES = {
  contact0: { x: 0,   y: 0,   w: 192, h: 144, ax: 108, ay: 132 },
  passing0: { x: 192, y: 0,   w: 192, h: 144, ax: 108, ay: 132 },
  flight0:  { x: 384, y: 0,   w: 192, h: 144, ax: 108, ay: 132 },
  contact1: { x: 576, y: 0,   w: 192, h: 144, ax: 108, ay: 132 },
  passing1: { x: 0,   y: 144, w: 192, h: 144, ax: 108, ay: 132 },
  flight1:  { x: 192, y: 144, w: 192, h: 144, ax: 108, ay: 132 },
  takeoff:  { x: 384, y: 144, w: 192, h: 144, ax: 108, ay: 132 },
  ascent:   { x: 576, y: 144, w: 192, h: 144, ax: 108, ay: 132 },
  descent:  { x: 0,   y: 288, w: 192, h: 144, ax: 108, ay: 132 },
  windup:   { x: 192, y: 288, w: 192, h: 144, ax: 108, ay: 132 },
  extend:   { x: 384, y: 288, w: 192, h: 144, ax: 108, ay: 132 },
  recover:  { x: 576, y: 288, w: 192, h: 144, ax: 108, ay: 132 },
  between0: { x: 0,   y: 432, w: 192, h: 144, ax: 108, ay: 132 },
  between1: { x: 192, y: 432, w: 192, h: 144, ax: 108, ay: 132 },
  between2: { x: 384, y: 432, w: 192, h: 144, ax: 108, ay: 132 },
  between3: { x: 576, y: 432, w: 192, h: 144, ax: 108, ay: 132 },
  between4: { x: 0,   y: 576, w: 192, h: 144, ax: 108, ay: 132 },
  between5: { x: 192, y: 576, w: 192, h: 144, ax: 108, ay: 132 },
};
const RUN_CYCLE = [
  'contact0', 'between0', 'passing0', 'between1', 'flight0', 'between2',
  'contact1', 'between3', 'passing1', 'between4', 'flight1', 'between5',
];
const KICK_DURATION = 0.28;
const KICK_WINDUP = 0.07;
const KICK_EXTENSION_END = 0.16;
const TAKEOFF_DURATION = 0.085;
const LAND_DURATION = 0.085;
const CELEBRATION_TURN_DURATION = 1.08;
const CELEBRATION_TURN_FRAMES = [0, 1, 2, 3, 4, 5, 6, 7, 0];
const REWARD_SPARK_COUNT = 24;
const REWARD_SPARK_START = 1.35;
const REWARD_SPARK_STAGGER = 0.014;
const REWARD_SPARK_TRAVEL = 0.78;

// Cloud uses enemies-sheet.png; redrawn bull, peacock, eagle and swan use
// ground-sheet.png. Both atlases are pre-scaled for crisp 1:1 drawing.
// Each creature has two animation frames.
const ENEMY_FRAMES = {
  eagle0: { x: 490, y: 2,  w: 86, h: 78 },
  eagle1: { x: 578, y: 2,  w: 86, h: 78 },
  swan0:  { x: 666, y: 70, w: 88, h: 84 },
  swan1:  { x: 756, y: 70, w: 88, h: 84 },
  cloud0: { x: 258, y: 6,  w: 86, h: 80 },
  cloud1: { x: 346, y: 6,  w: 86, h: 80 },
  bull0:  { x: 2,   y: 2,  w: 152, h: 152 },
  bull1:  { x: 156, y: 2,  w: 152, h: 152 },
  peacock0: { x: 310, y: 35, w: 88, h: 119 },
  peacock1: { x: 400, y: 35, w: 88, h: 119 },
};
const ENEMY_ANIM_HZ = { eagle: 6, swan: 4, cloud: 2.5, bull: 9 };

const GameState = {
  LOADING:      'LOADING',
  START_SCREEN: 'START_SCREEN',
  RUNNING:      'RUNNING',
  QUESTION:     'QUESTION',
  PAUSED:       'PAUSED',
  DEBUG:        'DEBUG',
  BESTIARY:     'BESTIARY',
  GAME_OVER:    'GAME_OVER',
};

const LS = {
  MIN:   'heraRunner.minFactor',
  MAX:   'heraRunner.maxFactor',
  BEST:  'heraRunner.bestScore',
  SOUND: 'heraRunner.soundEnabled',
};

// ─── State ────────────────────────────────────────────────────────────────────

let state       = GameState.LOADING;
let stamina     = START_STAMINA;
let score       = 0;
let bestScore   = 0;
let worldSpeed  = 220;     // px/s, ramps up over time
let elapsed     = 0;       // seconds spent in RUNNING state
let lowPlayed   = false;   // stamina-low sound gating

let enemies  = [];
let peacocks = [];
let effects  = [];
let celebration = null;
let collectedPeacock = null;
let dusts    = [];   // footstep / landing dust puffs

let animT = 0;   // world animation clock (seconds); frozen while paused

let eTimer = 0, eInterval = 2.0;
let pTimer = 0, pInterval = 5.0;

let question  = null;
let minFactor = 5;
let maxFactor = 9;

let soundOn  = true;
let audioCtx = null;

// Parallax offsets
let skyOff   = 0;
let cloudOff = 0;
let gndOff   = 0;

// Charge-jump state (input layer)
let isCharging = false;
let chargeT    = 0;   // seconds held, capped at MAX_CHARGE

const hera = {
  x: HERA_X, y: GY - HERA_H,
  vy: 0, grounded: true,
  anim: 'run',   // 'run' | 'jump' | 'kick'
  frame: 0, runPhase: 0, kickTimer: 0, kickAnticipating: false, jumpT: 0, landTimer: 0,
};

// Sprite sheets ship with transparent backgrounds — no cleanup needed.
const heraImg = new Image();
let heraSpriteReady = false;
heraImg.onload = () => { heraSpriteReady = true; };
heraImg.src = 'assets/sprites/hera-sheet.png';

const enemiesImg = new Image();
let enemySpriteReady = false;
enemiesImg.onload = () => { enemySpriteReady = true; };
enemiesImg.src = 'assets/sprites/enemies-sheet.png';

const groundImg = new Image();
let groundSpriteReady = false;
groundImg.onload = () => { groundSpriteReady = true; };
groundImg.src = 'assets/sprites/ground-sheet.png';

const celebrationImg = new Image();
celebrationImg.src = 'assets/sprites/hera-turn-sheet.png';
const peacockFlightImg = new Image();
peacockFlightImg.src = 'assets/sprites/peacock-turn-sheet.png';
const peacockExitImg = new Image();
peacockExitImg.src = 'assets/sprites/peacock-exit-sheet.png';

const olympusImg = new Image();
const skyCloudImg = new Image();
olympusImg.src = 'assets/backgrounds/olympus.png';
skyCloudImg.src = 'assets/backgrounds/sky-clouds.png';

// Visual size only; flying enemies retain their existing collision boxes.
const ENEMY_DRAW_SCALE = { eagle: 1.2, cloud: 1.2, swan: 1, bull: 1 };

// ─── DOM ──────────────────────────────────────────────────────────────────────

const canvas   = document.getElementById('game-canvas');
const ctx      = canvas.getContext('2d');
const rewardCanvas = document.getElementById('reward-effects');
const rewardCtx = rewardCanvas.getContext('2d');
const hudEl    = document.getElementById('hud');
const scoreVal = document.getElementById('score-value');
const sBar     = document.getElementById('stamina-bar');
const sFill    = document.getElementById('stamina-fill');
const factorRng = document.getElementById('factor-range');
const soundBtn = document.getElementById('sound-btn');
const pauseBtn = document.getElementById('pause-btn');

const startScreen   = document.getElementById('start-screen');
const qOverlay      = document.getElementById('question-overlay');
const pausedScreen   = document.getElementById('paused-screen');
const debugScreen    = document.getElementById('debug-screen');
const debugCanvas    = document.getElementById('debug-canvas');
const debugCtx       = debugCanvas.getContext('2d');
const bestiaryScreen = document.getElementById('bestiary-screen');
const overScreen     = document.getElementById('gameover-screen');
const rotateOverlay = document.getElementById('rotate-overlay');

const minInput    = document.getElementById('min-factor');
const maxInput    = document.getElementById('max-factor');
const bestStart   = document.getElementById('best-score-start');
const qText       = document.getElementById('question-text');
const answerBtns  = document.querySelectorAll('.answer-btn');
const finalScore  = document.getElementById('final-score');
const bestOver    = document.getElementById('best-score-over');
const startBtn    = document.getElementById('start-btn');
const debugBtn    = document.getElementById('debug-btn');
const debugBackBtn = document.getElementById('debug-back-btn');
const debugResumeBtn = document.getElementById('debug-resume-btn');
const bestiaryBtn       = document.getElementById('bestiary-btn');
const bestiaryBackBtn   = document.getElementById('bestiary-back-btn');
const bestiaryResumeBtn = document.getElementById('bestiary-resume-btn');
const resumeBtn   = document.getElementById('resume-btn');
const restartBtn  = document.getElementById('restart-btn');

// ─── Utility ──────────────────────────────────────────────────────────────────

function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ─── LocalStorage ─────────────────────────────────────────────────────────────

function loadPrefs() {
  minFactor = parseInt(localStorage.getItem(LS.MIN))  || 5;
  maxFactor = parseInt(localStorage.getItem(LS.MAX))  || 9;
  bestScore = parseInt(localStorage.getItem(LS.BEST)) || 0;
  soundOn   = localStorage.getItem(LS.SOUND) !== 'false';
}

function savePrefs() {
  localStorage.setItem(LS.MIN,   minFactor);
  localStorage.setItem(LS.MAX,   maxFactor);
  localStorage.setItem(LS.SOUND, soundOn);
}

function saveBest() {
  localStorage.setItem(LS.BEST, bestScore);
}

// ─── Audio ────────────────────────────────────────────────────────────────────

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function tone(freq, type, dur, gain, delay = 0) {
  if (!soundOn) return;
  try {
    ensureAudio();
    const t = audioCtx.currentTime + delay;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(audioCtx.destination);
    const o = audioCtx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.connect(g);
    o.start(t); o.stop(t + dur);
  } catch (_) {}
}

function sfxKick()       { tone(180,'sawtooth',0.15,0.4); tone(80,'sine',0.2,0.3,0.05); }
function sfxCorrect()    { tone(523,'sine',0.15,0.35); tone(659,'sine',0.15,0.35,0.15); tone(784,'sine',0.2,0.35,0.3); }
function sfxWrong()      { tone(220,'sawtooth',0.3,0.3); tone(175,'sawtooth',0.25,0.3,0.15); }
function sfxStaminaLow() { tone(440,'sine',0.1,0.2); tone(380,'sine',0.1,0.2,0.15); }
function sfxJump(frac) {
  const base = 240 + frac * 320;
  tone(base,        'sine', 0.1,  0.22);
  if (frac > 0.25) tone(base * 1.5, 'sine', 0.08, 0.14, 0.06);
  if (frac > 0.7)  tone(base * 2,   'sine', 0.06, 0.10, 0.12);
}

// ─── Canvas scaling ───────────────────────────────────────────────────────────

function resizeCanvas() {
  const wh = document.getElementById('canvas-wrapper');
  const cw = wh.clientWidth, ch = wh.clientHeight;
  const ratio = CW / CH;
  let w = cw, h = cw / ratio;
  if (h > ch) { h = ch; w = h * ratio; }
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  rewardCanvas.width = Math.round(window.innerWidth * dpr);
  rewardCanvas.height = Math.round(window.innerHeight * dpr);
  rewardCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ─── Multiplication ───────────────────────────────────────────────────────────

function genQuestion() {
  const a = randInt(minFactor, maxFactor);
  const b = randInt(minFactor, maxFactor);
  const correct = a * b;
  const wrongs = new Set();
  const strategies = [
    a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b,
    correct + 10, correct - 10, correct + a, correct - a,
    correct + b, correct - b,
  ].filter(v => v > 0 && v !== correct).sort(() => Math.random() - 0.5);
  for (const v of strategies) {
    if (wrongs.size >= 3) break;
    wrongs.add(v);
  }
  // fill if needed
  for (let d = 1; wrongs.size < 3; d++) {
    const v = correct + (d % 2 === 0 ? d : -d);
    if (v > 0 && v !== correct) wrongs.add(v);
  }
  const choices = [...wrongs, correct].sort(() => Math.random() - 0.5);
  return { a, b, correct, choices };
}

// ─── State machine ────────────────────────────────────────────────────────────

function setState(s) {
  state = s;
  const running = s === GameState.RUNNING || s === GameState.QUESTION || s === GameState.PAUSED || s === GameState.DEBUG || s === GameState.BESTIARY;
  hudEl.classList.toggle('hidden', !running);
  startScreen.classList.toggle('hidden',    s !== GameState.START_SCREEN);
  qOverlay.classList.toggle('hidden',       s !== GameState.QUESTION);
  pausedScreen.classList.toggle('hidden',   s !== GameState.PAUSED);
  debugScreen.classList.toggle('hidden',    s !== GameState.DEBUG);
  bestiaryScreen.classList.toggle('hidden', s !== GameState.BESTIARY);
  overScreen.classList.toggle('hidden',     s !== GameState.GAME_OVER);
  if (s === GameState.DEBUG) drawSpriteDebug();
}

function startRun() {
  minFactor = clamp(parseInt(minInput.value) || 5, 2, 12);
  maxFactor = clamp(parseInt(maxInput.value) || 9, 2, 12);
  if (minFactor > maxFactor) maxFactor = minFactor;
  savePrefs();

  stamina = START_STAMINA; score = 0; worldSpeed = 220; elapsed = 0; lowPlayed = false;
  enemies = []; peacocks = []; effects = []; dusts = [];
  eTimer = 0; eInterval = rand(1.5, 3.0);
  pTimer = 0; pInterval = rand(4.0, 7.0);
  question = null; celebration = null; collectedPeacock = null;
  sBar.classList.remove('refilling');
  skyOff = 0; cloudOff = 0; gndOff = 0;

  isCharging = false; chargeT = 0; animT = 0;
  hera.y = GY - HERA_H; hera.vy = 0; hera.grounded = true;
  hera.anim = 'run'; hera.frame = 0; hera.runPhase = 0; hera.kickTimer = 0;
  hera.jumpT = 0; hera.landTimer = 0;
  hera.kickAnticipating = false;

  factorRng.textContent = `${minFactor}–${maxFactor}`;
  setState(GameState.RUNNING);
}

function openQuestion() {
  question = genQuestion();
  qText.textContent = `${question.a} × ${question.b} = ?`;
  answerBtns.forEach((b, i) => {
    b.textContent = question.choices[i];
    b.classList.remove('correct', 'wrong');
    b.disabled = false;
  });
  setState(GameState.QUESTION);
}

function answerQuestion(idx) {
  if (state !== GameState.QUESTION) return;
  answerBtns.forEach(b => b.disabled = true);
  const chosen = question.choices[idx];
  if (chosen === question.correct) {
    answerBtns[idx].classList.add('correct');
    const from = stamina;
    stamina = clamp(stamina + CORRECT_GAIN, 0, MAX_STAMINA);
    celebration = { t: 0, dur: 2.9, from, gain: stamina - from,
      footY: hera.y + HERA_H,
      birdX: collectedPeacock?.x ?? hera.x + 70,
      birdY: collectedPeacock?.y ?? GY - 60 };
    isCharging = false; chargeT = 0;
    score  += CORRECT_SCORE;
    sfxCorrect();
  } else {
    answerBtns[idx].classList.add('wrong');
    stamina = clamp(stamina - WRONG_LOSS, 0, MAX_STAMINA);
    sfxWrong();
  }
  setTimeout(() => stamina <= 0 ? endGame() : setState(GameState.RUNNING), 700);
}

function pause()  { if (state === GameState.RUNNING)  setState(GameState.PAUSED); }
function resume() { if (state === GameState.PAUSED)   setState(GameState.RUNNING); }
function openDebug() { if (state === GameState.PAUSED) setState(GameState.DEBUG); }
function closeDebug() { if (state === GameState.DEBUG) setState(GameState.PAUSED); }
function resumeFromDebug() { if (state === GameState.DEBUG) setState(GameState.RUNNING); }
function openBestiary() { if (state === GameState.PAUSED) setState(GameState.BESTIARY); }
function closeBestiary() { if (state === GameState.BESTIARY) setState(GameState.PAUSED); }
function resumeFromBestiary() { if (state === GameState.BESTIARY) setState(GameState.RUNNING); }

function endGame() {
  if (score > bestScore) { bestScore = Math.floor(score); saveBest(); }
  finalScore.textContent = `Score: ${Math.floor(score)}`;
  bestOver.textContent   = `Best: ${bestScore}`;
  setState(GameState.GAME_OVER);
}

// ─── Spawning ─────────────────────────────────────────────────────────────────

const ETYPES = ['eagle', 'swan', 'cloud', 'bull'];

function spawnEnemy() {
  const type = ETYPES[randInt(0, 3)];
  const grounded = type === 'bull' || type === 'swan';
  const w = 75, h = grounded ? 75 : 60;
  let y;
  if (grounded) {
    y = GY - h;
  } else {
    // Three tiers for flying enemies, calibrated to jump heights:
    //   min jump (~120px): low tier always reachable from ground
    //   normal jump (~240px): mid tier reachable
    //   full-charge jump (~345px): high tier reachable
    const tier = randInt(0, 2);
    const base = GY - h;
    if (tier === 0)      y = base - rand(20,  90);   // low  — kickable from ground
    else if (tier === 1) y = base - rand(105, 195);  // mid  — normal jump
    else                 y = base - rand(210, 305);  // high — needs charge
  }
  enemies.push({ type, x: CW + 20, y, w, h, defeated: false, phase: rand(0, Math.PI * 2) });
}

function spawnPeacock() {
  peacocks.push({ x: CW + 20, y: GY - 70, w: 60, h: 70, collected: false, phase: rand(0, Math.PI * 2) });
}

function spawnDust(x, y) {
  dusts.push({ x, y, t: 0, dur: rand(0.25, 0.4), r: rand(2, 3.5) });
}

function spawnEffect(x, y) {
  effects.push({ x, y, t: 0, dur: 0.38,
    rays: Array.from({length: 8}, (_, i) => ({
      angle: (i / 8) * Math.PI * 2 + rand(0, 0.4),
      len: rand(0.5, 1.0),
    }))
  });
}

// ─── Update ───────────────────────────────────────────────────────────────────

function update(dt) {
  if (state !== GameState.RUNNING) return;

  if (celebration) {
    celebration.t += dt;
    const c = celebration;
    const refill = rewardRefillProgress(c.t);
    updateHUD(c.from + c.gain * refill);
    sBar.classList.toggle('refilling', refill > 0);
    sBar.style.setProperty('--refill-sweep', `${-100 + refill * 500}%`);
    if (c.t >= c.dur) {
      celebration = null;
      sBar.classList.remove('refilling');
      hera.y = GY - HERA_H; hera.vy = 0; hera.grounded = true;
      hera.anim = 'run'; hera.frame = 0; hera.runPhase = 0;
      hera.kickTimer = 0; hera.kickAnticipating = false;
      updateHUD();
    }
    return; // Let the reward play without draining stamina or moving hazards.
  }

  elapsed += dt;
  score   += SCORE_PER_S * dt;
  worldSpeed = 220 + elapsed * 5;

  // Stamina drain
  stamina = clamp(stamina - DRAIN_PER_S * dt, 0, MAX_STAMINA);
  if (stamina < LOW_THRESH && !lowPlayed) { lowPlayed = true; sfxStaminaLow(); }
  if (stamina >= LOW_THRESH) lowPlayed = false;
  if (stamina <= 0) { endGame(); return; }

  // Hera physics
  if (!hera.grounded) {
    hera.vy += GRAVITY * dt;
    hera.y  += hera.vy * dt;
    if (hera.y >= GY - HERA_H) {
      hera.y = GY - HERA_H; hera.vy = 0; hera.grounded = true;
      if (hera.anim !== 'kick') hera.anim = 'run';
      hera.landTimer = LAND_DURATION;
      hera.runPhase = 0; hera.frame = 0;
      for (let i = 0; i < 3; i++) spawnDust(hera.x + rand(-6, 16), GY - 2);
    }
  }

  // Charge accumulates only while grounded and key/pointer is held
  if (isCharging && hera.grounded) chargeT = Math.min(chargeT + dt, MAX_CHARGE);

  // Animation
  animT += dt;
  if (!hera.grounded) hera.jumpT += dt;
  hera.landTimer = Math.max(0, hera.landTimer - dt);
  if (hera.anim === 'run') {
    // Twelve poses at the same stride rate; intermediate poses soften the
    // large contact/passing/flight changes without ghosting or head bobbing.
    const previousStep = Math.floor(hera.runPhase / (RUN_CYCLE.length / 2));
    hera.runPhase += dt * clamp(worldSpeed / 100, 2.2, 3.3) * RUN_CYCLE.length;
    const nf = Math.floor(hera.runPhase) % RUN_CYCLE.length;
    if (Math.floor(hera.runPhase / (RUN_CYCLE.length / 2)) !== previousStep && hera.grounded) {
      spawnDust(hera.x + rand(-2, 10), GY - 2);   // footfall kicks up dust
    }
    hera.frame = nf;
  }
  if (hera.anim === 'kick') {
    hera.kickTimer -= dt;
    if (hera.kickTimer <= 0) hera.anim = hera.grounded ? 'run' : 'jump';
  }

  // Parallax scroll
  skyOff   = (skyOff   + worldSpeed * 0.08 * dt) % CW;
  cloudOff = (cloudOff + worldSpeed * 0.18 * dt) % (CW + 300);
  gndOff   = (gndOff   + worldSpeed * dt)        % 80;

  // Enemy spawning
  eTimer += dt;
  if (eTimer >= eInterval) {
    spawnEnemy();
    eTimer = 0;
    eInterval = Math.max(0.7, rand(1.5, 3.0) - elapsed * 0.006);
  }

  // Peacock spawning
  pTimer += dt;
  if (pTimer >= pInterval) {
    spawnPeacock();
    pTimer = 0;
    pInterval = rand(4.0, 7.0);
  }

  // Shrink hitboxes slightly for fairness
  const hx = hera.x + 6, hy = hera.y + 6, hw = HERA_W - 12, hh = HERA_H - 10;

  // Update enemies
  hera.kickAnticipating = false;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.defeated) {
      const fly = e.fly;
      fly.t += dt;
      fly.x += fly.vx * dt;
      fly.y += fly.vy * dt;
      fly.vy += 320 * dt;
      // Briefly show the changed expression before the full tumble begins.
      fly.angle = Math.max(0, fly.t - 0.09) * 8.5;
      const radius = Math.hypot(fly.pose.dw, fly.pose.dh) / 2;
      if (fly.x - radius > CW || fly.y - radius > CH || fly.t > 3) enemies.splice(i, 1);
      continue; // Defeated enemies never collide or score again.
    }
    e.x -= worldSpeed * dt;
    const visibleRight = e.type === 'bull' ? e.x + ENEMY_FRAMES.bull0.w
      : e.x + e.w / 2 + ENEMY_FRAMES[e.type + '0'].w * ENEMY_DRAW_SCALE[e.type] / 2;
    if (visibleRight < 0) { enemies.splice(i, 1); continue; }
    // Anticipation is artwork only. Predict the existing hitbox contact,
    // including Hera's airborne trajectory; never enlarge the collision box.
    const bounds = enemyHitbox(e);
    const flying = e.type === 'eagle' || e.type === 'cloud';
    // Hera's artwork extends 32px above the old logical box. Head contact
    // with a flying disguise should count as a kick too.
    const heroTop = flying ? hera.y - 26 : hy;
    const heroHeight = flying ? HERA_H + 22 : hh;
    const contactIn = (bounds.x - (hx + hw)) / worldSpeed;
    if (!e.defeated && contactIn >= 0 && contactIn <= KICK_WINDUP) {
      const futureY = hera.grounded ? hera.y : Math.min(GY - HERA_H,
        hera.y + hera.vy * contactIn + 0.5 * GRAVITY * contactIn * contactIn);
      const futureTop = futureY + (flying ? -26 : 6);
      if (futureTop < bounds.y + bounds.h && futureTop + heroHeight > bounds.y) {
        hera.kickAnticipating = true;
      }
    }
    if (!e.defeated && aabb(hx, heroTop, hw, heroHeight, bounds.x, bounds.y, bounds.w, bounds.h)) {
      const pose = enemyPose(e);
      e.fly = { pose, x: pose.dx + pose.dw / 2, y: pose.dy + pose.dh / 2,
        vx: 780, vy: -340, angle: 0, t: 0 };
      e.defeated = true;
      score += KICK_SCORE;
      hera.anim = 'kick'; hera.kickTimer = KICK_DURATION;
      // Extend on this exact collision frame, alongside score, sound and spark.
      spawnEffect(Math.max(e.x + e.w / 2, hera.x + HERA_W / 2 + 79), hera.y + HERA_H - 69);
      sfxKick();
    }
  }

  // Update peacocks
  for (let i = peacocks.length - 1; i >= 0; i--) {
    const p = peacocks[i];
    p.x -= worldSpeed * 0.85 * dt;
    if (p.x + p.w / 2 + ENEMY_FRAMES.peacock0.w / 2 < 0) { peacocks.splice(i, 1); continue; }
    if (!p.collected && aabb(hx, hy, hw, hh, p.x + 8, p.y + 8, p.w - 16, p.h - 12)) {
      collectedPeacock = { x: p.x + p.w / 2, y: p.y + p.h / 2 };
      p.collected = true;
      peacocks.splice(i, 1);
      openQuestion();
      return;
    }
  }

  // Update effects
  for (let i = effects.length - 1; i >= 0; i--) {
    effects[i].t += dt;
    if (effects[i].t >= effects[i].dur) effects.splice(i, 1);
  }

  // Update dust puffs (they trail off behind her with the ground)
  for (let i = dusts.length - 1; i >= 0; i--) {
    const d = dusts[i];
    d.t += dt;
    d.x -= worldSpeed * 0.6 * dt;
    if (d.t >= d.dur) dusts.splice(i, 1);
  }

  updateHUD();
}

function updateHUD(displayStamina = stamina) {
  scoreVal.textContent = Math.floor(score);
  const pct = (displayStamina / MAX_STAMINA) * 100;
  sFill.style.width = pct + '%';
  sBar.setAttribute('aria-valuenow', Math.floor(displayStamina));
  const flash = stamina < LOW_THRESH && Math.floor(elapsed * 4) % 2 === 0;
  sFill.style.background = celebration && rewardRefillProgress(celebration.t) > 0 ? '#79f3cc' : stamina < LOW_THRESH
    ? (flash ? '#ff3333' : '#ff8888')
    : '#f0c040';
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function circle(x, y, r) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

// ─── Background ───────────────────────────────────────────────────────────────

// Distant Olympus stays still; separate cloud banks drift across the sky.
const SKY_CLOUD_FRAMES = [
  { x: 12, y: 12, w: 744, h: 224 },
  { x: 28, y: 249, w: 704, h: 128 },
  { x: 153, y: 388, w: 460, h: 119 },
];
const SKY_CLOUDS = [
  { frame: 0, x: 50, y: 28, w: 280, alpha: 0.38 },
  { frame: 1, x: 470, y: 80, w: 315, alpha: 0.32 },
  { frame: 2, x: 850, y: 35, w: 185, alpha: 0.38 },
];

function drawBg() {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#211b50';
  ctx.fillRect(0, 0, CW, GY);
  if (olympusImg.complete && olympusImg.naturalWidth) {
    ctx.drawImage(olympusImg, 0, 0, CW, GY);
  }
  if (skyCloudImg.complete && skyCloudImg.naturalWidth) {
    for (const c of SKY_CLOUDS) {
      const f = SKY_CLOUD_FRAMES[c.frame];
      const x = ((c.x - cloudOff + CW + 300) % (CW + 300));
      const h = Math.round(c.w * f.h / f.w);
      ctx.globalAlpha = c.alpha;
      // Duplicate at the wrap boundary, so clouds never pop into view.
      for (const dx of [x, x - CW - 300]) {
        ctx.drawImage(skyCloudImg, f.x, f.y, f.w, f.h,
          Math.round(dx), c.y, c.w, h);
      }
    }
  }
  ctx.restore();
}

function drawGround() {
  const g = ctx.createLinearGradient(0, GY, 0, CH);
  g.addColorStop(0, '#5a4028'); g.addColorStop(0.4, '#3a2810'); g.addColorStop(1, '#180f04');
  ctx.fillStyle = g;
  ctx.fillRect(0, GY, CW, CH - GY);

  // Stone block top edge
  const bw = 80;
  for (let i = 0; i <= Math.ceil(CW / bw) + 1; i++) {
    const bx = (i * bw - gndOff % bw) | 0;
    ctx.fillStyle = i % 2 === 0 ? '#6e5438' : '#5a4228';
    ctx.fillRect(bx, GY, bw, 18);
    ctx.strokeStyle = '#2e1a06'; ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, GY + 0.5, bw - 1, 17);
  }
}

// ─── Hera ─────────────────────────────────────────────────────────────────────

// Blit 1:1 at integer coordinates. Pose art supplies the lean and airtime;
// rotating/scaling the full sprite made the face nod and the feet slide.
function drawHeraFrame(name, footX, footY) {
  const f = HERA_FRAMES[name];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(heraImg, f.x, f.y, f.w, f.h,
    Math.round(footX - f.ax), Math.round(footY - f.ay), f.w, f.h);
  ctx.restore();
}

function heraPose() {
  if (hera.anim === 'kick') {
    const t = KICK_DURATION - hera.kickTimer;
    return t < KICK_EXTENSION_END ? 'extend' : 'recover';
  }
  if (hera.kickAnticipating) return 'windup';
  if (!hera.grounded) {
    if (hera.jumpT < TAKEOFF_DURATION) return 'takeoff';
    return hera.vy < 90 ? 'ascent' : 'descent';
  }
  if (hera.landTimer > 0 || (isCharging && chargeT > 0.06)) return 'passing1';
  return RUN_CYCLE[hera.frame];
}
function drawHera() {
  const { x, y } = hera;
  const chargeFrac = (isCharging && hera.grounded) ? clamp(chargeT / MAX_CHARGE, 0, 1) : 0;
  const cx = x + HERA_W / 2;
  ctx.save();

  // Gold aura — radiates around Hera's body when charging
  if (chargeFrac > 0) {
    const heraCY = y + HERA_H / 2;
    const pulse = 0.5 + 0.5 * Math.sin(animT * 12.5);
    // Outer body halo
    const outerR = 28 + chargeFrac * 24 + pulse * 8;
    const og = ctx.createRadialGradient(cx, heraCY, 4, cx, heraCY, outerR);
    og.addColorStop(0,    `rgba(240,192,64,${0.18 + chargeFrac * 0.22})`);
    og.addColorStop(0.5,  `rgba(212,160,23,${0.12 + chargeFrac * 0.18})`);
    og.addColorStop(1,    'rgba(140,90,0,0)');
    ctx.globalAlpha = 0.7 + chargeFrac * 0.3;
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.ellipse(cx, heraCY, outerR, outerR * 1.3, 0, 0, Math.PI * 2); ctx.fill();
    // Inner bright core shimmer
    const coreR = 10 + chargeFrac * 14 + pulse * 4;
    const cg = ctx.createRadialGradient(cx, heraCY, 0, cx, heraCY, coreR);
    cg.addColorStop(0,   `rgba(255,240,180,${0.55 + chargeFrac * 0.35})`);
    cg.addColorStop(0.4, `rgba(240,192,64,${0.3 + chargeFrac * 0.25})`);
    cg.addColorStop(1,   'rgba(180,120,0,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.ellipse(cx, heraCY, coreR, coreR * 1.2, 0, 0, Math.PI * 2); ctx.fill();
    // Ground pool glow
    const poolR = 22 + chargeFrac * 18;
    const pg = ctx.createRadialGradient(cx, GY, 0, cx, GY, poolR);
    pg.addColorStop(0,   `rgba(212,160,23,${0.35 + chargeFrac * 0.3})`);
    pg.addColorStop(1,   'rgba(140,90,0,0)');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.ellipse(cx, GY, poolR, poolR * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Ground shadow (widens with charge to hint power)
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(cx, GY + 4, 26 + chargeFrac * 12, 6, 0, 0, Math.PI * 2); ctx.fill();

  if (heraSpriteReady) {
    drawHeraFrame(heraPose(), cx, y + HERA_H);
  } else {
    // Fallback while sprite loads
    ctx.fillStyle = '#9b1c1c';
    ctx.fillRect(x, y, HERA_W, HERA_H);
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(x + 3, y + HERA_H * 0.44, HERA_W - 6, 6);
  }

  ctx.restore();
}

function rewardSparkLaunch(i) {
  return REWARD_SPARK_START + i * REWARD_SPARK_STAGGER;
}

function rewardRefillProgress(t) {
  let arrived = 0;
  for (let i = 0; i < REWARD_SPARK_COUNT; i++) {
    arrived += clamp((t - rewardSparkLaunch(i) - REWARD_SPARK_TRAVEL) / 0.12, 0, 1);
  }
  return arrived / REWARD_SPARK_COUNT;
}

function celebrationSpark(i, t, c) {
  const ease = v => 1 - Math.pow(1 - clamp(v, 0, 1), 3);
  const a = i * Math.PI * 2 / REWARD_SPARK_COUNT + t * 5;
  const r = 30 + ease(t / 0.8) * 50;
  const footY = c.footY + (GY - c.footY) * ease(t / 0.35);
  return { x: hera.x + HERA_W / 2 + Math.cos(a) * r,
    y: footY - 65 + Math.sin(a) * (t < CELEBRATION_TURN_DURATION ? 24 : 65) };
}

function drawRewardTransfer() {
  const c = celebration;
  if (!c || (state !== GameState.RUNNING && state !== GameState.PAUSED)) return;
  // Map logical game pixels to viewport pixels so sparks can cross into the HUD.
  const game = canvas.getBoundingClientRect(), bar = sBar.getBoundingClientRect();
  const scale = game.width / CW;
  const pixel = Math.max(2, Math.round(3 * scale));
  rewardCtx.save();
  for (let i = 0; i < REWARD_SPARK_COUNT; i++) {
    const age = c.t - rewardSparkLaunch(i);
    if (age < 0 || age > REWARD_SPARK_TRAVEL + 0.22) continue;
    const start = celebrationSpark(i, rewardSparkLaunch(i), c);
    const sx = game.left + start.x * scale, sy = game.top + start.y * scale;
    const tx = bar.left + 3 + (bar.width - 6) * (c.from + c.gain * (i + 1) / REWARD_SPARK_COUNT) / MAX_STAMINA;
    const ty = bar.top + bar.height / 2;
    const at = p => {
      const q = 1 - p;
      return { x: q*q*q*sx + 3*q*q*p*(sx + 80*scale) + 3*q*p*p*(tx - 70*scale) + p*p*p*tx,
        y: q*q*q*sy + 3*q*q*p*(sy - 140*scale) + 3*q*p*p*(ty + 100*scale) + p*p*p*ty };
    };
    rewardCtx.fillStyle = i % 2 ? '#ffe28b' : '#83ffdb';
    if (age <= REWARD_SPARK_TRAVEL) {
      const p = age / REWARD_SPARK_TRAVEL;
      for (let tail = 3; tail >= 0; tail--) {
        const point = at(Math.max(0, p - tail * 0.035));
        rewardCtx.globalAlpha = 1 - tail * 0.23;
        rewardCtx.fillRect(Math.round(point.x), Math.round(point.y), pixel, pixel);
        if (!tail) {
          rewardCtx.fillRect(Math.round(point.x - pixel), Math.round(point.y + pixel / 3), pixel * 3, Math.max(1, pixel / 3));
        }
      }
    } else {
      const pop = (age - REWARD_SPARK_TRAVEL) / 0.22;
      rewardCtx.globalAlpha = 1 - pop;
      for (let ray = 0; ray < 4; ray++) {
        const a = ray * Math.PI / 2;
        rewardCtx.fillRect(Math.round(tx + Math.cos(a) * (3 + pop * 10)),
          Math.round(ty + Math.sin(a) * (3 + pop * 10)), pixel, pixel);
      }
    }
  }
  rewardCtx.restore();
}

function drawCelebration() {
  const c = celebration, t = c.t;
  const cx = hera.x + HERA_W / 2;
  const ease = v => 1 - Math.pow(1 - clamp(v, 0, 1), 3);
  const footY = c.footY + (GY - c.footY) * ease(t / 0.35);
  const twirl = clamp(t / CELEBRATION_TURN_DURATION, 0, 1);
  const frame = twirl < 1
    ? CELEBRATION_TURN_FRAMES[Math.floor(twirl * CELEBRATION_TURN_FRAMES.length)] : 8;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(cx, GY + 4, 35, 6, 0, 0, Math.PI * 2); ctx.fill();

  // A ribbon of sparks circles the dancer, then blooms around the final pose.
  const fade = clamp((c.dur - t) / 0.3, 0, 1);
  for (let i = 0; i < REWARD_SPARK_COUNT; i++) {
    if (t >= rewardSparkLaunch(i)) continue;
    const { x, y } = celebrationSpark(i, t, c);
    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 6 + i));
    ctx.fillStyle = i % 2 ? '#ffd86b' : '#75f0d0';
    ctx.fillRect(Math.round(x), Math.round(y), 3, 3);
  }
  ctx.globalAlpha = 1;
  if (celebrationImg.complete && celebrationImg.naturalWidth) {
    ctx.save();
    ctx.translate(cx, footY);
    ctx.drawImage(celebrationImg, frame * 192, 0, 192, 144, -108, -132, 192, 144);
    ctx.restore();
  } else drawHeraFrame('recover', cx, footY);

  const rise = ease(t / CELEBRATION_TURN_DURATION);
  const flightT = Math.max(0, t - 1.65);
  const exit = clamp(flightT / 0.95, 0, 1);
  const travel = exit * exit * (3 - 2 * exit);
  const bx = c.birdX + (cx - c.birdX) * rise + Math.sin(twirl * Math.PI * 2) * 24
    - (cx + 125) * travel;
  const by = c.birdY + (GY - 205 - c.birdY) * rise - 35 * travel
    + (flightT > 0 ? Math.sin(flightT * Math.PI * 18) * 3 : 0);
  ctx.save();
  ctx.translate(Math.round(bx), Math.round(by));
  if (flightT > 0 && peacockExitImg.complete && peacockExitImg.naturalWidth) {
    const wing = Math.floor(flightT * 9) % 4;
    ctx.drawImage(peacockExitImg, wing * 160, 0, 160, 160, -80, -80, 160, 160);
  } else if (peacockFlightImg.complete && peacockFlightImg.naturalWidth) {
    ctx.drawImage(peacockFlightImg, frame * 144, 0, 144, 128, -72, -64, 144, 128);
  }
  ctx.restore();

  const textAlpha = Math.min(1, t / 0.18) * fade;
  ctx.globalAlpha = textAlpha;
  ctx.textAlign = 'left';
  ctx.lineWidth = 5; ctx.strokeStyle = '#201437';
  ctx.font = 'bold 24px Georgia, serif';
  const tx = cx + 115, ty = GY - 145 - ease(t / 0.4) * 8;
  ctx.strokeText('Correct!', tx, ty);
  ctx.fillStyle = '#ffe18a'; ctx.fillText('Correct!', tx, ty);
  ctx.font = 'bold 19px Georgia, serif';
  const label = c.gain > 0 ? `+${Math.round(c.gain)} stamina` : 'Stamina full!';
  ctx.strokeText(label, tx, ty + 29);
  ctx.fillStyle = '#8bffe0'; ctx.fillText(label, tx, ty + 29);
  ctx.restore();
}

function drawDebugSpriteFrame(label, name, x, y) {
  const f = HERA_FRAMES[name];
  debugCtx.imageSmoothingEnabled = false;
  if (heraSpriteReady) {
    debugCtx.drawImage(heraImg, f.x, f.y, f.w, f.h, x, y, f.w * 0.66, f.h * 0.66);
  }
  debugCtx.fillStyle = '#f0c040';
  debugCtx.font = '13px Georgia, serif';
  debugCtx.fillText(label, x + 12, y + 114);
}

function drawSpriteDebug() {
  debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
  debugCtx.fillStyle = '#120025';
  debugCtx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);
  debugCtx.fillStyle = '#f0e0ff';
  debugCtx.font = '16px Georgia, serif';
  debugCtx.fillText('Run: contact → passing → flight, alternating stride', 24, 32);
  RUN_CYCLE.forEach((name, i) =>
    drawDebugSpriteFrame(name, name, 16 + (i % 6) * 148, 42 + Math.floor(i / 6) * 138));
  debugCtx.fillStyle = '#f0e0ff';
  debugCtx.font = '16px Georgia, serif';
  debugCtx.fillText('Jump: takeoff → ascent → descent', 24, 330);
  debugCtx.fillText('Kick: anticipate → contact → recover', 468, 330);
  ['takeoff', 'ascent', 'descent', 'windup', 'extend', 'recover'].forEach((name, i) =>
    drawDebugSpriteFrame(name, name, 16 + i * 148, 350));
}

// ─── Enemies ──────────────────────────────────────────────────────────────────
// Zeus's disguises, blitted straight from the reference pixel art. Each
// enemy alternates its two baked frames (wing-beat / puff-breath / gallop)
// off the `animT` clock with a per-enemy phase so they desync, plus a small
// draw-only bob (flying) or ground bounce (bull). The cloud gets extra
// procedural lightning crackle on top of the bolts baked into its sprite.

function drawBolt(x, y, s, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(2, -8); ctx.lineTo(-3, 0); ctx.lineTo(0, 0);
  ctx.lineTo(-2, 8); ctx.lineTo(3, -1); ctx.lineTo(0, -1);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function enemyPose(e) {
  const isBull = e.type === 'bull';
  const usesRedrawnSheet = e.type !== 'cloud';
  const t = animT * ENEMY_ANIM_HZ[e.type] + e.phase;
  const frame = Math.floor(t) % 2;
  const f = ENEMY_FRAMES[e.type + frame];

  const scale = ENEMY_DRAW_SCALE[e.type];
  const dw = Math.round(f.w * scale), dh = Math.round(f.h * scale);
  let dx = e.x + e.w / 2 - dw / 2;
  let dy;
  if (isBull) {
    // Keep the leading fist beside the existing collision edge; the added
    // bulk extends behind it instead of making contact look prematurely late.
    dx = e.x;
    dy = e.y + e.h - f.h - Math.abs(Math.sin(t * Math.PI)) * 2.5;
  } else if (e.type === 'swan') {
    // Walking poses keep a webbed foot planted; no flying bob or height tier.
    dy = e.y + e.h - f.h;
  } else {
    dy = e.y + e.h / 2 - dh / 2 + Math.sin(animT * 2.6 + e.phase) * 3;
  }

  return { f, frame, dx, dy, dw, dh, scale, usesRedrawnSheet };
}

// Eye coordinates are relative to each atlas frame. Warm ivory patches cover
// the normal pupils; chunky crossed eyes rotate with the defeated sprite.
const DAZED_EYES = {
  bull: [[[29, 54, 3], [53, 53, 4]], [[29, 54, 3], [53, 53, 4]]],
  eagle: [[[23, 34, 3]], [[29, 32, 3]]],
  swan: [[[17, 15, 3]], [[18, 17, 3]]],
  cloud: [[[31, 25, 4], [49, 24, 4]], [[31, 27, 4], [49, 26, 4]]],
};

function drawDefeatedEnemy(e) {
  const fly = e.fly;
  const { f, frame, dw, dh, usesRedrawnSheet } = fly.pose;
  ctx.save();
  ctx.translate(Math.round(fly.x), Math.round(fly.y));
  ctx.rotate(fly.angle);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(usesRedrawnSheet ? groundImg : enemiesImg, f.x, f.y, f.w, f.h,
    -dw / 2, -dh / 2, dw, dh);
  ctx.translate(-dw / 2, -dh / 2);
  ctx.scale(dw / f.w, dh / f.h);
  for (const [x, y, r] of DAZED_EYES[e.type][frame]) {
    ctx.fillStyle = e.type === 'cloud' ? '#dad5ec' : '#fff0ce';
    ctx.fillRect(x - r - 1, y - r - 1, r * 2 + 3, r * 2 + 3);
    ctx.fillStyle = '#422345';
    for (let d = -r; d <= r; d++) {
      ctx.fillRect(x + d, y + d, 2, 2);
      ctx.fillRect(x + d, y - d, 2, 2);
    }
  }
  ctx.restore();
}

function enemyHitbox(e) {
  if (e.type === 'eagle' || e.type === 'cloud') {
    const p = enemyPose(e);
    // Follow the enlarged art, omitting transparent borders and bolt tips.
    const insetX = e.type === 'eagle' ? 12 : 8;
    const insetY = e.type === 'eagle' ? 10 : 7;
    return { x: p.dx + insetX, y: p.dy + insetY,
      w: p.dw - insetX * 2, h: p.dh - insetY * 2 };
  }
  return { x: e.x + 6, y: e.y + 6, w: e.w - 12, h: e.h - 10 };
}

function drawEnemy(e) {
  const usesRedrawnSheet = e.type !== 'cloud';
  if (usesRedrawnSheet ? !groundSpriteReady : !enemySpriteReady) return;
  if (e.defeated) { drawDefeatedEnemy(e); return; }
  const { f, dx, dy, dw, dh, scale } = enemyPose(e);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(usesRedrawnSheet ? groundImg : enemiesImg, f.x, f.y, f.w, f.h,
    Math.round(dx), Math.round(dy), dw, dh);
  ctx.restore();

  if (e.type === 'cloud') {
    const cx0 = e.x + e.w / 2, cy0 = e.y + e.h / 2;
    const f1 = Math.sin(animT * 13 + e.phase * 3);
    if (f1 > 0.2) drawBolt(cx0 + 57, cy0 - 7, 1.2, '#ffd700', Math.min(1, f1 * 1.4));
    const f2 = Math.sin(animT * 11 + e.phase * 5 + 2);
    if (f2 > 0.4) drawBolt(cx0 - 55, cy0 + 17, 1.0, '#9be8ff', Math.min(1, f2 * 1.3));
    ctx.fillStyle = '#ffd700';
    const sparks = [[-40, -22], [42, 16], [-8, -34]];
    for (let i = 0; i < sparks.length; i++) {
      ctx.globalAlpha = (0.5 + 0.5 * Math.sin(animT * 9 + i * 2.1 + e.phase)) * 0.9;
      circle(cx0 + sparks[i][0] * scale, cy0 + sparks[i][1] * scale, 1.6);
    }
    ctx.globalAlpha = 1;
  }
}

// ─── Peacock ──────────────────────────────────────────────────────────────────
// Left-facing peacock redrawn from the concept art in ground-sheet.png,
// with a two-frame strut and gold glint at the original ground baseline.

function drawPeacock(p) {
  if (!groundSpriteReady) return;
  const f = ENEMY_FRAMES['peacock' + (Math.floor(animT * 3 + p.phase) % 2)];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(groundImg, f.x, f.y, f.w, f.h,
    Math.round(p.x + p.w / 2 - f.w / 2), Math.round(p.y + p.h - f.h), f.w, f.h);
  ctx.restore();

  const tw = 0.5 + 0.5 * Math.sin(animT * 6 + p.phase);
  ctx.globalAlpha = 0.4 + tw * 0.6;
  ctx.fillStyle = '#ffd700';
  circle(p.x + p.w / 2 + f.w * 0.38, p.y + p.h - f.h + 4, 1.5 + tw * 1.5);
  ctx.globalAlpha = 1;
}

// ─── Dust ─────────────────────────────────────────────────────────────────────

function drawDust(d) {
  const pr = d.t / d.dur;
  ctx.globalAlpha = 0.35 * (1 - pr);
  ctx.fillStyle = '#c9b28a';
  circle(d.x, d.y - pr * 6, d.r + pr * 4);
  ctx.globalAlpha = 1;
}

// ─── Kick effect ──────────────────────────────────────────────────────────────

const EFF_COLS = ['#ffd700', '#ff8c00', '#ff4500', '#fff'];

function drawEffect(ef) {
  const p = ef.t / ef.dur;
  ctx.save(); ctx.globalAlpha = 1 - p;
  const maxR = 55;
  for (const ray of ef.rays) {
    const r = maxR * p * ray.len;
    const x = ef.x + Math.cos(ray.angle) * r;
    const y = ef.y + Math.sin(ray.angle) * r * 0.7;
    ctx.fillStyle = EFF_COLS[Math.floor(ray.angle * 1.3) % EFF_COLS.length];
    ctx.beginPath(); ctx.arc(x, y, (1 - p) * 7 + 1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render() {
  rewardCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.clearRect(0, 0, CW, CH);

  if (state === GameState.LOADING) {
    ctx.fillStyle = '#070015';
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#d4a017';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Loading…', CW / 2, CH / 2);
    return;
  }

  drawBg();
  drawGround();

  for (const p of peacocks) drawPeacock(p);

  for (const e of enemies) drawEnemy(e);

  for (const d of dusts) drawDust(d);

  if (celebration && state !== GameState.QUESTION) drawCelebration();
  else drawHera();

  for (const ef of effects) drawEffect(ef);
  drawRewardTransfer();
}

// ─── Game loop ────────────────────────────────────────────────────────────────

let lastTs = null;
function loop(ts) {
  if (lastTs === null) lastTs = ts;
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// ─── Input ────────────────────────────────────────────────────────────────────

function startCharge() {
  if (state !== GameState.RUNNING || celebration || !hera.grounded || isCharging) return;
  isCharging = true;
  chargeT = 0;
}

function releaseJump() {
  if (!isCharging) return;
  isCharging = false;
  if (state !== GameState.RUNNING || celebration || !hera.grounded) { chargeT = 0; return; }
  const frac = clamp(chargeT / MAX_CHARGE, 0, 1);
  hera.vy = JUMP_MIN_VY + (JUMP_MAX_VY - JUMP_MIN_VY) * frac;
  hera.grounded = false;
  hera.anim = 'jump';
  hera.jumpT = 0; hera.landTimer = 0;
  sfxJump(frac);
  chargeT = 0;
}

document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault();
    if (e.repeat) return;
    if (state === GameState.RUNNING) startCharge();
    else if (state === GameState.PAUSED) resume();
    else if (state === GameState.DEBUG) resumeFromDebug();
  }
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (state === GameState.RUNNING) pause();
    else if (state === GameState.PAUSED) resume();
    else if (state === GameState.DEBUG) closeDebug();
  }
});

document.addEventListener('keyup', e => {
  if (e.code === 'Space' || e.key === ' ') releaseJump();
});

canvas.addEventListener('pointerdown',  e => { e.preventDefault(); startCharge(); });
canvas.addEventListener('pointerup',    e => { e.preventDefault(); releaseJump(); });
canvas.addEventListener('pointercancel', () => { isCharging = false; chargeT = 0; });
canvas.addEventListener('contextmenu',  e => e.preventDefault());

startBtn.addEventListener('click',   startRun);
pauseBtn.addEventListener('click',   pause);
debugBtn.addEventListener('click',   openDebug);
debugBackBtn.addEventListener('click', closeDebug);
debugResumeBtn.addEventListener('click', resumeFromDebug);
bestiaryBtn.addEventListener('click',       openBestiary);
bestiaryBackBtn.addEventListener('click',   closeBestiary);
bestiaryResumeBtn.addEventListener('click', resumeFromBestiary);
resumeBtn.addEventListener('click',  resume);
restartBtn.addEventListener('click', startRun);

answerBtns.forEach((btn, i) => btn.addEventListener('click', () => answerQuestion(i)));

soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  soundBtn.textContent = soundOn ? '♪' : '♪̶';
  soundBtn.setAttribute('aria-label', soundOn ? 'Mute sound' : 'Enable sound');
  savePrefs();
  if (soundOn) ensureAudio();
});

minInput.addEventListener('change', () => {
  const mn = parseInt(minInput.value) || 2;
  const mx = parseInt(maxInput.value) || 12;
  if (mn > mx) maxInput.value = mn;
});
maxInput.addEventListener('change', () => {
  const mn = parseInt(minInput.value) || 2;
  const mx = parseInt(maxInput.value) || 12;
  if (mx < mn) minInput.value = mx;
});

// ─── Orientation guard ────────────────────────────────────────────────────────

function checkOrientation() {
  const portrait = window.innerHeight > window.innerWidth;
  rotateOverlay.classList.toggle('hidden', !portrait);
}

window.addEventListener('resize', () => { resizeCanvas(); checkOrientation(); });
window.addEventListener('orientationchange', () => setTimeout(checkOrientation, 250));

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  canvas.width  = CW;
  canvas.height = CH;

  loadPrefs();
  minInput.value = minFactor;
  maxInput.value = maxFactor;
  bestStart.textContent = bestScore > 0 ? `Best: ${bestScore}` : '';
  soundBtn.textContent  = soundOn ? '♪' : '♪̶';

  resizeCanvas();
  checkOrientation();
  setState(GameState.START_SCREEN);
  requestAnimationFrame(loop);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

window.addEventListener('load', init);
