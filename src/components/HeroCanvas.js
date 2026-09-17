import React, { useEffect, useRef, useState } from "react";

/**
 * Экспериментальный WebGL-фон hero Главной: «жидкая ткань / satin waves».
 *
 * Один canvas строго в границах .home-ambient (высота hero). Фрагментный шейдер
 * строит три height-field «складки» (низкочастотный simplex noise + синусоидальный
 * displacement), считает псевдонормаль через конечные разности и освещает её:
 * diffuse даёт объём, specular — светлую кромку складки, обратная сторона уходит
 * в мягкую тень к глубокому синему. Время непрерывное — видимого шва цикла нет.
 *
 * Производительность (PWA на iPhone): DPR ≤ 1.5, ~30 fps, пауза при document.hidden
 * и когда hero вне viewport, низкое энергопотребление контекста. Если WebGL
 * недоступен, включён prefers-reduced-motion, устройство слабое или контекст
 * потерян — canvas не активируется, остаётся CSS-fallback (ribbons в .home-ambient).
 */

const DPR_CAP = 1.5;
const TARGET_FPS = 30;

// палитра Lexcar по темам: cyan / teal / ice blue / soft white / чуть глубокого синего
const PALETTES = {
  light: {
    top: [0.851, 0.925, 0.957],   // #d9ecf4
    bot: [0.918, 0.957, 0.969],   // #eaf4f7
    c1:  [0.051, 0.580, 0.627],   // teal
    c2:  [0.470, 0.769, 0.941],   // ice blue
    c3:  [0.941, 0.980, 0.988],   // soft white
    deep:[0.059, 0.373, 0.471],   // deep blue (тень)
    alpha: [0.46, 0.40, 0.52],
    light: 0.75,
  },
  dark: {
    top: [0.059, 0.094, 0.106],   // #0f181b
    bot: [0.059, 0.059, 0.059],   // #0f0f0f
    c1:  [0.055, 0.588, 0.635],
    c2:  [0.353, 0.667, 0.902],
    c3:  [0.667, 0.843, 0.882],
    deep:[0.020, 0.157, 0.216],
    alpha: [0.34, 0.24, 0.16],
    light: 0.22,
  },
  sepia: {
    top: [0.937, 0.906, 0.847],   // #efe7d8
    bot: [0.961, 0.941, 0.910],   // #f5f0e8
    c1:  [0.275, 0.667, 0.627],
    c2:  [0.831, 0.686, 0.216],
    c3:  [1.000, 0.980, 0.941],
    deep:[0.588, 0.471, 0.235],
    alpha: [0.40, 0.28, 0.40],
    light: 0.40,
  },
};

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 v_uv;
uniform vec2  u_res;
uniform float u_t;
uniform vec3  u_top, u_bot, u_c1, u_c2, u_c3, u_deep;
uniform vec3  u_alpha;
uniform float u_light;

// 2D simplex noise (Ashima Arts / Ian McEwan, MIT)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// height field одной складки: крупная синусоида, изогнутая низкочастотным шумом.
// dir — направление дрейфа (складка входит с одного края и уходит с другого),
// seed — своя фаза/форма у каждого слоя.
float fold(vec2 p, float t, vec2 dir, float seed) {
  vec2 q = p - dir * t * 0.05;
  float n1 = snoise(vec2(q.x * 0.75 + seed * 11.0, q.y * 1.05 + t * 0.03 + seed));
  float n2 = snoise(vec2(q.x * 1.3 - t * 0.02 + seed * 3.0, q.y * 1.4 + seed * 5.0));
  float w  = sin(q.x * 1.5 + q.y * 1.1 + n1 * 1.9 + t * 0.14 + seed * 2.0);
  return w * 0.58 + n1 * 0.45 + n2 * 0.06;
}

// один слой ткани: band — где складка видна, N — псевдонормаль поверхности
vec3 layer(vec3 col, vec2 p, float t, vec2 dir, float seed, vec3 tint, float alpha) {
  const float e = 0.035;
  float h  = fold(p, t, dir, seed);
  float hx = fold(p + vec2(e, 0.0), t, dir, seed);
  float hy = fold(p + vec2(0.0, e), t, dir, seed);
  vec3 N = normalize(vec3(-(hx - h) / e * 0.30, -(hy - h) / e * 0.30, 1.0));
  vec3 L = normalize(vec3(-0.45, 0.75, 0.55));      // свет сверху-слева
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float diff = clamp(dot(N, L), 0.0, 1.0);
  float spec = pow(clamp(dot(N, H), 0.0, 1.0), 12.0);
  float band = smoothstep(-0.35, 0.45, h) * (1.0 - smoothstep(0.55, 1.25, h));
  vec3 shaded = tint * (0.82 + 0.28 * diff);          // объём
  shaded = mix(shaded, u_deep, (1.0 - diff) * 0.26);  // мягкая тень на обратной стороне
  shaded += vec3(1.0) * spec * u_light;               // светлая кромка складки
  return mix(col, shaded, band * alpha);
}

