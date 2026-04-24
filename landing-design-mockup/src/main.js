import "./input.css";
import site from "./site.config.js";
import {
  addGarageCar,
  deleteGarageCar,
  getGarageCar,
  getAllGarageCars,
  updateGarageCar,
} from "./db.js";
import { buildCarMetaBlock } from "./pages/CarsPage.js";
import { mountNotificationBell } from "./components/NotificationBell.js";
import { mountComparePage } from "./pages/ComparePage.js";
import { comparisonStore } from "./stores/comparisonStore.mjs";

const GARAGE_BC_NAME = "car-notes-garage-sync";

/** @type {BroadcastChannel | null} */
let garageBroadcast = null;
try {
  if (typeof BroadcastChannel !== "undefined") {
    garageBroadcast = new BroadcastChannel(GARAGE_BC_NAME);
    garageBroadcast.addEventListener("message", (ev) => {
      if (ev.data?.type === "invalidate") void renderGarageCards();
    });
  }
} catch {
  garageBroadcast = null;
}

function broadcastGarageInvalidate() {
  try {
    garageBroadcast?.postMessage({ type: "invalidate" });
  } catch {
    /* ignore */
  }
}

/** Счётчик гонок: не применять устаревший ответ GET после параллельных renderGarageCards. */
let garageRenderSeq = 0;
let comparePageApi = null;

