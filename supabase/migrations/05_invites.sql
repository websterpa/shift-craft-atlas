-- Invites Table
create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique, -- sha256 hex
  label text,
  expires_at timestamptz,
  uses_remaining int, -- null for unlimited
  created_by uuid references app_admins(uid),
  created_at timestamptz not null default now()
);

alter table invites enable row level security;

-- Policies
create policy invites_read_admin on invites
for select using (auth.uid() in (select uid from app_admins));

create policy invites_no_client_writes on invites for insert with check (false);
create policy invites_no_client_updates on invites for update using (false);
create policy invites_no_client_deletes on invites for delete using (false);

-- RPC: Create Invite (Admin Only)
create or replace function public.create_invite(p_code text, p_label text default null, p_uses int default null, p_expires timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_hash text;
begin
  -- Check Admin
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

-- RPC: Validate Invite (Public)
create or replace function public.validate_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
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

  -- Audit (using Prompt 3 helper)
  perform audit('invite_validated', 'invites', jsonb_build_object('label', v_invite.label));

  return jsonb_build_object('valid', true, 'label', v_invite.label);
end;
$$;

-- Seed Default Invite (ATLAS2026)
-- We cannot use create_invite because we might not be auth.uid() in this script context.
-- Manual insert of hash for 'ATLAS2026'
insert into invites (code_hash, label, uses_remaining)
values (
  encode(digest('ATLAS2026', 'sha256'), 'hex'),
  'Default Early Access',
  null -- Unlimited
) on conflict (code_hash) do nothing;
