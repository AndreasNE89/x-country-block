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
  const legacy = isRecord(obj.legacy) ? obj.legacy : null;
  return typeof obj.rest_id === "string" && !!legacy && typeof legacy.lang === "string";
}

function isUser(obj: Record<string, unknown>): boolean {
  if (obj.__typename === "User") return true;
  if (typeof obj.rest_id === "string" && isRecord(obj.about_profile)) return true;
  const legacy = isRecord(obj.legacy) ? obj.legacy : null;
  return typeof obj.rest_id === "string" && !!legacy && typeof legacy.screen_name === "string";
}

function extractTweet(
  obj: Record<string, unknown>,
  tweets: Map<string, TweetRecord>,
  users: Map<string, UserRecord>,
): void {
  const tweetId = String(obj.rest_id ?? "");
  if (!tweetId) return;
  const legacy = isRecord(obj.legacy) ? obj.legacy : {};
  const author = authorFromTweet(obj);
  if (author) extractUser(author, users);
  const authorId =
    (author && typeof author.rest_id === "string" && author.rest_id) ||
    (typeof legacy.user_id_str === "string" && legacy.user_id_str) ||
    null;
  const place = placeFromLegacy(legacy);
  const quoted = quotedFrom(obj);
  const retweeted = retweetedFrom(legacy);
  const prev = tweets.get(tweetId);
  if (prev) {
    if (!prev.authorId && authorId) prev.authorId = authorId;
    if (!prev.place && place) prev.place = place;
    if (!prev.lang && typeof legacy.lang === "string") prev.lang = legacy.lang;
  } else {
    tweets.set(tweetId, {
      tweetId,
      lang: typeof legacy.lang === "string" ? legacy.lang : null,
      authorId,
      place,
      quoted: null,
      retweeted: null,
    });
  }
  if (quoted) {
    extractTweet(quoted, tweets, users);
    const row = tweets.get(tweetId);
    if (row && typeof quoted.rest_id === "string") {
      row.quoted = tweets.get(String(quoted.rest_id)) ?? null;
    }
  }
  if (retweeted) {
    extractTweet(retweeted, tweets, users);
    const row = tweets.get(tweetId);
    if (row && typeof retweeted.rest_id === "string") {
      row.retweeted = tweets.get(String(retweeted.rest_id)) ?? null;
    }
  }
}

function unwrapUserResult(obj: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!obj) return null;
  if (obj.__typename === "UserUnavailable") return null;
  if (isRecord(obj.result) && obj.result !== obj) return unwrapUserResult(obj.result);
  if (obj.__typename === "User" || isUser(obj)) return obj;
  return null;
}

function authorFromTweet(obj: Record<string, unknown>): Record<string, unknown> | null {
  const core = isRecord(obj.core) ? obj.core : null;
  const userResults = core && isRecord(core.user_results) ? core.user_results : null;
  const result = userResults && isRecord(userResults.result) ? userResults.result : null;
  const fromCore = unwrapUserResult(result);
  if (fromCore) return fromCore;
  if (isRecord(obj.author)) return unwrapUserResult(obj.author) ?? obj.author;
  return null;
}

function placeFromLegacy(legacy: Record<string, unknown>): string | null {
  const place = isRecord(legacy.place) ? legacy.place : null;
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

function retweetedFrom(legacy: Record<string, unknown>): Record<string, unknown> | null {
  const rt = isRecord(legacy.retweeted_status_result) ? legacy.retweeted_status_result : null;
  const result = rt && isRecord(rt.result) ? rt.result : null;
  if (!result) return null;
  return unwrapTweet(result) ?? (isTweet(result) ? result : null);
}

function extractUser(obj: Record<string, unknown>, users: Map<string, UserRecord>): void {
  const userId = String(obj.rest_id ?? "");
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
  if (typeof legacy.location === "string" && legacy.location.trim()) return legacy.location;
  const loc = isRecord(obj.location) ? obj.location : null;
  if (loc && typeof loc.location === "string" && loc.location.trim()) return loc.location;
  const core = isRecord(obj.core) ? obj.core : null;
  if (core && typeof core.location === "string" && core.location.trim()) return core.location;
  return null;
}

function aboutProfile(obj: Record<string, unknown>): Record<string, unknown> | null {
  return isRecord(obj.about_profile) ? obj.about_profile : null;
}

function basedInFrom(obj: Record<string, unknown>, legacy: Record<string, unknown>): string | null {
  const about = aboutProfile(obj);
  if (about && typeof about.account_based_in === "string" && about.account_based_in.trim()) {
    return about.account_based_in;
  }
  if (about && typeof about.based_in === "string" && about.based_in.trim()) {
    return about.based_in;
  }
  const loc = isRecord(obj.location) ? obj.location : null;
  if (loc && typeof loc.country === "string" && loc.country.trim()) return loc.country;
  if (loc && typeof loc.country_code === "string" && loc.country_code.trim()) {
    return loc.country_code;
  }
  if (typeof obj.account_based_in === "string" && obj.account_based_in.trim()) {
    return obj.account_based_in;
  }
  if (typeof obj.country === "string" && obj.country.trim()) return obj.country;
  if (typeof legacy.country === "string" && legacy.country.trim()) return legacy.country;
  return null;
}

function connectedViaFrom(obj: Record<string, unknown>): string | null {
  const about = aboutProfile(obj);
  if (about && typeof about.source === "string" && about.source.trim()) return about.source;
  if (typeof obj.connected_via === "string" && obj.connected_via.trim()) return obj.connected_via;
  return null;
}
