#!/usr/bin/env python3
"""Remove the mooncake held in the person's hand (v2, high quality).

- Mask: HSV golden threshold -> full-image connected components ->
  pick compact high-fill component in upper half -> dilate + row close.
- Inpaint: Push-Pull pyramid fill (smooth, Poisson-like), then
  distance-weighted blend with original to kill seams, then light
  surface smoothing inside mask only.
- Verify: pixels outside mask+feather band must be unchanged.
"""
import numpy as np, os
from PIL import Image, ImageFilter
from collections import deque

SRC = "/ws/source.png"
OUT_DIR = "/ws/mooncake-removal"
os.makedirs(OUT_DIR, exist_ok=True)
OUT = os.path.join(OUT_DIR, "output.png")

im = Image.open(SRC).convert("RGB")
a = np.asarray(im).astype(np.float32)
h, w, _ = a.shape

# ---------- 1. HSV mask ----------
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

# ---------- 2. full-image components ----------
lab = np.zeros((h, w), np.int32); cur = 0; comps = {}
for y in range(h):
    for x in range(w):
        if mask[y, x] and lab[y, x] == 0:
            cur += 1; q = deque([(y, x)]); lab[y, x] = cur
            n = 0; x0 = x1 = x; y0 = y1 = y
            while q:
                cy, cx = q.popleft(); n += 1
                x0 = min(x0, cx); x1 = max(x1, cx)
                y0 = min(y0, cy); y1 = max(y1, cy)
                for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                    ny, nx = cy+dy, cx+dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and lab[ny, nx] == 0:
                        lab[ny, nx] = cur; q.append((ny, nx))
            comps[cur] = (n, x0, y0, x1, y1)

cands = []
for cid, (n, x0, y0, x1, y1) in comps.items():
    if n < 800 or y1 >= h // 2 + 40:
        continue
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    fill = n / (bw * bh)
    if fill < 0.40:
        continue
    aspect = min(bw, bh) / max(bw, bh)
    score = n * fill * aspect * (1.0 - y0 / h)
    cands.append((score, cid, n, (x0, y0, x1, y1)))
cands.sort(reverse=True)
for sc, cid, n, bb in cands[:5]:
    bw, bh = bb[2]-bb[0]+1, bb[3]-bb[1]+1
    print(f"cand score={sc:.0f} area={n} bbox={bb} fill={n/(bw*bh):.2f}")
assert cands, "no mooncake candidate"
_, best_id, _, (bx0, by0, bx1, by1) = cands[0]
moon = lab == best_id
print(f"mooncake area={int(moon.sum())} bbox=({bx0},{by0},{bx1},{by1})")

# ---------- 3. dilate + row close ----------
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
np.save(os.path.join(OUT_DIR, "_mask.npy"), M)

# ---------- 4. Push-Pull pyramid inpaint ----------
# Build pyramid: at each level keep known values; unknown = weighted child avg.
def push_pull(img, known):
    levels = []
    cur_img, cur_known = img.copy(), known.copy().astype(np.float32)
    while min(cur_img.shape[0], cur_img.shape[1]) > 4:
        levels.append((cur_img, cur_known))
        H, W = cur_img.shape[:2]
        H2, W2 = (H + 1) // 2, (W + 1) // 2
        # box-downsample weighted by known mask
        pad_h, pad_w = H2 * 2 - H, W2 * 2 - W
        ip = np.pad(cur_img, ((0, pad_h), (0, pad_w), (0, 0)), mode='edge')
        kp = np.pad(cur_known, ((0, pad_h), (0, pad_w))), 
        kp = kp[0] if isinstance(kp, tuple) else kp
        ip = ip.reshape(H2, 2, W2, 2, 3); kp2 = cur_known
        kp_p = np.pad(cur_known, ((0, pad_h), (0, pad_w)), mode='edge').reshape(H2, 2, W2, 2)
        wsum = kp_p.sum((1, 3))
        num = (ip * kp_p[..., None]).sum((1, 3))
        new_img = np.where(wsum[..., None] > 0, num / np.maximum(wsum, 1e-6)[..., None],
                           cur_img[:H2, :W2].mean(0).mean(0))
        new_known = (wsum > 0).astype(np.float32)
        # fully unknown coarse cells inherit nearest known avg (handled at pull)
        cur_img, cur_known = new_img.astype(np.float32), new_known
    levels.append((cur_img, cur_known))
    # pull: coarse->fine fill
    coarse_img, coarse_k = levels[-1]
    filled_pyramid = coarse_img.copy()
    for lvl in range(len(levels) - 2, -1, -1):
        f_img, f_known = levels[lvl]
        H, W = f_img.shape[:2]
        Hc, Wc = coarse_img.shape[:2]
        up = np.asarray(Image.fromarray(np.clip(coarse_img, 0, 255).astype(np.uint8))
                         .resize((W, H), Image.BILINEAR)).astype(np.float32)
        # blend: known fine pixels keep original; unknown take upsampled coarse
        blend_w = f_known[..., None]
        outp = f_img * blend_w + up * (1 - blend_w)
        # for known-but-low-confidence regions just keep original
        coarse_img, coarse_k = outp, np.maximum(f_known, 0)
    return outp

