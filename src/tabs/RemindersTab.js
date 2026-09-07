import React from "react";
import { fmtDate, fmtKm } from "../utils";

const GROUPS = [
  { id: "overdue",  title: "Просрочено",        color: "var(--red)" },
  { id: "upcoming", title: "Запланировано",     color: "var(--gold)" },
  { id: "pending",  title: "Ожидают установки", color: "var(--blue)" },
  { id: "info",     title: "Информация",        color: "var(--muted)" },
];

const effectivePriority = (r, currentKm) =>
  r.dueKm && currentKm >= r.dueKm ? "overdue" : r.priority;

export default function RemindersTab({ reminders, currentKm }) {
  return (
    <main className="screen">
      {GROUPS.map((g) => {
        const items = reminders.filter((r) => effectivePriority(r, currentKm) === g.id);
        if (!items.length) return null;

        return (
          <section key={g.id}>
            <div className="section-title" style={{ color: g.color }}>
              {g.title} · {items.length}
            </div>

            {items.map((r) => {
              const overdue = g.id === "overdue";
              const kmLeft = r.dueKm ? r.dueKm - currentKm : null;
              return (
                <div key={r.id} className={`item reminder ${overdue ? "item--overdue" : ""}`}>
                  <span className="reminder__icon">{r.icon}</span>
                  <div className="row__main">
                    <div className="row__title">{r.title}</div>
                    <div className="row__sub">{r.note}</div>
                    {(r.dueKm || r.dueDate) && (
                      <div className="row__sub" style={{ marginTop: 5 }}>
                        {r.dueKm && <>🎯 {fmtKm(r.dueKm)} км</>}
                        {r.dueKm && r.dueDate && " • "}
                        {r.dueDate && <>📅 {fmtDate(r.dueDate)}</>}
                      </div>
                    )}
                  </div>
                  {kmLeft !== null && (
                    <div className="row__right">
                      <div
                        className="row__value row__value--small"
                        style={{ color: kmLeft <= 0 ? "var(--red)" : "var(--muted)" }}
                      >
                        {kmLeft > 0 ? `+${fmtKm(kmLeft)}` : fmtKm(kmLeft)}
                      </div>
                      <div className="row__sub">км</div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}

      <div className="hint" style={{ padding: "10px 2px 0" }}>
        Текущий пробег: {fmtKm(currentKm)} км
      </div>
    </main>
  );
}
