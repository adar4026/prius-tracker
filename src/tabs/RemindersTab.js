import React, { useMemo, useState } from "react";
import Modal from "../components/Modal";
import DateField from "../components/DateField";
import { REMINDER_ICONS } from "../data";
import {
  fmtDate, fmtKm, nearestDueLabel, nextId, num, reminderStatus, reminderUrgency,
  todayISO,
} from "../utils";

const STATUSES = [
  { id: "all",      label: "Все",        color: "var(--gold)" },
  { id: "overdue",  label: "Просрочено", color: "var(--red)" },
  { id: "soon",     label: "Скоро",      color: "var(--gold)" },
  { id: "waiting",  label: "Ожидает",    color: "var(--blue)" },
  { id: "done",     label: "Выполнено",  color: "var(--green)" },
];

const STATUS_META = {
  overdue: { label: "Просрочено", color: "var(--red)" },
  soon:    { label: "Скоро",      color: "var(--gold)" },
  waiting: { label: "Ожидает",    color: "var(--blue)" },
  done:    { label: "Выполнено",  color: "var(--green)" },
};

const RANK = { overdue: 0, soon: 1, waiting: 2, done: 4 };

const PRIORITIES = [
  { id: "upcoming", label: "Запланировано" },
  { id: "pending",  label: "Ожидает установки" },
  { id: "overdue",  label: "Просрочено" },
  { id: "info",     label: "Информация" },
];

const emptyForm = () => ({
  title: "", icon: "🔧", priority: "upcoming", dueKm: "", dueDate: "", note: "",
});

export default function RemindersTab({
  reminders, setReminders, service, currentKm, onComplete,
}) {
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");

  const withStatus = useMemo(
    () =>
      reminders.map((r) => ({
        ...r,
        status: reminderStatus(r, currentKm),
        urgency: reminderUrgency(r, currentKm),
      })),
    [reminders, currentKm]
  );

  const counts = useMemo(() => {
    const map = { all: withStatus.length };
    withStatus.forEach((r) => { map[r.status] = (map[r.status] || 0) + 1; });
    return map;
  }, [withStatus]);

  /**
   * Порядок: просроченные, ближайшие, остальные, выполненные внизу.
   * Задача без срока идёт после задач со сроком, но выше выполненных.
   */
  const visible = useMemo(() => {
    const rank = (r) => (r.urgency === null && r.status !== "done" ? 3 : RANK[r.status]);
    return withStatus
      .filter((r) => filter === "all" || r.status === filter)
      .sort((a, b) => {
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        if (a.urgency !== null && b.urgency !== null) return a.urgency - b.urgency;
        if (a.urgency !== null) return -1;
        if (b.urgency !== null) return 1;
        return (b.completedDate || "").localeCompare(a.completedDate || "");
      });
  }, [withStatus, filter]);

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
      // связи с ТО правятся из формы ТО, здесь они только сохраняются
      ...(editing || {
        sourceServiceId: null, completedServiceId: null,
        intervalKm: null, intervalMonths: null,
      }),
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
          ? { ...x, completed: false, completedDate: null, completedKm: null, completedServiceId: null }
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

      <div className="chip-row" style={{ marginTop: 14 }}>
        {STATUSES.map((st) => (
          <button
            key={st.id}
            className={`chip ${filter === st.id ? "chip--active" : ""}`}
            onClick={() => setFilter(st.id)}
            style={filter === st.id && st.id !== "all"
              ? { background: st.color, borderColor: st.color }
              : undefined}
          >
            {st.label} · {counts[st.id] || 0}
          </button>
        ))}
      </div>

      {!visible.length && <div className="empty">Задач нет</div>}

      {visible.map((r) => {
        const meta = STATUS_META[r.status];
        const left = nearestDueLabel(r, currentKm);
        const source = r.sourceServiceId
          ? service.find((s) => s.id === r.sourceServiceId)
          : null;

        return (
          <div
            key={r.id}
            className={`item item--card reminder ${r.status === "overdue" ? "item--overdue" : ""} ${r.completed ? "item--done" : ""}`}
          >
            <span className="reminder__icon">{r.icon}</span>
            <div className="row__main">
              <div className="row__title">
                {r.title}{" "}
                <span className="badge" style={{ color: meta.color }}>{meta.label}</span>
              </div>
              {r.note && <div className="row__sub">{r.note}</div>}

              {source && (
                <div className="row__sub">
                  🔧 Предыдущее: {fmtDate(source.date)}
                  {source.km ? ` • ${fmtKm(source.km)} км` : ""}
                </div>
              )}

              {r.completed ? (
                <div className="row__sub" style={{ marginTop: 5, color: "var(--green)" }}>
                  ✅ {fmtDate(r.completedDate)}
                  {r.completedKm ? ` • ${fmtKm(r.completedKm)} км` : ""}
                </div>
              ) : (
                <>
                  {(r.dueKm || r.dueDate) && (
                    <div className="row__sub" style={{ marginTop: 5 }}>
                      {r.dueKm && <>🎯 {fmtKm(r.dueKm)} км</>}
                      {r.dueKm && r.dueDate && " • "}
                      {r.dueDate && <>📅 {fmtDate(r.dueDate)}</>}
                    </div>
                  )}
                  {left && (
                    <div
                      className="row__sub row__countdown"
                      style={{ color: left.overdue ? "var(--red)" : "var(--gold)" }}
                    >
                      {left.text}
                    </div>
                  )}
                </>
              )}

              <div className="row__actions row__actions--left">
                {!r.completed && (
                  <button className="btn btn--mini" onClick={() => onComplete(r)}>
                    Выполнить
                  </button>
                )}
                <button className="icon-btn" onClick={() => toggleDone(r)} title={r.completed ? "Вернуть в работу" : "Отметить выполненной"}>
                  {r.completed ? "↩️" : "✅"}
                </button>
                <button className="icon-btn" onClick={() => openEdit(r)} aria-label="Изменить">✏️</button>
                <button className="icon-btn" onClick={() => remove(r)} aria-label="Удалить">🗑</button>
              </div>
            </div>
          </div>
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
                <DateField
                  label="Срок, дата"
                  value={form.dueDate} onChange={(v) => setField("dueDate", v)}
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

            {editing?.sourceServiceId && (
              <div className="hint">
                Задача связана с записью ТО — интервал и следующий срок удобнее
                менять в самой записи.
              </div>
            )}

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
