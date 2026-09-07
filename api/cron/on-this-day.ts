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
    
    // 1. Get Guruhari Darshan Category ID
    const { data: catData, error: catError } = await supabase
      .from('categories')
      .select('id')
      .eq('name', 'Guruhari Darshan')
      .single();

    if (catError || !catData) {
      return res.status(404).json({ message: 'Guruhari Darshan category not found' });
    }

    // 2. Execute PostgreSQL RPC to find historical matches
    const { data: pastLogs, error: rpcError } = await supabase.rpc('get_guruhari_on_this_day', {
      target_month: today.getMonth() + 1,
      target_day: today.getDate()
    });

    if (rpcError) {
      return res.status(500).json({ error: rpcError.message });
    }

    if (!pastLogs || pastLogs.length === 0) {
      return res.status(200).json({ success: true, message: 'No past entries found for today' });
    }

    // 3. Fetch Push Subscriptions natively from Supabase
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, subscription_json');

    if (subError) throw subError;

    // 4. Dispatch Notifications
    const payload = JSON.stringify({
      title: "Guruhari Darshan: On This Day",
      body: `You have ${pastLogs.length} memories from this day in history. Tap to read.`,
      icon: '/assets/icon-192.png',
      data: { url: '/on-this-day' } // Service worker handles this route
    });

    let sentCount = 0;
    for (const sub of subscriptions || []) {
      try {
        // Parse the stored JSON string
        const pushSub = typeof sub.subscription_json === 'string' 
            ? JSON.parse(sub.subscription_json) 
            : sub.subscription_json;

        await webpush.sendNotification(pushSub, payload);
        sentCount++;
      } catch (err: any) {
        // Clean up expired or revoked subscriptions
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }

    return res.status(200).json({ success: true, sent: sentCount });
  } catch (error: any) {
    console.error('Cron Error:', error);
    return res.status(500).json({ error: error.message });
  }
}