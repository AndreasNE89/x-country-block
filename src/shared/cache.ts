import type { UserRecord } from "./types.ts";

/** A saved account row expires when it has not been refreshed for this long. */
export const USER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** A row seen again after this long is saved again, so accounts still in view do not expire. */
export const USER_REFRESH_MS = 24 * 60 * 60 * 1000;
/** Most rows kept in chrome.storage.local "userCache". */
export const PERSIST_LIMIT = 5_000;

/** A user row as kept in memory and in storage: seenAt is when it was last worth saving. */
export type StoredUser = UserRecord & { seenAt: number };

/** Only rows that can decide a location match are worth saving. */
export function hasLocationSignal(user: UserRecord): boolean {
  return Boolean(user.location || user.basedIn || user.connectedVia);
}

/**
 * Merge a newer sighting over an older one. Fields the newer one carries win; missing (null)
 * fields keep the old value. An empty location is a value: X sent it blank, so it was cleared.
 */
export function mergeUser(prev: UserRecord | undefined, next: UserRecord): UserRecord {
  return {
    userId: next.userId,
    screenName: next.screenName ?? prev?.screenName ?? null,
    location: next.location ?? prev?.location ?? null,
    basedIn: next.basedIn ?? prev?.basedIn ?? null,
    connectedVia: next.connectedVia ?? prev?.connectedVia ?? null,
    lang: next.lang ?? prev?.lang ?? null,
    locationAccurate: next.locationAccurate ?? prev?.locationAccurate ?? null,
  };
}

function sameFields(a: UserRecord, b: UserRecord): boolean {
  return (
    a.screenName === b.screenName &&
    a.location === b.location &&
    a.basedIn === b.basedIn &&
    a.connectedVia === b.connectedVia &&
    a.lang === b.lang &&
    (a.locationAccurate ?? null) === (b.locationAccurate ?? null)
  );
}

/** LRU of users keyed by id, using Map insertion order (oldest first), with a screen-name index. */
export class UserCache {
  private readonly rows = new Map<string, StoredUser>();
  private readonly names = new Map<string, string>();

  constructor(private readonly limit: number) {}

  get size(): number {
    return this.rows.size;
  }

  get(id: string): StoredUser | undefined {
    const row = this.rows.get(id);
    if (!row) return undefined;
    this.rows.delete(id);
    this.rows.set(id, row);
    return row;
  }

  peek(id: string): StoredUser | undefined {
    return this.rows.get(id);
  }

  byScreenName(name: string): StoredUser | undefined {
    const id = this.names.get(name.toLowerCase());
    return id ? this.rows.get(id) : undefined;
  }

  /**
   * Merge a sighting into the cache. Returns the merged row when it is worth saving (new, a field
   * changed, or last saved more than USER_REFRESH_MS ago), otherwise null.
   */
  put(user: UserRecord, now: number): StoredUser | null {
    const prev = this.rows.get(user.userId);
    const merged = mergeUser(prev, user);
    const worthSaving = !prev || !sameFields(prev, merged) || now - prev.seenAt >= USER_REFRESH_MS;
    const row: StoredUser = { ...merged, seenAt: worthSaving || !prev ? now : prev.seenAt };
    this.insert(row);
    this.evict();
    return worthSaving ? row : null;
  }

  /** Add stored rows. Rows already in memory are fresher, so their fields win. */
  load(stored: StoredUser[]): void {
    const current = [...this.rows.values()];
    this.rows.clear();
    this.names.clear();
    const sorted = [...stored].sort((a, b) => a.seenAt - b.seenAt);
    for (const row of sorted) this.insert(row);
    for (const row of current) {
      const prev = this.rows.get(row.userId);
      this.insert(prev ? { ...mergeUser(prev, row), seenAt: Math.max(prev.seenAt, row.seenAt) } : row);
    }
    this.evict();
  }

  /** Oldest first. */
  dump(): StoredUser[] {
    return [...this.rows.values()];
  }

  private insert(row: StoredUser): void {
    const prev = this.rows.get(row.userId);
    if (prev?.screenName && prev.screenName.toLowerCase() !== row.screenName?.toLowerCase()) {
      this.dropName(prev);
    }
    this.rows.delete(row.userId);
    this.rows.set(row.userId, row);
    if (row.screenName) this.names.set(row.screenName.toLowerCase(), row.userId);
  }

  private evict(): void {
    while (this.rows.size > this.limit) {
      const oldest = this.rows.keys().next();
      if (oldest.done) return;
      const row = this.rows.get(oldest.value);
      this.rows.delete(oldest.value);
      if (row) this.dropName(row);
    }
  }

  private dropName(row: StoredUser): void {
    if (!row.screenName) return;
    const key = row.screenName.toLowerCase();
    if (this.names.get(key) === row.userId) this.names.delete(key);
  }
}

/**
 * Merge this tab's fresh rows into the stored copy (other tabs write it too). Per user the most
 * recently seen row wins field by field. Drops expired rows and rows without a location signal,
 * and keeps the `limit` most recently seen.
 */
export function mergeStoredRows(
  stored: StoredUser[],
  fresh: StoredUser[],
  now: number,
  limit = PERSIST_LIMIT,
  ttlMs = USER_TTL_MS,
): StoredUser[] {
  const byId = new Map<string, StoredUser>();
  for (const row of [...stored, ...fresh]) {
    if (now - row.seenAt > ttlMs) continue;
    const prev = byId.get(row.userId);
    if (!prev) {
      byId.set(row.userId, row);
      continue;
    }
    const [older, newer] = prev.seenAt <= row.seenAt ? [prev, row] : [row, prev];
    byId.set(row.userId, { ...mergeUser(older, newer), seenAt: newer.seenAt });
  }
  return [...byId.values()]
    .filter(hasLocationSignal)
    .sort((a, b) => a.seenAt - b.seenAt)
    .slice(-limit);
}
