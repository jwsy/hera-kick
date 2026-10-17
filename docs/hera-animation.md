# Hera animation art

Generated with the built-in imagegen tool. Sources are retained for reproducible atlas packing; `node tools/pack-hera-sprites.mjs` requires ImageMagick (`magick`). The script crops and registers poses, resizes with nearest-neighbor sampling, thresholds alpha, removes detached specks smaller than four pixels, and packs the transparent atlas.

## Runtime and validation

Gameplay captures at native canvas scale: [run poses](hera-run-preview.png), [jump and kick poses](hera-actions-preview.png).

- `hera-sheet.png`: eighteen 192 × 144 cells, four columns by five rows (last two cells empty). Shared torso x anchor 108, ground y anchor 132; approximately 122px standing height. No background, guides, or embedded impact flash.
- Twelve run frames: contact, passing and flight for each half-stride, with an intermediate frame between each. Both contact-to-passing transitions reuse the forward weight-transfer silhouette to keep the support foot moving continuously backward. Cadence remains 2.2 to 3.3 cycles/second with world speed. No full-sprite rotation, squash, blending, or bouncing.
- Jump: 85ms takeoff, tucked ascent through the apex, reaching descent once vertical velocity exceeds 90px/s, and an 85ms planted landing pose. These timers only select artwork.
- Kick: up to 70ms anticipation BEFORE predicted hitbox contact, then 160ms extension and 120ms recovery. Anticipation considers vertical movement during jumps and has no gameplay effects. Extension, existing impact particles, score and sound all start on the collision frame; unexpected contacts also extend immediately.
- The existing debug screen previews all eighteen frames. `sw.js` cache version is bumped so installed games receive the new atlas and code together.
- Checked in the local running game at 960 × 588 (960 × 540 canvas below the HUD) and 960 × 540 viewport. Captured actual run frames and a keyboard jump, inspected all action phases, and checked collision scoring, pause freezing, tap/full-charge velocities and landing. Also checked JavaScript syntax, frame bounds, alpha and the diff. Follow-up kick checks at 60, 30 and 20 updates/second confirm immediate extension/particles and exactly 25 bonus points on contact, no score during anticipation, no windup for vertically separated enemies, and immediate extension for unexpected overlaps.
- Remaining visual limits: cape/hair shapes change slightly between poses. At full jump charge the crown can leave the top of the canvas (about 22px at 60Hz), inherited from the existing jump height and 122px artwork; physics and viewport are preserved.

## Run intermediate-pose prompt

Use case: identity-preserve. Edit target/reference: attached six-frame Hera run atlas. Create SIX intermediate animation poses to be inserted BETWEEN the existing six poses, in a matching 3-column 2-row atlas. Keep EXACT same Hera face, pointed crown, brown hair, red dress, gold sandals/bracers, teal peacock cape, pixel style and proportions. Do not redesign or enlarge her head. These are subtle in-between positions; do not repeat the existing extremes.
Keep the head and torso in EXACT same position/angle as in each corresponding reference cell. Crown at same height, same full standing height as reference. Only legs/skirt/arms/cape move slightly toward the NEXT pose.
Cell1: midway from reference cell1 split contact to cell2 passing: planted front leg drawing backward toward under hips, knee slightly bent, trailing heel folding upward.
Cell2: midway from reference cell2 passing to cell3 long airborne split: stance heel lifting and pushing backward, opposite thigh swinging forward, front knee bent about 90 degrees, toes off ground.
Cell3: midway from reference cell3 airborne split to cell4 contact: front leg stretching down to ground, back heel folding up, flight about to land.
Cell4: midway from reference cell4 contact to cell5 high-knee passing: front planted foot halfway toward torso, other knee swinging forward, skirt lifting a little.
Cell5: midway from reference cell5 passing to cell6 tucked flight: stance knee bending, heel lifting backward, front knee high.
Cell6: midway from reference cell6 tucked flight back to reference cell1 contact: front lower leg extends diagonally forward and downward, back leg unfolds diagonally back, feet just above ground.
Same forward running lean and upright head. No head bob or nod. Arms and cape halfway between corresponding reference poses. All face right. Full bodies, same scale across frames, transparent padding. GENUINE transparent alpha background, no glow, no shadows, no ground, no grid, no labels, no text, no duplicate ghost limbs, crisp pixel edges.

