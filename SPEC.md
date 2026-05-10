# Hera Runner SPEC

## Overview

Hera Runner is a static HTML5 PWA endless runner built with plain HTML, CSS, and JavaScript. The game is landscape-first and mobile-friendly. Hera runs automatically to the right while the player controls only jumping with tap, click, or spacebar.

The core loop combines arcade timing with multiplication practice:

- Hera automatically runs.
- Stamina drains over time.
- Zeus disguises approach from the right.
- Hera automatically kicks Zeus disguises when she reaches them.
- Peacocks trigger multiplication prompts.
- Correct answers restore stamina.
- Wrong answers reduce stamina.
- The run ends when stamina reaches zero.

The visual style should feel like a mythic 16-bit arcade game: deep purple skies, gold UI accents, teal peacock details, burgundy Hera costume, cloudy Olympus backgrounds, and temple stone platforms.

## Target Platform

The MVP is a static web app that can be hosted from any basic static server.

Primary targets:

- Mobile browsers in landscape orientation.
- Desktop browsers with keyboard support.
- Installed PWA mode after first visit.
- Offline loading after assets are cached by the service worker.

No build step is required for the MVP.

## File Structure

```text
hera-runner/
|-- index.html
|-- style.css
|-- app.js
|-- manifest.json
|-- sw.js
|-- assets/
|   |-- icons/
|   |   |-- icon-192.png
|   |   `-- icon-512.png
|   |-- sprites/
|   |   |-- hera-spritesheet.png
|   |   |-- zeus-eagle.png
|   |   |-- zeus-swan.png
|   |   |-- zeus-cloud.png
|   |   |-- zeus-bull.png
|   |   `-- peacock.png
|   |-- backgrounds/
|   |   |-- olympus-sky.png
|   |   `-- temple-ground.png
|   `-- audio/
|       |-- kick.wav
|       |-- correct.wav
|       |-- wrong.wav
|       `-- stamina-low.wav
`-- README.md
```

During early development, missing art or audio assets may be replaced by canvas-drawn placeholders. The final MVP should keep the same paths so caching, rendering, and documentation remain stable.

## PWA Requirements

### Manifest

`manifest.json` must define:

- `name`: `Hera Runner`
- `short_name`: `Hera`
- `display`: `standalone`
- `orientation`: `landscape`
- `start_url`: `/`
- `theme_color`: deep mythic purple
- `background_color`: dark purple
- Icons:
  - `assets/icons/icon-192.png`
  - `assets/icons/icon-512.png`

### Service Worker

`sw.js` must:

- Cache core app shell files during install:
  - `index.html`
  - `style.css`
  - `app.js`
  - `manifest.json`
  - required sprites
  - required icons
  - required backgrounds
  - core audio
- Clean old cache versions during activate.
- Use a cache-first strategy for known static assets.
- Fall back to network for uncached requests.
- Keep the app loadable offline after a successful first visit.

## Layout

The app uses one primary screen with layered UI:

```text
[Top HUD]
Score | Stamina Bar | Factor Range | Pause

[Game Canvas]
Hera on left/middle lane
Zeus disguises move right-to-left
Peacocks move right-to-left as collectibles

[Quiz Overlay]
Multiplication question
Four answer buttons
```

### Mobile

- Landscape is the preferred orientation.
- If the viewport is portrait, show a rotate-device overlay.
- Touching the game area while running triggers jump.
- Touching quiz answers selects an answer.

### Desktop

- Canvas scales to fit the browser window.
- Spacebar triggers jump.
- Mouse click or pointer tap selects quiz answers.

## Screens

### Loading

Used while assets are prepared.

Requirements:

- Show a loading state.
- Transition to the start screen when minimum assets are ready.
- If optional assets fail, continue with placeholders where practical.

### Start Screen

Elements:

- Title: `Hera Runner`
- Factor range picker
  - Default minimum factor: `5`
  - Default maximum factor: `9`
  - Minimum must not exceed maximum.
- Start button.
- Best score display when available.

Behavior:

- Start button initializes a new run.
- Factor range is saved to local storage.

### Running

Gameplay is active.

Behavior:

- Hera runs automatically.
- World objects scroll right-to-left.
- Stamina drains continuously.
- Enemies and peacocks spawn over time.
- Jump input applies upward velocity if Hera is grounded.
- Hera kicks enemies automatically on collision.
- Peacock collision opens the question overlay.

### Question

