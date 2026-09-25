import { describe, expect, it, vi } from "vitest";
import { type HookWindow, installHook, readXhr } from "../src/hook/inject.ts";
import { HOOK_INSTALLED, HOOK_SOURCE, HOOK_VERSION } from "../src/shared/types.ts";

const PAYLOAD = {
  data: {
    user: {
      result: {
        __typename: "User",
        rest_id: "42",
        legacy: { screen_name: "someone", location: "Oslo, Norway" },
      },
    },
  },
};

type Posted = { message: { source: string; type: string; v?: number; users: { userId: string }[] }; origin: string };

function jsonResponse(body: unknown, type = "application/json"): Response {
  return new Response(JSON.stringify(body), { headers: { "content-type": type } });
}

class FakeXhr {
  responseType: XMLHttpRequestResponseType = "";
  response: unknown = null;
  responseText = "";
  contentType = "application/json";
  private readonly listeners: (() => void)[] = [];

  open(_method: string, _url: string): void {}

  send(_body?: unknown): void {}

  addEventListener(_type: string, cb: () => void): void {
    this.listeners.push(cb);
  }

  getResponseHeader(): string {
    return this.contentType;
  }

  finish(): void {
    for (const cb of this.listeners) cb();
  }
}

/** A page window: posted messages reach its "message" listeners in a later task, as in a browser. */
function fakeWindow(fetchImpl: typeof fetch = async () => jsonResponse(PAYLOAD), install = installHook) {
  const all: Posted[] = [];
  const listeners: ((event: MessageEvent) => void)[] = [];
  const win: HookWindow = {
    fetch: fetchImpl,
    XMLHttpRequest: class extends FakeXhr {} as unknown as typeof XMLHttpRequest,
    postMessage: (message: unknown, origin: string) => {
      all.push({ message: message as Posted["message"], origin });
      setTimeout(() => {
        for (const cb of listeners) cb({ data: message, origin, source: win } as unknown as MessageEvent);
      }, 0);
    },
    location: { origin: "https://x.com" },
    addEventListener: (_type, cb) => listeners.push(cb),
  };
  install(win);
  // Record batches only; the hook also announces itself once.
  const batches = () => all.filter((p) => p.message.type === "graphql");
  return { win, batches, all };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("fetch hook", () => {
  it("returns X's own response and posts parsed records to this origin only", async () => {
    const original = vi.fn(async () => jsonResponse(PAYLOAD));
    const { win, batches } = fakeWindow(original);
    const response = await win.fetch("https://x.com/i/api/graphql/abc/UserByScreenName");
    expect(await response.json()).toEqual(PAYLOAD);
    await settle();
    expect(original).toHaveBeenCalledTimes(1);
    expect(batches()).toHaveLength(1);
    expect(batches()[0]!.origin).toBe("https://x.com");
    expect(batches()[0]!.message.source).toBe(HOOK_SOURCE);
    expect(batches()[0]!.message.v).toBe(HOOK_VERSION);
    expect(batches()[0]!.message.users.map((u) => u.userId)).toEqual(["42"]);
  });

  it("ignores responses that are not GraphQL JSON", async () => {
    const { win, batches } = fakeWindow(async () => jsonResponse(PAYLOAD, "text/html"));
    await win.fetch("https://x.com/i/api/graphql/abc/HomeTimeline");
    await win.fetch("https://x.com/i/api/1.1/jot/client_event.json");
    await settle();
    expect(batches()).toHaveLength(0);
  });

  it("passes failures through untouched", async () => {
    const { win } = fakeWindow(async () => {
      throw new TypeError("offline");
    });
    await expect(win.fetch("https://x.com/i/api/graphql/abc/HomeTimeline")).rejects.toThrow("offline");
  });

  it("keeps fetch looking native (F49)", () => {
    const { win } = fakeWindow();
    expect(Function.prototype.toString.call(win.fetch)).toContain("[native code]");
  });
});

describe("XMLHttpRequest hook", () => {
  function sendXhr(win: HookWindow, url: string): FakeXhr {
    const xhr = new win.XMLHttpRequest() as unknown as FakeXhr;
    (xhr as unknown as XMLHttpRequest).open("GET", url);
    (xhr as unknown as XMLHttpRequest).send();
    return xhr;
  }

  it("keeps the request URL off the XHR object (F49)", () => {
    const { win } = fakeWindow();
    const xhr = sendXhr(win, "https://x.com/i/api/graphql/abc/HomeTimeline");
    expect(Object.keys(xhr).some((key) => key.startsWith("__"))).toBe(false);
    expect(Function.prototype.toString.call(win.XMLHttpRequest.prototype.open)).toContain("[native code]");
  });

  it("reads text, json, arraybuffer and blob bodies (F50)", async () => {
    const { win, batches } = fakeWindow();
    const url = "https://x.com/i/api/graphql/abc/HomeTimeline";
    const text = sendXhr(win, url);
    text.responseText = JSON.stringify(PAYLOAD);
    text.finish();
    const json = sendXhr(win, url);
    json.responseType = "json";
    json.response = PAYLOAD;
    json.finish();
    const buffer = sendXhr(win, url);
    buffer.responseType = "arraybuffer";
    buffer.response = new TextEncoder().encode(JSON.stringify(PAYLOAD)).buffer;
    buffer.finish();
    const blob = sendXhr(win, url);
    blob.responseType = "blob";
    blob.response = new Blob([JSON.stringify(PAYLOAD)], { type: "application/json" });
    blob.finish();
    await settle();
    expect(batches()).toHaveLength(4);
  });

  it("does not listen to requests that are not GraphQL", () => {
    const { win } = fakeWindow();
    const xhr = sendXhr(win, "https://x.com/i/api/1.1/jot/client_event.json");
    expect((xhr as unknown as { listeners: unknown[] }).listeners).toHaveLength(0);
  });

  it("stands down when a newer hook.js installs in the same page (R40)", async () => {
    const { win, batches } = fakeWindow();
    await settle();
    // Firefox runs the next build's hook.js in a tab left open across an update: a new bundle,
    // with its own module state, wraps the proxies this one left.
    vi.resetModules();
    const next = await import("../src/hook/inject.ts");
    next.installHook(win);
    await settle();
    const url = "https://x.com/i/api/graphql/abc/HomeTimeline";
    const xhr = sendXhr(win, url);
    xhr.responseText = JSON.stringify(PAYLOAD);
    xhr.finish();
    expect((xhr as unknown as { listeners: unknown[] }).listeners).toHaveLength(1);
    const clone = vi.spyOn(Response.prototype, "clone");
    await win.fetch(url);
    await settle();
    expect(clone).toHaveBeenCalledTimes(1);
    clone.mockRestore();
    expect(batches()).toHaveLength(2);
  });

  it("is not silenced by its own announcement", async () => {
    const { win, batches, all } = fakeWindow();
    await settle();
    expect(all.filter((p) => p.message.type === HOOK_INSTALLED)).toHaveLength(1);
    await win.fetch("https://x.com/i/api/graphql/abc/HomeTimeline");
    await settle();
    expect(batches()).toHaveLength(1);
  });

  it("skips a document body and a malformed body without throwing", () => {
    const send = vi.fn();
    const doc = new FakeXhr();
    doc.responseType = "document";
    readXhr(doc as unknown as XMLHttpRequest, send);
    const bad = new FakeXhr();
    bad.responseText = "{not json";
    expect(() => readXhr(bad as unknown as XMLHttpRequest, send)).not.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});
