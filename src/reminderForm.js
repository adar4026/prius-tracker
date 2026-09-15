// Сборка задачи из формы «Новая задача / Изменить задачу».
//
// Вынесено из вкладки, чтобы правила сохранения проверялись тестами без
// React: у задачи два независимых срока — пробег и дата. Каждый из них
// необязателен, но хотя бы один должен быть задан; исключение — раздел
// «Ожидает установки», где задача по смыслу срока не имеет (деталь куплена,
// не установлена).

import { serviceReminderNote } from "./serviceReminder";
import { num } from "./utils";

/** Разделы, где задача может быть без срока вовсе. */
export const NO_DUE_PRIORITIES = ["pending"];

export const needsDue = (priority) => !NO_DUE_PRIORITIES.includes(priority);

const BLANK = {
  sourceServiceId: null, completedServiceId: null,
  intervalKm: null, intervalMonths: null,
  completed: false, completedDate: null, completedKm: null,
};

/**
 * Задача из полей формы. Возвращает { entry } или { error }.
 *
 * Связи с ТО (sourceServiceId, completedServiceId) правятся из формы ТО и
 * здесь только сохраняются. Интервал живёт вместе со своим сроком: стёрта
 * дата — стёрт и интервал в месяцах, стёрт пробег — интервал в км; иначе
 * форма ТО при следующей правке записи восстановила бы срок из интервала.
 * Автоматическое примечание («Интервал … От замены …») пересобирается под
 * новый интервал; своё примечание пользователь не теряет.
 */
export function reminderFromForm(form, editing, service = [], id = editing?.id) {
  const title = String(form.title || "").trim();
  if (!title) return { error: "Укажите название задачи" };

  const dueKm = form.dueKm ? Math.round(num(form.dueKm)) || null : null;
  const dueDate = form.dueDate || null;
  if (!dueKm && !dueDate && needsDue(form.priority)) {
    return { error: "Укажите срок: пробег, дату или оба" };
  }

  const base = editing || BLANK;
  const intervalKm = dueKm ? base.intervalKm ?? null : null;
  const intervalMonths = dueDate ? base.intervalMonths ?? null : null;

  let note = String(form.note || "").trim();
  const source = base.sourceServiceId
    ? service.find((s) => s.id === base.sourceServiceId)
    : null;
  const intervalChanged =
    intervalKm !== (base.intervalKm ?? null) || intervalMonths !== (base.intervalMonths ?? null);
  if (source && intervalChanged && note === serviceReminderNote(source, base.intervalKm, base.intervalMonths)) {
    note = serviceReminderNote(source, intervalKm, intervalMonths);
  }

  return {
    entry: {
      ...base,
      id,
      title,
      icon: form.icon,
      priority: form.priority,
      dueKm,
      dueDate,
      intervalKm,
      intervalMonths,
      note,
    },
  };
}
