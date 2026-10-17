# Olympus background refresh

[Gameplay preview](olympus-preview.png)

- Eagle and storm-cloud enemies render at 120% of their previous size (103 × 94px and 103 × 96px). Collision boxes and flight tiers are unchanged. Culling and cloud sparks follow the enlarged art.
- `assets/backgrounds/olympus.png`: distant twilight temples and mountains, rendered at 960 × 435px above the existing ground.
- `assets/backgrounds/sky-clouds.png`: three transparent cloud silhouettes, drifting on the existing cloud clock. Distant scenery stays fixed; clouds provide sky movement.
- Original generated images are saved alongside these as `olympus-source.png` and `sky-clouds-source.png`.
- `app.js` loads and draws both layers; `sw.js` caches them under v16.
- Visually inspected at normal gameplay size. No automated tests run.

## Asset preparation

ImageMagick commands (from repository root):

```sh
magick assets/backgrounds/olympus-source.png -filter point -resize '960x435!' assets/backgrounds/olympus.png
magick assets/backgrounds/sky-clouds-source.png -channel A -threshold 90% +channel -filter point -resize 768x512 assets/backgrounds/sky-clouds.png
```

The alpha threshold removes generated glow outside the cloud silhouettes.

## Generation

Built-in imagegen; approved `assets/sprites/bull-source.png` used as the style reference for both images.

### Backdrop prompt

Use case: stylized-concept. Create a wide 1920x870 background painting for a 960x435 pixel-art Greek mythology side-scrolling game. Reference image is STYLE ONLY: match its confident chunky 16-bit pixel clusters, warm gold highlights and lavender shadows, but use lower contrast background colors. Scene: Olympian twilight, deep indigo upper sky fading to dusty purple and muted teal near horizon; distant layered blue-violet mountains and elegant ancient Greek marble temples and terraces perched on cliffs in the LOWER third, atmospheric depth, sparse tiny gold stars. Upper two thirds mostly open dark sky to keep flying white enemies readable. Bottom quarter dark muted silhouettes to keep running characters readable. Horizontal side-view composition with broad open spaces, no central focal object. Refined pixel art, restrained palette, visible crisp pixel clusters, no smooth vector shapes or photorealism. No characters, animals, foreground floor, UI, text, moon, sun or large clouds (cloud sprites added separately). Full bleed opaque landscape.

### Sky-cloud prompt

Use case: stylized-concept. Transparent sprite atlas of three separate atmospheric SKY CLOUDS for a mythic Greek pixel-art game. Reference bull is STYLE ONLY: confident chunky 16-bit pixel clusters and lavender shaded sculptural forms. Three long horizontal wind-sculpted clouds arranged vertically with large transparent gaps, each entire cloud fully contained. Each has curled voluminous billows, stepped pixel edges, dusky lavender and muted blue-violet undersides, restrained pale mauve rim highlights. Low contrast twilight background scenery, NOT bright white enemy clouds. Different silhouettes: broad layered bank; slender wispy curling cloud; small rounded cumulus. No faces, eyes, lightning, animals, ground, text, lines, glow, borders. Genuine transparent alpha background, no painted backdrop. Crisp game-ready pixel art.
