// src/hook/inject.ts
import { isGraphqlUrl, requestUrl } from "../shared/graphql-url.ts";
import { parseGraphQL } from "../shared/parse-graphql.ts";
import { HOOK_SOURCE, type HookMessage } from "../shared/types.ts";

function publish(payload: unknown): void {
  try {
    const parsed = parseGraphQL(payload);
    if (parsed.tweets.length === 0 && parsed.users.length === 0) return;
    const message: HookMessage = { source: HOOK_SOURCE, type: "graphql", ...parsed };
    window.postMessage(message, "*");
  } catch {
    // fail open
  }
}

async function parseResponse(url: string, response: Response): Promise<void> {
  try {
    if (!isGraphqlUrl(url)) return;
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
  void parseResponse(requestUrl(args[0]), response);
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
  this.addEventListener(
    "load",
    () => {
      try {
        const url = (this as XMLHttpRequest & { __xchUrl?: string }).__xchUrl ?? "";
        if (!isGraphqlUrl(url)) return;
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
    },
    { once: true },
  );
  return xhrSend.call(this, body);
};
