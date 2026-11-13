import type { Task } from "./store";

export type TasksImportMode = "append" | "replace" | "replace_filtered";

export function normalizeTagFilterList(tagOrTags?: string | string[]): string[] {
  if (!tagOrTags) return [];
  const rawList = Array.isArray(tagOrTags) ? tagOrTags : [tagOrTags];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of rawList) {
    if (typeof item !== "string") continue;
    const clean = item.trim();
    if (!clean || clean === "all" || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}

export function taskHasAllTags(task: Pick<Task, "tags">, requiredTags: string[]): boolean {
  if (requiredTags.length === 0) return true;
  const taskTags = new Set(
    (task.tags || [])
      .filter((tg): tg is string => typeof tg === "string")
      .map((tg) => tg.trim())
      .filter(Boolean)
  );
  return requiredTags.every((req) => taskTags.has(req));
}

export function filterTasksByTags<T extends Pick<Task, "tags">>(
  tasks: T[],
  tagOrTags?: string | string[]
): T[] {
  const cleanTags = normalizeTagFilterList(tagOrTags);
  if (cleanTags.length === 0) return tasks;
  return tasks.filter((t) => taskHasAllTags(t, cleanTags));
}

export interface MergeImportedTasksResult {
  nextTasks: Task[];
  importedCount: number;
  replacedCount: number;
  error?: string;
}

export function mergeImportedTasks(
  currentTasks: Task[],
  incomingSanitized: Task[],
  mode: TasksImportMode,
  filterTags?: string | string[]
): MergeImportedTasksResult {
  if (mode === "replace") {
    return {
      nextTasks: incomingSanitized,
      importedCount: incomingSanitized.length,
      replacedCount: currentTasks.length,
    };
  }

  if (mode === "replace_filtered") {
    const cleanFilterTags = normalizeTagFilterList(filterTags);
    if (cleanFilterTags.length === 0) {
      return {
        nextTasks: currentTasks,
        importedCount: 0,
        replacedCount: 0,
        error: "لطفاً حداقل یک برچسب برای جایگزینی فیلترشده انتخاب کنید.",
      };
    }

    let replacedCount = 0;
    const preservedTasks = currentTasks.filter((task) => {
      const matches = taskHasAllTags(task, cleanFilterTags);
      if (matches) {
        replacedCount += 1;
        return false;
      }
      return true;
    });

    const incomingIds = new Set(incomingSanitized.map((t) => t.id));
    const uniquePreserved = preservedTasks.filter((t) => !incomingIds.has(t.id));

    return {
      nextTasks: [...incomingSanitized, ...uniquePreserved],
      importedCount: incomingSanitized.length,
      replacedCount,
    };
  }

  // Default: "append"
  const existingMap = new Map<string, Task>();
  for (const t of currentTasks) {
    existingMap.set(t.id, t);
  }
  for (const t of incomingSanitized) {
    if (existingMap.has(t.id)) {
      existingMap.set(t.id, { ...existingMap.get(t.id)!, ...t });
    } else {
      existingMap.set(t.id, t);
    }
  }
  return {
    nextTasks: Array.from(existingMap.values()),
    importedCount: incomingSanitized.length,
    replacedCount: 0,
  };
}