/** @param {unknown} input */
function normalizeExternalUrl(input) {
  const s = String(input ?? "").trim();
  if (!s) return "";
  let u;
  try {
    u = new URL(s);
  } catch {
    try {
      u = new URL(`https://${s.replace(/^\/+/, "")}`);
    } catch {
      return "";
    }
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "";
  return u.href;
}

/** @param {unknown} input */
function normalizePriceText(input) {
  const digits = String(input ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ru-RU");
}

/** @param {unknown} input */
function normalizeMileageText(input) {
  const digits = String(input ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ru-RU");
}


function metaThemeKey() {
  const el = document.querySelector('meta[name="theme-storage-key"]');
  return (el && el.getAttribute("content")) || site.themeStorageKey;
}

function bgmVolumeStorageKey() {
  return `${metaThemeKey()}:bgm-volume`;
}

/** @param {number} fallback 0…1 */
function readStoredBgmVolume(fallback) {
  try {
    const raw = localStorage.getItem(bgmVolumeStorageKey());
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
  } catch {
    /* ignore */
  }
  return fallback;
}

/** @param {number} v 0…1 */
function writeStoredBgmVolume(v) {
  try {
    localStorage.setItem(bgmVolumeStorageKey(), String(v));
  } catch {
    /* ignore */
  }
}

function applySite() {
  document.title = site.seo.title;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", site.seo.description);

  document.querySelectorAll("[data-brand]").forEach((el) => {
    el.textContent = site.brandName;
  });

  const logoRoot = document.querySelector("[data-logo-link]");
  if (logoRoot) {
    logoRoot.setAttribute("href", site.links.logo);
    logoRoot.setAttribute("aria-label", site.brandName);
  }

  const map = {
    "link-purchased": site.links.purchased,
    "link-sold": site.links.sold,
    "link-summary": site.links.summary,
    "link-discover": site.links.discover,
    "link-showcase-all": site.links.showcaseAll,
  };
  Object.entries(map).forEach(([attr, href]) => {
    document.querySelectorAll(`[data-${attr}]`).forEach((el) => {
      el.setAttribute("href", href || "#");
    });
  });

  document.querySelectorAll("[data-link-product]").forEach((el) => {
    el.setAttribute("href", site.links.product || "#");
  });

  const chip = document.querySelector("[data-copy-hero-chip]");
  if (chip) chip.textContent = site.copy.heroChip;

  const setText = (sel, text) => {
    const n = document.querySelector(sel);
    if (n && text != null) n.textContent = text;
  };
  setText("[data-copy-hero-cta-primary]", site.copy.heroCtaPrimary);
}

function wireTheme() {
  const key = metaThemeKey();
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const d = document.documentElement;
    const dark = d.classList.toggle("dark");
    d.style.colorScheme = dark ? "dark" : "light";
    try {
      localStorage.setItem(key, dark ? "dark" : "light");
    } catch {
      /* ignore */
    }
  });
}

function fillSelect(select, options) {
  select.innerHTML = "";
  for (const { value, label } of options) {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    select.appendChild(o);
  }
}

/**
 * @param {unknown} where
 * @param {unknown} degree
 * @param {string} title
 */
function formatWhereDegree(where, degree, title) {
  const w = where != null ? String(where).trim() : "";
  const d = degree != null ? String(degree).trim() : "";
  if (!w && !d) return "";
  if (w && d) return `${title}: ${w} — ${d}`;
  if (w) return `${title}: ${w}`;
  return `${title}: ${d}`;
}

/** @param {import("./db.js").GarageCar} car */
function carDescriptionPreviewLines(car) {
  const cfg = site.addDescriptionModal;
  const lines = [];
  const labelFor = (opts, val) => {
    const o = opts?.find((x) => x.value === val);
    return o?.label?.trim() || "";
  };

  if (car.legalStatus === "clean") {
    const lab = labelFor(cfg.legalOptions, "clean");
    lines.push(lab ? `Юр. состояние: ${lab}` : "Юр. состояние: чистая");
  } else if (car.legalStatus === "not_clean") {
    const lab = labelFor(cfg.legalOptions, "not_clean");
    lines.push(lab ? `Юр. состояние: ${lab}` : "Юр. состояние: нечистая");
  }

  const electrical = car.electrical != null ? String(car.electrical).trim() : "";
  if (electrical) lines.push(`Электрика: ${electrical}`);
  const color = car.color != null ? String(car.color).trim() : "";
  if (color) lines.push(`Цвет: ${color}`);

  const rust = formatWhereDegree(car.rustWhere, car.rustDegree, "Ржавчина");
  if (rust) lines.push(rust);
  const chips = formatWhereDegree(car.chipsWhere, car.chipsDamage, "Сколы");
  if (chips) lines.push(chips);

  if (car.damaged === "yes") {
    const lab = labelFor(cfg.damagedOptions, "yes");
    lines.push(lab ? `Битая: ${lab}` : "Битая: да");
  } else if (car.damaged === "no") {
    const lab = labelFor(cfg.damagedOptions, "no");
    lines.push(lab ? `Битая: ${lab}` : "Битая: нет");
  }

  const dents = formatWhereDegree(car.dentsWhere, car.dentsDamage, "Вмятины");
  if (dents) lines.push(dents);
  const repaint = formatWhereDegree(car.repaintWhere, car.repaintDegree, "Крашена");
  if (repaint) lines.push(repaint);

  const general = car.generalCondition != null ? String(car.generalCondition).trim() : "";
  if (general) lines.push(`Общее состояние: ${general}`);

  const legacy = [car.desc1, car.desc2, car.desc3]
    .map((x) => (x != null ? String(x).trim() : ""))
    .filter(Boolean);
  if (!lines.length && legacy.length) return legacy;
  return lines;
}

/** @param {import("./db.js").GarageCar} car */
function carListingStatus(car) {
  const s = car.listingStatus != null ? String(car.listingStatus).trim() : "";
  if (s === "purchased" || s === "sold") return s;
  return "listed";
}

/** @param {unknown} input */
function parseMoneyAmount(input) {
  const digits = String(input ?? "").replace(/[^\d]/g, "");
  if (!digits) return 0;
  return Number.parseInt(digits, 10) || 0;
}

/** @param {number} amount */
function formatMoneyAmount(amount) {
  return `${Math.trunc(amount).toLocaleString("ru-RU")} ₽`;
}

/**
 * @param {HTMLElement | null} mount
 * @param {number} target
 */
function animateMoneyCounter(mount, target) {
  if (!(mount instanceof HTMLElement)) return;
  const finalValue = Math.max(0, Math.trunc(target));
  const duration = 1200;
  const start = performance.now();
  const easeOutCubic = (t) => 1 - (1 - t) ** 3;

  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const current = Math.round(finalValue * easeOutCubic(progress));
    mount.textContent = formatMoneyAmount(current);
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * @param {import("./db.js").GarageCar[]} soldCars
 */
function renderSummaryPanel(soldCars) {
  const panel = document.querySelector('[data-site-panel="summary"]');
  if (!(panel instanceof HTMLElement)) return;
  const cars = Array.isArray(soldCars) ? soldCars : [];
  let totalSale = 0;
  let totalPurchase = 0;
  let totalInvested = 0;
  for (const car of cars) {
    totalSale += parseMoneyAmount(car.salePrice);
    totalPurchase += parseMoneyAmount(car.purchasePrice);
    totalInvested += parseMoneyAmount(car.investedAmount);
  }
  const totalProfit = totalSale - totalPurchase - totalInvested;
  const goalAmount = 1200000;
  const amountLeft = Math.max(0, goalAmount - totalProfit);
  panel.innerHTML = `
    <h2 class="font-display text-2xl font-medium tracking-tight text-ink-950 dark:text-white sm:text-3xl">
      Итоги
    </h2>
    <p class="mt-2 max-w-3xl text-sm text-ink-600 dark:text-ink-400">
      Чистая прибыль считается по проданным машинам: сумма продажи - сумма покупки - вложения.
    </p>
    <div class="mt-8 flex min-h-[38vh] items-center justify-center">
      <div class="w-full max-w-3xl rounded-3xl border border-accent-200/70 bg-gradient-to-br from-accent-100/70 via-white to-accent-50 p-8 text-center shadow-lg dark:border-accent-500/30 dark:from-accent-900/30 dark:via-ink-900 dark:to-ink-900">
        <p class="text-base font-medium uppercase tracking-wide text-ink-700 dark:text-ink-200 sm:text-lg">
          До Ляма двести осталось:
        </p>
        <p
          data-summary-goal-left
          class="mt-4 font-display text-4xl font-semibold tracking-tight text-accent-700 drop-shadow-sm dark:text-accent-300 sm:text-6xl"
        >
          ${formatMoneyAmount(amountLeft)}
        </p>
      </div>
    </div>
    <div class="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <article class="rounded-2xl border border-ink-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
        <p class="text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">Продано авто</p>
        <p class="mt-2 text-2xl font-semibold text-ink-950 dark:text-white">${cars.length}</p>
      </article>
      <article class="rounded-2xl border border-ink-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
        <p class="text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">Сумма продаж</p>
        <p class="mt-2 text-2xl font-semibold text-ink-950 dark:text-white">${formatMoneyAmount(totalSale)}</p>
      </article>
      <article class="rounded-2xl border border-ink-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
        <p class="text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">Затраты</p>
        <p class="mt-2 text-2xl font-semibold text-ink-950 dark:text-white">${formatMoneyAmount(totalPurchase + totalInvested)}</p>
      </article>
      <article class="rounded-2xl border border-ink-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
        <p class="text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">Чистая прибыль</p>
        <p class="mt-2 text-2xl font-semibold ${
          totalProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        }">${formatMoneyAmount(totalProfit)}</p>
      </article>
    </div>
  `;
  animateMoneyCounter(panel.querySelector("[data-summary-goal-left]"), amountLeft);
}

/** @param {HTMLElement} article @param {string} id */
function applyCompareCardState(article, id) {
  const active = comparisonStore.has(id);
  article.classList.toggle("ring-2", active);
  article.classList.toggle("ring-accent-400", active);
}

function mountComparisonIndicator() {
  let root = document.querySelector("[data-compare-indicator]");
  if (root instanceof HTMLElement) return root;
  root = document.createElement("div");
  root.setAttribute("data-compare-indicator", "");
  root.className = "fixed bottom-4 right-4 z-40 hidden";
  root.innerHTML = `
    <div class="rounded-xl border border-ink-300 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-ink-700 dark:bg-ink-900/95">
      <div class="flex items-center gap-3">
        <p data-compare-count class="text-sm font-medium text-ink-900 dark:text-ink-100">Сравнение (0/4)</p>
        <button type="button" data-open-compare class="rounded-lg bg-accent-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-accent-600">
          Открыть
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("[data-open-compare]")) {
      document.dispatchEvent(new CustomEvent("car-notes:open-tab", { detail: { tab: "compare" } }));
    }
  });
  return root;
}

function renderComparisonIndicator() {
  const root = mountComparisonIndicator();
  const countEl = root.querySelector("[data-compare-count]");
  if (!(countEl instanceof HTMLElement)) return;
  const count = comparisonStore.count();
  countEl.textContent = `Сравнение (${count}/${comparisonStore.MAX_COMPARISON_ITEMS})`;
  root.classList.toggle("hidden", count <= 0);
}

/**
 * @param {import("./db.js").GarageCar} car
 * @param {"listed" | "purchased" | "sold"} listKind
 */
function createCarCardElement(car, listKind) {
  const article = document.createElement("article");
  article.className =
    "car-card relative flex h-full min-h-[220px] flex-col overflow-hidden rounded-2xl border border-ink-200 bg-gradient-to-br from-ink-950 via-ink-900 to-ink-800 p-5 text-white dark:border-ink-700 sm:p-6";
  article.dataset.carId = car.id;
  article.setAttribute("aria-label", car.title);
  applyCompareCardState(article, car.id);

  const noise = document.createElement("div");
  noise.className = "noise opacity-30";

  const orb = document.createElement("div");
  orb.setAttribute("aria-hidden", "true");
  orb.className =
    "pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-accent-500/35 blur-2xl";

  const inner = document.createElement("div");
  inner.className = "relative z-10 flex min-h-0 flex-1 flex-col";

  const head = document.createElement("div");
  head.className = "flex items-start justify-between gap-2";

  const headMain = document.createElement("div");
  headMain.className = "min-w-0 flex-1";
  headMain.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-accent-300" aria-hidden="true">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  `;

  const h2 = document.createElement("h2");
  h2.className =
    "mt-2 font-display text-lg font-medium leading-snug tracking-tight text-white sm:text-xl";
  h2.textContent = car.title;
  headMain.appendChild(h2);

  const linkHref = car.linkUrl != null ? String(car.linkUrl).trim() : "";
  if (linkHref) {
    const ext = document.createElement("a");
    ext.href = linkHref;
    ext.target = "_blank";
    ext.rel = "noopener noreferrer";
    ext.className =
      "mt-2 inline-flex max-w-full items-center gap-1 truncate text-xs font-medium text-accent-300 underline-offset-2 hover:text-white hover:underline sm:text-sm";
    ext.textContent = site.addCarModal?.linkCardLabel ?? "Открыть ссылку";
    headMain.appendChild(ext);
  }

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.dataset.deleteCar = "";
  delBtn.setAttribute("aria-label", "Удалить карточку");
  delBtn.className =
    "btn shrink-0 rounded-full border border-white/25 bg-white/10 p-2 text-white transition hover:border-red-400/80 hover:bg-red-600/90 hover:text-white";
  delBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  `;

  head.appendChild(headMain);
  head.appendChild(delBtn);
  inner.appendChild(head);
  inner.appendChild(buildCarMetaBlock(car));

  const purchaseStr = car.purchasePrice != null ? String(car.purchasePrice).trim() : "";
  const saleStr = car.salePrice != null ? String(car.salePrice).trim() : "";
  const investedStr = car.investedAmount != null ? String(car.investedAmount).trim() : "";
  if (purchaseStr || saleStr || investedStr) {
    const sums = document.createElement("div");
    sums.className =
      "mt-2 space-y-0.5 text-left text-xs text-accent-200 sm:text-sm";
    if (purchaseStr) {
      const p = document.createElement("p");
      p.textContent = `Куплено за: ${purchaseStr}`;
      sums.appendChild(p);
    }
    if (saleStr) {
      const p = document.createElement("p");
      p.textContent = `Продано за: ${saleStr}`;
      sums.appendChild(p);
    }
    if (investedStr) {
      const p = document.createElement("p");
      p.textContent = `Вложено: ${investedStr}`;
      sums.appendChild(p);
    }
    inner.appendChild(sums);
  }

  const descLines = carDescriptionPreviewLines(car);
  if (descLines.length) {
    const meta = document.createElement("p");
    meta.className =
      "mt-2 line-clamp-4 text-left text-xs leading-relaxed text-ink-200 sm:text-sm";
    meta.textContent = descLines.join(" · ");
    inner.appendChild(meta);
  }

  const actions = document.createElement("div");
  actions.className = "mt-auto flex flex-wrap items-center gap-2 pt-4";
  const compareBtn = document.createElement("button");
  compareBtn.type = "button";
  compareBtn.dataset.compareToggle = "";
  compareBtn.className =
    "btn inline-flex items-center gap-2 border border-white/35 bg-white/15 px-3 py-2 text-xs text-white hover:border-accent-400 hover:bg-accent-500 hover:text-white sm:text-sm";
  compareBtn.innerHTML = `
    <span class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current/40 bg-white/10">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" class="h-3.5 w-3.5" aria-hidden="true">
        <path d="M8 3.25V12.75" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
        <path d="M3.25 8H12.75" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
      </svg>
    </span>
    <span>Сравнить</span>
  `;
  const alreadyInCompare = comparisonStore.has(car.id);
  if (alreadyInCompare) {
    compareBtn.classList.add("border-accent-300", "bg-accent-500/80");
    compareBtn.innerHTML = `
      <span class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/40 bg-white/20">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
          <path fill-rule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.06 7.12a1 1 0 0 1-1.418.006l-3.94-3.91a1 1 0 1 1 1.41-1.42l3.23 3.204 6.355-6.41a1 1 0 0 1 1.417-.004Z" clip-rule="evenodd" />
        </svg>
      </span>
      <span>В сравнении</span>
    `;
  } else if (comparisonStore.count() >= comparisonStore.MAX_COMPARISON_ITEMS) {
    compareBtn.title = "Максимум 4 авто для сравнения";
  }
  actions.appendChild(compareBtn);
  const descBtn = document.createElement("button");
  descBtn.type = "button";
  descBtn.dataset.openAddDescription = "";
  descBtn.className =
    "btn border border-white/35 bg-white/15 px-3 py-2 text-xs text-white hover:border-accent-400 hover:bg-accent-500 hover:text-white sm:text-sm";
  descBtn.textContent =
    site.addDescriptionModal?.openButtonLabel ?? "Добавить описание";
  actions.appendChild(descBtn);

  const deal = site.dealFlow ?? {};
  if (listKind === "listed") {
    const buyBtn = document.createElement("button");
    buyBtn.type = "button";
    buyBtn.dataset.openPurchasePrice = "";
    buyBtn.className =
      "btn border border-white/35 bg-white/15 px-3 py-2 text-xs text-white hover:border-accent-400 hover:bg-accent-500 hover:text-white sm:text-sm";
    buyBtn.textContent = deal.boughtButton ?? "Куплено";
    actions.appendChild(buyBtn);
  } else if (listKind === "purchased") {
    const soldBtn = document.createElement("button");
    soldBtn.type = "button";
    soldBtn.dataset.openSalePrice = "";
    soldBtn.className =
      "btn border border-white/35 bg-white/15 px-3 py-2 text-xs text-white hover:border-accent-400 hover:bg-accent-500 hover:text-white sm:text-sm";
    soldBtn.textContent = deal.soldButton ?? "Продано";
    actions.appendChild(soldBtn);
  }

  inner.appendChild(actions);

  article.append(noise, orb, inner);
  return article;
}

async function renderGarageCards() {
  const section = document.getElementById("user-car-cards-section");
  const listListed = document.getElementById("user-car-cards-list");
  const listPurchased = document.getElementById("purchased-car-cards-list");
  const listSold = document.getElementById("sold-car-cards-list");
  const emptyPurchased = document.getElementById("purchased-empty-hint");
  const emptySold = document.getElementById("sold-empty-hint");
  if (!section || !listListed || !listPurchased || !listSold) return;
  const seq = ++garageRenderSeq;
  let cars;
  try {
    cars = await getAllGarageCars();
  } catch (err) {
    console.error(err);
    return;
  }
  if (seq !== garageRenderSeq) return;
  if (!Array.isArray(cars)) {
    console.error("getAllGarageCars: ожидался массив");
    return;
  }
  /** @type {import("./db.js").GarageCar[]} */
  const listed = [];
  /** @type {import("./db.js").GarageCar[]} */
  const purchased = [];
  /** @type {import("./db.js").GarageCar[]} */
  const sold = [];
  for (const car of cars) {
    if (!car) continue;
    const idStr = car.id != null ? String(car.id).trim() : "";
    if (!idStr) continue;
    const row = { ...car, id: idStr };
    const st = carListingStatus(row);
    if (st === "sold") sold.push(row);
    else if (st === "purchased") purchased.push(row);
    else listed.push(row);
  }
  /** @param {HTMLElement} el @param {import("./db.js").GarageCar[]} arr @param {"listed" | "purchased" | "sold"} kind */
  function fillList(el, arr, kind) {
    const frag = document.createDocumentFragment();
    for (const c of arr) {
      try {
        frag.appendChild(createCarCardElement(c, kind));
      } catch (err) {
        console.error("createCarCardElement", c.id, err);
      }
    }
    el.replaceChildren(frag);
  }
  fillList(listListed, listed, "listed");
  fillList(listPurchased, purchased, "purchased");
  fillList(listSold, sold, "sold");
  renderSummaryPanel(sold);
  if (listed.length) section.classList.remove("hidden");
  else section.classList.add("hidden");
  emptyPurchased?.classList.toggle("hidden", purchased.length > 0);
  emptySold?.classList.toggle("hidden", sold.length > 0);
}

async function appendCarCard({ title, linkUrl = "", purchasePrice = "", mileage = null }) {
  await addGarageCar({ title, linkUrl, purchasePrice, mileage });
  await renderGarageCards();
  broadcastGarageInvalidate();
  const list = document.getElementById("user-car-cards-list");
  list?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function wireGarageCardActions() {
  const lists = document.querySelectorAll(".js-car-cards-list");
  if (!lists.length) return;
  const onClick = async (e) => {
    const compareToggle = e.target.closest("[data-compare-toggle]");
    if (compareToggle) {
      const card = compareToggle.closest(".car-card");
      const id = card?.dataset.carId;
      if (!id) return;
      if (comparisonStore.has(id)) {
        comparisonStore.remove(id);
      } else {
        const added = comparisonStore.add(id);
        if (!added) {
          compareToggle.setAttribute("title", "Максимум 4 авто для сравнения");
        }
      }
      await renderGarageCards();
      if (comparePageApi?.refresh) {
        await comparePageApi.refresh();
      }
      return;
    }

    const del = e.target.closest("[data-delete-car]");
    if (!del) return;
    const card = del.closest(".car-card");
    const id = card?.dataset.carId;
    if (!id) return;
    if (!window.confirm("Удалить эту карточку?")) return;
    try {
      await deleteGarageCar(id);
      comparisonStore.remove(id);
      await renderGarageCards();
      broadcastGarageInvalidate();
      if (comparePageApi?.refresh) {
        await comparePageApi.refresh();
      }
    } catch (err) {
      console.error(err);
    }
  };
  lists.forEach((list) => list.addEventListener("click", onClick));
}

function wireAddCarModal() {
  const cfg = site.addCarModal;
  const dialog = document.getElementById("add-car-dialog");
  const openBtns = document.querySelectorAll("[data-add-car-open]");
  const brand = document.getElementById("modal-car-brand");
  const model = document.getElementById("modal-car-model");
  const year = document.getElementById("modal-car-year");
  const link = document.getElementById("modal-car-link");
  const purchasePrice = document.getElementById("modal-car-purchase-price");
  const mileage = document.getElementById("modal-car-mileage");
  const form = document.getElementById("add-car-form");
  if (
    !cfg ||
    !dialog ||
    !openBtns.length ||
    !brand ||
    !model ||
    !year ||
    !form ||
    !purchasePrice ||
    !mileage
  ) {
    return;
  }

  const title = dialog.querySelector("[data-modal-title]");
  if (title) title.textContent = cfg.title;

  const lbBrand = dialog.querySelector("[data-modal-label-brand]");
  const lbModel = dialog.querySelector("[data-modal-label-model]");
  const lbYear = dialog.querySelector("[data-modal-label-year]");
  const lbLink = dialog.querySelector("[data-modal-label-link]");
  const linkHint = dialog.querySelector("[data-modal-link-hint]");
  if (lbBrand) lbBrand.textContent = cfg.brandLabel;
  if (lbModel) lbModel.textContent = cfg.modelLabel;
  if (lbYear) lbYear.textContent = cfg.yearLabel;
  if (lbLink) lbLink.textContent = cfg.linkLabel ?? "Ссылка";
  if (link && cfg.linkPlaceholder != null) link.placeholder = cfg.linkPlaceholder;
  if (linkHint) linkHint.textContent = cfg.linkHint ?? "";
  const lbPurchasePrice = dialog.querySelector("[data-modal-label-purchase-price]");
  if (lbPurchasePrice) lbPurchasePrice.textContent = "Цена покупки";
  const lbMileage = dialog.querySelector("[data-modal-label-mileage]");
  if (lbMileage) lbMileage.textContent = "Пробег (км)";

  const cancelBtn = dialog.querySelector("[data-modal-cancel-text]");
  const saveBtn = dialog.querySelector("[data-modal-save-text]");
  if (cancelBtn) cancelBtn.textContent = cfg.cancelLabel;
  if (saveBtn) saveBtn.textContent = cfg.saveLabel;

  function yearsOptionsForModel(modelKey) {
    const yb = cfg.yearsByModel;
    if (!modelKey || !yb || !yb[modelKey]) {
      return [{ value: "", label: "Сначала выберите модель" }];
    }
    const range = yb[modelKey];
    const from = range?.from;
    const to = range?.to;
    if (from == null || to == null || from > to) {
      return [{ value: "", label: "Сначала выберите модель" }];
    }
    const out = [{ value: "", label: "Год выпуска" }];
    for (let y = to; y >= from; y -= 1) {
      out.push({ value: String(y), label: String(y) });
    }
    return out;
  }

  function syncYears() {
    fillSelect(year, yearsOptionsForModel(model.value || ""));
  }

  function syncModels() {
    const key = brand.value || "";
    const list = cfg.modelsByBrand[key] ?? cfg.modelsByBrand[""];
    fillSelect(model, list);
    syncYears();
  }

  function applySingleBrandDefault() {
    const withValue = cfg.brands.filter((b) => b.value);
    if (withValue.length === 1) {
      brand.value = withValue[0].value;
      syncModels();
    }
  }

  function resetModalForm() {
    fillSelect(brand, cfg.brands);
    syncModels();
    applySingleBrandDefault();
    if (link) link.value = "";
    purchasePrice.value = "";
    mileage.value = "";
  }

  resetModalForm();
  brand.addEventListener("change", syncModels);
  model.addEventListener("change", syncYears);
  purchasePrice.addEventListener("blur", () => {
    purchasePrice.value = normalizePriceText(purchasePrice.value);
  });
  mileage.addEventListener("blur", () => {
    mileage.value = normalizeMileageText(mileage.value);
  });

  openBtns.forEach((openBtn) => {
    openBtn.addEventListener("click", () => {
      resetModalForm();
      dialog.showModal();
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const b = brand.options[brand.selectedIndex]?.text?.trim() ?? "";
    const m = model.options[model.selectedIndex]?.text?.trim() ?? "";
    const y = year.options[year.selectedIndex]?.text?.trim() ?? "";
    if (!b || !m || !y) return;
    if (b.startsWith("Выберите") || m.startsWith("Выберите") || m.startsWith("Сначала")) return;
    if (y === "Год выпуска" || y.startsWith("Сначала")) return;

    const rawLink = link?.value?.trim() ?? "";
    const linkUrl = normalizeExternalUrl(rawLink);
    if (rawLink && !linkUrl) {
      window.alert(
        "Укажите корректную ссылку (адрес с http или https) или оставьте поле пустым.",
      );
      return;
    }

    const normalizedPurchasePrice = normalizePriceText(purchasePrice.value);
    const normalizedMileageText = normalizeMileageText(mileage.value);
    const normalizedMileage = normalizedMileageText
      ? Number.parseInt(normalizedMileageText.replace(/[^\d]/g, ""), 10)
      : null;

    try {
      await appendCarCard({
        title: `${b} · ${m} · ${y}`,
        linkUrl,
        purchasePrice: normalizedPurchasePrice,
        mileage: Number.isFinite(normalizedMileage) ? normalizedMileage : null,
      });
      dialog.close();
      resetModalForm();
    } catch (err) {
      console.error(err);
    }
  });

  dialog.querySelectorAll("[data-modal-close]").forEach((btn) => {
    btn.addEventListener("click", () => dialog.close());
  });

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
}

function wireAddDescriptionModal() {
  const cfg = site.addDescriptionModal;
  const dialog = document.getElementById("add-description-dialog");
  const descLists = document.querySelectorAll(".js-car-cards-list");
  const form = document.getElementById("add-description-form");
  const legal = document.getElementById("desc-legal");
  const electrical = document.getElementById("desc-electrical");
  const color = document.getElementById("desc-color");
  const rustWhere = document.getElementById("desc-rust-where");
  const rustDegree = document.getElementById("desc-rust-degree");
  const chipsWhere = document.getElementById("desc-chips-where");
  const chipsDamage = document.getElementById("desc-chips-damage");
  const damaged = document.getElementById("desc-damaged");
  const dentsWhere = document.getElementById("desc-dents-where");
  const dentsDamage = document.getElementById("desc-dents-damage");
  const repaintWhere = document.getElementById("desc-repaint-where");
  const repaintDegree = document.getElementById("desc-repaint-degree");
  const general = document.getElementById("desc-general");
  if (
    !cfg ||
    !dialog ||
    !descLists.length ||
    !form ||
    !legal ||
    !electrical ||
    !color ||
    !rustWhere ||
    !rustDegree ||
    !chipsWhere ||
    !chipsDamage ||
    !damaged ||
    !dentsWhere ||
    !dentsDamage ||
    !repaintWhere ||
    !repaintDegree ||
    !general
  ) {
    return;
  }

  let descriptionContextCarId = null;

  const titleEl = dialog.querySelector("[data-desc-modal-title]");
  if (titleEl) titleEl.textContent = cfg.title;

  const cancelBtn = dialog.querySelector("[data-desc-cancel-text]");
  const saveBtn = dialog.querySelector("[data-desc-save-text]");
  if (cancelBtn) cancelBtn.textContent = cfg.cancelLabel;
  if (saveBtn) saveBtn.textContent = cfg.saveLabel;

  const carLine = dialog.querySelector("[data-desc-car-line]");

  function resetDescForm() {
    fillSelect(legal, cfg.legalOptions || [{ value: "", label: "—" }]);
    fillSelect(damaged, cfg.damagedOptions || [{ value: "", label: "—" }]);
    electrical.value = "";
    color.value = "";
    rustWhere.value = "";
    rustDegree.value = "";
    chipsWhere.value = "";
    chipsDamage.value = "";
    dentsWhere.value = "";
    dentsDamage.value = "";
    repaintWhere.value = "";
    repaintDegree.value = "";
    general.value = "";
  }

  /** @param {import("./db.js").GarageCar | null} car */
  function loadCarIntoForm(car) {
    resetDescForm();
    if (!car) return;
    legal.value = car.legalStatus ?? "";
    electrical.value = car.electrical ?? "";
    color.value = car.color ?? "";
    rustWhere.value = car.rustWhere ?? "";
    rustDegree.value = car.rustDegree ?? "";
    chipsWhere.value = car.chipsWhere ?? "";
    chipsDamage.value = car.chipsDamage ?? "";
    damaged.value = car.damaged ?? "";
    dentsWhere.value = car.dentsWhere ?? "";
    dentsDamage.value = car.dentsDamage ?? "";
    repaintWhere.value = car.repaintWhere ?? "";
    repaintDegree.value = car.repaintDegree ?? "";
    general.value = car.generalCondition ?? "";
  }

  function clearCarLine() {
    if (!carLine) return;
    carLine.textContent = "";
    carLine.classList.add("hidden");
  }

  resetDescForm();

  dialog.addEventListener("close", () => {
    descriptionContextCarId = null;
    clearCarLine();
    resetDescForm();
  });

  const openDesc = async (e) => {
    const btn = e.target.closest("[data-open-add-description]");
    if (!btn) return;
    const card = btn.closest(".car-card");
    descriptionContextCarId = card?.dataset.carId || null;
    const carTitle = card?.querySelector("h2")?.textContent?.trim() ?? "";
    if (carLine) {
      carLine.textContent = `${cfg.carContextPrefix} ${carTitle}`;
      carLine.classList.remove("hidden");
    }
    if (descriptionContextCarId) {
      try {
        const car = await getGarageCar(descriptionContextCarId);
        loadCarIntoForm(car);
      } catch (err) {
        console.error(err);
        resetDescForm();
      }
    } else {
      resetDescForm();
    }
    dialog.showModal();
  };
  descLists.forEach((list) => list.addEventListener("click", openDesc));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!descriptionContextCarId) {
      dialog.close();
      return;
    }
    try {
      await updateGarageCar(descriptionContextCarId, {
        legalStatus: legal.value,
        electrical: electrical.value.trim(),
        color: color.value.trim(),
        rustWhere: rustWhere.value.trim(),
        rustDegree: rustDegree.value.trim(),
        chipsWhere: chipsWhere.value.trim(),
        chipsDamage: chipsDamage.value.trim(),
        damaged: damaged.value,
        dentsWhere: dentsWhere.value.trim(),
        dentsDamage: dentsDamage.value.trim(),
        repaintWhere: repaintWhere.value.trim(),
        repaintDegree: repaintDegree.value.trim(),
        generalCondition: general.value.trim(),
      });
      await renderGarageCards();
      broadcastGarageInvalidate();
    } catch (err) {
      console.error(err);
    }
    dialog.close();
  });

  dialog.querySelectorAll("[data-desc-modal-close]").forEach((btn) => {
    btn.addEventListener("click", () => dialog.close());
  });

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
}

function wireBackgroundAudio() {
  const cfg = site.backgroundAudio;
  const src = cfg?.src != null ? String(cfg.src).trim() : "";
  const audio = document.getElementById("site-bgm");
  const controls = document.getElementById("sound-controls");
  const btn = document.getElementById("sound-toggle");
  const volumeEl = document.getElementById("sound-volume");
  const onIcon = document.getElementById("sound-icon-on");
  const offIcon = document.getElementById("sound-icon-off");
  if (!audio || !btn) return;
  if (!src) {
    controls?.classList.add("hidden");
    btn.classList.add("hidden");
    return;
  }

  const defaultVol =
    typeof cfg?.volume === "number" && cfg.volume >= 0 && cfg.volume <= 1 ? cfg.volume : 0.85;
  const initialVol = readStoredBgmVolume(defaultVol);

  audio.src = src;
  audio.loop = false;
  audio.volume = initialVol;

  if (volumeEl instanceof HTMLInputElement) {
    volumeEl.value = String(Math.round(initialVol * 100));
    volumeEl.setAttribute("aria-valuenow", volumeEl.value);
    volumeEl.addEventListener("input", () => {
      const pct = Number(volumeEl.value);
      const v = Number.isFinite(pct) ? Math.min(1, Math.max(0, pct / 100)) : initialVol;
      audio.volume = v;
      volumeEl.setAttribute("aria-valuenow", volumeEl.value);
    });
    volumeEl.addEventListener("change", () => {
      writeStoredBgmVolume(audio.volume);
    });
  }

  function syncSoundUi() {
    const ended = audio.ended;
    const muted = audio.muted;
    const showMute = muted || ended;
    btn.setAttribute("aria-pressed", showMute ? "true" : "false");
    if (ended) {
      btn.setAttribute("aria-label", "Проиграть снова с начала");
    } else {
      btn.setAttribute("aria-label", muted ? "Включить звук" : "Выключить звук");
    }
    onIcon?.classList.toggle("hidden", showMute);
    offIcon?.classList.toggle("hidden", !showMute);
  }

  function playFromStart() {
    audio.currentTime = 0;
    return audio.play();
  }

  playFromStart().catch(() => {
    const unlock = () => {
      playFromStart().catch(() => {});
      document.removeEventListener("pointerdown", unlock, true);
    };
    document.addEventListener("pointerdown", unlock, { capture: true, once: true });
  });

  btn.addEventListener("click", () => {
    if (audio.ended) {
      audio.muted = false;
      void playFromStart().catch(() => {});
      syncSoundUi();
      return;
    }
    audio.muted = !audio.muted;
    syncSoundUi();
  });

  audio.addEventListener("volumechange", syncSoundUi);
  audio.addEventListener("ended", syncSoundUi);
  syncSoundUi();
}

function wireDealPriceModals() {
  const deal = site.dealFlow ?? {};
  const purchaseDialog = document.getElementById("purchase-price-dialog");
  const saleDialog = document.getElementById("sale-price-dialog");
  const purchaseForm = document.getElementById("purchase-price-form");
  const saleForm = document.getElementById("sale-price-form");
  const purchaseInput = document.getElementById("purchase-price-input");
  const saleInput = document.getElementById("sale-price-input");
  const saleInvestedInput = document.getElementById("sale-invested-input");
  if (
    !purchaseDialog ||
    !saleDialog ||
    !purchaseForm ||
    !saleForm ||
    !purchaseInput ||
    !saleInput ||
    !saleInvestedInput
  ) {
    return;
  }

  const pTitle = purchaseDialog.querySelector("[data-purchase-modal-title]");
  if (pTitle) pTitle.textContent = deal.purchaseModalTitle ?? "Куплено";
  const sTitle = saleDialog.querySelector("[data-sale-modal-title]");
  if (sTitle) sTitle.textContent = deal.saleModalTitle ?? "Продано";
  const pLabel = purchaseDialog.querySelector("[data-purchase-label]");
  if (pLabel) pLabel.textContent = deal.purchaseAmountLabel ?? "Сумма покупки";
  purchaseInput.placeholder = deal.purchaseAmountPlaceholder ?? "";
  const pHint = purchaseDialog.querySelector("[data-purchase-hint]");
  if (pHint) pHint.textContent = deal.purchaseHint ?? "";
  const sLabel = saleDialog.querySelector("[data-sale-label]");
  if (sLabel) sLabel.textContent = deal.saleAmountLabel ?? "Сумма продажи";
  saleInput.placeholder = deal.saleAmountPlaceholder ?? "";
  const sInvestedLabel = saleDialog.querySelector("[data-sale-invested-label]");
  if (sInvestedLabel) sInvestedLabel.textContent = deal.saleInvestedAmountLabel ?? "Сколько вложено";
  saleInvestedInput.placeholder = deal.saleInvestedAmountPlaceholder ?? "Например: 30 000 ₽";
  const sHint = saleDialog.querySelector("[data-sale-hint]");
  if (sHint) {
    sHint.textContent =
      deal.saleHint ?? "Укажите сумму продажи и сумму всех вложений по машине.";
  }

  const pCancel = purchaseDialog.querySelector("[data-purchase-cancel-text]");
  if (pCancel) pCancel.textContent = deal.purchaseCancel ?? "Отмена";
  const pSave = purchaseDialog.querySelector("[data-purchase-save-text]");
  if (pSave) pSave.textContent = deal.purchaseSave ?? "Сохранить";
  const sCancel = saleDialog.querySelector("[data-sale-cancel-text]");
  if (sCancel) sCancel.textContent = deal.saleCancel ?? "Отмена";
  const sSave = saleDialog.querySelector("[data-sale-save-text]");
  if (sSave) sSave.textContent = deal.saleSave ?? "Сохранить";

  let purchaseContextCarId = null;
  let saleContextCarId = null;
  const purchaseCarLine = purchaseDialog.querySelector("[data-purchase-car-line]");
  const saleCarLine = saleDialog.querySelector("[data-sale-car-line]");

  function resetPurchaseForm() {
    purchaseInput.value = "";
  }
  function resetSaleForm() {
    saleInput.value = "";
    saleInvestedInput.value = "";
  }

  purchaseDialog.addEventListener("close", () => {
    purchaseContextCarId = null;
    resetPurchaseForm();
    if (purchaseCarLine) {
      purchaseCarLine.textContent = "";
      purchaseCarLine.classList.add("hidden");
    }
  });
  saleDialog.addEventListener("close", () => {
    saleContextCarId = null;
    resetSaleForm();
    if (saleCarLine) {
      saleCarLine.textContent = "";
      saleCarLine.classList.add("hidden");
    }
  });
  purchaseInput.addEventListener("blur", () => {
    purchaseInput.value = normalizePriceText(purchaseInput.value);
  });
  saleInput.addEventListener("blur", () => {
    saleInput.value = normalizePriceText(saleInput.value);
  });
  saleInvestedInput.addEventListener("blur", () => {
    saleInvestedInput.value = normalizePriceText(saleInvestedInput.value);
  });

  function onCarListClick(e) {
    const buyBtn = e.target.closest("[data-open-purchase-price]");
    if (buyBtn) {
      const card = buyBtn.closest(".car-card");
      purchaseContextCarId = card?.dataset.carId || null;
      const carTitle = card?.querySelector("h2")?.textContent?.trim() ?? "";
      if (purchaseCarLine && purchaseContextCarId) {
        purchaseCarLine.textContent = `${deal.purchaseCarContextPrefix ?? "Машина:"} ${carTitle}`;
        purchaseCarLine.classList.remove("hidden");
      } else if (purchaseCarLine) {
        purchaseCarLine.classList.add("hidden");
      }
      resetPurchaseForm();
      purchaseDialog.showModal();
      return;
    }
    const soldBtn = e.target.closest("[data-open-sale-price]");
    if (soldBtn) {
      const card = soldBtn.closest(".car-card");
      saleContextCarId = card?.dataset.carId || null;
      const carTitle = card?.querySelector("h2")?.textContent?.trim() ?? "";
      if (saleCarLine && saleContextCarId) {
        saleCarLine.textContent = `${deal.saleCarContextPrefix ?? "Машина:"} ${carTitle}`;
        saleCarLine.classList.remove("hidden");
      } else if (saleCarLine) {
        saleCarLine.classList.add("hidden");
      }
      resetSaleForm();
      saleDialog.showModal();
    }
  }

  document.querySelectorAll(".js-car-cards-list").forEach((list) => {
    list.addEventListener("click", onCarListClick);
  });

  purchaseForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!purchaseContextCarId) {
      purchaseDialog.close();
      return;
    }
    const amount = normalizePriceText(purchaseInput.value);
    if (!amount) return;
    try {
      await updateGarageCar(purchaseContextCarId, {
        listingStatus: "purchased",
        purchasePrice: amount,
      });
      await renderGarageCards();
      broadcastGarageInvalidate();
      document.dispatchEvent(new CustomEvent("car-notes:open-tab", { detail: { tab: "purchased" } }));
    } catch (err) {
      console.error(err);
    }
    purchaseDialog.close();
  });

  saleForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!saleContextCarId) {
      saleDialog.close();
      return;
    }
    const amount = normalizePriceText(saleInput.value);
    const investedAmount = normalizePriceText(saleInvestedInput.value);
    if (!amount || !investedAmount) return;
    try {
      await updateGarageCar(saleContextCarId, {
        listingStatus: "sold",
        salePrice: amount,
        investedAmount,
      });
      await renderGarageCards();
      broadcastGarageInvalidate();
      document.dispatchEvent(new CustomEvent("car-notes:open-tab", { detail: { tab: "sold" } }));
    } catch (err) {
      console.error(err);
    }
    saleDialog.close();
  });

  purchaseDialog.querySelectorAll("[data-purchase-modal-close]").forEach((btn) => {
    btn.addEventListener("click", () => purchaseDialog.close());
  });
  purchaseDialog.addEventListener("click", (e) => {
    if (e.target === purchaseDialog) purchaseDialog.close();
  });
  saleDialog.querySelectorAll("[data-sale-modal-close]").forEach((btn) => {
    btn.addEventListener("click", () => saleDialog.close());
  });
  saleDialog.addEventListener("click", (e) => {
    if (e.target === saleDialog) saleDialog.close();
  });
}

const SITE_TAB_ACTIVE_CLASSES = [
  "border-ink-300",
  "bg-white/90",
  "text-ink-950",
  "shadow-sm",
  "dark:border-ink-500",
  "dark:bg-ink-900/90",
  "dark:text-white",
];

function wireSiteTabs() {
  const garage = document.querySelector('[data-site-panel="garage"]');
  const tabs = document.querySelectorAll("[data-site-tab]");
  const panelIds = Array.from(tabs)
    .map((t) => t.getAttribute("data-site-tab") || "")
    .filter(Boolean);
  /** @type {Record<string, HTMLElement | null>} */
  const panels = {};
  for (const id of panelIds) {
    panels[id] = document.querySelector(`[data-site-panel="${id}"]`);
  }
  const logo = document.querySelector("[data-logo-link]");
  if (!garage || !tabs.length) return;

  function setTabActive(activeName) {
    tabs.forEach((t) => {
      const on = t.getAttribute("data-site-tab") === activeName;
      t.setAttribute("aria-selected", on ? "true" : "false");
      SITE_TAB_ACTIVE_CLASSES.forEach((c) => t.classList.toggle(c, on));
    });
  }

  function showGarage() {
    garage.hidden = false;
    for (const id of panelIds) {
      const p = panels[id];
      if (p) p.hidden = true;
    }
    setTabActive("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** @param {string} name */
  function showPanel(name) {
    if (!panels[name]) return;
    garage.hidden = true;
    for (const id of panelIds) {
      const p = panels[id];
      if (p) p.hidden = id !== name;
    }
    setTabActive(name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      const name = tab.getAttribute("data-site-tab");
      if (name) showPanel(name);
    });
  });

  logo?.addEventListener("click", (e) => {
    const href = (logo.getAttribute("href") || "").trim();
    if (href === "#" || href === "") {
      e.preventDefault();
      showGarage();
    }
  });

  document.addEventListener("car-notes:open-tab", (ev) => {
    const tab = /** @type {CustomEvent<{ tab?: string }>} */ (ev).detail?.tab;
    if (typeof tab === "string" && panelIds.includes(tab)) {
      showPanel(tab);
      if (tab === "compare" && comparePageApi?.refresh) {
        void comparePageApi.refresh();
      }
    } else if (tab === "") {
      showGarage();
    }
  });
}

async function bootstrap() {
  applySite();
  wireTheme();
  wireBackgroundAudio();
  const headerControls = document.querySelector("header .flex.flex-1");
  if (headerControls instanceof HTMLElement) {
    mountNotificationBell(headerControls);
  }
  comparePageApi = mountComparePage();
  renderComparisonIndicator();
  document.addEventListener(comparisonStore.CHANGE_EVENT, () => {
    renderComparisonIndicator();
  });
  wireSiteTabs();
  try {
    await renderGarageCards();
  } catch (err) {
    console.error(err);
  }
  wireAddCarModal();
  wireAddDescriptionModal();
  wireDealPriceModals();
  wireGarageCardActions();
}

void bootstrap();
