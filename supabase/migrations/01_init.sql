-- Enable hashing helpers
create extension if not exists pgcrypto;

-- Admin allow-list (store auth.uid() values of admins)
create table if not exists app_admins (
  uid uuid primary key,
  added_at timestamptz not null default now()
);

-- Seed yourself as admin (replace the UUID with your Supabase auth uid)
-- You can find your UID in the Authentication > Users section of the Supabase Dashboard.
insert into app_admins (uid) values ('00000000-0000-0000-0000-000000000000')
on conflict do nothing;
