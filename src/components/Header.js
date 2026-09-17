import React from "react";
import { BackIcon, MenuIcon, SearchIcon } from "./Icons";

/**
 * Верхняя панель. На основных вкладках: [☰] Lexcar [⌕].
 * На внутренних страницах: [←] Заголовок и, при необходимости, действие справа.
 * immersive — шапка Главной: прозрачная, без разделителя, лежит прямо на
 * fluid-фоне; scrolled — после прокрутки становится стеклянной.
 */
export default function Header({
  title, onMenu, onBack, onSearch, action, immersive = false, scrolled = false,
}) {
  const cls = [
    "header",
    immersive ? "header--immersive" : "",
    immersive && scrolled ? "header--scrolled" : "",
  ].filter(Boolean).join(" ");
  return (
    <header className={cls}>
      {onBack ? (
        <button type="button" className="header__btn" onClick={onBack} aria-label="Назад">
          <BackIcon />
        </button>
      ) : (
        <button
          type="button"
          className="header__btn"
          onClick={onMenu}
          aria-label="Открыть меню"
          aria-haspopup="dialog"
        >
          <MenuIcon />
        </button>
      )}
      <h1 className="header__title">{title}</h1>
      {action && <div className="header__action">{action}</div>}
      {onSearch && (
        <button
          type="button"
          className={`header__btn header__action ${immersive ? "header__btn--glass" : ""}`}
          onClick={onSearch}
          aria-label="Поиск"
          aria-haspopup="dialog"
        >
          <SearchIcon />
        </button>
      )}
    </header>
  );
}
