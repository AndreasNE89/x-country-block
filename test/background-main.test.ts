import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STRIPE_PAID_MESSAGE } from "../src/shared/license.ts";
import { STRIPE_SUCCESS_PATH } from "../src/shared/stripe.ts";

type Listener = (...args: any[]) => unknown;

function makeChrome(options: { textColor?: boolean; sync?: boolean } = {}) {
  const messageListeners: Listener[] = [];
  const installedListeners: Listener[] = [];
  const api = {
    action: {
      setBadgeText: vi.fn(async () => undefined),
      getBadgeText: vi.fn(async () => ""),
      setBadgeBackgroundColor: vi.fn(async () => undefined),
      ...(options.textColor === false ? {} : { setBadgeTextColor: vi.fn(async () => undefined) }),
    },
    runtime: {
      onMessage: { addListener: (cb: Listener) => messageListeners.push(cb) },
      onInstalled: { addListener: (cb: Listener) => installedListeners.push(cb) },
    },
    storage: {
      local: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
        onChanged: { addListener: vi.fn() },
      },
      ...(options.sync === false ? {} : { sync: { remove: vi.fn(async () => undefined) } }),
    },
    tabs: {
      remove: vi.fn(async () => undefined),
    },
  };
  return { api, messageListeners, installedListeners };
}

async function loadBackground(options: { textColor?: boolean; sync?: boolean } = {}) {
  const env = makeChrome(options);
  vi.stubGlobal("chrome", env.api);
  vi.resetModules();
  await import("../src/background/main.ts");
  return env;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("background badge", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should paint the badge marigold with ink text at startup", async () => {
    const { api } = await loadBackground();
    expect(api.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: "#FFB638" });
    expect(api.action.setBadgeTextColor).toHaveBeenCalledWith({ color: "#14201F" });
  });

  it("should set per-tab text and colors from a badge message", async () => {
    const { api, messageListeners } = await loadBackground();
    messageListeners[0]({ type: "xcb-badge", count: 7 }, { tab: { id: 5 } }, () => undefined);
    expect(api.action.setBadgeText).toHaveBeenCalledWith({ text: "7", tabId: 5 });
    expect(api.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: "#FFB638", tabId: 5 });
    expect(api.action.setBadgeTextColor).toHaveBeenCalledWith({ color: "#14201F", tabId: 5 });
  });

  it("should work without setBadgeTextColor", async () => {
    const { api, messageListeners } = await loadBackground({ textColor: false });
    expect(() =>
      messageListeners[0]({ type: "xcb-badge", count: 2 }, { tab: { id: 1 } }, () => undefined),
    ).not.toThrow();
    expect(api.action.setBadgeText).toHaveBeenCalledWith({ text: "2", tabId: 1 });
  });
});

describe("background Stripe unlock", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should store the purchase, keep the tab open and answer the page", async () => {
    const { api, messageListeners } = await loadBackground();
    const sendResponse = vi.fn();
    const keepOpen = messageListeners[0](
      { type: STRIPE_PAID_MESSAGE },
      { tab: { id: 9 }, url: `${STRIPE_SUCCESS_PATH}?paid=1` },
      sendResponse,
    );
    expect(keepOpen).toBe(true);
    await flush();
    expect(api.storage.local.set).toHaveBeenCalledWith({ onlyShowPaid: true });
    expect(api.tabs.remove).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("should ignore a paid message sent from another page", async () => {
    const { api, messageListeners } = await loadBackground();
    messageListeners[0]({ type: STRIPE_PAID_MESSAGE }, { tab: { id: 9 }, url: "https://x.com/home" }, vi.fn());
    await flush();
    expect(api.storage.local.set).not.toHaveBeenCalled();
  });

  it("should ignore a paid message whose sender has no URL", async () => {
    const { api, messageListeners } = await loadBackground();
    messageListeners[0]({ type: STRIPE_PAID_MESSAGE }, {}, vi.fn());
    await flush();
    expect(api.storage.local.set).not.toHaveBeenCalled();
  });
});

describe("background legacy ExtensionPay cleanup", () => {
  const keys = ["extensionpay_api_key", "extensionpay_installed_at", "extensionpay_user"];

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should remove ExtensionPay keys from local and sync storage after an update from 0.1.x", async () => {
    const { api, installedListeners } = await loadBackground();
    expect(installedListeners).toHaveLength(1);
    installedListeners[0]({ reason: "update", previousVersion: "0.1.2" });
    await flush();
    expect(api.storage.local.remove).toHaveBeenCalledWith([...keys, "onlyShowUnlocked"]);
    expect(api.storage.sync?.remove).toHaveBeenCalledWith(keys);
  });

  it("should leave storage alone after an update from 0.2.0", async () => {
    const { api, installedListeners } = await loadBackground();
    installedListeners[0]({ reason: "update", previousVersion: "0.2.0" });
    await flush();
    expect(api.storage.local.remove).not.toHaveBeenCalled();
  });

  it("should still clean local storage when storage.sync is missing or fails", async () => {
    const { api, installedListeners } = await loadBackground({ sync: false });
    installedListeners[0]({ reason: "update", previousVersion: "0.1.0" });
    await flush();
    expect(api.storage.local.remove).toHaveBeenCalledWith([...keys, "onlyShowUnlocked"]);
  });

  it("should never touch the user's picks or purchase", async () => {
    const { api, installedListeners } = await loadBackground();
    installedListeners[0]({ reason: "update", previousVersion: "0.1.1" });
    await flush();
    for (const call of api.storage.local.remove.mock.calls as unknown as string[][][]) {
      expect(call[0]).not.toContain("onlyShowPaid");
      expect(call[0]).not.toContain("hiddenCountryCodes");
    }
  });
});
