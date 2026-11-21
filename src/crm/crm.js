// CRM mini cho sale chăm khách từ landing page.
// Dữ liệu nằm trong schema riêng `nx` (dự án Supabase giang-ai-marketing-os, tạm). Trình duyệt KHÔNG đọc bảng trực tiếp:
// mọi thao tác gọi hàm public.nx_crm_* kèm mật khẩu CRM (hàm tự kiểm bằng bcrypt). Không dùng Supabase Auth.
import { SOURCES, sourceKey, sourceLabel } from './source.js';

const CFG = window.CRM_CFG || {};
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUSES = ['Mới', 'Đã gọi', 'Khách thật', 'Hẹn xem nhà', 'Đã xem nhà', 'Đặt cọc', 'Không liên lạc được', 'Sai số / Rác'];
const CLOSED = ['Đặt cọc', 'Sai số / Rác'];
const ADS = { 'Khách thật': 1, 'Hẹn xem nhà': 1, 'Đặt cọc': 1 }; // đổi sang các trạng thái này → gửi TikTok + Facebook
const pillCls = (s) => ({ 'Mới': 's-moi', 'Hẹn xem nhà': 's-hen', 'Đặt cọc': 's-coc', 'Sai số / Rác': 's-rac', 'Không liên lạc được': 's-rac' }[s] || '');
const digits = (p) => String(p || '').replace(/\D/g, '');
const ago = (t) => {
  const m = Math.round((Date.now() - new Date(t)) / 60000);
  if (m < 1) return 'vừa xong'; if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60); if (h < 24) return `${h} giờ trước`;
  return new Date(t).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const fmtDT = (t) => (t ? new Date(t).toLocaleString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const toLocalInput = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 16); };
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), ms); }

if (!CFG.supabaseUrl || !CFG.supabaseKey) {
  document.body.insertAdjacentHTML('beforeend', '<p class="wrap empty">CRM chưa được cấu hình (thiếu crm.supabaseUrl / supabaseKey trong data/site.json).</p>');
  throw new Error('no config');
}
const PASS_KEY = 'nx_crm_pass', WHO_KEY = 'nx_crm_who';
const getPass = () => { try { return localStorage.getItem(PASS_KEY) || ''; } catch { return ''; } };
const getWho = () => { try { return localStorage.getItem(WHO_KEY) || ''; } catch { return ''; } };
// Gọi hàm nx_crm_* → { data, error } (cùng dạng kết quả cũ để phần giao diện giữ nguyên)
async function rpc(fn, args = {}) {
  try {
    const r = await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/${fn}`, { method: 'POST',
      headers: { apikey: CFG.supabaseKey, Authorization: `Bearer ${CFG.supabaseKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_pass: getPass(), ...args }) });
    const t = await r.text(); const j = t ? JSON.parse(t) : null;
    if (!r.ok) {
      if (r.status === 403 || (j && j.code === '42501')) { logout(true); return { data: null, error: { message: 'Mật khẩu CRM không đúng hoặc đã đổi' } }; }
      return { data: null, error: { message: (j && j.message) || r.status } };
    }
    return { data: j, error: null };
  } catch (e) { return { data: null, error: { message: 'Mất mạng? ' + e.message } }; }
}
function logout(expired) { try { localStorage.removeItem(PASS_KEY); } catch { /* bỏ qua */ } if (expired) showAuth('Mật khẩu CRM không đúng hoặc đã đổi — nhập lại.', true); }
const S = { leads: [], filter: 'Tất cả', q: '', house: '', src: '', limit: 200, open: null, tab: 'list', range: 30, lastMax: 0 };
// Mức chất lượng theo trạng thái hiện tại (âm = loại)
const STAGE = { 'Mới': 0, 'Đã gọi': 1, 'Khách thật': 2, 'Hẹn xem nhà': 3, 'Đã xem nhà': 4, 'Đặt cọc': 5, 'Không liên lạc được': -1, 'Sai số / Rác': -2 };
const SHORT = { tiktok_ads: 'TikTok QC', facebook_ads: 'Facebook QC', facebook: 'Facebook', tiktok: 'TikTok', zalo: 'Zalo', google: 'Google', youtube: 'YouTube', referral: 'Giới thiệu', offline: 'Biển bán', direct: 'Trực tiếp' };
const srcShort = (l) => SHORT[sourceKey(l)] || sourceLabel(l);
const money = (v) => (v >= 1e9 ? (v / 1e9).toFixed(2).replace(/\.?0+$/, '').replace('.', ',') + ' tỷ' : Math.round(v / 1e6).toLocaleString('vi-VN') + ' triệu');
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// ================= ĐĂNG NHẬP =================
async function boot() {
  if (!getPass()) return showAuth();
  const ok = await rpc('nx_crm_check');
  if (ok.error || ok.data !== true) return showAuth(ok.error ? ok.error.message : 'Mật khẩu CRM không đúng.', true);
  $('#authView').hidden = true; $('#appView').hidden = false; $('#who').hidden = false; $('#whoName').textContent = getWho();
  await loadLeads();
  poll();
  openFromHash();
}
function showAuth(msg = '', err = false) {
  $('#authView').hidden = false; $('#appView').hidden = true; $('#who').hidden = true;
  const m = $('#authMsg'); m.textContent = msg; m.classList.toggle('err', err);
  const f = $('#authForm'); if (f && !f.who.value) f.who.value = getWho();
}
$('#authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, m = $('#authMsg');
  m.textContent = 'Đang kiểm tra…'; m.classList.remove('err');
  try { localStorage.setItem(PASS_KEY, f.password.value); localStorage.setItem(WHO_KEY, f.who.value.trim()); } catch { /* bỏ qua */ }
  boot();
});
$('#logoutBtn').addEventListener('click', () => { logout(false); location.hash = ''; location.reload(); });

