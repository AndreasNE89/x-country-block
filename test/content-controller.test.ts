import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentController } from "../src/content/controller.ts";
import { BADGE_MSG } from "../src/shared/badge.ts";
import {
  ALLOW_ATTR,
  HIDE_ATTR,
  KEY_ATTR,
  MARK_ATTR,
  MARK_LABEL_CLASS,
  SLIM_ATTR,
} from "../src/shared/hide-dom.ts";
import { ONLY_SHOW_TRIAL_MS } from "../src/shared/license.ts";
import { PING_MSG } from "../src/shared/messages.ts";
import { HOOK_SOURCE, HOOK_VERSION, type TweetRecord, type UserRecord } from "../src/shared/types.ts";

const NOW = 1_800_000_000_000;

type Changes = Record<string, { oldValue?: unknown; newValue?: unknown }>;

function memoryArea(initial: Record<string, unknown>) {
  const data: Record<string, unknown> = structuredClone(initial);
  const listeners: ((changes: Changes) => void)[] = [];
  const area = {
    data,
    get: vi.fn(async (keys: string[] | readonly string[]) =>
      Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, structuredClone(data[k])])),
    ),
    set: vi.fn(async (items: Record<string, unknown>) => {
      const changes: Changes = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: data[key], newValue: structuredClone(value) };
        data[key] = structuredClone(value);
      }
      for (const cb of listeners) cb(changes);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const changes: Changes = {};
      for (const key of typeof keys === "string" ? [keys] : keys) {
        if (!(key in data)) continue;
        changes[key] = { oldValue: data[key] };
        delete data[key];
      }
      for (const cb of listeners) cb(changes);
    }),
    onChanged: { addListener: (cb: (changes: Changes) => void) => listeners.push(cb) },
  };
  return area;
}

type Harness = Awaited<ReturnType<typeof setup>>;

async function setup(stored: Record<string, unknown>, init: { incognito?: boolean; path?: string } = {}) {
  window.history.pushState({}, "", init.path ?? "/home");
  const area = memoryArea(stored);
  const frames: (() => void)[] = [];
  const timers: (() => void)[] = [];
  let tick: () => void = () => {};
  let onRuntimeMessage: ((m: unknown, s: unknown, r: (x?: unknown) => void) => unknown) | null = null;
  const runtime = {
    id: "ext" as string | undefined,
    sendMessage: vi.fn(() => Promise.resolve()),
    getManifest: () => ({ version: "0.2.0", name: "Tamis" }),
    onMessage: { addListener: (cb: typeof onRuntimeMessage) => (onRuntimeMessage = cb) },
  };
  let now = NOW;
  const controller = new ContentController({
    win: window,
    doc: document,
    area: area as unknown as typeof chrome.storage.local,
    runtime: runtime as unknown as typeof chrome.runtime,
    incognito: init.incognito ?? false,
    now: () => now,
    raf: (cb) => frames.push(cb),
    setTimer: (fn) => timers.push(fn),
    clearTimer: () => {
      timers.length = 0;
    },
    setRepeat: (fn) => {
      tick = fn;
      return 1;
    },
    clearRepeat: () => {},
  });
  await controller.start();
  const frame = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0)); // happy-dom delivers mutations in a task
    for (let i = 0; i < 5 && frames.length; i += 1) for (const cb of frames.splice(0)) cb();
  };
  await frame();
  const post = (users: UserRecord[], tweets: TweetRecord[], init2: { origin?: string; source?: Window | null } = {}) => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { source: HOOK_SOURCE, type: "graphql", v: HOOK_VERSION, users, tweets },
        origin: init2.origin ?? window.location.origin,
        source: init2.source === undefined ? window : init2.source,
      }),
    );
  };
  const ping = () => {
    let response: unknown;
    onRuntimeMessage?.({ type: PING_MSG }, {}, (r) => (response = r));
    return response;
  };
  const badges = () =>
    runtime.sendMessage.mock.calls
      .map((call) => (call as unknown[])[0] as { type: string; count: number })
      .filter((m) => m.type === BADGE_MSG)
      .map((m) => m.count);
  return {
    controller,
    area,
    runtime,
    frame,
    post,
    ping,
    badges,
    runTimers: () => {
      for (const fn of timers.splice(0)) fn();
    },
    tick: () => tick(),
    setNow: (value: number) => {
      now = value;
    },
  };
}

