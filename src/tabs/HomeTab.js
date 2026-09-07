import React, { useState } from "react";
import Stat from "../components/Stat";
import CarModal from "../components/CarModal";
import { CAR } from "../data";
import {
  avg, byDateDesc, consumptionPoints, effectivePriority, fmtDate, fmtKm,
  fmtMoney, fmtNum, kmLeftLabel, num,
} from "../utils";

function lastOilChange(service) {
  return service
    .filter((s) => s.category === "oil" && s.km > 0)
    .sort((a, b) => b.km - a.km)[0];
}

export default function HomeTab({ fuel, service, reminders, currentKm, onGo }) {
  const [carOpen, setCarOpen] = useState(false);

  const points = consumptionPoints(fuel);
  const avgConsumption = avg(points.map((p) => p.consumption));
  const totalPaid = fuel.reduce((s, f) => s + num(f.paidTotal), 0);
  const avgPrice = avg(fuel.map((f) => num(f.pricePerL)).filter((p) => p > 0));
  const totalService = service.reduce((s, r) => s + num(r.cost), 0);

  const oil = lastOilChange(service);
  // прогресс ведём от того же dueKm, что и в задаче "Моторное масло 0W-20" —
  // без собственного фиксированного интервала
  const oilReminder = reminders.find((r) => r.title === "Моторное масло 0W-20");
  const dueKm = oilReminder?.dueKm ?? null;
  const driven = oil ? currentKm - oil.km : 0;
  const totalSpan = oil && dueKm !== null ? dueKm - oil.km : null;
  const pct = totalSpan ? Math.min(100, Math.max(0, Math.round((driven / totalSpan) * 100))) : 0;
  const oilLeft = dueKm !== null ? kmLeftLabel({ dueKm, completed: false }, currentKm) : null;
  const oilColor = !oilLeft ? "var(--muted)" : oilLeft.overdue ? "var(--red)" : dueKm - currentKm < 1500 ? "var(--gold)" : "var(--green)";

  const tasks = reminders
    .filter((r) => ["overdue", "upcoming"].includes(effectivePriority(r, currentKm)))
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
        <Stat icon="⛽" label="Средний расход" value={fmtNum(avgConsumption, 2)} unit="л/100 км" color="var(--green)" />
        <Stat icon="💶" label="Средняя цена" value={fmtNum(avgPrice, 3)} unit="€/л" color="var(--blue)" />
        <Stat icon="🛢" label="Топливо всего" value={fmtMoney(totalPaid, 0)} />
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
              {oilLeft && (
                <span style={{ color: oilColor }}>{oilLeft.text}</span>
              )}
            </div>
            <div className="hint">
              {totalSpan !== null
                ? <>Пройдено {fmtKm(driven)} км из {fmtKm(totalSpan)} • {fmtDate(oil.date)}</>
                : <>Пройдено {fmtKm(driven)} км • {fmtDate(oil.date)}</>}
            </div>
          </div>
        </>
      )}

      {tasks.length > 0 && (
        <>
          <div className="section-title">Ближайшие задачи</div>
          {tasks.map((t) => {
            const isOverdue = effectivePriority(t, currentKm) === "overdue";
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
                  <div className="row__value">{fmtMoney(f.paidTotal)}</div>
                  <div className="row__sub" style={{ color: "var(--green)" }}>
                    {f.consumption ? `${fmtNum(f.consumption, 2)} л/100 км` : "—"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      <div className="section-title">Автомобиль</div>
      <button type="button" className="card car-card" onClick={() => setCarOpen(true)}>
        <span className="car-card__icon">🚗</span>
        <span className="car-card__main">
          <span className="row__title">{CAR.model}</span>
          <span className="row__sub">{CAR.year}</span>
        </span>
        <span className="car-card__chevron">›</span>
      </button>

      {carOpen && <CarModal onClose={() => setCarOpen(false)} />}
    </main>
  );
}
