import type { ParsedGraphQL, TweetRecord, UserRecord } from "./types.ts";

export function parseGraphQL(payload: unknown): ParsedGraphQL {
  const tweets = new Map<string, TweetRecord>();
  const users = new Map<string, UserRecord>();
  try {
    walk(payload, tweets, users);
  } catch {
    return { tweets: [], users: [] };
  }
  return { tweets: [...tweets.values()], users: [...users.values()] };
}

function walk(
  node: unknown,
  tweets: Map<string, TweetRecord>,
  users: Map<string, UserRecord>,
): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, tweets, users);
    return;
  }
  const obj = node as Record<string, unknown>;
  const unwrapped = unwrapTweet(obj);
  if (unwrapped) extractTweet(unwrapped, tweets, users);
  if (isUser(obj)) extractUser(obj, users);
  for (const value of Object.values(obj)) walk(value, tweets, users);
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
  return typeof idFrom(obj) === "string" && !!tweetLang(obj, legacy);
}

function isUser(obj: Record<string, unknown>): boolean {
  if (obj.__typename === "User") return true;
  const id = idFrom(obj);
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

function idFrom(obj: Record<string, unknown>): string | null {
  if (typeof obj.rest_id === "string" && obj.rest_id.trim()) return obj.rest_id;
  if (typeof obj.id_str === "string" && obj.id_str.trim()) return obj.id_str;
  if (typeof obj.id === "string" && obj.id.trim()) return obj.id;
  if (typeof obj.id === "number" && Number.isFinite(obj.id)) return String(obj.id);
  return null;
}

function tweetLang(obj: Record<string, unknown>, legacy: Record<string, unknown>): string | null {
  if (typeof obj.lang === "string" && obj.lang.trim()) return obj.lang;
  if (typeof legacy.lang === "string" && legacy.lang.trim()) return legacy.lang;
  return null;
}

function extractTweet(
  obj: Record<string, unknown>,
  tweets: Map<string, TweetRecord>,
  users: Map<string, UserRecord>,
): void {
  const tweetId = idFrom(obj) ?? "";
  if (!tweetId) return;
  const legacy = recordOrEmpty(obj.legacy);
  const author = authorFromTweet(obj);
  if (author) extractUser(author, users);
  const authorId =
    (author && idFrom(author)) ||
    (typeof obj.user_id_str === "string" && obj.user_id_str) ||
    (typeof legacy.user_id_str === "string" && legacy.user_id_str) ||
    null;
  const place = placeFrom(obj, legacy);
  const quoted = quotedFrom(obj);
  const retweeted = retweetedFrom(obj, legacy);
  const lang = tweetLang(obj, legacy);
  const prev = tweets.get(tweetId);
  if (prev) {
    if (!prev.authorId && authorId) prev.authorId = authorId;
    if (!prev.place && place) prev.place = place;
    if (!prev.lang && lang) prev.lang = lang;
  } else {
    tweets.set(tweetId, {
      tweetId,
      lang,
      authorId,
      place,
      quoted: null,
      retweeted: null,
    });
  }
  if (quoted) {
    extractTweet(quoted, tweets, users);
    const row = tweets.get(tweetId);
    const quotedId = idFrom(quoted);
    if (row && quotedId) row.quoted = tweets.get(quotedId) ?? null;
  }
  if (retweeted) {
    extractTweet(retweeted, tweets, users);
    const row = tweets.get(tweetId);
    const retweetedId = idFrom(retweeted);
    if (row && retweetedId) row.retweeted = tweets.get(retweetedId) ?? null;
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

function quotedFrom(obj: Record<string, unknown>): Record<string, unknown> | null {
  const quoted = isRecord(obj.quoted_status_result) ? obj.quoted_status_result : null;
  const result = quoted && isRecord(quoted.result) ? quoted.result : null;
  if (!result) return null;
  return unwrapTweet(result) ?? (isTweet(result) ? result : null);
}

function retweetedFrom(
  obj: Record<string, unknown>,
  legacy: Record<string, unknown>,
): Record<string, unknown> | null {
  const rt = isRecord(obj.retweeted_status_result)
    ? obj.retweeted_status_result
    : isRecord(legacy.retweeted_status_result)
      ? legacy.retweeted_status_result
      : null;
  const result = rt && isRecord(rt.result) ? rt.result : null;
  if (!result) return null;
  return unwrapTweet(result) ?? (isTweet(result) ? result : null);
}

function extractUser(obj: Record<string, unknown>, users: Map<string, UserRecord>): void {
  const userId = idFrom(obj) ?? "";
  if (!userId) return;
  const legacy = isRecord(obj.legacy) ? obj.legacy : {};
  const location = locationFromUser(obj, legacy);
  const lang = typeof legacy.lang === "string" ? legacy.lang : null;
  const basedIn = basedInFrom(obj, legacy);
  const connectedVia = connectedViaFrom(obj);
  const screenName = screenNameFromUser(obj, legacy);
  const prev = users.get(userId);
  users.set(userId, {
    userId,
    screenName: screenName ?? prev?.screenName ?? null,
    location: location ?? prev?.location ?? null,
    basedIn: basedIn ?? prev?.basedIn ?? null,
    connectedVia: connectedVia ?? prev?.connectedVia ?? null,
    lang: lang ?? prev?.lang ?? null,
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

function locationFromUser(
  obj: Record<string, unknown>,
  legacy: Record<string, unknown>,
): string | null {
  if (typeof obj.location === "string" && obj.location.trim()) return obj.location;
  if (typeof legacy.location === "string" && legacy.location.trim()) return legacy.location;
  const loc = isRecord(obj.location)
    ? obj.location
    : isRecord(legacy.location)
      ? legacy.location
      : null;
  if (loc) {
    if (typeof loc.location === "string" && loc.location.trim()) return loc.location;
    if (typeof loc.full_name === "string" && loc.full_name.trim()) return loc.full_name;
  }
  const core = isRecord(obj.core) ? obj.core : null;
  if (core && typeof core.location === "string" && core.location.trim()) return core.location;
  return null;
}

function aboutProfile(obj: Record<string, unknown>): Record<string, unknown> | null {
  return isRecord(obj.about_profile) ? obj.about_profile : null;
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
