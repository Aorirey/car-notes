/**
 * Гараж через HTTP API (PostgreSQL + Express на Render или локально с DATABASE_URL).
 */

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

/**
 * @param {string} path
 * @param {RequestInit & { json?: unknown }} [opts]
 */
async function api(path, opts = {}) {
  const { json, ...init } = opts;
  const url = `${API_BASE}${path}`;
  const headers = new Headers(init.headers);
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, {
    ...init,
    headers,
    body: json !== undefined ? JSON.stringify(json) : init.body,
  });
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(text || res.statusText);
    /** @type {Error & { status?: number }} */ (err).status = res.status;
    throw err;
  }
  if (!text) return undefined;
  return JSON.parse(text);
}

export async function getAllGarageCars() {
  const data = await api("/api/cars");
  return Array.isArray(data) ? data : [];
}

export async function getGarageCar(id) {
  try {
    return await api(`/api/cars/${encodeURIComponent(id)}`);
  } catch (e) {
    if (typeof e === "object" && e !== null && /** @type {{ status?: number }} */ (e).status === 404) {
      return null;
    }
    throw e;
  }
}

export async function addGarageCar(payload) {
  return api("/api/cars", {
    method: "POST",
    json: {
      title: payload.title,
      linkUrl: payload.linkUrl ?? "",
    },
  });
}

export async function updateGarageCar(id, patch) {
  await api(`/api/cars/${encodeURIComponent(id)}`, {
    method: "PATCH",
    json: patch,
  });
}

export async function deleteGarageCar(id) {
  await api(`/api/cars/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
