import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.VITE_SUPABASE_ANON_KEY as string)
);

export default async function handler(req: any, res: any) {
  try {
    const now = new Date();
    const currentServerTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 1. Fetch categories with scheduled reminders
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name, reminder_time')
      .eq('is_active', true)
      .not('reminder_time', 'is', null);

    if (catError) {
      console.warn('[Cron Status] Failed to query categories:', catError.message);
    }

    // 2. Fetch count of active subscriptions
    const { count, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true });

    if (subError) {
      console.warn('[Cron Status] Failed to count subscriptions:', subError.message);
    }

    return res.status(200).json({
      isRunning: true,
      currentServerTime,
      categoriesWithReminders: (categories || []).map((c) => ({
        id: c.id,
        name: c.name,
        reminder_time: c.reminder_time,
      })),
      activeSubscribersCount: count || 0,
    });
  } catch (error: any) {
    console.error('[Cron Status Error]:', error);
    const now = new Date();
    return res.status(200).json({
      isRunning: true,
      currentServerTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      categoriesWithReminders: [],
      activeSubscribersCount: 0,
    });
  }
}
