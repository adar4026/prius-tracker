import { useEffect, useRef, useState } from "react";
import { createCollapse, smoothProgress, stepCollapse, SMOOTH_TAU } from "../navCollapse";

// после этого смещения (px) шапка immersive-режима становится «стеклом»
const HEADER_SCROLLED_AT = 12;
// первый кадр сглаживания — без известного dt
const FRAME_MS = 1000 / 60;

// блокировку прокрутки фона (шторка, поиск) делают через body position:fixed —
// scrollY при этом прыгает в 0 и обратно, это не жест пользователя
const scrollLocked = () => document.body.style.position === "fixed";
const maxScroll = () =>
  Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

/**
 * Единственный обработчик прокрутки окна для «хрома» приложения.
 *
 * - возвращает scrolled для шапки immersive-режима (React-состояние меняется
 *   только при пересечении порога);
 * - прогресс сжатия нижней навигации пишет напрямую в CSS-переменную --nav-p
 *   элемента navRef раз в кадр, без перерисовки React.
 *
 * resetKey — текущий экран: при его смене капсула плавно раскрывается, а
 * базовая точка прокрутки переносится, чтобы первое движение не потерялось.
 * Пока на капсуле идёт жест (атрибут data-gesture от BottomNav), прогресс
 * заморожен: drag pill опирается на геометрию, измеренную на pointerdown.
 */
export default function useScrollChrome(navRef, resetKey) {
  const [scrolled, setScrolled] = useState(false);
  const r = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const s = {
      state: createCollapse(window.scrollY, maxScroll()),
      shown: 0, // прогресс, уже записанный в --nav-p
      maxY: maxScroll(),
      raf: 0,
      last: 0, // timestamp предыдущего кадра сглаживания
      locked: false,
      reduce: !!mq?.matches,
    };
    r.current = s;

    const write = (p) => {
      s.shown = p;
      navRef.current?.style.setProperty("--nav-p", p.toFixed(4));
    };

    const frame = (now) => {
      s.raf = 0;
      const target = s.state.p;
      const dt = s.last ? Math.min(now - s.last, 64) : FRAME_MS;
      const next = smoothProgress(s.shown, target, dt, s.reduce ? 0 : SMOOTH_TAU);
      if (next !== s.shown) write(next);
      if (next !== target) {
        s.last = now;
        s.raf = requestAnimationFrame(frame);
      } else {
        s.last = 0; // сглаживание закончилось — цикл не крутится вхолостую
      }
    };
    const schedule = () => {
      if (!s.raf) s.raf = requestAnimationFrame(frame);
    };
    s.schedule = schedule;

    const onScroll = () => {
      if (scrollLocked()) { s.locked = true; return; }
      const y = window.scrollY;
      setScrolled(y > HEADER_SCROLLED_AT);
      if (s.locked) {
        // первое событие после снятия блокировки — восстановление прокрутки
        s.locked = false;
        s.state = stepCollapse(s.state, y, s.maxY, { frozen: true });
      } else {
        s.state = stepCollapse(s.state, y, s.maxY, {
          frozen: navRef.current?.hasAttribute("data-gesture"),
          teleport: window.innerHeight,
        });
      }
      if (s.state.p !== s.shown) schedule();
    };

    // высота документа меняется при смене вкладки, раскрытии списков и
    // повороте экрана — кешируем её, а не меряем на каждом событии прокрутки
    const remeasure = () => {
      s.maxY = maxScroll();
      onScroll();
    };
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(remeasure) : null;
    ro?.observe(document.body);
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", onScroll, { passive: true });

    const onMotion = () => {
      s.reduce = mq.matches;
    };
    mq?.addEventListener?.("change", onMotion);

    write(0);
    setScrolled(window.scrollY > HEADER_SCROLLED_AT);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", remeasure);
      ro?.disconnect();
      mq?.removeEventListener?.("change", onMotion);
      if (s.raf) cancelAnimationFrame(s.raf);
      r.current = null;
    };
  }, [navRef]);

  // смена экрана: капсула раскрывается, отсчёт — от текущей прокрутки
  useEffect(() => {
    const s = r.current;
    if (!s) return;
    s.maxY = maxScroll();
    s.state = createCollapse(window.scrollY, s.maxY);
    if (s.shown !== 0) s.schedule();
  }, [resetKey]);

  return scrolled;
}
