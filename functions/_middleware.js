// Chuyển link cũ *.pages.dev (bản chính) sang tên miền riêng — chỉ bật khi biến CANONICAL_REDIRECT = "on"
// (đặt sau khi tên miền đã chạy). Không đụng /api/* để form, sự kiện đang gửi không bị lỗi. Bản xem thử (<hash>.…pages.dev) không bị chuyển.
import { SITE } from './_lib/site.gen.js';

export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  const prodPages = /^[a-z0-9-]+\.pages\.dev$/.test(url.hostname) && url.hostname.split('.').length === 3;
  const target = new URL(SITE.baseUrl);
  // www.<tên miền> → tên miền gốc (luôn bật, không cần biến) — trừ /api/* để form/sự kiện POST không bị chuyển hướng
  if (url.hostname === 'www.' + target.hostname && !url.pathname.startsWith('/api/') && ['GET', 'HEAD'].includes(ctx.request.method)) {
    return Response.redirect(target.origin + url.pathname + url.search, 301);
  }
  // Không chuyển khi baseUrl vẫn là chính link pages.dev (chưa có tên miền) → tránh vòng lặp chuyển hướng
  if (ctx.env.CANONICAL_REDIRECT === 'on' && prodPages && target.hostname !== url.hostname && !url.pathname.startsWith('/api/') && ['GET', 'HEAD'].includes(ctx.request.method)) {
    return Response.redirect(SITE.baseUrl.replace(/\/$/, '') + url.pathname + url.search, 301);
  }
  return ctx.next();
}
