# Regenerates assets/sprites/enemies-sheet.png from the reference art sprites-init.png.
# Run from the repo root: python3 tools/build_enemies.py
# Requires: pillow, numpy, scipy. Frame metadata is printed to stdout;
# paste it into the matching *_FRAMES constant in app.js if boxes change.
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage
import json

SRC = 'sprites-init.png'
OUT = 'assets/sprites/enemies-sheet.png'
BG = np.array([54, 44, 76])

im = np.asarray(Image.open(SRC).convert('RGB')).astype(int)

def white_donor(a):
    lum = a.mean(axis=2); sat = a.max(axis=2) - a.min(axis=2)
    return (lum >= 150) & (sat < 60)

def cream_donor(a):
    r, g, b = a[...,0], a[...,1], a[...,2]
    return (r > 170) & (g > 140) & (b > 90) & ((r - b) < 90) & ((r - b) > 25)

# repair: tight octagon over the impact spark where it covers the body
# erase:  Hera, spark-over-background, swoosh arcs (erase wins over repair)
CFG = {
    'eagle': dict(
        box=(150, 520, 375, 745), th=94, donor=white_donor, clone=(0, 0), patch=(287, 640, 322, 684), glow=(45, 200),
        nosweep=[(222, 556, 315, 610), (195, 692, 268, 745)],
        repair=[[(222,604),(256,626),(282,650),(258,682),(238,704),(212,684),(190,652),(206,624)]],
        erase=[[(150,608),(226,608),(226,616),(236,616),(238,634),(236,658),(242,678),(248,688),(150,688)],
               [(150,688),(202,688),(202,745),(150,745)],
               [(202,688),(252,688),(252,704),(202,704)]]),
    'swan': dict(
        box=(470, 540, 690, 745), th=86, donor=white_donor, clone=(30, 38),
        nosweep=[(492, 558, 552, 602)], glow=(45, 200),
        repair=[[(548,608),(586,628),(616,652),(586,690),(552,712),(524,700),(518,652),(526,622)],
                [(556,578),(594,578),(594,604),(556,604)]],
        erase=[[(470,560),(520,560),(534,600),(526,622),(518,652),(524,700),(548,722),(542,745),(470,745)]]),
    'cloud': dict(
        box=(780, 530, 1040, 750), th=96, donor=white_donor, clone=(-35, 55),
        nosweep=[(866, 594, 1030, 632)], decolor=[(833, 648, 884, 714)],
        repair=[[(848,592),(900,592),(908,700),(880,712),(862,706),(838,668),(842,625)]],
        erase=[[(780,540),(800,540),(800,615),(842,625),(838,668),(856,704),(846,750),(780,750)]]),
    'bull': dict(
        box=(1150, 520, 1380, 745), th=100, donor=cream_donor, clone=(25, 45),
        nosweep=[(1265, 528, 1372, 608), (1288, 662, 1348, 710), (1200, 545, 1335, 624)],
        paint=[('ellipse', (1240, 650, 1252, 660), (62, 47, 40)),
               ('ellipse', (1242, 652, 1246, 655), (120, 96, 78)),
               ('arc', (1236, 646, 1304, 698), 30, 150, (52, 40, 34), 4),
               ('line', (1233, 620, 1240, 660), (208, 182, 142), 3)],
        repair=[[(1212,622),(1250,636),(1262,654),(1248,686),(1214,700),(1186,684),(1172,654),(1186,630)]],
        erase=[[(1150,545),(1172,545),(1172,618),(1204,620),(1204,652),(1218,694),(1244,708),(1228,722),(1228,745),(1150,745)]]),
    # the collectible peacock (bottom row of the art, unoccluded); erase rects
    # trim the throne's gold staff and armrest intruding on the right edge
    'peacock': dict(
        box=(565, 852, 748, 1090), th=76, donor=white_donor, clone=(0, 0),
        nosweep=[],
        repair=[],
        erase=[[(736, 852), (748, 852), (748, 930), (736, 930)],
               [(730, 975), (748, 975), (748, 1090), (730, 1090)]]),
}

def poly_mask(shape, polys, off):
    m = Image.new('L', (shape[1], shape[0]), 0)
    d = ImageDraw.Draw(m)
    ox, oy = off
    for p in polys:
        d.polygon([(x - ox, y - oy) for (x, y) in p], fill=255)
    return np.asarray(m) > 0

