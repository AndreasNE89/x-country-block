import { describe, expect, it } from "vitest";
import {
  hasLocationSignal,
  mergeStoredRows,
  mergeUser,
  type StoredUser,
  UserCache,
  USER_REFRESH_MS,
  USER_TTL_MS,
} from "../src/shared/cache.ts";
import type { UserRecord } from "../src/shared/types.ts";

const NOW = 1_800_000_000_000;

function user(partial: Partial<UserRecord> & Pick<UserRecord, "userId">): UserRecord {
  return {
    screenName: null,
    location: null,
    basedIn: null,
    connectedVia: null,
    lang: null,
    ...partial,
  };
}

function stored(partial: Partial<StoredUser> & Pick<StoredUser, "userId">): StoredUser {
  return { ...user(partial), seenAt: NOW, ...partial };
}

describe("UserCache", () => {
  it("evicts oldest when over limit", () => {
    const cache = new UserCache(2);
    cache.put(user({ userId: "a", location: "A" }), NOW);
    cache.put(user({ userId: "b", location: "B" }), NOW);
    cache.put(user({ userId: "c", location: "C" }), NOW);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("c")?.location).toBe("C");
    expect(cache.size).toBe(2);
  });

  it("merges fields on put and refreshes LRU", () => {
    const cache = new UserCache(2);
    cache.put(user({ userId: "a", location: "A" }), NOW);
    cache.put(user({ userId: "b", location: "B" }), NOW);
    cache.put(
      user({
        userId: "a",
        basedIn: "India",
        connectedVia: "India Android App",
        lang: "hi",
      }),
      NOW,
    );
    cache.put(user({ userId: "c", location: "C" }), NOW);
    expect(cache.get("a")?.basedIn).toBe("India");
    expect(cache.get("a")?.connectedVia).toBe("India Android App");
    expect(cache.get("a")?.location).toBe("A");
    expect(cache.get("b")).toBeUndefined();
  });

  it("should refresh LRU when reading an entry", () => {
    const cache = new UserCache(2);
    cache.put(user({ userId: "a", location: "A" }), NOW);
    cache.put(user({ userId: "b", location: "B" }), NOW);

    expect(cache.get("a")?.location).toBe("A");
    cache.put(user({ userId: "c", location: "C" }), NOW);

    expect(cache.get("a")?.location).toBe("A");
    expect(cache.get("b")).toBeUndefined();
  });

  it("peek does not refresh LRU", () => {
    const cache = new UserCache(2);
    cache.put(user({ userId: "a", location: "A" }), NOW);
    cache.put(user({ userId: "b", location: "B" }), NOW);
    expect(cache.peek("a")?.location).toBe("A");
    cache.put(user({ userId: "c", location: "C" }), NOW);
    expect(cache.peek("a")).toBeUndefined();
  });

  it("finds a user by screen name, case-insensitively, and forgets evicted names", () => {
    const cache = new UserCache(2);
    cache.put(user({ userId: "1", screenName: "Alice", location: "Oslo" }), NOW);
    expect(cache.byScreenName("alice")?.userId).toBe("1");
    expect(cache.byScreenName("ALICE")?.location).toBe("Oslo");
    cache.put(user({ userId: "1", screenName: "alice_new" }), NOW);
    expect(cache.byScreenName("alice")).toBeUndefined();
    expect(cache.byScreenName("alice_new")?.userId).toBe("1");
    cache.put(user({ userId: "2" }), NOW);
    cache.put(user({ userId: "3" }), NOW);
    expect(cache.byScreenName("alice_new")).toBeUndefined();
  });

  it("lets an explicitly cleared location replace the old one", () => {
    const cache = new UserCache(10);
    cache.put(user({ userId: "a", location: "Lagos, Nigeria" }), NOW);
    cache.put(user({ userId: "a", location: null }), NOW);
    expect(cache.get("a")?.location).toBe("Lagos, Nigeria");
    cache.put(user({ userId: "a", location: "" }), NOW);
    expect(cache.get("a")?.location).toBe("");
  });

  it("keeps the location accuracy flag across sparser sightings", () => {
    const cache = new UserCache(10);
    cache.put(user({ userId: "a", basedIn: "Nigeria", locationAccurate: false }), NOW);
    cache.put(user({ userId: "a", location: "Toronto" }), NOW);
    expect(cache.get("a")?.locationAccurate).toBe(false);
    cache.put(user({ userId: "a", locationAccurate: true }), NOW);
    expect(cache.get("a")?.locationAccurate).toBe(true);
  });

  it("reports a row as worth saving only when it changed or was saved long ago", () => {
    const cache = new UserCache(10);
    expect(cache.put(user({ userId: "a", location: "Oslo" }), NOW)?.seenAt).toBe(NOW);
    expect(cache.put(user({ userId: "a", location: "Oslo" }), NOW + 1000)).toBeNull();
    expect(cache.put(user({ userId: "a", basedIn: "Norway" }), NOW + 2000)?.basedIn).toBe("Norway");
    const later = NOW + 2000 + USER_REFRESH_MS;
    expect(cache.put(user({ userId: "a" }), later)?.seenAt).toBe(later);
  });

  it("loads stored rows without overwriting fresher in-memory rows", () => {
    const cache = new UserCache(10);
    cache.put(user({ userId: "a", location: "Bergen" }), NOW);
    cache.load([
      stored({ userId: "a", location: "Oslo", basedIn: "Norway", seenAt: NOW - 5000 }),
      stored({ userId: "b", location: "Paris", seenAt: NOW - 5000 }),
    ]);
    expect(cache.get("a")?.location).toBe("Bergen");
    expect(cache.get("a")?.basedIn).toBe("Norway");
    expect(cache.get("b")?.location).toBe("Paris");
  });

  it("absorbs rows another tab saved later, and only those (R11)", () => {
    const cache = new UserCache(10);
    cache.put(user({ userId: "a", screenName: "a", location: "Austin, TX" }), NOW);
    cache.put(user({ userId: "b", location: "Oslo" }), NOW);
    const changed = cache.absorb([
      stored({ userId: "a", screenName: "a", basedIn: "India", seenAt: NOW + 10 }),
      stored({ userId: "b", location: "Lagos", seenAt: NOW - 10 }),
      stored({ userId: "c", screenName: "Cee", location: "Lima", seenAt: NOW + 5 }),
    ]);
    expect(changed).toBe(true);
    expect(cache.peek("a")).toMatchObject({ location: "Austin, TX", basedIn: "India", seenAt: NOW + 10 });
    // An older copy (a stale write from another tab) never replaces what this tab saw.
    expect(cache.peek("b")).toMatchObject({ location: "Oslo", seenAt: NOW });
    expect(cache.byScreenName("cee")?.location).toBe("Lima");
    // Absorbed rows keep their seenAt, so a sighting soon after is not worth saving again.
    expect(cache.put(user({ userId: "a", screenName: "a", location: "Austin, TX" }), NOW + 20)).toBeNull();
  });

  it("reports no change when another tab saved the same fields (its own write coming back)", () => {
    const cache = new UserCache(10);
    const row = cache.put(user({ userId: "a", location: "Oslo" }), NOW)!;
    expect(cache.absorb([row])).toBe(false);
    expect(cache.absorb([{ ...row, seenAt: NOW + 1 }])).toBe(false);
    expect(cache.peek("a")?.seenAt).toBe(NOW + 1);
  });

  it("round-trips dump/load", () => {
    const cache = new UserCache(10);
    cache.put(user({ userId: "a", location: "A" }), NOW);
    const next = new UserCache(10);
    next.load(cache.dump());
    expect(next.get("a")?.location).toBe("A");
  });

  it("loads 10k rows quickly (O(1) LRU)", () => {
    const rows: StoredUser[] = [];
    for (let i = 0; i < 10_000; i += 1) rows.push(stored({ userId: String(i), location: `City ${i}` }));
    const cache = new UserCache(10_000);
    const start = performance.now();
    cache.load(rows);
    for (let i = 0; i < 10_000; i += 1) cache.get(String(i));
    expect(performance.now() - start).toBeLessThan(200);
    expect(cache.size).toBe(10_000);
  });
});

