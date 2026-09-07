import React from "react";

export default function BottomNav({ tabs, active, onChange, badges = {} }) {
  return (
    <nav className="nav">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={active === t.id ? "active" : ""}
          onClick={() => onChange(t.id)}
        >
          <span className="nav__icon">{t.icon}</span>
          {t.label}
          {badges[t.id] > 0 && <span className="nav__badge">{badges[t.id]}</span>}
        </button>
      ))}
    </nav>
  );
}
