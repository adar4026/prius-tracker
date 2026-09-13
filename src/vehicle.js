// Технические данные автомобиля: паспорт, жидкости, шины, номера деталей.
//
// Хранятся отдельно от журналов (KEYS.vehicle) и на расчёты не влияют.
// Значения по умолчанию описывают текущий автомобиль; migrateVehicle
// дополняет сохранённый объект недостающими полями, поэтому старые
// данные и пустой localStorage открываются одинаково безопасно.

import { byDateDesc } from "./utils";

export const VEHICLE_DEFAULTS = {
  name: "Toyota Prius+",
  modelFull: "Toyota Prius+ / Prius v",
  year: "2012",
  fuelType: "Гибрид",
  engine: "1.8 Hybrid 136 CV",
  engineCode: "2ZR-FXE",
  body: "XW40",
  vin: "JTDZS3EU003044352",
  plate: "7722 JWB",
  color: "1G3",
  oil: {
    grade: "0W-20",
    volume: "4,2 л",
    filter: "Toyota 04152-YZZA6 / MANN HU6006z",
  },
  transmission: {
    fluid: "Toyota ATF WS",
    volume: "~3,4 л",
  },
  coolant: {
    engine: "Toyota SLLC, ~7,2 л",
    inverter: "Toyota SLLC, ~2,1 л",
  },
  tires: {
    stock: "215/50 R17",
    current: "205/60 R16",
    pcd: "5×114,3",
  },
  parts: {
    inverter: "G9200-47162",
  },
  docs: {
    // дата покупки показывается только если пользователь её сохранил
    purchaseDate: "",
  },
  notes: "",
};

const str = (v, fallback) => (typeof v === "string" ? v : fallback);

const group = (saved, defaults) => {
  const src = saved && typeof saved === "object" ? saved : {};
  return Object.fromEntries(
    Object.keys(defaults).map((k) => [k, str(src[k], defaults[k])])
  );
};

/** Приводит сохранённый объект к полной модели, подставляя значения по умолчанию. */
export function migrateVehicle(raw) {
  const v = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const d = VEHICLE_DEFAULTS;
  return {
    name: str(v.name, d.name),
    modelFull: str(v.modelFull, d.modelFull),
    year: str(v.year, d.year),
    fuelType: str(v.fuelType, d.fuelType),
    engine: str(v.engine, d.engine),
    engineCode: str(v.engineCode, d.engineCode),
    body: str(v.body, d.body),
    vin: str(v.vin, d.vin),
    plate: str(v.plate, d.plate),
    color: str(v.color, d.color),
    oil: group(v.oil, d.oil),
    transmission: group(v.transmission, d.transmission),
    coolant: group(v.coolant, d.coolant),
    tires: group(v.tires, d.tires),
    parts: group(v.parts, d.parts),
    docs: group(v.docs, d.docs),
    notes: str(v.notes, d.notes),
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
  const date = v.docs.purchaseDate.trim();
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.purchaseDate = "Дата в формате ГГГГ-ММ-ДД";
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
