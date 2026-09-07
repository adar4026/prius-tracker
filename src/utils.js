export const PARTIAL_NOTE = "Не до полного";

export const num = (v) => {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const round = (v, digits) => {
  const k = 10 ** digits;
  return Math.round(v * k) / k;
};

/** Полный ли бак. Старые записи помечались строкой в note. */
export const isFull = (e) =>
  e.fullTank !== undefined
    ? !!e.fullTank
    : (e.note || "").trim().toLowerCase() !== PARTIAL_NOTE.toLowerCase();

export const isPartial = (e) => !isFull(e);

/* ---------------- форматирование ---------------- */

// 220 684 км — неразрывный пробел как разделитель тысяч
export const fmtKm = (v) => Math.round(v || 0).toLocaleString("ru-RU");

// 38,50 €
export const fmtMoney = (v, digits = 2) =>
  `${(v || 0).toFixed(digits).replace(".", ",")} €`;

// 20,95 / 1,959 / 4,82
export const fmtNum = (v, digits = 2) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : v.toFixed(digits).replace(".", ",");

// 06.09.2026
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

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const byKmAsc = (a, b) => a.km - b.km || a.date.localeCompare(b.date);
export const byDateDesc = (a, b) => b.date.localeCompare(a.date) || b.km - a.km;

export const nextId = (list) =>
  list.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;

/* ---------------- миграция ---------------- */

/**
 * Приводит заправку к модели grossTotal / discount / paidTotal.
 * Старая запись с одним total: grossTotal = paidTotal = total, discount = 0.
 */
export function migrateFuelEntry(e) {
  const liters = num(e.liters);
  const pricePerL = num(e.pricePerL);

  const grossTotal =
    e.grossTotal !== undefined && e.grossTotal !== null ? num(e.grossTotal)
    : e.total !== undefined && e.total !== null ? num(e.total)
    : round(liters * pricePerL, 2);

  const discount = num(e.discount);
  const paidTotal =
    e.paidTotal !== undefined && e.paidTotal !== null
      ? num(e.paidTotal)
      : round(grossTotal - discount, 2);

  // раньше признак неполного бака жил в note
  const legacyPartial =
    (e.note || "").trim().toLowerCase() === PARTIAL_NOTE.toLowerCase();
  const fullTank = e.fullTank !== undefined ? !!e.fullTank : !legacyPartial;
  const note = e.fullTank === undefined && legacyPartial ? "" : (e.note || "");

  return {
    id: e.id,
    date: e.date,
    km: Math.round(num(e.km)),
    liters,
    pricePerL,
    grossTotal,
    discount,
    paidTotal,
    station: e.station || "",
    fullTank,
    note,
    // неполная заправка собственного расхода не имеет
    consumption: fullTank && Number.isFinite(e.consumption) ? e.consumption : null,
  };
}

export const migrateFuel = (list) =>
  (Array.isArray(list) ? list : []).map(migrateFuelEntry);

export const migrateService = (list) =>
  (Array.isArray(list) ? list : []).map((s) => ({
    ...s,
    km: Math.round(num(s.km)),
    cost: num(s.cost),
    note: s.note || "",
  }));

export const migrateReminders = (list) =>
  (Array.isArray(list) ? list : []).map((r) => ({
    ...r,
    completed: !!r.completed,
    completedDate: r.completedDate || null,
    completedKm: Number.isFinite(r.completedKm) ? r.completedKm : null,
  }));

/* ---------------- расход ---------------- */

/**
 * Расход л/100 км для одной заправки.
 * Отсчёт ведётся от последнего полного бака: литры неполных заправок
 * накапливаются и учитываются в следующей полной.
 * Неполная заправка собственного расхода не получает (null).
 */
export function calcConsumption(existing, entry) {
  if (isPartial(entry)) return null;

  const before = existing
    .filter((e) => e.km < entry.km && e.id !== entry.id)
    .sort(byKmAsc);
  if (!before.length) return null;

  let liters = num(entry.liters);
  let baseKm = null;
  for (let i = before.length - 1; i >= 0; i--) {
    if (isFull(before[i])) { baseKm = before[i].km; break; }
    liters += num(before[i].liters);
  }
  if (baseKm === null) return null;

  const dist = entry.km - baseKm;
  if (dist <= 0) return null;
  return round((liters / dist) * 100, 2);
}

/**
 * Пересчитывает расход всех топливных циклов начиная с пробега fromKm.
 * Записи до fromKm сохраняют исторические значения, но участвуют
 * в определении базы цикла.
 */
export function recalcFrom(list, fromKm = -Infinity) {
  const sorted = [...list].sort(byKmAsc);
  let baseKm = null;   // пробег последнего полного бака
  let pending = 0;     // литры неполных заправок после него

  return sorted.map((e) => {
    const full = isFull(e);
    let consumption = Number.isFinite(e.consumption) ? e.consumption : null;

    if (e.km >= fromKm) {
      if (!full || baseKm === null || e.km <= baseKm) {
        consumption = null;
      } else {
        consumption = round(((pending + num(e.liters)) / (e.km - baseKm)) * 100, 2);
      }
    }

    if (full) { baseKm = e.km; pending = 0; }
    else { pending += num(e.liters); }

    return { ...e, consumption };
  });
}

/** Заправки, участвующие в статистике расхода */
export const consumptionPoints = (fuel) =>
  fuel
    .filter((e) => isFull(e) && Number.isFinite(e.consumption) && e.consumption > 0)
    .sort(byKmAsc);

export function avg(values) {
  if (!values.length) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/* ---------------- задачи ---------------- */

/**
 * Просрочена ли задача. Считается всегда динамически:
 * по пробегу (currentKm >= dueKm) или по дате (сегодня позже dueDate).
 * Выполненная задача просроченной не бывает.
 */
export const isReminderOverdue = (r, currentKm) => {
  if (r.completed) return false;
  if (r.dueKm && currentKm >= r.dueKm) return true;
  if (r.dueDate && todayISO() > r.dueDate) return true;
  return false;
};

/** Раздел задачи. */
export const effectivePriority = (r, currentKm) => {
  if (r.completed) return "completed";
  if (isReminderOverdue(r, currentKm)) return "overdue";
  // сохранённый "overdue" не должен залипать, пока срок не наступил
  if (r.priority === "overdue") return "upcoming";
  return r.priority;
};

/** Динамический текст остатка до срока: dueKm - currentKm */
export const kmLeftLabel = (r, currentKm) => {
  if (r.completed || !r.dueKm) return null;
  const left = r.dueKm - currentKm;
  if (left > 0) return { text: `Осталось ${fmtKm(left)} км`, overdue: false };
  if (left === 0) return { text: "Срок наступил", overdue: true };
  return { text: `Просрочено на ${fmtKm(-left)} км`, overdue: true };
};
