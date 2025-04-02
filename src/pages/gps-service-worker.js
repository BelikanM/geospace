// gps-service-worker.js
const CACHE_NAME = 'geospace-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/static/js/bundle.js',
];

// Installation du service worker
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activation du service worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Capture des positions GPS en arrière-plan
let watchPositionId = null;

self.addEventListener('message', event => {
  // Start tracking GPS
  if (event.data === 'START_GPS_TRACKING') {
    if (navigator.geolocation) {
      watchPositionId = navigator.geolocation.watchPosition(
        position => {
          const positionData = {
            position: { 
              lat: position.coords.latitude, 
              lng: position.coords.longitude 
            },
            altitude: position.coords.altitude,
            speed: position.coords.speed,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
          };
          
          // Notify all clients about the new position
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'GPS_POSITION_UPDATE',
                data: positionData
              });
            });
          });
        },
        error => {
          console.error('Background GPS error:', error);
        },
        { 
          enableHighAccuracy: true, 
          timeout: 30000, 
          maximumAge: 0 
        }
      );
    }
  } 
  // Stop tracking GPS
  else if (event.data === 'STOP_GPS_TRACKING') {
    if (watchPositionId !== null) {
      navigator.geolocation.clearWatch(watchPositionId);
      watchPositionId = null;
    }
  }
});

// Intercepte les requêtes réseau
self.addEventListener('fetch', event => {
  // On permet au navigateur de gérer les requêtes de façon standard
  // tout en permettant au service worker de fonctionner en arrière-plan
});

