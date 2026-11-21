#!/usr/bin/env python3
"""Vẽ bản đồ vị trí cho 1 căn: data/nha/<slug>.map.json → public/nha/<slug>/ban-do-ngang(.webp|-800.webp), ban-do-doc(.webp|-800.webp).

Dữ liệu thật: nền CARTO Voyager (OSM), ranh hành chính = relation OSM, đường đi ô tô = OSRM, đường trước nhà = way OSM.
Có ô phóng to quanh căn nhà để thấy rõ điểm ranh. Chạy:  python3 tools/ban-do.py nha-mat-tien-le-thi-tam-phuoc-ly
Cần: pip install shapely pillow playwright (Chrome ở /usr/bin/google-chrome). Bộ nhớ đệm: tools/.cache/
"""
import asyncio, base64, io, json, math, os, sys, time, urllib.request, xml.etree.ElementTree as ET
from PIL import Image
from shapely.geometry import LineString, Point, box
from shapely.ops import split, nearest_points

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'tools', '.cache'); os.makedirs(CACHE, exist_ok=True)
UA = {'User-Agent': 'NhaXinhMapRenderer/1.0'}
slug = sys.argv[1] if len(sys.argv) > 1 else 'nha-mat-tien-le-thi-tam-phuoc-ly'
CFG = json.load(open(os.path.join(ROOT, 'data/nha', slug + '.map.json'), encoding='utf8'))
OUT = os.path.join(ROOT, 'public/nha', slug)
H = CFG['house']; BB = CFG['bbox']

def get(url, name, binary=False):
    p = os.path.join(CACHE, name)
    if not os.path.exists(p):
        for i in range(3):
            try:
                data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read(); break
            except Exception as e:
                if i == 2: raise
                time.sleep(2)
        open(p, 'wb').write(data); time.sleep(0.15)
    return open(p, 'rb').read() if binary else open(p, encoding='utf8').read()

# ---------- Web Mercator (pixel thế giới ở zoom z, ô 256) ----------
def wpx(lat, lng, z):
    s = 256 * 2 ** z; x = (lng + 180) / 360 * s
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * s
    return x, y

def stitch(z, s, w, n, e, pad=1):
    """Ảnh vệ tinh Esri World Imagery: lấy ô ở zoom z+1 (256 px) → tương đương ảnh @2x của zoom z."""
    zz = z + 1
    x0, y1 = wpx(s, w, zz); x1, y0 = wpx(n, e, zz)
    tx0, ty0, tx1, ty1 = int(x0 // 256) - pad, int(y0 // 256) - pad, int(x1 // 256) + pad, int(y1 // 256) + pad
    tx0 -= tx0 % 2; ty0 -= ty0 % 2
    img = Image.new('RGB', ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256), '#333')
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            b = get(f'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{zz}/{ty}/{tx}', f'esri-{zz}-{tx}-{ty}.jpg', True)
            img.paste(Image.open(io.BytesIO(b)).convert('RGB'), ((tx - tx0) * 256, (ty - ty0) * 256))
    return img, tx0 * 128, ty0 * 128   # gốc ảnh theo pixel thế giới zoom z (1 px thế giới = 2 px ảnh)

def b64(img, fmt='JPEG', q=88):
    bio = io.BytesIO(); img.save(bio, fmt, quality=q); return base64.b64encode(bio.getvalue()).decode()

# ---------- dữ liệu OSM ----------
m = 0.006
osm = get(f"https://api.openstreetmap.org/api/0.6/map?bbox={BB['w']-m},{BB['s']-m},{BB['e']+m},{BB['n']+m}", f"osm-{slug}.xml")
r = ET.fromstring(osm)
nodes = {n.get('id'): (float(n.get('lat')), float(n.get('lon'))) for n in r.iter('node')}
ways = {w.get('id'): w for w in r.iter('way')}
def wpts(w): return [nodes[nd.get('ref')] for nd in w.iter('nd') if nd.get('ref') in nodes]
def tags(e): return {t.get('k'): t.get('v') for t in e.iter('tag')}

