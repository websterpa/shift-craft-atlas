const express = require('express');
const { supabase } = require('../lib/supabase');
const { ok, fail } = require('../lib/respond');
const { requireAdmin } = require('../lib/auth');
const router = express.Router();

// GET Flags (Public)
router.get('/', async (req, res, next) => {
    try {
        // Use the RPC defined in SQL
        const { data, error } = await supabase.rpc('get_public_flags');

        if (error) {
            throw error;
        }

        ok(res, data || {});
    } catch (e) {
        console.error('Flags Fetch Error:', e);
        // Fallback or fail? User Prompt 7 removed SPA fallbacks.
        // We simply fail 500 if DB is down.
        next(e);
    }
});

// Update Flag (Admin)
router.post('/', async (req, res, next) => {
    try {
        await requireAdmin(req); // Still enforce API-level "Secret Token" for now
        // Note: Real RLS requires a specific User Context (auth.uid).
        // Since we are using Service Key in 'supabase.js', we bypass RLS by default / act as superuser.
        // The SQL Policy "flags_admin_write" checks "auth.uid() in app_admins".
        // If we use Service Key, we are admin. 
        // If we want to test RLS, we should sign in or use setSession.
        // But for this MVP backend, Service Key Write is fine.

        const { key, value } = req.body;
        if (!key || value === undefined) {
            throw new Error("Missing key or value");
        }

        const { error } = await supabase
            .from('flags')
            .upsert({ key, value, updated_at: new Date() });

        if (error) throw error;

        // Audit via RPC
        await supabase.rpc('audit', {
            p_action: 'flag_update',
            p_resource: key,
            p_details: { newValue: value }
        });

        ok(res, { success: true, key });
    } catch (e) {
        next(e);
    }
});

module.exports = router;
