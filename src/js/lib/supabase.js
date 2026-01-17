/* 
 * Supabase Client Initialization
 * Uses the global 'supabase' object from CDN script
 */
const SUPABASE_URL = 'https://xfwztqhcfyxtwusftmql.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ps0cNtovWKNh-aF5hrZu_w_m_JRWRtt';

let client;

if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('[Supabase] Client initialized');
} else {
    console.error('[Supabase] Library not loaded from CDN');
    // Fallback? No, just error.
}

export const supabase = client;
