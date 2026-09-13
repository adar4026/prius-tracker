import React, { forwardRef, useId } from "react";
import { ChevronIcon } from "./Icons";

/**
 * Раскрывающаяся секция страницы «Автомобиль». Управляется снаружи
 * (open / onToggle), чтобы страница помнила состояние всех секций.
 * ref указывает на корневой элемент — для прокрутки к секции из поиска.
 */
const VehicleSection = forwardRef(function VehicleSection(
  { icon, title, summary, open, onToggle, children }, ref
) {
  const id = useId();
  return (
    <section ref={ref} className={`vsec ${open ? "vsec--open" : ""}`}>
      <button
        type="button"
        className="vsec__head"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={id}
      >
        <span className="vsec__icon" aria-hidden="true">{icon}</span>
        <span className="vsec__main">
          <span className="vsec__title">{title}</span>
          {summary && !open && <span className="vsec__summary">{summary}</span>}
        </span>
        <span className="vsec__chevron" aria-hidden="true"><ChevronIcon size={18} /></span>
      </button>
      {open && (
        <div className="vsec__body" id={id}>
          {children}
        </div>
      )}
    </section>
  );
});

export default VehicleSection;

/** Строка «подпись — значение» внутри секции. */
export function SpecRow({ label, value, action, color }) {
  return (
    <div className="spec spec--vehicle">
      <dt>{label}</dt>
      <dd style={color ? { color } : undefined}>
        <span className="spec__value">{value}</span>
        {action}
      </dd>
    </div>
  );
}
