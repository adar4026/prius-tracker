import React, { useEffect, useRef, useState } from "react";
import Header from "./Header";
import DateField from "./DateField";
import { CameraIcon, CarIcon } from "./Icons";
import { PHOTO_ACCEPT, checkPhotoFile, compressPhoto } from "../photo";

/**
 * Редактор профиля автомобиля. Работает с черновиком form: изменения
 * (включая фото) применяются только по «Сохранить».
 *
 * Фото в черновике: undefined — не менялось, null — удалить, Blob — новое
 * сжатое изображение. onSave(photoDraft) получает это значение.
 */
export default function VehicleEditor({ form, setForm, errors, photoUrl, onCancel, onSave }) {
  const fileRef = useRef(null);
  const [photoDraft, setPhotoDraft] = useState(undefined);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  // object URL для предпросмотра нового снимка освобождается при замене
  useEffect(() => {
    if (!(photoDraft instanceof Blob)) { setPreviewUrl(null); return undefined; }
    const url = URL.createObjectURL(photoDraft);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoDraft]);

  const shown = photoDraft === null ? null : previewUrl || (photoDraft === undefined ? photoUrl : null);

  const pickFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // повторный выбор того же файла должен сработать
    if (!file) return;
    const problem = checkPhotoFile(file);
    if (problem) { setPhotoError(problem); return; }
    setPhotoError("");
    setBusy(true);
    try {
      setPhotoDraft(await compressPhoto(file));
    } catch (err) {
      setPhotoError(err.message || "Не удалось обработать фото");
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = () => {
    if (!window.confirm("Удалить фото автомобиля?")) return;
    setPhotoError("");
    setPhotoDraft(null);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(photoDraft);
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setIn = (grp, key) => (e) => {
    const value = e && e.target ? e.target.value : e;
    setForm((f) => ({ ...f, [grp]: { ...f[grp], [key]: value } }));
  };

  const errorLine = (text) => text && <div className="hint" style={{ color: "var(--red)" }}>{text}</div>;

  const field = (label, value, onChange, opts = {}) => (
    <div className="field">
      <label htmlFor={opts.id}>{label}</label>
      {opts.textarea ? (
        <textarea id={opts.id} rows={3} value={value} onChange={onChange} placeholder={opts.placeholder} />
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
      {errorLine(opts.error)}
    </div>
  );

  const dateField = (label, id, grp, key, error) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <DateField id={id} label={label} value={form[grp][key]} onChange={setIn(grp, key)} />
      {errorLine(error)}
    </div>
  );

  return (
    <>
      <Header
        title="Редактирование"
        onBack={onCancel}
        action={
          <button type="button" className="header__text-btn" onClick={save} disabled={saving}>
            Сохранить
          </button>
        }
      />
      <main className="screen page">
        <div className="section-title">Фото автомобиля</div>
        <div className="card card--form">
          {shown ? (
            <img src={shown} alt="Фото автомобиля" className="vehicle-photo vehicle-photo--edit" />
          ) : (
            <div className="vehicle-photo vehicle-photo--empty vehicle-photo--edit">
              <span className="vehicle-photo__icon" aria-hidden="true"><CarIcon size={40} /></span>
              <span className="hint">Фото пока не добавлено</span>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={PHOTO_ACCEPT}
            onChange={pickFile}
            style={{ display: "none" }}
            aria-hidden="true"
            tabIndex={-1}
          />
          <div className="form-actions vehicle-photo__actions">
            <button
              type="button"
              className="btn"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              <CameraIcon size={18} />
              {busy ? "Обработка…" : shown ? "Изменить фото" : "Добавить фото"}
            </button>
            {shown && (
              <button type="button" className="btn btn--danger" onClick={removePhoto} disabled={busy}>
                Удалить фото
              </button>
            )}
          </div>
          {errorLine(photoError || errors.photo)}
          <div className="hint">
            JPEG, PNG или WebP. Снимок уменьшается до 1600 px по большей стороне
            и хранится только на этом устройстве.
          </div>
        </div>

        <div className="section-title">Автомобиль</div>
        <div className="card card--form">
          {field("Название", form.name, set("name"), { id: "v-name", error: errors.name, placeholder: "Toyota Prius+" })}
          <div className="form-row">
            {field("Марка", form.brand, set("brand"), { id: "v-brand" })}
            {field("Модель", form.model, set("model"), { id: "v-model-short" })}
          </div>
          {field("Комплектация (полное наименование)", form.modelFull, set("modelFull"), { id: "v-model" })}
          {field("Версия", form.version, set("version"), { id: "v-version", mono: true, autoCapitalize: "characters" })}
          <div className="form-row">
            {field("Год выпуска", form.year, set("year"), { id: "v-year", inputMode: "numeric", error: errors.year })}
            {dateField("Первая регистрация", "v-first-reg", "docs", "firstRegistration", errors.firstRegistration)}
          </div>
          <div className="form-row">
            {field("Топливо (кратко)", form.fuelType, set("fuelType"), { id: "v-fuel" })}
            {field("Мощность", form.power, set("power"), { id: "v-power" })}
          </div>
          {field("Топливо (полностью)", form.driveType, set("driveType"), { id: "v-drive" })}
          <div className="form-row">
            {field("Двигатель", form.engineCode, set("engineCode"), { id: "v-engine-code", mono: true })}
            {field("Силовая установка", form.engine, set("engine"), { id: "v-engine" })}
          </div>
          {field("VIN", form.vin, set("vin"), { id: "v-vin", mono: true, autoCapitalize: "characters", error: errors.vin })}
          <div className="form-row">
            {field("Госномер", form.plate, set("plate"), { id: "v-plate", mono: true, autoCapitalize: "characters" })}
            {field("Кузов", form.body, set("body"), { id: "v-body", mono: true })}
          </div>
          {field("Код цвета", form.color, set("color"), { id: "v-color", mono: true })}
        </div>

        <div className="section-title">Покупка</div>
        <div className="card card--form">
          {dateField("Дата покупки", "v-purchase", "docs", "purchaseDate", errors.purchaseDate)}
          <div className="form-row">
            {field("Пробег при покупке, км", form.docs.purchaseKm, setIn("docs", "purchaseKm"), { id: "v-purchase-km", inputMode: "numeric", error: errors.purchaseKm })}
            {field("Цена покупки, €", form.docs.purchasePrice, setIn("docs", "purchasePrice"), { id: "v-purchase-price", inputMode: "decimal", error: errors.purchasePrice })}
          </div>
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

        <div className="section-title">Документы и даты</div>
        <div className="card card--form">
          {dateField("ITV действует до", "v-itv", "docs", "itvUntil", errors.itvUntil)}
          <div className="form-row">
            {field("Страховая компания", form.docs.insuranceCompany, setIn("docs", "insuranceCompany"), { id: "v-ins-company", placeholder: "Zurich" })}
            {dateField("Страховка до", "v-ins-until", "docs", "insuranceUntil", errors.insuranceUntil)}
          </div>
          {field("Другие документы", form.docs.other, setIn("docs", "other"), { id: "v-docs-other", textarea: true, placeholder: "Номер полиса, сервисная книжка…" })}
        </div>

        <div className="section-title">Заметки</div>
        <div className="card card--form">
          {field("Заметки", form.notes, set("notes"), { id: "v-notes", textarea: true, placeholder: "Всё, что важно помнить об автомобиле" })}
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>Отмена</button>
          <button type="button" className="btn btn--solid" onClick={save} disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </main>
    </>
  );
}
