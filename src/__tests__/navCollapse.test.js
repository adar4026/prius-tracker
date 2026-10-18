import {
  COLLAPSE_RANGE, REVERSE_SLOP, SMOOTH_TAU,
  createCollapse, smoothProgress, stepCollapse,
} from "../navCollapse";

const MAX = 3000;

// прогоняет последовательность scrollY через stepCollapse
const run = (ys, start = createCollapse(ys[0], MAX), opts) =>
  ys.slice(1).reduce((s, y) => stepCollapse(s, y, MAX, opts), start);

// плавная прокрутка от a до b шагом step
const path = (a, b, step = 4) => {
  const out = [];
  const dir = b > a ? 1 : -1;
  for (let y = a; dir > 0 ? y < b : y > b; y += dir * step) out.push(y);
  out.push(b);
  return out;
};

describe("stepCollapse", () => {
  it("starts expanded, even when the page loads already scrolled", () => {
    expect(createCollapse(0, MAX).p).toBe(0);
    expect(createCollapse(1200, MAX).p).toBe(0);
  });

  it("collapses continuously while scrolling down, through intermediate values", () => {
    let s = createCollapse(400, MAX);
    const seen = [];
    for (const y of path(400, 400 + COLLAPSE_RANGE, 8).slice(1)) {
      s = stepCollapse(s, y, MAX);
      seen.push(s.p);
    }
    // монотонно, без пропусков: каждый шаг 8px = 0.1 прогресса
    seen.forEach((p, i) => expect(p).toBeCloseTo((i + 1) * 8 / COLLAPSE_RANGE, 6));
    expect(seen[seen.length - 1]).toBe(1);
    expect(seen.some((p) => p > 0.4 && p < 0.6)).toBe(true);
  });

  it("expands continuously while scrolling up", () => {
    const down = run(path(400, 600));
    expect(down.p).toBe(1);
    const half = run([600, ...path(600, 600 - COLLAPSE_RANGE / 2 - REVERSE_SLOP).slice(1)], down);
    expect(half.p).toBeCloseTo(0.5, 6);
    const full = run([half.y, ...path(half.y, 300).slice(1)], half);
    expect(full.p).toBe(0);
  });

  it("keeps a partial value after a short gesture — no auto-completion", () => {
    const s = run(path(500, 520));
    expect(s.p).toBeCloseTo(20 / COLLAPSE_RANGE, 6);
    // пользователь остановился: повтор той же позиции ничего не меняет
    expect(stepCollapse(s, 520, MAX).p).toBe(s.p);
    expect(stepCollapse(stepCollapse(s, 520, MAX), 520, MAX).p).toBe(s.p);
  });

  it("reverses direction from the current value without a jump", () => {
    const mid = run(path(500, 540)); // 0.5
    const back = stepCollapse(stepCollapse(mid, 536, MAX), 530, MAX);
    // 10px вверх минус slop 4px = 6px
    expect(back.p).toBeCloseTo(mid.p - 6 / COLLAPSE_RANGE, 6);
    expect(Math.abs(back.p - mid.p)).toBeLessThan(0.1);
  });

  it("ignores small back-and-forth jitter", () => {
    const mid = run(path(500, 540));
    let s = mid;
    for (const y of [538, 540, 537, 540, 539, 540, 537]) s = stepCollapse(s, y, MAX);
    expect(s.p).toBeCloseTo(mid.p, 6);
  });

  it("handles large single-event jumps by clamping, not overshooting", () => {
    const s = run([500, 900]);
    expect(s.p).toBe(1);
    const up = stepCollapse(s, 100, MAX);
    expect(up.p).toBe(0);
    [s.p, up.p].forEach((p) => {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });
  });

  it("treats a programmatic teleport as a rebase", () => {
    const s = run([0, 2000], undefined, { teleport: 800 });
    expect(s.p).toBe(0);
    expect(s.y).toBe(2000);
    // а следующее настоящее движение уже учитывается
    expect(stepCollapse(s, 2040, MAX, { teleport: 800 }).p).toBeCloseTo(0.5, 6);
  });

  it("is always fully expanded at the very top and caps progress near it", () => {
    let s = run(path(0, 30));
    expect(s.p).toBeCloseTo(30 / COLLAPSE_RANGE, 6);
    s = run(path(800, 1000));
    s = stepCollapse(s, 0, MAX);
    expect(s.p).toBe(0);
  });

  it("ignores top rubber-band (negative scrollY)", () => {
    let s = createCollapse(0, MAX);
    for (const y of [-10, -40, -15, 0]) s = stepCollapse(s, y, MAX);
    expect(s.p).toBe(0);
  });

  it("ignores bottom rubber-band (scrollY past max)", () => {
    const atBottom = run(path(MAX - 200, MAX));
    expect(atBottom.p).toBe(1);
    let s = atBottom;
    for (const y of [MAX + 30, MAX + 60, MAX + 20, MAX]) s = stepCollapse(s, y, MAX);
    expect(s.p).toBe(1);
    // частично сжатая капсула у нижней границы тоже не меняется от bounce
    let part = run([MAX - 20, MAX - 10, MAX]);
    const before = part.p;
    for (const y of [MAX + 40, MAX + 5, MAX]) part = stepCollapse(part, y, MAX);
    expect(part.p).toBeCloseTo(before, 6);
  });

  it("only partially collapses a page that barely scrolls", () => {
    const short = 30;
    let s = createCollapse(0, short);
    for (const y of path(0, 200)) s = stepCollapse(s, y, short);
    expect(s.p).toBeCloseTo(short / COLLAPSE_RANGE, 6);
  });

  it("freezes progress during a gesture on the bar but keeps the baseline", () => {
    const mid = run(path(500, 540));
    const frozen = run([540, 560, 600], mid, { frozen: true });
    expect(frozen.p).toBeCloseTo(mid.p, 6);
    expect(frozen.y).toBe(600);
    // после жеста отсчёт идёт от новой точки, без накопленного скачка
    expect(stepCollapse(frozen, 608, MAX).p).toBeCloseTo(mid.p + 8 / COLLAPSE_RANGE, 6);
  });
});

describe("smoothProgress", () => {
  it("applies the target immediately when smoothing is off (reduced motion)", () => {
    expect(smoothProgress(0, 1, 16, 0)).toBe(1);
    expect(smoothProgress(0.7, 0.2, 16, 0)).toBe(0.2);
  });

  it("spreads a big jump across frames instead of one-frame snap", () => {
    let p = 0;
    const frames = [];
    for (let i = 0; i < 30 && p !== 1; i++) {
      p = smoothProgress(p, 1, 1000 / 60, SMOOTH_TAU);
      frames.push(p);
    }
    expect(frames[0]).toBeGreaterThan(0);
    expect(frames[0]).toBeLessThan(0.5);
    // каждый следующий кадр ближе к цели, без перелёта
    frames.reduce((a, b) => { expect(b).toBeGreaterThanOrEqual(a); expect(b).toBeLessThanOrEqual(1); return b; });
    // сходится за разумное число кадров и останавливается точно на цели
    expect(frames[frames.length - 1]).toBe(1);
    expect(frames.length).toBeLessThan(20);
  });

  it("reverses mid-way from the current displayed value", () => {
    const a = smoothProgress(0, 1, 16, SMOOTH_TAU);
    const b = smoothProgress(a, 0, 16, SMOOTH_TAU);
    expect(b).toBeLessThan(a);
    expect(b).toBeGreaterThan(0);
  });
});
