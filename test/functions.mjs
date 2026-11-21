// Test hàm máy chủ với fetch giả (không gọi mạng thật). Chạy: node test/functions.mjs
import assert from 'node:assert/strict';
import { handleLead } from '../functions/api/lead.js';
import { handleContact } from '../functions/api/contact.js';
import { handleEvents } from '../functions/api/events.js';
import { phoneE164 } from '../functions/_lib/util.js';

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('✓', name); } catch (e) { fail++; console.log('✗', name, '\n   ', e.message); } }

function mockFetch(routes) {
  const calls = [];
  const f = async (url, opts = {}) => {
    calls.push({ url: String(url), body: opts.body ? JSON.parse(opts.body) : null, headers: opts.headers || {} });
    for (const [re, res] of routes) if (re.test(String(url))) { const r = typeof res === 'function' ? res(url, opts) : res; const wrap = r && 'body' in r && 'status' in r; return new Response(JSON.stringify(wrap ? r.body : r), { status: wrap ? r.status : 200 }); }
    return new Response('{}', { status: 404 });
  };
  f.calls = calls; return f;
}
const ENV = { CRM_INGEST_SECRET: 's', TELEGRAM_BOT_TOKEN: 'tg', TELEGRAM_CHAT_ID: '1', TIKTOK_ACCESS_TOKEN: 'tt', TIKTOK_PIXEL_ID: 'P', META_ACCESS_TOKEN: 'm', META_PIXEL_ID: 'M', SITE_URL: 'https://nhaxinhminhthuy.com' };
const req = (body, headers = {}) => new Request('https://nhaxinhminhthuy.com/api/x', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '1.2.3.4', ...headers }, body: JSON.stringify(body) });
const okRoutes = (extra = []) => [...extra,
  [/rpc\/nx_ingest_lead/, { id: 7, ok: true, duplicate_of: null }], [/rpc\/nx_ingest_log/, {}], [/rpc\/nx_ingest_click/, { ok: true }],
  [/api\.telegram\.org/, { ok: true }], [/business-api\.tiktok\.com/, { code: 0 }], [/graph\.facebook\.com/, { events_received: 1 }]];

