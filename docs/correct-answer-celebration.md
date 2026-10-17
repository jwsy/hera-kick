# Correct-answer celebration and flying collisions

[Reward preview](correct-answer-preview.png)

## Behavior

- Eagle and storm-cloud collision bounds follow their enlarged rendered sprites, with small border insets. Their contact checks include Hera's visible head above her logical body box. Kick anticipation uses the same bounds. Ground enemy hitboxes are unchanged.
- A correct answer restores the existing 20 stamina (capped at 100) and awards the existing 50 points. After answer feedback, a 2.9-second celebration freezes world movement and stamina drain. Hera twirls into a raised-hand pose while the collected peacock rises above her and mirrors the pose, then flies away.
- Gold and teal sparks, a gain label, and a glowing sweeping stamina meter highlight the reward. The meter interpolates to the actual capped amount. Wrong answers retain their existing penalty.
- Pausing freezes the celebration; a new run clears it. Jump input is held off during the reward. Hera returns to a grounded run afterward.
- Service-worker cache v20 includes the two new runtime sheets.

## Assets

Built-in imagegen created `assets/sprites/hera-celebration-source.png` from `hera-poses-source.png` and `assets/sprites/peacock-celebration-source.png` from `peacock-source.png`. Current runtime sheets: `assets/sprites/hera-turn-sheet.png` and `assets/sprites/peacock-turn-sheet.png`; see [drawn turn sequences](celebration-turns.md). The two-pose sheets are retained as packing intermediates. Repack with `node tools/pack-celebration-sprites.mjs` (ImageMagick 7 required).

## Validation

Browser checks covered head-level contacts and distant misses for both flyers, correct/incorrect answers, reward capping, frozen hazards and stamina, pause, restart and normal play resumption. The final pose was inspected at 960×540. JavaScript syntax and diff whitespace checks passed.

## Hera prompt

Create a transparent two-frame pixel-art sprite strip of THIS EXACT Hera character from reference, preserve same face proportions, large brown eyes, long burgundy hair, gold crown with teal jewel, red dress, gold sandals and jewelry, teal gold-eye peacock feather cape. Same chunky pixel style and outlines. TWO poses side by side equal cells generous gutters: first a graceful dance twirl with red skirt and teal cape fanning out around her hips, arms extended and feet planted close together, front three-quarter view; second a victorious pose facing right three-quarter, one arm raised joyfully overhead with open hand and other hand on hip, smiling confident, one straight support leg and one lightly bent, feet planted. Keep same body scale, crown height and floor baseline, full body uncropped. NO duplicate people within frames, no text guides ground shadows glow sparkles or scenery. Transparent alpha. Will display about122px crown-to-feet (raised hand may be higher); preserve exact reference identity.

## Peacock prompt

Transparent pixel-art sprite strip with TWO poses of the exact teal peacock from reference, same face crest gold beak legs green open fan of gold-ringed eyes and chunky pixels. Celebration flight: first pose both turquoise wings spread wide upward as it lifts off, feet tucked; second pose hovering joyfully with one wing raised like a triumphant wave and other wing extended, open emerald tail fan like a halo, feet tucked. Facing left three-quarter, same scale and head location, two equal side-by-side cells generous transparent gutters, uncropped. Preserve recognizable peacock identity. No ground glow text guides shadows or backdrop. Real transparent alpha. Readable at110px tall.

The celebration finishes with a [sparkle transfer into the stamina bar and a leftward peacock flight](stamina-transfer.md).
