import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://fgvngijqikcxdrjvdzfi.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    'sb_publishable_xlhoYm36tJin5GtwYc7c-A_MLAoq2lN'
);

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const now = new Date();
    // Calculate IST time (UTC+5:30)
    const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const currentServerTime = `${String(istDate.getUTCHours()).padStart(2, '0')}:${String(
      istDate.getUTCMinutes()
    ).padStart(2, '0')}`;

    const targetMonth = istDate.getUTCMonth() + 1;
    const targetDay = istDate.getUTCDate();
    const targetYear = istDate.getUTCFullYear();

    // 1. Fetch categories
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name, reminder_time, is_on_this_day, is_active')
      .eq('is_active', true);

    if (catError) {
      console.warn('[Cron Status] Failed to query categories:', catError.message);
    }

    const catsWithReminders = (categories || []).filter((c) => Boolean(c.reminder_time));
    const onThisDayCategories = (categories || []).filter(
      (c) => c.is_on_this_day === true || c.name === 'Guruhari Darshan'
    );
    const onThisDayCatIds = onThisDayCategories.map((c) => c.id);

    // 2. Fetch count of active subscriptions
    const { count, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true });

    if (subError) {
      console.warn('[Cron Status] Failed to count subscriptions:', subError.message);
    }

    // 3. Count today's memories
    let todayMemoriesCount = 0;
    if (onThisDayCatIds.length > 0) {
      const { data: logs } = await supabase
        .from('daily_logs')
        .select('id, log_date, category_id')
        .in('category_id', onThisDayCatIds);

      if (logs) {
        todayMemoriesCount = logs.filter((log: any) => {
          if (!log.log_date) return false;
          const cleanDate = String(log.log_date).split('T')[0];
          const parts = cleanDate.split('-');
          if (parts.length < 3) return false;
          const [y, m, d] = parts.map(Number);
          return m === targetMonth && d === targetDay && y !== targetYear;
        }).length;
      }
    }

    return res.status(200).json({
      isRunning: true,
      currentServerTime,
      categoriesWithReminders: catsWithReminders.map((c) => ({
        id: c.id,
        name: c.name,
        reminder_time: c.reminder_time,
      })),
      onThisDayCategories: onThisDayCategories.map((c) => ({
        id: c.id,
        name: c.name,
      })),
      todayMemoriesCount,
      activeSubscribersCount: count || 0,
    });
  } catch (error: any) {
    console.error('[Cron Status Error]:', error);
    const now = new Date();
    return res.status(200).json({
      isRunning: true,
      currentServerTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      categoriesWithReminders: [],
      onThisDayCategories: [],
      todayMemoriesCount: 0,
      activeSubscribersCount: 0,
    });
  }
}
