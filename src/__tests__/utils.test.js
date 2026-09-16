import { byMonthKeyDesc } from "../utils";

describe("byMonthKeyDesc", () => {
  it("sorts months newest-first by year+month key, not by month label", () => {
    const months = [
      { key: "2024-05", label: "май 24" },
      { key: "2026-10", label: "окт 26" },
      { key: "2025-08", label: "авг 25" },
      { key: "2026-01", label: "янв 26" },
    ];
    const sorted = [...months].sort(byMonthKeyDesc);
    expect(sorted.map((m) => m.key)).toEqual([
      "2026-10", "2026-01", "2025-08", "2024-05",
    ]);
  });

  it("puts a future month first once it appears, without manual reordering", () => {
    const months = [
      { key: "2026-09" },
      { key: "2026-10" },
      { key: "2026-11" },
    ];
    const sorted = [...months].sort(byMonthKeyDesc);
    expect(sorted.map((m) => m.key)).toEqual(["2026-11", "2026-10", "2026-09"]);
  });
});
