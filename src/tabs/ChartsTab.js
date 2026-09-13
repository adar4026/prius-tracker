import React, { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import Stat from "../components/Stat";
import { chartColors } from "../themes";
import {
  avg, byKmAsc, consumptionPoints, fmtMoney, fmtNum, isFull, monthLabel, num,
  numOrNull,
} from "../utils";

const MODES = [
  { id: "consumption", label: "Расход" },
  { id: "price", label: "Цена" },
  { id: "months", label: "Месяцы" },
  { id: "costs", label: "Затраты" },
];

const shortDate = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

export default function ChartsTab({ fuel, service, theme }) {
  const [mode, setMode] = useState("consumption");
  const c = chartColors(theme);

  const tooltipStyle = {
    background: c.tooltipBg,
    border: `1px solid ${c.grid}`,
    borderRadius: 10,
    color: c.text,
    fontSize: 12,
  };
  const axisProps = {
    tick: { fill: c.axis, fontSize: 10 },
    axisLine: { stroke: c.grid },
    tickLine: false,
  };

  const consumption = useMemo(
    () => consumptionPoints(fuel).map((f) => ({ ...f, label: shortDate(f.date) })),
    [fuel]
  );
  const avgConsumption = useMemo(
    () => avg(consumption.map((f) => f.consumption)),
    [consumption]
  );

  // заправки с неизвестной ценой на график не попадают — иначе это ноль в ряду
  const prices = useMemo(
    () =>
      [...fuel]
        .sort(byKmAsc)
        .filter((f) => numOrNull(f.pricePerL) !== null)
        .map((f) => ({ label: shortDate(f.date), price: num(f.pricePerL) })),
    [fuel]
  );
  const avgPrice = useMemo(() => avg(prices.map((p) => p.price)), [prices]);

  const months = useMemo(() => {
    const map = new Map();
    [...fuel].sort(byKmAsc).forEach((f) => {
      const key = f.date.slice(0, 7);
      if (!map.has(key)) map.set(key, { key, label: monthLabel(f.date), spent: 0, liters: 0, fills: 0, cons: [] });
      const m = map.get(key);
      m.spent += num(f.paidTotal);
      m.liters += num(f.liters);
      m.fills += 1;
      if (isFull(f) && Number.isFinite(f.consumption) && f.consumption > 0) m.cons.push(f.consumption);
    });
    return [...map.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((m) => ({ ...m, avgCons: m.cons.length ? avg(m.cons) : null }));
  }, [fuel]);

  // итоговые суммы — те же, что раньше стояли на главной
  const totalFuel = useMemo(() => fuel.reduce((s, f) => s + num(f.paidTotal), 0), [fuel]);
  const totalService = useMemo(() => service.reduce((s, r) => s + num(r.cost), 0), [service]);
  const totalCosts = totalFuel + totalService;
  const fuelShare = totalCosts > 0 ? Math.round((totalFuel / totalCosts) * 100) : 0;

  return (
    <main className="screen">
      <div className="seg">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={mode === m.id ? "active" : ""}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "consumption" && !consumption.length && (
        <div className="empty">Недостаточно данных для расчёта расхода</div>
      )}

      {mode === "consumption" && consumption.length > 0 && (
        <>
          <div className="card chart-card">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={consumption} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
                <YAxis domain={["dataMin - 0.4", "dataMax + 0.4"]} {...axisProps} width={44} tickFormatter={(v) => v.toFixed(1)} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: c.axis }}
                  formatter={(v) => [`${fmtNum(v, 2)} л/100 км`, "Расход"]}
                />
                {avgConsumption && (
                  <ReferenceLine
                    y={avgConsumption}
                    stroke={c.gold}
                    strokeDasharray="5 4"
                    label={{ value: `среднее ${fmtNum(avgConsumption, 2)}`, fill: c.gold, fontSize: 10, position: "insideTopRight" }}
                  />
                )}
                <Line
                  type="monotone" dataKey="consumption" stroke={c.green} strokeWidth={2.4}
                  dot={{ r: 2.6, fill: c.green, strokeWidth: 0 }} activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              <span><i className="dot" style={{ background: c.green }} /> л/100 км</span>
              <span><i className="dot" style={{ background: c.gold }} /> среднее</span>
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: 10 }}>
            <div className="card stat">
              <div className="stat__label">Минимум</div>
              <div className="stat__value" style={{ color: "var(--green)" }}>
                {fmtNum(Math.min(...consumption.map((x) => x.consumption)), 2)}
                <span className="stat__unit">л/100 км</span>
              </div>
            </div>
            <div className="card stat">
              <div className="stat__label">Максимум</div>
              <div className="stat__value" style={{ color: "var(--red)" }}>
                {fmtNum(Math.max(...consumption.map((x) => x.consumption)), 2)}
                <span className="stat__unit">л/100 км</span>
              </div>
            </div>
          </div>
          <div className="hint" style={{ padding: "0 2px" }}>
            Заправки «не до полного» в расчёте не участвуют.
          </div>
        </>
      )}

      {mode === "price" && !prices.length && (
        <div className="empty">Нет заправок</div>
      )}

      {mode === "price" && prices.length > 0 && (
        <>
          <div className="card chart-card">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={prices} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
                <YAxis domain={["dataMin - 0.1", "dataMax + 0.1"]} {...axisProps} width={46} tickFormatter={(v) => v.toFixed(2)} />
                <Tooltip
                  cursor={{ fill: c.grid, opacity: 0.35 }}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: c.axis }}
                  formatter={(v) => [`${fmtNum(v, 3)} €/л`, "Цена"]}
                />
                {avgPrice && <ReferenceLine y={avgPrice} stroke={c.gold} strokeDasharray="5 4" />}
                <Bar dataKey="price" fill={c.blue} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              <span><i className="dot" style={{ background: c.blue }} /> €/л</span>
              <span><i className="dot" style={{ background: c.gold }} /> среднее {fmtNum(avgPrice, 3)}</span>
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: 10 }}>
            <div className="card stat">
              <div className="stat__label">Дешевле всего</div>
              <div className="stat__value" style={{ color: "var(--green)" }}>
                {fmtNum(Math.min(...prices.map((p) => p.price)), 3)}
                <span className="stat__unit">€/л</span>
              </div>
            </div>
            <div className="card stat">
              <div className="stat__label">Дороже всего</div>
              <div className="stat__value" style={{ color: "var(--red)" }}>
                {fmtNum(Math.max(...prices.map((p) => p.price)), 3)}
                <span className="stat__unit">€/л</span>
              </div>
            </div>
          </div>
        </>
      )}

      {mode === "costs" && totalCosts === 0 && (
        <div className="empty">Нет данных о расходах</div>
      )}

      {mode === "costs" && totalCosts > 0 && (
        <>
          <div className="card hero">
            <div className="hero__label">Всего расходов</div>
            <div className="hero__value">{fmtMoney(totalCosts, 0)}</div>
            <div className="hero__note">Топливо + ТО и ремонт</div>
          </div>

          <div className="grid-2" style={{ marginTop: 10 }}>
            <Stat icon="⛽" label="Топливо" value={fmtMoney(totalFuel, 0)} color="var(--gold)" />
            <Stat icon="🔧" label="ТО и ремонт" value={fmtMoney(totalService, 0)} color="var(--blue)" />
          </div>

          <div className="card" style={{ marginTop: 10 }}>
            <div className="progress__head">
              <span className="progress__title">Распределение</span>
            </div>
            <div className="bar split">
              <div className="split__part" style={{ width: `${fuelShare}%`, background: "var(--gold)" }} />
              <div className="split__part" style={{ flex: 1, background: "var(--blue)" }} />
            </div>
            <div className="progress__meta">
              <span style={{ color: "var(--gold)" }}>Топливо {fuelShare}%</span>
              <span style={{ color: "var(--blue)" }}>ТО и ремонт {100 - fuelShare}%</span>
            </div>
          </div>
        </>
      )}

      {mode === "months" && !months.length && (
        <div className="empty">Нет заправок</div>
      )}

      {mode === "months" && months.length > 0 && (
        <>
          <div className="section-title">Средний расход по месяцам</div>
          <div className="card chart-card">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={months} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" {...axisProps} interval={0} angle={-35} textAnchor="end" height={44} />
                <YAxis domain={[0, "dataMax + 0.5"]} {...axisProps} width={44} tickFormatter={(v) => v.toFixed(1)} />
                <Tooltip
                  cursor={{ fill: c.grid, opacity: 0.35 }}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: c.axis }}
                  formatter={(v) => [`${fmtNum(v, 2)} л/100 км`, "Расход"]}
                />
                <Bar dataKey="avgCons" fill={c.green} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="section-title">Расходы на топливо</div>
          <div className="card chart-card">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={months} margin={{ top: 6, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" {...axisProps} interval={0} angle={-35} textAnchor="end" height={44} />
                <YAxis {...axisProps} width={50} tickFormatter={(v) => Math.round(v)} />
                <Tooltip
                  cursor={{ fill: c.grid, opacity: 0.35 }}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: c.axis }}
                  formatter={(v) => [fmtMoney(v), "Потрачено"]}
                />
                <Bar dataKey="spent" fill={c.gold} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="section-title">Сводка</div>
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Месяц</th><th>Запр.</th><th>Литры</th><th>л/100</th><th>€</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.key}>
                    <td>{m.label}</td>
                    <td>{m.fills}</td>
                    <td>{fmtNum(m.liters, 1)}</td>
                    <td style={{ color: "var(--green)" }}>{fmtNum(m.avgCons, 2)}</td>
                    <td>{m.spent.toFixed(0)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ fontWeight: 700 }}>Итого</td>
                  <td style={{ fontWeight: 700 }}>{months.reduce((s, m) => s + m.fills, 0)}</td>
                  <td style={{ fontWeight: 700 }}>{fmtNum(months.reduce((s, m) => s + m.liters, 0), 1)}</td>
                  <td />
                  <td style={{ fontWeight: 700 }}>{months.reduce((s, m) => s + m.spent, 0).toFixed(0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
