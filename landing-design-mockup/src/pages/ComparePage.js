import { getCarsForComparison } from "../db.js";
import { comparisonStore } from "../stores/comparisonStore.mjs";

const FALLBACK = "—";
const ROWS = [
  { label: "Цена покупки", getValue: (car) => car.purchasePrice },
  { label: "Год", getValue: (car) => String(car.title ?? "").match(/\b(19|20)\d{2}\b/u)?.[0] ?? "" },
  { label: "Пробег", getValue: (car) => car.mileage },
  { label: "Статус", getValue: (car) => car.status },
  { label: "Состояние", getValue: (car) => car.generalCondition },
  { label: "VIN", getValue: (car) => car.vin },
  { label: "Заметки", getValue: (car) => [car.desc1, car.desc2, car.desc3].find((v) => String(v ?? "").trim()) },
];

/** @param {unknown} value */
function formatValue(value) {
  if (value === null || value === undefined) return FALLBACK;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const text = String(value).trim();
  return text || FALLBACK;
}

/**
 * @param {HTMLElement} panel
 * @param {import("../db.js").GarageCar[]} cars
 * @param {(id: string) => void} onRemove
 */
function renderTable(panel, cars, onRemove) {
  const wrapper = document.createElement("div");
  wrapper.className =
    "mt-6 overflow-x-auto rounded-2xl border border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-900";
  const table = document.createElement("table");
  table.className = "min-w-[720px] w-full border-collapse text-sm";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const firstHead = document.createElement("th");
  firstHead.className =
    "sticky left-0 z-20 border-b border-ink-200 bg-ink-50 px-4 py-3 text-left font-semibold text-ink-700 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-200";
  firstHead.textContent = "Параметр";
  headRow.appendChild(firstHead);
  for (const car of cars) {
    const th = document.createElement("th");
    th.className =
      "border-b border-ink-200 bg-ink-50 px-4 py-3 text-left align-top font-semibold text-ink-900 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-100";
    th.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="truncate">${formatValue(car.title)}</p>
          <p class="mt-1 text-xs font-normal text-ink-500 dark:text-ink-400">${car.id}</p>
        </div>
      </div>
    `;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className =
      "rounded-full border border-ink-300 px-2 py-1 text-xs text-ink-700 transition hover:border-red-400 hover:text-red-600 dark:border-ink-600 dark:text-ink-200 dark:hover:border-red-500 dark:hover:text-red-300";
    closeBtn.textContent = "❌";
    closeBtn.setAttribute("aria-label", "Удалить авто из сравнения");
    closeBtn.addEventListener("click", () => onRemove(String(car.id)));
    th.firstElementChild?.appendChild(closeBtn);
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const row of ROWS) {
    const tr = document.createElement("tr");
    const values = cars.map((car) => formatValue(row.getValue(car)));
    const firstValue = values[0] ?? "";
    const isDifferent = values.some((value) => value !== firstValue);
    const cellDiffClass = isDifferent ? "bg-amber-100 dark:bg-amber-900/30" : "bg-transparent";

    const labelTd = document.createElement("td");
    labelTd.className =
      "sticky left-0 z-10 border-b border-ink-200 bg-ink-50 px-4 py-3 font-medium text-ink-700 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-200";
    labelTd.textContent = row.label;
    tr.appendChild(labelTd);

    values.forEach((value) => {
      const td = document.createElement("td");
      td.className = `border-b border-ink-200 px-4 py-3 text-ink-900 dark:border-ink-700 dark:text-ink-100 ${cellDiffClass}`;
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrapper.appendChild(table);
  panel.appendChild(wrapper);
}

/** @returns {{ panel: HTMLElement | null, tab: HTMLElement | null, refresh: () => Promise<void> }} */
export function mountComparePage() {
  const panel = document.querySelector('[data-site-panel="compare"]');
  const tab = document.querySelector('[data-site-tab="compare"]');
  if (!(panel instanceof HTMLElement)) {
    return { panel: null, tab: null, refresh: async () => {} };
  }

  const render = async () => {
    panel.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-display text-2xl font-medium tracking-tight text-ink-950 dark:text-white sm:text-3xl">Сравнение авто</h2>
          <p class="mt-2 text-sm text-ink-600 dark:text-ink-400">Выберите до ${comparisonStore.MAX_COMPARISON_ITEMS} автомобилей и сравните ключевые параметры.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" data-compare-clear class="rounded-lg border border-ink-300 px-3 py-2 text-sm text-ink-700 transition hover:border-ink-400 hover:text-ink-900 dark:border-ink-600 dark:text-ink-100 dark:hover:border-ink-500">Очистить всё</button>
          <button type="button" data-compare-close class="rounded-lg border border-ink-300 px-3 py-2 text-sm text-ink-700 transition hover:border-ink-400 hover:text-ink-900 dark:border-ink-600 dark:text-ink-100 dark:hover:border-ink-500">Закрыть</button>
        </div>
      </div>
      <div data-compare-body class="mt-4"></div>
    `;

    const body = panel.querySelector("[data-compare-body]");
    if (!(body instanceof HTMLElement)) return;

    const selectedIds = comparisonStore.getList();
    if (!selectedIds.length) {
      body.innerHTML =
        '<div class="rounded-xl border border-dashed border-ink-300 p-6 text-sm text-ink-600 dark:border-ink-600 dark:text-ink-300">Список сравнения пуст. Добавьте машины через кнопку "Сравнить" в карточке.</div>';
      return;
    }

    try {
      const cars = await getCarsForComparison(selectedIds);
      if (!cars.length) {
        body.innerHTML =
          '<div class="rounded-xl border border-dashed border-ink-300 p-6 text-sm text-ink-600 dark:border-ink-600 dark:text-ink-300">Выбранные машины не найдены в базе.</div>';
        return;
      }
      renderTable(body, cars, (id) => {
        comparisonStore.remove(id);
      });
    } catch (error) {
      console.error(error);
      body.innerHTML =
        '<div class="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">Ошибка сети при загрузке сравнения. Попробуйте снова.</div>';
    }
  };

  panel.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("[data-compare-clear]")) {
      comparisonStore.clear();
      return;
    }
    if (target.closest("[data-compare-close]")) {
      document.dispatchEvent(new CustomEvent("car-notes:open-tab", { detail: { tab: "" } }));
    }
  });

  document.addEventListener(comparisonStore.CHANGE_EVENT, () => {
    void render();
  });

  void render();
  return { panel, tab, refresh: render };
}
