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

// Hera sprite sheet (assets/sprites/hera-sheet.png) — frames cut from the
// "Hera, Queen of the Gods" reference art (sprites-init.png). Transparent
// background, feet resting on the bottom edge of each frame box.
// The run cycle is contact/airborne pairs: walk frames are the stride
// contacts, pass frames are the same poses with the hem/feet band squashed
// (legs tucked, airborne). Run-frame anchors (ax) sit on the head/torso
// centroid so her body stays rock steady between frames — anchoring by the
// feet is what made the old animation twitch. Idle/kick anchor by the
// planted foot. The kick frame has the impact spark baked in.
const HERA_FRAMES = {
  idle0: { x: 2,   y: 7,  w: 160, h: 221, ax: 70 },
  idle1: { x: 164, y: 8,  w: 162, h: 220, ax: 84 },
  walk0: { x: 328, y: 6,  w: 153, h: 222, ax: 91 },
  pass0: { x: 483, y: 15, w: 153, h: 213, ax: 91 },
  walk1: { x: 638, y: 7,  w: 166, h: 221, ax: 98 },
  pass1: { x: 806, y: 16, w: 166, h: 212, ax: 98 },
  kick:  { x: 974, y: 2,  w: 318, h: 226, ax: 139 },
};
const RUN_CYCLE  = ['walk0', 'pass0', 'walk1', 'pass1'];
const RUN_BASE_H = 222;    // contact-frame height; run frames top-align to it
                           // so the shorter pass frames lift the feet, not drop the head
const HERA_SCALE = 0.55;   // sheet px -> screen px (~122px standing height)
const RUN_LEAN   = 0.09;   // forward lean while running (radians)

