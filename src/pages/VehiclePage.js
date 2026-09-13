import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header";
import VehicleSection, { SpecRow } from "../components/VehicleSection";
import VehicleEditor from "../components/VehicleEditor";
import { CarIcon, CopyIcon, EditIcon } from "../components/Icons";
import { useToast } from "../components/Toast";
import { copyText } from "../clipboard";
import {
  activeReminder, lastOilChange, lastService, migrateVehicle, validateVehicle,
} from "../vehicle";
import { fmtDate, fmtKm, fmtMoney, fmtPrice, kmLeftLabel, nearestDueLabel, num } from "../utils";

const OIL_RE = /масл/i;
const CVT_RE = /вариатор|atf|трансмис|cvt/i;
const COOLANT_RE = /антифриз|охлажд|sllc/i;
const ITV_RE = /itv|техосмотр/i;
const INSURANCE_RE = /страхов/i;

/** Строка «дата · пробег» для записи ТО. */
const when = (s) => `${fmtDate(s.date)}${s.km ? ` · ${fmtKm(s.km)} км` : ""}`;

/** Секции в порядке показа; по умолчанию раскрыт только паспорт. */
const initialOpen = (section) => ({ passport: true, ...(section ? { [section]: true } : {}) });

export default function VehiclePage({
  vehicle, setVehicle, photo, service, reminders, currentKm, initialSection,
  onBack, onOpenService, onOpenReminders,
}) {
  const [open, setOpen] = useState(() => initialOpen(initialSection));
  const [form, setForm] = useState(null); // черновик редактирования или null
  const [errors, setErrors] = useState({});
  const [toast, showToast] = useToast();
  const sectionRefs = useRef({});

  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  // переход из поиска: нужная секция раскрыта и подведена к верху экрана
  useEffect(() => {
    if (!initialSection) return undefined;
    setOpen(initialOpen(initialSection));
    const t = setTimeout(() => {
      sectionRefs.current[initialSection]?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 60);
    return () => clearTimeout(t);
  }, [initialSection]);

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

  const copy = async (text) => {
    showToast((await copyText(text)) ? "Скопировано" : "Буфер обмена недоступен");
  };

  const copyBtn = (text, label) => (
    <button
      type="button"
      className="copy-btn"
      onClick={() => copy(text)}
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

  /**
   * Сохранение: сначала фото (IndexedDB), затем профиль. Если фото не
   * записалось, профиль не трогаем и остаёмся в редакторе с сообщением.
   */
  const save = async (photoDraft) => {
    const errs = validateVehicle(form);
    setErrors(errs);
    if (Object.keys(errs).length) return false;

    try {
      if (photoDraft instanceof Blob) await photo.save(photoDraft);
      else if (photoDraft === null) await photo.remove();
    } catch {
      setErrors({ photo: "Не удалось сохранить фото. Попробуйте ещё раз." });
      return false;
    }

    const next = migrateVehicle(form);
    // текстовые поля сохраняются без крайних пробелов, коды — заглавными
    ["name", "brand", "model", "modelFull", "plate", "year", "notes"].forEach((k) => {
      next[k] = next[k].trim();
    });
    if (!next.name) next.name = [next.brand, next.model].filter(Boolean).join(" ");
    next.vin = next.vin.trim().toUpperCase();
    next.version = next.version.trim().toUpperCase();
    next.parts.inverter = next.parts.inverter.trim().toUpperCase();
    next.parts.battery12v = next.parts.battery12v.trim().toUpperCase();
    Object.keys(next.docs).forEach((k) => { next.docs[k] = next.docs[k].trim(); });
    setVehicle(next);
    setForm(null);
    showToast("Сохранено");
    return true;
  };

  if (form) {
    return (
      <>
        <VehicleEditor
          form={form}
          setForm={setForm}
          errors={errors}
          photoUrl={photo.url}
          onCancel={cancelEdit}
          onSave={save}
        />
        {toast}
      </>
    );
  }

  /* ---------------- просмотр ---------------- */

  const oilColor = !derived.oilLeft
    ? "var(--muted)"
    : derived.oilLeft.overdue ? "var(--red)" : "var(--green)";

  const docs = vehicle.docs;
  const hasDocs = derived.itvLast || derived.itvNext || derived.insurance
    || docs.itvUntil || docs.insuranceCompany || docs.insuranceUntil || docs.other;
  const hasPurchase = docs.purchaseDate || docs.purchaseKm || docs.purchasePrice;
  const purchaseKm = num(docs.purchaseKm);

  const heroDate = docs.firstRegistration ? fmtDate(docs.firstRegistration) : vehicle.year;

  // основные данные — только заполненные поля
  const mainSpecs = [
    ["Марка", vehicle.brand],
    ["Модель", vehicle.model],
    ["Дата первой регистрации", docs.firstRegistration ? fmtDate(docs.firstRegistration) : ""],
    ["Тип топлива", vehicle.driveType || vehicle.fuelType],
    ["Мощность", vehicle.power.replace(" / ", " · ")],
    ["Версия", vehicle.version, true],
    ["Двигатель", vehicle.engineCode, true],
    ["Цвет кузова", vehicle.color, true],
  ].filter(([, value]) => value);

  const bindSection = (id) => (node) => { sectionRefs.current[id] = node; };

  return (
    <>
      <Header
        title={vehicle.name}
        onBack={onBack}
        action={
          <button
            type="button"
            className="header__btn"
            onClick={startEdit}
            aria-label="Редактировать профиль автомобиля"
            title="Редактировать"
          >
            <EditIcon />
          </button>
        }
      />
      <main className="screen page">
        <div className="card vehicle-hero">
          {photo.url ? (
            <img src={photo.url} alt={vehicle.name} className="vehicle-photo" />
          ) : (
            <div className="vehicle-photo vehicle-photo--empty">
              <span className="vehicle-photo__icon" aria-hidden="true"><CarIcon size={44} /></span>
              {!photo.loading && (
                <button type="button" className="btn btn--mini vehicle-photo__add" onClick={startEdit}>
                  Добавить фото автомобиля
                </button>
              )}
            </div>
          )}
          <div className="vehicle-hero__body">
            <div className="vehicle-hero__name">{vehicle.name}</div>
            <div className="vehicle-hero__sub">{heroDate} · {vehicle.fuelType}</div>
            <div className="vehicle-hero__km">
              Текущий пробег: <b>{fmtKm(currentKm)} км</b>
            </div>
          </div>
        </div>

        {mainSpecs.length > 0 && (
          <>
            <div className="section-title">Основные данные</div>
            <div className="card vehicle-main">
              <dl className="spec-grid">
                {mainSpecs.map(([label, value, isMono]) => (
                  <div key={label} className="spec-grid__cell">
                    <dt>{label}</dt>
                    <dd>{isMono ? mono(value) : value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </>
        )}

        <div className="section-title">Покупка и пробег</div>
        <div className="card vehicle-main">
          <dl className="spec-list">
            {docs.purchaseDate && <SpecRow label="Дата покупки" value={fmtDate(docs.purchaseDate)} />}
            {docs.purchaseKm && <SpecRow label="Пробег при покупке" value={`${fmtKm(purchaseKm)} км`} />}
            {docs.purchasePrice && <SpecRow label="Цена покупки" value={fmtPrice(num(docs.purchasePrice))} />}
            <SpecRow label="Текущий пробег" value={`${fmtKm(currentKm)} км`} color="var(--accent)" />
            {docs.purchaseKm && currentKm >= purchaseKm && (
              <SpecRow label="Пройдено с покупки" value={`${fmtKm(currentKm - purchaseKm)} км`} />
            )}
          </dl>
          {!hasPurchase && (
            <button type="button" className="link-btn" onClick={startEdit}>
              Добавить данные о покупке
            </button>
          )}
        </div>

        <div className="vsec-list">
          <VehicleSection
            ref={bindSection("passport")}
            icon="📘" title="Паспорт и идентификация"
            summary={`${vehicle.vin} · ${vehicle.plate}`}
            open={!!open.passport} onToggle={() => toggle("passport")}
          >
            <dl className="spec-list">
              <SpecRow label="VIN" value={mono(vehicle.vin)} action={copyBtn(vehicle.vin, "VIN")} />
              <SpecRow label="Госномер" value={mono(vehicle.plate)} action={copyBtn(vehicle.plate, "госномер")} />
              <SpecRow label="Автомобиль" value={vehicle.modelFull} />
              {vehicle.version && <SpecRow label="Версия" value={mono(vehicle.version)} />}
              <SpecRow label="Двигатель" value={mono(vehicle.engineCode)} />
              {vehicle.engine && <SpecRow label="Силовая установка" value={vehicle.engine} />}
              <SpecRow label="Тип" value={vehicle.driveType || vehicle.fuelType} />
              {vehicle.power && <SpecRow label="Мощность" value={vehicle.power} />}
              {vehicle.color && <SpecRow label="Код цвета" value={mono(vehicle.color)} />}
              {vehicle.body && <SpecRow label="Кузов" value={mono(vehicle.body)} />}
              <SpecRow label="Год выпуска" value={vehicle.year} />
              {vehicle.notes && <SpecRow label="Заметки" value={vehicle.notes} />}
            </dl>
          </VehicleSection>

          <VehicleSection
            ref={bindSection("oil")}
            icon="🛢️" title="Моторное масло"
            summary={`${vehicle.oil.grade} · ${vehicle.oil.volume} с фильтром`}
            open={!!open.oil} onToggle={() => toggle("oil")}
          >
            <dl className="spec-list">
              <SpecRow label="Рекомендованное масло" value={vehicle.oil.grade} />
              {vehicle.oil.volumeNoFilter && (
                <SpecRow label="Объём без фильтра" value={vehicle.oil.volumeNoFilter} />
              )}
              <SpecRow label="Объём с фильтром" value={vehicle.oil.volume} />
              <SpecRow label="Фильтры" value={vehicle.oil.filter} />
              {derived.oil && (
                <SpecRow label="Последняя замена" value={when(derived.oil)} action={serviceLink(derived.oil)} />
              )}
              {derived.oil && derived.oil.cost !== null && (
                <SpecRow label="Стоимость замены" value={fmtMoney(derived.oil.cost, derived.oil.cost % 1 ? 2 : 0)} />
              )}
              {derived.oilLeft && (
                <SpecRow label="Статус" value={derived.oilLeft.text} color={oilColor} />
              )}
            </dl>
            <button type="button" className="btn btn--ghost btn--section" onClick={() => onOpenService()}>
              Открыть историю ТО
            </button>
          </VehicleSection>

          <VehicleSection
            ref={bindSection("cvt")}
            icon="⚙️" title="Трансмиссия"
            summary={vehicle.transmission.fluid}
            open={!!open.cvt} onToggle={() => toggle("cvt")}
          >
            <dl className="spec-list">
              <SpecRow label="Масло" value={vehicle.transmission.fluid} />
              <SpecRow label="Объём при частичной замене" value={vehicle.transmission.volume} />
              {derived.cvt && (
                <SpecRow label="Последняя замена" value={when(derived.cvt)} action={serviceLink(derived.cvt)} />
              )}
            </dl>
            <div className="hint">Справочные данные — не запись о выполненном обслуживании.</div>
          </VehicleSection>

          <VehicleSection
            ref={bindSection("coolant")}
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
            ref={bindSection("tires")}
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
            ref={bindSection("parts")}
            icon="🔩" title="Важные номера деталей"
            summary={`Инвертор ${vehicle.parts.inverter}`}
            open={!!open.parts} onToggle={() => toggle("parts")}
          >
            <dl className="spec-list">
              <SpecRow label="Инвертор" value={mono(vehicle.parts.inverter)} action={copyBtn(vehicle.parts.inverter, "номер инвертора")} />
              {vehicle.parts.battery12v && (
                <SpecRow label="Аккумулятор 12 V" value={mono(vehicle.parts.battery12v)} />
              )}
            </dl>
          </VehicleSection>

          <VehicleSection
            ref={bindSection("docs")}
            icon="📋" title="Документы и даты"
            summary={
              docs.insuranceUntil ? `Страховка до ${fmtDate(docs.insuranceUntil)}`
              : derived.insurance?.dueDate ? `Страховка до ${fmtDate(derived.insurance.dueDate)}`
              : "ITV, страховка"
            }
            open={!!open.docs} onToggle={() => toggle("docs")}
          >
            {hasDocs ? (
              <dl className="spec-list">
                {derived.itvLast && (
                  <SpecRow label="ITV пройден" value={when(derived.itvLast)} action={serviceLink(derived.itvLast)} />
                )}
                {docs.itvUntil && (() => {
                  const left = nearestDueLabel({ dueDate: docs.itvUntil }, currentKm);
                  return (
                    <SpecRow
                      label="ITV действует до"
                      value={`${fmtDate(docs.itvUntil)}${left ? ` · ${left.text}` : ""}`}
                      color={left?.overdue ? "var(--red)" : undefined}
                    />
                  );
                })()}
                {!docs.itvUntil && derived.itvNext?.dueDate && (() => {
                  const left = nearestDueLabel(derived.itvNext, currentKm);
                  return (
                    <SpecRow
                      label="Следующий ITV"
                      value={`${fmtDate(derived.itvNext.dueDate)}${left ? ` · ${left.text}` : ""}`}
                      color={left?.overdue ? "var(--red)" : undefined}
                    />
                  );
                })()}
                {docs.insuranceCompany && <SpecRow label="Страховая компания" value={docs.insuranceCompany} />}
                {docs.insuranceUntil && (() => {
                  const left = nearestDueLabel({ dueDate: docs.insuranceUntil }, currentKm);
                  return (
                    <SpecRow
                      label="Страховка до"
                      value={`${fmtDate(docs.insuranceUntil)}${left ? ` · ${left.text}` : ""}`}
                      color={left?.overdue ? "var(--red)" : undefined}
                    />
                  );
                })()}
                {!docs.insuranceUntil && derived.insurance?.dueDate && (() => {
                  const left = nearestDueLabel(derived.insurance, currentKm);
                  return (
                    <SpecRow
                      label={derived.insurance.title}
                      value={`до ${fmtDate(derived.insurance.dueDate)}${left ? ` · ${left.text}` : ""}`}
                      color={left?.overdue ? "var(--red)" : undefined}
                    />
                  );
                })()}
                {derived.insurance?.note && !docs.insuranceCompany && (
                  <SpecRow label="Заметка" value={derived.insurance.note} />
                )}
                {docs.other && <SpecRow label="Другие документы" value={docs.other} />}
              </dl>
            ) : (
              <div className="hint">Пока нет сохранённых документов.</div>
            )}
            <div className="vsec__actions">
              <button type="button" className="link-btn" onClick={startEdit}>
                {hasDocs ? "Изменить документы" : "Добавить документы"}
              </button>
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
