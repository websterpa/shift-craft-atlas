-- Admin RPCs for Flags (Required by Prompt 7 Tests)

-- Set Flag
create or replace function public.set_flag(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Check Admin
  if auth.uid() is null or auth.uid() not in (select uid from app_admins) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into flags(key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = p_value, updated_at = now();

  -- Audit
  perform audit('flag_set', p_key, jsonb_build_object('value', p_value));
end;
$$;
