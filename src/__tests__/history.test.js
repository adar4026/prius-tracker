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
      HISTORY_IMPORTS.slice(0, -1).reduce(applyServiceBatch, migrateService(INITIAL_SERVICE))
        .reduce((s, r) => s + (r.cost || 0), 0) + 92.88,
      2
    );
  });

  test("старая задача закрывается записью, создаётся одна новая на 236 570 км", () => {
    const { service, reminders } = apply(INITIAL_SERVICE, INITIAL_REMINDERS);
    const entry = service.find((s) => s.date === "2026-09-14" && s.category === "oil");
    const old = reminders.find((r) => r.title === "Моторное масло 0W-20");
    expect(old).toMatchObject({ completed: true, completedKm: 221570, completedDate: "2026-09-14", completedServiceId: entry.id });

    const planned = reminders.filter((r) => r.sourceServiceId === entry.id);
    expect(planned).toHaveLength(1);
    expect(planned[0]).toMatchObject({
      title: "Заменить моторное масло 0W-20", icon: "🔧", completed: false, priority: "upcoming",
      dueKm: 236570, dueDate: "2027-09-14", intervalKm: 15000, intervalMonths: 12,
    });
    expect(planned[0].note).toBe(
      `Интервал ${fmtKm(15000)} км / 12 мес. От замены 14.09.2026, ${fmtKm(221570)} км.`
    );
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
