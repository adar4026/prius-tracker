import { fmtKm } from "../utils";
import {
  activeOilReminder, dueFromInterval, isOilChangeReminder, oilGradeOf,
  plannedReminderFields, serviceReminderNote, serviceReminderTitle,
} from "../serviceReminder";

const entry = {
  id: 30, date: "2026-09-14", km: 221570, category: "oil",
  type: "Масло Toyota 0W-20 + фильтр MANN HU 6006 z",
};

describe("задача из записи ТО", () => {
  test("название замены масла единое, вязкость из вида работ или профиля", () => {
    expect(oilGradeOf("Масло 5W-30 и фильтр")).toBe("5W-30");
    expect(oilGradeOf("Масло и фильтр")).toBeNull();
    expect(serviceReminderTitle(entry)).toBe("Заменить моторное масло 0W-20");
    expect(serviceReminderTitle({ ...entry, type: "Масло и фильтр" }, "0W-20"))
      .toBe("Заменить моторное масло 0W-20");
    expect(serviceReminderTitle({ ...entry, type: "Масло и фильтр" })).toBe("Заменить моторное масло");
    expect(serviceReminderTitle({ ...entry, category: "brakes", type: "Колодки" })).toBe("Колодки");
  });

  test("срок по интервалу: пробег + км, дата + месяцы", () => {
    expect(dueFromInterval(entry, 15000, 12)).toEqual({ dueKm: 236570, dueDate: "2027-09-14" });
    expect(dueFromInterval(entry, 13000, null)).toEqual({ dueKm: 234570, dueDate: null });
    expect(dueFromInterval({ ...entry, km: null }, 13000, 6)).toEqual({ dueKm: null, dueDate: "2027-03-14" });
  });

  test("примечание хранит интервал и исходную замену", () => {
    // fmtKm ставит неразрывный пробел между тысячами
    expect(serviceReminderNote(entry, 15000, 12)).toBe(
      `Интервал ${fmtKm(15000)} км / 12 мес. От замены 14.09.2026, ${fmtKm(221570)} км.`
    );
    expect(serviceReminderNote(entry, 13000, null)).toBe(
      `Интервал ${fmtKm(13000)} км. От замены 14.09.2026, ${fmtKm(221570)} км.`
    );
    expect(serviceReminderNote({ ...entry, km: null }, null, null))
      .toBe("Запланировано от записи 14.09.2026.");
  });

  test("поля задачи, которыми владеет запись ТО", () => {
    expect(plannedReminderFields(entry, { dueKm: 236570, dueDate: "2027-09-14", intervalKm: "15000", intervalMonths: "12" }))
      .toEqual({
        title: "Заменить моторное масло 0W-20", icon: "🔧",
        dueKm: 236570, dueDate: "2027-09-14", intervalKm: 15000, intervalMonths: 12,
        sourceServiceId: 30,
      });
  });

  test("задача про моторное масло распознаётся по связи или по названию", () => {
    const service = [entry, { id: 5, category: "fluid", type: "Вариатор" }];
    expect(isOilChangeReminder({ title: "Моторное масло 0W-20" })).toBe(true);
    expect(isOilChangeReminder({ title: "Заменить моторное масло 0W-20" })).toBe(true);
    expect(isOilChangeReminder({ title: "Масло 5W-30 и фильтр" })).toBe(true);
    expect(isOilChangeReminder({ title: "Масло в коробку" })).toBe(false);
    expect(isOilChangeReminder({ title: "Тормозная жидкость DOT4" })).toBe(false);
    expect(isOilChangeReminder({ title: "Что угодно", sourceServiceId: 30 }, service)).toBe(true);
    expect(isOilChangeReminder({ title: "Масло 0W-20", sourceServiceId: 5 }, service)).toBe(false);
  });

  test("активная задача масла: сначала созданная из последней замены", () => {
    const service = [entry, { id: 23, date: "2026-02-19", km: 208188, category: "oil", type: "Масло 5W-30" }];
    const old = { id: 1, title: "Моторное масло 0W-20", completed: false, dueKm: 221000 };
    const linked = { id: 9, title: "Заменить моторное масло 0W-20", completed: false, sourceServiceId: 30, dueKm: 234570 };
    expect(activeOilReminder([old, linked], service)).toBe(linked);
    expect(activeOilReminder([old], service)).toBe(old);
    expect(activeOilReminder([{ ...old, completed: true }], service)).toBeNull();
  });
});
