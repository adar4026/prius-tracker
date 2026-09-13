export const PARTIAL_NOTE = "Не до полного";

export const num = (v) => {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Как num, но неизвестное значение остаётся null, а не превращается в 0.
 * Нужно для исторических записей, где часть данных не восстановлена:
 * «неизвестно» и «ноль» — разные вещи и в журнале, и в статистике.
 */
export const numOrNull = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
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

// 38,50 € — неизвестная сумма показывается как «—», ноль остаётся нулём
export const fmtMoney = (v, digits = 2) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : `${v.toFixed(digits).replace(".", ",")} €`;

// 12 500 € — целая сумма с разделителем тысяч, копейки только если они есть
export const fmtPrice = (v) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : `${v.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} €`;

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
  // null сохраняется как null: часть исторических записей неполная
  const liters = numOrNull(e.liters);
  const pricePerL = numOrNull(e.pricePerL);

  const grossTotal =
    e.grossTotal !== undefined && e.grossTotal !== null ? numOrNull(e.grossTotal)
    : e.total !== undefined && e.total !== null ? numOrNull(e.total)
    : liters !== null && pricePerL !== null ? round(liters * pricePerL, 2)
    : null;

  const discount = num(e.discount);
  const paidTotal =
    e.paidTotal !== undefined && e.paidTotal !== null
      ? numOrNull(e.paidTotal)
      : grossTotal !== null
        ? round(grossTotal - discount, 2)
        : null;

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
    // km и cost могут быть неизвестны — тогда null, а не 0
    km: s.km === null || s.km === undefined ? null : Math.round(num(s.km)),
    cost: s.cost === undefined ? 0 : numOrNull(s.cost),
    note: s.note || "",
  }));

/**
 * Задачи. Поля связи с ТО добавляются аддитивно: у старых задач они null,
 * и такая задача ведёт себя ровно как раньше — обычное напоминание без
 * привязки к сервисной записи.
 */
