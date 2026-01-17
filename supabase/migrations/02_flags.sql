-- Create Flags Table
create table if not exists flags (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- RLS
alter table flags enable row level security;

-- Policies
create policy flags_read_all on flags for select using (true);

create policy flags_admin_insert on flags for insert with check (
  auth.uid() in (select uid from app_admins)
);

create policy flags_admin_update on flags for update using (
  auth.uid() in (select uid from app_admins)
) with check (
  auth.uid() in (select uid from app_admins)
);

create policy flags_admin_delete on flags for delete using (
  auth.uid() in (select uid from app_admins)
);

-- Seed defaults
insert into flags(key, value) values
('prelaunch', '{"enabled": true}'),
('inviteOnly', '{"enabled": true}'),
('enableBilling', '{"enabled": false}'),
('enableGenerator', '{"enabled": false}')
on conflict (key) do nothing;

-- RPC to fetch as single JSON object
create or replace function public.get_public_flags()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from flags;
$$;
