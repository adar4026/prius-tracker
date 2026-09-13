import React, { useEffect, useState } from "react";

/**
 * Компактный фильтр журнала: кнопка «Ключ: значение ▾», по нажатию — нижнее
 * меню со списком вариантов. Закрывается после выбора, по тапу мимо и по Esc.
 *
 * options: [{ id, label, count?, color? }]; value — id выбранного варианта.
 * «Нейтральный» вариант (обычно "all") задаётся через defaultId — кнопка с ним
 * не подсвечивается как активный фильтр.
 */
export default function FilterMenu({ name, title, value, options, onChange, defaultId = "all" }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const current = options.find((o) => o.id === value) || options[0];
  const active = value !== defaultId;

  const pick = (id) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className={`filter-btn ${active ? "filter-btn--active" : ""}`}
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="filter-btn__key">{name}:</span>
        <span className="filter-btn__val">{current ? current.shortLabel || current.label : "—"}</span>
        <span className="filter-btn__caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="sheet" role="listbox" aria-label={title || name}>
            <div className="sheet__handle" aria-hidden="true" />
            {title && <div className="sheet__title">{title}</div>}
            {options.map((o) => {
              const selected = o.id === value;
              return (
                <button
                  type="button"
                  key={o.id}
                  role="option"
                  aria-selected={selected}
                  className={`sheet__option ${selected ? "sheet__option--active" : ""}`}
                  onClick={() => pick(o.id)}
                >
                  {o.color && <i className="sheet__dot" style={{ background: o.color }} />}
                  <span className="sheet__label">{o.label}</span>
                  {o.count !== undefined && <span className="sheet__count">· {o.count}</span>}
                  <span className="sheet__check" aria-hidden="true">{selected ? "✓" : ""}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
