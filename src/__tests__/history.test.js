import { INITIAL_REMINDERS, INITIAL_SERVICE } from "../data";
import { HISTORY_IMPORTS, applyReminderBatch, applyServiceBatch } from "../history";
import { fmtKm, migrateReminders, migrateService } from "../utils";

const batch = HISTORY_IMPORTS.find((b) => b.id === "oil-change-2026-09-14");
const apply = (service, reminders) => {
  const nextService = HISTORY_IMPORTS.reduce(applyServiceBatch, migrateService(service));
  const nextReminders = HISTORY_IMPORTS.reduce(
    (acc, b) => applyReminderBatch(acc, nextService, b), migrateReminders(reminders)
  );
  return { service: nextService, reminders: nextReminders };
};

describe("импорт замены масла 14.09.2026", () => {
  test("запись добавляется с детализацией, сумма — итог визита", () => {
    const { service } = apply(INITIAL_SERVICE, INITIAL_REMINDERS);
    const entry = service.find((s) => s.date === "2026-09-14" && s.category === "oil");
    expect(entry).toMatchObject({
      km: 221570, cost: 92.88, note: "Ростик Felguera",
      costs: { labor: 30, oil: 62.88, filter: null, other: null },
    });
    expect(service.reduce((s, r) => s + (r.cost || 0), 0)).toBeCloseTo(
      HISTORY_IMPORTS.filter((b) => !b.id.startsWith("oil-change-"))
        .reduce(applyServiceBatch, migrateService(INITIAL_SERVICE))
        .reduce((s, r) => s + (r.cost || 0), 0) + 92.88,
      2
    );
  });

  test("старая задача закрывается записью, создаётся одна новая на 234 570 км", () => {
    const { service, reminders } = apply(INITIAL_SERVICE, INITIAL_REMINDERS);
    const entry = service.find((s) => s.date === "2026-09-14" && s.category === "oil");
    const old = reminders.find((r) => r.title === "Моторное масло 0W-20");
    expect(old).toMatchObject({ completed: true, completedKm: 221570, completedDate: "2026-09-14", completedServiceId: entry.id });

    const planned = reminders.filter((r) => r.sourceServiceId === entry.id);
    expect(planned).toHaveLength(1);
    expect(planned[0]).toMatchObject({
      title: "Заменить моторное масло 0W-20", icon: "🔧", completed: false, priority: "upcoming",
      dueKm: 221570 + 13000, dueDate: "2027-09-14", intervalKm: 13000, intervalMonths: 12,
    });
    expect(planned[0].dueKm).toBe(234570);
    expect(planned[0].note).toBe(
      `Интервал ${fmtKm(13000)} км / 12 мес. От замены 14.09.2026, ${fmtKm(221570)} км.`
    );
  });

  test("корректировка интервала переводит задачу первой версии партии с 236 570 на 234 570 км", () => {
    const upToFirst = HISTORY_IMPORTS.slice(0, HISTORY_IMPORTS.indexOf(batch) + 1);
    const service = upToFirst.reduce(applyServiceBatch, migrateService(INITIAL_SERVICE));
    const entry = service.find((s) => s.date === "2026-09-14" && s.category === "oil");
    // задача, как её создала первая (уже выпущенная) версия партии — 15 000 км
    const stale = {
      id: 8, title: "Заменить моторное масло 0W-20", icon: "🔧", priority: "upcoming",
      dueKm: 236570, dueDate: "2027-09-14", intervalKm: 15000, intervalMonths: 12,
      sourceServiceId: entry.id, completed: false,
      note: `Интервал ${fmtKm(15000)} км / 12 мес. От замены 14.09.2026, ${fmtKm(221570)} км.`,
    };
    const other = { id: 2, title: "Тормозная жидкость DOT4", dueKm: 233000, completed: false, intervalKm: 15000, intervalMonths: 12 };
    const fix = HISTORY_IMPORTS.find((b) => b.id === "oil-change-2026-09-14-interval-13000");

    const out = applyReminderBatch([other, stale], service, fix);
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.id === 8)).toMatchObject({
      dueKm: 234570, dueDate: "2027-09-14", intervalKm: 13000, intervalMonths: 12,
      title: "Заменить моторное масло 0W-20", sourceServiceId: entry.id,
      note: `Интервал ${fmtKm(13000)} км / 12 мес. От замены 14.09.2026, ${fmtKm(221570)} км.`,
    });
    // чужая задача с тем же интервалом не трогается
    expect(out.find((r) => r.id === 2)).toMatchObject({ dueKm: 233000, intervalKm: 15000 });
    // повторное применение — без изменений
    expect(applyReminderBatch(out, service, fix)).toBe(out);
  });

  test("корректировка не трогает задачу, интервал которой пользователь менял сам", () => {
    const first = apply(INITIAL_SERVICE, INITIAL_REMINDERS);
    const entry = first.service.find((s) => s.date === "2026-09-14" && s.category === "oil");
    const fix = HISTORY_IMPORTS.find((b) => b.id === "oil-change-2026-09-14-interval-13000");
    const own = {
      id: 8, title: "Заменить моторное масло 0W-20", dueKm: 231570, dueDate: "2027-03-14",
      intervalKm: 10000, intervalMonths: 6, sourceServiceId: entry.id, completed: false, note: "моя",
    };
    const list = [own];
    const out = applyReminderBatch(list, first.service, fix);
    expect(out).toBe(list);
    expect(out[0]).toMatchObject({ dueKm: 231570, intervalKm: 10000, note: "моя" });
  });

  test("закрытие устаревшей задачи на устройстве, где её правили вручную", () => {
    const first = apply(INITIAL_SERVICE, INITIAL_REMINDERS);
    const entry = first.service.find((s) => s.date === "2026-09-14" && s.category === "oil");
    const closeStale = HISTORY_IMPORTS.find((b) => b.id === "oil-change-2026-09-14-close-stale");
    // так задача выглядела на телефоне: пробег и дата поправлены вручную,
    // название набрано заново (лишний пробел), партия по названию её не нашла
    const edited = {
      id: 1, title: "Моторное  масло 0W-20", icon: "🔧", dueKm: 221600, dueDate: "2026-09-14",
      priority: "upcoming", note: "Замена моторного масла 0W-20", completed: false,
    };
    const planned = first.reminders.find((r) => r.sourceServiceId === entry.id);
    const others = first.reminders.filter((r) => r.id !== 1 && r.id !== planned.id);
    const before = migrateReminders([edited, ...others, planned]);

    const out = applyReminderBatch(before, first.service, closeStale);
    expect(out).toHaveLength(before.length);
    expect(out.find((r) => r.id === 1)).toMatchObject({
      completed: true, completedKm: 221570, completedDate: "2026-09-14", completedServiceId: entry.id,
      dueKm: 221600, dueDate: "2026-09-14", title: "Моторное  масло 0W-20",
    });
    // задача следующей замены остаётся единственной активной задачей о масле
    expect(out.filter((r) => !r.completed && r.title.includes("масло"))).toEqual([planned]);
    expect(out.find((r) => r.sourceServiceId === entry.id)).toMatchObject({ completed: false, dueKm: 234570 });
    // остальные задачи не тронуты
    others.forEach((o) => expect(out.find((r) => r.id === o.id)).toEqual(before.find((r) => r.id === o.id)));
    // запись ТО партия не меняет, повторное применение — без изменений
    expect(applyServiceBatch(first.service, closeStale)).toEqual(first.service);
    expect(applyReminderBatch(out, first.service, closeStale)).toBe(out);
  });

  test("закрытие устаревшей задачи: задача, возвращённая в работу после первой партии", () => {
    const first = apply(INITIAL_SERVICE, INITIAL_REMINDERS);
    const closeStale = HISTORY_IMPORTS.find((b) => b.id === "oil-change-2026-09-14-close-stale");
    const reopened = first.reminders.map((r) =>
      r.id === 1
        ? { ...r, completed: false, completedDate: null, completedKm: null, completedServiceId: null, dueKm: 221600, dueDate: "2026-09-14" }
        : r
    );
    const out = applyReminderBatch(reopened, first.service, closeStale);
    expect(out.find((r) => r.id === 1)).toMatchObject({ completed: true, completedKm: 221570 });
    expect(out.filter((r) => !r.completed)).toHaveLength(reopened.filter((r) => !r.completed).length - 1);
  });

  test("на чистой установке партия закрытия ничего не меняет — всё закрыто раньше", () => {
    const { service, reminders } = apply(INITIAL_SERVICE, INITIAL_REMINDERS);
    const closeStale = HISTORY_IMPORTS.find((b) => b.id === "oil-change-2026-09-14-close-stale");
    expect(applyReminderBatch(reminders, service, closeStale)).toBe(reminders);
    expect(reminders.filter((r) => r.completed).map((r) => r.id)).toEqual([1]);
    expect(reminders.filter((r) => !r.completed)).toHaveLength(INITIAL_REMINDERS.length);
  });

  test("повторное применение партии ничего не дублирует", () => {
    const first = apply(INITIAL_SERVICE, INITIAL_REMINDERS);
    const service = applyServiceBatch(first.service, batch);
    const reminders = applyReminderBatch(first.reminders, service, batch);
    expect(service).toHaveLength(first.service.length);
    expect(reminders).toHaveLength(first.reminders.length);
    expect(reminders.filter((r) => r.title === "Заменить моторное масло 0W-20")).toHaveLength(1);
  });

  test("если пользователь уже создал задачу из этой записи, импорт её не добавляет", () => {
    const first = apply(INITIAL_SERVICE, INITIAL_REMINDERS);
    const entry = first.service.find((s) => s.date === "2026-09-14" && s.category === "oil");
    const own = { id: 99, title: "Своя задача", sourceServiceId: entry.id, completed: false };
    const reminders = applyReminderBatch([own], first.service, batch);
    expect(reminders.map((r) => r.id)).toEqual([99]);
  });
});
