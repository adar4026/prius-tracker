// Технические данные автомобиля: паспорт, жидкости, шины, номера деталей.
//
// Хранятся отдельно от журналов (KEYS.vehicle) и на расчёты не влияют.
// Значения по умолчанию описывают текущий автомобиль; migrateVehicle
// дополняет сохранённый объект недостающими полями, поэтому старые
// данные и пустой localStorage открываются одинаково безопасно.

import { byDateDesc } from "./utils";

export const VEHICLE_DEFAULTS = {
  name: "Toyota Prius+",
  modelFull: "Toyota Prius+ 1.8 VVT-i HSD Advance",
  version: "ZVW40L-AWXEBW",
  year: "2012",
  // короткий тип для карточек и полное описание для паспорта
  fuelType: "Гибрид",
  driveType: "Гибрид (бензин + электродвигатель)",
  engine: "1.8 VVT-i HSD",
  engineCode: "2ZR-FXE",
  power: "136 CV / 99,96 kW",
  body: "XW40",
  vin: "JTDZS3EU003044352",
  plate: "7722 JWB",
  color: "1G3",
  oil: {
    grade: "0W-20",
    volumeNoFilter: "3,9 л",
    volume: "4,2 л", // полный объём при замене фильтра
    filter: "Toyota 04152-YZZA6 / MANN HU6006z",
  },
  transmission: {
    fluid: "Toyota ATF WS",
    volume: "3,4 л", // при частичной замене
  },
  coolant: {
    engine: "Toyota SLLC, ~7,2 л",
    inverter: "Toyota SLLC, ~2,1 л",
  },
  tires: {
    pcd: "PCD 114,3 × 5",
    rims: "7J",
    stock: "215/50 R17",
    current: "205/60 R16 91V",
    spare: "Temporary 135/70 D17",
  },
  parts: {
    inverter: "G9200-47162",
    battery12v: "S46B24R",
  },
  docs: {
    firstRegistration: "2012-12-27",
    // дата покупки показывается только если пользователь её сохранил
    purchaseDate: "",
  },
  notes: "",
};

// Значения по умолчанию из предыдущей версии модели. Если в сохранённом
// профиле поле совпадает со старым дефолтом, пользователь его не менял —
// такое поле безопасно обновить до нового справочного значения.
const LEGACY_DEFAULTS = {
  modelFull: "Toyota Prius+ / Prius v",
  engine: "1.8 Hybrid 136 CV",
  "transmission.volume": "~3,4 л",
  "tires.pcd": "5×114,3",
  "tires.current": "205/60 R16",
};

const str = (v, fallback) => (typeof v === "string" ? v : fallback);

/** Поле профиля: отсутствует → дефолт; равно старому дефолту → новый дефолт; иначе как есть. */
const pick = (saved, key, fallback, path = key) => {
  const value = str(saved[key], fallback);
  return path in LEGACY_DEFAULTS && value === LEGACY_DEFAULTS[path] ? fallback : value;
};

const group = (saved, name, defaults) => {
  const src = saved && typeof saved === "object" ? saved : {};
  return Object.fromEntries(
    Object.keys(defaults).map((k) => [k, pick(src, k, defaults[k], `${name}.${k}`)])
  );
};

/**
 * Приводит сохранённый объект к полной модели: недостающие поля берутся
 * из VEHICLE_DEFAULTS, введённые пользователем значения не трогаются.
 */
export function migrateVehicle(raw) {
  const v = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const d = VEHICLE_DEFAULTS;
  return {
    name: pick(v, "name", d.name),
    modelFull: pick(v, "modelFull", d.modelFull),
    version: pick(v, "version", d.version),
    year: pick(v, "year", d.year),
    fuelType: pick(v, "fuelType", d.fuelType),
    driveType: pick(v, "driveType", d.driveType),
    engine: pick(v, "engine", d.engine),
    engineCode: pick(v, "engineCode", d.engineCode),
    power: pick(v, "power", d.power),
    body: pick(v, "body", d.body),
    vin: pick(v, "vin", d.vin),
    plate: pick(v, "plate", d.plate),
    color: pick(v, "color", d.color),
    oil: group(v.oil, "oil", d.oil),
    transmission: group(v.transmission, "transmission", d.transmission),
    coolant: group(v.coolant, "coolant", d.coolant),
    tires: group(v.tires, "tires", d.tires),
    parts: group(v.parts, "parts", d.parts),
    docs: group(v.docs, "docs", d.docs),
    notes: pick(v, "notes", d.notes),
  };
}

/* ---------------- проверка полей формы ---------------- */

const CURRENT_YEAR = new Date().getFullYear();

/** Возвращает { field: сообщение } — пустой объект, если всё в порядке. */
export function validateVehicle(v) {
  const errors = {};
  if (!v.name.trim()) errors.name = "Укажите название автомобиля";
  if (!/^\d{4}$/.test(v.year.trim()) ||
      Number(v.year) < 1950 || Number(v.year) > CURRENT_YEAR + 1) {
    errors.year = "Год — четыре цифры, например 2012";
  }
  const vin = v.vin.trim();
  if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
    errors.vin = "VIN — 17 символов без букв I, O и Q";
  }
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if (v.docs.purchaseDate.trim() && !isoDate.test(v.docs.purchaseDate.trim())) {
    errors.purchaseDate = "Дата в формате ГГГГ-ММ-ДД";
  }
  if (v.docs.firstRegistration.trim() && !isoDate.test(v.docs.firstRegistration.trim())) {
    errors.firstRegistration = "Дата в формате ГГГГ-ММ-ДД";
  }
  return errors;
}

/* ---------------- связь с журналом ТО ---------------- */

/** Последняя замена масла с известным пробегом. */
export const lastOilChange = (service) =>
  service
    .filter((s) => s.category === "oil" && s.km > 0)
    .sort((a, b) => b.km - a.km)[0] || null;

const latest = (list) => [...list].sort(byDateDesc)[0] || null;

/** Последняя запись ТО заданной категории (и, при необходимости, по тексту). */
export const lastService = (service, category, pattern) =>
  latest(
    service.filter(
      (s) => s.category === category && (!pattern || pattern.test(s.type || ""))
    )
  );

/** Незакрытая задача, подходящая под шаблон названия. */
export const activeReminder = (reminders, pattern) =>
  reminders.find((r) => !r.completed && pattern.test(r.title || "")) || null;
