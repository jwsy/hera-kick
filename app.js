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

// Hera sprite sheet (assets/sprites/hera-spritesheet.png, 4 cols × 3 rows)
// Row 0: run frames 0-3
// Row 1: upright run/jump (cols 0-1), high kick (cols 2-3, col 3 has sparks)
// Row 2: guard/idle (cols 0-1), punch (cols 2-3, col 3 has sparks)
const SPRITE_W      = 1536;
const SPRITE_H      = 1024;
const SPRITE_COLS   = 4;
const SPRITE_ROWS   = 3;
const FRAME_W       = SPRITE_W / SPRITE_COLS;   // 384
const FRAME_H       = SPRITE_H / SPRITE_ROWS;   // 341.33
const SPRITE_DRAW_H = 120;
const SPRITE_DRAW_W = SPRITE_DRAW_H * (FRAME_W / FRAME_H);

const GameState = {
  LOADING:      'LOADING',
  START_SCREEN: 'START_SCREEN',
  RUNNING:      'RUNNING',
  QUESTION:     'QUESTION',
  PAUSED:       'PAUSED',
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
  frame: 0, fTimer: 0, kickTimer: 0,
};

// Sprite sheet with white-background removed
const heraImg = new Image();
let heraSpriteCanvas = null;
let heraSpriteReady  = false;
heraImg.onload = () => {
  const oc = document.createElement('canvas');
  oc.width  = SPRITE_W;
  oc.height = SPRITE_H;
  const oc2 = oc.getContext('2d');
  oc2.drawImage(heraImg, 0, 0);
  const id = oc2.getImageData(0, 0, SPRITE_W, SPRITE_H);
  const d  = id.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 240 && d[i+1] > 240 && d[i+2] > 240) d[i+3] = 0;
  }
  oc2.putImageData(id, 0, 0);
  heraSpriteCanvas = oc;
  heraSpriteReady  = true;
};
heraImg.src = 'assets/sprites/hera-spritesheet.png';

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
const pausedScreen  = document.getElementById('paused-screen');
const overScreen    = document.getElementById('gameover-screen');
const rotateOverlay = document.getElementById('rotate-overlay');

