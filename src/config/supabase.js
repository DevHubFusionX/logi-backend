require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('⚠️  Missing Supabase environment variables!');
    console.error('   Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file');
}

// Public client (respects Row Level Security)
const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
        autoRefreshToken: true,
        persistSession: false
    }
});

// Admin client (bypasses Row Level Security) - Use for server-side operations
const supabaseAdmin = createClient(supabaseUrl || '', supabaseServiceKey || '', {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

module.exports = { supabase, supabaseAdmin };
