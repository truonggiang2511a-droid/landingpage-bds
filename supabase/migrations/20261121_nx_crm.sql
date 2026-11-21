-- CRM Nhà Xinh Minh Thùy — đặt TẠM trong dự án Supabase giang-ai-marketing-os (21/11/2026).
-- Tách biệt hoàn toàn với app marketing:
--   * Bảng nằm trong schema riêng `nx` — schema này KHÔNG mở qua Data API, anon/authenticated không có quyền gì.
--   * Trình duyệt/hàm máy chủ chỉ gọi các hàm public.nx_* (SECURITY DEFINER), mỗi hàm tự kiểm khoá:
--       - nx_ingest_*  : khoá máy chủ (secret CRM_INGEST_SECRET trên Cloudflare) → so sha256 với nx.config.ingest_sha256
--       - nx_crm_*     : mật khẩu CRM của sale → so bcrypt với nx.config.crm_pass_bcrypt
--   * Không dùng Supabase Auth → không tạo tài khoản nào trong danh sách người dùng của app marketing.
-- Chuyển CRM ra dự án riêng sau này: pg_dump schema nx + các hàm public.nx_* là đủ.

create schema if not exists nx;
revoke all on schema nx from public, anon, authenticated;

create table if not exists nx.config (key text primary key, value text not null);

create table if not exists nx.leads (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'Mới',
  mode text,                       -- xem | tuvan | goi (khách gọi tới, sale nhập tay)
  name text, phone text, phone_e164 text, email text,
  note text, user_note text, appointment text,
  property_id text, property_name text, page_url text, referrer text,
  event_id text unique,
  ttclid text, ttp text, fbclid text, fbp text, fbc text, gclid text, gbraid text, wbraid text,
  utm_source text, utm_medium text, utm_campaign text, utm_content text,
  client_ip text, user_agent text,
  next_follow_at timestamptz, deposit_value bigint, assignee text,
  duplicate_of bigint, tiktok_log text not null default ''
);
create index if not exists nx_leads_created on nx.leads (created_at desc);
create index if not exists nx_leads_phone on nx.leads (phone_e164);

create table if not exists nx.clicks (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text, event_id text unique, page_url text, referrer text, property_id text, property_name text,
  utm_source text, utm_medium text, utm_campaign text, utm_content text,
  ttclid text, fbclid text, gclid text, client_ip text, user_agent text
);
create index if not exists nx_clicks_created on nx.clicks (created_at desc);

create table if not exists nx.notes (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  lead_id bigint not null references nx.leads(id) on delete cascade,
  author_name text, body text not null, kind text default 'note'
);
create index if not exists nx_notes_lead on nx.notes (lead_id, created_at desc);

alter table nx.config enable row level security;
alter table nx.leads  enable row level security;
alter table nx.clicks enable row level security;
alter table nx.notes  enable row level security;
revoke all on all tables in schema nx from public, anon, authenticated;

-- ===== kiểm khoá =====
create or replace function nx._ok_ingest(p_secret text) returns boolean
language sql stable security definer set search_path = nx, extensions, pg_temp as $$
  select coalesce(p_secret <> '' and encode(extensions.digest(p_secret, 'sha256'), 'hex')
         = (select value from nx.config where key = 'ingest_sha256'), false)
$$;
create or replace function nx._ok_crm(p_pass text) returns boolean
language sql stable security definer set search_path = nx, extensions, pg_temp as $$
  select coalesce(p_pass <> '' and (select value from nx.config where key = 'crm_pass_bcrypt')
         = extensions.crypt(p_pass, (select value from nx.config where key = 'crm_pass_bcrypt')), false)
$$;
revoke all on function nx._ok_ingest(text), nx._ok_crm(text) from public, anon, authenticated;

