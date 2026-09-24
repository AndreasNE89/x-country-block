import type { ParsedGraphQL, TweetRecord, UserRecord } from "./types.ts";

// Real X payloads nest about 40 levels deep; deeper branches are skipped rather than overflowing.
const MAX_DEPTH = 150;
const NUMERIC_ID = /^\d{1,25}$/;

type IdKind = "User" | "Tweet";

export function parseGraphQL(payload: unknown): ParsedGraphQL {
  const tweets = new Map<string, TweetRecord>();
  const users = new Map<string, UserRecord>();
  walk(payload, tweets, users, 0);
  linkQuotes(tweets);
  return { tweets: [...tweets.values()], users: [...users.values()] };
}

function walk(
  node: unknown,
  tweets: Map<string, TweetRecord>,
  users: Map<string, UserRecord>,
  depth: number,
): void {
  if (!node || typeof node !== "object" || depth > MAX_DEPTH) return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, tweets, users, depth + 1);
    return;
  }
  const obj = node as Record<string, unknown>;
  // One malformed record must not drop the rest of the response.
  try {
    const unwrapped = unwrapTweet(obj);
    if (unwrapped && !isTweetStub(unwrapped)) extractTweet(unwrapped, tweets, users);
  } catch {
    // skip this tweet
  }
  try {
    if (isUser(obj)) extractUser(obj, users);
  } catch {
    // skip this user
  }
  let values: unknown[];
  try {
    values = Object.values(obj);
  } catch {
    return;
  }
  for (const value of values) walk(value, tweets, users, depth + 1);
}

/** Fill `quoted` for quotes X sent by id only, when the quoted tweet is in the same response. */
function linkQuotes(tweets: Map<string, TweetRecord>): void {
  for (const tweet of tweets.values()) {
    if (!tweet.quoted && tweet.quotedId) tweet.quoted = tweets.get(tweet.quotedId) ?? null;
  }
}

