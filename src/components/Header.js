import React from "react";
import { THEME_META } from "../themes";

export default function Header({ title, subtitle, theme, onToggleTheme }) {
  const meta = THEME_META[theme];
  return (
    <header className="header">
      <div className="header__title">
        <h1>{title}</h1>
        {subtitle && <span className="header__sub">{subtitle}</span>}
      </div>
      <button
        className="theme-btn"
        onClick={onToggleTheme}
        title={`Тема: ${meta.label}`}
        aria-label={`Тема: ${meta.label}. Переключить`}
      >
        {meta.icon}
      </button>
    </header>
  );
}
