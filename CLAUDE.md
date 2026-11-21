# Landing page BĐS — Nhà Xinh Minh Thùy

Đọc file này trước khi sửa. Sửa xong: chạy `npm test`, **commit + push GitHub ngay** (21/11/2026 mất toàn bộ code vì
repo GitHub trống, code chỉ nằm trong 1 file zip ở Downloads rồi bị xoá — phải dựng lại từ web đang chạy).

## 0. Cách làm việc với Giang
- Giao diện khách 100% tiếng Việt. Không bịa dữ liệu (review, lượt xem, khoảng cách tự đoán); chưa có thì để trống.
- Ưu tiên: Chuyển đổi > Trải nghiệm điện thoại > Tốc độ > SEO > hiệu ứng. Khách quảng cáo gần như toàn xem bằng điện thoại.
- Mỗi đề xuất của Giang: phản biện theo mục tiêu thật (đã có sẵn gì, xung đột gì, rủi ro, chi phí) rồi đề xuất hướng tốt nhất.
- Cập nhật không được làm hỏng quảng cáo đang chạy / sự kiện chuyển đổi: thử bằng bản xem thử (preview) trước khi thay bản chính.

## 1. Tổng quan
- Web tĩnh + Cloudflare Pages Functions. **1 file `data/nha/<slug>.json` = 1 trang `/<slug>/`**. `node build.mjs` → `dist/`.
- Cloudflare Pages dự án `nhaxinhminhthuy-bds` (tài khoản Cloudflare Hungnguyen2511ab@gmail.com), tên miền `nhaxinhminhthuy.com`
  (mua 21/11/2026 ở Cloudflare Registrar). Link cũ `nhaxinhminhthuy-bds.pages.dev` → 301 sang tên miền khi biến `CANONICAL_REDIRECT=on`.
- CRM tại `/crm/` — **tạm** đặt trong dự án Supabase `giang-ai-marketing-os` (ref `otolussdwersbctkveot`), schema riêng `nx`.
  (Dự án cũ `giang-quant-dashboard` bị Supabase tạm dừng do 1 tuần không hoạt động + gói miễn phí chỉ 2 dự án chạy; dữ liệu cũ còn trong đó.)

## 2. Cấu trúc
| Đường dẫn | Việc |
|---|---|
| `data/site.json` | Thương hiệu, SĐT, Zalo, `baseUrl`, mã pixel TikTok/Meta, `gtmId`, cấu hình CRM (URL + khoá công khai Supabase) |
| `data/nha/<slug>.json` | Nội dung 1 căn: giá, chips, video YouTube, điểm nổi bật, album, thông số, vị trí + bảng khoảng cách, vay, pháp lý, hỏi đáp, `short` (link ngắn) |
| `build.mjs` | Dựng trang căn, trang chủ (danh sách căn, noindex), chính sách bảo mật, CRM (chèn cấu hình), robots/sitemap/_headers/_redirects; sinh `functions/_lib/site.gen.js` |
| `src/styles.css`, `src/app.js` | Giao diện + tương tác/đo chuyển đổi (JS thuần). `src/icons.mjs` icon nét mảnh |
| `src/crm/` | CRM: `crm.js` (gọi hàm `nx_crm_*` bằng mật khẩu), `source.js` (phân loại nguồn), `crm.css`, `index.html` |
| `public/` | Font Geist, ảnh căn `nha/<slug>/NN-ten[-400|-800].webp`, bản đồ `ban-do-ngang|doc`, ảnh sổ đã che số |
| `functions/api/lead.js` | Form → CRM (`nx_ingest_lead`) + Telegram + TikTok `SubmitForm` + Facebook `Lead` (cùng `event_id` pixel) |
| `functions/api/contact.js` | Bấm Gọi/Zalo → `nx_ingest_click` + `Contact` TikTok/Facebook |
| `functions/api/events.js` | Sale đổi trạng thái → TikTok/Facebook (Khách thật→ApplicationApproval/QualifiedLead, Hẹn xem→Schedule, Đặt cọc+tiền→Purchase) |
| `functions/_middleware.js` | 301 pages.dev → tên miền (bật bằng `CANONICAL_REDIRECT=on`) |
| `supabase/migrations/` | Schema `nx` + các hàm `public.nx_*` |
| `test/` | `functions.mjs` (13 ca, fetch giả), `page.mjs` (kiểm trang dựng) — `npm test` |

## 3. Đo chuyển đổi — KHÔNG đếm trùng
- TikTok pixel `DBKSTGRC77UFMFQA75Q0`, Meta pixel `1561410692372628`: gắn thẳng trong trang (tải sau `load`) + gửi từ máy chủ, cùng `event_id`.
- **GTM chỉ cho thẻ Google** (Google Ads, GA4). TUYỆT ĐỐI không thêm thẻ TikTok/Meta trong GTM. dataLayer có:
  `lead_submit` (event_id, lead_mode, user_data.sha256_phone_number → dùng cho Lượt chuyển đổi nâng cao), `contact_click` (contact_kind call|zalo), `video_play`.
- Google Ads trong GTM: thẻ Chuyển đổi "Gửi form" kích hoạt bằng sự kiện tuỳ chỉnh `lead_submit`, Transaction ID = biến DL `event_id`;
  "Bấm Gọi/Zalo" bằng `contact_click`. Thẻ Google (AW-…) chạy trên All Pages.
