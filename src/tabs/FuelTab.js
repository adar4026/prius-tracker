import React, { useMemo, useState } from "react";
import Modal from "../components/Modal";
import {
  PARTIAL_NOTE, byDateDesc, byKmAsc, calcConsumption, fmtDate, fmtKm,
  fmtMoney, fmtNum, isPartial, nextId, num,
} from "../utils";

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (lastKm) => ({
  date: today(),
  km: lastKm ? String(lastKm) : "",
  liters: "",
  pricePerL: "",
  total: "",
  station: "",
  partial: false,
});

export default function FuelTab({ fuel, setFuel }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm(""));
  const [error, setError] = useState("");

  const sorted = useMemo(() => [...fuel].sort(byDateDesc), [fuel]);
  const lastKm = useMemo(
    () => (fuel.length ? [...fuel].sort(byKmAsc)[fuel.length - 1].km : 0),
    [fuel]
  );

  const openForm = () => {
    setForm(emptyForm(""));
    setError("");
    setOpen(true);
  };

  // Литры / цена / итого связаны: меняем одно — пересчитываем зависимое
  const setField = (name, value) => {
    setForm((f) => {
      const next = { ...f, [name]: value };
      const l = num(next.liters), p = num(next.pricePerL), t = num(next.total);
      if ((name === "liters" || name === "pricePerL") && l > 0 && p > 0) {
        next.total = (l * p).toFixed(2);
      } else if (name === "total" && t > 0 && p > 0) {
        next.liters = (t / p).toFixed(3);
      }
      return next;
    });
  };

  const preview = useMemo(() => {
    const km = num(form.km), liters = num(form.liters);
    if (!km || !liters) return null;
    return calcConsumption(fuel, {
      km, liters, note: form.partial ? PARTIAL_NOTE : "",
    });
  }, [form, fuel]);

  const submit = (e) => {
    e.preventDefault();
    const km = Math.round(num(form.km));
    const liters = num(form.liters);
    const pricePerL = num(form.pricePerL);
    const total = num(form.total) || liters * pricePerL;

    if (!form.date) return setError("Укажите дату");
    if (!km) return setError("Укажите пробег");
    if (!liters) return setError("Укажите количество литров");
    if (fuel.some((f) => f.km === km)) return setError("Заправка с таким пробегом уже есть");

    const entry = {
      id: nextId(fuel),
      date: form.date,
      km,
      liters,
      pricePerL: pricePerL || (liters ? total / liters : 0),
      total,
      station: form.station.trim(),
      consumption: null,
    };
    if (form.partial) entry.note = PARTIAL_NOTE;
    entry.consumption = calcConsumption(fuel, entry);

    setFuel([...fuel, entry]);
    setOpen(false);
  };

  const remove = (id) => {
    const item = fuel.find((f) => f.id === id);
    if (window.confirm(`Удалить заправку от ${fmtDate(item.date)}?`)) {
      setFuel(fuel.filter((f) => f.id !== id));
    }
  };

  return (
    <main className="screen">
      <button className="btn" onClick={openForm}>+ Добавить заправку</button>

      <div className="section-title">Все заправки · {fuel.length}</div>

      {!sorted.length && <div className="empty">Пока нет ни одной заправки</div>}

      {sorted.map((f) => (
        <div key={f.id} className="item">
          <div className="row">
            <div className="row__main">
              <div className="row__title">
                {fmtDate(f.date)}{" "}
                {isPartial(f) && (
                  <span className="badge" style={{ color: "var(--gold)" }}>не до полного</span>
                )}
              </div>
              <div className="row__sub">
                {fmtKm(f.km)} км • {fmtNum(f.liters, 2)} л • {fmtNum(f.pricePerL, 3)} €/л
              </div>
              {f.station && <div className="row__sub">📍 {f.station}</div>}
            </div>
            <div className="row__right">
              <div className="row__value">{fmtMoney(f.total)}</div>
              <div
                className="row__sub"
                style={{ color: f.consumption && !isPartial(f) ? "var(--green)" : "var(--muted)" }}
              >
                {f.consumption ? `${fmtNum(f.consumption, 2)} л/100` : "—"}
              </div>
              <button className="icon-btn" onClick={() => remove(f.id)} aria-label="Удалить">🗑</button>
            </div>
          </div>
        </div>
      ))}

      {open && (
        <Modal title="Новая заправка" onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <div className="form-row">
              <div className="field">
                <label>Дата</label>
                <input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} />
              </div>
              <div className="field">
                <label>Пробег, км</label>
                <input
                  type="number" inputMode="numeric" placeholder={String(lastKm)}
                  value={form.km} onChange={(e) => setField("km", e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>Литры</label>
                <input
                  type="number" step="0.001" inputMode="decimal" placeholder="35,000"
                  value={form.liters} onChange={(e) => setField("liters", e.target.value)}
                />
              </div>
              <div className="field">
                <label>Цена, €/л</label>
                <input
                  type="number" step="0.001" inputMode="decimal" placeholder="1,800"
                  value={form.pricePerL} onChange={(e) => setField("pricePerL", e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label>Итого, €</label>
              <input
                type="number" step="0.01" inputMode="decimal" placeholder="60,00"
                value={form.total} onChange={(e) => setField("total", e.target.value)}
              />
            </div>

            <div className="field">
              <label>Станция</label>
              <input
                type="text" placeholder="Repsol, Овьедо"
                value={form.station} onChange={(e) => setField("station", e.target.value)}
              />
            </div>

            <label className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox" style={{ width: 18, height: 18 }}
                checked={form.partial}
                onChange={(e) => setField("partial", e.target.checked)}
              />
              <span style={{ color: "var(--text)", fontSize: 14 }}>Не до полного бака</span>
            </label>

            <div className="hint">
              {form.partial
                ? "Расход не считается — литры перейдут в следующую полную заправку."
                : `Расчётный расход: ${preview ? `${fmtNum(preview, 2)} л/100 км` : "—"}`}
            </div>

            {error && <div className="hint" style={{ color: "var(--red)" }}>{error}</div>}

            <div className="form-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>Отмена</button>
              <button type="submit" className="btn btn--solid">Сохранить</button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}
