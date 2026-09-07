// Исторические записи из старого журнала My Car.
//
// Это не «начальные данные»: INITIAL_* применяются только при самом первом
// запуске, а на устройстве, где localStorage уже заполнен, они игнорируются.
// Поэтому история оформлена как разовая миграция (см. HISTORY_IMPORTS.id):
// приложение один раз доливает недостающие записи в уже существующие данные
// и запоминает выполненный импорт в KEYS.imports.
//
// Правила источника:
//   • неизвестное значение — null, а не 0 и не догадка;
//   • ни одна запись не удаляется и не изменяется, добавляются только новые;
//   • признак дубля для заправки — совпадение пробега (приложение и так
//     запрещает две заправки с одинаковым km), для ТО — дата + вид работ.

import { migrateFuel, migrateService, nextId } from "./utils";

/* ---------------- заправки ---------------- */
// station/note взяты из старого журнала как есть.
//
// Признак «полный бак» в старом журнале не сохранился. Модель требует boolean,
// поэтому берётся значение по умолчанию (полный), но расход по таким записям
// НЕ рассчитывается: без реальных границ цикла получались бы числа вроде
// 1,87 и 23,18 л/100 км, которые испортили бы средний расход. Как только
// у записи проставлен настоящий признак бака, обычное редактирование
// пересчитает расход штатным recalcFrom.

const FUEL_2025 = [
  { date:"2025-06-10", km:189000, liters:26.000, pricePerL:1.539, grossTotal:40.00, station:"Repsol" },
  { date:"2025-06-21", km:189700, liters:28.000, pricePerL:1.643, grossTotal:46.00, station:"Repsol" },
  { date:"2025-06-30", km:190300, liters:30.000, pricePerL:1.550, grossTotal:46.50, station:"Repsol Gijón" },
  { date:"2025-07-12", km:190900, liters:26.600, pricePerL:1.459, grossTotal:38.80, station:"Repsol" },
  { date:"2025-07-19", km:191536, liters:26.300, pricePerL:1.521, grossTotal:40.00, station:"Alcampo El Entrego" },
  { date:"2025-07-26", km:192000, liters:31.270, pricePerL:1.599, grossTotal:50.00, station:"Repsol, Oviedo" },
  { date:"2025-08-08", km:192827, liters:25.332, pricePerL:1.579, grossTotal:40.00, station:"Oviedo" },
  { date:"2025-08-15", km:193304, liters:29.630, pricePerL:1.350, grossTotal:40.00, station:"Хихон" },
  { date:"2025-08-23", km:193988, liters:23.818, pricePerL:1.679, grossTotal:39.99, station:"Gijón" },
  { date:"2025-08-30", km:194404, liters:24.860, pricePerL:1.609, grossTotal:40.00, station:"Oviedo" },
  { date:"2025-09-03", km:194808, liters:28.996, pricePerL:1.379, grossTotal:40.00, station:"El Entrego" },
  { date:"2025-09-06", km:195487, liters:25.642, pricePerL:1.565, grossTotal:40.13, station:"Madrid" },
  { date:"2025-09-07", km:195757, liters:23.631, pricePerL:1.589, grossTotal:37.55, station:"Burgos" },
  { date:"2025-09-13", km:196330, liters:29.007, pricePerL:1.379, grossTotal:40.00, station:"Alcampo" },
  { date:"2025-09-21", km:197085, liters:17.868, pricePerL:1.679, grossTotal:30.00, station:"" },
  { date:"2025-09-27", km:197451, liters:24.860, pricePerL:1.609, grossTotal:40.00, station:"Oviedo" },
  { date:"2025-10-08", km:197955, liters:37.611, pricePerL:1.649, grossTotal:62.02, station:"Хихон" },
  { date:"2025-10-19", km:198722, liters:15.209, pricePerL:1.699, grossTotal:25.84, station:"" },
  { date:"2025-10-26", km:199010, liters:11.320, pricePerL:1.659, grossTotal:18.78, station:"" },
  { date:"2025-11-01", km:199231, liters:23.972, pricePerL:1.669, grossTotal:40.01, station:"" },
  { date:"2025-11-08", km:199631, liters:31.301, pricePerL:1.599, grossTotal:50.05, station:"" },
  { date:"2025-11-08", km:200059, liters:25.199, pricePerL:null,  grossTotal:39.79, station:"Madrid",
    note:"Цена за литр в старом журнале перекрыта — не восстановлена" },
  { date:"2025-11-13", km:200776, liters:25.960, pricePerL:1.619, grossTotal:42.03, station:"Benidorm" },
  { date:"2025-11-19", km:201208, liters:30.952, pricePerL:1.629, grossTotal:50.42, station:"Benidorm" },
  { date:"2025-11-26", km:201672, liters:20.981, pricePerL:1.559, grossTotal:32.71, station:"Трасса, Madrid" },
  { date:"2025-11-26", km:202137, liters:25.823, pricePerL:null,  grossTotal:40.00, station:"",
    note:"Цена за литр в старом журнале перекрыта — не восстановлена" },
  { date:"2025-12-05", km:202641, liters:25.243, pricePerL:1.585, grossTotal:40.01, station:"Gijón" },
  { date:"2025-12-09", km:203024, liters:25.570, pricePerL:1.569, grossTotal:40.12, station:"Ribadesella" },
  { date:"2025-12-27", km:203631, liters:26.230, pricePerL:1.525, grossTotal:40.00, station:"Oviedo" },
];

