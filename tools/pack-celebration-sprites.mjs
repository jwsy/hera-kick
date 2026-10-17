// Pack the reward poses with stable floor/torso anchors. Requires ImageMagick 7.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyHeraHairPalette } from './hera-hair-palette.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets/sprites');
const tmp = mkdtempSync(join(tmpdir(), 'hera-reward-'));
const magick = args => execFileSync('magick', args);
try {
  for (let i = 0; i < 2; i++) {
    const x = i ? 1035 : 0, w = i ? 739 : 1035;
    const body = i ? 383 : 575, scale = 122 / 783;
    const crop = join(tmp, `hera${i}.png`);
    magick([join(assets, 'hera-celebration-source.png'), '-crop', `${w}x887+${x}+0`,
      '+repage', '-filter', 'point', '-resize', `${Math.round(w * scale)}x${Math.round(887 * scale)}!`,
      '-channel', 'A', '-threshold', '50%', '+channel', crop]);
    magick(['-size', '192x144', 'xc:none', crop, '-geometry',
      `+${Math.round(108 - body * scale)}+${Math.round(10 - 54 * scale)}`,
      '-composite', join(tmp, `hera-cell${i}.png`)]);
    magick([join(assets, 'peacock-celebration-source.png'), '-crop', `${i ? 874 : 900}x887+${i ? 900 : 0}+0`,
      '+repage', '-channel', 'A', '-threshold', '50%', '+channel', '-trim', '+repage',
      '-filter', 'point', '-resize', '120x110', '-gravity', 'center', '-background', 'none',
      '-extent', '128x128', join(tmp, `bird-cell${i}.png`)]);
  }
  for (const [name, prefix] of [['hera', 'hera'], ['peacock', 'bird']]) {
    magick([join(tmp, `${prefix}-cell0.png`), join(tmp, `${prefix}-cell1.png`), '+append',
      join(assets, `${name}-celebration.png`)]);
  }
  // Drawn turn views: normalize height and register the planted ankles/body,
  // not the changing cape/fan silhouette. Final cell is the victory pose.
  const specs = [
    { name: 'hera', cw: 192, ch: 144, height: 122, ax: 108, top: 10,
      pivots: [260, 700, 1140, 1558, 205, 640, 1088, 1563], prefix: 'hera' },
    { name: 'peacock', cw: 144, ch: 128, height: 110, ax: 72, top: 9,
      pivots: [214, 625, 1090, 1535, 240, 700, 1120, 1535], prefix: 'bird' },
  ];
  for (const spec of specs) {
    const source = join(assets, `${spec.name}-turn-source.png`);
    const size = execFileSync('magick', ['identify', '-format', '%w %h', source]).toString().split(' ').map(Number);
    const cells = [];
    for (let i = 0; i < 8; i++) {
      const col = i % 4, row = Math.floor(i / 4);
      const x = Math.round(col * size[0] / 4), y = Math.round(row * size[1] / 2);
      const w = Math.round((col + 1) * size[0] / 4) - x;
      const h = Math.round((row + 1) * size[1] / 2) - y;
      const crop = join(tmp, `${spec.name}-turn${i}.png`);
      magick([source, '-crop', `${w}x${h}+${x}+${y}`, '+repage',
        '-channel', 'A', '-threshold', '50%', '+channel', crop]);
      const bounds = execFileSync('magick', [crop, '-trim', '-format', '%w %h %X %Y', 'info:'])
        .toString().split(' ').map(Number);
      const scale = spec.height / bounds[1];
      const sw = Math.round(w * scale), sh = Math.round(h * scale);
      magick([crop, '-filter', 'point', '-resize', `${sw}x${sh}!`, crop]);
      // Some source cells include a detached tip from the adjacent wing.
      // Remove small border islands while preserving the main silhouette.
      const rgba = execFileSync('magick', [crop, '-depth', '8', 'rgba:-']);
      const seen = new Uint8Array(sw * sh), components = [];
      for (let p = 0; p < seen.length; p++) {
        if (seen[p] || !rgba[p * 4 + 3]) continue;
        const pixels = [p]; seen[p] = 1;
        let border = false;
        for (let j = 0; j < pixels.length; j++) {
          const q = pixels[j], qx = q % sw, qy = Math.floor(q / sw);
          if (qx === 0 || qx === sw - 1 || qy === 0 || qy === sh - 1) border = true;
          for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
            const nx = qx + ox, ny = qy + oy;
            if (nx < 0 || nx >= sw || ny < 0 || ny >= sh) continue;
            const n = ny * sw + nx;
            if (!seen[n] && rgba[n * 4 + 3]) { seen[n] = 1; pixels.push(n); }
          }
        }
        components.push({ pixels, border });
      }
      const largest = Math.max(...components.map(c => c.pixels.length));
      for (const c of components) {
        if (c.pixels.length < 3 || (c.border && c.pixels.length < largest / 3)) {
          for (const p of c.pixels) rgba[p * 4 + 3] = 0;
        }
      }
      execFileSync('magick', ['-size', `${sw}x${sh}`, '-depth', '8', 'rgba:-', crop], { input: rgba });
      const dx = Math.round(spec.ax - (spec.pivots[i] - x) * scale);
      const dy = Math.round(spec.top - bounds[3] * scale);
      const cell = join(tmp, `${spec.name}-turn-cell${i}.png`);
      magick(['-size', `${spec.cw}x${spec.ch}`, 'xc:none', crop,
        '-geometry', `${dx >= 0 ? '+' : ''}${dx}${dy >= 0 ? '+' : ''}${dy}`, '-composite', cell]);
      cells.push(cell);
    }
    const final = join(tmp, `${spec.name}-victory.png`);
    magick([join(tmp, `${spec.prefix}-cell1.png`), '-gravity', 'center', '-background', 'none',
      '-extent', `${spec.cw}x${spec.ch}`, final]);
    magick([...cells, final, '+append', join(assets, `${spec.name}-turn-sheet.png`)]);
  }
  applyHeraHairPalette(join(assets, 'hera-celebration.png'));
  applyHeraHairPalette(join(assets, 'hera-turn-sheet.png'));
} finally { rmSync(tmp, { recursive: true, force: true }); }
