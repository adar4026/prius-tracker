import React from "react";

/**
 * Поиск + переключение года для журналов.
 * Годы приходят из самих записей, поэтому новый год появляется сам.
 */
export default function JournalFilter({
  years, counts, total, year, onYear, query, onQuery, placeholder,
}) {
  return (
    <>
      <div className="search">
        <span className="search__icon" aria-hidden="true">🔍</span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />
        {query && (
          <button
            type="button"
            className="search__clear"
            onClick={() => onQuery("")}
            aria-label="Очистить поиск"
          >
            ✕
          </button>
        )}
      </div>

      <div className="chip-row">
        <button
          type="button"
          className={`chip ${year === "all" ? "chip--active" : ""}`}
          onClick={() => onYear("all")}
        >
          Все · {total}
        </button>
        {years.map((y) => (
          <button
            type="button"
            key={y}
            className={`chip ${year === y ? "chip--active" : ""}`}
            onClick={() => onYear(y)}
          >
            {y} · {counts[y] || 0}
          </button>
        ))}
      </div>
    </>
  );
}
