/* SmartFixOS Service Worker — Push Notifications */
const CACHE_NAME = "smartfixos-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// Manejar mensajes desde la app
self.addEventListener("message", (event) => {
  if (event.data?.type === "SHOW_NOTIFICATION") {
    const { title, body, icon, tag, data } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: icon || "/icon-192.png",
      badge: "/icon-192.png",
      tag: tag || "smartfixos",
      data: data || {},
      vibrate: [200, 100, 200],
    });
  }
});

// Clic en notificación — abrir la app en la ruta correcta
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.postMessage({ type: "NAVIGATE", url }); }
      else self.clients.openWindow(url);
    })
  );
});
