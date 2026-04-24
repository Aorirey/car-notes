import { getAuthToken } from "../stores/auth.mjs";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

/**
 * @param {string} path
 * @returns {Promise<unknown>}
 */
async function apiGet(path) {
  const headers = new Headers();
  const token = getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_BASE}${path}`, { headers, cache: "no-store" });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

/**
 * @param {HTMLElement} mount
 * @param {string} carId
 */
export function mountFinanceCalculator(mount, carId) {
  const wrap = document.createElement("section");
  wrap.className = "rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900";
  wrap.innerHTML = `
    <h3 class="text-sm font-semibold text-ink-900 dark:text-ink-100">Калькулятор маржи</h3>
    <label class="mt-3 block text-xs text-ink-600 dark:text-ink-300">
      Цена продажи
      <input data-sale-price type="number" min="0" step="0.01" class="mt-1 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100" />
    </label>
    <div data-result class="mt-3 text-sm text-ink-700 dark:text-ink-200"></div>
  `;
  mount.appendChild(wrap);

  const input = wrap.querySelector("[data-sale-price]");
  const result = wrap.querySelector("[data-result]");
  if (!(input instanceof HTMLInputElement) || !(result instanceof HTMLDivElement)) return;

  let timer = null;
  const renderResult = (payload) => {
    result.textContent =
      `Себестоимость: ${payload.total_costs} | Чистая прибыль: ${payload.net_profit} | ` +
      `Маржа: ${payload.margin_pct}% | Точка безубыточности: ${payload.breakeven}`;
  };

  input.addEventListener("input", () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      const salePrice = Number(input.value || 0);
      try {
        const data = await apiGet(
          `/api/cars/${encodeURIComponent(carId)}/calc?sale_price=${encodeURIComponent(String(salePrice))}`,
        );
        renderResult(data);
      } catch (error) {
        console.error(error);
      }
    }, 250);
  });
}
