import React, { useState } from "react";
import Stat from "../components/Stat";
import { CAR, OIL_INTERVAL_KM } from "../data";
import {
  avg, byDateDesc, consumptionPoints, fmtDate, fmtKm, fmtMoney, fmtNum, num,
} from "../utils";

function lastOilChange(service) {
  return service
    .filter((s) => s.category === "oil" && s.km > 0)
    .sort((a, b) => b.km - a.km)[0];
}

export default function HomeTab({ fuel, service, reminders, currentKm, onGo }) {
  const [specsOpen, setSpecsOpen] = useState(false);

  const points = consumptionPoints(fuel);
  const avgConsumption = avg(points.map((p) => p.consumption));
  const totalLiters = fuel.reduce((s, f) => s + num(f.liters), 0);
  const totalFuelCost = fuel.reduce((s, f) => s + num(f.total), 0);
  const avgPrice = totalLiters ? totalFuelCost / totalLiters : null;
  const totalService = service.reduce((s, r) => s + num(r.cost), 0);

  const oil = lastOilChange(service);
  const driven = oil ? currentKm - oil.km : 0;
  const left = OIL_INTERVAL_KM - driven;
  const pct = Math.min(100, Math.round((driven / OIL_INTERVAL_KM) * 100));
  const oilColor = left <= 0 ? "var(--red)" : left < 1500 ? "var(--gold)" : "var(--green)";

  const tasks = reminders
    .filter((r) => r.priority === "overdue" || r.priority === "upcoming" || (r.dueKm && currentKm >= r.dueKm))
    .slice(0, 4);

  const recent = [...fuel].sort(byDateDesc).slice(0, 3);
  const lastFill = recent[0];

  return (
    <main className="screen">
      <div className="card hero">
        <div className="hero__label">Текущий пробег</div>
        <div className="hero__value">
          {fmtKm(currentKm)} <span className="hero__unit">км</span>
        </div>
        <div className="hero__note">
          {lastFill ? `Последняя заправка ${fmtDate(lastFill.date)}` : "Нет данных о заправках"}
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 10 }}>
        <Stat icon="⛽" label="Средний расход" value={fmtNum(avgConsumption, 2)} unit="л/100" color="var(--green)" />
        <Stat icon="💶" label="Средняя цена" value={fmtNum(avgPrice, 3)} unit="€/л" color="var(--blue)" />
        <Stat icon="🛢" label="Топливо всего" value={fmtMoney(totalFuelCost, 0)} />
        <Stat icon="🔧" label="ТО всего" value={fmtMoney(totalService, 0)} />
      </div>

      {oil && (
        <>
          <div className="section-title">Замена масла</div>
          <div className="card">
            <div className="progress__head">
              <span className="progress__title">🔧 До замены масла</span>
              <span className="progress__pct" style={{ color: oilColor }}>{pct}%</span>
            </div>
            <div className="bar">
              <div className="bar__fill" style={{ width: `${pct}%`, background: oilColor }} />
            </div>
            <div className="progress__meta">
              <span>Заменено на {fmtKm(oil.km)} км</span>
              <span style={{ color: oilColor }}>
                {left > 0 ? `осталось ${fmtKm(left)} км` : `просрочено на ${fmtKm(-left)} км`}
              </span>
            </div>
            <div className="hint">
              Пройдено {fmtKm(driven)} км из {fmtKm(OIL_INTERVAL_KM)} • {fmtDate(oil.date)}
            </div>
          </div>
        </>
      )}

      {tasks.length > 0 && (
        <>
          <div className="section-title">Ближайшие задачи</div>
          {tasks.map((t) => {
            const isOverdue = t.priority === "overdue" || (t.dueKm && currentKm >= t.dueKm);
            return (
              <div
                key={t.id}
                className={`item reminder ${isOverdue ? "item--overdue" : ""}`}
                onClick={() => onGo("reminders")}
              >
                <span className="reminder__icon">{t.icon}</span>
                <div className="row__main">
                  <div className="row__title">{t.title}</div>
                  <div className="row__sub">{t.note}</div>
                </div>
                {t.dueKm && (
                  <div className="row__right">
                    <div className="row__value row__value--small" style={{ color: isOverdue ? "var(--red)" : "var(--muted)" }}>
                      {fmtKm(t.dueKm)}
                    </div>
                    <div className="row__sub">км</div>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {recent.length > 0 && (
        <>
          <div className="section-title">Последние заправки</div>
          {recent.map((f) => (
            <div key={f.id} className="item" onClick={() => onGo("fuel")}>
              <div className="row">
                <div className="row__main">
                  <div className="row__title">{fmtDate(f.date)}</div>
                  <div className="row__sub">
                    {fmtNum(f.liters, 2)} л • {fmtKm(f.km)} км
                    {f.station ? ` • ${f.station}` : ""}
                  </div>
                </div>
                <div className="row__right">
                  <div className="row__value">{fmtMoney(f.total)}</div>
                  <div className="row__sub" style={{ color: "var(--green)" }}>
                    {f.consumption ? `${fmtNum(f.consumption, 1)} л/100` : "—"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      <div className="section-title">Автомобиль</div>
      <div className="card">
        <div className="row" onClick={() => setSpecsOpen((v) => !v)} style={{ cursor: "pointer" }}>
          <div className="row__main">
            <div className="row__title">🚗 {CAR.model}</div>
            <div className="row__sub">{CAR.year} • {CAR.engine}</div>
          </div>
          <span className="icon-btn">{specsOpen ? "▲" : "▼"}</span>
        </div>
        {specsOpen && (
          <dl style={{ margin: "12px 0 0" }}>
            <div className="spec"><dt>VIN</dt><dd>{CAR.vin}</dd></div>
            <div className="spec"><dt>Цвет</dt><dd>{CAR.color}</dd></div>
            <div className="spec"><dt>Масло</dt><dd>{CAR.oil}</dd></div>
            <div className="spec"><dt>АКПП</dt><dd>{CAR.gearbox}</dd></div>
            <div className="spec"><dt>Антифриз</dt><dd>{CAR.coolant}</dd></div>
            <div className="spec"><dt>Шины</dt><dd>{CAR.tires}</dd></div>
          </dl>
        )}
      </div>
    </main>
  );
}
