import React, { useCallback, useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import SettingsModal from "./components/SettingsModal";
import HomeTab from "./tabs/HomeTab";
import FuelTab from "./tabs/FuelTab";
import ChartsTab from "./tabs/ChartsTab";
import ServiceTab from "./tabs/ServiceTab";
import RemindersTab from "./tabs/RemindersTab";
import { KEYS, usePersistentState } from "./storage";
import { INITIAL_FUEL, INITIAL_SERVICE, INITIAL_REMINDERS } from "./data";
import { THEMES, THEME_META } from "./themes";
import {
  effectivePriority, fmtKm, migrateFuel, migrateReminders, migrateService,
} from "./utils";

const TABS = [
  { id: "home",      icon: "🏠", label: "Главная", title: "Autocontrol" },
  { id: "fuel",      icon: "⛽", label: "Топливо",  title: "Топливо" },
  { id: "charts",    icon: "📊", label: "Графики",  title: "Графики" },
  { id: "service",   icon: "🔧", label: "ТО",       title: "История ТО" },
  { id: "reminders", icon: "🔔", label: "Задачи",   title: "Задачи" },
];

export default function App() {
  const [tab, setTab] = useState("home");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [theme, setTheme] = usePersistentState(KEYS.theme, "dark");
  const [fuel, setFuel] = usePersistentState(KEYS.fuel, INITIAL_FUEL, migrateFuel);
  const [service, setService] = usePersistentState(KEYS.service, INITIAL_SERVICE, migrateService);
  const [reminders, setReminders] = usePersistentState(KEYS.reminders, INITIAL_REMINDERS, migrateReminders);

  const safeTheme = THEMES.includes(theme) ? theme : "dark";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", safeTheme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_META[safeTheme].meta);
  }, [safeTheme]);

  const cycleTheme = () =>
    setTheme((t) => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]);

  const currentKm = useMemo(
    () => fuel.reduce((max, f) => Math.max(max, f.km), 0),
    [fuel]
  );

  // красный бейдж считает только невыполненные просроченные задачи
  const overdue = useMemo(
    () => reminders.filter((r) => effectivePriority(r, currentKm) === "overdue").length,
    [reminders, currentKm]
  );

  const importData = useCallback(
    (data) => {
      setFuel(migrateFuel(data.fuel));
      setService(migrateService(data.service));
      setReminders(migrateReminders(data.reminders));
      if (data.theme && THEMES.includes(data.theme)) setTheme(data.theme);
    },
    [setFuel, setService, setReminders, setTheme]
  );

  const active = TABS.find((t) => t.id === tab);

  return (
    <div className="app">
      <Header
        title={active.title}
        subtitle={tab === "home" ? "Toyota Prius+ 2012" : `${fmtKm(currentKm)} км`}
        theme={safeTheme}
        onToggleTheme={cycleTheme}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {tab === "home" && (
        <HomeTab
          fuel={fuel}
          service={service}
          reminders={reminders}
          currentKm={currentKm}
          onGo={setTab}
        />
      )}
      {tab === "fuel" && <FuelTab fuel={fuel} setFuel={setFuel} />}
      {tab === "charts" && <ChartsTab fuel={fuel} theme={safeTheme} />}
      {tab === "service" && <ServiceTab service={service} setService={setService} />}
      {tab === "reminders" && (
        <RemindersTab
          reminders={reminders}
          setReminders={setReminders}
          currentKm={currentKm}
        />
      )}

      <BottomNav
        tabs={TABS}
        active={tab}
        onChange={setTab}
        badges={{ reminders: overdue }}
      />

      {settingsOpen && (
        <SettingsModal
          fuel={fuel}
          service={service}
          reminders={reminders}
          theme={safeTheme}
          onImport={importData}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
