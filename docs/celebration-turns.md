# Drawn celebration turns

[Eight turn frames at gameplay size](celebration-turn-frames.png)

Hera and the peacock each have eight distinct directional drawings plus a victory pose. The 1.08-second turn advances through front, profile, rear and front views, returns to its starting direction, then settles into the raised-hand/raised-wing pose. The full reward lasts 2.9 seconds. Rendering uses unscaled, unrotated frame blits; hair, cape, wings and fan perspective are drawn into the frames.

Built-in imagegen created `assets/sprites/hera-turn-source.png` and `assets/sprites/peacock-turn-source.png`, using their respective celebration source art as identity/style references. Runtime assets are `assets/sprites/hera-turn-sheet.png` and `assets/sprites/peacock-turn-sheet.png`. Each sheet includes the existing final victory pose. Rebuild with `node tools/pack-celebration-sprites.mjs` (ImageMagick required). The packer registers Hera at her ankles and the bird at its body, normalizes height, and removes detached neighboring-cell fragments.

Service-worker cache: v20. Kicked enemies retain their separate tumble animation.

Validation: inspected all eight views at native gameplay size; confirmed frame order, pause behavior, and completion back to a grounded run in the browser. JavaScript syntax and diff whitespace checks passed.

## Hera generation prompt

Production sprite atlas for a real hand-drawn TURN animation of the exact Hera in reference. Transparent background. Exactly EIGHT frames arranged in a strict FOUR columns by TWO rows grid, each equal cell, one full-body Hera per cell. Same crown height, feet baseline, body center and scale in every cell. Preserve exact large-eyed face, gold crown, burgundy long hair, red dress, gold jewelry and sandals, teal peacock feather cape with gold eyes. Style same chunky polished pixel art. Her arms out gently and dress flared as she pivots upright about her vertical axis, NOT cartwheeling. Read left-to-right then second row: 1 front-right three-quarter (face to right); 2 full RIGHT PROFILE; 3 rear-right three-quarter (face mostly hidden); 4 FULL BACK VIEW (no face, back of hair and teal cape); 5 rear-left three-quarter (no frontal face); 6 full LEFT PROFILE; 7 front-left three-quarter; 8 FULL FRONT face looking at viewer, arms out. Each drawing genuinely shows different anatomy and occlusion around the turn. Hair and cape trail the movement and reveal back design. Do not mirror repeated front views, no compressed or rotated copies. All characters upright, same size, generous gutters each, everything contained within cell. NO letters numbers labels borders guide lines ground shadows particles or backdrop. This is a sprite sheet not a scene.

## Peacock generation prompt

Production transparent sprite atlas: EIGHT actually drawn directional frames of a turning flying PEACOCK, exactly FOUR columns by TWO rows, equal cells with generous transparent gutters. Use reference exact identity and polished chunky pixel style: teal blue neck, crest, gold beak, emerald fan with gold eye rings, spread turquoise wings and tucked gold feet. Hovering celebration pirouette around UPRIGHT vertical axis (NOT somersault). Same body scale, head height and body center in each cell. Ordered left-to-right top row then bottom: 1 front-left three-quarter (matching reference), 2 full LEFT PROFILE, tail seen edge-on behind it; 3 rear-left three-quarter, back of tail fan visible; 4 FULL BACK VIEW, no face or beak, back of green tail, wings spread; 5 rear-right three-quarter; 6 full RIGHT PROFILE, tail seen edge-on; 7 front-right three-quarter; 8 FULL FRONT, face centered, symmetrical spread wings. Real directional anatomy and depth: far wing hidden in profile, back of fan behind bird in rear views. Do not mirror duplicate poses or flatten a frontal fan into every frame. Gentle sequential wing strokes, legs tucked, open fan rotates with the body. Every full bird isolated uncropped within its own cell; no text labels guides borders glow ground shadows or backdrop. True transparent alpha.

The celebration finishes with a [sparkle transfer into the stamina bar and a leftward peacock flight](stamina-transfer.md).
