# Eagle and swan redraw

[Gameplay preview](creature-preview.png)

- Eagle: two flying poses with raised and lowered wings, tucked talons, and a stable head registration; 86 × 78px frames.
- Swan: two walking poses with folded wings and planted webbed feet; 88 × 84px frames. All swans spawn on the ground with a 75 × 75px entity box, like the bull, and no flying bob.
- Both use the approved bull's dark outlines, warm ivory highlights, lavender shadows and gold details. Transparent source art: `assets/sprites/eagle-flight-source.png` and `assets/sprites/swan-source.png`.
- Packed into `assets/sprites/ground-sheet.png` with `node tools/pack-ground-sprites.mjs`. Updated frame definitions, swan spawning/rendering, and sprite culling in `app.js`; service-worker cache v15.
- Inspected both poses at the normal 960 × 540 canvas size. All 61 swans in a 250-spawn sample were grounded; a ground collision triggered the kick and awarded 25 points. Syntax and diff checks passed.
- Remaining limitation: both birds use two animation poses, so the wingbeat and walking motion are deliberately simple.

## Generation references

Built-in imagegen with `assets/sprites/bull-source.png` as the style reference and `sprites-init.png` as the character reference.

## Eagle prompt

Create a transparent production pixel-art sprite strip of TWO animation frames of the WHITE EAGLE Zeus disguise from reference 2. Reference 1 bull is the exact approved art style: crisp dark outlines, confident chunky pixel clusters, warm ivory highlights, lavender gray shadows, rich gold details, expressive angry gold eyes. Recreate eagle with that same polish. Face LEFT. Large proud hooked gold beak, stern brow, broad layered white feather chest, white wings, gold talons. Distinct eagle anatomy, no swan neck. Compact soaring pose with feet tucked, not standing upright. Frame1 wings raised, frame2 wings swept down. Same head and torso coordinates, size and angle in both frames. Two equal horizontal cells with generous gutters and full uncropped wings, same scale. Readable at 86x78 pixels. Match the bull's bold solid shapes and original eagle identity. No Hera, impact flash, accessories, labels, borders, guide lines, ground, shadows, glow or backdrop. Genuine transparent alpha PNG.

## Swan prompt

Create a transparent production pixel-art sprite strip of TWO animation frames of the WHITE SWAN Zeus disguise from reference2's middle row AS SWAN. Reference1 bull sets the exact approved style: confident dark outlines, chunky clean 16-bit pixel clusters, warm white highlights, pale lavender-gray shadows, rich golden beak accents, stern expressive eyes. Draw only the swan. Face LEFT in both frames. Recognizable elegant swan anatomy: long graceful S-curved white neck, small head with stern dark brow and golden eye, orange-gold beak with dark base, plump elongated white body, layered folded white wings, short gray-gold webbed feet. Not an eagle: no hooked raptor beak, no huge talons, no short neck. Preserve concept art personality and feathery white/lavender palette.
The swan WALKS ON LAND, never flying or swimming. Frame1 one webbed foot steps forward left while other supports body; frame2 opposite foot forward. BOTH frames at least one planted foot on same invisible ground baseline. Wings remain folded, neck/head and torso stable at identical scale and coordinates; subtle wing feather movement only. Exactly two full bodies side by side in equal cells with clean transparent gutters, all feather tips visible. Readable at about 80px tall. Match the bull artist's bold stylized shapes and clean detail.
No Hera, impact sparks, glow, water, ground line, shadow, backdrop, text, labels, grids, borders or props. Genuine transparent alpha PNG.
