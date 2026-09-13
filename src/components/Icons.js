import React from "react";

// Служебные глифы навигации (бургер, назад, закрыть, шеврон). Рисуются
// inline-SVG в цвете currentColor, чтобы не зависеть от шрифта эмодзи.
const Svg = ({ children, size = 22 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

export const MenuIcon = (p) => (
  <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>
);

export const BackIcon = (p) => (
  <Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>
);

export const CloseIcon = (p) => (
  <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
);

export const ChevronIcon = (p) => (
  <Svg {...p}><path d="M9 5l7 7-7 7" /></Svg>
);

export const CopyIcon = (p) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </Svg>
);
