self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'PaperTok 📚', body: 'Your landmark digests have been refreshed!' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'PaperTok 📚', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600&auto=format&fit=crop',
    vibrate: [200, 100, 200],
    tag: 'paper-tok-daily',
    renotify: true,
    requireInteraction: false,
    actions: [
      { action: 'open', title: '📖 Read Now' },
      { action: 'close', title: 'Dismiss' }
    ],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  if (event.action === 'close') {
    event.notification.close();
    return;
  }

  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Focus ANY existing app window/tab if open (even if URL is slightly different)
      for (const client of clientList) {
        if ('focus' in client) {
          // Focus the tab
          client.focus();
          // Navigate to target URL if supported
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          event.notification.close();
          return;
        }
      }
      
      // 2. If no window is open at all, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl).then(() => {
          event.notification.close();
        });
      }
    })
  );
});