// ================= DỮ LIỆU =================
async function loadLeads() {
  const { data, error } = await rpc('nx_crm_leads', { p_limit: S.limit });
  if (error) return toast('Lỗi tải khách: ' + error.message, 5000);
  S.leads = data || [];
  S.lastMax = Math.max(0, ...S.leads.map((l) => l.id));
  $('#moreLeads').hidden = S.leads.length < S.limit;
  const houses = [...new Set(S.leads.map((l) => l.property_name).filter(Boolean))];
  $('#houseSel').innerHTML = '<option value="">Tất cả căn</option>' + houses.map((h) => `<option${h === S.house ? ' selected' : ''}>${esc(h)}</option>`).join('');
  $('#srcSel').innerHTML = '<option value="">Tất cả nguồn</option>' + SOURCES.map((x) => `<option value="${x.key}"${x.key === S.src ? ' selected' : ''}>${esc(x.label)}</option>`).join('');
  render();
}
// Không dùng realtime (bảng kín) → 30 giây hỏi lại 1 lần khi trang đang mở; có khách mới thì báo + rung
function poll() {
  setInterval(async () => {
    if (document.hidden || !getPass()) return;
    const { data } = await rpc('nx_crm_leads', { p_limit: 20 });
    if (!data) return;
    const fresh = data.filter((l) => l.id > S.lastMax);
    if (!fresh.length) return;
    fresh.reverse().forEach((l) => { S.leads.unshift({ ...l, _new: true }); toast(`🔔 Khách mới: ${l.name || l.phone}`, 5000); });
    S.lastMax = Math.max(S.lastMax, ...fresh.map((l) => l.id));
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    render();
  }, 30000);
}

