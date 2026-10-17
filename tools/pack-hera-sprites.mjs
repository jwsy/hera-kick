// Repack generated poses without repainting them. Requires ImageMagick 7.
// All frames share a 192 x 144 cell, torso anchor x=108 and ground y=132.
// Source anchors follow the face/torso, never the moving running feet.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'hera-atlas-'));
const run = 'hera-run-source.png', jump = 'hera-poses-source.png', kick = 'hera-kick-source.png';
const between = 'hera-run-between-source.png';
// [source, crop x/y/w/h, body x, crown y, scale]. Crown rests at y=10.
// Grounded poses normalize to the same 122px standing height. Flight poses
// retain their lifted feet; they must not be bottom-aligned independently.
const poses = [
  [run, 0, 0, 510, 515, 340, 79, 122 / 415],
  [run, 510, 0, 480, 515, 799, 78, 122 / 423],
  [run, 990, 0, 546, 515, 1327, 78, 0.29],
  [run, 0, 515, 510, 509, 340, 536, 122 / 422],
  [run, 510, 515, 480, 509, 809, 534, 122 / 428],
  [run, 990, 515, 546, 509, 1336, 535, 0.29],
  [jump, 724, 380, 362, 330, 941, 399, 0.39],
  [jump, 1086, 380, 362, 330, 1335, 406, 0.39],
  [jump, 0, 710, 362, 376, 238, 715, 122 / 327],
  [kick, 0, 0, 700, 724, 523, 63, 122 / 618],
  [kick, 700, 0, 774, 724, 1110, 63, 122 / 618],
  [kick, 1474, 0, 698, 724, 1839, 62, 122 / 619],
  [between, 0, 0, 510, 515, 343, 78, 0.29],
  [between, 510, 0, 480, 515, 810, 78, 0.29],
  [between, 990, 0, 546, 515, 1329, 78, 0.29],
  // Both contacts have the same skirt-facing silhouette. Reuse the forward
  // weight-transfer pose here; the generated fourth pose put the support
  // foot behind the hip too early and made it jump backward, then forward.
  [between, 0, 0, 510, 515, 343, 78, 0.29],
  [between, 510, 515, 480, 509, 818, 534, 0.29],
  [between, 990, 515, 546, 509, 1340, 535, 0.29],
];
try {
  const cells = poses.map(([source, x, y, w, h, ax, top, scale], i) => {
    const sprite = join(tmp, `${i}-crop.png`), cell = join(tmp, `${i}.png`);
    const sw = Math.round(w * scale), sh = Math.round(h * scale);
    execFileSync('magick', [join(root, 'assets/sprites', source), '-crop', `${w}x${h}+${x}+${y}`,
      '+repage', '-filter', 'point', '-resize', `${sw}x${sh}!`,
      '-channel', 'A', '-threshold', '50%', '+channel', sprite]);
    // Reject detached generation specks after downsampling; preserve real
    // silhouette islands (including crown points) of at least four pixels.
    const rgba = execFileSync('magick', [sprite, '-depth', '8', 'rgba:-']);
    const seen = new Uint8Array(sw * sh);
    for (let p = 0; p < seen.length; p++) {
      if (seen[p] || !rgba[p * 4 + 3]) continue;
      const component = [p]; seen[p] = 1;
      for (let n = 0; n < component.length; n++) {
        const q = component[n], qx = q % sw, qy = Math.floor(q / sw);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x1 = qx + dx, y1 = qy + dy, next = y1 * sw + x1;
          if (x1 < 0 || x1 >= sw || y1 < 0 || y1 >= sh || seen[next] || !rgba[next * 4 + 3]) continue;
          seen[next] = 1; component.push(next);
        }
      }
      if (component.length < 4) for (const q of component) rgba[q * 4 + 3] = 0;
    }
    execFileSync('magick', ['-size', `${sw}x${sh}`, '-depth', '8', 'rgba:-', sprite], { input: rgba });
    const dx = Math.round(108 - (ax - x) * sw / w);
    const dy = Math.round(10 - (top - y) * sh / h);
    const offset = n => n < 0 ? `${n}` : `+${n}`;
    execFileSync('magick', ['-size', '192x144', 'xc:none', sprite,
      '-geometry', `${offset(dx)}${offset(dy)}`, '-compose', 'Over', '-composite', cell]);
    return cell;
  });
  execFileSync('magick', ['montage', ...cells, '-tile', '4x5', '-geometry', '192x144+0+0',
    '-background', 'none', join(root, 'assets/sprites/hera-sheet.png')]);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