def chains_of(segs):
    segs = [list(x) for x in segs]; out = []
    while segs:
        c = segs.pop(0); ch = True
        while ch:
            ch = False
            for i, s in enumerate(segs):
                if s[0] == c[-1]: c += s[1:]
                elif s[-1] == c[-1]: c += s[::-1][1:]
                elif s[-1] == c[0]: c = s + c[1:]
                elif s[0] == c[0]: c = s[::-1] + c[1:]
                else: continue
                segs.pop(i); ch = True; break
        out.append(c)
    return out

rel = next(x for x in r.iter('relation') if x.get('id') == str(CFG['boundary']['relation']))
bchains = chains_of([wpts(ways[mm.get('ref')]) for mm in rel.iter('member') if mm.get('type') == 'way' and mm.get('ref') in ways and len(wpts(ways[mm.get('ref')])) > 1])
bchain = max(bchains, key=len)
front = wpts(ways[str(CFG['frontRoad']['way'])])
hl_roads = []
for hr in CFG.get('highlightRoads', []):
    segs = [wpts(w) for w in ways.values() if tags(w).get('name') == hr['name'] and 'highway' in tags(w)]
    hl_roads.append((hr, chains_of(segs)))

routes = []
for p in CFG['pois']:
    j = json.loads(get(f"https://router.project-osrm.org/route/v1/driving/{H['lng']},{H['lat']};{p['lng']},{p['lat']}?overview=full&geometries=geojson", f"osrm-{slug}-{p['n']}.json"))
    routes.append([(c[1], c[0]) for c in j['routes'][0]['geometry']['coordinates']])

zone_routes = []
for i, zn in enumerate(CFG.get('zones', [])):
    j = json.loads(get(f"https://router.project-osrm.org/route/v1/driving/{H['lng']},{H['lat']};{zn['lng']},{zn['lat']}?overview=full&geometries=geojson", f"osrm-{slug}-zone{i}.json"))
    r0 = j['routes'][0]; zone_routes.append([(c[1], c[0]) for c in r0['geometry']['coordinates']])
    print(f"Đường đi tới {zn['name']}: {r0['distance']/1000:.1f} km, {r0['duration']/60:.0f} phút")

# khoảng cách thật nhà → ranh (mét, phép chiếu phẳng cục bộ)
kx, ky = 111320 * math.cos(math.radians(H['lat'])), 110574
loc = lambda la, lo: ((lo - H['lng']) * kx, (la - H['lat']) * ky)
bl = LineString([loc(*p) for p in bchain]); hp = Point(0, 0)
near = nearest_points(hp, bl)[1]
dist_m = hp.distance(bl)
near_ll = (H['lat'] + near.y / ky, H['lng'] + near.x / kx)
print(f'Khoảng cách nhà → ranh: {dist_m:.1f} m (điểm ranh gần nhất {near_ll[0]:.6f}, {near_ll[1]:.6f})')