-- ===== máy chủ landing gọi =====
create or replace function public.nx_ingest_lead(p_secret text, p jsonb) returns jsonb
language plpgsql security definer set search_path = nx, pg_temp as $$
declare v_id bigint; v_dup bigint; v_old bigint;
begin
  if not nx._ok_ingest(p_secret) then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(p->>'event_id','') <> '' then
    select id into v_old from nx.leads where event_id = p->>'event_id';
    if v_old is not null then return jsonb_build_object('ok', true, 'id', v_old, 'repeat', true); end if;
  end if;
  if coalesce(p->>'phone_e164','') <> '' then
    select id into v_dup from nx.leads where phone_e164 = p->>'phone_e164' and created_at > now() - interval '60 days'
      order by created_at limit 1;
  end if;
  insert into nx.leads (mode, name, phone, phone_e164, email, note, user_note, appointment, property_id, property_name,
    page_url, referrer, event_id, ttclid, ttp, fbclid, fbp, fbc, gclid, gbraid, wbraid,
    utm_source, utm_medium, utm_campaign, utm_content, client_ip, user_agent, duplicate_of, status)
  values (p->>'mode', left(p->>'name',80), left(p->>'phone',20), p->>'phone_e164', p->>'email', left(p->>'note',600), left(p->>'user_note',400),
    p->>'appointment', p->>'property_id', p->>'property_name', left(p->>'page_url',600), left(p->>'referrer',600), nullif(p->>'event_id',''),
    p->>'ttclid', p->>'ttp', p->>'fbclid', p->>'fbp', p->>'fbc', p->>'gclid', p->>'gbraid', p->>'wbraid',
    p->>'utm_source', p->>'utm_medium', p->>'utm_campaign', p->>'utm_content', p->>'client_ip', left(p->>'user_agent',400), v_dup,
    coalesce(nullif(p->>'status',''),'Mới'))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'duplicate_of', v_dup);
end $$;

create or replace function public.nx_ingest_click(p_secret text, p jsonb) returns jsonb
language plpgsql security definer set search_path = nx, pg_temp as $$
begin
  if not nx._ok_ingest(p_secret) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into nx.clicks (kind, event_id, page_url, referrer, property_id, property_name, utm_source, utm_medium, utm_campaign, utm_content,
    ttclid, fbclid, gclid, client_ip, user_agent)
  values (p->>'kind', nullif(p->>'event_id',''), left(p->>'page_url',600), left(p->>'referrer',600), p->>'property_id', p->>'property_name',
    p->>'utm_source', p->>'utm_medium', p->>'utm_campaign', p->>'utm_content', p->>'ttclid', p->>'fbclid',
    coalesce(nullif(p->>'gclid',''), nullif(p->>'gbraid',''), nullif(p->>'wbraid','')), p->>'client_ip', left(p->>'user_agent',400))
  on conflict (event_id) do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- ===== trang CRM (mật khẩu sale) =====
create or replace function public.nx_crm_check(p_pass text) returns boolean
language sql security definer set search_path = nx, pg_temp as $$ select nx._ok_crm(p_pass) $$;

create or replace function public.nx_crm_leads(p_pass text, p_limit int default 500) returns jsonb
language plpgsql stable security definer set search_path = nx, pg_temp as $$
begin
  if not nx._ok_crm(p_pass) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from
    (select * from nx.leads order by created_at desc limit least(greatest(p_limit,1),5000)) l), '[]'::jsonb);
end $$;

create or replace function public.nx_crm_lead(p_pass text, p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = nx, pg_temp as $$
begin
  if not nx._ok_crm(p_pass) then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select to_jsonb(l) from nx.leads l where id = p_id);
end $$;

create or replace function public.nx_crm_update(p_pass text, p_id bigint, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = nx, pg_temp as $$
declare r jsonb;
begin
  if not nx._ok_crm(p_pass) then raise exception 'forbidden' using errcode = '42501'; end if;
  update nx.leads set
    status         = case when p_patch ? 'status' then coalesce(nullif(p_patch->>'status',''), status) else status end,
    next_follow_at = case when p_patch ? 'next_follow_at' then nullif(p_patch->>'next_follow_at','')::timestamptz else next_follow_at end,
    deposit_value  = case when p_patch ? 'deposit_value' then nullif(p_patch->>'deposit_value','')::bigint else deposit_value end,
    assignee       = case when p_patch ? 'assignee' then nullif(p_patch->>'assignee','') else assignee end,
    name           = case when p_patch ? 'name' then left(p_patch->>'name',80) else name end,
    appointment    = case when p_patch ? 'appointment' then p_patch->>'appointment' else appointment end,
    updated_at = now()
  where id = p_id returning to_jsonb(leads.*) into r;
  return r;
end $$;

create or replace function public.nx_crm_add_lead(p_pass text, p jsonb) returns jsonb
language plpgsql security definer set search_path = nx, pg_temp as $$
declare v_id bigint; v_dup bigint;
begin
  if not nx._ok_crm(p_pass) then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(p->>'phone_e164','') <> '' then
    select id into v_dup from nx.leads where phone_e164 = p->>'phone_e164' order by created_at limit 1;
  end if;
  insert into nx.leads (mode, name, phone, phone_e164, note, status, property_id, property_name, utm_source, utm_medium, duplicate_of)
  values (coalesce(nullif(p->>'mode',''),'goi'), left(p->>'name',80), left(p->>'phone',20), p->>'phone_e164', left(p->>'note',600),
    coalesce(nullif(p->>'status',''),'Mới'), p->>'property_id', p->>'property_name', p->>'utm_source', p->>'utm_medium', v_dup)
  returning id into v_id;
  return (select to_jsonb(l) from nx.leads l where id = v_id);
end $$;

create or replace function public.nx_crm_notes(p_pass text, p_lead bigint) returns jsonb
language plpgsql stable security definer set search_path = nx, pg_temp as $$
begin
  if not nx._ok_crm(p_pass) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from nx.notes n where lead_id = p_lead), '[]'::jsonb);