Gameplay timer is paused or slowed while the question is active.

Elements:

- Large multiplication question.
- Four answer buttons.

Behavior:

- Correct answer:
  - Restores stamina.
  - Adds bonus score.
  - Plays correct sound when sound is enabled.
  - Returns to running.
- Wrong answer:
  - Reduces stamina.
  - Plays wrong sound when sound is enabled.
  - Returns to running.

### Paused

Optional for MVP but included in the state model.

Behavior:

- Pauses timers, stamina drain, spawning, movement, and collision checks.
- Resume returns to running.

### Game Over

Elements:

- Final score.
- Best score.
- Restart button.

Behavior:

- Reaching zero stamina transitions to game over.
- Best score is updated in local storage.
- Restart begins a fresh run with the saved factor range.

## Game States

The app must use explicit game states:

```js
const GameState = {
  LOADING: "LOADING",
  START_SCREEN: "START_SCREEN",
  RUNNING: "RUNNING",
  QUESTION: "QUESTION",
  PAUSED: "PAUSED",
  GAME_OVER: "GAME_OVER"
};
```

State transitions should be centralized so input, rendering, and timers behave predictably.

## Core Systems

### Game Loop

Use `requestAnimationFrame`.

Each frame:

1. Calculate delta time.
2. Update game state if running.
3. Render background, ground, Hera, objects, effects, and HUD.
4. Skip movement and stamina drain when paused, loading, on start screen, in question state, or game over.

### Canvas Rendering

The canvas should use an internal logical resolution and scale to fit the viewport.

Recommended logical size:

```text
960 x 540
```

This supports 16:9 landscape while scaling cleanly on phones and desktops.

Rendering layers:

1. Olympus sky background.
2. Distant clouds or parallax details.
3. Temple ground.
4. Peacocks.
5. Zeus disguises.
6. Hera.
7. Kick effects.
8. HUD overlay.

### Hera

Hera remains mostly fixed horizontally, around the left third of the canvas.

Properties:

- `x`
- `y`
- `width`
- `height`
- `velocityY`
- `isGrounded`
- `animationState`
- `animationFrame`

Actions:

- Run.
- Jump.
- Kick.

Jump:

- Triggered by tap, pointer down, or spacebar.
- Only allowed when grounded.
- Uses gravity and vertical velocity.

Kick:

- Triggered automatically by collision with a Zeus disguise.
- Does not require player input.

### Zeus Disguises

Enemy types:

- Eagle
- Swan
- Cloud
- Bull

Properties:

- `type`
- `x`
- `y`
- `width`
- `height`
- `speed`
- `defeated`

Behavior:

- Spawn off the right side of the canvas.
- Move left based on world speed.
- On Hera collision:
  - Trigger Hera kick animation.
  - Remove enemy.
  - Add score.
  - Play kick sound when sound is enabled.
- If missed or passed, remove when off-screen.

### Peacocks

Properties:

- `x`
- `y`
- `width`
- `height`
- `speed`
- `collected`

Behavior:

- Spawn off the right side of the canvas.
- Move left based on world speed.
- On Hera collision:
  - Remove peacock.
  - Generate multiplication question.
  - Transition to `QUESTION`.
- If missed or passed, remove when off-screen.

### Spawning

Use timers based on elapsed running time.

MVP defaults:

- Enemy spawn interval: 1.5 to 3.0 seconds.
- Peacock spawn interval: 4.0 to 7.0 seconds.
- Avoid spawning a peacock and enemy at the same exact position.

Difficulty may increase gradually by:

- Raising world speed.
- Slightly reducing enemy spawn interval.
- Keeping peacock frequency fair enough that stamina recovery remains possible.

### Collision Detection

Use axis-aligned bounding boxes for MVP.

Rules:

- Hera + Zeus disguise:
  - Auto-kick.
  - Enemy defeated.
  - Score increases.
- Hera + Peacock:
  - Open multiplication prompt.
  - Pause gameplay timer.
- Hera misses Peacock:
  - No quiz.
  - Stamina keeps draining.

Future option:

- Jumping over Zeus avoids the enemy, while kicking gives more points.

### Stamina

Stamina is the run timer and survival resource.

Recommended values:

- Maximum stamina: `100`
- Starting stamina: `80`
- Drain per second: `3`
- Correct answer gain: `20`
- Wrong answer loss: `15`
- Low stamina warning threshold: `25`

Rules:

