import { INITIAL_FUEL, INITIAL_REMINDERS, INITIAL_SERVICE } from "../data";
import { HISTORY_IMPORTS, applyFuelBatch, applyReminderBatch, applyServiceBatch, interpolateKm, mergeFuel, odometerAnchors } from "../history";
import { mileagePoints, monthlyFuelCosts } from "../analytics";
import { consumptionPoints, fmtKm, migrateFuel, migrateReminders, migrateService } from "../utils";

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

describe("сверка заправок с финансовым журналом (осень 2025)", () => {
  const FIN = HISTORY_IMPORTS.find((b) => b.id === "fuel-fin-journal-2025-09-10");
  const before = HISTORY_IMPORTS.filter((b) => b !== FIN).reduce(applyFuelBatch, migrateFuel(INITIAL_FUEL));
  const after = applyFuelBatch(before, FIN);
  const y2025 = (list) => list.filter((f) => f.date.startsWith("2025"));
  const total = (list) => Math.round(list.reduce((s, f) => s + (f.paidTotal || 0), 0) * 100) / 100;

  test("новых заправок нет: 12 записей журнала — дубли и уточнения существующих", () => {
    expect(y2025(after)).toHaveLength(29);
    expect(y2025(after)).toHaveLength(y2025(before).length);
    // итоги месяца из журнала (13.06 — 132,00 €, 01.07 — 128,50 €) заправками не стали
    expect(after.some((f) => f.date === "2025-06-13" || f.date === "2025-07-01")).toBe(false);
    // точные дубли остались одной записью
    ["2025-09-03", "2025-09-13", "2025-09-21"].forEach((d) =>
      expect(after.filter((f) => f.date === d)).toHaveLength(1)
    );
  });

  test("paidTotal уточняется по списанию, чек остаётся в grossTotal, разница — в discount", () => {
    const byKm = (km) => after.find((f) => f.km === km);
    expect(byKm(195487)).toMatchObject({ date: "2025-09-06", grossTotal: 40.13, paidTotal: 40.00, discount: 0.13 });
    expect(byKm(195757)).toMatchObject({ date: "2025-09-07", grossTotal: 38.00, paidTotal: 38.00, discount: 0 });
    expect(byKm(197451)).toMatchObject({ date: "2025-09-27", grossTotal: 40.00, paidTotal: 37.57, discount: 2.43 });
    expect(byKm(197955)).toMatchObject({ date: "2025-10-08", grossTotal: 62.02, paidTotal: 60.00, discount: 2.02 });
    expect(byKm(198722)).toMatchObject({ date: "2025-10-19", grossTotal: 25.84, paidTotal: 21.63, discount: 4.21 });
    expect(byKm(199010)).toMatchObject({ date: "2025-10-26", grossTotal: 18.78, paidTotal: 17.26, discount: 1.52 });
    // 08.08 — расхождение не объяснено, запись не тронута
    expect(after.find((f) => f.km === 192827)).toMatchObject({ paidTotal: 40, discount: 0 });
    // литры, пробег и расход не менялись
    after.forEach((f, i) => {
      expect([f.km, f.liters, f.consumption]).toEqual([before[i].km, before[i].liters, before[i].consumption]);
    });
  });

  test("контрольные суммы по месяцам из журнала: сентябрь 225,57 €, октябрь 98,89 €", () => {
    const { months, total: t } = monthlyFuelCosts(after, "2025", "2026-09-15");
    const m = Object.fromEntries(months.map((x) => [x.key, x.total]));
    expect(m["2025-06"]).toBe(132.5);
    expect(m["2025-07"]).toBe(128.8);
    expect(m["2025-08"]).toBe(159.99);
    expect(m["2025-09"]).toBe(225.57);
    expect(m["2025-10"]).toBe(98.89);
    expect(t).toBe(1160.89);
    expect(total(y2025(after))).toBe(1160.89);
    expect(total(y2025(before)) - total(y2025(after))).toBeCloseTo(9.86, 2);
  });

  test("данные 2026 года не меняются", () => {
    const y26 = (list) => list.filter((f) => f.date.startsWith("2026"));
    expect(y26(after)).toEqual(y26(before));
  });

  test("идемпотентность: повторное применение ничего не меняет", () => {
    expect(applyFuelBatch(after, FIN)).toEqual(after);
  });

  test("запись, которую пользователь уже поправил сам, не затирается", () => {
    const edited = before.map((f) => (f.km === 197955 ? { ...f, paidTotal: 55, discount: 7.02 } : f));
    const out = applyFuelBatch(edited, FIN);
    expect(out.find((f) => f.km === 197955)).toMatchObject({ paidTotal: 55, discount: 7.02 });
    // остальные правки партии при этом применяются
    expect(out.find((f) => f.km === 199010).paidTotal).toBe(17.26);
  });
});

