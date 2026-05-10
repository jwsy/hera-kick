# Hera Runner

A mythic endless runner with multiplication practice. Hera sprints across Olympus, kicking Zeus's disguises and answering math questions to keep her stamina up.

Play it at: `index.html` — no build step, no server required beyond basic static file hosting.

## How to Play

- **Jump** — tap, click, or press Space
- **Answer questions** — tap one of the four answer buttons when a peacock triggers a quiz
- **Goal** — keep stamina from hitting zero as long as possible

### Scoring

| Action | Points |
|---|---|
| Surviving | 1 pt/sec |
| Kicking a Zeus disguise | 25 pts |
| Correct multiplication answer | 50 pts |

### Stamina

Stamina drains at 3 per second. Correct answers restore 20; wrong answers cost 15. The run ends at zero.

### Factor Range

On the start screen, choose your multiplication table range (default 5–9). Your preference is saved between sessions.

## Running Locally

Open `index.html` in any modern browser. For PWA features (offline support, install prompt), serve from a local HTTP server:

```sh
# Python
python3 -m http.server 8000

# Node
npx serve .
```

Then visit `http://localhost:8000`.

## Project Structure

```
hera-kick/
├── index.html          # App shell and all screens
├── style.css           # Layout and visual theme
├── app.js              # All game logic (single file, no dependencies)
├── manifest.json       # PWA manifest
├── sw.js               # Service worker for offline caching
└── assets/
    ├── icons/          # PWA icons (192×192, 512×512)
    └── sprites/        # Hera spritesheet
```

No framework, no bundler, no backend. Everything runs in the browser from a single page.

## PWA Support

After your first online visit, the service worker caches the app shell and core assets. Subsequent loads work offline. The app can be installed from the browser's "Add to Home Screen" prompt on mobile or the install icon in desktop browsers.

The manifest sets `orientation: landscape` — on mobile, play in landscape mode. Portrait view shows a rotate prompt.

## Local Storage Keys

| Key | Purpose |
|---|---|
| `heraRunner.minFactor` | Saved minimum factor |
| `heraRunner.maxFactor` | Saved maximum factor |
| `heraRunner.bestScore` | All-time best score |
| `heraRunner.soundEnabled` | Sound on/off preference |

## License

See [LICENSE](LICENSE).
