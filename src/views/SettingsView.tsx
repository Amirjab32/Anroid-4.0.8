import { useState, useEffect, useMemo } from "react";
import {
  Settings,
  LayoutGrid,
  Palette,
  Flame,
  Bell,
  Database,
  Search,
  Check,
  ExternalLink,
  Play,
  Sun,
  Moon,
  RotateCcw,
  AlertCircle,
  X,
  EyeOff,
  LucideIcon,
} from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import { useThemeStyles } from "@/lib/useThemeStyles";
import { NAV_ITEMS, MainNavId } from "@/lib/navigation";
import {
  APP_SETTINGS_EVENT,
  AppSettings,
  AppSettingsService,
} from "@/lib/appSettings";
import {
  MotivationStore,
  SrsReminderSettings,
  SrsReminderStore,
  markLocalModified,
} from "@/lib/store";
import { IRAN_PROVINCES, PrayerSettingsService } from "@/lib/prayerTimes";
import { DEFAULT_CLOUDFLARE_URL } from "@/lib/sync";
import {
  getNotificationPermission,
  requestNotificationPermission,
} from "@/lib/notifications";
import { toPersianDigits } from "@/lib/shamsi";
import ShamsiDatePicker from "@/components/shared/ShamsiDatePicker";

interface Props {
  onNavigateView: (view: string) => void;
  onOpenBackup: () => void;
}

type CategoryId =
  | "general"
  | "menu"
  | "theme"
  | "motivation"
  | "reminders"
  | "sync";

interface CategoryDef {
  id: CategoryId;
  label: string;
  icon: LucideIcon;
  keywords: string[];
}

const CATEGORIES: CategoryDef[] = [
  {
    id: "general",
    label: "عمومی",
    icon: Settings,
    keywords: [
      "عمومی",
      "صفحه شروع",
      "پیش فرض",
      "پیش‌فرض",
      "اوقات شرعی",
      "نوار",
      "حالت اطمینان",
      "حذف امن",
      "بازنشانی",
    ],
  },
  {
    id: "menu",
    label: "منوی همبرگری",
    icon: LayoutGrid,
    keywords: [
      "منو",
      "همبرگری",
      "بخش",
      "مخفی",
      "پنهان",
      ...NAV_ITEMS.map((item) => item.label),
    ],
  },
  {
    id: "theme",
    label: "ظاهر و تم",
    icon: Palette,
    keywords: ["ظاهر", "تم", "تیره", "روشن", "رنگ", "پوسته"],
  },
  {
    id: "motivation",
    label: "انگیزه و هدف‌ها",
    icon: Flame,
    keywords: [
      "انگیزه",
      "انگیزشی",
      "کنکور",
      "امتحانات",
      "نهایی",
      "تاریخ",
      "روزشمار",
      "شروع خودکار",
    ],
  },
  {
    id: "reminders",
    label: "اوقات و یادآور",
    icon: Bell,
    keywords: [
      "نماز",
      "اوقات شرعی",
      "استان",
      "شهر",
      "تعدیل",
      "یادآور",
      "مرور فاصله‌دار",
      "ساعت",
    ],
  },
  {
    id: "sync",
    label: "همگام‌سازی و بکاپ",
    icon: Database,
    keywords: [
      "سرور",
      "همگام",
      "بکاپ",
      "پشتیبان",
      "آدرس",
      "انتقال",
      "لپ‌تاپ",
    ],
  },
];

function SettingCheckbox({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  description?: string;
}) {
  const { isDark, fg, fgMuted } = useThemeStyles();
  const uncheckedBg = isDark ? "rgba(255,255,255,0.05)" : "#ffffff";
  const uncheckedBorder = isDark ? "rgba(255,255,255,0.26)" : "rgba(0,0,0,0.28)";

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="flex items-start gap-2.5 text-right cursor-pointer group py-0.5 select-none"
    >
      <span
        className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-colors"
        style={{
          backgroundColor: checked ? "#2589f5" : uncheckedBg,
          borderColor: checked ? "#2589f5" : uncheckedBorder,
          color: "#ffffff",
        }}
      >
        {checked && <Check className="h-3.5 w-3.5 stroke-[2.75]" />}
      </span>
      <span className="flex flex-col">
        <span className="text-[13px] font-medium leading-snug" style={{ color: fg }}>
          {label}
        </span>
        {description && (
          <span className="text-[11px] mt-0.5 leading-relaxed" style={{ color: fgMuted }}>
            {description}
          </span>
        )}
      </span>
    </button>
  );
}

