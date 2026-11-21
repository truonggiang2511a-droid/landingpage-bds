# Dựng bản xem thử (artifact claude.ai) từ dist: bỏ pixel TikTok/Meta, form chạy demo (không gửi lead), thêm dải báo.
# Chạy sau `node build.mjs`: python3 tools/xem-thu.py [slug] [thư mục ra, mặc định xem-thu/]
import re, shutil, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
slug = sys.argv[1] if len(sys.argv) > 1 else 'nha-mat-tien-le-thi-tam-phuoc-ly'
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'xem-thu')
src = os.path.join(ROOT, 'dist', slug, 'index.html')
s = open(src).read()
s = s.replace('../fonts/', 'fonts/').replace('../nha/', 'nha/').replace('../app.js', 'app.js').replace('../chinh-sach', 'chinh-sach')
s = s.replace('"demo":false', '"demo":true').replace('"leadApi":true', '"leadApi":false')
s, n1 = re.subn(r'<script>!function\(w,d,t\)\{w\.TiktokAnalyticsObject.*?</script>\n?', '', s, flags=re.S)
s, n2 = re.subn(r'<script>!function\(f,b,e,v,n,t,s\)\{if\(f\.fbq\).*?</script>\n?', '', s, flags=re.S)
assert n1 == 1 and n2 == 1, (n1, n2)
assert 'googletagmanager' not in s and 'analytics.tiktok' not in s and 'fbevents' not in s
s = s.replace('<body>\n', '<body>\n<div style="background:#FEF3C7;color:#78350F;font-size:13px;line-height:1.4;padding:8px 14px;text-align:center">Bản xem thử giao diện — form chưa gửi đi; video, nút Gọi/Zalo chạy trên web thật</div>\n', 1)
assert '../' not in s, re.findall(r'.{30}\.\./.{30}', s)[:3]
os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'index.html'), 'w').write(s)
shutil.copy(os.path.join(ROOT, 'dist', 'app.js'), os.path.join(out, 'app.js'))
for d in ('fonts', os.path.join('nha', slug)):
    shutil.copytree(os.path.join(ROOT, 'dist', d), os.path.join(out, d), dirs_exist_ok=True)
print('ok', len(s))
