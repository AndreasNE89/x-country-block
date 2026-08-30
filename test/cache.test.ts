import { describe, expect, it } from "vitest";
import { UserCache } from "../src/shared/cache.ts";

describe("UserCache", () => {
  it("evicts oldest when over limit", () => {
    const cache = new UserCache(2);
    cache.put({ userId: "a", location: "A", basedIn: null, lang: null });
    cache.put({ userId: "b", location: "B", basedIn: null, lang: null });
    cache.put({ userId: "c", location: "C", basedIn: null, lang: null });
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("c")?.location).toBe("C");
  });

  it("merges fields on put and refreshes LRU", () => {
    const cache = new UserCache(2);
    cache.put({ userId: "a", location: "A", basedIn: null, lang: null });
    cache.put({ userId: "b", location: "B", basedIn: null, lang: null });
    cache.put({ userId: "a", location: null, basedIn: "India", lang: "hi" });
    cache.put({ userId: "c", location: "C", basedIn: null, lang: null });
    expect(cache.get("a")?.basedIn).toBe("India");
    expect(cache.get("a")?.location).toBe("A");
    expect(cache.get("b")).toBeUndefined();
  });

  it("round-trips dump/load", () => {
    const cache = new UserCache(10);
    cache.put({ userId: "a", location: "A", basedIn: null, lang: null });
    const next = new UserCache(10);
    next.load(cache.dump());
    expect(next.get("a")?.location).toBe("A");
  });
});
