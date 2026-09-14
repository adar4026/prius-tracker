// Задача на следующую замену, создаваемая из записи ТО.
//
// Связь живёт на стороне задачи (sourceServiceId), сама запись ТО ничего
// о плане не знает. Здесь собрано всё, что одинаково нужно форме ТО и
// разовым импортам истории: название, примечание и срок по интервалу.

import { CATEGORY_ICONS } from "./data";
import { addMonths, fmtDate, fmtKm, num, numOrNull } from "./utils";

/** Вязкость масла из названия работ: «Масло 5W-30 и фильтр» → «5W-30». */
export const oilGradeOf = (text) => {
  const m = String(text || "").match(/\b\d{1,2}W-\d{2}\b/i);
  return m ? m[0].toUpperCase() : null;
};

/**
 * Название задачи. Для замены масла — единое «Заменить моторное масло 0W-20»
 * (вязкость из названия работ, иначе из профиля автомобиля), для остальных
 * категорий — сам вид работ.
 */
export const serviceReminderTitle = (entry, defaultOilGrade = "") => {
  if (entry.category !== "oil") return entry.type;
  const grade = oilGradeOf(entry.type) || defaultOilGrade;
  return `Заменить моторное масло${grade ? ` ${grade}` : ""}`;
};

/**
 * Примечание задачи: каким интервалом посчитан срок и от какой замены.
 * Дата и пробег исходной записи дублируются намеренно — связь по
 * sourceServiceId пропадает при удалении записи, а примечание остаётся.
 * Пересоздаётся при правке записи ТО, если пользователь не написал своё.
 */
export const serviceReminderNote = (entry, intervalKm, intervalMonths) => {
  const km = numOrNull(intervalKm);
  const months = numOrNull(intervalMonths);
  const interval = [km ? `${fmtKm(km)} км` : "", months ? `${months} мес` : ""]
    .filter(Boolean).join(" / ");
  const from = [fmtDate(entry.date), entry.km ? `${fmtKm(entry.km)} км` : ""]
    .filter(Boolean).join(", ");
  return interval
    ? `Интервал ${interval}. От замены ${from}.`
    : `Запланировано от записи ${from}.`;
};

/** Срок по интервалу от записи: пробег + км, дата + месяцы. Чего нет — null. */
export const dueFromInterval = (entry, intervalKm, intervalMonths) => {
  const stepKm = Math.round(num(intervalKm));
  const months = Math.round(num(intervalMonths));
  return {
    dueKm: entry.km > 0 && stepKm > 0 ? entry.km + stepKm : null,
    dueDate: entry.date && months > 0 ? addMonths(entry.date, months) : null,
  };
};

/**
 * Поля задачи, которые задаёт запись ТО. Именно они обновляются при правке
 * записи; всё остальное (приоритет, примечание, отметка «выполнено») —
 * собственность задачи.
 */
export const plannedReminderFields = (
  entry, { dueKm, dueDate, intervalKm, intervalMonths, oilGrade = "" }
) => ({
  title: serviceReminderTitle(entry, oilGrade),
  icon: CATEGORY_ICONS[entry.category] || "🔧",
  dueKm: dueKm ?? null,
  dueDate: dueDate ?? null,
  intervalKm: numOrNull(intervalKm),
  intervalMonths: numOrNull(intervalMonths),
  sourceServiceId: entry.id,
});

/* ---------------- какая задача — про моторное масло ---------------- */

// «Моторное масло 0W-20», «Заменить моторное масло», «Масло 5W-30 и фильтр»;
// масло коробки/вариатора — не оно
const OIL_TASK_RE = /моторн\w*\s+масл|масл\w*\s+моторн|\d{1,2}W-\d{2}/i;
const NOT_OIL_TASK_RE = /вариатор|коробк|атф|atf|cvt|трансмис/i;

/**
 * Задача о замене моторного масла: созданная из записи категории «Масло»
 * либо (у задач без связи) названная соответственно.
 */
export const isOilChangeReminder = (r, service = []) => {
  if (r.sourceServiceId) {
    const source = service.find((s) => s.id === r.sourceServiceId);
    if (source) return source.category === "oil";
  }
  const title = String(r.title || "");
  return OIL_TASK_RE.test(title) && !NOT_OIL_TASK_RE.test(title);
};

/**
 * Активная задача на следующую замену масла: в первую очередь созданная из
 * последней замены, иначе любая незакрытая задача про моторное масло.
 * Одновременно активной должна быть одна такая задача — форма ТО закрывает
 * прежние при сохранении новой замены.
 */
export function activeOilReminder(reminders, service) {
  const last = service
    .filter((s) => s.category === "oil" && s.km > 0)
    .sort((a, b) => b.km - a.km)[0];
  return (
    (last && reminders.find((r) => !r.completed && r.sourceServiceId === last.id)) ||
    reminders.find((r) => !r.completed && isOilChangeReminder(r, service)) ||
    null
  );
}
