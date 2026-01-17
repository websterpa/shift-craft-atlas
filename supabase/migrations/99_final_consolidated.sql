-- MASTER MIGRATION: Shift Craft Backend (Consolidated & Fixed)

-- 1. Extensions
create extension if not exists pgcrypto schema public;
create extension if not exists citext schema public;

-- 2. Tables
create table if not exists app_admins (
  uid uuid primary key,
  email text,
  created_at timestamptz default now()
);

create table if not exists flags (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);
alter table flags enable row level security;
alter table flags force row level security;

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  table_name text,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  actor_uid uuid default auth.uid(),
  ip_address text,
  created_at timestamptz default now()
);
alter table audit_log enable row level security;

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  name text,
  source text,
  ip_hash text,
  created_at timestamptz default now()
);
alter table waitlist enable row level security;

create table if not exists waitlist_ip_throttle (
  ip_hash text primary key,
  last_submission timestamptz not null default now(),
  attempt_count int default 1,
  last_attempt_at timestamptz default now()
);
-- Ensure columns exist (if table existed before with fewer columns)
alter table waitlist_ip_throttle add column if not exists attempt_count int default 1;
alter table waitlist_ip_throttle add column if not exists last_attempt_at timestamptz default now();

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  label text,
  expires_at timestamptz,
  uses_remaining int,
  created_by uuid references app_admins(uid),
  created_at timestamptz not null default now()
);
alter table invites enable row level security;

-- 3. Policies (Idempotent Drops)
drop policy if exists flags_read_all on flags;
create policy flags_read_all on flags for select using (true);

drop policy if exists flags_admin_write on flags;
create policy flags_admin_write on flags for all using (auth.uid() in (select uid from app_admins)) with check (auth.uid() in (select uid from app_admins));

drop policy if exists audit_read_admin on audit_log;
create policy audit_read_admin on audit_log for select using (auth.uid() in (select uid from app_admins));

drop policy if exists audit_no_client_writes on audit_log;
create policy audit_no_client_writes on audit_log for insert with check (false);

drop policy if exists waitlist_read_admin on waitlist;
create policy waitlist_read_admin on waitlist for select using (auth.uid() in (select uid from app_admins));

drop policy if exists waitlist_no_public_write on waitlist;
create policy waitlist_no_public_write on waitlist for insert with check (false);

drop policy if exists invites_read_admin on invites;
create policy invites_read_admin on invites for select using (auth.uid() in (select uid from app_admins));

-- 4. RPC Functions (Latest logic)

-- Audit Helper
drop function if exists public.audit(text, text, jsonb);
create or replace function public.audit(p_event text, p_table text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log(event_type, table_name, new_data, actor_uid, ip_address)
  values (p_event, p_table, p_data, auth.uid(), current_setting('request.headers', true)::json->>'x-forwarded-for');
end;
$$;

-- Get Flags
create or replace function public.get_public_flags()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_object_agg(key, value) from flags;
$$;

-- Set Flag (Secure Invoker)
create or replace function public.set_flag(p_key text, p_value jsonb)
returns void
language plpgsql
set search_path = public
as $$
begin
  insert into flags(key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = p_value, updated_at = now();
  perform audit('flag_set', p_key, jsonb_build_object('value', p_value));
end;
$$;

-- Join Waitlist (Clean)
drop function if exists public.join_waitlist(text, text, text);
drop function if exists public.join_waitlist(text, text, text, text);

create or replace function public.join_waitlist(p_email text, p_name text default null, p_source text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ip text;
  v_ip_hash text;
  v_waitlist_id uuid;
begin
  v_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
  if v_ip is null then v_ip := '0.0.0.0'; end if;
  v_ip_hash := encode(digest(v_ip, 'sha256'), 'hex');

  -- Custom Rate Limit (5 per hour)
  if exists (
    select 1 from waitlist_ip_throttle 
    where ip_hash = v_ip_hash 
    and last_attempt_at > now() - interval '1 hour'
    and attempt_count >= 5
  ) then
      return jsonb_build_object('ok', false, 'error', 'Too many requests');
  end if;
  
  -- Update Throttle
  insert into waitlist_ip_throttle(ip_hash, attempt_count, last_attempt_at, last_submission)
  values (v_ip_hash, 1, now(), now())
  on conflict (ip_hash) do update
  set attempt_count = waitlist_ip_throttle.attempt_count + 1,
      last_attempt_at = now(),
      last_submission = now();
      
  begin
    insert into waitlist(email, name, source, ip_hash)
    values (p_email, p_name, p_source, v_ip_hash)
    returning id into v_waitlist_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'status', 'already_registered');
  end;

  perform audit('waitlist_join', 'waitlist', jsonb_build_object('id', v_waitlist_id));
  return jsonb_build_object('ok', true);
end;
$$;

-- Validate Invite
create or replace function public.validate_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_invite record;
begin
  v_hash := encode(digest(p_code, 'sha256'), 'hex');
  select * into v_invite from invites where code_hash = v_hash;

  if v_invite.id is null then return jsonb_build_object('valid', false, 'error', 'Invalid code'); end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then return jsonb_build_object('valid', false, 'error', 'Expired'); end if;
  if v_invite.uses_remaining is not null and v_invite.uses_remaining <= 0 then return jsonb_build_object('valid', false, 'error', 'Usage limit reached'); end if;

  if v_invite.uses_remaining is not null then
    update invites set uses_remaining = uses_remaining - 1 where id = v_invite.id;
  end if;

  perform audit('invite_validated', 'invites', jsonb_build_object('label', v_invite.label));
  return jsonb_build_object('valid', true, 'label', v_invite.label);
end;
$$;

-- Create Invite
create or replace function public.create_invite(p_code text, p_label text default null, p_uses int default null, p_expires timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or auth.uid() not in (select uid from app_admins) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into invites(code_hash, label, uses_remaining, expires_at, created_by)
  values (encode(digest(p_code, 'sha256'), 'hex'), p_label, p_uses, p_expires, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- 5. Seeding (Idempotent)
insert into invites (code_hash, label, uses_remaining)
values (encode(digest('ATLAS2026', 'sha256'), 'hex'), 'Default Early Access', null)
on conflict (code_hash) do nothing;
