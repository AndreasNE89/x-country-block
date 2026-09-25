import { screenNameFromPath } from "../shared/hide-dom.ts";
import { normalizeHandle } from "../shared/settings.ts";
import { isXUrl } from "./page.ts";

export type AddHandleResult =
  | { ok: true; handle: string; handles: string[] }
  | { ok: false; error: string };

const NOT_A_HANDLE = "Type an X handle, like @name.";
const NOT_A_PROFILE_LINK = "That link is not a profile or a post. Paste one of those, or type @name.";

type Parsed = { handle: string } | { error: string };

function parseInput(input: string): Parsed {
  const text = input.trim();
  if (!/[/.]/.test(text)) {
    const handle = normalizeHandle(text);
    return handle ? { handle } : { error: NOT_A_HANDLE };
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return { error: NOT_A_HANDLE };
  }
  // A hand-typed http:// link is still an X link.
  if (url.protocol === "http:") url.protocol = "https:";
  if (!isXUrl(url.href)) return { error: NOT_A_HANDLE };
  // The content script's own rule, so /home, /i/lists/1, /search, /settings... never become "accounts".
  const name = screenNameFromPath(url.pathname);
  const handle = name ? normalizeHandle(name) : null;
  return handle ? { handle } : { error: NOT_A_PROFILE_LINK };
}

/**
 * A handle from "@name", "name" or a pasted profile or post link. Only links are
 * checked against X's own routes: a typed name is taken as the user wrote it.
 */
export function handleFromInput(input: string): string | null {
  const parsed = parseInput(input);
  return "handle" in parsed ? parsed.handle : null;
}

export function addHandle(list: readonly string[], input: string): AddHandleResult {
  const parsed = parseInput(input);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const { handle } = parsed;
  if (list.includes(handle)) return { ok: false, error: `@${handle} is already on the list.` };
  return { ok: true, handle, handles: [...list, handle] };
}

export function removeHandle(list: readonly string[], handle: string): string[] {
  return list.filter((item) => item !== handle);
}
