import { useCallback, useEffect, useState } from "react";

export const KEYS = {
  fuel: "autocontrol_fuel",
  service: "autocontrol_service",
  reminders: "autocontrol_reminders",
  theme: "autocontrol_theme",
};

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** useState, синхронизированный с localStorage */
export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => read(key, initial));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* приватный режим Safari / переполнение — работаем без сохранения */
    }
  }, [key, value]);

  const reset = useCallback(() => setValue(initial), [initial]);

  return [value, setValue, reset];
}