known = (~M).astype(np.float32)
filled = push_pull(a, known)

# distance-weighted blend: near seam lean to smoothed original boundary values
# build distance transform inside mask (BFS rings)
dist = np.full((h, w), -1, np.int32)
dq = deque()
ring0 = M.copy()
for y in range(h):
    for x in range(w):
        if M[y, x]:
            # neighbor outside?
            for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                ny, nx = y+dy, x+dx
                if not (0 <= ny < h and 0 <= nx < w) or not M[ny, nx]:
                    dist[y, x] = 0; dq.append((y, x)); break
while dq:
    cy, cx = dq.popleft()
    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
        ny, nx = cy+dy, cx+dx
        if 0 <= ny < h and 0 <= nx < w and M[ny, nx] and dist[ny, nx] < 0:
            dist[ny, nx] = dist[cy, cx] + 1
            dq.append((ny, nx))
dist[M] = np.maximum(dist[M], 0)
DMAX = max(1, int(dist[M].max()))

res = a.copy()
# surface-smooth the filled result inside mask a bit
fs = np.asarray(Image.fromarray(np.clip(filled,0,255).astype(np.uint8))
                 .filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32)
# per-pixel weight: deep inside -> smoother fs, near seam -> push-pull filled
tw = np.clip(dist / max(6, DMAX * 0.35), 0, 1)[M][..., None]
res = a.copy()
res[M] = fs[M] * tw + filled[M] * (1 - tw)
# seam feather band outside mask
seam = M.copy()
for _ in range(5):
    seam[1:, :] |= M[:-1, :]; seam[:-1, :] |= M[1:, :]
    seam[:, 1:] |= M[:, :-1];  seam[:, :-1] |= M[:, 1:]
seam_only = seam & ~M
rb = np.asarray(Image.fromarray(np.clip(res,0,255).astype(np.uint8))
                 .filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32)
res[seam_only] = res[seam_only] * 0.55 + rb[seam_only] * 0.45

# ---------- 5. save + verify ----------
out = Image.fromarray(np.clip(res, 0, 255).astype(np.uint8))
out.save(OUT)

o = np.asarray(out).astype(np.int16)
orig = np.asarray(im).astype(np.int16)
diff = np.abs(o - orig).sum(2)
changed = diff > 3
inside = int((changed & M).sum())
outside = int((changed & ~M).sum())
print(f"masked changed: {inside} / {mask_px} px; outside changed: {outside} px (band allowed < 5000)")

# QA: region stats - repaired area vs ring around it
ring = seam & ~M
print(f"repaired std={o[M].std():.1f} mean={o[M].mean(1).mean():.1f} | "
      f"ring std={o[ring].std():.1f} mean={o[ring].mean(1).mean():.1f}")

dimg = np.zeros((h, w, 3), np.uint8)
dimg[..., 0] = np.clip(diff, 0, 255)
dimg[..., 1] = (M * 180).astype(np.uint8)
Image.fromarray(dimg).save(os.path.join(OUT_DIR, "diff.png"))

# QA crop: repair area zoomed
padq = 20
qx0, qy0 = max(0, bx0 - padq), max(0, by0 - padq)
qx1, qy1 = min(w, bx1 + padq + 1), min(h, by1 + padq + 1)
crop_o = out.crop((qx0, qy0, qx1, qy1))
crop_i = im.crop((qx0, qy0, qx1, qy1))
combo = Image.new("RGB", (crop_o.width * 2 + 8, crop_o.height), (20, 20, 30))
combo.paste(crop_i, (0, 0)); combo.paste(crop_o, (crop_o.width + 8, 0))
combo = combo.resize((combo.width * 2, combo.height * 2), Image.NEAREST)
combo.save(os.path.join(OUT_DIR, "qa_crop.png"))

im.save(os.path.join(OUT_DIR, "input.png"))
print("saved", OUT)