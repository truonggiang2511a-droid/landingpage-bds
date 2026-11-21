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
- Cloudflare Pages dự án `nhaxinhminhthuy-bds` (tài khoản Cloudflare Hungnguyen2511ab@gmail.com, account ID `335d210ae0fbc3ac05c5d7b9f45d0a60`,
  đăng nhập bằng Google). Tên miền **`nhaxinhminhthuy.com` mua 21/11/2026 ở Cloudflare Registrar** (chủ thể: Hộ kinh doanh Nguyễn Trường Giang; zone
  `e6a09f107feb3ff0a1499fc2aea88a38`, NS naomi/yisroel.ns.cloudflare.com). Đã gắn vào Pages: `nhaxinhminhthuy.com` + `www` (CNAME proxied → pages.dev),
  `www` → 301 về tên miền gốc (middleware, luôn bật). `baseUrl` + biến `SITE_URL` (production + preview) = `https://nhaxinhminhthuy.com`.
  Link cũ `nhaxinhminhthuy-bds.pages.dev` VẪN chạy bình thường (canonical/og đã trỏ tên miền). **`CANONICAL_REDIRECT` CHƯA bật — cố ý**: quảng cáo
  TikTok/Facebook đang trỏ pages.dev; bật 301 thì mỗi lượt bấm quảng cáo thêm 1 bước chuyển (chậm trên 4G) mà đo chuyển đổi không lợi gì (pixel chạy được ở
  cả 2 host). Quảng cáo mới dùng tên miền; khi quảng cáo cũ tắt hết mới bật `CANONICAL_REDIRECT=on` (middleware bỏ qua nếu baseUrl trùng host, không vòng lặp;
  preview `<x>.nhaxinhminhthuy-bds.pages.dev` không bị chuyển).
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
| `tools/ban-do.py` + `data/nha/<slug>.map.json` | Vẽ bản đồ vị trí (ngang 1600 + dọc 1170, kèm bản 800): nền vệ tinh Esri, ranh = relation OSM, đường đi OSRM, ô phóng to điểm ranh. Vị trí nhãn chỉnh trong `.map.json` (`pos`, `pos_v` = tỉ lệ khung) |
| `tools/xem-thu.py` | Bản xem thử gửi Giang (artifact claude.ai): lấy `dist/<slug>` → `xem-thu/` (bỏ pixel, form demo, dải báo). Đăng lại bằng publish_files, artifact `0286d960-a184-40fd-86d4-eb5b6564c7a2` |
| `supabase/migrations/` | Schema `nx` + các hàm `public.nx_*` |
| `test/` | `functions.mjs` (16 ca, fetch giả), `page.mjs` (kiểm trang dựng) — `npm test` |

## 3. Đo chuyển đổi — KHÔNG đếm trùng
- TikTok pixel `DBKSTGRC77UFMFQA75Q0`, Meta pixel `1561410692372628`: gắn thẳng trong trang (tải sau `load`) + gửi từ máy chủ, cùng `event_id`.
- **GTM chỉ cho thẻ Google** (Google Ads, GA4). TUYỆT ĐỐI không thêm thẻ TikTok/Meta trong GTM. dataLayer có:
  `lead_submit` (event_id, lead_mode, user_data.sha256_phone_number → dùng cho Lượt chuyển đổi nâng cao), `contact_click` (contact_kind call|zalo), `video_play`.
- Google Ads: tài khoản **225-186-9515** (đăng nhập Google Hungnguyen2511ab@gmail.com, `authuser=1`), mã **AW-17918172769**. 2 hành động chuyển đổi
  (chính, đếm "Một"): "Gửi form" nhãn `u1xuCLTA37wdEOG8huBC`, "Bấm Gọi/Zalo" nhãn `KBSECLfA37wdEOG8huBC`.