describe("заправки 2024 по финансовому журналу", () => {
  const FIN24 = HISTORY_IMPORTS.find((b) => b.id === "fuel-fin-journal-2024");
  const before = HISTORY_IMPORTS.filter((b) => b !== FIN24).reduce(applyFuelBatch, migrateFuel(INITIAL_FUEL));
  const after = applyFuelBatch(before, FIN24);
  const y = (list, year) => list.filter((f) => f.date.startsWith(year));
  const r2 = (v) => Math.round(v * 100) / 100;
  const total = (list) => r2(list.reduce((s, f) => s + (f.paidTotal || 0), 0));

  test("сумма партии считается из самого списка: 8 операций, 862,00 €", () => {
    expect(FIN24.fuel).toHaveLength(8);
    expect(r2(FIN24.fuel.reduce((s, f) => s + f.paidTotal, 0))).toBe(862);
  });

  test("до импорта заправок 2024 нет, после — все 8 добавлены", () => {
    expect(y(before, "2024")).toHaveLength(0);
    expect(y(after, "2024")).toHaveLength(8);
    expect(total(y(after, "2024"))).toBe(862);
    expect(after).toHaveLength(before.length + 8);
  });

  test("до восстановления пробега: km, литры и цена неизвестны; расход и цена не считаются", () => {
    y(after, "2024").forEach((f) => {
      expect(f.km).toBe(0);
      expect(f.liters).toBeNull();
      expect(f.pricePerL).toBeNull();
      expect(f.grossTotal).toBeNull();
      expect(f.consumption).toBeNull();
      expect(f.discount).toBe(0);
      expect(typeof f.id).toBe("number");
    });
    // в статистику расхода и в историю одометра такие записи не попадают
    expect(mileagePoints(after, []).some((p) => p.date.startsWith("2024"))).toBe(false);
    expect(consumptionPoints(after).some((p) => p.date.startsWith("2024"))).toBe(false);
  });

  test("контрольные суммы по месяцам 2024 на графике", () => {
    const { months, total: t, avgPerMonth } = monthlyFuelCosts(after, "2024", "2026-09-15");
    expect(months.map((m) => [m.key, m.total])).toEqual([
      ["2024-05", 142], ["2024-06", 120], ["2024-07", 70], ["2024-08", 120],
      ["2024-09", 120], ["2024-10", 120], ["2024-11", 120], ["2024-12", 50],
    ]);
    expect(t).toBe(862);
    expect(avgPerMonth).toBeCloseTo(862 / 8, 6);
  });

  test("данные 2025 и 2026 не меняются", () => {
    expect(y(after, "2025")).toEqual(y(before, "2025"));
    expect(y(after, "2026")).toEqual(y(before, "2026"));
    expect(total(y(after, "2025"))).toBe(1160.89);
  });

  test("идемпотентность: повторное применение и повтор внутри партии не дублируют", () => {
    expect(applyFuelBatch(after, FIN24)).toEqual(after);
    // две записи без пробега с одной датой и суммой — одна заправка
    const twice = { fuel: [FIN24.fuel[0], { ...FIN24.fuel[0] }] };
    expect(applyFuelBatch(before, twice)).toHaveLength(before.length + 1);
    // а с разной суммой в один день — две
    const two = { fuel: [FIN24.fuel[0], { ...FIN24.fuel[0], paidTotal: 30 }] };
    expect(applyFuelBatch(before, two)).toHaveLength(before.length + 2);
  });

  test("запись без пробега не считается дублем заправки с пробегом на другую дату", () => {
    const own = { ...FIN24.fuel[0], km: 150000 };
    expect(mergeFuel(before, [own]).added).toHaveLength(1);
    // но та же дата и сумма, что у пользовательской записи, — дубль
    const withOwn = mergeFuel(before, [own]).list;
    expect(applyFuelBatch(withOwn, FIN24)).toHaveLength(withOwn.length + 7);
  });

  test("записи ТО партия не добавляет: шины и страховка уже есть, масло и дворники — конфликт", () => {
    expect(FIN24.service).toBeUndefined();
    const service = HISTORY_IMPORTS.reduce(applyServiceBatch, migrateService(INITIAL_SERVICE)).filter((s) => s.date.startsWith("2024"));
    expect(service.find((s) => s.date === "2024-09-25" && s.category === "tires").cost).toBe(254);
    expect(service.find((s) => s.date === "2024-11-21" && s.category === "insurance").cost).toBe(271.17);
    expect(service.find((s) => s.date === "2024-06-08" && s.category === "oil").cost).toBe(50);
    expect(service.find((s) => s.date === "2024-11-21" && s.category === "parts").cost).toBe(20);
    expect(service).toHaveLength(7);
  });
});

