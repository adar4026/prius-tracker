import React, { useState } from "react";
import Modal from "../components/Modal";
import { REMINDER_ICONS } from "../data";
import { effectivePriority, fmtDate, fmtKm, nextId, num, todayISO } from "../utils";

const GROUPS = [
  { id: "overdue",   title: "Просрочено",        color: "var(--red)" },
  { id: "upcoming",  title: "Запланировано",     color: "var(--gold)" },
  { id: "pending",   title: "Ожидают установки", color: "var(--blue)" },
  { id: "info",      title: "Информация",        color: "var(--muted)" },
  { id: "completed", title: "Выполненные",       color: "var(--green)" },
];

const PRIORITIES = [
  { id: "upcoming", label: "Запланировано" },
  { id: "pending",  label: "Ожидает установки" },
  { id: "overdue",  label: "Просрочено" },
  { id: "info",     label: "Информация" },
];

const emptyForm = () => ({
  title: "", icon: "🔧", priority: "upcoming", dueKm: "", dueDate: "", note: "",
});

export default function RemindersTab({ reminders, setReminders, currentKm }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");

  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setForm({
      title: r.title,
      icon: r.icon || "🔧",
      priority: r.priority,
      dueKm: r.dueKm ? String(r.dueKm) : "",
      dueDate: r.dueDate || "",
      note: r.note || "",
    });
    setError("");
    setOpen(true);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError("Укажите название задачи");

    const entry = {
      id: editing ? editing.id : nextId(reminders),
      title: form.title.trim(),
      icon: form.icon,
      priority: form.priority,
      dueKm: form.dueKm ? Math.round(num(form.dueKm)) : null,
      dueDate: form.dueDate || null,
      note: form.note.trim(),
      completed: editing ? editing.completed : false,
      completedDate: editing ? editing.completedDate : null,
      completedKm: editing ? editing.completedKm : null,
    };

    setReminders(
      editing
        ? reminders.map((r) => (r.id === editing.id ? entry : r))
        : [...reminders, entry]
    );
    setOpen(false);
  };

  const toggleDone = (r) => {
    setReminders(
      reminders.map((x) =>
        x.id !== r.id
          ? x
          : x.completed
          ? { ...x, completed: false, completedDate: null, completedKm: null }
          : { ...x, completed: true, completedDate: todayISO(), completedKm: currentKm || null }
      )
    );
  };

  const remove = (r) => {
    if (window.confirm(`Удалить задачу «${r.title}»?`)) {
      setReminders(reminders.filter((x) => x.id !== r.id));
    }
  };

  return (
    <main className="screen">
      <button className="btn" onClick={openAdd}>+ Добавить задачу</button>

      {GROUPS.map((g) => {
        const items = reminders.filter((r) => effectivePriority(r, currentKm) === g.id);
        if (!items.length) return null;

        return (
          <section key={g.id}>
            <div className="section-title" style={{ color: g.color }}>
              {g.title} · {items.length}
            </div>

            {items.map((r) => {
              const overdue = g.id === "overdue";
              const kmLeft = !r.completed && r.dueKm ? r.dueKm - currentKm : null;
              return (
                <div
                  key={r.id}
                  className={`item reminder ${overdue ? "item--overdue" : ""} ${r.completed ? "item--done" : ""}`}
                >
                  <span className="reminder__icon">{r.icon}</span>
                  <div className="row__main">
                    <div className="row__title">{r.title}</div>
                    {r.note && <div className="row__sub">{r.note}</div>}

                    {r.completed ? (
                      <div className="row__sub" style={{ marginTop: 5, color: "var(--green)" }}>
                        ✅ {fmtDate(r.completedDate)}
                        {r.completedKm ? ` • ${fmtKm(r.completedKm)} км` : ""}
                      </div>
                    ) : (
                      (r.dueKm || r.dueDate) && (
                        <div className="row__sub" style={{ marginTop: 5 }}>
                          {r.dueKm && <>🎯 {fmtKm(r.dueKm)} км</>}
                          {r.dueKm && r.dueDate && " • "}
                          {r.dueDate && <>📅 {fmtDate(r.dueDate)}</>}
                        </div>
                      )
                    )}

                    <div className="row__actions row__actions--left">
                      <button className="icon-btn" onClick={() => toggleDone(r)} title={r.completed ? "Вернуть в работу" : "Отметить выполненной"}>
                        {r.completed ? "↩️" : "✅"}
                      </button>
                      <button className="icon-btn" onClick={() => openEdit(r)} aria-label="Изменить">✏️</button>
                      <button className="icon-btn" onClick={() => remove(r)} aria-label="Удалить">🗑</button>
                    </div>
                  </div>

                  {kmLeft !== null && (
                    <div className="row__right">
                      <div
                        className="row__value row__value--small"
                        style={{ color: kmLeft <= 0 ? "var(--red)" : "var(--muted)" }}
                      >
                        {kmLeft > 0 ? `+${fmtKm(kmLeft)}` : fmtKm(kmLeft)}
                      </div>
                      <div className="row__sub">км</div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}

      <div className="hint" style={{ padding: "10px 2px 0" }}>
        Текущий пробег: {fmtKm(currentKm)} км
      </div>

      {open && (
        <Modal title={editing ? "Изменить задачу" : "Новая задача"} onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <div className="field">
              <label>Название</label>
              <input
                type="text" placeholder="Моторное масло 0W-20"
                value={form.title} onChange={(e) => setField("title", e.target.value)}
              />
            </div>

            <div className="field">
              <label>Иконка</label>
              <div className="icon-picker">
                {REMINDER_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    className={`icon-choice ${form.icon === ic ? "icon-choice--active" : ""}`}
                    onClick={() => setField("icon", ic)}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Раздел</label>
              <select value={form.priority} onChange={(e) => setField("priority", e.target.value)}>
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="field">
                <label>Срок, км</label>
                <input
                  type="number" inputMode="numeric" placeholder="не важно"
                  value={form.dueKm} onChange={(e) => setField("dueKm", e.target.value)}
                />
              </div>
              <div className="field">
                <label>Срок, дата</label>
                <input
                  type="date"
                  value={form.dueDate} onChange={(e) => setField("dueDate", e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label>Примечание</label>
              <textarea
                rows={2} placeholder="Детали, цена, где куплено…"
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