- GTM **GTM-NV7HRR4B** (Google truonggiang2511a@gmail.com, tài khoản GTM "Nhà Xinh Minh Thuỳ"; tên container vẫn ghi netlify cũ — chỉ là tên), gắn trong
  `data/site.json → tracking.gtmId`, `build.mjs` tải gtm.js sau `load` + lúc rảnh (sự kiện đẩy trước đó vẫn xếp hàng trong dataLayer). Phiên bản 6 (21/11):
  thẻ "Điền Form thành công." ← trình kích hoạt `CE - lead_submit`; thẻ "Ads - Bấm Gọi/Zalo (contact_click)" ← `CE - contact_click`; cả 2 Transaction ID =
  `{{DLV - event_id}}`; thẻ "Google Ads AW-17918172769" (loại Google Ads — GTM tự thêm, thay thẻ Google) chạy Initialization. Biến `DLV - event_id`, `DLV - user_data`.
  Đã TẠM DỪNG mọi thẻ tài khoản cũ AW-17767188385 (Lượt Click Zalo, Lượt xem trang, Thẻ Google cũ, và thẻ tên "Trình liên kết chuyển đổi" — thực ra là
  thẻ CHUYỂN ĐỔI chạy All Pages, đừng bật lại). Đã thử trên preview: `/pagead/conversion/17918172769/` đúng nhãn + `oid` = event_id (2 lượt thử
  `test_gtm_2111_*` có thể hiện trong Ads).
- **Lượt chuyển đổi nâng cao** BẬT 21/11 (Giang đồng ý điều khoản dữ liệu khách hàng; Ads → Cài đặt chuyển đổi → "Được quản lý thông qua GTM").
  GTM v7: thẻ "Điền Form thành công." có Tham số sự kiện `user_data` = biến "UPD - SDT bam (Gui form)" (Dữ liệu do người dùng cung cấp → Manual →
  Điện thoại = `{{DLV - sha256_phone}}` = DL `user_data.sha256_phone_number`). Đã thử: request gửi `em=tv.1~pn.<sha256 hex>` nguyên mã băm (không băm lại),
  `ec_mode=m` (lượt thử `test_ec_2111`). Thẻ "Bấm Gọi/Zalo" không có SĐT (khách chưa để lại số). gtm.js cache trình duyệt 15 phút → sau khi xuất bản, chờ ~15 phút mới thấy bản mới ở máy đã vào trang.
- Video YouTube đầu trang **tự chạy tắt tiếng** (Giang chọn 21/11 — trước đó bấm ▶ thì màn đen 2–3 s, khách dễ thoát). HTML vẫn chỉ có ảnh bìa (LCP, test kiểm);
  `app.js` chèn iframe `youtube-nocookie` (`autoplay=1&mute=1&loop=1&enablejsapi=1`) SAU sự kiện `load`, nằm DƯỚI ảnh bìa; YouTube báo `playerState 1`
  (postMessage `listening`) mới đặt `data-on="auto"` → ảnh mờ dần, hiện nút "🔊 Bật tiếng" (postMessage `unMute` + `setVolume 100`, đẩy `video_play`
  `video_mode: unmute`). Lướt khỏi video khi còn tắt tiếng → `pauseVideo`. Mạng 2g / tiết kiệm dữ liệu / giảm chuyển động → không tự chạy (bấm ▶ như cũ).
  12 s chưa chạy: trình phát sẵn sàng → hiện trình phát YouTube (chạm là chạy ngay); lỗi/chưa tải → gỡ, giữ ảnh + ▶. `video.start` (giây) = điểm bắt đầu.
  Đánh đổi: tải thêm ~1 MB JS YouTube sau khi trang hiện (không ảnh hưởng LCP, tăng thời gian luồng chính). Máy làm việc (IP trung tâm dữ liệu) YouTube báo
  "Video unavailable" → phải thử tự chạy bằng trình duyệt trong máy Giang (built-in browser, preset mobile).

## 4. CRM (schema `nx`, dự án giang-ai-marketing-os)
- Bảng `nx.leads`, `nx.clicks`, `nx.notes`, `nx.config` — schema `nx` không mở qua Data API, anon/authenticated không có quyền bảng.
- Trình duyệt/máy chủ chỉ gọi hàm `public.nx_*` (SECURITY DEFINER, tự kiểm khoá):
  `nx_ingest_lead|click|log(p_secret…)` khoá máy chủ = secret `CRM_INGEST_SECRET` (so sha256 với `nx.config.ingest_sha256`);
  `nx_crm_check|leads|lead|update|add_lead|notes|add_note|log_event|report|clicks|link_click(p_pass…)` = mật khẩu CRM (bcrypt `nx.config.crm_pass_bcrypt`).
