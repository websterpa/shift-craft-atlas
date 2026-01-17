-- Admin RPCs for Flags (Patched for Permissions)

create or replace function public.set_flag(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Must be authenticated (not anon)
  if auth.role() = 'anon' then
     raise exception 'Forbidden: Anonymous access' using errcode = '42501';
  end if;
  
  -- 2. Must have UID
  if auth.uid() is null then
     raise exception 'Forbidden: No User ID' using errcode = '42501';
  end if;

  -- 3. Must be in App Admins
  if not exists (select 1 from app_admins where uid = auth.uid()) then
     raise exception 'Forbidden: Not an Admin' using errcode = '42501';
  end if;

  insert into flags(key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = p_value, updated_at = now();

  -- Audit
  perform audit('flag_set', p_key, jsonb_build_object('value', p_value));
end;
$$;
