import { describe, expect, it } from "vitest";
import { UserCache } from "../src/shared/cache.ts";
import type { UserRecord } from "../src/shared/types.ts";

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

describe("UserCache", () => {
  it("evicts oldest when over limit", () => {
    const cache = new UserCache(2);
    cache.put(user({ userId: "a", location: "A" }));
    cache.put(user({ userId: "b", location: "B" }));
    cache.put(user({ userId: "c", location: "C" }));
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("c")?.location).toBe("C");
  });

  it("merges fields on put and refreshes LRU", () => {
    const cache = new UserCache(2);
    cache.put(user({ userId: "a", location: "A" }));
    cache.put(user({ userId: "b", location: "B" }));
    cache.put(
      user({
        userId: "a",
        basedIn: "India",
        connectedVia: "India Android App",
        lang: "hi",
      }),
    );
    cache.put(user({ userId: "c", location: "C" }));
    expect(cache.get("a")?.basedIn).toBe("India");
    expect(cache.get("a")?.connectedVia).toBe("India Android App");
    expect(cache.get("a")?.location).toBe("A");
    expect(cache.get("b")).toBeUndefined();
  });

  it("should refresh LRU when reading an entry", () => {
    const cache = new UserCache(2);
    cache.put(user({ userId: "a", location: "A" }));
    cache.put(user({ userId: "b", location: "B" }));

    expect(cache.get("a")?.location).toBe("A");
    cache.put(user({ userId: "c", location: "C" }));

    expect(cache.get("a")?.location).toBe("A");
    expect(cache.get("b")).toBeUndefined();
  });

  it("round-trips dump/load", () => {
    const cache = new UserCache(10);
    cache.put(user({ userId: "a", location: "A" }));
    const next = new UserCache(10);
    next.load(cache.dump());
    expect(next.get("a")?.location).toBe("A");
  });
});