await t('phoneE164 chuẩn hoá', () => {
  assert.equal(phoneE164('0912 345 678'), '+84912345678'); assert.equal(phoneE164('+84 912345678'), '+84912345678'); assert.equal(phoneE164('123'), '');
});
await t('lead: SĐT sai → 400, không gọi gì', async () => {
  const f = mockFetch(okRoutes()); const r = await handleLead(req({ phone: '12' }), ENV, f);
  assert.equal(r.status, 400); assert.equal(f.calls.length, 0);
});
await t('lead: bẫy bot → ok giả, không lưu', async () => {
  const f = mockFetch(okRoutes()); const r = await handleLead(req({ phone: '0912345678', website: 'x' }), ENV, f);
  assert.equal(r.status, 200); assert.equal(f.calls.length, 0);
});
await t('lead: lưu CRM + Telegram + TikTok SubmitForm + Facebook Lead cùng event_id, SĐT đã băm', async () => {
  const f = mockFetch(okRoutes());
  const r = await handleLead(req({ name: 'An', phone: '0912345678', event_id: 'lead_1', mode: 'xem', appointment: 'T7 · 08:00 – 10:00', ttclid: 'abc', fbclid: 'fb1', property_id: 'LTT-01', property_name: 'Nhà LTT', page_url: 'https://x/y' }), ENV, f);
  const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.ok, true); assert.equal(j.id, 7);
  const ing = f.calls.find((c) => /nx_ingest_lead/.test(c.url));
  assert.equal(ing.body.p_secret, 's'); assert.equal(ing.body.p.phone_e164, '+84912345678'); assert.equal(ing.body.p.client_ip, '1.2.3.4');
  const tt = f.calls.find((c) => /tiktok/.test(c.url)).body.data[0];
  assert.equal(tt.event, 'SubmitForm'); assert.equal(tt.event_id, 'lead_1'); assert.equal(tt.user.ttclid, 'abc'); assert.match(tt.user.phone, /^[0-9a-f]{64}$/);
  const fb = f.calls.find((c) => /graph\.facebook/.test(c.url)).body.data[0];
  assert.equal(fb.event_name, 'Lead'); assert.equal(fb.event_id, 'lead_1'); assert.match(fb.user_data.ph[0], /^[0-9a-f]{64}$/); assert.match(fb.user_data.fbc, /^fb\.1\.\d+\.fb1$/);
  const tg = f.calls.find((c) => /telegram/.test(c.url)).body.text;
  assert.match(tg, /0912345678/); assert.match(tg, /crm\/#lead=7/);
  assert.ok(f.calls.find((c) => /nx_ingest_log/.test(c.url)));
});
await t('lead: gửi lặp cùng event_id → không báo/gửi lại', async () => {
  const f = mockFetch(okRoutes([[/rpc\/nx_ingest_lead/, { id: 7, ok: true, repeat: true }]]));
  const r = await handleLead(req({ phone: '0912345678', event_id: 'lead_1' }), ENV, f);
  assert.equal((await r.json()).repeat, true); assert.equal(f.calls.length, 1);
});
await t('lead: CRM lỗi nhưng Telegram nhận → vẫn ok, tin báo nhắc nhập tay', async () => {
  const f = mockFetch(okRoutes([[/rpc\/nx_ingest_lead/, { status: 500, body: { message: 'down' } }]]));
  const r = await handleLead(req({ phone: '0912345678' }), ENV, f);
  assert.equal(r.status, 200); assert.match(f.calls.find((c) => /telegram/.test(c.url)).body.text, /CRM chưa lưu được/);
});
await t('lead: CRM lỗi VÀ Telegram lỗi → 502 để trang báo khách gọi trực tiếp', async () => {
  const f = mockFetch(okRoutes([[/rpc\/nx_ingest_lead/, { status: 500, body: {} }], [/api\.telegram\.org/, { ok: false }]]));
  const r = await handleLead(req({ phone: '0912345678' }), ENV, f);
  assert.equal(r.status, 502);
});
await t('lead: thiếu khoá TikTok/Facebook → bỏ qua nền tảng đó, vẫn ok', async () => {
  const f = mockFetch(okRoutes()); const env = { ...ENV, TIKTOK_ACCESS_TOKEN: '', META_ACCESS_TOKEN: '' };
  const j = await (await handleLead(req({ phone: '0912345678' }), env, f)).json();
  assert.equal(j.ok, true); assert.match(j.tiktok, /chưa cài mã/); assert.ok(!f.calls.some((c) => /tiktok|facebook/.test(c.url)));
});
await t('contact: lưu lượt bấm + Contact cho TikTok và Facebook', async () => {
  const f = mockFetch(okRoutes());
  const r = await handleContact(req({ event_id: 'contact_1', kind: 'call', page_url: 'https://x' }), ENV, f);
  assert.equal(r.status, 204);
  assert.equal(f.calls.find((c) => /tiktok/.test(c.url)).body.data[0].event, 'Contact');
  assert.equal(f.calls.find((c) => /graph\.facebook/.test(c.url)).body.data[0].event_name, 'Contact');
  assert.ok(f.calls.find((c) => /nx_ingest_click/.test(c.url)));
});
await t('events: sai mật khẩu → 403', async () => {
  const f = mockFetch([[/nx_crm_lead/, { status: 403, body: { code: '42501', message: 'forbidden' } }]]);
  const r = await handleEvents(req({ id: 1 }, { 'x-crm-pass': 'sai' }), ENV, f);
  assert.equal(r.status, 403);
});
await t('events: Hẹn xem nhà → Schedule cả 2 nền tảng, event_id riêng, ghi nhật ký', async () => {
  const f = mockFetch([[/nx_crm_lead/, { id: 1, status: 'Hẹn xem nhà', event_id: 'lead_1', phone_e164: '+84912345678', tiktok_log: '' }], [/nx_crm_log_event/, {}],
    [/business-api\.tiktok\.com/, { code: 0 }], [/graph\.facebook\.com/, { events_received: 1 }]]);
  const j = await (await handleEvents(req({ id: 1 }, { 'x-crm-pass': 'p' }), ENV, f)).json();
  assert.equal(j.ok, true);
  assert.equal(f.calls.find((c) => /tiktok/.test(c.url)).body.data[0].event_id, 'lead_1_Schedule');
  assert.ok(f.calls.find((c) => /nx_crm_log_event/.test(c.url)));
});
await t('events: đã gửi rồi → không gửi lại', async () => {
  const f = mockFetch([[/nx_crm_lead/, { id: 1, status: 'Hẹn xem nhà', event_id: 'lead_1', tiktok_log: '✓ TikTok Schedule · ✓ Facebook Schedule' }]]);
  const j = await (await handleEvents(req({ id: 1 }, { 'x-crm-pass': 'p' }), ENV, f)).json();
  assert.equal(j.skipped, 'sent'); assert.equal(f.calls.length, 1);
});
await t('events: Đặt cọc chưa nhập tiền → chờ, có tiền → Purchase value VND', async () => {
  let f = mockFetch([[/nx_crm_lead/, { id: 1, status: 'Đặt cọc', tiktok_log: '' }]]);
  assert.equal((await (await handleEvents(req({ id: 1 }, { 'x-crm-pass': 'p' }), ENV, f)).json()).skipped, 'deposit');
  f = mockFetch([[/nx_crm_lead/, { id: 1, status: 'Đặt cọc', deposit_value: 200000000, tiktok_log: '' }], [/nx_crm_log_event/, {}],
    [/business-api\.tiktok\.com/, { code: 0 }], [/graph\.facebook\.com/, { events_received: 1 }]]);
  await handleEvents(req({ id: 1 }, { 'x-crm-pass': 'p' }), ENV, f);
  const tt = f.calls.find((c) => /tiktok/.test(c.url)).body.data[0];
  assert.equal(tt.event, 'Purchase'); assert.equal(tt.properties.value, 200000000); assert.equal(tt.properties.currency, 'VND');
});

console.log(`\n${pass} đạt, ${fail} lỗi`);
if (fail) process.exit(1);
