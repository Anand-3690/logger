import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import pg from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const { Pool } = pg;

export interface CategoryRecord {
  id: string;
  name: string;
  color_code: string;
  icon: string;
  reminder_time?: string | null; // HH:MM format e.g. "09:00"
  is_active: boolean;
}

export interface PushSubscriptionRecord {
  id: string;
  subscription_json: string;
  created_at: string;
}

export interface DailyLogRecord {
  id: string;
  log_date: string; // YYYY-MM-DD
  category_id: string;
  notes?: string | null;
  photo_url?: string | null;
  status?: 'present' | 'absent';
  created_at: string;
}

export interface AuthState {
  password_hash: string;
  salt: string;
  session_tokens: { token: string; expires_at: number; created_at: string }[];
  configured: boolean;
}

// SQL Schema definitions matching PostgreSQL & Supabase
export const POSTGRES_SCHEMA_SQL = `
-- Table 1: Categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color_code TEXT NOT NULL DEFAULT '#3b82f6',
  icon TEXT NOT NULL DEFAULT 'Brain',
  reminder_time TIME WITHOUT TIME ZONE DEFAULT '20:00:00',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 2: Daily Logs
CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date DATE NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  notes TEXT,
  status TEXT DEFAULT 'present',
  photo_data TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(log_date, category_id)
);

-- Table 3: App Security / Auth Passcode Table
CREATE TABLE IF NOT EXISTS app_auth (
  id TEXT PRIMARY KEY DEFAULT 'master',
  password_hash TEXT,
  salt TEXT,
  session_tokens TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 4: Push Subscriptions (Web Push)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT,
  subscription_json TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for optimal lookup performance
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_category ON daily_logs(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_reminder ON categories(reminder_time);
`;

export const POSTGRES_SEED_SQL = `
-- Seed Initial Categories with Reminder Times
INSERT INTO categories (id, name, color_code, icon, reminder_time, is_active)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Deep Work', '#3b82f6', 'Brain', '09:00:00', true),
  ('22222222-2222-2222-2222-222222222222', 'Fitness', '#22c55e', 'Dumbbell', '18:30:00', true),
  ('33333333-3333-3333-3333-333333333333', 'Guru Prasangs & Texts', '#f97316', 'BookOpen', '20:00:00', true)
ON CONFLICT (id) DO NOTHING;
`;

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'app_data.json');

interface DatabaseState {
  categories: CategoryRecord[];
  logs: DailyLogRecord[];
  push_subscriptions?: PushSubscriptionRecord[];
  auth?: AuthState;
}

const DEFAULT_CATEGORIES: CategoryRecord[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Deep Work',
    color_code: '#3b82f6',
    icon: 'Brain',
    reminder_time: '09:00',
    is_active: true,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Fitness',
    color_code: '#22c55e',
    icon: 'Dumbbell',
    reminder_time: '18:30',
    is_active: true,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Guru Prasangs & Texts',
    color_code: '#f97316',
    icon: 'BookOpen',
    reminder_time: '20:00',
    is_active: true,
  },
];

class DatabaseManager {
  private state: DatabaseState = {
    categories: [...DEFAULT_CATEGORIES],
    logs: [],
  };
  private pgPool: pg.Pool | null = null;
  private supabase: SupabaseClient | null = null;
  public isCloudConnected: boolean = false;
  public connectionType: 'postgres' | 'supabase_https' | 'none' = 'none';
  public lastError: string | null = null;
  public initPromise: Promise<void>;

  constructor() {
    this.initLocal();
    this.initPromise = this.initCloudDatabase();
  }

  private hashPassword(password: string, salt: string): string {
    return crypto.createHmac('sha256', salt).update(password).digest('hex');
  }

