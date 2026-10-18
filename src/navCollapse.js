/**
 * Прогресс сжатия нижней навигации: 0 — капсула раскрыта, 1 — компактная.
 *
 * Прогресс следует за фактическим смещением прокрутки, а не за порогом:
 * каждый пиксель вниз прибавляет 1/COLLAPSE_RANGE, вверх — отнимает. Поэтому
 * короткий жест даёт частичное сжатие, а смена направления разворачивает
 * капсулу с того же промежуточного значения, без автодоводки.
 *
 * Модуль чистый (без DOM), его использует useScrollChrome.
 */

// путь прокрутки (px), за который капсула сжимается полностью
export const COLLAPSE_RANGE = 80;
// разворот направления меньше этого (px) считается дрожанием и игнорируется
export const REVERSE_SLOP = 4;
// время сглаживания отображаемого прогресса (мс); 0 — без сглаживания
export const SMOOTH_TAU = 40;
// разница, ниже которой сглаживание считается завершённым
export const SETTLE_EPS = 0.001;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Начальное состояние: капсула раскрыта, базовая точка — текущая прокрутка. */
export function createCollapse(y = 0, maxY = 0) {
  return { y: clamp(y, 0, Math.max(0, maxY)), p: 0, dir: 0, rev: 0 };
}

/**
 * Новое состояние по текущей прокрутке.
 *
 * - y зажимается в [0, maxY]: rubber-band/overscroll iOS за границами
 *   не даёт ни сдвига, ни смены направления;
 * - у верха прогресс ограничен y / COLLAPSE_RANGE — на самом верху капсула
 *   всегда раскрыта, а короткая страница сжимается лишь частично;
 * - разворот меньше REVERSE_SLOP не двигает прогресс, а сверх него
 *   учитывается только излишек — без скачка на величину порога;
 * - opts.frozen (идёт жест по самой капсуле) и opts.teleport (программный
 *   прыжок больше этого порога, px) только переносят базовую точку.
 */
export function stepCollapse(state, rawY, maxY, opts = {}) {
  const max = Math.max(0, maxY);
  const y = clamp(rawY, 0, max);
  const cap = Math.min(1, y / COLLAPSE_RANGE);
  const delta = y - state.y;

  if (opts.frozen || (opts.teleport && Math.abs(delta) > opts.teleport)) {
    return { y, p: Math.min(state.p, cap), dir: 0, rev: 0 };
  }
  if (delta === 0) return { ...state, y, p: Math.min(state.p, cap) };

  const sign = delta > 0 ? 1 : -1;
  const dist = Math.abs(delta);
  let { dir, rev } = state;
  let move;
  if (dir !== 0 && sign !== dir) {
    // возможный разворот: копим путь, пока он не превысит порог
    rev += dist;
    if (rev < REVERSE_SLOP) {
      return { y, p: Math.min(state.p, cap), dir, rev };
    }
    move = sign * (rev - REVERSE_SLOP);
    dir = sign;
    rev = 0;
  } else {
    // движение в прежнюю сторону сначала гасит несостоявшийся разворот —
    // так дрожание вокруг точки не дожимает капсулу по чуть-чуть
    const back = Math.min(rev, dist);
    rev -= back;
    move = sign * (dist - back);
    dir = sign;
  }

  let p = clamp(state.p + move / COLLAPSE_RANGE, 0, cap);
  // накопленная погрешность float не должна оставлять «почти» крайние значения
  if (p > 1 - 1e-9) p = 1;
  else if (p < 1e-9) p = 0;
  return { y, p, dir, rev };
}

/**
 * Отображаемый прогресс догоняет целевой по экспоненте с постоянной времени
 * tau (мс): обычный жест почти не отстаёт, а резкий прыжок прокрутки
 * растягивается на несколько кадров вместо скачка геометрии.
 * tau = 0 (prefers-reduced-motion) — значение применяется сразу.
 */
export function smoothProgress(current, target, dt, tau = SMOOTH_TAU) {
  if (!(tau > 0) || !(dt > 0)) return tau > 0 ? current : target;
  const next = current + (target - current) * (1 - Math.exp(-dt / tau));
  return Math.abs(target - next) < SETTLE_EPS ? target : next;
}