describe("восстановление пробега по опорным точкам", () => {
  const FILL = HISTORY_IMPORTS.find((b) => b.id === "odometer-fill-2024");
  const applyAll = (batches, fuel, service) =>
    batches.reduce(
      (acc, b) => ({ fuel: applyFuelBatch(acc.fuel, b, acc.service), service: applyServiceBatch(acc.service, b, acc.fuel) }),
      { fuel, service }
    );
  const before = applyAll(HISTORY_IMPORTS.filter((b) => b !== FILL), migrateFuel(INITIAL_FUEL), migrateService(INITIAL_SERVICE));
  const after = applyAll([FILL], before.fuel, before.service);
  const byDate = (list, date) => list.filter((e) => e.date === date);

  test("интерполяция: между точками, в день точки, вне диапазона, округление до 10 и зажим", () => {
    const anchors = [{ date: "2024-04-05", km: 160000 }, { date: "2024-06-08", km: 164700 }];
    // 29 из 64 дней: 160000 + 4700 × 29/64 = 162 129,7 → 162 130
    expect(interpolateKm(anchors, "2024-05-04")).toBe(162130);
    expect(interpolateKm(anchors, "2024-04-05")).toBe(160000);
    expect(interpolateKm(anchors, "2024-06-08")).toBe(164700);
    expect(interpolateKm(anchors, "2024-04-01")).toBeNull();
    expect(interpolateKm(anchors, "2024-07-01")).toBeNull();
    // накануне точки округление не перепрыгивает через неё
    expect(interpolateKm([{ date: "2024-01-01", km: 100 }, { date: "2024-01-02", km: 104 }], "2024-01-01")).toBe(100);
    // 91 + 7 × 1/2 = 94,5 → 90 округлением, но не ниже точки «до» — 91
    expect(interpolateKm([{ date: "2024-01-01", km: 91 }, { date: "2024-01-03", km: 98 }], "2024-01-02")).toBe(91);
    // несколько точек в один день — наименьшая
    expect(interpolateKm([{ date: "2025-08-08", km: 192820 }, { date: "2025-08-08", km: 192827 }], "2025-08-08")).toBe(192820);
  });

  test("опорные точки: подтверждённые + реальные из базы, монотонны, без дублей", () => {
    const anchors = odometerAnchors(before.fuel, before.service);
    for (let i = 1; i < anchors.length; i++) {
      expect(anchors[i].km).toBeGreaterThanOrEqual(anchors[i - 1].km);
      expect(anchors[i].date >= anchors[i - 1].date).toBe(true);
    }
    // откат одометра назад (дворники 21.11.2024 на 170 000 км до правки) точкой не становится
    const raw = odometerAnchors([], [{ date: "2024-09-25", km: 174000 }, { date: "2024-11-21", km: 170000 }], []);
    expect(raw).toEqual([{ date: "2024-09-25", km: 174000 }]);
    expect(anchors.some((a) => a.date === "2024-11-21" && a.km === 170000)).toBe(false);
    expect(anchors.filter((a) => a.date === "2019-11-21")).toHaveLength(1);
    // реальные заправки 2025 стали точками рядом с подтверждёнными
    expect(anchors.some((a) => a.date === "2025-08-15" && a.km === 193304)).toBe(true);
  });

  test("заправки 2024 получают пробег, рассчитанный между ближайшими реальными показаниями", () => {
    const expected = {
      "2024-05-04": 162130, "2024-06-04": 164410, "2024-07-04": 166920, "2024-08-26": 171440,
      "2024-09-06": 172380, "2024-10-01": 174130, "2024-11-21": 175200, "2024-12-01": 175410,
    };
    Object.entries(expected).forEach(([date, km]) => {
      const [f] = byDate(after.fuel, date);
      expect(f.km).toBe(km);
      // расход и цена по-прежнему не считаются: литров нет
      expect(f.liters).toBeNull();
      expect(f.pricePerL).toBeNull();
      expect(f.consumption).toBeNull();
    });
  });

  test("записи ТО без одометра тоже получают пробег", () => {
    const s = (date, type) => after.service.find((x) => x.date === date && x.type === type);
    expect(s("2024-11-21", "Страхование").km).toBe(175200);
    expect(s("2025-08-08", "Масло в коробку автомат").km).toBe(192820);
    expect(s("2025-08-08", "Масло в коробку и фильтр").km).toBe(192820);
    // между заправками 08.08 (192 827) и 15.08 (193 304)
    expect(s("2025-08-13", "Свечи").km).toBe(193170);
    // между заправками 07.09 (195 757) и 10.09 (196 113)
    expect(s("2025-09-09", "Аккумулятор Varta B33 45Ah 330A").km).toBe(195990);
    expect(after.service.filter((x) => !(x.km > 0))).toEqual([]);
  });

  test("одометр монотонный: все восстановленные точки попадают в график пробега", () => {
    const points = mileagePoints(after.fuel, after.service);
    const dates = new Set(points.map((p) => p.date));
    ["2024-05-04", "2024-06-04", "2024-07-04", "2024-08-26", "2024-09-06", "2024-10-01", "2024-11-21", "2024-12-01",
      "2025-08-13", "2025-09-09"].forEach((d) => expect(dates.has(d)).toBe(true));
    const km2024 = points.filter((p) => p.date >= "2024-01-18" && p.date <= "2025-01-24").map((p) => p.km);
    expect(km2024).toEqual([155347, 155870, 160000, 162130, 164410, 164700, 166920, 171440, 172380, 174000, 174130, 175200, 175410, 176540]);
  });

  test("известный пробег никогда не перезаписывается, 2025/2026 не повреждаются", () => {
    const known = (list) => list.filter((e) => e.km > 0).map((e) => [e.id, e.km]);
    expect(known(after.fuel)).toEqual(expect.arrayContaining(known(before.fuel)));
    expect(known(after.service)).toEqual(expect.arrayContaining(known(before.service)));
    expect(after.fuel.filter((f) => f.date >= "2025")).toEqual(before.fuel.filter((f) => f.date >= "2025"));
    // запись, где пользователь уже сам поставил пробег, остаётся как есть
    const own = before.fuel.map((f) => (f.date === "2024-07-04" ? { ...f, km: 166000 } : f));
    expect(applyFuelBatch(own, FILL, before.service).find((f) => f.date === "2024-07-04").km).toBe(166000);
  });

  test("идемпотентность: повторное применение ничего не меняет", () => {
    const again = applyAll([FILL], after.fuel, after.service);
    expect(again.fuel).toEqual(after.fuel);
    expect(again.service).toEqual(after.service);
  });

  test("запись вне диапазона точек остаётся без пробега — среднее не подставляется", () => {
    const early = [{ id: 1, date: "2015-01-01", km: null, paidTotal: 10 }];
    expect(applyFuelBatch(early, FILL, []).find((f) => f.id === 1).km).toBeNull();
  });
});

