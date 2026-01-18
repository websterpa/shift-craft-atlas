import { supabase } from './supabase.js';

/**
 * Feature Flags Library (Supabase Backend)
 */
export async function loadFlags() {
    try {
        if (!supabase) return {};

        const { data, error } = await supabase.rpc('get_public_flags');
        if (error) {
            console.warn('Failed to fetch flags via RPC:', error);
            return {};
        }
        return data || {};
    } catch (e) {
        console.error('Error loading flags:', e);
        return {};
    }
}

export async function setFlag(key, value) {
    // Admin Only
    try {
        const { error } = await supabase.rpc('set_flag', { p_key: key, p_value: value });
        if (error) throw error;
        return { ok: true };
    } catch (e) {
        console.error('setFlag error:', e);
        return { ok: false, error: e.message };
    }
}
