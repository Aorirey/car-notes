import { createCarStatusBadge } from "../components/CarStatusBadge.js";

/**
 * @param {import("../db.js").GarageCar} car
 * @returns {HTMLDivElement}
 */
export function buildCarMetaBlock(car) {
  const container = document.createElement("div");
  container.className = "mt-3 flex flex-wrap items-center gap-2";
  container.appendChild(createCarStatusBadge(String(car.status ?? "found")));

  const vin = car.vin != null ? String(car.vin).trim() : "";
  if (vin) {
    const vinTag = document.createElement("span");
    vinTag.className =
      "inline-flex items-center rounded-full bg-white/10 px-2 py-1 text-xs text-ink-100";
    vinTag.textContent = `VIN: ${vin}`;
    container.appendChild(vinTag);
  }

  const mileage = Number(car.mileage);
  if (Number.isFinite(mileage) && mileage >= 0) {
    const mileageTag = document.createElement("span");
    mileageTag.className =
      "inline-flex items-center rounded-full bg-white/10 px-2 py-1 text-xs text-ink-100";
    mileageTag.textContent = `${mileage.toLocaleString("ru-RU")} км`;
    container.appendChild(mileageTag);
  }

  const photosCount = Array.isArray(car.photos) ? car.photos.length : 0;
  if (photosCount > 0) {
    const photosTag = document.createElement("span");
    photosTag.className =
      "inline-flex items-center rounded-full bg-white/10 px-2 py-1 text-xs text-ink-100";
    photosTag.textContent = `Фото: ${photosCount}`;
    container.appendChild(photosTag);
  }

  return container;
}
