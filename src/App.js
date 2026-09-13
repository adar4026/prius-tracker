import React, { useCallback, useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import SideDrawer from "./components/SideDrawer";
import HomeTab from "./tabs/HomeTab";
import FuelTab from "./tabs/FuelTab";
import ChartsTab from "./tabs/ChartsTab";
import ServiceTab from "./tabs/ServiceTab";
import RemindersTab from "./tabs/RemindersTab";
import VehiclePage from "./pages/VehiclePage";
import SettingsPage from "./pages/SettingsPage";
import { KEYS, usePersistentState } from "./storage";
import { INITIAL_FUEL, INITIAL_SERVICE, INITIAL_REMINDERS } from "./data";
import { HISTORY_IMPORTS, applyFuelBatch, applyServiceBatch } from "./history";
import { THEMES, THEME_META } from "./themes";
import { CATEGORY_ICONS } from "./data";
import { VEHICLE_DEFAULTS, migrateVehicle } from "./vehicle";
import {
  entryYear, migrateFuel, migrateReminders, migrateService, reminderStatus,
} from "./utils";

const TABS = [
  { id: "home",      icon: "🏠", label: "Главная" },
  { id: "fuel",      icon: "⛽", label: "Топливо" },
  { id: "charts",    icon: "📊", label: "Графики" },
  { id: "service",   icon: "🔧", label: "ТО", menuLabel: "Техническое обслуживание" },
  { id: "reminders", icon: "🔔", label: "Задачи" },
];

// пункты шторки в порядке из макета: журналы, затем графики, задачи и автомобиль
const DRAWER_ORDER = ["home", "fuel", "service", "charts", "reminders"];
const DRAWER_ITEMS = [
  ...DRAWER_ORDER.map((id) => TABS.find((t) => t.id === id)),
  { id: "vehicle", icon: "🚗", label: "Автомобиль" },
];

const APP_VERSION = process.env.REACT_APP_VERSION || "";

const CURRENT_YEAR = String(new Date().getFullYear());

export default function App() {
  const [tab, setTab] = useState("home");
  // внутренняя страница поверх вкладки: "vehicle" | "settings" | null.
  // Вкладка при этом не меняется, поэтому «Назад» возвращает туда, откуда пришли.
  const [page, setPage] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // выбранный год общий для журналов, поэтому не сбрасывается при смене вкладки
  const [year, setYear] = useState(CURRENT_YEAR);
  // заготовка формы ТО для сценария «Выполнить» из раздела «Задачи»
  const [serviceDraft, setServiceDraft] = useState(null);

  const [theme, setTheme] = usePersistentState(KEYS.theme, "light");
  const [fuel, setFuel] = usePersistentState(KEYS.fuel, INITIAL_FUEL, migrateFuel);
  const [service, setService] = usePersistentState(KEYS.service, INITIAL_SERVICE, migrateService);
  const [reminders, setReminders] = usePersistentState(KEYS.reminders, INITIAL_REMINDERS, migrateReminders);
  const [vehicle, setVehicle] = usePersistentState(KEYS.vehicle, VEHICLE_DEFAULTS, migrateVehicle);
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

  const currentKm = useMemo(
    () => fuel.reduce((max, f) => Math.max(max, f.km), 0),
    [fuel]
  );

  // красный бейдж считает только невыполненные просроченные задачи
  const overdue = useMemo(
    () => reminders.filter((r) => reminderStatus(r, currentKm) === "overdue").length,
    [reminders, currentKm]
  );

  /* ---------------- навигация ---------------- */

  const goTab = useCallback((id) => {
    setTab(id);
    setPage(null);
  }, []);

  const openPage = useCallback((id) => setPage(id), []);
  const closePage = useCallback(() => setPage(null), []);

  // внутренняя страница открывается с начала. Эффект родителя срабатывает
  // после очистки эффектов шторки, которая возвращает прокрутку фона.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  const drawerSelect = useCallback(
    (id) => (id === "vehicle" || id === "settings" ? openPage(id) : goTab(id)),
    [openPage, goTab]
  );

  // переход к записи ТО со страницы автомобиля: год журнала подстраивается под запись
  const openService = useCallback(
    (entry) => {
      if (entry && entry.date) setYear(entryYear(entry));
      goTab("service");
    },
    [goTab]
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
      if (data.vehicle) setVehicle(migrateVehicle(data.vehicle));
      if (data.theme && THEMES.includes(data.theme)) setTheme(data.theme);
    },
    [setFuel, setService, setReminders, setVehicle, setTheme]
  );

  // журналы и задачи очищаются, данные автомобиля возвращаются к значениям
  // по умолчанию; список выполненных исторических импортов сохраняется,
  // чтобы история не долилась заново при следующем запуске
  const clearAll = useCallback(() => {
    setFuel([]);
    setService([]);
    setReminders([]);
    setVehicle(migrateVehicle({}));
  }, [setFuel, setService, setReminders, setVehicle]);

  const drawerActive = page || tab;

  return (
    <div className="app">
      {page === "vehicle" && (
        <VehiclePage
          vehicle={vehicle}
          setVehicle={setVehicle}
          service={service}
          reminders={reminders}
          currentKm={currentKm}
          onBack={closePage}
          onOpenService={openService}
          onOpenReminders={() => goTab("reminders")}
        />
      )}
      {page === "settings" && (
        <SettingsPage
          fuel={fuel}
          service={service}
          reminders={reminders}
          vehicle={vehicle}
          theme={safeTheme}
          onTheme={setTheme}
          onImport={importData}
          onClearAll={clearAll}
          onBack={closePage}
          version={APP_VERSION}
        />
      )}

      {!page && (
        <>
          <Header title="Lexcar" onMenu={() => setDrawerOpen(true)} />

          {tab === "home" && (
            <HomeTab
              fuel={fuel}
              service={service}
              reminders={reminders}
              currentKm={currentKm}
              vehicle={vehicle}
              onGo={goTab}
              onOpenVehicle={() => openPage("vehicle")}
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
        </>
      )}

      <BottomNav
        tabs={TABS}
        active={page ? null : tab}
        onChange={goTab}
        badges={{ reminders: overdue }}
      />

      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={DRAWER_ITEMS}
        active={drawerActive}
        onSelect={drawerSelect}
        vehicle={vehicle}
        currentKm={currentKm}
        version={APP_VERSION}
      />
    </div>
  );
}