const FUEL_2026 = [
  { date:"2026-01-05", km:204058, liters:26.333, pricePerL:1.519, grossTotal:40.00, station:"Oviedo" },
  { date:"2026-01-10", km:204444, liters:28.450, pricePerL:1.529, grossTotal:43.50, station:"Bilbao" },
  { date:"2026-01-11", km:205121, liters:12.660, pricePerL:1.579, grossTotal:19.99, station:"Caparoca, Сарагоса" },
  { date:"2026-01-11", km:205251, liters:30.137, pricePerL:1.535, grossTotal:46.26, station:"Caparoca, Сарагоса" },
  { date:"2026-01-16", km:205954, liters:null,   pricePerL:null,  grossTotal:null,  station:"Трасса, Хихон",
    note:"Объём, цена и сумма в старом журнале перекрыты — не восстановлены" },
  { date:"2026-01-22", km:206421, liters:25.110, pricePerL:1.593, grossTotal:40.00, station:"" },
  { date:"2026-01-31", km:206919, liters:25.110, pricePerL:1.593, grossTotal:40.00, station:"" },
  { date:"2026-02-06", km:207389, liters:24.882, pricePerL:1.608, grossTotal:40.01, station:"" },
  { date:"2026-02-14", km:207908, liters:28.037, pricePerL:1.605, grossTotal:45.00, station:"Хихон" },
  { date:"2026-02-21", km:208369, liters:24.272, pricePerL:1.648, grossTotal:40.00, station:"Siero" },
  { date:"2026-03-01", km:208952, liters:24.178, pricePerL:1.654, grossTotal:39.99, station:"" },
  { date:"2026-03-06", km:209368, liters:24.257, pricePerL:1.649, grossTotal:40.00, station:"Хихон" },
];

/* ---------------- ТО, ремонты и расходы ---------------- */
// Только записи, которых в журнале ещё нет. События, уже записанные одной
// объединённой строкой (08.08.2025, 10.09.2025, 19.02.2021), сюда не входят —
// они бы удвоили суммы; расхождения вынесены в отчёт.

