// Client-side Web Push & Service Worker Registration Utilities

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

/**
 * Register Service Worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
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
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return {
      isSupported: false,
      permission: 'unsupported',
      isSubscribed: false,
      subscription: null,
    };
  }

  const permission = Notification.permission;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    return {
      isSupported: true,
      permission,
      isSubscribed: Boolean(subscription),
      subscription,
    };
  } catch (err) {
    console.error('[PWA] Error checking push subscription:', err);
    return {
      isSupported: true,
      permission,
      isSubscribed: false,
      subscription: null,
    };
  }
}

/**
 * Request notification permission and subscribe to Web Push
 */
export async function subscribeToWebPush(authToken?: string | null): Promise<PushSubscription> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  // 1. Request browser permission
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    throw new Error('Notification permission is blocked in your browser settings. Please enable notifications for this site in your browser permissions.');
  }

  let permission: NotificationPermission = 'default';
  try {
    permission = await Notification.requestPermission();
  } catch (permErr) {
    console.warn('[PWA] Permission request error:', permErr);
  }

  if (permission === 'denied') {
    throw new Error('Notification permission was blocked. Please enable notifications in your browser settings.');
  }
  if (permission !== 'granted') {
    throw new Error('Notification prompt was dismissed. Please allow notifications when prompted.');
  }

  // 2. Register / wait for service worker ready
  const registration = await navigator.serviceWorker.ready;

  // 3. Fetch VAPID Public Key from backend
  const keyRes = await fetch('/api/notifications/vapid-public-key');
  if (!keyRes.ok) {
    throw new Error('Failed to retrieve VAPID public key from server');
  }
  const { publicKey } = await keyRes.json();
  if (!publicKey) {
    throw new Error('Server VAPID public key is empty');
  }

  const convertedVapidKey = urlBase64ToUint8Array(publicKey);

  // 4. Subscribe to PushManager
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey,
    });
  }

  // 5. Send subscription to server
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const saveRes = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers,
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });

  if (!saveRes.ok) {
    const errData = await saveRes.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to save subscription to server');
  }

  return subscription;
}

/**
 * Unsubscribe from Web Push
 */
export async function unsubscribeFromWebPush(authToken?: string | null): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

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
      });
    }

    return true;
  } catch (err) {
    console.error('[PWA] Error unsubscribing:', err);
    return false;
  }
}

/**
 * Trigger immediate test push notification
 */
export async function sendTestPushNotification(authToken?: string | null): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch('/api/notifications/test', {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to trigger test notification');
  }

  return res.json();
}

/**
 * Get internal self-hosted cron scheduler live status
 */
export async function fetchCronStatus(): Promise<{
  success: boolean;
  mode: string;
  isRunning: boolean;
  intervalSeconds: number;
  currentServerTime: string;
  activeSubscribersCount: number;
  categoriesWithReminders: { id: string; name: string; reminder_time: string }[];
  lastDispatchedMinute: string | null;
  recentLogs: any[];
}> {
  const res = await fetch('/api/cron/status');
  if (!res.ok) {
    throw new Error('Failed to retrieve cron scheduler status');
  }
  return res.json();
}

/**
 * Trigger cron check manually
 */
export async function triggerCronCheck(authToken?: string | null, forceAll = false): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`/api/cron/notify?all=${forceAll ? 'true' : 'false'}`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to trigger cron check');
  }

  return res.json();
}

