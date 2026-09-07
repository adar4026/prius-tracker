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
 */
export default function DateField({ value, onChange, label, id }) {
  const display = value ? value.split("-").reverse().join(".") : "";

  return (
    <div className="datefield">
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
    </div>
  );
}
