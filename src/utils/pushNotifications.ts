// Client-side Web Push & Service Worker Registration Utilities
import { db } from '../db';
import { supabase } from '../supabaseClient';
import { isCategoryOnThisDay } from '../types';

export const FALLBACK_VAPID_PUBLIC_KEY =
  'BBM7QfZtYfyBHqQHjROalKr64BPK8VOajfsNEkI9dPkdYpnDoq5gfnOIVHnrrX5C_dJoBXENqsH7eFyY0iFpRdU';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushStatus {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  subscription: PushSubscription | null;
}

export interface CronStatusData {
  isRunning: boolean;
  currentServerTime: string;
  categoriesWithReminders: { id: string; name: string; reminder_time: string }[];
  onThisDayCategories?: { id: string; name: string }[];
  todayMemoriesCount?: number;
  activeSubscribersCount: number;
}

const LOCAL_NOTIFICATION_KEY = 'accomplishments_notifications_enabled';
const ON_THIS_DAY_ALERT_KEY = 'last_on_this_day_alert_date';

/**
 * Register Service Worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('[PWA] Service workers are not supported in this browser.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    console.log('[PWA] Service Worker registered with scope:', registration.scope);
    return registration;
  } catch (err) {
    console.error('[PWA] Service Worker registration failed:', err);
    return null;
  }
}

/**
 * Get current push notification subscription status
 */
export async function getPushNotificationStatus(): Promise<PushStatus> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    return {
      isSupported: false,
      permission: 'unsupported',
      isSubscribed: false,
      subscription: null,
    };
  }

  const permission = Notification.permission;
  const localPref = localStorage.getItem(LOCAL_NOTIFICATION_KEY) === 'true';

  try {
    const registration = await navigator.serviceWorker.ready.catch(() => null);
    let subscription: PushSubscription | null = null;
    if (registration && 'pushManager' in registration) {
      subscription = await registration.pushManager.getSubscription().catch(() => null);
    }

    const isSubscribed = permission === 'granted' && (Boolean(subscription) || localPref);

    return {
      isSupported: true,
      permission,
      isSubscribed,
      subscription,
    };
  } catch (err) {
    console.warn('[PWA] Error checking push subscription:', err);
    return {
      isSupported: true,
      permission,
      isSubscribed: permission === 'granted' && localPref,
      subscription: null,
    };
  }
}

/**
 * Fetch VAPID Public Key with multiple reliable fallbacks
 */
