import { describe, expect, it, vi } from "vitest";
import { isXUrl, probePage, type TabApi, X_ORIGINS } from "../src/popup/page.ts";

function api(overrides: Partial<TabApi> = {}): TabApi {
  return {
    hasAccess: async () => true,
    activeTab: async () => ({ id: 4, url: "https://x.com/home" }),
    ping: async () => ({ ok: true, count: 14, version: "0.2.0" }),
    ...overrides,
  };
}

describe("isXUrl", () => {
  it("should match the hosts the content script runs on", () => {
    expect(isXUrl("https://x.com/home")).toBe(true);
    expect(isXUrl("https://www.x.com/search?q=a")).toBe(true);
    expect(isXUrl("https://twitter.com/jack")).toBe(true);
    expect(isXUrl("https://mobile.twitter.com/")).toBe(true);
    expect(isXUrl("http://x.com/")).toBe(false);
    expect(isXUrl("https://notx.com/")).toBe(false);
    expect(isXUrl("https://x.com.evil.test/")).toBe(false);
    expect(isXUrl(undefined)).toBe(false);
    expect(isXUrl("chrome://newtab")).toBe(false);
  });

  it("should ask only for the manifest's host permissions", () => {
    expect(X_ORIGINS).toEqual(["https://x.com/*", "https://twitter.com/*"]);
  });
});

describe("probePage", () => {
  it("should report the filtered count when the content script answers", async () => {
    expect(await probePage(api())).toEqual({ kind: "ready", tabId: 4, count: 14 });
  });

  it("should ask for access first when host access is missing", async () => {
    const ping = vi.fn();
    expect(await probePage(api({ hasAccess: async () => false, ping }))).toEqual({ kind: "no-access" });
    expect(ping).not.toHaveBeenCalled();
  });

  it("should say not-x for other tabs, including tabs whose URL is hidden", async () => {
    expect(await probePage(api({ activeTab: async () => ({ id: 2, url: "https://example.com/" }) }))).toEqual({
      kind: "not-x",
    });
    expect(await probePage(api({ activeTab: async () => ({ id: 2 }) }))).toEqual({ kind: "not-x" });
    expect(await probePage(api({ activeTab: async () => null }))).toEqual({ kind: "not-x" });
  });

  it("should ask for a reload when nothing answers the ping", async () => {
    const fail = async () => {
      throw new Error("Could not establish connection. Receiving end does not exist.");
    };
    expect(await probePage(api({ ping: fail }))).toEqual({ kind: "no-answer", tabId: 4 });
    expect(await probePage(api({ ping: async () => undefined }))).toEqual({ kind: "no-answer", tabId: 4 });
  });

  it("should time out a ping that never answers", async () => {
    const hang = () => new Promise<unknown>(() => undefined);
    expect(await probePage(api({ ping: hang }), 10)).toEqual({ kind: "no-answer", tabId: 4 });
  });

  it("should assume access when the permissions API fails", async () => {
    const hasAccess = async () => {
      throw new Error("no permissions API");
    };
    expect((await probePage(api({ hasAccess }))).kind).toBe("ready");
  });
});
