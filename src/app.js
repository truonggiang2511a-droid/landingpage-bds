/* Landing page BĐS — tương tác + đo chuyển đổi. JS thuần, không thư viện.
 * Form → POST /api/lead (functions/api/lead.js). Bấm Gọi/Zalo → sendBeacon /api/contact.
 * Pixel TikTok/Meta trong trang + bản máy chủ dùng CÙNG event_id. GTM chỉ nhận dataLayer: lead_submit, contact_click, video_play.
 */
(function () {
  'use strict';
  var LP = window.LP || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ================= ĐO CHUYỂN ĐỔI =================
  var TTCLID_KEY = 'tt_lp_ttclid', TTCLID_MAX = 7 * 864e5;
  // GTM (chỉ thẻ Google): đẩy sự kiện vào dataLayer; KHÔNG gắn TikTok/Meta trong GTM (đã gửi thẳng + máy chủ)
  window.dataLayer = window.dataLayer || [];
  function dl(o) { try { window.dataLayer.push(o); } catch (e) { /* bỏ qua */ } }
  function ttq() { return window.ttq && typeof window.ttq.track === 'function' ? window.ttq : null; }
  function fbq() { return typeof window.fbq === 'function' ? window.fbq : null; }
  // Thẻ Google Ads (dùng chung cho quảng cáo Google Tìm kiếm + YouTube): chỉ chạy khi site.config có googleAdsId
  function gtagF() { return LP.gads && LP.gads.id && typeof window.gtag === 'function' ? window.gtag : null; }
  function gadsConv(label, extra) {
    var g = gtagF(); if (!g || !label) return;
    var o = { send_to: LP.gads.id + '/' + label }; Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; });
    g('event', 'conversion', o);
  }
  function contentProps() { return { content_type: 'product', contents: [{ content_id: String(LP.id || ''), content_name: String(LP.name || '') }], value: LP.price || undefined, currency: LP.price ? 'VND' : undefined }; }
  function getCookie(n) { var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; }
  try {
    var q = new URLSearchParams(location.search);
    if (q.get('ttclid')) localStorage.setItem(TTCLID_KEY, JSON.stringify({ v: q.get('ttclid'), t: Date.now() }));
  } catch (e) { /* trình duyệt chặn bộ nhớ */ }
  // Nguồn khách: utm_* + fbclid + mã nhấp Google (gclid; gbraid/wbraid trên iPhone) giữ 30 ngày để CRM biết khách đến từ quảng cáo nào
  var SRC_KEY = 'lp_src';
  try {
    var src = {}, keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid', 'gclid', 'gbraid', 'wbraid'];
    keys.forEach(function (k) { if (q.get(k)) src[k] = q.get(k); });
    if (Object.keys(src).length) localStorage.setItem(SRC_KEY, JSON.stringify({ v: src, t: Date.now() }));
  } catch (e) { /* bỏ qua */ }
  function getSrc() {
    try { var o = JSON.parse(localStorage.getItem(SRC_KEY) || 'null'); return o && Date.now() - o.t < 30 * 864e5 ? o.v : {}; } catch (e) { return {}; }
  }
  // Cookie khớp khách của Facebook: _fbc do pixel Meta tạo; chưa có pixel thì tự dựng từ fbclid theo chuẩn fb.1.<ms>.<fbclid>
  function getFbc(src) {
    var c = getCookie('_fbc'); if (c) return c;
    if (!src.fbclid) return '';
    try { var o = JSON.parse(localStorage.getItem(SRC_KEY) || 'null'); return 'fb.1.' + ((o && o.t) || Date.now()) + '.' + src.fbclid; } catch (e) { return ''; }
  }
  function getTtclid() {
    try { var o = JSON.parse(localStorage.getItem(TTCLID_KEY) || 'null'); return o && o.v && Date.now() - o.t < TTCLID_MAX ? o.v : ''; } catch (e) { return ''; }
  }
  function normalizePhoneVN(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.indexOf('84') === 0) d = d.slice(2); else if (d.charAt(0) === '0') d = d.slice(1);
    if (d.length < 9 || d.length > 10) return '';
    return '+84' + d;
  }
  function sha256(str) {
    if (!str || !window.crypto || !crypto.subtle || !window.TextEncoder) return Promise.resolve('');
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    }).catch(function () { return ''; });
  }
  if (!LP.demo) {
    if (ttq()) ttq().track('ViewContent', contentProps());
    if (fbq()) fbq()('track', 'ViewContent', { content_ids: [String(LP.id)], content_name: LP.name, content_type: 'product', value: LP.price, currency: 'VND' });
  }
  // Bấm Gọi / Zalo → pixel TikTok + Facebook (trình duyệt) VÀ /api/contact (máy chủ, cùng event_id → nền tảng tự gộp; đỡ sót do chặn quảng cáo/iPhone)
  var lastContact = 0;
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href^="tel:"], a[href*="zalo.me"]');
    if (!a) return;
    try { localStorage.setItem('lp_contacted', String(Date.now())); } catch (e) { /* bỏ qua */ }
    if (LP.demo || Date.now() - lastContact < 3000) return;
    lastContact = Date.now();
    var kind = /^tel:/.test(a.getAttribute('href')) ? 'call' : 'zalo';
    var eid = 'contact_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    if (ttq()) ttq().track('Contact', contentProps(), { event_id: eid });
    if (fbq()) fbq()('track', 'Contact', { content_name: LP.name, content_ids: [String(LP.id || '')], content_type: 'product' }, { eventID: eid });
    if (LP.gads) gadsConv(LP.gads.contact);
    dl({ event: 'contact_click', contact_kind: kind, event_id: eid, property_id: String(LP.id || '') });
    if (LP.leadApi && navigator.sendBeacon) {
      var src = getSrc();
      var body = { event_id: eid, kind: kind, page_url: location.href, referrer: document.referrer || '', property_id: String(LP.id || ''), property_name: String(LP.name || ''),
        ttclid: getTtclid(), ttp: getCookie('_ttp'), fbclid: src.fbclid || '', fbp: getCookie('_fbp'), fbc: getFbc(src), user_agent: navigator.userAgent,
        utm_source: src.utm_source || '', utm_medium: src.utm_medium || '', utm_campaign: src.utm_campaign || '', utm_content: src.utm_content || '',
        gclid: src.gclid || '', gbraid: src.gbraid || '', wbraid: src.wbraid || '' };
      try { navigator.sendBeacon('/api/contact', new Blob([JSON.stringify(body)], { type: 'application/json' })); } catch (e) { /* bỏ qua */ }
    }
  }, true);

  // ================= CUỘN TỚI FORM + CHỌN CHẾ ĐỘ =================
  var card = $('.form-card'), form = $('#leadForm');
  var BTN_TEXT = { xem: 'Xác nhận lịch xem', tuvan: 'Gửi cho tôi ảnh & tư vấn' };
  function setMode(m) {
    if (!card || !BTN_TEXT[m]) return;
    form.elements.mode.value = m;
    card.classList.toggle('m-tuvan', m === 'tuvan');
    $$('.mode-b', card).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-mode') === m); });
    $('#leadBtn span').textContent = BTN_TEXT[m];
  }
  $$('[data-mode]').forEach(function (el) {
    el.addEventListener('click', function () { setMode(el.getAttribute('data-mode')); });
  });

  // ================= NGÀY / GIỜ XEM =================
  var DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  var daysBox = $('#days');
  if (daysBox) {
    var now = new Date(), start = now.getHours() >= 17 ? 1 : 0, html = '';
    for (var i = start; i < start + 7; i++) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      var dd = ('0' + d.getDate()).slice(-2), mm = ('0' + (d.getMonth() + 1)).slice(-2);
      var lab = i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : DOW[d.getDay()];
      var val = dd + '/' + mm + ' (' + (i === 0 ? 'hôm nay' : DOW[d.getDay()]) + ')';
      html += '<label class="day' + (i === start ? ' on' : '') + '"><input type="radio" name="day" value="' + val + '"' + (i === start ? ' checked' : '') + '><small>' + lab + '</small><b>' + dd + '</b><small>Th' + (d.getMonth() + 1) + '</small></label>';
    }
    daysBox.innerHTML = html;
  }
  function syncPicks(name, cls) {
    $$('input[name="' + name + '"]').forEach(function (r) { r.closest('.' + cls).classList.toggle('on', r.checked); });
  }
  document.addEventListener('change', function (e) {
    if (e.target.name === 'day') syncPicks('day', 'day');
    if (e.target.name === 'slot') syncPicks('slot', 'slot');
  });
  syncPicks('slot', 'slot');

  // ================= GỬI FORM =================
  // Máy chủ /api/lead: lưu CRM + báo Telegram + gửi TikTok/Facebook từ máy chủ (cùng event_id với pixel)
  function postApi(payload, extra) {
    if (!LP.leadApi || location.protocol === 'file:') return Promise.reject(new Error('no-api'));
    var body = {}; Object.keys(payload).forEach(function (k) { body[k] = payload[k]; });
    Object.keys(extra).forEach(function (k) { body[k] = extra[k]; });
    return fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j || j.ok !== true) throw new Error((j && j.error) || 'api-fail'); return true; });
  }
  function settle(p) { return p.then(function () { return true; }, function () { return false; }); }

  if (form) {
    var phoneInput = form.elements.phone, phoneErr = $('#phoneErr');
    phoneInput.addEventListener('input', function () { phoneInput.classList.remove('bad'); phoneErr.hidden = true; });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (form.getAttribute('data-sending') === '1') return;
      if (form.elements.website.value) return; // bẫy bot
      var e164 = normalizePhoneVN(phoneInput.value);
      if (!e164) { phoneInput.classList.add('bad'); phoneErr.hidden = false; phoneInput.focus(); return; }

      var mode = form.elements.mode.value;
      var dayEl = form.querySelector('input[name="day"]:checked'), slotEl = form.querySelector('input[name="slot"]:checked');
      var userNote = form.elements.note.value.trim();
      var note = mode === 'xem'
        ? '[Đặt lịch xem] ' + (dayEl ? dayEl.value : '') + (slotEl ? ' · ' + slotEl.value : '') + (userNote ? ' · ' + userNote : '')
        : '[Nhận ảnh & tư vấn]' + (userNote ? ' ' + userNote : '');
      var eventId = 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      var payload = {
        name: form.elements.name.value.trim(), phone: phoneInput.value.trim(), email: '', note: note,
        event_id: eventId, ttclid: getTtclid(), ttp: getCookie('_ttp'), user_agent: navigator.userAgent,
        page_url: location.href, referrer: document.referrer || '', property_id: String(LP.id || ''), property_name: String(LP.name || '')
      };

      var btn = $('#leadBtn');
      form.setAttribute('data-sending', '1'); btn.disabled = true; btn.style.opacity = '.7';
      var done = function (ok) {
        form.setAttribute('data-sending', '0'); btn.disabled = false; btn.style.opacity = '';
        if (!ok) { alert('Gửi chưa thành công. Anh/chị nhắn Zalo hoặc gọi trực tiếp giúp em nhé.'); return; }
        form.hidden = true; $('.mode', card).hidden = true; $('#leadDone').hidden = false;
        if (LP.demo) $('#doneText').textContent = 'Bản mẫu: form chưa nối Google Sheet nên thông tin chưa được gửi đi.';
        else if (mode === 'xem' && dayEl) $('#doneText').textContent = 'Lịch xem ' + dayEl.value + (slotEl ? ', ' + slotEl.value : '') + ' đã được ghi nhận. Bên em gọi lại xác nhận trong ít phút.';
        card.scrollIntoView({ block: 'center', behavior: 'smooth' });
      };
      if (LP.demo) { setTimeout(function () { done(true); }, 400); return; }

      var src = getSrc();
      var extra = { mode: mode, appointment: mode === 'xem' && dayEl ? dayEl.value + (slotEl ? ' · ' + slotEl.value : '') : '', user_note: userNote,
        utm_source: src.utm_source || '', utm_medium: src.utm_medium || '', utm_campaign: src.utm_campaign || '', utm_content: src.utm_content || '', fbclid: src.fbclid || '',
        gclid: src.gclid || '', gbraid: src.gbraid || '', wbraid: src.wbraid || '',
        fbp: getCookie('_fbp'), fbc: getFbc(src) };
      settle(postApi(payload, extra)).then(function (ok) {
        if (ok) {
          try { localStorage.setItem('lp_lead_done', String(Date.now())); } catch (e) { /* bỏ qua */ }
          var ng = $('#nudge'); if (ng) { ng.hidden = true; upd(); }
          sha256(e164).then(function (h) {
            if (ttq()) {
              if (h && typeof ttq().identify === 'function') ttq().identify({ phone_number: h, external_id: h });
              ttq().track('SubmitForm', contentProps(), { event_id: eventId }); // TikTok không có sự kiện chuẩn "Lead"; máy chủ cũng gửi SubmitForm cùng event_id
            }
            if (fbq()) fbq()('track', 'Lead', { content_name: LP.name, content_ids: [String(LP.id || '')], content_type: 'product' }, { eventID: eventId });
            // Google Ads: chuyển đổi nâng cao — SĐT dạng +84… băm SHA-256 (đúng chuẩn Google), transaction_id = event_id để không đếm trùng
            dl({ event: 'lead_submit', event_id: eventId, lead_mode: mode, property_id: String(LP.id || ''), value: 0, currency: 'VND',
              user_data: h ? { sha256_phone_number: h } : { phone_number: e164 } });
            if (gtagF() && LP.gads.lead) {
              gtagF()('set', 'user_data', h ? { sha256_phone_number: h } : { phone_number: e164 });
              gadsConv(LP.gads.lead, { transaction_id: eventId });
            }
          });
        }
        done(ok);
      });
    });
  }

  // ================= TÍNH KHOẢN VAY =================
  var pct = $('#lpPct');
  if (pct && LP.price) {
    var yrs = $('#lpYears'), rate = $('#lpRate');
    var fmt = function (v) {
      if (!isFinite(v) || v <= 0) return '0';
      if (v >= 1e9) return (v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ';
      return Math.round(v / 1e6).toLocaleString('vi-VN') + ' triệu';
    };
    var fmtMonth = function (v) { return isFinite(v) && v > 0 ? (v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' triệu' : '–'; };
    var calc = function () {
      var p = +pct.value, n = +yrs.value * 12, r = Math.max(0, +String(rate.value).replace(',', '.')) / 1200;
      var amt = LP.price * p / 100;
      $('#lpOut').textContent = p + '%';
      pct.style.setProperty('--p', (p / (+pct.max || 80) * 100) + '%');
      var m = r ? amt * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : amt / n;
      $('#lpDown').textContent = fmt(LP.price - amt);
      $('#lpAmt').textContent = fmt(amt);
      $('#lpMonth').textContent = amt ? fmtMonth(m) : '–';
      $('#lpFirst').textContent = amt ? fmtMonth(amt / n + amt * r) : '–';
    };
    [pct, yrs, rate].forEach(function (el) { el.addEventListener('input', calc); el.addEventListener('change', calc); });
    calc();
  }

  // ================= ALBUM + XEM ẢNH LỚN =================
  var all = [];
  try { all = JSON.parse(($('#galleryData') || {}).textContent || '[]'); } catch (e) { all = []; }
  var lb = $('#lb'), lbImg = $('#lbImg'), list = [], idx = 0, curGroup = '*';
  $$('#anh .tab').forEach(function (t) {
    t.addEventListener('click', function () {
      curGroup = t.getAttribute('data-g');
      $$('#anh .tab').forEach(function (x) { x.classList.toggle('on', x === t); });
      var first = true;
      $$('#anh .gi').forEach(function (g) {
        var show = curGroup === '*' || g.getAttribute('data-g') === curGroup;
        g.hidden = !show;
        g.classList.toggle('gi-big', show && first && curGroup === '*');
        if (show) first = false;
      });
      var grid = $('#anh .grid'), more = $('#moreBtn');
      if (grid) grid.classList.toggle('grid-all', curGroup !== '*' || grid.getAttribute('data-open') === '1');
      if (more) more.hidden = curGroup !== '*' || (grid && grid.getAttribute('data-open') === '1');
    });
  });
  var moreBtn = $('#moreBtn');
  if (moreBtn) moreBtn.addEventListener('click', function () {
    var grid = $('#anh .grid'); grid.setAttribute('data-open', '1'); grid.classList.add('grid-all'); moreBtn.hidden = true;
  });
  function show(i) {
    idx = (i + list.length) % list.length;
    window.__lpImgViews = (window.__lpImgViews || 0) + 1;
    var it = list[idx];
    lbImg.style.opacity = '0';
    var im = new Image();
    im.onload = im.onerror = function () { lbImg.src = it.src; lbImg.alt = it.alt || ''; lbImg.style.opacity = '1'; };
    im.src = it.src;
    $('#lbCount').textContent = list.length > 1 ? (idx + 1) + ' / ' + list.length : '';
    $('#lbCap').textContent = it.group || it.alt || '';
    [1, -1].forEach(function (k) { if (list.length > 1) { var p = new Image(); p.src = list[(idx + k + list.length) % list.length].src; } });
    $$('.lb-nav', lb).forEach(function (b) { b.style.visibility = list.length > 1 ? '' : 'hidden'; });
  }
  function open(items, i) {
    list = items; if (!list.length) return;
    lb.hidden = false; document.body.classList.add('lock'); show(i || 0);
    $('.lb-x', lb).focus();
  }
  function close() { lb.hidden = true; document.body.classList.remove('lock'); lbImg.removeAttribute('src'); }
  $$('#anh .gi').forEach(function (g) {
    g.addEventListener('click', function () {
      var items = all.filter(function (x) { return curGroup === '*' || x.group === curGroup; });
      var it = all[+g.getAttribute('data-i')];
      open(items, Math.max(0, items.indexOf(it)));
    });
  });
  $$('[data-zoom]').forEach(function (b) {
    b.addEventListener('click', function () { var m = b.getAttribute('data-zoom-m'); open([{ src: (m && innerWidth < 720) ? m : b.getAttribute('data-zoom'), alt: b.getAttribute('aria-label') || '' }], 0); });
  });
  if (lb) {
    $('.lb-x', lb).addEventListener('click', close);
    $('.lb-prev', lb).addEventListener('click', function () { show(idx - 1); });
    $('.lb-next', lb).addEventListener('click', function () { show(idx + 1); });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
    var sx = 0, sy = 0, st = $('#lbStage');
    st.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    st.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(idx + (dx < 0 ? 1 : -1));
      else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) close();
    }, { passive: true });
    st.addEventListener('click', function (e) { if (e.target === st) close(); });
  }

  // ================= MẶT BẰNG =================
  $$('.fp-tab').forEach(function (t) {
    t.addEventListener('click', function () {
      var k = t.getAttribute('data-fp');
      $$('.fp-tab').forEach(function (x) { x.classList.toggle('on', x === t); });
      $$('.fp').forEach(function (f) { f.classList.toggle('on', f.getAttribute('data-fp') === k); });
    });
  });

  // ================= HIỆN DẦN KHI CUỘN =================
  // Chỉ gắn cho khối nằm DƯỚI màn đầu (màn đầu hiện ngay, không chờ hiệu ứng). Máy không hỗ trợ → hiện bình thường.
  (function () {
    window.__rv = true;
    var root = document.documentElement;
    if (!('IntersectionObserver' in window) || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) { root.classList.remove('rv-on'); return; }
    var els = $$('.sec .eyebrow, .sec h2, .hl li, .grid, .specs, .addr, .lmap, .legend li, .price-card, .docs, .form-card, .agent, .agent-cta, .faq details, .facts li');
    var fold = innerHeight; // chỉ ẩn khối thật sự nằm ngoài màn hình lúc mở trang
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el, i) {
      if (el.getBoundingClientRect().top < fold) return;
      el.classList.add('rv');
      el.style.transitionDelay = (i % 4) * 70 + 'ms';
      io.observe(el);
    });
  })();

  // ================= VIDEO + BẢN ĐỒ (chỉ tải khi bấm) =================
  function playVid(v, start) {
    var yt = v.getAttribute('data-yt'), mp4 = v.getAttribute('data-mp4'), t = Math.max(0, start | 0);
    if (!v.getAttribute('data-html')) v.setAttribute('data-html', v.innerHTML);
    v.setAttribute('data-on', '1');
    dl({ event: 'video_play', video_id: yt || mp4 || '' });
    if (yt) v.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(yt) + '?autoplay=1&playsinline=1&rel=0&modestbranding=1' + (t ? '&start=' + t : '') + '" title="Video căn nhà" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
    else if (mp4) {
      var el = $('video', v);
      if (el) { el.currentTime = t; el.play(); return; }
      v.innerHTML = '<video src="' + mp4 + (t ? '#t=' + t : '') + '" controls autoplay playsinline></video>';
    }
  }
  function resetVid(v) { if (v.getAttribute('data-on')) { v.innerHTML = v.getAttribute('data-html'); v.removeAttribute('data-on'); } }
  $$('.vid').forEach(function (v) { v.addEventListener('click', function () { if (!v.getAttribute('data-on')) playVid(v, 0); }); });
  // Nút "nhảy tới từng phòng"
  $$('.chap button').forEach(function (b) {
    b.addEventListener('click', function () {
      var pane = b.closest('.vpane'), v = $('.vid', pane);
      $$('.chap button', pane).forEach(function (x) { x.classList.toggle('on', x === b); });
      playVid(v, +b.getAttribute('data-t'));
      v.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  });
  // Tab video dọc / ngang: điện thoại mở sẵn video dọc, máy tính mở sẵn video ngang
  var vtabs = $$('.vtab button');
  function pickVid(i) {
    vtabs.forEach(function (b) { var on = b.getAttribute('data-v') === String(i); b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    $$('.vpane').forEach(function (p) { var on = p.getAttribute('data-v') === String(i); if (!on) resetVid($('.vid', p)); p.hidden = !on; });
  }
  vtabs.forEach(function (b) { b.addEventListener('click', function () { pickVid(b.getAttribute('data-v')); }); });
  if (vtabs.length) {
    var wantTall = innerWidth < 720 ? '1' : '0';
    var first = vtabs.filter(function (b) { return b.getAttribute('data-tall') === wantTall; })[0];
    if (first) pickVid(first.getAttribute('data-v'));
  }
  $$('.map').forEach(function (m) {
    $('.map-btn', m).addEventListener('click', function () {
      m.innerHTML = '<iframe src="https://www.google.com/maps?q=' + encodeURIComponent(m.getAttribute('data-q')) + '&z=16&output=embed" title="Bản đồ vị trí căn nhà" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>';
    });
  });

  // ================= VIDEO YOUTUBE ĐẦU TRANG TỰ CHẠY (Giang chọn 21/11) =================
  // Điện thoại chỉ cho tự chạy khi TẮT TIẾNG → có nút "Bật tiếng". Ảnh nhà (LCP) hiện ngay; trình phát YouTube (~1 MB) tải SAU khi trang hiện xong,
  // nằm DƯỚI ảnh bìa và chỉ hiện lên khi YouTube báo đang phát → khách không thấy màn đen. Mạng yếu / tiết kiệm dữ liệu / giảm chuyển động → giữ nút ▶ như cũ.
  // Lướt khỏi video mà video còn tắt tiếng → tạm dừng (đỡ tốn dữ liệu của khách), lướt lại → chạy tiếp.
  var hv = $('.hero-v .vid');
  if (hv && hv.getAttribute('data-yt')) {
    var cn = navigator.connection || {};
    var weak = cn.saveData || /(^|-)2g$/.test(cn.effectiveType || '') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    var ytWin = null, ytMuted = true, ytPlaying = false, ytReady = false, ytErr = false, inView = true, failT = 0, ytIfr = null;
    var ytCmd = function (func, args) { if (ytWin) try { ytWin.postMessage(JSON.stringify({ event: 'command', func: func, args: args || [] }), '*'); } catch (e) { /* bỏ qua */ } };
    var snd = document.createElement('button');
    snd.type = 'button'; snd.className = 'vid-snd'; snd.hidden = true; snd.innerHTML = '🔊 Bật tiếng';
    var onPlaying = function () {
      if (ytPlaying) return; ytPlaying = true; clearTimeout(failT);
      hv.setAttribute('data-on', 'auto'); // ẩn ảnh bìa, nhường chỗ cho video
      if (ytMuted) snd.hidden = false;
    };
    addEventListener('message', function (e) {
      if (!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(e.origin)) return;
      var d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (er) { return; }
      if (!d) return;
      var info = d.info || {};
      if (d.event === 'onReady') ytReady = true;
      if (d.event === 'onError') { ytErr = true; dropYt(); }
      if ((d.event === 'onStateChange' && d.info === 1) || info.playerState === 1) onPlaying();
      if (typeof info.muted === 'boolean') { ytMuted = info.muted; if (!ytMuted) snd.hidden = true; }
    });
    var dropYt = function () { clearTimeout(failT); if (ytIfr && ytIfr.parentNode && !ytPlaying) { ytIfr.parentNode.removeChild(ytIfr); ytWin = null; ytIfr = null; } };
    var autoStart = function () {
      if (hv.getAttribute('data-on')) return; // khách đã tự bấm ▶
      var yt = encodeURIComponent(hv.getAttribute('data-yt')), st = +hv.getAttribute('data-start') || 0;
      var ifr = ytIfr = document.createElement('iframe');
      ifr.className = 'yt-auto'; ifr.title = 'Video căn nhà';
      ifr.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen'); ifr.setAttribute('allowfullscreen', '');
      ifr.src = 'https://www.youtube-nocookie.com/embed/' + yt + '?autoplay=1&mute=1&playsinline=1&loop=1&playlist=' + yt + '&rel=0&modestbranding=1&enablejsapi=1'
        + (st ? '&start=' + st : '') + '&origin=' + encodeURIComponent(location.origin);
      ifr.addEventListener('load', function () {
        ytWin = ifr.contentWindow;
        try { ytWin.postMessage(JSON.stringify({ event: 'listening', id: 'hero', channel: 'widget' }), '*'); } catch (e) { /* bỏ qua */ }
      });
      hv.insertBefore(ifr, hv.firstChild);
      hv.appendChild(snd);
      // 12 giây chưa chạy: trình phát đã sẵn sàng (trình duyệt chặn tự chạy, vd. iPhone tiết kiệm pin) → cho hiện trình phát YouTube,
      // khách chạm ▶ của YouTube là chạy ngay (đã tải xong, không chờ màn đen). Trình phát lỗi / chưa tải xong → gỡ, giữ ảnh + nút ▶ như cũ.
      failT = setTimeout(function () {
        if (ytPlaying || !ifr.parentNode) return;
        if (ytReady && !ytErr) hv.setAttribute('data-on', 'auto'); else dropYt();
      }, 12000);
    };
    snd.addEventListener('click', function (e) {
      e.stopPropagation();
      ytCmd('unMute'); ytCmd('setVolume', [100]); ytCmd('playVideo');
      dl({ event: 'video_play', video_id: hv.getAttribute('data-yt'), video_mode: 'unmute' });
      snd.innerHTML = 'Đang bật tiếng…';
      setTimeout(function () { if (ytMuted && !snd.hidden) { snd.innerHTML = 'Chạm vào video, bấm biểu tượng 🔇 để bật tiếng'; setTimeout(function () { snd.hidden = true; }, 5000); } }, 1200);
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          inView = en.isIntersecting;
          if (!ytPlaying || !ytMuted) return; // khách đang nghe tiếng thì để chạy tiếp
          ytCmd(inView ? 'playVideo' : 'pauseVideo');
        });
      }, { threshold: 0.25 }).observe(hv);
    }
    if (!weak) {
      var go = function () { setTimeout(autoStart, 250); };
      if (document.readyState === 'complete') go(); else addEventListener('load', go);
    }
  }

  // ================= CLIP NỀN HERO (tải sau khi trang hiện xong; điện thoại dùng clip dọc) =================
  var heroVid = $('.hero-vid');
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  if (heroVid && !calm && !saveData) {
    var startHero = function () {
      var m = heroVid.getAttribute('data-src-m'), d = heroVid.getAttribute('data-src');
      var src = innerWidth < 720 ? (m || d) : (d || m);
      if (!src) return;
      heroVid.addEventListener('playing', function () { heroVid.classList.add('on'); }, { once: true });
      heroVid.src = src;
      var pr = heroVid.play(); if (pr && pr.catch) pr.catch(function () { /* trình duyệt chặn tự chạy: giữ ảnh */ });
    };
    if (document.readyState === 'complete') setTimeout(startHero, 400); else addEventListener('load', function () { setTimeout(startHero, 400); });
  }

  // ================= THANH LIÊN HỆ ĐÁY =================
  var bar = $('#bar'), heroCta = $('#heroCta'), formSec = $('#dat-lich'), nudge = $('#nudge');
  var vis = { hero: true, form: false };
  // Thẻ nhắc đang mở → ẩn thanh đáy (thẻ đã có đủ Gọi / Zalo / Đặt lịch), tránh 2 bộ nút trùng nhau. Đóng thẻ → thanh đáy hiện lại.
  var upd = function () {
    var nOpen = nudge && !nudge.hidden;
    if (bar) bar.classList.toggle('hide', vis.hero || vis.form || nOpen);
    if (nudge) nudge.classList.toggle('nobar', true);
  };
  if (bar && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.target === heroCta) vis.hero = e.isIntersecting; else vis.form = e.isIntersecting; });
      upd();
    }, { threshold: 0.15 }).observe(heroCta);
    var io2 = new IntersectionObserver(function (es) {
      es.forEach(function (e) { vis.form = e.isIntersecting; });
      // Khách đã tới form → thẻ nhắc xong việc, tự đóng để không che ô nhập
      if (vis.form && nudge && !nudge.hidden) nudge.hidden = true;
      upd();
    }, { threshold: 0.2 });
    io2.observe(formSec);
    upd();
  }

  // ================= THANH ĐẦU TRANG (điện thoại) =================
  // Lướt xuống → ẩn (thanh đáy đã có Gọi/Zalo/Đặt lịch), lướt lên → hiện lại. Màn 360×640 trong TikTok/Facebook lấy lại ~56px đọc nội dung.
  var top = $('.top');
  if (top && window.matchMedia && matchMedia('(max-width: 899px)').matches) {
    var lastY = scrollY, ticking = false;
    addEventListener('scroll', function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        var y = scrollY, dy = y - lastY;
        if (y < 120 || dy < -6) top.classList.remove('top-up');
        else if (dy > 6) top.classList.add('top-up');
        if (Math.abs(dy) > 6) lastY = y;
        ticking = false;
      });
    }, { passive: true });
  }

  // ================= THẺ NHẮC (thay popup) =================
  // Mỗi lượt vào trang hiện tối đa 1 lần (sessionStorage — khách quay lại từ quảng cáo nhắc lại vẫn được mời), khi khách ĐÃ XEM KỸ (lướt quá nửa trang, xem ≥ 5 ảnh, hoặc ở lại ≥ 45 giây và đã lướt ≥ 25%).
  // Không hiện nếu khách đã để lại số / đã bấm gọi-Zalo, đang xem ảnh lớn, đang ở form hoặc đang gõ.
  if (nudge) {
    var NKEY = 'lp_nudge_s', t0 = Date.now(), maxDepth = 0, shown = false;
    var seenThisVisit = function () { try { return !!sessionStorage.getItem(NKEY); } catch (e) { return false; } };
    var markSeen = function () { try { sessionStorage.setItem(NKEY, '1'); } catch (e) { /* bỏ qua */ } };
    var recent = function (k, ms) { try { var v = +localStorage.getItem(k); return v && Date.now() - v < ms; } catch (e) { return false; } };
    var depth = function () { var d = document.documentElement, mx = d.scrollHeight - innerHeight; return mx > 0 ? scrollY / mx : 0; };
    var hideNudge = function () { nudge.hidden = true; markSeen(); upd(); };
    var check = function () {
      if (shown) return;
      maxDepth = Math.max(maxDepth, depth());
      if (seenThisVisit() || recent('lp_lead_done', 30 * 864e5) || recent('lp_contacted', 864e5)) return;
      var lbEl = $('#lb'), act = document.activeElement;
      if (vis.form || (lbEl && !lbEl.hidden) || (act && /INPUT|TEXTAREA|SELECT/.test(act.tagName))) return;
      var engaged = maxDepth >= 0.5 || (window.__lpImgViews || 0) >= 5 || (Date.now() - t0 >= 45000 && maxDepth >= 0.25);
      if (!engaged) return;
      shown = true; nudge.hidden = false; markSeen(); upd();
    };
    addEventListener('scroll', check, { passive: true });
    setInterval(check, 3000);
    $('.nudge-x', nudge).addEventListener('click', hideNudge);
    document.addEventListener('focusin', function (e) { if (!nudge.hidden && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) hideNudge(); });
    $$('a', nudge).forEach(function (a) { a.addEventListener('click', function () { nudge.hidden = true; upd(); }); });
    var ty = null;
    nudge.addEventListener('touchstart', function (e) { ty = e.touches[0].clientY; }, { passive: true });
    nudge.addEventListener('touchmove', function (e) { if (ty !== null && e.touches[0].clientY - ty > 40) { ty = null; hideNudge(); } }, { passive: true });
  }
})();
