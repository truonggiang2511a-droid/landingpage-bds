// POST /api/lead — khách gửi form trên trang căn. CÙNG LÚC:
//   1) lưu CRM (Supabase rpc nx_ingest_lead, khoá CRM_INGEST_SECRET)
//   2) báo Telegram (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)
//   3) gửi sự kiện từ máy chủ: TikTok "SubmitForm" + Facebook "Lead" (cùng event_id với pixel → gộp)
// Trả {ok:true} nếu CRM HOẶC Telegram nhận được (khách không bị mất). Gửi lặp cùng event_id → không báo/gửi lại.
import { json, phoneE164, clientIp, readJson, str, rpc } from '../_lib/util.js';
import { sendTikTok, sendMeta } from '../_lib/ads.js';
import { leadText, sendTelegram } from '../_lib/tg.js';

const FIELDS = ['name', 'phone', 'email', 'note', 'user_note', 'appointment', 'mode', 'event_id', 'ttclid', 'ttp', 'fbclid', 'fbp', 'fbc',
  'gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'page_url', 'referrer', 'property_id', 'property_name', 'user_agent'];

export async function handleLead(request, env, fetcher = fetch) {
  let b;
  try { b = await readJson(request); } catch { return json({ ok: false, error: 'bad json' }, 400); }
  if (b.website) return json({ ok: true }); // bẫy bot
  const e164 = phoneE164(b.phone);
  if (!e164) return json({ ok: false, error: 'Số điện thoại chưa đúng' }, 400);

  const L = {};
  FIELDS.forEach((k) => { L[k] = str(b[k], k === 'note' || k.endsWith('url') || k === 'referrer' || k === 'user_agent' ? 600 : 300); });
  L.phone_e164 = e164;
  L.client_ip = clientIp(request);
  if (!L.user_agent) L.user_agent = str(request.headers.get('user-agent'), 400);
  if (!L.event_id) L.event_id = `lead_srv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const saved = await rpc(env, 'nx_ingest_lead', { p_secret: env.CRM_INGEST_SECRET || '', p: L }, fetcher);
  const repeat = saved.ok && saved.data && saved.data.repeat;
  if (repeat) return json({ ok: true, id: saved.data.id, repeat: true });

  const site = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
  const id = saved.ok && saved.data ? saved.data.id : null;
  const tgText = leadText(L, { crmUrl: id ? `${site}/crm/#lead=${id}` : '', duplicateOf: saved.ok && saved.data ? saved.data.duplicate_of : null })
    + (saved.ok ? '' : '\n❗ CRM chưa lưu được — nhập tay khách này vào CRM');

  const [tg, tt, fb] = await Promise.all([
    sendTelegram(env, tgText, fetcher),
    sendTikTok(env, { event: 'SubmitForm', eventId: L.event_id, lead: L, fetcher }),
    sendMeta(env, { event: 'Lead', eventId: L.event_id, lead: L, fetcher }),
  ]);
  if (id) await rpc(env, 'nx_ingest_log', { p_secret: env.CRM_INGEST_SECRET || '', p_id: id, p_line: [tt.line, fb.line].join(' · ') }, fetcher);
  const ok = saved.ok || tg.ok;
  return json({ ok, id, crm: saved.ok, telegram: tg.ok, tiktok: tt.line, facebook: fb.line, ...(ok ? {} : { error: 'Chưa lưu được, vui lòng gọi trực tiếp' }) }, ok ? 200 : 502);
}

export const onRequestPost = ({ request, env }) => handleLead(request, env);
