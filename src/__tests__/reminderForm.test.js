import { reminderFromForm, needsDue } from "../reminderForm";
import { serviceReminderNote } from "../serviceReminder";
import { applyChange, emptyForm } from "../tabs/ServiceTab";
import {
  fmtDate, fmtKm, nearestDueLabel, reminderStatus, reminderUrgency, todayISO,
} from "../utils";

const source = {
  id: 45, date: "2026-09-14", km: 221570, category: "oil",
  type: "Масло Toyota 0W-20 + фильтр MANN HU 6006 z",
};
const service = [source];

// задача, как её создала партия: оба срока, автоматическое примечание
const linked = {
  id: 8, title: "Заменить моторное масло 0W-20", icon: "🔧", priority: "upcoming",
  dueKm: 234570, dueDate: "2027-09-14", intervalKm: 13000, intervalMonths: 12,
  sourceServiceId: 45, completedServiceId: null,
  note: serviceReminderNote(source, 13000, 12),
  completed: false, completedDate: null, completedKm: null,
};

const formOf = (r, patch = {}) => ({
  title: r.title, icon: r.icon, priority: r.priority,
  dueKm: r.dueKm ? String(r.dueKm) : "", dueDate: r.dueDate || "", note: r.note || "",
  ...patch,
});

const blank = { title: "Свечи", icon: "⚙️", priority: "upcoming", dueKm: "", dueDate: "", note: "" };

describe("форма задачи: пробег и дата — независимые сроки", () => {
  test("только пробег", () => {
    const { entry, error } = reminderFromForm({ ...blank, dueKm: "240000" }, null, [], 10);
    expect(error).toBeUndefined();
    expect(entry).toMatchObject({ id: 10, dueKm: 240000, dueDate: null, intervalKm: null, intervalMonths: null, completed: false });
  });

  test("только дата", () => {
    const { entry } = reminderFromForm({ ...blank, dueDate: "2027-03-15" }, null, [], 10);
    expect(entry).toMatchObject({ dueKm: null, dueDate: "2027-03-15" });
  });

  test("оба срока", () => {
    const { entry } = reminderFromForm({ ...blank, dueKm: "240000", dueDate: "2027-03-15" }, null, [], 10);
    expect(entry).toMatchObject({ dueKm: 240000, dueDate: "2027-03-15" });
  });

  test("без обоих сроков не сохраняется, кроме раздела «Ожидает установки»", () => {
    expect(reminderFromForm(blank, null, [], 10).error).toBe("Укажите срок: пробег, дату или оба");
    expect(reminderFromForm({ ...blank, dueKm: "0" }, null, [], 10).error).toBeTruthy();
    const pending = reminderFromForm({ ...blank, priority: "pending" }, null, [], 10);
    expect(pending.error).toBeUndefined();
    expect(pending.entry).toMatchObject({ dueKm: null, dueDate: null, priority: "pending" });
    expect(needsDue("upcoming")).toBe(true);
    expect(needsDue("pending")).toBe(false);
  });

  test("очистка даты у задачи масла: только пробег, интервал в месяцах снят, примечание без «/ 12 мес.»", () => {
    const { entry, error } = reminderFromForm(formOf(linked, { dueDate: "" }), linked, service);
    expect(error).toBeUndefined();
    expect(entry).toMatchObject({
      id: 8, dueKm: 234570, dueDate: null, intervalKm: 13000, intervalMonths: null,
      sourceServiceId: 45, title: "Заменить моторное масло 0W-20",
    });
    expect(entry.note).toBe(`Интервал ${fmtKm(13000)} км. От замены 14.09.2026, ${fmtKm(221570)} км.`);
    expect(entry.note).not.toMatch(/мес/);
  });

  test("дата после очистки не возвращается: повторное сохранение и правка записи ТО", () => {
    const kmOnly = reminderFromForm(formOf(linked, { dueDate: "" }), linked, service).entry;
    // повторное сохранение той же задачи без изменений
    const again = reminderFromForm(formOf(kmOnly), kmOnly, service).entry;
    expect(again).toEqual(kmOnly);

    // форма ТО открывает связанную запись: план есть, интервал в месяцах пуст
    let f = {
      ...emptyForm(), date: source.date, km: String(source.km), type: source.type, category: "oil",
      planNext: true, intervalKm: "13000", intervalMonths: "", nextKm: "234570", nextDate: "",
      nextKmTouched: false, nextDateTouched: true,
    };
    f = applyChange(f, "km", "221600");
    expect(f.nextKm).toBe("234600");
    expect(f.nextDate).toBe("");
    expect(f.intervalMonths).toBe("");
    f = applyChange(f, "date", "2026-09-15");
    expect(f.nextDate).toBe("");
  });

  test("позже выбранная вручную дата сохраняется", () => {
    const kmOnly = reminderFromForm(formOf(linked, { dueDate: "" }), linked, service).entry;
    const withDate = reminderFromForm(formOf(kmOnly, { dueDate: "2027-03-15" }), kmOnly, service).entry;
    expect(withDate).toMatchObject({ dueKm: 234570, dueDate: "2027-03-15", intervalMonths: null });
    // интервал в месяцах пользователь не задавал — в примечании его нет
    expect(withDate.note).toBe(kmOnly.note);
  });

  test("очистка пробега: только дата, интервал в км снят", () => {
    const { entry } = reminderFromForm(formOf(linked, { dueKm: "" }), linked, service);
    expect(entry).toMatchObject({ dueKm: null, dueDate: "2027-09-14", intervalKm: null, intervalMonths: 12 });
    expect(entry.note).toBe(`Интервал 12 мес. От замены 14.09.2026, ${fmtKm(221570)} км.`);
  });

  test("своё примечание при очистке даты не трогается", () => {
    const own = { ...linked, note: "Масло куплено заранее" };
    const { entry } = reminderFromForm(formOf(own, { dueDate: "" }), own, service);
    expect(entry.note).toBe("Масло куплено заранее");
  });
});