## Initial prompt

Use case: identity-preserve. Asset type: production transparent pixel-art sprite atlas for Hera Runner.
Input 1 (hera-sheet.png) is the CHARACTER IDENTITY and pixel style reference; input 2 (IMG_5383.png) is ONLY motion inspiration. Preserve input 1's recognizable adult Hera: same expressive profile face, long wavy auburn/brown hair, gold crown and teal jewel, RED burgundy dress with gold trim and belt, gold sandals/bracers, teal peacock feather cape with gold eye spots. Do NOT adopt input 2's chibi proportions or purple outfit. Face right in every frame. Crisp 16-bit pixel art, dark outlines, readable clusters at 122px character height.
Replace the atlas with exactly 12 full-body poses in a regular 4-column by 3-row grid on genuinely transparent alpha, no text, no lines, no ground, no shadows, no props, no sparks, no blur. Each cell same size, generous transparent gutters, consistent character scale, crown and torso centered at same x coordinate within each cell, consistent crown height and ground baseline. Cape trails left, feet point right. No scepter in action poses so arms can pump.
Row 1 RUN first half: (1) right foot contact forward with left leg extended back; (2) right stance leg under hips, left knee passing forward bent; (3) airborne right push-off, left knee high and right heel folded back; (4) left foot forward contact, right leg back.
Row 2: (1) RUN left stance leg under hips, right knee passing; (2) RUN airborne left push-off, right knee high, left heel folded back; (3) JUMP takeoff, both legs extending down, arms bent upward; (4) JUMP ascent, both knees tucked visibly, cape sweeping downward and backward.
Row 3: (1) JUMP descent, legs reaching down for landing, cape lifted behind; (2) KICK windup, support foot directly beneath torso, kicking knee drawn up at waist, hands guarding; (3) KICK full extension, support foot at SAME location under torso, kicking leg straight horizontally right with gold sandal clearly defined, torso vertical, cape fans left; (4) KICK recovery, knee retracting, support foot same anchor. The kick must contain NO baked-in impact flash.
Run poses must be six actually different limb configurations, not translated or squashed duplicates. Open split in flowing skirt exposes lower legs/sandals enough to read stride without shortening the long red dress identity. Head and torso size identical across all 12 frames. Export the atlas as a transparent PNG.

## Run refinement prompt

Use case: identity-preserve. Edit target: first image, a transparent Hera animation atlas. Second image is original Hera identity reference. Refine only the RUN poses in the first six cells and crown on all figures; preserve the remaining jump/kick poses, face, scale, palette and clean transparent alpha.
CRITICAL running biomechanics: six DIFFERENT poses in first 6 cells in reading order. Run 1 (row1 col1): long split stride, front leg reaches diagonally RIGHT, heel at ground; rear leg stretches LEFT with toe at ground. Run 2 (row1 col2): planted leg VERTICAL DOWN below hip, foot under torso touching ground, other thigh horizontal RIGHT with bent knee and shin folded back. Run 3 (row1 col3): flight with BOTH feet off ground, front leg starting to reach forward and rear foot tucked high behind. Run 4 (row1 col4): OPPOSITE leg contact, near leg straight diagonally BACK LEFT, far leg visible forward RIGHT; swap arm swing too. Run 5 (row2 col1): opposite passing, near stance leg vertical directly BELOW hip, far knee raised FORWARD RIGHT; visibly open gap between legs. Run 6 (row2 col2): opposite flight, near knee high in FRONT, far leg tucked BACK, both sandals off ground. Do not copy-paste run 1 into run 4 or run 5. The leg geometry and red skirt folds MUST differ.
Crown: add recognizable small gold crown points above the gold band consistent with original reference; preserve teal center jewel. Same expressive adult profile face, brown wavy hair, long red split dress gold hem, teal peacock feather cape, gold sandals. 16-bit pixel clusters, no new details.
Exactly 4 columns and 3 rows. Same scale on all characters, same head positions relative to cells, consistent full 300px standing height, head size unchanged. Ground contact baseline same relative cell height across all run and kick poses; airborne feet lift above that invisible baseline. Transparent padding around each isolated full-body sprite; absolutely no text, background, ground lines, guides, shadows, impact sparks, or props.

