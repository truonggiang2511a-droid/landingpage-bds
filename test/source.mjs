// Kiểm phân loại nguồn khách (src/crm/source.js) — dùng cho CRM.
import assert from 'node:assert/strict';
import { sourceKey, sourceLabel } from '../src/crm/source.js';

const ca = [
  [{ utm_source: 'zalo', utm_medium: 'paid', utm_campaign: 'ltt' }, 'zalo_ads'],
  [{ utm_source: 'zalo', utm_medium: 'cpc' }, 'zalo_ads'],
  [{ utm_source: 'zalo', utm_medium: 'organic', utm_campaign: 'ltt' }, 'zalo'], // link ngắn /ltt-zalo
  [{ utm_source: 'zalo' }, 'zalo'],
  [{ referrer: 'https://zalo.me/abc' }, 'zalo'],
  [{ utm_source: 'tiktok', utm_medium: 'paid' }, 'tiktok_ads'],
  [{ utm_source: 'facebook', utm_medium: 'organic' }, 'facebook'],
  [{ utm_source: 'facebook', utm_medium: 'paid' }, 'facebook_ads'],
  [{ ttclid: 'x' }, 'tiktok_ads'],
  [{ gclid: 'x' }, 'google_ads'],
  [{ utm_source: 'youtube', utm_medium: 'organic' }, 'youtube'],
  [{ utm_source: 'bien-ban', utm_medium: 'offline' }, 'offline'],
  [{ utm_source: 'batdongsan', utm_medium: 'organic' }, 'other'],
  [{}, 'direct']
];
let ok = 0;
for (const [lead, want] of ca) { assert.equal(sourceKey(lead), want, JSON.stringify(lead)); ok++; }
assert.equal(sourceLabel({ utm_source: 'zalo', utm_medium: 'paid' }), 'Zalo quảng cáo');
assert.equal(sourceLabel({ utm_source: 'batdongsan' }), 'batdongsan');
console.log(`✓ Nguồn khách: ${ok + 2} ca đạt`);