describe("hasLocationSignal", () => {
  it("is true only for location, based-in or connected-via", () => {
    expect(hasLocationSignal(user({ userId: "a" }))).toBe(false);
    expect(hasLocationSignal(user({ userId: "a", lang: "en", screenName: "x" }))).toBe(false);
    expect(hasLocationSignal(user({ userId: "a", location: "" }))).toBe(false);
    expect(hasLocationSignal(user({ userId: "a", location: "Oslo" }))).toBe(true);
    expect(hasLocationSignal(user({ userId: "a", basedIn: "Norway" }))).toBe(true);
    expect(hasLocationSignal(user({ userId: "a", connectedVia: "Norway App Store" }))).toBe(true);
  });
});

describe("mergeUser", () => {
  it("keeps old values for fields the new sighting did not carry", () => {
    expect(
      mergeUser(user({ userId: "a", location: "Oslo", basedIn: "Norway" }), user({ userId: "a", screenName: "ola" })),
    ).toMatchObject({ screenName: "ola", location: "Oslo", basedIn: "Norway" });
  });
});

describe("mergeStoredRows", () => {
  it("merges another tab's stored rows with this tab's fresh rows", () => {
    const merged = mergeStoredRows(
      [stored({ userId: "77", basedIn: "India", seenAt: NOW - 1000 }), stored({ userId: "1", location: "Oslo" })],
      [stored({ userId: "77", location: "Delhi" }), stored({ userId: "2", location: "Rome" })],
      NOW,
    );
    const byId = new Map(merged.map((row) => [row.userId, row]));
    expect(byId.get("77")).toMatchObject({ basedIn: "India", location: "Delhi", seenAt: NOW });
    expect(byId.get("1")?.location).toBe("Oslo");
    expect(byId.get("2")?.location).toBe("Rome");
  });

  it("drops expired rows and rows without a location signal", () => {
    const merged = mergeStoredRows(
      [
        stored({ userId: "old", location: "Oslo", seenAt: NOW - USER_TTL_MS - 1 }),
        stored({ userId: "bare", screenName: "bare", lang: "en" }),
        stored({ userId: "cleared", location: "Lagos" , seenAt: NOW - 10 }),
      ],
      [stored({ userId: "cleared", location: "" })],
      NOW,
    );
    expect(merged.map((row) => row.userId)).toEqual([]);
  });

  it("keeps only the most recently seen rows up to the limit", () => {
    const merged = mergeStoredRows(
      [stored({ userId: "a", location: "A", seenAt: NOW - 3 }), stored({ userId: "b", location: "B", seenAt: NOW - 1 })],
      [stored({ userId: "c", location: "C", seenAt: NOW - 2 })],
      NOW,
      2,
    );
    expect(merged.map((row) => row.userId)).toEqual(["c", "b"]);
  });
});
