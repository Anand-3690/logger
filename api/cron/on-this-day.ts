import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Configure Web Push with your VAPID keys from .env
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@dailyaccomplishments.app',
  process.env.VAPID_PUBLIC_KEY as string,
  process.env.VAPID_PRIVATE_KEY as string
);

// Initialize Supabase Client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY as string
);

export default async function handler(req: any, res: any) {
  try {
    const today = new Date();
    const targetMonth = today.getMonth() + 1;
    const targetDay = today.getDate();
    const targetYear = today.getFullYear();

    // 1. Fetch eligible categories (is_on_this_day = true OR name = 'Guruhari Darshan')
    let eligibleCategories: Array<{ id: string; name: string }> = [];

    const { data: catData, error: catError } = await supabase
      .from('categories')
      .select('id, name, is_on_this_day');

    if (catError) {
      // Fallback if is_on_this_day column doesn't exist yet in remote schema
      const { data: fallbackCats, error: fbError } = await supabase
        .from('categories')
        .select('id, name');

      if (fbError) {
        return res.status(500).json({ error: fbError.message });
      }
      eligibleCategories = (fallbackCats || []).filter((c: any) => c.name === 'Guruhari Darshan');
    } else {
      eligibleCategories = (catData || []).filter(
        (c: any) => c.is_on_this_day === true || c.name === 'Guruhari Darshan'
      );
    }

    if (eligibleCategories.length === 0) {
      return res.status(200).json({ success: true, message: 'No categories configured for On This Day' });
    }

    const eligibleCategoryIds = eligibleCategories.map((c) => c.id);
    const categoryMap = new Map<string, string>(eligibleCategories.map((c) => [c.id, c.name]));

    // 2. Query historical matches for enabled categories
    let matchedLogs: Array<{ id: string; log_date: string; category_id: string }> = [];

    const { data: logs, error: logsError } = await supabase
      .from('daily_logs')
      .select('id, log_date, category_id')
      .in('category_id', eligibleCategoryIds);

    if (!logsError && logs && logs.length > 0) {
      matchedLogs = logs.filter((log: any) => {
        if (!log.log_date) return false;
        const parts = log.log_date.split('-');
        if (parts.length < 3) return false;
        const [y, m, d] = parts.map(Number);
        return m === targetMonth && d === targetDay && y !== targetYear;
      });
    }

    // Fallback to PostgreSQL RPC for Guruhari Darshan if direct query found nothing
    if (matchedLogs.length === 0 && eligibleCategories.some((c) => c.name === 'Guruhari Darshan')) {
      try {
        const { data: rpcLogs } = await supabase.rpc('get_guruhari_on_this_day', {
          target_month: targetMonth,
          target_day: targetDay,
        });
        if (rpcLogs && Array.isArray(rpcLogs) && rpcLogs.length > 0) {
          const guruhariCat = eligibleCategories.find((c) => c.name === 'Guruhari Darshan');
          matchedLogs = rpcLogs.map((l: any) => ({
            id: l.id,
            log_date: l.log_date,
            category_id: guruhariCat?.id || '',
          }));
        }
      } catch {
        // RPC is optional fallback
      }
    }

    if (matchedLogs.length === 0) {
      return res.status(200).json({ success: true, message: 'No past entries found for today in configured categories' });
    }

    // 3. Fetch Push Subscriptions natively from Supabase
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, subscription_json');

    if (subError) throw subError;

    // 4. Formulate Notification Details
    const uniqueCatNames = Array.from(
      new Set(
        matchedLogs
          .map((l) => categoryMap.get(l.category_id))
          .filter((name): name is string => Boolean(name))
      )
    );

    const title = uniqueCatNames.length === 1
      ? `${uniqueCatNames[0]}: On This Day`
      : 'On This Day: Memories Found';

    const body = uniqueCatNames.length === 1
      ? `You have ${matchedLogs.length} memories from this day in history. Tap to read.`
      : `You have ${matchedLogs.length} memories across ${uniqueCatNames.slice(0, 3).join(', ')}${uniqueCatNames.length > 3 ? ' and more' : ''}. Tap to view.`;

    const payload = JSON.stringify({
      title,
      body,
      icon: '/assets/icon-192.png',
      data: { url: '/on-this-day' },
    });

    let sentCount = 0;
    for (const sub of subscriptions || []) {
      try {
        const pushSub = typeof sub.subscription_json === 'string'
          ? JSON.parse(sub.subscription_json)
          : sub.subscription_json;

        await webpush.sendNotification(pushSub, payload);
        sentCount++;
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }

    return res.status(200).json({
      success: true,
      sent: sentCount,
      memoriesCount: matchedLogs.length,
      categories: uniqueCatNames,
    });
  } catch (error: any) {
    console.error('Cron Error:', error);
    return res.status(500).json({ error: error.message });
  }
}