end $$;

create or replace function public.nx_crm_add_note(p_pass text, p_lead bigint, p_author text, p_body text, p_kind text default 'note') returns jsonb
language plpgsql security definer set search_path = nx, pg_temp as $$
declare r jsonb;
begin
  if not nx._ok_crm(p_pass) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into nx.notes (lead_id, author_name, body, kind) values (p_lead, left(p_author,60), left(p_body,2000), coalesce(p_kind,'note'))
  returning to_jsonb(notes.*) into r;
  return r;
end $$;

create or replace function public.nx_crm_log_event(p_pass text, p_id bigint, p_line text) returns void
language plpgsql security definer set search_path = nx, pg_temp as $$
begin
  if not nx._ok_crm(p_pass) then raise exception 'forbidden' using errcode = '42501'; end if;
  update nx.leads set tiktok_log = trim(both E'\n' from tiktok_log || E'\n' || to_char(now() at time zone 'Asia/Ho_Chi_Minh','DD/MM HH24:MI') || ' ' || p_line)
  where id = p_id;
end $$;

create or replace function public.nx_crm_report(p_pass text, p_since timestamptz default now() - interval '90 days') returns jsonb
language plpgsql stable security definer set search_path = nx, pg_temp as $$
begin
  if not nx._ok_crm(p_pass) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'leads', coalesce((select jsonb_agg(jsonb_build_object('id',id,'created_at',created_at,'status',status,'mode',mode,
        'utm_source',utm_source,'utm_medium',utm_medium,'utm_campaign',utm_campaign,'utm_content',utm_content,
        'ttclid',ttclid,'fbclid',fbclid,'gclid',gclid,'gbraid',gbraid,'wbraid',wbraid,'referrer',referrer,
        'property_name',property_name,'deposit_value',deposit_value)) from nx.leads where created_at >= p_since), '[]'::jsonb),
    'clicks', coalesce((select jsonb_agg(jsonb_build_object('id',id,'created_at',created_at,'kind',kind,'utm_source',utm_source,
        'utm_medium',utm_medium,'ttclid',ttclid,'fbclid',fbclid,'gclid',gclid,'referrer',referrer)) from nx.clicks where created_at >= p_since), '[]'::jsonb));
end $$;

-- Chỉ mở đúng các hàm public.nx_* cho khoá công khai (anon); bảng vẫn kín.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'nx\_%' loop
    execute format('revoke all on function %s from public', f.sig);
    execute format('grant execute on function %s to anon, authenticated', f.sig);
  end loop;
end $$;

-- Máy chủ ghi nhật ký gửi sự kiện (TikTok/Facebook) vào khách vừa lưu.
create or replace function public.nx_ingest_log(p_secret text, p_id bigint, p_line text) returns void
language plpgsql security definer set search_path = nx, pg_temp as $$
begin
  if not nx._ok_ingest(p_secret) then raise exception 'forbidden' using errcode = '42501'; end if;
  update nx.leads set tiktok_log = trim(both E'\n' from tiktok_log || E'\n' || to_char(now() at time zone 'Asia/Ho_Chi_Minh','DD/MM HH24:MI') || ' ' || p_line)
  where id = p_id;
end $$;
revoke all on function public.nx_ingest_log(text, bigint, text) from public;
grant execute on function public.nx_ingest_log(text, bigint, text) to anon, authenticated;
