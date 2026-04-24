import { getAuthToken } from "../stores/auth.mjs";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

/**
 * @param {(payload: unknown) => void} onEvent
 * @returns {{ close: () => void }}
 */
export function connectNotificationsSse(onEvent) {
  const token = getAuthToken();
  if (!token) {
    return { close() {} };
  }
  const url = `${API_BASE}/api/events?token=${encodeURIComponent(token)}`;
  const es = new EventSource(url);

  es.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      onEvent(payload);
      if (payload?.type === "notification") {
        const title = String(payload.notification?.title ?? "Новое уведомление");
        const body = String(payload.notification?.message ?? "");
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          // Browser-native alert strictly inside the website.
          new Notification(title, { body });
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  es.onerror = (error) => {
    console.error("SSE error", error);
  };

  return {
    close() {
      es.close();
    },
  };
}
