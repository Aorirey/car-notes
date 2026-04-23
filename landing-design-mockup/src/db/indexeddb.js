/**
 * Локальный гараж в IndexedDB (режим `npm run dev` без PostgreSQL).
 */

const DB_NAME = "car_notes_garage";
const DB_VERSION = 1;
const STORE = "cars";

function openGarageDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
  });
}

/** @returns {Promise<object[]>} */
export async function getAllGarageCars() {
  const db = await openGarageDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    r.onsuccess = () => {
      const rows = r.result || [];
      rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      resolve(rows);
    };
    r.onerror = () => reject(r.error);
  });
}

/** @param {string} id */
export async function getGarageCar(id) {
  const db = await openGarageDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
}

/**
 * @param {{ title: string, linkUrl?: string }} payload
 * @returns {Promise<object>}
 */
export async function addGarageCar(payload) {
  const db = await openGarageDb();
  const linkUrl = String(payload.linkUrl || "").trim();
  const row = {
    id: crypto.randomUUID(),
    title: String(payload.title || "").trim(),
    createdAt: Date.now(),
    linkUrl: linkUrl || "",
    legalStatus: "",
    electrical: "",
    rustWhere: "",
    rustDegree: "",
    chipsWhere: "",
    chipsDamage: "",
    damaged: "",
    dentsWhere: "",
    dentsDamage: "",
    repaintWhere: "",
    repaintDegree: "",
    generalCondition: "",
    desc1: "",
    desc2: "",
    desc3: "",
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve(row);
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).add(row);
  });
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} patch
 */
export async function updateGarageCar(id, patch) {
  const prev = await getGarageCar(id);
  if (!prev) throw new Error("Car not found");
  Object.assign(prev, patch);
  const db = await openGarageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(prev);
  });
}

/** @param {string} id */
export async function deleteGarageCar(id) {
  const db = await openGarageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete(id);
  });
}
