# Bull and peacock artwork

[Current gameplay preview](creature-preview.png)

- Bull: rebuilt from the white Zeus disguise in `sprites-init.png`, restoring the unobscured muzzle, scowl, white muscular torso, gold horns/cuffs and cloven hooves. Two charging poses at 152 × 152px (previously 67 × 84px); about 25% taller than Hera's 122px standing art.
- Peacock: redrawn from the concept art facing left in two strut frames, at 88 × 119px (about 70% larger than the original 52 × 70px). Feet stay on the ground and the pickup glint follows the enlarged fan.
- Runtime asset: `assets/sprites/ground-sheet.png`, transparent and packed at display resolution. `assets/sprites/enemies-sheet.png` is unchanged; cloud and Hera retain their existing art. The eagle and swan now share the redrawn atlas; see [eagle and swan update](eagle-swan-art.md).
- Regenerate with `node tools/pack-ground-sprites.mjs` (ImageMagick 7). The bull source is `assets/sprites/bull-source.png`; the peacock source is `assets/sprites/peacock-source.png`.
- Rendering preserves the original collision boxes. The bull's leading edge is registered to its existing collision edge; extra width trails behind. Offscreen removal accounts for enlarged artwork. Existing kick scoring and multiplication pickups were checked in the browser; the game-size preview was inspected at a 960 × 540 canvas. Service-worker cache v16 includes the current assets.

## Bull generation prompt

Generated using the built-in imagegen tool, with `sprites-init.png` as the identity reference.

Use case: identity-preserve / precise-object-edit. Asset type: transparent two-frame pixel-art sprite strip for Hera Runner.
Reference image is sprites-init.png. Reconstruct ONLY the WHITE BULL Zeus disguise in the middle row at far right under AS BULL. Preserve THAT original design: angry cream-white bull with big gold upward curving horns, strong dark scowling eyebrows, yellow eyes, broad cream muzzle and pinkish nose, massive muscular shoulders, rounded heavy chest, bent muscular arms with clenched fists, gold wrist cuffs, short powerful bovine legs and brown cloven hooves. Three-quarter view facing LEFT toward Hera. Original is a stylized upright muscular bull; preserve this anatomy and personality. Do not turn him into a generic four-legged cow. No clothes, weapons, armor, or extra props. Keep the original chunky 16-bit pixel-art outlines, white/ivory/light tan shading and gold accents.
Remove Hera, her leg, ALL impact sparks/lightning and restore the obscured muzzle and near arm naturally. Show the whole bull unobstructed, both horns, both arms, both feet.
Make TWO poses in one horizontal strip on genuine transparent alpha, equal size cells, padding between. Frame1 grounded charging stride, left-facing head lowered slightly, broad shoulders, one hoof forward; frame2 passing stride with feet exchanging weight, small compression in legs, head/shoulders nearly fixed. Maintain identical bull size, face, horn shape and torso registration between frames; no head wobble, no growth. Full body. Heavy sturdy silhouette whose shoulder bulk and horns will look larger than Hera when displayed about 150px tall by 135px wide.
Crisp pixel clusters readable at game size, no smooth vector rendering. NO text, no title, no frame borders, no guidelines, no floor, no shadows, no background, no glow, no sparks. Transparent PNG.
