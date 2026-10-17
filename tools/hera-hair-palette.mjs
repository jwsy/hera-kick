// Apply the darker plum palette from hera-hair-color-reference.png after packing.
// Original source art is retained. Only upper-frame burgundy hair colors change;
// pixels, alpha, frame dimensions and anchors remain identical.
import { execFileSync } from 'node:child_process';

export function applyHeraHairPalette(path) {
  const [w, h] = execFileSync('magick', ['identify', '-format', '%w %h', path])
    .toString().split(' ').map(Number);
  const rgba = execFileSync('magick', [path, '-depth', '8', 'rgba:-'], { maxBuffer: 16e6 });
  for (let y = 0; y < h; y++) {
    if (y % 144 > 85) continue;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      // Hair has muted burgundy shading; dress reds are more saturated,
      // skin/gold have higher green, and teal has higher green/blue than red.
      if (!rgba[i + 3] || r < 35 || r > 205 || r < g * 1.4 || g > r * 0.6
          || b < r * 0.27 || b < g * 0.8 || b > r * 0.65) continue;
      rgba[i] = Math.round(r * 0.48);
      rgba[i + 1] = Math.round(g * 0.64 + 7);
      rgba[i + 2] = Math.round(b * 0.85 + 14);
    }
  }
  execFileSync('magick', ['-size', `${w}x${h}`, '-depth', '8', 'rgba:-', path], { input: rgba });
}