- Advisor Supabase báo "anon gọi được SECURITY DEFINER" cho các hàm `nx_*` — **cố ý** (hàm tự kiểm khoá). Không thu quyền.
- Đổi mật khẩu CRM: tạo bcrypt `$2a$` (python `bcrypt.hashpw(pw, bcrypt.gensalt(prefix=b'2a'))`) → `update nx.config set value=… where key='crm_pass_bcrypt'`.
  KHÔNG đưa mật khẩu gốc vào migration (bảng migrations lưu nguyên văn).
- Không dùng Supabase Auth (để không tạo người dùng trong app marketing). Không realtime → CRM hỏi lại mỗi 30 giây.
- **Tín hiệu ngược về nền tảng** (đã có từ đầu, 21/11 làm kỹ thêm): sale đổi trạng thái → `/api/events` tự gửi (không cần bấm thêm):
  Khách thật → TikTok `ApplicationApproval` / Facebook `QualifiedLead`; Hẹn xem nhà → `Schedule`; Đặt cọc + nhập tiền → `Purchase` (value = tiền cọc, VND).
  Mỗi bước gửi 1 lần (kiểm `tiktok_log`), `event_id` = `<event_id lead hoặc crm<id>>_<tên sự kiện>`. Kèm mã nhận diện lưu từ lúc khách vào trang:
  SĐT băm, `external_id` = sha256("nx:" + SĐT +84) giống nhau ở mọi bước/2 nền tảng, ttclid, _ttp, fbclid/_fbc (fbc dựng theo GIỜ KHÁCH BẤM), _fbp, IP, trình duyệt.
- **Khách gọi/Zalo thẳng** (không điền form) trước đây chỉ có SĐT → nền tảng khó khớp. Migration `20261121b_nx_click_link.sql`: `nx.clicks` lưu thêm
  _ttp/_fbp/_fbc + `lead_id`; CRM có khung vàng "Khớp khách với quảng cáo" ở khách chưa có mã → sale chọn lượt bấm Gọi/Zalo trùng giờ (72 giờ gần nhất,
  hiện nguồn/chiến dịch/thiết bị) → `nx_crm_link_click` chép mã sang khách (chỉ điền ô trống) → các bước sau gửi kèm mã. Gắn sai = gán nhầm người: chọn đúng giờ.
- Lượng khách BĐS ít (vài chục/tuần) → nền tảng chưa đủ dữ liệu để tối ưu thẳng vào QualifiedLead/Purchase (cần ~50 sự kiện/tuần/nhóm QC):
  tối ưu theo Lead/SubmitForm, dùng các bước sau để xem quảng cáo nào ra khách thật + làm tệp tương tự (Lookalike cần ≥100 người).
- Chuyển CRM ra dự án riêng: chạy lại migration ở dự án mới + chép dữ liệu `nx.*` + đổi `data/site.json → crm` + hash khoá.

## 5. Thêm 1 căn mới
1. Ảnh → webp 3 cỡ (`-400`, `-800`, gốc 1600) vào `public/nha/<slug>/`. Bỏ ảnh có dấu "Ai✦" (Galaxy AI), ảnh trùng; ảnh sổ phải che số thửa/số vào sổ.
2. Chép `data/nha/nha-mat-tien-le-thi-tam-phuoc-ly.json` → sửa nội dung. `video.youtube` = mã video (phần sau `v=`), để trống = hero ảnh.
3. Khoảng cách tiện ích: đo bằng OSRM/OpenStreetMap, không tự đoán. Địa chỉ sau sáp nhập 07/2025: tên xã mới + tên cũ theo sổ trong ngoặc.
4. Ảnh chia sẻ `public/nha/<slug>/og.jpg` 1200×630 (Zalo/Facebook đọc JPG chắc hơn webp) + `"ogImage": "og.jpg"` trong data căn. Chữ trên ảnh chỉ dùng số liệu
   thật của căn (giá trả trước, pháp lý, khoảng cách đã đo). Làm như bản LTT: HTML + Playwright chụp 1200×630, tiêu đề 1 dòng.
