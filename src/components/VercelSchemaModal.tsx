import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Database, Layers, CloudUpload, Bell, Terminal, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface VercelSchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DbStatus {
  isCloudConnected: boolean;
  connectionType: string;
  cloudProvider: string;
  lastError: string | null;
  categoryCount: number;
  logCount: number;
  pushSubscriptionCount: number;
  envConfigured?: {
    hasSupabaseUrl: boolean;
    hasSupabaseKey: boolean;
    hasDatabaseUrl: boolean;
  };
}

export const VercelSchemaModal: React.FC<VercelSchemaModalProps> = ({ isOpen, onClose }) => {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sql' | 'supabase_sql' | 'cron' | 'service_worker' | 'vercel_json'>('supabase_sql');
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const fetchStatus = () => {
    fetch('/api/db/status')
      .then((res) => res.json())
      .then((data) => setDbStatus(data))
      .catch((err) => console.error('Failed to fetch DB status', err));
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  const handlePushToCloud = async () => {
    try {
      setIsPushing(true);
      setSyncMessage(null);
      const res = await fetch('/api/db/sync-push', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncMessage({
          type: 'success',
          text: `Pushed successfully to Supabase! (${data.categoriesSynced} categories, ${data.logsSynced} logs)`,
        });
        fetchStatus();
      } else {
        setSyncMessage({
          type: 'error',
          text: `Push notice: ${data.errors?.join('; ') || data.error || 'Check database connection'}`,
        });
      }
    } catch (err: any) {
      setSyncMessage({
        type: 'error',
        text: `Push error: ${err.message || String(err)}`,
      });
    } finally {
      setIsPushing(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  const handleSyncPull = async () => {
    try {
      setIsSyncing(true);
      setSyncMessage(null);
      const res = await fetch('/api/db/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setDbStatus(data);
        setSyncMessage({
          type: 'success',
          text: `Pulled from Cloud: ${data.categoryCount} categories, ${data.logCount} logs active.`,
        });
      } else {
        setSyncMessage({
          type: 'error',
          text: `Pull failed: ${data.error || 'Could not reach cloud database'}`,
        });
      }
    } catch (err: any) {
      setSyncMessage({
        type: 'error',
        text: `Sync error: ${err.message || String(err)}`,
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  if (!isOpen) return null;

  const supabaseSqlCode = `-- ===================================================
-- SUPABASE / POSTGRESQL PRODUCTION SCHEMA
-- Paste into Supabase SQL Editor and click RUN
-- ===================================================

-- 1. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color_code TEXT NOT NULL DEFAULT '#3b82f6',
  icon TEXT NOT NULL DEFAULT 'Brain',
  reminder_time TIME WITHOUT TIME ZONE DEFAULT '20:00:00',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Daily Logs Table
CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date DATE NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  notes TEXT,
  status TEXT DEFAULT 'present',
  photo_url TEXT,
  photo_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(log_date, category_id)
);

-- 3. Web Push Subscriptions Table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT,
  subscription_json TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_category ON daily_logs(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);

-- Enable Row Level Security (RLS) & Grant Access to Anon and Authenticated Roles
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to categories" ON categories;
CREATE POLICY "Allow all access to categories" ON categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to daily_logs" ON daily_logs;
CREATE POLICY "Allow all access to daily_logs" ON daily_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to push_subscriptions" ON push_subscriptions;
CREATE POLICY "Allow all access to push_subscriptions" ON push_subscriptions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);`;

  const sqlCode = supabaseSqlCode;

  const cronRouteCode = `// app/api/cron/notify/route.ts
// Triggered every minute by Vercel Cron Jobs
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@dailyaccomplishments.app',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function GET(request: Request) {
  try {
    // 1. Get current time in HH:MM format
    const now = new Date();
    const currentTime = \`\${String(now.getHours()).padStart(2, '0')}:\${String(now.getMinutes()).padStart(2, '0')}\`;

    // 2. Query categories scheduled for right now
    const { rows: categories } = await sql\`
      SELECT id, name, reminder_time 
      FROM categories 
      WHERE is_active = true 
        AND reminder_time::text LIKE \${currentTime + '%'}
    \`;

    // 3. Fetch all active push subscriptions
    const { rows: subscriptions } = await sql\`
      SELECT id, subscription_json 
      FROM push_subscriptions;
    \`;

    let totalSent = 0;
    for (const cat of categories) {
      const payload = JSON.stringify({
        title: \`Daily Check-in: \${cat.name}\`,
        body: \`Did you complete "\${cat.name}" today? Tap to record instantly.\`,
        icon: '/assets/icon-192.png',
        data: { category_id: cat.id, category_name: cat.name, log_date: now.toISOString().split('T')[0] },
        actions: [
          { action: 'present', title: 'Present / Yes' },
          { action: 'absent', title: 'Absent / No' }
        ]
      });

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(sub.subscription_json, payload);
          totalSent++;
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await sql\`DELETE FROM push_subscriptions WHERE id = \${sub.id}\`;
          }
        }
      }
    }

    return NextResponse.json({ success: true, currentTime, matchedCategories: categories.length, sent: totalSent });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}`;

  const serviceWorkerCode = `// public/sw.js
// PWA Service Worker with Interactive Action Buttons

self.addEventListener('push', (event) => {
  let data = event.data ? event.data.json() : { title: 'Daily Check-in', body: 'Log your progress today!' };
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/assets/icon-192.png',
      actions: [
        { action: 'present', title: 'Present / Yes' },
        { action: 'absent', title: 'Absent / No' }
      ],
      data: data.data
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  notification.close();

  if (action === 'present') {
    // Instantly log Present / Yes in the background
    event.waitUntil(
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_date: data.log_date || new Date().toISOString().split('T')[0],
          category_id: data.category_id,
          notes: 'Recorded via Push Notification (Present / Yes)'
        })
      })
    );
  } else if (action === 'absent') {
    // Record Absent / No response
    event.waitUntil(
      fetch('/api/notifications/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'absent', category_id: data.category_id, log_date: data.log_date })
      })
    );
  } else {
    // Clicked notification body: Open app
    event.waitUntil(self.clients.openWindow('/dashboard'));
  }
});`;

  const vercelJsonCode = `{
  "crons": [
    {
      "path": "/api/cron/notify",
      "schedule": "* * * * *"
    }
  ]
}`;

  const handleCopy = (text: string, tabName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabName);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const getActiveCode = () => {
    switch (activeTab) {
      case 'supabase_sql':
      case 'sql':
        return supabaseSqlCode;
      case 'cron':
        return cronRouteCode;
      case 'service_worker':
        return serviceWorkerCode;
      case 'vercel_json':
        return vercelJsonCode;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-md transition-opacity animate-in fade-in duration-200">
      <div
        id="modal-vercel-schema"
        className="glass-dark text-white rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs ring-1 ring-white/20">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white leading-tight">
                  Database & Supabase Sync
                </h3>
                {dbStatus?.isCloudConnected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> {dbStatus.cloudProvider}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <AlertCircle className="w-3 h-3" /> Local Server Storage (.data/app_data.json)
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 font-medium mt-0.5">
                {dbStatus?.categoryCount ?? 0} active categories · {dbStatus?.logCount ?? 0} activity logs stored
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sync Controls Banner */}
        <div className="px-5 py-3 bg-neutral-900/90 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-neutral-300">
            {dbStatus?.isCloudConnected ? (
              <span className="text-emerald-400 font-medium">✓ Remote Supabase synchronization is active for new logs and updates.</span>
            ) : (
              <span className="text-amber-300 font-medium">
                Storage: Logs are persisting in the local server state. Set <code className="bg-black/40 px-1 py-0.5 rounded text-amber-200">SUPABASE_URL</code> in environment to sync to cloud.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePushToCloud}
              disabled={isPushing || isSyncing}
              title="Push all local categories and logs into Supabase tables"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              <CloudUpload className={`w-3.5 h-3.5 ${isPushing ? 'animate-bounce' : ''}`} />
              <span>{isPushing ? 'Pushing Data...' : 'Push Local Data to Supabase'}</span>
            </button>
            <button
              onClick={handleSyncPull}
              disabled={isSyncing || isPushing}
              title="Pull latest data from Supabase/Postgres"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium border border-neutral-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
              <span>{isSyncing ? 'Pulling...' : 'Pull from Cloud'}</span>
            </button>
          </div>
        </div>

        {syncMessage && (
          <div className={`px-5 py-2.5 border-b text-xs font-medium flex items-center gap-2 ${
            syncMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
              : 'bg-red-950/40 border-red-800/40 text-red-300'
          }`}>
            {syncMessage.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            )}
            <span>{syncMessage.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-800 px-5 pt-2 bg-neutral-950/30 gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('supabase_sql')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'supabase_sql'
                ? 'text-blue-400 border-blue-500 bg-neutral-800/60'
                : 'text-neutral-400 border-transparent hover:text-neutral-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Supabase / Postgres SQL Schema</span>
          </button>
          <button
            onClick={() => setActiveTab('cron')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'cron'
                ? 'text-blue-400 border-blue-500 bg-neutral-800/60'
                : 'text-neutral-400 border-transparent hover:text-neutral-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Cron API Route (/api/cron/notify)</span>
          </button>
          <button
            onClick={() => setActiveTab('service_worker')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'service_worker'
                ? 'text-blue-400 border-blue-500 bg-neutral-800/60'
                : 'text-neutral-400 border-transparent hover:text-neutral-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Service Worker (sw.js)</span>
          </button>
          <button
            onClick={() => setActiveTab('vercel_json')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'vercel_json'
                ? 'text-blue-400 border-blue-500 bg-neutral-800/60'
                : 'text-neutral-400 border-transparent hover:text-neutral-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>vercel.json Crons</span>
          </button>
        </div>

        {/* Code View Body */}
        <div className="relative flex-1 overflow-y-auto p-5 bg-neutral-950/70 font-mono text-xs text-neutral-300">
          <button
            onClick={() => handleCopy(getActiveCode(), activeTab)}
            className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 shadow-md transition-colors"
          >
            {copiedTab === activeTab ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>

          <pre className="overflow-x-auto leading-relaxed selection:bg-blue-600 selection:text-white">
            <code>{getActiveCode()}</code>
          </pre>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 flex items-center justify-between bg-neutral-950/50">
          <div className="text-[11px] text-neutral-400 flex items-center gap-1.5">
            <CloudUpload className="w-3.5 h-3.5 text-blue-400" />
            <span>Vercel Cron + Web Push Ready</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
