const STORAGE_KEY = "car-notes:comparison:selected";
const MAX_COMPARISON_ITEMS = 4;
const CHANGE_EVENT = "car-notes:comparison-changed";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @returns {string[]} */
function readList() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((id) => String(id).trim())
      .filter((id) => UUID_RE.test(id))
      .slice(0, MAX_COMPARISON_ITEMS);
  } catch {
    return [];
  }
}

/** @param {string[]} list */
function writeList(list) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** @param {string[]} list */
function emitChange(list) {
  document.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { list: [...list] } }));
}

/** @param {unknown} id */
function normalizeId(id) {
  const value = String(id ?? "").trim();
  return UUID_RE.test(value) ? value : "";
}

export const comparisonStore = {
  MAX_COMPARISON_ITEMS,
  CHANGE_EVENT,

  /** @param {string} id */
  add(id) {
    const normalized = normalizeId(id);
    if (!normalized) return false;
    const list = readList();
    if (list.includes(normalized)) {
      emitChange(list);
      return true;
    }
    if (list.length >= MAX_COMPARISON_ITEMS) return false;
    const next = [...list, normalized];
    writeList(next);
    emitChange(next);
    return true;
  },

  /** @param {string} id */
  remove(id) {
    const normalized = normalizeId(id);
    if (!normalized) return;
    const list = readList();
    const next = list.filter((item) => item !== normalized);
    writeList(next);
    emitChange(next);
  },

  clear() {
    writeList([]);
    emitChange([]);
  },

  getList() {
    return readList();
  },

  /** @param {string} id */
  has(id) {
    const normalized = normalizeId(id);
    if (!normalized) return false;
    return readList().includes(normalized);
  },

  count() {
    return readList().length;
  },
};
