import { supabase } from './supabase.js';

/**
 * Waitlist Library (Supabase Backend)
 */
export async function joinWaitlist(email, name, source) {
    try {
        if (!supabase) {
            console.error('Supabase client is not initialized (CDN load failed?)');
            return { ok: false, error: 'System error: Database client missing' };
        }

        const { data, error } = await supabase.rpc('join_waitlist', {
            p_email: email,
            p_name: name || null,
            p_source: source || null
        });

        if (error) {
            console.error('Waitlist RPC Error:', error);
            // Translate Supabase errors if possible
            return { ok: false, error: error.message };
        }

        // RPC returns { ok: boolean, error?: string, status?: string }
        if (data.ok) {
            return { ok: true };
        } else {
            return { ok: false, error: data.error || data.status || 'Failed to join' };
        }

    } catch (e) {
        console.error('Waitlist exception:', e);
        return { ok: false, error: 'Network error' };
    }
}
