// Dựng web tĩnh vào dist/: 1 file data/nha/<slug>.json = 1 trang căn /<slug>/.
// Chạy: node build.mjs   (SITE_URL=... để đổi tên miền gốc khi cần, mặc định lấy data/site.json → baseUrl)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ic } from './src/icons.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, 'dist');
const SITE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/site.json'), 'utf8'));
const BASE = (process.env.SITE_URL || SITE.baseUrl).replace(/\/$/, '');
const T = SITE.tracking || {};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const vnd = (n) => new Intl.NumberFormat('vi-VN').format(n);
const ty = (n) => (n >= 1e9 ? `${(n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ` : `${Math.round(n / 1e6).toLocaleString('vi-VN')} triệu`);
const telHref = `tel:${SITE.phone}`;

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
const write = (rel, content) => { const p = path.join(OUT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); };

// ---------- dựng ----------
rmrf(OUT);
fs.mkdirSync(OUT, { recursive: true });
copyDir(path.join(ROOT, 'public'), OUT);
const css = fs.readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
const V = crypto.createHash('md5').update(css + js + fs.readFileSync(path.join(ROOT, 'src/crm/crm.js'), 'utf8')).digest('hex').slice(0, 8);
write('styles.css', css);
write('app.js', js);
copyDir(path.join(ROOT, 'src/crm'), path.join(OUT, 'crm'));

// Hàm máy chủ đọc cấu hình Supabase từ file sinh ra (không cần nhập tay biến môi trường)
fs.writeFileSync(path.join(ROOT, 'functions/_lib/site.gen.js'),
  `// TỰ SINH bởi build.mjs từ data/site.json — đừng sửa tay.\nexport const SITE = ${JSON.stringify({ baseUrl: BASE, crm: { supabaseUrl: SITE.crm.supabaseUrl, supabaseKey: SITE.crm.supabaseKey } }, null, 2)};\n`);

const LOGO = (size) => `<svg class="logo" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="${SITE.color}"/><path d="M8 30V17l6.5-6 5.5 5 5.5-5 6.5 6v13" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/><path d="M14.5 30v-9.5L20 25.5l5.5-5V30" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
const FAVICON = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="11" fill="${SITE.color}"/><path d="M8 30V17l6.5-6 5.5 5 5.5-5 6.5 6v13" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/><path d="M14.5 30v-9.5L20 25.5l5.5-5V30" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/></svg>`);

// Pixel/thẻ đo: tải SAU khi trang hiện xong (load + rảnh) để không làm chậm trang trên điện thoại.
function trackingHead() {
  let h = '';
  if (T.tiktokPixelId) h += `<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.page();var go=function(){ttq.load(${JSON.stringify(T.tiktokPixelId)})};w.addEventListener("load",function(){(w.requestIdleCallback||setTimeout)(go,{timeout:2500})});}(window,document,"ttq");</script>\n`;
  if (T.metaPixelId) h += `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];f.addEventListener('load',function(){(f.requestIdleCallback||setTimeout)(function(){t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)},{timeout:2500})})}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(T.metaPixelId)});fbq('track','PageView');</script>\n`;
  // GTM — CHỈ cho thẻ Google (Google Ads, GA4). Sự kiện trong dataLayer: lead_submit, contact_click, video_play.
  if (T.gtmId) h += `<script>window.dataLayer=window.dataLayer||[];window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});addEventListener('load',function(){(window.requestIdleCallback||setTimeout)(function(){var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtm.js?id=${esc(T.gtmId)}';document.head.appendChild(s)},{timeout:2000})});</script>\n`;
  if (T.metaDomainVerification) h += `<meta name="facebook-domain-verification" content="${esc(T.metaDomainVerification)}">\n`;
  return h;
}

