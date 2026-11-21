// POST /api/events {id} + header X-CRM-Pass — sale đổi trạng thái trong CRM → gửi TikTok + Facebook.
// Đọc khách bằng mật khẩu CRM (hàm nx_crm_lead tự kiểm). Mỗi sự kiện gửi 1 lần/nền tảng (dựa vào nhật ký tiktok_log).
// "Đặt cọc" chờ nhập số tiền cọc rồi mới gửi Purchase (value = tiền cọc, VND).
import { json, readJson, rpc } from '../_lib/util.js';
import { STATUS_EVENTS, sendTikTok, sendMeta } from '../_lib/ads.js';

export async function handleEvents(request, env, fetcher = fetch) {
  const pass = request.headers.get('x-crm-pass') || '';
  let b; try { b = await readJson(request, 2000); } catch { return json({ ok: false, error: 'bad json' }, 400); }
  const id = Number(b.id);
  if (!pass || !id) return json({ ok: false, error: 'thiếu id / mật khẩu' }, 400);
  const got = await rpc(env, 'nx_crm_lead', { p_pass: pass, p_id: id }, fetcher);
  if (!got.ok) return json({ ok: false, error: 'không có quyền' }, 403);
  const L = got.data;
  if (!L) return json({ ok: false, error: 'không thấy khách' }, 404);
  const map = STATUS_EVENTS[L.status];
  if (!map) return json({ ok: true, skipped: 'status' });
  const isPurchase = L.status === 'Đặt cọc';
  if (isPurchase && !(Number(L.deposit_value) > 0)) return json({ ok: true, skipped: 'deposit', line: '– Nhập số tiền cọc để gửi Purchase cho TikTok/Facebook' });

  const log = L.tiktok_log || '';
  const base = L.event_id || `crm${L.id}`;
  const value = isPurchase ? Number(L.deposit_value) : 0;
  const jobs = [];
  if (!log.includes(`✓ TikTok ${map.tiktok}`)) jobs.push(sendTikTok(env, { event: map.tiktok, eventId: `${base}_${map.tiktok}`, lead: L, value, fetcher }));
  if (!log.includes(`✓ Facebook ${map.meta}`)) jobs.push(sendMeta(env, { event: map.meta, eventId: `${base}_${map.meta}`, lead: L, value, fetcher }));
  if (!jobs.length) return json({ ok: true, skipped: 'sent' });
  const lines = (await Promise.all(jobs)).map((x) => x.line);
  const fresh = lines.filter((x) => !(x.startsWith('–') && log.includes(x)));
  if (fresh.length) await rpc(env, 'nx_crm_log_event', { p_pass: pass, p_id: id, p_line: fresh.join(' · ') }, fetcher);
  return json({ ok: true, line: lines.join(' · '), lines });
}

export const onRequestPost = ({ request, env }) => handleEvents(request, env);