5. `npm test` → deploy preview → xem điện thoại → deploy chính → push GitHub.

## 6. Deploy
```
node build.mjs
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npx wrangler pages deploy dist --project-name nhaxinhminhthuy-bds --branch preview   # xem thử
… --branch main   # bản chính
```
- `wrangler pages deploy dist` lấy thư mục `functions/` ở thư mục hiện tại (gốc repo) → chạy lệnh từ gốc repo. Thêm `--commit-dirty=true` để bỏ cảnh báo git.
- Khoá deploy: API token `landing-deploy` (Cloudflare Pages: Edit + DNS: Edit, mọi zone của tài khoản), **hết hạn 28/11/2026**. Chỉ lưu ở máy làm việc
  `/home/claude/.cf_env` (không commit). Tạo lại: dash.cloudflare.com → Profile → API tokens → Create token → Start from scratch → Account policy
  (Cloudflare Pages Edit) + Zone policy (DNS Edit) → 7 days. Token chỉ có quyền theo tài khoản nên `GET /accounts` trả rỗng — lấy account ID từ URL dashboard.
- Biến môi trường đặt bằng API `PATCH /accounts/{id}/pages/projects/nhaxinhminhthuy-bds` (`deployment_configs.{production|preview}.env_vars`, gộp từng khoá).
  Preview chỉ có `CRM_INGEST_SECRET` + `SITE_URL` (= tên miền, như production) → form ở preview vào CRM nhưng KHÔNG gửi Telegram/TikTok/Facebook (thử thoải mái).
  Production còn `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` của bản cũ — code KHÔNG đọc nữa (đổi sang `CRM_SUPABASE_URL|KEY`, mặc định lấy `data/site.json`).
- Quay lại bản cũ nếu lỗi: Cloudflare → Pages → nhaxinhminhthuy-bds → Deployments → bản `904b7ba3` (03/11, bản trước khi dựng lại) → Rollback.
- Secret trên Cloudflare (Settings → Variables): `CRM_INGEST_SECRET` (mới 21/11), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`,
  `TIKTOK_ACCESS_TOKEN`, `TIKTOK_PIXEL_ID`, `META_ACCESS_TOKEN`, `META_PIXEL_ID`, `SITE_URL`, (`*_TEST_EVENT_CODE` chỉ khi thử, xoá sau), `CANONICAL_REDIRECT`.
  Secret cũ `SUPABASE_*`/`APPS_SCRIPT_URL` của bản trước không còn dùng.

## 7. Bài học
- 21/11/2026: code mất vì chưa từng push GitHub → luôn push sau mỗi lần sửa. Dựng lại được nhờ tải HTML/CSS/JS/ảnh từ web đang chạy
  (app.js, crm.js không minify nên đọc lại được logic); hàm máy chủ phải viết lại theo nội dung chat cũ.
- Supabase gói miễn phí: dự án tự dừng sau 7 ngày không hoạt động; chỉ 2 dự án chạy cùng lúc (tính mọi tổ chức mình là Owner/Admin).
- Trạm Y tế Hưng Long: bản cũ ghi "khoảng 300 m", đo thật 561 m → sửa "560 m". Sổ: 31,5 m² thuộc chỉ giới đường đỏ — đã ghi rõ ở Pháp lý + Hỏi đáp.
- Khung gợi ý góc phải (`#nudge`): mỗi lượt vào trang (sessionStorage `lp_nudge_s`) hiện tối đa 1 lần khi khách đã xem kỹ; không hiện nếu đã bấm Gọi/Zalo (24h) hoặc đã gửi form (30 ngày). Giang chọn 21/11 (trước đây 3 ngày/lần). Không hiện ngay khi vào trang (khung che nội dung bị nền tảng đánh giá kém).
  Thẻ mở → thanh đáy `#bar` ẩn (thẻ có đủ Gọi / Zalo / Đặt lịch), đóng thẻ → thanh hiện lại — không để 2 bộ nút trùng nhau (Giang báo 21/11).
  Thanh đáy luôn có dòng mời "Anh/chị muốn xem nhà thực tế? Dẫn xem tận nơi, miễn phí" (`.bar-t`, cao thêm ~22px → `--bar:88px`).