// Zeus-disguise enemy sprites (assets/sprites/enemies-sheet.png) — the
// actual pixel art cut from the reference sheet, pre-scaled to game size so
// frames blit 1:1 with crisp pixels. Each disguise has two frames: the base
// pose and a squashed variant (wing-beat / puff-breath / gallop-compress).
const ENEMY_FRAMES = {
  eagle0: { x: 2,   y: 8,  w: 80,  h: 94 },
  eagle1: { x: 84,  y: 8,  w: 80,  h: 94 },
  swan0:  { x: 166, y: 16, w: 73,  h: 86 },
  swan1:  { x: 241, y: 16, w: 73,  h: 86 },
  cloud0: { x: 316, y: 6,  w: 103, h: 96 },
  cloud1: { x: 421, y: 6,  w: 103, h: 96 },
  bull0:  { x: 526, y: 2,  w: 80,  h: 100 },
  bull1:  { x: 608, y: 2,  w: 80,  h: 100 },
  peacock0: { x: 690, y: 32, w: 52, h: 70 },
  peacock1: { x: 744, y: 32, w: 52, h: 70 },
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
  frame: 0, runPhase: 0, kickTimer: 0,
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

// ─── DOM ──────────────────────────────────────────────────────────────────────

const canvas   = document.getElementById('game-canvas');
const ctx      = canvas.getContext('2d');
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
  question = null;
  skyOff = 0; cloudOff = 0; gndOff = 0;

  isCharging = false; chargeT = 0; animT = 0;
  hera.y = GY - HERA_H; hera.vy = 0; hera.grounded = true;
  hera.anim = 'run'; hera.frame = 0; hera.runPhase = 0; hera.kickTimer = 0;

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
    stamina = clamp(stamina + CORRECT_GAIN, 0, MAX_STAMINA);
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
  const w = 86, h = type === 'bull' ? 86 : 72;
  let y;
  if (type === 'bull') {
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
      hera.anim = 'run';
      for (let i = 0; i < 3; i++) spawnDust(hera.x + rand(-6, 16), GY - 2);
    }
  }

  // Charge accumulates only while grounded and key/pointer is held
  if (isCharging && hera.grounded) chargeT = Math.min(chargeT + dt, MAX_CHARGE);

  // Animation
  animT += dt;
  if (hera.anim === 'run') {
    // Stride rate scales with world speed so her feet keep up with the ground
    hera.runPhase += dt * clamp(worldSpeed / 14, 13, 22);
    const nf = Math.floor(hera.runPhase) % 4;
    if (nf !== hera.frame && nf % 2 === 0 && hera.grounded) {
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
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.x -= worldSpeed * dt;
    if (e.x + e.w < 0) { enemies.splice(i, 1); continue; }
    if (!e.defeated && aabb(hx, hy, hw, hh, e.x + 6, e.y + 6, e.w - 12, e.h - 10)) {
      e.defeated = true;
      score += KICK_SCORE;
      hera.anim = 'kick'; hera.kickTimer = 0.35;
      spawnEffect(e.x + e.w / 2, e.y + e.h / 2);
      sfxKick();
      enemies.splice(i, 1);
    }
  }

  // Update peacocks
  for (let i = peacocks.length - 1; i >= 0; i--) {
    const p = peacocks[i];
    p.x -= worldSpeed * 0.85 * dt;
    if (p.x + p.w < 0) { peacocks.splice(i, 1); continue; }
    if (!p.collected && aabb(hx, hy, hw, hh, p.x + 8, p.y + 8, p.w - 16, p.h - 12)) {
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

  // HUD
  scoreVal.textContent = Math.floor(score);
  const pct = (stamina / MAX_STAMINA) * 100;
  sFill.style.width = pct + '%';
  sBar.setAttribute('aria-valuenow', Math.floor(stamina));
  const flash = stamina < LOW_THRESH && Math.floor(elapsed * 4) % 2 === 0;
  sFill.style.background = stamina < LOW_THRESH
    ? (flash ? '#ff3333' : '#ff8888')
    : '#f0c040';
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function circle(x, y, r) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function drawCloud(x, y, r) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.75, y - r * 0.35, r * 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x - r * 0.75, y - r * 0.25, r * 0.65, 0, Math.PI * 2); ctx.fill();
}

// ─── Background ───────────────────────────────────────────────────────────────

const STARS = Array.from({length: 30}, () => [rand(0, CW), rand(0, GY - 80), rand(0.8, 2.2)]);
const COL_BASES = [80, 240, 410, 580, 750, 920];

function drawBg() {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, GY);
  sky.addColorStop(0, '#070015');
  sky.addColorStop(0.5, '#2d0057');
  sky.addColorStop(1, '#450075');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CW, GY);

  // Stars
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const [sx, sy, sr] of STARS) {
    const x = ((sx - skyOff * 0.05 + CW * 2) % CW);
    ctx.beginPath(); ctx.arc(x, sy, sr, 0, Math.PI * 2); ctx.fill();
  }

  // Distant columns
  ctx.fillStyle = 'rgba(160, 120, 210, 0.22)';
  for (const bx of COL_BASES) {
    const cx = ((bx - skyOff * 0.15 + CW * 3) % (CW + 200)) - 60;
    ctx.fillRect(cx, GY - 220, 22, 220);
    ctx.fillRect(cx - 6, GY - 228, 34, 14);   // capital
    ctx.fillRect(cx - 4, GY - 4,   30, 8);    // base
  }

  // Purple clouds
  ctx.fillStyle = 'rgba(130, 90, 190, 0.28)';
  const cloudDefs = [[120, 90, 42], [370, 65, 52], [620, 85, 38], [860, 72, 46]];
  for (const [bx, by, r] of cloudDefs) {
    const cx = ((bx - cloudOff + CW * 3) % (CW + 200)) - 80;
    drawCloud(cx, by, r);
  }
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

// Draw a sheet frame anchored at (footX, footY), optionally rotated about
// that point and squash/stretched. baseH top-aligns the frame to a taller
// reference height: run frames pass RUN_BASE_H so the shorter airborne
// frames lift her feet off the ground instead of dropping her head.
function drawHeraFrame(name, footX, footY, rot = 0, sclX = 1, sclY = 1, baseH = 0) {
  const f = HERA_FRAMES[name];
  ctx.save();
  ctx.translate(footX, footY);
  if (rot) ctx.rotate(rot);
  ctx.scale(sclX, sclY);
  ctx.drawImage(heraImg, f.x, f.y, f.w, f.h,
    -f.ax * HERA_SCALE, -(baseH || f.h) * HERA_SCALE, f.w * HERA_SCALE, f.h * HERA_SCALE);
  ctx.restore();
}

