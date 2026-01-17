-- Admin RPCs for Flags (Switched to Security Invoker)

create or replace function public.set_flag(p_key text, p_value jsonb)
returns void
language plpgsql
-- Removed 'security definer' to enforce Table RLS
set search_path = public
as $$
begin
  insert into flags(key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = p_value, updated_at = now();

  -- Audit (audit() RPC is security definer, so it will still work)
  perform audit('flag_set', p_key, jsonb_build_object('value', p_value));
end;
$$;
