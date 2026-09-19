import React, { useCallback, useEffect, useRef } from "react";
import { ChartIcon, ClipboardCheckIcon, FuelIcon, HomeIcon, WrenchIcon } from "./Icons";

const ICONS = {
  home: HomeIcon,
  fuel: FuelIcon,
  charts: ChartIcon,
  service: WrenchIcon,
  reminders: ClipboardCheckIcon,
};

// внутренний отступ капсулы (см. .nav__inner padding / .nav__pill left/top)
const PAD = 7;
// горизонтальный сдвиг, после которого жест считается drag, а не tap/scroll
const DRAG_THRESHOLD = 8;
// длительность пружинного «прилипания» — должна совпадать с .nav__pill--snap
const SNAP_MS = 380;
// максимальное растяжение pill в сторону движения
const STRETCH_MAX = 0.05;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Плавающая нижняя панель-«капсула». Подложка активного пункта — один
 * элемент, который переезжает между равными колонками через transform,
 * поэтому переход анимируется без измерения DOM.
 *
 * Поверх этого — экспериментальный drag: палец тянет pill по оси X, при
 * отпускании она пружинно прилипает к ближайшей вкладке и только тогда
 * вызывается onChange. Во время drag pill получает состояние «живого стекла»:
 * блик под пальцем (--glint-x/--glint-y), подсветка переднего края
 * (--drag-dir/--drag-v) и лёгкое растяжение. Всё — CSS-имитация, реального
 * преломления контента под стеклом здесь нет.
 */
