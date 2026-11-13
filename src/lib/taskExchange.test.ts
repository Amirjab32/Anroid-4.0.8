import test from "node:test";
import assert from "node:assert/strict";
import type { Task } from "./store";
import {
  normalizeTagFilterList,
  taskHasAllTags,
  filterTasksByTags,
  mergeImportedTasks,
} from "./taskExchange";

function makeTask(id: string, title: string, tags: string[]): Task {
  return {
    id,
    title,
    description: "",
    priority: "medium",
    scheduled_date: "2026-11-13",
    activity_id: null,
    status: "todo",
    kanban_column: "todo",
    created_date: "2026-11-13",
    elapsed_seconds: 0,
    timer_started_at: null,
    timeline_slot: null,
    timeline_date: null,
    intervals: [],
    tags,
  };
}

test("normalizeTagFilterList trims, deduplicates, and ignores 'all'", () => {
  assert.deepEqual(normalizeTagFilterList("all"), []);
  assert.deepEqual(normalizeTagFilterList([" all ", " چینی ", "چینی", " دوره-۱ "]), ["چینی", "دوره-۱"]);
  assert.deepEqual(normalizeTagFilterList(undefined), []);
});

test("filterTasksByTags uses intersection (AND) across selected tags", () => {
  const tasks = [
    makeTask("1", "Chinese Course 1 - L1", ["چینی", "دوره-اول"]),
    makeTask("2", "Chinese Course 1 - L2", ["چینی", "دوره-اول"]),
    makeTask("3", "Chinese Course 2 - L1", ["چینی", "دوره-دوم"]),
    makeTask("4", "Guitar", ["گیتار"]),
  ];

  assert.equal(filterTasksByTags(tasks, []).length, 4);
  assert.equal(filterTasksByTags(tasks, ["چینی"]).length, 3);
  const course1 = filterTasksByTags(tasks, ["چینی", "دوره-اول"]);
  assert.deepEqual(course1.map((t) => t.id), ["1", "2"]);
  assert.equal(taskHasAllTags(tasks[2], ["چینی", "دوره-اول"]), false);
});

test("mergeImportedTasks in replace_filtered replaces only tasks matching all chosen tags", () => {
  const existing = [
    makeTask("c1-1", "Old Chinese Course 1 A", ["چینی", "دوره-اول"]),
    makeTask("c1-2", "Old Chinese Course 1 B", ["چینی", "دوره-اول"]),
    makeTask("c2-1", "Keep Chinese Course 2", ["چینی", "دوره-دوم"]),
    makeTask("g-1", "Keep Guitar", ["گیتار"]),
  ];

  const incoming = [
    makeTask("new-1", "New Chinese Course 1 A", ["چینی", "دوره-اول"]),
    makeTask("new-2", "New Chinese Course 1 B", ["چینی", "دوره-اول"]),
    makeTask("new-3", "New Chinese Course 1 C", ["چینی", "دوره-اول"]),
  ];

  const result = mergeImportedTasks(existing, incoming, "replace_filtered", ["چینی", "دوره-اول"]);
  assert.equal(result.error, undefined);
  assert.equal(result.importedCount, 3);
  assert.equal(result.replacedCount, 2);
  assert.deepEqual(
    result.nextTasks.map((t) => t.id),
    ["new-1", "new-2", "new-3", "c2-1", "g-1"]
  );
});

test("mergeImportedTasks in replace_filtered errors cleanly when no tags are selected", () => {
  const existing = [makeTask("1", "Task 1", ["چینی"])];
  const incoming = [makeTask("2", "Task 2", ["چینی"])];

  const result = mergeImportedTasks(existing, incoming, "replace_filtered", []);
  assert.ok(result.error);
  assert.deepEqual(result.nextTasks, existing);
  assert.equal(result.importedCount, 0);
});

test("mergeImportedTasks deduplicates if incoming reuses preserved task id", () => {
  const existing = [
    makeTask("shared-id", "Unrelated task", ["گیتار"]),
    makeTask("target-id", "Old target", ["چینی"]),
  ];
  const incoming = [makeTask("shared-id", "Updated incoming task", ["چینی"])];

  const result = mergeImportedTasks(existing, incoming, "replace_filtered", ["چینی"]);
  assert.equal(result.replacedCount, 1);
  assert.equal(result.nextTasks.length, 1);
  assert.equal(result.nextTasks[0].title, "Updated incoming task");
});
