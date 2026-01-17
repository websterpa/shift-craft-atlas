-- Fix Schema for Enhanced Throttling

alter table waitlist_ip_throttle 
add column if not exists attempt_count int default 1;

alter table waitlist_ip_throttle 
add column if not exists last_attempt_at timestamptz default now();

-- Migrate old data if present
update waitlist_ip_throttle 
set last_attempt_at = last_submission 
where last_attempt_at is null and last_submission is not null;
