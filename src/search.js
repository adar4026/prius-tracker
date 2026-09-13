// Глобальный поиск по всем данным приложения.
//
// Индекс строится из текущего состояния (заправки, ТО, задачи, профиль
// автомобиля) и ничего не дублирует в хранилище. Каждая запись индекса —
// { group, id, icon, title, sub, text, target }, где text — строка для
// сопоставления, а target описывает, куда переходить по нажатию.

import { CATEGORY_LABELS } from "./data";
import {
  fmtDate, fmtKm, fmtMoney, fmtNum, fmtPrice, fuelSearchText, nearestDueLabel,
  num, reminderStatus, serviceSearchText, byDateDesc,
} from "./utils";

export const SEARCH_GROUPS = [
  { id: "vehicle",  label: "Автомобиль" },
  { id: "service",  label: "Техническое обслуживание" },
  { id: "fuel",     label: "Заправки" },
  { id: "reminder", label: "Задачи" },
];

export const GROUP_ICONS = { vehicle: "🚗", service: "🔧", fuel: "⛽", reminder: "🔔" };

const STATUS_LABELS = {
  overdue: "Просрочено", soon: "Скоро", waiting: "Ожидает", done: "Выполнено",
};
const STATUS_RANK = { overdue: 0, soon: 1, waiting: 2, done: 3 };

/**
 * Регистр, лишние пробелы и диакритика («Agustín» → «agustin») не мешают
 * совпадению; неразрывные пробелы из toLocaleString становятся обычными.
 */
