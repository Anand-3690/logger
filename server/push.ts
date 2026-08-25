import webpush from 'web-push';
import { db, CategoryRecord } from './db.js';

// Default / fallback keys in case environment variables are not yet defined
// This ensures notifications work seamlessly in preview/dev environments
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
let vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@dailyaccomplishments.app';

if (!vapidPublicKey || !vapidPrivateKey) {
  // Generate a keypair for seamless runtime functionality if not set
  try {
    const generated = webpush.generateVAPIDKeys();
    vapidPublicKey = vapidPublicKey || generated.publicKey;
    vapidPrivateKey = vapidPrivateKey || generated.privateKey;
    console.log('[WebPush] Auto-generated fallback VAPID keypair for session:', vapidPublicKey.substring(0, 16) + '...');
  } catch (err) {
    console.warn('[WebPush] Failed to generate VAPID keys automatically:', err);
  }
}

try {
  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    console.log('[WebPush] VAPID details initialized successfully');
  }
} catch (e) {
  console.warn('[WebPush] Warning configuring VAPID details:', e);
}

export function getVapidPublicKey(): string {
  return vapidPublicKey || '';
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    category_id?: string;
    category_name?: string;
    log_date?: string;
    url?: string;
    timestamp?: number;
  };
  actions?: {
    action: string;
    title: string;
    icon?: string;
  }[];
}

/**
 * Send push notification to all active subscribers
 */
export async function broadcastPushNotification(payload: PushPayload): Promise<{
  total: number;
  sent: number;
  failed: number;
}> {
  const subscriptions = db.getAllPushSubscriptions();
  if (subscriptions.length === 0) {
    return { total: 0, sent: 0, failed: 0 };
  }

  const payloadString = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;

  for (const subRecord of subscriptions) {
    try {
      const subObj = JSON.parse(subRecord.subscription_json);
      await webpush.sendNotification(subObj, payloadString, {
        TTL: 86400, // 24 hours
        urgency: 'high',
      });
      sent++;
    } catch (err: any) {
      console.warn(`[WebPush] Failed to send push to ${subRecord.id}:`, err?.statusCode || err?.message);
      failed++;
      // If subscription has expired or is gone (HTTP 404 or 410 Gone), automatically clean it up
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        db.removePushSubscription(subRecord.id);
        console.log(`[WebPush] Removed expired subscription ${subRecord.id}`);
      }
    }
  }

  return {
    total: subscriptions.length,
    sent,
    failed,
  };
}

/**
 * Build reminder notification payload for a specific category
 */
export function createCategoryReminderPayload(category: CategoryRecord, targetDate?: string): PushPayload {
  const todayStr = targetDate || new Date().toISOString().split('T')[0];

  return {
    title: `Daily Check-in: ${category.name}`,
    body: `Did you complete "${category.name}" today? Tap to record instantly.`,
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
    data: {
      category_id: category.id,
      category_name: category.name,
      log_date: todayStr,
      url: '/dashboard',
      timestamp: Date.now(),
    },
    actions: [
      {
        action: 'present',
        title: 'Present / Yes',
      },
      {
        action: 'absent',
        title: 'Absent / No',
      },
    ],
  };
}