// ================= DANH SÁCH =================
const isDue = (l) => l.next_follow_at && new Date(l.next_follow_at) <= new Date() && !CLOSED.includes(l.status);
function visible() {
  const q = S.q.trim().toLowerCase(), qd = digits(q);
  return S.leads.filter((l) => {
    if (S.house && l.property_name !== S.house) return false;
    if (S.src && sourceKey(l) !== S.src) return false;
    if (S.filter === 'Cần gọi lại' && !isDue(l)) return false;
    if (S.filter === 'Hôm nay' && new Date(l.created_at).toDateString() !== new Date().toDateString()) return false;
    if (!['Tất cả', 'Cần gọi lại', 'Hôm nay'].includes(S.filter) && l.status !== S.filter) return false;
    if (q && !((l.name || '').toLowerCase().includes(q) || (qd && digits(l.phone).includes(qd)))) return false;
    return true;
  });
}
function render() {
  const today = new Date().toDateString();
  const cnt = { 'Mới': 0, 'Cần gọi lại': 0, 'Hẹn xem nhà': 0, 'Hôm nay': 0 };
  S.leads.forEach((l) => { if (l.status === 'Mới') cnt['Mới']++; if (isDue(l)) cnt['Cần gọi lại']++; if (l.status === 'Hẹn xem nhà') cnt['Hẹn xem nhà']++; if (new Date(l.created_at).toDateString() === today) cnt['Hôm nay']++; });
  $('#stats').innerHTML = Object.entries(cnt).map(([k, v]) => `<button class="stat${(k === 'Mới' || k === 'Cần gọi lại') && v ? ' hot' : ''}" data-f="${esc(k)}"><b>${v}</b><small>${esc(k === 'Mới' ? 'Khách mới' : k)}</small></button>`).join('');
  const byStatus = {}; S.leads.forEach((l) => (byStatus[l.status] = (byStatus[l.status] || 0) + 1));
  $('#statusChips').innerHTML = ['Tất cả', 'Cần gọi lại', 'Hôm nay', ...STATUSES].map((s) => `<button class="${s === S.filter ? 'on' : ''}" data-f="${esc(s)}">${esc(s)}${byStatus[s] ? `<small>${byStatus[s]}</small>` : ''}</button>`).join('');
  const rows = visible();
  $('#empty').hidden = rows.length > 0;
  $('#list').innerHTML = rows.map((l) => `<li class="lead${l._new ? ' new' : ''}" data-id="${l.id}">
    <div><div class="nm">${esc(l.name || 'Khách chưa để tên')}</div><div class="ph">${esc(l.phone)}</div></div>
    <div class="acts"><a class="call" href="tel:${digits(l.phone)}" data-act>Gọi</a><a href="https://zalo.me/${digits(l.phone)}" target="_blank" rel="noopener" data-act>Zalo</a></div>
    <div class="meta"><b class="pill ${pillCls(l.status)}">${esc(l.status)}</b>${l.mode === 'goi' ? '<span class="src s-goi">📞 Gọi tới</span>' : ''}<span class="src s-${sourceKey(l)}">${esc(srcShort(l))}</span>${l.appointment ? `<span>🗓 ${esc(l.appointment)}</span>` : ''}${isDue(l) ? `<span class="warn">⏰ gọi lại ${esc(fmtDT(l.next_follow_at))}</span>` : ''}${l.duplicate_of ? '<span class="warn">Trùng SĐT</span>' : ''}<em>${esc(l.property_name || '')}</em><em>· ${esc(ago(l.created_at))}</em></div>
  </li>`).join('');
}
document.addEventListener('click', (e) => {
  const f = e.target.closest('[data-f]'); if (f) { S.filter = f.dataset.f; render(); return; }
  if (e.target.closest('[data-act]')) return;
  const li = e.target.closest('.lead'); if (li) location.hash = 'lead-' + li.dataset.id;
});
$('#q').addEventListener('input', (e) => { S.q = e.target.value; render(); });
$('#houseSel').addEventListener('change', (e) => { S.house = e.target.value; render(); });
$('#srcSel').addEventListener('change', (e) => { S.src = e.target.value; render(); });
$('#moreLeads').addEventListener('click', () => { S.limit += 200; loadLeads(); });