void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);   // y сверху вниз, как в CSS
  float aspect = u_res.x / u_res.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 1.15;
  float t = u_t;

  vec3 col = mix(u_top, u_bot, uv.y);
  col = layer(col, p, t, vec2( 1.0, -0.35), 0.0, u_c1, u_alpha.x);  // teal: слева-снизу вправо-вверх
  col = layer(col, p, t, vec2(-0.85, 0.30), 1.0, u_c2, u_alpha.y);  // ice blue: справа влево
  col = layer(col, p, t, vec2( 0.55, 0.85), 2.0, u_c3, u_alpha.z);  // soft white: через центр

  // плавно уходим в фон страницы к нижнему краю hero — без резкой линии;
  // заодно облегчаем зону показателей (низ hero) для читаемости
  col = mix(col, u_bot, smoothstep(0.58, 1.0, uv.y));
  gl_FragColor = vec4(col, 1.0);
}`;

function prefersReducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// заведомо слабое устройство — не запускаем шейдер, остаётся CSS-fallback
function isLowEndDevice() {
  const nav = typeof navigator !== "undefined" ? navigator : {};
  if (nav.deviceMemory && nav.deviceMemory <= 2) return true;
  if (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2) return true;
  return false;
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    // eslint-disable-next-line no-console
    console.warn("HeroCanvas shader:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export default function HeroCanvas({ theme = "light" }) {
  const ref = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    if (prefersReducedMotion() || isLowEndDevice()) return undefined;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "low-power",
    });
    if (!gl || gl.isContextLost()) return undefined;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return undefined;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return undefined;
    gl.useProgram(prog);

    // fullscreen triangle
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = (n) => gl.getUniformLocation(prog, n);
    const uRes = u("u_res");
    const uT = u("u_t");
    const pal = PALETTES[theme] || PALETTES.light;
    gl.uniform3fv(u("u_top"), pal.top);
    gl.uniform3fv(u("u_bot"), pal.bot);
    gl.uniform3fv(u("u_c1"), pal.c1);
    gl.uniform3fv(u("u_c2"), pal.c2);
    gl.uniform3fv(u("u_c3"), pal.c3);
    gl.uniform3fv(u("u_deep"), pal.deep);
    gl.uniform3fv(u("u_alpha"), pal.alpha);
    gl.uniform1f(u("u_light"), pal.light);

    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    let w = 0;
    let h = 0;
    const resize = () => {
      const host = canvas.parentElement || canvas;
      const cw = Math.max(1, Math.round(host.clientWidth));
      const ch = Math.max(1, Math.round(host.clientHeight));
      if (cw === w && ch === h) return;
      w = cw; h = ch;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();
    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(resize)
      : null;
    if (ro) ro.observe(canvas.parentElement || canvas);
    else window.addEventListener("resize", resize);

    // рисуем только пока вкладка видна и hero в viewport
    let raf = 0;
    let running = false;
    let visible = !document.hidden;
    let inView = true;
    let last = 0;
    const start = performance.now();
    const frameMs = 1000 / TARGET_FPS;
    let lost = false;

    const frame = (now) => {
      raf = 0;
      if (!running || lost) return;
      if (now - last >= frameMs) {
        last = now;
        gl.uniform1f(uT, (now - start) / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      raf = requestAnimationFrame(frame);
    };
    const sync = () => {
      const shouldRun = visible && inView && !lost;
      if (shouldRun && !running) {
        running = true;
        if (!raf) raf = requestAnimationFrame(frame);
      } else if (!shouldRun && running) {
        running = false;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      }
    };
    const onVisibility = () => { visible = !document.hidden; sync(); };
    document.addEventListener("visibilitychange", onVisibility);
    const io = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((entries) => {
        inView = entries.some((en) => en.isIntersecting);
        sync();
      }, { threshold: 0 })
      : null;
    if (io) io.observe(canvas);

    const onLost = (e) => { e.preventDefault(); lost = true; sync(); setActive(false); };
    canvas.addEventListener("webglcontextlost", onLost);

    // первый кадр синхронно, чтобы не было пустого canvas до fade-in
    gl.uniform1f(uT, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    setActive(true);
    sync();

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      if (io) io.disconnect();
      if (ro) ro.disconnect(); else window.removeEventListener("resize", resize);
      // контекст намеренно не теряем: в StrictMode эффект перезапускается на том же
      // canvas, а при unmount canvas уходит из DOM и контекст освобождается сам
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      setActive(false);
    };
  }, [theme]);

  return (
    <canvas
      ref={ref}
      className={`hero-canvas ${active ? "hero-canvas--on" : ""}`}
      aria-hidden="true"
    />
  );
}
