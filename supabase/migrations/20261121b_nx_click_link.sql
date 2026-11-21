-- Gắn lượt bấm Gọi/Zalo với khách sale nhập tay → các sự kiện sau (Khách thật / Hẹn xem / Đặt cọc) mang được mã nhận diện
-- của TikTok/Facebook (ttclid, _ttp, fbclid, _fbp, _fbc, IP, trình duyệt) thay vì chỉ có số điện thoại.
-- Khách BĐS phần lớn gọi/nhắn Zalo thẳng chứ không điền form, nên đây là chỗ nền tảng "mất dấu" khách nhiều nhất.

alter table nx.clicks add column if not exists ttp text;
alter table nx.clicks add column if not exists fbp text;
alter table nx.clicks add column if not exists fbc text;
alter table nx.clicks add column if not exists lead_id bigint references nx.leads(id) on delete set null;
alter table nx.leads  add column if not exists click_id bigint;

-- Lưu thêm _ttp/_fbp/_fbc (trang đã gửi từ trước, bản cũ của hàm bỏ qua 3 trường này).
create or replace function public.nx_ingest_click(p_secret text, p jsonb) returns jsonb
language plpgsql security definer set search_path = nx, pg_temp as $$
begin
  if not nx._ok_ingest(p_secret) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into nx.clicks (kind, event_id, page_url, referrer, property_id, property_name, utm_source, utm_medium, utm_campaign, utm_content,
    ttclid, ttp, fbclid, fbp, fbc, gclid, client_ip, user_agent)
  values (p->>'kind', nullif(p->>'event_id',''), left(p->>'page_url',600), left(p->>'referrer',600), p->>'property_id', p->>'property_name',
    p->>'utm_source', p->>'utm_medium', p->>'utm_campaign', p->>'utm_content',
    nullif(p->>'ttclid',''), nullif(p->>'ttp',''), nullif(p->>'fbclid',''), nullif(p->>'fbp',''), nullif(p->>'fbc',''),
    coalesce(nullif(p->>'gclid',''), nullif(p->>'gbraid',''), nullif(p->>'wbraid','')), p->>'client_ip', left(p->>'user_agent',400))
  on conflict (event_id) do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- Lượt bấm Gọi/Zalo chưa gắn khách trong p_hours giờ gần nhất (mới nhất trước) — sale chọn lượt trùng giờ khách gọi/nhắn.
create or replace function public.nx_crm_clicks(p_pass text, p_hours int default 48) returns jsonb
language plpgsql stable security definer set search_path = nx, pg_temp as $$
begin
  if not nx._ok_crm(p_pass) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'created_at', created_at, 'kind', kind, 'property_name', property_name,
      'utm_source', utm_source, 'utm_medium', utm_medium, 'utm_campaign', utm_campaign, 'referrer', referrer,
      'ttclid', ttclid, 'fbclid', fbclid, 'gclid', gclid, 'user_agent', user_agent,
      'has_tt', coalesce(ttclid,'') <> '' or coalesce(ttp,'') <> '',
      'has_fb', coalesce(fbclid,'') <> '' or coalesce(fbp,'') <> '' or coalesce(fbc,'') <> '') order by created_at desc)
    from nx.clicks where lead_id is null and created_at >= now() - make_interval(hours => least(greatest(p_hours, 1), 168))), '[]'::jsonb);
end $$;

-- Gắn 1 lượt bấm vào khách: chép mã nhận diện sang khách (chỉ điền ô đang trống, không ghi đè dữ liệu form).
create or replace function public.nx_crm_link_click(p_pass text, p_lead bigint, p_click bigint) returns jsonb
language plpgsql security definer set search_path = nx, pg_temp as $$
declare c nx.clicks;
begin
  if not nx._ok_crm(p_pass) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from nx.clicks where id = p_click;
  if c.id is null then raise exception 'không thấy lượt bấm'; end if;
  if c.lead_id is not null and c.lead_id <> p_lead then raise exception 'lượt bấm này đã gắn khách #%', c.lead_id; end if;
  update nx.leads l set
    click_id = c.id,
    ttclid = coalesce(nullif(l.ttclid,''), c.ttclid),   ttp = coalesce(nullif(l.ttp,''), c.ttp),
    fbclid = coalesce(nullif(l.fbclid,''), c.fbclid),   fbp = coalesce(nullif(l.fbp,''), c.fbp),
    fbc    = coalesce(nullif(l.fbc,''), c.fbc),         gclid = coalesce(nullif(l.gclid,''), c.gclid),
    client_ip  = coalesce(nullif(l.client_ip,''), c.client_ip),
    user_agent = coalesce(nullif(l.user_agent,''), c.user_agent),
    page_url   = coalesce(nullif(l.page_url,''), c.page_url),
    referrer   = coalesce(nullif(l.referrer,''), c.referrer),
    utm_source = coalesce(nullif(l.utm_source,''), c.utm_source), utm_medium = coalesce(nullif(l.utm_medium,''), c.utm_medium),
    utm_campaign = coalesce(nullif(l.utm_campaign,''), c.utm_campaign), utm_content = coalesce(nullif(l.utm_content,''), c.utm_content)
  where l.id = p_lead;
  update nx.clicks set lead_id = p_lead where id = p_click;
  return (select to_jsonb(l) from nx.leads l where id = p_lead);
end $$;