function user(partial: Partial<UserRecord> & Pick<UserRecord, "userId">): UserRecord {
  return { screenName: null, location: null, basedIn: null, connectedVia: null, lang: null, ...partial };
}

function tweet(partial: Partial<TweetRecord> & Pick<TweetRecord, "tweetId">): TweetRecord {
  return { lang: null, authorId: null, place: null, quoted: null, retweeted: null, ...partial };
}

/** A row as this version stores it (rows from before 0.2.0 carry no seenAt and are dropped). */
function saved<T extends UserRecord>(row: T, seenAt = NOW): T & { seenAt: number } {
  return { ...row, seenAt };
}

const carol = saved(user({ userId: "10", screenName: "carol", location: "Mumbai, India" }));
const olav = saved(user({ userId: "11", screenName: "olav", location: "Oslo, Norway" }));

function article(id: string, handle: string, top = 100): string {
  return `<div data-testid="cellInnerDiv" data-top="${top}"><article data-testid="tweet" id="a${id}"><a href="/${handle}/status/${id}">x</a></article></div>`;
}

function layout(): void {
  for (const cell of document.querySelectorAll<HTMLElement>("[data-top]")) {
    const top = Number(cell.dataset.top);
    const rect = () => ({ top, bottom: top + 200, height: 200, left: 0, right: 600, width: 600, x: 0, y: top, toJSON() {} }) as DOMRect;
    cell.getBoundingClientRect = rect;
    (cell.firstElementChild as HTMLElement).getBoundingClientRect = rect;
  }
}

function page(html: string): void {
  document.body.innerHTML = `<nav><a data-testid="AppTabBar_Profile_Link" href="/me">Profile</a></nav>${html}`;
  layout();
}

const el = (id: string) => document.getElementById(id) as HTMLElement;

let current: Harness | null = null;
afterEach(() => {
  current?.controller.stop();
  current = null;
  document.body.innerHTML = "";
});

async function start(stored: Record<string, unknown>, init?: { incognito?: boolean; path?: string }) {
  current = await setup(stored, init);
  return current;
}

describe("hiding", () => {
  it("hides matches in every position, including below the fold and the last card (F03, F15, C07)", async () => {
    page(article("1", "carol", 100) + article("2", "olav", 620) + article("3", "carol", 2000));
    const h = await start({ hiddenCountryCodes: ["IN"], userCache: [carol, olav] });
    h.post([], [tweet({ tweetId: "1", authorId: "10" }), tweet({ tweetId: "3", authorId: "10" })]);
    await h.frame();
    expect(el("a1").getAttribute(HIDE_ATTR)).toContain("India");
    expect(el("a3").getAttribute(HIDE_ATTR)).toContain("India");
    expect(el("a2").hasAttribute(HIDE_ATTR)).toBe(false);
  });

  it("hides a card as soon as X adds it", async () => {
    page("");
    const h = await start({ hiddenCountryCodes: ["IN"], userCache: [carol] });
    document.body.insertAdjacentHTML("beforeend", article("5", "carol", 3000));
    await h.frame();
    expect(el("a5").getAttribute(HIDE_ATTR)).toContain("India");
  });

  it("re-checks a node X reuses for another post (F54)", async () => {
    page(article("1", "carol"));
    const h = await start({ hiddenCountryCodes: ["IN"], userCache: [carol, olav] });
    await h.frame();
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(true);
    el("a1").querySelector("a")!.setAttribute("href", "/olav/status/9");
    await h.frame();
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(false);
    expect(el("a1").hasAttribute(KEY_ATTR)).toBe(false);
  });

  it("collapses set-aside posts to slim rows in Only show", async () => {
    page(article("1", "carol") + article("2", "olav"));
    const h = await start({
      hiddenCountryCodes: ["NO"],
      filterMode: "only",
      onlyShowPaid: true,
      userCache: [carol, olav],
    });
    await h.frame();
    expect(el("a1").hasAttribute(SLIM_ATTR)).toBe(true);
    expect(el("a2").hasAttribute(HIDE_ATTR)).toBe(false);
  });

  it("never hides the signed-in account's own posts (F17)", async () => {
    page(article("1", "me"));
    const h = await start({ hiddenCountryCodes: ["NO"], filterMode: "only", onlyShowPaid: true });
    await h.frame();
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(false);
  });

  it("outlines the post a /status/ page was opened for instead of hiding it (F17)", async () => {
    page(article("100", "carol") + article("101", "carol"));
    const h = await start({ hiddenCountryCodes: ["IN"], userCache: [carol] }, { path: "/carol/status/100" });
    await h.frame();
    expect(el("a100").getAttribute(MARK_ATTR)).toContain("India");
    expect(el("a100").querySelector(`.${MARK_LABEL_CLASS}`)).not.toBeNull();
    expect(el("a101").getAttribute(HIDE_ATTR)).toContain("India");
  });

  it("ignores records posted from another origin (F11)", async () => {
    page(article("1", "olav"));
    const h = await start({ hiddenCountryCodes: ["RU"] });
    h.post([user({ userId: "11", screenName: "olav", basedIn: "Russia" })], [tweet({ tweetId: "1", authorId: "11" })], {
      origin: "https://evil.example",
      source: null,
    });
    await h.frame();
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(false);
    expect(h.controller.userCache.peek("11")).toBeUndefined();
  });
});

