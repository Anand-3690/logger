const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const CONNECTION_STRING = 'postgresql://postgres:1GRlwWQTYzIDDpPr@db.fgvngijqikcxdrjvdzfi.supabase.co:5432/postgres';
const SUPABASE_URL = 'https://fgvngijqikcxdrjvdzfi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xlhoYm36tJin5GtwYc7c-A_MLAoq2lN';

const client = new Client({
  connectionString: CONNECTION_STRING,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  console.log('--- Step 1: Connecting to PostgreSQL ---');
  await client.connect();
  console.log('Connected.');

  console.log('--- Step 2: Creating Schema, Tables, Indexes, and RLS Policies ---');
  await client.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      color_code TEXT NOT NULL DEFAULT '#3b82f6',
      icon TEXT NOT NULL DEFAULT 'Brain',
      reminder_time TIME WITHOUT TIME ZONE,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      log_date DATE NOT NULL,
      category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      notes TEXT,
      status TEXT DEFAULT 'present',
      photo_url TEXT,
      photo_storage_path TEXT,
      photo_data TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      endpoint TEXT,
      subscription_json TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(log_date);
    CREATE INDEX IF NOT EXISTS idx_daily_logs_category ON daily_logs(category_id);
    CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);

    ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
    ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on categories') THEN
        CREATE POLICY "Allow all on categories" ON categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on daily_logs') THEN
        CREATE POLICY "Allow all on daily_logs" ON daily_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on push_subscriptions') THEN
        CREATE POLICY "Allow all on push_subscriptions" ON push_subscriptions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
      END IF;
    END
    $$;

    -- Setup storage bucket
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('log_photos', 'log_photos', true)
    ON CONFLICT (id) DO UPDATE SET public = true;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access on log_photos') THEN
        CREATE POLICY "Public Access on log_photos" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'log_photos');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Insert on log_photos') THEN
        CREATE POLICY "Public Insert on log_photos" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'log_photos');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Update on log_photos') THEN
        CREATE POLICY "Public Update on log_photos" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'log_photos');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Delete on log_photos') THEN
        CREATE POLICY "Public Delete on log_photos" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'log_photos');
      END IF;
    END
    $$;
  `);
  console.log('Schema & Storage created.');

  console.log('--- Step 3: Inserting Categories ---');
  const catCsv = fs.readFileSync(path.join(__dirname, 'categories_exported.csv'), 'utf-8');
  const catLines = catCsv.trim().split('\n').slice(1);
  for (const line of catLines) {
    if (!line.trim()) continue;
    const parts = line.split(',');
    const [id, name, color_code, icon, reminder_time, is_active, created_at, updated_at] = parts;
    await client.query(`
      INSERT INTO categories (id, name, color_code, icon, reminder_time, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        color_code = EXCLUDED.color_code,
        icon = EXCLUDED.icon,
        reminder_time = EXCLUDED.reminder_time,
        is_active = EXCLUDED.is_active;
    `, [
      id,
      name,
      color_code,
      icon,
      reminder_time || null,
      is_active === 'true',
      created_at || new Date().toISOString(),
      updated_at || new Date().toISOString()
    ]);
  }
  console.log(`Inserted ${catLines.length} categories.`);

  console.log('--- Step 4: Inserting Daily Logs ---');
  const logs = JSON.parse(fs.readFileSync(path.join(__dirname, 'daily_logs_exported.json'), 'utf-8'));
  for (const log of logs) {
    // Update old photo_url domain to new project domain
    let photoUrl = log.photo_url || null;
    if (photoUrl && photoUrl.includes('supabase.co/storage/v1/object/public/log_photos/')) {
      const cleanPath = photoUrl.split('supabase.co/storage/v1/object/public/log_photos/')[1];
      photoUrl = `${SUPABASE_URL}/storage/v1/object/public/log_photos/${cleanPath}`;
    }

    await client.query(`
      INSERT INTO daily_logs (
        id, log_date, category_id, notes, status, photo_url, photo_storage_path, photo_data, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        notes = EXCLUDED.notes,
        status = EXCLUDED.status,
        photo_url = EXCLUDED.photo_url,
        photo_storage_path = EXCLUDED.photo_storage_path,
        photo_data = EXCLUDED.photo_data,
        updated_at = EXCLUDED.updated_at;
    `, [
      log.id,
      log.log_date,
      log.category_id,
      log.notes || '',
      log.status || 'present',
      photoUrl,
      log.photo_storage_path || null,
      log.photo_data || null,
      log.created_at || new Date().toISOString(),
      log.updated_at || new Date().toISOString()
    ]);
  }
  console.log(`Inserted ${logs.length} daily logs.`);

  console.log('--- Step 5: Uploading Decoded Photo to Supabase Storage ---');
  const savedImagePath = path.join(__dirname, 'uploads', '443a624f-be87-42d5-b7f4-2a0d852c7f98_79bf761f-a6eb-474d-83b2-b7a14f7b2d5f.jpg');
  if (fs.existsSync(savedImagePath)) {
    const imgBuffer = fs.readFileSync(savedImagePath);
    const storagePath = '443a624f-be87-42d5-b7f4-2a0d852c7f98/79bf761f-a6eb-474d-83b2-b7a14f7b2d5f.jpg';
    
    // Direct Postgres insert into storage.objects
    await client.query(`
      INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ($1, $2, null, $3)
      ON CONFLICT (bucket_id, name) DO NOTHING;
    `, [
      'log_photos',
      storagePath,
      JSON.stringify({ mimetype: 'image/jpeg', size: imgBuffer.length })
    ]);
    console.log('Storage object registered for photo.');
  }

  // Verification counts
  const catRes = await client.query('SELECT count(*) FROM categories;');
  const logRes = await client.query('SELECT count(*) FROM daily_logs;');
  console.log('--- VERIFICATION ---');
  console.log('Categories count:', catRes.rows[0].count);
  console.log('Daily logs count:', logRes.rows[0].count);

  await client.end();

  console.log('--- Step 6: Creating User Account via Supabase Auth ---');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: 'anandsagar@avd.com',
    password: 'anand123'
  });
  if (authErr) {
    console.log('Auth note:', authErr.message);
  } else {
    console.log('Auth user created successfully! ID:', authData?.user?.id);
  }

  console.log('--- ALL DONE! ---');
}

runMigration().catch(err => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
