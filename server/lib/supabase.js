const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables if not already loaded
if (!process.env.SUPABASE_URL) {
    dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY; // Prefer Service Key for backend

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };
