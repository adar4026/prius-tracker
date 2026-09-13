import React, { useEffect, useMemo, useRef, useState } from "react";
import { BackIcon, CloseIcon, SearchIcon } from "./Icons";
import { buildSearchIndex, highlight, searchIndex, MAX_PER_GROUP } from "../search";

/**
 * Полноэкранный поиск по всем данным приложения. Монтируется только
 * пока открыт: индекс строится из текущего состояния и пересчитывается
 * лишь при изменении данных, выдача — при каждом изменении запроса.
 * Закрывается кнопками «Назад» и ✕ и клавишей Escape; фон не прокручивается.
 */
export default function GlobalSearch({ fuel, service, reminders, vehicle, currentKm, onClose, onOpen }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  const index = useMemo(
    () => buildSearchIndex({ fuel, service, reminders, vehicle, currentKm }),
    [fuel, service, reminders, vehicle, currentKm]
  );
  const groups = useMemo(() => searchIndex(index, query), [index, query]);
  const hasQuery = query.trim() !== "";

  // блокировка прокрутки фона тем же способом, что и у шторки
  useEffect(() => {
    const scrollY = window.scrollY;
    const { style } = document.body;
    const prev = { position: style.position, top: style.top, width: style.width, overflow: style.overflow };
    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.width = "100%";
    style.overflow = "hidden";
    return () => {
      style.position = prev.position;
      style.top = prev.top;
      style.width = prev.width;
      style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    const opener = document.activeElement;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      if (opener && typeof opener.focus === "function") opener.focus();
    };
  }, [onClose]);

  const mark = (text) =>
    highlight(text, query).map((part, i) =>
      part.hit ? <mark key={i} className="gsearch__hit">{part.text}</mark> : <React.Fragment key={i}>{part.text}</React.Fragment>
    );

  return (
    <div className="gsearch" role="dialog" aria-modal="true" aria-label="Поиск по Lexcar">
      <div className="gsearch__bar">
        <button type="button" className="header__btn" onClick={onClose} aria-label="Назад">
          <BackIcon />
        </button>
        <div className="gsearch__field">
          <span className="gsearch__field-icon" aria-hidden="true"><SearchIcon size={18} /></span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по Lexcar…"
            aria-label="Поиск по Lexcar"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            enterKeyHint="search"
          />
          {hasQuery && (
            <button
              type="button"
              className="gsearch__clear"
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              aria-label="Очистить"
            >
              <CloseIcon size={14} />
            </button>
          )}
        </div>
        <button type="button" className="header__btn" onClick={onClose} aria-label="Закрыть поиск">
          <CloseIcon />
        </button>
      </div>

      <div className="gsearch__body">
        {!hasQuery && (
          <div className="gsearch__empty">
            <span className="gsearch__empty-icon" aria-hidden="true"><SearchIcon size={28} /></span>
            Ищите заправки, масло, VIN, работы, задачи и другие данные
          </div>
        )}

        {hasQuery && !groups.length && (
          <div className="gsearch__empty">Ничего не найдено</div>
        )}

        {groups.map((g) => (
          <section key={g.id} className="gsearch__group" aria-label={g.label}>
            <div className="section-title">
              {g.label}
              {g.items.length >= MAX_PER_GROUP && <span className="gsearch__more"> · первые {MAX_PER_GROUP}</span>}
            </div>
            <div className="card gsearch__list">
              {g.items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="gsearch__item"
                  onClick={() => onOpen(it.target)}
                >
                  <span className="gsearch__icon" aria-hidden="true">{it.icon}</span>
                  <span className="gsearch__main">
                    <span className={`gsearch__title ${it.mono ? "gsearch__title--mono" : ""}`}>{mark(it.title)}</span>
                    {it.sub && <span className="gsearch__sub">{mark(it.sub)}</span>}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