// ================= CHẤT LƯỢNG & NGUỒN =================
function setTab(t) {
  S.tab = t;
  document.querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  $('#listView').hidden = t !== 'list'; $('#reportView').hidden = t !== 'report'; $('#linksView').hidden = t !== 'links';
  if (t === 'report') loadReport();
  if (t === 'links') renderLinks();
}
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
// ================= LINK — copy dán, không cần hiểu UTM =================
// Quảng cáo: link dài cũng được (khách không thấy, chỉ là nút bấm). Gửi tay / đăng bài: link ngắn /<short>-zalo … (build.mjs → _redirects).
function renderLinks() {
  const base = location.origin;
  const hs = CFG.houses || [];
  const row = (title, how, val) => `<div class="lk"><div class="lk-h"><b>${esc(title)}</b>${how ? `<small>${esc(how)}</small>` : ''}</div>
    <div class="lk-v"><code>${esc(val)}</code><button type="button" class="lk-copy" data-copy="${esc(val)}">Copy</button></div></div>`;
  $('#links').innerHTML = hs.length ? hs.map((h) => {
    const page = `${base}/${h.slug}/`;
    const s = h.short;
    const ad = (src) => `${page}?utm_source=${src}&utm_medium=paid&utm_campaign=${s || 'qc'}-${src}`;
    return `<section class="rblk"><h3>${esc(h.name)}</h3>
      <p class="lk-sec">Dán vào QUẢNG CÁO <span class="mut">(link dài không sao — khách chỉ thấy nút bấm)</span></p>
      ${row('TikTok', 'Ô "URL" của quảng cáo', `${page}?utm_source=tiktok&utm_medium=paid&utm_campaign=__CAMPAIGN_NAME__&utm_content=__CID_NAME__`)}
      ${row('Facebook — ô "URL trang web"', '', page)}
      ${row('Facebook — ô "Tham số URL" (ngay dưới)', 'Dán 1 lần, nhân bản quảng cáo tự giữ', 'utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}')}
      ${row('Google Tìm kiếm', 'Ô "URL cuối cùng"', ad('google'))}
      ${row('YouTube', 'Ô "URL cuối cùng"', ad('youtube'))}
      ${s ? `<p class="lk-sec">Gửi khách / đăng bài <span class="mut">(link ngắn, tự ghi nguồn)</span></p>
      ${row('Nhắn Zalo, nhóm Zalo', '', `${base}/${s}-zalo`)}
      ${row('Mô tả video YouTube của kênh', '', `${base}/${s}-yt`)}
      ${row('Bài đăng Facebook (không phải quảng cáo)', '', `${base}/${s}-fb`)}
      ${row('TikTok: tiểu sử, bình luận, bài thường', '', `${base}/${s}-tt`)}
      ${row('Biển bán nhà, tờ rơi, mã QR', '', `${base}/${s}-bien`)}` : ''}
    </section>`;
  }).join('') : '<p class="empty">Chưa có căn nào.</p>';
}
$('#links').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-copy]'); if (!b) return;
  try { await navigator.clipboard.writeText(b.dataset.copy); } catch { const ta = document.createElement('textarea'); ta.value = b.dataset.copy; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  b.textContent = 'Đã copy ✓'; setTimeout(() => (b.textContent = 'Copy'), 1500);
});
const RANGES = [[7, '7 ngày'], [30, '30 ngày'], [90, '90 ngày'], [0, 'Tất cả']];
async function loadReport() {
  $('#rangeChips').innerHTML = RANGES.map(([d, t]) => `<button data-range="${d}" class="${d === S.range ? 'on' : ''}">${t}</button>`).join('');
  const since = S.range ? new Date(Date.now() - S.range * 864e5).toISOString() : null;
  const { data, error } = await rpc('nx_crm_report', since ? { p_since: since } : { p_since: '2000-01-01T00:00:00Z' });
  if (error) { $('#report').innerHTML = `<p class="empty">Lỗi tải báo cáo: ${esc(error.message)}</p>`; return; }
  renderReport(((data && data.leads) || []).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)), (data && data.clicks) || []);
}
$('#rangeChips').addEventListener('click', (e) => { const b = e.target.closest('[data-range]'); if (b) { S.range = +b.dataset.range; loadReport(); } });
function agg(rows) {
  const a = { n: rows.length, moi: 0, called: 0, real: 0, appt: 0, seen: 0, dep: 0, dead: 0, depSum: 0 };
  rows.forEach((l) => {
    const g = STAGE[l.status] ?? 0;
    if (g === 0) a.moi++; else a.called++;
    if (g >= 2) a.real++; if (g >= 3) a.appt++; if (g >= 4) a.seen++;
    if (g === 5) { a.dep++; a.depSum += Number(l.deposit_value) || 0; }
    if (g < 0) a.dead++;
  });
  return a;
}
function groupBy(rows, keyFn) {
  const m = new Map(); rows.forEach((l) => { const k = keyFn(l); if (!m.has(k)) m.set(k, []); m.get(k).push(l); });
  return [...m.entries()].map(([k, r]) => ({ k, a: agg(r) })).sort((x, y) => y.a.n - x.a.n);
}
// thanh chất lượng: khách thật+ · đã gọi chưa rõ · chưa gọi · rác/không liên lạc
function qbar(a) {
  const seg = [['q-real', a.real], ['q-call', a.called - a.real - a.dead], ['q-new', a.moi], ['q-dead', a.dead]];
  return `<div class="qbar">${seg.map(([c, v]) => (v > 0 ? `<i class="${c}" style="width:${(v / a.n) * 100}%"></i>` : '')).join('')}</div>`;
}
function rowHtml(title, a, attrs = '') {
  return `<li class="rrow"${attrs}><div class="rr-top"><b>${esc(title)}</b><span>${a.n} khách</span></div>${qbar(a)}
    <div class="rr-sub"><span class="ok">${a.real} khách thật (${pct(a.real, a.n)}%)</span><span>${a.appt} hẹn xem</span><span>${a.dep} cọc${a.depSum ? ' · ' + money(a.depSum) : ''}</span>${a.moi ? `<span class="mut">${a.moi} chưa gọi</span>` : ''}${a.dead ? `<span class="mut">${a.dead} rác/không LL</span>` : ''}</div></li>`;
}
function clicksHtml(clicks) {
  if (!clicks.length) return '';
  const m = new Map();
  clicks.forEach((c) => { const k = sourceKey(c); const v = m.get(k) || { call: 0, zalo: 0 }; v[c.kind]++; m.set(k, v); });
  const rows = [...m.entries()].sort((a, b) => (b[1].call + b[1].zalo) - (a[1].call + a[1].zalo));
  const tot = rows.reduce((t, [, v]) => ({ call: t.call + v.call, zalo: t.zalo + v.zalo }), { call: 0, zalo: 0 });
  const lab = (k) => (SOURCES.find((x) => x.key === k) || {}).label || k;
  return `<div class="rblk"><h3>Bấm Gọi / Zalo trên trang</h3>
    <p class="hint" style="margin:-4px 0 10px">${tot.call} lượt bấm Gọi · ${tot.zalo} lượt bấm Zalo (khách có thể chưa để lại số). Khách gọi tới nhớ bấm "＋ Khách gọi tới" để vào báo cáo.</p>
    <div class="clk"><span class="h">Nguồn</span><span class="h" style="text-align:right">Gọi</span><span class="h" style="text-align:right">Zalo</span>
    ${rows.map(([k, v]) => `<span>${esc(lab(k))}</span><b>${v.call}</b><b>${v.zalo}</b>`).join('')}</div></div>`;
}
function renderReport(rows, clicks = []) {
  if (!rows.length && !clicks.length) { $('#report').innerHTML = `<p class="empty">Chưa có khách trong ${S.range ? S.range + ' ngày qua' : 'CRM'}. Khách để lại số trên landing sẽ hiện ở đây.</p>`; return; }
  if (!rows.length) { $('#report').innerHTML = clicksHtml(clicks) + '<p class="empty">Chưa có khách để lại số trong khoảng này.</p>'; return; }
  const a = agg(rows);
  const funnel = [['Tổng khách', a.n], ['Đã liên hệ', a.called], ['Khách thật', a.real], ['Hẹn xem nhà', a.appt], ['Đã xem nhà', a.seen], ['Đặt cọc', a.dep]];
  const bySrc = groupBy(rows, sourceKey);
  const camp = rows.some((l) => l.utm_campaign) ? groupBy(rows, (l) => l.utm_campaign || '(không gắn chiến dịch)') : [];
  const houses = groupBy(rows, (l) => l.property_name || '(không rõ căn)');
  const label = (k) => (SOURCES.find((x) => x.key === k) || {}).label || k;
  $('#report').innerHTML = `
  <div class="kpis">
    <div class="kpi"><b>${a.n}</b><small>Tổng khách</small></div>
    <div class="kpi good"><b>${a.real}</b><small>Khách thật · ${pct(a.real, a.n)}%</small></div>
    <div class="kpi"><b>${a.appt}</b><small>Hẹn xem · ${pct(a.appt, a.n)}%</small></div>
    <div class="kpi dark"><b>${a.dep}</b><small>Đặt cọc${a.depSum ? ' · ' + money(a.depSum) : ''}</small></div>
  </div>
  ${clicksHtml(clicks)}
  ${a.moi ? `<p class="note">${a.moi} khách chưa được gọi (trạng thái "Mới"). Tỉ lệ chất lượng chỉ đúng khi sale cập nhật trạng thái sau mỗi cuộc gọi.</p>` : ''}
  <div class="rblk"><h3>Phễu chất lượng khách</h3><ul class="funnel">${funnel.map(([t, v]) => `<li><span>${t}</span><div class="fbar"><i style="width:${pct(v, a.n)}%"></i></div><b>${v}</b><em>${pct(v, a.n)}%</em></li>`).join('')}</ul></div>
  <div class="rblk"><h3>Khách đến từ đâu</h3>
    <div class="legend"><span><i class="q-real"></i>Khách thật trở lên</span><span><i class="q-call"></i>Đã gọi</span><span><i class="q-new"></i>Chưa gọi</span><span><i class="q-dead"></i>Rác / không liên lạc</span></div>
    <ul class="rlist">${bySrc.map((g) => rowHtml(label(g.k), g.a, ` data-src="${esc(g.k)}" title="Bấm để xem danh sách khách"`)).join('')}</ul>
    <p class="hint">Bấm một nguồn để xem danh sách khách của nguồn đó.</p></div>
  ${camp.length ? `<div class="rblk"><h3>Theo chiến dịch quảng cáo</h3><ul class="rlist">${camp.slice(0, 15).map((g) => rowHtml(g.k, g.a)).join('')}</ul></div>` : ''}
  ${houses.length > 1 ? `<div class="rblk"><h3>Theo căn nhà</h3><ul class="rlist">${houses.map((g) => rowHtml(g.k, g.a)).join('')}</ul></div>` : ''}
  <details class="rblk utm"><summary>Gắn UTM vào link quảng cáo để biết chiến dịch nào ra khách thật</summary>
    <p>Dán phần sau vào ô <b>URL parameters</b> / <b>Tham số URL</b> của quảng cáo (link vẫn là trang căn nhà):</p>
    <label>TikTok</label><code>utm_source=tiktok&amp;utm_medium=paid&amp;utm_campaign=__CAMPAIGN_NAME__&amp;utm_content=__CID_NAME__</code>
    <label>Facebook</label><code>utm_source=facebook&amp;utm_medium=paid&amp;utm_campaign={{campaign.name}}&amp;utm_content={{ad.name}}</code>
    <label>Google Tìm kiếm</label><code>utm_source=google&amp;utm_medium=paid&amp;utm_campaign=ten-chien-dich</code>
    <label>YouTube</label><code>utm_source=youtube&amp;utm_medium=paid&amp;utm_campaign=ten-chien-dich</code>
    <p class="mut">Facebook gắn fbclid cho mọi link (cả bài đăng thường) nên không có UTM thì CRM chỉ ghi "Facebook (chưa rõ QC hay bài đăng)".
    Google Ads dán vào ô <b>Hậu tố URL cuối cùng</b> của từng chiến dịch; không có UTM thì quảng cáo YouTube cũng chỉ hiện "Google quảng cáo".</p></details>`;
}
$('#report').addEventListener('click', (e) => {
  const r = e.target.closest('[data-src]'); if (!r) return;
  S.src = r.dataset.src; S.filter = 'Tất cả'; setTab('list'); loadLeads();
});

