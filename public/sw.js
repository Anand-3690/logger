// Service Worker for Daily Accomplishments PWA & Push Notifications

self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('[SW] Service Worker installed');
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  console.log('[SW] Service Worker activated and claimed clients');
});

// 1. Listen for incoming Web Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');

  let data = {
    title: 'Daily Accomplishments Reminder',
    body: 'Time to log your daily progress!',
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
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || '/assets/icon-192.png',
    badge: data.badge || '/assets/icon-192.png',
    tag: data.data?.category_id ? `reminder-${data.data.category_id}` : 'daily-reminder',
    renotify: true,
    data: data.data || {},
    actions: data.actions || [
      { action: 'present', title: 'Present / Yes' },
      { action: 'absent', title: 'Absent / No' },
    ],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, notificationOptions)
  );
});

// Helper to record activity into IndexedDB from the service worker
async function saveToIndexedDB(logPayload) {
  return new Promise((resolve) => {
    try {
      // Open without locking version 1 so it safely opens the current DB version
      const request = indexedDB.open('TrackerLocalDB');
      request.onerror = () => resolve(false);
      request.onsuccess = (event) => {
        try {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('dailyLogs') || !db.objectStoreNames.contains('syncQueue')) {
            resolve(false);
            return;
          }
          const tx = db.transaction(['dailyLogs', 'syncQueue'], 'readwrite');
          const logsStore = tx.objectStore('dailyLogs');
          const syncStore = tx.objectStore('syncQueue');
          const now = new Date().toISOString();
          const logRecord = {
            id: crypto.randomUUID ? crypto.randomUUID() : `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            log_date: logPayload.log_date,
            category_id: logPayload.category_id || 'general',
            notes: logPayload.notes || '',
            status: logPayload.status || 'present',
            updated_at: now,
            created_at: now,
          };
          logsStore.put(logRecord);
          if (syncStore) {
            syncStore.put({
              id: logRecord.id,
              table: 'daily_logs',
              action: 'upsert',
              timestamp: Date.now(),
            });
          }
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      };
    } catch {
      resolve(false);
    }
  });
}

// 2. Handle interactive button clicks & notification taps
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click action:', event.action);

  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  const today = data.log_date || new Date().toISOString().split('T')[0];

  // Close the notification immediately
  notification.close();

  // If "Present / Yes" or "Absent / No" button is clicked:
  if (action === 'present' || action === 'absent') {
    event.waitUntil(
      (async () => {
        const isPresent = action === 'present';
        const logPayload = {
          log_date: today,
          category_id: data.category_id,
          notes: `Recorded via notification (${isPresent ? 'Present / Yes' : 'Absent / No'})`,
          status: action,
        };

        // 1. Notify any active clients
        const allClients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });

        let clientHandled = false;
        for (const client of allClients) {
          client.postMessage({
            type: 'RECORD_LOG',
            data: logPayload,
          });
          clientHandled = true;
        }

        // 2. If no client window was open, persist directly in IndexedDB
        if (!clientHandled) {
          await saveToIndexedDB(logPayload);
        }

        // 3. Show instant confirmation notification
        await self.registration.showNotification(
          isPresent ? 'Activity Logged! ✅' : 'Check-in Noted ⚪',
          {
            body: isPresent
              ? `Marked "Present" for today. Great job!`
              : `Marked "Absent" for today.`,
            icon: '/assets/icon-192.png',
            tag: 'log-feedback',
            silent: true,
          }
        );
      })()
    );
    return;
  }

  // If clicked notification body itself: Open / focus the app window
  event.waitUntil(
    (async () => {
      let targetPath = data.url || '/';
      if (data.category_id) {
        targetPath = `/?category_id=${data.category_id}`;
      }

      const urlToOpen = new URL(targetPath, self.location.origin).href;

      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // If the app is already open, focus it and potentially navigate it
      for (const client of allClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          await client.focus();
          client.postMessage({
            type: 'NAVIGATE',
            url: targetPath,
          });
          return;
        }
      }

      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })()
  );
});
