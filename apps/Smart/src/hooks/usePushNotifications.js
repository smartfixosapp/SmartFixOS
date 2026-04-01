import { useEffect, useRef, useCallback } from "react";

const PERM_KEY = "smartfix_push_enabled";

/** Registra el service worker y expone `notify()` para mostrar notificaciones nativas */
export function usePushNotifications() {
  const swRef = useRef(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

    // Registrar SW
    navigator.serviceWorker
      .register("/service-worker.js", { scope: "/" })
      .then(reg => { swRef.current = reg; })
      .catch(() => {}); // silencioso si ya estaba registrado

    // Navegar a ruta cuando el SW lo pide
    const onMsg = (e) => {
      if (e.data?.type === "NAVIGATE" && e.data.url) {
        window.location.pathname = e.data.url;
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);

  /** Solicita permiso si aún no se ha concedido */
  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return "denied";
    if (Notification.permission === "granted") return "granted";
    const result = await Notification.requestPermission();
    if (result === "granted") localStorage.setItem(PERM_KEY, "1");
    return result;
  }, []);

  /** Muestra una notificación nativa (requiere permiso previo) */
  const notify = useCallback(async ({ title, body, tag, url }) => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const sw = swRef.current || (await navigator.serviceWorker.ready.catch(() => null));
    if (sw) {
      sw.active?.postMessage({ type: "SHOW_NOTIFICATION", title, body, tag, data: { url } });
    } else {
      new Notification(title, { body, tag, icon: "/icon-192.png" });
    }
  }, []);

  return { notify, requestPermission, permission: typeof window !== "undefined" ? Notification?.permission : "default" };
}
