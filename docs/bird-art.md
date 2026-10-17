# Peacock and eagle redraw

The eagle was subsequently replaced and the swan redrawn: see [eagle and swan update](eagle-swan-art.md).

[Gameplay preview](creature-preview.png)

Both birds were redrawn with the built-in imagegen tool, using `sprites-init.png` for character identity and `assets/sprites/bull-source.png` for the approved rendering style.

- Peacock faces **left** in both strut frames. Teal curved neck, crest, gold legs and an open emerald fan with clear gold-ringed eye spots follow the concept art. Keeps the enlarged 88 × 119px size.
- Eagle retains its white/ivory plumage, angry gold eyes, hooked gold beak and talons. Two distinct wingbeat poses share a stable head/torso registration. Its 78px height is preserved; 86px frame width accommodates the wings without squeezing the art.
- Peacock source: `assets/sprites/peacock-source.png`. Eagle source: `assets/sprites/eagle-flight-source.png`. Both packed into `assets/sprites/ground-sheet.png` by `node tools/pack-ground-sprites.mjs` (ImageMagick required). The bull's atlas pixels are unchanged.
- Frame definitions and atlas selection updated in `app.js`; current service-worker cache is v16. Collision boxes, movement, scoring and pickup behavior are preserved. Offscreen culling includes the eagle's extra wing width.
- Inspected both animation frames at normal canvas size; syntax/diff checks and collision/pickup checks passed.

## Peacock prompt

Use case: identity-preserve. Asset type: transparent two-frame PEACOCK sprite strip for Hera Runner.
Image1 is the character concept art: copy the PEACOCK at bottom center beside Hera's throne. Image2 (bull) is the approved pixel-art rendering style. Create ONLY this peacock, facing LEFT (beak pointing toward left edge) in BOTH frames. Preserve the concept peacock's teal/turquoise neck and rounded body, small teal head crest, friendly alert eye with white facial marking, short golden beak and golden legs, a tall broad OPEN FAN of dark emerald/teal feathers with neat gold-ringed dark eye spots. Elegant curved upright neck and layered folded wing. Tail fan fans upward BEHIND the body, showing approximately 15 clearly separated eye spots as in the concept. No accessories.
Render like the same artist who drew image2 bull: confident dark outlines, clean chunky 16-bit pixel clusters, carefully shaped highlights, restrained palette, readable broad shapes. Crisp pixel art, no blurred photo texture or noisy dithering. Must read beautifully at 88px wide x119px tall.
Exactly TWO full-body frames side by side in equal size cells, transparent alpha background. First is leftward strut with near foot slightly forward left, second is opposite strut with far foot forward left. Fan, head, neck and body positions and size remain almost identical; only legs/wing tips change subtly. Stable ground baseline, fan top and head alignment, generous transparent padding. Peacock is an elegant helpful collectible, NOT angry. Do NOT draw the bull or Hera.
NO ground, shadows, text, labels, guides, checkerboard, border, spark, glow, backdrop. Both birds must face LEFT.

## Eagle prompt

Use case: identity-preserve / style-transfer. Production transparent TWO-FRAME EAGLE sprite strip for Hera Runner.
Input1 is the APPROVED BULL sprite: match this artist's style exactly, same weight of dark brown-black pixel outlines, clean chunky 16-bit pixel clusters, warm ivory highlights, pale lavender-gray feather shadows, golden shading, expressive eyes. Input2 is original game concept art: character to recreate is Zeus AS EAGLE in middle row left, the white stout eagle with angry eyebrows, golden hooked beak, yellow eyes and yellow talons. Use original eagle identity, drawn with the clean muscular bull's polish.
Show ONLY a complete white/ivory EAGLE, facing LEFT in both poses. Proud broad chest, large rounded head, strong dark angry eyebrows, golden-yellow irises, clearly hooked gold beak, layered white feathers with soft lavender-gray shading, gold talons tucked slightly beneath body, small rear tail feathers pointing right. Entire eagle white, NOT brown bald-eagle body. Bird anatomy, no humanoid arms, no armor, no bull horns. No Hera, no impact sparks, no damage or occlusions.
Exactly two sprites side by side, equal cell sizes, same scale, head and torso at same location in each cell, transparent spacing. Frame1 wingbeat UP: near wing raised up-left beside body, far wing partly visible behind. Frame2 wingbeat DOWN: near wing fans outward/down-left; far wing lowers subtly. Head stays stable, feet stay about same height, only wings/feathers move. Wings stay compact enough that torso remains readable at 67x78px game size; do not produce a giant horizontal wingspan. Same maximum canvas envelope and centered torso registration in both frames. Full body with all wings/beak/talons visible. Crisp purposeful pixel edges; not noisy dithering, not vector-smooth.
Transparent alpha PNG with NO backdrop, glow, shadows, floor, text, labels, guides, frame lines, checkerboard or effects.
