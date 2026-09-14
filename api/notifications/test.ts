import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@dailyaccomplishments.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.VITE_SUPABASE_ANON_KEY as string)
);

export default async function handler(req: any, res: any) {
  try {
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, subscription_json');

    if (subError) {
      return res.status(500).json({ error: subError.message });
    }

    const payload = JSON.stringify({
      title: '🚀 Interactive Test Check-in',
      body: 'Did you complete your daily spiritual routine today?',
      icon: '/assets/icon-192.png',
      badge: '/assets/icon-192.png',
      data: {
        url: '/',
        log_date: new Date().toISOString().split('T')[0],
      },
      actions: [
        { action: 'present', title: 'Present / Yes' },
        { action: 'absent', title: 'Absent / No' },
      ],
    });

    let sent = 0;
    for (const sub of subscriptions || []) {
      try {
        const pushSub =
          typeof sub.subscription_json === 'string'
            ? JSON.parse(sub.subscription_json)
            : sub.subscription_json;

        await webpush.sendNotification(pushSub, payload);
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
