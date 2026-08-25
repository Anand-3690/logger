import React, { useState } from 'react';
import { X, Copy, Check, Database, Layers, CloudUpload, Bell, Terminal } from 'lucide-react';

interface VercelSchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VercelSchemaModal: React.FC<VercelSchemaModalProps> = ({ isOpen, onClose }) => {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sql' | 'cron' | 'service_worker' | 'vercel_json'>('sql');

  if (!isOpen) return null;

  const sqlCode = `-- ===================================================
-- POSTGRESQL SCHEMA (@vercel/postgres)
-- Upgraded with reminder_time & push_subscriptions
-- ===================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: Categories (with reminder_time TIME)
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

-- Table 3: Web Push Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_category ON daily_logs(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_reminder_time ON categories(reminder_time);

-- Seed Initial Categories
INSERT INTO categories (id, name, color_code, icon, reminder_time, is_active)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Deep Work', '#3b82f6', 'Brain', '09:00:00', true),
  ('22222222-2222-2222-2222-222222222222', 'Fitness', '#22c55e', 'Dumbbell', '18:30:00', true),
  ('33333333-3333-3333-3333-333333333333', 'Guru Prasangs & Texts', '#f97316', 'BookOpen', '20:30:00', true)
ON CONFLICT (id) DO NOTHING;`;

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
      case 'sql':
        return sqlCode;
      case 'cron':
        return cronRouteCode;
      case 'service_worker':
        return serviceWorkerCode;
      case 'vercel_json':
        return vercelJsonCode;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-900/60 backdrop-blur-xs transition-opacity">
      <div
        id="modal-vercel-schema"
        className="bg-neutral-900 text-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-neutral-800 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                Vercel Postgres & PWA Push Architecture
              </h3>
              <p className="text-xs text-neutral-400 font-medium">
                SQL schema, Cron Job endpoint, and Service Worker specifications
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-800 px-5 pt-2 bg-neutral-950/30 gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'sql'
                ? 'text-blue-400 border-blue-500 bg-neutral-800/60'
                : 'text-neutral-400 border-transparent hover:text-neutral-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>PostgreSQL Schema (@vercel/postgres)</span>
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
