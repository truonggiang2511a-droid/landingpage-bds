// Chuyển link cũ *.pages.dev (bản chính) sang tên miền riêng — chỉ bật khi biến CANONICAL_REDIRECT = "on"
// (đặt sau khi tên miền đã chạy). Không đụng /api/* để form, sự kiện đang gửi không bị lỗi. Bản xem thử (<hash>.…pages.dev) không bị chuyển.
import { SITE } from './_lib/site.gen.js';

export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  const prodPages = /^[a-z0-9-]+\.pages\.dev$/.test(url.hostname) && url.hostname.split('.').length === 3;
  if (ctx.env.CANONICAL_REDIRECT === 'on' && prodPages && !url.pathname.startsWith('/api/') && ['GET', 'HEAD'].includes(ctx.request.method)) {
    return Response.redirect(SITE.baseUrl.replace(/\/$/, '') + url.pathname + url.search, 301);
  }
  return ctx.next();
}