- Video YouTube đầu trang: chỉ ảnh bìa (ảnh mặt tiền của mình) + nút ▶; bấm mới tải `youtube-nocookie` (iframe). Không nhúng sẵn — nặng ~0,5–1 MB JS, chậm trang điện thoại.

## 4. CRM (schema `nx`, dự án giang-ai-marketing-os)
- Bảng `nx.leads`, `nx.clicks`, `nx.notes`, `nx.config` — schema `nx` không mở qua Data API, anon/authenticated không có quyền bảng.
- Trình duyệt/máy chủ chỉ gọi hàm `public.nx_*` (SECURITY DEFINER, tự kiểm khoá):
  `nx_ingest_lead|click|log(p_secret…)` khoá máy chủ = secret `CRM_INGEST_SECRET` (so sha256 với `nx.config.ingest_sha256`);
  `nx_crm_check|leads|lead|update|add_lead|notes|add_note|log_event|report(p_pass…)` = mật khẩu CRM (bcrypt `nx.config.crm_pass_bcrypt`).
- Advisor Supabase báo "anon gọi được SECURITY DEFINER" cho các hàm `nx_*` — **cố ý** (hàm tự kiểm khoá). Không thu quyền.
- Đổi mật khẩu CRM: tạo bcrypt `$2a$` (python `bcrypt.hashpw(pw, bcrypt.gensalt(prefix=b'2a'))`) → `update nx.config set value=… where key='crm_pass_bcrypt'`.
  KHÔNG đưa mật khẩu gốc vào migration (bảng migrations lưu nguyên văn).
- Không dùng Supabase Auth (để không tạo người dùng trong app marketing). Không realtime → CRM hỏi lại mỗi 30 giây.
- Chuyển CRM ra dự án riêng: chạy lại migration ở dự án mới + chép dữ liệu `nx.*` + đổi `data/site.json → crm` + hash khoá.

## 5. Thêm 1 căn mới
1. Ảnh → webp 3 cỡ (`-400`, `-800`, gốc 1600) vào `public/nha/<slug>/`. Bỏ ảnh có dấu "Ai✦" (Galaxy AI), ảnh trùng; ảnh sổ phải che số thửa/số vào sổ.
2. Chép `data/nha/nha-mat-tien-le-thi-tam-phuoc-ly.json` → sửa nội dung. `video.youtube` = mã video (phần sau `v=`), để trống = hero ảnh.
3. Khoảng cách tiện ích: đo bằng OSRM/OpenStreetMap, không tự đoán. Địa chỉ sau sáp nhập 07/2025: tên xã mới + tên cũ theo sổ trong ngoặc.
4. `npm test` → deploy preview → xem điện thoại → deploy chính → push GitHub.

## 6. Deploy
```
node build.mjs
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npx wrangler pages deploy dist --project-name nhaxinhminhthuy-bds --branch preview   # xem thử
… --branch main   # bản chính
```
- `wrangler pages deploy dist` lấy thư mục `functions/` ở thư mục hiện tại (gốc repo) → chạy lệnh từ gốc repo.
- Secret trên Cloudflare (Settings → Variables): `CRM_INGEST_SECRET` (mới 21/11), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`,
  `TIKTOK_ACCESS_TOKEN`, `TIKTOK_PIXEL_ID`, `META_ACCESS_TOKEN`, `META_PIXEL_ID`, `SITE_URL`, (`*_TEST_EVENT_CODE` chỉ khi thử, xoá sau), `CANONICAL_REDIRECT`.
  Secret cũ `SUPABASE_*`/`APPS_SCRIPT_URL` của bản trước không còn dùng.

## 7. Bài học
- 21/11/2026: code mất vì chưa từng push GitHub → luôn push sau mỗi lần sửa. Dựng lại được nhờ tải HTML/CSS/JS/ảnh từ web đang chạy
  (app.js, crm.js không minify nên đọc lại được logic); hàm máy chủ phải viết lại theo nội dung chat cũ.
- Supabase gói miễn phí: dự án tự dừng sau 7 ngày không hoạt động; chỉ 2 dự án chạy cùng lúc (tính mọi tổ chức mình là Owner/Admin).
- Trạm Y tế Hưng Long: bản cũ ghi "khoảng 300 m", đo thật 561 m → sửa "560 m". Sổ: 31,5 m² thuộc chỉ giới đường đỏ — đã ghi rõ ở Pháp lý + Hỏi đáp.
- Khung gợi ý góc phải (`#nudge`): mỗi lượt vào trang (sessionStorage `lp_nudge_s`) hiện tối đa 1 lần khi khách đã xem kỹ; không hiện nếu đã bấm Gọi/Zalo (24h) hoặc đã gửi form (30 ngày). Giang chọn 21/11 (trước đây 3 ngày/lần). Không hiện ngay khi vào trang (khung che nội dung bị nền tảng đánh giá kém).
- Tiêu đề video YouTube ghi "135m²", sổ ghi 138 m² → trang giữ 138 m² theo sổ; nên sửa tiêu đề video cho khớp.

## 8. Việc còn chờ
- Mã GTM (`tracking.gtmId`) + cấu hình thẻ Google Ads trong GTM (mục 3).
- Dữ liệu CRM cũ trong dự án `giang-quant-dashboard` (đang dừng) — chép sang khi bật lại được.
- Chuyển CRM ra dự án Supabase riêng khi nâng gói hoặc có tài khoản mới.
