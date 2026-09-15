import React, { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import Stat from "../components/Stat";
import FilterMenu from "../components/FilterMenu";
import { chartColors } from "../themes";
import {
  avg, byKmAsc, consumptionPoints, fmtDate, fmtKm, fmtMoney, fmtNum, isFull,
  monthLabel, num, numOrNull,
} from "../utils";
import {
  avgKmPerDay, expenseEntries, filterPeriod, kmTicks, mileagePoints, monthTicks,
  monthlyExpenses, periodLabel, periodOptions, timeTicks, tsToISO,
} from "../analytics";

const MODES = [
  { id: "consumption", label: "Обзор" },
  { id: "price", label: "Цена" },
  { id: "months", label: "Месяцы" },
  { id: "costs", label: "Затраты" },
];

const shortDate = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

// 220 000 → «220 тыс.», 220 500 → «220,5 тыс.» — компактная подпись оси км.
// Пробел неразрывный: по обычному recharts переносит подпись на две строки.
const kmTick = (v) =>
  `${v % 1000 === 0 ? Math.round(v / 1000) : fmtNum(v / 1000, 1)}\u00a0тыс.`;

const DAY_MS = 86400000;

/**
 * Раздел «Графики»: переключатель режимов. Период («Все» или год) относится
 * к режиму «Обзор»: он срезает заправки и записи ТО (fuelP/serviceP), и по
 * этому срезу считаются график расхода, минимум/максимум и «Аналитика».
 * Режимы «Цена», «Месяцы» и «Затраты» работают с исходными списками и от
 * периода не зависят. Выбор сохраняется при переключении режимов.
 */
export default function ChartsTab({ fuel, service, theme }) {
  const [mode, setMode] = useState("consumption");
  const [period, setPeriod] = useState("all");
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

  /* ---------------- период ---------------- */

  const options = useMemo(() => periodOptions(fuel, service), [fuel, service]);
  // выбранный год мог исчезнуть после удаления записей
  const activePeriod = options.some((o) => o.id === period) ? period : "all";
  const periodText = periodLabel(activePeriod);

  // срез по периоду для режима «Обзор» и его аналитики
  const fuelP = useMemo(() => filterPeriod(fuel, activePeriod), [fuel, activePeriod]);
  const serviceP = useMemo(() => filterPeriod(service, activePeriod), [service, activePeriod]);

  /* ---------------- расход ---------------- */

  // расход каждой заправки хранится в записи, поэтому январская заправка
  // сохраняет цикл от декабрьского полного бака и при фильтре по году
  const consumption = useMemo(
    () => consumptionPoints(fuelP).map((f) => ({ ...f, label: shortDate(f.date) })),
    [fuelP]
  );
  const avgConsumption = useMemo(
    () => avg(consumption.map((f) => f.consumption)),
    [consumption]
  );
  const minConsumption = consumption.length
    ? Math.min(...consumption.map((x) => x.consumption))
    : null;
  const maxConsumption = consumption.length
    ? Math.max(...consumption.map((x) => x.consumption))
    : null;

  /* ---------------- цена ---------------- */

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

  /* ---------------- месяцы ---------------- */

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
  // на длинном диапазоне подписи месяцев прореживаются, иначе они наезжают
  const monthsAxis = useMemo(() => monthTicks(months.map((m) => m.key)), [months]);

  /* ---------------- затраты ---------------- */

  // итоговые суммы — те же, что раньше стояли на главной
  const totalFuel = useMemo(() => fuel.reduce((s, f) => s + num(f.paidTotal), 0), [fuel]);
  const totalService = useMemo(() => service.reduce((s, r) => s + num(r.cost), 0), [service]);
  const totalCosts = totalFuel + totalService;
  const fuelShare = totalCosts > 0 ? Math.round((totalFuel / totalCosts) * 100) : 0;

  /* ---------------- пробег ---------------- */

  const mileage = useMemo(() => mileagePoints(fuelP, serviceP), [fuelP, serviceP]);
  const kmPerDay = useMemo(() => avgKmPerDay(mileage), [mileage]);
  const mileageAxis = useMemo(() => {
    if (!mileage.length) return { domain: [0, 1], y: kmTicks(NaN, NaN), ticks: [], format: () => "" };
    let min = mileage[0].ts;
    let max = mileage[mileage.length - 1].ts;
    // одна точка: без искусственной ширины оси recharts не строит шкалу
    if (min === max) { min -= DAY_MS; max += DAY_MS; }
    const y = kmTicks(mileage[0].km, mileage[mileage.length - 1].km);
    return { domain: [min, max], y, ...timeTicks(min, max) };
  }, [mileage]);

  /* ---------------- ежемесячные затраты (вкладка «Затраты») ---------------- */

  // карточка живёт в «Затратах», поэтому считается по всем данным, а не по
  // периоду «Обзора» — так же, как «Всего расходов» и остальные карточки вкладки
  const expenses = useMemo(() => expenseEntries(fuel, service), [fuel, service]);
  const monthly = useMemo(() => monthlyExpenses(expenses, "all"), [expenses]);
  const monthlyAxis = useMemo(
    () => monthTicks(monthly.months.map((m) => m.key)),
    [monthly]
  );
  const monthlyPeriodText = periodLabel("all");

  return (
    <main className="screen screen--charts">
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

      {/* ---------- расход топлива ---------- */}

      {/* период режима «Обзор»: график, минимум/максимум и аналитика ниже */}
      {mode === "consumption" && (
        <div className="filter-row" style={{ paddingTop: 0 }}>
          <FilterMenu name="Период" title="Период" value={activePeriod} options={options} onChange={setPeriod} />
          <span className="analytic__scope">{periodText}</span>
        </div>
      )}

      {mode === "consumption" && !consumption.length && (
        <div className="card">
          <div className="empty">Недостаточно данных для расчёта расхода</div>
        </div>
      )}

      {mode === "consumption" && consumption.length > 0 && (
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
      )}

      {mode === "consumption" && (
        <>
          <div className="grid-2" style={{ marginTop: 10 }}>
            <div className="card stat">
              <div className="stat__label">Минимум</div>
              <div className="stat__value" style={{ color: "var(--green)" }}>
                {fmtNum(minConsumption, 2)}
                <span className="stat__unit">л/100 км</span>
              </div>
            </div>
            <div className="card stat">
              <div className="stat__label">Максимум</div>
              <div className="stat__value" style={{ color: "var(--red)" }}>
                {fmtNum(maxConsumption, 2)}
                <span className="stat__unit">л/100 км</span>
              </div>
            </div>
          </div>
          <div className="hint" style={{ padding: "0 2px" }}>
            Заправки «не до полного» в расчёте не участвуют.
          </div>
        </>
      )}

      {/* ---------- цена ---------- */}

      {mode === "price" && !prices.length && (
        <div className="card"><div className="empty">Нет заправок</div></div>
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

      {/* ---------- месяцы ---------- */}

      {mode === "months" && !months.length && (
        <div className="card"><div className="empty">Нет заправок</div></div>
      )}

      {mode === "months" && months.length > 0 && (
        <>
          <div className="section-title">Средний расход по месяцам</div>
          <div className="card chart-card">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={months} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="key" ticks={monthsAxis.ticks} tickFormatter={monthsAxis.format} {...axisProps} interval={0} />
                <YAxis domain={[0, "dataMax + 0.5"]} {...axisProps} width={44} tickFormatter={(v) => v.toFixed(1)} />
                <Tooltip
                  cursor={{ fill: c.grid, opacity: 0.35 }}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: c.axis }}
                  labelFormatter={(key) => monthLabel(`${key}-01`)}
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
                <XAxis dataKey="key" ticks={monthsAxis.ticks} tickFormatter={monthsAxis.format} {...axisProps} interval={0} />
                <YAxis {...axisProps} width={50} tickFormatter={(v) => Math.round(v)} />
                <Tooltip
                  cursor={{ fill: c.grid, opacity: 0.35 }}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: c.axis }}
                  labelFormatter={(key) => monthLabel(`${key}-01`)}
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

      {/* ---------- затраты ---------- */}

      {mode === "costs" && totalCosts === 0 && (
        <div className="card"><div className="empty">Нет данных о расходах</div></div>
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

          {/* ---------- ежемесячные затраты ---------- */}

          <div className="card chart-card" style={{ marginTop: 10 }}>
            <div className="analytic__head">
              <div className="hero__label">Ежемесячные затраты</div>
              <div className="analytic__period">{monthlyPeriodText}</div>
            </div>
            <div className="analytic__value">
              В среднем в мес.:
              <b>{fmtMoney(monthly.avgPerMonth)}</b>
            </div>
            {monthly.months.length === 0 ? (
              <div className="analytic__empty">Нет расходов</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthly.months} margin={{ top: 10, right: 14, left: -12, bottom: 0 }} barCategoryGap="20%">
                  <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="key" ticks={monthlyAxis.ticks} tickFormatter={monthlyAxis.format}
                    {...axisProps} interval={0}
                  />
                  <YAxis {...axisProps} width={52} tickFormatter={(v) => Math.round(v)} />
                  <Tooltip
                    cursor={{ fill: c.grid, opacity: 0.35 }}
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: c.axis }}
                    labelFormatter={(key) => monthLabel(`${key}-01`)}
                    formatter={(v) => [fmtMoney(v), "Расходы"]}
                  />
                  <Bar dataKey="total" fill={c.teal} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="chart-legend">
              <span><i className="dot" style={{ background: c.teal }} /> топливо + ТО и покупки, €</span>
              <span>всего {fmtMoney(monthly.total, 0)}</span>
            </div>
          </div>
        </>
      )}

      {/* ---------- аналитика («Пробег»): только в режиме «Обзор» ---------- */}

      {mode === "consumption" && (
        <>
          <div className="section-title">Аналитика</div>
          <div className="card chart-card">
            <div className="analytic__head">
              <div className="hero__label">Пробег</div>
              <div className="analytic__period">{periodText}</div>
            </div>
            <div className="analytic__value">
              В среднем в сутки:
              <b>{kmPerDay === null ? "—" : `${fmtKm(kmPerDay)} км`}</b>
            </div>
            {mileage.length === 0 ? (
              <div className="analytic__empty">Нет записей с пробегом за период</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={mileage} margin={{ top: 10, right: 14, left: -6, bottom: 0 }}>
                  <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="ts" type="number" domain={mileageAxis.domain}
                    ticks={mileageAxis.ticks} tickFormatter={mileageAxis.format}
                    {...axisProps} minTickGap={12}
                  />
                  <YAxis
                    domain={mileageAxis.y.domain} ticks={mileageAxis.y.ticks}
                    {...axisProps} width={62} tickFormatter={kmTick}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: c.axis }}
                    labelFormatter={(ts) => fmtDate(tsToISO(ts))}
                    formatter={(v) => [`${fmtKm(v)} км`, "Пробег"]}
                  />
                  <Line
                    type="monotone" dataKey="km" stroke={c.teal} strokeWidth={2.4}
                    dot={mileage.length <= 40 ? { r: 2.4, fill: c.teal, strokeWidth: 0 } : false}
                    activeDot={{ r: 5 }} isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
            <div className="chart-legend">
              <span><i className="dot" style={{ background: c.teal }} /> одометр, км · заправки и ТО</span>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
