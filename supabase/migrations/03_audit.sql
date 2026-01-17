-- Audit Log Table
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  actor uuid, -- auth.uid() when available
  action text not null,
  resource text not null,
  details jsonb
);

alter table audit_log enable row level security;

-- Admin Read Policy
create policy audit_read_admin on audit_log
for select using (
  auth.uid() in (select uid from app_admins)
);

-- No Access Policy (Explicit deny for direct inserts)
create policy audit_no_client_writes on audit_log
for insert with check (false);

-- Helper RPC
create or replace function public.audit(p_action text, p_resource text, p_details jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log(actor, action, resource, details)
  values (auth.uid(), p_action, p_resource, p_details);
end;
$$;