describe("форма ТО: план без обязательной даты", () => {
  test("включение плана для масла подставляет только пробег, дата остаётся пустой", () => {
    let f = { ...emptyForm(), date: "2026-09-14", km: "221570", category: "oil" };
    f = applyChange(f, "planNext", true);
    expect(f.intervalKm).toBe("15000");
    expect(f.nextKm).toBe("236570");
    expect(f.intervalMonths).toBe("");
    expect(f.nextDate).toBe("");
  });

  test("интервал в месяцах задаёт дату, очистка даты снимает интервал", () => {
    let f = { ...emptyForm(), date: "2026-09-14", km: "221570", category: "oil" };
    f = applyChange(f, "planNext", true);
    f = applyChange(f, "intervalMonths", "6");
    expect(f.nextDate).toBe("2027-03-14");
    f = applyChange(f, "nextDate", "");
    expect(f.nextDate).toBe("");
    expect(f.intervalMonths).toBe("");
    f = applyChange(f, "km", "221600");
    expect(f.nextDate).toBe("");
    expect(f.nextKm).toBe("236600");
  });

  test("примечание собирается из того, что задано", () => {
    expect(serviceReminderNote(source, 13000, null)).toBe(`Интервал ${fmtKm(13000)} км. От замены 14.09.2026, ${fmtKm(221570)} км.`);
    expect(serviceReminderNote(source, null, 6)).toBe(`Интервал 6 мес. От замены 14.09.2026, ${fmtKm(221570)} км.`);
    expect(serviceReminderNote(source, 13000, 6)).toBe(`Интервал ${fmtKm(13000)} км / 6 мес. От замены 14.09.2026, ${fmtKm(221570)} км.`);
  });
});

describe("статусы, подписи и сортировка для km-only / date-only", () => {
  const km = 221570;
  const kmOnly = { dueKm: 234570, dueDate: null, completed: false };
  const dateOnly = { dueKm: null, dueDate: "2026-11-21", completed: false };
  const both = { dueKm: 222000, dueDate: "2028-01-01", completed: false };

  test("подпись только по пробегу — «через 13 000 км», без даты", () => {
    expect(nearestDueLabel(kmOnly, km)).toEqual({ text: `через ${fmtKm(13000)} км`, overdue: false });
    expect(fmtDate(kmOnly.dueDate)).toBe("—");
  });

  test("статус по тому условию, которое задано", () => {
    expect(reminderStatus(kmOnly, km)).toBe("waiting");
    expect(reminderStatus(kmOnly, 234570)).toBe("overdue");
    expect(reminderStatus({ ...kmOnly, dueKm: km + 500 }, km)).toBe("soon");
    expect(reminderStatus(dateOnly, km)).toBe("waiting");
    expect(reminderStatus({ ...dateOnly, dueDate: todayISO() }, km)).toBe("overdue");
    // оба срока: просрочка по любому из них
    expect(reminderStatus(both, 222000)).toBe("overdue");
    expect(reminderStatus({ ...both, dueDate: "2020-01-01" }, km)).toBe("overdue");
    expect(reminderStatus(both, km)).toBe("soon");
  });

  test("сортировка: побеждает то, что ближе, задачи без срока — без срочности", () => {
    const soonKm = { dueKm: km + 200, dueDate: null };
    const laterDate = { dueKm: null, dueDate: "2027-09-14" };
    expect(reminderUrgency(soonKm, km)).toBeLessThan(reminderUrgency(dateOnly, km));
    expect(reminderUrgency(dateOnly, km)).toBeLessThan(reminderUrgency(laterDate, km));
    expect(reminderUrgency({ dueKm: null, dueDate: null }, km)).toBeNull();
    expect(Number.isFinite(reminderUrgency(kmOnly, km))).toBe(true);
  });

  test("никаких Invalid Date / NaN / пустых подписей", () => {
    [kmOnly, dateOnly, both, { dueKm: null, dueDate: null, completed: false }].forEach((r) => {
      const label = nearestDueLabel(r, km);
      if (label) {
        expect(label.text).not.toMatch(/NaN|Invalid|undefined|null/);
        expect(label.text.trim()).not.toBe("");
      } else {
        expect(r.dueKm ?? r.dueDate).toBeNull();
      }
      expect(String(reminderUrgency(r, km))).not.toMatch(/NaN/);
    });
    expect(nearestDueLabel(dateOnly, km).text).toMatch(/^через /);
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate("")).toBe("—");
  });
});
