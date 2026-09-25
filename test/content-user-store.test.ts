import { describe, expect, it, vi } from "vitest";
import { UserPersister } from "../src/content/user-store.ts";
import { type StoredUser, UserCache, USER_TTL_MS } from "../src/shared/cache.ts";

const NOW = 1_800_000_000_000;

function row(partial: Partial<StoredUser> & Pick<StoredUser, "userId">): StoredUser {
  return {
    screenName: null,
    location: null,
    basedIn: null,
    connectedVia: null,
    lang: null,
    seenAt: NOW,
    ...partial,
  };
}

function setup() {
  const writes: unknown[] = [];
  const area = {
    set: vi.fn(async (items: Record<string, unknown>) => {
      writes.push(items.userCache);
    }),
  };
  const timers: (() => void)[] = [];
  const persister = new UserPersister({
    area,
    now: () => NOW,
    setTimer: (fn) => timers.push(fn),
    clearTimer: () => {
      timers.length = 0;
    },
  });
  const runTimers = () => {
    const due = timers.splice(0);
    for (const fn of due) fn();
  };
  return { area, writes, persister, runTimers, timers };
}

describe("UserPersister (F12, C05)", () => {
  it("batches many rows into one delayed write", () => {
    const { area, persister, runTimers, writes } = setup();
    persister.setAllowed(true);
    for (let i = 1; i <= 40; i += 1) persister.note(row({ userId: String(i), location: "Oslo" }));
    expect(area.set).not.toHaveBeenCalled();
    runTimers();
    expect(area.set).toHaveBeenCalledTimes(1);
    expect(writes[0]).toHaveLength(40);
  });

  it("merges into the copy another tab stored instead of replacing it", () => {
    const { persister, writes } = setup();
    persister.setAllowed(true);
    persister.setStored([row({ userId: "77", basedIn: "India", seenAt: NOW - 1000 })]);
    persister.note(row({ userId: "1", location: "Oslo" }));
    persister.flush();
    expect((writes[0] as StoredUser[]).map((r) => r.userId)).toEqual(["77", "1"]);
  });

  it("stores only rows with a location signal", () => {
    const { persister, area } = setup();
    persister.setAllowed(true);
    persister.note(row({ userId: "1", lang: "en" }));
    persister.flush();
    expect(area.set).not.toHaveBeenCalled();
  });

  it("writes nothing while no filter is on or in a private window", () => {
    const { persister, area, timers } = setup();
    persister.note(row({ userId: "1", location: "Oslo" }));
    persister.flush();
    expect(area.set).not.toHaveBeenCalled();
    persister.setAllowed(true);
    persister.note(row({ userId: "1", location: "Oslo" }));
    persister.setAllowed(false);
    expect(timers).toHaveLength(0);
    persister.flush();
    expect(area.set).not.toHaveBeenCalled();
  });

  it("drops expired stored rows when it writes", () => {
    const { persister, writes } = setup();
    persister.setAllowed(true);
    persister.setStored([row({ userId: "old", location: "Lagos", seenAt: NOW - USER_TTL_MS - 1 })]);
    persister.note(row({ userId: "1", location: "Oslo" }));
    persister.flush();
    expect((writes[0] as StoredUser[]).map((r) => r.userId)).toEqual(["1"]);
  });

  it("survives a storage error", async () => {
    const persister = new UserPersister({
      area: {
        set: () => {
          throw new Error("Extension context invalidated.");
        },
      },
      now: () => NOW,
      setTimer: () => 0,
      clearTimer: () => {},
    });
    persister.setAllowed(true);
    persister.note(row({ userId: "1", location: "Oslo" }));
    expect(() => persister.flush()).not.toThrow();
  });

  it("removes a stored row whose location X now sends blank (F13)", () => {
    const { persister, writes } = setup();
    persister.setAllowed(true);
    persister.setStored([
      row({ userId: "30", location: "Lagos, Nigeria", seenAt: NOW - 1000 }),
      row({ userId: "31", location: "Accra", basedIn: "Ghana", seenAt: NOW - 1000 }),
    ]);
    persister.note(row({ userId: "30", location: "" }));
    persister.note(row({ userId: "31", location: "", basedIn: "Ghana" }));
    persister.flush();
    const stored = writes[0] as StoredUser[];
    expect(stored.map((r) => r.userId)).toEqual(["31"]);
    expect(stored[0]).toMatchObject({ location: "", basedIn: "Ghana", seenAt: NOW });
  });

  it("lets a blank location replace a pending one from the same tab (F13)", () => {
    const { persister, area } = setup();
    persister.setAllowed(true);
    persister.note(row({ userId: "30", location: "Lagos, Nigeria" }));
    persister.note(row({ userId: "30", location: "" }));
    persister.flush();
    expect(area.set).not.toHaveBeenCalled();
  });

  it("queues only rows UserCache reports as changed", () => {
    const { persister, runTimers, area } = setup();
    persister.setAllowed(true);
    const cache = new UserCache(10);
    const user = { userId: "1", screenName: "a", location: "Oslo", basedIn: null, connectedVia: null, lang: null };
    persister.note(cache.put(user, NOW));
    runTimers();
    persister.note(cache.put(user, NOW + 1000));
    runTimers();
    expect(area.set).toHaveBeenCalledTimes(1);
  });
});