const SERVICE = [
  { date:"2019-11-21", km:106500, type:"Покупка автомобиля", cost:null, note:"Benidorm", category:"other" },
  { date:"2019-11-27", km:106700, type:"Аккумулятор 12V", cost:59, note:"Benidorm", category:"battery" },
  { date:"2024-01-18", km:155347, type:"ITV Техосмотр", cost:null, note:"Benidorm", category:"inspection" },
  { date:"2024-11-21", km:170000, type:"Щётки стеклоочистителя", cost:20, note:"Asturias. Передние дворники 70 см и 36 см", category:"parts" },
  { date:"2024-11-21", km:null, type:"Страхование", cost:271.17, note:"Агент Татьяна, начало 21.11.2024", category:"insurance" },
  { date:"2025-02-21", km:178100, type:"Задний дворник", cost:15, note:"Asturias", category:"parts" },
  { date:"2025-05-24", km:183000, type:"Накачал шины", cost:null, note:"El Entrego. Стоимость неизвестна", category:"tires" },
  { date:"2025-08-08", km:null, type:"Масло в коробку автомат", cost:68, note:"Toyota магазин. Покупка", category:"parts" },
  { date:"2025-08-08", km:null, type:"Масло в коробку и фильтр", cost:84, note:"Toyota магазин. Покупка", category:"parts" },
  { date:"2025-08-13", km:null, type:"Свечи", cost:103, note:"Toyota магазин. Запчасти", category:"parts" },
];

/* ---------------- разбор расхождений со старым журналом ---------------- */
// Правки существующих записей: старый журнал точнее там, где в текущей базе
// стоял 0 (= «бесплатно») вместо неизвестной или реальной суммы, а текущая
// база точнее в пробегах и в разбивке уже уточнённых сумм.

const FUEL_PATCHES = [
  // дата заправки: в журнале 26.05, в базе стояло 23.05
  { match: { km: 215239 }, set: { date: "2026-05-26" } },
];

const SERVICE_PATCHES = [
  {
    // большой сервис остаётся одной записью на 150 € — четыре отдельные строки
    // задвоили бы расходы; детализация уходит в заметку
    match: { date: "2025-08-08", type: "Стойка стаб. + прокладка натяжителя + тормозная жидкость DOT4 + балансировка" },
    set: {
      note:
        "Олександр, Овьедо. Стойка стабилизатора 27 € + замена 37 €; " +
        "прокладка натяжителя цепи 5,30 € + замена 37 €; " +
        "тормозная жидкость DOT4 1 л 14 € + замена 15 €; " +
        "балансировка двух передних колёс 15 €. Ревизия ходовой — всё нормально.",
    },
  },
  {
    // 205 € — полная стоимость события; 100 € из старого журнала это только работа
    match: { date: "2025-09-10", type: "Масло 5W-30 + фильтр + жидкость вариатора + свечи" },
    set: {
      note:
        "Олександр. Свечи Toyota 105 € + работа 100 €. " +
        "Работа: свечи 30 €, масло коробки 30 €, моторное масло 40 €.",
    },
  },
  {
    // 0 € означало бы бесплатно, а стоимость на самом деле неизвестна
    match: { date: "2025-01-24", type: "ITV Техосмотр" },
    set: { cost: null, note: "Пройден. Перегорела лампа фары" },
  },
  {
    match: { date: "2025-02-14", type: "Масло и фильтр" },
    set: {
      cost: 100,
      note: "Алекс, Овьедо. Работа по замене 45 €; масло и фильтр куплены отдельно, около 56 €",
    },
  },
  {
    match: { date: "2025-04-01", type: "Ремонт суппорта левого тормоза" },
    set: { cost: 60, note: "Aleks Motors Oviedo. Греется диск, колодки полностью не отходят" },
  },
  {
    match: { date: "2024-06-08", type: "Масло и фильтр 0W-20" },
    set: { cost: 50, note: "lubricantesweb.es. Менял самостоятельно" },
  },
  {
    // пробег из старого журнала, стоимость остаётся более точной
    match: { date: "2021-11-13", type: "Задние тормозные колодки TRW" },
    set: { km: 126000, note: "TRW, куплены самостоятельно. AutoDoc" },
  },
];

