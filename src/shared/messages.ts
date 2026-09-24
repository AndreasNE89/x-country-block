// Messages between the popup and the content script in the active X tab.

export const PING_MSG = "xcb-ping" as const;

export type PingMessage = { type: typeof PING_MSG };

export type PingResponse = {
  ok: true;
  /** Posts currently hidden or marked on this page. */
  count: number;
  /** Content script build version, from the manifest. */
  version: string;
};

export function isPingMessage(value: unknown): value is PingMessage {
  return Boolean(value && typeof value === "object" && (value as { type?: unknown }).type === PING_MSG);
}

export function isPingResponse(value: unknown): value is PingResponse {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return obj.ok === true && typeof obj.count === "number" && typeof obj.version === "string";
}
