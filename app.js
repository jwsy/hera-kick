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
// ax = x (in sheet px) of the planted foot inside the frame; every frame is
// drawn with that foot pinned to Hera's ground point so the animation
// doesn't slide. The kick frame has the impact spark baked in at the foot.
const HERA_FRAMES = {
  idle0: { x: 2,   y: 7, w: 160, h: 221, ax: 70 },
  idle1: { x: 164, y: 8, w: 162, h: 220, ax: 84 },
  walk0: { x: 328, y: 6, w: 153, h: 222, ax: 93 },
  walk1: { x: 483, y: 7, w: 166, h: 221, ax: 102 },
  kick:  { x: 651, y: 2, w: 318, h: 226, ax: 139 },
};
const HERA_SCALE = 0.55;   // sheet px -> screen px (~122px standing height)
const RUN_LEAN   = 0.06;   // forward lean while running (radians)

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

// Sprite sheet ships with a transparent background — no cleanup needed.
const heraImg = new Image();
let heraSpriteReady = false;
heraImg.onload = () => { heraSpriteReady = true; };
heraImg.src = 'assets/sprites/hera-sheet.png';

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
  enemies = []; peacocks = []; effects = [];
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
  const w = 75, h = type === 'bull' ? 75 : 60;
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
  peacocks.push({ x: CW + 20, y: GY - 70, w: 60, h: 70, collected: false });
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
    }
  }

  // Charge accumulates only while grounded and key/pointer is held
  if (isCharging && hera.grounded) chargeT = Math.min(chargeT + dt, MAX_CHARGE);

  // Animation
  animT += dt;
  if (hera.anim === 'run') {
    // Stride rate scales with world speed so her feet keep up with the ground
    hera.runPhase += dt * clamp(worldSpeed / 28, 7, 12);
    hera.frame = Math.floor(hera.runPhase) % 2;
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

// Draw a sheet frame with its planted foot pinned at (footX, footY),
// optionally rotated about that foot and squash/stretched.
function drawHeraFrame(name, footX, footY, rot = 0, sclX = 1, sclY = 1) {
  const f = HERA_FRAMES[name];
  ctx.save();
  ctx.translate(footX, footY);
  if (rot) ctx.rotate(rot);
  ctx.scale(sclX, sclY);
  ctx.drawImage(heraImg, f.x, f.y, f.w, f.h,
    -f.ax * HERA_SCALE, -f.h * HERA_SCALE, f.w * HERA_SCALE, f.h * HERA_SCALE);
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
      // Mid-stride frame, tilting back on the way up and forward coming down
      const tilt = clamp(hera.vy * 0.00012, -0.12, 0.14);
      drawHeraFrame('walk1', cx, footY, tilt);
    } else {
      // Run: alternate the two stride frames with a bounce; crouch while charging
      const bounce = 2.5 * Math.abs(Math.sin(hera.runPhase * Math.PI));
      const name = hera.frame === 0 ? 'walk0' : 'walk1';
      drawHeraFrame(name, cx, footY - bounce, RUN_LEAN,
        1 + chargeFrac * 0.05, 1 - chargeFrac * 0.09);
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
  debugCtx.fillText('Run cycle (walk0 ↔ walk1, jump uses walk1)', 24, 28);
  debugCtx.fillText('Kick (spark baked in)', 324, 254);
  debugCtx.fillText('Idle (unused in run)', 24, 254);

  drawDebugSpriteFrame('walk0', 'walk0', 24, 42);
  drawDebugSpriteFrame('walk1', 'walk1', 160, 42);
  drawDebugSpriteFrame('idle0', 'idle0', 24, 270, 0.7, false);
  drawDebugSpriteFrame('idle1', 'idle1', 160, 270, 0.7, false);
  drawDebugSpriteFrame('kick', 'kick', 324, 270);
}

// ─── Enemies ──────────────────────────────────────────────────────────────────
// Zeus's disguises, styled after the reference art (sprites-init.png):
// white eagle, white swan, angry silver storm cloud, cream bull with gold
// horns. All animate off `animT` with a per-enemy phase so they desync.

const OUTLINE = 'rgba(43, 34, 64, 0.9)';

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

function drawEagle(e) {
  const t   = animT * 9 + e.phase;
  const flap = Math.sin(t);
  const bob  = Math.sin(animT * 2.8 + e.phase) * 3;
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h / 2 + bob);
  ctx.lineJoin = 'round';

  // Wings — raised feather fans beating at the shoulder
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 8, -4);
    ctx.rotate(side * flap * 0.28);
    ctx.strokeStyle = side < 0 ? '#d8d2c2' : '#f4f0e2';
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = 0.3 + i * 0.3;
      const len = 26 - i * 2.5;
      ctx.lineWidth = 7 - i;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.lineTo(side * Math.sin(a) * len, -Math.cos(a) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Tail feathers trailing behind
  ctx.fillStyle = '#e8e2d0';
  ctx.beginPath();
  ctx.moveTo(14, 4); ctx.lineTo(30, 0); ctx.lineTo(28, 6);
  ctx.lineTo(31, 8); ctx.lineTo(26, 12); ctx.lineTo(14, 12);
  ctx.closePath(); ctx.fill();

  // Body with breast-feather scallops
  ctx.fillStyle = '#f4f0e2';
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(2, 8, 17, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(180,170,150,0.7)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(-2, 7, 5, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.beginPath(); ctx.arc(6, 11, 5, 0.2, Math.PI - 0.2); ctx.stroke();

  // Head — white, glaring at Hera
  ctx.fillStyle = '#faf7ec';
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(-14, -6, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Big hooked golden beak
  ctx.fillStyle = '#e8a825';
  ctx.beginPath();
  ctx.moveTo(-22, -11);
  ctx.quadraticCurveTo(-36, -10, -33, -2);
  ctx.quadraticCurveTo(-31, 2, -27, -1);
  ctx.quadraticCurveTo(-26, 1, -21, 0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5; ctx.stroke();

  // Angry brow and eye
  ctx.strokeStyle = '#3a3050'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-21, -13); ctx.lineTo(-13, -10); ctx.stroke();
  ctx.fillStyle = '#2b2240'; circle(-17, -8, 2.2);

  // Talons tucking with the wingbeat
  ctx.strokeStyle = '#e0a020'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-4, 19); ctx.lineTo(-6, 25 + flap * 1.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, 20);  ctx.lineTo(3, 26 - flap * 1.5);  ctx.stroke();

  ctx.restore();
}

function drawSwan(e) {
  const bob  = Math.sin(animT * 2.4 + e.phase) * 3;
  const flap = Math.sin(animT * 6 + e.phase);
  const nod  = Math.sin(animT * 2.4 + e.phase + 0.8) * 1.5;
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h / 2 + bob);

  // Body
  ctx.fillStyle = '#f2f0f8';
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(4, 8, 22, 12, -0.08, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Upturned tail
  ctx.fillStyle = '#f2f0f8';
  ctx.beginPath();
  ctx.moveTo(22, 2); ctx.quadraticCurveTo(32, -4, 34, -10);
  ctx.quadraticCurveTo(28, 0, 20, 8);
  ctx.closePath(); ctx.fill();

  // Layered wing, gently beating
  ctx.save();
  ctx.translate(6, 2);
  ctx.rotate(flap * 0.18 - 0.05);
  ctx.fillStyle = '#dcd8ec';
  ctx.beginPath(); ctx.ellipse(6, 2, 16, 8, -0.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#efedf8';
  ctx.beginPath(); ctx.ellipse(2, -1, 13, 6.5, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(150,145,180,0.8)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(6 + i * 3, 8 - i * 4);
    ctx.lineTo(18 + i * 3, 4 - i * 4);
    ctx.stroke();
  }
  ctx.restore();

  // Tall S-curved neck with a slow nod, shaded so it reads against the body
  ctx.strokeStyle = '#dcd8ec'; ctx.lineWidth = 9.5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-8, 6);
  ctx.bezierCurveTo(-16, -2, -24, -8, -22, -23 + nod);
  ctx.stroke();
  ctx.strokeStyle = '#f6f4fb'; ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-8, 5);
  ctx.bezierCurveTo(-16, -3, -24, -9, -22, -23 + nod);
  ctx.stroke();

  // Head raised high: black mask, orange beak
  ctx.fillStyle = '#f6f4fb';
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(-22, -25 + nod, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2b2240';
  ctx.beginPath(); ctx.ellipse(-26, -26 + nod, 4.5, 3, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8963c';
  ctx.beginPath();
  ctx.moveTo(-28, -29 + nod); ctx.lineTo(-38, -24 + nod); ctx.lineTo(-28, -22 + nod);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; circle(-26, -27 + nod, 1.4);

  ctx.restore();
}

function drawZeusCloud(e) {
  const cx0 = e.x + e.w / 2, cy0 = e.y + e.h / 2;
  const puff = 1 + Math.sin(animT * 3 + e.phase) * 0.04;
  ctx.save();
  ctx.translate(cx0, cy0);
  ctx.scale(puff, 2 - puff);   // breathe: widen while flattening

  // Cumulus puffs — dark base, silver body, bright crown
  ctx.fillStyle = '#a8a2c6';
  for (const [px, py, r] of [[-20, 12, 12], [-2, 15, 13], [16, 12, 12], [27, 6, 9]]) circle(px, py, r);
  ctx.fillStyle = '#c7c2dd';
  for (const [px, py, r] of [[-24, -2, 13], [-8, -10, 15], [10, -8, 14], [24, -2, 11], [0, 4, 16], [18, 4, 12]]) circle(px, py, r);
  ctx.fillStyle = '#e5e1f1';
  for (const [px, py, r] of [[-12, -12, 8], [6, -13, 8], [-26, -6, 6]]) circle(px, py, r);

  // Furious golden eyes under heavy brows, and a thundering frown
  ctx.fillStyle = '#f2b52a';
  ctx.beginPath(); ctx.ellipse(-8, -2, 4.5, 3.5, 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(8, -2, 4.5, 3.5, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2b2240'; circle(-7, -2, 1.8); circle(7, -2, 1.8);
  ctx.strokeStyle = '#4a4066'; ctx.lineCap = 'round';
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(-14, -9); ctx.lineTo(-3, -5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14, -9);  ctx.lineTo(3, -5);  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 14, 6, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();

  ctx.restore();

  // Crackling lightning, flickering out of sync
  const f1 = Math.sin(animT * 13 + e.phase * 3);
  if (f1 > 0.1) drawBolt(cx0 + 34, cy0 - 8, 1.4, '#ffd700', Math.min(1, f1 * 1.5));
  const f2 = Math.sin(animT * 11 + e.phase * 5 + 2);
  if (f2 > 0.3) drawBolt(cx0 - 30, cy0 + 16, 1.1, '#9be8ff', Math.min(1, f2 * 1.4));
  const f3 = Math.sin(animT * 17 + e.phase * 7 + 4);
  if (f3 > 0.55) drawBolt(cx0 + 14, cy0 + 24, 0.8, '#9be8ff', Math.min(1, f3));

  // Twinkling gold sparks
  ctx.fillStyle = '#ffd700';
  const sparks = [[-32, -16], [30, 8], [-6, -24]];
  for (let i = 0; i < sparks.length; i++) {
    const a = 0.5 + 0.5 * Math.sin(animT * 9 + i * 2.1 + e.phase);
    ctx.globalAlpha = a * 0.9;
    circle(cx0 + sparks[i][0], cy0 + sparks[i][1], 1.6);
  }
  ctx.globalAlpha = 1;
}

function drawBull(e) {
  const g = animT * 12 + e.phase;
  const bounce = Math.abs(Math.sin(g)) * 2.5;
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h / 2 - bounce);
  ctx.lineJoin = 'round';

  const BODY = '#ecdcae', SHADE = '#d2bc84', DARK = '#3f3350';

  // Flicking tail
  const tw = Math.sin(g * 0.5) * 4;
  ctx.strokeStyle = SHADE; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(26, -2); ctx.quadraticCurveTo(36, 2 + tw, 34, 12 + tw); ctx.stroke();
  ctx.fillStyle = '#8a6a3a'; circle(34, 13 + tw, 3);

  // Galloping legs (uneven phases for a gallop, not a trot)
  const legPhase = [0, 2.4, 1.1, 3.5];
  const legX = [-18, -8, 12, 22];
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(legX[i], 12);
    ctx.rotate(Math.sin(g + legPhase[i]) * 0.55);
    ctx.fillStyle = i % 2 === 0 ? SHADE : BODY;
    ctx.fillRect(-3.5, 0, 7, 18);
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(-3.5, 15, 7, 5);
    if (i === 1) {   // gold band, as in the art
      ctx.fillStyle = '#d4a017';
      ctx.fillRect(-4, 8, 8, 4);
    }
    ctx.restore();
  }

  // Massive cream body with a muscled shoulder hump
  ctx.fillStyle = BODY;
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(2, 0, 28, 19, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f6ecd0';
  ctx.beginPath(); ctx.ellipse(-8, -10, 14, 8, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = SHADE;
  ctx.beginPath(); ctx.ellipse(8, 10, 16, 7, 0.1, 0, Math.PI * 2); ctx.fill();

  // Lowered head, swinging with the gallop
  ctx.save();
  ctx.translate(-22, -4 + Math.sin(g) * 1.2);

  // Ear behind the horns
  ctx.fillStyle = SHADE;
  ctx.beginPath(); ctx.ellipse(9, -9, 5, 3, 0.5, 0, Math.PI * 2); ctx.fill();

  // Great golden horns sweeping up like a lyre
  ctx.lineCap = 'round';
  ctx.lineWidth = 5; ctx.strokeStyle = '#c99a20';
  ctx.beginPath(); ctx.moveTo(8, -7); ctx.quadraticCurveTo(18, -14, 14, -26); ctx.stroke();
  ctx.lineWidth = 6; ctx.strokeStyle = '#e8b62e';
  ctx.beginPath(); ctx.moveTo(-6, -8); ctx.quadraticCurveTo(-16, -16, -12, -28); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = '#f8dc7a';
  ctx.beginPath(); ctx.moveTo(-8, -11); ctx.quadraticCurveTo(-14, -17, -12, -25); ctx.stroke();

  // Head, muzzle, nostrils
  ctx.fillStyle = BODY;
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 12, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d9bd94';
  ctx.beginPath(); ctx.ellipse(-5, 6, 9, 6.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = DARK; circle(-9, 5, 1.6); circle(-4, 7, 1.6);

  // Angry golden eye
  ctx.fillStyle = '#f2b52a';
  ctx.beginPath(); ctx.ellipse(-5, -4, 3.5, 2.6, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = DARK; circle(-6, -4, 1.4);
  ctx.strokeStyle = DARK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-11, -9); ctx.lineTo(-2, -7); ctx.stroke();

  ctx.restore();
  ctx.restore();
}

// ─── Peacock ──────────────────────────────────────────────────────────────────

function drawPeacock(p) {
  ctx.save(); ctx.translate(p.x + p.w / 2, p.y + p.h);

  const TEAL = '#008080';
  // Fan
  for (let i = 0; i < 7; i++) {
    const a = (-60 + i * 20) * Math.PI / 180;
    const fl = 44;
    const fx = Math.cos(a) * fl, fy = -32 - Math.sin(a) * fl;
    ctx.strokeStyle = i % 2 === 0 ? '#009090' : '#00b0a0';
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.fillStyle = '#003d55'; circle(fx, fy, 6);
    ctx.fillStyle = '#00d0ff'; circle(fx, fy, 3.5);
    ctx.fillStyle = '#fff'; circle(fx, fy, 1.5);
  }

  // Body
  ctx.fillStyle = '#006060';
  ctx.beginPath(); ctx.ellipse(0, -20, 12, 22, 0, 0, Math.PI * 2); ctx.fill();

  // Head
  ctx.fillStyle = '#00a0a0'; circle(0, -44, 8);
  // Crest
  ctx.fillStyle = '#00d0b0';
  for (let i = 0; i < 3; i++) circle(-4 + i * 4, -55 - i, 3);
  // Beak & eye
  ctx.fillStyle = '#ffd700'; ctx.fillRect(7, -45, 9, 3);
  ctx.fillStyle = '#111'; circle(5, -46, 2);

  // Legs
  ctx.strokeStyle = '#007050'; ctx.lineWidth = 3; ctx.lineCap = 'square';
  ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(-5, 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( 5, -5); ctx.lineTo( 5, 6); ctx.stroke();

  ctx.restore();
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

  for (const e of enemies) {
    if      (e.type === 'eagle') drawEagle(e);
    else if (e.type === 'swan')  drawSwan(e);
    else if (e.type === 'cloud') drawZeusCloud(e);
    else                         drawBull(e);
  }

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
