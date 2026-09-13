import { useCallback, useEffect, useState } from "react";

export const KEYS = {
  fuel: "autocontrol_fuel",
  service: "autocontrol_service",
  reminders: "autocontrol_reminders",
  theme: "autocontrol_theme",
  imports: "autocontrol_imports",
  vehicle: "autocontrol_vehicle",
};

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    // повреждённый JSON в localStorage не должен ронять приложение
    return fallback;
  }
}

export function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // приватный режим Safari / переполнение — работаем без сохранения
    return false;
  }
}

/**
 * useState, синхронизированный с localStorage.
 * migrate применяется и к сохранённым, и к начальным данным,
 * поэтому старые записи подтягиваются к актуальной модели.
 */
export function usePersistentState(key, initial, migrate) {
  const [value, setValue] = useState(() => {
    const raw = read(key, initial);
    try {
      return migrate ? migrate(raw) : raw;
    } catch {
      return migrate ? migrate(initial) : initial;
    }
  });

  useEffect(() => {
    write(key, value);
  }, [key, value]);

  const reset = useCallback(
    () => setValue(migrate ? migrate(initial) : initial),
    [initial, migrate]
  );

  return [value, setValue, reset];
}
