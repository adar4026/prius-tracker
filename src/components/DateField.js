import React from "react";

/**
 * Компактное поле даты.
 *
 * Видимый контрол — обычный текстовый input (те же стили, что у остальных
 * полей формы), поверх него лежит прозрачный нативный input[type="date"]:
 * тап по полю открывает штатный iOS date picker, но собственная широкая
 * ширина нативного контрола не влияет на layout grid-колонки.
 *
 * Наружу отдаёт ISO-значение YYYY-MM-DD — как обычный input[type="date"].
 *
 * clearable — необязательная дата: рядом со значением появляется «×»,
 * которое отдаёт наружу пустую строку. Нужно потому, что нативный
 * picker iOS не даёт стереть уже выбранную дату.
 */
export default function DateField({ value, onChange, label, id, clearable = false }) {
  const display = value ? value.split("-").reverse().join(".") : "";
  const showClear = clearable && !!value;

  return (
    <div className={`datefield ${showClear ? "datefield--clearable" : ""}`}>
      <input
        type="text"
        className="datefield__display"
        value={display}
        placeholder="дд.мм.гггг"
        readOnly
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        id={id}
        type="date"
        className="datefield__native"
        value={value || ""}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
      />
      {showClear && (
        <button
          type="button"
          className="datefield__clear"
          aria-label={`Очистить: ${label}`}
          title="Очистить дату"
          onClick={() => onChange("")}
        >
          ×
        </button>
      )}
    </div>
  );
}
