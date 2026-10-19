#!/usr/bin/env python3
"""宽阈值定位牌子：亮区扫描 (r+g+b)>190 且低饱和。"""
from PIL import Image, ImageFilter
import collections

SRC = "/ws/source.png"
im = Image.open(SRC).convert("RGB")
W, H = im.size
px = im.load()

rows_cnt = collections.Counter(); cols_cnt = collections.Counter()
hits = []
for y in range(H // 2, H):
    for x in range(W):
        r, g, b = px[x, y]
        mx, mn = max(r, g, b), min(r, g, b)
        if (r + g + b) >= 200 and (mx - mn) <= 110:
            rows_cnt[y] += 1; cols_cnt[x] += 1
            hits.append((x, y))

hot_rows = [y for y, c in rows_cnt.items() if c > 8]
hot_cols = [x for x, c in cols_cnt.items() if c > 8]
print("hot rows:", (min(hot_rows), max(hot_rows)) if hot_rows else None, len(hot_rows))
print("hot cols:", (min(hot_cols), max(hot_cols)) if hot_cols else None, len(hot_cols))
print("total hits:", len(hits))

if hot_rows and hot_cols and len(hits) > 60:
    by0, by1 = max(0, min(hot_rows) - 8), min(H, max(hot_rows) + 8)
    bx0, bx1 = max(0, min(hot_cols) - 8), min(W, max(hot_cols) + 8)
    print(f"sign box: ({bx0},{by0})-({bx1},{by1})")

    pad = 10
    ex0, ey0 = max(0, bx0 - pad), max(0, by0 - pad)
    ex1, ey1 = min(W, bx1 + pad), min(H, by1 + pad)
    hgt = ey1 - ey0; wid = ex1 - ex0
    # 背景源：牌子正下方条带（草地/地面）
    if ey1 + hgt <= H:
        src_box = (ex0, ey1, ex1, min(H, ey1 + hgt))
    else:
        src_box = (ex0, max(0, ey0 - hgt), ex1, ey0)
    patch = im.crop(src_box).resize((wid, hgt)).filter(ImageFilter.GaussianBlur(6))

    out = im.copy()
    region = out.crop((ex0, ey0, ex1, ey1))
    from PIL import Image as I
    m = I.new("L", region.size, 255).filter(ImageFilter.GaussianBlur(6))
    out.paste(I.composite(patch, region, m), (ex0, ey0))
    out.save("after.png", "PNG")
    im.save("before.png", "PNG")
    print("OK before.png after.png")
else:
    print("NO_REGION")