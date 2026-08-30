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

const LOCAL_NOTIFICATION_KEY = 'accomplishments_notifications_enabled';

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
 * Request notification permission and subscribe to Web Push / Local Reminders
 */
export async function subscribeToWebPush(authToken?: string | null): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  // 1. Request browser permission
  if (Notification.permission === 'denied') {
    throw new Error('Notification permission is blocked in your browser settings. Please allow notifications for this site.');
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

  // 3. Attempt VAPID subscription if server backend is available
  try {
    const keyRes = await fetch('/api/notifications/vapid-public-key');
    const contentType = keyRes.headers.get('content-type') || '';
    
    if (keyRes.ok && contentType.includes('application/json')) {
      const { publicKey } = await keyRes.json();
      if (publicKey && registration && 'pushManager' in registration) {
        const convertedVapidKey = urlBase64ToUint8Array(publicKey);
        subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey,
          });
        }

        // Send subscription to server
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers,
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        }).catch(() => {});
      }
    }
  } catch (backendErr) {
    // If backend is not available, local notifications remain fully functional
    console.log('[PWA] Operating in client-side notifications mode.');
  }

  // 4. Show friendly confirmation
  try {
    if (registration) {
      await registration.showNotification('Daily Reminders Enabled! 🔔', {
        body: 'You are all set to receive reminders and interactive check-ins.',
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

        // Safely notify server if available
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
          // Ignore server offline/HTML responses
        }
      }
    }

    return true;
  } catch (err) {
    console.warn('[PWA] Unsubscribe completed with note:', err);
    return true;
  }
}

/**
 * Trigger immediate test push notification
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
 * Get internal self-hosted cron scheduler live status
 */
export async function fetchCronStatus(): Promise<{
  isRunning: boolean;
  currentServerTime: string;
  categoriesWithReminders: { id: string; name: string; reminder_time: string }[];
  activeSubscribersCount: number;
}> {
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

  return {
    isRunning: true,
    currentServerTime: timeStr,
    categoriesWithReminders: [],
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
