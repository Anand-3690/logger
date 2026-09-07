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

async function insertLogs() {
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

    // 2. Resolve or create 'Guruhari Darshan' category ID
    console.log('Resolving category ID for "Guruhari Darshan"...');
    let { data: catData, error: catError } = await supabase
      .from('categories')
      .select('id')
      .eq('name', 'Guruhari Darshan')
      .single();

    let categoryId;
    if (catError || !catData) {
      console.log('Category not found. Creating "Guruhari Darshan"...');
      const { data: newCat, error: newCatError } = await supabase
        .from('categories')
        .insert([{ name: 'Guruhari Darshan' }])
        .select('id')
        .single();
      
      if (newCatError) throw new Error(`Failed to create category: ${newCatError.message}`);
      categoryId = newCat.id;
    } else {
      categoryId = catData.id;
    }
    console.log(`✅ Category ID resolved: ${categoryId}`);

    // 3. Clear existing Guruhari Darshan logs to prevent duplicates
    console.log('Clearing old Guruhari Darshan entries from daily_logs...');
    await supabase.from('daily_logs').delete().eq('category_id', categoryId);

    console.log('Reading "GuruhariDarshan_Formatted.txt"...');
    const fileContent = fs.readFileSync('GuruhariDarshan_Formatted.txt', 'utf-8');

    // Split file by the date header pattern: ### **Date**
    // This splits the file chunks neatly by each date section
    const rawSections = fileContent.split(/### \*\*(.*?)\*\*/g);
    
    const entries = [];

    // rawSections will look like: [ "", "8 August 2021", "content...", "14 August 2021", "content...", ... ]
    for (let i = 1; i < rawSections.length; i += 2) {
      const dateString = rawSections[i].trim();
      let contentString = rawSections[i + 1] || '';

      // Clean up separator lines or excessive padding
      contentString = contentString
        .replace(/={40,}/g, '') // remove "===================="
        .replace(/-{40,}/g, '') // remove "--------------------"
        .trim();

      if (!contentString) continue;

      // Parse date string into YYYY-MM-DD safely
      const dateObj = new Date(dateString);
      if (isNaN(dateObj.getTime())) {
        console.warn(`⚠️ Warning: Could not parse date "${dateString}". Skipping.`);
        continue;
      }

      const offset = dateObj.getTimezoneOffset() * 60000;
      const localDate = new Date(dateObj.getTime() - offset);
      const formattedDate = localDate.toISOString().split('T')[0];

      entries.push({
        log_date: formattedDate,
        category_id: categoryId,
        notes: contentString,
        status: 'present'
      });
    }

    console.log(`Successfully parsed ${entries.length} entries. Inserting into 'daily_logs'...`);

    // 4. Batch insert into daily_logs (in chunks of 50 to avoid payload limits)
    const batchSize = 50;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const { error: insertError } = await supabase.from('daily_logs').insert(batch);
      if (insertError) {
        throw new Error(`Batch insert failed: ${insertError.message}`);
      }
    }

    console.log('✅ Success! All Guruhari Darshan entries have been securely updated in Supabase.');

  } catch (err) {
    console.error('❌ Script failed:', err);
  }
}

insertLogs();