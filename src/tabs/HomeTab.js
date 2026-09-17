import React from "react";
import { lastOilChange } from "../vehicle";
import { activeOilReminder } from "../serviceReminder";
import {
  avg, byDateDesc, consumptionPoints, fmtDate, fmtKm, fmtMoney, fmtNum,
  kmLeftLabel, nearestDueLabel, num, reminderStatus, reminderUrgency,
} from "../utils";

export default function HomeTab({
  fuel, service, reminders, currentKm, vehicle, photoUrl, onGo, onOpenVehicle,
}) {
  const points = consumptionPoints(fuel);
  const avgConsumption = avg(points.map((p) => p.consumption));
  const avgPrice = avg(fuel.map((f) => num(f.pricePerL)).filter((p) => p > 0));

  const oil = lastOilChange(service);
  // прогресс ведём от dueKm актуальной задачи следующей замены (в первую
  // очередь созданной из последней замены) — без собственного интервала
  const oilReminder = activeOilReminder(reminders, service);
  const dueKm = oilReminder?.dueKm ?? null;
  // текущий пробег может быть ниже пробега свежей записи ТО — тогда 0, не минус
  const driven = oil ? Math.max(0, currentKm - oil.km) : 0;
  const totalSpan = oil && dueKm !== null ? dueKm - oil.km : null;
  const pct = totalSpan ? Math.min(100, Math.max(0, Math.round((driven / totalSpan) * 100))) : 0;
  const oilLeft = dueKm !== null ? kmLeftLabel({ dueKm, completed: false }, currentKm) : null;
  const oilColor = !oilLeft ? "var(--muted)" : oilLeft.overdue ? "var(--red)" : dueKm - currentKm < 1500 ? "var(--gold)" : "var(--green)";

  // ближайшее обслуживание: только активные задачи со сроком, самые срочные сверху
  const tasks = reminders
    .filter((r) => !r.completed && reminderUrgency(r, currentKm) !== null)
    .sort((a, b) => reminderUrgency(a, currentKm) - reminderUrgency(b, currentKm))
    .slice(0, 3);

  const recent = [...fuel].sort(byDateDesc).slice(0, 3);
  const lastFill = recent[0];
  // откуда взят текущий пробег: заправка или запись ТО с максимальным показанием
  const kmFromFuel = fuel.find((f) => f.km === currentKm);
  const kmFromService = kmFromFuel ? null : service.find((s) => s.km === currentKm);

  return (
    <main className="screen screen--home">
      {/* hero Главной: без карточки — пробег и два показателя лежат прямо на fluid-фоне */}
      <section className="home-hero">
        <div className="home-hero__label">Текущий пробег</div>
        <div className="home-hero__value">
          {fmtKm(currentKm)} <span className="home-hero__unit">км</span>
        </div>
        <div className="home-hero__note">
          {kmFromFuel
            ? `Последняя заправка: ${fmtDate(kmFromFuel.date)}`
            : kmFromService
              ? `Последняя запись ТО: ${fmtDate(kmFromService.date)}`
              : lastFill
                ? `Последняя заправка: ${fmtDate(lastFill.date)}`
                : "Нет данных о пробеге"}
        </div>
        <div className="home-hero__stats">
          <div className="home-hero__stat">
            <div className="home-hero__stat-label"><span aria-hidden="true">⛽</span>Средний расход</div>
            <div className="home-hero__stat-value" style={{ color: "var(--green)" }}>
              {fmtNum(avgConsumption, 2)}<span className="home-hero__stat-unit">л/100 км</span>
            </div>
          </div>
          <div className="home-hero__stat">
            <div className="home-hero__stat-label"><span aria-hidden="true">💶</span>Средняя цена</div>
            <div className="home-hero__stat-value" style={{ color: "var(--blue)" }}>
              {fmtNum(avgPrice, 3)}<span className="home-hero__stat-unit">€/л</span>
            </div>
          </div>
        </div>
      </section>

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
          <div className="section-title">Ближайшее обслуживание</div>
          {tasks.map((t) => {
            const isOverdue = reminderStatus(t, currentKm) === "overdue";
            const left = nearestDueLabel(t, currentKm);
            return (
              <div
                key={t.id}
                className={`item item--card reminder ${isOverdue ? "item--overdue" : ""}`}
                onClick={() => onGo("reminders")}
              >
                <span className="reminder__icon">{t.icon}</span>
                <div className="row__main">
                  <div className="row__title">{t.title}</div>
                  <div className="row__sub">
                    {t.dueKm ? `${fmtKm(t.dueKm)} км` : ""}
                    {t.dueKm && t.dueDate ? " • " : ""}
                    {t.dueDate ? fmtDate(t.dueDate) : ""}
                  </div>
                </div>
                {left && (
                  <div className="row__right">
                    <div
                      className="row__value row__value--small"
                      style={{ color: left.overdue ? "var(--red)" : "var(--gold)" }}
                    >
                      {left.text}
                    </div>
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
            <div key={f.id} className="item item--card" onClick={() => onGo("fuel")}>
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
      <button type="button" className="card car-card" onClick={onOpenVehicle}>
        <span className="car-card__icon" aria-hidden="true">
          {photoUrl ? <img src={photoUrl} alt="" className="car-card__photo" /> : "🚗"}
        </span>
        <span className="car-card__main">
          <span className="row__title">{vehicle.name}</span>
          <span className="row__sub">{vehicle.year} · {vehicle.fuelType}</span>
        </span>
        <span className="car-card__chevron">›</span>
      </button>
    </main>
  );
}
