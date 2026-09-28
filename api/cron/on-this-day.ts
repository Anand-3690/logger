import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const DEFAULT_VAPID_PUBLIC_KEY =
  'BBM7QfZtYfyBHqQHjROalKr64BPK8VOajfsNEkI9dPkdYpnDoq5gfnOIVHnrrX5C_dJoBXENqsH7eFyY0iFpRdU';
const DEFAULT_VAPID_PRIVATE_KEY =
  '3lKgFmaU5leTosE5cEya4DMEBgFoF35twqIcDBegvRM';

const vapidPublic =
  process.env.VAPID_PUBLIC_KEY ||
  process.env.VITE_VAPID_PUBLIC_KEY ||
  DEFAULT_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY;
const vapidSubject =
  process.env.VAPID_SUBJECT || 'mailto:admin@dailyaccomplishments.app';

if (vapidPublic && vapidPrivate) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  } catch (err) {
    console.warn('[VAPID Setup Warning]:', err);
  }
}

// Initialize Supabase Client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://fgvngijqikcxdrjvdzfi.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    'sb_publishable_xlhoYm36tJin5GtwYc7c-A_MLAoq2lN'
);

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. Determine target date (supports ?date=YYYY-MM-DD or defaults to local IST date)
    let targetYear: number;
    let targetMonth: number;
    let targetDay: number;

    const requestedDate = req.query?.date || req.body?.date;
    if (requestedDate && typeof requestedDate === 'string' && requestedDate.includes('-')) {
      const parts = requestedDate.split('T')[0].split('-').map(Number);
      targetYear = parts[0];
      targetMonth = parts[1];
      targetDay = parts[2];
    } else {
      // Calculate IST time (UTC+5:30)
      const now = new Date();
      const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
      targetYear = istDate.getUTCFullYear();
      targetMonth = istDate.getUTCMonth() + 1;
      targetDay = istDate.getUTCDate();
    }

    const formattedTarget = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

    // 2. Fetch eligible categories (is_on_this_day = true OR name = 'Guruhari Darshan')
    let eligibleCategories: Array<{ id: string; name: string }> = [];

    const { data: catData, error: catError } = await supabase
      .from('categories')
      .select('id, name, is_on_this_day');

    if (catError) {
      console.warn('[On This Day Cron] Categories query fallback:', catError.message);
      const { data: fallbackCats } = await supabase
        .from('categories')
        .select('id, name');

      eligibleCategories = (fallbackCats || []).filter(
        (c: any) => c.name === 'Guruhari Darshan'
      );
    } else {
      eligibleCategories = (catData || []).filter(
        (c: any) => c.is_on_this_day === true || c.name === 'Guruhari Darshan'
      );
    }

    if (eligibleCategories.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No categories configured for On This Day',
        targetDate: formattedTarget,
        sent: 0,
      });
    }

    const eligibleCategoryIds = eligibleCategories.map((c) => c.id);
    const categoryMap = new Map<string, string>(eligibleCategories.map((c) => [c.id, c.name]));

    // 3. Query historical matches for enabled categories
    let matchedLogs: Array<{ id: string; log_date: string; category_id: string; notes?: string }> = [];

    const { data: logs, error: logsError } = await supabase
      .from('daily_logs')
      .select('id, log_date, category_id, notes')
      .in('category_id', eligibleCategoryIds);

    if (!logsError && logs && logs.length > 0) {
      matchedLogs = logs.filter((log: any) => {
        if (!log.log_date) return false;
        const cleanDate = String(log.log_date).split('T')[0];
        const parts = cleanDate.split('-');
        if (parts.length < 3) return false;
        const [y, m, d] = parts.map(Number);
        return m === targetMonth && d === targetDay && y !== targetYear;
      });
    }

    if (matchedLogs.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No past entries found for today in configured categories',
        targetDate: formattedTarget,
        eligibleCategories: eligibleCategories.map((c) => c.name),
        sent: 0,
      });
    }

    // 4. Fetch Push Subscriptions natively from Supabase
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, subscription_json');

    if (subError) {
      console.warn('[On This Day Cron] Subscriptions query warning:', subError.message);
    }

    // 5. Formulate Notification Details
    const uniqueCatNames = Array.from(
      new Set(
        matchedLogs
          .map((l) => categoryMap.get(l.category_id))
          .filter((name): name is string => Boolean(name))
      )
    );

    const title =
      uniqueCatNames.length === 1
        ? `${uniqueCatNames[0]}: On This Day`
        : 'On This Day: Memories Found';

    const body =
      uniqueCatNames.length === 1
        ? `You have ${matchedLogs.length} memories from this day in history. Tap to read.`
        : `You have ${matchedLogs.length} memories across ${uniqueCatNames.slice(0, 3).join(', ')}${
            uniqueCatNames.length > 3 ? ' and more' : ''
          }. Tap to view.`;

    const payload = JSON.stringify({
      title,
      body,
      icon: '/assets/icon-192.png',
      badge: '/assets/icon-192.png',
      data: { url: '/on-this-day' },
      actions: [{ action: 'view', title: 'Open Memories' }],
    });

    let sentCount = 0;
    const subsList = subscriptions || [];

    for (const sub of subsList) {
      try {
        const pushSub =
          typeof sub.subscription_json === 'string'
            ? JSON.parse(sub.subscription_json)
            : sub.subscription_json;

        await webpush.sendNotification(pushSub, payload);
        sentCount++;
      } catch (err: any) {
        console.warn('[Push Notification Error]:', err.statusCode || err.message);
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }

    return res.status(200).json({
      success: true,
      targetDate: formattedTarget,
      memoriesCount: matchedLogs.length,
      categories: uniqueCatNames,
      subscribersCount: subsList.length,
      sent: sentCount,
      title,
      body,
    });
  } catch (error: any) {
    console.error('[On This Day Cron Error]:', error);
    return res.status(500).json({ error: error.message || 'Cron error' });
  }
}