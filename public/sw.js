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
      url: '/dashboard',
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

// 2. Handle interactive button clicks & notification taps
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click action:', event.action);

  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  const today = data.log_date || new Date().toISOString().split('T')[0];

  // Close the notification immediately
  notification.close();

  // If "Present / Yes" button is clicked:
  if (action === 'present') {
    event.waitUntil(
      (async () => {
        try {
          const logPayload = {
            log_date: today,
            category_id: data.category_id,
            notes: `Recorded automatically via Push Notification (Present / Yes)`,
            status: 'present',
          };

          const res = await fetch('/api/logs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(logPayload),
          });

          console.log('[SW] Background log recorded (present):', res.status);

          // Show immediate feedback notification
          await self.registration.showNotification('Activity Logged! ✅', {
            body: `Marked "Present" for ${data.category_name || 'Category'} today. Great job!`,
            icon: '/assets/icon-192.png',
            tag: 'log-feedback',
            silent: true,
          });
        } catch (err) {
          console.error('[SW] Failed to record present log:', err);
        }
      })()
    );
    return;
  }

  // If "Absent / No" button is clicked:
  if (action === 'absent') {
    event.waitUntil(
      (async () => {
        try {
          const logPayload = {
            log_date: today,
            category_id: data.category_id,
            notes: `Marked as absent via Push Notification (Absent / No)`,
            status: 'absent',
          };

          const res = await fetch('/api/logs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(logPayload),
          });

          console.log('[SW] Background log recorded (absent):', res.status);

          // Show discreet feedback notification
          await self.registration.showNotification('Check-in Noted ⚪', {
            body: `Marked "Absent" for ${data.category_name || 'Category'} for today.`,
            icon: '/assets/icon-192.png',
            tag: 'log-feedback',
            silent: true,
          });
        } catch (err) {
          console.error('[SW] Failed to record absent action:', err);
        }
      })()
    );
    return;
  }

  // If clicked notification body itself without button action: Open / focus the app window
  event.waitUntil(
    (async () => {
      // Build the target URL using the category_id from payload
      let targetPath = data.url || '/';
      if (data.category_id) {
        targetPath = `/quick-log?category_id=${data.category_id}`;
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
          
          // Send a message to the client to navigate smoothly without a hard reload
          client.postMessage({
            type: 'NAVIGATE',
            url: targetPath
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
