import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startPopup, type PopupHandle } from "../src/popup/app.ts";
import { PAID_PAGE_MATCH, STRIPE_PAYMENT_LINK } from "../src/shared/stripe.ts";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;
const HTML = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/popup/popup.html"), "utf8");
const BODY = (/<body[^>]*>([\s\S]*)<\/body>/.exec(HTML)?.[1] ?? "").replace(/<script[\s\S]*?<\/script>/g, "");

type Raw = Record<string, unknown>;
type Changes = Record<string, { oldValue?: unknown; newValue?: unknown }>;

type Options = {
  holdGet?: boolean;
  tab?: { id?: number; url?: string } | null;
  ping?: unknown;
  access?: boolean;
  prod?: boolean;
  /** Take the held get's answer when it is asked, not when it is released. */
  snapshotGet?: boolean;
  /** A browser without the permissions API. */
  noPermissions?: boolean;
  /** Whether Tamis may run on its thank-you page (defaults to yes). */
  paidPage?: boolean;
};

function makeStore(initial: Raw, holdGet: boolean, snapshotGet = false) {
  const data: Raw = structuredClone(initial);
  const listeners: ((changes: Changes) => void)[] = [];
  let release = () => undefined as void;
  const gate = holdGet ? new Promise<void>((resolve) => (release = resolve)) : Promise.resolve();
  const emit = (changes: Changes) => {
    for (const listener of listeners) listener(changes);
  };
  const local = {
    get: vi.fn(async (keys: readonly string[]) => {
      const read = () => {
        const out: Raw = {};
        for (const key of keys) if (key in data) out[key] = structuredClone(data[key]);
        return out;
      };
      const early = snapshotGet ? read() : null;
      await gate;
      return early ?? read();
    }),
    set: vi.fn(async (items: Raw) => {
      const changes: Changes = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: data[key], newValue: value };
        data[key] = structuredClone(value);
      }
      setTimeout(() => emit(changes), 0);
    }),
    remove: vi.fn(async () => undefined),
    onChanged: { addListener: (cb: (changes: Changes) => void) => listeners.push(cb) },
  };
  return { local, data, emit, release: () => release() };
}

function makeApi(store: ReturnType<typeof makeStore>, options: Options) {
  const tab = options.tab === undefined ? { id: 7, url: "https://x.com/home" } : options.tab;
  return {
    storage: { local: store.local },
    tabs: {
      query: vi.fn(async () => (tab ? [tab] : [])),
      sendMessage: vi.fn(async () => {
        if (options.ping === undefined) throw new Error("Receiving end does not exist.");
        return options.ping;
      }),
      reload: vi.fn(async () => undefined),
      create: vi.fn(async () => ({})),
      remove: vi.fn(async () => undefined),
    },
    permissions: options.noPermissions
      ? undefined
      : {
          contains: vi.fn(async ({ origins = [] }: { origins?: string[] }) =>
            origins.includes(PAID_PAGE_MATCH) ? (options.paidPage ?? true) : (options.access ?? true),
          ),
          request: vi.fn(async () => true),
        },
    action: {},
    runtime: {},
  };
}

