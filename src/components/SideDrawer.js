import React, { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon } from "./Icons";
import { fmtKm } from "../utils";

const SWIPE_CLOSE_PX = 60;
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Боковая шторка навигации. Всегда смонтирована — открытие/закрытие
 * анимируется классом .drawer--open. Пока открыта, прокрутка страницы
 * заблокирована, фокус остаётся внутри панели, закрывается по overlay,
 * кнопке ✕, свайпу влево и Escape.
 */
export default function SideDrawer({
  open, onClose, items, active, onSelect, vehicle, photoUrl, currentKm, version,
}) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const touch = useRef(null); // { x, y, dragging } на время свайпа
  const [drag, setDrag] = useState(0); // смещение панели влево, px

  // перед скрытием фокус уходит из панели, чтобы он не остался под aria-hidden
  const close = useCallback(() => {
    if (panelRef.current?.contains(document.activeElement)) document.activeElement.blur();
    onClose();
  }, [onClose]);

  // блокировка прокрутки фона: position:fixed надёжнее overflow:hidden в iOS Safari
  useEffect(() => {
    if (!open) return undefined;
    const scrollY = window.scrollY;
    const { style } = document.body;
    const prev = { position: style.position, top: style.top, width: style.width, overflow: style.overflow };
    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.width = "100%";
    style.overflow = "hidden";
    return () => {
      style.position = prev.position;
      style.top = prev.top;
      style.width = prev.width;
      style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  // Escape, перенос фокуса внутрь и возврат кнопке-бургеру после закрытия
  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const onKey = (e) => {
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((n) => !n.disabled);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => closeRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      if (opener && typeof opener.focus === "function") opener.focus();
    };
  }, [open, close]);

  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, dragging: false };
  };
  const onTouchMove = (e) => {
    if (!touch.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    // горизонтальный жест начинается, только если он заметнее вертикального
    if (!touch.current.dragging && Math.abs(dx) < 8) return;
    if (!touch.current.dragging && Math.abs(dy) > Math.abs(dx)) { touch.current = null; return; }
    touch.current.dragging = true;
    setDrag(Math.min(0, dx));
  };
  const onTouchEnd = () => {
    const shouldClose = touch.current?.dragging && drag < -SWIPE_CLOSE_PX;
    touch.current = null;
    setDrag(0);
    if (shouldClose) close();
  };

  const go = (id) => {
    onSelect(id);
    close();
  };

  const panelStyle = drag
    ? { transform: `translateX(${drag}px)`, transition: "none" }
    : undefined;

  return (
    <div className={`drawer ${open ? "drawer--open" : ""}`} aria-hidden={!open}>
      <div className="drawer__overlay" onClick={close} />
      <div
        ref={panelRef}
        className="drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Меню"
        style={panelStyle}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div className="drawer__head">
          <span className="drawer__brand">Lexcar</span>
          <button
            ref={closeRef}
            type="button"
            className="header__btn"
            onClick={close}
            aria-label="Закрыть меню"
            tabIndex={open ? 0 : -1}
          >
            <CloseIcon />
          </button>
        </div>

        <button
          type="button"
          className={`drawer__car ${active === "vehicle" ? "drawer__car--active" : ""}`}
          onClick={() => go("vehicle")}
          aria-label="Открыть страницу автомобиля"
          tabIndex={open ? 0 : -1}
        >
          <span className="drawer__car-icon" aria-hidden="true">
            {photoUrl ? <img src={photoUrl} alt="" className="drawer__car-photo" /> : "🚗"}
          </span>
          <span className="drawer__car-main">
            <span className="drawer__car-name">{vehicle.name}</span>
            <span className="drawer__car-sub">{vehicle.year} · {vehicle.fuelType}</span>
            <span className="drawer__car-km">{fmtKm(currentKm)} км</span>
          </span>
        </button>

        <nav className="drawer__nav" aria-label="Разделы">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              className={`drawer__item ${active === it.id ? "drawer__item--active" : ""}`}
              onClick={() => go(it.id)}
              aria-current={active === it.id ? "page" : undefined}
              tabIndex={open ? 0 : -1}
            >
              <span className="drawer__item-icon" aria-hidden="true">{it.icon}</span>
              <span className="drawer__item-label">{it.menuLabel || it.label}</span>
            </button>
          ))}
        </nav>

        <div className="drawer__foot">
          <button
            type="button"
            className={`drawer__item ${active === "settings" ? "drawer__item--active" : ""}`}
            onClick={() => go("settings")}
            aria-current={active === "settings" ? "page" : undefined}
            tabIndex={open ? 0 : -1}
          >
            <span className="drawer__item-icon" aria-hidden="true">⚙️</span>
            <span className="drawer__item-label">Данные и настройки</span>
          </button>
          {version && <div className="drawer__version">Версия {version}</div>}
        </div>
      </div>
    </div>
  );
}
