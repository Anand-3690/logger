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
  } catch (e) {
    console.warn('[VAPID Setup Warning]:', e);
  }
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://fgvngijqikcxdrjvdzfi.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    'sb_publishable_xlhoYm36tJin5GtwYc7c-A_MLAoq2lN'
);

export default async function handler(req: any, res: any) {
  try {
    const testType = req.query?.type || req.body?.type || 'general';
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, subscription_json');

    if (subError) {
      return res.status(500).json({ error: subError.message });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    let payloadStr = '';

    if (testType === 'resolution') {
      const title = req.body?.title || req.query?.title || '🎯 Resolution: Morning Meditation & Dhyan';
      const body = req.body?.body || req.query?.body || 'Did you complete your daily resolution "Morning Meditation (15m)" today?';
      const resId = req.body?.resolution_id || req.query?.resolution_id;

      payloadStr = JSON.stringify({
        title,
        body,
        icon: '/assets/icon-192.png',
        badge: '/assets/icon-192.png',
        tag: `resolution-test-${todayStr}`,
        data: {
          url: '/resolutions',
          resolution_id: resId,
          log_date: todayStr,
        },
        actions: [
          { action: 'present', title: 'Completed ✅' },
          { action: 'absent', title: 'Not Today' },
        ],
      });
    } else if (testType === 'on-this-day') {
      const title = req.body?.title || req.query?.title || 'Guruhari Darshan: On This Day';
      const body = req.body?.body || req.query?.body || 'You have memorable entries from this day in previous years. Tap to read.';

      payloadStr = JSON.stringify({
        title,
        body,
        icon: '/assets/icon-192.png',
        badge: '/assets/icon-192.png',
        tag: `on-this-day-${todayStr}`,
        data: {
          url: '/on-this-day',
          tag: `on-this-day-${todayStr}`,
          log_date: todayStr,
        },
        actions: [
          { action: 'view', title: 'Open Memories' },
        ],
      });
    } else {
      payloadStr = JSON.stringify({
        title: '🚀 Interactive Test Check-in',
        body: 'Did you complete your daily spiritual routine today?',
        icon: '/assets/icon-192.png',
        badge: '/assets/icon-192.png',
        tag: 'test-checkin',
        data: {
          url: '/',
          log_date: todayStr,
        },
        actions: [
          { action: 'present', title: 'Present / Yes' },
          { action: 'absent', title: 'Absent / No' },
        ],
      });
    }

    let sent = 0;
    for (const sub of subscriptions || []) {
      try {
        const pushSub =
          typeof sub.subscription_json === 'string'
            ? JSON.parse(sub.subscription_json)
            : sub.subscription_json;

        await webpush.sendNotification(pushSub, payloadStr, {
          TTL: 86400,
          urgency: 'high',
        });
        sent++;
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Interactive test notification dispatched to ${sent} active device(s)! 🚀`,
      sent,
    });
  } catch (error: any) {
    console.error('[Notification Test Error]:', error);
    return res.status(500).json({ error: error.message || 'Failed to dispatch test notification' });
  }
}
