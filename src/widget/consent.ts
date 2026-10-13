export const CONSENT_VERSION = "1";
const KEY = "shadewise:consent";

export interface ConsentRecord {
  version: string;
  at: string;
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStore(): Store | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readConsent(store: Store | null = defaultStore()): ConsentRecord | null {
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as Partial<ConsentRecord>;
    return r.version === CONSENT_VERSION && typeof r.at === "string"
      ? { version: r.version, at: r.at }
      : null;
  } catch {
    return null;
  }
}

export function saveConsent(store: Store | null = defaultStore(), now: Date = new Date()): void {
  try {
    const rec: ConsentRecord = { version: CONSENT_VERSION, at: now.toISOString() };
    store?.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* storage unavailable: consent just won't persist for this session */
  }
}

export function clearConsent(store: Store | null = defaultStore()): void {
  try {
    store?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