const SERVICE_SPLITS = [
  {
    // две работы с разными интервалами следующей замены; сумма 215 € сохраняется
    match: { date: "2021-02-19", type: "Замена масла вариатора + антифриз (2 контура)" },
    into: [
      { type: "Замена масла вариатора", cost: 100, note: "Toyota Центр Бенидорм", category: "fluid" },
      { type: "Антифриз (2 контура)", cost: 115, note: "Toyota Центр Бенидорм", category: "fluid" },
    ],
  },
];

/**
 * Разделение записей, где под одной карточкой было объединено несколько
 * самостоятельных работ. Каждая работа получает свою карточку, категорию
 * и (где известна) свою стоимость — детализация взята из заметки прежней
 * объединённой записи, ничего не досчитано и не придумано.
 */
const SERVICE_SPLITS_2 = [
  {
    // сумма 4 позиций 150,30 € на 0,30 € больше фактически оплаченных 150 € —
    // расхождение сохранено как есть, каждая карточка поясняет расчёт
    match: { date: "2025-08-08", type: "Стойка стаб. + прокладка натяжителя + тормозная жидкость DOT4 + балансировка" },
    into: [
      {
        type: "Замена стойки стабилизатора", cost: 64, category: "suspension",
        note:
          "Олександр, Овьедо. Стойка стабилизатора 27 € + работа 37 €. Ревизия ходовой при визите — всё в норме. " +
          "Разделено из общей записи 08.08.2025: сумма по 4 позициям 150,30 €, фактически оплачено за визит 150 €.",
      },
      {
        type: "Замена прокладки натяжителя цепи", cost: 42.30, category: "other",
        note:
          "Олександр, Овьедо. Прокладка натяжителя цепи 5,30 € + работа 37 €. " +
          "Часть визита 08.08.2025 (сумма по 4 позициям 150,30 €, фактически оплачено 150 €).",
      },
      {
        type: "Замена тормозной жидкости DOT4", cost: 29, category: "fluid",
        note:
          "Олександр, Овьедо. Тормозная жидкость DOT4 1 л 14 € + работа 15 €. " +
          "Часть визита 08.08.2025 (сумма по 4 позициям 150,30 €, фактически оплачено 150 €).",
      },
      {
        type: "Балансировка передних колёс", cost: 15, category: "tires",
        note:
          "Олександр, Овьедо. Балансировка двух передних колёс. " +
          "Часть визита 08.08.2025 (сумма по 4 позициям 150,30 €, фактически оплачено 150 €).",
      },
    ],
  },
  {
    // сумма 3 позиций 205 € совпадает с исходной стоимостью визита без остатка
    match: { date: "2025-09-10", type: "Масло 5W-30 + фильтр + жидкость вариатора + свечи" },
    into: [
      {
        type: "Замена моторного масла 5W-30 и фильтра", cost: 40, category: "oil",
        note: "Олександр. Работа по замене масла и фильтра 40 €. Стоимость масла и фильтра в сумму не входит — куплены отдельно.",
      },
      {
        type: "Замена жидкости вариатора", cost: 30, category: "fluid",
        note: "Олександр. Работа по замене жидкости вариатора 30 €. Стоимость жидкости в сумму не входит — куплена отдельно.",
      },
      {
        type: "Замена свечей зажигания", cost: 135, category: "other",
        note:
          "Олександр. Свечи Toyota 105 € (материал) + работа 30 €. " +
          "Возможно совпадает с покупкой «Свечи» от 13.08.2025 (103 €) — требует проверки, пока не объединено.",
      },
    ],
  },
];

