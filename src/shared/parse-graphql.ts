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
  const legacy = isRecord(obj.legacy) ? obj.legacy : null;
  return typeof obj.rest_id === "string" && !!legacy && typeof legacy.screen_name === "string";
}

function extractTweet(
  obj: Record<string, unknown>,
  tweets: Map<string, TweetRecord>,
  users: Map<string, UserRecord>,
): void {
  const tweetId = String(obj.rest_id ?? "");
  if (!tweetId || tweets.has(tweetId)) return;
  const legacy = isRecord(obj.legacy) ? obj.legacy : {};
  const author = authorFromTweet(obj);
  if (author) extractUser(author, users);
  const quoted = quotedFrom(obj);
  const retweeted = retweetedFrom(legacy);
  tweets.set(tweetId, {
    tweetId,
    lang: typeof legacy.lang === "string" ? legacy.lang : null,
    authorId: author && typeof author.rest_id === "string" ? author.rest_id : null,
    quoted: null,
    retweeted: null,
  });
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

function authorFromTweet(obj: Record<string, unknown>): Record<string, unknown> | null {
  const core = isRecord(obj.core) ? obj.core : null;
  const userResults = core && isRecord(core.user_results) ? core.user_results : null;
  const result = userResults && isRecord(userResults.result) ? userResults.result : null;
  return result;
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
  const location = typeof legacy.location === "string" ? legacy.location : null;
  const lang = typeof legacy.lang === "string" ? legacy.lang : null;
  const basedIn = basedInFrom(obj, legacy);
  const prev = users.get(userId);
  users.set(userId, {
    userId,
    location: location ?? prev?.location ?? null,
    basedIn: basedIn ?? prev?.basedIn ?? null,
    lang: lang ?? prev?.lang ?? null,
  });
}

function basedInFrom(obj: Record<string, unknown>, legacy: Record<string, unknown>): string | null {
  const loc = isRecord(obj.location) ? obj.location : null;
  if (loc && typeof loc.country === "string") return loc.country;
  if (typeof obj.account_based_in === "string") return obj.account_based_in;
  if (typeof obj.country === "string") return obj.country;
  if (typeof legacy.country === "string") return legacy.country;
  return null;
}
