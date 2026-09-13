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

/* ---- иконки нижней навигации (контуры в стиле lucide) ---- */

export const HomeIcon = (p) => (
  <Svg {...p}>
    <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
    <path d="M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </Svg>
);

export const FuelIcon = (p) => (
  <Svg {...p}>
    <path d="M3 22h12M4 9h10" />
    <path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18" />
    <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.8a2 2 0 0 0-.6-1.4L18 5" />
  </Svg>
);

export const ChartIcon = (p) => (
  <Svg {...p}>
    <path d="M4 18v3M8 14v7M12 16v5M16 14v7M20 10v11" />
    <path d="m22 3-8.6 8.6a.5.5 0 0 1-.8 0L9.4 8.4a.5.5 0 0 0-.8 0L2 15" />
  </Svg>
);

export const WrenchIcon = (p) => (
  <Svg {...p}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-8 8l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 8-8l-3.8 3.8Z" />
  </Svg>
);

export const ClipboardCheckIcon = (p) => (
  <Svg {...p}>
    <rect width="8" height="4" x="8" y="2" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="m9 14 2 2 4-4" />
  </Svg>
);
