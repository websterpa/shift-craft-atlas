-- Diagnostic RPC
create or replace function public.whoami()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'current_user', current_user,
    'session_user', session_user,
    'auth_uid', auth.uid(),
    'auth_role', auth.role(),
    'jwt_role', current_setting('request.jwt.claim.role', true)
  );
$$;
