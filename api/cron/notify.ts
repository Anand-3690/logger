import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Configure Web Push with VAPID keys from environment
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@dailyaccomplishments.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Initialize Supabase Client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.VITE_SUPABASE_ANON_KEY as string)
);

export default async function handler(req: any, res: any) {
  try {
    const now = new Date();
    const utcHours = String(now.getUTCHours()).padStart(2, '0');
    const utcMinutes = String(now.getUTCMinutes()).padStart(2, '0');
    const utcTime = `${utcHours}:${utcMinutes}`;

    // Calculate IST time (UTC+5:30) as a common local fallback
    const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const istHours = String(istDate.getUTCHours()).padStart(2, '0');
    const istMinutes = String(istDate.getUTCMinutes()).padStart(2, '0');
    const istTime = `${istHours}:${istMinutes}`;

    const isForce = req.query?.force === 'true' || req.body?.force === true;
    const requestedTime = req.query?.time || req.body?.time;

    // 1. Fetch active categories
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name, reminder_time, is_active')
      .eq('is_active', true);

    if (catError) {
      return res.status(500).json({ error: catError.message });
    }

    // Filter categories that have reminders matching current time or if forced
    const matchedCategories = (categories || []).filter((cat) => {
      if (!cat.reminder_time) return false;
      if (isForce) return true;
      const cleanTime = cat.reminder_time.slice(0, 5);
      if (requestedTime) return cleanTime === requestedTime;
      return cleanTime === utcTime || cleanTime === istTime;
    });

    if (matchedCategories.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No scheduled categories matching current time slot.',
        utcTime,
        istTime,
        matchedCategories: 0,
        sent: 0,
      });
    }

    // 2. Fetch all registered push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, subscription_json');

    if (subError) {
      return res.status(500).json({ error: subError.message });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active push subscriptions found.',
        matchedCategories: matchedCategories.length,
        sent: 0,
      });
    }

    const todayStr = now.toISOString().split('T')[0];
    let totalSent = 0;

    // 3. Dispatch interactive notifications for each matched category
    for (const cat of matchedCategories) {
      const payload = JSON.stringify({
        title: `Daily Check-in: ${cat.name}`,
        body: `Did you complete "${cat.name}" today? Tap to record instantly.`,
        icon: '/assets/icon-192.png',
        badge: '/assets/icon-192.png',
        data: {
          url: `/?category_id=${cat.id}`,
          category_id: cat.id,
          category_name: cat.name,
          log_date: todayStr,
        },
        actions: [
          { action: 'present', title: 'Present / Yes' },
          { action: 'absent', title: 'Absent / No' },
        ],
      });

      for (const sub of subscriptions) {
        try {
          const pushSub =
            typeof sub.subscription_json === 'string'
              ? JSON.parse(sub.subscription_json)
              : sub.subscription_json;

          await webpush.sendNotification(pushSub, payload);
          totalSent++;
        } catch (err: any) {
          // Purge expired, unregistered, or revoked client endpoints
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      utcTime,
      matchedCategories: matchedCategories.length,
      sent: totalSent,
    });
  } catch (error: any) {
    console.error('[Cron Notify Error]:', error);
    return res.status(500).json({ error: error.message || 'Internal cron error' });
  }
}