describe("settings", () => {
  it("clears every hide when paused and restores them when resumed", async () => {
    page(article("1", "carol"));
    const h = await start({ hiddenCountryCodes: ["IN"], userCache: [carol] });
    await h.frame();
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(true);
    await h.area.set({ enabled: false });
    await h.frame();
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(false);
    expect(h.badges().at(-1)).toBe(0);
    expect(h.ping()).toEqual({ ok: true, count: 0, version: "0.2.0" });
    await h.area.set({ enabled: true });
    await h.frame();
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(true);
  });

  it("does not reload the account cache on a settings change (C06)", async () => {
    page(article("1", "carol"));
    const h = await start({ hiddenCountryCodes: ["IN"], userCache: [carol] });
    await h.area.set({ hiddenLanguageCodes: ["pt"] });
    await h.area.set({ markOnly: true });
    expect(h.area.get).toHaveBeenCalledTimes(1);
  });

  it("stops Only show in an open tab when the trial ends (F56)", async () => {
    page(article("1", "carol"));
    const h = await start({
      hiddenCountryCodes: ["NO"],
      filterMode: "only",
      trialStartedAt: NOW - ONLY_SHOW_TRIAL_MS + 30_000,
      userCache: [carol],
    });
    await h.frame();
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(true);
    h.setNow(NOW + 60_000);
    h.tick();
    await h.frame();
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(false);
  });

  it("offers Always show in Highlight mode and applies it (F10, F32)", async () => {
    page(article("1", "carol"));
    const h = await start({ hiddenCountryCodes: ["IN"], markOnly: true, userCache: [carol] });
    await h.frame();
    const button = el("a1").querySelector<HTMLElement>(`[${ALLOW_ATTR}]`)!;
    expect(button.textContent).toBe("Always show @carol");
    button.click();
    await vi.waitFor(() => expect(h.area.data.allowedHandles).toEqual(["carol"]));
    await h.frame();
    expect(el("a1").hasAttribute(MARK_ATTR)).toBe(false);
  });
});