function drawHera() {
  const { x, y, anim } = hera;
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
    const footY = y + HERA_H;
    if (anim === 'kick') {
      drawHeraFrame('kick', cx, footY);
    } else if (anim === 'jump') {
      // Tucked-legs frame, tilting back on the way up and forward coming down
      const tilt = clamp(hera.vy * 0.00012, -0.12, 0.14);
      drawHeraFrame('pass1', cx, footY, tilt);
    } else {
      // Run cycle: contact -> airborne -> contact -> airborne, with a small
      // bounce per step; crouch while charging a jump
      const bounce = 1.2 * Math.abs(Math.sin(hera.runPhase * Math.PI / 2));
      drawHeraFrame(RUN_CYCLE[hera.frame], cx, footY - bounce, RUN_LEAN,
        1 + chargeFrac * 0.05, 1 - chargeFrac * 0.09, RUN_BASE_H);
    }
  } else {
    // Fallback while sprite loads
    ctx.fillStyle = '#9b1c1c';
    ctx.fillRect(x, y, HERA_W, HERA_H);
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(x + 3, y + HERA_H * 0.44, HERA_W - 6, 6);
  }

  ctx.restore();
}

function drawDebugSpriteFrame(label, name, x, y, scale = 0.7, active = true) {
  const f = HERA_FRAMES[name];
  const cellH = 226 * scale;              // tallest frame, keeps baselines level
  const w = f.w * scale;
  const h = f.h * scale;
  debugCtx.save();
  debugCtx.fillStyle = 'rgba(255,255,255,0.04)';
  debugCtx.fillRect(x, y, w, cellH);
  debugCtx.strokeStyle = active ? 'rgba(240,192,64,0.65)' : 'rgba(240,224,255,0.3)';
  debugCtx.lineWidth = 1;
  debugCtx.strokeRect(x + 0.5, y + 0.5, w - 1, cellH - 1);

  // Cyan vertical: the planted-foot anchor (f.ax); red dashed: ground baseline
  debugCtx.strokeStyle = 'rgba(96,200,255,0.6)';
  debugCtx.beginPath();
  debugCtx.moveTo(x + f.ax * scale, y);
  debugCtx.lineTo(x + f.ax * scale, y + cellH);
  debugCtx.stroke();
  debugCtx.strokeStyle = 'rgba(255, 60, 60, 0.85)';
  debugCtx.lineWidth = 1.5;
  debugCtx.setLineDash([4, 3]);
  debugCtx.beginPath();
  debugCtx.moveTo(x, y + cellH - 1);
  debugCtx.lineTo(x + w, y + cellH - 1);
  debugCtx.stroke();
  debugCtx.setLineDash([]);

  if (heraSpriteReady) {
    debugCtx.imageSmoothingEnabled = false;
    debugCtx.drawImage(heraImg, f.x, f.y, f.w, f.h, x, y + cellH - h, w, h);
  }

  debugCtx.fillStyle = '#f0c040';
  debugCtx.font = '14px Georgia, serif';
  debugCtx.fillText(label, x, y + cellH + 18);
  if (!active) {
    debugCtx.fillStyle = 'rgba(13,0,32,0.62)';
    debugCtx.fillRect(x, y, w, cellH);
    debugCtx.fillStyle = '#f0e0ff';
    debugCtx.fillText('idle only', x + 8, y + cellH / 2);
  }
  debugCtx.restore();
}

