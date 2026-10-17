// Four wingbeat poses registered to the same eye/head position.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets/sprites');
const tmp = mkdtempSync(join(tmpdir(), 'peacock-exit-'));
const magick = args => execFileSync('magick', args);
try {
  const cells = [];
  for (let i = 0; i < 4; i++) {
    const crop = join(tmp, `crop${i}.png`), cell = join(tmp, `cell${i}.png`);
    magick([join(assets, 'peacock-exit-source.png'), '-crop', `543x724+${i * 543}+0`,
      '+repage', '-channel', 'A', '-threshold', '50%', '+channel', '-filter', 'point',
      '-resize', '117x156!', crop]);
    // Discard detached tips from neighboring source cells.
    const rgba = execFileSync('magick', [crop, '-depth', '8', 'rgba:-']);
    const seen = new Uint8Array(117 * 156), groups = [];
    for (let p = 0; p < seen.length; p++) {
      if (seen[p] || !rgba[p * 4 + 3]) continue;
      const group = [p]; seen[p] = 1;
      for (let j = 0; j < group.length; j++) {
        const q = group[j], x = q % 117, y = Math.floor(q / 117);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= 117 || ny < 0 || ny >= 156) continue;
          const n = ny * 117 + nx;
          if (!seen[n] && rgba[n * 4 + 3]) { seen[n] = 1; group.push(n); }
        }
      }
      groups.push(group);
    }
    const main = groups.reduce((a, b) => a.length > b.length ? a : b, []);
    for (const group of groups) if (group !== main) {
      for (const p of group) rgba[p * 4 + 3] = 0;
    }
    execFileSync('magick', ['-size', '117x156', '-depth', '8', 'rgba:-', crop], { input: rgba });
    const head = [108, 650, 1190, 1733][i] - i * 543;
    const dx = Math.round(44 - head * 117 / 543);
    magick(['-size', '160x160', 'xc:none', crop, '-geometry', `+${dx}-17`, '-composite', cell]);
    cells.push(cell);
  }
  magick([...cells, '+append', join(assets, 'peacock-exit-sheet.png')]);
} finally { rmSync(tmp, { recursive: true, force: true }); }