export default function SettingsView({ onNavigateView, onOpenBackup }: Props) {
  const { theme, toggleTheme } = useTheme();
  const { isDark, bg, fg, fgMuted, cardBorder } = useThemeStyles();

  const [activeCategory, setActiveCategory] = useState<CategoryId>("general");
  const [searchQuery, setSearchQuery] = useState("");

  const [appSettings, setAppSettings] = useState<AppSettings>(() =>
    AppSettingsService.get()
  );
  const [safeMode, setSafeMode] = useState<boolean>(() => {
    return localStorage.getItem("focusflow_safe_mode") !== "false";
  });
  const [konkurDate, setKonkurDate] = useState<string>(() =>
    MotivationStore.getKonkurDate()
  );
  const [finalExamsDate, setFinalExamsDate] = useState<string>(() =>
    MotivationStore.getFinalExamsDate()
  );
  const [province, setProvince] = useState<string>(() =>
    PrayerSettingsService.getProvince()
  );
  const [city, setCity] = useState<string>(() =>
    PrayerSettingsService.getCity()
  );
  const [prayerOffset, setPrayerOffset] = useState<number>(() =>
    PrayerSettingsService.getOffset()
  );
  const [srsReminder, setSrsReminder] = useState<SrsReminderSettings>(() =>
    SrsReminderStore.get()
  );
  const [serverUrl, setServerUrl] = useState<string>(() => {
    return localStorage.getItem("focusflow_server_url") || "";
  });

  const [menuGuardNotice, setMenuGuardNotice] = useState<string | null>(null);
  const [serverFeedback, setServerFeedback] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDoneMsg, setResetDoneMsg] = useState(false);

  useEffect(() => {
    const syncAppSettings = () => setAppSettings(AppSettingsService.get());
    const syncSafeMode = () =>
      setSafeMode(localStorage.getItem("focusflow_safe_mode") !== "false");
    const syncMotivation = () => {
      setKonkurDate(MotivationStore.getKonkurDate());
      setFinalExamsDate(MotivationStore.getFinalExamsDate());
    };
    const syncPrayer = () => {
      setProvince(PrayerSettingsService.getProvince());
      setCity(PrayerSettingsService.getCity());
      setPrayerOffset(PrayerSettingsService.getOffset());
    };
    const syncSrs = () => setSrsReminder(SrsReminderStore.get());
    const syncAll = () => {
      syncAppSettings();
      syncSafeMode();
      syncMotivation();
      syncPrayer();
      syncSrs();
    };

    window.addEventListener(APP_SETTINGS_EVENT, syncAppSettings);
    window.addEventListener("safe-mode-changed", syncSafeMode);
    window.addEventListener("motivation-updated", syncMotivation);
    window.addEventListener("focusflow-prayer-settings-changed", syncPrayer);
    window.addEventListener("focusflow-srs-reminder-changed", syncSrs);
    window.addEventListener("focusflow-db-synced", syncAll);

    return () => {
      window.removeEventListener(APP_SETTINGS_EVENT, syncAppSettings);
      window.removeEventListener("safe-mode-changed", syncSafeMode);
      window.removeEventListener("motivation-updated", syncMotivation);
      window.removeEventListener("focusflow-prayer-settings-changed", syncPrayer);
      window.removeEventListener("focusflow-srs-reminder-changed", syncSrs);
      window.removeEventListener("focusflow-db-synced", syncAll);
    };
  }, []);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !appSettings.hiddenMenuIds.includes(item.id)
  );
  const hiddenItems = NAV_ITEMS.filter((item) =>
    appSettings.hiddenMenuIds.includes(item.id)
  );
  const provinceCities = PrayerSettingsService.getCitiesByProvince(province);

  const normalizedSearch = searchQuery.trim();
  const matchingCategories = useMemo(() => {
    if (!normalizedSearch) return CATEGORIES;
    return CATEGORIES.filter(
      (cat) =>
        cat.label.includes(normalizedSearch) ||
        cat.keywords.some((kw) => kw.includes(normalizedSearch))
    );
  }, [normalizedSearch]);

  useEffect(() => {
    if (
      normalizedSearch &&
      matchingCategories.length > 0 &&
      !matchingCategories.some((c) => c.id === activeCategory)
    ) {
      setActiveCategory(matchingCategories[0].id);
    }
  }, [normalizedSearch, matchingCategories, activeCategory]);

  const handleToggleMenuSection = (id: MainNavId) => {
    const result = AppSettingsService.toggleMenuSection(id);
    if (!result.changed && result.reason === "last_visible") {
      setMenuGuardNotice("حداقل یک بخش باید در منوی همبرگری فعال بماند.");
      setTimeout(() => setMenuGuardNotice(null), 4000);
      return;
    }
    setMenuGuardNotice(null);
    setAppSettings(result.settings);
  };

  const handleStartViewChange = (nextView: MainNavId) => {
    setAppSettings(AppSettingsService.update({ defaultStartView: nextView }));
  };

  const handleTogglePrayerBar = () => {
    setAppSettings(
      AppSettingsService.update({ showPrayerBar: !appSettings.showPrayerBar })
    );
  };

  const handleToggleAutoIntro = () => {
    setAppSettings(
      AppSettingsService.update({ autoShowIntro: !appSettings.autoShowIntro })
    );
  };

  const handleToggleSafeMode = () => {
    const next = !safeMode;
    setSafeMode(next);
    localStorage.setItem("focusflow_safe_mode", String(next));
    markLocalModified();
    window.dispatchEvent(
      new CustomEvent("safe-mode-changed", { detail: { enabled: next } })
    );
    window.dispatchEvent(
      new CustomEvent("focusflow-data-changed", {
        detail: { key: "focusflow_safe_mode" },
      })
    );
  };

  const handleThemeSwitch = (target: "dark" | "light") => {
    if (theme !== target) {
      toggleTheme();
      markLocalModified();
      window.dispatchEvent(
        new CustomEvent("focusflow-data-changed", {
          detail: { key: "focusflow-theme" },
        })
      );
    }
  };

  const handleProvinceChange = (nextProvince: string) => {
    PrayerSettingsService.setProvince(nextProvince);
    setProvince(PrayerSettingsService.getProvince());
    setCity(PrayerSettingsService.getCity());
  };

  const handleCityChange = (nextCity: string) => {
    PrayerSettingsService.setCity(nextCity);
    setCity(nextCity);
  };

  const handleOffsetChange = (delta: number) => {
    const next = Math.max(-30, Math.min(30, prayerOffset + delta));
    PrayerSettingsService.setOffset(next);
    setPrayerOffset(next);
  };

  const handleToggleSrsReminder = async () => {
    if (!srsReminder.enabled) {
      if (getNotificationPermission() !== "granted") {
        await requestNotificationPermission();
      }
      setSrsReminder(SrsReminderStore.save({ enabled: true }));
    } else {
      setSrsReminder(SrsReminderStore.save({ enabled: false }));
    }
  };

  const handleSrsTimeChange = (time: string) => {
    if (!time) return;
    setSrsReminder(SrsReminderStore.save({ time }));
  };

  const handleSaveServerUrl = () => {
    const trimmed = serverUrl.trim().replace(/\/+$/, "");
    if (trimmed) {
      localStorage.setItem("focusflow_server_url", trimmed);
      setServerUrl(trimmed);
      setServerFeedback("آدرس سرور ذخیره شد.");
    } else {
      localStorage.removeItem("focusflow_server_url");
      setServerUrl("");
      setServerFeedback("آدرس پیش‌فرض سرور فعال شد.");
    }
    setTimeout(() => setServerFeedback(null), 3500);
  };

  const handleResetServerUrl = () => {
    localStorage.removeItem("focusflow_server_url");
    setServerUrl("");
    setServerFeedback("آدرس سرور به حالت پیش‌فرض بازگشت.");
    setTimeout(() => setServerFeedback(null), 3500);
  };

  const handleResetSettings = () => {
    setAppSettings(AppSettingsService.reset());
    setConfirmReset(false);
    setResetDoneMsg(true);
    setTimeout(() => setResetDoneMsg(false), 3500);
  };

  // Palette tuned to match the ShareX desktop settings window while preserving light & dark parity
  const windowBorder = isDark ? "rgba(255,255,255,0.09)" : cardBorder;
  const sidebarSurface = isDark ? "#18181b" : "#f4f4f6";
  const contentSurface = isDark ? "#1f1f22" : "#ffffff";
  const groupSurface = isDark ? "#252529" : "#fafafa";
  const controlSurface = isDark ? "#2c2c31" : "#ffffff";
  const accentBlue = isDark ? "#3898ff" : "#0f6cbd";
  const activeNavBg = "#0f6cbd";

  const currentCategoryDef =
    CATEGORIES.find((c) => c.id === activeCategory) || CATEGORIES[0];
  const ActiveHeaderIcon = currentCategoryDef.icon;

  return (
    <div dir="rtl" className="pb-10">
      {/* Hidden accessible h1 for top-level document heading */}
      <h1 className="sr-only">تنظیمات</h1>

      <div
        className="rounded-xl border overflow-hidden flex flex-col md:flex-row min-h-[560px]"
        style={{
          borderColor: windowBorder,
          backgroundColor: contentSurface,
        }}
      >
        {/* Right Sidebar Category Menu (first child in RTL renders on the right) */}
        <aside
          className="w-full md:w-60 shrink-0 border-b md:border-b-0 md:border-l p-3 flex flex-col gap-3"
          style={{
            backgroundColor: sidebarSurface,
            borderColor: windowBorder,
          }}
        >
          {/* Search box */}
          <div className="relative">
            <Search
              className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: fgMuted }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در تنظیمات..."
              aria-label="جستجو در تنظیمات"
              className="w-full rounded-lg pr-9 pl-8 py-2 text-xs border outline-none focus:ring-2 focus:ring-sky-500/60"
              style={{
                backgroundColor: controlSurface,
                borderColor: windowBorder,
                color: fg,
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="پاک کردن جستجو"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/10 cursor-pointer"
                style={{ color: fgMuted }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Vertical category menu (horizontal scrollable strip on narrow screens) */}
          <nav
            aria-label="دسته‌بندی تنظیمات"
            className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0"
          >
            {matchingCategories.length === 0 ? (
              <div className="px-3 py-2 text-xs" style={{ color: fgMuted }}>
                موردی یافت نشد
              </div>
            ) : (
              matchingCategories.map((cat) => {
                const Icon = cat.icon;
                const isActive = cat.id === activeCategory;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    data-settings-category={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors cursor-pointer shrink-0 md:w-full text-right ${
                      isActive ? "" : "hover:bg-white/5"
                    }`}
                    style={
                      isActive
                        ? { backgroundColor: activeNavBg, color: "#ffffff" }
                        : { color: isDark ? "#d4d4d8" : "#3f3f46" }
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })
            )}
          </nav>
        </aside>

        {/* Left Settings Content Pane */}
        <div className="flex-1 min-w-0 p-4 sm:p-6 space-y-5">
          {/* Category Page Heading */}
          <div className="flex items-center justify-between gap-3">
            <div
              className="flex items-center gap-2 text-lg font-bold"
              style={{ color: accentBlue }}
            >
              <ActiveHeaderIcon className="h-5 w-5 shrink-0" />
              <h2>{currentCategoryDef.label}</h2>
            </div>

            {activeCategory === "menu" && (
              <span
                className="text-xs font-medium tabular-nums"
                style={{ color: fgMuted }}
              >
                {toPersianDigits(visibleItems.length)} از{" "}
                {toPersianDigits(NAV_ITEMS.length)} فعال
              </span>
            )}
          </div>

          {/* 1. General Category */}
          {activeCategory === "general" && (
            <div className="space-y-4">
              <section
                className="rounded-lg border p-4 sm:p-5 space-y-4"
                style={{
                  backgroundColor: groupSurface,
                  borderColor: windowBorder,
                }}
              >
                <h3 className="text-sm font-bold" style={{ color: fg }}>
                  برنامه و صفحه شروع
                </h3>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <label
                    htmlFor="settings-default-start-view"
                    className="text-[13px] sm:w-44 shrink-0"
                    style={{ color: fg }}
                  >
                    صفحه شروع پیش‌فرض:
                  </label>
                  <select
                    id="settings-default-start-view"
                    value={appSettings.defaultStartView}
                    onChange={(e) =>
                      handleStartViewChange(e.target.value as MainNavId)
                    }
                    className="w-full sm:w-64 rounded-md px-3 py-1.5 text-[13px] border outline-none focus:ring-2 focus:ring-sky-500/60 cursor-pointer"
                    style={{
                      backgroundColor: controlSurface,
                      borderColor: windowBorder,
                      color: fg,
                    }}
                  >
                    {visibleItems.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        style={{ backgroundColor: bg, color: fg }}
                      >
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2.5 pt-1">
                  <SettingCheckbox
                    checked={appSettings.showPrayerBar}
                    onChange={handleTogglePrayerBar}
                    label="نمایش نوار اوقات شرعی"
                    description="نمایش نوار زمان نماز بعدی و تایم‌لاین اوقات شرعی در بالای صفحه"
                  />
                  <SettingCheckbox
                    checked={safeMode}
                    onChange={handleToggleSafeMode}
                    label="حالت اطمینان (تایید پیش از حذف)"
                    description="درخواست تایید پیش از حذف تسک‌ها، عادت‌ها و یادداشت‌ها"
                  />
                </div>
              </section>

              <section
                className="rounded-lg border p-4 sm:p-5 space-y-3"
                style={{
                  backgroundColor: groupSurface,
                  borderColor: windowBorder,
                }}
              >
                <h3 className="text-sm font-bold" style={{ color: fg }}>
                  بازنشانی
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: fgMuted }}>
                  بازگردانی نمایش بخش‌های منو، صفحه شروع، نوار اوقات شرعی و نمایش خودکار صفحه انگیزشی به تنظیمات پیش‌فرض.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {!confirmReset ? (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold border transition-colors hover:bg-white/5 cursor-pointer"
                      style={{
                        backgroundColor: controlSurface,
                        borderColor: windowBorder,
                        color: fg,
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>بازنشانی تنظیمات پیش‌فرض...</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleResetSettings}
                        className="rounded-md bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer"
                      >
                        تایید بازنشانی
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="rounded-md px-3 py-2 text-xs font-semibold border transition-colors hover:bg-white/5 cursor-pointer"
                        style={{
                          backgroundColor: controlSurface,
                          borderColor: windowBorder,
                          color: fg,
                        }}
                      >
                        انصراف
                      </button>
                    </>
                  )}
                  {resetDoneMsg && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500">
                      <Check className="h-3.5 w-3.5" />
                      بازنشانی انجام شد
                    </span>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* 2. Hamburger Menu Management Category */}
          {activeCategory === "menu" && (
            <div className="space-y-4">
              <section
                className="rounded-lg border p-4 sm:p-5 space-y-3.5"
                style={{
                  backgroundColor: groupSurface,
                  borderColor: windowBorder,
                }}
              >
                <div>
                  <h3 className="text-sm font-bold" style={{ color: fg }}>
                    بخش‌های نمایش‌داده‌شده در منوی همبرگری
                  </h3>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: fgMuted }}>
                    تیک هر بخش را بردارید تا فقط از منوی همبرگری مخفی شود؛ اطلاعات شما حفظ شده و از همین لیست یا بخش زیر قابل باز کردن است.
                  </p>
                </div>

                {menuGuardNotice && (
                  <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{menuGuardNotice}</span>
                  </div>
                )}

                <div className="divide-y" style={{ borderColor: windowBorder }}>
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isHidden = appSettings.hiddenMenuIds.includes(item.id);
                    const isChecked = !isHidden;

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 py-2.5 first:pt-1 last:pb-1"
                        style={{ borderColor: windowBorder }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <SettingCheckbox
                            checked={isChecked}
                            onChange={() => handleToggleMenuSection(item.id)}
                            label={`نمایش ${item.label} در منو`}
                          />
                          <Icon
                            className="h-3.5 w-3.5 shrink-0 hidden sm:block"
                            style={{ color: fgMuted }}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => onNavigateView(item.id)}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold border transition-colors hover:bg-white/5 cursor-pointer shrink-0"
                          style={{
                            backgroundColor: controlSurface,
                            borderColor: windowBorder,
                            color: isHidden ? accentBlue : fgMuted,
                          }}
                        >
                          <span>باز کردن</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              {hiddenItems.length > 0 && (
                <section
                  className="rounded-lg border p-4 sm:p-5 space-y-3"
                  style={{
                    backgroundColor: groupSurface,
                    borderColor: windowBorder,
                  }}
                >
                  <div className="flex items-center gap-2 text-sm font-bold" style={{ color: fg }}>
                    <EyeOff className="h-4 w-4 text-amber-400" />
                    <span>
                      بخش‌های پنهان‌شده ({toPersianDigits(hiddenItems.length)})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hiddenItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 rounded-md px-3 py-1.5 border text-xs"
                          style={{
                            borderColor: windowBorder,
                            backgroundColor: controlSurface,
                          }}
                        >
                          <Icon
                            className="h-3.5 w-3.5 shrink-0"
                            style={{ color: accentBlue }}
                          />
                          <span className="font-semibold" style={{ color: fg }}>
                            {item.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => onNavigateView(item.id)}
                            className="rounded px-2 py-0.5 text-[11px] font-bold text-white cursor-pointer"
                            style={{ backgroundColor: activeNavBg }}
                          >
                            ورود
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleMenuSection(item.id)}
                            className="rounded px-1.5 py-0.5 text-[11px] font-semibold hover:bg-white/10 cursor-pointer"
                            style={{ color: fgMuted }}
                          >
                            بازگردانی
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* 3. Theme & Appearance Category */}
          {activeCategory === "theme" && (
            <div className="space-y-4">
              <section
                className="rounded-lg border p-4 sm:p-5 space-y-4"
                style={{
                  backgroundColor: groupSurface,
                  borderColor: windowBorder,
                }}
              >
                <h3 className="text-sm font-bold" style={{ color: fg }}>
                  انتخاب پوسته ظاهری
                </h3>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <span className="text-[13px] sm:w-44 shrink-0" style={{ color: fg }}>
                    تم برنامه:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleThemeSwitch("dark")}
                      className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold border transition-colors cursor-pointer"
                      style={
                        theme === "dark"
                          ? {
                              backgroundColor: activeNavBg,
                              borderColor: activeNavBg,
                              color: "#ffffff",
                            }
                          : {
                              backgroundColor: controlSurface,
                              borderColor: windowBorder,
                              color: fgMuted,
                            }
                      }
                    >
                      <Moon className="h-3.5 w-3.5" />
                      <span>حالت تیره</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleThemeSwitch("light")}
                      className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold border transition-colors cursor-pointer"
                      style={
                        theme === "light"
                          ? {
                              backgroundColor: activeNavBg,
                              borderColor: activeNavBg,
                              color: "#ffffff",
                            }
                          : {
                              backgroundColor: controlSurface,
                              borderColor: windowBorder,
                              color: fgMuted,
                            }
                      }
                    >
                      <Sun className="h-3.5 w-3.5" />
                      <span>حالت روشن</span>
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* 4. Motivation & Target Dates Category */}
          {activeCategory === "motivation" && (
            <div className="space-y-4">
              <section
                className="rounded-lg border p-4 sm:p-5 space-y-3.5"
                style={{
                  backgroundColor: groupSurface,
                  borderColor: windowBorder,
                }}
              >
                <h3 className="text-sm font-bold" style={{ color: fg }}>
                  صفحه شروع انگیزشی
                </h3>

                <SettingCheckbox
                  checked={appSettings.autoShowIntro}
                  onChange={handleToggleAutoIntro}
                  label="نمایش خودکار صفحه انگیزشی (هر ۳ ساعت)"
                  description="در صورت غیرفعال کردن، صفحه انگیزشی به صورت خودکار باز نمی‌شود ولی همچنان به صورت دستی قابل اجرا است"
                />

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(new CustomEvent("trigger-intro-overlay"))
                    }
                    className="inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold border transition-colors hover:bg-white/5 cursor-pointer"
                    style={{
                      backgroundColor: controlSurface,
                      borderColor: windowBorder,
                      color: fg,
                    }}
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>اجرای فوری صفحه انگیزشی</span>
                  </button>
                </div>
              </section>

              <section
                className="rounded-lg border p-4 sm:p-5 space-y-4"
                style={{
                  backgroundColor: groupSurface,
                  borderColor: windowBorder,
                }}
              >
                <h3 className="text-sm font-bold" style={{ color: fg }}>
                  تاریخ‌های هدف
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ShamsiDatePicker
                    label="تاریخ کنکور سراسری"
                    value={konkurDate}
                    onChange={(val) => {
                      setKonkurDate(val);
                      MotivationStore.setKonkurDate(val);
                    }}
                    accentColorClass="indigo"
                  />
                  <ShamsiDatePicker
                    label="تاریخ امتحانات نهایی"
                    value={finalExamsDate}
                    onChange={(val) => {
                      setFinalExamsDate(val);
                      MotivationStore.setFinalExamsDate(val);
                    }}
                    accentColorClass="amber"
                  />
                </div>
              </section>
            </div>
          )}

          {/* 5. Prayer Times & SRS Reminder Category */}
          {activeCategory === "reminders" && (
            <div className="space-y-4">
              <section
                className="rounded-lg border p-4 sm:p-5 space-y-4"
                style={{
                  backgroundColor: groupSurface,
                  borderColor: windowBorder,
                }}
              >
                <h3 className="text-sm font-bold" style={{ color: fg }}>
                  موقعیت و زمان اوقات شرعی
                </h3>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <label
                    htmlFor="settings-prayer-province"
                    className="text-[13px] sm:w-44 shrink-0"
                    style={{ color: fg }}
                  >
                    استان:
                  </label>
                  <select
                    id="settings-prayer-province"
                    value={province}
                    onChange={(e) => handleProvinceChange(e.target.value)}
                    className="w-full sm:w-64 rounded-md px-3 py-1.5 text-[13px] border outline-none focus:ring-2 focus:ring-sky-500/60 cursor-pointer"
                    style={{
                      backgroundColor: controlSurface,
                      borderColor: windowBorder,
                      color: fg,
                    }}
                  >
                    {IRAN_PROVINCES.map((p) => (
                      <option
                        key={p}
                        value={p}
                        style={{ backgroundColor: bg, color: fg }}
                      >
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <label
                    htmlFor="settings-prayer-city"
                    className="text-[13px] sm:w-44 shrink-0"
                    style={{ color: fg }}
                  >
                    شهر:
                  </label>
                  <select
                    id="settings-prayer-city"
                    value={city}
                    onChange={(e) => handleCityChange(e.target.value)}
                    className="w-full sm:w-64 rounded-md px-3 py-1.5 text-[13px] border outline-none focus:ring-2 focus:ring-sky-500/60 cursor-pointer"
                    style={{
                      backgroundColor: controlSurface,
                      borderColor: windowBorder,
                      color: fg,
                    }}
                  >
                    {provinceCities.map((c) => (
                      <option
                        key={c.name}
                        value={c.name}
                        style={{ backgroundColor: bg, color: fg }}
                      >
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <span className="text-[13px] sm:w-44 shrink-0" style={{ color: fg }}>
                    تعدیل دستی زمان (دقیقه):
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOffsetChange(-1)}
                      aria-label="کاهش یک دقیقه"
                      className="h-8 w-8 rounded-md border text-sm font-bold transition-colors hover:bg-white/10 cursor-pointer"
                      style={{
                        backgroundColor: controlSurface,
                        borderColor: windowBorder,
                        color: fg,
                      }}
                    >
                      -
                    </button>
                    <span
                      className="min-w-[3rem] text-center text-sm font-bold tabular-nums"
                      style={{ color: fg }}
                    >
                      {prayerOffset > 0
                        ? `+${toPersianDigits(prayerOffset)}`
                        : toPersianDigits(prayerOffset)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOffsetChange(1)}
                      aria-label="افزایش یک دقیقه"
                      className="h-8 w-8 rounded-md border text-sm font-bold transition-colors hover:bg-white/10 cursor-pointer"
                      style={{
                        backgroundColor: controlSurface,
                        borderColor: windowBorder,
                        color: fg,
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </section>

              <section
                className="rounded-lg border p-4 sm:p-5 space-y-4"
                style={{
                  backgroundColor: groupSurface,
                  borderColor: windowBorder,
                }}
              >
                <h3 className="text-sm font-bold" style={{ color: fg }}>
                  یادآور مرور فاصله‌دار
                </h3>

                <SettingCheckbox
                  checked={Boolean(srsReminder.enabled)}
                  onChange={handleToggleSrsReminder}
                  label="فعال‌سازی یادآور روزانه مرور فاصله‌دار"
                />

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <label
                    htmlFor="settings-srs-time"
                    className="text-[13px] sm:w-44 shrink-0"
                    style={{ color: fg }}
                  >
                    ساعت یادآوری:
                  </label>
                  <input
                    id="settings-srs-time"
                    type="time"
                    dir="ltr"
                    value={srsReminder.time || "20:00"}
                    onChange={(e) => handleSrsTimeChange(e.target.value)}
                    className="w-full sm:w-44 rounded-md px-3 py-1.5 text-[13px] border outline-none focus:ring-2 focus:ring-sky-500/60 tabular-nums"
                    style={{
                      backgroundColor: controlSurface,
                      borderColor: windowBorder,
                      color: fg,
                    }}
                  />
                </div>
              </section>
            </div>
          )}

          {/* 6. Sync & Backup Category */}
          {activeCategory === "sync" && (
            <div className="space-y-4">
              <section
                className="rounded-lg border p-4 sm:p-5 space-y-4"
                style={{
                  backgroundColor: groupSurface,
                  borderColor: windowBorder,
                }}
              >
                <h3 className="text-sm font-bold" style={{ color: fg }}>
                  آدرس سرور همگام‌سازی اختصاصی
                </h3>

                <div className="space-y-2.5">
                  <label
                    htmlFor="settings-server-url"
                    className="block text-xs"
                    style={{ color: fgMuted }}
                  >
                    در صورت استفاده از سرور دلخواه آدرس را وارد کنید (اختیاری):
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="settings-server-url"
                      type="url"
                      dir="ltr"
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                      placeholder={DEFAULT_CLOUDFLARE_URL}
                      className="flex-1 rounded-md px-3 py-1.5 text-[13px] border outline-none focus:ring-2 focus:ring-sky-500/60"
                      style={{
                        backgroundColor: controlSurface,
                        borderColor: windowBorder,
                        color: fg,
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSaveServerUrl}
                      className="rounded-md text-white px-4 py-1.5 text-xs font-bold transition-colors cursor-pointer shrink-0"
                      style={{ backgroundColor: activeNavBg }}
                    >
                      ذخیره آدرس
                    </button>
                    <button
                      type="button"
                      onClick={handleResetServerUrl}
                      className="rounded-md px-3.5 py-1.5 text-xs font-semibold border transition-colors hover:bg-white/5 cursor-pointer shrink-0"
                      style={{
                        backgroundColor: controlSurface,
                        borderColor: windowBorder,
                        color: fgMuted,
                      }}
                    >
                      پیش‌فرض
                    </button>
                  </div>
                  {serverFeedback && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                      <Check className="h-3.5 w-3.5" />
                      <span>{serverFeedback}</span>
                    </div>
                  )}
                </div>
              </section>

              <section
                className="rounded-lg border p-4 sm:p-5 space-y-3"
                style={{
                  backgroundColor: groupSurface,
                  borderColor: windowBorder,
                }}
              >
                <h3 className="text-sm font-bold" style={{ color: fg }}>
                  مدیریت فایل‌های پشتیبان و انتقال بین دستگاه‌ها
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: fgMuted }}>
                  دریافت خروجی کامل، وارد کردن بکاپ دستی و همگام‌سازی وای‌فای با لپ‌تاپ.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={onOpenBackup}
                    className="inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold border transition-colors hover:bg-white/5 cursor-pointer"
                    style={{
                      backgroundColor: controlSurface,
                      borderColor: windowBorder,
                      color: fg,
                    }}
                  >
                    <Database className="h-3.5 w-3.5 text-amber-500" />
                    <span>باز کردن پشتیبان‌گیری و انتقال اطلاعات...</span>
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
