import React, { useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal";
import DateField from "../components/DateField";
import JournalFilter from "../components/JournalFilter";
import NextServiceFields from "../components/NextServiceFields";
import { CATEGORY_COLORS, CATEGORY_ICONS, CATEGORY_LABELS } from "../data";
import {
  addMonths, byDateDesc, entryYear, fmtDate, fmtKm, fmtMoney, matchesQuery,
  nextId, num, numOrNull, serviceSearchText, todayISO, yearsOf,
} from "../utils";

const CATS = Object.keys(CATEGORY_LABELS);
const today = () => todayISO();

const emptyForm = () => ({
  date: today(), km: "", type: "", cost: "", note: "", category: "oil",
  // блок «Следующая замена»
  planNext: false, intervalKm: "", intervalMonths: "", nextKm: "", nextDate: "",
  nextKmTouched: false, nextDateTouched: false,
});

/** Задача, созданная из этой сервисной записи (связь живёт на стороне задачи). */
export const linkedReminder = (reminders, serviceId) =>
  reminders.find((r) => r.sourceServiceId === serviceId) || null;

export default function ServiceTab({
  service, setService, reminders, setReminders, currentKm,
  year, onYear, draft, onDraftUsed,
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // редактируемая запись или null
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");
  // задача, которую закроет сохраняемая запись (сценарий «Выполнить»)
  const [draftReminderId, setDraftReminderId] = useState(null);

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

  /**
   * Пробег и дата следующей замены пересчитываются от интервала, но только
   * пока пользователь не исправил их руками — иначе ручное значение затиралось
   * бы при любой правке даты или пробега.
   */
  const setField = (name, value) =>
    setForm((f) => {
      const next = { ...f, [name]: value };
      if (name === "nextKm") next.nextKmTouched = true;
      if (name === "nextDate") next.nextDateTouched = true;
      // выбор интервала — явное намерение пересчитать, ручная правка снимается
      if (name === "intervalKm") next.nextKmTouched = false;
      if (name === "intervalMonths") next.nextDateTouched = false;

      const recalc = ["km", "date", "intervalKm", "intervalMonths", "planNext"];
      if (recalc.includes(name) && next.planNext) {
        const baseKm = Math.round(num(next.km));
        const stepKm = Math.round(num(next.intervalKm));
        if (!next.nextKmTouched && baseKm > 0 && stepKm > 0) {
          next.nextKm = String(baseKm + stepKm);
        }
        const months = Math.round(num(next.intervalMonths));
        if (!next.nextDateTouched && next.date && months > 0) {
          next.nextDate = addMonths(next.date, months) || "";
        }
      }
      return next;
    });

  const openAdd = (prefill = null) => {
    setEditing(null);
    setForm({ ...emptyForm(), ...(prefill || {}) });
    setError("");
    setOpen(true);
  };

  const openEdit = (item) => {
    const linked = linkedReminder(reminders, item.id);
    setEditing(item);
    setForm({
      ...emptyForm(),
      date: item.date,
      km: item.km ? String(item.km) : "",
      type: item.type,
      cost: item.cost === null || item.cost === undefined ? "" : String(item.cost),
      note: item.note || "",
      category: item.category,
      // план следующей замены хранится в связанной задаче, а не дублируется в ТО
      planNext: !!linked,
      intervalKm: linked?.intervalKm ? String(linked.intervalKm) : "",
      intervalMonths: linked?.intervalMonths ? String(linked.intervalMonths) : "",
      nextKm: linked?.dueKm ? String(linked.dueKm) : "",
      nextDate: linked?.dueDate || "",
      // «тронуто» только если сохранённая цель не совпадает с расчётом
      // по интервалу — тогда её не перезаписываем
      nextKmTouched: !(
        linked?.intervalKm && item.km && linked.dueKm === item.km + linked.intervalKm
      ),
      nextDateTouched: !(
        linked?.intervalMonths && linked.dueDate === addMonths(item.date, linked.intervalMonths)
      ),
    });
    setError("");
    setOpen(true);
  };

  // «Выполнить» из раздела «Задачи» открывает форму с подставленным названием
  useEffect(() => {
    if (!draft) return;
    openAdd(draft.form);
    setDraftReminderId(draft.reminderId || null);
    onDraftUsed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.date) return setError("Укажите дату");
    if (!form.type.trim()) return setError("Укажите вид работ");

    const nextKm = form.nextKm === "" ? null : Math.round(num(form.nextKm));
    const nextDate = form.nextDate || null;
    if (form.planNext && !nextKm && !nextDate)
      return setError("Укажите следующий пробег или следующую дату");

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

    syncReminder(entry, { nextKm, nextDate });
    setOpen(false);
  };

  /**
   * Приводит связанную задачу в соответствие с сохранённой записью ТО.
   * Существующая задача обновляется, а не дублируется; выполненная задача
   * своё «выполнено» не теряет. Выключенный план удаляет только незакрытую
   * задачу — историю выполненных не трогаем.
   */
  const syncReminder = (entry, { nextKm, nextDate }) => {
    const linked = linkedReminder(reminders, entry.id);
    const closing = draftReminderId; // задача, которую закрывает эта запись

    setReminders((list) => {
      let out = list;

      if (form.planNext) {
        const fields = {
          title: entry.type,
          icon: CATEGORY_ICONS[entry.category] || "🔧",
          dueKm: nextKm,
          dueDate: nextDate,
          intervalKm: numOrNull(form.intervalKm),
          intervalMonths: numOrNull(form.intervalMonths),
          sourceServiceId: entry.id,
        };
        out = linked
          ? out.map((r) => (r.id === linked.id ? { ...r, ...fields } : r))
          : [
              ...out,
              {
                id: nextId(out),
                priority: "upcoming",
                note: "",
                completed: false,
                completedDate: null,
                completedKm: null,
                completedServiceId: null,
                ...fields,
              },
            ];
      } else if (linked && !linked.completed) {
        out = out.filter((r) => r.id !== linked.id);
      }

      // запись создана кнопкой «Выполнить» — закрываем исходную задачу
      if (closing) {
        out = out.map((r) =>
          r.id === closing
            ? {
                ...r,
                completed: true,
                completedDate: entry.date,
                completedKm: entry.km,
                completedServiceId: entry.id,
              }
            : r
        );
      }
      return out;
    });

    setDraftReminderId(null);
  };

  const remove = (id) => {
    const item = service.find((s) => s.id === id);
    const linked = linkedReminder(reminders, id);
    const closed = reminders.filter((r) => r.completedServiceId === id);

    let question = `Удалить запись «${item.type}»?`;
    if (linked && !linked.completed) {
      question += `\n\nСвязанная задача «${linked.title}» тоже будет удалена.`;
    } else if (linked) {
      question += `\n\nСвязанная задача «${linked.title}» выполнена — она останется в истории, связь будет снята.`;
    }
    if (closed.length) {
      question += `\n\nУ ${closed.length} выполненной задачи снимется отметка о закрывшей её записи.`;
    }
    if (!window.confirm(question)) return;

    setService(service.filter((s) => s.id !== id));
    // битых ссылок не оставляем ни в одну сторону
    setReminders((list) =>
      list
        .filter((r) => !(r.sourceServiceId === id && !r.completed))
        .map((r) => ({
          ...r,
          sourceServiceId: r.sourceServiceId === id ? null : r.sourceServiceId,
          completedServiceId: r.completedServiceId === id ? null : r.completedServiceId,
        }))
    );
  };

  return (
    <main className="screen">
      <button className="btn" onClick={() => openAdd()}>+ Добавить запись</button>

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
              {(() => {
                const linked = linkedReminder(reminders, s.id);
                if (!linked) return null;
                return (
                  <div className="row__sub" style={{ color: "var(--gold)" }}>
                    🔔 Следующая: {linked.dueKm ? `${fmtKm(linked.dueKm)} км` : ""}
                    {linked.dueKm && linked.dueDate ? " • " : ""}
                    {linked.dueDate ? fmtDate(linked.dueDate) : ""}
                  </div>
                );
              })()}
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

            <NextServiceFields
              form={form}
              setField={setField}
              linkedDone={
                editing && linkedReminder(reminders, editing.id)
                  ? linkedReminder(reminders, editing.id).completed
                  : null
              }
            />

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
