// Shape checks for records that cross a trust boundary: window messages from the MAIN-world hook
// (any page script can post those) and rows read back from chrome.storage.local.
import type { StoredUser } from "../shared/cache.ts";
import { USER_TTL_MS } from "../shared/cache.ts";
import type { TweetRecord, UserRecord } from "../shared/types.ts";

const ID = /^\d{1,25}$/;
const SCREEN_NAME = /^[A-Za-z0-9_]{1,20}$/;
const LANG = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8}){0,2}$/;
const TEXT_MAX = 160;
/** A tweet record may nest a quoted/retweeted record, which may nest one more. */
const TWEET_DEPTH = 2;

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function id(value: unknown): string | null {
  return typeof value === "string" && ID.test(value) ? value : null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.length > TEXT_MAX ? value.slice(0, TEXT_MAX) : value;
}

function lang(value: unknown): string | null {
  return typeof value === "string" && LANG.test(value) ? value : null;
}

export function sanitizeUser(raw: unknown): UserRecord | null {
  if (!isObject(raw)) return null;
  const userId = id(raw.userId);
  if (!userId) return null;
  return {
    userId,
    screenName: typeof raw.screenName === "string" && SCREEN_NAME.test(raw.screenName) ? raw.screenName : null,
    location: text(raw.location),
    basedIn: text(raw.basedIn),
    connectedVia: text(raw.connectedVia),
    lang: lang(raw.lang),
    locationAccurate: typeof raw.locationAccurate === "boolean" ? raw.locationAccurate : null,
  };
}

export function sanitizeTweet(raw: unknown, depth = 0): TweetRecord | null {
  if (!isObject(raw)) return null;
  const tweetId = id(raw.tweetId);
  if (!tweetId) return null;
  const nested = (value: unknown): TweetRecord | null =>
    depth < TWEET_DEPTH ? sanitizeTweet(value, depth + 1) : null;
  return {
    tweetId,
    lang: lang(raw.lang),
    authorId: id(raw.authorId),
    place: text(raw.place),
    quoted: nested(raw.quoted),
    retweeted: nested(raw.retweeted),
    quotedId: id(raw.quotedId),
    retweetedId: id(raw.retweetedId),
  };
}

/** Clean up to `limit` records, dropping the malformed ones. */
export function sanitizeList<T>(raw: unknown, clean: (row: unknown) => T | null, limit: number): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const row of raw.slice(0, limit)) {
    const value = clean(row);
    if (value) out.push(value);
  }
  return out;
}

/**
 * Rows from chrome.storage.local "userCache": malformed rows are dropped, rows from builds before
 * 0.2.0 (no seenAt) count as seen now, and rows not refreshed within the TTL are dropped.
 */
export function parseStoredUsers(raw: unknown, now: number, ttlMs = USER_TTL_MS): StoredUser[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredUser[] = [];
  for (const row of raw) {
    const user = sanitizeUser(row);
    if (!user) continue;
    const seenAt = isObject(row) && typeof row.seenAt === "number" && Number.isFinite(row.seenAt)
      ? Math.min(row.seenAt, now)
      : now;
    if (now - seenAt > ttlMs) continue;
    out.push({ ...user, seenAt });
  }
  return out;
}