function unwrapTweet(obj: Record<string, unknown>): Record<string, unknown> | null {
  if (obj.__typename === "TweetWithVisibilityResults" && isRecord(obj.tweet)) {
    return obj.tweet;
  }
  if (isTweet(obj)) return obj;
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isTweet(obj: Record<string, unknown>): boolean {
  if (obj.__typename === "User") return false;
  if (obj.__typename === "Tweet") return true;
  const legacy = recordOrEmpty(obj.legacy);
  return typeof idFrom(obj, "Tweet") === "string" && !!tweetLang(obj, legacy);
}

/** A bare reference such as quotedRefResult.result: an id and nothing to match on. */
function isTweetStub(obj: Record<string, unknown>): boolean {
  const legacy = recordOrEmpty(obj.legacy);
  return (
    !tweetLang(obj, legacy) &&
    !authorFromTweet(obj) &&
    !authorIdFrom(obj, legacy) &&
    !placeFrom(obj, legacy) &&
    !quotedIdFrom(obj, legacy) &&
    !retweetedIdFrom(obj, legacy)
  );
}

function isUser(obj: Record<string, unknown>): boolean {
  if (obj.__typename === "User") return true;
  const id = idFrom(obj, "User");
  if (!id) return false;
  if (isRecord(obj.about_profile)) return true;
  const legacy = recordOrEmpty(obj.legacy);
  const core = isRecord(obj.core) ? obj.core : null;
  return (
    typeof legacy.screen_name === "string" ||
    (core !== null && typeof core.screen_name === "string")
  );
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

/**
 * rest_id / id_str as sent. A plain `id` is used only when numeric, or when it is X's base64
 * node id ("User:123" / "Tweet:123") of the expected kind; anything else never matches authorId.
 */
function idFrom(obj: Record<string, unknown>, kind: IdKind): string | null {
  if (typeof obj.rest_id === "string" && obj.rest_id.trim()) return obj.rest_id.trim();
  if (typeof obj.id_str === "string" && obj.id_str.trim()) return obj.id_str.trim();
  if (typeof obj.id === "number" && Number.isSafeInteger(obj.id) && obj.id >= 0) return String(obj.id);
  if (typeof obj.id !== "string") return null;
  const id = obj.id.trim();
  if (NUMERIC_ID.test(id)) return id;
  return nodeIdNumber(id, kind);
}

function nodeIdNumber(id: string, kind: IdKind): string | null {
  if (!id || id.length > 64 || typeof atob !== "function") return null;
  try {
    const match = atob(id).match(/^(User|Tweet):(\d{1,25})$/);
    return match && match[1] === kind ? match[2]! : null;
  } catch {
    return null;
  }
}

function tweetLang(obj: Record<string, unknown>, legacy: Record<string, unknown>): string | null {
  if (typeof obj.lang === "string" && obj.lang.trim()) return obj.lang;
  if (typeof legacy.lang === "string" && legacy.lang.trim()) return legacy.lang;
  return null;
}

function authorIdFrom(obj: Record<string, unknown>, legacy: Record<string, unknown>): string | null {
  if (typeof obj.user_id_str === "string" && obj.user_id_str) return obj.user_id_str;
  if (typeof legacy.user_id_str === "string" && legacy.user_id_str) return legacy.user_id_str;
  return null;
}

function extractTweet(
  obj: Record<string, unknown>,
  tweets: Map<string, TweetRecord>,
  users: Map<string, UserRecord>,
): void {
  const tweetId = idFrom(obj, "Tweet") ?? "";
  if (!tweetId) return;
  const legacy = recordOrEmpty(obj.legacy);
  const author = authorFromTweet(obj);
  if (author) extractUser(author, users);
  const authorId = (author && idFrom(author, "User")) || authorIdFrom(obj, legacy);
  const place = placeFrom(obj, legacy);
  const quoted = quotedFrom(obj);
  const retweeted = retweetedFrom(obj, legacy);
  const quotedId = quotedIdFrom(obj, legacy);
  const retweetedId = retweetedIdFrom(obj, legacy);
  const lang = tweetLang(obj, legacy);
  const prev = tweets.get(tweetId);
  if (prev) {
    if (!prev.authorId && authorId) prev.authorId = authorId;
    if (!prev.place && place) prev.place = place;
    if (!prev.lang && lang) prev.lang = lang;
    if (!prev.quotedId && quotedId) prev.quotedId = quotedId;
    if (!prev.retweetedId && retweetedId) prev.retweetedId = retweetedId;
  } else {
    tweets.set(tweetId, {
      tweetId,
      lang,
      authorId,
      place,
      quoted: null,
      retweeted: null,
      quotedId,
      retweetedId,
    });
  }
  if (quoted) {
    extractTweet(quoted, tweets, users);
    const row = tweets.get(tweetId);
    const id = idFrom(quoted, "Tweet");
    if (row && id) row.quoted = tweets.get(id) ?? null;
  }
  if (retweeted) {
    extractTweet(retweeted, tweets, users);
    const row = tweets.get(tweetId);
    const id = idFrom(retweeted, "Tweet");
    if (row && id) row.retweeted = tweets.get(id) ?? null;
  }
}

function unwrapUserResult(obj: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!obj) return null;
  if (obj.__typename === "UserUnavailable") return null;
  if (isRecord(obj.result) && obj.result !== obj) return unwrapUserResult(obj.result);
  if (obj.__typename === "User" || isUser(obj)) return obj;
  return null;
}

function userResultsFrom(obj: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!obj) return null;
  const userResults = isRecord(obj.user_results) ? obj.user_results : null;
  const result = userResults && isRecord(userResults.result) ? userResults.result : null;
  return unwrapUserResult(result);
}

function authorFromTweet(obj: Record<string, unknown>): Record<string, unknown> | null {
  const fromCore = userResultsFrom(isRecord(obj.core) ? obj.core : null);
  if (fromCore) return fromCore;
  const fromRoot = userResultsFrom(obj);
  if (fromRoot) return fromRoot;
  if (isRecord(obj.author)) return unwrapUserResult(obj.author) ?? obj.author;
  return null;
}

function placeFrom(obj: Record<string, unknown>, legacy: Record<string, unknown>): string | null {
  const place = isRecord(obj.place) ? obj.place : isRecord(legacy.place) ? legacy.place : null;
  if (!place) return null;
  if (typeof place.country === "string" && place.country.trim()) return place.country;
  if (typeof place.full_name === "string" && place.full_name.trim()) return place.full_name;
  if (typeof place.name === "string" && place.name.trim()) return place.name;
  return null;
}

function resultOf(value: unknown): Record<string, unknown> | null {
  return isRecord(value) && isRecord(value.result) ? value.result : null;
}

function quotedFrom(obj: Record<string, unknown>): Record<string, unknown> | null {
  const result = resultOf(obj.quoted_status_result);
  if (!result) return null;
  return unwrapTweet(result) ?? (isTweet(result) ? result : null);
}

function retweetedFrom(
  obj: Record<string, unknown>,
  legacy: Record<string, unknown>,
): Record<string, unknown> | null {
  const result = resultOf(obj.retweeted_status_result) ?? resultOf(legacy.retweeted_status_result);
  if (!result) return null;
  return unwrapTweet(result) ?? (isTweet(result) ? result : null);
}

