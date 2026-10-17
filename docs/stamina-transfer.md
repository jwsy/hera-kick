# Stamina transfer and peacock exit

[Gameplay preview](stamina-transfer-preview.png)

After the victory pose, the same 24 gold and teal sparkles leave Hera in staggered arcs, cross the game canvas edge, and land inside the stamina bar. A transparent viewport canvas sits above the game/HUD and below screen overlays, with pointer events disabled. Coordinates follow the displayed game canvas and stamina bar at any window size. The visual refill and glow begin as particles arrive; the actual capped reward is still applied once when the answer is accepted.

The peacock holds its pose, then uses four drawn wingbeat frames to fly fully off the left edge. There is no exit fade. The reward now lasts 2.9 seconds. Both effects follow the celebration clock, freeze when paused, and clear on completion or a new run. Cache version: v20.

Built-in imagegen created `assets/sprites/peacock-exit-source.png` using `peacock-celebration-source.png` as its reference. `node tools/pack-peacock-exit.mjs` (ImageMagick required) produces `assets/sprites/peacock-exit-sheet.png` with a stable head anchor and cleaned cell edges.

Validation: inspected the scene at 960×540; checked viewport-to-HUD alignment at960×588, 1200×900 and 740×400 window sizes, pause behavior, refill timing, complete leftward exit, and clearing the overlay. Syntax and whitespace checks passed.

## Generation prompt

Create a production transparent pixel-art sprite strip of FOUR animation frames in one horizontal row. Exact same teal peacock identity and chunky pixel style as reference. Flying toward LEFT in side / front-left three-quarter view, gold beak points left every frame. Blue teal head and long neck, white eye marking, head crest, emerald tail feathers with gold eyes swept behind it, golden feet tucked. Real wingbeat cycle: 1 both wings high upward, 2 wings open horizontal, 3 wings pressed downward below body, 4 recovering wings partially lifted. Same head/body anchor and size in each equal cell, generous gaps, all tips uncropped. Body tilted slightly forward for purposeful flight. Tail trails right, moderately folded fan suited to flight. Preserve same character palette and face. Four clearly distinct wing poses with consistent anatomy, no duplicate frames, no rotation or squashing of whole bird. No text grids labels floor shadows glow scenery or effects. Genuine transparent alpha.
