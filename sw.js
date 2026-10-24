/* APA SMC Live Desk service worker. Bump SHELL_VERSION whenever changing offline-shell behavior. */
'use strict';
const SHELL_VERSION = 'apa-smc-shell-2026-10-24-15';
const SHELL_CACHE = SHELL_VERSION;
const SHELL_FILES = ['./', './index.html', './manifest.webmanifest', './icon.svg'];
const EXTERNAL_ASSETS = [
  'https://unpkg.com/lightweight-charts@5.0.8/dist/lightweight-charts.standalone.production.js',
  'https://cdn.jsdelivr.net/npm/lightweight-charts@5.0.8/dist/lightweight-charts.standalone.production.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.all(SHELL_FILES.map(async path => {
      try {
        const response = await fetch(path, {cache: 'no-store'});
        if (response.ok) await cache.put(path, response);
      } catch (_) {}
    }));
    // Cache the chart library after the first successful online install so a cold
    // launch can still render cached candles when the device has no connection.
    await Promise.all(EXTERNAL_ASSETS.map(async url => {
      try {
        const response = await fetch(url, {mode: 'no-cors', cache: 'no-store'});
        if (response.ok || response.type === 'opaque') await cache.put(url, response);
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('apa-smc-shell-') && key !== SHELL_CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    if (EXTERNAL_ASSETS.includes(request.url)) {
      event.respondWith((async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(request.url);
        if (cached) return cached;
        try { return await fetch(request); } catch (_) { return Response.error(); }
      })());
    }
    return;
  }

  // Always try the network first for HTML. This keeps the app and its signal logic
  // current on each navigation; the cache is a fallback for temporary outages.
  if (request.mode === 'navigate' || /\/index\.html$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const response = await fetch(request, {cache: 'no-store'});
        if (response.ok && !url.searchParams.has('releaseCheck')) {
          await cache.put('./index.html', response.clone());
          await cache.put('./', response.clone());
        }
        return response;
      } catch (_) {
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Static local shell assets use cache-first with a network refresh fallback.
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});

