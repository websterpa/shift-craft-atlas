-- Waitlist Extension
create extension if not exists citext;

-- Waitlist Table
create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  name text,
  source text,
  created_at timestamptz not null default now(),
  ip_hash text
);

alter table waitlist enable row level security;

-- Policies
create policy waitlist_read_admin on waitlist for select using (auth.uid() in (select uid from app_admins));
create policy waitlist_no_client_writes on waitlist for insert with check (false);
create policy waitlist_no_client_updates on waitlist for update using (false);
create policy waitlist_no_client_deletes on waitlist for delete using (false);

-- Throttle Table
create table if not exists waitlist_ip_throttle (
  ip_hash text primary key,
  last_submission timestamptz not null
);

-- RPC: join_waitlist
create or replace function public.join_waitlist(p_email text, p_name text default null, p_source text default null, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip_hash text;
  v_last_sub timestamptz;
begin
  -- Hash IP
  v_ip_hash := case when p_ip is null then null else encode(digest(p_ip, 'sha256'), 'hex') end;

  -- Check Throttle (e.g., 30 seconds)
  if v_ip_hash is not null then
    select last_submission into v_last_sub from waitlist_ip_throttle where ip_hash = v_ip_hash;
    if v_last_sub is not null and v_last_sub > now() - interval '30 seconds' then
         return jsonb_build_object('ok', false, 'error', 'Rate limit exceeded. Please wait.');
    end if;
    
    -- Update Throttle
    insert into waitlist_ip_throttle(ip_hash, last_submission) values (v_ip_hash, now())
    on conflict (ip_hash) do update set last_submission = now();
  end if;

  -- Insert Waitlist
  begin
    insert into waitlist(email, name, source, ip_hash)
    values (p_email, p_name, p_source, v_ip_hash);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'Email already on waitlist.');
  end;
  
  -- Audit (Prompt 3 Helper)
  perform audit('waitlist_join', p_email::text, jsonb_build_object('source', p_source));

  return jsonb_build_object('ok', true);
end;
$$;
