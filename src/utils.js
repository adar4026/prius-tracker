export const PARTIAL_NOTE = "Не до полного";

export const isPartial = (e) =>
  (e.note || "").trim().toLowerCase() === PARTIAL_NOTE.toLowerCase();

export const num = (v) => {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export const fmtKm = (v) =>
  Math.round(v || 0).toLocaleString("ru-RU").replace(/ /g, ".");

export const fmtMoney = (v, digits = 2) =>
  `${(v || 0).toFixed(digits).replace(".", ",")} €`;

export const fmtNum = (v, digits = 2) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : v.toFixed(digits).replace(".", ",");

export const fmtDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

export const MONTHS_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

export const monthLabel = (iso) => {
  const [y, m] = iso.split("-");
  return `${MONTHS_SHORT[Number(m) - 1]} ${y.slice(2)}`;
};

export const byKmAsc = (a, b) => a.km - b.km || a.date.localeCompare(b.date);
export const byDateDesc = (a, b) => b.date.localeCompare(a.date) || b.km - a.km;

export const nextId = (list) =>
  list.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;

/**
 * Расход л/100 км для новой заправки.
 * Отсчёт ведётся от последнего полного бака: литры неполных заправок
 * накапливаются и учитываются в следующей полной.
 * Для самой неполной заправки расход не считается (null).
 */
export function calcConsumption(existing, entry) {
  if (isPartial(entry)) return null;

  const before = existing.filter((e) => e.km < entry.km).sort(byKmAsc);
  if (!before.length) return null;

  let liters = num(entry.liters);
  let baseKm = null;
  for (let i = before.length - 1; i >= 0; i--) {
    if (!isPartial(before[i])) { baseKm = before[i].km; break; }
    liters += num(before[i].liters);
  }
  if (baseKm === null) return null;

  const dist = entry.km - baseKm;
  if (dist <= 0) return null;
  return Math.round((liters / dist) * 1000) / 10;
}

/** Заправки, участвующие в статистике расхода */
export const consumptionPoints = (fuel) =>
  fuel
    .filter((e) => !isPartial(e) && Number.isFinite(e.consumption) && e.consumption > 0)
    .sort(byKmAsc);

export function avg(values) {
  if (!values.length) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}
