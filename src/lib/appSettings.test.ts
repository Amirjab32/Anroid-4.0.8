import test from "node:test";
import assert from "node:assert/strict";
import {
  APP_SETTINGS_KEY,
  AppSettingsService,
  DEFAULT_APP_SETTINGS,
  normalizeAppSettings,
} from "./appSettings";
import { MAIN_NAV_IDS } from "./navigation";

function createMockLocalStorage() {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

test("AppSettingsService returns defaults on empty storage and handles hide/show", () => {
  const mockStorage = createMockLocalStorage();
  (globalThis as any).localStorage = mockStorage;

  const initial = AppSettingsService.get();
  assert.deepEqual(initial, DEFAULT_APP_SETTINGS);
  assert.equal(AppSettingsService.getVisibleNavItems().length, MAIN_NAV_IDS.length);
  assert.equal(AppSettingsService.getHiddenNavItems().length, 0);

  const hideResult = AppSettingsService.toggleMenuSection("kanban");
  assert.equal(hideResult.changed, true);
  assert.deepEqual(hideResult.settings.hiddenMenuIds, ["kanban"]);
  assert.equal(AppSettingsService.isSectionHidden("kanban"), true);
  assert.equal(AppSettingsService.getHiddenNavItems().map((x) => x.id).join(","), "kanban");

  const showResult = AppSettingsService.toggleMenuSection("kanban");
  assert.equal(showResult.changed, true);
  assert.deepEqual(showResult.settings.hiddenMenuIds, []);
  assert.equal(AppSettingsService.isSectionHidden("kanban"), false);
});

test("AppSettingsService prevents hiding the last remaining visible section", () => {
  const mockStorage = createMockLocalStorage();
  (globalThis as any).localStorage = mockStorage;

  // Hide all except "notes"
  for (const id of MAIN_NAV_IDS) {
    if (id !== "notes") {
      const res = AppSettingsService.toggleMenuSection(id);
      assert.equal(res.changed, true);
    }
  }

  assert.equal(AppSettingsService.getVisibleNavItems().length, 1);
  assert.equal(AppSettingsService.getEffectiveStartView(), "notes");

  // Attempting to hide "notes" must be rejected
  const blocked = AppSettingsService.toggleMenuSection("notes");
  assert.equal(blocked.changed, false);
  assert.equal(blocked.reason, "last_visible");
  assert.equal(AppSettingsService.getVisibleNavItems().length, 1);
  assert.equal(AppSettingsService.isSectionHidden("notes"), false);
});

test("AppSettingsService auto-switches defaultStartView when the start section is hidden", () => {
  const mockStorage = createMockLocalStorage();
  (globalThis as any).localStorage = mockStorage;

  AppSettingsService.update({ defaultStartView: "planner" });
  assert.equal(AppSettingsService.getEffectiveStartView(), "planner");

  AppSettingsService.toggleMenuSection("planner");
  assert.equal(AppSettingsService.isSectionHidden("planner"), true);
  assert.equal(AppSettingsService.getEffectiveStartView(), "tasks");

  // Even when persisted directly with hidden start view, normalization falls back cleanly
  const normalized = normalizeAppSettings({
    hiddenMenuIds: ["tasks", "kanban", "planner", "habits"],
    defaultStartView: "kanban",
    showPrayerBar: false,
    autoShowIntro: false,
  });
  assert.equal(normalized.defaultStartView, "going_up");
  assert.equal(normalized.showPrayerBar, false);
  assert.equal(normalized.autoShowIntro, false);
});

test("AppSettingsService reset restores all defaults and persists", () => {
  const mockStorage = createMockLocalStorage();
  (globalThis as any).localStorage = mockStorage;

  AppSettingsService.update({
    hiddenMenuIds: ["quiz", "notes"],
    defaultStartView: "habits",
    showPrayerBar: false,
    autoShowIntro: false,
  });

  const resetSettings = AppSettingsService.reset();
  assert.deepEqual(resetSettings, DEFAULT_APP_SETTINGS);

  const raw = JSON.parse(mockStorage.getItem(APP_SETTINGS_KEY)!);
  assert.deepEqual(raw, DEFAULT_APP_SETTINGS);
});
