// Pack the redrawn bull, peacock, eagle and swan at gameplay sizes.
// Requires ImageMagick 7; leaves the original enemy sheet untouched.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets/sprites');
const tmp = mkdtempSync(join(tmpdir(), 'hera-ground-'));
try {
  const sprites = [];
  for (let i = 0; i < 2; i++) {
    const path = join(tmp, `bull${i}.png`);
    execFileSync('magick', [join(assets, 'bull-source.png'),
      '-crop', `887x887+${i * 887}+0`, '+repage',
      '-channel', 'A', '-threshold', '50%', '+channel', '-trim', '+repage',
      '-filter', 'point', '-resize', '152x152!', path]);
    sprites.push([path, 2 + i * 154, 2]);
  }
  for (let i = 0; i < 2; i++) {
    const path = join(tmp, `peacock${i}.png`);
    execFileSync('magick', [join(assets, 'peacock-source.png'),
      '-crop', `768x1024+${i * 768}+0`, '+repage',
      '-channel', 'A', '-threshold', '50%', '+channel', '-trim', '+repage',
      '-filter', 'point', '-resize', '88x119!', path]);
    sprites.push([path, 310 + i * 90, 35]);
  }
  for (let i = 0; i < 2; i++) {
    const path = join(tmp, `eagle${i}.png`);
    // Register the head/torso, rather than trimming each wing pose to fit.
    // Both poses keep the same scale and talon baseline as the wings flap.
    const crop = join(tmp, `eagle-crop${i}.png`);
    execFileSync('magick', [join(assets, 'eagle-flight-source.png'),
      '-crop', `931x845+${i * 931}+0`, '+repage',
      '-channel', 'A', '-threshold', '50%', '+channel', crop]);
    execFileSync('magick', ['-size', '1042x845', 'xc:none', crop,
      '-geometry', `+${i * 111}+0`, '-compose', 'Over', '-composite',
      '-filter', 'point', '-resize', '86x78!', path]);
    sprites.push([path, 490 + i * 88, 2]);
  }
  for (let i = 0; i < 2; i++) {
    const path = join(tmp, `swan${i}.png`);
    // Shared neck registration and foot baseline across both walking poses.
    execFileSync('magick', [join(assets, 'swan-source.png'),
      '-crop', `770x744+${140 + i * 842}+90`, '+repage',
      '-channel', 'A', '-threshold', '50%', '+channel',
      '-filter', 'point', '-resize', '88x84!', path]);
    sprites.push([path, 666 + i * 90, 70]);
  }
  const args = ['-size', '846x156', 'xc:none'];
  for (const [path, x, y] of sprites) {
    args.push(path, '-geometry', `+${x}+${y}`, '-compose', 'Over', '-composite');
  }
  execFileSync('magick', [...args, join(assets, 'ground-sheet.png')]);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
