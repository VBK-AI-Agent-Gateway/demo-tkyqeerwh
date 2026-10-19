#!/usr/bin/env python3
"""生成 月饼(before) -> 啤酒杯(after) 替换对比图"""
from PIL import Image, ImageDraw, ImageFont

W, H = 720, 900
BG = (244, 246, 250)

def font(sz):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"]:
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            pass
    return ImageFont.load_default()

def person(d):
    # 头
    d.ellipse([280, 120, 440, 280], fill=(255, 214, 179), outline=(60, 60, 60), width=3)
    # 头发
    d.chord([278, 110, 442, 250], 180, 360, fill=(45, 45, 55))
    # 身体
    d.rounded_rectangle([210, 300, 510, 760], radius=60, fill=(37, 99, 235), outline=(30, 64, 175), width=3)
    # 眼睛嘴
    d.ellipse([325, 190, 345, 212], fill=(30, 30, 30))
    d.ellipse([378, 190, 398, 212], fill=(30, 30, 30))
    d.arc([335, 225, 390, 265], 20, 160, fill=(30, 30, 30), width=4)

def arm(d):
    # 右臂伸向手持物
    d.line([470, 420, 560, 560], fill=(255, 214, 179), width=44)
    d.ellipse([538, 540, 592, 594], fill=(255, 214, 179), outline=(60, 60, 60), width=3)

def mooncake(d, cx, cy):
    # 月饼：圆形带花纹
    d.ellipse([cx-70, cy-70, cx+70, cy+70], fill=(196, 128, 56), outline=(120, 76, 28), width=5)
    d.ellipse([cx-52, cy-52, cx+52, cy+52], outline=(240, 214, 160), width=4)
    for a in range(0, 360, 45):
        import math
        x = cx + 40 * math.cos(math.radians(a))
        y = cy + 40 * math.sin(math.radians(a))
        d.ellipse([x-9, y-9, x+9, y+9], outline=(240, 214, 160), width=3)
    d.ellipse([cx-16, cy-16, cx+16, cy+16], fill=(240, 214, 160))

def beer(d, cx, cy):
    # 啤酒杯：梯形杯体 + 丰富泡沫 + 把手 + 气泡 + 底座
    # 杯体（略带收腰）
    d.polygon([(cx-58, cy-95), (cx+58, cy-95), (cx+46, cy+105), (cx-46, cy+105)],
              fill=(255, 205, 82), outline=(140, 96, 18), width=5)
    # 酒液层次
    d.polygon([(cx-46, cy-40), (cx+46, cy-40), (cx+43, cy+8), (cx-43, cy+8)],
              fill=(255, 226, 130))
    d.polygon([(cx-44, cy+8), (cx+44, cy+8), (cx+40, cy+95), (cx-40, cy+95)],
              fill=(255, 196, 60))
    # 高光条
    d.polygon([(cx-42, cy-88), (cx-22, cy-88), (cx-28, cy+95), (cx-42, cy+95)],
              fill=(255, 245, 200))
    # 泡沫主体
    d.rounded_rectangle([cx-62, cy-130, cx+62, cy-86], radius=18, fill=(255, 255, 255),
                        outline=(214, 218, 226), width=3)
    for dx in (-44, -16, 14, 44):
        d.ellipse([cx+dx-18, cy-146, cx+dx+18, cy-110], fill=(255, 255, 255),
                  outline=(214, 218, 226), width=3)
    # 溢出小泡沫
    for dx, dy, r in ((-64, -96, 8), (60, -102, 7), (34, -84, 6)):
        d.ellipse([cx+dx-r, cy+dy-r, cx+dx+r, cy+dy+r], fill=(255, 255, 255),
                  outline=(214, 218, 226), width=2)
    # 把手（右侧圆环）
    d.arc([cx+44, cy-75, cx+132, cy+62], -85, 85, fill=(140, 96, 18), width=16)
    d.arc([cx+54, cy-62, cx+120, cy+48], -80, 80, fill=(255, 205, 82), width=6)
    # 杯底
    d.rounded_rectangle([cx-52, cy+102, cx+52, cy+122], radius=8, fill=(230, 234, 240),
                        outline=(140, 148, 160), width=3)
    # 气泡
    for dx, dy, r in ((-20, 45, 7), (8, 70, 5), (-4, 20, 6), (22, 40, 4), (14, -10, 5), (-26, -25, 4)):
        d.ellipse([cx+dx-r, cy+dy-r, cx+dx+r, cy+dy+r], outline=(214, 160, 40), width=2)
    # 手指（握住杯体/把手）
    for i, fy in enumerate((-45, -8, 30)):
        d.rounded_rectangle([cx+46, cy+fy, cx+88, cy+fy+22], radius=10,
                            fill=(255, 214, 179), outline=(60, 60, 60), width=3)

def build(path, title, subtitle, draw_obj):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # 卡片背景
    d.rounded_rectangle([30, 110, W-30, H-40], radius=6, fill=(255, 255, 255),
                        outline=(229, 231, 235), width=2)
    # 标题
    f1, f2 = font(40), font(22)
    tw = d.textlength(title, font=f1)
    d.text(((W-tw)/2, 40), title, fill=(37, 99, 235), font=f1)
    sw = d.textlength(subtitle, font=f2)
    d.text(((W-sw)/2, H-100), subtitle, fill=(107, 114, 128), font=f2)
    person(d)
    arm(d)
    draw_obj(d, 560, 560)   # 手持物位置（手心）
    img.save(path, "PNG")
    return path

if __name__ == "__main__":
    p1 = build("before.png", "BEFORE - Mooncake", "Original: person holding a mooncake", mooncake)
    p2 = build("after.png", "AFTER - Beer Mug", "Edited: mooncake replaced with a beer mug", beer)
    print("OK", p1, p2)