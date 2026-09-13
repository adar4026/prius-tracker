import React from "react";
import { ChartIcon, ClipboardCheckIcon, FuelIcon, HomeIcon, WrenchIcon } from "./Icons";

const ICONS = {
  home: HomeIcon,
  fuel: FuelIcon,
  charts: ChartIcon,
  service: WrenchIcon,
  reminders: ClipboardCheckIcon,
};

/**
 * Плавающая нижняя панель-«капсула». Подложка активного пункта — один
 * элемент, который переезжает между равными колонками через transform,
 * поэтому переход анимируется без измерения DOM.
 */
export default function BottomNav({ tabs, active, onChange, badges = {} }) {
  const index = tabs.findIndex((t) => t.id === active);
  return (
    <nav className="nav" aria-label="Разделы">
      <div
        className="nav__inner"
        style={{ "--nav-count": tabs.length, "--nav-index": index }}
      >
        {index >= 0 && <span className="nav__pill" aria-hidden="true" />}
        {tabs.map((t) => {
          const Icon = ICONS[t.id];
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`nav__item ${isActive ? "nav__item--active" : ""}`}
              onClick={() => onChange(t.id)}
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