describe("badge and ping (F55)", () => {
  it("counts distinct posts on the page and sends only changes", async () => {
    page(article("1", "carol") + article("2", "carol"));
    const h = await start({ hiddenCountryCodes: ["IN"], userCache: [carol] });
    await h.frame();
    expect(h.badges().at(-1)).toBe(2);
    const sent = h.badges().length;
    document.body.insertAdjacentHTML("beforeend", "<div>unrelated</div>");
    await h.frame();
    expect(h.badges()).toHaveLength(sent);
    // X unmounts a hidden cell: the count stays.
    el("a1").parentElement!.remove();
    await h.frame();
    expect(h.ping()).toEqual({ ok: true, count: 2, version: "0.2.0" });
    window.history.pushState({}, "", "/explore");
    document.body.insertAdjacentHTML("beforeend", "<div>new page</div>");
    await h.frame();
    expect(h.badges().at(-1)).toBe(1);
  });

  it("keeps the count while X shows an About sheet over the timeline (R2)", async () => {
    page(article("1", "carol") + article("2", "carol") + article("3", "carol") + article("4", "carol"));
    const h = await start({ hiddenCountryCodes: ["IN"], userCache: [carol] });
    await h.frame();
    expect(h.ping()).toMatchObject({ count: 4 });
    // X unmounts two cells the user scrolled past, then opens the sheet over the timeline.
    el("a1").parentElement!.remove();
    el("a2").parentElement!.remove();
    window.history.pushState({}, "", "/someone/about");
    document.body.insertAdjacentHTML("beforeend", `<div role="dialog"><span>About this account</span></div>`);
    await h.frame();
    expect(h.ping()).toMatchObject({ count: 4 });
    window.history.pushState({}, "", "/home");
    document.querySelector('[role="dialog"]')!.remove();
    await h.frame();
    expect(h.ping()).toMatchObject({ count: 4 });
    expect(h.badges()).not.toContain(2);
  });
});

describe("account cache", () => {
  it("writes batched rows only while a filter is on", async () => {
    page("");
    const h = await start({});
    h.post([carol], []);
    h.runTimers();
    window.dispatchEvent(new Event("pagehide"));
    expect(h.area.set).not.toHaveBeenCalled();
    await h.area.set({ hiddenCountryCodes: ["IN"] });
    h.area.set.mockClear();
    h.post([olav], []);
    h.post([user({ userId: "12", screenName: "x", location: "Lima, Peru" })], []);
    expect(h.area.set).not.toHaveBeenCalled();
    h.runTimers();
    expect(h.area.set).toHaveBeenCalledTimes(1);
    expect((h.area.data.userCache as UserRecord[]).map((u) => u.userId)).toEqual(["11", "12"]);
  });

  it("never writes in a private window (C05)", async () => {
    page("");
    const h = await start({ hiddenCountryCodes: ["IN"] }, { incognito: true });
    h.post([carol], []);
    h.runTimers();
    window.dispatchEvent(new Event("pagehide"));
    expect(h.area.set).not.toHaveBeenCalled();
  });

  it("flushes on pagehide", async () => {
    page("");
    const h = await start({ hiddenCountryCodes: ["IN"] });
    h.post([carol], []);
    window.dispatchEvent(new Event("pagehide"));
    expect(h.area.set).toHaveBeenCalledTimes(1);
  });

  it("removes a stored location the account has cleared, for later tabs too (F13)", async () => {
    const lagos = { ...user({ userId: "30", screenName: "ngacct", location: "Lagos, Nigeria" }), seenAt: NOW - 1000 };
    page(article("1", "ngacct"));
    const a = await start({ hiddenCountryCodes: ["NG"], userCache: [lagos] });
    await a.frame();
    expect(el("a1").getAttribute(HIDE_ATTR)).toContain("Nigeria");
    a.post([user({ userId: "30", screenName: "ngacct", location: "" })], [tweet({ tweetId: "1", authorId: "30" })]);
    await a.frame();
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(false);
    a.runTimers();
    window.dispatchEvent(new Event("pagehide"));
    expect(a.area.set).toHaveBeenCalled();
    expect((a.area.data.userCache as UserRecord[]).map((u) => u.userId)).not.toContain("30");

    // A new tab loads what tab A stored.
    a.controller.stop();
    page(article("1", "ngacct"));
    const b = await start(structuredClone(a.area.data));
    await b.frame();
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(false);
  });

  it("does not write rows that never had a location", async () => {
    page("");
    const h = await start({ hiddenCountryCodes: ["IN"] });
    h.post([user({ userId: "31", screenName: "quiet", location: "" })], []);
    h.runTimers();
    window.dispatchEvent(new Event("pagehide"));
    expect(h.area.set).not.toHaveBeenCalled();
  });
});

