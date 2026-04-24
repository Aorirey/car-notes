const AUTH_TOKEN_KEY = "car_notes_auth_token";
const AUTH_USER_KEY = "car_notes_auth_user";

function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

/**
 * @returns {string}
 */
export function getAuthToken() {
  const storage = getStorage();
  return storage?.getItem(AUTH_TOKEN_KEY) ?? "";
}

/**
 * @param {{ token: string, user?: unknown }} payload
 */
export function setAuthSession(payload) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(AUTH_TOKEN_KEY, payload.token);
  if (payload.user !== undefined) {
    storage.setItem(AUTH_USER_KEY, JSON.stringify(payload.user));
  }
}

/**
 * @returns {boolean}
 */
export function isLoggedIn() {
  return Boolean(getAuthToken());
}

export function logout() {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(AUTH_TOKEN_KEY);
  storage.removeItem(AUTH_USER_KEY);
}

/**
 * @param {Headers} headers
 * @returns {Headers}
 */
export function applyAuthHeader(headers) {
  const token = getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

export function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  window.location.assign("/login");
}
