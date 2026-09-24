// MAIN-world hook: reads the GraphQL responses X's own requests receive and posts the parsed
// records to the content script. It makes no requests of its own.
import { isGraphqlUrl, requestUrl } from "../shared/graphql-url.ts";
import { parseGraphQL } from "../shared/parse-graphql.ts";
import { HOOK_SOURCE, type HookMessage } from "../shared/types.ts";

type Send = (payload: unknown) => void;

export type HookWindow = {
  fetch: typeof fetch;
  XMLHttpRequest: typeof XMLHttpRequest;
  postMessage: (message: unknown, targetOrigin: string) => void;
  location: { origin: string };
};

const installed = new WeakSet<object>();

export function publish(win: HookWindow, payload: unknown): void {
  try {
    const parsed = parseGraphQL(payload);
    if (parsed.tweets.length === 0 && parsed.users.length === 0) return;
    const message: HookMessage = { source: HOOK_SOURCE, type: "graphql", ...parsed };
    // Same-origin only: never delivered to a frame of another origin.
    win.postMessage(message, win.location.origin);
  } catch {
    // fail open
  }
}

function readFetch(response: Response, send: Send): void {
  try {
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("json")) return;
    // Clone before X's own handler (registered after this one) reads the body.
    response
      .clone()
      .json()
      .then(send, () => {
        // not JSON after all
      });
  } catch {
    // fail open
  }
}

function hasByteLength(value: unknown): value is ArrayBuffer {
  return !!value && typeof value === "object" && typeof (value as ArrayBuffer).byteLength === "number";
}

function hasText(value: unknown): value is Blob {
  return !!value && typeof value === "object" && typeof (value as Blob).text === "function";
}

/** The JSON body of a finished XHR, whatever responseType X asked for. */
export function readXhr(xhr: XMLHttpRequest, send: Send): void {
  try {
    const type = xhr.getResponseHeader("content-type") ?? "";
    if (!type.includes("json")) return;
    switch (xhr.responseType) {
      case "json":
        send(xhr.response);
        return;
      case "":
      case "text": {
        const text = xhr.responseText;
        if (text) send(JSON.parse(text));
        return;
      }
      case "arraybuffer":
        if (hasByteLength(xhr.response)) send(JSON.parse(new TextDecoder().decode(xhr.response)));
        return;
      case "blob":
        if (hasText(xhr.response)) {
          xhr.response.text().then(
            (text) => send(JSON.parse(text)),
            () => {
              // unreadable body
            },
          );
        }
        return;
      default:
        // "document" never holds JSON
        return;
    }
  } catch {
    // fail open
  }
}

/**
 * Wrap fetch and XMLHttpRequest. The wrappers are Proxies of the originals, so they keep their
 * native name, length and toString; request URLs live in a WeakMap, not on the XHR objects.
 */
export function installHook(win: HookWindow): void {
  if (installed.has(win)) return;
  installed.add(win);
  const send: Send = (payload) => publish(win, payload);

  win.fetch = new Proxy(win.fetch, {
    apply(target, thisArg, args: Parameters<typeof fetch>) {
      const pending = Reflect.apply(target, thisArg, args) as Promise<Response>;
      try {
        if (isGraphqlUrl(requestUrl(args[0]))) {
          pending.then(
            (response) => readFetch(response, send),
            () => {
              // X handles its own failed requests
            },
          );
        }
      } catch {
        // fail open
      }
      return pending;
    },
  });

  const urls = new WeakMap<object, string>();
  const proto = win.XMLHttpRequest.prototype;
  proto.open = new Proxy(proto.open, {
    apply(target, thisArg, args: unknown[]) {
      try {
        urls.set(thisArg as object, String(args[1]));
      } catch {
        // not an XHR
      }
      return Reflect.apply(target, thisArg, args);
    },
  });
  proto.send = new Proxy(proto.send, {
    apply(target, thisArg, args: unknown[]) {
      try {
        const xhr = thisArg as XMLHttpRequest;
        if (isGraphqlUrl(urls.get(xhr) ?? "")) {
          xhr.addEventListener("load", () => readXhr(xhr, send), { once: true });
        }
      } catch {
        // fail open
      }
      return Reflect.apply(target, thisArg, args);
    },
  });
}

if (typeof window !== "undefined" && typeof XMLHttpRequest !== "undefined") {
  installHook(window);
}