describe("About sheet (C01)", () => {
  it("uses X's About sheet for that account only, and never over hook data", async () => {
    const alice = saved(user({ userId: "20", screenName: "alice", location: "Austin, TX" }));
    page(
      article("1", "alice") +
        `<div role="dialog"><span>@alice</span><div><span>Account based in</span></div><div><span>Nigeria</span></div></div>`,
    );
    const h = await start({ hiddenCountryCodes: ["NG"], userCache: [alice] }, { path: "/alice/about" });
    await h.frame();
    expect(el("a1").getAttribute(HIDE_ATTR)).toContain("Nigeria");
    expect(h.controller.userCache.peek("20")?.basedIn).toBe("Nigeria");
    h.post([user({ userId: "20", screenName: "alice", basedIn: "United States" })], []);
    await h.frame();
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(false);
  });

  it("does not read reply text in the photo viewer as About data", async () => {
    const alice = saved(user({ userId: "20", screenName: "alice", location: "Austin, TX" }));
    page(
      article("1", "alice") +
        `<div role="dialog"><span>@alice</span><span>Account based in</span><span>Nigeria lol</span></div>`,
    );
    const h = await start({ hiddenCountryCodes: ["NG"], userCache: [alice] }, { path: "/alice/status/1/photo/1" });
    await h.frame();
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(false);
    expect(h.controller.userCache.peek("20")?.basedIn).toBeNull();
  });
});

describe("extension reloaded under the tab (F57)", () => {
  it("restores the page and stops listening", async () => {
    page(article("1", "carol"));
    const h = await start({ hiddenCountryCodes: ["IN"], userCache: [carol] });
    await h.frame();
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(true);
    h.runtime.id = undefined;
    h.post([carol], [tweet({ tweetId: "1", authorId: "10" })]);
    expect(h.controller.isStopped).toBe(true);
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(false);
    document.body.insertAdjacentHTML("beforeend", article("2", "carol"));
    await h.frame();
    expect(el("a2").hasAttribute(HIDE_ATTR)).toBe(false);
  });
});

describe("account rows and notifications", () => {
  it("hides account rows and like notifications by the acting account", async () => {
    page(
      `<div data-testid="UserCell" id="cell"><a href="/carol">carol</a></div>` +
        `<div data-testid="cellInnerDiv"><article data-testid="notification" id="like"><a href="/carol">carol</a> liked your post <a href="/me/status/5">p</a></article></div>`,
    );
    const h = await start({ hiddenCountryCodes: ["IN"], userCache: [carol] }, { path: "/notifications" });
    h.post([user({ userId: "13", screenName: "me", location: "Oslo, Norway" })], [tweet({ tweetId: "5", authorId: "13" })]);
    await h.frame();
    expect(el("cell").getAttribute(HIDE_ATTR)).toContain("India");
    expect(el("like").getAttribute(HIDE_ATTR)).toContain("India");
    // The account row is not a post, so the badge counts only the notification.
    expect(h.badges().at(-1)).toBe(1);
  });
});

