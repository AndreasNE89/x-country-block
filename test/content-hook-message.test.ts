import { describe, expect, it } from "vitest";
import { MAX_RECORDS, readHookMessage } from "../src/content/hook-message.ts";
import { parseStoredUsers, sanitizeTweet, sanitizeUser } from "../src/content/records.ts";
import { USER_TTL_MS } from "../src/shared/cache.ts";
import { HOOK_SOURCE, HOOK_VERSION } from "../src/shared/types.ts";

const NOW = 1_800_000_000_000;

function message(data: unknown, init: { origin?: string; source?: unknown } = {}) {
  return {
    data,
    origin: init.origin ?? window.location.origin,
    source: (init.source === undefined ? window : init.source) as MessageEventSource | null,
  };
}

function batch(users: unknown[], tweets: unknown[] = []) {
  return { source: HOOK_SOURCE, type: "graphql", v: HOOK_VERSION, users, tweets };
}

const USER = {
  userId: "1",
  screenName: "legit_user",
  location: "Oslo",
  basedIn: null,
  connectedVia: null,
  lang: "no",
};

describe("readHookMessage (F11)", () => {
  it("accepts a batch this window posted to itself", () => {
    expect(readHookMessage(message(batch([USER])), window)?.users).toEqual([
      { ...USER, locationAccurate: null },
    ]);
  });

  it("rejects messages from another origin or from a child frame", () => {
    expect(readHookMessage(message(batch([USER]), { origin: "https://evil.example" }), window)).toBeNull();
    expect(readHookMessage(message(batch([USER]), { source: null }), window)).toBeNull();
    expect(readHookMessage(message(batch([USER]), { source: {} }), window)).toBeNull();
  });

  it("rejects other shapes", () => {
    expect(readHookMessage(message({ ...batch([USER]), source: "other" }), window)).toBeNull();
    expect(readHookMessage(message({ ...batch([USER]), type: "nope" }), window)).toBeNull();
    expect(readHookMessage(message({ source: HOOK_SOURCE, type: "graphql", users: {} }), window)).toBeNull();
    expect(readHookMessage(message("x-country-block"), window)).toBeNull();
  });

  it("ignores a hook from an older build still running in the page (R40)", () => {
    const { v: _v, ...untagged } = batch([USER]);
    expect(readHookMessage(message(untagged), window)).toBeNull();
    expect(readHookMessage(message({ ...batch([USER]), v: 1 }), window)).toBeNull();
  });

  it("drops malformed rows but keeps the good ones", () => {
    const data = readHookMessage(
      message(batch([null, 42, { userId: "abc" }, { userId: "666", screenName: 42 }, USER])),
      window,
    );
    expect(data?.users.map((u) => u.userId)).toEqual(["666", "1"]);
    expect(data?.users[0]?.screenName).toBeNull();
  });

  it("caps the number of records per message", () => {
    const flood = Array.from({ length: MAX_RECORDS * 3 }, (_, i) => ({ ...USER, userId: String(i + 1) }));
    expect(readHookMessage(message(batch(flood)), window)?.users).toHaveLength(MAX_RECORDS);
  });
});

describe("record sanitizers", () => {
  it("clips long text and rejects odd language tags", () => {
    const user = sanitizeUser({ ...USER, location: "x".repeat(10_000), lang: "<script>" });
    expect(user?.location).toHaveLength(160);
    expect(user?.lang).toBeNull();
  });

  it("checks nested tweets to two levels", () => {
    const deep = {
      tweetId: "1",
      quoted: { tweetId: "2", quoted: { tweetId: "3", quoted: { tweetId: "4" } } },
    };
    const tweet = sanitizeTweet(deep);
    expect(tweet?.quoted?.tweetId).toBe("2");
    expect(tweet?.quoted?.quoted?.tweetId).toBe("3");
    expect(tweet?.quoted?.quoted?.quoted).toBeNull();
    expect(sanitizeTweet({ tweetId: "1", authorId: "u-1" })?.authorId).toBeNull();
  });

  it("reads stored rows: drops junk, expired rows and rows from before 0.2.0 (R12, R41)", () => {
    const rows = parseStoredUsers(
      [
        { ...USER, userId: "1", seenAt: NOW - 1000 },
        { ...USER, userId: "2", basedIn: "Nigeria lol" },
        { ...USER, userId: "3", seenAt: NOW - USER_TTL_MS - 1 },
        { userId: 5 },
        "junk",
      ],
      NOW,
    );
    expect(rows.map((r) => [r.userId, r.seenAt])).toEqual([
      ["1", NOW - 1000],
    ]);
    expect(parseStoredUsers({ not: "a list" }, NOW)).toEqual([]);
  });
});
