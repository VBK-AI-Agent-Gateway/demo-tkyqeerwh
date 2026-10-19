#!/usr/bin/env python3
"""诊断 + 去牌：分析底部区域亮度分布，定位标牌矩形并擦除。"""
from PIL import Image, ImageDraw, ImageFilter, ImageStat

SRC = "/ws/source.png"
im = Image.open(SRC).convert("RGB")
W, H = im.size
print("size", W, H)

# 诊断：将下半部分切成 8x8 网格，打印每格平均亮度
print("brightness grid (lower half):")
gw, gh = W // 8, (H // 2) // 8
for gy in range(8):
    row = []
    for gx in range(8):
        box = (gx * gw, H // 2 + gy * gh, (gx + 1) * gw, H // 2 + (gy + 1) * gh)
        s = ImageStat.Stat(im.crop(box))
        row.append(f"{int(sum(s.mean)//3):3d}")
    print(" ".join(row))

# 遍历下半部分，找"高亮矩形块"：像素级亮 (>160) 且色偏小(近白/灰) 或偏黄
mask = Image.new("L", (W, H), 0)
px_m = mask.load()
px = im.load()
for y in range(H // 2, H):
    for x in range(W):
        r, g, b = px[x, y]
        mx, mn = max(r, g, b), min(r, g, b)
        if r > 155 and g > 155 and b > 130 and (mx - mn) < 90:
            px_m[x, y] = 255

# 找连通高亮区域的边界（简化：对 mask 取 bbox after 极大腐蚀保留大块）
bbox = mask.getbbox()
print("mask bbox:", bbox)

# 统计每行/列高亮像素数，确定主要块
import collections
rows_cnt = collections.Counter()
cols_cnt = collections.Counter()
for y in range(H // 2, H):
    c = 0
    for x in range(W):
        if px_m[x, y]:
            c += 1
            cols_cnt[x] += 1
    if c:
        rows_cnt[y] = c
hot_rows = [y for y, c in rows_cnt.items() if c > 30]
hot_cols = [x for x, c in cols_cnt.items() if c > 20]
print("hot rows range:", (min(hot_rows), max(hot_rows)) if hot_rows else None, "count", len(hot_rows))
print("hot cols range:", (min(hot_cols), max(hot_cols)) if hot_cols else None, "count", len(hot_cols))

if hot_rows and hot_cols:
    by0, by1 = min(hot_rows) - 6, max(hot_rows) + 6
    bx0, bx1 = min(hot_cols) - 6, max(hot_cols) + 6
    by0, bx0 = max(0, by0), max(0, bx0)
    by1, bx1 = min(H, by1), min(W, bx1)
    print(f"sign box: ({bx0},{by0})-({bx1},{by1})")

    pad = 8
    ex0, ey0 = max(0, bx0 - pad), max(0, by0 - pad)
    ex1, ey1 = min(W, bx1 + pad), min(H, by1 + pad)

    # 背景源：取牌子左右两侧或下方的条带
    hgt = ey1 - ey0
    if ey1 + hgt <= H:
        src_box = (ex0, ey1, ex1, min(H, ey1 + hgt))
    else:
        src_box = (ex0, max(0, ey0 - hgt), ex1, ey0)
    patch = im.crop(src_box).resize((ex1 - ex0, ey1 - ey0)).filter(ImageFilter.GaussianBlur(5))

    out = im.copy()
    region = out.crop((ex0, ey0, ex1, ey1))
    m = Image.new("L", region.size, 255).filter(ImageFilter.GaussianBlur(5))
    out.paste(Image.composite(patch, region, m), (ex0, ey0))
    out.save("after.png", "PNG")
    im.save("before.png", "PNG")
    print("OK before.png after.png")
else:
    print("NO_REGION")