const flush = async (times = 4) => {
  for (let i = 0; i < times; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

let handle: PopupHandle | null = null;

async function open(initial: Raw = {}, options: Options = {}) {
  document.body.innerHTML = BODY;
  const store = makeStore(initial, options.holdGet ?? false, options.snapshotGet ?? false);
  const api = makeApi(store, { ping: { ok: true, count: 0, version: "0.2.0" }, ...options });
  handle = startPopup({
    api: api as unknown as typeof chrome,
    doc: document,
    now: () => NOW,
    prod: options.prod ?? false,
    pollMs: 0,
  });
  if (!options.holdGet) {
    await handle.ready;
    await flush();
  }
  return { api, store };
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const rows = () => [...document.querySelectorAll<HTMLLIElement>("#list li")];
const box = (id: string) => document.querySelector<HTMLInputElement>(`#list input[value="${id}"]`) as HTMLInputElement;
const visible = (id: string) => {
  let node: HTMLElement | null = $(id);
  while (node) {
    if (node.hidden) return false;
    node = node.parentElement;
  }
  return true;
};

afterEach(() => {
  handle?.dispose();
  handle = null;
});

describe("popup load", () => {
  it("should open on Languages with ticked rows pinned and codes on the right", async () => {
    await open({ hiddenLanguageCodes: ["pt"] });
    expect($("tab-languages").getAttribute("aria-selected")).toBe("true");
    expect($("tab-languages").textContent).toBe("Languages · 1");
    const first = rows()[0];
    expect(first.querySelector(".name")?.textContent).toBe("Portuguese");
    expect(first.querySelector(".code")?.textContent).toBe("pt");
    expect(first.classList.contains("is-on")).toBe(true);
    expect($<HTMLInputElement>("search").placeholder).toBe("Search languages");
    expect($("status").textContent).toBe("Hiding Portuguese");
  });

  it("should write nothing before the initial load finished", async () => {
    const { api, store } = await open({ hiddenLanguageCodes: ["pt"], markOnly: true }, { holdGet: true });
    $("mark-only").click();
    $("enabled").click();
    $("mode-only").click();
    await flush();
    expect(api.storage.local.set).not.toHaveBeenCalled();
    store.release();
    await handle?.ready;
    await flush();
    expect(api.storage.local.set).not.toHaveBeenCalled();
    expect($("mark-only").getAttribute("aria-checked")).toBe("true");
    expect(box("pt").checked).toBe(true);
  });
});

describe("list toggles", () => {
  it("should keep focus and row order after a toggle", async () => {
    const { api } = await open({ hiddenLanguageCodes: ["pt"] });
    const ja = box("ja");
    const before = rows().indexOf(ja.closest("li") as HTMLLIElement);
    ja.focus();
    ja.click();
    await flush();
    expect(document.activeElement).toBe(ja);
    expect(ja.isConnected).toBe(true);
    expect(rows().indexOf(ja.closest("li") as HTMLLIElement)).toBe(before);
    expect(ja.closest("li")?.classList.contains("is-on")).toBe(true);
    expect(api.storage.local.set).toHaveBeenCalledTimes(1);
    expect(api.storage.local.set).toHaveBeenCalledWith({ hiddenLanguageCodes: ["pt", "ja"] });
  });

  it("should re-sort only when the tab changes", async () => {
    await open({ hiddenLanguageCodes: ["pt"] });
    box("ja").click();
    await flush();
    $("tab-countries").click();
    $("tab-languages").click();
    const names = rows()
      .slice(0, 2)
      .map((row) => row.querySelector(".name")?.textContent);
    expect(names).toEqual(["Japanese", "Portuguese"]);
  });

  it("should keep ticks made in another popup", async () => {
    const { store } = await open({ hiddenLanguageCodes: ["pt"] });
    store.data.hiddenLanguageCodes = ["pt", "de"];
    box("ja").click();
    await flush();
    expect(store.data.hiddenLanguageCodes).toEqual(["pt", "de", "ja"]);
  });

  it("should follow changes from another popup without moving rows", async () => {
    const { store } = await open({ hiddenLanguageCodes: ["pt"] });
    const order = rows().map((row) => row.querySelector("input")?.value);
    store.data.hiddenLanguageCodes = ["pt", "de"];
    store.emit({ hiddenLanguageCodes: { newValue: ["pt", "de"] } });
    await flush();
    expect(box("de").checked).toBe(true);
    expect(box("de").closest("li")?.classList.contains("is-on")).toBe(true);
    expect(rows().map((row) => row.querySelector("input")?.value)).toEqual(order);
    expect($("status").textContent).toBe("Hiding Portuguese, German");
  });
});

describe("storage sync", () => {
  it("should keep both ticks after two quick clicks", async () => {
    const { store } = await open({ hiddenLanguageCodes: ["pt"] });
    box("ja").click();
    box("de").click();
    await flush();
    expect(store.data.hiddenLanguageCodes).toEqual(["pt", "ja", "de"]);
    expect(box("ja").checked).toBe(true);
    expect(box("de").checked).toBe(true);
  });

  it("should not flicker a fresh tick back while its write is queued", async () => {
    const { api, store } = await open({ hiddenLanguageCodes: ["pt"] });
    const seen: boolean[] = [];
    const get = api.storage.local.get.getMockImplementation();
    api.storage.local.get.mockImplementation(async (keys: readonly string[]) => {
      seen.push(box("ja").checked);
      return (get as (keys: readonly string[]) => Promise<Raw>)(keys);
    });
    store.data.hiddenLanguageCodes = ["pt", "de"];
    store.emit({ hiddenLanguageCodes: { newValue: ["pt", "de"] } });
    box("ja").click();
    await flush();
    expect(seen.every(Boolean)).toBe(true);
    expect(store.data.hiddenLanguageCodes).toEqual(["pt", "de", "ja"]);
    expect(box("ja").checked).toBe(true);
    expect(box("de").checked).toBe(true);
  });

  it("should never repaint an older state while a later change is still queued", async () => {
    const { api, store } = await open({ hiddenLanguageCodes: ["pt"] });
    const seen: string[] = [];
    const snapshot = () =>
      [
        box("ja").checked,
        box("de").checked,
        document.querySelectorAll("#chips li").length,
        $("status").textContent,
      ].join(" / ");
    const set = api.storage.local.set.getMockImplementation() as (items: Raw) => Promise<void>;
    api.storage.local.set.mockImplementation(async (items: Raw) => {
      seen.push(snapshot());
      return set(items);
    });

    box("ja").click();
    box("de").click();
    const ticked = snapshot();
    await flush();
    expect(ticked).toBe("true / true / 3 / Hiding Portuguese, Japanese, German");
    expect(seen).toEqual([ticked, ticked]);
    expect(store.data.hiddenLanguageCodes).toEqual(["pt", "ja", "de"]);

    seen.length = 0;
    box("ko").click();
    $("clear-all").click();
    const cleared = snapshot();
    await flush();
    expect(cleared).toBe("false / false / 0 / Nothing ticked yet. Pick a language, country or region.");
    expect(seen).toEqual([cleared, cleared]);
    expect(store.data.hiddenLanguageCodes).toEqual([]);
  });

  it("should pick up a change made while the first read was on its way", async () => {
    const { store } = await open({ hiddenLanguageCodes: ["pt"] }, { holdGet: true, snapshotGet: true });
    store.data.hiddenLanguageCodes = ["pt", "de"];
    store.emit({ hiddenLanguageCodes: { newValue: ["pt", "de"] } });
    store.release();
    await handle?.ready;
    await flush();
    expect(box("de").checked).toBe(true);
    expect($("status").textContent).toBe("Hiding Portuguese, German");
  });

  it("should ignore storage changes to other keys", async () => {
    const { api, store } = await open({ hiddenLanguageCodes: ["pt"] });
    api.storage.local.get.mockClear();
    store.emit({ userCache: { newValue: {} } });
    await flush();
    expect(api.storage.local.get).not.toHaveBeenCalled();
  });
});

describe("single-key writes", () => {
  it("should persist only markOnly for the highlight switch", async () => {
    const { api } = await open({ hiddenLanguageCodes: ["pt"] });
    $("mark-only").click();
    await flush();
    expect(api.storage.local.set).toHaveBeenCalledWith({ markOnly: true });
    expect($("mark-only").getAttribute("aria-checked")).toBe("true");
    expect($("status").textContent).toBe("Highlighting matches for Portuguese");
  });

  it("should keep picks editable while paused", async () => {
    const { api } = await open({ enabled: false });
    box("ja").click();
    await flush();
    expect(api.storage.local.set).toHaveBeenCalledWith({ hiddenLanguageCodes: ["ja"] });
    expect($("status").textContent).toBe("Paused. Your picks are saved.");
  });

  it("should toggle a switch from its label text too", async () => {
    const { api } = await open({ hiddenLanguageCodes: ["pt"] });
    $("mark-label").click();
    await flush();
    expect(api.storage.local.set).toHaveBeenLastCalledWith({ markOnly: true });
    $("mark-help").click();
    await flush();
    expect(api.storage.local.set).toHaveBeenLastCalledWith({ markOnly: false });
    $("enabled-label").click();
    await flush();
    expect(api.storage.local.set).toHaveBeenLastCalledWith({ enabled: false });
    expect(api.storage.local.set).toHaveBeenCalledTimes(3);
  });

  it("should pause and resume with the Filtering switch", async () => {
    const { api } = await open({ hiddenLanguageCodes: ["pt"] });
    $("enabled").click();
    await flush();
    expect(api.storage.local.set).toHaveBeenCalledWith({ enabled: false });
    expect($("enabled").getAttribute("aria-checked")).toBe("false");
    expect($("status").textContent).toBe("Paused. Your picks are saved.");
  });
});

describe("Focus mode", () => {
  it("should open the inline card instead of checkout when locked", async () => {
    const { api } = await open();
    expect(visible("pro-card")).toBe(false);
    $("mode-only").click();
    await flush();
    expect(visible("pro-card")).toBe(true);
    expect(api.tabs.create).not.toHaveBeenCalled();
    expect(api.storage.local.set).not.toHaveBeenCalled();
    expect($("mode-hide").getAttribute("aria-checked")).toBe("true");
    expect($("pro-price").textContent).toBe("$5.99 once · no subscription");
    expect($("pro-pay").textContent).toBe("Unlock $5.99");
    expect($("pro-trial").textContent).toBe("Try free for 7 days");
    expect(visible("pro-trial")).toBe(true);
  });

  it("should say so on the card when Tamis may not run on its thank-you page", async () => {
    await open();
    $("mode-only").click();
    expect(visible("pro-hint")).toBe(false);
    handle?.dispose();
    await open({}, { paidPage: false });
    expect(visible("pro-hint")).toBe(false);
    $("mode-only").click();
    expect(visible("pro-hint")).toBe(true);
    expect($("pro-hint").textContent).toContain("Restore");
  });

  it("should open Stripe from the Unlock button", async () => {
    const { api } = await open();
    $("mode-only").click();
    $("pro-pay").click();
    expect(api.tabs.create).toHaveBeenCalledWith({ url: STRIPE_PAYMENT_LINK });
  });

  it("should start the trial once and switch to Only show", async () => {
    const { api } = await open({ hiddenCountryCodes: ["NO"] });
    $("mode-only").click();
    $("pro-trial").click();
    await flush();
    expect(api.storage.local.set).toHaveBeenCalledWith({ trialStartedAt: NOW, filterMode: "only" });
    expect(visible("pro-card")).toBe(false);
    expect($("mode-only").getAttribute("aria-checked")).toBe("true");
    expect($("trial-chip").textContent).toBe("Trial · 7 days left");
    expect(visible("trial-buy")).toBe(true);
    expect($("status").textContent).toBe("Showing only Norway");
  });

  it("should never restart a trial started elsewhere", async () => {
    const { api, store } = await open();
    store.data.trialStartedAt = NOW - 10 * DAY;
    $("mode-only").click();
    $("pro-trial").click();
    await flush();
    expect(api.storage.local.set).not.toHaveBeenCalled();
    expect(store.data.trialStartedAt).toBe(NOW - 10 * DAY);
  });

  it("should keep the buy button during the trial", async () => {
    const { api } = await open({ trialStartedAt: NOW - 2 * DAY, filterMode: "only" });
    expect($("trial-chip").textContent).toBe("Trial · 5 days left");
    $("trial-buy").click();
    expect(api.tabs.create).toHaveBeenCalledWith({ url: STRIPE_PAYMENT_LINK });
  });

  const ENDED = { filterMode: "only", trialStartedAt: NOW - 8 * DAY, hiddenCountryCodes: ["NO"] };

  it("should fold the ended card to one line so the list keeps its room", async () => {
    await open(ENDED);
    expect($("status").textContent).toBe("Your free trial has ended. Nothing is filtered right now.");
    expect(visible("pro-card")).toBe(false);
    expect(document.body.classList.contains("card-open")).toBe(false);
    expect(visible("trial-row")).toBe(true);
    expect($("trial-chip").textContent).toBe("Trial ended");
    expect(visible("trial-buy")).toBe(false);
    expect(visible("pro-expand")).toBe(true);
    expect($("pro-expand").textContent).toBe("Unlock or switch to Hide");
  });

  it("should open the ended card on request and fold it back with the close button", async () => {
    await open(ENDED);
    $("pro-expand").click();
    expect(visible("pro-card")).toBe(true);
    expect(visible("trial-row")).toBe(false);
    expect(document.activeElement).toBe($("pro-title"));
    expect($("pro-ended").textContent).toBe("Your picks are saved. Unlock Focus mode to see only them again, or switch to Hide.");
    expect(visible("pro-trial")).toBe(false);
    expect(visible("pro-pay")).toBe(true);
    expect(visible("pro-close")).toBe(true);
    $("pro-close").focus();
    $("pro-close").click();
    expect(visible("pro-card")).toBe(false);
    expect(visible("trial-row")).toBe(true);
    expect(document.activeElement).toBe($("pro-expand"));
  });

  it("should ask before Switch to Hide turns an allow-list into a hide-list", async () => {
    const { api } = await open(ENDED);
    $("pro-expand").click();
    expect($("pro-hide").textContent).toBe("Switch to Hide…");
    $("pro-hide").click();
    expect(visible("hide-confirm")).toBe(true);
    expect($("pro-hide").getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe($("hide-keep"));
    expect(api.storage.local.set).not.toHaveBeenCalled();
    $("hide-keep").click();
    await flush();
    expect(api.storage.local.set).toHaveBeenCalledWith({ filterMode: "hide" });
    expect(visible("pro-card")).toBe(false);
    expect(visible("trial-row")).toBe(false);
    expect($("status").textContent).toBe("Hiding Norway");
    expect(document.activeElement).toBe($("mode-hide"));
  });

  it("should switch to Hide with the picks cleared, and undo that", async () => {
    const { api, store } = await open(ENDED);
    $("pro-expand").click();
    $("pro-hide").click();
    $("hide-clear").click();
    await flush();
    expect(api.storage.local.set).toHaveBeenCalledWith({
      filterMode: "hide",
      hiddenCountryCodes: [],
      hiddenLanguageCodes: [],
      hiddenRegionIds: [],
    });
    expect($("status").textContent).toBe("Nothing ticked yet. Pick a language, country or region.");
    expect(visible("undo-clear")).toBe(true);
    expect(document.activeElement).toBe($("undo-clear"));
    $("undo-clear").click();
    await flush();
    expect(store.data.hiddenCountryCodes).toEqual(["NO"]);
  });

  it("should ask first when the Hide segment would flip an allow-list", async () => {
    const { api } = await open(ENDED);
    $("mode-hide").click();
    expect(visible("pro-card")).toBe(true);
    expect(visible("hide-confirm")).toBe(true);
    expect(document.activeElement).toBe($("hide-keep"));
    expect(api.storage.local.set).not.toHaveBeenCalled();
    expect($("mode-only").getAttribute("aria-checked")).toBe("true");
    $("hide-cancel").click();
    expect(visible("hide-confirm")).toBe(false);
    expect(document.activeElement).toBe($("pro-hide"));
    expect(api.storage.local.set).not.toHaveBeenCalled();
  });

  it("should switch straight to Hide when nothing is picked", async () => {
    const { api } = await open({ filterMode: "only", trialStartedAt: NOW - 8 * DAY });
    $("pro-expand").click();
    expect($("pro-hide").textContent).toBe("Switch to Hide");
    $("pro-hide").click();
    await flush();
    expect(api.storage.local.set).toHaveBeenCalledWith({ filterMode: "hide" });
    handle?.dispose();
    const second = await open({ filterMode: "only", trialStartedAt: NOW - 8 * DAY });
    $("mode-hide").click();
    await flush();
    expect(second.api.storage.local.set).toHaveBeenCalledWith({ filterMode: "hide" });
  });

  it("should offer only Unlock after the trial when Hide is selected", async () => {
    await open({ trialStartedAt: NOW - 8 * DAY, hiddenLanguageCodes: ["ja"] });
    expect(visible("pro-card")).toBe(false);
    expect(visible("trial-row")).toBe(false);
    expect($("status").textContent).toBe("Hiding Japanese");
    $("mode-only").click();
    expect(visible("pro-card")).toBe(true);
    expect(visible("pro-ended")).toBe(true);
    expect(visible("pro-pay")).toBe(true);
    expect(visible("pro-trial")).toBe(false);
    expect(visible("pro-hide")).toBe(false);
    expect(visible("pro-close")).toBe(true);
    $("pro-close").focus();
    $("pro-close").click();
    expect(visible("pro-card")).toBe(false);
    // Back on the checked radio (tabindex 0), not the unchecked Only show at tabindex -1.
    expect(document.activeElement).toBe($("mode-hide"));
    expect($("mode-hide").tabIndex).toBe(0);
  });

  it("should never hide the focus ring of a radio or tab that has focus", () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/popup/popup.css"), "utf8");
    expect(css).not.toContain('[tabindex="-1"]:focus');
    expect(css).toContain("#pro-title:focus");
  });

  it("should move focus to the checked mode once the trial starts", async () => {
    await open({ hiddenCountryCodes: ["NO"] });
    $("mode-only").click();
    $("pro-trial").focus();
    $("pro-trial").click();
    await flush();
    expect(visible("pro-card")).toBe(false);
    expect(document.activeElement).toBe($("mode-only"));
    expect($("announce").textContent).toBe("Focus mode trial started.");
  });

  it("should not unlock with a trial start in the future", async () => {
    await open({ trialStartedAt: NOW + 30 * DAY, filterMode: "only", hiddenCountryCodes: ["NO"] });
    expect($("trial-chip").textContent).toBe("Trial ended");
    expect(visible("trial-buy")).toBe(false);
    $("pro-expand").click();
    expect(visible("pro-card")).toBe(true);
    expect(visible("pro-trial")).toBe(false);
    expect($("status").textContent).not.toContain("Showing only");
  });

  it("should restore Focus mode only after a confirm", async () => {
    const { api } = await open();
    $("mode-only").click();
    $("pro-restore").click();
    expect(visible("restore-confirm")).toBe(true);
    expect(api.storage.local.set).not.toHaveBeenCalled();
    $("restore-yes").click();
    await flush();
    expect(api.storage.local.set).toHaveBeenCalledWith({ onlyShowPaid: true, filterMode: "only" });
    expect(visible("pro-card")).toBe(false);
  });

  it("should switch to Only show directly when unlocked", async () => {
    const { api } = await open({ onlyShowPaid: true });
    $("mode-only").click();
    await flush();
    expect(api.storage.local.set).toHaveBeenCalledWith({ filterMode: "only" });
    expect(visible("pro-card")).toBe(false);
    expect(visible("trial-row")).toBe(false);
  });

  it("should not ship Test unlock in popup.html", () => {
    expect(HTML).not.toContain("pro-test");
    expect(HTML).not.toContain("Test unlock");
  });

  it("should add Test unlock only in dev builds", async () => {
    await open({}, { prod: true });
    $("mode-only").click();
    expect($("pro-test")).toBeNull();
    handle?.dispose();
    const { api } = await open({}, { prod: false });
    $("mode-only").click();
    expect(visible("pro-test")).toBe(true);
    expect($("pro-test").textContent).toBe("Test unlock");
    $("pro-test").click();
    await flush();
    expect(api.storage.local.set).toHaveBeenCalledWith({ onlyShowPaid: true, filterMode: "only" });
  });
});

describe("mode control", () => {
  it("should move between modes with the arrow keys", async () => {
    const { api } = await open({ onlyShowPaid: true });
    $("mode-hide").focus();
    $("mode-hide").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await flush();
    expect(api.storage.local.set).toHaveBeenCalledWith({ filterMode: "only" });
    expect(document.activeElement).toBe($("mode-only"));
    expect($("mode-only").getAttribute("aria-checked")).toBe("true");
    expect($("mode-only").tabIndex).toBe(0);
    expect($("mode-hide").tabIndex).toBe(-1);
  });

  it("should open the card from the keyboard when locked", async () => {
    const { api } = await open();
    $("mode-hide").focus();
    $("mode-hide").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(visible("pro-card")).toBe(true);
    expect(api.storage.local.set).not.toHaveBeenCalled();
    expect(document.activeElement).toBe($("pro-title"));
  });
});

describe("active tab status", () => {
  it("should work without the permissions API", async () => {
    await open({ hiddenLanguageCodes: ["ja"] }, { noPermissions: true, ping: { ok: true, count: 3, version: "0.2.0" } });
    expect($("status-count").textContent).toBe("3 on this tab");
    expect(visible("page-note")).toBe(false);
  });

  it("should point to x.com on other tabs", async () => {
    await open({ hiddenLanguageCodes: ["ja"] }, { tab: { id: 3, url: "https://example.com/" } });
    expect($("page-note-text").textContent).toBe("Open x.com to see it work.");
    expect(visible("page-action")).toBe(false);
    expect(visible("status-count")).toBe(false);
  });

  it("should offer a reload when the content script does not answer", async () => {
    const { api } = await open({ hiddenLanguageCodes: ["ja"] }, { tab: { id: 3, url: "https://x.com/home" }, ping: undefined });
    expect($("page-note-text").textContent).toBe("Reload this tab to start filtering.");
    expect($("page-action").textContent).toBe("Reload");
    $("page-action").focus();
    $("page-action").click();
    expect(api.tabs.reload).toHaveBeenCalledWith(3);
    // The Reload button is gone now; keep keyboard users on the page and say what happens.
    expect(visible("page-action")).toBe(false);
    expect(document.activeElement).toBe($("mode-hide"));
    expect($("announce").textContent).toBe("Reloading this tab…");
  });

  it("should keep focus on the page once access is granted", async () => {
    const { api } = await open({ hiddenLanguageCodes: ["ja"] }, { access: false, ping: { ok: true, count: 2, version: "0.2.0" } });
    api.permissions?.contains.mockImplementation(async () => true);
    $("page-action").focus();
    $("page-action").click();
    await flush();
    expect(visible("page-note")).toBe(false);
    expect($("status-count").textContent).toBe("2 on this tab");
    expect(document.activeElement).toBe($("mode-hide"));
  });

  it("should ask for host access from the click", async () => {
    const { api } = await open({}, { access: false });
    expect($("page-note-text").textContent).toBe("Tamis needs access to x.com.");
    expect($("page-action").textContent).toBe("Allow");
    $("page-action").click();
    expect(api.permissions?.request).toHaveBeenCalledWith({ origins: ["https://x.com/*", "https://twitter.com/*"] });
  });

  it("should show the count on the active X tab", async () => {
    await open({ hiddenLanguageCodes: ["ja", "pt"] }, { ping: { ok: true, count: 14, version: "0.2.0" } });
    expect($("status-count").textContent).toBe("14 on this tab");
    expect(visible("page-note")).toBe(false);
  });
});

describe("tray, tabs and search", () => {
  it("should list picks from every tab as removable chips", async () => {
    const { api } = await open({ hiddenCountryCodes: ["NO"], hiddenLanguageCodes: ["no"] });
    const chips = [...document.querySelectorAll<HTMLButtonElement>("#chips button")];
    expect(chips.map((chip) => chip.dataset.label)).toEqual(["Norway", "Norwegian"]);
    chips[1].click();
    await flush();
    expect(api.storage.local.set).toHaveBeenCalledWith({ hiddenLanguageCodes: [] });
    expect(box("no").checked).toBe(false);
  });

  it("should clear everything and undo", async () => {
    const { api, store } = await open({ hiddenCountryCodes: ["NO"], hiddenLanguageCodes: ["no"] });
    $("clear-all").click();
    await flush();
    expect(api.storage.local.set).toHaveBeenCalledWith({
      hiddenCountryCodes: [],
      hiddenLanguageCodes: [],
      hiddenRegionIds: [],
    });
    expect(visible("undo-clear")).toBe(true);
    $("undo-clear").click();
    await flush();
    expect(store.data.hiddenCountryCodes).toEqual(["NO"]);
    expect(store.data.hiddenLanguageCodes).toEqual(["no"]);
    expect(visible("undo-clear")).toBe(false);
  });

  it("should move between tabs with the arrow keys", async () => {
    await open();
    $("tab-languages").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect($("tab-countries").getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe($("tab-countries"));
    expect($<HTMLInputElement>("search").placeholder).toBe("Search countries");
    expect($("search-label").textContent).toBe("Search countries");
    expect($("panel").getAttribute("aria-labelledby")).toBe("tab-countries");
    $("tab-countries").dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect($("tab-regions").getAttribute("aria-selected")).toBe("true");
  });

  it("should search countries by alias", async () => {
    await open();
    $("tab-countries").click();
    const search = $<HTMLInputElement>("search");
    search.value = "usa";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(rows()[0].querySelector(".name")?.textContent).toBe("United States");
    search.value = "qqqq";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(rows()).toHaveLength(0);
    expect(visible("empty")).toBe(true);
  });
});

describe("always-shown accounts", () => {
  it("should put the Add form above the account chips, so a long list never pushes it out of view", async () => {
    await open({ allowedHandles: ["a", "b", "c"] });
    const form = $("handle-form");
    const handles = $("handles");
    expect(form.compareDocumentPosition(handles) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(form.compareDocumentPosition($("handle-error")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("should add, reject and remove handles", async () => {
    const { api } = await open();
    const input = $<HTMLInputElement>("handle-input");
    input.value = "@Jack";
    $("handle-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    expect(api.storage.local.set).toHaveBeenCalledWith({ allowedHandles: ["jack"] });
    expect(input.value).toBe("");
    const chip = document.querySelector<HTMLButtonElement>("#handles button");
    expect(chip?.dataset.label).toBe("@jack");
    input.value = "not a handle";
    $("handle-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect($("handle-error").textContent).toBe("Type an X handle, like @name.");
    expect(visible("handle-error")).toBe(true);
    chip?.click();
    await flush();
    expect(api.storage.local.set).toHaveBeenLastCalledWith({ allowedHandles: [] });
  });
});

describe("footer", () => {
  it("should link the privacy page", async () => {
    await open();
    const link = document.querySelector<HTMLAnchorElement>("footer a");
    expect(link?.href).toBe("https://andreasne89.github.io/x-country-block/privacy.html");
    expect(document.querySelector("footer")?.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "Runs in your browser · no extra requests to X · Privacy",
    );
  });
});