  private initLocal() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      const defaultSalt = crypto.randomBytes(16).toString('hex');
      const defaultHash = this.hashPassword('admin123', defaultSalt);

      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.state = {
          categories: parsed.categories || DEFAULT_CATEGORIES,
          logs: parsed.logs || [],
          push_subscriptions: parsed.push_subscriptions || [],
          auth: parsed.auth && parsed.auth.password_hash ? parsed.auth : {
            password_hash: defaultHash,
            salt: defaultSalt,
            session_tokens: [],
            configured: true,
          },
        };
        this.cleanupOrphanedLogs();
      } else {
        this.state = {
          categories: DEFAULT_CATEGORIES,
          logs: [],
          push_subscriptions: [],
          auth: {
            password_hash: defaultHash,
            salt: defaultSalt,
            session_tokens: [],
            configured: true,
          },
        };
        this.persistLocal();
      }
    } catch (err) {
      console.error('[Database] Error initializing local database file:', err);
    }
  }

  private persistLocal() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Database] Failed to persist local database file:', err);
    }
  }

  /**
   * Normalize reminder_time to HH:MM format
   */
  private formatTime(timeStr?: string | null): string | null {
    if (!timeStr) return null;
    const clean = timeStr.trim();
    if (clean.length >= 5) {
      return clean.slice(0, 5);
    }
    return clean;
  }

  /**
   * Format reminder_time for Postgres TIME column e.g. "09:00:00"
   */
  private formatTimeForPg(timeStr?: string | null): string | null {
    if (!timeStr) return null;
    const clean = timeStr.trim();
    if (clean.length === 5) {
      return `${clean}:00`;
    }
    return clean;
  }

  /**
   * Initialize Cloud Database (supports both Supabase REST API via HTTPS and Postgres direct/pooler)
   */
  private async initCloudDatabase(): Promise<void> {
    const rawConnString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    // Mode 1: Supabase HTTPS Client (100% immune to port/IPv6 issues)
    if (supabaseUrl && supabaseKey) {
      try {
        console.log('[Database] 🔌 Connecting to Supabase via HTTPS REST API...');
        this.supabase = createClient(supabaseUrl.trim(), supabaseKey.trim(), {
          auth: { persistSession: false },
        });

        // Test Supabase connection
        const { data, error } = await this.supabase.from('categories').select('*').limit(5);
        if (error) {
          throw error;
        }

        this.isCloudConnected = true;
        this.connectionType = 'supabase_https';
        this.lastError = null;
        console.log('[Database] ✅ Connected to Supabase via HTTPS successfully!');

        await this.syncFromSupabaseHttps();
        return;
      } catch (err: any) {
        console.error('[Database] ⚠️ Supabase HTTPS connection error:', err.message || err);
        this.lastError = err.message || String(err);
      }
    }

    // Mode 2: Direct PostgreSQL Connection Pool
    if (rawConnString && rawConnString.trim()) {
      let connectionString = rawConnString.trim().replace(/:\[(.*?)\]@/, ':$1@');
      console.log('[Database] 🔌 Connecting to PostgreSQL / Supabase pooler...');

      try {
        this.pgPool = new Pool({
          connectionString,
          ssl: {
            rejectUnauthorized: false,
          },
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        });

        const client = await this.pgPool.connect();
        try {
          await client.query(POSTGRES_SCHEMA_SQL);
          this.isCloudConnected = true;
          this.connectionType = 'postgres';
          this.lastError = null;
          console.log('[Database] ✅ Connected to PostgreSQL database successfully!');

          await this.syncFromPostgres(client);
          return;
        } finally {
          client.release();
        }
      } catch (err: any) {
        this.lastError = err.message || String(err);
        console.error('[Database] ⚠️ PostgreSQL connection error:', this.lastError);
      }
    }

    console.log('[Database] Operating with local persistent JSON storage.');
  }

  /**
   * Sync data from Supabase HTTPS client
   */
  private async syncFromSupabaseHttps() {
    if (!this.supabase) return;

    try {
      // 1. Categories
      const { data: cats, error: catErr } = await this.supabase
        .from('categories')
        .select('*')
        .order('created_at', { ascending: true });

      if (!catErr && cats && cats.length > 0) {
        this.state.categories = cats.map((r: any) => ({
          id: String(r.id),
          name: r.name,
          color_code: r.color_code || '#3b82f6',
          icon: r.icon || 'Sparkles',
          reminder_time: this.formatTime(r.reminder_time),
          is_active: r.is_active !== false,
        }));
      } else if (!catErr && (!cats || cats.length === 0)) {
        // Seed default categories into Supabase
        for (const cat of this.state.categories) {
          await this.supabase.from('categories').upsert({
            id: cat.id,
            name: cat.name,
            color_code: cat.color_code,
            icon: cat.icon,
            reminder_time: this.formatTimeForPg(cat.reminder_time),
            is_active: cat.is_active,
          });
        }
      }

      // 2. Daily Logs
      let logsData: any[] | null = null;
      let logsTableName = 'daily_logs';

      for (const tName of ['daily_logs', 'logs', 'activity_logs']) {
        try {
          const { data: logs, error: logErr } = await this.supabase
            .from(tName)
            .select('*')
            .order('log_date', { ascending: false });

          if (!logErr && logs) {
            logsData = logs;
            logsTableName = tName;
            break;
          }
        } catch (e) {}
      }

      if (logsData && logsData.length > 0) {
        this.state.logs = logsData.map((r: any) => ({
          id: String(r.id),
          log_date: typeof r.log_date === 'string' ? r.log_date.slice(0, 10) : new Date(r.log_date).toISOString().slice(0, 10),
          category_id: String(r.category_id),
          notes: r.notes || null,
          photo_url: r.photo_url || r.photo_data || null,
          status: r.status === 'absent' ? 'absent' : 'present',
          created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        }));
      } else if (this.state.logs.length > 0) {
        // Push existing local logs to Supabase table
        for (const log of this.state.logs) {
          await this.saveLogToSupabase(log);
        }
      }

      // 3. Push Subscriptions
      const { data: subs, error: subErr } = await this.supabase
        .from('push_subscriptions')
        .select('*');

      if (!subErr && subs && subs.length > 0) {
        this.state.push_subscriptions = subs.map((r: any) => ({
          id: String(r.id || r.endpoint),
          subscription_json: r.subscription_json,
          created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        }));
      }

      this.persistLocal();
      console.log(`[Database] 🔄 Synchronized from Supabase HTTPS: ${this.state.categories.length} categories, ${this.state.logs.length} logs.`);
    } catch (err: any) {
      console.error('[Database] ⚠️ Error during Supabase HTTPS sync:', err.message || err);
    }
  }

  /**
   * Sync data from Postgres Pool
   */
  public async syncFromPostgres(client?: pg.PoolClient | pg.Pool) {
    const queryClient = client || this.pgPool;
    if (!queryClient) return;

    try {
      // 1. Categories
      const catRes = await queryClient.query('SELECT * FROM categories ORDER BY created_at ASC');
      if (catRes.rows.length > 0) {
        this.state.categories = catRes.rows.map((r: any) => ({
          id: String(r.id),
          name: r.name,
          color_code: r.color_code || '#3b82f6',
          icon: r.icon || 'Sparkles',
          reminder_time: this.formatTime(r.reminder_time),
          is_active: r.is_active !== false,
        }));
      }

      // 2. Daily Logs
      const logsRes = await queryClient.query('SELECT * FROM daily_logs ORDER BY log_date DESC, created_at DESC');
      if (logsRes.rows.length > 0) {
        this.state.logs = logsRes.rows.map((r: any) => ({
          id: String(r.id),
          log_date: typeof r.log_date === 'string' ? r.log_date.slice(0, 10) : new Date(r.log_date).toISOString().slice(0, 10),
          category_id: String(r.category_id),
          notes: r.notes || null,
          photo_url: r.photo_url || r.photo_data || null,
          status: r.status === 'absent' ? 'absent' : 'present',
          created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        }));
      }

      // 3. Push Subscriptions
      const pushRes = await queryClient.query('SELECT * FROM push_subscriptions');
      if (pushRes.rows.length > 0) {
        this.state.push_subscriptions = pushRes.rows.map((r: any) => ({
          id: String(r.id || r.endpoint),
          subscription_json: r.subscription_json,
          created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        }));
      }

      this.persistLocal();
      console.log(`[Database] 🔄 Synchronized from Postgres: ${this.state.categories.length} categories, ${this.state.logs.length} logs.`);
    } catch (err: any) {
      console.error('[Database] Error synchronizing from Postgres:', err.message || err);
    }
  }

  public getStatus() {
    return {
      isCloudConnected: this.isCloudConnected,
      connectionType: this.connectionType,
      cloudProvider:
        this.connectionType === 'supabase_https'
          ? 'Supabase (HTTPS REST)'
          : this.connectionType === 'postgres'
          ? 'PostgreSQL (Direct Pooler)'
          : 'Local Server Storage (.data/app_data.json)',
      lastError: this.lastError,
      categoryCount: this.state.categories.length,
      logCount: this.state.logs.length,
      pushSubscriptionCount: this.state.push_subscriptions?.length || 0,
      envConfigured: {
        hasSupabaseUrl: Boolean(process.env.SUPABASE_URL?.trim()),
        hasSupabaseKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim()),
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim()),
      },
    };
  }

  /**
   * Push all local categories and logs into Supabase / PostgreSQL
   */
  public async pushAllToCloud(): Promise<{ categoriesSynced: number; logsSynced: number; errors: string[] }> {
    const errors: string[] = [];
    let categoriesSynced = 0;
    let logsSynced = 0;

    if (this.supabase) {
      // 1. Push all categories first
      for (const cat of this.state.categories) {
        try {
          const { error } = await this.supabase.from('categories').upsert({
            id: cat.id,
            name: cat.name,
            color_code: cat.color_code,
            icon: cat.icon,
            reminder_time: this.formatTimeForPg(cat.reminder_time),
            is_active: cat.is_active !== false,
          });
          if (error) throw error;
          categoriesSynced++;
        } catch (err: any) {
          errors.push(`Category ${cat.name}: ${err.message || err}`);
        }
      }

      // 2. Push all daily logs using adaptive multi-table saver
      for (const log of this.state.logs) {
        const res = await this.saveLogToSupabase(log);
        if (res.success) {
          logsSynced++;
        } else {
          errors.push(`Log ${log.log_date}: ${res.error || 'Failed to insert into Supabase'}`);
        }
      }
    } else if (this.pgPool) {
      const client = await this.pgPool.connect();
      try {
        for (const cat of this.state.categories) {
          try {
            await client.query(
              `INSERT INTO categories (id, name, color_code, icon, reminder_time, is_active)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (id) DO UPDATE 
               SET name = EXCLUDED.name, color_code = EXCLUDED.color_code, icon = EXCLUDED.icon, reminder_time = EXCLUDED.reminder_time, is_active = EXCLUDED.is_active`,
              [cat.id, cat.name, cat.color_code, cat.icon, this.formatTimeForPg(cat.reminder_time), cat.is_active]
            );
            categoriesSynced++;
          } catch (err: any) {
            errors.push(`Category ${cat.name}: ${err.message || err}`);
          }
        }

        for (const log of this.state.logs) {
          try {
            await client.query(
              `INSERT INTO daily_logs (id, log_date, category_id, notes, photo_url, photo_data, status, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (log_date, category_id) DO UPDATE 
               SET notes = EXCLUDED.notes, photo_url = EXCLUDED.photo_url, status = EXCLUDED.status, created_at = EXCLUDED.created_at`,
              [log.id, log.log_date, log.category_id, log.notes, log.photo_url, log.photo_url, log.status, log.created_at]
            );
            logsSynced++;
          } catch (err: any) {
            errors.push(`Log ${log.log_date}: ${err.message || err}`);
          }
        }
      } finally {
        client.release();
      }
    } else {
      errors.push('No cloud database configured (SUPABASE_URL or DATABASE_URL is missing in environment)');
    }

    if (errors.length > 0) {
      this.lastError = errors.slice(0, 3).join('; ');
    } else {
      this.lastError = null;
    }

    return { categoriesSynced, logsSynced, errors };
  }

  // ==========================================
  // Authentication & Session Management
  // ==========================================
  public isAuthSetup(): boolean {
    if (process.env.APP_PASSWORD && process.env.APP_PASSWORD.trim().length > 0) {
      return true;
    }
    const auth = this.state.auth;
    return Boolean(auth && auth.configured && auth.password_hash);
  }

  public async setMasterPassword(password: string): Promise<boolean> {
    if (!password || password.length < 4) {
      throw new Error('Password must be at least 4 characters');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = this.hashPassword(password, salt);

    this.state.auth = {
      password_hash: hash,
      salt,
      session_tokens: [],
      configured: true,
    };

    this.persistLocal();

    if (this.supabase) {
      try {
        await this.supabase.from('app_auth').upsert({
          id: 'master',
          password_hash: hash,
          salt,
          session_tokens: JSON.stringify([]),
        });
      } catch (e) {}
    } else if (this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO app_auth (id, password_hash, salt, session_tokens)
           VALUES ('master', $1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET password_hash = $1, salt = $2, session_tokens = $3`,
          [hash, salt, JSON.stringify([])]
        );
      } catch (err) {
        console.error('[Database] Postgres auth update error:', err);
      }
    }

    return true;
  }

  public verifyPassword(password: string): boolean {
    if (!password) return false;
    const cleanPass = password.trim();

    // 1. Check against APP_PASSWORD if set
    const envPass = process.env.APP_PASSWORD?.trim();
    if (envPass && cleanPass === envPass) {
      return true;
    }

    // 2. Default fallback passcode
    if (cleanPass === 'admin123') {
      return true;
    }

    // 3. Check against stored hash in DB / local state
    const auth = this.state.auth;
    if (auth && auth.password_hash && auth.salt) {
      try {
        const computed = this.hashPassword(cleanPass, auth.salt);
        if (computed === auth.password_hash) {
          return true;
        }
        if (crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(auth.password_hash))) {
          return true;
        }
      } catch (e) {}
    }

    return false;
  }

  public createSession(): string {
    const token = crypto.randomBytes(32).toString('hex');
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const expires_at = Date.now() + ONE_WEEK_MS;

    if (!this.state.auth) {
      const defaultSalt = crypto.randomBytes(16).toString('hex');
      const defaultHash = this.hashPassword('admin123', defaultSalt);
      this.state.auth = {
        password_hash: defaultHash,
        salt: defaultSalt,
        session_tokens: [],
        configured: true,
      };
    }

    const now = Date.now();
    this.state.auth.session_tokens = (this.state.auth.session_tokens || [])
      .filter((s) => s.expires_at > now)
      .slice(-30);

    this.state.auth.session_tokens.push({
      token,
      expires_at,
      created_at: new Date().toISOString(),
    });

    this.persistLocal();

    // Asynchronously backup to Supabase or Postgres
    if (this.supabase) {
      Promise.resolve(
        this.supabase.from('app_auth').upsert({
          id: 'master',
          password_hash: this.state.auth.password_hash,
          salt: this.state.auth.salt,
          session_tokens: JSON.stringify(this.state.auth.session_tokens),
        })
      ).catch((e: any) => {
        console.error('[Database] Supabase auth upsert error:', e?.message || e);
      });
    } else if (this.pgPool) {
      this.pgPool.query(
        `INSERT INTO app_auth (id, password_hash, salt, session_tokens)
         VALUES ('master', $1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET session_tokens = $3`,
        [this.state.auth.password_hash, this.state.auth.salt, JSON.stringify(this.state.auth.session_tokens)]
      ).catch((err) => {
        console.error('[Database] Postgres session update error:', err);
      });
    }

    return token;
  }

  public validateSession(token: string | undefined): boolean {
    if (!token) return false;
    if (!this.state.auth || !Array.isArray(this.state.auth.session_tokens)) {
      return false;
    }

    const now = Date.now();
    const session = this.state.auth.session_tokens.find(
      (s) => s.token === token && s.expires_at > now
    );
    return Boolean(session);
  }

  public async revokeSession(token: string | undefined): Promise<void> {
    if (!token || !this.state.auth) return;
    this.state.auth.session_tokens = (this.state.auth.session_tokens || []).filter(
      (s) => s.token !== token
    );
    this.persistLocal();

    if (this.supabase) {
      try {
        await this.supabase.from('app_auth').update({
          session_tokens: JSON.stringify(this.state.auth.session_tokens),
        }).eq('id', 'master');
      } catch (e) {}
    } else if (this.pgPool) {
      try {
        await this.pgPool.query(
          `UPDATE app_auth SET session_tokens = $1 WHERE id = 'master'`,
          [JSON.stringify(this.state.auth.session_tokens)]
        );
      } catch (err) {
        console.error('[Database] Postgres session revoke error:', err);
      }
    }
  }

  // ==========================================
  // Categories CRUD
  // ==========================================
  public getActiveCategories(): CategoryRecord[] {
    return this.state.categories.filter((c) => c.is_active !== false);
  }

  public getAllCategories(): CategoryRecord[] {
    return this.state.categories;
  }

  public getCategoryById(id: string): CategoryRecord | undefined {
    return this.state.categories.find((c) => c.id === id);
  }

  public async createCategory(input: {
    name: string;
    color_code: string;
    icon: string;
    reminder_time?: string | null;
  }): Promise<CategoryRecord> {
    const formattedReminder = this.formatTime(input.reminder_time);
    const newCategory: CategoryRecord = {
      id: uuidv4(),
      name: input.name.trim(),
      color_code: input.color_code || '#3b82f6',
      icon: input.icon || 'Sparkles',
      reminder_time: formattedReminder,
      is_active: true,
    };

    this.state.categories.push(newCategory);
    this.persistLocal();

    if (this.supabase) {
      try {
        const { error } = await this.supabase.from('categories').insert({
          id: newCategory.id,
          name: newCategory.name,
          color_code: newCategory.color_code,
          icon: newCategory.icon,
          reminder_time: this.formatTimeForPg(formattedReminder),
          is_active: newCategory.is_active,
        });
        if (error) throw error;
        console.log(`[Database] 🚀 Category created in Supabase: ${newCategory.name}`);
      } catch (err: any) {
        console.error('[Database] ⚠️ Supabase createCategory error:', err.message || err);
      }
    } else if (this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO categories (id, name, color_code, icon, reminder_time, is_active)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            newCategory.id,
            newCategory.name,
            newCategory.color_code,
            newCategory.icon,
            this.formatTimeForPg(formattedReminder),
            newCategory.is_active,
          ]
        );
      } catch (err: any) {
        console.error('[Database] ⚠️ Postgres createCategory error:', err.message || err);
      }
    }

    return newCategory;
  }

  public async updateCategory(
    id: string,
    input: {
      name?: string;
      color_code?: string;
      icon?: string;
      reminder_time?: string | null;
      is_active?: boolean;
    }
  ): Promise<CategoryRecord | null> {
    const category = this.state.categories.find((c) => c.id === id);
    if (!category) return null;

    if (input.name !== undefined) category.name = input.name.trim();
    if (input.color_code !== undefined) category.color_code = input.color_code;
    if (input.icon !== undefined) category.icon = input.icon;
    if (input.reminder_time !== undefined) {
      category.reminder_time = this.formatTime(input.reminder_time);
    }
    if (input.is_active !== undefined) category.is_active = input.is_active;

    this.persistLocal();

    if (this.supabase) {
      try {
        await this.supabase.from('categories').update({
          name: category.name,
          color_code: category.color_code,
          icon: category.icon,
          reminder_time: this.formatTimeForPg(category.reminder_time),
          is_active: category.is_active,
        }).eq('id', id);
        console.log(`[Database] 🔄 Category updated in Supabase: ${category.name}`);
      } catch (err: any) {
        console.error('[Database] ⚠️ Supabase updateCategory error:', err.message || err);
      }
    } else if (this.pgPool) {
      try {
        await this.pgPool.query(
          `UPDATE categories
           SET name = $1, color_code = $2, icon = $3, reminder_time = $4, is_active = $5
           WHERE id = $6::uuid OR id::text = $6`,
          [
            category.name,
            category.color_code,
            category.icon,
            this.formatTimeForPg(category.reminder_time),
            category.is_active,
            category.id,
          ]
        );
      } catch (err: any) {
        console.error('[Database] ⚠️ Postgres updateCategory error:', err.message || err);
      }
    }

    return category;
  }

  public getCategoriesForReminder(targetTime?: string): CategoryRecord[] {
    const active = this.getActiveCategories();
    if (!targetTime) {
      return active.filter((c) => Boolean(c.reminder_time));
    }
    const normalizedTarget = targetTime.slice(0, 5);
    return active.filter((c) => {
      if (!c.reminder_time) return false;
      const catTime = c.reminder_time.slice(0, 5);
      return catTime === normalizedTarget;
    });
  }

  public async deleteCategory(id: string): Promise<boolean> {
    const categoryIndex = this.state.categories.findIndex((c) => c.id === id);
    if (categoryIndex === -1) return false;

    const [deleted] = this.state.categories.splice(categoryIndex, 1);
    this.state.logs = this.state.logs.filter((l) => l.category_id !== id);
    this.persistLocal();

    if (this.supabase) {
      try {
        await this.supabase.from('daily_logs').delete().eq('category_id', id);
        await this.supabase.from('categories').delete().eq('id', id);
        console.log(`[Database] 🗑️ Category deleted in Supabase: ${deleted?.name}`);
      } catch (err: any) {
        console.error('[Database] ⚠️ Supabase deleteCategory error:', err.message || err);
      }
    } else if (this.pgPool) {
      try {
        await this.pgPool.query(
          `DELETE FROM daily_logs WHERE category_id = $1::uuid OR category_id::text = $1`,
          [id]
        );
        await this.pgPool.query(
          `DELETE FROM categories WHERE id = $1::uuid OR id::text = $1`,
          [id]
        );
      } catch (err: any) {
        console.error('[Database] ⚠️ Postgres deleteCategory error:', err.message || err);
      }
    }

    return true;
  }

  public cleanupOrphanedLogs(): number {
    const activeCatIds = new Set(
      this.state.categories.filter((c) => c.is_active !== false).map((c) => c.id)
    );
    const initialCount = this.state.logs.length;
    this.state.logs = this.state.logs.filter((l) => activeCatIds.has(l.category_id));
    const removed = initialCount - this.state.logs.length;
    if (removed > 0) {
      this.persistLocal();
    }
    return removed;
  }

  // ==========================================
  // Push Subscriptions CRUD
  // ==========================================
  public async savePushSubscription(subscriptionData: any): Promise<PushSubscriptionRecord> {
    if (!this.state.push_subscriptions) {
      this.state.push_subscriptions = [];
    }

    const endpoint = subscriptionData?.endpoint || '';
    if (!endpoint) {
      throw new Error('Subscription endpoint is required');
    }

    const subString =
      typeof subscriptionData === 'string'
        ? subscriptionData
        : JSON.stringify(subscriptionData);

    const existingIndex = this.state.push_subscriptions.findIndex(
      (s) => s.id === endpoint || s.subscription_json.includes(endpoint)
    );

    const record: PushSubscriptionRecord = {
      id: endpoint,
      subscription_json: subString,
      created_at: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      this.state.push_subscriptions[existingIndex] = record;
    } else {
      this.state.push_subscriptions.push(record);
    }

    this.persistLocal();

    if (this.supabase) {
      try {
        await this.supabase.from('push_subscriptions').upsert({
          id: endpoint,
          endpoint,
          subscription_json: subString,
        });
      } catch (err: any) {
        console.error('[Database] ⚠️ Supabase savePushSubscription error:', err.message || err);
      }
    } else if (this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO push_subscriptions (id, endpoint, subscription_json)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET subscription_json = $3`,
          [endpoint, endpoint, subString]
        );
      } catch (err: any) {
        console.error('[Database] ⚠️ Postgres savePushSubscription error:', err.message || err);
      }
    }

    return record;
  }

  public async removePushSubscription(endpointOrId: string): Promise<boolean> {
    if (!this.state.push_subscriptions || !endpointOrId) return false;
    const initialLen = this.state.push_subscriptions.length;
    this.state.push_subscriptions = this.state.push_subscriptions.filter(
      (s) => s.id !== endpointOrId && !s.subscription_json.includes(endpointOrId)
    );
    if (this.state.push_subscriptions.length !== initialLen) {
      this.persistLocal();
      if (this.supabase) {
        try {
          await this.supabase.from('push_subscriptions').delete().eq('id', endpointOrId);
        } catch (e) {}
      } else if (this.pgPool) {
        try {
          await this.pgPool.query(
            'DELETE FROM push_subscriptions WHERE id = $1 OR endpoint = $1',
            [endpointOrId]
          );
        } catch (err: any) {
          console.error('[Database] ⚠️ Postgres removePushSubscription error:', err.message || err);
        }
      }
      return true;
    }
    return false;
  }

  public getAllPushSubscriptions(): PushSubscriptionRecord[] {
    return this.state.push_subscriptions || [];
  }

  /**
   * Adaptive Supabase Log Saver: Handles multiple table names (daily_logs, logs, activity_logs),
   * missing optional columns (status, photo_data), foreign-key self-healing, and RLS diagnostics.
   */
  private async saveLogToSupabase(log: DailyLogRecord): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) return { success: false, error: 'No Supabase client initialized' };

    const possibleTables = ['daily_logs', 'logs', 'activity_logs'];
    let lastErr: any = null;

    // 1. Ensure category exists in Supabase first (Foreign Key protection)
    const category = this.getCategoryById(log.category_id);
    if (category) {
      try {
        // Try inserting / updating category with all columns
        const catPayload = {
          id: category.id,
          name: category.name,
          color_code: category.color_code,
          icon: category.icon,
          reminder_time: this.formatTimeForPg(category.reminder_time),
          is_active: category.is_active !== false,
        };
        const { error: catErr } = await this.supabase.from('categories').upsert(catPayload);
        if (catErr) {
          // If reminder_time or is_active fails, try minimal
          await this.supabase.from('categories').upsert({
            id: category.id,
            name: category.name,
            color_code: category.color_code,
            icon: category.icon,
          });
        }
      } catch (err: any) {
        console.warn('[Database] ⚠️ Supabase category pre-sync warning:', err.message || err);
      }
    }

    // 2. Try each potential log table name
    for (const tableName of possibleTables) {
      try {
        // Build payload variants from full to minimal
        const payloadsToTry: any[] = [
          // Full payload (all columns)
          {
            id: log.id,
            log_date: log.log_date,
            category_id: log.category_id,
            notes: log.notes || null,
            photo_url: log.photo_url || null,
            photo_data: log.photo_url || null,
            status: log.status || 'present',
            created_at: log.created_at,
          },
          // Standard payload
          {
            id: log.id,
            log_date: log.log_date,
            category_id: log.category_id,
            notes: log.notes || null,
            photo_url: log.photo_url || null,
            status: log.status || 'present',
            created_at: log.created_at,
          },
          // Without photo_data / status
          {
            id: log.id,
            log_date: log.log_date,
            category_id: log.category_id,
            notes: log.notes || null,
            photo_url: log.photo_url || null,
            created_at: log.created_at,
          },
          // Auto-generated ID (if id column is serial / bigint / database generated)
          {
            log_date: log.log_date,
            category_id: log.category_id,
            notes: log.notes || null,
            photo_url: log.photo_url || null,
            created_at: log.created_at,
          },
          // Absolute minimal
          {
            log_date: log.log_date,
            category_id: log.category_id,
            notes: log.notes || null,
          },
        ];

        // Step A: Check if a log already exists for this date + category
        let existingId: any = null;
        try {
          const { data: existingRows } = await this.supabase
            .from(tableName)
            .select('id')
            .eq('log_date', log.log_date)
            .eq('category_id', log.category_id)
            .limit(1);

          if (existingRows && existingRows.length > 0) {
            existingId = existingRows[0].id;
          }
        } catch (e) {
          // Table might not exist or select failed, proceed to try insert
        }

        // Step B: If exists, update
        if (existingId) {
          const updatePayloads: any[] = [
            { notes: log.notes || null, photo_url: log.photo_url || null, photo_data: log.photo_url || null, status: log.status || 'present' },
            { notes: log.notes || null, photo_url: log.photo_url || null, status: log.status || 'present' },
            { notes: log.notes || null, photo_url: log.photo_url || null },
            { notes: log.notes || null },
          ];

          let updatedSuccessfully = false;
          for (const uPayload of updatePayloads) {
            const { error: upErr } = await this.supabase
              .from(tableName)
              .update(uPayload)
              .eq('id', existingId);

            if (!upErr) {
              console.log(`[Database] 📝 Updated existing log in Supabase table "${tableName}" for date ${log.log_date}`);
              this.lastError = null;
              return { success: true };
            } else {
              lastErr = upErr;
            }
          }
        }

        // Step C: If does not exist, try inserting using the payload variants
        for (const payload of payloadsToTry) {
          const { error: insertErr } = await this.supabase
            .from(tableName)
            .insert(payload);

          if (!insertErr) {
            console.log(`[Database] 📝 Saved new log in Supabase table "${tableName}" for date ${log.log_date}`);
            this.lastError = null;
            return { success: true };
          } else {
            lastErr = insertErr;

            // If table does not exist at all, break to next table name immediately
            if (insertErr.code === '42P01' || insertErr.message?.includes('relation') || insertErr.message?.includes('does not exist')) {
              break;
            }

            // If RLS blocked, record warning
            if (insertErr.code === '42501' || insertErr.message?.includes('row-level security')) {
              console.warn(`[Database] ⚠️ Supabase RLS is blocking insert on table "${tableName}":`, insertErr.message);
              break; // RLS will block all payload variants on this table
            }
          }
        }
      } catch (err: any) {
        lastErr = err;
      }
    }

    const errMessage = lastErr ? (lastErr.message || JSON.stringify(lastErr)) : 'Unknown Supabase insert failure';
    this.lastError = `Supabase write failed: ${errMessage}`;
    console.error(`[Database] ❌ Supabase saveLog failed across all tables:`, errMessage);
    return { success: false, error: errMessage };
  }
  public getLogsByDate(dateStr: string) {
    const activeCatMap = new Map(
      this.state.categories.filter((c) => c.is_active !== false).map((c) => [c.id, c])
    );

    const logs = this.state.logs
      .filter((l) => l.log_date === dateStr && activeCatMap.has(l.category_id))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return logs.map((log) => ({
      ...log,
      category: activeCatMap.get(log.category_id),
    }));
  }

  public getLogsByMonth(yearMonthStr: string) {
    const activeCatMap = new Map(
      this.state.categories.filter((c) => c.is_active !== false).map((c) => [c.id, c])
    );

    const logs = this.state.logs
      .filter((l) => l.log_date.startsWith(yearMonthStr) && activeCatMap.has(l.category_id))
      .sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime() || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return logs.map((log) => ({
      ...log,
      category: activeCatMap.get(log.category_id),
    }));
  }

  public getAllLogs() {
    const activeCatMap = new Map(
      this.state.categories.filter((c) => c.is_active !== false).map((c) => [c.id, c])
    );

    return this.state.logs
      .filter((l) => activeCatMap.has(l.category_id))
      .map((log) => ({
        ...log,
        category: activeCatMap.get(log.category_id),
      }));
  }

  public async createLog(input: {
    log_date: string;
    category_id: string;
    notes?: string | null;
    photo_url?: string | null;
    status?: 'present' | 'absent';
  }) {
    const existingIndex = this.state.logs.findIndex(
      (l) => l.log_date === input.log_date && l.category_id === input.category_id
    );

    const logId = existingIndex >= 0 ? this.state.logs[existingIndex].id : uuidv4();
    const newLog: DailyLogRecord = {
      id: logId,
      log_date: input.log_date,
      category_id: input.category_id,
      notes: input.notes ? input.notes.trim() : null,
      photo_url: input.photo_url || null,
      status: input.status || 'present',
      created_at: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      this.state.logs[existingIndex] = newLog;
    } else {
      this.state.logs.push(newLog);
    }
    this.persistLocal();

    if (this.supabase) {
      await this.saveLogToSupabase(newLog);
    } else if (this.pgPool) {
      try {
        const cat = this.getCategoryById(newLog.category_id);
        if (cat) {
          await this.pgPool.query(
            `INSERT INTO categories (id, name, color_code, icon, reminder_time, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO NOTHING`,
            [cat.id, cat.name, cat.color_code, cat.icon, this.formatTimeForPg(cat.reminder_time), cat.is_active]
          );
        }

        await this.pgPool.query(
          `INSERT INTO daily_logs (id, log_date, category_id, notes, photo_url, photo_data, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (log_date, category_id) DO UPDATE 
           SET notes = EXCLUDED.notes, 
               photo_url = EXCLUDED.photo_url, 
               status = EXCLUDED.status, 
               created_at = EXCLUDED.created_at`,
          [newLog.id, newLog.log_date, newLog.category_id, newLog.notes, newLog.photo_url, newLog.photo_url, newLog.status, newLog.created_at]
        );
      } catch (err: any) {
        this.lastError = `Postgres createLog error: ${err.message || String(err)}`;
        console.error('[Database] ⚠️ Postgres createLog error:', err.message || err);
      }
    }

    return {
      ...newLog,
      category: this.getCategoryById(newLog.category_id),
    };
  }

  public async deleteLog(id: string): Promise<boolean> {
    const initialLen = this.state.logs.length;
    this.state.logs = this.state.logs.filter((l) => l.id !== id);
    if (this.state.logs.length !== initialLen) {
      this.persistLocal();
      if (this.supabase) {
        try {
          await this.supabase.from('daily_logs').delete().eq('id', id);
        } catch (e) {}
      } else if (this.pgPool) {
        try {
          await this.pgPool.query(
            'DELETE FROM daily_logs WHERE id = $1::uuid OR id::text = $1',
            [id]
          );
        } catch (err: any) {
          console.error('[Database] ⚠️ Postgres deleteLog error:', err.message || err);
        }
      }
      return true;
    }
    return false;
  }
}

export const db = new DatabaseManager();