export const migrateReminders = (list) =>
  (Array.isArray(list) ? list : []).map((r) => ({
    ...r,
    completed: !!r.completed,
    completedDate: r.completedDate || null,
    completedKm: Number.isFinite(r.completedKm) ? r.completedKm : null,
    // из какой сервисной записи задача создана
    sourceServiceId: r.sourceServiceId ?? null,
    // какой сервисной записью задача закрыта
    completedServiceId: r.completedServiceId ?? null,
    // интервал, которым посчитан срок
    intervalKm: numOrNull(r.intervalKm),
    intervalMonths: numOrNull(r.intervalMonths),
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
export function recalcFrom(list, fromKm = -Infinity, toKm = Infinity) {
  const sorted = [...list].sort(byKmAsc);
  let baseKm = null;         // пробег последнего полного бака
  let pending = 0;           // литры неполных заправок после него
  let pendingUnknown = false; // среди них есть заправка с неизвестным объёмом

  return sorted.map((e) => {
    const full = isFull(e);
    const liters = numOrNull(e.liters);
    let consumption = Number.isFinite(e.consumption) ? e.consumption : null;

    if (e.km >= fromKm && e.km <= toKm) {
      // цикл с неизвестным объёмом расход не даёт — лучше «—», чем неверная цифра
      if (!full || baseKm === null || e.km <= baseKm || liters === null || pendingUnknown) {
        consumption = null;
      } else {
        consumption = round(((pending + liters) / (e.km - baseKm)) * 100, 2);
      }
    }

    if (full) { baseKm = e.km; pending = 0; pendingUnknown = false; }
    else if (liters === null) { pendingUnknown = true; }
    else { pending += liters; }

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

/** Пороги статуса «Скоро». Меняются здесь и нигде больше. */
export const DUE_SOON_KM = 1000;
export const DUE_SOON_DAYS = 30;

/** Сколько дней осталось до даты: 0 — сегодня, отрицательное — срок прошёл. */
export const daysUntil = (iso) => {
  if (!iso) return null;
  const today = Date.parse(`${todayISO()}T00:00:00Z`);
  const due = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(due)) return null;
  return Math.round((due - today) / 86400000);
};

/**
 * Дата через N месяцев. 31 января + 1 месяц даёт 28/29 февраля,
 * а не перескок на март.
 */
export function addMonths(iso, months) {
  if (!iso || !Number.isFinite(months)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const shifted = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)
  ).getUTCDate();
  shifted.setUTCDate(Math.min(d, lastDay));
  return shifted.toISOString().slice(0, 10);
}

/**
 * Просрочена ли задача. Считается всегда динамически:
 * по пробегу (currentKm >= dueKm) или по наступившей дате (сегодня >= dueDate).
 * Выполненная задача просроченной не бывает.
 */
export const isReminderOverdue = (r, currentKm) => {
  if (r.completed) return false;
  if (r.dueKm && currentKm >= r.dueKm) return true;
  if (r.dueDate && todayISO() >= r.dueDate) return true;
  return false;
};

/**
 * Статус задачи: done | overdue | soon | waiting.
 * Если заданы оба условия, срабатывает то, которое наступит раньше.
 */
export function reminderStatus(r, currentKm) {
  if (r.completed) return "done";
  if (isReminderOverdue(r, currentKm)) return "overdue";
  const kmLeft = r.dueKm ? r.dueKm - currentKm : null;
  const dLeft = daysUntil(r.dueDate);
  if ((kmLeft !== null && kmLeft <= DUE_SOON_KM) || (dLeft !== null && dLeft <= DUE_SOON_DAYS))
    return "soon";
  return "waiting";
}

/**
 * Насколько задача срочная: чем меньше, тем ближе срок.
 * Пробег и дни приводятся к общей шкале через пороги «Скоро», поэтому
 * у задачи с двумя условиями побеждает то, что действительно ближе.
 * null — срока нет вовсе.
 */
export function reminderUrgency(r, currentKm) {
  const scales = [];
  if (r.dueKm) scales.push((r.dueKm - currentKm) / DUE_SOON_KM);
  const dLeft = daysUntil(r.dueDate);
  if (dLeft !== null) scales.push(dLeft / DUE_SOON_DAYS);
  return scales.length ? Math.min(...scales) : null;
}

/** Ближайшее из двух условий — то, что показывается в списке одной строкой. */
export function nearestDueLabel(r, currentKm) {
  if (r.completed) return null;
  const kmLeft = r.dueKm ? r.dueKm - currentKm : null;
  const dLeft = daysUntil(r.dueDate);
  const byKm = kmLeft !== null ? kmLeft / DUE_SOON_KM : Infinity;
  const byDay = dLeft !== null ? dLeft / DUE_SOON_DAYS : Infinity;
  if (byKm === Infinity && byDay === Infinity) return null;

  if (byKm <= byDay) {
    if (kmLeft > 0) return { text: `через ${fmtKm(kmLeft)} км`, overdue: false };
    if (kmLeft === 0) return { text: "пробег достигнут", overdue: true };
    return { text: `просрочено на ${fmtKm(-kmLeft)} км`, overdue: true };
  }
  if (dLeft === 0) return { text: "сегодня", overdue: true };
  const span = calendarUntil(r.dueDate);
  const formatted = fmtElapsed(span);
  return span.overdue
    ? { text: `просрочено на ${formatted}`, overdue: true }
    : { text: `через ${formatted}`, overdue: false };
}

/** Динамический текст остатка до срока: dueKm - currentKm */
export const kmLeftLabel = (r, currentKm) => {
  if (r.completed || !r.dueKm) return null;
  const left = r.dueKm - currentKm;
  if (left > 0) return { text: `Осталось ${fmtKm(left)} км`, overdue: false };
  if (left === 0) return { text: "Срок наступил", overdue: true };
  return { text: `Просрочено на ${fmtKm(-left)} км`, overdue: true };
};

/* ---------------- журнал: год и поиск ---------------- */

/** Год записи как строка: "2026". */
export const entryYear = (e) => (e && e.date ? e.date.slice(0, 4) : "");

/** Все годы, встречающиеся в переданных списках, от новых к старым. */
export const yearsOf = (...lists) => {
  const set = new Set();
  lists.flat().forEach((e) => {
    const y = entryYear(e);
    if (y) set.add(y);
  });
  return [...set].sort((a, b) => b.localeCompare(a));
};

// toLocaleString вставляет неразрывные пробелы — для поиска они обычные
const normalize = (v) =>
  String(v === null || v === undefined ? "" : v)
    .toLowerCase()
    .replace(/[  ]/g, " ");

/** Число в поиске должно находиться и как «25823», и как «25 823» / «25,82». */
const numTokens = (v, digits) =>
  v === null || v === undefined || !Number.isFinite(v) ? "" : `${v} ${fmtNum(v, digits)}`;

/**
 * Все токены запроса должны присутствовать в строке записи (И, а не ИЛИ),
 * поэтому «2025 масло» сужает выдачу, как и ожидается.
 */
export function matchesQuery(haystack, query) {
  const q = normalize(query).trim();
  if (!q) return true;
  const hay = normalize(haystack);
  return q.split(/\s+/).every((token) => hay.includes(token));
}

/** Строка, по которой ищется заправка. */
export const fuelSearchText = (f) =>
  [
    "заправка топливо бензин азс",
    f.date, fmtDate(f.date), entryYear(f),
    f.km, fmtKm(f.km),
    numTokens(f.liters, 2), "л литры",
    numTokens(f.pricePerL, 3), "€/л цена",
    numTokens(f.grossTotal, 2), numTokens(f.paidTotal, 2), "€ сумма",
    f.discount ? `скидка ${numTokens(f.discount, 2)}` : "",
    f.station, f.note,
    isFull(f) ? "полный бак" : "не до полного частичная",
    f.consumption ? `расход ${numTokens(f.consumption, 2)}` : "",
  ].join(" ");

/** Строка, по которой ищется запись ТО / расхода. Ярлык категории передаёт вызывающий. */
export const serviceSearchText = (s, categoryLabel = "") =>
  [
    "то сервис ремонт обслуживание расход",
    s.date, fmtDate(s.date), entryYear(s),
    s.km ? `${s.km} ${fmtKm(s.km)}` : "",
    s.type, s.note,
    s.category, categoryLabel,
    numTokens(s.cost, 2), "€ стоимость",
  ].join(" ");

/* ---------------- сколько прошло с записи ---------------- */

/**
 * Календарная разница между двумя датами (earlierISO ожидается не позже
 * laterISO): годы, месяцы, дни. Считается по календарю, поэтому «1 мес.» —
 * это то же число следующего месяца, а не 30 суток.
 */
function calendarSpan(earlierISO, laterISO) {
  const [y1, m1, d1] = earlierISO.split("-").map(Number);
  const [y2, m2, d2] = laterISO.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return null;

  let years = y2 - y1;
  let months = m2 - m1;
  let days = d2 - d1;
  if (days < 0) {
    months -= 1;
    // занимаем дни у предыдущего месяца — у него своя длина
    days += new Date(Date.UTC(y2, m2 - 1, 0)).getUTCDate();
  }
  if (months < 0) { years -= 1; months += 12; }
  return { years, months, days };
}

/**
 * Календарная разница от даты записи до сегодня. Дата в будущем разницы
 * не даёт (null) — для этого случая см. calendarUntil.
 */
export function elapsedSince(iso, fromISO = todayISO()) {
  if (!iso || iso > fromISO) return null;
  return calendarSpan(iso, fromISO);
}

/**
 * Календарный остаток до даты в обе стороны: {years, months, days, overdue}.
 * Дата в будущем — сколько до неё осталось; дата в прошлом — на сколько
 * она просрочена. Совпадение с сегодня даёт нули — вызывающий код сам
 * решает, показывать ли отдельным текстом «сегодня».
 */
export function calendarUntil(iso, fromISO = todayISO()) {
  if (!iso) return null;
  const overdue = iso < fromISO;
  const span = overdue ? calendarSpan(iso, fromISO) : calendarSpan(fromISO, iso);
  return span ? { ...span, overdue } : null;
}

/**
 * «3 мес. 26 дн.», «1 г. 2 мес.», «4 дн.».
 * Показываются только две старшие единицы: после года дни уже не важны.
 */
export function fmtElapsed(e) {
  if (!e) return "";
  if (e.years > 0) return e.months > 0 ? `${e.years} г. ${e.months} мес.` : `${e.years} г.`;
  if (e.months > 0) return e.days > 0 ? `${e.months} мес. ${e.days} дн.` : `${e.months} мес.`;
  return `${e.days} дн.`;
}

/**
 * Возраст записи: время от её даты до сегодня и пробег от её показаний до
 * текущего. Обе части необязательны — показывается то, что известно;
 * ничего не известно — null. Ничего не хранится: и дни, и километры
 * пересчитываются на каждый рендер от актуального пробега и текущей даты.
 */
export function elapsedLabel(entry, currentKm) {
  if (!entry) return null;
  const time = fmtElapsed(elapsedSince(entry.date));
  const km =
    Number.isFinite(entry.km) && entry.km > 0 &&
    Number.isFinite(currentKm) && currentKm >= entry.km
      ? `${fmtKm(currentKm - entry.km)} км`
      : "";
  const parts = [time, km].filter(Boolean);
  return parts.length ? parts.join(" • ") : null;
}