## Final running prompt

Use case: identity-preserve. Production transparent pixel-art RUN CYCLE for Hera from attached reference. Exactly SIX sprites, 3 columns by 2 rows. Adult expressive right-facing Hera, SAME face, brown wavy hair, pointed gold crown teal jewel, red burgundy dress gold trim/belt, gold sandals and bracers, teal/gold peacock cape. Preserve character. No staff.
This is FAST RUNNING with a forward torso lean, elbows pumping and a wide split stride, NOT walking or marching. Keep head upright at a fixed height and x coordinate relative to torso in all 6 frames: no nodding, no rotation of face, no growing/shrinking. Cape streams backward horizontally. Red skirt flares with action but maintains dress identity.
ANIMATION ORDER:
Top left 1: near leg forward landing with heel down, far leg stretched far BACK LEFT toe lifted, near arm BACK with fist near rear hip, far arm FORWARD.
Top middle 2: near leg straight vertical stance under hip, far knee passing toward right with bent shin tucked, arms passing torso.
Top right 3: BOTH FEET AIRBORNE, near leg extended diagonally BACK LEFT almost straight, far leg reaching FORWARD RIGHT, front arm pumping forward. Clear long airborne split with both sandals above contact baseline.
Bottom left 4: near leg stretched BACK LEFT (visible below skirt), FAR leg lands ahead RIGHT; near arm FORWARD with bent elbow, far arm BACK. This is opposite contact from top left, clearly different silhouette and folds.
Bottom middle 5: FAR leg straight vertical stance below hip, NEAR knee high FORWARD right with shin tucked; near arm back.
Bottom right 6: BOTH FEET AIRBORNE, NEAR knee high FORWARD with shin starting to extend right, far heel folded up behind. Compact fast flight.
Each pose should read as running at 122px tall. Expose enough gold sandals/lower legs under the split red skirt to read the actual leg positions. Six unique limb poses. Strong crisp pixel clusters dark outline and limited shading, no painterly blur. Match reference rather than chibi.
Same head size/face/height in all six. Same ground baseline and torso x position in every cell. Transparent alpha, no ground shadow, no text, no grid or guide lines, no effects. Full bodies with padding, keep cape in frame.

## Run alpha cleanup prompt

Use case: background-extraction. Edit target: this exact six-frame Hera run sprite atlas. Remove ALL background including the brown gradient, black backdrop, teal glow, gold glow, shadow and ground. Replace all pixels outside the six character silhouettes with genuine fully transparent alpha. Preserve the character art, all 6 poses, scale, positions, face, crown, red dress, gold sandals, teal feather cape and crisp pixel edges exactly. No changes inside the silhouettes. No remaining halos, shadows, checkerboard, grid lines or text. PNG with true transparent background, isolated six full-body character sprites.

## Kick refinement prompt

Use case: identity-preserve. Asset type: transparent Hera kick sprite strip. Reference: supplied Hera atlas. Create exactly THREE separate full-body sprites in ONE HORIZONTAL ROW on genuine transparent background. Use the SAME adult Hera character in the BOTTOM ROW of the reference: expressive right-facing face, gold pointed crown with teal jewel, long brown wavy hair, red burgundy split dress with gold belt and hem, gold sandals and bracers, teal/gold peacock cape.
Three frames: 1 WINDUP with near knee raised tightly to waist and shin tucked back, 2 EXTENSION with same near leg straight horizontally right at waist height, 3 RECOVERY with near knee bent halfway back. In ALL THREE: far supporting leg completely vertical, supporting sandal flat on ground directly beneath torso; crown, face, torso and supporting foot occupy IDENTICAL coordinates relative to cell. Use the EXTENSION pose from the bottom row third column of reference as the exact body/face/support-foot position for all 3 poses. Keep arms/upper body locked except a tiny hand movement. Head cannot move, rotate, or resize. Dress and cape only change enough to accommodate the kicking leg. Preserve same gold crown face hair and scale.
Make poses distinct in leg geometry. Pixel-art with crisp dark outline matching reference. All face right. Exactly three equal width cells, generous margins and transparent gutters, no clipping. No impact effect/sparks, no ground or shadows, NO guide lines, NO text, NO scepter, NO background.
