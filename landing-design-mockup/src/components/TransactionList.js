import { getAuthToken } from "../stores/auth.mjs";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

/**
 * @param {string} path
 * @param {RequestInit & { json?: unknown }} [opts]
 * @returns {Promise<unknown>}
 */
async function api(path, opts = {}) {
  const { json, ...init } = opts;
  const headers = new Headers(init.headers);
  const token = getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    body: json !== undefined ? JSON.stringify(json) : init.body,
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  if (res.status === 204) return undefined;
  return res.json();
}

/**
 * @param {HTMLElement} mount
 * @param {string} carId
 */
export function mountTransactionList(mount, carId) {
  const wrap = document.createElement("section");
  wrap.className = "rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900";
  wrap.innerHTML = `
    <h3 class="text-sm font-semibold text-ink-900 dark:text-ink-100">Транзакции</h3>
    <form data-form class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <select name="type" class="rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100">
        <option value="expense">Расход</option>
        <option value="income">Доход</option>
      </select>
      <input name="amount" type="number" min="0" step="0.01" placeholder="Сумма" class="rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100" />
      <input name="category" type="text" placeholder="Категория" class="rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100" />
      <input name="description" type="text" placeholder="Описание" class="rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100" />
      <button type="submit" class="btn bg-ink-900 px-3 py-2 text-sm text-white dark:bg-ink-100 dark:text-ink-900">Добавить</button>
    </form>
    <div data-summary class="mt-3 text-xs text-ink-600 dark:text-ink-300"></div>
    <div class="mt-3 overflow-auto">
      <table class="min-w-full text-left text-xs text-ink-700 dark:text-ink-200">
        <thead>
          <tr>
            <th class="px-2 py-1">Дата</th>
            <th class="px-2 py-1">Тип</th>
            <th class="px-2 py-1">Сумма</th>
            <th class="px-2 py-1">Категория</th>
            <th class="px-2 py-1">Описание</th>
          </tr>
        </thead>
        <tbody data-body></tbody>
      </table>
    </div>
  `;
  mount.appendChild(wrap);

  const form = wrap.querySelector("[data-form]");
  const body = wrap.querySelector("[data-body]");
  const summary = wrap.querySelector("[data-summary]");
  if (!(form instanceof HTMLFormElement) || !(body instanceof HTMLElement) || !(summary instanceof HTMLElement)) {
    return;
  }

  const renderRows = (rows) => {
    const frag = document.createDocumentFragment();
    for (const row of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="px-2 py-1">${new Date(row.date).toLocaleString("ru-RU")}</td>
        <td class="px-2 py-1">${row.type}</td>
        <td class="px-2 py-1">${row.amount}</td>
        <td class="px-2 py-1">${row.category ?? ""}</td>
        <td class="px-2 py-1">${row.description ?? ""}</td>
      `;
      frag.appendChild(tr);
    }
    body.replaceChildren(frag);
  };

  const load = async () => {
    try {
      const payload = await api(`/api/cars/${encodeURIComponent(carId)}/finance`);
      renderRows(Array.isArray(payload.transactions) ? payload.transactions : []);
      const s = payload.summary ?? {};
      summary.textContent = `Расходы: ${s.total_expenses ?? 0} | Доходы: ${s.total_incomes ?? 0} | Поток: ${s.net_flow ?? 0}`;
    } catch (error) {
      console.error(error);
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const amount = Number(fd.get("amount"));
    if (!Number.isFinite(amount) || amount < 0) return;
    try {
      await api(`/api/cars/${encodeURIComponent(carId)}/finance`, {
        method: "POST",
        json: {
          type: String(fd.get("type") ?? "expense"),
          amount,
          category: String(fd.get("category") ?? ""),
          description: String(fd.get("description") ?? ""),
        },
      });
      form.reset();
      await load();
    } catch (error) {
      console.error(error);
    }
  });

  void load();
}
