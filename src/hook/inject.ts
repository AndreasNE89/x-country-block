// src/hook/inject.ts
import { parseGraphQL } from "../shared/parse-graphql.ts";
import type { HookMessage } from "../shared/types.ts";

const SOURCE = "x-country-hide";

function publish(payload: unknown): void {
  try {
    const parsed = parseGraphQL(payload);
    if (parsed.tweets.length === 0 && parsed.users.length === 0) return;
    const message: HookMessage = { source: SOURCE, type: "graphql", ...parsed };
    window.postMessage(message, "*");
  } catch {
    // fail open
  }
}

async function parseResponse(response: Response): Promise<void> {
  try {
    const clone = response.clone();
    const contentType = clone.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) return;
    publish(await clone.json());
  } catch {
    // fail open
  }
}

const originalFetch = window.fetch.bind(window);
window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
  const response = await originalFetch(...args);
  void parseResponse(response);
  return response;
};

const xhrOpen = XMLHttpRequest.prototype.open;
const xhrSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (
  this: XMLHttpRequest,
  method: string,
  url: string | URL,
  ...rest: unknown[]
): void {
  (this as XMLHttpRequest & { __xchUrl?: string }).__xchUrl = String(url);
  // @ts-expect-error XHR open arity
  return xhrOpen.call(this, method, url, ...(rest as []));
};

XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): void {
  this.addEventListener("load", () => {
    try {
      const type = this.getResponseHeader("content-type") ?? "";
      if (!type.includes("json")) return;
      if (this.responseType === "json") {
        publish(this.response);
        return;
      }
      const text = this.responseText;
      if (!text) return;
      publish(JSON.parse(text));
    } catch {
      // fail open
    }
  });
  return xhrSend.call(this, body);
};