- Clamp stamina between `0` and `100`.
- When stamina reaches `0`, transition to `GAME_OVER`.
- Play stamina-low sound when crossing the low threshold if sound is enabled. Avoid repeating it every frame.

### Score

Score increases from:

- Surviving over time.
- Kicking Zeus disguises.
- Answering math questions correctly.

Recommended MVP values:

- Survival: `1` point per second.
- Zeus kick: `25` points.
- Correct answer bonus: `50` points.

Best score is saved to local storage.

## Multiplication System

### Factor Range

The player chooses:

- Minimum factor.
- Maximum factor.

Default range:

```text
5-9
```

Example questions:

- `5 x 7`
- `8 x 9`
- `6 x 6`

### Question Generation

Algorithm:

1. Choose factor A from selected range.
2. Choose factor B from selected range.
3. Calculate correct answer.
4. Generate three plausible wrong answers.
5. Shuffle all four choices.

Question object:

```js
{
  a: 7,
  b: 8,
  correct: 56,
  choices: [42, 48, 54, 56]
}
```

### Wrong Answer Generation

Wrong answers should be near the correct answer.

Strategies:

- Use nearby multiples of either factor.
- Add or subtract one selected factor.
- Add or subtract `10`.
- Avoid duplicates.
- Avoid negative values.
- Never include the correct answer as a wrong choice.

Example:

```text
Question: 6 x 8 = ?
Choices: 42, 48, 54, 56
```

## Input

### Running Input

Jump triggers:

- Spacebar.
- Pointer down on game canvas.
- Touch start on game canvas.

Ignore jump input when:

- Question overlay is open.
- Game is paused.
- Game is over.
- Start screen is active.

### Quiz Input

Answer triggers:

- Click.
- Pointer tap.
- Touch tap.

Keyboard number shortcuts are optional for MVP.

## Audio

Core sounds:

- `kick.wav`
- `correct.wav`
- `wrong.wav`
- `stamina-low.wav`

Rules:

- Audio should be optional.
- Sound on/off should be saved in local storage.
- The MVP may begin muted until the first user gesture to satisfy browser autoplay rules.

## Local Storage

Use local storage for:

- Preferred minimum factor.
- Preferred maximum factor.
- Best score.
- Sound enabled setting.

Suggested keys:

```text
heraRunner.minFactor
heraRunner.maxFactor
heraRunner.bestScore
heraRunner.soundEnabled
```

## Accessibility

The MVP should include:

- High-contrast quiz buttons.
- Large touch targets for answer choices.
- Keyboard support for jump.
- Visible focus styles for start, pause, restart, and answer buttons.
- Text alternatives for non-canvas controls.
- No reliance on color alone for stamina status.

## Performance

Targets:

- Smooth 60 FPS on modern mobile devices.
- Avoid unnecessary DOM updates during gameplay.
- Reuse object arrays where practical.
- Keep sprite assets reasonably small.
- Cache static assets through the service worker.

## MVP Acceptance Criteria

The MVP is complete when:

- The game loads from `index.html`.
- The app presents a start screen with factor range controls.
- The selected factor range affects generated questions.
- Hera runs automatically in a landscape canvas.
- Tap/click/spacebar makes Hera jump.
- Stamina drains during running.
- Zeus disguises spawn and move from right to left.
- Hera automatically kicks Zeus disguises on collision.
- Kicking enemies increases score.
- Peacocks spawn and move from right to left.
- Peacock collision opens a four-choice multiplication prompt.
- Correct answers restore stamina and add score.
- Wrong answers reduce stamina.
- Stamina reaching zero shows game over.
- Best score persists across reloads.
- The PWA manifest is valid.
- The service worker caches the app shell and core assets.
- The app can reload offline after the first successful online load.
- Portrait mobile view shows a rotate-device overlay.

## Nice-To-Have Later

- Boss Zeus mode.
- Unlockable Hera poses.
- Peacock companion power-up.
- Difficulty ramping by player performance.
- Expanded sound controls.
- High score leaderboard.
- More mythological enemies.
- Keyboard shortcuts for quiz answers.
- Sprite polish and additional kick effects.

## Implementation Notes

Keep the first implementation simple and static:

- No framework.
- No bundler.
- No backend.
- No external runtime dependencies.
- Prefer readable game-state code over premature abstraction.
- Use placeholder rendering when final assets are unavailable.
- Keep asset paths stable even if placeholders are used initially.
