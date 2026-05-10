# AGENTS.md

This file provides guidance to agents like Codex, Gemini CLI, or Claude Code when working with code in this repository.

## Project Overview

Hera Runner is a static HTML5 PWA endless runner with multiplication practice. Hera runs automatically, the player controls only jumping (tap/click/spacebar), enemies auto-kick on collision, and peacock collisions trigger multiplication prompts that restore or drain stamina. The full design spec is in `SPEC.md`.

**No build step, no framework, no bundler, no backend.** Everything runs directly from `index.html`.

## Running Locally

Serve the root directory with any static file server. The service worker requires `localhost` or HTTPS:

```sh
npx serve .
# or
python3 -m http.server
```

Open `http://localhost:3000` (or whatever port) in a browser. There are no automated tests or linting configurations.

## Architecture

All game logic lives in a single `app.js` (~900 lines). The file is organized into clearly labeled sections:

| Section | What it does |
|---|---|
| Constants | Physics, stamina, scoring, canvas dimensions, sprite layout |
| State | Module-level mutable vars (`state`, `stamina`, `score`, `enemies[]`, etc.) |
| DOM | Element references grabbed once at module init |
| Utility | `rand`, `randInt`, `clamp`, `aabb` (axis-aligned bounding box) |
| LocalStorage | `loadPrefs` / `savePrefs` / `saveBest` |
| Audio | Synthesized sounds via Web Audio API — **no audio files exist** |
| Canvas scaling | `resizeCanvas` fits the 960×540 logical canvas to the viewport |
| Multiplication | `genQuestion` builds 4-choice questions with plausible wrong answers |
| State machine | `setState`, `startRun`, `openQuestion`, `answerQuestion`, `pause`, `resume`, `endGame` |
| Spawning | `spawnEnemy`, `spawnPeacock`, `spawnEffect` |
| Update | `update(dt)` — only runs when `state === RUNNING` |
| Drawing | `drawBg`, `drawGround`, `drawHera`, `drawEagle/Swan/ZeusCloud/Bull`, `drawPeacock`, `drawEffect` |
| Game loop | `loop(ts)` via `requestAnimationFrame`, delta-time capped at 50 ms |
| Input | Keyboard + pointer events; charge-jump on hold |
| Orientation guard | Portrait → shows rotate overlay |
| Init | `init()` on `window load` |

### State Machine

`setState(s)` is the single source of truth for screen visibility. It toggles `.hidden` on `#hud`, `#start-screen`, `#question-overlay`, `#paused-screen`, and `#gameover-screen`. All state transitions go through this function.

```js
const GameState = { LOADING, START_SCREEN, RUNNING, QUESTION, PAUSED, GAME_OVER }
```

### Canvas Rendering

Internal logical size is **960 × 540**. The canvas element is CSS-scaled to fit the viewport. `GY = 435` is the ground y-coordinate; Hera's feet are anchored there.

Render order: sky background → parallax clouds/columns → ground → peacocks → enemies → Hera → kick effects.

### Hera Sprite Sheet

`assets/sprites/hera-spritesheet.png` — 4 columns × 3 rows (1536 × 1024 px):
- Row 0: run frames 0–3
- Row 1 col 0–1: jump; col 2–3: kick (col 3 has sparks)
- Row 2: guard/idle and punch (not used in current gameplay)

White background pixels are stripped at load time via `getImageData` pixel manipulation and stored in `heraSpriteCanvas`.

### Jump System

Holding spacebar/pointer charges `chargeT` up to `MAX_CHARGE = 0.55 s`. On release, jump velocity interpolates between `JUMP_MIN_VY = -580` and `JUMP_MAX_VY = -980`. Flying enemies spawn at three height tiers calibrated to these jump heights.

### Audio

All sounds are synthesized with the Web Audio API (`tone()` helper). No `.wav` files exist despite what `SPEC.md` describes. The `sfxKick`, `sfxCorrect`, `sfxWrong`, `sfxStaminaLow`, and `sfxJump` functions compose oscillator notes.

### LocalStorage Keys

```
heraRunner.minFactor
heraRunner.maxFactor
heraRunner.bestScore
heraRunner.soundEnabled
```

### Service Worker

`sw.js` caches the app shell (`index.html`, `style.css`, `app.js`, `manifest.json`, icons) on install and uses cache-first for all requests. Bump the `CACHE` version string in `sw.js` when deploying changes that must invalidate the old cache.

## Key Conventions

- **Delta time** (`dt`) is in seconds throughout `update()`. Physics constants (`GRAVITY`, `DRAIN_PER_S`, etc.) are per-second values.
- **Hitboxes are shrunk by ~6–8px** on each side inside `update()` for collision fairness — the visual sprite is larger than the effective hitbox.
- **World speed ramps**: `worldSpeed = 220 + elapsed * 5` (px/s). Enemy spawn interval shrinks with `elapsed` down to a minimum of 0.7 s.
- **Stamina** clamps between 0 and 100. The low-stamina sound fires once per threshold crossing, gated by `lowPlayed`.
- **Screen overlays** (`.screen` class) sit at `z-index: 20` above the canvas; the rotate overlay is `z-index: 100`.
- CSS custom properties for the color palette live in `:root` in `style.css` (`--purple-deep`, `--gold`, `--teal`, `--burgundy`, etc.).
