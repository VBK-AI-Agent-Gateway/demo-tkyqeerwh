#!/usr/bin/env python3
"""去除坦克下方牌子：分析底部区域，检测矩形标牌并用邻域背景擦除。"""
from PIL import Image, ImageDraw, ImageFilter, ImageStat
import sys

SRC = "/ws/source.png"

def is_sign_like(region_img):
    """标牌特征：非灰色/非绿色的亮色（白/黄等），方正高亮块"""
    stat = ImageStat.Stat(region_img)
    r, g, b = stat.mean
    # 白牌：亮; 黄牌：r,g 高 b 低; 整体明显区别于草地/迷彩
    brightness = (r + g + b) / 3
    return brightness > 140

def main():
    im = Image.open(SRC).convert("RGB")
    W, H = im.size
    out = im.copy()
    d = ImageDraw.Draw(out)

    # 扫描坦克下方区域（下 45%），逐行找标牌
    regions = []
    step = 8
    y0 = int(H * 0.5)
    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)

    # 行扫描：找连续高亮行
    rows = []
    for y in range(y0, H - 4, 4):
        row = im.crop((0, y, W, y + 4))
        stat = ImageStat.Stat(row)
        # 行内是否有标牌样亮块（均值不反映局部，改用逐点）
        bright = 0
        px = row.resize((W // 4, 1))
        for x in range(W // 4):
            r, g, b = px.getpixel((x, 0))
            if r > 170 and g > 170 and b > 150:
                bright += 1
        if bright > 6:
            rows.append(y)

    if not rows:
        print("NO_REGION_DETECTED")
        sys.exit(2)

    # 连通行成块
    blocks = []
    cur = [rows[0]]
    for y in rows[1:]:
        if y - cur[-1] <= 12:
            cur.append(y)
        else:
            blocks.append(cur); cur = [y]
    blocks.append(cur)
    # 选最大块
    block = max(blocks, key=len)
    by0, by1 = block[0] - 4, block[-1] + 8

    # 列扫描确定左右边界
    xs = []
    for x in range(0, W, 4):
        strip = im.crop((x, by0, x + 4, by1))
        stat = ImageStat.Stat(strip)
        r, g, b = stat.mean
        if (r + g + b) / 3 > 150 and max(r, g, b) - min(r, g, b) < 120:
            xs.append(x)
    bx0 = max(0, (min(xs) if xs else W // 4) - 6)
    bx1 = min(W, (max(xs) if xs else 3 * W // 4) + 6)

    print(f"detected sign box: ({bx0},{by0})-({bx1},{by1})")

    # 擦除：用牌子下方/左右的背景做模糊填充
    pad = 6
    ex0, ey0 = max(0, bx0 - pad), max(0, by0 - pad)
    ex1, ey1 = min(W, bx1 + pad), min(H, by1 + pad)

    # 取牌子下方区域（若到底则取上方）作为背景源
    below_h = ey1 - ey0
    if ey1 + below_h <= H:
        src_box = (ex0, ey1, ex1, min(H, ey1 + below_h))
    else:
        src_box = (ex0, max(0, ey0 - below_h), ex1, ey0)
    patch = im.crop(src_box).resize((ex1 - ex0, ey1 - ey0)).filter(ImageFilter.GaussianBlur(6))

    # 羽化边缘贴回
    region = out.crop((ex0, ey0, ex1, ey1))
    blend = Image.new("RGB", region.size)
    m = Image.new("L", region.size, 255)
    m = m.filter(ImageFilter.GaussianBlur(4))
    out.paste(Image.composite(patch, region, m), (ex0, ey0))

    out.save("after.png", "PNG")
    im.save("before.png", "PNG")
    print("OK before.png after.png")

if __name__ == "__main__":
    main()