- 21/11 tối ưu điện thoại (Lighthouse mobile 82→91, Accessibility 97→100, FCP 2,3→1,5 s, LCP 3,0→2,4 s trên máy chủ thử không nén):
  CSS nhúng thẳng vào trang (bỏ 1 lượt tải chặn hiển thị; CRM vẫn dùng `/styles.css`), font Geist bản variable 3 file thay 12 file,
  màu nút gọi `--call:#15803D` (đủ tương phản dưới nắng), màn đầu 360×640 (trình duyệt trong TikTok/Facebook) phải thấy giá ngay dưới tiêu đề.
- 21/11 Giang: "5,6 tỷ" to làm khách ngợp → bỏ thẻ giá trên video; hero hiện **"Trả trước chỉ từ 1,68 tỷ (30%)"** to, dòng nhỏ
  "Giá 5,6 tỷ ~~5,999 tỷ~~ · Ngân hàng hỗ trợ vay đến 70% (tuỳ hồ sơ)" (giá tổng vẫn hiện — minh bạch), + 3 điểm mạnh `strengths`
  (data căn: `downPct`, `loanNote`, `strengths`). Giang khẳng định nhà ĐÃ hoàn công (trang sổ đang đăng ghi "Nhà ở: -/-" → nên đăng thêm
  ảnh trang hoàn công đã che số). "Qua ranh chỉ 3 bước chân" → ghi số đo thật **khoảng 23 m** (ranh TP.HCM relation OSM 1973756, đo 11/2026). Pixel TikTok/Meta vẫn tải sau `load` (chặn ~0,5 s luồng chính) —
  KHÔNG dời tới lúc khách chạm vì sẽ mất PageView/ViewContent của khách thoát nhanh (nền tảng tối ưu kém hơn).
- 21/11 bản đồ vị trí làm lại: nền **vệ tinh Esri** (Carto giờ đòi khoá API — ra ô "API KEY REQUIRED"; Overpass bị chặn → lấy dữ liệu bằng
  OSM API `/map?bbox=`). Đo lại bằng hình học: nhà → ranh TP.HCM **23,2 m**. Ô tròn phóng to z18 thấy rõ điểm ranh. Ghi nguồn: © Esri, © OpenStreetMap, OSRM.
- 21/11 thêm **Làng Đại học Hưng Long** lên bản đồ (`zones` trong `.map.json`: ghim 🎓 + thẻ vàng + đường đi OSRM chấm vàng 3,6 km/8 phút).
  KHÔNG có ranh công khai (chưa có polygon OSM/GIS; đồ án KĐT Hưng Long ~1.512,7 ha mới lấy ý kiến 28/7–18/8/2026, Vingroup được giao phối hợp lập quy hoạch;
  khu đại học phía Bắc ~293,3 ha, phía Nam ~60,3 ha) → chỉ ghim **vị trí tham khảo**, không tự vẽ ranh. Phía Nam KĐT giáp Đ. Đoàn Nguyễn Tuấn (tô mờ `style: minor`).
  Ảnh bìa nhà tách khỏi điểm ghim (`house.photoPos[_v]`, `cardSide[_v]`) để không che đường; `MAPDEBUG=1` in toạ độ màn hình các điểm để chỉnh nhãn.
- 21/11 rà UI/UX điện thoại (Playwright 360×640, 390×844): (1) thẻ nhắc đang mở mà khách lướt tới form → che ô nhập ⇒ tự đóng khi `#dat-lich` hiện
  hoặc khách bấm vào ô nhập; (2) thanh đầu `.top` lướt xuống ẩn / lướt lên hiện (chỉ <900px, lấy lại 56px trên màn nhỏ); (3) nút Zalo trên thanh đáy
  to ngang 2 nút kia (lưới 1.25/1/1.25), ≤380px chữ "Đặt lịch xem" rút còn "Đặt lịch" để không xuống 2 dòng; (4) bản đồ dọc chữ quá nhỏ
  (hiện ~350px) ⇒ `minimal_v` + `fsBoost_v: 1.6` trong `.map.json`: bỏ thẻ tiêu đề/nhãn đường/điểm xa, tiện ích chỉ còn số (khớp bảng dưới),
  thẻ nhà nằm dưới ảnh (`cardSide_v: "b"`).
