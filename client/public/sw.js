/**
 * Service Worker for OrbitAI PWA
 * Provides offline support and caching
 */

// Updated cache version to force refresh after cleanup
const CACHE_NAME = 'orbitai-v3-react18-cleanup';
const RUNTIME_CACHE = 'orbitai-runtime-v3-react18-cleanup';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.warn('Failed to cache some assets:', error);
      });
    })
  );
  // Don't skip waiting - prevents reload loops
  // The service worker will activate when all tabs are closed
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  // CRITICAL: In development, immediately unregister to prevent reload loops
  if (self.location.hostname === 'localhost' || 
      self.location.hostname === '127.0.0.1' || 
      self.location.hostname.includes('localhost')) {
    event.waitUntil(
      self.registration.unregister().then(() => {
        console.log('[SW] Development mode - service worker unregistered');
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'SW_DEV_DISABLED' });
          });
        });
      })
    );
    return; // Don't proceed with normal activation
  }

  // Production: normal activation
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      // Delete ALL old caches (including React 19 caches)
      return Promise.all(
        cacheNames
          .filter((name) => !name.includes('react18') && !name.includes('v3') && !name.includes('cleanup'))
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Don't force claim clients - let them control when to update
      // This prevents automatic reload loops
      return Promise.resolve();
    })
  );
  // Don't skip waiting - let the old service worker finish before activating
  // This prevents reload loops
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // CRITICAL: In development, completely disable service worker
  // Don't intercept ANY requests in development - let browser handle everything
  if (self.location.hostname === 'localhost' || 
      self.location.hostname === '127.0.0.1' ||
      self.location.hostname.includes('localhost') ||
      event.request.url.includes('localhost:5173')) {
    // In development, don't intercept - let requests go through normally
    return;
  }
  
  // Skip non-GET requests - let browser handle normally
  if (event.request.method !== 'GET') {
    return;
  }

  // CRITICAL: Skip service worker for Vite dev server files
  // Always use network for Vite HMR and dev files
  if (event.request.url.includes('/@vite/') || 
      event.request.url.includes('/node_modules/.vite/') ||
      event.request.url.includes('?v=') ||
      event.request.url.includes('react_jsx') ||
      event.request.url.includes('.tsx') ||
      event.request.url.includes('.ts') ||
      event.request.url.includes('index.tsx')) {
    return; // Let browser handle - don't intercept
  }

  // Skip ALL API requests - always use network (let browser handle)
  // This includes both relative /api/ paths and full backend URLs
  const url = event.request.url;
  if (url.includes('/api/') || url.includes('localhost:3002') || url.includes('127.0.0.1:3002')) {
    return;
  }

  // Skip Vite HMR WebSocket connections - let browser handle
  if (event.request.url.includes('ws://') || event.request.url.includes('wss://')) {
    return;
  }

  // Skip CSS files - let Vite handle them directly to ensure correct MIME type
  if (event.request.url.includes('.css') || event.request.url.includes('index.css')) {
    return;
  }

  // Skip Vite dev server files - let Vite handle them directly
  if (event.request.url.includes('/@vite/') || event.request.url.includes('/@react-refresh')) {
    return;
  }

  // Skip external requests - let browser handle
  try {
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) {
      return;
    }
  } catch (e) {
    // Invalid URL, let browser handle
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached response if available
      if (cachedResponse) {
        return cachedResponse;
      }

      // Fetch from network
      return fetch(event.request)
        .then((response) => {
          // Validate response before caching
          if (!response || response.status !== 200) {
            return response;
          }

          // Only cache basic (same-origin) responses
          if (response.type !== 'basic') {
            return response;
          }

          // Clone response for caching (don't block on cache write)
          const responseToCache = response.clone();

          // Cache asynchronously (don't await)
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseToCache).catch((err) => {
              console.warn('[SW] Failed to cache:', err);
            });
          }).catch((err) => {
            console.warn('[SW] Cache open failed:', err);
          });

          return response;
        })
        .catch((error) => {
          // In development, don't show offline page - let browser handle
          if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
            // In dev, just let the error propagate - don't intercept
            return fetch(event.request);
          }
          
          // Network failed - try to return cached offline page (production only)
          if (event.request.destination === 'document') {
            return caches.match('/index.html').then((offlinePage) => {
              if (offlinePage) {
                return offlinePage;
              }
              // Return a proper Response object
              return new Response('Offline - Please check your connection', { 
                status: 503, 
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain' }
              });
            }).catch(() => {
              return new Response('Offline', { 
                status: 503, 
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain' }
              });
            });
          }
          // For non-document requests, return error response
          return new Response('Network error', { 
            status: 503, 
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
          });
        });
    }).catch((error) => {
      // Cache match failed - try network
      console.warn('[SW] Cache match error:', error);
      return fetch(event.request).catch(() => {
        // Both cache and network failed
        return new Response('Offline', { 
          status: 503, 
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-projects') {
    event.waitUntil(syncProjects());
  }
});

async function syncProjects() {
  // Sync pending project updates when back online
  // Implementation depends on your offline queue system
  console.log('Syncing projects...');
}

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'orbitai-notification',
    requireInteraction: true,
  };

  event.waitUntil(
    self.registration.showNotification('OrbitAI', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});

// Listen for messages from the page to control service worker updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    // Only skip waiting if explicitly requested by the page
    self.skipWaiting().then(() => {
      // Don't force claim - let the page control when to reload
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          // Send message to client instead of forcing reload
          client.postMessage({ type: 'SW_UPDATED' });
        });
      });
    });
  } else if (event.data && event.data.type === 'UNREGISTER') {
    // Handle unregister request - self-destruct
    self.registration.unregister().then(() => {
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UNREGISTERED' });
        });
      });
    });
  }
});

