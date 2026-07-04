# Regenerates assets/sprites/hera-sheet.png from the reference art sprites-init.png.
# Run from the repo root: python3 tools/build_hera.py
# Requires: pillow, numpy, scipy. Frame metadata is printed to stdout;
# paste it into the matching *_FRAMES constant in app.js if boxes change.
from PIL import Image
import numpy as np, json

SRC = 'sprites-init.png'
OUT = 'assets/sprites/hera-sheet.png'
BG = np.array([54, 44, 76])

im = Image.open(SRC).convert('RGB')
full = np.asarray(im).astype(int)

BOXES = {
    'idle0': (63, 183, 226, 407),
    'idle1': (230, 182, 395, 406),
    'walk0': (505, 186, 661, 412),
    'walk1': (682, 185, 852, 409),
    'kick':  (925, 179, 1246, 407),
}

def cut(box):
    x0, y0, x1, y1 = box
    a = full[y0:y1, x0:x1]
    dist = np.abs(a - BG).sum(axis=2)
    alpha = np.clip((dist - 25) / 50.0, 0, 1)
    rgba = np.zeros((*a.shape[:2], 4), np.uint8)
    rgba[..., :3] = a
    rgba[..., 3] = (alpha * 255).astype(np.uint8)
    fg = rgba[..., 3] > 10
    rows = np.where(fg.any(axis=1))[0]; cols = np.where(fg.any(axis=0))[0]
    return rgba[rows[0]:rows[-1]+1, cols[0]:cols[-1]+1]

def foot_anchor(rgba, left_only=False):
    fg = rgba[..., 3] > 100
    h, w = fg.shape
    ys, xs = np.where(fg[h-16:h, :])
    if left_only:
        xs = xs[xs < w * 0.55]
    return float(xs.mean())

def head_anchor(rgba):
    """x centroid of the head/chest region — aligning run frames on the torso
    keeps her body steady between frames (feet may slide; the ground scrolls)."""
    fg = rgba[..., 3] > 100
    h = fg.shape[0]
    ys, xs = np.where(fg[int(h*0.05):int(h*0.4), :])
    return float(xs.mean())

def make_pass(rgba, lift_f=0.82):
    """Airborne 'pass' frame: squash the hem/feet band so the legs tuck."""
    h, w = rgba.shape[:2]
    y0 = int(h * 0.78)
    band = rgba[y0:, :]
    nh = max(1, round(band.shape[0] * lift_f))
    small = np.asarray(Image.fromarray(band).resize((w, nh), Image.NEAREST))
    out = rgba.copy()
    out[y0:, :] = 0
    out[y0:y0+nh, :] = small
    return out[:y0+nh, :]

base = {n: cut(b) for n, b in BOXES.items()}
frames = {
    'idle0': base['idle0'],
    'idle1': base['idle1'],
    'walk0': base['walk0'],
    'pass0': make_pass(base['walk0']),
    'walk1': base['walk1'],
    'pass1': make_pass(base['walk1']),
    'kick':  base['kick'],
}

# torso-aligned anchor shared across the whole run cycle: average the head
# centroids so every run frame uses the same reference line
run_names = ['walk0', 'pass0', 'walk1', 'pass1']
meta = {}
GAP = 2
H = max(f.shape[0] for f in frames.values()) + 2
W = sum(f.shape[1] for f in frames.values()) + GAP * (len(frames) + 1)
sheet = np.zeros((H, W, 4), np.uint8)
x = GAP
for name, f in frames.items():
    fh, fw = f.shape[:2]
    y = H - fh
    sheet[y:y+fh, x:x+fw] = f
    if name in run_names:
        ax = head_anchor(f)
    elif name == 'kick':
        ax = foot_anchor(f, left_only=True)
    else:
        ax = foot_anchor(f)
    # pass frames ride 5 sheet-px higher (airborne)
    dy = 5 if name.startswith('pass') else 0
    meta[name] = {'x': x, 'y': y, 'w': fw, 'h': fh, 'ax': round(ax, 1), 'dy': dy}
    x += fw + GAP

Image.fromarray(sheet).save(OUT)
print('sheet', W, 'x', H)
print(json.dumps(meta, indent=1))
