import React, { useMemo, useState } from "react";
import Modal from "../components/Modal";
import DateField from "../components/DateField";
import JournalFilter from "../components/JournalFilter";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../data";
import {
  byDateDesc, entryYear, fmtDate, fmtKm, fmtMoney, matchesQuery, nextId, num,
  numOrNull, serviceSearchText, yearsOf,
} from "../utils";

const CATS = Object.keys(CATEGORY_LABELS);
const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  date: today(), km: "", type: "", cost: "", note: "", category: "oil",
});

export default function ServiceTab({ service, setService, year, onYear }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // редактируемая запись или null
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");

  const sorted = useMemo(() => [...service].sort(byDateDesc), [service]);

  const years = useMemo(() => yearsOf(service), [service]);
  const counts = useMemo(() => {
    const map = {};
    service.forEach((s) => { map[entryYear(s)] = (map[entryYear(s)] || 0) + 1; });
    return map;
  }, [service]);
  // выбранный в другом разделе год мог не встретиться в записях ТО
  const activeYear = years.includes(year) ? year : "all";

  // год и поиск сужают выборку до применения фильтра категорий
  const inPeriod = useMemo(
    () =>
      sorted.filter(
        (s) =>
          (activeYear === "all" || entryYear(s) === activeYear) &&
          matchesQuery(serviceSearchText(s, CATEGORY_LABELS[s.category]), query)
      ),
    [sorted, activeYear, query]
  );
  const visible = useMemo(
    () => (filter === "all" ? inPeriod : inPeriod.filter((s) => s.category === filter)),
    [inPeriod, filter]
  );

  const spent = visible.reduce((s, r) => s + num(r.cost), 0);
  const free = visible.filter((r) => numOrNull(r.cost) === 0).length;
  const unknown = visible.filter((r) => numOrNull(r.cost) === null).length;

  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      date: item.date,
      km: item.km ? String(item.km) : "",
      type: item.type,
      cost: item.cost === null || item.cost === undefined ? "" : String(item.cost),
      note: item.note || "",
      category: item.category,
    });
    setError("");
    setOpen(true);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.date) return setError("Укажите дату");
    if (!form.type.trim()) return setError("Укажите вид работ");

    const entry = {
      id: editing ? editing.id : nextId(service),
      date: form.date,
      km: form.km === "" ? null : Math.round(num(form.km)),
      type: form.type.trim(),
      cost: numOrNull(form.cost),
      note: form.note.trim(),
      category: form.category,
    };

    setService(
      editing
        ? service.map((s) => (s.id === editing.id ? entry : s))
        : [...service, entry]
    );
    setOpen(false);
  };

  const remove = (id) => {
    const item = service.find((s) => s.id === id);
    if (window.confirm(`Удалить запись «${item.type}»?`)) {
      setService(service.filter((s) => s.id !== id));
    }
  };

  return (
    <main className="screen">
      <button className="btn" onClick={openAdd}>+ Добавить запись</button>

      <JournalFilter
        years={years}
        counts={counts}
        total={service.length}
        year={activeYear}
        onYear={onYear}
        query={query}
        onQuery={setQuery}
        placeholder="Поиск: работа, мастер, пробег, дата…"
      />

      <div className="chip-row">
        <button
          className={`chip ${filter === "all" ? "chip--active" : ""}`}
          onClick={() => setFilter("all")}
        >
          Все · {inPeriod.length}
        </button>
        {CATS.map((cat) => {
          const n = inPeriod.filter((s) => s.category === cat).length;
          if (!n) return null;
          return (
            <button
              key={cat}
              className={`chip ${filter === cat ? "chip--active" : ""}`}
              onClick={() => setFilter(cat)}
              style={filter === cat ? { background: CATEGORY_COLORS[cat], borderColor: CATEGORY_COLORS[cat] } : undefined}
            >
              {CATEGORY_LABELS[cat]} · {n}
            </button>
          );
        })}
      </div>

      <div className="grid-2">
        <div className="card stat">
          <div className="stat__label">Записей</div>
          <div className="stat__value">{visible.length}</div>
        </div>
        <div className="card stat">
          <div className="stat__label">Потрачено</div>
          <div className="stat__value" style={{ color: "var(--gold)" }}>{fmtMoney(spent, 0)}</div>
        </div>
      </div>
      <div className="hint" style={{ padding: "6px 2px 0" }}>
        Бесплатно / по гарантии: {free}
        {unknown > 0 && ` • стоимость неизвестна: ${unknown}`}
      </div>

      <div className="section-title">
        {filter === "all" ? "Все работы" : CATEGORY_LABELS[filter]} · {visible.length}
      </div>

      {!visible.length && (
        <div className="empty">
          {service.length ? "Ничего не найдено" : "Записей нет"}
        </div>
      )}

      {visible.map((s) => (
        <div key={s.id} className="item item--striped">
          <span className="item__stripe" style={{ background: CATEGORY_COLORS[s.category] || "var(--border)" }} />
          <div className="row">
            <div className="row__main">
              <div className="row__title">{s.type}</div>
              <div className="row__sub">
                {fmtDate(s.date)}{s.km ? ` • ${fmtKm(s.km)} км` : ""}
                {" • "}
                <span style={{ color: CATEGORY_COLORS[s.category] }}>
                  {CATEGORY_LABELS[s.category] || s.category}
                </span>
              </div>
              {s.note && <div className="row__sub">{s.note}</div>}
            </div>
            <div className="row__right">
              <div
                className="row__value"
                style={{
                  color:
                    s.cost === null ? "var(--muted)"
                    : num(s.cost) ? "var(--text)"
                    : "var(--green)",
                }}
              >
                {s.cost === null ? "—" : num(s.cost) ? fmtMoney(s.cost, 2) : "0 €"}
              </div>
              <div className="row__actions">
                <button className="icon-btn" onClick={() => openEdit(s)} aria-label="Изменить">✏️</button>
                <button className="icon-btn" onClick={() => remove(s.id)} aria-label="Удалить">🗑</button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {open && (
        <Modal title={editing ? "Изменить запись ТО" : "Новая запись ТО"} onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <div className="form-row">
              <div className="field">
                <label>Дата</label>
                <DateField label="Дата" value={form.date} onChange={(v) => setField("date", v)} />
              </div>
              <div className="field">
                <label>Пробег, км</label>
                <input
                  type="number" inputMode="numeric" placeholder="0 — если не важен"
                  value={form.km} onChange={(e) => setField("km", e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label>Вид работ</label>
              <input
                type="text" placeholder="Масло и фильтр 0W-20"
                value={form.type} onChange={(e) => setField("type", e.target.value)}
              />
            </div>

            <div className="form-row">
              <div className="field">
                <label>Стоимость, €</label>
                <input
                  type="number" step="0.01" inputMode="decimal" placeholder="неизвестно"
                  value={form.cost} onChange={(e) => setField("cost", e.target.value)}
                />
              </div>
              <div className="field">
                <label>Категория</label>
                <select value={form.category} onChange={(e) => setField("category", e.target.value)}>
                  {CATS.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label>Примечание</label>
              <textarea
                rows={2} placeholder="Мастер, магазин, детали…"
                value={form.note} onChange={(e) => setField("note", e.target.value)}
              />
            </div>

            {error && <div className="hint" style={{ color: "var(--red)" }}>{error}</div>}

            <div className="form-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>Отмена</button>
              <button type="submit" className="btn btn--solid">Сохранить</button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}
