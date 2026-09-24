import { hasLocationSignal, mergeStoredRows, type StoredUser } from "../shared/cache.ts";
import { parseStoredUsers } from "./records.ts";

/** At most one userCache write per this many ms from a tab. */
export const PERSIST_DELAY_MS = 5_000;

type Area = { set: (items: Record<string, unknown>) => Promise<void> };

export type PersistDeps = {
  area: Area | null;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  delayMs?: number;
};

/**
 * Batches this tab's account rows into chrome.storage.local "userCache". Writes are throttled,
 * merged into the stored copy that other tabs write too (kept current from storage.onChanged, so
 * a flush on pagehide needs no read first), and limited to rows with a location signal.
 */
export class UserPersister {
  private readonly pending = new Map<string, StoredUser>();
  private stored: unknown = [];
  private timer: unknown = null;
  private allowed = false;

  constructor(private readonly deps: PersistDeps) {}

  get pendingCount(): number {
    return this.pending.size;
  }

  /** Writes are allowed only while a filter is on and the tab is not incognito/private. */
  setAllowed(allowed: boolean): void {
    this.allowed = allowed;
    if (allowed) return;
    this.pending.clear();
    this.cancel();
  }

  /** The stored copy, as read at startup or written by any tab since. */
  setStored(raw: unknown): void {
    this.stored = raw;
  }

  /** Queue a row that UserCache.put() reported as worth saving. */
  note(row: StoredUser | null): void {
    if (!row || !this.allowed || !hasLocationSignal(row)) return;
    this.pending.set(row.userId, row);
    if (this.timer !== null) return;
    this.timer = this.deps.setTimer(() => {
      this.timer = null;
      this.flush();
    }, this.deps.delayMs ?? PERSIST_DELAY_MS);
  }

  flush(): void {
    this.cancel();
    const area = this.deps.area;
    if (!this.allowed || this.pending.size === 0 || !area) return;
    const now = this.deps.now();
    const rows = mergeStoredRows(parseStoredUsers(this.stored, now), [...this.pending.values()], now);
    this.pending.clear();
    this.stored = rows;
    try {
      void area.set({ userCache: rows }).catch(() => {
        // quota or extension context gone: the rows stay in memory for this tab
      });
    } catch {
      // extension context invalidated
    }
  }

  cancel(): void {
    if (this.timer === null) return;
    this.deps.clearTimer(this.timer);
    this.timer = null;
  }
}