Z = 16
base, ox, oy = stitch(Z, BB['s'] - 0.012, BB['w'] - 0.012, BB['n'] + 0.012, BB['e'] + 0.012)
ZI = 18
inset_img, iox, ioy = stitch(ZI, H['lat'] - 0.0012, H['lng'] - 0.0012, H['lat'] + 0.0012, H['lng'] + 0.0012, pad=1)
photo = os.path.join(OUT, H['photo'])
photo_b64 = b64(Image.open(photo).convert('RGB').resize((160, 160 * Image.open(photo).height // Image.open(photo).width)), 'JPEG', 85)
FONT = lambda f: 'file://' + os.path.join(ROOT, 'public/fonts', f)

def render_html(W, Hh, vertical):
    B = CFG['boundary']
    # khung nhìn: phủ bbox, chừa chỗ cho thẻ tiêu đề (trên) và ô phóng to
    (sx0, sy1), (sx1, sy0) = wpx(BB['s'], BB['w'], Z), wpx(BB['n'], BB['e'], Z)
    # Bản dọc hiện ~350px trên điện thoại → chữ phóng to (fsBoost_v) và bớt nhãn (minimal_v): bỏ thẻ tiêu đề, nhãn đường, điểm xa;
    # tiện ích chỉ còn số tròn (khớp bảng khoảng cách ngay dưới bản đồ).
    MIN = vertical and CFG.get('minimal_v', False)
    padt, padb, padl, padr = (0.17, 0.05, 0.03, 0.03) if not vertical else ((0.05 if MIN else 0.16), 0.24, 0.03, 0.03)
    bw, bh = sx1 - sx0, sy1 - sy0
    sc = min(W * (1 - padl - padr) / bw, Hh * (1 - padt - padb) / bh)
    cx = (sx0 + sx1) / 2 + (padr - padl) * W / sc / 2; cy = (sy0 + sy1) / 2 - (padt - padb) * Hh / sc / 2
    vx0, vy0 = cx - W / 2 / sc, cy - Hh / 2 / sc
    S = lambda la, lo: ((wpx(la, lo, Z)[0] - vx0) * sc, (wpx(la, lo, Z)[1] - vy0) * sc)
    pts = lambda arr: ' '.join(f'{x:.1f},{y:.1f}' for x, y in (S(*p) for p in arr))
    hx, hy = S(H['lat'], H['lng'])
    big = box(-2 * W, -2 * Hh, 3 * W, 3 * Hh)
    sp = [S(*p) for p in bchain]
    def ext(a, b):  # kéo dài đầu mút theo hướng đoạn cuối ra ngoài khung lớn
        dx, dy = a[0] - b[0], a[1] - b[1]; L = math.hypot(dx, dy) or 1; return (a[0] + dx / L * 10 * W, a[1] + dy / L * 10 * W)
    sp = [ext(sp[0], sp[1])] + sp + [ext(sp[-1], sp[-2])]
    parts = list(split(big, LineString(sp)).geoms)
    hcm = [g for g in parts if not g.contains(Point(hx, hy))]
    poly = lambda g: ' '.join(f'{x:.1f},{y:.1f}' for x, y in g.exterior.coords)
    fs = W / 800 * (CFG.get('fsBoost_v', 1) if vertical else 1)
    V = '_v' if vertical else ''
    P = lambda obj, key, ll: ((obj[key + V][0] * W, obj[key + V][1] * Hh) if key + V in obj else S(*ll))
    inx, iny = P(B, 'inPos', B['inAt']); outx, outy = P(B, 'outPos', B['outAt'])
    # ô phóng to quanh nhà (z18 → 1 px thế giới = 1 px CSS)
    IR = 88 if not vertical else round(96 * (1.3 if MIN else 1))
    icx, icy = (W - IR - 22, Hh - IR - 34) if not vertical else (W - IR - 24, Hh - IR - 34)
    ihx, ihy = wpx(H['lat'], H['lng'], ZI); isc = 1.0
    ibx, iby = (wpx(*near_ll, ZI)[0] - ihx) * isc, (wpx(*near_ll, ZI)[1] - ihy) * isc
    iline = ' '.join(f'{(wpx(la, lo, ZI)[0]-ihx)*isc:.1f},{(wpx(la, lo, ZI)[1]-ihy)*isc:.1f}' for la, lo in bchain)
    ifront = ' '.join(f'{(wpx(la, lo, ZI)[0]-ihx)*isc:.1f},{(wpx(la, lo, ZI)[1]-ihy)*isc:.1f}' for la, lo in front)
    head_bottom = 16 * fs + (86 * fs)
    # điểm xa: mũi tên ở mép khung theo đúng hướng từ căn nhà
    def edge(la, lo):
        tx, ty = S(la, lo); dx, dy = tx - hx, ty - hy; L = math.hypot(dx, dy); dx, dy = dx / L, dy / L
        ts = []
        for v, lo_, hi in ((dx, 16 - hx, W - 16 - hx), (dy, head_bottom + 30 * fs - hy, Hh - 40 * fs - hy)):
            if v > 0: ts.append(hi / v)
            elif v < 0: ts.append(lo_ / v)
        t = min(ts); return hx + dx * t, hy + dy * t, math.degrees(math.atan2(dy, dx))
    far_html = ''
    for f in ([] if MIN else CFG.get('far', [])):
        ex, ey, ang = edge(f['lat'], f['lng'])
        if 'pos' + V in f:
            ex, ey = f['pos' + V][0] * W, f['pos' + V][1] * Hh
            tx, ty = S(f['lat'], f['lng']); ang = math.degrees(math.atan2(ty - hy, tx - hx))
        al = f.get('align' + V) or ('r' if ex > W * .66 else ('l' if ex < W * .34 else 'c'))
        far_html += f'<div class="far far-{al}" style="left:{ex:.0f}px;top:{ey:.0f}px"><span class="arr" style="transform:rotate({ang:.0f}deg)">➜</span><span><b>{f["name"]}</b><small>{f["sub"]}</small></span></div>'
    poi_html = ''
    for p in CFG['pois']:
        px_, py_ = S(p['lat'], p['lng'])
        side = p.get('side_v' if vertical else 'side', 'r')
        lbl = '' if MIN else f'<span>{p.get("short", p["name"])}</span>'
        poi_html += f'<div class="poi poi-{side}" style="left:{px_:.0f}px;top:{py_:.0f}px"><i>{p["n"]}</i>{lbl}</div>'
    road_svg = ''.join(f'<polyline points="{pts(c)}" class="{"minor" if hr.get("style") == "minor" else "xway"}"/>' for hr, cs in hl_roads for c in cs)
    zone_svg = ''.join(f'<polyline points="{pts(rt)}" class="zroute"/>' for rt in zone_routes)
    zone_html = ''
    for zn in CFG.get('zones', []):
        zx, zy = S(zn['lat'], zn['lng']); cxp, cyp = P(zn, 'pos', (zn['lat'], zn['lng']))
        zside = zn.get('side' + V, 'c')
        zone_svg += f'<line x1="{zx:.1f}" y1="{zy:.1f}" x2="{cxp:.1f}" y2="{cyp:.1f}" stroke="#FDE68A" stroke-width="{2*fs:.1f}"/>'
        zsub = '' if MIN else f'<span>{zn["sub"]}</span>'
        zone_html += f'<div class="zmark" style="left:{zx:.0f}px;top:{zy:.0f}px">🎓</div><div class="zcard zc-{zside}" style="left:{cxp:.0f}px;top:{cyp:.0f}px"><b>{zn["name"]}</b>{zsub}<small>{zn["note"]}</small></div>'
    road_lbl = ''
    for hr, cs in hl_roads:
        if cs and not MIN and ('at' in hr or 'pos' + V in hr):
            ax_, ay_ = P(hr, 'pos', hr.get('at')); road_lbl += f'<div class="rlbl xl" style="left:{ax_:.0f}px;top:{ay_:.0f}px">{hr["label"]}</div>'
    fx, fy = P(CFG['frontRoad'], 'pos', CFG['frontRoad']['at'])
    mpp = 156543.03 * math.cos(math.radians(H['lat'])) / 2 ** Z / sc
    sbar = 500 / mpp
    bx_, by_ = P(H, 'photoPos', (H['lat'], H['lng']))
    card_side = H.get('cardSide' + V, 'l')
    HEAD = f'<div class="head"><p class="ey">Vị trí căn nhà</p><h1>Sát ranh TP.HCM · Mặt tiền Lê Thị Tám</h1><p class="sl">Qua ranh sang xã Hưng Long (Bình Chánh cũ) chỉ ~{round(dist_m)} m</p></div>'
    if os.environ.get('MAPDEBUG'):
        print(('DOC' if vertical else 'NGANG'), 'nhà', round(hx*2), round(hy*2), 'zones', [tuple(round(v*2) for v in S(z['lat'], z['lng'])) for z in CFG.get('zones', [])], 'pois', [tuple(round(v*2) for v in S(p['lat'], p['lng'])) for p in CFG['pois']], 'near', tuple(round(v*2) for v in S(*near_ll)))
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:G;src:url({FONT('geist-vietnamese-wght-normal.woff2')});font-weight:100 900;unicode-range:U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB}}
@font-face{{font-family:G;src:url({FONT('geist-latin-ext-wght-normal.woff2')});font-weight:100 900;unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}}
@font-face{{font-family:G;src:url({FONT('geist-latin-wght-normal.woff2')});font-weight:100 900}}
@font-face{{font-family:P;src:url({FONT('playfair-display-vietnamese-600-italic.woff2')});font-style:italic;font-weight:600;unicode-range:U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9}}
@font-face{{font-family:P;src:url({FONT('playfair-display-latin-600-italic.woff2')});font-style:italic;font-weight:600}}
*{{margin:0;padding:0;box-sizing:border-box}} body{{width:{W}px;height:{Hh}px;overflow:hidden;font-family:G,sans-serif;color:#0B0B0B;position:relative;background:#1c2a20}}
.base{{position:absolute;left:{(ox-vx0)*sc:.1f}px;top:{(oy-vy0)*sc:.1f}px;width:{base.width/2*sc:.1f}px;filter:brightness(.82) saturate(.85) contrast(1.05)}}
svg.ov{{position:absolute;inset:0;width:{W}px;height:{Hh}px}}
.hcm{{fill:#4ADE80;fill-opacity:.26;mix-blend-mode:screen}}
.bnd-w{{fill:none;stroke:#fff;stroke-width:{8*fs:.1f};stroke-linejoin:round;opacity:.95}} .bnd{{fill:none;stroke:#F97316;stroke-width:{4.2*fs:.1f};stroke-linejoin:round;stroke-dasharray:{11*fs:.0f} {6*fs:.0f}}}
.xway{{fill:none;stroke:#FBBF24;stroke-width:{5*fs:.1f};stroke-linecap:round;opacity:.9}}
.minor{{fill:none;stroke:#FDE68A;stroke-width:{2.6*fs:.1f};stroke-linecap:round;opacity:.75}}
.zroute{{fill:none;stroke:#FDE68A;stroke-width:{3*fs:.1f};stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:{2*fs:.0f} {6*fs:.0f};opacity:.95}}
.zmark{{position:absolute;transform:translate(-50%,-50%);width:{40*fs:.0f}px;height:{40*fs:.0f}px;border-radius:50%;background:#FBBF24;border:3px solid #fff;display:grid;place-items:center;font-size:{20*fs:.0f}px;box-shadow:0 0 0 {10*fs:.0f}px rgba(251,191,36,.25),0 0 0 {22*fs:.0f}px rgba(251,191,36,.12),0 8px 20px rgba(0,0,0,.45)}}
.zcard{{position:absolute;transform:translate(-50%,-50%);background:linear-gradient(135deg,#FEF3C7,#FDE68A);color:#451A03;border-radius:{12*fs:.0f}px;padding:{8*fs:.0f}px {12*fs:.0f}px;box-shadow:0 10px 26px rgba(0,0,0,.45);{'white-space:nowrap' if MIN else 'width:'+str(round(205*fs))+'px'};border:2px solid #fff}}
.zc-l{{transform:translate(-100%,-50%)}} .zc-r{{transform:translate(0,-50%)}}
.zcard b{{display:block;font-size:{14*fs:.0f}px;text-transform:uppercase;letter-spacing:.04em}} .zcard span{{display:block;font-size:{11*fs:.0f}px;font-weight:600;margin-top:2px;line-height:1.3}} .zcard small{{display:block;font-size:{10.5*fs:.0f}px;font-weight:800;color:#92400E;margin-top:3px}}
.route{{fill:none;stroke:#BBF7D0;stroke-width:{3*fs:.1f};stroke-linecap:round;stroke-linejoin:round;opacity:.85}}
.front{{fill:none;stroke:#fff;stroke-width:{6*fs:.1f};stroke-linecap:round;opacity:.9}}
.zone{{position:absolute;transform:translate(-50%,-50%);text-align:center;font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:{15*fs:.0f}px;line-height:1.15;color:#fff;padding:{6*fs:.0f}px {12*fs:.0f}px;border-radius:{10*fs:.0f}px;white-space:nowrap}}
.zone small{{display:block;font-size:{11*fs:.0f}px;letter-spacing:.03em;font-weight:600;text-transform:none;margin-top:2px;opacity:.9}}
.zone.in{{background:rgba(20,83,45,.88);box-shadow:0 6px 18px rgba(0,0,0,.35)}} .zone.out{{background:rgba(28,25,23,.62)}}
.house{{position:absolute;left:{bx_:.1f}px;top:{by_:.1f}px;transform:translate(-50%,-50%)}}
.pin{{width:{70*fs:.0f}px;height:{70*fs:.0f}px;border-radius:50%;border:{4*fs:.0f}px solid #fff;box-shadow:0 0 0 {4*fs:.0f}px #14532D,0 10px 24px rgba(0,0,0,.5);background:url(data:image/jpeg;base64,{photo_b64}) center/cover;position:relative}}
.pin::after{{display:none}}
.pulse{{position:absolute;left:{hx:.1f}px;top:{hy:.1f}px;width:{30*fs:.0f}px;height:{30*fs:.0f}px;border-radius:50%;transform:translate(-50%,-50%);background:rgba(255,255,255,.35);box-shadow:0 0 0 {10*fs:.0f}px rgba(255,255,255,.18),0 0 0 {22*fs:.0f}px rgba(255,255,255,.08)}}
.dot{{position:absolute;left:{hx:.1f}px;top:{hy:.1f}px;width:{13*fs:.0f}px;height:{13*fs:.0f}px;border-radius:50%;background:#14532D;border:3px solid #fff;transform:translate(-50%,-50%)}}
.hcard{{position:absolute;left:{bx_ + {'l': -44, 'r': 44, 'b': 0}[card_side]*fs:.1f}px;top:{by_ + (40*fs if card_side == 'b' else 0):.1f}px;transform:translate({ {'l': '-100%', 'r': '0', 'b': '-50%'}[card_side] },{'0' if card_side == 'b' else '-50%'});text-align:{'center' if card_side == 'b' else 'left'};background:#fff;border-radius:{12*fs:.0f}px;padding:{8*fs:.0f}px {12*fs:.0f}px;box-shadow:0 10px 26px rgba(0,0,0,.4);white-space:nowrap;border-left:{5*fs:.0f}px solid #14532D}}
.hcard b{{display:block;font-size:{14.5*fs:.0f}px;color:#0B3B22}} .hcard span{{display:block;font-size:{12*fs:.0f}px;color:#C2410C;font-weight:800;margin-top:1px}}
.poi{{position:absolute;display:flex;align-items:center;gap:{5*fs:.0f}px;transform:translate(-{12*fs:.0f}px,-50%)}}
.poi-l{{flex-direction:row-reverse;transform:translate(calc(-100% + {12*fs:.0f}px),-50%)}}
.poi-b{{flex-direction:column;transform:translate(-50%,-{12*fs:.0f}px)}} .poi-t{{flex-direction:column-reverse;transform:translate(-50%,calc(-100% + {12*fs:.0f}px))}}
.poi i{{font-style:normal;width:{24*fs:.0f}px;height:{24*fs:.0f}px;border-radius:50%;background:#14532D;border:2.5px solid #fff;color:#fff;font-weight:800;font-size:{13*fs:.0f}px;display:grid;place-items:center;box-shadow:0 3px 8px rgba(0,0,0,.4);flex:none}}
.poi span{{background:rgba(255,255,255,.95);font-size:{12*fs:.0f}px;font-weight:700;padding:{3*fs:.0f}px {8*fs:.0f}px;border-radius:7px;box-shadow:0 2px 6px rgba(0,0,0,.25);white-space:nowrap;color:#0B3B22}}
.rlbl{{position:absolute;transform:translate(-50%,-50%);font-size:{11*fs:.0f}px;font-weight:800;white-space:nowrap;padding:{3*fs:.0f}px {9*fs:.0f}px;border-radius:6px}}
.rlbl.xl{{background:#FBBF24;color:#451A03}} .rlbl.fr{{background:#fff;color:#14532D;box-shadow:0 3px 10px rgba(0,0,0,.3)}}
.far{{position:absolute;display:flex;align-items:center;gap:{7*fs:.0f}px;background:rgba(11,59,34,.95);color:#fff;padding:{6*fs:.0f}px {11*fs:.0f}px;border-radius:999px;box-shadow:0 6px 16px rgba(0,0,0,.4);white-space:nowrap;transform:translate(-50%,-50%);border:1.5px solid rgba(243,227,181,.6)}}
.far-r{{transform:translate(-100%,-50%)}} .far-l{{transform:translate(0,-50%)}}
.far b{{display:block;font-size:{12.5*fs:.0f}px}} .far small{{display:block;font-size:{10.5*fs:.0f}px;color:#F3E3B5;font-weight:600}}
.far .arr{{display:inline-block;color:#F3E3B5;font-size:{14*fs:.0f}px}}
.head{{position:absolute;left:{16*fs:.0f}px;top:{16*fs:.0f}px;{'right:'+str(round(16*fs))+'px' if vertical else 'max-width:'+str(round(W*.62))+'px'};background:rgba(255,255,255,.97);border-radius:{14*fs:.0f}px;padding:{11*fs:.0f}px {15*fs:.0f}px;box-shadow:0 10px 30px rgba(0,0,0,.35);border-left:{6*fs:.0f}px solid #14532D}}
.head .ey{{font-size:{10.5*fs:.0f}px;font-weight:800;letter-spacing:.14em;color:#166534;text-transform:uppercase}}
.head h1{{font-size:{19*fs:.0f}px;line-height:1.2;margin-top:2px;color:#0B0B0B}}
.head .sl{{font-family:P,serif;font-style:italic;font-weight:600;color:#9A7B2F;font-size:{13.5*fs:.0f}px;margin-top:2px}}
.inset{{position:absolute;left:{icx:.0f}px;top:{icy:.0f}px;width:{2*IR}px;height:{2*IR}px;transform:translate(-50%,-50%);border-radius:50%;overflow:hidden;border:4px solid #fff;box-shadow:0 0 0 3px #F97316,0 14px 30px rgba(0,0,0,.5)}}
.inset img{{position:absolute;left:{IR - (ihx - iox)*isc:.1f}px;top:{IR - (ihy - ioy)*isc:.1f}px;width:{inset_img.width/2*isc:.1f}px;filter:brightness(.9)}}
.inset svg{{position:absolute;inset:0;width:{2*IR}px;height:{2*IR}px;overflow:visible}}
.itl{{position:absolute;left:{icx:.0f}px;top:{icy - IR - 10:.0f}px;transform:translate(-50%,-100%);background:#F97316;color:#fff;font-size:{10.5*fs:.0f}px;font-weight:800;padding:3px 10px;border-radius:999px;white-space:nowrap;letter-spacing:.05em;box-shadow:0 4px 10px rgba(0,0,0,.35)}}
.foot{{position:absolute;left:{14*fs:.0f}px;bottom:{8*fs:.0f}px;display:flex;align-items:flex-end;gap:12px;font-size:{9.5*fs:.0f}px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8)}}
.sbar{{height:6px;border:2px solid #fff;border-top:0;width:{sbar:.0f}px;box-shadow:0 1px 2px rgba(0,0,0,.6)}}
</style></head><body>
<img class="base" src="data:image/jpeg;base64,{b64(base)}">
<svg class="ov" viewBox="0 0 {W} {Hh}">
  {''.join(f'<polygon class="hcm" points="{poly(g)}"/>' for g in hcm)}
  {road_svg}
  {zone_svg}
  {''.join(f'<polyline class="route" points="{pts(rt)}"/>' for rt in routes)}
  <polyline class="front" points="{pts(front)}"/>
  <polyline class="bnd-w" points="{pts(bchain)}"/><polyline class="bnd" points="{pts(bchain)}"/>
  <line x1="{icx:.1f}" y1="{icy:.1f}" x2="{hx:.1f}" y2="{hy:.1f}" stroke="#fff" stroke-width="{2*fs:.1f}" stroke-dasharray="5 4" opacity=".8"/>
  <line x1="{bx_:.1f}" y1="{by_:.1f}" x2="{hx:.1f}" y2="{hy:.1f}" stroke="#fff" stroke-width="{3*fs:.1f}"/>
</svg>
<div class="zone in" style="left:{inx:.0f}px;top:{iny:.0f}px">{B['inLabel']}<small>{B['inSub']}</small></div>
<div class="zone out" style="left:{outx:.0f}px;top:{outy:.0f}px">{B['outLabel']}<small>{B['outSub']}</small></div>
{road_lbl}
{'' if MIN else f'<div class="rlbl fr" style="left:{fx:.0f}px;top:{fy:.0f}px">{CFG["frontRoad"]["label"]}</div>'}
{poi_html}
{zone_html}
<div class="pulse"></div><div class="dot"></div>
<div class="house"><div class="pin"></div></div>
<div class="hcard"><b>{H['title']}</b><span>{B['callout']}</span></div>
{far_html}
<div class="itl">PHÓNG TO · ĐIỂM RANH</div>
<div class="inset"><img src="data:image/jpeg;base64,{b64(inset_img)}"><svg viewBox="{-IR} {-IR} {2*IR} {2*IR}">
  <polyline points="{ifront}" fill="none" stroke="#fff" stroke-width="5" opacity=".75" stroke-linecap="round"/>
  <polyline points="{iline}" fill="none" stroke="#fff" stroke-width="8"/><polyline points="{iline}" fill="none" stroke="#F97316" stroke-width="4.5" stroke-dasharray="9 5"/>
  <line x1="0" y1="0" x2="{ibx:.1f}" y2="{iby:.1f}" stroke="#fff" stroke-width="3"/>
  <circle cx="0" cy="0" r="10" fill="#14532D" stroke="#fff" stroke-width="3"/>
  <text x="{ibx/2 + 9:.1f}" y="{iby/2 + 5:.1f}" font-family="G" font-weight="800" font-size="{15*max(1, fs*800/W*(0.85 if vertical else 1)):.0f}" fill="#fff" stroke="#0B3B22" stroke-width="4" paint-order="stroke">~{round(dist_m)} m</text>
</svg></div>
{'' if MIN else HEAD}
<div class="foot"><div><div class="sbar"></div>500 m</div><span>Ảnh vệ tinh © Esri · Ranh, đường © OpenStreetMap · Đường đi đo bằng OSRM</span></div>
</body></html>"""

async def shoot():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--allow-file-access-from-files'])
        for name, W, Hh, vert, sizes in (('ban-do-ngang', 800, 500, False, (1600, 800)), ('ban-do-doc', 585, 780, True, (1170, 780))):
            html = render_html(W, Hh, vert)
            fp = os.path.join(CACHE, name + '.html'); open(fp, 'w', encoding='utf8').write(html)
            pg = await b.new_page(viewport={'width': W, 'height': Hh}, device_scale_factor=2)
            await pg.goto('file://' + fp); await pg.wait_for_timeout(600)
            png = await pg.screenshot(type='png'); await pg.close()
            im = Image.open(io.BytesIO(png)).convert('RGB')
            im.resize((sizes[0], round(im.height * sizes[0] / im.width)), Image.LANCZOS).save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=82)
            im.resize((sizes[1], round(im.height * sizes[1] / im.width)), Image.LANCZOS).save(os.path.join(OUT, name + '-800.webp'), 'WEBP', quality=80)
            print('→', name, im.size)
        await b.close()

asyncio.run(shoot())
