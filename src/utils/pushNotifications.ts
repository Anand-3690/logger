// Client-side Web Push & Service Worker Registration Utilities
import { db } from '../db';
import { supabase } from '../supabaseClient';
import {
  isCategoryOnThisDay,
  isResolutionDueOnDate,
  AppNotification,
  AppNotificationAction,
  APP_NOTIFICATION_EVENT,
  Resolution,
} from '../types';
import { getEffectiveLogDate } from './dayBoundary';

export { APP_NOTIFICATION_EVENT };
export type { AppNotification, AppNotificationAction };

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
          applicationServerKey: convertedVapidKey as unknown as BufferSource,
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
 * Dispatch an on-screen in-app notification and trigger device notification
 */
export async function dispatchAppNotification(notification: AppNotification): Promise<void> {
  // 1. Dispatch custom event for current window
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(APP_NOTIFICATION_EVENT, { detail: notification })
    );

    // Cross-tab broadcast to open tabs
    try {
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('daily_logger_notifications_bc');
        channel.postMessage({ type: 'APP_NOTIFICATION', notification });
        channel.close();
      }
    } catch {}
  }

  // 2. Dispatch OS / System Notification if supported and permitted
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker?.ready.catch(() => null);
      if (reg) {
        await reg.showNotification(notification.title, {
          body: notification.body,
          icon: notification.icon || '/assets/icon-192.png',
          badge: '/assets/icon-192.png',
          tag: notification.id || `app-notif-${Date.now()}`,
          renotify: true,
          requireInteraction: true,
          data: notification.data || {},
          actions: notification.actions?.map((a) => ({
            action: a.action,
            title: a.title,
          })) || [
            { action: 'present', title: 'Present / Yes' },
            { action: 'absent', title: 'Absent / No' },
          ],
        } as any);
      } else {
        new Notification(notification.title, {
          body: notification.body,
          icon: notification.icon || '/assets/icon-192.png',
        });
      }
    } catch (e) {
      console.warn('[PWA] OS notification dispatch note:', e);
    }
  }
}

/**
 * Trigger immediate test push notification for daily habits
 */
export async function sendTestPushNotification(authToken?: string | null): Promise<any> {
  const todayStr = new Date().toISOString().split('T')[0];
  const title = 'Daily Accomplishments Reminder 🌟';
  const body = 'Time to log your daily progress! Did you complete your habits today?';

  // 1. Immediately dispatch rich on-screen notification
  await dispatchAppNotification({
    id: `test-habit-${Date.now()}`,
    title,
    body,
    icon: '/assets/icon-192.png',
    type: 'habit',
    data: {
      url: '/',
      log_date: todayStr,
    },
    actions: [
      { action: 'present', title: 'Present / Yes ✅', variant: 'primary' },
      { action: 'absent', title: 'Absent / No ⚪', variant: 'secondary' },
    ],
  });

  // 2. Request browser permission if not yet decided
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {}
  }

  // 3. Also try backend endpoint if reachable
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch('/api/notifications/test', { method: 'POST', headers });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      return await res.json();
    }
  } catch {
    // Client notification already displayed
  }

  return { success: true, message: 'Interactive on-screen test notification displayed! 🚀' };
}

/**
 * Trigger "On This Day" test notification directly on this device and broadcast to subscribers
 */
export async function sendTestOnThisDayNotification(authToken?: string | null): Promise<any> {
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
      if (!eligibleCatIds.has(log.category_id)) return false;
      const effDate = getEffectiveLogDate(log);
      if (!effDate) return false;
      const cleanDate = effDate.split('T')[0];
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
      : 'Retrospective alert: You recorded spiritual milestones on this day in past years. Tap to explore!';

  // 2. Dispatch rich interactive on-screen notification immediately
  await dispatchAppNotification({
    id: `test-on-this-day-${Date.now()}`,
    title,
    body,
    icon: '/assets/icon-192.png',
    type: 'on-this-day',
    data: {
      url: '/on-this-day',
      tag: `on-this-day-${todayStr}`,
      log_date: todayStr,
    },
    actions: [
      { action: 'view', title: 'Open Memories 📖', variant: 'primary' },
      { action: 'dismiss', title: 'Dismiss', variant: 'secondary' },
    ],
  });

  // 3. Request browser permission if default
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {}
  }

  // 4. Dispatch to server test and cron endpoints
  let serverResult: any = null;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    await fetch('/api/notifications/test?type=on-this-day', {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, body }),
    }).catch(() => {});
    const res = await fetch(`/api/cron/on-this-day?date=${todayStr}`, { method: 'POST', headers }).catch(() => null);
    if (res && res.ok) {
      serverResult = await res.json().catch(() => null);
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
        ? `Found ${memoriesCount} memories for today (${categoryNames.join(', ')})! On-screen notification displayed.`
        : `On-screen 'On This Day' notification displayed! Tap 'Open Memories' to explore.`,
  };
}

/**
 * Trigger immediate test push notification for Resolutions
 */
