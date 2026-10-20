#!/usr/bin/env python3
"""Remove the mooncake held in the person's hand.

Pipeline (pure numpy/PIL):
1. HSV golden-brown threshold -> connected components (full image).
2. Pick the mooncake: compact, high-fill component in the upper half.
3. Dilate + row-close so fingers/rim/shadow are covered.
4. Diffusion inpaint (known pixels re-imposed each pass).
5. Feather-blend seam, verify pixel diff, save output + diff.
"""
import numpy as np, os
from PIL import Image, ImageFilter
from collections import deque

SRC = "/ws/source.png"
OUT_DIR = "/ws/mooncake-removal"
OUT = os.path.join(OUT_DIR, "output.png")
os.makedirs(OUT_DIR, exist_ok=True)

im = Image.open(SRC).convert("RGB")
a = np.asarray(im).astype(np.float32)
h, w, _ = a.shape

# --- 1. HSV mask ---
mx, mn = a.max(2), a.min(2)
v, s = mx, np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
d = mx - mn + 1e-6
hu = np.zeros_like(mx, np.float32)
m = mx == r; hu[m] = ((g - b)[m] / d[m]) % 6
m = mx == g; hu[m] = ((b - r)[m] / d[m]) + 2
m = mx == b; hu[m] = ((r - g)[m] / d[m]) + 4
hu *= 60
mask = ((hu >= 15) & (hu <= 55) & (s >= 0.30) & (v >= 90) & (v <= 235))

# --- 2. connected components over whole image ---
lab = np.zeros((h, w), np.int32); cur = 0; comps = {}
for y in range(h):
    for x in range(w):
        if mask[y, x] and lab[y, x] == 0:
            cur += 1; q = deque([(y, x)]); lab[y, x] = cur
            n = 1; x0 = x1 = x; y0 = y1 = y
            while q:
                cy, cx = q.popleft()
                for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                    ny, nx = cy+dy, cx+dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and lab[ny, nx] == 0:
                        lab[ny, nx] = cur; q.append((ny, nx)); n += 1
                        x0 = min(x0, nx); x1 = max(x1, nx)
                        y0 = min(y0, ny); y1 = max(y1, ny)
            comps[cur] = (n, x0, y0, x1, y1)

# pick mooncake: upper-half, area>=800, high bbox fill, prefer higher up
cands = []
for cid, (n, x0, y0, x1, y1) in comps.items():
    if n < 800 or y1 >= h // 2 + 40:
        continue
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    fill = n / (bw * bh)
    if fill < 0.40:
        continue
    aspect = min(bw, bh) / max(bw, bh)
    score = n * fill * aspect * (1.0 - y0 / h)   # big, solid, round-ish, high
    cands.append((score, cid, n, (x0, y0, x1, y1)))
cands.sort(reverse=True)
for sc, cid, n, bb in cands[:5]:
    bw, bh = bb[2]-bb[0]+1, bb[3]-bb[1]+1
    print(f"cand score={sc:.0f} area={n} bbox={bb} fill={n/(bw*bh):.2f}")
assert cands, "no mooncake candidate found"
_, best_id, best_area, (bx0, by0, bx1, by1) = cands[0]
moon = lab == best_id
print(f"mooncake area={int(moon.sum())} bbox=({bx0},{by0},{bx1},{by1})")

# --- 3. dilate + row close (cover rim/shadow/fingers behind cake) ---
M = moon.copy()
for _ in range(8):
    M[1:, :] |= M[:-1, :]; M[:-1, :] |= M[1:, :]
    M[:, 1:] |= M[:, :-1];  M[:, :-1] |= M[:, 1:]
for y in range(max(0, by0 - 6), min(h, by1 + 7)):
    xs = np.nonzero(M[y])[0]
    if len(xs) > 1:
        M[y, xs.min():xs.max()+1] = True
for _ in range(4): M[:-1] |= M[1:]
for _ in range(4): M[1:] |= M[:-1]
mask_px = int(M.sum())
print("mask px:", mask_px)

# --- 4. diffusion inpaint ---
mi = M[..., None]
known = ~M
work = a.copy()
work[M] = a[known].mean(0)
for i in range(450):
    avg = (np.roll(work,1,0) + np.roll(work,-1,0) + np.roll(work,1,1) + np.roll(work,-1,1)) * 0.25
    work = np.where(mi, avg, work)
    work[known] = a[known]
res = a.copy()
res[M] = work[M]
del work

# --- 5. feather blend seam ---
seam = M.copy()
for _ in range(6):
    seam[1:, :] |= M[:-1, :]; seam[:-1, :] |= M[1:, :]
    seam[:, 1:] |= M[:, :-1];  seam[:, :-1] |= M[:, 1:]
blur = np.asarray(Image.fromarray(np.clip(res,0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.0))).astype(np.float32)
seam_only = seam & ~M
res[seam_only] = blur[seam_only] * 0.5 + res[seam_only] * 0.5
res[M] = res[M] * 0.65 + blur[M] * 0.35

out = Image.fromarray(np.clip(res, 0, 255).astype(np.uint8))
out.save(OUT)

# --- verification ---
o = np.asarray(out).astype(np.int16)
orig = np.asarray(im).astype(np.int16)
diff = np.abs(o - orig).sum(2)
changed = diff > 3
inside = int((changed & M).sum()); outside = int((changed & ~M).sum())
print(f"masked changed: {inside} / {mask_px} px; outside changed: {outside} px (seam feather allowed < 4000)")
dimg = np.zeros((h, w, 3), np.uint8)
dimg[..., 0] = np.clip(diff, 0, 255)
dimg[..., 1] = (M * 180).astype(np.uint8)
Image.fromarray(dimg).save(os.path.join(OUT_DIR, "diff.png"))
im.save(os.path.join(OUT_DIR, "input.png"))
print("saved", OUT)