function head({ title, description, url, image, rel = '', extra = '', noindex = false }) {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="${SITE.color}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<link rel="icon" href="${FAVICON}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${image ? `<meta property="og:image" content="${image}">\n` : ''}<meta property="og:url" content="${url}">
<link rel="preload" href="${rel}fonts/geist-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${rel}fonts/geist-vietnamese-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<script>document.documentElement.classList.add('rv-on');setTimeout(function(){if(!window.__rv)document.documentElement.classList.remove('rv-on')},2500)</script>
${extra}<style>${css.replaceAll('url(fonts/', `url(${rel}fonts/`)}</style>
${trackingHead()}</head>`;
}

const topBar = (rel = '../') => `<header class="top"><div class="wrap top-in">
  <a class="brand" href="#top">${LOGO(36)}<span class="brand-t rev"><b>${esc(SITE.brandTop)}</b><small>${esc(SITE.brandSub)}</small></span></a>
  <div class="top-r"><a class="top-call" href="${telHref}">${ic('phone')}<span>${esc(SITE.phoneText)}</span></a><a class="btn btn-primary top-book" href="#dat-lich" data-mode="xem">Đặt lịch xem</a></div>
</div></header>`;

function img(slug, file, { sizes = '100vw', alt = '', lazy = true, cls = '', w = [400, 800, 1600] } = {}) {
  const d = `../nha/${slug}/`;
  const set = w.map((x) => (x === 1600 ? `${d}${file}.webp 1600w` : `${d}${file}-${x}.webp ${x}w`)).join(', ');
  return `<img${cls ? ` class="${cls}"` : ''} src="${d}${file}.webp" srcset="${set}" sizes="${sizes}" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ' fetchpriority="high"'} decoding="async">`;
}

function heroHtml(h) {
  const d = `../nha/${h.slug}/`;
  const info = `<div class="hero-in${h.video && h.video.youtube ? '' : ' wrap'}">
    ${SITE.slogan ? `<p class="slogan">${esc(SITE.slogan)}</p>` : ''}
    <p class="hero-tag">${ic('pin')}<span>${esc(h.tag)}</span></p>
    <h1>${esc(h.name)}</h1>
    ${h.downPct ? `<div class="hero-price hp-down">
      <span class="hp-l">Trả trước chỉ từ</span>
      <span class="hp-row"><span class="price">${esc(ty(h.price * h.downPct / 100))}</span><span class="hp-pct">${h.downPct}%</span></span>
      <span class="hp-sub">Giá ${esc(h.priceText)}${h.priceOld ? ` <s>${esc(h.priceOld)}</s>` : ''} · ${esc(h.loanNote || h.priceNote)}</span>
    </div>` : `<div class="hero-price"><span class="price">${esc(h.priceText)}</span>${h.priceOld ? `<span class="price-old">${esc(h.priceOld)}</span>` : ''}<span class="price-note">${esc(h.priceNote)}</span></div>`}
    ${(h.strengths || []).length ? `<ul class="strengths">${h.strengths.map((x) => `<li>${ic('check')}<span>${esc(x)}</span></li>`).join('')}</ul>` : `<p class="hero-sub">${esc(h.sub)}</p>`}
    <ul class="chips">${h.chips.map((c, i) => `<li>${ic(h.chipIcons[i] || 'check')}<span>${esc(c)}</span></li>`).join('')}</ul>
    <div class="hero-cta" id="heroCta">
      <a class="btn btn-primary" href="#dat-lich" data-mode="xem">${ic('calendar')}Đặt lịch xem nhà</a>
      <div class="hero-cta2">
        <a class="btn btn-call" href="${telHref}">${ic('phone')}Gọi ngay</a>
        <a class="btn btn-ghost" href="${SITE.zalo}" target="_blank" rel="noopener">${ic('zalo')}Nhắn Zalo</a>
      </div>
    </div>
    <p class="hero-trust">${ic('shield')}<span>${esc(h.trust)}</span></p>
  </div>`;
  if (h.video && h.video.youtube) {
    // Ảnh bìa = ảnh mặt tiền của mình (nhẹ, hiện ngay). Sau khi trang hiện xong app.js tự tải YouTube tắt tiếng phía dưới ảnh,
    // video chạy thật mới che ảnh (không màn đen). Mạng yếu / bị chặn tự chạy → bấm ▶ như cũ (playVid).
    return `<section class="hero hero-v"><div class="hero-grid">
  <div class="hero-video"><div class="vid" data-yt="${esc(h.video.youtube)}"${h.video.start ? ` data-start="${+h.video.start}"` : ''} role="button" tabindex="0" aria-label="Phát video: ${esc(h.video.title)}">
    ${img(h.slug, h.heroImage, { sizes: '(min-width: 960px) 700px, 100vw', alt: `${h.name} – video thực tế`, lazy: false, w: [800, 1600] })}
    <span class="vid-play">${ic('play')}</span>
    <span class="vid-cap"><span class="dot"></span>${esc(h.video.title)}${h.video.duration ? ` · ${esc(h.video.duration)}` : ''}</span>
  </div></div>
  ${info}
