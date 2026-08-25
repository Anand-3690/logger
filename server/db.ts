import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

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

// SQL Schema definitions matching PostgreSQL & @vercel/postgres
export const POSTGRES_SCHEMA_SQL = `
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: Categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  color_code VARCHAR(50) NOT NULL,
  icon VARCHAR(50) NOT NULL,
  reminder_time TIME,
  is_active BOOLEAN DEFAULT true
);

-- Table 2: Daily Logs
CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  log_date DATE NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  notes TEXT,
  photo_url VARCHAR(1024),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 3: Auth State & Sessions
CREATE TABLE IF NOT EXISTS auth_state (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'master',
  password_hash VARCHAR(255) NOT NULL,
  salt VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 4: Push Subscriptions (Web Push)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id VARCHAR(255) PRIMARY KEY,
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
    color_code: '#3b82f6', // blue
    icon: 'Brain',
    reminder_time: '09:00',
    is_active: true,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Fitness',
    color_code: '#22c55e', // green
    icon: 'Dumbbell',
    reminder_time: '18:30',
    is_active: true,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Guru Prasangs & Texts',
    color_code: '#f97316', // orange
    icon: 'BookOpen',
    reminder_time: '20:00',
    is_active: true,
  },
];

function getInitialLogs(): DailyLogRecord[] {
  // Generate realistic initial logs for today and recent days around August 2026
  const todayStr = '2026-08-24';
  return [
    {
      id: uuidv4(),
      log_date: todayStr,
      category_id: '11111111-1111-1111-1111-111111111111', // Deep Work
      notes: 'Completed the core architecture and database query layer. 3 hours of uninterrupted focus.',
      photo_url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80',
      created_at: new Date('2026-08-24T09:30:00Z').toISOString(),
    },
    {
      id: uuidv4(),
      log_date: todayStr,
      category_id: '22222222-2222-2222-2222-222222222222', // Fitness
      notes: 'Morning 5km interval run and core stability workout. Felt energized!',
      photo_url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80',
      created_at: new Date('2026-08-24T07:15:00Z').toISOString(),
    },
    {
      id: uuidv4(),
      log_date: todayStr,
      category_id: '33333333-3333-3333-3333-333333333333', // Guru Prasangs & Texts
      notes: 'Read Vachanamrut Gadhada I-1 regarding controlling thoughts and daily reflection during contemplation.',
      photo_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
      created_at: new Date('2026-08-24T19:45:00Z').toISOString(),
    },
    {
      id: uuidv4(),
      log_date: '2026-08-23',
      category_id: '11111111-1111-1111-1111-111111111111',
      notes: 'Refactored state management hooks and optimized rendering pipeline.',
      photo_url: null,
      created_at: new Date('2026-08-23T14:20:00Z').toISOString(),
    },
    {
      id: uuidv4(),
      log_date: '2026-08-23',
      category_id: '22222222-2222-2222-2222-222222222222',
      notes: 'Upper body strength session: Pull-ups, bench press, and shoulder mobility routines.',
      photo_url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
      created_at: new Date('2026-08-23T17:45:00Z').toISOString(),
    },
    {
      id: uuidv4(),
      log_date: '2026-08-22',
      category_id: '33333333-3333-3333-3333-333333333333',
      notes: 'Evening reading from Swamini Vato on sincerity, humility, and maintaining positive perspective.',
      photo_url: null,
      created_at: new Date('2026-08-22T20:10:00Z').toISOString(),
    },
    {
      id: uuidv4(),
      log_date: '2026-08-21',
      category_id: '11111111-1111-1111-1111-111111111111',
      notes: 'Drafted technical specification document and API interface contracts.',
      photo_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80',
      created_at: new Date('2026-08-21T11:00:00Z').toISOString(),
    },
    {
      id: uuidv4(),
      log_date: '2026-08-20',
      category_id: '22222222-2222-2222-2222-222222222222',
      notes: 'Outdoor cycling: 22km along scenic route. Great cardio pacing.',
      photo_url: 'https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=800&q=80',
      created_at: new Date('2026-08-20T08:30:00Z').toISOString(),
    },
  ];
}

class DatabaseManager {
  private state: DatabaseState = {
    categories: [...DEFAULT_CATEGORIES],
    logs: [],
  };

  constructor() {
    this.init();
  }

  private hashPassword(password: string, salt: string): string {
    return crypto.createHmac('sha256', salt).update(password).digest('hex');
  }

  private init() {
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
          logs: getInitialLogs(),
          auth: {
            password_hash: defaultHash,
            salt: defaultSalt,
            session_tokens: [],
            configured: true,
          },
        };
        this.persist();
      }
    } catch (err) {
      console.error('Error initializing database file, using in-memory state:', err);
      const defaultSalt = crypto.randomBytes(16).toString('hex');
      const defaultHash = this.hashPassword('admin123', defaultSalt);
      this.state = {
        categories: DEFAULT_CATEGORIES,
        logs: getInitialLogs(),
        auth: {
          password_hash: defaultHash,
          salt: defaultSalt,
          session_tokens: [],
          configured: true,
        },
      };
    }
  }

  private persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist database state:', err);
    }
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

  public setMasterPassword(password: string): boolean {
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

    this.persist();
    return true;
  }

  public verifyPassword(password: string): boolean {
    const envPass = process.env.APP_PASSWORD;
    if (envPass && envPass.trim().length > 0) {
      return password === envPass.trim();
    }

    const auth = this.state.auth;
    if (!auth || !auth.password_hash || !auth.salt) {
      return false;
    }

    const computed = this.hashPassword(password, auth.salt);
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(auth.password_hash));
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

    this.persist();
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

  public revokeSession(token: string | undefined): void {
    if (!token || !this.state.auth) return;
    this.state.auth.session_tokens = (this.state.auth.session_tokens || []).filter(
      (s) => s.token !== token
    );
    this.persist();
  }

  // Categories CRUD
  public getActiveCategories(): CategoryRecord[] {
    return this.state.categories.filter((c) => c.is_active !== false);
  }

  public getAllCategories(): CategoryRecord[] {
    return this.state.categories;
  }

  public getCategoryById(id: string): CategoryRecord | undefined {
    return this.state.categories.find((c) => c.id === id);
  }

  public createCategory(input: {
    name: string;
    color_code: string;
    icon: string;
    reminder_time?: string | null;
  }): CategoryRecord {
    const newCategory: CategoryRecord = {
      id: uuidv4(),
      name: input.name.trim(),
      color_code: input.color_code || '#3b82f6',
      icon: input.icon || 'Sparkles',
      reminder_time: input.reminder_time ? input.reminder_time.trim() : null,
      is_active: true,
    };
    this.state.categories.push(newCategory);
    this.persist();
    return newCategory;
  }

  public updateCategory(
    id: string,
    input: {
      name?: string;
      color_code?: string;
      icon?: string;
      reminder_time?: string | null;
      is_active?: boolean;
    }
  ): CategoryRecord | null {
    const category = this.state.categories.find((c) => c.id === id);
    if (!category) return null;

    if (input.name !== undefined) category.name = input.name.trim();
    if (input.color_code !== undefined) category.color_code = input.color_code;
    if (input.icon !== undefined) category.icon = input.icon;
    if (input.reminder_time !== undefined) {
      category.reminder_time = input.reminder_time ? input.reminder_time.trim() : null;
    }
    if (input.is_active !== undefined) category.is_active = input.is_active;

    this.persist();
    return category;
  }

  public getCategoriesForReminder(targetTime?: string): CategoryRecord[] {
    const active = this.getActiveCategories();
    if (!targetTime) {
      return active.filter((c) => Boolean(c.reminder_time));
    }
    // targetTime format is "HH:MM"
    const normalizedTarget = targetTime.slice(0, 5);
    return active.filter((c) => {
      if (!c.reminder_time) return false;
      const catTime = c.reminder_time.slice(0, 5);
      return catTime === normalizedTarget;
    });
  }

  // Push Subscriptions CRUD
  public savePushSubscription(subscriptionData: any): PushSubscriptionRecord {
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

    this.persist();
    return record;
  }

  public removePushSubscription(endpointOrId: string): boolean {
    if (!this.state.push_subscriptions || !endpointOrId) return false;
    const initialLen = this.state.push_subscriptions.length;
    this.state.push_subscriptions = this.state.push_subscriptions.filter(
      (s) => s.id !== endpointOrId && !s.subscription_json.includes(endpointOrId)
    );
    if (this.state.push_subscriptions.length !== initialLen) {
      this.persist();
      return true;
    }
    return false;
  }

  public getAllPushSubscriptions(): PushSubscriptionRecord[] {
    return this.state.push_subscriptions || [];
  }

  public deleteCategory(id: string): boolean {
    const categoryIndex = this.state.categories.findIndex((c) => c.id === id);
    if (categoryIndex === -1) return false;

    // Remove the category
    this.state.categories.splice(categoryIndex, 1);

    // Remove all logs associated with this deleted category
    this.state.logs = this.state.logs.filter((l) => l.category_id !== id);

    this.persist();
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
      this.persist();
    }
    return removed;
  }

  // Daily Logs CRUD
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
    // yearMonthStr: YYYY-MM
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

  public createLog(input: {
    log_date: string;
    category_id: string;
    notes?: string | null;
    photo_url?: string | null;
    status?: 'present' | 'absent';
  }) {
    const newLog: DailyLogRecord = {
      id: uuidv4(),
      log_date: input.log_date,
      category_id: input.category_id,
      notes: input.notes ? input.notes.trim() : null,
      photo_url: input.photo_url || null,
      status: input.status || 'present',
      created_at: new Date().toISOString(),
    };

    this.state.logs.push(newLog);
    this.persist();

    return {
      ...newLog,
      category: this.getCategoryById(newLog.category_id),
    };
  }

  public deleteLog(id: string): boolean {
    const initialLen = this.state.logs.length;
    this.state.logs = this.state.logs.filter((l) => l.id !== id);
    if (this.state.logs.length !== initialLen) {
      this.persist();
      return true;
    }
    return false;
  }
}

export const db = new DatabaseManager();