/** Id of a tweet result, looking through the visibility wrapper. */
function refId(result: Record<string, unknown> | null): string | null {
  if (!result) return null;
  const tweet = result.__typename === "TweetWithVisibilityResults" && isRecord(result.tweet) ? result.tweet : result;
  return idFrom(tweet, "Tweet");
}

function numericString(value: unknown): string | null {
  return typeof value === "string" && NUMERIC_ID.test(value.trim()) ? value.trim() : null;
}

function quotedIdFrom(obj: Record<string, unknown>, legacy: Record<string, unknown>): string | null {
  return (
    refId(resultOf(obj.quoted_status_result)) ??
    refId(resultOf(obj.quotedRefResult)) ??
    numericString(legacy.quoted_status_id_str) ??
    numericString(obj.quoted_status_id_str)
  );
}

function retweetedIdFrom(obj: Record<string, unknown>, legacy: Record<string, unknown>): string | null {
  return (
    refId(resultOf(obj.retweeted_status_result)) ??
    refId(resultOf(legacy.retweeted_status_result)) ??
    numericString(legacy.retweeted_status_id_str)
  );
}

function extractUser(obj: Record<string, unknown>, users: Map<string, UserRecord>): void {
  const userId = idFrom(obj, "User") ?? "";
  if (!userId) return;
  const legacy = isRecord(obj.legacy) ? obj.legacy : {};
  const location = locationFromUser(obj, legacy);
  const lang = typeof legacy.lang === "string" ? legacy.lang : null;
  const basedIn = basedInFrom(obj, legacy);
  const connectedVia = connectedViaFrom(obj);
  const screenName = screenNameFromUser(obj, legacy);
  const locationAccurate = locationAccurateFrom(obj);
  const prev = users.get(userId);
  users.set(userId, {
    userId,
    screenName: screenName ?? prev?.screenName ?? null,
    location: location ?? prev?.location ?? null,
    basedIn: basedIn ?? prev?.basedIn ?? null,
    connectedVia: connectedVia ?? prev?.connectedVia ?? null,
    lang: lang ?? prev?.lang ?? null,
    locationAccurate: locationAccurate ?? prev?.locationAccurate ?? null,
  });
}

function screenNameFromUser(
  obj: Record<string, unknown>,
  legacy: Record<string, unknown>,
): string | null {
  if (typeof legacy.screen_name === "string" && legacy.screen_name.trim()) {
    return legacy.screen_name;
  }
  const core = isRecord(obj.core) ? obj.core : null;
  if (core && typeof core.screen_name === "string" && core.screen_name.trim()) {
    return core.screen_name;
  }
  return null;
}

/**
 * The profile location. Returns "" when X sent the field blank (the account cleared it), so the
 * cache can drop an old value, and null when no location field was sent at all.
 */
function locationFromUser(
  obj: Record<string, unknown>,
  legacy: Record<string, unknown>,
): string | null {
  const loc = isRecord(obj.location) ? obj.location : isRecord(legacy.location) ? legacy.location : null;
  const core = isRecord(obj.core) ? obj.core : null;
  const candidates = [obj.location, legacy.location, loc?.location, loc?.full_name, core?.location];
  let blank = false;
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
    blank = true;
  }
  return blank ? "" : null;
}

function aboutProfile(obj: Record<string, unknown>): Record<string, unknown> | null {
  return isRecord(obj.about_profile) ? obj.about_profile : null;
}

function locationAccurateFrom(obj: Record<string, unknown>): boolean | null {
  const accurate = aboutProfile(obj)?.location_accurate;
  return typeof accurate === "boolean" ? accurate : null;
}

function countryText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (!isRecord(value)) return null;
  return (
    countryText(value.account_based_in) ??
    countryText(value.based_in) ??
    countryText(value.country) ??
    countryText(value.country_code) ??
    countryText(value.name)
  );
}

function basedInFrom(obj: Record<string, unknown>, legacy: Record<string, unknown>): string | null {
  const about = aboutProfile(obj) ?? (isRecord(obj.about) ? obj.about : null);
  return (
    countryText(about?.account_based_in) ??
    countryText(about?.based_in) ??
    countryText(obj.account_based_in) ??
    countryText(obj.based_in) ??
    countryText(isRecord(obj.location) ? obj.location.country : null) ??
    countryText(isRecord(obj.location) ? obj.location.country_code : null) ??
    countryText(obj.country) ??
    countryText(legacy.country)
  );
}

function connectedViaFrom(obj: Record<string, unknown>): string | null {
  const about = aboutProfile(obj);
  if (about && typeof about.source === "string" && about.source.trim()) return about.source;
  if (typeof obj.connected_via === "string" && obj.connected_via.trim()) return obj.connected_via;
  return null;
}
