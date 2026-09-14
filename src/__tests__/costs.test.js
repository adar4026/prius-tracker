import {
  costBreakdownLabel, migrateService, normalizeCosts, serviceSearchText, sumCosts,
} from "../utils";

describe("детализация расходов ТО", () => {
  test("пустая детализация — null, запись остаётся «старой»", () => {
    expect(normalizeCosts(undefined)).toBeNull();
    expect(normalizeCosts(null)).toBeNull();
    expect(normalizeCosts({ labor: "", oil: "", filter: "", other: "" })).toBeNull();
    expect(sumCosts(null)).toBeNull();
    expect(costBreakdownLabel(null)).toBeNull();
  });

  test("сумма позиций считается с округлением до копеек", () => {
    expect(sumCosts({ labor: "30", oil: "62.88" })).toBe(92.88);
    expect(sumCosts({ labor: 0.1, oil: 0.2, filter: null, other: null })).toBe(0.3);
    expect(normalizeCosts({ labor: "30", oil: "62,88" })).toEqual({
      labor: 30, oil: 62.88, filter: null, other: null,
    });
  });

  test("строка детализации для карточки", () => {
    expect(costBreakdownLabel({ labor: 30, oil: 62.88 }))
      .toBe("Работа: 30,00 € · Масло и фильтр: 62,88 €");
    expect(costBreakdownLabel({ labor: 30, oil: 50, filter: 12.88, other: 5 }))
      .toBe("Работа: 30,00 € · Масло и фильтр: 62,88 € · Прочее: 5,00 €");
    expect(costBreakdownLabel({ filter: 12 })).toBe("Масляный фильтр: 12,00 €");
  });

  test("миграция: старые записи без детализации не меняются", () => {
    const [old] = migrateService([{ id: 1, date: "2025-02-14", km: 178000, type: "Масло", cost: 45, category: "oil" }]);
    expect(old).toMatchObject({ cost: 45, costs: null, note: "" });
    const [unknown] = migrateService([{ id: 2, date: "2025-01-24", type: "ITV", cost: null }]);
    expect(unknown.cost).toBeNull();
  });

  test("миграция: детализация нормализуется, общая сумма без cost берётся из неё", () => {
    const [entry] = migrateService([
      { id: 3, date: "2026-09-14", km: 221570, type: "Масло", costs: { labor: "30", oil: 62.88 }, category: "oil" },
    ]);
    expect(entry.costs).toEqual({ labor: 30, oil: 62.88, filter: null, other: null });
    expect(entry.cost).toBe(92.88);
    // явно заданная общая сумма не пересчитывается задним числом
    const [kept] = migrateService([{ id: 4, date: "2026-09-14", type: "Масло", cost: 90, costs: { labor: 30, oil: 62.88 } }]);
    expect(kept.cost).toBe(90);
  });

  test("поиск находит запись по позициям детализации", () => {
    const text = serviceSearchText({ date: "2026-09-14", km: 221570, type: "Масло", cost: 92.88, costs: { labor: 30, oil: 62.88 }, category: "oil" });
    expect(text).toContain("Работа: 30,00 €");
    expect(text).toContain("62,88");
  });
});
