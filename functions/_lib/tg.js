// Báo khách mới vào nhóm Telegram "Khách nhà đất" (bot @NhaxinhminhthuyBot). Token chỉ nằm trên máy chủ.
const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function leadText(L, { crmUrl = '', duplicateOf = null } = {}) {
  const src = [L.utm_source, L.utm_campaign].filter(Boolean).join(' / ') || (L.ttclid ? 'TikTok' : L.fbclid ? 'Facebook' : (L.gclid || L.gbraid || L.wbraid) ? 'Google' : 'Tự nhiên');
  const lines = [
    `🏠 <b>KHÁCH MỚI</b> — ${esc(L.property_name || '')}`,
    `👤 ${esc(L.name || '(chưa để tên)')}`,
    `📞 <b>${esc(L.phone || '')}</b>`,
    L.mode === 'xem' && L.appointment ? `📅 Hẹn xem: ${esc(L.appointment)}` : (L.mode === 'tuvan' ? '💬 Muốn nhận ảnh & tư vấn' : ''),
    L.user_note ? `📝 ${esc(L.user_note)}` : '',
    `📣 Nguồn: ${esc(src)}`,
    duplicateOf ? `⚠️ Số này đã để lại trước đây (khách #${duplicateOf})` : '',
    crmUrl ? `👉 ${esc(crmUrl)}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

export async function sendTelegram(env, text, fetcher = fetch) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return { ok: false, skipped: true };
  try {
    const r = await fetcher(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const j = await r.json().catch(() => ({}));
    return { ok: !!j.ok };
  } catch { return { ok: false }; }
}
