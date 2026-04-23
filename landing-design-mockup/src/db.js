/**
 * Слой данных гаража.
 *
 * - **Локальная разработка** (`npm run dev`, без VITE_USE_HTTP_DB): IndexedDB в браузере — Postgres не нужен.
 * - **Продакшен** (сборка после `vite build`): запросы на `/api` к Node-серверу (Render + DATABASE_URL).
 * - Принудительно HTTP в dev: в `.env` задайте `VITE_USE_HTTP_DB=true` и поднимите сервер с `DATABASE_URL`.
 * - Локальный prod-бандл без API: `VITE_FORCE_LOCAL_DB=true` при сборке (редко).
 *
 * @typedef {{
 *   id: string,
 *   title: string,
 *   createdAt: number,
 *   linkUrl?: string,
 *   legalStatus?: string,
 *   electrical?: string,
 *   rustWhere?: string,
 *   rustDegree?: string,
 *   chipsWhere?: string,
 *   chipsDamage?: string,
 *   damaged?: string,
 *   dentsWhere?: string,
 *   dentsDamage?: string,
 *   repaintWhere?: string,
 *   repaintDegree?: string,
 *   generalCondition?: string,
 *   desc1?: string,
 *   desc2?: string,
 *   desc3?: string,
 * }} GarageCar
 */

const useHttpApi =
  import.meta.env.VITE_USE_HTTP_DB === "true" ||
  (import.meta.env.PROD && import.meta.env.VITE_FORCE_LOCAL_DB !== "true");

/** @type {Promise<typeof import("./db/http.js")> | Promise<typeof import("./db/indexeddb.js")> | null} */
let implPromise = null;

function getImpl() {
  if (!implPromise) {
    implPromise = useHttpApi ? import("./db/http.js") : import("./db/indexeddb.js");
  }
  return implPromise;
}

/** @returns {Promise<GarageCar[]>} */
export async function getAllGarageCars() {
  return (await getImpl()).getAllGarageCars();
}

/** @param {string} id @returns {Promise<GarageCar | null>} */
export async function getGarageCar(id) {
  return (await getImpl()).getGarageCar(id);
}

/**
 * @param {{ title: string, linkUrl?: string }} payload
 * @returns {Promise<GarageCar>}
 */
export async function addGarageCar(payload) {
  return (await getImpl()).addGarageCar(payload);
}

/**
 * @param {string} id
 * @param {Partial<GarageCar>} patch
 */
export async function updateGarageCar(id, patch) {
  return (await getImpl()).updateGarageCar(id, patch);
}

/** @param {string} id */
export async function deleteGarageCar(id) {
  return (await getImpl()).deleteGarageCar(id);
}
