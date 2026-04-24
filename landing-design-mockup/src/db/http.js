/**
 * Гараж через HTTP API (PostgreSQL + Express на Render или локально с DATABASE_URL).
 */
import { applyAuthHeader, logout, redirectToLogin } from "../stores/auth.mjs";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {string} path
 * @param {RequestInit & { json?: unknown }} [opts]
 */
async function api(path, opts = {}) {
  const { json, ...init } = opts;
  const url = `${API_BASE}${path}`;
  const headers = applyAuthHeader(new Headers(init.headers));
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const method = (init.method || "GET").toUpperCase();
  const res = await fetch(url, {
    ...init,
    headers,
    body: json !== undefined ? JSON.stringify(json) : init.body,
    cache:
      method === "GET" || method === "HEAD" ? "no-store" : init.cache,
  });
  if (res.status === 401) {
    logout();
    redirectToLogin();
    throw new Error("Unauthorized");
  }
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

export async function getAllGarageCars(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", String(filters.status));
  if (filters.assignedTo) params.set("assigned_to", String(filters.assignedTo));
  const suffix = params.size ? `?${params.toString()}` : "";
  const data = await api(`/api/cars${suffix}`);
  if (data === undefined || data === null) {
    throw new Error("Garage API: пустой ответ при загрузке списка");
  }
  if (!Array.isArray(data)) {
    throw new Error("Garage API: ожидался массив автомобилей");
  }
  return data;
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
      purchasePrice: payload.purchasePrice ?? "",
      mileage: payload.mileage ?? null,
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

export async function updateCarStatus(id, status) {
  return api(`/api/cars/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    json: { status },
  });
}

export async function addCarPhoto(id, photo) {
  return api(`/api/cars/${encodeURIComponent(id)}/photos`, {
    method: "POST",
    json: { photo },
  });
}

/**
 * @param {string[]} ids
 */
export async function getCarsForComparison(ids) {
  const clean = Array.isArray(ids)
    ? ids
        .map((id) => String(id).trim())
        .filter((id) => id && UUID_RE.test(id))
        .slice(0, 4)
    : [];
  if (!clean.length) return [];
  const params = new URLSearchParams();
  params.set("ids", clean.join(","));
  try {
    const data = await api(`/api/cars/compare?${params.toString()}`);
    if (!Array.isArray(data)) {
      throw new Error("Garage API: ожидался массив для сравнения");
    }
    return data;
  } catch {
    // Fallback for older backend builds without /compare support.
    const loaded = await Promise.all(clean.map((id) => getGarageCar(id)));
    return loaded.filter(Boolean);
  }
}