describe("stored accounts from earlier versions (R12, R13, R34, R41)", () => {
  const DAY = 24 * 60 * 60 * 1000;
  // Rows written by 0.1.x carry no seenAt; its About reader could take reply text for "based in".
  const legacy = user({ userId: "20", screenName: "alice", location: "Austin, TX", basedIn: "Nigeria lolcarol@carol1hnice" });
  const legacyQuiet = user({ userId: "21", screenName: "quiet" });
  const noSignal = saved(user({ userId: "22", screenName: "lang_only", lang: "en" }));
  const expired = saved(user({ userId: "23", screenName: "gone", location: "Lagos" }), NOW - 40 * DAY);
  const storedIds = (h: Harness) => (h.area.data.userCache as UserRecord[] | undefined)?.map((u) => u.userId);

  it.each([
    ["nothing is ticked", {}],
    ["filtering is paused", { hiddenCountryCodes: ["NG"], enabled: false }],
    ["Focus mode is locked", { hiddenCountryCodes: ["NG"], filterMode: "only" }],
  ])("prunes the stored copy once at startup when %s", async (_what, settings) => {
    page("");
    const h = await start({ ...settings, userCache: [legacy, legacyQuiet, noSignal, expired, olav] });
    expect(h.area.set).toHaveBeenCalledTimes(1);
    expect(storedIds(h)).toEqual(["11"]);
    expect(h.controller.userCache.peek("20")).toBeUndefined();
  });

  it("removes the key when nothing is left, and writes nothing when nothing is dropped", async () => {
    page("");
    const h = await start({ userCache: [legacy, expired] });
    expect(h.area.remove).toHaveBeenCalledWith("userCache");
    expect("userCache" in h.area.data).toBe(false);
    h.controller.stop();
    const clean = await start({ userCache: [carol, olav] });
    expect(clean.area.set).not.toHaveBeenCalled();
    expect(clean.area.remove).not.toHaveBeenCalled();
  });

  it("writes nothing from a private window, and still ignores the old rows there", async () => {
    page("");
    const h = await start({ userCache: [legacy, olav] }, { incognito: true });
    expect(h.area.set).not.toHaveBeenCalled();
    expect(h.area.remove).not.toHaveBeenCalled();
    expect(h.controller.userCache.peek("20")).toBeUndefined();
  });

  it("keeps the 5,000 most recently seen rows", async () => {
    page("");
    const rows = Array.from({ length: 5_003 }, (_, i) =>
      saved(user({ userId: String(1000 + i), location: "Oslo" }), NOW - 5_003 + i),
    );
    const h = await start({ userCache: rows });
    const kept = storedIds(h)!;
    expect(kept).toHaveLength(5_000);
    expect(kept).not.toContain("1000");
    expect(kept).toContain("6002");
  });

  it("does not filter by a 'based in' stored by 0.1.x", async () => {
    page(article("1", "alice"));
    const h = await start({ hiddenCountryCodes: ["NG"], userCache: [legacy] });
    h.post([user({ userId: "20", screenName: "alice", location: "Austin, TX" })], [tweet({ tweetId: "1", authorId: "20" })]);
    await h.frame();
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(false);
    h.runTimers();
    window.dispatchEvent(new Event("pagehide"));
    expect(JSON.stringify(h.area.data.userCache)).not.toContain("Nigeria");
  });

  it("writes a fresh sighting over an old row and keeps new accounts, however large the old cache", async () => {
    page("");
    const many = Array.from({ length: 6_001 }, (_, i) => user({ userId: String(1000 + i), location: "Paris, France" }));
    const moved = user({ userId: "50", screenName: "moved", location: "Paris, France", lang: "fr" });
    const h = await start({ hiddenCountryCodes: ["IN"], userCache: [...many, moved] });
    h.post(
      [
        user({ userId: "50", screenName: "moved", location: "Berlin", basedIn: "Germany", lang: "de" }),
        user({ userId: "51", screenName: "newbie", location: "Lima, Peru" }),
      ],
      [],
    );
    h.setNow(NOW + 5_000); // the batched write runs a few seconds later
    h.runTimers();
    const rows = h.area.data.userCache as UserRecord[];
    expect(rows.find((u) => u.userId === "50")).toMatchObject({ location: "Berlin", lang: "de" });
    expect(rows.map((u) => u.userId)).toContain("51");
  });
});

