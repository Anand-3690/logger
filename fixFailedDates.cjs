const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// 1. Load variables from your .env file
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// ⚠️ ENTER YOUR APP LOGIN CREDENTIALS HERE
const APP_LOGIN_EMAIL = 'anandsagar@avd.com';
const APP_LOGIN_PASSWORD = 'anand123';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase variables in .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// The exact headers that failed in the previous run
const TARGET_HEADERS = [
  "21 AUG 2022, Bensalem",
  "8 MAY 2023 PSM",
  "12 OCT 2024 - Dashera",
  "25 FEB 2025 Staff Sabha",
  "7 MAY 2025 - વૈશાખ સુદ દશમ",
  "5 JAN 2026 Staff Sabha"
];

async function insertFailedLogs() {
  try {
    console.log('Authenticating with Supabase...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: APP_LOGIN_EMAIL,
      password: APP_LOGIN_PASSWORD,
    });

    if (authError || !authData.user) {
      throw new Error(`Authentication failed: ${authError?.message}`);
    }
    console.log('✅ Authenticated successfully.');

    // 2. Resolve 'Guruhari Darshan' category ID
    console.log('Resolving category ID for "Guruhari Darshan"...');
    let { data: catData, error: catError } = await supabase
      .from('categories')
      .select('id')
      .eq('name', 'Guruhari Darshan')
      .single();

    if (catError || !catData) {
      throw new Error(`Category not found. Please run the main script first to create it.`);
    }
    const categoryId = catData.id;
    console.log(`✅ Category ID resolved: ${categoryId}`);

    console.log('Reading "GuruhariDarshan_Formatted.txt"...');
    const fileContent = fs.readFileSync('GuruhariDarshan_Formatted.txt', 'utf-8');

    // Split file by the date header pattern
    const rawSections = fileContent.split(/### \*\*(.*?)\*\*/g);
    
    const entries = [];

    // Loop through the split sections
    for (let i = 1; i < rawSections.length; i += 2) {
      const rawHeader = rawSections[i].trim();
      let contentString = rawSections[i + 1] || '';

      // ONLY process the headers that are in our target list
      if (!TARGET_HEADERS.includes(rawHeader)) {
        continue;
      }

      // Clean up separator lines or excessive padding from the content
      contentString = contentString
        .replace(/={40,}/g, '') // remove "===================="
        .replace(/-{40,}/g, '') // remove "--------------------"
        .trim();

      if (!contentString) continue;

      // MAGIC FIX: Extract ONLY the "DD MMM YYYY" part from the messy header
      const dateMatch = rawHeader.match(/^(\d{1,2}\s+[a-zA-Z]+\s+\d{4})/i);
      
      if (!dateMatch) {
        console.warn(`⚠️ Warning: Still could not extract a clean date from "${rawHeader}".`);
        continue;
      }

      const cleanDateStr = dateMatch[1]; // e.g., "21 AUG 2022"

      // Parse the cleanly extracted date string
      const dateObj = new Date(cleanDateStr);
      const offset = dateObj.getTimezoneOffset() * 60000;
      const localDate = new Date(dateObj.getTime() - offset);
      const formattedDate = localDate.toISOString().split('T')[0];

      entries.push({
        log_date: formattedDate,
        category_id: categoryId,
        notes: contentString,
        status: 'present'
      });
      
      console.log(`Matched: "${rawHeader}" -> Parsed Date: ${formattedDate}`);
    }

    if (entries.length === 0) {
      console.log('No matching targeted entries found to insert.');
      return;
    }

    console.log(`\nSuccessfully parsed ${entries.length} targeted entries. Inserting into 'daily_logs'...`);

    // 4. Insert the missing entries
    const { error: insertError } = await supabase.from('daily_logs').insert(entries);
    
    if (insertError) {
      throw new Error(`Insert failed: ${insertError.message}`);
    }

    console.log('✅ Success! The missing entries have been perfectly parsed and added to your database.');

  } catch (err) {
    console.error('\n❌ Script failed:', err);
  }
}

insertFailedLogs();