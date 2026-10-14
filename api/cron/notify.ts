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

function checkResolutionDue(res: any, dateStr: string): boolean {
  if (!res.is_active) return false;
  if (!dateStr || (res.start_date && dateStr < res.start_date)) return false;

  const parts = dateStr.split('T')[0].split('-').map(Number);
  if (parts.length < 3) return false;
  const [year, month, day] = parts;

  switch (res.interval_type) {
    case 'daily':
      return true;

    case 'weekly': {
      const d = new Date(year, month - 1, day);
      const dayOfWeek = d.getDay();
      return Array.isArray(res.days_of_week) && res.days_of_week.includes(dayOfWeek);
    }

    case 'monthly': {
      const targetDay = res.day_of_month ?? 1;
      return day === targetDay;
    }

    case 'yearly': {
      const targetMonth = res.month_of_year ?? 1;
      const targetDay = res.day_of_month ?? 1;
      return month === targetMonth && day === targetDay;
    }

    case 'custom': {
      const interval = res.custom_interval_days && res.custom_interval_days > 0 ? res.custom_interval_days : 1;
      const startParts = (res.start_date || dateStr).split('T')[0].split('-').map(Number);
      const startMs = new Date(startParts[0], startParts[1] - 1, startParts[2]).getTime();
      const currentMs = new Date(year, month - 1, day).getTime();
      const diffDays = Math.round((currentMs - startMs) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays % interval === 0;
    }

    default:
      return true;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const now = new Date();
    const utcHours = String(now.getUTCHours()).padStart(2, '0');
    const utcMinutes = String(now.getUTCMinutes()).padStart(2, '0');
    const utcTime = `${utcHours}:${utcMinutes}`;

    // Calculate IST time (UTC+5:30)
    const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const istHours = String(istDate.getUTCHours()).padStart(2, '0');
    const istMinutes = String(istDate.getUTCMinutes()).padStart(2, '0');
    const istTime = `${istHours}:${istMinutes}`;

    const isForce = req.query?.force === 'true' || req.body?.force === true;
    const requestedTime = req.query?.time || req.body?.time;
    const targetDateStr = `${istDate.getUTCFullYear()}-${String(istDate.getUTCMonth() + 1).padStart(2, '0')}-${String(istDate.getUTCDate()).padStart(2, '0')}`;

    // 1. Fetch push subscriptions first
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, subscription_json');

    if (subError) {
      return res.status(500).json({ error: subError.message });
    }

    const subsList = subscriptions || [];
    if (subsList.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active push subscriptions found in database.',
        utcTime,
        istTime,
        sent: 0,
      });
    }

    let totalSent = 0;

    // 2. Process Categories Reminders
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name, reminder_time, is_active')
      .eq('is_active', true);

    const matchedCategories = (categories || []).filter((cat) => {
      if (!cat.reminder_time) return false;
      if (isForce) return true;
      const cleanTime = cat.reminder_time.slice(0, 5);
      if (requestedTime) return cleanTime === requestedTime;
      return cleanTime === utcTime || cleanTime === istTime;
    });

    for (const cat of matchedCategories) {
      const payload = JSON.stringify({
        title: `Daily Check-in: ${cat.name}`,
        body: `Did you complete "${cat.name}" today? Tap to record instantly.`,
        icon: '/assets/icon-192.png',
        badge: '/assets/icon-192.png',
        tag: `reminder-${cat.id}`,
        data: {
          url: `/?category_id=${cat.id}`,
          category_id: cat.id,
          category_name: cat.name,
          log_date: targetDateStr,
        },
        actions: [
          { action: 'present', title: 'Present / Yes' },
          { action: 'absent', title: 'Absent / No' },
        ],
      });

      for (const sub of subsList) {
        try {
          const pushSub =
            typeof sub.subscription_json === 'string'
              ? JSON.parse(sub.subscription_json)
              : sub.subscription_json;

          await webpush.sendNotification(pushSub, payload, {
            TTL: 86400,
            urgency: 'high',
          });
          totalSent++;
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
        }
      }
    }

    // 3. Process Resolutions Reminders
    let matchedResolutionsCount = 0;
    try {
      const { data: resolutionsData } = await supabase
        .from('resolutions')
        .select('*')
        .eq('is_active', true);

      const activeResolutions = resolutionsData || [];
      const matchedResolutions = activeResolutions.filter((res) => {
        if (!checkResolutionDue(res, targetDateStr)) return false;
        if (isForce) return true;
        const cleanTime = (res.reminder_time || '08:00').slice(0, 5);
        if (requestedTime) return cleanTime === requestedTime;
        return cleanTime === utcTime || cleanTime === istTime;
      });

      matchedResolutionsCount = matchedResolutions.length;

      for (const resItem of matchedResolutions) {
        const payload = JSON.stringify({
          title: `🎯 Resolution: ${resItem.title}`,
          body: `Time for your resolution: "${resItem.title}". Did you accomplish it today?`,
          icon: '/assets/icon-192.png',
          badge: '/assets/icon-192.png',
          tag: `resolution-${resItem.id}-${targetDateStr}`,
          data: {
            url: '/resolutions',
            resolution_id: resItem.id,
            category_id: resItem.category_id,
            log_date: targetDateStr,
          },
          actions: [
            { action: 'present', title: 'Completed ✅' },
            { action: 'absent', title: 'Not Today' },
          ],
        });

        for (const sub of subsList) {
          try {
            const pushSub =
              typeof sub.subscription_json === 'string'
                ? JSON.parse(sub.subscription_json)
                : sub.subscription_json;

            await webpush.sendNotification(pushSub, payload, {
              TTL: 86400,
              urgency: 'high',
            });
            totalSent++;
          } catch (err: any) {
            if (err.statusCode === 404 || err.statusCode === 410) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            }
          }
        }
      }
    } catch (resErr) {
      console.warn('[Notify Cron] Resolutions evaluation note:', resErr);
    }

    // 4. Check Morning "On This Day" Retrospective (at 09:00 AM IST or forced)
    let onThisDayDispatched = false;
    const isOnThisDaySlot = istTime === '09:00' || (requestedTime && requestedTime === '09:00') || (isForce && req.query?.include_on_this_day === 'true');

    if (isOnThisDaySlot) {
      try {
        const targetMonth = istDate.getUTCMonth() + 1;
        const targetDay = istDate.getUTCDate();
        const targetYear = istDate.getUTCFullYear();

        const { data: catData } = await supabase
          .from('categories')
          .select('id, name, is_on_this_day');

        const eligibleCategories = (catData || []).filter(
          (c: any) => c.is_on_this_day === true || c.name === 'Guruhari Darshan'
        );

        if (eligibleCategories.length > 0) {
          const catIds = eligibleCategories.map((c) => c.id);
          const catMap = new Map<string, string>(eligibleCategories.map((c) => [c.id, c.name]));

          const { data: logs } = await supabase
            .from('daily_logs')
            .select('id, log_date, category_id')
            .in('category_id', catIds);

          const matchedLogs = (logs || []).filter((log: any) => {
            if (!log.log_date) return false;
            const cleanDate = String(log.log_date).split('T')[0];
            const parts = cleanDate.split('-');
            if (parts.length < 3) return false;
            const [y, m, d] = parts.map(Number);
            return m === targetMonth && d === targetDay && y !== targetYear;
          });

          if (matchedLogs.length > 0) {
            const uniqueCatNames = Array.from(
              new Set(
                matchedLogs
                  .map((l) => catMap.get(l.category_id))
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
                : `You have ${matchedLogs.length} memories across ${uniqueCatNames.slice(0, 3).join(', ')}. Tap to view.`;

            const otdPayload = JSON.stringify({
              title,
              body,
              icon: '/assets/icon-192.png',
              badge: '/assets/icon-192.png',
              tag: `on-this-day-${targetDateStr}`,
              data: { url: '/on-this-day', tag: `on-this-day-${targetDateStr}` },
              actions: [{ action: 'view', title: 'Open Memories' }],
            });

            for (const sub of subsList) {
              try {
                const pushSub =
                  typeof sub.subscription_json === 'string'
                    ? JSON.parse(sub.subscription_json)
                    : sub.subscription_json;

                await webpush.sendNotification(pushSub, otdPayload, {
                  TTL: 86400,
                  urgency: 'high',
                });
                totalSent++;
                onThisDayDispatched = true;
              } catch (err: any) {
                if (err.statusCode === 404 || err.statusCode === 410) {
                  await supabase.from('push_subscriptions').delete().eq('id', sub.id);
                }
              }
            }
          }
        }
      } catch (otdErr) {
        console.warn('[Notify Cron] On This Day dispatch note:', otdErr);
      }
    }

    return res.status(200).json({
      success: true,
      utcTime,
      istTime,
      targetDate: targetDateStr,
      matchedCategories: matchedCategories.length,
      matchedResolutions: matchedResolutionsCount,
      onThisDayDispatched,
      subscribersCount: subsList.length,
      sent: totalSent,
    });
  } catch (error: any) {
    console.error('[Cron Notify Error]:', error);
    return res.status(500).json({ error: error.message || 'Internal cron error' });
  }
}
