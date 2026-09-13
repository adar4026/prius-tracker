export const THEMES = ["dark", "light", "sepia"];

export const THEME_META = {
  dark:  { icon: "🌙", label: "Тёмная",  meta: "#0f0f0f" },
  light: { icon: "☀️", label: "Светлая", meta: "#eaf4f7" },
  sepia: { icon: "📖", label: "Сепия",   meta: "#f5f0e8" },
};

// Цвета графиков берём из CSS-переменных: recharts не понимает var() в SVG-заливке
export function chartColors(theme) {
  const grid = { dark: "#2a2a2a", light: "#dce9ed", sepia: "#d4c9b0" }[theme];
  const axis = { dark: "#7a7468", light: "#5b7482", sepia: "#7a6a55" }[theme];
  const tooltipBg = { dark: "#1a1a1a", light: "#f7fcfd", sepia: "#ede8dc" }[theme];
  const text = { dark: "#e8e0d0", light: "#14232b", sepia: "#3d2b1f" }[theme];
  // в светлой теме цвета данных чуть темнее — те же значения, что и в index.css
  const data = theme === "light"
    ? { gold: "#b8901c", green: "#2e9a72", red: "#d94f4f", blue: "#4f7fc2" }
    : { gold: "#d4af37", green: "#4caf8a", red: "#ff6b6b", blue: "#7b9fd4" };
  return { grid, axis, tooltipBg, text, ...data };
}
