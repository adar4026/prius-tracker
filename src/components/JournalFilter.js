import React from "react";
import FilterMenu from "./FilterMenu";

/**
 * Поиск + компактные фильтры журнала.
 * Годы приходят из самих записей, поэтому новый год появляется сам.
 * Дополнительные фильтры (например, категория ТО) передаются детьми —
 * они встают в одну строку с «Периодом» и переносятся на узком экране.
 */
export default function JournalFilter({
  years, counts, total, year, onYear, query, onQuery, placeholder, children,
}) {
  const options = [
    { id: "all", label: "Все записи", shortLabel: "Все", count: total },
    ...years.map((y) => ({ id: y, label: y, count: counts[y] || 0 })),
  ];

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

      <div className="filter-row">
        <FilterMenu name="Период" title="Период" value={year} options={options} onChange={onYear} />
        {children}
      </div>
    </>
  );
}
