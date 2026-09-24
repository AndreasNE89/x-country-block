import { describe, expect, it, vi } from "vitest";
import { type HookWindow, installHook, readXhr } from "../src/hook/inject.ts";
import { HOOK_SOURCE } from "../src/shared/types.ts";

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

type Posted = { message: { source: string; type: string; users: { userId: string }[] }; origin: string };

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

function fakeWindow(fetchImpl: typeof fetch = async () => jsonResponse(PAYLOAD)) {
  const posted: Posted[] = [];
  const win = {
    fetch: fetchImpl,
    XMLHttpRequest: class extends FakeXhr {} as unknown as typeof XMLHttpRequest,
    postMessage: (message: unknown, origin: string) => posted.push({ message: message as Posted["message"], origin }),
    location: { origin: "https://x.com" },
  } satisfies HookWindow;
  installHook(win);
  return { win, posted };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("fetch hook", () => {
  it("returns X's own response and posts parsed records to this origin only", async () => {
    const original = vi.fn(async () => jsonResponse(PAYLOAD));
    const { win, posted } = fakeWindow(original);
    const response = await win.fetch("https://x.com/i/api/graphql/abc/UserByScreenName");
    expect(await response.json()).toEqual(PAYLOAD);
    await settle();
    expect(original).toHaveBeenCalledTimes(1);
    expect(posted).toHaveLength(1);
    expect(posted[0]!.origin).toBe("https://x.com");
    expect(posted[0]!.message.source).toBe(HOOK_SOURCE);
    expect(posted[0]!.message.users.map((u) => u.userId)).toEqual(["42"]);
  });

  it("ignores responses that are not GraphQL JSON", async () => {
    const { win, posted } = fakeWindow(async () => jsonResponse(PAYLOAD, "text/html"));
    await win.fetch("https://x.com/i/api/graphql/abc/HomeTimeline");
    await win.fetch("https://x.com/i/api/1.1/jot/client_event.json");
    await settle();
    expect(posted).toHaveLength(0);
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
    const { win, posted } = fakeWindow();
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
    expect(posted).toHaveLength(4);
  });

  it("does not listen to requests that are not GraphQL", () => {
    const { win } = fakeWindow();
    const xhr = sendXhr(win, "https://x.com/i/api/1.1/jot/client_event.json");
    expect((xhr as unknown as { listeners: unknown[] }).listeners).toHaveLength(0);
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
