import { hasLocationSignal, mergeStoredRows, type StoredUser } from "../shared/cache.ts";
import { parseStoredUsers, storedSeenAt } from "./records.ts";

/** At most one userCache write per this many ms from a tab. */
export const PERSIST_DELAY_MS = 5_000;
/**
 * How long after a write this tab checks that its rows are still stored. Another tab that writes
 * before it hears of this write replaces the key from an older copy; that happens within a
 * storage round-trip, so a few seconds is ample.
 */
export const CONFIRM_MS = 2 * PERSIST_DELAY_MS;

type Area = { set: (items: Record<string, unknown>) => Promise<void> };

export type PersistDeps = {
  area: Area | null;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  delayMs?: number;
};

/**
 * Whether a stored copy lost a row this tab wrote: a row with a location signal is missing or
 * older, or a row that cleared a location (the merge drops it) came back as an older copy.
 */
function lostFrom(seen: Map<string, number>, row: StoredUser): boolean {
  const stored = seen.get(row.userId);
  if (hasLocationSignal(row)) return stored === undefined || stored < row.seenAt;
  return stored !== undefined && stored < row.seenAt;
}

/**
 * Batches this tab's account rows into chrome.storage.local "userCache". Writes are throttled,
 * merged into the stored copy that other tabs write too (kept current from storage.onChanged, so
 * a flush on pagehide needs no read first), and limited to rows with a location signal. Two tabs
 * that write at the same moment each build on a copy without the other's rows, so the later
 * write drops the earlier one's: for a short while after a write, rows the stored copy lost are
 * written again. A tab that closes cannot write again, so rows lost then are a cache miss.
 */
export class UserPersister {
  private readonly pending = new Map<string, StoredUser>();
  private readonly sent = new Map<string, StoredUser>();
  private sentUntil = 0;
  private stored: unknown = [];
  private storedIds: Set<string> | null = null;
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
    this.sent.clear();
    this.cancel();
  }

  /** The stored copy, as read at startup or written by any tab since. */
  setStored(raw: unknown): void {
    this.stored = raw;
    this.storedIds = null;
    if (this.sent.size === 0 || !this.allowed) return;
    if (this.deps.now() > this.sentUntil) {
      this.sent.clear();
      return;
    }
    const seen = storedSeenAt(raw);
    if ([...this.sent.values()].some((row) => lostFrom(seen, row))) this.arm();
  }

  /** Queue a row that UserCache.put() reported as worth saving. */
  note(row: StoredUser | null): void {
    if (!row || !this.allowed || !this.worthWriting(row)) return;
    this.pending.set(row.userId, row);
    this.arm();
  }

  flush(): void {
    this.cancel();
    const area = this.deps.area;
    if (!this.allowed || !area) return;
    const now = this.deps.now();
    const lost = this.lostRows(now);
    if (this.pending.size === 0 && lost.length === 0) return;
    const renewed = this.pending.size > 0;
    const fresh = [...lost, ...this.pending.values()];
    this.pending.clear();
    if (!fresh.some((row) => this.worthWriting(row))) return;
    const rows = mergeStoredRows(parseStoredUsers(this.stored, now), fresh, now);
    this.stored = rows;
    this.storedIds = null;
    for (const row of fresh) this.sent.set(row.userId, row);
    // Rows written again do not extend the check, so two tabs cannot keep re-writing forever.
    if (renewed) this.sentUntil = now + CONFIRM_MS;
    try {
      void area.set({ userCache: rows }).catch(() => {
        // quota or extension context gone: the rows stay in memory for this tab
      });
    } catch {
      // extension context invalidated
    }
  }

  /** Rows this tab wrote lately that the stored copy has since lost (not replaced by newer ones). */
  private lostRows(now: number): StoredUser[] {
    if (this.sent.size === 0) return [];
    if (now > this.sentUntil) {
      this.sent.clear();
      return [];
    }
    const seen = storedSeenAt(this.stored);
    return [...this.sent.values()].filter((row) => !this.pending.has(row.userId) && lostFrom(seen, row));
  }

  /**
   * A row with a location signal is saved. A row without one (X now sends the location blank) is
   * written only to replace an older copy with a signal, stored or pending, which the merge then
   * drops; otherwise the cleared location would come back from storage in every new tab.
   */
  private worthWriting(row: StoredUser): boolean {
    if (hasLocationSignal(row) || this.pending.has(row.userId)) return true;
    this.storedIds ??= new Set(storedSeenAt(this.stored).keys());
    return this.storedIds.has(row.userId);
  }

  private arm(): void {
    if (this.timer !== null) return;
    this.timer = this.deps.setTimer(() => {
      this.timer = null;
      this.flush();
    }, this.deps.delayMs ?? PERSIST_DELAY_MS);
  }

  cancel(): void {
    if (this.timer === null) return;
    this.deps.clearTimer(this.timer);
    this.timer = null;
  }
}
