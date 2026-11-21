// Gửi sự kiện chuyển đổi từ MÁY CHỦ: TikTok Events API v1.3 + Meta Conversions API (Graph v26.0).
// Cùng event_id với pixel trên trang → nền tảng tự gộp, không đếm trùng.
// Thiếu khoá nền tảng nào → bỏ qua nền tảng đó, trả dòng "– … chưa cài mã" (không làm hỏng việc khác).
import { sha256 } from './util.js';

// Trạng thái CRM → sự kiện gửi đi. Đổi tên trạng thái ở đây thì đổi luôn STATUSES trong src/crm/crm.js.
export const STATUS_EVENTS = {
  'Khách thật': { tiktok: 'ApplicationApproval', meta: 'QualifiedLead' },
  'Hẹn xem nhà': { tiktok: 'Schedule', meta: 'Schedule' },
  'Đặt cọc': { tiktok: 'Purchase', meta: 'Purchase' },
};

const TT_URL = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';
const META_VER = 'v26.0';

// fbc chuẩn: fb.1.<ms>.<fbclid>
export const fbcFrom = (fbclid, ms = Date.now()) => (fbclid ? `fb.1.${ms}.${fbclid}` : '');

export async function sendTikTok(env, { event, eventId, lead, value = 0, fetcher = fetch }) {
  if (!env.TIKTOK_ACCESS_TOKEN || !env.TIKTOK_PIXEL_ID) return { ok: false, skipped: true, line: '– TikTok chưa cài mã' };
  const phone = lead.phone_e164 ? await sha256(lead.phone_e164) : '';
  const body = {
    event_source: 'web', event_source_id: env.TIKTOK_PIXEL_ID,
    ...(env.TIKTOK_TEST_EVENT_CODE ? { test_event_code: env.TIKTOK_TEST_EVENT_CODE } : {}),
    data: [{
      event, event_time: Math.floor(Date.now() / 1000), event_id: eventId,
      user: { ...(phone ? { phone } : {}), ...(lead.ttclid ? { ttclid: lead.ttclid } : {}), ...(lead.ttp ? { ttp: lead.ttp } : {}),
        ...(lead.client_ip ? { ip: lead.client_ip } : {}), ...(lead.user_agent ? { user_agent: lead.user_agent } : {}) },
      page: { url: lead.page_url || '', ...(lead.referrer ? { referrer: lead.referrer } : {}) },
      properties: { content_type: 'product', contents: [{ content_id: String(lead.property_id || ''), content_name: String(lead.property_name || '') }],
        ...(value > 0 ? { value, currency: 'VND' } : {}) },
    }],
  };
  try {
    const r = await fetcher(TT_URL, { method: 'POST', headers: { 'Access-Token': env.TIKTOK_ACCESS_TOKEN, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.code === 0) return { ok: true, line: `✓ TikTok ${event}` };
    return { ok: false, line: `✗ TikTok ${event}: ${j.message || r.status}` };
  } catch (e) { return { ok: false, line: `✗ TikTok ${event}: ${e.message}` }; }
}

export async function sendMeta(env, { event, eventId, lead, value = 0, fetcher = fetch }) {
  if (!env.META_ACCESS_TOKEN || !env.META_PIXEL_ID) return { ok: false, skipped: true, line: '– Facebook chưa cài mã' };
  const digits = (lead.phone_e164 || '').replace(/\D/g, ''); // Meta: chỉ chữ số, có mã nước 84…
  const ph = digits ? await sha256(digits) : '';
  const body = {
    data: [{
      event_name: event, event_time: Math.floor(Date.now() / 1000), event_id: eventId, action_source: 'website',
      event_source_url: lead.page_url || undefined,
      user_data: { ...(ph ? { ph: [ph] } : {}), ...(lead.client_ip ? { client_ip_address: lead.client_ip } : {}),
        ...(lead.user_agent ? { client_user_agent: lead.user_agent } : {}), ...(lead.fbp ? { fbp: lead.fbp } : {}),
        ...((lead.fbc || lead.fbclid) ? { fbc: lead.fbc || fbcFrom(lead.fbclid) } : {}) },
      custom_data: { content_name: lead.property_name || '', content_ids: [String(lead.property_id || '')], content_type: 'product',
        ...(value > 0 ? { value, currency: 'VND' } : {}) },
    }],
    ...(env.META_TEST_EVENT_CODE ? { test_event_code: env.META_TEST_EVENT_CODE } : {}),
  };
  try {
    const r = await fetcher(`https://graph.facebook.com/${META_VER}/${env.META_PIXEL_ID}/events?access_token=${encodeURIComponent(env.META_ACCESS_TOKEN)}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && (j.events_received || 0) > 0) return { ok: true, line: `✓ Facebook ${event}` };
    return { ok: false, line: `✗ Facebook ${event}: ${(j.error && j.error.message) || r.status}` };
  } catch (e) { return { ok: false, line: `✗ Facebook ${event}: ${e.message}` }; }
}
