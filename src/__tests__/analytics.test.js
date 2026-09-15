import {
  averageFuelCostPerMonth, averageServiceCostPerDay, avgKmPerDay, daysBetween,
  expenseEntries, filterPeriod, inPeriod, isValidISODate, kmTicks, mileagePoints,
  monthRange, monthTicks, monthlyExpenses, monthlyFuelCosts, periodDayBounds,
  periodMonthBounds, periodOptions, serviceCostsByMonth, timeTicks,
} from "../analytics";
import { INITIAL_FUEL, INITIAL_SERVICE } from "../data";
import { HISTORY_IMPORTS, applyFuelBatch } from "../history";
import { migrateFuel, migrateService } from "../utils";

const fuel = (date, km, paidTotal = 40) => ({ id: km, date, km, paidTotal });
const service = (date, km, cost = 0) => ({ id: `${date}-${km}`, date, km, cost });

describe("точки пробега", () => {
  test("объединяются из заправок и ТО, сортируются по дате", () => {
    const points = mileagePoints(
      [fuel("2026-03-20", 210554), fuel("2026-03-11", 209834)],
      [service("2026-02-19", 208188)]
    );
    expect(points.map((p) => p.km)).toEqual([208188, 209834, 210554]);
    expect(points.map((p) => p.date)).toEqual(["2026-02-19", "2026-03-11", "2026-03-20"]);
  });

  test("одинаковые дата и пробег из разных источников — одна точка", () => {
    const points = mileagePoints([fuel("2026-05-02", 213747)], [service("2026-05-02", 213747)]);
    expect(points).toHaveLength(1);
  });

  test("несколько записей в один день сохраняются по возрастанию пробега", () => {
    const points = mileagePoints(
      [fuel("2026-01-11", 205251), fuel("2026-01-11", 205121)],
      [service("2026-01-11", 205000)]
    );
    expect(points.map((p) => p.km)).toEqual([205000, 205121, 205251]);
  });

  test("одометр не уменьшается: заниженный пробег поздней записи пропускается", () => {
    const points = mileagePoints(
      [fuel("2026-05-14", 214503)],
      [service("2026-05-21", 214500), service("2026-06-11", 216000)]
    );
    expect(points.map((p) => p.km)).toEqual([214503, 216000]);
  });

  test("неизвестный пробег (0, null, '') и битая дата точкой не становятся", () => {
    const points = mileagePoints(
      [fuel("2026-13-40", 1000), { date: "", km: 5 }, null],
      [service("2025-09-09", 0), service("2024-11-21", null), service("2025-01-24", "")]
    );
    expect(points).toEqual([]);
  });

  test("ts точки — полночь UTC, без Invalid Date", () => {
    const [p] = mileagePoints([fuel("2026-03-11", 209834)], []);
    expect(p.ts).toBe(Date.UTC(2026, 2, 11));
    expect(Number.isFinite(p.ts)).toBe(true);
  });
});

describe("средний пробег в сутки", () => {
  test("(последний − первый) / календарных дней, округляется до целых", () => {
    const points = mileagePoints([fuel("2026-03-11", 209834), fuel("2026-09-06", 220684)], []);
    // 10 850 км за 179 дней
    expect(daysBetween("2026-03-11", "2026-09-06")).toBe(179);
    expect(avgKmPerDay(points)).toBe(61);
  });

  test("одна точка или все точки в один день — null, а не NaN/Infinity", () => {
    expect(avgKmPerDay(mileagePoints([fuel("2026-03-11", 209834)], []))).toBeNull();
    expect(avgKmPerDay(mileagePoints([fuel("2026-03-11", 209834), fuel("2026-03-11", 209900)], []))).toBeNull();
    expect(avgKmPerDay([])).toBeNull();
    expect(avgKmPerDay(null)).toBeNull();
  });

  test("несколько лет данных", () => {
    const points = mileagePoints([], [service("2018-02-19", 91714), service("2026-09-14", 221570)]);
    // 129 856 км за 3129 дней
    expect(avgKmPerDay(points)).toBe(42);
  });
});

