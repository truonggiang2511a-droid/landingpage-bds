// Phân loại NGUỒN khách — dùng chung cho CRM (/crm/source.js) và tin Telegram (máy chủ).
// Lưu ý thật: Facebook gắn fbclid cho MỌI link bấm ra ngoài (cả bài đăng thường), nên chỉ có fbclid thì chưa chắc là quảng cáo.
// Quảng cáo nên gắn UTM: TikTok  utm_source=tiktok&utm_medium=paid&utm_campaign=__CAMPAIGN_NAME__&utm_content=__CID_NAME__
//                         Facebook utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}
// Link ngắn /<short>-zalo|-yt|-fb|-tt|-bien (build.mjs → _redirects) tự gắn utm_source tương ứng + utm_medium=organic/offline.
// Google Ads tự gắn gclid (iPhone/app: gbraid/wbraid) cho mọi lượt nhấp quảng cáo — kể cả quảng cáo YouTube. Muốn CRM tách
// YouTube với Google Tìm kiếm thì đặt "Hậu tố URL cuối cùng" theo từng chiến dịch:
//                         Tìm kiếm utm_source=google&utm_medium=paid&utm_campaign=<ten-chien-dich>
//                         YouTube  utm_source=youtube&utm_medium=paid&utm_campaign=<ten-chien-dich>
export const SOURCES = [
  { key: 'tiktok_ads', label: 'TikTok quảng cáo' },
  { key: 'facebook_ads', label: 'Facebook quảng cáo' },
  { key: 'google_ads', label: 'Google quảng cáo' },
  { key: 'youtube_ads', label: 'YouTube quảng cáo' },
  { key: 'facebook', label: 'Facebook (chưa rõ QC hay bài đăng)' },
  { key: 'tiktok', label: 'TikTok tự nhiên' },
  { key: 'zalo', label: 'Zalo' },
  { key: 'google', label: 'Google tự nhiên' },
  { key: 'youtube', label: 'YouTube tự nhiên' },
  { key: 'referral', label: 'Giới thiệu / khách cũ' },
  { key: 'offline', label: 'Biển bán nhà / đi ngang' },
  { key: 'other', label: 'Nguồn khác' },
  { key: 'direct', label: 'Trực tiếp / link gửi tay' }
];
const LABEL = Object.fromEntries(SOURCES.map((s) => [s.key, s.label]));
const PAID = /^(paid|cpc|cpm|ads?|ppc|quang-?cao|qc)$/i;
const ORGANIC = /^(organic|social|post|bai-?dang|profile|bio)$/i;

function host(u) { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } }

export function sourceKey(l) {
  const us = String(l.utm_source || '').toLowerCase().trim(), um = String(l.utm_medium || '').trim();
  const h = host(l.referrer);
  const gc = l.gclid || l.gbraid || l.wbraid; // Google chỉ gắn khi bấm từ quảng cáo (Tìm kiếm, YouTube, Demand Gen, PMax)
  if (l.ttclid) return 'tiktok_ads'; // TikTok chỉ gắn ttclid khi bấm từ quảng cáo
  if (/tiktok/.test(us)) return ORGANIC.test(um) ? 'tiktok' : (PAID.test(um) || !um ? 'tiktok_ads' : 'tiktok');
  if (/^(facebook|fb|instagram|ig|meta|messenger)/.test(us)) return ORGANIC.test(um) ? 'facebook' : 'facebook_ads';
  if (/zalo/.test(us)) return 'zalo';
  if (/youtube|^yt$/.test(us)) return ORGANIC.test(um) ? 'youtube' : (PAID.test(um) || gc ? 'youtube_ads' : 'youtube');
  if (/google|gads|adwords/.test(us)) return ORGANIC.test(um) ? 'google' : 'google_ads';
  if (gc) return 'google_ads';
  if (/gioi-?thieu|referral|khach-?cu/.test(us)) return 'referral';
  if (/bien|offline|di-?ngang|tan-?noi/.test(us)) return 'offline';
  if (us) return 'other';
  if (l.fbclid) return 'facebook';
  if (/facebook|fb\.|instagram|messenger/.test(h)) return 'facebook';
  if (/tiktok/.test(h)) return 'tiktok';
  if (/zalo/.test(h)) return 'zalo';
  if (/google\./.test(h)) return 'google';
  if (/youtube|youtu\.be/.test(h)) return 'youtube';
  if (h) return 'other';
  return 'direct';
}

export function sourceLabel(l) {
  const k = sourceKey(l);
  if (k === 'other') return l.utm_source ? String(l.utm_source) : (host(l.referrer).replace(/^www\./, '') || LABEL.other);
  return LABEL[k];
}
