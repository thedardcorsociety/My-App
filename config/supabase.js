const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL; 
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

let supabase;

try {
    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase URL atau Key tidak diatur di Environment Variables.");
    }
    
    supabase = createClient(supabaseUrl, supabaseKey);
} catch (error) {
    console.error(`Gagal inisialisasi Supabase: ${error.message}`);
    process.exit(1); 
}

module.exports = supabase;