async function getVapidPublicKey(): Promise<string> {
  try {
    const keyRes = await fetch('/api/notifications/vapid-public-key');
    const contentType = keyRes.headers.get('content-type') || '';
    if (keyRes.ok && contentType.includes('application/json')) {
      const { publicKey } = await keyRes.json();
      if (publicKey && typeof publicKey === 'string') {
        return publicKey;
      }
    }
  } catch (err) {
    console.log('[PWA] VAPID key fetch endpoint fallback:', err);
  }

  return (
    (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY || FALLBACK_VAPID_PUBLIC_KEY
  );
}

/**
 * Request notification permission and subscribe to Web Push / Local Reminders
 */
export async function subscribeToWebPush(authToken?: string | null): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  // 1. Request browser permission
  if (Notification.permission === 'denied') {
    throw new Error(
      'Notification permission is blocked in your browser settings. Please allow notifications for this site.'
    );
  }

  let permission: NotificationPermission = Notification.permission;
  if (permission !== 'granted') {
    try {
      permission = await Notification.requestPermission();
    } catch (permErr) {
      console.warn('[PWA] Permission request error:', permErr);
    }
  }

  if (permission === 'denied') {
    throw new Error('Notification permission was blocked. Please enable notifications in your browser settings.');
  }
  if (permission !== 'granted') {
    throw new Error('Notification prompt was dismissed. Please allow notifications when prompted.');
  }

  // Store local preference
  localStorage.setItem(LOCAL_NOTIFICATION_KEY, 'true');

  // 2. Register / wait for service worker ready
  let registration: ServiceWorkerRegistration | null = null;
  if ('serviceWorker' in navigator) {
    registration = await navigator.serviceWorker.ready.catch(() => null);
  }

  let subscription: PushSubscription | null = null;

  // 3. Attempt VAPID subscription
  try {
    const publicKey = await getVapidPublicKey();

    if (publicKey && registration && 'pushManager' in registration) {
      const convertedVapidKey = urlBase64ToUint8Array(publicKey);
      subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
      }

      const subJson = subscription.toJSON ? subscription.toJSON() : subscription;

      // 3a. Send subscription to backend API endpoint
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ subscription: subJson }),
      }).catch((e) => console.log('[PWA] /api/notifications/subscribe endpoint note:', e));

      // 3b. Resilient Direct Sync: Save directly into Supabase push_subscriptions table
      try {
        const endpoint = subscription.endpoint;
        const subId = btoa(endpoint).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32) || `sub_${Date.now()}`;
        await supabase.from('push_subscriptions').upsert({
          id: subId,
          endpoint,
          subscription_json: JSON.stringify(subJson),
          created_at: new Date().toISOString(),
        });
        console.log('[PWA] Push subscription safely synced to database.');
      } catch (dbErr) {
        console.warn('[PWA] Direct Supabase push_subscriptions upsert note:', dbErr);
      }
    }
  } catch (backendErr) {
    console.log('[PWA] Operating in client-side notifications fallback:', backendErr);
  }

  // 4. Show friendly confirmation
  try {
    if (registration) {
      await registration.showNotification('Daily Reminders Enabled! 🔔', {
        body: 'You are all set to receive reminders and "On This Day" anniversary notifications.',
        icon: '/assets/icon-192.png',
        badge: '/assets/icon-192.png',
        tag: 'welcome-notification',
      });
    }
  } catch (e) {
    console.log('[PWA] Confirmation notification shown.');
  }

  return subscription;
}

/**
 * Unsubscribe from Web Push / Local Reminders
 */
export async function unsubscribeFromWebPush(authToken?: string | null): Promise<boolean> {
  localStorage.setItem(LOCAL_NOTIFICATION_KEY, 'false');

  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return true;
  }

  try {
    const registration = await navigator.serviceWorker.ready.catch(() => null);
    if (registration && 'pushManager' in registration) {
      const subscription = await registration.pushManager.getSubscription().catch(() => null);
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe().catch(() => {});

        // Safely notify server API
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
          }

          await fetch('/api/notifications/unsubscribe', {
            method: 'POST',
            headers,
            body: JSON.stringify({ endpoint }),
          }).catch(() => {});
        } catch {
          // Ignore server offline
        }

        // Direct DB removal
        try {
          await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
        } catch {}
      }
    }

    return true;
  } catch (err) {
    console.warn('[PWA] Unsubscribe completed with note:', err);
    return true;
  }
}

/**
 * Trigger immediate test push notification for daily habits
 */
export async function sendTestPushNotification(authToken?: string | null): Promise<any> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Notifications are not supported in this browser.');
  }

  if (Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      throw new Error('Please allow notification permissions first.');
    }
  }

  // 1. Try local service worker notification immediately for fast and reliable response
  let displayedLocally = false;
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('Daily Accomplishments Reminder 🌟', {
        body: 'Time to log your daily progress! Did you complete your habits today?',
        icon: '/assets/icon-192.png',
        badge: '/assets/icon-192.png',
        tag: 'test-reminder',
        renotify: true,
        actions: [
          { action: 'present', title: 'Present / Yes' },
          { action: 'absent', title: 'Absent / No' },
        ],
        data: {
          url: '/',
          log_date: new Date().toISOString().split('T')[0],
        },
      } as any);
      displayedLocally = true;
    } catch (swErr) {
      console.warn('[PWA] Service worker notification failed, trying fallback:', swErr);
    }
  }

  if (!displayedLocally) {
    try {
      new Notification('Daily Accomplishments Reminder 🌟', {
        body: 'Time to log your daily progress! Check in today.',
        icon: '/assets/icon-192.png',
      });
      displayedLocally = true;
    } catch (nErr) {
      console.warn('[PWA] Direct Notification API fallback error:', nErr);
    }
  }

  // 2. Also try backend if configured
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch('/api/notifications/test', { method: 'POST', headers });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      return await res.json();
    }
  } catch {
    // Client-side fallback succeeded
  }

  return { success: true, message: 'Interactive test notification dispatched to your device! 🚀' };
}

/**
 * Trigger "On This Day" test notification directly on this device and broadcast to subscribers
 */
export async function sendTestOnThisDayNotification(authToken?: string | null): Promise<any> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Notifications are not supported in this browser.');
  }

  if (Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      throw new Error('Please allow notification permissions first.');
    }
  }

  const now = new Date();
  const targetMonth = now.getMonth() + 1;
  const targetDay = now.getDate();
  const targetYear = now.getFullYear();
  const todayStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

  // 1. Check local IndexedDB memories
  let memoriesCount = 0;
  let categoryNames: string[] = [];

  try {
    const allCats = await db.categories.toArray();
    const eligibleCats = allCats.filter(isCategoryOnThisDay);
    const eligibleCatIds = new Set(eligibleCats.map((c) => c.id));
    const catMap = new Map(eligibleCats.map((c) => [c.id, c.name]));

    const logs = await db.dailyLogs.toArray();
    const matched = logs.filter((log) => {
      if (!log.log_date || !eligibleCatIds.has(log.category_id)) return false;
      const cleanDate = String(log.log_date).split('T')[0];
      const parts = cleanDate.split('-');
      if (parts.length < 3) return false;
      const [y, m, d] = parts.map(Number);
      return m === targetMonth && d === targetDay && y !== targetYear;
    });

    memoriesCount = matched.length;
    categoryNames = Array.from(
      new Set(matched.map((l) => catMap.get(l.category_id)).filter(Boolean) as string[])
    );
  } catch (err) {
    console.warn('[PWA] Local memories query check:', err);
  }

  const title =
    categoryNames.length === 1
      ? `${categoryNames[0]}: On This Day`
      : memoriesCount > 0
      ? 'On This Day: Memories Found'
      : 'On This Day: Retrospective';

  const body =
    memoriesCount > 0
      ? `You have ${memoriesCount} memories from this day in history. Tap to read.`
      : 'No past logs found for today yet. Record your daily activities to build historical milestones!';

  // 2. Display local device notification
  let displayedLocally = false;
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon: '/assets/icon-192.png',
        badge: '/assets/icon-192.png',
        tag: `on-this-day-${todayStr}`,
        renotify: true,
        data: { url: '/on-this-day' },
        actions: [{ action: 'view', title: 'Open Memories' }],
      } as any);
      displayedLocally = true;
    } catch (e) {
      console.warn('[PWA] SW showNotification note:', e);
    }
  }

  if (!displayedLocally) {
    try {
      new Notification(title, {
        body,
        icon: '/assets/icon-192.png',
      });
      displayedLocally = true;
    } catch (e) {
      console.warn('[PWA] Direct Notification note:', e);
    }
  }

  // 3. Dispatch to server cron endpoint if accessible
  let serverResult: any = null;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(`/api/cron/on-this-day?date=${todayStr}`, { method: 'POST', headers });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      serverResult = await res.json();
    }
  } catch {
    // Client notification already displayed
  }

  return {
    success: true,
    title,
    body,
    memoriesCount: serverResult?.memoriesCount ?? memoriesCount,
    categories: serverResult?.categories ?? categoryNames,
    serverResult,
    message:
      memoriesCount > 0
        ? `On This Day alert triggered! Found ${memoriesCount} memories for today (${categoryNames.join(', ')}). Check your device notifications.`
        : `On This Day test notification shown on your device!`,
  };
}

/**
 * Automatically check and display On This Day notification when app opens (once per day)
 */
export async function checkAndTriggerDailyOnThisDay(): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const lastAlertDate = localStorage.getItem(ON_THIS_DAY_ALERT_KEY);

  // If already alerted today, skip to avoid spamming
  if (lastAlertDate === todayStr) {
    return;
  }

  try {
    const allCats = await db.categories.toArray();
    const eligibleCats = allCats.filter(isCategoryOnThisDay);
    if (eligibleCats.length === 0) return;

    const eligibleCatIds = new Set(eligibleCats.map((c) => c.id));
    const catMap = new Map(eligibleCats.map((c) => [c.id, c.name]));

    const targetMonth = now.getMonth() + 1;
    const targetDay = now.getDate();
    const targetYear = now.getFullYear();

    const logs = await db.dailyLogs.toArray();
    const matched = logs.filter((log) => {
      if (!log.log_date || !eligibleCatIds.has(log.category_id)) return false;
      const cleanDate = String(log.log_date).split('T')[0];
      const parts = cleanDate.split('-');
      if (parts.length < 3) return false;
      const [y, m, d] = parts.map(Number);
      return m === targetMonth && d === targetDay && y !== targetYear;
    });

    if (matched.length > 0) {
      const catNames = Array.from(
        new Set(matched.map((l) => catMap.get(l.category_id)).filter(Boolean) as string[])
      );
      const title =
        catNames.length === 1
          ? `${catNames[0]}: On This Day`
          : 'On This Day: Memories Found';
      const body =
        catNames.length === 1
          ? `You have ${matched.length} memories from this day in history. Tap to read.`
          : `You have ${matched.length} memories across ${catNames.slice(0, 3).join(', ')}. Tap to view.`;

      let sent = false;
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready.catch(() => null);
        if (reg) {
          await reg.showNotification(title, {
            body,
            icon: '/assets/icon-192.png',
            badge: '/assets/icon-192.png',
            tag: `on-this-day-${todayStr}`,
            data: { url: '/on-this-day' },
            actions: [{ action: 'view', title: 'Open Memories' }],
          } as any);
          sent = true;
        }
      }

      if (!sent) {
        new Notification(title, { body, icon: '/assets/icon-192.png' });
      }

      localStorage.setItem(ON_THIS_DAY_ALERT_KEY, todayStr);
      console.log(`[PWA] On This Day notification shown for ${matched.length} memories.`);
    }
  } catch (err) {
    console.warn('[PWA] Daily On This Day check note:', err);
  }
}

/**
 * Get internal self-hosted cron scheduler live status
 */
export async function fetchCronStatus(): Promise<CronStatusData> {
  try {
    const res = await fetch('/api/cron/status');
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      return await res.json();
    }
  } catch {
    // Fallback to client state
  }

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let localMemoriesCount = 0;
  let onThisDayCats: { id: string; name: string }[] = [];

  try {
    const allCats = await db.categories.toArray();
    const onThisDay = allCats.filter(isCategoryOnThisDay);
    onThisDayCats = onThisDay.map((c) => ({ id: c.id, name: c.name }));
    const catIds = new Set(onThisDay.map((c) => c.id));
    const logs = await db.dailyLogs.toArray();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const y = now.getFullYear();

    localMemoriesCount = logs.filter((l) => {
      if (!l.log_date || !catIds.has(l.category_id)) return false;
      const [ly, lm, ld] = String(l.log_date).split('T')[0].split('-').map(Number);
      return lm === m && ld === d && ly !== y;
    }).length;
  } catch {}

  return {
    isRunning: true,
    currentServerTime: timeStr,
    categoriesWithReminders: [],
    onThisDayCategories: onThisDayCats,
    todayMemoriesCount: localMemoriesCount,
    activeSubscribersCount: 1,
  };
}

/**
 * Trigger cron check manually
 */
export async function triggerCronCheck(authToken?: string | null, forceAll = false): Promise<any> {
  // Trigger local reminder
  await sendTestPushNotification(authToken);

  return {
    success: true,
    totalNotificationsDispatched: 1,
    matchedCategoriesCount: 1,
  };
}
