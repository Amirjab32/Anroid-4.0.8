/**
 * سیستم هماهنگ‌سازی خودکار دیتابیس با سرور ابری کلادفلر (Cloudflare Worker & KV)
 * تمام دستگاه‌ها (گوشی، لپ‌تاپ و تبلت) به صورت مستقل و مستقیم با کلادفلر تبادل اطلاعات دارند.
 */
import { Capacitor } from "@capacitor/core";
import { exportDatabase, importDatabase, getLocalModifiedTime } from "./store";
import { LocalSnapshotService } from "./localSnapshots";
import { offlineQueue } from "./offlineQueue";

/// آدرس سرور کلودفلر اختصاصی کاربر جهت هماهنگ‌سازی زنده برنامه و وب
export const DEFAULT_CLOUDFLARE_URL = "https://studywork.amirjab32.ir";

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    // ۱. اگر کاربر آدرس سرور متفاوتی را در تنظیمات وارد کرده باشد
    const custom = localStorage.getItem("focusflow_server_url");
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, "");
    }

    // ۲. اگر در اپلیکیشن موبایل (خروجی نیتیو Capacitor اندروید/iOS) باشیم
    if (Capacitor.isNativePlatform()) {
      return DEFAULT_CLOUDFLARE_URL;
    }

    // ۳. در تمام محیط‌های تحت وب (مرورگر محلی، سرور نود و محیط‌های پیش‌نمایش کلود)، از سرور جاری استفاده می‌شود
    return "";
  }

  return "";
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${cleanPath}` : cleanPath;
}

/// کلید وضعیت تغییرات ارسال‌نشده محلی در حافظه پایدار مرورگر
const HAS_UNPUSHED_CHANGES_KEY = "focusflow_has_unpushed_changes";

// تابع کمکی جهت بررسی خالی بودن دیتابیس ارسالی کلاینت یا سرور
function isDatabaseEmpty(data: any): boolean {
  if (!data || typeof data !== "object") return true;
  const userKeys = [
    "focusflow_tasks",
    "focusflow_recurring_activities",
    "focusflow_habits",
    "focusflow_habit_groups",
    "focusflow_topics",
    "focusflow_quiz_subjects",
    "focusflow_quiz_entries",
    "focusflow_timeline_entries",
    "focusflow_notes",
    "focusflow_memories",
    "focusflow_going_up_evaluated_days",
    "focusflow_planner",
    "focusflow_planner_presets"
  ];
  for (const key of userKeys) {
    const val = data[key];
    if (Array.isArray(val) && val.length > 0) return false;
    if (val && typeof val === "object" && !Array.isArray(val) && Object.keys(val).length > 0) {
      if (key === "focusflow_planner" && val.slots && Object.keys(val.slots).length > 0) {
        return false;
      }
    }
  }
  return true;
}

// محاسبه مجموع آیتم‌های ذخیره شده در تمام بخش‌های دیتابیس کاربر
export function calculateDatabaseItemCount(data: any): number {
  if (!data || typeof data !== "object") return 0;
  let count = 0;
  const arrayKeys = [
    "focusflow_tasks",
    "focusflow_recurring_activities",
    "focusflow_habits",
    "focusflow_habit_groups",
    "focusflow_topics",
    "focusflow_quiz_subjects",
    "focusflow_quiz_entries",
    "focusflow_timeline_entries",
    "focusflow_notes",
    "focusflow_memories",
    "focusflow_going_up_evaluated_days",
    "focusflow_planner_presets"
  ];
  for (const key of arrayKeys) {
    const val = data[key];
    if (Array.isArray(val)) {
      count += val.length;
    }
  }
  if (data.focusflow_planner && typeof data.focusflow_planner === "object") {
    if (data.focusflow_planner.slots && typeof data.focusflow_planner.slots === "object") {
      count += Object.keys(data.focusflow_planner.slots).length;
    }
  }
  return count;
}

// بررسی استثنای کاهش شدید یا صفر بودن اطلاعات دستگاه کلاینت
// فقط در این شرایط استثنایی اطلاعات سرور جایگزین دستگاه می‌شود (مثلاً کلیر کش یا حذف تصادفی کل داده‌ها)
export function isLocalDrasticallyDepleted(localCount: number, serverCount: number, isLocalEmpty: boolean): boolean {
  if (serverCount === 0) return false;
  // ۱. دیتای دیوایس کاملاً خالی یا صفر باشد (مانند کلیر کش، پنجره ناشناس یا دستگاه کاملاً جدید)
  if (isLocalEmpty || localCount === 0) return true;
  // ۲. سرور اطلاعات کافی دارد (حداقل ۵ آیتم) ولی دیوایس به ۲ آیتم یا کمتر سقوط کرده
  if (serverCount >= 5 && localCount <= 2) return true;
  // ۳. سرور بیش از ۱۰ آیتم دارد و بیش از ۷۰ درصد آیتم‌های دیوایس ناپدید شده‌اند
  if (serverCount >= 10 && localCount < serverCount * 0.3) return true;
  return false;
}

// تعریف انواع وضعیت هماهنگی
export type SyncStatus = "connected" | "syncing" | "offline" | "idle";

// رویداد هماهنگی سراسری کلاینت برای مطلع ساختن کامپوننت‌های فرانت‌اند
export const SYNC_EVENT = "focusflow-db-synced";
export const SYNC_STATUS_EVENT = "focusflow-sync-status-changed";

class SyncManager {
  private lastSyncedMtime: number = 0;
  private isPushing: boolean = false;
  private isApplyingServerData: boolean = false;
  private pendingPushTimeout: NodeJS.Timeout | null = null;
  private pollIntervalId: NodeJS.Timeout | null = null;
  private currentStatus: SyncStatus = "idle";
  private hasUnsavedLocalChanges: boolean = false;
  private initialSyncSettled: boolean = false;
  private initialSyncWaiters: Array<() => void> = [];

  constructor() {
    if (typeof window !== "undefined") {
      // لود کردن آخرین مهر زمانی هماهنگ شده از localStorage
      const cachedTime = localStorage.getItem("focusflow_last_synced_mtime");
      if (cachedTime) {
        this.lastSyncedMtime = parseFloat(cachedTime);
      }

      // لود وضعیت ماندگار تغییرات ارسال نشده از قبل
      const cachedHasUnsaved = localStorage.getItem(HAS_UNPUSHED_CHANGES_KEY);
      if (cachedHasUnsaved === "true") {
        this.hasUnsavedLocalChanges = true;
      }

      // شنود تغییرات دیتابیس محلی برای ارسال به سرور (Push)
      // گارد بحرانی: در صورتی که تغییر ناشی از دریافت اطلاعات از سرور باشد، نباید دوباره به سرور ارسال شود
      window.addEventListener("focusflow-data-changed", (e: any) => {
        if (this.isApplyingServerData || e?.detail?.key === "database_import") {
          return;
        }
        this.hasUnsavedLocalChanges = true;
        localStorage.setItem(HAS_UNPUSHED_CHANGES_KEY, "true");
        offlineQueue.enqueue("DATA_UPDATE", "تغییرات دیتابیس محلی").catch(() => {});
        this.setStatus("syncing");
        this.schedulePush();
        LocalSnapshotService.notifyDataChanged();
      });

      // ارسال فوری تغییرات تایمر زنده (استارت/استپ)
      window.addEventListener("focusflow-planner-timer-change", () => {
        if (this.isApplyingServerData) {
          return;
        }
        this.hasUnsavedLocalChanges = true;
        localStorage.setItem(HAS_UNPUSHED_CHANGES_KEY, "true");
        offlineQueue.enqueue("TIMER_UPDATE", "تغییر وضعیت تایمر پلنر").catch(() => {});
        this.triggerImmediatePush();
        LocalSnapshotService.notifyDataChanged();
      });

      // هماهنگ‌سازی هنگام فعال شدن تب یا اتصال مجدد اینترنت بر اساس امضای زمانی
      const handleReconnection = () => {
        this.reconcileWithServer();
      };

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          handleReconnection();
        }
      });
      window.addEventListener("focus", handleReconnection);
      window.addEventListener("online", handleReconnection);

      // شروع همگام‌سازی دوره‌ای و خودکار در پس‌زمینه
      this.startPolling();

      // سیستم بکاپ محلی خودکار پایدار در پس‌زمینه
      setTimeout(() => {
        LocalSnapshotService.createSnapshot().catch(() => {});
      }, 5000);

      setInterval(() => {
        LocalSnapshotService.createSnapshot().catch(() => {});
      }, 15 * 60 * 1000);
    }
  }

  // تغییر وضعیت اتصال و اطلاع‌رسانی به کامپوننت‌ها
  private setStatus(status: SyncStatus) {
    if (this.currentStatus !== status) {
      this.currentStatus = status;
      window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: status }));
    }
  }

  public getStatus(): SyncStatus {
    return this.currentStatus;
  }

  public hasUnsavedChanges(): boolean {
    return this.hasUnsavedLocalChanges;
  }

  private resolveInitialSync() {
    if (this.initialSyncSettled) return;
    this.initialSyncSettled = true;
    const waiters = this.initialSyncWaiters.splice(0);
    waiters.forEach((resolve) => resolve());
  }

  public waitForInitialSync(timeoutMs: number = 1000): Promise<void> {
    if (this.initialSyncSettled) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);
      this.initialSyncWaiters.push(finish);
    });
  }

  // ارسال فوری اطلاعات به سرور بدون تاخیر
  public triggerImmediatePush() {
    if (this.pendingPushTimeout) {
      clearTimeout(this.pendingPushTimeout);
      this.pendingPushTimeout = null;
    }
    this.hasUnsavedLocalChanges = true;
    localStorage.setItem(HAS_UNPUSHED_CHANGES_KEY, "true");
    this.pushLocalToServer(true);
  }

  // فرستادن اطلاعات محلی به سرور با تکنیک Debounce برای بهینه‌سازی ترافیک شبکه
  private schedulePush() {
    if (this.pendingPushTimeout) {
      clearTimeout(this.pendingPushTimeout);
    }

    this.pendingPushTimeout = setTimeout(async () => {
      await this.pushLocalToServer(false);
    }, 500);
  }

  // متد اصلی اعمال دیتای سرور روی لوکال با ایمنی کامل و بدون ایجاد حلقه بازگشتی
  private applyServerToLocal(serverData: any, serverMtime: number): boolean {
    this.isApplyingServerData = true;
    try {
      const serverStr = JSON.stringify(serverData);
      const success = importDatabase(serverStr);
      if (success) {
        this.lastSyncedMtime = serverMtime;
        localStorage.setItem("focusflow_last_synced_mtime", serverMtime.toString());
        localStorage.setItem("focusflow_local_mtime", serverMtime.toString());
        this.hasUnsavedLocalChanges = false;
        localStorage.removeItem(HAS_UNPUSHED_CHANGES_KEY);
        offlineQueue.clearQueue().catch(() => {});
        window.dispatchEvent(new CustomEvent(SYNC_EVENT));
        window.dispatchEvent(new CustomEvent("focusflow-data-changed", { detail: { key: "database_import" } }));
        this.setStatus("connected");
        return true;
      }
      return false;
    } finally {
      setTimeout(() => {
        this.isApplyingServerData = false;
      }, 200);
    }
  }

  // متد اصلی ارسال اطلاعات کلاینت به سرور کلادفلر یا نود
  public async pushLocalToServer(force: boolean = false): Promise<boolean> {
    if (this.isPushing || this.isApplyingServerData) return false;

    try {
      const dataStr = exportDatabase();
      const parsedData = JSON.parse(dataStr);
      const isLocalEmpty = isDatabaseEmpty(parsedData);

      // محافظت کلاینت: اگر دیتای محلی کلاینت خالی است، هرگز نباید دیتابیس سرور را رونویسی کند
      // در چنین وضعیتی (مثلاً پنجره ناشناس یا مرورگر تازه) داده‌های سرور بازیابی می‌شوند
      if (isLocalEmpty) {
        console.warn("Sync: Local database is empty. Skipping push and restoring from server to protect database.");
        await this.pullFromServer(true);
        return false;
      }

      this.isPushing = true;
      this.setStatus("syncing");

      const localMtime = getLocalModifiedTime() || Date.now();
      parsedData._last_modified = localMtime;

      const endpoint = force ? "/api/db?force=true" : "/api/db";
      const response = await fetch(apiUrl(endpoint), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({ data: parsedData }),
      });

      if (response.ok) {
        const resBody = await response.json();
        if (resBody.success) {
          const updatedTime = Number(resBody.lastUpdated) || localMtime;
          this.lastSyncedMtime = updatedTime;
          localStorage.setItem("focusflow_last_synced_mtime", updatedTime.toString());
          localStorage.setItem("focusflow_local_mtime", updatedTime.toString());
          this.hasUnsavedLocalChanges = false;
          localStorage.removeItem(HAS_UNPUSHED_CHANGES_KEY);
          offlineQueue.clearQueue().catch(() => {});
          this.setStatus("connected");
          return true;
        }
      } else if (response.status === 409) {
        const errBody = await response.json().catch(() => ({}));
        if (errBody.error === "SERVER_HAS_DATA_PROTECTION") {
          console.warn("Sync: Server blocked empty push because it holds valid database. Pulling server data to restore client...");
          this.lastSyncedMtime = 0;
          this.hasUnsavedLocalChanges = false;
          localStorage.removeItem(HAS_UNPUSHED_CHANGES_KEY);
          await this.pullFromServer(true);
        }
      } else {
        this.setStatus("offline");
      }
    } catch (err) {
      console.warn("Sync: Network is offline, keeping changes saved locally on device...", err);
      this.setStatus("offline");
    } finally {
      this.isPushing = false;
    }
    return false;
  }

  // هماهنگ‌سازی دستی فوری
  public async forceSync(): Promise<boolean> {
    this.setStatus("syncing");
    return await this.reconcileWithServer();
  }

  // اعمال اجباری فایل اطلاعات به حافظه محلی و سرور
  public async applyManualDatabaseOverride(jsonString: string): Promise<boolean> {
    this.setStatus("syncing");

    const now = Date.now();
    localStorage.setItem("focusflow_local_mtime", now.toString());

    const success = importDatabase(jsonString, true);
    if (!success) {
      this.setStatus(this.currentStatus);
      return false;
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("focusflow-data-changed", { detail: { key: "database_import" } }));
      window.dispatchEvent(new CustomEvent("focusflow-db-synced"));
    }

    try {
      await LocalSnapshotService.createSnapshot(true);
    } catch (e) {
      console.warn("Failed to create snapshot during manual override:", e);
    }

    try {
      const dataStr = exportDatabase();
      const parsedData = JSON.parse(dataStr);
      parsedData._last_modified = now;

      const response = await fetch(apiUrl("/api/db?force=true"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: parsedData }),
      });

      if (response.ok) {
        const resBody = await response.json();
        if (resBody.success) {
          const updatedTime = Number(resBody.lastUpdated) || now;
          this.lastSyncedMtime = updatedTime;
          localStorage.setItem("focusflow_last_synced_mtime", updatedTime.toString());
          localStorage.setItem("focusflow_local_mtime", updatedTime.toString());
          this.hasUnsavedLocalChanges = false;
          localStorage.removeItem(HAS_UNPUSHED_CHANGES_KEY);
          this.setStatus("connected");
        }
      }
    } catch (err) {
      console.warn("Sync: Server unreachable during manual override, local storage forcefully updated.", err);
      this.hasUnsavedLocalChanges = true;
      localStorage.setItem(HAS_UNPUSHED_CHANGES_KEY, "true");
    }

    return true;
  }

  // پاک کردن دیتابیس محلی و ارسال دیتابیس خالی به سرور جهت ریست همه دستگاه‌ها به صورت هماهنگ
  public async clearDatabaseAndSync() {
    this.setStatus("syncing");
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }

    localStorage.clear();
    this.lastSyncedMtime = 0;
    this.hasUnsavedLocalChanges = false;
    localStorage.removeItem(HAS_UNPUSHED_CHANGES_KEY);
    offlineQueue.clearQueue().catch(() => {});

    try {
      const response = await fetch(apiUrl("/api/db?reset=true"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: {} }),
      });

      if (response.ok) {
        const resBody = await response.json();
        this.lastSyncedMtime = resBody.lastUpdated || Date.now();
        localStorage.setItem("focusflow_last_synced_mtime", this.lastSyncedMtime.toString());
      }
    } catch (err) {
      console.error("Failed to clear database on the server:", err);
    }

    window.location.reload();
  }

  // متد دریافت اطلاعات از فایل دیتابیس سرور (Pull)
  public async pullFromServer(_force: boolean = false): Promise<boolean> {
    if (this.isPushing) return false;
    return await this.reconcileWithServer();
  }

  /**
   * هماهنگ‌سازی دوطرفه دقیق بر اساس امضای زمانی تغییرات (Timestamp Signature):
   * ۱. اولویت مطلق با هر تغییری است که آخرین بار ایجاد شده باشد (Last-Write-Wins).
   * ۲. تنها استثنا: محافظت از پاک شدن داده‌ها هنگام ورود با مرورگر جدید، حالت ناشناس (Incognito) یا کلیر کش
   *    که در آن حالت دیتای سرور بازیابی می‌شود و دیتای خالی دستگاه محلی روی سرور ارسال نمی‌گردد.
   */
  public async reconcileWithServer(): Promise<boolean> {
    if (this.isPushing || this.isApplyingServerData) return false;

    try {
      const response = await fetch(apiUrl(`/api/db?t=${Date.now()}`), { cache: "no-store" });
      if (!response.ok) {
        this.setStatus("offline");
        return false;
      }

      const resBody = await response.json();
      const serverData = resBody.data;
      const serverMtime = Number(resBody.lastUpdated || (serverData && serverData._last_modified)) || 0;

      const localDataStr = exportDatabase();
      const localData = JSON.parse(localDataStr);
      const localMtime = getLocalModifiedTime() || Number(localData._last_modified) || 0;

      const localCount = calculateDatabaseItemCount(localData);
      const serverCount = calculateDatabaseItemCount(serverData);
      const isLocalEmpty = isDatabaseEmpty(localData);
      const isServerEmpty = isDatabaseEmpty(serverData);

      // ۱. اگر سرور کاملاً خالی است و کلاینت داده دارد، اطلاعات کلاینت به سرور تحمیل می‌شود
      if (isServerEmpty) {
        if (!isLocalEmpty) {
          console.log("Sync: Server is empty, uploading device data to server...");
          return await this.pushLocalToServer(true);
        }
        this.setStatus("connected");
        return true;
      }

      // ۲. استثنای حیاتی گارد محافظتی: دیتای دیوایس صفر است یا به شدت کاهش یافته (مرورگر جدید، ناشناس، کلیر کش)
      // در این حالت دیتای معتبر سرور به دیوایس بازیابی می‌شود تا از نابودی اطلاعات جلوگیری شود
      if (isLocalDrasticallyDepleted(localCount, serverCount, isLocalEmpty)) {
        console.warn(`Sync: Local data is depleted (${localCount} vs server ${serverCount}). Restoring device from server database...`);
        return this.applyServerToLocal(serverData, serverMtime);
      }

      // ۳. بررسی برابری محتوا بدون در نظر گرفتن فیلد امضای زمانی
      const localCopy = { ...localData };
      delete localCopy._last_modified;
      const serverCopy = { ...serverData };
      delete serverCopy._last_modified;

      if (JSON.stringify(localCopy) === JSON.stringify(serverCopy)) {
        const maxTime = Math.max(serverMtime, localMtime, this.lastSyncedMtime);
        this.lastSyncedMtime = maxTime;
        localStorage.setItem("focusflow_last_synced_mtime", maxTime.toString());
        localStorage.setItem("focusflow_local_mtime", maxTime.toString());
        this.hasUnsavedLocalChanges = false;
        localStorage.removeItem(HAS_UNPUSHED_CHANGES_KEY);
        this.setStatus("connected");
        return true;
      }

      // ۴. تصمیم‌گیری دیکتاتورانه بر اساس امضای زمانی آخرین تغییرات (Timestamp Signature):
      // اگر سرور جدیدتر است (تغییری در گوشی یا دستگاه دیگر دیرتر از آخرین تغییر این سیستم ایجاد شده):
      // سرور قطعاً ارجحیت دارد و تغییرات سرور روی این دیوایس اعمال می‌شود
      if (serverMtime > localMtime) {
        console.log(`Sync: Server has newer changes (${serverMtime} > ${localMtime}). Applying server updates to local device...`);
        return this.applyServerToLocal(serverData, serverMtime);
      }

      // اگر کاربر روی همین دیوایس تغییر جدیدتری ایجاد کرده است (زمان ویرایش محلی بعد از سرور است):
      // این دیوایس جدیدتر است و تغییرات محلی آن به سرور ارسال می‌شود
      if (localMtime > serverMtime) {
        console.log(`Sync: Local changes are newer (${localMtime} > ${serverMtime}). Pushing latest device changes to server...`);
        return await this.pushLocalToServer(true);
      }

      // ۵. اگر زمان‌ها دقیقاً برابر باشند اما محتوا متفاوت است (تداخل همزمان نادر):
      // اولویت با دیتایی است که آیتم‌های بیشتری دارد تا از دست رفتن داده به صفر برسد
      if (serverCount >= localCount) {
        return this.applyServerToLocal(serverData, serverMtime);
      } else {
        return await this.pushLocalToServer(true);
      }
    } catch (err) {
      this.setStatus("offline");
      return false;
    } finally {
      this.resolveInitialSync();
    }
  }

  // شروع پایش مستمر هر ۲.۵ ثانیه برای هماهنگی ریل‌تایم بین دیوایس و دیتابیس
  private startPolling() {
    this.reconcileWithServer();

    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }

    this.pollIntervalId = setInterval(async () => {
      if (this.isPushing || this.isApplyingServerData) return;
      await this.reconcileWithServer();
    }, 2500);
  }

  // توقف همگام‌سازی در صورت لزوم
  public destroy() {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }
    if (this.pendingPushTimeout) {
      clearTimeout(this.pendingPushTimeout);
    }
  }
}

// ایجاد و اکسپورت تک‌نمونه (Singleton) از مدیر هماهنگی
export const syncManager = new SyncManager();