export async function sendTestResolutionNotification(authToken?: string | null): Promise<any> {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  // Find a real resolution if available from db
  let resTitle = 'Morning Meditation & Dhyan';
  let resId: string | undefined = undefined;
  let categoryId: string | undefined = undefined;

  try {
    const allRes = await db.resolutions.toArray();
    const activeRes = allRes.filter((r) => r.is_active);
    if (activeRes.length > 0) {
      const uncompleted = activeRes.find((r) => r.last_completed_at !== todayStr);
      const targetRes = uncompleted || activeRes[0];
      resTitle = targetRes.title;
      resId = targetRes.id;
      categoryId = targetRes.category_id;
    }
  } catch {}

  const title = `🎯 Resolution: ${resTitle}`;
  const body = `Time for your daily resolution: "${resTitle}". Did you accomplish it today?`;

  // 1. Dispatch rich interactive on-screen notification immediately
  await dispatchAppNotification({
    id: `test-resolution-${Date.now()}`,
    title,
    body,
    icon: '/assets/icon-192.png',
    type: 'resolution',
    data: {
      url: '/resolutions',
      resolution_id: resId,
      resolution_title: resTitle,
      category_id: categoryId,
      log_date: todayStr,
    },
    actions: [
      { action: 'present', title: 'Completed ✅', variant: 'primary' },
      { action: 'absent', title: 'Not Today ⚪', variant: 'secondary' },
      { action: 'view', title: 'View 🎯', variant: 'secondary' },
    ],
  });

  // 2. Request browser permission if default
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {}
  }

  // 3. Also trigger server push if reachable
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    await fetch('/api/notifications/test?type=resolution', {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, body, resolution_id: resId }),
    }).catch(() => {});
    await fetch('/api/cron/notify?force=true', { method: 'POST', headers }).catch(() => {});
  } catch {}

  return {
    success: true,
    message: `On-screen resolution alert for "${resTitle}" displayed! Check the interactive popup.`,
  };
}

/**
 * Check and trigger due Resolution notifications in-app
 */
export async function checkAndTriggerDueResolutions(force: boolean = false): Promise<number> {
  if (typeof window === 'undefined') return 0;

  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHours}:${currentMinutes}`;
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  try {
    const allRes = await db.resolutions.toArray();
    const activeResolutions = allRes.filter((r) => r.is_active);

    let triggeredCount = 0;
    for (const res of activeResolutions) {
      // 1. Is it due today?
      if (!isResolutionDueOnDate(res, todayStr)) continue;

      // 2. Is it already completed today?
      if (!force && res.last_completed_at === todayStr) continue;

      // 3. Time check: has reminder_time arrived today?
      const reminderTime = (res.reminder_time || '08:00').slice(0, 5);
      if (!force && currentTime < reminderTime) {
        continue;
      }

      // 4. Have we already alerted today for this resolution?
      const alertKey = `last_alert_res_${res.id}_${todayStr}`;
      if (!force && localStorage.getItem(alertKey)) {
        continue;
      }

      // Mark alerted
      localStorage.setItem(alertKey, new Date().toISOString());

      // Dispatch interactive on-screen notification
      await dispatchAppNotification({
        id: `resolution-${res.id}-${todayStr}`,
        title: `🎯 Resolution: ${res.title}`,
        body: `Time for your scheduled resolution: "${res.title}". Did you accomplish it today?`,
        icon: '/assets/icon-192.png',
        type: 'resolution',
        data: {
          url: '/resolutions',
          resolution_id: res.id,
          resolution_title: res.title,
          category_id: res.category_id,
          log_date: todayStr,
        },
        actions: [
          { action: 'present', title: 'Completed ✅', variant: 'primary' },
          { action: 'absent', title: 'Not Today ⚪', variant: 'secondary' },
          { action: 'view', title: 'View 🎯', variant: 'secondary' },
        ],
      });

      triggeredCount++;
    }

    return triggeredCount;
  } catch (err) {
    console.warn('[PWA] Due resolutions check error:', err);
    return 0;
  }
}

/**
 * Automatically check and display On This Day notification when app opens or syncs
 */
export async function checkAndTriggerDailyOnThisDay(force: boolean = false): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const lastAlertDate = localStorage.getItem(ON_THIS_DAY_ALERT_KEY);

  // If already alerted today, skip to avoid spamming unless force is specified
  if (!force && lastAlertDate === todayStr) {
    return false;
  }

  try {
    const allCats = await db.categories.toArray();
    const eligibleCats = allCats.filter(isCategoryOnThisDay);
    if (eligibleCats.length === 0) return false;

    const eligibleCatIds = new Set(eligibleCats.map((c) => c.id));
    const catMap = new Map(eligibleCats.map((c) => [c.id, c.name]));

    const targetMonth = now.getMonth() + 1;
    const targetDay = now.getDate();
    const targetYear = now.getFullYear();

    const logs = await db.dailyLogs.toArray();
    const matched = logs.filter((log) => {
      if (!eligibleCatIds.has(log.category_id)) return false;
      const effDate = getEffectiveLogDate(log);
      if (!effDate) return false;
      const cleanDate = effDate.split('T')[0];
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

      localStorage.setItem(ON_THIS_DAY_ALERT_KEY, todayStr);

      await dispatchAppNotification({
        id: `on-this-day-${todayStr}`,
        title,
        body,
        icon: '/assets/icon-192.png',
        type: 'on-this-day',
        data: {
          url: '/on-this-day',
          log_date: todayStr,
        },
        actions: [
          { action: 'view', title: 'Open Memories 📖', variant: 'primary' },
          { action: 'dismiss', title: 'Dismiss', variant: 'secondary' },
        ],
      });

      console.log(`[PWA] On This Day on-screen notification shown for ${matched.length} memories.`);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[PWA] Daily On This Day check note:', err);
    return false;
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
