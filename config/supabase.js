// backend/config/supabase.js
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const connectSupabase = () => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL or SUPABASE_SERVICE_KEY is missing');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ✅ Uncommented this line so you see it in the console
    console.log('✅ Supabase Client Initialized'); 
    
    return supabase;

  } catch (error) {
    console.error('❌ Supabase connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectSupabase;