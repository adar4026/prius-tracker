import React, { useMemo, useState } from "react";
import Modal from "../components/Modal";
import DateField from "../components/DateField";
import JournalFilter from "../components/JournalFilter";
import Stat from "../components/Stat";
import {
  avg, byDateDesc, byKmAsc, calcConsumption, entryYear, fmtDate, fmtKm, fmtMoney,
  fmtNum, fuelSearchText, isFull, matchesQuery, nextId, num, numOrNull,
  recalcFrom, todayISO, yearsOf,
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

// неизвестное значение исторической записи открывается пустым полем, а не «null»
const numField = (v, digits) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? ""
    : digits === undefined ? String(v) : v.toFixed(digits);

const toForm = (e) => ({
  date: e.date,
  km: numField(e.km),
  liters: numField(e.liters),
  pricePerL: numField(e.pricePerL),
  grossTotal: numField(e.grossTotal, 2),
  discount: e.discount ? e.discount.toFixed(2) : "",
  paidTotal: numField(e.paidTotal, 2),
  station: e.station || "",
  fullTank: isFull(e),
  note: e.note || "",
});

export default function FuelTab({ fuel, setFuel, year, onYear }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // редактируемая запись или null
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");

  const sorted = useMemo(() => [...fuel].sort(byDateDesc), [fuel]);
  const lastKm = useMemo(
    () => (fuel.length ? [...fuel].sort(byKmAsc)[fuel.length - 1].km : 0),
    [fuel]
  );

  const prevKmById = useMemo(() => {
    const map = new Map();
    const byKm = [...fuel].sort(byKmAsc);
    byKm.forEach((f, i) => { if (i > 0) map.set(f.id, byKm[i - 1].km); });
    return map;
  }, [fuel]);

  const years = useMemo(() => yearsOf(fuel), [fuel]);
  const counts = useMemo(() => {
    const map = {};
    fuel.forEach((f) => { map[entryYear(f)] = (map[entryYear(f)] || 0) + 1; });
    return map;
  }, [fuel]);
  // выбранный в другом разделе год мог не встретиться в заправках
  const activeYear = years.includes(year) ? year : "all";

  const visible = useMemo(
    () =>
      sorted.filter(
        (f) =>
          (activeYear === "all" || entryYear(f) === activeYear) &&
          matchesQuery(fuelSearchText(f), query)
      ),
    [sorted, activeYear, query]
  );
  const filtered = activeYear !== "all" || query.trim() !== "";

  // статистика следует за выбранным периодом и поиском
  const stats = useMemo(() => {
    const liters = visible.reduce((s, f) => s + num(f.liters), 0);
    const paid = visible.reduce((s, f) => s + num(f.paidTotal), 0);
    const discount = visible.reduce((s, f) => s + num(f.discount), 0);
    const prices = visible.map((f) => numOrNull(f.pricePerL)).filter((p) => p !== null && p > 0);
    const cons = visible
      .filter((f) => isFull(f) && Number.isFinite(f.consumption) && f.consumption > 0)
      .map((f) => f.consumption);
    return { liters, paid, discount, avgPrice: avg(prices), avgCons: avg(cons) };
  }, [visible]);

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
    const liters = numOrNull(form.liters);
    const pricePerL = numOrNull(form.pricePerL);
    const grossTotal =
      numOrNull(form.grossTotal) ??
      (liters !== null && pricePerL !== null ? +(liters * pricePerL).toFixed(2) : null);
    const discount = num(form.discount);
    const paidTotal =
      form.paidTotal !== ""
        ? numOrNull(form.paidTotal)
        : grossTotal !== null ? +(grossTotal - discount).toFixed(2) : null;

    if (!form.date) return setError("Укажите дату");
    if (!km) return setError("Укажите пробег");
    if (discount < 0) return setError("Скидка не может быть отрицательной");
    if (grossTotal !== null && discount > grossTotal)
      return setError("Скидка больше суммы до скидки");
    if (fuel.some((f) => f.km === km && f.id !== editing?.id))
      return setError("Заправка с таким пробегом уже есть");

    const entry = {
      id: editing ? editing.id : nextId(fuel),
      date: form.date,
      km,
      liters,
      pricePerL:
        pricePerL !== null
          ? pricePerL
          : liters && grossTotal !== null ? +(grossTotal / liters).toFixed(3) : null,
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
    <main className="screen screen--fab">
      <JournalFilter
        years={years}
        counts={counts}
        total={fuel.length}
        year={activeYear}
        onYear={onYear}
        query={query}
        onQuery={setQuery}
        placeholder="Поиск: АЗС, пробег, дата, сумма…"
      />

      {visible.length > 0 && (
        <div className="grid-2">
          <Stat icon="⛽" label="Средний расход" value={fmtNum(stats.avgCons, 2)} unit="л/100 км" color="var(--green)" />
          <Stat icon="💶" label="Средняя цена" value={fmtNum(stats.avgPrice, 3)} unit="€/л" color="var(--blue)" />
          <Stat icon="🛢" label="Литров" value={fmtNum(stats.liters, 2)} unit="л" />
          <Stat icon="💰" label="Оплачено" value={fmtMoney(stats.paid, 0)} />
        </div>
      )}
      {stats.discount > 0 && (
        <div className="hint" style={{ padding: "6px 2px 0", color: "var(--green)" }}>
          Скидок за период: {fmtMoney(stats.discount)}
        </div>
      )}

      <div className="section-title">
        {filtered ? `Показано · ${visible.length}` : `Все заправки · ${fuel.length}`}
      </div>

      {!visible.length && (
        <div className="empty">
          {fuel.length ? "Ничего не найдено" : "Пока нет ни одной заправки"}
        </div>
      )}

      {visible.map((f) => {
        const prevKm = prevKmById.get(f.id);
        const distance = prevKm !== undefined ? f.km - prevKm : null;
        return (
          <div key={f.id} className="item item--card fuel-card">
            <div className="fuel-card__head">
              <span className="fuel-card__icon" aria-hidden="true">⛽</span>
              <span className="fuel-card__title">
                <span className="fuel-card__kind">Заправка</span>
                {!isFull(f) && (
                  <span className="badge" style={{ color: "var(--gold)" }}>не до полного</span>
                )}
              </span>
              <span className="fuel-card__date">{fmtDate(f.date)}</span>
            </div>

            <div className="fuel-card__main">
              <div>
                <div className="fuel-card__label">Пробег</div>
                <div className="fuel-card__big">{fmtKm(f.km)} <small>км</small></div>
              </div>
              <div className="fuel-card__right">
                <div className="fuel-card__label">Сумма</div>
                <div className="fuel-card__big fuel-card__big--sum">{fmtMoney(f.paidTotal)}</div>
              </div>
            </div>

            <div className="fuel-card__row">
              <span>
                Расход{" "}
                <b style={{ color: f.consumption ? "var(--green)" : "var(--muted)" }}>
                  {f.consumption ? `${fmtNum(f.consumption, 2)} л/100 км` : "—"}
                </b>
              </span>
              <span className="fuel-card__right">Литры <b>{fmtNum(f.liters, 2)} л</b></span>
            </div>

            <div className="fuel-card__row fuel-card__row--foot">
              <span>Пройдено <b>{distance !== null ? `${fmtKm(distance)} км` : "—"}</b></span>
              <span className="fuel-card__right">Цена <b>{fmtNum(f.pricePerL, 3)} €/л</b></span>
            </div>

            {f.discount > 0 && (
              <div className="fuel-card__note">
                <s>{fmtMoney(f.grossTotal)}</s>{" "}
                <span style={{ color: "var(--green)" }}>скидка −{fmtMoney(f.discount)}</span>
              </div>
            )}
            {f.station && <div className="fuel-card__note">📍 {f.station}</div>}
            {f.note && <div className="fuel-card__note">📝 {f.note}</div>}

            <div className="row__actions row__actions--left">
              <button className="icon-btn" onClick={() => openEdit(f)} aria-label="Изменить">✏️</button>
              <button className="icon-btn" onClick={() => remove(f)} aria-label="Удалить">🗑</button>
            </div>
          </div>
        );
      })}

      <button className="fab" onClick={openAdd} aria-label="Добавить заправку" title="Добавить заправку">
        +
      </button>

      {open && (
        <Modal
          title={editing ? "Изменить заправку" : "Новая заправка"}
          onClose={() => setOpen(false)}
        >
          <form onSubmit={submit}>
            <div className="form-row">
              <div className="field">
                <label>Дата</label>
                <DateField label="Дата" value={form.date} onChange={(v) => setField("date", v)} />
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
              {form.liters === "" && " Литры можно оставить пустыми, если они неизвестны."}
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