- 21/11 **đưa bản mới lên production** (deploy `16c2c498`). Thử thật: form → CRM ✓ Telegram ✓ TikTok SubmitForm ✓ Facebook Lead ✓; bấm Zalo → nx.clicks ✓;
  trang nén Brotli 98 KB → 20 KB. Suýt lỗi: `functions/_lib/util.js` đọc `env.SUPABASE_URL` — production còn biến này trỏ về dự án Supabase đã dừng ⇒ lead sẽ
  không vào CRM. Đã đổi tên biến + thêm test. Link ngắn giữ `utm_campaign=ltt` như bản cũ (báo cáo liền mạch).
- 21/11 Lighthouse mobile trên web thật SAU khi bật video tự chạy: Performance 91 → **70** (FCP 1,5 s, LCP 2,2 s vẫn tốt; TBT 1,8 s do YouTube ~1,5 MB +
  pixel Facebook/TikTok), Accessibility 100, SEO 100, Best Practices 79 (cookie bên thứ ba của YouTube/Facebook). Ảnh/font của mình đã cache 1 năm;
  các mục "cache ngắn" còn lại đều là của Facebook/YouTube. Nếu khách máy yếu thoát nhiều → cân nhắc chỉ tự chạy khi khách lướt/chạm.
- Tiêu đề video YouTube ghi "135m²", sổ ghi 138 m² → trang giữ 138 m² theo sổ; nên sửa tiêu đề video cho khớp.

