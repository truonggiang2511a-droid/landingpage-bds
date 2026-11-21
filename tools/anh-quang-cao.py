#!/usr/bin/env python3
"""Ảnh quảng cáo (Zalo Ads / dùng chung) từ ảnh thật của căn: ảnh tràn khung + dải chữ dưới (1 dòng chính + 1 dòng phụ) + thương hiệu nhỏ.
Chữ ít (≈ dưới 20% diện tích) để dễ được duyệt; chỉ dùng số liệu thật của căn (data/nha/<slug>.json). Không số điện thoại, không gạch giá.
Chạy: python3 tools/anh-quang-cao.py  → quang-cao/<short>/zalo/<mau>-<cỡ>.jpg  (cỡ: 1200x628 ngang, 1080x1080 vuông)
Cần: playwright + Chrome /usr/bin/google-chrome (như tools/ban-do.py)."""
import asyncio, base64, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SLUG = 'nha-mat-tien-le-thi-tam-phuoc-ly'
H = json.load(open(os.path.join(ROOT, 'data/nha', SLUG + '.json'), encoding='utf-8'))
SITE = json.load(open(os.path.join(ROOT, 'data/site.json'), encoding='utf-8'))
PHOTO = os.path.join(ROOT, 'public/nha', SLUG)
OUT = os.path.join(ROOT, 'quang-cao', H.get('short') or SLUG, 'zalo')
FONT = os.path.join(ROOT, 'public/fonts')

down = H['price'] * H['downPct'] / 100 / 1e9  # 1,68 tỷ
DOWN = f"{down:.2f}".rstrip('0').rstrip('.').replace('.', ',') + ' tỷ'

# Mẫu: ảnh, dòng chính, dòng phụ, vị trí lấy ảnh (object-position). Toàn số liệu có trên trang căn.
MAU = [
    ('1-tra-truoc', '01-mat-tien-1.webp', f'Trả trước chỉ từ {DOWN}', 'Nhà mặt tiền Lê Thị Tám · 1 trệt 2 lầu · 138 m²', '50% 45%'),
    ('2-noi-that', '14-phong-khach-2.webp', 'Full nội thất · Sổ hồng riêng', 'Đã hoàn công · 4 phòng ngủ · 4 WC', '50% 50%'),
    ('3-vi-tri', '05-mat-tien-5.webp', 'Cách ranh TP.HCM khoảng 23 m', 'Mặt tiền kinh doanh đường Lê Thị Tám', '50% 55%'),
]
SIZES = [('1200x628', 1200, 628), ('1080x1080', 1080, 1080)]


def b64(path, mime):
    return f'data:{mime};base64,' + base64.b64encode(open(path, 'rb').read()).decode()


def html(img, title, sub, pos, W, Hh):
    sq = W == Hh
    t = 64 if sq else 54
    s = 32 if sq else 26
    # Lấy NGUYÊN 3 @font-face Geist của web (có unicode-range) — thiếu unicode-range thì bản latin đè bản tiếng Việt → mất dấu (ổ→ô, ồ→ô).
    import re
    css = open(os.path.join(ROOT, 'src/styles.css'), encoding='utf-8').read()
    fonts = ''.join(re.sub(r"url\((fonts/[^)]+)\)", lambda m: f"url('{b64(os.path.join(ROOT, 'public', m.group(1)), 'font/woff2')}')", r)
                    for r in re.findall(r"@font-face\{font-family:'Geist';[^}]+\}", css))
    color = SITE.get('color', '#14532D')
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{fonts}
*{{margin:0;box-sizing:border-box}} body{{width:{W}px;height:{Hh}px;overflow:hidden;font-family:Geist,sans-serif}}
.bg{{position:absolute;inset:0;background:url('{b64(os.path.join(PHOTO, img), 'image/webp')}') {pos}/cover}}
.sh{{position:absolute;left:0;right:0;bottom:0;height:{48 if sq else 58}%;background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.55) 45%,rgba(0,0,0,.82) 100%)}}
.tx{{position:absolute;left:{56 if sq else 48}px;right:{56 if sq else 48}px;bottom:{64 if sq else 40}px;color:#fff}}
h1{{font-size:{t}px;font-weight:800;letter-spacing:-.02em;line-height:1.08;text-shadow:0 2px 12px rgba(0,0,0,.35)}}
p{{margin-top:{14 if sq else 10}px;font-size:{s}px;font-weight:500;opacity:.95}}
.br{{position:absolute;top:{36 if sq else 28}px;left:{40 if sq else 32}px;display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.94);
  border-radius:999px;padding:8px 18px 8px 8px;font-weight:700;font-size:{24 if sq else 21}px;color:{color}}}
.lg{{width:{40 if sq else 36}px;height:{40 if sq else 36}px;border-radius:11px;background:{color};display:grid;place-items:center}}
</style></head><body><div class="bg"></div><div class="sh"></div>
<div class="br"><div class="lg"><svg width="70%" height="70%" viewBox="0 0 40 40"><path d="M8 30V17l6.5-6 5.5 5 5.5-5 6.5 6v13" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>{SITE['brand']}</div>
<div class="tx"><h1>{title}</h1><p>{sub}</p></div></body></html>"""


async def main():
    from playwright.async_api import async_playwright
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        for key, img, title, sub, pos in MAU:
            for sz, W, Hh in SIZES:
                pg = await b.new_page(viewport={'width': W, 'height': Hh})
                await pg.set_content(html(img, title, sub, pos, W, Hh))
                await pg.wait_for_timeout(500)
                fp = os.path.join(OUT, f'{key}-{sz}.jpg')
                await pg.screenshot(path=fp, type='jpeg', quality=88)
                await pg.close()
                print('→', os.path.relpath(fp, ROOT), f'{os.path.getsize(fp)//1024} KB')
        await b.close()

asyncio.run(main())