export default function BottomNav({ tabs, active, onChange, badges = {} }) {
  const index = tabs.findIndex((t) => t.id === active);
  const innerRef = useRef(null);
  const pillRef = useRef(null);
  // всё состояние жеста — в ref, чтобы не перерисовывать React на каждый pointermove
  const g = useRef({
    id: null, // pointerId активного жеста
    dragging: false,
    live: false, // pill в состоянии «живого стекла» (удержание или drag)
    moved: false, // был ли drag — чтобы подавить click после отпускания
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    left: 0, // геометрия капсулы, измеренная один раз на pointerdown
    top: 0,
    pillW: 0,
    pillH: 0,
    maxX: 0,
    baseX: 0, // положение pill в px на момент начала жеста
    x: 0, // текущее положение pill в px
    v: 0, // сглаженная скорость 0..1
    dir: 1, // направление движения: 1 — вправо, -1 — влево
    nearest: -1, // вкладка, к которой сейчас ближе всего pill
    raf: 0,
    snapTimer: 0,
    movedTimer: 0,
    reduceMotion: false,
  });

  const indexRef = useRef(index);
  indexRef.current = index;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const countRef = useRef(tabs.length);
  countRef.current = tabs.length;

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return undefined;
    const apply = () => { g.current.reduceMotion = mq.matches; };
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  const setPreview = useCallback((i) => {
    const s = g.current;
    if (s.nearest === i) return;
    const items = innerRef.current?.querySelectorAll(".nav__item");
    if (items) {
      if (s.nearest >= 0) items[s.nearest]?.classList.remove("nav__item--preview");
      if (i >= 0 && i !== indexRef.current) items[i]?.classList.add("nav__item--preview");
    }
    s.nearest = i;
  }, []);

  // применяем накопленное положение пальца одним кадром
  const frame = useCallback(() => {
    const s = g.current;
    s.raf = 0;
    const pill = pillRef.current;
    if (!pill) return;
    if (s.dragging) {
      const prev = s.x;
      s.x = clamp(s.baseX + (s.lastX - s.startX), 0, s.maxX);
      const delta = s.x - prev;
      if (Math.abs(delta) > 0.5) s.dir = delta > 0 ? 1 : -1;
      // скорость сглаживаем, чтобы подсветка края не мигала
      const inst = clamp(Math.abs(delta) / 14, 0, 1);
      s.v = s.v * 0.7 + inst * 0.3;
      const stretch = s.reduceMotion ? 1 : 1 + STRETCH_MAX * s.v;
      pill.style.transform = `translate3d(${s.x}px, 0, 0) scaleX(${stretch.toFixed(4)})`;
      pill.style.setProperty("--drag-dir", String(s.dir));
      pill.style.setProperty("--drag-v", s.v.toFixed(3));
      setPreview(Math.round(s.x / s.pillW));
    }
    if (s.live) {
      // блик — под пальцем, в координатах pill
      const gx = clamp(s.lastX - s.left - PAD - s.x, 0, s.pillW);
      const gy = clamp(s.lastY - s.top - PAD, 0, s.pillH);
      pill.style.setProperty("--glint-x", `${gx.toFixed(1)}px`);
      pill.style.setProperty("--glint-y", `${gy.toFixed(1)}px`);
    }
  }, [setPreview]);

  const schedule = useCallback(() => {
    const s = g.current;
    if (!s.raf) s.raf = requestAnimationFrame(frame);
  }, [frame]);

  // завершение жеста: пружиной к target (в px), затем отдать управление CSS
  const settle = useCallback((target) => {
    const s = g.current;
    const inner = innerRef.current;
    const pill = pillRef.current;
    if (s.raf) { cancelAnimationFrame(s.raf); s.raf = 0; }
    setPreview(-1);
    s.id = null;
    s.live = false;
    // click после drag (если браузер его вообще пошлёт) приходит сразу за pointerup;
    // после этого guard снимаем, чтобы не съесть следующий Enter/клик с клавиатуры
    clearTimeout(s.movedTimer);
    s.movedTimer = setTimeout(() => { s.moved = false; }, 400);
    inner?.classList.remove("nav__inner--dragging");
    pill?.classList.remove("nav__pill--live");
    if (!pill) return;
    pill.style.removeProperty("--glint-x");
    pill.style.removeProperty("--glint-y");
    if (!s.dragging) {
      // без drag pill не двигалась — просто снимаем блик
      pill.style.removeProperty("--drag-v");
      return;
    }
    s.dragging = false;
    pill.classList.add("nav__pill--snap");
    pill.style.setProperty("--drag-v", "0");
    // принудительный reflow, чтобы transition стартовала с текущего px-положения
    void pill.offsetWidth;
    pill.style.transform = `translate3d(${target * s.pillW}px, 0, 0)`;
    clearTimeout(s.snapTimer);
    s.snapTimer = setTimeout(() => {
      // к этому моменту --nav-index уже указывает на target: CSS-значение
      // совпадает с inline, убираем inline без визуального скачка
      pill.classList.remove("nav__pill--snap");
      pill.style.removeProperty("transform");
      pill.style.removeProperty("--drag-dir");
      pill.style.removeProperty("--drag-v");
    }, s.reduceMotion ? 200 : SNAP_MS);
  }, [setPreview]);

  const onPointerDown = useCallback((e) => {
    const s = g.current;
    if (s.id !== null || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    const inner = innerRef.current;
    if (!inner || indexRef.current < 0) return;
    clearTimeout(s.snapTimer);
    const r = inner.getBoundingClientRect();
    const count = countRef.current;
    s.left = r.left;
    s.top = r.top;
    s.pillW = (r.width - PAD * 2) / count;
    s.pillH = r.height - PAD * 2;
    s.maxX = s.pillW * (count - 1);
    s.baseX = indexRef.current * s.pillW;
    s.x = s.baseX;
    s.startX = s.lastX = e.clientX;
    s.startY = s.lastY = e.clientY;
    s.moved = false;
    s.dragging = false;
    s.v = 0;
    s.id = e.pointerId;
    // удержание прямо на pill сразу «оживляет» стекло; drag — из любой точки панели
    const inPill = e.clientX >= r.left + PAD + s.x && e.clientX <= r.left + PAD + s.x + s.pillW;
    if (inPill && !s.reduceMotion) {
      s.live = true;
      pillRef.current?.classList.add("nav__pill--live");
      schedule();
    }
    try { inner.setPointerCapture(e.pointerId); } catch (_) { /* старый WebKit */ }
  }, [schedule]);

  const onPointerMove = useCallback((e) => {
    const s = g.current;
    if (e.pointerId !== s.id) return;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    if (!s.dragging) {
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      if (Math.abs(dx) < DRAG_THRESHOLD) { if (s.live) schedule(); return; }
      // вертикальное движение — это scroll, его отдаёт браузер (touch-action: pan-y)
      if (Math.abs(dy) > Math.abs(dx)) return;
      s.dragging = true;
      s.moved = true;
      // порог не должен давать рывок: сдвигаем начало ровно на порог, а не в
      // текущую точку — иначе быстрый flick теряет путь, пройденный в этом же событии
      s.startX += Math.sign(dx) * DRAG_THRESHOLD;
      s.live = !s.reduceMotion;
      innerRef.current?.classList.add("nav__inner--dragging");
      if (s.live) pillRef.current?.classList.add("nav__pill--live");
      pillRef.current?.classList.remove("nav__pill--snap");
    }
    schedule();
  }, [schedule]);

  const onPointerUp = useCallback((e) => {
    const s = g.current;
    if (e.pointerId !== s.id) return;
    const wasDragging = s.dragging;
    // финальное положение — по последней точке, без ожидания кадра
    if (wasDragging) s.x = clamp(s.baseX + (s.lastX - s.startX), 0, s.maxX);
    const target = wasDragging ? Math.round(s.x / s.pillW) : indexRef.current;
    settle(target);
    if (wasDragging && target !== indexRef.current) onChangeRef.current(tabs[target].id);
  }, [settle, tabs]);

  const onPointerCancel = useCallback((e) => {
    const s = g.current;
    if (e.pointerId !== s.id) return;
    settle(indexRef.current); // возврат на текущую вкладку, маршрут не трогаем
  }, [settle]);

  useEffect(() => () => {
    const s = g.current;
    if (s.raf) cancelAnimationFrame(s.raf);
    clearTimeout(s.snapTimer);
    clearTimeout(s.movedTimer);
  }, []);

  return (
    <nav className="nav" aria-label="Разделы">
      <div
        ref={innerRef}
        className="nav__inner"
        style={{ "--nav-count": tabs.length, "--nav-index": index }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {index >= 0 && <span ref={pillRef} className="nav__pill" aria-hidden="true" />}
        {tabs.map((t) => {
          const Icon = ICONS[t.id];
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`nav__item ${isActive ? "nav__item--active" : ""}`}
              onClick={() => {
                // click после drag приходит уже после onChange из pointerup — глотаем
                if (g.current.moved) { g.current.moved = false; return; }
                onChange(t.id);
              }}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="nav__icon">
                {Icon ? <Icon size={22} /> : t.icon}
                {badges[t.id] > 0 && <span className="nav__badge">{badges[t.id]}</span>}
              </span>
              <span className="nav__label">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
