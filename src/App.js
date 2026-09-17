import React, { useCallback, useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import SideDrawer from "./components/SideDrawer";
import GlobalSearch from "./components/GlobalSearch";
import HeroCanvas from "./components/HeroCanvas";
import HomeTab from "./tabs/HomeTab";
import FuelTab from "./tabs/FuelTab";
import ChartsTab from "./tabs/ChartsTab";
import ServiceTab from "./tabs/ServiceTab";
import RemindersTab from "./tabs/RemindersTab";
import VehiclePage from "./pages/VehiclePage";
import SettingsPage from "./pages/SettingsPage";
import { KEYS, usePersistentState } from "./storage";
import { INITIAL_FUEL, INITIAL_SERVICE, INITIAL_REMINDERS } from "./data";
import {
  HISTORY_IMPORTS, applyFuelBatch, applyReminderBatch, applyServiceBatch,
} from "./history";
import { THEMES, THEME_META } from "./themes";
import { CATEGORY_ICONS } from "./data";
import { VEHICLE_DEFAULTS, migrateVehicle } from "./vehicle";
import { useVehiclePhoto } from "./photo";
import {
  entryYear, migrateFuel, migrateReminders, migrateService, reminderStatus,
} from "./utils";

const TABS = [
  { id: "home",      icon: "🏠", label: "Главное", menuLabel: "Главная" },
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
  const [searchOpen, setSearchOpen] = useState(false);
  // запись, к которой нужно прокрутить вкладку после перехода из поиска: { id }
  const [focus, setFocus] = useState(null);
  // секция страницы «Автомобиль», которую нужно раскрыть при открытии
  const [vehicleSection, setVehicleSection] = useState(null);
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
  // фото живёт в IndexedDB и в резервную копию не входит
  const photo = useVehiclePhoto();
  const { remove: removePhoto } = photo;

  // Разовая доливка исторических записей: на устройстве, где localStorage уже
  // заполнен, INITIAL_* не применяются, поэтому история приходит миграцией.
  useEffect(() => {
    const pending = HISTORY_IMPORTS.filter(
      (batch) => !(Array.isArray(importsDone) ? importsDone : []).includes(batch.id)
    );
    if (!pending.length) return;

    // заправки и ТО идут через партии вместе: восстановление пробега берёт
    // опорные точки из обеих коллекций
    const { fuel: nextFuel, service: nextService } = pending.reduce(
      (acc, batch) => ({
        fuel: applyFuelBatch(acc.fuel, batch, acc.service),
        service: applyServiceBatch(acc.service, batch, acc.fuel),
      }),
      { fuel, service }
    );
    setFuel(nextFuel);
    // задачи партии ссылаются на записи ТО по дате и виду работ, поэтому
    // применяются к уже долитому списку
    setService(nextService);
    setReminders((prev) =>
      pending.reduce((acc, batch) => applyReminderBatch(acc, nextService, batch), prev)
    );
    setImportsDone((prev) =>
      [...new Set([...(Array.isArray(prev) ? prev : []), ...pending.map((b) => b.id)])]
    );
    // применяется один раз за сессию, дальше защищает список выполненных импортов
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const safeTheme = THEMES.includes(theme) ? theme : "light";

  // immersive-режим Главной: декоративный fluid-фон под шапкой и hero-блоком,
  // шапка прозрачная и становится «стеклом» только после прокрутки
  const immersive = !page && tab === "home";
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!immersive) return undefined;
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [immersive]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", safeTheme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_META[safeTheme].meta);
  }, [safeTheme]);

  // максимальный известный пробег по всем записям: свежая запись ТО может
  // быть позже последней заправки
  const currentKm = useMemo(
    () =>
      Math.max(
        0,
        ...fuel.map((f) => f.km || 0),
        ...service.map((s) => s.km || 0)
      ),
    [fuel, service]
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
  const closePage = useCallback(() => {
    setPage(null);
    setVehicleSection(null);
  }, []);
  const focused = useCallback(() => setFocus(null), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  // внутренняя страница открывается с начала. Эффект родителя срабатывает
  // после очистки эффектов шторки, которая возвращает прокрутку фона.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  const drawerSelect = useCallback(
    (id) => (id === "vehicle" || id === "settings" ? openPage(id) : goTab(id)),
    [openPage, goTab]
  );

  /**
   * Переход из глобального поиска: журналы получают год записи и id для
   * прокрутки, задачи — id, характеристика автомобиля — нужную секцию.
   */
  const openSearchResult = useCallback(
    (target) => {
      setSearchOpen(false);
      if (target.type === "vehicle") {
        setVehicleSection(target.section);
        openPage("vehicle");
        return;
      }
      if (target.date) setYear(target.date.slice(0, 4));
      setFocus({ id: target.id });
      goTab(target.type === "reminder" ? "reminders" : target.type);
    },
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
   * Если задача создана из сервисной записи, вид работ и категория берутся
   * из неё: название задачи («Заменить моторное масло 0W-20») — это
   * формулировка задачи, а не вид работ.
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
        form: { type: source?.type || reminder.title, category },
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
    removePhoto().catch(() => {});
  }, [setFuel, setService, setReminders, setVehicle, removePhoto]);

  const drawerActive = page || tab;

  return (
    <div className={`app ${immersive ? "app--immersive" : ""}`}>
      {immersive && (
        <div className="home-ambient" aria-hidden="true">
          {/* WebGL «жидкая ткань»; если не активируется — ниже остаются CSS-ribbons */}
          <HeroCanvas theme={safeTheme} />
          <span className="ambient-glow glow-1" />
          <span className="ambient-glow glow-2" />
          <span className="ambient-ribbon ribbon-a" />
          <span className="ambient-ribbon ribbon-b" />
          <span className="ambient-ribbon ribbon-c" />
        </div>
      )}
      {page === "vehicle" && (
        <VehiclePage
          vehicle={vehicle}
          setVehicle={setVehicle}
          photo={photo}
          service={service}
          reminders={reminders}
          currentKm={currentKm}
          initialSection={vehicleSection}
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
          <Header
            title="Lexcar"
            immersive={immersive}
            scrolled={immersive && scrolled}
            onMenu={() => setDrawerOpen(true)}
            onSearch={() => setSearchOpen(true)}
          />

          {tab === "home" && (
            <HomeTab
              fuel={fuel}
              service={service}
              reminders={reminders}
              currentKm={currentKm}
              vehicle={vehicle}
              photoUrl={photo.url}
              onGo={goTab}
              onOpenVehicle={() => openPage("vehicle")}
            />
          )}
          {tab === "fuel" && (
            <FuelTab
              fuel={fuel}
              setFuel={setFuel}
              year={year}
              onYear={setYear}
              focus={focus}
              onFocused={focused}
            />
          )}
          {tab === "charts" && <ChartsTab fuel={fuel} service={service} theme={safeTheme} />}
          {tab === "service" && (
            <ServiceTab
              service={service}
              setService={setService}
              reminders={reminders}
              setReminders={setReminders}
              currentKm={currentKm}
              oilGrade={vehicle.oil?.grade || ""}
              year={year}
              onYear={setYear}
              draft={serviceDraft}
              onDraftUsed={() => setServiceDraft(null)}
              focus={focus}
              onFocused={focused}
            />
          )}
          {tab === "reminders" && (
            <RemindersTab
              reminders={reminders}
              setReminders={setReminders}
              service={service}
              currentKm={currentKm}
              onComplete={completeReminder}
              focus={focus}
              onFocused={focused}
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
        photoUrl={photo.url}
        currentKm={currentKm}
        version={APP_VERSION}
      />

      {searchOpen && (
        <GlobalSearch
          fuel={fuel}
          service={service}
          reminders={reminders}
          vehicle={vehicle}
          currentKm={currentKm}
          onClose={closeSearch}
          onOpen={openSearchResult}
        />
      )}
    </div>
  );
}
