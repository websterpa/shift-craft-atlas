-- Fix Audit Schema (Normalize All Columns)

do $$
begin
  -- 1. Rename Columns to match Master Schema
  if exists(select 1 from information_schema.columns where table_name = 'audit_log' and column_name = 'action') then
    alter table audit_log rename column action to event_type;
  end if;

  if exists(select 1 from information_schema.columns where table_name = 'audit_log' and column_name = 'resource') then
    alter table audit_log rename column resource to table_name;
  end if;

  if exists(select 1 from information_schema.columns where table_name = 'audit_log' and column_name = 'details') then
    alter table audit_log rename column details to new_data;
  end if;

  if exists(select 1 from information_schema.columns where table_name = 'audit_log' and column_name = 'actor') then
    alter table audit_log rename column actor to actor_uid;
  end if;

  -- 2. Add Missing Columns
  alter table audit_log add column if not exists ip_address text;
  alter table audit_log add column if not exists old_data jsonb;
  alter table audit_log add column if not exists created_at timestamptz default now();
  alter table audit_log add column if not exists record_id text;

  -- 3. Ensure 'event_type' exists (if it was missing and not renamed)
  alter table audit_log add column if not exists event_type text;
end $$;
