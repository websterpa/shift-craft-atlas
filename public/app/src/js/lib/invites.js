import { supabase } from './supabase.js';

/**
 * Invites Library (Supabase Backend)
 */
export async function validateInvite(code) {
    try {
        if (!supabase) return { ok: false, error: 'System error: Database client missing' };

        console.log('[Invites] Validating code via RPC:', code);
        const { data, error } = await supabase.rpc('validate_invite', { p_code: code });

        if (error) {
            console.error('RPC Error:', error);
            return { ok: false, error: error.message };
        }

        // RPC returns { valid: boolean, error: string, label: string }
        if (data && data.valid) {
            return { ok: true, label: data.label };
        } else {
            return { ok: false, error: (data && data.error) ? data.error : 'Invalid Code' };
        }
    } catch (e) {
        console.error('Invite validation exception:', e);
        return { ok: false, error: 'Network error' };
    }
}
