# Hera hair palette

[Gameplay preview](darker-hair-preview.png)

Compared `sprites-init.png` and `assets/IMG_5383.png` with the current art. The running reference uses nearly black plum hair; the modern frames had brighter burgundy hair. All gameplay and celebration frames now use a darker plum palette with readable curl highlights.

The built-in imagegen tool produced `assets/sprites/hera-hair-color-reference.png` as the color reference. To preserve animation registration, `tools/hera-hair-palette.mjs` applies that color direction to the packed sheets without changing geometry or transparency. It selects muted burgundy hair colors in the upper part of each frame and retains the more saturated dress reds, gold, skin and teal palette. Original source art remains available.

Regenerate with `node tools/pack-hera-sprites.mjs` and `node tools/pack-celebration-sprites.mjs`. Both invoke the palette pass after packing. Outputs: `assets/sprites/hera-sheet.png`, `assets/sprites/hera-celebration.png`, and `assets/sprites/hera-turn-sheet.png`.

Validation: the gameplay atlas retained identical dimensions and every alpha pixel compared with the committed version. Inspected gameplay and victory art at 960×540. Cache version: v21.

## Color-reference prompt

Precise palette edit of image1 Hera celebration sprite strip. Change ONLY the burgundy hair color to the deep nearly-black plum hair palette of image2 original running reference. Preserve soft muted plum highlights so curls remain readable. Keep red dress red, skin, gold crown and jewelry, teal feather cape, eyes, poses, silhouette, exact frame composition unchanged. Transparent background. This is a hair-color reference for a pixel-preserving game palette pass: no redesign, no new poses or objects, no labels, no guide lines. Main hair dark plum #30202f, middle #493047, highlights muted plum #684159. Hair should read dark almost-black purple-brown rather than red.
