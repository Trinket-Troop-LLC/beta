import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Change this attribute's name to your `injectionPoint`.
    // `injectionPoint` is an InjectManifest option.
    // See https://serwist.pages.dev/docs/build/configuring
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const authenticatedPaths = [
  "/admin",
  "/messages",
  "/posts",
  "/profile",
  "/protected",
  "/thoughts",
  "/troop",
];

function isAuthenticatedPath(pathname: string) {
  return authenticatedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Supabase (auth, chat messages, listings) must never be served stale from
    // cache — defaultCache's generic cross-origin rule would otherwise fall back
    // to a cached response after a 10s network hiccup, which for realtime chat
    // means silently showing outdated messages instead of surfacing a real error.
    {
      matcher: /^https:\/\/[a-z0-9-]+\.supabase\.co(?:\/|$)/i,
      handler: new NetworkOnly(),
    },
    // Authenticated HTML and RSC responses can contain member-specific data.
    // Never place them in a shared browser cache or use stale copies offline.
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin && isAuthenticatedPath(url.pathname),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

// Earlier service workers used Serwist's generic runtime caches for every page
// and cross-origin request. Remove those caches once this safer worker activates
// so data written under the old rules cannot be served to a later browser user.
self.addEventListener("activate", (event) => {
  const obsoleteRuntimeCaches = new Set([
    "apis",
    "cross-origin",
    "others",
    "pages",
    "pages-rsc",
    "pages-rsc-prefetch",
    "static-image-assets",
  ]);

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => obsoleteRuntimeCaches.has(cacheName))
            .map((cacheName) => caches.delete(cacheName)),
        ),
      ),
  );
});

serwist.addEventListeners();

// Payload shape matches PushPayload in lib/notifications/push-send.ts.
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload: { title: string; body: string; url: string };
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon.png",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url;
  if (!url) return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
