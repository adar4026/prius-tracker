import React, { useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal";
import DateField from "../components/DateField";
import JournalFilter from "../components/JournalFilter";
import FilterMenu from "../components/FilterMenu";
import NextServiceFields from "../components/NextServiceFields";
import useFocusEntry from "../components/useFocusEntry";
import { CATEGORY_COLORS, CATEGORY_LABELS, OIL_INTERVAL_DEFAULTS } from "../data";
import {
  isOilChangeReminder, plannedReminderFields, serviceReminderNote,
} from "../serviceReminder";
import {
  addMonths, byDateDesc, costBreakdownLabel, elapsedLabel, entryYear, fmtDate,
  fmtKm, fmtMoney, matchesQuery, nextId, normalizeCosts, num, numOrNull,
  serviceSearchText, sumCosts, todayISO, yearsOf,
} from "../utils";

const CATS = Object.keys(CATEGORY_LABELS);
const today = () => todayISO();

// поля формы ↔ позиции детализации расходов (см. COST_PARTS в utils)
const COST_FIELDS = { costLabor: "labor", costOil: "oil", costFilter: "filter", costOther: "other" };

const emptyForm = () => ({
  date: today(), km: "", type: "", cost: "", note: "", category: "oil",
  // блок «Расходы» — детализация общей стоимости для замены масла
  costLabor: "", costOil: "", costFilter: "", costOther: "",
  // блок «Следующая замена»
  planNext: false, intervalKm: "", intervalMonths: "", nextKm: "", nextDate: "",
  nextKmTouched: false, nextDateTouched: false,
});

/** Детализация из полей формы; null, если ни одна позиция не заполнена. */
const formCosts = (f) =>
  normalizeCosts(
    Object.fromEntries(Object.entries(COST_FIELDS).map(([field, part]) => [part, f[field]]))
  );

/** Блок «Расходы» показывается только для замены масла. */
const hasCostBlock = (f) => f.category === "oil";

/**
 * Одно изменение формы со всеми следствиями. Вынесено из setState, чтобы
 * заготовка формы («Выполнить» из задач) проходила через ту же логику.
 *
 * Пробег и дата следующей замены пересчитываются от интервала, но только
 * пока пользователь не исправил их руками — иначе ручное значение затиралось
 * бы при любой правке даты или пробега.
 */
function applyChange(f, name, value) {
  const next = { ...f, [name]: value };
  if (name === "nextKm") next.nextKmTouched = true;
  if (name === "nextDate") next.nextDateTouched = true;
  // выбор интервала — явное намерение пересчитать, ручная правка снимается
  if (name === "intervalKm") next.nextKmTouched = false;
  if (name === "intervalMonths") next.nextDateTouched = false;

  // детализация расходов заполняет общую стоимость своей суммой;
  // если все позиции стёрты, общая сумма снова вводится вручную
  if (name in COST_FIELDS) {
    const total = sumCosts(formCosts(next));
    if (total !== null) next.cost = String(total);
  }

  // включённый план для замены масла получает интервал по умолчанию —
  // только в пустые поля, введённое пользователем не трогается
  const planTurnedOn = name === "planNext" && value;
  const becameOil = name === "category" && value === "oil" && next.planNext;
  if ((planTurnedOn || becameOil) && next.category === "oil") {
    if (next.intervalKm === "") {
      next.intervalKm = String(OIL_INTERVAL_DEFAULTS.km);
      next.nextKmTouched = false;
    }
    if (next.intervalMonths === "") {
      next.intervalMonths = String(OIL_INTERVAL_DEFAULTS.months);
      next.nextDateTouched = false;
    }
  }

  const recalc = ["km", "date", "intervalKm", "intervalMonths", "planNext", "category"];
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
}

/** Задача, созданная из этой сервисной записи (связь живёт на стороне задачи). */
export const linkedReminder = (reminders, serviceId) =>
  reminders.find((r) => r.sourceServiceId === serviceId) || null;

export default function ServiceTab({
  service, setService, reminders, setReminders, currentKm, oilGrade,
  year, onYear, draft, onDraftUsed, focus, onFocused,
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // редактируемая запись или null
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");
  // задача, которую закроет сохраняемая запись (сценарий «Выполнить»)
  const [draftReminderId, setDraftReminderId] = useState(null);

  // переход из глобального поиска: категория и поиск журнала сбрасываются, год задаёт родитель
  const flashId = useFocusEntry(
    focus, "service", () => { setFilter("all"); setQuery(""); }, onFocused
  );

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

  // категории берутся из самих записей (в порядке справочника, неизвестные — в конец),
  // счётчик показывает, сколько таких работ попало в выбранный период
  const categoryOptions = useMemo(() => {
    const present = new Set(service.map((s) => s.category));
    const ordered = [...CATS.filter((c) => present.has(c)), ...[...present].filter((c) => !CATS.includes(c))];
    return [
      { id: "all", label: "Все категории", shortLabel: "Все", count: inPeriod.length },
      ...ordered.map((cat) => ({
        id: cat,
        label: CATEGORY_LABELS[cat] || cat,
        color: CATEGORY_COLORS[cat],
        count: inPeriod.filter((s) => s.category === cat).length,
      })),
    ];
  }, [service, inPeriod]);

  const spent = visible.reduce((s, r) => s + num(r.cost), 0);
  const free = visible.filter((r) => numOrNull(r.cost) === 0).length;
  const unknown = visible.filter((r) => numOrNull(r.cost) === null).length;

  const setField = (name, value) => setForm((f) => applyChange(f, name, value));

  // заготовка применяется по полю, чтобы сработали те же следствия, что и при вводе
  const openAdd = (prefill = null) => {
    setEditing(null);
    setForm(
      Object.entries(prefill || {}).reduce((f, [k, v]) => applyChange(f, k, v), emptyForm())
    );
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
      ...Object.fromEntries(
        Object.entries(COST_FIELDS).map(([field, part]) => [
          field, item.costs && item.costs[part] !== null ? String(item.costs[part]) : "",
        ])
      ),
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

    // детализация есть только у замены масла; при ней общая сумма — сумма позиций
    const costs = hasCostBlock(form) ? formCosts(form) : null;
    const entry = {
      id: editing ? editing.id : nextId(service),
      date: form.date,
      km: form.km === "" ? null : Math.round(num(form.km)),
      type: form.type.trim(),
      cost: costs ? sumCosts(costs) : numOrNull(form.cost),
      costs,
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
   *
   * Новая замена масла закрывает все прежние активные задачи про моторное
   * масло, а не только ту, из которой нажали «Выполнить»: одновременно
   * активна одна задача следующей замены. Правка старой записи ничего не
   * закрывает.
   */
  const syncReminder = (entry, { nextKm, nextDate }) => {
    const linked = linkedReminder(reminders, entry.id);
    const closing = draftReminderId; // задача, которую закрывает эта запись
    const closesOil = !editing && entry.category === "oil";

    setReminders((list) => {
      let out = list;

      if (closesOil) {
        out = out.map((r) =>
          !r.completed && r.sourceServiceId !== entry.id && isOilChangeReminder(r, service)
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

      if (form.planNext) {
        const fields = plannedReminderFields(entry, {
          dueKm: nextKm,
          dueDate: nextDate,
          intervalKm: form.intervalKm,
          intervalMonths: form.intervalMonths,
          oilGrade,
        });
        const note = serviceReminderNote(entry, fields.intervalKm, fields.intervalMonths);
        // примечание задачи обновляется вслед за записью, только если оно
        // всё ещё автоматическое — своё пользователь не теряет
        const autoNote =
          !linked || !linked.note ||
          (editing && linked.note === serviceReminderNote(editing, linked.intervalKm, linked.intervalMonths));
        out = linked
          ? out.map((r) =>
              r.id === linked.id ? { ...r, ...fields, note: autoNote ? note : r.note } : r
            )
          : [
              ...out,
              {
                id: nextId(out),
                priority: "upcoming",
                note,
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

      // правка записи подтягивает дату и пробег в задачах, которые она закрыла
      if (editing) {
        out = out.map((r) =>
          r.completedServiceId === entry.id
            ? { ...r, completedDate: entry.date, completedKm: entry.km }
            : r
        );
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
      question += `\n\nЗадач, закрытых этой записью: ${closed.length} — они снова станут активными.`;
    }
    if (!window.confirm(question)) return;

    setService(service.filter((s) => s.id !== id));
    // битых ссылок не оставляем ни в одну сторону; задачи, которые закрыла
    // удаляемая запись, возвращаются в работу — удаление отменяет «выполнено»
    setReminders((list) =>
      list
        .filter((r) => !(r.sourceServiceId === id && !r.completed))
        .map((r) => ({
          ...r,
          sourceServiceId: r.sourceServiceId === id ? null : r.sourceServiceId,
          ...(r.completedServiceId === id
            ? { completed: false, completedDate: null, completedKm: null, completedServiceId: null }
            : {}),
        }))
    );
  };

  // пока заполнена хоть одна позиция детализации, общая стоимость — её сумма
  const breakdownTotal = hasCostBlock(form) ? sumCosts(formCosts(form)) : null;
  const breakdownActive = breakdownTotal !== null;

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
      >
        <FilterMenu
          name="Категория"
          title="Категория"
          value={filter}
          options={categoryOptions}
          onChange={setFilter}
        />
      </JournalFilter>

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
        {filter === "all" ? "Все работы" : CATEGORY_LABELS[filter] || filter} · {visible.length}
      </div>

      {!visible.length && (
        <div className="empty">
          {service.length ? "Ничего не найдено" : "Записей нет"}
        </div>
      )}

      {visible.map((s) => (
        <div
          key={s.id}
          id={`service-${s.id}`}
          className={`item item--card item--striped ${flashId === s.id ? "item--flash" : ""}`}
        >
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
              {s.costs && <div className="row__sub row__breakdown">{costBreakdownLabel(s.costs)}</div>}
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
              {(() => {
                const elapsed = elapsedLabel(s, currentKm);
                return elapsed && <div className="row__elapsed">🔴 Прошло: {elapsed}</div>;
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
                  readOnly={breakdownActive}
                  aria-describedby={breakdownActive ? "cost-total-hint" : undefined}
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

            {hasCostBlock(form) && (
              <div className="form-block">
                <div className="form-block__title">Расходы</div>
                <div className="form-row">
                  <div className="field">
                    <label>Работа, €</label>
                    <input
                      type="number" step="0.01" inputMode="decimal" placeholder="0,00"
                      value={form.costLabor} onChange={(e) => setField("costLabor", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Масло, €</label>
                    <input
                      type="number" step="0.01" inputMode="decimal" placeholder="0,00"
                      value={form.costOil} onChange={(e) => setField("costOil", e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>Масляный фильтр, €</label>
                    <input
                      type="number" step="0.01" inputMode="decimal" placeholder="0,00"
                      value={form.costFilter} onChange={(e) => setField("costFilter", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Прочие расходы, €</label>
                    <input
                      type="number" step="0.01" inputMode="decimal" placeholder="0,00"
                      value={form.costOther} onChange={(e) => setField("costOther", e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-block__total">
                  <span>Итого</span>
                  <span>{breakdownActive ? fmtMoney(breakdownTotal) : "—"}</span>
                </div>
                <div className="hint" id="cost-total-hint">
                  {breakdownActive
                    ? "Общая стоимость считается из этих позиций."
                    : "Можно не заполнять — тогда укажите только общую стоимость."}
                </div>
              </div>
            )}

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