const minInput    = document.getElementById('min-factor');
const maxInput    = document.getElementById('max-factor');
const bestStart   = document.getElementById('best-score-start');
const qText       = document.getElementById('question-text');
const answerBtns  = document.querySelectorAll('.answer-btn');
const finalScore  = document.getElementById('final-score');
const bestOver    = document.getElementById('best-score-over');
const startBtn    = document.getElementById('start-btn');
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
  const running = s === GameState.RUNNING || s === GameState.QUESTION || s === GameState.PAUSED;
  hudEl.classList.toggle('hidden', !running);
  startScreen.classList.toggle('hidden', s !== GameState.START_SCREEN);
  qOverlay.classList.toggle('hidden',    s !== GameState.QUESTION);
  pausedScreen.classList.toggle('hidden', s !== GameState.PAUSED);
  overScreen.classList.toggle('hidden',  s !== GameState.GAME_OVER);
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

  isCharging = false; chargeT = 0;
  hera.y = GY - HERA_H; hera.vy = 0; hera.grounded = true;
  hera.anim = 'run'; hera.frame = 0; hera.fTimer = 0; hera.kickTimer = 0;

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
  enemies.push({ type, x: CW + 20, y, w, h, defeated: false });
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
  hera.fTimer += dt;
  if (hera.anim === 'run' && hera.fTimer > 0.11) {
    hera.frame = (hera.frame + 1) % 4; hera.fTimer = 0;
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

function getSpriteFrame(anim, frame, kickTimer) {
  if (anim === 'run')  return [frame % 4, 0];
  if (anim === 'jump') return [1, 1];
  // Kick: show impact-with-sparks frame first, then follow-through
  if (anim === 'kick') return kickTimer > 0.175 ? [3, 1] : [2, 1];
  return [0, 0];
}

function drawHera() {
  const { x, y, anim, frame, kickTimer } = hera;
  const chargeFrac = (isCharging && hera.grounded) ? clamp(chargeT / MAX_CHARGE, 0, 1) : 0;
  const cx = x + HERA_W / 2;
  ctx.save();

  // Charge aura — radial glow at feet, gold→electric-blue at full charge
  if (chargeFrac > 0) {
    const auraR = 18 + chargeFrac * 32;
    const auraColor = chargeFrac > 0.7 ? '#60c8ff' : '#d4a017';
    const ag = ctx.createRadialGradient(cx, GY, 1, cx, GY, auraR);
    ag.addColorStop(0,    '#ffffff');
    ag.addColorStop(0.35, auraColor);
    ag.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.25 + chargeFrac * 0.6;
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.ellipse(cx, GY, auraR, auraR * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Ground shadow (widens with charge to hint power)
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(cx, GY + 4, 26 + chargeFrac * 12, 6, 0, 0, Math.PI * 2); ctx.fill();

  // Crouch squish: anchor pivot at GY so feet stay planted
  const squish = 1 - chargeFrac * 0.22;
  ctx.translate(cx, GY);
  ctx.scale(1, squish);
  ctx.translate(-cx, -GY);

  if (heraSpriteReady) {
    const [col, row] = getSpriteFrame(anim, frame, kickTimer);
    const sx    = col * FRAME_W;
    const sy    = row * FRAME_H;
    const drawX = cx - SPRITE_DRAW_W / 2;
    const drawY = y + HERA_H - SPRITE_DRAW_H;   // feet anchored to collision bottom
    ctx.drawImage(heraSpriteCanvas, sx, sy, FRAME_W, FRAME_H, drawX, drawY, SPRITE_DRAW_W, SPRITE_DRAW_H);
  } else {
    // Fallback while sprite loads
    ctx.fillStyle = '#9b1c1c';
    ctx.fillRect(x, y, HERA_W, HERA_H);
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(x + 3, y + HERA_H * 0.44, HERA_W - 6, 6);
  }

  ctx.restore();
}

// ─── Enemies ──────────────────────────────────────────────────────────────────

function drawEagle(e) {
  const t = Date.now() * 0.007;
  ctx.save(); ctx.translate(e.x + e.w / 2, e.y + e.h / 2);

  const flap = Math.sin(t) * 14;
  ctx.fillStyle = '#8b4513';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 6, 2);
    ctx.lineTo(side * 36, -8 - flap);
    ctx.lineTo(side * 24, 8);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#a0521d';
  ctx.beginPath(); ctx.ellipse(0, 6, 18, 11, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#f5f5dc';
  circle(-14, -4, 8);
  ctx.fillStyle = '#ffa500';
  ctx.beginPath(); ctx.moveTo(-21, -4); ctx.lineTo(-30, -1); ctx.lineTo(-21, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#111';
  circle(-17, -6, 2);

  ctx.restore();
}

function drawSwan(e) {
  ctx.save(); ctx.translate(e.x + e.w / 2, e.y + e.h / 2);

  ctx.fillStyle = '#fffef0';
  ctx.beginPath(); ctx.ellipse(0, 8, 26, 13, 0, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = '#fffef0'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8, 0); ctx.bezierCurveTo(-8, -16, -26, -20, -28, -9); ctx.stroke();
  ctx.fillStyle = '#fffef0'; circle(-27, -12, 7);
  ctx.fillStyle = '#e8c090'; ctx.fillRect(-35, -13, 10, 3);
  ctx.fillStyle = '#111'; circle(-30, -14, 1.5);

  ctx.fillStyle = '#e8e8d0';
  ctx.beginPath(); ctx.ellipse(6, 0, 18, 9, -0.25, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function drawZeusCloud(e) {
  ctx.save(); ctx.translate(e.x + e.w / 2, e.y + e.h / 2);

  ctx.fillStyle = '#6a6a8a'; drawCloud(0, 8, 30);

  ctx.fillStyle = '#e0cca0';
  ctx.beginPath(); ctx.ellipse(0, -4, 15, 19, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#ddd';
  ctx.beginPath(); ctx.ellipse(0, 12, 13, 9, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#333';
  ctx.fillRect(-9, -8, 5, 5); ctx.fillRect(4, -8, 5, 5);
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-11, -13); ctx.lineTo(-4, -10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(11,  -13); ctx.lineTo(4,  -10); ctx.stroke();

  // Lightning bolt
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.moveTo(18, -17); ctx.lineTo(11, -4); ctx.lineTo(17, -4);
  ctx.lineTo(10, 12);  ctx.lineTo(14, 1);  ctx.lineTo(8,  1);
  ctx.closePath(); ctx.fill();

  ctx.restore();
}

function drawBull(e) {
  const t = Date.now() * 0.012;
  ctx.save(); ctx.translate(e.x + e.w / 2, e.y + e.h / 2);

  ctx.fillStyle = '#8b6914';
  ctx.beginPath(); ctx.ellipse(0, 4, 28, 21, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#9b7924';
  ctx.beginPath(); ctx.ellipse(-22, 0, 15, 13, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#e0d010';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-22 + side * 10, -10);
    ctx.lineTo(-22 + side * 20, -26);
    ctx.lineTo(-22 + side * 12, -8);
    ctx.closePath(); ctx.fill();
  }

  ctx.fillStyle = '#111'; circle(-26, -3, 2.5);
  ctx.fillStyle = '#5a3a0a'; circle(-32, 4, 3); circle(-27, 5, 3);

  const la = Math.sin(t) * 5;
  ctx.fillStyle = '#7a5910';
  ctx.fillRect(-12, 22, 10, 16 + la);
  ctx.fillRect(  4, 22, 10, 16 - la);
  ctx.fillRect(-22, 22, 10, 16 - la);
  ctx.fillRect( 16, 22, 10, 16 + la);

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
  }
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (state === GameState.RUNNING) pause();
    else if (state === GameState.PAUSED) resume();
  }
});

document.addEventListener('keyup', e => {
  if (e.code === 'Space' || e.key === ' ') releaseJump();
});

canvas.addEventListener('pointerdown',  e => { e.preventDefault(); startCharge(); });
canvas.addEventListener('pointerup',    e => { e.preventDefault(); releaseJump(); });
canvas.addEventListener('pointercancel', () => { isCharging = false; chargeT = 0; });

startBtn.addEventListener('click',   startRun);
pauseBtn.addEventListener('click',   pause);
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
