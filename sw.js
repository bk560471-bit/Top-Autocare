// sw.js - Service Worker for Top Autocare Garage PWA
// Self-contained, vanilla JS implementation for caching and offline support

const CACHE_NAME = 'top-autocare-v2.0'; // Version for cache busting - update when assets change
const OFFLINE_PAGE = '/offline.html'; // Fallback page for offline navigation
const SKIP_WAITING = true; // Automatically activate after installation

// Pre-defined assets to cache (app shell + static files)
const urlsToCache = [
  // HTML Pages (core app shell)
  '/',
  '/index.html',
  '/dashboard.html',
  '/book-appointment.html',
  '/myvehicles.html',
  '/services.html',
  '/profile.html',
  '/notifications.html',
  '/signin.html',
  '/signup.html',
  '/verify-email.html',
  // Admin Pages
  '/admin.html',
  '/admin-users.html',
  '/admin-appointments.html',
  '/admin-appointment-details.html',
  '/admin-services.html',
  '/admin-vehicles.html',
  '/admin-reports.html',
  '/admin-settings.html',
  '/admin-profile.html',
  '/admin-notifications.html',
  '/admin-faq.html',
  '/admin-analytics.html',
  '/admin-backup.html',
  // Fallback/Offline
  OFFLINE_PAGE,
  // Manifest and Icons (PWA essentials)
  '/manifest.json',
  '/assets/images/app-icon-192.png',
  '/assets/images/app-icon-512.png',
  '/assets/images/logo.png',
  // Images/Assets
  '/images/logo.png',
  '/images/background.png',
  '/assets/images/favicon.ico',
  // Scripts (external libraries)
  '/analytics.js',
  '/offline-db.js',
  '/performance-monitor.js',
  '/error-handler.js',
  '/service-worker-manager.js',
  // Note: Dynamic content (user data, APIs) will be network-first
];

// Install Event - Cache the app shell
self.addEventListener('install', (event) => {
  console.log('🛠️ Service Worker: Installing...');
  
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Caching app shell');
        return cache.addAll(urlsToCache).catch((error) => {
          console.warn('⚠️ Service Worker: Some assets failed to cache:', error);
        });
      })
      .then(() => {
        console.log('✅ Service Worker: Install complete');
      })
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker: Activating...');
  
  // Claim all clients immediately
  event.waitUntil(clients.claim());
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker: Cache cleanup complete');
    })
  );
});

// Fetch Event - Network-first with cache fallback for dynamic content
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Ignore non-GET requests and non-same-origin
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Cache-first strategy for cached assets (app shell)
  if (urlsToCache.some(url => request.url.endsWith(url) || request.url.includes('/images/') || request.url.includes('/assets/'))) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log('📦 Service Worker: Serving from cache:', request.url);
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          // Cache successful responses for future use
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        }).catch(() => {
          console.log('❌ Service Worker: Network failed, returning offline page');
          return caches.match(OFFLINE_PAGE);
        });
      })
    );
    return;
  }
  
  // Network-first for API calls and dynamic content (e.g., /api, user data)
  if (request.url.includes('/api/') || request.destination === 'fetch') {
    event.respondWith(
      fetch(request).catch((error) => {
        console.warn('🌐 Service Worker: API request failed:', error);
        // Return a custom offline response for API failures
        return new Response(JSON.stringify({ error: 'Offline - Please check your connection' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }
  
  // Default: Network-first with cache fallback for documents (pages)
  event.respondWith(
    fetch(request).then((networkResponse) => {
      // Cache the response if successful
      const responseToCache = networkResponse.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, responseToCache);
      });
      return networkResponse;
    }).catch(() => {
      console.log('🌐 Service Worker: Fetch failed, trying cache');
      return caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // Final fallback for navigation requests
        if (request.destination === 'document') {
          console.log('📄 Service Worker: Serving offline fallback');
          return caches.match(OFFLINE_PAGE);
        }
        // For other resources, return a generic error
        return new Response('You are offline. Please try again later.', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      });
    })
  );
});

// Background Sync (Optional - for queued actions like form submissions)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-appointment-booking') {
    console.log('🔄 Service Worker: Syncing appointment booking...');
    // Example: Sync queued data from IndexedDB when online
    // Implement your sync logic here
  }
});

// Push Notifications (Optional - Add if needed later)
self.addEventListener('push', (event) => {
  const title = 'Top Autocare Update';
  const options = {
    body: event.data ? event.data.text() : 'You have a new notification!',
    icon: '/assets/images/app-icon-192.png',
    badge: '/assets/images/app-icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click Handler (Optional)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.notification.data.primaryKey) {
    // Open specific page or handle action
    event.waitUntil(
      clients.openWindow('/notifications.html')
    );
  }
});

// Debug: Listen for messages from page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('🚀 Service Worker: Loaded and ready!');