describe("accounts another tab saved (R11)", () => {
  it("filters by what another tab saved, without a reload or a write back", async () => {
    page(article("1", "u5"));
    const h = await start({ hiddenCountryCodes: ["IN"] });
    h.post([user({ userId: "50", screenName: "u5" })], [tweet({ tweetId: "1", authorId: "50" })]);
    await h.frame();
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(false);
    // A second later tab A opened @u5's About page and saved what X said there.
    h.setNow(NOW + 2000);
    await h.area.set({ userCache: [saved(user({ userId: "50", screenName: "u5", basedIn: "India" }), NOW + 1000)] });
    await h.frame();
    expect(el("a1").getAttribute(HIDE_ATTR)).toContain("India");
    h.runTimers();
    window.dispatchEvent(new Event("pagehide"));
    expect(h.area.set).toHaveBeenCalledTimes(1);
  });

  it("ignores an older copy another tab wrote", async () => {
    page(article("1", "carol"));
    const h = await start({ hiddenCountryCodes: ["IN"], userCache: [carol] });
    await h.frame();
    await h.area.set({ userCache: [saved({ ...carol, location: "Oslo, Norway" }, NOW - 5_000)] });
    await h.frame();
    expect(el("a1").getAttribute(HIDE_ATTR)).toContain("India");
  });
});

/** Timeline cells laid out as a column from `start`: 200px posts, 24px slim rows, 0px hidden ones. */
function column(start: number): void {
  const cells = [...document.querySelectorAll<HTMLElement>('[data-testid="cellInnerDiv"]')];
  const height = (cell: HTMLElement) => {
    const post = cell.firstElementChild as HTMLElement;
    if (post.hasAttribute(SLIM_ATTR)) return 24;
    return post.hasAttribute(HIDE_ATTR) ? 0 : 200;
  };
  cells.forEach((cell, i) => {
    const rect = () => {
      const top = cells.slice(0, i).reduce((sum, prev) => sum + height(prev), start);
      const h = height(cell);
      return { top, bottom: top + h, height: h, left: 0, right: 600, width: 600, x: 0, y: top, toJSON() {} } as DOMRect;
    };
    cell.getBoundingClientRect = rect;
    (cell.firstElementChild as HTMLElement).getBoundingClientRect = rect;
  });
}

describe("reading position when filtering stops (R10)", () => {
  /** Olav's post is cut off at the top of the view; carol's hidden post sits right above the one being read. */
  async function reading(stored: Record<string, unknown>) {
    page(article("0", "olav") + article("1", "carol") + article("2", "olav"));
    column(-100);
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    const h = await start({ hiddenCountryCodes: ["IN"], userCache: [carol, olav], ...stored });
    await h.frame();
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(true);
    expect(el("a2").getBoundingClientRect().top).toBe(100);
    scrollBy.mockClear();
    return { h, scrollBy };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["pausing", { enabled: false }],
    ["unticking the last pick", { hiddenCountryCodes: [] }],
  ])("holds the post being read when %s shows the posts above it again", async (_what, change) => {
    const { h, scrollBy } = await reading({});
    await h.area.set(change);
    await h.frame();
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(false);
    // Carol's post comes back above: the view moves down with it, so olav's stays at 100px.
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy).toHaveBeenCalledWith(0, 200);
  });

  it("holds it when the extension is unloaded under the tab", async () => {
    const { h, scrollBy } = await reading({});
    h.runtime.id = undefined;
    h.post([], []);
    expect(h.controller.isStopped).toBe(true);
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(false);
    expect(scrollBy).toHaveBeenCalledWith(0, 200);
  });

  it("holds the top slim row in view when the Focus trial ends and every post in view comes back", async () => {
    page(article("0", "carol") + article("1", "carol") + article("2", "carol"));
    column(-24);
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    const h = await start({
      hiddenCountryCodes: ["NO"],
      filterMode: "only",
      trialStartedAt: NOW - ONLY_SHOW_TRIAL_MS + 30_000,
      userCache: [carol],
    });
    await h.frame();
    expect(el("a1").hasAttribute(SLIM_ATTR)).toBe(true);
    expect(el("a1").getBoundingClientRect().top).toBe(0);
    scrollBy.mockClear();
    h.setNow(NOW + 60_000);
    h.tick();
    await h.frame();
    expect(el("a1").hasAttribute(HIDE_ATTR)).toBe(false);
    // The row cut off above grows by 176px; the one at the top of the view stays there.
    expect(scrollBy).toHaveBeenCalledWith(0, 176);
  });
});