// ================= CHI TIẾT KHÁCH =================
window.addEventListener('hashchange', openFromHash);
function openFromHash() {
  const m = location.hash.match(/^#lead-(\d+)$/);
  if (!m) { $('#sheet').hidden = true; S.open = null; document.body.classList.remove('lock'); return; }
  openLead(+m[1]);
}
$('#closeSheet').addEventListener('click', () => history.length > 1 ? history.back() : (location.hash = ''));
async function openLead(id) {
  let l = S.leads.find((x) => x.id === id);
  if (!l) { const { data } = await rpc('nx_crm_lead', { p_id: id }); l = data; }
  if (!l) return toast('Không tìm thấy khách #' + id);
  l._new = false; S.open = id;
  $('#sheet').hidden = false; document.body.classList.add('lock');
  renderDetail(l);
}
async function renderDetail(l) {
  $('#sheetId').textContent = `#${l.id} · ${ago(l.created_at)}`;
  const src = [sourceLabel(l), l.utm_campaign, l.utm_content].filter(Boolean).join(' · ');
  $('#detail').innerHTML = `
  <div class="d-head"><h2>${esc(l.name || 'Khách chưa để tên')}</h2><div class="ph">${esc(l.phone)}</div>${l.duplicate_of ? `<a class="pill s-hen" href="#lead-${l.duplicate_of}">SĐT đã để lại trước đó (#${l.duplicate_of})</a>` : ''}</div>
  <div class="d-cta"><a class="btn btn-primary" href="tel:${digits(l.phone)}" id="callBtn">Gọi ngay</a><a class="btn btn-line" href="https://zalo.me/${digits(l.phone)}" target="_blank" rel="noopener">Nhắn Zalo</a></div>
  <div class="blk"><h3>Trạng thái</h3><div class="st-grid">${STATUSES.map((s) => `<button data-st="${esc(s)}" class="${s === l.status ? 'on' : ''}">${esc(s)}</button>`).join('')}</div>
    <div id="depositBox" ${l.status === 'Đặt cọc' ? '' : 'hidden'} style="margin-top:10px"><label class="fld"><span>Số tiền cọc (VNĐ) — gửi TikTok + Facebook làm giá trị chuyển đổi</span><input id="deposit" inputmode="numeric" value="${l.deposit_value || ''}" placeholder="Ví dụ 200000000"></label></div>
    ${l.tiktok_log ? `<div class="tlog"><b>Đã gửi quảng cáo</b>\n${esc(l.tiktok_log.trim())}</div>` : ''}</div>
  <div class="blk"><h3>Hẹn gọi lại</h3><input type="datetime-local" id="follow" value="${l.next_follow_at ? toLocalInput(new Date(l.next_follow_at)) : ''}">
    <div class="quick"><button data-fu="2h">+2 giờ</button><button data-fu="tonight">Tối nay 19:00</button><button data-fu="tomorrow">Mai 9:00</button><button data-fu="clear">Bỏ hẹn</button></div></div>
  <div class="blk"><h3>Người phụ trách</h3><input id="assignee" value="${esc(l.assignee || '')}" placeholder="Tên sale phụ trách" maxlength="40"></div>
  <div class="blk"><h3>Thông tin</h3><dl class="kv">
    <dt>Căn nhà</dt><dd>${l.page_url ? `<a href="${esc(l.page_url.split('?')[0])}" target="_blank" rel="noopener">${esc(l.property_name || l.property_id)}</a>` : esc(l.property_name || '')}</dd>
    ${l.appointment ? `<dt>Hẹn xem</dt><dd><b>${esc(l.appointment)}</b></dd>` : ''}
    <dt>Khách muốn</dt><dd>${l.mode === 'xem' ? 'Đặt lịch xem nhà' : 'Nhận ảnh & tư vấn'}</dd>
    <dt>Ghi chú khách</dt><dd>${esc(l.note || '')}</dd>
    <dt>Nguồn</dt><dd>${esc(src)}${l.ttclid ? ' · có mã TikTok ✓' : ''}${l.fbclid ? ' · có mã Facebook ✓' : ''}${l.gclid || l.gbraid || l.wbraid ? ' · có mã Google ✓' : ''}</dd>
    <dt>Thời gian</dt><dd>${esc(new Date(l.created_at).toLocaleString('vi-VN'))}</dd>
  </dl></div>
  <div class="blk"><h3>Ghi chú chăm sóc</h3>
    <textarea id="noteText" rows="3" placeholder="Ví dụ: khách cần vay 70%, hẹn chở vợ đi xem thứ 7…"></textarea>
    <div class="quick"><button id="addNote" style="background:var(--g8);color:#fff">Lưu ghi chú</button><button data-quick="Đã gọi, không nghe máy">Không nghe máy</button><button data-quick="Đã gửi thêm ảnh/video qua Zalo">Đã gửi Zalo</button></div>
    <ul class="notes" id="notes"><li><small>Đang tải…</small></li></ul></div>`;
  const { data: notes } = await rpc('nx_crm_notes', { p_lead: l.id });
  $('#notes').innerHTML = (notes || []).map((n) => `<li class="${n.kind}">${esc(n.body)}<small>${esc(n.author_name || '')} · ${esc(ago(n.created_at))}</small></li>`).join('') || '<li><small>Chưa có ghi chú.</small></li>';
}
async function updateLead(id, patch, okMsg) {
  const { data, error } = await rpc('nx_crm_update', { p_id: id, p_patch: patch });
  if (error) { toast('Lỗi: ' + error.message, 4000); return null; }
  const i = S.leads.findIndex((x) => x.id === id); if (i >= 0) S.leads[i] = data;
  if (okMsg) toast(okMsg);
  render(); renderDetail(data);
  return data;
}
async function reloadLead(id) {
  const { data } = await rpc('nx_crm_lead', { p_id: id });
  if (!data) return;
  const i = S.leads.findIndex((x) => x.id === id); if (i >= 0) S.leads[i] = data;
  if (S.open === id) renderDetail(data);
}
async function addNote(id, body, kind = 'note') {
  const { error } = await rpc('nx_crm_add_note', { p_lead: id, p_author: getWho() || 'Sale', p_body: body, p_kind: kind });
  if (error) return toast('Lỗi ghi chú: ' + error.message, 4000);
  const l = S.leads.find((x) => x.id === id); if (l) renderDetail(l);
}
$('#detail').addEventListener('click', async (e) => {
  const id = S.open; if (!id) return;
  const st = e.target.closest('[data-st]');
  if (st) {
    const status = st.dataset.st;
    const l = await updateLead(id, { status }, `Đã chuyển: ${status}`);
    if (l && ADS[status]) sendAds(id);
    return;
  }
  const fu = e.target.closest('[data-fu]');
  if (fu) {
    const d = new Date(), k = fu.dataset.fu; let v = null;
    if (k === '2h') v = new Date(d.getTime() + 2 * 3600e3);
    if (k === 'tonight') { v = new Date(d); v.setHours(19, 0, 0, 0); if (v < d) v.setDate(v.getDate() + 1); }
    if (k === 'tomorrow') { v = new Date(d); v.setDate(v.getDate() + 1); v.setHours(9, 0, 0, 0); }
    await updateLead(id, { next_follow_at: v ? v.toISOString() : null }, v ? `Hẹn gọi lại ${fmtDT(v)}` : 'Đã bỏ hẹn gọi lại');
    return;
  }
  if (e.target.id === 'addNote') { const t = $('#noteText').value.trim(); if (t) addNote(id, t); return; }
  const qn = e.target.closest('[data-quick]'); if (qn) { addNote(id, qn.dataset.quick, 'call'); return; }
  if (e.target.id === 'callBtn') addNote(id, 'Bấm gọi khách', 'call');
});
$('#detail').addEventListener('change', async (e) => {
  const id = S.open;
  if (e.target.id === 'follow') await updateLead(id, { next_follow_at: e.target.value ? new Date(e.target.value).toISOString() : null }, 'Đã lưu hẹn gọi lại');
  if (e.target.id === 'assignee') await updateLead(id, { assignee: e.target.value.trim() }, 'Đã lưu người phụ trách');
  if (e.target.id === 'deposit') { const v = Number(digits(e.target.value)); const l = await updateLead(id, { deposit_value: v || null }, 'Đã lưu tiền cọc'); if (l && l.status === 'Đặt cọc') sendAds(id); }
});
async function sendAds(id, kind) {
  try {
    const r = await fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json', 'x-crm-pass': getPass() }, body: JSON.stringify({ id, kind }) });
    const j = await r.json();
    if (j.line) toast(j.line, 4500);
    if (j.lines) await reloadLead(id);
  } catch (err) { /* chạy thử không có máy chủ thì không có /api */ }
}

// ================= KHÁCH GỌI TỚI (thêm tay) =================
const phoneVN = (raw) => { let d = digits(raw); if (d.startsWith('84')) d = d.slice(2); else if (d.startsWith('0')) d = d.slice(1); return d.length >= 9 && d.length <= 10 ? '+84' + d : ''; };
$('#addCallBtn').addEventListener('click', () => {
  const hs = CFG.houses || [];
  $('#addHouse').innerHTML = hs.map((h, i) => `<option value="${i}">${esc(h.name)}</option>`).join('') + '<option value="">Căn khác / chưa rõ</option>';
  $('#addForm').reset(); $('#addMsg').textContent = ''; $('#addSheet').hidden = false;
  setTimeout(() => $('#addForm').phone.focus(), 50);
});
$('#addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, m = $('#addMsg'), e164 = phoneVN(f.phone.value);
  if (!e164) { m.textContent = 'Số điện thoại chưa đúng (cần 10 số, ví dụ 0912 345 678).'; m.classList.add('err'); return; }
  const [us, um] = f.src.value.split('|');
  const h = (CFG.houses || [])[f.house.value];
  const p = { phone: f.phone.value.trim(), phone_e164: e164, name: f.name.value.trim(), note: f.note.value.trim(), status: f.status.value,
    utm_source: us, utm_medium: um || '', property_id: h ? h.id : '', property_name: h ? h.name : '',
    event_id: 'call_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), source_label: f.src.options[f.src.selectedIndex].text };
  m.textContent = 'Đang lưu…'; m.classList.remove('err');
  const { data, error } = await rpc('nx_crm_add_lead', { p });
  if (error) { m.textContent = 'Lỗi: ' + error.message; m.classList.add('err'); return; }
  $('#addSheet').hidden = true;
  toast(data.duplicate_of ? `Đã lưu · SĐT này đã có (#${data.duplicate_of})` : 'Đã lưu khách gọi tới', 3500);
  await loadLeads();
  sendAds(data.id, 'lead');
  location.hash = 'lead-' + data.id;
});

document.addEventListener('click', (e) => { const c = e.target.closest('[data-close]'); if (c) $('#' + c.dataset.close).hidden = true; });

boot();
