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
  đăng nhập bằng Google). Tên miền `nhaxinhminhthuy.com`: **21/11 chưa có trong tài khoản** (chưa mua xong ở Cloudflare Registrar) → web đang chạy ở
  `nhaxinhminhthuy-bds.pages.dev`. Khi có tên miền: gắn vào Pages + đổi `SITE_URL` rồi mới bật `CANONICAL_REDIRECT=on` (bật sớm = 301 sang tên miền chết).
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
- Google Ads trong GTM: thẻ Chuyển đổi "Gửi form" kích hoạt bằng sự kiện tuỳ chỉnh `lead_submit`, Transaction ID = biến DL `event_id`;
  "Bấm Gọi/Zalo" bằng `contact_click`. Thẻ Google (AW-…) chạy trên All Pages.
- Video YouTube đầu trang: chỉ ảnh bìa (ảnh mặt tiền của mình) + nút ▶; bấm mới tải `youtube-nocookie` (iframe). Không nhúng sẵn — nặng ~0,5–1 MB JS, chậm trang điện thoại.

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
4. `npm test` → deploy preview → xem điện thoại → deploy chính → push GitHub.

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
  Preview chỉ có `CRM_INGEST_SECRET` + `SITE_URL` → form ở preview vào CRM nhưng KHÔNG gửi Telegram/TikTok/Facebook (thử thoải mái).
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
- Tiêu đề video YouTube ghi "135m²", sổ ghi 138 m² → trang giữ 138 m² theo sổ; nên sửa tiêu đề video cho khớp.

## 8. Việc còn chờ
- Mã GTM (`tracking.gtmId`) + cấu hình thẻ Google Ads trong GTM (mục 3).
- Dữ liệu CRM cũ trong dự án `giang-quant-dashboard` (đang dừng) — chép sang khi bật lại được.
- Chuyển CRM ra dự án Supabase riêng khi nâng gói hoặc có tài khoản mới.
