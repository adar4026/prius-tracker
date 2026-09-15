// Аналитика для раздела «Графики»: история пробега и расходы по месяцам.
// Только чистые функции над уже существующими данными — заправками и
// записями ТО. Ничего не хранится, всё пересчитывается от текущих списков.

import { MONTHS_SHORT, entryYear, monthLabel, numOrNull, todayISO, yearsOf } from "./utils";

const DAY_MS = 86400000;

/** Дата вида YYYY-MM-DD, которая действительно существует в календаре. */
export const isValidISODate = (iso) => {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

/** Полночь даты по UTC в миллисекундах — ось времени графика пробега. */
export const isoToTs = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export const tsToISO = (ts) => new Date(ts).toISOString().slice(0, 10);

/** Календарных дней между датами (later − earlier). */
export const daysBetween = (earlierISO, laterISO) =>
  Math.round((isoToTs(laterISO) - isoToTs(earlierISO)) / DAY_MS);

/* ---------------- периоды ---------------- */

/**
 * Период раздела — тот же, что в журналах: "all" или год строкой ("2026").
 * Запись попадает в период по году даты.
 */
export const inPeriod = (entry, period) =>
  period === "all" || entryYear(entry) === period;

export const periodLabel = (period) =>
  period === "all" ? "За всё время" : `За ${period} год`;

/** Записи выбранного периода — общий срез для всех графиков раздела. */
export const filterPeriod = (list, period) =>
  period === "all" ? list : (Array.isArray(list) ? list : []).filter((e) => inPeriod(e, period));

/**
 * Варианты фильтра «Период» в том же виде, что в журналах: «Все записи»
 * и годы, встречающиеся в записях (от новых к старым).
 */
export const periodOptions = (...lists) => [
  { id: "all", label: "Все записи", shortLabel: "Все" },
  ...yearsOf(...lists).map((y) => ({ id: y, label: y })),
];

/* ---------------- пробег ---------------- */

/**
 * Точки истории одометра из всех записей с достоверной датой и пробегом:
 * заправки и ТО. Пробег 0/null означает «неизвестен» и точкой не становится.
 *
 * Точки сортируются по дате (внутри дня — по пробегу), дубли одинаковых
 * дата+пробег из разных источников схлопываются, а запись, у которой пробег
 * меньше уже достигнутого (обычно округлённый пробег в старой записи ТО),
 * пропускается — одометр не уменьшается. Промежуточных значений нет:
 * график показывает только то, что действительно записано.
 */
export function mileagePoints(fuel = [], service = []) {
  const raw = [];
  const collect = (list) =>
    (Array.isArray(list) ? list : []).forEach((e) => {
      if (!e || !isValidISODate(e.date)) return;
      const km = numOrNull(e.km);
      if (km === null || km <= 0) return;
      raw.push({ date: e.date, km: Math.round(km) });
    });
  collect(fuel);
  collect(service);

  raw.sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);

  const out = [];
  const seen = new Set();
  let maxKm = -Infinity;
  raw.forEach((p) => {
    const key = `${p.date}|${p.km}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (p.km < maxKm) return;
    maxKm = p.km;
    out.push({ date: p.date, km: p.km, ts: isoToTs(p.date) });
  });
  return out;
}

/**
 * Средний пробег в сутки за диапазон точек:
 * (последний пробег − первый пробег) / календарных дней между ними.
 * Меньше двух точек или все точки в один день — null (показывается «—»).
 * Округляется до целых км.
 */
export function avgKmPerDay(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const days = daysBetween(first.date, last.date);
  if (!(days > 0)) return null;
  const value = Math.round((last.km - first.km) / days);
  return Number.isFinite(value) ? value : null;
}

/* ---------------- расходы по месяцам ---------------- */

/**
 * Фактические расходы в том же виде, в каком их суммирует приложение:
 * заправка — оплаченная сумма paidTotal, запись ТО/покупки — cost.
 * Запись без суммы (null) расхода не даёт, но дату свою в историю вносит:
 * она нужна, чтобы определить начало диапазона «за всё время».
 * Задачи (напоминания) расходами не являются и сюда не попадают.
 */
export function expenseEntries(fuel = [], service = []) {
  const out = [];
  (Array.isArray(fuel) ? fuel : []).forEach((f) => {
    if (!f || !isValidISODate(f.date)) return;
    out.push({ date: f.date, amount: numOrNull(f.paidTotal), kind: "fuel" });
  });
  (Array.isArray(service) ? service : []).forEach((s) => {
    if (!s || !isValidISODate(s.date)) return;
    out.push({ date: s.date, amount: numOrNull(s.cost), kind: "service" });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const monthKey = (iso) => iso.slice(0, 7);

const shiftMonth = (key, delta) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Все календарные месяцы от from до to включительно: ["2025-11", "2025-12", …]. */
export function monthRange(from, to) {
  if (!from || !to || from > to) return [];
  const out = [];
  for (let k = from; k <= to; k = shiftMonth(k, 1)) out.push(k);
  return out;
}

/**
 * Границы диапазона месяцев для периода.
 *   all  — от месяца первой записи до текущего месяца (или до месяца
 *          последней записи, если она датирована позже);
 *   год  — с января по декабрь; для текущего года — по текущий месяц,
 *          будущие месяцы в диапазон не входят.
 * Без записей за период — null.
 */
export function periodMonthBounds(entries, period, today = todayISO()) {
  const dated = entries.filter((e) => inPeriod(e, period)).map((e) => monthKey(e.date));
  if (!dated.length) return null;
  const first = dated.reduce((a, b) => (a < b ? a : b));
  const last = dated.reduce((a, b) => (a > b ? a : b));
  const current = monthKey(today);

  if (period === "all") return { from: first, to: last > current ? last : current };

  const from = `${period}-01`;
  const dec = `${period}-12`;
  let to = dec;
  if (current < dec && current >= from) to = current;
  if (last > to) to = last;
  return { from, to };
}

/**
 * Расходы по календарным месяцам выбранного периода. Каждый месяц диапазона
 * присутствует в списке, даже если трат в нём не было (0 €).
 *
 * Средняя сумма в месяц = сумма фактических расходов / число календарных
 * месяцев диапазона (включая нулевые). Без записей — total 0, avg null.
 *
 * boundsEntries задаёт границы диапазона отдельно от entries: так средний
 * расход на топливо за год без единой заправки всё равно раскладывается
 * по всем месяцам года (0 €), а не пропадает — границы берутся из общей
 * истории (заправки + ТО), а суммы — только из нужной категории.
 */
export function monthlyExpenses(entries, period, today = todayISO(), boundsEntries = entries) {
  return expensesByMonth(entries, period, periodMonthBounds(boundsEntries, period, today));
}

/** Раскладка расходов периода по заданному диапазону месяцев; без диапазона — пусто. */
export function expensesByMonth(entries, period, bounds) {
  if (!bounds) return { months: [], total: 0, avgPerMonth: null };

  const sums = new Map();
  entries.forEach((e) => {
    if (!inPeriod(e, period) || e.amount === null || !Number.isFinite(e.amount)) return;
    const key = monthKey(e.date);
    sums.set(key, (sums.get(key) || 0) + e.amount);
  });

  const months = monthRange(bounds.from, bounds.to).map((key) => ({
    key,
    label: monthLabel(`${key}-01`),
    total: Math.round((sums.get(key) || 0) * 100) / 100,
  }));
  const total = Math.round(months.reduce((s, m) => s + m.total, 0) * 100) / 100;
  const avgPerMonth = months.length ? total / months.length : null;
  return { months, total, avgPerMonth };
}

/**
 * Границы календарных дней диапазона для периода — тот же принцип, что
 * у periodMonthBounds, но по дням: all — от первой записи до сегодня
 * (или до последней записи, если она позже), год — с 1 января по
 * 31 декабря, для текущего года — по сегодня. Без записей за период — null.
 */
export function periodDayBounds(entries, period, today = todayISO()) {
  const dated = entries.filter((e) => inPeriod(e, period)).map((e) => e.date);
  if (!dated.length) return null;
  const last = dated.reduce((a, b) => (a > b ? a : b));

  if (period === "all") {
    const first = dated.reduce((a, b) => (a < b ? a : b));
    return { from: first, to: last > today ? last : today };
  }

  const from = `${period}-01-01`;
  const dec31 = `${period}-12-31`;
  let to = dec31;
  if (today < dec31 && today >= from) to = today;
  if (last > to) to = last;
  return { from, to };
}

/**
 * Расходы на топливо по месяцам выбранного периода вкладки «Затраты».
 *
 * Диапазон начинается с первого месяца, за который есть заправка с известной
 * оплаченной суммой, — а не с первой записи автомобиля. Месяцы до этого —
 * не «0 €», а отсутствие данных, и в знаменатель среднего они не входят.
 * Внутри диапазона месяц без заправок — действительно 0 €. Для года диапазон
 * тоже обрезается снизу по первой финансовой записи (июнь 2025 → июнь–декабрь,
 * а не январь–декабрь). Год без единой оплаченной заправки — пусто, avg null.
 */
export function monthlyFuelCosts(fuel = [], period, today = todayISO()) {
  const paid = expenseEntries(fuel, []).filter((e) => e.amount !== null);
  const bounds = periodMonthBounds(paid, period, today);
  if (!bounds) return expensesByMonth(paid, period, null);
  const firstKnown = monthKey(paid[0].date);
  const from = bounds.from > firstKnown ? bounds.from : firstKnown;
  return expensesByMonth(paid, period, { from, to: bounds.to });
}

/** Среднемесячный расход на топливо за период — avgPerMonth из monthlyFuelCosts. */
export function averageFuelCostPerMonth(fuel, period, today = todayISO()) {
  return monthlyFuelCosts(fuel, period, today).avgPerMonth;
}

/** Расходы на ТО и ремонт по месяцам выбранного периода — суммы из cost записей ТО. */
export function serviceCostsByMonth(fuel = [], service = [], period, today = todayISO()) {
  const boundsEntries = expenseEntries(fuel, service);
  const serviceEntries = expenseEntries([], service);
  return monthlyExpenses(serviceEntries, period, today, boundsEntries);
}

/**
 * Средний расход на ТО и ремонт в день = сумма cost записей ТО за период /
 * число календарных дней диапазона (periodDayBounds, по всей истории).
 * Без записей за период (ни заправок, ни ТО) — null.
 */
export function averageServiceCostPerDay(fuel = [], service = [], period, today = todayISO()) {
  const boundsEntries = expenseEntries(fuel, service);
  const bounds = periodDayBounds(boundsEntries, period, today);
  if (!bounds) return null;

  const total = expenseEntries([], service)
    .filter((e) => inPeriod(e, period) && e.amount !== null && Number.isFinite(e.amount))
    .reduce((s, e) => s + e.amount, 0);
  const days = daysBetween(bounds.from, bounds.to) + 1;
  return days > 0 ? Math.round((total / days) * 100) / 100 : null;
}

/* ---------------- подписи осей ---------------- */

const KM_STEPS = [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];

/**
 * Деления оси пробега: круглый шаг (500 км, 1, 2, 5, 10… тыс.), при котором
 * подписей не больше max (по умолчанию шесть). Домен расширяется до ближайших делений, поэтому
 * подписи всегда «220 тыс.», а не «214,5 тыс.» с тремя цифрами после запятой.
 */
export function kmTicks(minKm, maxKm, max = 6) {
  if (!Number.isFinite(minKm) || !Number.isFinite(maxKm) || maxKm < minKm) {
    return { ticks: [], domain: [0, 1] };
  }
  // делений между округлёнными вниз/вверх границами — с учётом самого округления
  const count = (s) => Math.ceil(maxKm / s) - Math.floor(minKm / s) + 1;
  let step = KM_STEPS.find((s) => count(s) <= max) || KM_STEPS[KM_STEPS.length - 1];
  while (count(step) > max) step *= 2;
  const from = Math.floor(minKm / step) * step;
  const to = Math.ceil(maxKm / step) * step;
  const ticks = [];
  for (let v = from; v <= to; v += step) ticks.push(v);
  return { ticks, domain: [from, to === from ? from + step : to] };
}

/** Каждый n-й элемент, чтобы подписей было не больше max. */
const thin = (list, max) => {
  if (list.length <= max) return list;
  const step = Math.ceil(list.length / max);
  return list.filter((_, i) => i % step === 0);
};

/**
 * Подписи оси X для помесячного графика: пока месяцев немного — сами
 * месяцы («янв 26»), на длинных диапазонах — только январи как годы.
 * Возвращает список ключей для ticks и форматтер подписи.
 */
export function monthTicks(keys, max = 7) {
  if (keys.length > 24) {
    const januaries = keys.filter((k) => k.endsWith("-01"));
    return {
      ticks: thin(januaries.length ? januaries : keys, max),
      format: (k) => k.slice(0, 4),
    };
  }
  return { ticks: thin(keys, max), format: (k) => monthLabel(`${k}-01`) };
}

/**
 * Подписи оси времени для графика пробега по диапазону в миллисекундах:
 * больше двух лет — годы, больше трёх месяцев — месяцы, иначе дни.
 */
export function timeTicks(minTs, maxTs, max = 6) {
  if (!Number.isFinite(minTs) || !Number.isFinite(maxTs) || maxTs < minTs) {
    return { ticks: [], format: () => "" };
  }
  const spanDays = (maxTs - minTs) / DAY_MS;
  const start = new Date(minTs);

  if (spanDays > 730) {
    const ticks = [];
    for (let y = start.getUTCFullYear(); ; y++) {
      const t = Date.UTC(y, 0, 1);
      if (t > maxTs) break;
      if (t >= minTs) ticks.push(t);
    }
    return { ticks: thin(ticks, max), format: (t) => String(new Date(t).getUTCFullYear()) };
  }

  if (spanDays > 90) {
    const ticks = [];
    const y = start.getUTCFullYear();
    for (let m = start.getUTCMonth(); ; m++) {
      const t = Date.UTC(y, m, 1);
      if (t > maxTs) break;
      if (t >= minTs) ticks.push(t);
    }
    return {
      ticks: thin(ticks, max),
      format: (t) => {
        const d = new Date(t);
        return `${MONTHS_SHORT[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
      },
    };
  }

  const stepDays = Math.max(1, Math.ceil(spanDays / max));
  const ticks = [];
  for (let t = minTs; t <= maxTs; t += stepDays * DAY_MS) ticks.push(t);
  return {
    ticks,
    format: (t) => {
      const iso = tsToISO(t);
      return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
    },
  };
}

/* ---------------- приблизительный расход: июнь 2025 — февраль 2026 ---------------- */

/**
 * Аналитическая реконструкция среднего расхода за месяцы, где ни одна
 * заправка не даёт официального consumption: в этот период (журнал MyCar,
 * см. history.js) признак «полного бака» не сохранился, поэтому
 * calcConsumption/recalcFrom принципиально ничего не считают — это не
 * пропуск данных, а честное «неизвестно» на уровне отдельной заправки.
 *
 * Число здесь — не показание конкретной заправки, а грубая оценка на уровне
 * месяца: сумма литров между первой заправкой месяца и первой заправкой
 * следующего, делённая на пройденный за то же окно пробег. Используется
 * только для непрерывности графика «Средний расход по месяцам» — нигде
 * не пишется в fuel[].consumption и не участвует в calcConsumption,
 * consumptionPoints, среднем/мин/макс на «Обзоре» или любом другом расчёте.
 */
export const RECONSTRUCTED_MONTHLY_CONSUMPTION = {
  "2025-06": 4.45,
  "2025-07": 4.30,
  "2025-08": 5.42,
  "2025-09": 5.04,
  "2025-10": 3.96,
  "2025-11": 5.44,
  "2025-12": 5.51,
  "2026-01": 4.39,
  "2026-02": 4.89,
};

/**
 * Добавляет к записям помесячного графика (см. ChartsTab) поле approxCons —
 * реконструкцию из RECONSTRUCTED_MONTHLY_CONSUMPTION там, где официального
 * avgCons нет, — consDisplay для самого графика (реальное значение, а при
 * его отсутствии приблизительное) и isApprox для визуального отличия.
 * Месяц без обоих значений остаётся пустым (null) — график идёт с разрывом,
 * а не с выдуманным числом.
 */
export function withApproxConsumption(months) {
  return (Array.isArray(months) ? months : []).map((m) => {
    const approxCons = m.avgCons === null ? RECONSTRUCTED_MONTHLY_CONSUMPTION[m.key] ?? null : null;
    return {
      ...m,
      approxCons,
      consDisplay: m.avgCons !== null ? m.avgCons : approxCons,
      isApprox: m.avgCons === null && approxCons !== null,
    };
  });
}
