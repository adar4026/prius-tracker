import React, { useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import HomeTab from "./tabs/HomeTab";
import FuelTab from "./tabs/FuelTab";
import ChartsTab from "./tabs/ChartsTab";
import ServiceTab from "./tabs/ServiceTab";
import RemindersTab from "./tabs/RemindersTab";
import { KEYS, usePersistentState } from "./storage";
import { INITIAL_FUEL, INITIAL_SERVICE, INITIAL_REMINDERS } from "./data";
import { THEMES, THEME_META } from "./themes";
import { byKmAsc, fmtKm } from "./utils";

const TABS = [
  { id: "home",      icon: "🏠", label: "Главная", title: "Autocontrol" },
  { id: "fuel",      icon: "⛽", label: "Топливо",  title: "Топливо" },
  { id: "charts",    icon: "📊", label: "Графики",  title: "Графики" },
  { id: "service",   icon: "🔧", label: "ТО",       title: "История ТО" },
  { id: "reminders", icon: "🔔", label: "Задачи",   title: "Задачи" },
];

export default function App() {
  const [tab, setTab] = useState("home");
  const [theme, setTheme] = usePersistentState(KEYS.theme, "dark");
  const [fuel, setFuel] = usePersistentState(KEYS.fuel, INITIAL_FUEL);
  const [service, setService] = usePersistentState(KEYS.service, INITIAL_SERVICE);
  const [reminders] = usePersistentState(KEYS.reminders, INITIAL_REMINDERS);

  useEffect(() => {
    const safe = THEMES.includes(theme) ? theme : "dark";
    document.documentElement.setAttribute("data-theme", safe);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_META[safe].meta);
  }, [theme]);

  const cycleTheme = () =>
    setTheme((t) => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]);

  const currentKm = useMemo(
    () => (fuel.length ? [...fuel].sort(byKmAsc)[fuel.length - 1].km : 0),
    [fuel]
  );

  const overdue = useMemo(
    () =>
      reminders.filter(
        (r) => r.priority === "overdue" || (r.dueKm && currentKm >= r.dueKm)
      ).length,
    [reminders, currentKm]
  );

  const active = TABS.find((t) => t.id === tab);

  return (
    <div className="app">
      <Header
        title={active.title}
        subtitle={tab === "home" ? "Toyota Prius+ 2012" : `${fmtKm(currentKm)} км`}
        theme={THEMES.includes(theme) ? theme : "dark"}
        onToggleTheme={cycleTheme}
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
      {tab === "charts" && <ChartsTab fuel={fuel} theme={theme} />}
      {tab === "service" && <ServiceTab service={service} setService={setService} />}
      {tab === "reminders" && (
        <RemindersTab reminders={reminders} currentKm={currentKm} />
      )}

      <BottomNav
        tabs={TABS}
        active={tab}
        onChange={setTab}
        badges={{ reminders: overdue }}
      />
    </div>
  );
}
