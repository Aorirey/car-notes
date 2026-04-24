import { applyAuthHeader } from "../stores/auth.mjs";
import { connectNotificationsSse } from "../utils/sseClient.mjs";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

/**
 * @param {string} path
 * @param {RequestInit} [init]
 * @returns {Promise<unknown>}
 */
async function api(path, init = {}) {
  const headers = applyAuthHeader(new Headers(init.headers));
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  if (res.status === 204) return undefined;
  return res.json();
}

/**
 * @param {HTMLElement} mountPoint
 */
export function mountNotificationBell(mountPoint) {
  const root = document.createElement("div");
  root.className = "relative";
  root.innerHTML = `
    <button type="button" data-bell-btn class="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200" aria-label="Уведомления">
      <span>🔔</span>
      <span data-bell-badge class="absolute -right-1 -top-1 hidden min-w-[1.1rem] rounded-full bg-accent-500 px-1 text-center text-[10px] font-semibold text-white">0</span>
    </button>
    <div data-bell-dropdown class="absolute right-0 z-50 mt-2 hidden w-80 rounded-xl border border-ink-200 bg-white p-3 shadow-xl dark:border-ink-700 dark:bg-ink-900">
      <div class="mb-2 flex items-center justify-between">
        <p class="text-sm font-semibold text-ink-900 dark:text-ink-100">Уведомления</p>
        <button type="button" data-permission-btn class="text-xs text-accent-600 hover:underline">Разрешить push</button>
      </div>
      <ul data-bell-list class="max-h-72 space-y-2 overflow-auto text-xs"></ul>
    </div>
  `;
  mountPoint.appendChild(root);

  const btn = root.querySelector("[data-bell-btn]");
  const badge = root.querySelector("[data-bell-badge]");
  const dropdown = root.querySelector("[data-bell-dropdown]");
  const list = root.querySelector("[data-bell-list]");
  const permissionBtn = root.querySelector("[data-permission-btn]");
  if (
    !(btn instanceof HTMLButtonElement) ||
    !(badge instanceof HTMLElement) ||
    !(dropdown instanceof HTMLElement) ||
    !(list instanceof HTMLElement) ||
    !(permissionBtn instanceof HTMLButtonElement)
  ) {
    return;
  }

  /** @type {Array<{id:string,title:string,message:string,is_read:boolean}>} */
  let notifications = [];

  const render = () => {
    const unread = notifications.filter((n) => !n.is_read).length;
    badge.textContent = String(unread);
    badge.classList.toggle("hidden", unread === 0);

    const frag = document.createDocumentFragment();
    for (const item of notifications) {
      const li = document.createElement("li");
      li.className = [
        "rounded-lg border px-2 py-2",
        item.is_read
          ? "border-ink-200 text-ink-500 dark:border-ink-700 dark:text-ink-400"
          : "border-accent-300 bg-accent-50 text-ink-800 dark:border-accent-700 dark:bg-accent-900/20 dark:text-ink-100",
      ].join(" ");
      li.innerHTML = `
        <p class="font-medium">${item.title}</p>
        <p class="mt-1">${item.message}</p>
        <button type="button" data-mark-read="${item.id}" class="mt-2 text-[11px] text-accent-600 hover:underline">Отметить прочитанным</button>
      `;
      frag.appendChild(li);
    }
    list.replaceChildren(frag);
  };

  const loadUnread = async () => {
    try {
      const data = await api("/api/notifications/unread");
      notifications = Array.isArray(data) ? data : [];
      render();
    } catch (error) {
      console.error(error);
    }
  };

  btn.addEventListener("click", () => {
    dropdown.classList.toggle("hidden");
  });

  permissionBtn.addEventListener("click", async () => {
    if (typeof Notification === "undefined") return;
    try {
      await Notification.requestPermission();
    } catch (error) {
      console.error(error);
    }
  });

  list.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const id = target.getAttribute("data-mark-read");
    if (!id) return;
    try {
      await api(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
      notifications = notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n));
      render();
    } catch (error) {
      console.error(error);
    }
  });

  const sse = connectNotificationsSse((payload) => {
    if (payload?.type === "notification" && payload.notification) {
      notifications = [payload.notification, ...notifications];
      render();
    }
    if (payload?.type === "snapshot" && typeof payload.unread_count === "number") {
      badge.textContent = String(payload.unread_count);
      badge.classList.toggle("hidden", payload.unread_count === 0);
    }
  });

  void loadUnread();

  return {
    unmount() {
      sse.close();
      root.remove();
    },
  };
}
