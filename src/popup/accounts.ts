import { normalizeHandle } from "../shared/settings.ts";
import { isXUrl } from "./page.ts";

export type AddHandleResult =
  | { ok: true; handle: string; handles: string[] }
  | { ok: false; error: string };

/** A handle from "@name", "name" or a pasted profile or post link. */
export function handleFromInput(input: string): string | null {
  const text = input.trim();
  if (/[/.]/.test(text)) {
    const url = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    if (!isXUrl(url)) return null;
    return normalizeHandle(new URL(url).pathname.split("/")[1] ?? "");
  }
  return normalizeHandle(text);
}

export function addHandle(list: readonly string[], input: string): AddHandleResult {
  const handle = handleFromInput(input);
  if (!handle) return { ok: false, error: "Type an X handle, like @name." };
  if (list.includes(handle)) return { ok: false, error: `@${handle} is already on the list.` };
  return { ok: true, handle, handles: [...list, handle] };
}

export function removeHandle(list: readonly string[], handle: string): string[] {
  return list.filter((item) => item !== handle);
}
