import React, { useMemo, useState } from "react";
import Header from "../components/Header";
import DateField from "../components/DateField";
import VehicleSection, { SpecRow } from "../components/VehicleSection";
import { CopyIcon } from "../components/Icons";
import { useToast } from "../components/Toast";
import { copyText } from "../clipboard";
import {
  activeReminder, lastOilChange, lastService, migrateVehicle, validateVehicle,
} from "../vehicle";
import { fmtDate, fmtKm, kmLeftLabel, nearestDueLabel } from "../utils";

const OIL_RE = /масл/i;
const CVT_RE = /вариатор|atf|трансмис|cvt/i;
const COOLANT_RE = /антифриз|охлажд|sllc/i;
const ITV_RE = /itv|техосмотр/i;
const INSURANCE_RE = /страхов/i;

/** Строка «дата · пробег» для записи ТО. */
const when = (s) => `${fmtDate(s.date)}${s.km ? ` · ${fmtKm(s.km)} км` : ""}`;

export default function VehiclePage({
  vehicle, setVehicle, service, reminders, currentKm, onBack, onOpenService, onOpenReminders,
}) {
  // по умолчанию раскрыт только паспорт
  const [open, setOpen] = useState({ passport: true });
  const [form, setForm] = useState(null); // черновик редактирования или null
  const [errors, setErrors] = useState({});
  const [toast, showToast] = useToast();

  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  // производные данные из журналов — только то, что реально есть в записях
  const derived = useMemo(() => {
    const oil = lastOilChange(service);
    const oilReminder = activeReminder(reminders, OIL_RE);
    return {
      oil,
      oilLeft: oilReminder ? kmLeftLabel(oilReminder, currentKm) : null,
      cvt: lastService(service, "fluid", CVT_RE) || lastService(service, "oil", CVT_RE),
      coolant: lastService(service, "fluid", COOLANT_RE),
      tires: lastService(service, "tires"),
      itvLast: lastService(service, "inspection"),
      itvNext: activeReminder(reminders, ITV_RE),
      insurance: activeReminder(reminders, INSURANCE_RE),
    };
  }, [service, reminders, currentKm]);

  const copy = async (text, label) => {
    showToast((await copyText(text)) ? `${label} скопирован` : "Буфер обмена недоступен");
  };

  const copyBtn = (text, label) => (
    <button
      type="button"
      className="copy-btn"
      onClick={() => copy(text, label)}
      aria-label={`Скопировать ${label}`}
      title="Скопировать"
    >
      <CopyIcon size={16} />
    </button>
  );

  // технические коды (VIN, номера деталей, версия) — моноширинным начертанием
  const mono = (text) => <span className="mono">{text}</span>;

  const serviceLink = (entry, label = "Открыть в ТО") => (
    <button type="button" className="link-btn" onClick={() => onOpenService(entry)}>
      {label}
    </button>
  );

  /* ---------------- редактирование ---------------- */

  const startEdit = () => {
    setForm(migrateVehicle(vehicle));
    setErrors({});
  };
  const cancelEdit = () => {
    setForm(null);
    setErrors({});
  };
  const save = () => {
    const errs = validateVehicle(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const next = migrateVehicle(form);
    // текстовые поля сохраняются без крайних пробелов, VIN — заглавными
    next.name = next.name.trim();
    next.vin = next.vin.trim().toUpperCase();
    next.plate = next.plate.trim();
    next.year = next.year.trim();
    next.version = next.version.trim().toUpperCase();
    next.parts.inverter = next.parts.inverter.trim().toUpperCase();
    next.parts.battery12v = next.parts.battery12v.trim().toUpperCase();
    setVehicle(next);
    setForm(null);
    showToast("Сохранено");
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setIn = (grp, key) => (e) => {
    const value = e && e.target ? e.target.value : e;
    setForm((f) => ({ ...f, [grp]: { ...f[grp], [key]: value } }));
  };

  const field = (label, value, onChange, opts = {}) => (
    <div className="field">
      <label htmlFor={opts.id}>{label}</label>
      {opts.textarea ? (
        <textarea id={opts.id} rows={3} value={value} onChange={onChange} />
      ) : (
        <input
          id={opts.id}
          type="text"
          className={opts.mono ? "mono" : undefined}
          value={value}
          onChange={onChange}
          placeholder={opts.placeholder}
          inputMode={opts.inputMode}
          autoCapitalize={opts.autoCapitalize}
        />
      )}
      {opts.error && <div className="hint" style={{ color: "var(--red)" }}>{opts.error}</div>}
    </div>
  );

  if (form) {
    return (
      <>
        <Header
          title="Редактирование"
          onBack={cancelEdit}
          action={
            <button type="button" className="header__text-btn" onClick={save}>
              Сохранить
            </button>
          }
        />
        <main className="screen page">
          <div className="section-title">Автомобиль</div>
          <div className="card card--form">
            {field("Название", form.name, set("name"), { id: "v-name", error: errors.name })}
            {field("Полное наименование", form.modelFull, set("modelFull"), { id: "v-model" })}
            {field("Версия", form.version, set("version"), { id: "v-version", mono: true, autoCapitalize: "characters" })}
            <div className="form-row">
              {field("Год выпуска", form.year, set("year"), { id: "v-year", inputMode: "numeric", error: errors.year })}
              <div className="field">
                <label htmlFor="v-first-reg">Первая регистрация</label>
                <DateField
                  id="v-first-reg"
                  label="Первая регистрация"
                  value={form.docs.firstRegistration}
                  onChange={setIn("docs", "firstRegistration")}
                />
                {errors.firstRegistration && (
                  <div className="hint" style={{ color: "var(--red)" }}>{errors.firstRegistration}</div>
                )}
              </div>
            </div>
            <div className="form-row">
              {field("Тип (кратко)", form.fuelType, set("fuelType"), { id: "v-fuel" })}
              {field("Мощность", form.power, set("power"), { id: "v-power" })}
            </div>
            {field("Тип (полностью)", form.driveType, set("driveType"), { id: "v-drive" })}
            <div className="form-row">
              {field("Двигатель", form.engineCode, set("engineCode"), { id: "v-engine-code", mono: true })}
              {field("Силовая установка", form.engine, set("engine"), { id: "v-engine" })}
            </div>
            {field("VIN", form.vin, set("vin"), { id: "v-vin", mono: true, autoCapitalize: "characters", error: errors.vin })}
            <div className="form-row">
              {field("Госномер", form.plate, set("plate"), { id: "v-plate", mono: true, autoCapitalize: "characters" })}
              {field("Кузов", form.body, set("body"), { id: "v-body", mono: true })}
            </div>
            {field("Цвет кузова (код)", form.color, set("color"), { id: "v-color", mono: true })}
          </div>

          <div className="section-title">Моторное масло</div>
          <div className="card card--form">
            {field("Рекомендованное масло", form.oil.grade, setIn("oil", "grade"), { id: "v-oil-grade" })}
            <div className="form-row">
              {field("Объём без фильтра", form.oil.volumeNoFilter, setIn("oil", "volumeNoFilter"), { id: "v-oil-vol0" })}
              {field("Объём с фильтром", form.oil.volume, setIn("oil", "volume"), { id: "v-oil-vol" })}
            </div>
            {field("Масляный фильтр", form.oil.filter, setIn("oil", "filter"), { id: "v-oil-filter" })}
          </div>

          <div className="section-title">Трансмиссия</div>
          <div className="card card--form">
            <div className="form-row">
              {field("Масло", form.transmission.fluid, setIn("transmission", "fluid"), { id: "v-cvt-fluid" })}
              {field("Объём (частичная замена)", form.transmission.volume, setIn("transmission", "volume"), { id: "v-cvt-vol" })}
            </div>
          </div>

          <div className="section-title">Охлаждающие жидкости</div>
          <div className="card card--form">
            {field("Двигатель", form.coolant.engine, setIn("coolant", "engine"), { id: "v-cool-engine" })}
            {field("Инвертор", form.coolant.inverter, setIn("coolant", "inverter"), { id: "v-cool-inv" })}
          </div>

          <div className="section-title">Колёса и шины</div>
          <div className="card card--form">
            <div className="form-row">
              {field("Сверловка", form.tires.pcd, setIn("tires", "pcd"), { id: "v-tire-pcd" })}
              {field("Штатные диски", form.tires.rims, setIn("tires", "rims"), { id: "v-tire-rims" })}
            </div>
            <div className="form-row">
              {field("Штатные шины", form.tires.stock, setIn("tires", "stock"), { id: "v-tire-stock" })}
              {field("Текущие шины", form.tires.current, setIn("tires", "current"), { id: "v-tire-cur" })}
            </div>
            {field("Запасное колесо", form.tires.spare, setIn("tires", "spare"), { id: "v-tire-spare" })}
          </div>

          <div className="section-title">Номера деталей</div>
          <div className="card card--form">
            {field("Инвертор", form.parts.inverter, setIn("parts", "inverter"), { id: "v-part-inv", mono: true, autoCapitalize: "characters" })}
            {field("Аккумулятор 12 V", form.parts.battery12v, setIn("parts", "battery12v"), { id: "v-part-bat", mono: true, autoCapitalize: "characters" })}
          </div>

          <div className="section-title">Документы и заметки</div>
          <div className="card card--form">
            <div className="field">
              <label htmlFor="v-purchase">Дата покупки</label>
              <DateField
                id="v-purchase"
                label="Дата покупки"
                value={form.docs.purchaseDate}
                onChange={setIn("docs", "purchaseDate")}
              />
              {errors.purchaseDate && (
                <div className="hint" style={{ color: "var(--red)" }}>{errors.purchaseDate}</div>
              )}
            </div>
            {field("Заметки", form.notes, set("notes"), { id: "v-notes", textarea: true })}
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={cancelEdit}>Отмена</button>
            <button type="button" className="btn btn--solid" onClick={save}>Сохранить</button>
          </div>
        </main>
        {toast}
      </>
    );
  }

  /* ---------------- просмотр ---------------- */

  const oilColor = !derived.oilLeft
    ? "var(--muted)"
    : derived.oilLeft.overdue ? "var(--red)" : "var(--green)";

  const hasDocs = derived.itvLast || derived.itvNext || derived.insurance
    || vehicle.docs.firstRegistration || vehicle.docs.purchaseDate;

  return (
    <>
      <Header
        title="Автомобиль"
        onBack={onBack}
        action={
          <button type="button" className="header__text-btn" onClick={startEdit}>
            Редактировать
          </button>
        }
      />
      <main className="screen page">
        <div className="card vehicle-hero">
          <div className="vehicle-hero__icon" aria-hidden="true">🚗</div>
          <div className="vehicle-hero__name">{vehicle.name}</div>
          <div className="vehicle-hero__sub">{vehicle.year} · {vehicle.fuelType}</div>
          <div className="vehicle-hero__km">
            Текущий пробег: <b>{fmtKm(currentKm)} км</b>
          </div>
        </div>

        <div className="vsec-list">
          <VehicleSection
            icon="📘" title="Паспорт автомобиля"
            summary={`${vehicle.modelFull} · ${vehicle.year}`}
            open={!!open.passport} onToggle={() => toggle("passport")}
          >
            <dl className="spec-list">
              <SpecRow label="Модель" value={vehicle.modelFull} />
              {vehicle.version && <SpecRow label="Версия" value={mono(vehicle.version)} />}
              <SpecRow label="Год выпуска" value={vehicle.year} />
              {vehicle.docs.firstRegistration && (
                <SpecRow label="Первая регистрация" value={fmtDate(vehicle.docs.firstRegistration)} />
              )}
              <SpecRow label="Двигатель" value={mono(vehicle.engineCode)} />
              {vehicle.engine && <SpecRow label="Силовая установка" value={vehicle.engine} />}
              <SpecRow label="Тип" value={vehicle.driveType || vehicle.fuelType} />
              {vehicle.power && <SpecRow label="Мощность" value={vehicle.power} />}
              <SpecRow label="Кузов" value={mono(vehicle.body)} />
              <SpecRow label="VIN" value={mono(vehicle.vin)} action={copyBtn(vehicle.vin, "VIN")} />
              <SpecRow label="Госномер" value={mono(vehicle.plate)} action={copyBtn(vehicle.plate, "Госномер")} />
              {vehicle.color && <SpecRow label="Цвет кузова" value={mono(vehicle.color)} />}
              {vehicle.notes && <SpecRow label="Заметки" value={vehicle.notes} />}
            </dl>
          </VehicleSection>

          <VehicleSection
            icon="🛢️" title="Моторное масло"
            summary={`${vehicle.oil.grade} · ${vehicle.oil.volume} с фильтром`}
            open={!!open.oil} onToggle={() => toggle("oil")}
          >
            <dl className="spec-list">
              <SpecRow label="Масло" value={vehicle.oil.grade} />
              {vehicle.oil.volumeNoFilter && (
                <SpecRow label="Объём без фильтра" value={vehicle.oil.volumeNoFilter} />
              )}
              <SpecRow label="Объём с фильтром" value={vehicle.oil.volume} />
              <SpecRow label="Масляный фильтр" value={vehicle.oil.filter} />
              {derived.oil && <SpecRow label="Последняя замена" value={when(derived.oil)} />}
              {derived.oilLeft && (
                <SpecRow label="Статус" value={derived.oilLeft.text} color={oilColor} />
              )}
            </dl>
            <button type="button" className="btn btn--ghost btn--section" onClick={() => onOpenService()}>
              Открыть историю ТО
            </button>
          </VehicleSection>

          <VehicleSection
            icon="⚙️" title="Трансмиссия"
            summary={vehicle.transmission.fluid}
            open={!!open.cvt} onToggle={() => toggle("cvt")}
          >
            <dl className="spec-list">
              <SpecRow label="Масло" value={vehicle.transmission.fluid} />
              <SpecRow label="Частичная замена" value={vehicle.transmission.volume} />
              {derived.cvt && (
                <SpecRow label="Последняя замена" value={when(derived.cvt)} action={serviceLink(derived.cvt)} />
              )}
            </dl>
            <div className="hint">Справочные данные — не запись о выполненном обслуживании.</div>
          </VehicleSection>

          <VehicleSection
            icon="❄️" title="Охлаждающие жидкости"
            summary={derived.coolant ? `Замена ${fmtDate(derived.coolant.date)}` : "Двигатель и инвертор"}
            open={!!open.coolant} onToggle={() => toggle("coolant")}
          >
            <dl className="spec-list">
              <SpecRow label="Двигатель" value={vehicle.coolant.engine} />
              <SpecRow label="Инвертор" value={vehicle.coolant.inverter} />
              {derived.coolant && (
                <SpecRow label="Последняя замена" value={when(derived.coolant)} action={serviceLink(derived.coolant)} />
              )}
              {derived.coolant?.note && <SpecRow label="Заметка" value={derived.coolant.note} />}
            </dl>
          </VehicleSection>

          <VehicleSection
            icon="🛞" title="Колёса и шины"
            summary={`Сейчас ${vehicle.tires.current}`}
            open={!!open.tires} onToggle={() => toggle("tires")}
          >
            <dl className="spec-list">
              <SpecRow label="Сверловка" value={vehicle.tires.pcd} />
              {vehicle.tires.rims && <SpecRow label="Штатные диски" value={vehicle.tires.rims} />}
              <SpecRow label="Штатные шины" value={vehicle.tires.stock} />
              <SpecRow label="Текущие шины" value={vehicle.tires.current} />
              {vehicle.tires.spare && <SpecRow label="Запасное колесо" value={vehicle.tires.spare} />}
              {derived.tires && (
                <SpecRow label="Последняя замена" value={when(derived.tires)} action={serviceLink(derived.tires)} />
              )}
              {derived.tires?.note && <SpecRow label="Заметка" value={derived.tires.note} />}
            </dl>
          </VehicleSection>

          <VehicleSection
            icon="🔩" title="Важные номера деталей"
            summary={`Инвертор ${vehicle.parts.inverter}`}
            open={!!open.parts} onToggle={() => toggle("parts")}
          >
            <dl className="spec-list">
              <SpecRow label="Инвертор" value={mono(vehicle.parts.inverter)} action={copyBtn(vehicle.parts.inverter, "Номер инвертора")} />
              {vehicle.parts.battery12v && (
                <SpecRow label="Аккумулятор 12 V" value={mono(vehicle.parts.battery12v)} />
              )}
            </dl>
          </VehicleSection>

          <VehicleSection
            icon="📋" title="Документы и даты"
            summary={derived.insurance?.dueDate ? `Страховка до ${fmtDate(derived.insurance.dueDate)}` : "ITV, страховка, покупка"}
            open={!!open.docs} onToggle={() => toggle("docs")}
          >
            {hasDocs ? (
              <dl className="spec-list">
                {derived.itvLast && (
                  <SpecRow label="ITV пройден" value={when(derived.itvLast)} action={serviceLink(derived.itvLast)} />
                )}
                {derived.itvNext?.dueDate && (() => {
                  const left = nearestDueLabel(derived.itvNext, currentKm);
                  return (
                    <SpecRow
                      label="Следующий ITV"
                      value={`${fmtDate(derived.itvNext.dueDate)}${left ? ` · ${left.text}` : ""}`}
                      color={left?.overdue ? "var(--red)" : undefined}
                    />
                  );
                })()}
                {derived.insurance?.dueDate && (() => {
                  const left = nearestDueLabel(derived.insurance, currentKm);
                  return (
                    <SpecRow
                      label={derived.insurance.title}
                      value={`до ${fmtDate(derived.insurance.dueDate)}${left ? ` · ${left.text}` : ""}`}
                      color={left?.overdue ? "var(--red)" : undefined}
                    />
                  );
                })()}
                {derived.insurance?.note && <SpecRow label="Заметка" value={derived.insurance.note} />}
                {vehicle.docs.firstRegistration && (
                  <SpecRow label="Первая регистрация" value={fmtDate(vehicle.docs.firstRegistration)} />
                )}
                {vehicle.docs.purchaseDate && (
                  <SpecRow label="Дата покупки" value={fmtDate(vehicle.docs.purchaseDate)} />
                )}
              </dl>
            ) : (
              <div className="hint">Пока нет сохранённых документов.</div>
            )}
            <div className="vsec__actions">
              {!vehicle.docs.purchaseDate && (
                <button type="button" className="link-btn" onClick={startEdit}>
                  Добавить дату покупки
                </button>
              )}
              <button type="button" className="link-btn" onClick={onOpenReminders}>
                Все задачи и сроки
              </button>
            </div>
          </VehicleSection>
        </div>
      </main>
      {toast}
    </>
  );
}
