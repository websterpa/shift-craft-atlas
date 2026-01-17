-- Fix Extensions and Search Paths

-- Ensure pgcrypto is available
create extension if not exists pgcrypto schema public;

-- Update RPCs to search both public and extensions (just in case)

-- 1. Join Waitlist
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
  -- Get IP from HTTP headers (Supabase injects this in plan execution if configured, but here we might rely on client passing it? 
  -- No, we rely on p_email. Wait, where do we get IP? 
  -- Prompt 4 logic: "v_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';"
  -- The original RPC in 04_waitlist.sql logic:
  
  v_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
  if v_ip is null then v_ip := '0.0.0.0'; end if;
  v_ip_hash := encode(digest(v_ip, 'sha256'), 'hex');

  -- Throttling Check
  if exists (
    select 1 from waitlist_ip_throttle 
    where ip_hash = v_ip_hash 
    and last_attempt_at > now() - interval '1 hour'
    and attempt_count >= 5
  ) then
      return jsonb_build_object('ok', false, 'error', 'Too many requests');
  end if;
  
  -- Update Throttle
  insert into waitlist_ip_throttle(ip_hash, attempt_count, last_attempt_at)
  values (v_ip_hash, 1, now())
  on conflict (ip_hash) do update
  set attempt_count = waitlist_ip_throttle.attempt_count + 1,
      last_attempt_at = now();
      
  -- Insert Waitlist
  begin
    insert into waitlist(email, name, source)
    values (p_email, p_name, p_source)
    returning id into v_waitlist_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'status', 'already_registered');
  end;

  -- Audit
  perform audit('waitlist_join', 'waitlist', jsonb_build_object('id', v_waitlist_id));

  return jsonb_build_object('ok', true);
end;
$$;


-- 2. Validate Invite
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

  if v_invite.id is null then
    return jsonb_build_object('valid', false, 'error', 'Invalid code');
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
     return jsonb_build_object('valid', false, 'error', 'Code expired');
  end if;

  if v_invite.uses_remaining is not null and v_invite.uses_remaining <= 0 then
     return jsonb_build_object('valid', false, 'error', 'Code usage limit reached');
  end if;

  -- Decrement
  if v_invite.uses_remaining is not null then
    update invites set uses_remaining = uses_remaining - 1 where id = v_invite.id;
  end if;

  -- Audit
  perform audit('invite_validated', 'invites', jsonb_build_object('label', v_invite.label));

  return jsonb_build_object('valid', true, 'label', v_invite.label);
end;
$$;

-- 3. Create Invite (Admin)
create or replace function public.create_invite(p_code text, p_label text default null, p_uses int default null, p_expires timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_hash text;
begin
  if auth.uid() is null or auth.uid() not in (select uid from app_admins) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_hash := encode(digest(p_code, 'sha256'), 'hex');

  insert into invites(code_hash, label, uses_remaining, expires_at, created_by)
  values (v_hash, p_label, p_uses, p_expires, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;
