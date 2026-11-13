export const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
export const LAST_INTRO_TIME_KEY = "focusflow_last_intro_time";
export const INTRO_SESSION_STATE_KEY = "focusflow_intro_session_state";

export interface IntroSessionState {
  active: boolean;
  step: number;
  userChoice: "yes" | "no" | null;
  showReasonInput: boolean;
  unsatisfiedReason: string;
  manual?: boolean;
}

export const DEFAULT_INTRO_SESSION_STATE: IntroSessionState = {
  active: true,
  step: 1,
  userChoice: null,
  showReasonInput: false,
  unsatisfiedReason: "",
  manual: false,
};

export function parseIntroTimestamp(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "" || raw === "undefined" || raw === "null") {
    return null;
  }
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  return num;
}

export function pickNewestIntroTimestamp(a: unknown, b: unknown): string | null {
  const numA = parseIntroTimestamp(a);
  const numB = parseIntroTimestamp(b);
  if (numA === null && numB === null) return null;
  if (numA === null) return String(numB);
  if (numB === null) return String(numA);
  return String(Math.max(numA, numB));
}

export function shouldShowIntro(lastIntroRaw: unknown, nowMs: number = Date.now()): boolean {
  const lastTime = parseIntroTimestamp(lastIntroRaw);
  if (lastTime === null) {
    return true;
  }
  const diffMs = nowMs - lastTime;
  return diffMs >= THREE_HOURS_MS;
}

export function getLastIntroTimeRaw(): string | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return localStorage.getItem(LAST_INTRO_TIME_KEY);
  } catch {
    return null;
  }
}

export function saveLastIntroTime(timestampMs: number = Date.now()): number {
  const safeTs = Number.isFinite(timestampMs) && timestampMs > 0 ? Math.floor(timestampMs) : Date.now();
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(LAST_INTRO_TIME_KEY, String(safeTs));
    }
  } catch (e) {
    console.warn("Could not save last intro time:", e);
  }
  return safeTs;
}

export function getIntroSessionState(): IntroSessionState | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = localStorage.getItem(INTRO_SESSION_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.active !== true) {
      return null;
    }
    const stepNum = Number(parsed.step);
    const validStep = Number.isInteger(stepNum) && stepNum >= 1 && stepNum <= 6 ? stepNum : 1;
    const userChoice = parsed.userChoice === "yes" || parsed.userChoice === "no" ? parsed.userChoice : null;
    return {
      active: true,
      step: validStep,
      userChoice,
      showReasonInput: Boolean(parsed.showReasonInput),
      unsatisfiedReason: typeof parsed.unsatisfiedReason === "string" ? parsed.unsatisfiedReason : "",
      manual: Boolean(parsed.manual),
    };
  } catch {
    return null;
  }
}

export function saveIntroSessionState(state: IntroSessionState): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(INTRO_SESSION_STATE_KEY, JSON.stringify(state));
    }
  } catch (e) {
    console.warn("Could not save intro session state:", e);
  }
}

export function clearIntroSessionState(): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(INTRO_SESSION_STATE_KEY);
    }
  } catch (e) {
    console.warn("Could not clear intro session state:", e);
  }
}
