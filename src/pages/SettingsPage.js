import React, { useRef, useState } from "react";
import Header from "../components/Header";
import { useToast } from "../components/Toast";
import { copyText } from "../clipboard";
import { THEMES, THEME_META } from "../themes";
import { todayISO } from "../utils";

const EXPORT_VERSION = 1;

/** Проверка структуры импортируемого файла. Бросает понятную ошибку. */
function validateBackup(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Файл не похож на резервную копию Lexcar");
  }
  const keys = ["fuel", "service", "reminders"];
  const present = keys.filter((k) => raw[k] !== undefined);
  if (!present.length) {
    throw new Error("В файле нет ни заправок, ни ТО, ни задач");
  }
  present.forEach((k) => {
    if (!Array.isArray(raw[k])) throw new Error(`Поле «${k}» должно быть списком`);
    if (raw[k].some((x) => !x || typeof x !== "object" || Array.isArray(x))) {
      throw new Error(`В списке «${k}» есть повреждённые записи`);
    }
  });
  return {
    fuel: raw.fuel || [],
    service: raw.service || [],
    reminders: raw.reminders || [],
    // технические данные автомобиля — необязательная часть копии
    vehicle: raw.vehicle && typeof raw.vehicle === "object" && !Array.isArray(raw.vehicle)
      ? raw.vehicle
      : null,
    theme: typeof raw.theme === "string" ? raw.theme : null,
  };
}

