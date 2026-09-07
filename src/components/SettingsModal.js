import React, { useRef, useState } from "react";
import Modal from "./Modal";
import { todayISO } from "../utils";

const EXPORT_VERSION = 1;

/** Проверка структуры импортируемого файла. Бросает понятную ошибку. */
function validateBackup(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Файл не похож на резервную копию Autocontrol");
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
    theme: typeof raw.theme === "string" ? raw.theme : null,
  };
}

export default function SettingsModal({ fuel, service, reminders, theme, onImport, onClose }) {
  const fileRef = useRef(null);
  const [pending, setPending] = useState(null); // проверенные данные, ждут подтверждения
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const payload = () => ({
    version: EXPORT_VERSION,
    exportDate: new Date().toISOString(),
    fuel,
    service,
    reminders,
    theme,
  });

  const exportJson = () => {
    setError("");
    try {
      const blob = new Blob([JSON.stringify(payload(), null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `autocontrol-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setInfo("Файл сохранён в «Загрузки».");
    } catch {
      setError("Не удалось сохранить файл. Попробуйте скопировать данные в буфер.");
    }
  };

  const copyJson = async () => {
    setError("");
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload()));
      setInfo("Данные скопированы в буфер обмена.");
    } catch {
      setError("Буфер обмена недоступен в этом браузере.");
    }
  };

  const pickFile = (e) => {
    setError("");
    setInfo("");
    setPending(null);
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // чтобы повторный выбор того же файла сработал
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => setError("Не удалось прочитать файл");
    reader.onload = () => {
      try {
        setPending(validateBackup(JSON.parse(String(reader.result))));
      } catch (err) {
        setError(
          err instanceof SyntaxError
            ? "Файл повреждён: это не корректный JSON"
            : err.message
        );
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    onImport(pending);
    setPending(null);
    setInfo("Данные импортированы.");
  };

  return (
    <Modal title="Настройки и данные" onClose={onClose}>
      <div className="section-title" style={{ marginTop: 0 }}>Что сейчас в приложении</div>
      <dl className="card">
        <div className="spec"><dt>Заправки</dt><dd>{fuel.length}</dd></div>
        <div className="spec"><dt>Записи ТО</dt><dd>{service.length}</dd></div>
        <div className="spec"><dt>Задачи</dt><dd>{reminders.length}</dd></div>
      </dl>

      <div className="section-title">Резервная копия</div>
      <button type="button" className="btn btn--solid" onClick={exportJson}>
        ⬇️ Экспорт в JSON
      </button>
      <button type="button" className="btn btn--ghost" style={{ marginTop: 8 }} onClick={copyJson}>
        📋 Скопировать JSON
      </button>
      <div className="hint">
        Данные хранятся только в этом браузере. Сохраняйте копию перед
        переустановкой или сменой устройства.
      </div>

      <div className="section-title">Восстановление</div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        onChange={pickFile}
        style={{ display: "none" }}
      />
      <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
        ⬆️ Выбрать файл для импорта
      </button>

      {pending && (
        <div className="card" style={{ marginTop: 10, borderColor: "var(--gold)" }}>
          <div className="row__title">Заменить все данные?</div>
          <div className="row__sub" style={{ marginTop: 6 }}>
            Из файла: {pending.fuel.length} заправок, {pending.service.length} записей ТО,{" "}
            {pending.reminders.length} задач. Текущие данные будут перезаписаны
            без возможности отмены.
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setPending(null)}>
              Отмена
            </button>
            <button type="button" className="btn btn--solid" onClick={confirmImport}>
              Заменить
            </button>
          </div>
        </div>
      )}

      {error && <div className="hint" style={{ color: "var(--red)" }}>{error}</div>}
      {info && !error && <div className="hint" style={{ color: "var(--green)" }}>{info}</div>}
    </Modal>
  );
}