describe("дворники 21.11.2024: пробег 170 000 → 175 200", () => {
  const FIX = HISTORY_IMPORTS.find((b) => b.id === "wipers-2024-11-21-km");
  const applyAll = (batches, fuel, service) =>
    batches.reduce(
      (acc, b) => ({ fuel: applyFuelBatch(acc.fuel, b, acc.service), service: applyServiceBatch(acc.service, b, acc.fuel) }),
      { fuel, service }
    );
  const before = applyAll(HISTORY_IMPORTS.filter((b) => b !== FIX), migrateFuel(INITIAL_FUEL), migrateService(INITIAL_SERVICE));
  const after = applyAll([FIX], before.fuel, before.service);
  const wipers = (list) => list.find((s) => s.date === "2024-11-21" && s.type === "Щётки стеклоочистителя");

  test("только эта запись меняется, и только пробег", () => {
    expect(wipers(before.service).km).toBe(170000);
    expect(wipers(after.service)).toEqual({ ...wipers(before.service), km: 175200 });
    expect(after.service.filter((s) => s !== wipers(after.service)))
      .toEqual(before.service.filter((s) => s !== wipers(before.service)));
    expect(after.fuel).toEqual(before.fuel);
  });

  test("одометр больше не откатывается после 174 000 км", () => {
    const all = [...after.fuel, ...after.service].filter((e) => e.km > 0)
      .sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);
    const back = [];
    let max = 0;
    all.forEach((e) => { if (e.km < max) back.push(`${e.date} ${e.km}`); else max = e.km; });
    // остаётся только округление ТО 21.05.2026 (214 500 против заправки 14.05 на 214 503)
    expect(back).toEqual(["2026-05-21 214500"]);
    expect(mileagePoints(after.fuel, after.service).some((p) => p.date === "2024-11-21" && p.km === 175200)).toBe(true);
  });

  test("идемпотентно, а пробег, который пользователь уже поправил сам, не затирается", () => {
    expect(applyServiceBatch(after.service, FIX, after.fuel)).toEqual(after.service);
    const own = before.service.map((s) => (s === wipers(before.service) ? { ...s, km: 175000 } : s));
    expect(wipers(applyServiceBatch(own, FIX, before.fuel)).km).toBe(175000);
  });
});
