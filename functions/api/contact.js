// POST /api/contact — khách bấm Gọi / Zalo (sendBeacon). Lưu lượt bấm vào CRM (báo cáo nguồn)
// + gửi "Contact" từ máy chủ cho TikTok + Facebook, cùng event_id với pixel. Luôn trả 204 nhanh.
import { clientIp, readJson, str, rpc } from '../_lib/util.js';
import { sendTikTok, sendMeta } from '../_lib/ads.js';

const KEYS = ['event_id', 'kind', 'page_url', 'referrer', 'property_id', 'property_name', 'ttclid', 'ttp', 'fbclid', 'fbp', 'fbc', 'user_agent',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'gclid', 'gbraid', 'wbraid'];

export async function handleContact(request, env, fetcher = fetch, wait = (p) => p) {
  let b; try { b = await readJson(request, 8000); } catch { return new Response(null, { status: 204 }); }
  const C = {}; KEYS.forEach((k) => { C[k] = str(b[k], k.endsWith('url') || k === 'referrer' || k === 'user_agent' ? 600 : 200); });
  if (!C.event_id || !/^(call|zalo|contact)/.test(C.kind || 'contact')) return new Response(null, { status: 204 });
  C.client_ip = clientIp(request);
  if (!C.user_agent) C.user_agent = str(request.headers.get('user-agent'), 400);
  const work = Promise.all([
    rpc(env, 'nx_ingest_click', { p_secret: env.CRM_INGEST_SECRET || '', p: C }, fetcher),
    sendTikTok(env, { event: 'Contact', eventId: C.event_id, lead: C, fetcher }),
    sendMeta(env, { event: 'Contact', eventId: C.event_id, lead: C, fetcher }),
  ]);
  await wait(work);
  return new Response(null, { status: 204 });
}

export const onRequestPost = (ctx) => handleContact(ctx.request, ctx.env, fetch, (p) => { ctx.waitUntil(p); return Promise.resolve(); });
