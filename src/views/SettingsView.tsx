import { useState, useEffect } from "react";
import {
  Settings,
  Eye,
  EyeOff,
  ExternalLink,
  Play,
  Sun,
  Moon,
  ShieldCheck,
  ShieldAlert,
  Compass,
  Bell,
  Database,
  RotateCcw,
  Check,
  AlertCircle,
  Home,
  Server,
  Clock,
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

function SettingSwitch({
  checked,
  onChange,
  label,
  disabled = false,
  accentColor = "#6366f1",
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
  accentColor?: string;
}) {
  const { isDark } = useThemeStyles();
  const trackOff = isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.18)";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      dir="ltr"
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      }`}
      style={{ backgroundColor: checked ? accentColor : trackOff }}
    >
      <span
        className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function SettingsView({ onNavigateView, onOpenBackup }: Props) {
  const { theme, toggleTheme } = useTheme();
  const { isDark, bg, fg, fgMuted, cardBg, cardBorder, inputBg } = useThemeStyles();

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
    const updated = AppSettingsService.update({ defaultStartView: nextView });
    setAppSettings(updated);
  };

  const handleTogglePrayerBar = () => {
    const updated = AppSettingsService.update({
      showPrayerBar: !appSettings.showPrayerBar,
    });
    setAppSettings(updated);
  };

  const handleToggleAutoIntro = () => {
    const updated = AppSettingsService.update({
      autoShowIntro: !appSettings.autoShowIntro,
    });
    setAppSettings(updated);
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
    const defaults = AppSettingsService.reset();
    setAppSettings(defaults);
    setConfirmReset(false);
    setResetDoneMsg(true);
    setTimeout(() => setResetDoneMsg(false), 3500);
  };

  const subtleSurface = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5"
        style={{ borderColor: cardBorder }}
      >
        <div className="flex items-start gap-3 text-right">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: fg }}>
              تنظیمات
            </h1>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: fgMuted }}>
              مدیریت بخش‌های منوی همبرگری، صفحه شروع، ظاهر برنامه، اوقات شرعی و همگام‌سازی بین دستگاه‌ها
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {resetDoneMsg && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500">
              <Check className="h-4 w-4" />
              بازنشانی انجام شد
            </span>
          )}
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold border transition-colors hover:bg-white/5 cursor-pointer"
              style={{ borderColor: cardBorder, color: fgMuted }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>بازنشانی تنظیمات</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetSettings}
                className="rounded-xl bg-rose-500 hover:bg-rose-600 text-white px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer"
              >
                تایید بازنشانی
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-xl px-3 py-2 text-xs font-semibold border transition-colors hover:bg-white/5 cursor-pointer"
                style={{ borderColor: cardBorder, color: fg }}
              >
                انصراف
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Section 1: Menu Sections Management */}
      <section
        className="rounded-2xl p-5 sm:p-6 border space-y-5"
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: fg }}>
              <Eye className="h-4 w-4 text-indigo-400" />
              <span>مدیریت بخش‌های منوی همبرگری</span>
            </h2>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: fgMuted }}>
              با خاموش کردن هر بخش، فقط از منوی همبرگری مخفی می‌شود و اطلاعات آن دست‌نخورده باقی می‌ماند. بخش‌های مخفی همیشه از همین صفحه قابل باز کردن هستند.
            </p>
          </div>
          <div
            className="text-xs font-semibold tabular-nums shrink-0"
            style={{ color: fgMuted }}
          >
            {toPersianDigits(visibleItems.length)} از {toPersianDigits(NAV_ITEMS.length)} بخش فعال در منو
          </div>
        </div>

        {menuGuardNotice && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{menuGuardNotice}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isHidden = appSettings.hiddenMenuIds.includes(item.id);
            const isLastVisible = !isHidden && visibleItems.length <= 1;

            return (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-3 rounded-xl p-4 border transition-colors"
                style={{
                  borderColor: isHidden
                    ? cardBorder
                    : isDark
                    ? "rgba(99,102,241,0.28)"
                    : "rgba(99,102,241,0.25)",
                  backgroundColor: isHidden ? subtleSurface : cardBg,
                  opacity: isHidden ? 0.85 : 1,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: isHidden
                          ? "rgba(128,128,128,0.12)"
                          : "rgba(99,102,241,0.14)",
                        color: isHidden ? fgMuted : "#818cf8",
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate" style={{ color: fg }}>
                        {item.label}
                      </div>
                      <p
                        className="text-[11px] leading-relaxed mt-0.5 line-clamp-2"
                        style={{ color: fgMuted }}
                      >
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <SettingSwitch
                    checked={!isHidden}
                    onChange={() => handleToggleMenuSection(item.id)}
                    label={`نمایش ${item.label} در منو`}
                    disabled={false}
                  />
                </div>

                <div
                  className="flex items-center justify-between pt-2 border-t text-[11px]"
                  style={{ borderColor: cardBorder }}
                >
                  <span style={{ color: isHidden ? fgMuted : "#818cf8" }}>
                    {isHidden
                      ? "مخفی از منوی همبرگری"
                      : isLastVisible
                      ? "تنها بخش فعال منو"
                      : "نمایش در منو"}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateView(item.id)}
                    className="inline-flex items-center gap-1 font-semibold hover:underline cursor-pointer text-indigo-400"
                  >
                    <span>باز کردن</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dedicated access bar for hidden sections */}
        {hiddenItems.length > 0 && (
          <div
            className="rounded-xl p-4 border space-y-3"
            style={{ borderColor: cardBorder, backgroundColor: subtleSurface }}
          >
            <div className="flex items-center gap-2 text-xs font-bold" style={{ color: fg }}>
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
                    className="flex items-center gap-2 rounded-xl px-3 py-2 border text-xs"
                    style={{ borderColor: cardBorder, backgroundColor: bg }}
                  >
                    <Icon className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    <span className="font-semibold" style={{ color: fg }}>
                      {item.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigateView(item.id)}
                      className="rounded-lg bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      ورود
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleMenuSection(item.id)}
                      className="rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-white/10 cursor-pointer"
                      style={{ color: fgMuted }}
                    >
                      بازگردانی به منو
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Section 2: Start Page & Motivation / Intro */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section
          className="rounded-2xl p-5 sm:p-6 border space-y-5"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
        >
          <div>
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: fg }}>
              <Home className="h-4 w-4 text-indigo-400" />
              <span>صفحه شروع و انگیزه</span>
            </h2>
            <p className="text-xs mt-1" style={{ color: fgMuted }}>
              تعیین صفحه پیش‌فرض هنگام باز کردن برنامه و تنظیمات روزشمار انگیزشی
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="settings-default-start-view"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: fg }}
              >
                صفحه شروع پیش‌فرض
              </label>
              <select
                id="settings-default-start-view"
                value={appSettings.defaultStartView}
                onChange={(e) => handleStartViewChange(e.target.value as MainNavId)}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm border outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                style={{ backgroundColor: inputBg, borderColor: cardBorder, color: fg }}
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
              <p className="text-[11px] mt-1" style={{ color: fgMuted }}>
                در صورت مخفی شدن صفحه شروع فعلی، اولین بخش فعال به عنوان صفحه شروع انتخاب می‌شود.
              </p>
            </div>

            <div
              className="flex items-center justify-between gap-4 rounded-xl p-3.5 border"
              style={{ borderColor: cardBorder, backgroundColor: subtleSurface }}
            >
              <div>
                <div className="text-sm font-semibold" style={{ color: fg }}>
                  نمایش خودکار صفحه انگیزشی
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: fgMuted }}>
                  پخش یادآور روزشمار کنکور و امتحانات هر ۳ ساعت یک‌بار
                </p>
              </div>
              <SettingSwitch
                checked={appSettings.autoShowIntro}
                onChange={handleToggleAutoIntro}
                label="نمایش خودکار صفحه انگیزشی"
              />
            </div>

            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("trigger-intro-overlay"))}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>اجرای فوری صفحه انگیزشی</span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
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
          </div>
        </section>

        {/* Section 3: Appearance & Workspace Safety */}
        <section
          className="rounded-2xl p-5 sm:p-6 border space-y-5"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
        >
          <div>
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: fg }}>
              {isDark ? (
                <Moon className="h-4 w-4 text-indigo-400" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500" />
              )}
              <span>ظاهر و فضای کاری</span>
            </h2>
            <p className="text-xs mt-1" style={{ color: fgMuted }}>
              شخصی‌سازی تم ظاهری، نوار بالایی اوقات شرعی و امنیت حذف داده‌ها
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold mb-2" style={{ color: fg }}>
                تم ظاهری برنامه
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleThemeSwitch("dark")}
                  className="flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold border transition-colors cursor-pointer"
                  style={{
                    borderColor: theme === "dark" ? "#6366f1" : cardBorder,
                    backgroundColor:
                      theme === "dark" ? "rgba(99,102,241,0.16)" : subtleSurface,
                    color: theme === "dark" ? "#818cf8" : fgMuted,
                  }}
                >
                  <Moon className="h-4 w-4" />
                  <span>حالت تیره</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeSwitch("light")}
                  className="flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold border transition-colors cursor-pointer"
                  style={{
                    borderColor: theme === "light" ? "#f59e0b" : cardBorder,
                    backgroundColor:
                      theme === "light" ? "rgba(245,158,11,0.14)" : subtleSurface,
                    color: theme === "light" ? "#d97706" : fgMuted,
                  }}
                >
                  <Sun className="h-4 w-4" />
                  <span>حالت روشن</span>
                </button>
              </div>
            </div>

            <div
              className="flex items-center justify-between gap-4 rounded-xl p-3.5 border"
              style={{ borderColor: cardBorder, backgroundColor: subtleSurface }}
            >
              <div>
                <div className="text-sm font-semibold" style={{ color: fg }}>
                  نوار اوقات شرعی در بالای صفحه
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: fgMuted }}>
                  نمایش زمان نماز بعدی و تایم‌لاین اوقات شرعی زیر نوار بالا
                </p>
              </div>
              <SettingSwitch
                checked={appSettings.showPrayerBar}
                onChange={handleTogglePrayerBar}
                label="نمایش نوار اوقات شرعی"
              />
            </div>

            <div
              className="flex items-center justify-between gap-4 rounded-xl p-3.5 border"
              style={{ borderColor: cardBorder, backgroundColor: subtleSurface }}
            >
              <div className="flex items-start gap-2.5">
                {safeMode ? (
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-sm font-semibold" style={{ color: fg }}>
                    حالت اطمینان (حذف امن)
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: fgMuted }}>
                    درخواست پنجره تایید پیش از حذف تسک‌ها، عادت‌ها و یادداشت‌ها
                  </p>
                </div>
              </div>
              <SettingSwitch
                checked={safeMode}
                onChange={handleToggleSafeMode}
                label="حالت اطمینان پیش از حذف"
                accentColor="#10b981"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Section 4: Prayer Times & SRS Reminder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section
          className="rounded-2xl p-5 sm:p-6 border space-y-5"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
        >
          <div>
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: fg }}>
              <Compass className="h-4 w-4 text-emerald-400" />
              <span>تنظیمات اوقات شرعی</span>
            </h2>
            <p className="text-xs mt-1" style={{ color: fgMuted }}>
              انتخاب استان، شهر و دقیقه‌ی تعدیل برای محاسبه دقیق اوقات نماز
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="settings-prayer-province"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: fg }}
              >
                استان
              </label>
              <select
                id="settings-prayer-province"
                value={province}
                onChange={(e) => handleProvinceChange(e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm border outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                style={{ backgroundColor: inputBg, borderColor: cardBorder, color: fg }}
              >
                {IRAN_PROVINCES.map((p) => (
                  <option key={p} value={p} style={{ backgroundColor: bg, color: fg }}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="settings-prayer-city"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: fg }}
              >
                شهر
              </label>
              <select
                id="settings-prayer-city"
                value={city}
                onChange={(e) => handleCityChange(e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm border outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                style={{ backgroundColor: inputBg, borderColor: cardBorder, color: fg }}
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
          </div>

          <div
            className="flex items-center justify-between gap-4 rounded-xl p-3.5 border"
            style={{ borderColor: cardBorder, backgroundColor: subtleSurface }}
          >
            <div>
              <div className="text-sm font-semibold" style={{ color: fg }}>
                تعدیل دستی زمان (دقیقه)
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: fgMuted }}>
                افزودن یا کاستن دقیقه احتیاط از تمام اوقات شرعی
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOffsetChange(-1)}
                className="h-9 w-9 rounded-lg border text-sm font-bold transition-colors hover:bg-white/10 cursor-pointer"
                style={{ borderColor: cardBorder, color: fg }}
                aria-label="کاهش یک دقیقه"
              >
                -
              </button>
              <span
                className="min-w-[3.2rem] text-center text-sm font-bold tabular-nums"
                style={{ color: fg }}
              >
                {prayerOffset > 0
                  ? `+${toPersianDigits(prayerOffset)}`
                  : toPersianDigits(prayerOffset)}
              </span>
              <button
                type="button"
                onClick={() => handleOffsetChange(1)}
                className="h-9 w-9 rounded-lg border text-sm font-bold transition-colors hover:bg-white/10 cursor-pointer"
                style={{ borderColor: cardBorder, color: fg }}
                aria-label="افزایش یک دقیقه"
              >
                +
              </button>
            </div>
          </div>
        </section>

        {/* SRS Reminder Settings */}
        <section
          className="rounded-2xl p-5 sm:p-6 border space-y-5"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
        >
          <div>
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: fg }}>
              <Bell className="h-4 w-4 text-amber-400" />
              <span>یادآور مرور فاصله‌دار</span>
            </h2>
            <p className="text-xs mt-1" style={{ color: fgMuted }}>
              اعلان روزانه در ساعت مشخص برای یادآوری موضوعات سررسید مرور
            </p>
          </div>

          <div className="space-y-4">
            <div
              className="flex items-center justify-between gap-4 rounded-xl p-3.5 border"
              style={{ borderColor: cardBorder, backgroundColor: subtleSurface }}
            >
              <div>
                <div className="text-sm font-semibold" style={{ color: fg }}>
                  فعال‌سازی یادآور روزانه مرور
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: fgMuted }}>
                  ارسال اعلان در صورت وجود مطلب آماده مرور
                </p>
              </div>
              <SettingSwitch
                checked={Boolean(srsReminder.enabled)}
                onChange={handleToggleSrsReminder}
                label="فعال‌سازی یادآور روزانه مرور"
                accentColor="#f59e0b"
              />
            </div>

            <div>
              <label
                htmlFor="settings-srs-time"
                className="flex items-center gap-1.5 text-xs font-semibold mb-1.5"
                style={{ color: fg }}
              >
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                <span>ساعت یادآوری روزانه</span>
              </label>
              <input
                id="settings-srs-time"
                type="time"
                dir="ltr"
                value={srsReminder.time || "20:00"}
                onChange={(e) => handleSrsTimeChange(e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm border outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
                style={{ backgroundColor: inputBg, borderColor: cardBorder, color: fg }}
              />
            </div>
          </div>
        </section>
      </div>

      {/* Section 5: Sync Server & Backup */}
      <section
        className="rounded-2xl p-5 sm:p-6 border space-y-5"
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: fg }}>
              <Server className="h-4 w-4 text-indigo-400" />
              <span>همگام‌سازی و پشتیبان‌گیری</span>
            </h2>
            <p className="text-xs mt-1" style={{ color: fgMuted }}>
              تنظیم آدرس سرور اختصاصی روی این دستگاه و دسترسی سریع به فایل‌های بکاپ
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenBackup}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold border transition-colors hover:bg-white/5 cursor-pointer self-start sm:self-center"
            style={{ borderColor: cardBorder, color: fg }}
          >
            <Database className="h-4 w-4 text-amber-500" />
            <span>باز کردن پشتیبان‌گیری و انتقال اطلاعات</span>
          </button>
        </div>

        <div className="space-y-2.5">
          <label
            htmlFor="settings-server-url"
            className="block text-xs font-semibold"
            style={{ color: fg }}
          >
            آدرس سرور همگام‌سازی اختصاصی (اختیاری)
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              id="settings-server-url"
              type="url"
              dir="ltr"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder={DEFAULT_CLOUDFLARE_URL}
              className="flex-1 rounded-xl px-3.5 py-2.5 text-sm border outline-none focus:ring-2 focus:ring-indigo-500"
              style={{ backgroundColor: inputBg, borderColor: cardBorder, color: fg }}
            />
            <button
              type="button"
              onClick={handleSaveServerUrl}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              ذخیره آدرس
            </button>
            <button
              type="button"
              onClick={handleResetServerUrl}
              className="rounded-xl px-4 py-2.5 text-xs font-semibold border transition-colors hover:bg-white/5 cursor-pointer shrink-0"
              style={{ borderColor: cardBorder, color: fgMuted }}
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
    </div>
  );
}
