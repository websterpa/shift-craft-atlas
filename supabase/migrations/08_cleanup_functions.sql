-- Cleanup overloaded functions and redeploy correct versions

-- 1. DROP Ambiguous Functions
drop function if exists public.join_waitlist(text, text, text); -- 3 args
drop function if exists public.join_waitlist(text, text, text, text); -- 4 args (p_ip)

-- 2. Redeploy Correct Join Waitlist (No p_ip arg, extracts from header)
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
  -- Get IP from HTTP headers
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
