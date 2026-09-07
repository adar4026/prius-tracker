import React, { useMemo, useState } from "react";
import Modal from "../components/Modal";
import DateField from "../components/DateField";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../data";
import { byDateDesc, fmtDate, fmtKm, fmtMoney, nextId, num } from "../utils";

const CATS = Object.keys(CATEGORY_LABELS);
const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  date: today(), km: "", type: "", cost: "", note: "", category: "oil",
});

export default function ServiceTab({ service, setService }) {
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // редактируемая запись или null
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");

  const sorted = useMemo(() => [...service].sort(byDateDesc), [service]);
  const visible = useMemo(
    () => (filter === "all" ? sorted : sorted.filter((s) => s.category === filter)),
    [sorted, filter]
  );

  const spent = visible.reduce((s, r) => s + num(r.cost), 0);
  const free = visible.filter((r) => !num(r.cost)).length;

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
      cost: item.cost ? String(item.cost) : "",
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
      km: Math.round(num(form.km)),
      type: form.type.trim(),
      cost: num(form.cost),
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

      <div className="chip-row" style={{ marginTop: 14 }}>
        <button
          className={`chip ${filter === "all" ? "chip--active" : ""}`}
          onClick={() => setFilter("all")}
        >
          Все · {service.length}
        </button>
        {CATS.map((cat) => {
          const n = service.filter((s) => s.category === cat).length;
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
      </div>

      <div className="section-title">
        {filter === "all" ? "Все работы" : CATEGORY_LABELS[filter]}
      </div>

      {!visible.length && <div className="empty">Записей нет</div>}

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
              <div className="row__value" style={{ color: num(s.cost) ? "var(--text)" : "var(--green)" }}>
                {num(s.cost) ? fmtMoney(s.cost, 2) : "0 €"}
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
                  type="number" step="0.01" inputMode="decimal" placeholder="0"
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
