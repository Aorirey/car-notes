const STATUS_STYLES = {
  found: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
  negotiating: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  bought: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200",
  repair: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  for_sale: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  sold: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  archive: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
};

const STATUS_LABELS = {
  found: "Найдена",
  negotiating: "Торг",
  bought: "Куплена",
  repair: "Ремонт",
  for_sale: "На продаже",
  sold: "Продана",
  archive: "Архив",
};

/**
 * @param {string} status
 * @returns {HTMLSpanElement}
 */
export function createCarStatusBadge(status) {
  const key = typeof status === "string" && status in STATUS_LABELS ? status : "found";
  const badge = document.createElement("span");
  badge.className = [
    "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
    STATUS_STYLES[key],
  ].join(" ");
  badge.textContent = STATUS_LABELS[key];
  return badge;
}
