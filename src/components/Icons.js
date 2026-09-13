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

export const SearchIcon = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Svg>
);

export const EditIcon = (p) => (
  <Svg {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Svg>
);

export const CameraIcon = (p) => (
  <Svg {...p}>
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.5" />
  </Svg>
);

export const CarIcon = (p) => (
  <Svg {...p}>
    <path d="M5 16v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-6l2.4-5.2A2 2 0 0 1 6.2 5.6h11.6a2 2 0 0 1 1.8 1.2L22 12v6a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-2" />
    <path d="M2 12h20M5 16h2M17 16h2" />
  </Svg>
);