function drawSpriteDebug() {
  debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
  debugCtx.fillStyle = '#120025';
  debugCtx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);

  debugCtx.fillStyle = '#f0e0ff';
  debugCtx.font = '16px Georgia, serif';
  debugCtx.fillText('Run cycle: contact → airborne → contact → airborne (jump uses pass1)', 24, 28);
  debugCtx.fillText('Kick (spark baked in)', 324, 254);
  debugCtx.fillText('Idle (unused in run)', 24, 254);

  RUN_CYCLE.forEach((name, i) => drawDebugSpriteFrame(name, name, 24 + i * 136, 42));
  drawDebugSpriteFrame('idle0', 'idle0', 24, 270, 0.7, false);
  drawDebugSpriteFrame('idle1', 'idle1', 160, 270, 0.7, false);
  drawDebugSpriteFrame('kick', 'kick', 324, 270);
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

function drawEnemy(e) {
  if (!enemySpriteReady) return;
  const t = animT * ENEMY_ANIM_HZ[e.type] + e.phase;
  const f = ENEMY_FRAMES[e.type + (Math.floor(t) % 2)];

  let dx = e.x + e.w / 2 - f.w / 2;
  let dy;
  if (e.type === 'bull') {
    dy = e.y + e.h - f.h - Math.abs(Math.sin(t * Math.PI)) * 2.5;
  } else {
    dy = e.y + e.h / 2 - f.h / 2 + Math.sin(animT * 2.6 + e.phase) * 3;
  }

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(enemiesImg, f.x, f.y, f.w, f.h, Math.round(dx), Math.round(dy), f.w, f.h);
  ctx.restore();

  if (e.type === 'cloud') {
    const cx0 = e.x + e.w / 2, cy0 = e.y + e.h / 2;
    const f1 = Math.sin(animT * 13 + e.phase * 3);
    if (f1 > 0.2) drawBolt(cx0 + 56, cy0 - 8, 1.3, '#ffd700', Math.min(1, f1 * 1.4));
    const f2 = Math.sin(animT * 11 + e.phase * 5 + 2);
    if (f2 > 0.4) drawBolt(cx0 - 54, cy0 + 16, 1.1, '#9be8ff', Math.min(1, f2 * 1.3));
    ctx.fillStyle = '#ffd700';
    const sparks = [[-46, -26], [48, 18], [-10, -40]];
    for (let i = 0; i < sparks.length; i++) {
      ctx.globalAlpha = (0.5 + 0.5 * Math.sin(animT * 9 + i * 2.1 + e.phase)) * 0.9;
      circle(cx0 + sparks[i][0], cy0 + sparks[i][1], 1.6);
    }
    ctx.globalAlpha = 1;
  }
}

// ─── Peacock ──────────────────────────────────────────────────────────────────
// The collectible peacock, blitted from the same reference pixel art
// (bottom row of sprites-init.png) with a two-frame strut and a gold glint
// so it reads as a pickup.

function drawPeacock(p) {
  if (!enemySpriteReady) return;
  const f = ENEMY_FRAMES['peacock' + (Math.floor(animT * 3 + p.phase) % 2)];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(enemiesImg, f.x, f.y, f.w, f.h,
    Math.round(p.x + p.w / 2 - f.w / 2), Math.round(p.y + p.h - f.h), f.w, f.h);
  ctx.restore();

  const tw = 0.5 + 0.5 * Math.sin(animT * 6 + p.phase);
  ctx.globalAlpha = 0.4 + tw * 0.6;
  ctx.fillStyle = '#ffd700';
  circle(p.x + p.w / 2 + 20, p.y + 4, 1.5 + tw * 1.5);
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

  drawHera();

  for (const ef of effects) drawEffect(ef);
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
  if (state !== GameState.RUNNING || !hera.grounded || isCharging) return;
  isCharging = true;
  chargeT = 0;
}

function releaseJump() {
  if (!isCharging) return;
  isCharging = false;
  if (state !== GameState.RUNNING || !hera.grounded) { chargeT = 0; return; }
  const frac = clamp(chargeT / MAX_CHARGE, 0, 1);
  hera.vy = JUMP_MIN_VY + (JUMP_MAX_VY - JUMP_MIN_VY) * frac;
  hera.grounded = false;
  hera.anim = 'jump';
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
