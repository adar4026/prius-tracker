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
import { HISTORY_IMPORTS, applyFuelBatch, applyServiceBatch } from "./history";
import { THEMES, THEME_META } from "./themes";
import { CATEGORY_ICONS } from "./data";
import {
  fmtKm, migrateFuel, migrateReminders, migrateService, reminderStatus,
} from "./utils";

const TABS = [
  { id: "home",      icon: "🏠", label: "Главная", title: "Autocontrol" },
  { id: "fuel",      icon: "⛽", label: "Топливо",  title: "Топливо" },
  { id: "charts",    icon: "📊", label: "Графики",  title: "Графики" },
  { id: "service",   icon: "🔧", label: "ТО",       title: "История ТО" },
  { id: "reminders", icon: "🔔", label: "Задачи",   title: "Задачи" },
];

const CURRENT_YEAR = String(new Date().getFullYear());

export default function App() {
  const [tab, setTab] = useState("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  // выбранный год общий для журналов, поэтому не сбрасывается при смене вкладки
  const [year, setYear] = useState(CURRENT_YEAR);
  // заготовка формы ТО для сценария «Выполнить» из раздела «Задачи»
  const [serviceDraft, setServiceDraft] = useState(null);

  const [theme, setTheme] = usePersistentState(KEYS.theme, "light");
  const [fuel, setFuel] = usePersistentState(KEYS.fuel, INITIAL_FUEL, migrateFuel);
  const [service, setService] = usePersistentState(KEYS.service, INITIAL_SERVICE, migrateService);
  const [reminders, setReminders] = usePersistentState(KEYS.reminders, INITIAL_REMINDERS, migrateReminders);
  const [importsDone, setImportsDone] = usePersistentState(KEYS.imports, []);

  // Разовая доливка исторических записей: на устройстве, где localStorage уже
  // заполнен, INITIAL_* не применяются, поэтому история приходит миграцией.
  useEffect(() => {
    const pending = HISTORY_IMPORTS.filter(
      (batch) => !(Array.isArray(importsDone) ? importsDone : []).includes(batch.id)
    );
    if (!pending.length) return;

    setFuel((prev) => pending.reduce(applyFuelBatch, prev));
    setService((prev) => pending.reduce(applyServiceBatch, prev));
    setImportsDone((prev) =>
      [...new Set([...(Array.isArray(prev) ? prev : []), ...pending.map((b) => b.id)])]
    );
    // применяется один раз за сессию, дальше защищает список выполненных импортов
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const safeTheme = THEMES.includes(theme) ? theme : "light";

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
    () => reminders.filter((r) => reminderStatus(r, currentKm) === "overdue").length,
    [reminders, currentKm]
  );

  /**
   * «Выполнить» в задаче открывает форму нового ТО с подставленным названием.
   * Категория берётся из исходной сервисной записи, если задача создана из неё.
   */
  const completeReminder = useCallback(
    (reminder) => {
      const source = reminder.sourceServiceId
        ? service.find((s) => s.id === reminder.sourceServiceId)
        : null;
      const category =
        source?.category ||
        Object.keys(CATEGORY_ICONS).find((c) => CATEGORY_ICONS[c] === reminder.icon) ||
        "oil";
      setServiceDraft({
        reminderId: reminder.id,
        form: { type: reminder.title, category },
      });
      setTab("service");
    },
    [service]
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
      {tab === "fuel" && (
        <FuelTab fuel={fuel} setFuel={setFuel} year={year} onYear={setYear} />
      )}
      {tab === "charts" && <ChartsTab fuel={fuel} service={service} theme={safeTheme} />}
      {tab === "service" && (
        <ServiceTab
          service={service}
          setService={setService}
          reminders={reminders}
          setReminders={setReminders}
          currentKm={currentKm}
          year={year}
          onYear={setYear}
          draft={serviceDraft}
          onDraftUsed={() => setServiceDraft(null)}
        />
      )}
      {tab === "reminders" && (
        <RemindersTab
          reminders={reminders}
          setReminders={setReminders}
          service={service}
          currentKm={currentKm}
          onComplete={completeReminder}
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
