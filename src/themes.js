export const THEMES = ["dark", "light", "sepia"];

export const THEME_META = {
  dark:  { icon: "🌙", label: "Тёмная",  meta: "#0f0f0f" },
  light: { icon: "☀️", label: "Светлая", meta: "#ffffff" },
  sepia: { icon: "📖", label: "Сепия",   meta: "#f5f0e8" },
};

// Цвета графиков берём из CSS-переменных: recharts не понимает var() в SVG-заливке
export function chartColors(theme) {
  const grid = { dark: "#2a2a2a", light: "#e0e0e0", sepia: "#d4c9b0" }[theme];
  const axis = { dark: "#7a7468", light: "#6b6b6b", sepia: "#7a6a55" }[theme];
  const tooltipBg = { dark: "#1a1a1a", light: "#ffffff", sepia: "#ede8dc" }[theme];
  const text = { dark: "#e8e0d0", light: "#1a1a1a", sepia: "#3d2b1f" }[theme];
  return {
    grid, axis, tooltipBg, text,
    gold: "#d4af37", green: "#4caf8a", red: "#ff6b6b", blue: "#7b9fd4",
  };
}
