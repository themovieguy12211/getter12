self.options = {
    "domain": "3nbf4.com",
    "zoneId": 10775744
}

// Allow API routes through without blocking
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Allow all /api/player/ routes
  if (url.pathname.startsWith('/api/player/')) {
    event.respondWith(fetch(event.request));
    return;
  }
});

self.lary = ""
importScripts('https://3nbf4.com/act/files/service-worker.min.js?r=sw')