export default function SettingsPage({
  fuel, service, reminders, vehicle, theme, onTheme, onImport, onClearAll, onBack, version,
}) {
  const fileRef = useRef(null);
  const [importStep, setImportStep] = useState(null); // null | "warn" | "preview"
  const [pending, setPending] = useState(null);       // проверенные данные из файла
  const [importError, setImportError] = useState("");
  const [clearStep, setClearStep] = useState(0);      // 0 — скрыто, 1 — предупреждение, 2 — подтверждение
  const [toast, showToast] = useToast(2200);

  const payload = () => ({
    version: EXPORT_VERSION,
    exportDate: new Date().toISOString(),
    fuel,
    service,
    reminders,
    vehicle,
    theme,
  });

  const exportJson = () => {
    try {
      const blob = new Blob([JSON.stringify(payload(), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lexcar-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Файл сохранён в «Загрузки»");
    } catch {
      showToast("Не удалось сохранить файл");
    }
  };

  const copyJson = async () => {
    showToast(
      (await copyText(JSON.stringify(payload())))
        ? "Данные скопированы в буфер обмена"
        : "Буфер обмена недоступен"
    );
  };

  const startImport = () => {
    setImportError("");
    setPending(null);
    setImportStep("warn");
  };
  const cancelImport = () => {
    setImportError("");
    setPending(null);
    setImportStep(null);
  };

  const pickFile = (e) => {
    setImportError("");
    setPending(null);
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // чтобы повторный выбор того же файла сработал
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => setImportError("Не удалось прочитать файл");
    reader.onload = () => {
      try {
        setPending(validateBackup(JSON.parse(String(reader.result))));
        setImportStep("preview");
      } catch (err) {
        setImportError(
          err instanceof SyntaxError
            ? "Файл повреждён: это не корректный JSON"
            : err.message
        );
        setImportStep("warn");
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    onImport(pending);
    cancelImport();
    showToast("Данные импортированы");
  };

  const confirmClear = () => {
    onClearAll();
    setClearStep(0);
    showToast("Все данные удалены");
  };

  return (
    <>
      <Header title="Данные и настройки" onBack={onBack} />
      <main className="screen page">
        <div className="section-title">Оформление</div>
        <div className="card settings-card">
          <div className="settings-row">
            <div className="settings-row__main">
              <div className="row__title">Тема</div>
              <div className="row__sub">Запоминается на этом устройстве</div>
            </div>
          </div>
          <div className="seg seg--flat" role="radiogroup" aria-label="Тема оформления">
            {THEMES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={theme === t}
                className={theme === t ? "active" : ""}
                onClick={() => onTheme(t)}
              >
                {THEME_META[t].icon} {THEME_META[t].label}
              </button>
            ))}
          </div>
        </div>

        <div className="section-title">Резервная копия</div>
        <div className="card settings-card">
          <div className="settings-stats">
            <div><b>{fuel.length}</b><span>заправок</span></div>
            <div><b>{service.length}</b><span>записей ТО</span></div>
            <div><b>{reminders.length}</b><span>задач</span></div>
          </div>
          <div className="hint" style={{ marginTop: 0 }}>
            Данные хранятся только в этом браузере. Сохраняйте копию перед
            переустановкой или сменой устройства.
          </div>
          <div className="settings-actions">
            <button type="button" className="btn btn--solid" onClick={exportJson}>
              ⬇️ Экспортировать данные
            </button>
            <button type="button" className="btn btn--ghost" onClick={copyJson}>
              📋 Скопировать JSON
            </button>
            {importStep === null && (
              <button type="button" className="btn" onClick={startImport}>
                ⬆️ Импортировать данные
              </button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={pickFile}
            style={{ display: "none" }}
          />

          {importStep === "warn" && (
            <div className="notice notice--warn">
              <div className="row__title">Импорт заменит текущие данные</div>
              <div className="row__sub" style={{ marginTop: 6 }}>
                Заправки, записи ТО и задачи из файла заменят то, что сейчас
                в приложении. Перед заменой вы увидите, что именно будет импортировано.
              </div>
              {importError && (
                <div className="notice__error">⚠️ {importError}</div>
              )}
              <div className="form-actions">
                <button type="button" className="btn btn--ghost" onClick={cancelImport}>Отмена</button>
                <button type="button" className="btn btn--solid" onClick={() => fileRef.current?.click()}>
                  {importError ? "Другой файл" : "Выбрать файл"}
                </button>
              </div>
            </div>
          )}

          {importStep === "preview" && pending && (
            <div className="notice notice--warn">
              <div className="row__title">✅ Файл проверен</div>
              <div className="settings-stats settings-stats--compact">
                <div><b>{pending.fuel.length}</b><span>заправок</span></div>
                <div><b>{pending.service.length}</b><span>записей ТО</span></div>
                <div><b>{pending.reminders.length}</b><span>задач</span></div>
              </div>
              <div className="row__sub">
                {pending.vehicle ? "Данные автомобиля тоже будут обновлены. " : ""}
                Текущие данные будут перезаписаны без возможности отмены.
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn--ghost" onClick={cancelImport}>Отмена</button>
                <button type="button" className="btn btn--solid" onClick={confirmImport}>Заменить</button>
              </div>
            </div>
          )}
        </div>

        <div className="section-title">Управление данными</div>
        <div className="card settings-card">
          <div className="settings-row">
            <div className="settings-row__main">
              <div className="row__title">Очистить все данные</div>
              <div className="row__sub">Удаляет заправки, ТО, задачи и сбрасывает данные автомобиля</div>
            </div>
          </div>
          {clearStep === 0 && (
            <button type="button" className="btn btn--danger" onClick={() => setClearStep(1)}>
              Очистить все данные
            </button>
          )}
          {clearStep === 1 && (
            <div className="notice notice--danger">
              <div className="row__title">Вы уверены?</div>
              <div className="row__sub" style={{ marginTop: 6 }}>
                Журналы и задачи будут удалены с этого устройства. Восстановить их
                можно только из резервной копии.
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn--ghost" onClick={() => setClearStep(0)}>Отмена</button>
                <button type="button" className="btn btn--danger" onClick={() => setClearStep(2)}>Продолжить</button>
              </div>
            </div>
          )}
          {clearStep === 2 && (
            <div className="notice notice--danger">
              <div className="row__title">Последнее подтверждение</div>
              <div className="row__sub" style={{ marginTop: 6 }}>
                Будут удалены {fuel.length} заправок, {service.length} записей ТО
                и {reminders.length} задач. Это действие нельзя отменить.
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn--ghost" onClick={() => setClearStep(0)}>Отмена</button>
                <button type="button" className="btn btn--danger btn--danger-solid" onClick={confirmClear}>
                  Да, удалить всё
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="section-title">О приложении</div>
        <div className="card settings-card">
          <div className="about">
            <img src={`${process.env.PUBLIC_URL}/icon-192.png`} alt="" className="about__icon" />
            <div>
              <div className="row__title">Lexcar — личный журнал автомобиля</div>
              <div className="row__sub">
                Заправки, расход, обслуживание и напоминания.
                {version ? ` Версия ${version}.` : ""}
              </div>
            </div>
          </div>
        </div>
      </main>
      {toast}
    </>
  );
}