</div></section>`;
  }
  return `<section class="hero">
  <div class="hero-bg"><picture><source media="(max-width: 719px)" srcset="${d}${h.heroImageMobile}-800.webp 800w, ${d}${h.heroImageMobile}.webp 1600w" sizes="100vw">${img(h.slug, h.heroImage, { alt: `${h.name} – ảnh mặt tiền`, lazy: false, cls: 'hero-media', w: [800, 1600] })}</picture></div>
  ${info}
</section>`;
}

function housePage(h) {
  const url = `${BASE}/${h.slug}/`;
  const d = `../nha/${h.slug}/`;
  const groups = [...new Set(h.gallery.map((g) => g.group))];
  const LP = { id: h.id, slug: h.slug, name: h.name, price: h.price, demo: false, appsScriptUrl: '', leadApi: true, netlifyBackup: false, gads: null, zalo: SITE.zalo };
  const ld = { '@context': 'https://schema.org', '@type': 'RealEstateListing', name: h.name, description: h.description, url, image: `${BASE}/nha/${h.slug}/${h.heroImage}.webp`,
    offers: { '@type': 'Offer', price: h.price, priceCurrency: 'VND' }, address: { '@type': 'PostalAddress', streetAddress: h.address, addressCountry: 'VN' } };
  const hasVid = h.video && h.video.youtube;
  const preload = hasVid
    ? `<link rel="preload" as="image" href="${d}${h.heroImage}-800.webp" imagesrcset="${d}${h.heroImage}-800.webp 800w, ${d}${h.heroImage}.webp 1600w" imagesizes="(min-width: 960px) 700px, 100vw">\n`
    : `<link rel="preload" as="image" media="(max-width: 719px)" href="${d}${h.heroImageMobile}-800.webp" imagesrcset="${d}${h.heroImageMobile}-800.webp 800w, ${d}${h.heroImageMobile}.webp 1600w" imagesizes="100vw">\n<link rel="preload" as="image" media="(min-width: 720px)" href="${d}${h.heroImage}-800.webp" imagesrcset="${d}${h.heroImage}-800.webp 800w, ${d}${h.heroImage}.webp 1600w" imagesizes="100vw">\n`;
  const perM2 = h.area ? `${(h.price / h.area / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu/m² đất` : '';
  const spec = (k) => (h.specs.find((s) => s[0] === k) || [])[1] || '';
  const facts = [h.downPct ? [`Trả trước ${h.downPct}%`, ty(h.price * h.downPct / 100)] : null, ['Giá', h.priceText], ['Diện tích', spec('Diện tích đất')], ['Pháp lý', 'Sổ hồng · đã hoàn công']].filter((f) => f && f[1]);
  const days = ''; // ngày xem do app.js tự dựng (7 ngày tới)

  return `${head({ title: h.title, description: h.description, url, image: `${BASE}/nha/${h.slug}/${h.heroImage}.webp`, rel: '../',
    extra: `${preload}${hasVid ? '<link rel="preconnect" href="https://www.youtube-nocookie.com">\n<link rel="preconnect" href="https://www.youtube.com">\n<link rel="dns-prefetch" href="https://i.ytimg.com">\n' : ''}<script type="application/ld+json">${JSON.stringify(ld)}</script>\n<script>window.LP=${JSON.stringify(LP)}</script>\n` })}
<body>
${topBar()}
<main id="top">
${heroHtml(h)}
<div class="facts"><ul class="wrap">${facts.map(([k, v]) => `<li><small>${esc(k)}</small><b>${esc(v)}</b></li>`).join('')}</ul></div>
<section id="noi-bat" class="sec"><div class="wrap"><p class="eyebrow">Vì sao nên xem căn này</p><h2>Điểm nổi bật</h2><ul class="hl">${h.highlights.map((x) => `<li><span class="hl-ic">${ic(x.icon)}</span><div><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></div></li>`).join('')}</ul></div></section>
<section id="anh" class="sec"><div class="wrap"><p class="eyebrow">${h.gallery.length} ảnh thực tế</p><h2>Album ảnh</h2><div class="tabs" role="tablist"><button type="button" role="tab" class="tab on" data-g="*">Tất cả</button>${groups.map((g) => `<button type="button" role="tab" class="tab" data-g="${esc(g)}">${esc(g)} <small>${h.gallery.filter((x) => x.group === g).length}</small></button>`).join('')}</div>
<div class="grid grid-cut">${h.gallery.map((g, i) => {
    const file = g.file.replace(/\.webp$/, '');
    return `<button type="button" class="gi${i === 0 ? ' gi-big' : ''}${i > 8 ? ' gi-more' : ''}" data-i="${i}" data-g="${esc(g.group)}" aria-label="Xem lớn: ${esc(g.alt)}">${img(h.slug, file, { sizes: '(min-width: 900px) 33vw, 50vw', alt: g.alt })}<span class="gi-tag">${esc(g.group)}</span></button>`;
  }).join('')}</div>
<button type="button" class="btn btn-line btn-block more-btn" id="moreBtn">${ic('expand')}Xem thêm ${Math.max(0, h.gallery.length - 9)} ảnh</button>
<script type="application/json" id="galleryData">${JSON.stringify(h.gallery.map((g) => ({ src: `${d}${g.file}`, alt: g.alt, group: g.group })))}</script>
</div></section>
<section id="thong-so" class="sec sec-tint"><div class="wrap"><p class="eyebrow">Thông tin chi tiết</p><h2>Thông số căn nhà</h2><dl class="specs">${h.specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div></section>
<section id="vi-tri" class="sec"><div class="wrap"><p class="eyebrow">Vị trí &amp; kết nối</p><h2>Vị trí căn nhà</h2>
<p class="addr">${ic('pin')}<span>${esc(h.address)}</span></p>
<button type="button" class="lmap" data-zoom="${d}${h.map.h}.webp" data-zoom-m="${d}${h.map.v}.webp" aria-label="Phóng to bản đồ vị trí">
  <picture><source media="(max-width: 719px)" srcset="${d}${h.map.v}-800.webp 780w, ${d}${h.map.v}.webp 1170w" sizes="100vw">
  <img src="${d}${h.map.h}.webp" srcset="${d}${h.map.h}-800.webp 800w, ${d}${h.map.h}.webp 1600w" sizes="(min-width: 1000px) 1080px, 100vw" alt="Bản đồ vị trí ${esc(h.name)}" loading="lazy" decoding="async"></picture>
  <span class="fp-zoom">${ic('expand')}</span></button>
<p class="lmap-cap">${esc(h.map.caption)}</p>
<ol class="legend">${h.legend.map((l, i) => `<li><span class="lg-n">${i + 1}</span><span class="lg-name">${esc(l.name)}</span><span class="lg-d">${l.time ? `<b>${esc(l.time)}</b>` : ''}<small>${esc(l.dist)}</small></span></li>`).join('')}</ol>
<p class="fine">Thời gian, quãng đường: đường đi ô tô đo trên bản đồ (OSRM/OpenStreetMap), có thể chênh theo giờ đi.</p>
<div class="map-cta"><a class="btn btn-primary" href="https://www.google.com/maps/dir/?api=1&amp;destination=${h.geo.lat}%2C${h.geo.lng}" target="_blank" rel="noopener">${ic('road')}Chỉ đường</a><a class="btn btn-line" href="https://www.google.com/maps/search/?api=1&amp;query=${h.geo.lat}%2C${h.geo.lng}" target="_blank" rel="noopener">${ic('map')}Google Maps</a></div></div></section>
<section id="gia" class="sec sec-tint"><div class="wrap"><p class="eyebrow">Tài chính</p><h2>Giá &amp; tính khoản vay</h2>
<div class="price-card">
  <div class="pc-top"><div><p class="pc-label">Giá bán</p><p class="pc-price">${esc(h.priceText)}</p><p class="pc-sub">${esc(perM2)}</p></div><p class="pc-note">${esc(h.priceNote)}</p></div>
  <form class="loan" id="loan" onsubmit="return false">
    <label><span class="lr-h">Vay ngân hàng <output id="lpOut">${h.loan.percent}%</output></span><input type="range" id="lpPct" min="0" max="${h.loan.max}" step="5" value="${h.loan.percent}"></label>
    <div class="loan-row">
      <label>Số năm<select id="lpYears">${[5, 10, 15, 20, 25, 30].map((y) => `<option${y === h.loan.years ? ' selected' : ''}>${y}</option>`).join('')}</select></label>
      <label>Lãi suất %/năm<input type="number" id="lpRate" inputmode="decimal" min="0" max="30" step="0.1" value="${h.loan.rate}"></label>
    </div>
    <dl class="loan-res">
      <div><dt>Cần chuẩn bị trước</dt><dd id="lpDown">–</dd></div>
      <div><dt>Số tiền vay</dt><dd id="lpAmt">–</dd></div>
      <div class="big"><dt>Góp đều mỗi tháng khoảng</dt><dd id="lpMonth">–</dd></div>
      <div><dt>Tháng đầu (dư nợ giảm dần)</dt><dd id="lpFirst">–</dd></div>
    </dl>
    <p class="fine">Lãi suất là con số giả định để ước tính, mỗi ngân hàng một mức. Hỏi ngân hàng hoặc nhắn tư vấn để được tính đúng hồ sơ của anh/chị.</p>
  </form>
  <a class="btn btn-primary btn-block" href="#dat-lich" data-mode="tuvan">${ic('wallet')}Nhờ tư vấn phương án vay</a>
</div></div></section>
<section id="phap-ly" class="sec"><div class="wrap"><p class="eyebrow">Minh bạch giấy tờ</p><h2>Pháp lý</h2><div class="docs">${h.documents.map((x) => `<button type="button" class="doc" data-zoom="${d}${x.file}.webp">${img(h.slug, x.file, { sizes: '(min-width: 720px) 560px, 100vw', alt: '' })}<span>${ic('doc')}${esc(x.label)}</span></button>`).join('')}</div>
<p class="fine">${esc(h.legalNote)}</p></div></section>
<section id="dat-lich" class="sec sec-dark"><div class="wrap">
<p class="eyebrow">Miễn phí · không ràng buộc</p>
<h2>Đặt lịch xem nhà</h2>
<p class="lead-sub">Chọn ngày giờ tiện cho anh/chị, ${esc(SITE.brand)} gọi lại xác nhận và dẫn xem tận nơi.</p>
<div class="form-card">
  <div class="mode">
    <button type="button" class="mode-b on" data-mode="xem">${ic('calendar')}Đặt lịch xem</button>
    <button type="button" class="mode-b" data-mode="tuvan">${ic('zalo')}Nhận ảnh & tư vấn</button>
  </div>
  <form id="leadForm" novalidate>
    <input type="hidden" name="mode" value="xem">
    <div class="f-xem">
      <p class="f-label">Ngày xem</p>
      <div class="days" id="days">${days}</div>
      <p class="f-label">Khung giờ</p>
      <div class="slots">${['08:00 – 10:00', '10:00 – 12:00', '14:00 – 16:00', '16:00 – 18:00'].map((s, i) => `<label class="slot"><input type="radio" name="slot" value="${s}"${i === 0 ? ' checked' : ''}><span>${s}</span></label>`).join('')}</div>
    </div>
    <label class="fld"><span>Họ tên</span><input name="name" autocomplete="name" placeholder="Anh/chị tên gì?" maxlength="60"></label>
    <label class="fld"><span>Số điện thoại / Zalo <b>*</b></span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="09xx xxx xxx" required maxlength="15"><small class="err" id="phoneErr" hidden>Số điện thoại chưa đúng, anh/chị kiểm tra lại giúp nhé.</small></label>
    <label class="fld"><span>Cần hỏi thêm (không bắt buộc)</span><textarea name="note" rows="2" maxlength="300" placeholder="Ví dụ: có hỗ trợ vay không, xem được buổi tối không…"></textarea></label>
    <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button class="btn btn-primary btn-block" type="submit" id="leadBtn">${ic('check')}<span>Xác nhận lịch xem</span></button>
    <p class="fine center">Bấm gửi là anh/chị đồng ý để ${esc(SITE.brand)} liên hệ tư vấn căn nhà này. <a href="../chinh-sach-bao-mat/">Chính sách bảo mật</a></p>
  </form>
  <div class="done" id="leadDone" hidden>
    <span class="done-ic">${ic('check')}</span>
    <h3>Đã nhận thông tin!</h3>
    <p id="doneText">${esc(SITE.brand)} sẽ gọi lại cho anh/chị trong thời gian sớm nhất.</p>
    <a class="btn btn-primary btn-block" href="${SITE.zalo}" target="_blank" rel="noopener">${ic('zalo')}Nhắn Zalo ngay cho nhanh</a>
  </div>
</div>
</div></section>
<section id="lien-he" class="sec"><div class="wrap"><p class="eyebrow">Người tư vấn</p><h2>Liên hệ trực tiếp</h2>
<div class="agent">
  <div class="agent-ph">${LOGO(64)}</div>
  <div class="agent-i"><p class="agent-n">${esc(SITE.brand)}</p>${SITE.slogan ? `<p class="slogan slogan-sm">${esc(SITE.slogan)}</p>` : ''}<p class="agent-r">${esc(SITE.agentRole)}</p></div>
</div>
<div class="agent-cta">
  <a class="btn btn-primary" href="${telHref}">${ic('phone')}Gọi ${esc(SITE.phoneText)}</a>
  <a class="btn btn-line" href="${SITE.zalo}" target="_blank" rel="noopener">${ic('zalo')}Nhắn Zalo</a>
</div></div></section>
<section id="hoi-dap" class="sec sec-tint"><div class="wrap"><p class="eyebrow">Khách hay hỏi</p><h2>Hỏi đáp</h2><div class="faq">${h.faq.map((f) => `<details><summary>${esc(f.q)}<span class="pm"></span></summary><p>${esc(f.a)}</p></details>`).join('')}</div></div></section>
</main>
<footer class="foot"><div class="wrap">
  <p class="foot-b">${LOGO(32)}<span>${esc(SITE.brand)}</span></p>
  ${SITE.slogan ? `<p class="slogan slogan-sm">${esc(SITE.slogan)}</p>` : ''}
  <p>${esc(h.name)} · ${esc(h.address)}</p>
  <p><a href="${telHref}">${esc(SITE.phoneText)}</a></p>
  <p class="foot-s">Thông tin, hình ảnh do chủ nhà cung cấp. Vui lòng kiểm tra giấy tờ gốc trước khi giao dịch.</p>
  <p class="foot-s"><a href="../chinh-sach-bao-mat/">Chính sách bảo mật</a></p>
</div></footer>

<nav class="bar" id="bar" aria-label="Liên hệ nhanh">
  <p class="bar-t"><b>Anh/chị muốn xem nhà thực tế?</b> <span>Dẫn xem tận nơi, miễn phí</span></p>
  <a class="bar-call" href="${telHref}">${ic('phone')}<span>Gọi ngay</span></a>
  <a class="bar-zalo" href="${SITE.zalo}" target="_blank" rel="noopener">${ic('zalo')}<span>Zalo</span></a>
  <a class="bar-main" href="#dat-lich" data-mode="xem">${ic('calendar')}<span>Đặt lịch<span class="nw"> xem</span></span></a>
</nav>
<aside class="nudge" id="nudge" hidden aria-label="Gợi ý liên hệ">
  <button type="button" class="nudge-x" aria-label="Đóng gợi ý">${ic('x')}</button>
  <b>Anh/chị muốn xem nhà thực tế?</b>
  <p>Gọi ngay để được dẫn xem tận nơi, hoặc đặt lịch — bên em gọi lại xác nhận trong ít phút.</p>
  <div class="nudge-btns"><a class="btn btn-call" href="${telHref}">${ic('phone')}Gọi ngay</a><a class="btn nudge-zalo" href="${SITE.zalo}" target="_blank" rel="noopener">${ic('zalo')}Zalo</a><a class="btn btn-dark" href="#dat-lich" data-mode="xem">${ic('calendar')}Đặt lịch</a></div>
</aside>

<div class="lb" id="lb" hidden role="dialog" aria-modal="true" aria-label="Xem ảnh">
  <div class="lb-top"><span id="lbCount"></span><span id="lbCap"></span><button type="button" class="lb-x" aria-label="Đóng">${ic('x')}</button></div>
  <div class="lb-stage" id="lbStage"><img id="lbImg" alt=""></div>
  <button type="button" class="lb-nav lb-prev" aria-label="Ảnh trước">${ic('prev')}</button>
  <button type="button" class="lb-nav lb-next" aria-label="Ảnh sau">${ic('next')}</button>
  <a class="lb-ask" href="${SITE.zalo}" target="_blank" rel="noopener">${ic('zalo')}Hỏi Zalo về căn này</a>
</div>
<script src="../app.js?v=${V}" defer></script>
</body>
</html>
`;
}

// ---------- các căn ----------
const dir = path.join(ROOT, 'data/nha');
const houses = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.endsWith('.map.json')).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
  .filter((h) => h.status !== 'an');
for (const h of houses) write(`${h.slug}/index.html`, housePage(h));

// ---------- trang chủ: danh sách căn ----------
write('index.html', `${head({ title: `${SITE.brand} – các căn đang bán`, description: `${SITE.brand}: nhà phố, nhà mặt tiền đang bán, ảnh thật, giá rõ ràng.`, url: `${BASE}/`, rel: '', noindex: true })}
<body>
${topBar('')}
<main id="top" class="sec"><div class="wrap"><p class="eyebrow">${esc(SITE.brand)}</p><h1 style="font-size:30px">Nhà đang bán</h1>
<ul class="home-list">${houses.map((h) => `<li><a class="home-card" href="${h.slug}/"><img src="nha/${h.slug}/${h.heroImage}-800.webp" alt="${esc(h.name)}" loading="lazy"><span class="home-i"><b>${esc(h.name)}</b><span>${esc(h.tag)}</span><em>${esc(h.priceText)}</em></span></a></li>`).join('')}</ul>
</div></main>
<footer class="foot"><div class="wrap"><p class="foot-b">${LOGO(32)}<span>${esc(SITE.brand)}</span></p><p><a href="${telHref}">${esc(SITE.phoneText)}</a></p><p class="foot-s"><a href="chinh-sach-bao-mat/">Chính sách bảo mật</a></p></div></footer>
</body></html>
`);

// ---------- chính sách bảo mật ----------
write('chinh-sach-bao-mat/index.html', `${head({ title: `Chính sách bảo mật – ${SITE.brand}`, description: `Cách ${SITE.brand} thu thập và dùng thông tin khách hàng.`, url: `${BASE}/chinh-sach-bao-mat/`, rel: '../' })}
<body>
<main class="doc">
${fs.readFileSync(path.join(ROOT, 'src/privacy.html'), 'utf8').replaceAll('{{PHONE}}', SITE.phone).replaceAll('{{PHONE_TEXT}}', SITE.phoneText)}</main>
</body></html>
`);

// ---------- CRM: chèn cấu hình + phiên bản ----------
const crmIndex = path.join(OUT, 'crm/index.html');
fs.writeFileSync(crmIndex, fs.readFileSync(crmIndex, 'utf8')
  .replace('__CRM_CONFIG__', JSON.stringify({ supabaseUrl: SITE.crm.supabaseUrl, supabaseKey: SITE.crm.supabaseKey, brand: SITE.brand, baseUrl: BASE,
    houses: houses.map((h) => ({ id: h.id, slug: h.slug, name: h.name, short: h.short || '' })) }))
  .replaceAll('__V__', V));

// ---------- robots, sitemap, headers ----------
write('robots.txt', `User-agent: *\nDisallow: /crm/\nDisallow: /api/\nSitemap: ${BASE}/sitemap.xml\n`);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${houses.map((h) => `  <url><loc>${BASE}/${h.slug}/</loc></url>`).join('\n')}\n</urlset>\n`);
write('_headers', `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/crm/*\n  X-Robots-Tag: noindex\n  Cache-Control: no-store\n/nha/*\n  Cache-Control: public, max-age=31536000, immutable\n/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n`);

// Link ngắn gửi tay / đăng bài: /<short>-zalo … → trang căn + UTM (CRM tự ghi nguồn). 302 để đổi đích được.
const SHORT = { zalo: ['zalo', 'organic'], yt: ['youtube', 'organic'], fb: ['facebook', 'organic'], tt: ['tiktok', 'organic'], bien: ['bien-ban', 'offline'] };
write('_redirects', houses.filter((h) => h.short).flatMap((h) => Object.entries(SHORT).map(([k, [src, med]]) =>
  `/${h.short}-${k} /${h.slug}/?utm_source=${src}&utm_medium=${med}&utm_campaign=${h.short} 302`)).join('\n') + '\n');

console.log(`Đã dựng ${houses.length} căn → dist/ (v=${V}, gốc ${BASE})`);
