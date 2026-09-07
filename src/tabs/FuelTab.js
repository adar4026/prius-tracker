import React, { useMemo, useState } from "react";
import Modal from "../components/Modal";
import {
  byDateDesc, byKmAsc, calcConsumption, fmtDate, fmtKm, fmtMoney, fmtNum,
  isFull, nextId, num, recalcFrom, todayISO,
} from "../utils";

const emptyForm = () => ({
  date: todayISO(),
  km: "",
  liters: "",
  pricePerL: "",
  grossTotal: "",
  discount: "",
  paidTotal: "",
  station: "",
  fullTank: true,
  note: "",
});

const toForm = (e) => ({
  date: e.date,
  km: String(e.km),
  liters: String(e.liters),
  pricePerL: String(e.pricePerL),
  grossTotal: e.grossTotal.toFixed(2),
  discount: e.discount ? e.discount.toFixed(2) : "",
  paidTotal: e.paidTotal.toFixed(2),
  station: e.station || "",
  fullTank: isFull(e),
  note: e.note || "",
});

export default function FuelTab({ fuel, setFuel }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // редактируемая запись или null
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");

  const sorted = useMemo(() => [...fuel].sort(byDateDesc), [fuel]);
  const lastKm = useMemo(
    () => (fuel.length ? [...fuel].sort(byKmAsc)[fuel.length - 1].km : 0),
    [fuel]
  );

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setOpen(true);
  };

  const openEdit = (entry) => {
    setEditing(entry);
    setForm(toForm(entry));
    setError("");
    setOpen(true);
  };

  /**
   * Связи полей:
   *   литры × цена = сумма до скидки
   *   оплачено     = сумма до скидки − скидка
   * Ручная правка оплаченной суммы меняет только скидку — литры не трогаем.
   */
  const setField = (name, value) => {
    setForm((f) => {
      const next = { ...f, [name]: value };
      const liters = num(next.liters);
      const price = num(next.pricePerL);

      if (name === "liters" || name === "pricePerL") {
        if (liters > 0 && price > 0) next.grossTotal = (liters * price).toFixed(2);
      }

      const gross = num(next.grossTotal);

      if (name === "liters" || name === "pricePerL" || name === "grossTotal" || name === "discount") {
        if (gross > 0) next.paidTotal = Math.max(0, gross - num(next.discount)).toFixed(2);
      } else if (name === "paidTotal") {
        if (gross > 0) {
          const diff = gross - num(next.paidTotal);
          next.discount = diff > 0 ? diff.toFixed(2) : "0.00";
        }
      }

      return next;
    });
  };

  const preview = useMemo(() => {
    const km = Math.round(num(form.km));
    const liters = num(form.liters);
    if (!km || !liters) return null;
    const others = editing ? fuel.filter((f) => f.id !== editing.id) : fuel;
    return calcConsumption(others, { id: editing?.id, km, liters, fullTank: form.fullTank });
  }, [form, fuel, editing]);

  const submit = (e) => {
    e.preventDefault();
    const km = Math.round(num(form.km));
    const liters = num(form.liters);
    const pricePerL = num(form.pricePerL);
    const grossTotal = num(form.grossTotal) || +(liters * pricePerL).toFixed(2);
    const discount = num(form.discount);
    const paidTotal = form.paidTotal !== "" ? num(form.paidTotal) : +(grossTotal - discount).toFixed(2);

    if (!form.date) return setError("Укажите дату");
    if (!km) return setError("Укажите пробег");
    if (!liters) return setError("Укажите количество литров");
    if (discount < 0) return setError("Скидка не может быть отрицательной");
    if (discount > grossTotal) return setError("Скидка больше суммы до скидки");
    if (fuel.some((f) => f.km === km && f.id !== editing?.id))
      return setError("Заправка с таким пробегом уже есть");

    const entry = {
      id: editing ? editing.id : nextId(fuel),
      date: form.date,
      km,
      liters,
      pricePerL: pricePerL || (liters ? +(grossTotal / liters).toFixed(3) : 0),
      grossTotal,
      discount,
      paidTotal,
      station: form.station.trim(),
      fullTank: form.fullTank,
      note: form.note.trim(),
      consumption: null,
    };

    // после правки пересчитываем все последующие топливные циклы
    const rest = editing ? fuel.filter((f) => f.id !== editing.id) : fuel;
    const fromKm = editing ? Math.min(editing.km, km) : km;
    setFuel(recalcFrom([...rest, entry], fromKm));
    setOpen(false);
  };

  const remove = (entry) => {
    if (!window.confirm(`Удалить заправку от ${fmtDate(entry.date)} (${fmtKm(entry.km)} км)?`)) return;
    setFuel(recalcFrom(fuel.filter((f) => f.id !== entry.id), entry.km));
  };

  return (
    <main className="screen">
      <button className="btn" onClick={openAdd}>+ Добавить заправку</button>

      <div className="section-title">Все заправки · {fuel.length}</div>

      {!sorted.length && <div className="empty">Пока нет ни одной заправки</div>}

      {sorted.map((f) => (
        <div key={f.id} className="item">
          <div className="row">
            <div className="row__main">
              <div className="row__title">
                {fmtDate(f.date)}{" "}
                {!isFull(f) && (
                  <span className="badge" style={{ color: "var(--gold)" }}>не до полного</span>
                )}
              </div>
              <div className="row__sub">
                {fmtKm(f.km)} км • {fmtNum(f.liters, 2)} л • {fmtNum(f.pricePerL, 3)} €/л
              </div>
              {f.discount > 0 && (
                <div className="row__sub">
                  <s>{fmtMoney(f.grossTotal)}</s>{" "}
                  <span style={{ color: "var(--green)" }}>скидка −{fmtMoney(f.discount)}</span>
                </div>
              )}
              {f.station && <div className="row__sub">📍 {f.station}</div>}
              {f.note && <div className="row__sub">📝 {f.note}</div>}
            </div>
            <div className="row__right">
              <div className="row__value">{fmtMoney(f.paidTotal)}</div>
              <div
                className="row__sub"
                style={{ color: f.consumption ? "var(--green)" : "var(--muted)" }}
              >
                {f.consumption ? `${fmtNum(f.consumption, 2)} л/100 км` : "—"}
              </div>
              <div className="row__actions">
                <button className="icon-btn" onClick={() => openEdit(f)} aria-label="Изменить">✏️</button>
                <button className="icon-btn" onClick={() => remove(f)} aria-label="Удалить">🗑</button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {open && (
        <Modal
          title={editing ? "Изменить заправку" : "Новая заправка"}
          onClose={() => setOpen(false)}
        >
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

            <div className="form-row">
              <div className="field">
                <label>Сумма до скидки, €</label>
                <input
                  type="number" step="0.01" inputMode="decimal" placeholder="60,00"
                  value={form.grossTotal} onChange={(e) => setField("grossTotal", e.target.value)}
                />
              </div>
              <div className="field">
                <label>Скидка, €</label>
                <input
                  type="number" step="0.01" inputMode="decimal" placeholder="0,00"
                  value={form.discount} onChange={(e) => setField("discount", e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label>Оплачено, €</label>
              <input
                type="number" step="0.01" inputMode="decimal" placeholder="60,00"
                value={form.paidTotal} onChange={(e) => setField("paidTotal", e.target.value)}
              />
            </div>

            <div className="field">
              <label>АЗС</label>
              <input
                type="text" placeholder="Repsol, Овьедо"
                value={form.station} onChange={(e) => setField("station", e.target.value)}
              />
            </div>

            <div className="switch-row">
              <span>Полный бак</span>
              <button
                type="button"
                role="switch"
                aria-checked={form.fullTank}
                className={`switch ${form.fullTank ? "switch--on" : ""}`}
                onClick={() => setField("fullTank", !form.fullTank)}
              >
                <span className="switch__knob" />
              </button>
            </div>

            <div className="field">
              <label>Примечание</label>
              <textarea
                rows={2} placeholder="Что-нибудь важное про эту заправку"
                value={form.note} onChange={(e) => setField("note", e.target.value)}
              />
            </div>

            <div className="hint">
              {!form.fullTank
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