## 8. Việc còn chờ
- **Google Ads 225-186-9515 BỊ TẠM NGƯNG 21/11 tối — chính sách "Lách hệ thống" (Circumventing systems)**. Xảy ra sau khi trong cùng ngày: mua tên miền
  mới, xác minh danh tính nhà quảng cáo, nạp 300.000 ₫ (số dư 277.778 ₫), tạo chiến dịch Tìm kiếm + bản nháp Video. Nguyên nhân Google không nói rõ; nghi:
  tên miền mới tinh chạy QC ngay, nhiều tài khoản Ads (225-186-9515, 594-493-6894 đã huỷ, 124-440-6068, 918-369-8280), chiến dịch cũ "Tạo nhu cầu 2026-09-11 #2"
  từng bị hạn chế chính sách, tiêu đề video "GIẢM SÂU 400 TRIỆU"/giá gạch. Cách xử lý: CHỈ Giang gửi kháng nghị (banner đầu trang Ads → "Liên hệ với chúng tôi"/
  "Khắc phục vấn đề"; có thể phải xác minh danh tính, sai 3 lần là mất quyền kháng nghị; mỗi lần 1 đơn, kết quả qua email).
  Đã kiểm 21/11: trang trả về Y HỆT cho người dùng và AdsBot-Google/Googlebot (200, cùng nội dung), www chỉ 301 về chính trang đó, robots không chặn AdsBot
  → không phải che giấu (cloaking). Quảng cáo LTT còn "đang xem xét", chưa bị từ chối. Không loại trừ: phiên tự động hoá trình duyệt dồn dập trong Ads
  (nhiều thao tác liên tiếp, thử tải logo lỗi, Google bật "Xác nhận danh tính" giữa chừng) → sau này thao tác Google Ads để Giang tự bấm, Claude chỉ hướng dẫn/đọc số. Lúc đó Giang còn mở Ads ở Chrome riêng sửa CÙNG LÚC với trình duyệt
  trong app (2 phiên, 2 bộ cookie, cùng 1 bản nháp — có thể là lý do từ khoá/quảng cáo từng bị mất phải nhập lại) → mỗi lúc chỉ 1 người, 1 trình duyệt thao tác Ads.
  Đơn kháng nghị (form "Account Suspension Appeal Form", 3 bước: Account details → Circumventing systems → Confirmation) 21/11 20:20 CHƯA gửi
  (Ads → Chính sách → Account issues vẫn hiện "Start").
  Nghi nặng nhất = **nhiều tài khoản**: login truonggiang2511a có 861-159-6462 (đã đóng), 151-744-7772, 362-923-5047, 989-858-6625, 918-369-8280,
  159-692-9290 (đều đã huỷ), 124-440-6068 (đang thiết lập); login hungnguyen2511ab có 594-493-6894 (đã huỷ) + 225-186-9515 → ~9 tài khoản cùng 1 người/
  thương hiệu. Đơn kháng nghị phải khai thật lý do tạo/huỷ các tài khoản này. KHÔNG dùng 124-440-6068 để chạy thay.
  **TUYỆT ĐỐI không tạo tài khoản Ads mới khi đang bị ngưng** (chính là "lách hệ thống" → khoá luôn tài khoản/tên miền/thẻ mới).
  Đã dựng trước khi bị ngưng (giữ nguyên, chạy lại được nếu kháng nghị thành công):
  · Chiến dịch Tìm kiếm id `24524671587` "LTT - Tìm kiếm - Nhà Lê Thị Tám 5,6 tỷ": 50.000 ₫/ngày, Tối đa hoá lượt nhấp (CPC tối đa 6.000 ₫), từ khoá cụm từ,
    từ khoá phủ định, chú thích (callout), hậu tố URL cuối gắn UTM (xem trong cài đặt chiến dịch). Quảng cáo hình ảnh trong Tìm kiếm chưa đủ điều kiện (cần tài khoản
    >60 ngày + ~28 ngày chi tiêu Tìm kiếm). Logo doanh nghiệp: `public/logo-1200.png` (1200×1200), trang `/thuong-hieu/` (noindex, og:image = logo).
  · Bản nháp Video lượt xem (draftId `10223928862`): 100.000 ₫/ngày, HCM + Tây Ninh, chỉ YouTube, video `0un_OGG0Gd4`, URL `?utm_source=youtube&utm_medium=cpc&utm_campaign=ltt-video`,
    dự kiến nhắm từ khoá BĐS Bình Chánh/Cần Giuộc + vị trí đặt = kênh đối thủ. Chưa tạo được (tài khoản ngưng).
  · Các chiến dịch cũ (Tạo nhu cầu, Video 2026-02-02, The Sol City…) đều Bị tạm dừng/Đã kết thúc.
  Mã GTM/thẻ Google Ads trên web vẫn giữ (vô hại khi tài khoản ngưng). 124-440-6068 (kẹt trình hướng dẫn) và 918-369-8280 (cũ) không dùng.
  GTM khác (tài khoản "nhaxinhminhthuy"): GTM-5FDCX8TX, GTM-52TCQ75H, GTM-MTCT4JQW — web khác, không đụng.
- Facebook (connector Ads_Facebook, 21/11): tài khoản QC `1191956771630072` **BỊ VÔ HIỆU** ("hoạt động bất thường", mọi QC tạm dừng — phải xác minh
  thông tin với Facebook); `942515124812526` hoạt động nhưng không có chiến dịch, chỉ gắn pixel Vị Trí Studio; `1460386329295995` "Trường Giang"
  (BM Lumi) hoạt động nhưng connector chưa thao tác được. Pixel web `1561410692372628` connector không thấy → nằm ở BM/người dùng khác.
  Chạy video về web: mục tiêu Khách hàng tiềm năng → Trang web → sự kiện Lead (không chạy Lưu lượng truy cập); nhắm VN không bắt buộc Danh mục đặc biệt Nhà ở.
- Quảng cáo TikTok/Facebook còn trỏ `nhaxinhminhthuy-bds.pages.dev` → quảng cáo mới dùng `https://nhaxinhminhthuy.com/…`; tắt hết quảng cáo cũ thì bật `CANONICAL_REDIRECT`.
- Lượt thử cần xoá khi Giang đồng ý: lead #4 + các lượt bấm thử trong CRM.
- Dữ liệu CRM cũ trong dự án `giang-quant-dashboard` (đang dừng) — chép sang khi bật lại được.
- Chuyển CRM ra dự án Supabase riêng khi nâng gói hoặc có tài khoản mới.
