import test from "node:test";
import assert from "node:assert/strict";
import { importDatabase, exportDatabase, TaskStore } from "./store";

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

test("importDatabase with forceOverride resets old tasks, dynamic keys, and omitted settings without downgrading mtime", () => {
  const mockStorage = createMockLocalStorage();
  (globalThis as any).localStorage = mockStorage;

  // Populate existing state with old tasks, custom settings, dynamic applied dates, and recent mtime
  mockStorage.setItem(
    "focusflow_tasks",
    JSON.stringify([
      { id: "old-1", title: "چینی دوره اول", status: "todo", kanban_column: "todo", priority: "high", created_date: "2026-10-01", elapsed_seconds: 0 },
      { id: "old-2", title: "چینی دوره دوم", status: "todo", kanban_column: "todo", priority: "medium", created_date: "2026-10-02", elapsed_seconds: 0 },
    ])
  );
  mockStorage.setItem("focusflow-theme", "light");
  mockStorage.setItem("focusflow_safe_mode", "false");
  mockStorage.setItem("focusflow_active_preset_id", "custom-preset-99");
  mockStorage.setItem("focusflow_prayer_province", "فارس");
  mockStorage.setItem("focusflow_prayer_city", "شیراز");
  mockStorage.setItem("focusflow_prayer_offset", "5");
  mockStorage.setItem("focusflow_planner_threshold", "65");
  mockStorage.setItem("focusflow_active_note_id", "note-old");
  mockStorage.setItem("focusflow_custom_applied_2026-11-12", "custom");
  mockStorage.setItem("focusflow_custom_applied_2026-11-13", "preset-1");
  mockStorage.setItem("focusflow_server_url", "https://custom.example.com");
  mockStorage.setItem("focusflow_local_mtime", "2000000000000");

  // Import a manual backup that has ONLY 1 completely different task and an old _last_modified, omitting optional settings
  const manualBackup = {
    focusflow_tasks: [
      { id: "new-1", title: "ریاضی فصل ۱", status: "todo", kanban_column: "todo", priority: "high", created_date: "2026-11-13", elapsed_seconds: 0 },
    ],
    _last_modified: 1500000000000,
  };

  const ok = importDatabase(JSON.stringify(manualBackup), true);
  assert.equal(ok, true);

  // Old tasks completely gone
  const tasks = TaskStore.list();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].id, "new-1");

  // Omitted settings reset to defaults
  assert.equal(mockStorage.getItem("focusflow-theme"), "dark");
  assert.equal(mockStorage.getItem("focusflow_safe_mode"), "true");
  assert.equal(mockStorage.getItem("focusflow_active_preset_id"), "default");
  assert.equal(mockStorage.getItem("focusflow_prayer_province"), null);
  assert.equal(mockStorage.getItem("focusflow_prayer_city"), null);
  assert.equal(mockStorage.getItem("focusflow_prayer_offset"), null);
  assert.equal(mockStorage.getItem("focusflow_planner_threshold"), null);
  assert.equal(mockStorage.getItem("focusflow_active_note_id"), null);

  // Dynamic planner custom dates removed
  assert.equal(mockStorage.getItem("focusflow_custom_applied_2026-11-12"), null);
  assert.equal(mockStorage.getItem("focusflow_custom_applied_2026-11-13"), null);

  // Server URL preserved & mtime NOT downgraded to 1500000000000
  assert.equal(mockStorage.getItem("focusflow_server_url"), "https://custom.example.com");
  assert.equal(mockStorage.getItem("focusflow_local_mtime"), "2000000000000");
});

test("importDatabase with forceOverride accepts empty tasks backup and clears all previous tasks", () => {
  const mockStorage = createMockLocalStorage();
  (globalThis as any).localStorage = mockStorage;

  mockStorage.setItem(
    "focusflow_tasks",
    JSON.stringify([
      { id: "old-1", title: "چینی دوره اول", status: "todo", kanban_column: "todo", priority: "high", created_date: "2026-10-01", elapsed_seconds: 0 },
    ])
  );

  const emptyTasksBackup = {
    focusflow_tasks: [],
    focusflow_notes: [{ id: "n1", title: "یادداشت", content: "متن", created_date: "2026-11-13", updated_at: 100 }],
  };

  const ok = importDatabase(JSON.stringify(emptyTasksBackup), true);
  assert.equal(ok, true);
  assert.equal(TaskStore.list().length, 0);

  const exported = JSON.parse(exportDatabase());
  assert.deepEqual(exported.focusflow_tasks, []);
  assert.equal(exported.focusflow_notes.length, 1);
});