/** Разовые миграции истории. Каждая применяется не более одного раза. */
export const HISTORY_IMPORTS = [
  {
    id: "mycar-history-2019-2026",
    fuel: [...FUEL_2025, ...FUEL_2026],
    service: SERVICE,
  },
  {
    id: "mycar-conflicts-2026-09",
    fuelPatches: FUEL_PATCHES,
    servicePatches: SERVICE_PATCHES,
    serviceSplits: SERVICE_SPLITS,
  },
  {
    id: "mycar-splits-2026-09-2",
    serviceSplits: SERVICE_SPLITS_2,
  },
];

/* ---------------- слияние без дублей ---------------- */

const FUEL_DEFAULTS = {
  liters: null, pricePerL: null, grossTotal: null, discount: 0,
  paidTotal: null, station: "", fullTank: true, note: "",
};

/**
 * Добавляет заправки, которых ещё нет. Дубль определяется по пробегу:
 * приложение само запрещает две заправки с одинаковым km, поэтому запись
 * с уже занятым пробегом считается той же самой, даже если дата отличается.
 * Расход импортированных записей остаётся пустым, а сохранённые значения
 * существующих записей не пересчитываются — статистика не меняется.
 */
export function mergeFuel(existing, incoming) {
  const takenKm = new Set(existing.map((e) => e.km));
  const added = [];
  const skipped = [];
  let id = nextId(existing);

  incoming.forEach((r) => {
    if (takenKm.has(r.km)) {
      skipped.push(r);
      return;
    }
    takenKm.add(r.km);
    added.push({ ...FUEL_DEFAULTS, ...r, id: id++, consumption: null });
  });

  if (!added.length) return { list: existing, added, skipped };
  return { list: migrateFuel([...existing, ...added]), added, skipped };
}

const serviceKey = (s) =>
  `${s.date}|${String(s.type || "").toLowerCase().trim()}`;

/** Добавляет записи ТО, которых ещё нет. Ключ дубля — дата + вид работ. */
export function mergeService(existing, incoming) {
  const taken = new Set(existing.map(serviceKey));
  const added = [];
  const skipped = [];
  let id = nextId(existing);

  incoming.forEach((r) => {
    if (taken.has(serviceKey(r))) {
      skipped.push(r);
      return;
    }
    taken.add(serviceKey(r));
    added.push({ note: "", category: "other", ...r, id: id++ });
  });

  if (!added.length) return { list: existing, added, skipped };
  return { list: migrateService([...existing, ...added]), added, skipped };
}

/* ---------------- применение партии миграции ---------------- */

const matchesService = (s, m) =>
  s.date === m.date &&
  String(s.type || "").toLowerCase().trim() === String(m.type || "").toLowerCase().trim();

/** Заправки партии: сначала новые записи, затем точечные правки существующих. */
export function applyFuelBatch(list, batch) {
  let out = batch.fuel && batch.fuel.length ? mergeFuel(list, batch.fuel).list : list;

  (batch.fuelPatches || []).forEach((p) => {
    out = out.map((f) => (f.km === p.match.km ? { ...f, ...p.set } : f));
  });

  // правки не трогают ни литры, ни пробег, поэтому расход пересчитывать не нужно
  return out;
}

/**
 * Записи ТО партии: новые записи, точечные правки и разделение объединённых
 * событий. Разделение именно заменяет исходную запись, а не добавляется
 * поверх неё, — иначе сумма события удвоилась бы.
 */
export function applyServiceBatch(list, batch) {
  let out = batch.service && batch.service.length ? mergeService(list, batch.service).list : list;

  (batch.servicePatches || []).forEach((p) => {
    out = out.map((s) => (matchesService(s, p.match) ? { ...s, ...p.set } : s));
  });

  (batch.serviceSplits || []).forEach((split) => {
    const target = out.find((s) => matchesService(s, split.match));
    if (!target) return;
    let id = nextId(out);
    const parts = split.into.map((part, i) => ({
      ...target,
      ...part,
      id: i === 0 ? target.id : id++,
    }));
    out = out.flatMap((s) => (s.id === target.id ? parts : [s]));
  });

  return migrateService(out);
}
