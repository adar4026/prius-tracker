import React from "react";
import DateField from "./DateField";
import { fmtDate, fmtKm } from "../utils";

// Быстрые интервалы. Намеренно не привязаны к виду работ: интервал
// выбирает пользователь, приложение ничего не подставляет само.
export const KM_PRESETS = [5000, 10000, 15000, 20000, 30000];
export const MONTH_PRESETS = [6, 12, 24, 36];

/**
 * Блок «Следующая замена» в форме ТО.
 * Интервал пересчитывает целевые значения, но вручную исправленное
 * значение больше не перезаписывается (см. nextKmTouched / nextDateTouched).
 */
export default function NextServiceFields({ form, setField, linkedDone }) {
  return (
    <>
      <div className="switch-row">
        <span>Запланировать следующую замену</span>
        <button
          type="button"
          role="switch"
          aria-checked={form.planNext}
          className={`switch ${form.planNext ? "switch--on" : ""}`}
          onClick={() => setField("planNext", !form.planNext)}
        >
          <span className="switch__knob" />
        </button>
      </div>

      {form.planNext && (
        <>
          <div className="field">
            <label>Через, км</label>
            <div className="chip-row">
              {KM_PRESETS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`chip ${Number(form.intervalKm) === v ? "chip--active" : ""}`}
                  onClick={() => setField("intervalKm", String(v))}
                >
                  {fmtKm(v)}
                </button>
              ))}
              <button
                type="button"
                className={`chip ${form.intervalKm && !KM_PRESETS.includes(Number(form.intervalKm)) ? "chip--active" : ""}`}
                onClick={() => setField("intervalKm", "")}
              >
                свой
              </button>
            </div>
            <input
              type="number" inputMode="numeric" placeholder="например 15000"
              value={form.intervalKm}
              onChange={(e) => setField("intervalKm", e.target.value)}
            />
          </div>

          <div className="field">
            <label>Через, месяцев</label>
            <div className="chip-row">
              {MONTH_PRESETS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`chip ${Number(form.intervalMonths) === v ? "chip--active" : ""}`}
                  onClick={() => setField("intervalMonths", String(v))}
                >
                  {v} мес
                </button>
              ))}
              <button
                type="button"
                className={`chip ${form.intervalMonths && !MONTH_PRESETS.includes(Number(form.intervalMonths)) ? "chip--active" : ""}`}
                onClick={() => setField("intervalMonths", "")}
              >
                свой
              </button>
            </div>
            <input
              type="number" inputMode="numeric" placeholder="например 12"
              value={form.intervalMonths}
              onChange={(e) => setField("intervalMonths", e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="field">
              <label>Следующий пробег</label>
              <input
                type="number" inputMode="numeric" placeholder="не важно"
                value={form.nextKm}
                onChange={(e) => setField("nextKm", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Следующая дата</label>
              <DateField
                label="Следующая дата"
                value={form.nextDate}
                onChange={(v) => setField("nextDate", v)}
              />
            </div>
          </div>

          <div className="hint">
            {form.nextKm || form.nextDate ? (
              <>
                Задача: {form.nextKm ? `${fmtKm(Number(form.nextKm))} км` : ""}
                {form.nextKm && form.nextDate ? " • " : ""}
                {form.nextDate ? fmtDate(form.nextDate) : ""}. Рассчитанные значения
                можно исправить вручную.
              </>
            ) : (
              "Укажите интервал или задайте следующий пробег и дату вручную."
            )}
          </div>
        </>
      )}

      {!form.planNext && linkedDone === false && (
        <div className="hint" style={{ color: "var(--gold)" }}>
          Связанная задача будет удалена при сохранении.
        </div>
      )}
    </>
  );
}