export const normalizeText = (v) =>
  String(v === null || v === undefined ? "" : v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Токены запроса; ё и е считаются одной буквой. */
export const queryTokens = (query) =>
  normalizeText(query).replace(/ё/g, "е").split(" ").filter(Boolean);

const hay = (text) => normalizeText(text).replace(/ё/g, "е");

/* ---------------- индекс ---------------- */

/** Секции страницы «Автомобиль» и поля, которые в них показываются. */
const VEHICLE_FIELDS = [
  { section: "passport", label: "Марка", get: (v) => v.brand },
  { section: "passport", label: "Модель", get: (v) => v.model },
  { section: "passport", label: "Название", get: (v) => v.name },
  { section: "passport", label: "Автомобиль", get: (v) => v.modelFull },
  { section: "passport", label: "Версия", get: (v) => v.version, mono: true },
  { section: "passport", label: "Год выпуска", get: (v) => v.year },
  { section: "passport", label: "Первая регистрация", get: (v) => fmtDate(v.docs.firstRegistration), when: (v) => v.docs.firstRegistration },
  { section: "passport", label: "Двигатель", get: (v) => v.engineCode, mono: true },
  { section: "passport", label: "Силовая установка", get: (v) => v.engine },
  { section: "passport", label: "Тип", get: (v) => v.driveType || v.fuelType },
  { section: "passport", label: "Мощность", get: (v) => v.power },
  { section: "passport", label: "Кузов", get: (v) => v.body, mono: true },
  { section: "passport", label: "VIN", get: (v) => v.vin, mono: true },
  { section: "passport", label: "Госномер", get: (v) => v.plate, mono: true },
  { section: "passport", label: "Цвет кузова", get: (v) => v.color, mono: true },
  { section: "oil", label: "Моторное масло", get: (v) => v.oil.grade },
  { section: "oil", label: "Объём масла без фильтра", get: (v) => v.oil.volumeNoFilter },
  { section: "oil", label: "Объём масла с фильтром", get: (v) => v.oil.volume },
  { section: "oil", label: "Масляный фильтр", get: (v) => v.oil.filter },
  { section: "cvt", label: "Масло трансмиссии", get: (v) => v.transmission.fluid },
  { section: "cvt", label: "Объём трансмиссии (частичная замена)", get: (v) => v.transmission.volume },
  { section: "coolant", label: "Охлаждающая жидкость двигателя", get: (v) => v.coolant.engine },
  { section: "coolant", label: "Охлаждающая жидкость инвертора", get: (v) => v.coolant.inverter },
  { section: "tires", label: "Сверловка", get: (v) => v.tires.pcd },
  { section: "tires", label: "Штатные диски", get: (v) => v.tires.rims },
  { section: "tires", label: "Штатные шины", get: (v) => v.tires.stock },
  { section: "tires", label: "Текущие шины", get: (v) => v.tires.current },
  { section: "tires", label: "Запасное колесо", get: (v) => v.tires.spare },
  { section: "parts", label: "Инвертор", get: (v) => v.parts.inverter, mono: true },
  { section: "parts", label: "Аккумулятор 12 V", get: (v) => v.parts.battery12v, mono: true },
  { section: "docs", label: "Дата покупки", get: (v) => fmtDate(v.docs.purchaseDate), when: (v) => v.docs.purchaseDate },
  { section: "docs", label: "Пробег при покупке", get: (v) => `${fmtKm(v.docs.purchaseKm)} км`, when: (v) => v.docs.purchaseKm },
  { section: "docs", label: "Цена покупки", get: (v) => fmtPrice(num(v.docs.purchasePrice)), when: (v) => v.docs.purchasePrice },
  { section: "docs", label: "ITV до", get: (v) => fmtDate(v.docs.itvUntil), when: (v) => v.docs.itvUntil },
  { section: "docs", label: "Страховая компания", get: (v) => v.docs.insuranceCompany },
  { section: "docs", label: "Страховка до", get: (v) => fmtDate(v.docs.insuranceUntil), when: (v) => v.docs.insuranceUntil },
  { section: "docs", label: "Другие документы", get: (v) => v.docs.other },
  { section: "passport", label: "Заметки", get: (v) => v.notes },
];

const SECTION_LABELS = {
  passport: "Паспорт и идентификация",
  oil: "Моторное масло",
  cvt: "Трансмиссия",
  coolant: "Охлаждающие жидкости",
  tires: "Колёса и шины",
  parts: "Номера деталей",
  docs: "Документы и даты",
};

const vehicleEntries = (vehicle) =>
  VEHICLE_FIELDS.flatMap((f, i) => {
    if (f.when && !String(f.when(vehicle) || "").trim()) return [];
    const value = String(f.get(vehicle) || "").trim();
    if (!value) return [];
    return [{
      group: "vehicle",
      id: `vehicle-${i}`,
      icon: GROUP_ICONS.vehicle,
      title: `${f.label} — ${value}`,
      sub: SECTION_LABELS[f.section],
      mono: !!f.mono,
      text: hay(`${f.label} ${value} автомобиль ${SECTION_LABELS[f.section]}`),
      target: { type: "vehicle", section: f.section },
    }];
  });

const fuelEntries = (fuel) =>
  [...fuel].sort(byDateDesc).map((f) => ({
    group: "fuel",
    id: `fuel-${f.id}`,
    icon: GROUP_ICONS.fuel,
    title: f.station || "Заправка",
    sub: [
      fmtDate(f.date),
      f.km ? `${fmtKm(f.km)} км` : "",
      f.liters !== null ? `${fmtNum(f.liters, 2)} л` : "",
      f.paidTotal !== null ? fmtMoney(f.paidTotal) : "",
    ].filter(Boolean).join(" · "),
    text: hay(fuelSearchText(f)),
    target: { type: "fuel", id: f.id, date: f.date },
  }));

const serviceEntries = (service) =>
  [...service].sort(byDateDesc).map((s) => ({
    group: "service",
    id: `service-${s.id}`,
    icon: GROUP_ICONS.service,
    title: s.type || "Запись ТО",
    sub: [
      fmtDate(s.date),
      s.km ? `${fmtKm(s.km)} км` : "",
      s.cost !== null && s.cost !== undefined ? fmtMoney(s.cost, s.cost % 1 ? 2 : 0) : "",
      CATEGORY_LABELS[s.category] || "",
    ].filter(Boolean).join(" · "),
    text: hay(serviceSearchText(s, CATEGORY_LABELS[s.category])),
    target: { type: "service", id: s.id, date: s.date },
  }));

const reminderEntries = (reminders, currentKm) =>
  reminders
    .map((r) => {
      const status = reminderStatus(r, currentKm);
      const left = nearestDueLabel(r, currentKm);
      const sub = r.completed
        ? [STATUS_LABELS.done, fmtDate(r.completedDate), r.completedKm ? `${fmtKm(r.completedKm)} км` : ""]
        : [STATUS_LABELS[status], left ? left.text : "", r.dueDate && !left ? fmtDate(r.dueDate) : ""];
      return {
        group: "reminder",
        id: `reminder-${r.id}`,
        icon: r.icon || GROUP_ICONS.reminder,
        title: r.title || "Задача",
        sub: sub.filter(Boolean).join(" · "),
        rank: STATUS_RANK[status],
        text: hay([
          "задача напоминание", r.title, r.note, STATUS_LABELS[status],
          r.dueDate, fmtDate(r.dueDate), r.dueKm ? `${r.dueKm} ${fmtKm(r.dueKm)}` : "",
          r.completedDate, fmtDate(r.completedDate),
          r.completedKm ? `${r.completedKm} ${fmtKm(r.completedKm)}` : "",
          left ? left.text : "",
        ].join(" ")),
        target: { type: "reminder", id: r.id },
      };
    })
    .sort((a, b) => a.rank - b.rank);

/** Полный индекс. Пересчитывается только при изменении данных (useMemo у вызывающего). */
export function buildSearchIndex({ fuel, service, reminders, vehicle, currentKm }) {
  return [
    ...vehicleEntries(vehicle),
    ...serviceEntries(service),
    ...fuelEntries(fuel),
    ...reminderEntries(reminders, currentKm),
  ];
}

/* ---------------- поиск ---------------- */

export const MAX_PER_GROUP = 30;

/**
 * Все токены запроса должны встретиться в записи (как в фильтрах журналов).
 * Результат сгруппирован в порядке SEARCH_GROUPS; пустые группы опущены.
 */
export function searchIndex(index, query) {
  const tokens = queryTokens(query);
  if (!tokens.length) return [];
  const byGroup = new Map();
  index.forEach((entry) => {
    if (!tokens.every((t) => entry.text.includes(t))) return;
    const list = byGroup.get(entry.group) || [];
    if (list.length < MAX_PER_GROUP) list.push(entry);
    byGroup.set(entry.group, list);
  });
  return SEARCH_GROUPS
    .filter((g) => byGroup.has(g.id))
    .map((g) => ({ ...g, items: byGroup.get(g.id) }));
}

/**
 * Разбивает строку на фрагменты { text, hit } для подсветки совпадений.
 * Сопоставление ведётся по нормализованной копии, а фрагменты берутся из
 * исходной строки: для каждого символа исходника запоминается его
 * позиция в нормализованной строке.
 */
export function highlight(text, query) {
  const source = String(text || "");
  const tokens = queryTokens(query);
  if (!tokens.length || !source) return [{ text: source, hit: false }];

  const chars = [...source];
  const starts = []; // начало каждого исходного символа в flat
  let flat = "";
  chars.forEach((ch) => {
    starts.push(flat.length);
    flat += normalizeText(ch).replace(/ё/g, "е") || ch.toLowerCase();
  });
  starts.push(flat.length);

  const marks = new Array(chars.length).fill(false);
  tokens.forEach((t) => {
    let from = 0;
    while (from <= flat.length - t.length) {
      const i = flat.indexOf(t, from);
      if (i < 0) break;
      // помечаем исходные символы, чьи нормализованные части попали в совпадение
      chars.forEach((_, k) => {
        if (starts[k] < i + t.length && starts[k + 1] > i) marks[k] = true;
      });
      from = i + 1;
    }
  });

  const out = [];
  let cur = null;
  chars.forEach((ch, i) => {
    const hit = marks[i];
    if (cur && cur.hit === hit) cur.text += ch;
    else { cur = { text: ch, hit }; out.push(cur); }
  });
  return out;
}
