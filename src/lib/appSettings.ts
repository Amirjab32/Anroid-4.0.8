import { MAIN_NAV_IDS, MainNavId, NAV_ITEMS, NavItemConfig, isMainNavId } from "./navigation";
import { markLocalModified } from "./store";

export const APP_SETTINGS_KEY = "focusflow_app_settings";
export const APP_SETTINGS_EVENT = "focusflow-app-settings-changed";

export interface AppSettings {
  hiddenMenuIds: MainNavId[];
  defaultStartView: MainNavId;
  showPrayerBar: boolean;
  autoShowIntro: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  hiddenMenuIds: [],
  defaultStartView: "tasks",
  showPrayerBar: true,
  autoShowIntro: true,
};

export function normalizeAppSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_APP_SETTINGS, hiddenMenuIds: [] };
  }

  const obj = raw as Record<string, unknown>;

  const rawHidden = Array.isArray(obj.hiddenMenuIds) ? obj.hiddenMenuIds : [];
  const dedupedHidden: MainNavId[] = [];
  for (const entry of rawHidden) {
    if (typeof entry === "string" && isMainNavId(entry) && !dedupedHidden.includes(entry)) {
      dedupedHidden.push(entry);
    }
  }

  // Always preserve at least one visible menu section
  if (dedupedHidden.length >= MAIN_NAV_IDS.length) {
    dedupedHidden.pop();
  }

  const visibleIds = MAIN_NAV_IDS.filter((id) => !dedupedHidden.includes(id));
  const fallbackStart: MainNavId = visibleIds[0] ?? "tasks";

  const candidateStart =
    typeof obj.defaultStartView === "string" && isMainNavId(obj.defaultStartView)
      ? obj.defaultStartView
      : fallbackStart;

  const defaultStartView: MainNavId = visibleIds.includes(candidateStart)
    ? candidateStart
    : fallbackStart;

  return {
    hiddenMenuIds: dedupedHidden,
    defaultStartView,
    showPrayerBar: obj.showPrayerBar !== false,
    autoShowIntro: obj.autoShowIntro !== false,
  };
}

function readStoredSettings(): AppSettings {
  if (typeof localStorage === "undefined") {
    return { ...DEFAULT_APP_SETTINGS, hiddenMenuIds: [] };
  }
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY);
    if (!raw) {
      return { ...DEFAULT_APP_SETTINGS, hiddenMenuIds: [] };
    }
    return normalizeAppSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_APP_SETTINGS, hiddenMenuIds: [] };
  }
}

function persistSettings(settings: AppSettings): AppSettings {
  const normalized = normalizeAppSettings(settings);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(normalized));
    markLocalModified();
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(APP_SETTINGS_EVENT, { detail: normalized }));
    window.dispatchEvent(new CustomEvent("focusflow-data-changed", { detail: { key: APP_SETTINGS_KEY } }));
  }
  return normalized;
}

export const AppSettingsService = {
  get(): AppSettings {
    return readStoredSettings();
  },

  update(partial: Partial<AppSettings>): AppSettings {
    const current = readStoredSettings();
    return persistSettings({
      ...current,
      ...partial,
      hiddenMenuIds: partial.hiddenMenuIds ?? current.hiddenMenuIds,
    });
  },

  toggleMenuSection(id: MainNavId): {
    settings: AppSettings;
    changed: boolean;
    reason?: "last_visible";
  } {
    const current = readStoredSettings();
    const isCurrentlyHidden = current.hiddenMenuIds.includes(id);

    if (isCurrentlyHidden) {
      const nextHidden = current.hiddenMenuIds.filter((item) => item !== id);
      const saved = persistSettings({ ...current, hiddenMenuIds: nextHidden });
      return { settings: saved, changed: true };
    }

    const visibleCount = MAIN_NAV_IDS.length - current.hiddenMenuIds.length;
    if (visibleCount <= 1) {
      return { settings: current, changed: false, reason: "last_visible" };
    }

    const nextHidden = [...current.hiddenMenuIds, id];
    const saved = persistSettings({ ...current, hiddenMenuIds: nextHidden });
    return { settings: saved, changed: true };
  },

  isSectionHidden(id: MainNavId): boolean {
    return readStoredSettings().hiddenMenuIds.includes(id);
  },

  getVisibleNavItems(): NavItemConfig[] {
    const hidden = new Set(readStoredSettings().hiddenMenuIds);
    return NAV_ITEMS.filter((item) => !hidden.has(item.id));
  },

  getHiddenNavItems(): NavItemConfig[] {
    const hidden = new Set(readStoredSettings().hiddenMenuIds);
    return NAV_ITEMS.filter((item) => hidden.has(item.id));
  },

  getEffectiveStartView(): MainNavId {
    return readStoredSettings().defaultStartView;
  },

  reset(): AppSettings {
    return persistSettings({ ...DEFAULT_APP_SETTINGS, hiddenMenuIds: [] });
  },
};
