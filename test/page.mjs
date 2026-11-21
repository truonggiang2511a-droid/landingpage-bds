// Kiểm tra trang đã dựng trong dist/: đủ phần chuyển đổi, mọi ảnh/font tham chiếu đều có file, không còn link cũ.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const DIST = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'dist');
const SITE = JSON.parse(fs.readFileSync(path.join(DIST, '..', 'data/site.json'), 'utf8'));
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✓', name); } catch (e) { fail++; console.log('✗', name, '\n   ', e.message); } };

const houses = fs.readdirSync(path.join(DIST, '..', 'data/nha')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(DIST, '..', 'data/nha', f), 'utf8')));
for (const h of houses) {
  const file = path.join(DIST, h.slug, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  t(`${h.slug}: có form, nút gọi, Zalo, thanh dưới`, () => {
    for (const s of ['id="leadForm"', 'name="phone"', `tel:${SITE.phone}`, SITE.zalo, 'id="bar"', 'window.LP=']) assert.ok(html.includes(s), 'thiếu ' + s);
  });
  t(`${h.slug}: pixel TikTok/Meta đúng mã, link chia sẻ/canonical trỏ đúng baseUrl đang chạy`, () => {
    if (SITE.tracking.tiktokPixelId) assert.ok(html.includes(SITE.tracking.tiktokPixelId));
    if (SITE.tracking.metaPixelId) assert.ok(html.includes(SITE.tracking.metaPixelId));
    // Zalo Ads: pixel tải sau load + 3 nút có ID cố định (chuyển đổi Zalo đo theo ID nút) — đổi ID là mất đo
    if (SITE.tracking.zaloPixelId) assert.ok(html.includes('ztracker.js?id=') && html.includes(SITE.tracking.zaloPixelId), 'thiếu pixel Zalo');
    for (const id of ['leadBtn', 'barCall', 'barZalo']) assert.ok(html.includes(`id="${id}"`), 'thiếu id ' + id);
    // canonical, og:url, og:image phải trỏ về baseUrl (đang là pages.dev khi chưa có tên miền) — trỏ tên miền chết = mất ảnh xem trước khi chia sẻ
    const base = SITE.baseUrl.replace(/\/$/, '');
    for (const m of html.matchAll(/(?:rel="canonical" href|property="og:(?:url|image)" content)="([^"]+)"/g)) assert.ok(m[1].startsWith(base), 'link lệch baseUrl: ' + m[1]);
    if (!/pages\.dev/.test(base)) assert.ok(!/pages\.dev/.test(html), 'đã có tên miền nhưng còn link pages.dev');
    if (SITE.tracking.gtmId) assert.ok(html.includes(SITE.tracking.gtmId)); else assert.ok(!html.includes('googletagmanager'));
  });
  t(`${h.slug}: video đầu trang chỉ là ảnh bìa (không nhúng iframe YouTube sẵn)`, () => {
    assert.ok(!/<iframe/.test(html));
    if (h.video && h.video.youtube) assert.ok(html.includes(`data-yt="${h.video.youtube}"`));
  });
  t(`${h.slug}: mọi file tham chiếu đều tồn tại`, () => {
    const refs = new Set();
    for (const m of html.matchAll(/(?:src|href|data-zoom|data-zoom-m)="(\.\.\/[^"?#]+)/g)) refs.add(m[1]);
    for (const m of html.matchAll(/srcset="([^"]+)"/g)) m[1].split(',').forEach((x) => { const u = x.trim().split(' ')[0]; if (u.startsWith('../')) refs.add(u); });
    for (const m of html.matchAll(/"src":"(\.\.\/[^"]+)"/g)) refs.add(m[1]);
    const missing = [...refs].filter((r) => !r.endsWith('/') && !fs.existsSync(path.join(DIST, h.slug, r)));
    assert.deepEqual(missing, []);
  });
}
t('CRM: đã chèn cấu hình, không còn supabase-js/Auth', () => {
  const html = fs.readFileSync(path.join(DIST, 'crm/index.html'), 'utf8');
  const js = fs.readFileSync(path.join(DIST, 'crm/crm.js'), 'utf8');
  assert.ok(!html.includes('__CRM_CONFIG__') && html.includes(SITE.crm.supabaseUrl));
  assert.ok(!/supabase-js|\.auth\./.test(js));
});
t('robots chặn /crm/, có sitemap, có link ngắn', () => {
  assert.match(fs.readFileSync(path.join(DIST, 'robots.txt'), 'utf8'), /Disallow: \/crm\//);
  assert.ok(fs.existsSync(path.join(DIST, 'sitemap.xml')));
  assert.match(fs.readFileSync(path.join(DIST, '_redirects'), 'utf8'), /-zalo .*utm_source=zalo/);
});
console.log(`\n${pass} đạt, ${fail} lỗi`);
if (fail) process.exit(1);
