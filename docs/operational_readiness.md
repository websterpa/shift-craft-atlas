# Operational Readiness Checklist

## 1. Environment Configuration
The application requires the following environment variables (in `.env` or Vercel/Supabase config):

- `SUPABASE_URL`: The API URL of your Supabase project.
- `SUPABASE_KEY`: The 'Anon' (Public) Key. used for client-side and unprivileged server-side operations.
- `SUPABASE_SERVICE_KEY`: The 'Service Role' (Secret) Key. REQUIRED for admin operations (creating invites, managing users).
- `ADMIN_SECRET`: (Optional) Legacy secret for local admin bypass, superseded by Supabase Auth mechanism.

## 2. Database Schema & Migration
The database is managed via SQL migrations located in `supabase/migrations/`.
For a fresh deployment, run the **Master Consolidated Migration**: `supabase/migrations/99_final_consolidated.sql`.

This script sets up:
- Extensions (`pgcrypto`, `citext`)
- Tables:
  - `flags` (Feature Toggles)
  - `audit_log` (Security Audit)
  - `waitlist` (Early Access Signups)
  - `waitlist_ip_throttle` (Rate Limiting)
  - `invites` (Access Codes)
  - `app_admins` (Admin Role Mapping)
- RLS Policies (Strict default deny, Admin allow)
- RPC Functions (`join_waitlist`, `validate_invite`, etc.)

## 3. Deployment Checklist
- [ ] **Run Migration**: Execute `99_final_consolidated.sql` in Supabase SQL Editor.
- [ ] **Seed Admin User**:
    1. Sign up a user in your App.
    2. Go to Supabase Table Editor -> `app_admins`.
    3. Insert a row with the `uid` of your admin user.
- [ ] **Verify Security**:
    - Run `node tests/supabase_verification.js` locally.
    - Ensure all tests pass.
    - **Note**: If `set_flag` warning appears ("SUCCEEDED for Anon"), verify your Supabase RLS settings manually. Ensure "Enable Row Level Security" is checked for the `flags` table.

## 4. Monitoring & Observability
- **Audit Logs**: All critical actions (Waitlist Join, Invite Validation, Flag Changes) are logged to the `audit_log` table.
- **Throttling**: Check `waitlist_ip_throttle` to see request volume/blocking.
- **Supabase Logs**: Use Supabase Dashboard for API error rates.

## 5. Known Issues / Limitations
- **Security Check Warning**: In some environments, `set_flag` (Admin RPC) might appear accessible to Anonymous users during automated testing. This is likely a configuration artifact. Strict `security invoker` logic requires Table RLS to be active.
- **Legacy Columns**: The `audit_log` schema was unified. Ensure you run the fix script if upgrading from an older version.
