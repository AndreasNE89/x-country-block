import { describe, expect, it, vi } from "vitest";
import { extensionTabApi, isXUrl, paidPageAllowed, probePage, type TabApi, X_ORIGINS } from "../src/popup/page.ts";
import { PAID_PAGE_MATCH } from "../src/shared/stripe.ts";

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

  it("should ping when only x.com or only twitter.com is granted", async () => {
    for (const granted of [["https://x.com/*"], ["https://twitter.com/*"]]) {
      const contains = vi.fn(async ({ origins = [] }: { origins?: string[] }) =>
        origins.every((origin) => granted.includes(origin)),
      );
      const sendMessage = vi.fn(async () => ({ ok: true, count: 5, version: "0.2.0" }));
      const chromeApi = {
        permissions: { contains, request: vi.fn() },
        tabs: { query: async () => [{ id: 9, url: "https://x.com/home" }], sendMessage },
      } as unknown as typeof chrome;
      expect(await probePage(extensionTabApi(chromeApi))).toEqual({ kind: "ready", tabId: 9, count: 5 });
      expect(sendMessage).toHaveBeenCalledTimes(1);
    }
  });

  it("should report no access when neither X host is granted", async () => {
    const chromeApi = {
      permissions: { contains: async () => false, request: vi.fn() },
      tabs: { query: async () => [{ id: 9 }], sendMessage: vi.fn() },
    } as unknown as typeof chrome;
    expect(await extensionTabApi(chromeApi).hasAccess()).toBe(false);
  });

  it("should tell when the thank-you page is off limits, and assume it is not otherwise", async () => {
    const withContains = (contains: unknown) => ({ permissions: { contains } }) as unknown as typeof chrome;
    const blocked = vi.fn(async () => false);
    expect(await paidPageAllowed(withContains(blocked))).toBe(false);
    expect(blocked).toHaveBeenCalledWith({ origins: [PAID_PAGE_MATCH] });
    expect(await paidPageAllowed(withContains(async () => true))).toBe(true);
    expect(
      await paidPageAllowed(
        withContains(async () => {
          throw new Error("Invalid match pattern");
        }),
      ),
    ).toBe(true);
    expect(await paidPageAllowed({} as unknown as typeof chrome)).toBe(true);
  });

  it("should assume access when the permissions API fails", async () => {
    const hasAccess = async () => {
      throw new Error("no permissions API");
    };
    expect((await probePage(api({ hasAccess }))).kind).toBe("ready");
  });
});
