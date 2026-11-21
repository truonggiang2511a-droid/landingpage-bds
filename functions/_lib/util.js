// Tiện ích dùng chung cho Cloudflare Pages Functions.
import { SITE } from './site.gen.js'; // build.mjs sinh từ data/site.json
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

// SĐT Việt Nam → +84xxxxxxxxx (9–10 số sau 84). Sai → ''.
export function phoneE164(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('84')) d = d.slice(2); else if (d.startsWith('0')) d = d.slice(1);
  if (d.length < 9 || d.length > 10) return '';
  return '+84' + d;
}

export async function sha256(str) {
  if (!str) return '';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str).trim().toLowerCase()));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const clientIp = (request) => request.headers.get('cf-connecting-ip') || (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || '';

export async function readJson(request, max = 20000) {
  const t = await request.text();
  if (t.length > max) throw new Error('too large');
  return JSON.parse(t || '{}');
}

export const str = (v, n = 300) => String(v == null ? '' : v).slice(0, n);

// Gọi hàm public.nx_* trong Supabase (khoá công khai; hàm tự kiểm secret/mật khẩu).
export async function rpc(env, fn, args, fetcher = fetch) {
  // Không đọc env.SUPABASE_URL: bản cũ còn để biến này trỏ về dự án Supabase đã dừng (giang-quant-dashboard) trên Cloudflare.
  const url = env.CRM_SUPABASE_URL || SITE.crm.supabaseUrl, key = env.CRM_SUPABASE_KEY || SITE.crm.supabaseKey;
  if (!url || !key) return { ok: false, error: 'chưa cấu hình Supabase' };
  const r = await fetcher(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return r.ok ? { ok: true, data } : { ok: false, status: r.status, error: (data && data.message) || text };
}