describe("расходы", () => {
  test("собираются из paidTotal заправок и cost записей ТО; без суммы — null", () => {
    const entries = expenseEntries(
      [fuel("2026-03-11", 209834, 59.59), { date: "2026-01-16", km: 205954, paidTotal: null }],
      [service("2025-01-24", 176540, null), service("2026-09-14", 221570, 92.88)]
    );
    expect(entries.map((e) => [e.date, e.amount])).toEqual([
      ["2025-01-24", null],
      ["2026-01-16", null],
      ["2026-03-11", 59.59],
      ["2026-09-14", 92.88],
    ]);
  });

  test("период: год или всё", () => {
    expect(inPeriod({ date: "2026-03-11" }, "all")).toBe(true);
    expect(inPeriod({ date: "2026-03-11" }, "2026")).toBe(true);
    expect(inPeriod({ date: "2026-03-11" }, "2025")).toBe(false);
  });

  test("общий срез по периоду и варианты фильтра", () => {
    const list = [fuel("2026-03-11", 1), fuel("2025-12-27", 2), service("2024-06-08", 3)];
    expect(filterPeriod(list, "all")).toBe(list);
    expect(filterPeriod(list, "2025").map((e) => e.date)).toEqual(["2025-12-27"]);
    expect(filterPeriod(list, "2019")).toEqual([]);
    expect(filterPeriod(null, "2026")).toEqual([]);
    expect(periodOptions(list.slice(0, 2), list.slice(2)).map((o) => o.id)).toEqual(["all", "2026", "2025", "2024"]);
    expect(periodOptions([], []).map((o) => o.id)).toEqual(["all"]);
  });

  test("диапазон месяцев включает пустые месяцы между границами", () => {
    expect(monthRange("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthRange("2026-02", "2026-02")).toEqual(["2026-02"]);
    expect(monthRange("2026-03", "2026-02")).toEqual([]);
  });

  test("границы периода: всё время — от первой записи до текущего месяца", () => {
    const entries = expenseEntries([fuel("2026-03-11", 1)], [service("2025-11-21", 1, 271.17)]);
    expect(periodMonthBounds(entries, "all", "2026-09-15")).toEqual({ from: "2025-11", to: "2026-09" });
    // прошлый год — все 12 месяцев, текущий — по текущий месяц
    expect(periodMonthBounds(entries, "2025", "2026-09-15")).toEqual({ from: "2025-01", to: "2025-12" });
    expect(periodMonthBounds(entries, "2026", "2026-09-15")).toEqual({ from: "2026-01", to: "2026-09" });
    // год без записей — нет диапазона
    expect(periodMonthBounds(entries, "2024", "2026-09-15")).toBeNull();
    expect(periodMonthBounds([], "all", "2026-09-15")).toBeNull();
  });

  test("группировка по календарным месяцам с нулевыми месяцами", () => {
    const entries = expenseEntries(
      [fuel("2026-01-05", 1, 40), fuel("2026-01-10", 2, 43.5), fuel("2026-03-06", 3, 40)],
      [service("2026-03-01", 4, 100)]
    );
    const { months, total, avgPerMonth } = monthlyExpenses(entries, "all", "2026-03-15");
    expect(months.map((m) => [m.key, m.total])).toEqual([
      ["2026-01", 83.5],
      ["2026-02", 0],
      ["2026-03", 140],
    ]);
    expect(months.map((m) => m.label)).toEqual(["янв 26", "фев 26", "мар 26"]);
    expect(total).toBe(223.5);
    // 223,50 / 3 месяца — пустой февраль делит сумму наравне с остальными
    expect(avgPerMonth).toBeCloseTo(74.5, 2);
  });

  test("средняя сумма в месяц делится на все месяцы диапазона, а не только на месяцы с покупками", () => {
    const entries = expenseEntries([fuel("2025-01-10", 1, 120)], []);
    const { months, avgPerMonth } = monthlyExpenses(entries, "2025", "2026-09-15");
    expect(months).toHaveLength(12);
    expect(avgPerMonth).toBeCloseTo(10, 6);
  });

  test("один месяц данных", () => {
    const entries = expenseEntries([fuel("2026-09-04", 1, 50), fuel("2026-09-06", 2, 38.5)], []);
    const { months, avgPerMonth } = monthlyExpenses(entries, "all", "2026-09-15");
    expect(months).toEqual([{ key: "2026-09", label: "сен 26", total: 88.5 }]);
    expect(avgPerMonth).toBe(88.5);
  });

  test("записи без цены не считаются, но диапазон задают", () => {
    const entries = expenseEntries([], [service("2018-02-19", 91714, null), service("2018-04-01", 95000, 46)]);
    const { months, total, avgPerMonth } = monthlyExpenses(entries, "2018", "2026-09-15");
    expect(months[0]).toEqual({ key: "2018-01", label: "янв 18", total: 0 });
    expect(months[1].total).toBe(0);
    expect(months[3].total).toBe(46);
    expect(total).toBe(46);
    expect(avgPerMonth).toBeCloseTo(46 / 12, 6);
  });

  test("отсутствие расходов — пустой результат без NaN", () => {
    const { months, total, avgPerMonth } = monthlyExpenses([], "all", "2026-09-15");
    expect(months).toEqual([]);
    expect(total).toBe(0);
    expect(avgPerMonth).toBeNull();
  });

  test("суммы округляются до копеек, ошибок плавающей точки нет", () => {
    const entries = expenseEntries([fuel("2026-09-01", 1, 0.1), fuel("2026-09-02", 2, 0.2)], []);
    expect(monthlyExpenses(entries, "all", "2026-09-15").months[0].total).toBe(0.3);
  });
});

describe("подписи осей", () => {
  test("до двух лет — месяцы, дальше — только годы", () => {
    const short = monthRange("2026-01", "2026-09");
    const t = monthTicks(short);
    expect(t.ticks.length).toBeLessThanOrEqual(7);
    expect(t.format("2026-01")).toBe("янв 26");

    const long = monthRange("2018-02", "2026-09");
    const y = monthTicks(long);
    expect(y.ticks.every((k) => k.endsWith("-01"))).toBe(true);
    expect(y.ticks.length).toBeLessThanOrEqual(7);
    expect(y.format("2019-01")).toBe("2019");
  });

  test("ось пробега: круглый шаг, не больше шести делений", () => {
    expect(kmTicks(91714, 221570)).toEqual({ ticks: [50000, 100000, 150000, 200000, 250000], domain: [50000, 250000] });
    const year = kmTicks(204058, 221570);
    expect(year.ticks.length).toBeLessThanOrEqual(6);
    expect(year.ticks[0]).toBeLessThanOrEqual(204058);
    expect(year.ticks[year.ticks.length - 1]).toBeGreaterThanOrEqual(221570);
    expect(year.ticks.every((v) => v % 1000 === 0)).toBe(true);
    // одна точка — домен всё равно имеет ширину
    const single = kmTicks(91714, 91714);
    expect(single.domain[1]).toBeGreaterThan(single.domain[0]);
    expect(kmTicks(NaN, 1).ticks).toEqual([]);
  });

  test("ось времени: годы / месяцы / дни по размеру диапазона", () => {
    const years = timeTicks(Date.UTC(2018, 1, 19), Date.UTC(2026, 8, 14));
    expect(years.ticks.length).toBeGreaterThan(0);
    expect(years.ticks.length).toBeLessThanOrEqual(6);
    expect(years.format(Date.UTC(2020, 0, 1))).toBe("2020");

    const months = timeTicks(Date.UTC(2026, 2, 11), Date.UTC(2026, 8, 14));
    expect(months.ticks[0]).toBe(Date.UTC(2026, 3, 1));
    expect(months.format(Date.UTC(2026, 3, 1))).toBe("апр 26");

    const days = timeTicks(Date.UTC(2026, 8, 1), Date.UTC(2026, 8, 14));
    expect(days.ticks[0]).toBe(Date.UTC(2026, 8, 1));
    expect(days.format(Date.UTC(2026, 8, 1))).toBe("01.09");

    expect(timeTicks(NaN, 5).ticks).toEqual([]);
    expect(timeTicks(10, 5).ticks).toEqual([]);
  });
});

describe("реальные начальные данные Lexcar", () => {
  const f = migrateFuel(INITIAL_FUEL);
  const s = migrateService(INITIAL_SERVICE);

  test("пробег монотонный, средний км/сутки конечный", () => {
    const points = mileagePoints(f, s);
    for (let i = 1; i < points.length; i++) {
      expect(points[i].km).toBeGreaterThanOrEqual(points[i - 1].km);
      expect(points[i].date >= points[i - 1].date).toBe(true);
    }
    // записи ТО с km:0 (аккумулятор, колодки) точками не стали
    expect(points.some((p) => p.km === 0)).toBe(false);
    expect(Number.isFinite(avgKmPerDay(points))).toBe(true);
  });

  test("расходы за всё время совпадают с суммой «Всего расходов» раздела", () => {
    const entries = expenseEntries(f, s);
    const { total } = monthlyExpenses(entries, "all", "2026-09-15");
    const expected =
      f.reduce((a, x) => a + (x.paidTotal || 0), 0) + s.reduce((a, x) => a + (x.cost || 0), 0);
    expect(total).toBeCloseTo(expected, 2);
  });

  test("дата валидируется по календарю", () => {
    expect(isValidISODate("2026-02-29")).toBe(false);
    expect(isValidISODate("2024-02-29")).toBe(true);
    expect(isValidISODate("2026-9-1")).toBe(false);
    expect(isValidISODate(null)).toBe(false);
  });
});

describe("границы календарных дней периода", () => {
  const entries = expenseEntries(
    [fuel("2025-11-21", 1, 40), fuel("2026-01-16", 2, 43.5)],
    [service("2018-02-19", 3, 0)]
  );

  test("«всё время» — от первой записи до сегодня", () => {
    expect(periodDayBounds(entries, "all", "2026-09-15")).toEqual({ from: "2018-02-19", to: "2026-09-15" });
  });

  test("прошлый завершённый год — 1 января – 31 декабря", () => {
    expect(periodDayBounds(entries, "2025", "2026-09-15")).toEqual({ from: "2025-01-01", to: "2025-12-31" });
  });

  test("текущий незавершённый год — по сегодня, без будущих дней", () => {
    expect(periodDayBounds(entries, "2026", "2026-09-15")).toEqual({ from: "2026-01-01", to: "2026-09-15" });
  });

  test("год без единой записи — null", () => {
    expect(periodDayBounds(entries, "2020", "2026-09-15")).toBeNull();
    expect(periodDayBounds([], "all", "2026-09-15")).toBeNull();
  });
});

describe("ежемесячные затраты на топливо (вкладка «Затраты»)", () => {
  test("пустой месяц между двумя известными считается 0 €, несколько заправок в месяце суммируются", () => {
    const fuelList = [fuel("2026-01-05", 1, 40), fuel("2026-01-10", 2, 43.5), fuel("2026-03-06", 3, 40)];
    const { months, total, avgPerMonth } = monthlyFuelCosts(fuelList, "all", "2026-03-15");
    expect(months.map((m) => [m.key, m.total])).toEqual([
      ["2026-01", 83.5],
      ["2026-02", 0],
      ["2026-03", 40],
    ]);
    expect(total).toBe(123.5);
    expect(avgPerMonth).toBeCloseTo(123.5 / 3, 6);
    expect(averageFuelCostPerMonth(fuelList, "all", "2026-03-15")).toBe(avgPerMonth);
  });

  test("«всё время»: диапазон начинается с первой заправки с суммой, а не с первой записи автомобиля", () => {
    // ТО с 2018 года топливный диапазон не растягивает — в monthlyFuelCosts оно не передаётся вовсе
    const fuelList = [fuel("2025-06-10", 1, 40), fuel("2026-09-06", 2, 38.5)];
    const { months, avgPerMonth } = monthlyFuelCosts(fuelList, "all", "2026-09-15");
    expect(months[0].key).toBe("2025-06");
    expect(months[months.length - 1].key).toBe("2026-09");
    expect(months).toHaveLength(16);
    // 78,50 / 16, а не / 104 месяца с 2018 года
    expect(avgPerMonth).toBeCloseTo(78.5 / 16, 6);
  });

  test("заправка без суммы диапазон не открывает: месяцы до первой оплаченной — не нули", () => {
    const fuelList = [
      { id: 1, date: "2024-03-01", km: 1, paidTotal: null },
      fuel("2025-06-10", 2, 40),
    ];
    const { months, avgPerMonth } = monthlyFuelCosts(fuelList, "all", "2025-07-15");
    expect(months.map((m) => m.key)).toEqual(["2025-06", "2025-07"]);
    expect(avgPerMonth).toBe(20);
  });

  test("конкретный год с данными: обрезается снизу по первой финансовой записи", () => {
    const fuelList = [fuel("2025-06-10", 1, 70), fuel("2025-12-27", 2, 70)];
    const { months, avgPerMonth } = monthlyFuelCosts(fuelList, "2025", "2026-09-15");
    // июнь–декабрь, а не январь–декабрь
    expect(months.map((m) => m.key)).toEqual(
      ["2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12"]
    );
    expect(avgPerMonth).toBe(20);
  });

  test("год после первой финансовой записи: считается с января, пропуски внутри — 0 €", () => {
    const fuelList = [fuel("2025-06-10", 1, 40), fuel("2026-03-06", 2, 60)];
    const { months, avgPerMonth } = monthlyFuelCosts(fuelList, "2026", "2026-03-15");
    expect(months.map((m) => [m.key, m.total])).toEqual([
      ["2026-01", 0],
      ["2026-02", 0],
      ["2026-03", 60],
    ]);
    expect(avgPerMonth).toBe(20);
  });

  test("конкретный год без финансовых данных о топливе — пусто, а не 0 €", () => {
    const fuelList = [fuel("2025-06-10", 1, 40)];
    const { months, total, avgPerMonth } = monthlyFuelCosts(fuelList, "2018", "2026-09-15");
    expect(months).toEqual([]);
    expect(total).toBe(0);
    expect(avgPerMonth).toBeNull();
  });

  test("текущий незавершённый год — только месяцы по сегодня, без будущих", () => {
    const fuelList = [fuel("2026-01-05", 1, 40)];
    const { months } = monthlyFuelCosts(fuelList, "2026", "2026-03-15");
    expect(months.map((m) => m.key)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  test("совсем без данных — пусто, без NaN/Infinity", () => {
    const { months, total, avgPerMonth } = monthlyFuelCosts([], "all", "2026-09-15");
    expect(months).toEqual([]);
    expect(total).toBe(0);
    expect(avgPerMonth).toBeNull();
    expect(Number.isFinite(total)).toBe(true);
    expect(averageFuelCostPerMonth([{ date: "2026-01-16", km: 1, paidTotal: null }], "all", "2026-09-15")).toBeNull();
  });
});

describe("топливо: реальные данные Lexcar", () => {
  const f = HISTORY_IMPORTS.reduce(applyFuelBatch, migrateFuel(INITIAL_FUEL));

  test("финансовые данные о топливе есть с мая 2024, среднее делится на 29 месяцев, а не на 104", () => {
    const { months, total, avgPerMonth } = monthlyFuelCosts(f, "all", "2026-09-15");
    expect(months[0].key).toBe("2024-05");
    expect(months).toHaveLength(29);
    // 862,00 (2024, фин. журнал) + 2542,42 по чекам − 9,86 скидок осени 2025
    expect(total).toBeCloseTo(3394.56, 2);
    expect(avgPerMonth).toBeCloseTo(3394.56 / 29, 2);
    // январь–апрель 2025: данные уже ведутся, заправок нет — честные нули внутри диапазона
    expect(months.filter((m) => m.key >= "2025-01" && m.key <= "2025-05").every((m) => m.total === 0)).toBe(true);
    // 2018 год есть только в ТО — для топлива это «нет данных»
    expect(monthlyFuelCosts(f, "2018", "2026-09-15").months).toEqual([]);
  });
});

describe("ежедневные затраты на ТО и ремонт (вкладка «Затраты»)", () => {
  test("среднее в день: сумма cost за период / календарные дни периода", () => {
    const serviceList = [service("2026-01-10", 1, 100), service("2026-01-20", 2, 50)];
    const avg = averageServiceCostPerDay([], serviceList, "2026", "2026-01-31");
    // 150 € / 31 день января, округляется до копеек
    expect(avg).toBeCloseTo(150 / 31, 2);
  });

  test("несколько расходов в одном месяце суммируются", () => {
    const serviceList = [
      service("2026-02-01", 1, 30),
      service("2026-02-15", 2, 20),
      service("2026-02-20", 3, 10),
    ];
    const { months } = serviceCostsByMonth([], serviceList, "2026", "2026-02-28");
    const feb = months.find((m) => m.key === "2026-02");
    expect(feb.total).toBe(60);
  });

  test("год без единого ТО — среднее 0, а не null/NaN", () => {
    const fuelList = [fuel("2026-05-01", 1, 40)];
    const avg = averageServiceCostPerDay(fuelList, [], "2026", "2026-09-15");
    expect(avg).toBe(0);
    expect(Number.isFinite(avg)).toBe(true);
  });

  test("совсем без записей за период — null, а не NaN/Infinity", () => {
    expect(averageServiceCostPerDay([], [], "all", "2026-09-15")).toBeNull();
    expect(averageServiceCostPerDay([], [], "2020", "2026-09-15")).toBeNull();
  });

  test("«всё время» использует все календарные дни от первой записи до сегодня", () => {
    const serviceList = [service("2018-02-19", 1, 365)];
    const avg = averageServiceCostPerDay([], serviceList, "all", "2019-02-19");
    // 365 € за ровно 365 дней (2018 — невисокосный)
    expect(avg).toBeCloseTo(1, 6);
  });
});