def extract(name):
    cfg = CFG[name]
    x0, y0, x1, y1 = cfg['box']
    a = im[y0:y1, x0:x1].copy()
    h, w = a.shape[:2]

    bgm = np.abs(a - BG).sum(axis=2) < 60
    erase = poly_mask((h, w), cfg['erase'], (x0, y0))
    repair = poly_mask((h, w), cfg['repair'], (x0, y0)) & ~erase

    outside = bgm | erase
    for (dx0, dy0, dx1, dy1) in cfg.get('decolor', []):
        rr, gg, bb = a[...,0], a[...,1], a[...,2]
        zone = np.zeros((h, w), bool)
        zone[max(dy0-y0,0):dy1-y0, max(dx0-x0,0):dx1-x0] = True
        outside |= zone & (gg > rr + 25) & (bb > rr + 25)
    hole = repair & ~bgm
    keep = ~outside & ~hole

    # drop small stray components (dust, ray tips) but keep feet/bolts
    lbl, n = ndimage.label(keep)
    sizes = ndimage.sum(keep, lbl, range(1, n + 1))
    for i in range(n):
        if sizes[i] <= 120:
            outside |= (lbl == i + 1)
    keep &= ~outside

    # sweep up stray spark pixels (ray tips, dust) near the repair zone
    r, g, b = a[...,0], a[...,1], a[...,2]
    rb_min, b_max = cfg.get('glow', (55, 175))
    sparky = ((r > 195) & (g > 110) & (b < 140)) | ((r > 235) & (g > 235) & (b > 205)) \
           | ((r > 215) & (g > 160) & (b < b_max) & ((r - b) > rb_min))
    near = ndimage.binary_dilation(repair, iterations=28)
    yy, xx = np.mgrid[0:h, 0:w]
    for (nx0, ny0, nx1, ny1) in cfg['nosweep']:
        near &= ~((xx >= nx0 - x0) & (xx < nx1 - x0) & (yy >= ny0 - y0) & (yy < ny1 - y0))
    resid = keep & sparky & near
    hole |= resid
    keep &= ~resid

    # fill holes by clone-stamping real body texture from a fixed offset;
    # fall back to the nearest body-toned pixel where the clone source is bad
    donor = keep & cfg['donor'](a)
    _, (iy, ix) = ndimage.distance_transform_edt(~donor, return_indices=True)
    work = a.copy()
    work[hole] = a[iy[hole], ix[hole]]
    dy, dx = cfg['clone']
    hy, hx = np.where(hole)
    sy, sx = hy + dy, hx + dx
    ok = (sy >= 0) & (sy < h) & (sx >= 0) & (sx < w)
    ok[ok] &= donor[sy[ok], sx[ok]]
    work[hy[ok], hx[ok]] = a[sy[ok], sx[ok]]
    if 'patch' in cfg:
        # tile a clean swatch of the body texture across the repaired area
        px0, py0, px1, py1 = cfg['patch']
        px0 -= x0; py0 -= y0; px1 -= x0; py1 -= y0
        pw, ph = px1 - px0, py1 - py0
        work[hy, hx] = a[py0 + (hy - py0) % ph, px0 + (hx - px0) % pw]

    # fill interior transparent pinholes (antialiased pixels that matched bg)
    tl, tn = ndimage.label(outside)
    border_t = set(tl[0]) | set(tl[-1]) | set(tl[:, 0]) | set(tl[:, -1])
    border_t.discard(0)
    pin = outside & ~np.isin(tl, list(border_t))
    if pin.any():
        work[pin] = a[iy[pin], ix[pin]]
        outside &= ~pin

    if 'paint' in cfg:
        pimg = Image.fromarray(work.clip(0, 255).astype(np.uint8))
        pd = ImageDraw.Draw(pimg)
        for op in cfg['paint']:
            if op[0] == 'ellipse':
                (ex0, ey0, ex1, ey1), col = op[1], op[2]
                pd.ellipse((ex0 - x0, ey0 - y0, ex1 - x0, ey1 - y0), fill=col)
            elif op[0] == 'arc':
                (ex0, ey0, ex1, ey1), a0, a1, col, wd = op[1], op[2], op[3], op[4], op[5]
                pd.arc((ex0 - x0, ey0 - y0, ex1 - x0, ey1 - y0), a0, a1, fill=col, width=wd)
            elif op[0] == 'line':
                (ex0, ey0, ex1, ey1), col, wd = op[1], op[2], op[3]
                pd.line((ex0 - x0, ey0 - y0, ex1 - x0, ey1 - y0), fill=col, width=wd)
        work = np.asarray(pimg).astype(int)

    alpha = np.where(outside, 0, 255).astype(np.uint8)
    rgba = np.dstack([work.clip(0, 255).astype(np.uint8), alpha])
    fg = alpha > 0
    rows = np.where(fg.any(axis=1))[0]; cols = np.where(fg.any(axis=0))[0]
    rgba = rgba[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]

    th = cfg['th']
    sh, sw = rgba.shape[:2]
    tw = round(sw * th / sh)
    box = np.asarray(Image.fromarray(rgba).resize((tw, th), Image.BOX))
    al = np.where(box[..., 3] > 127, 255, 0).astype(np.uint8)
    q = Image.fromarray(box[..., :3]).quantize(40, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    return np.dstack([np.asarray(q), al])

def squash_band(img, x0, x1, y_top, y_anchor, f):
    out = img.copy()
    band = img[y_top:y_anchor, x0:x1]
    nh = max(1, round(band.shape[0] * f))
    small = np.asarray(Image.fromarray(band).resize((band.shape[1], nh), Image.NEAREST))
    out[y_top:y_anchor, x0:x1] = 0
    out[y_anchor - nh:y_anchor, x0:x1] = small
    return out

def make_frames(name, s):
    h, w = s.shape[:2]
    f = {'eagle': 0.88, 'swan': 0.92, 'cloud': 0.94, 'bull': 0.93, 'peacock': 0.94}[name]
    return [s, squash_band(s, 0, w, 0, h, f)]

frames = {}
for name in CFG:
    s = extract(name)
    for i, f in enumerate(make_frames(name, s)):
        frames[f'{name}{i}'] = f
    print(name, s.shape[1], 'x', s.shape[0])

GAP = 2
H = max(f.shape[0] for f in frames.values()) + 2
W = sum(f.shape[1] for f in frames.values()) + GAP * (len(frames) + 1)
sheet = np.zeros((H, W, 4), np.uint8)
meta = {}
x = GAP
for nm, f in frames.items():
    fh, fw = f.shape[:2]
    sheet[H - fh:H, x:x + fw] = f
    meta[nm] = {'x': x, 'y': H - fh, 'w': fw, 'h': fh}
    x += fw + GAP
Image.fromarray(sheet).save(OUT)
print('sheet', W, 'x', H)
print(json.dumps(meta))

prev = Image.new('RGB', (W * 3, H * 3), (58, 48, 82))
si = Image.fromarray(sheet).resize((W * 3, H * 3), Image.NEAREST)
prev.paste(si, (0, 0), si)
prev.save('/tmp/enemies_sheet_preview.png')
