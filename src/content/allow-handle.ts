import { ALLOW_ATTR } from "../shared/hide-dom.ts";
import { normalizeHandle } from "../shared/settings.ts";

type Area = {
  get: (keys: string[]) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
};

/** Add a handle to allowedHandles (read-modify-write, so picks made meanwhile are kept). */
export async function addAllowedHandle(area: Area, value: string): Promise<boolean> {
  const handle = normalizeHandle(value);
  if (!handle) return false;
  const raw = await area.get(["allowedHandles"]);
  const current = Array.isArray(raw.allowedHandles)
    ? raw.allowedHandles.filter((item): item is string => typeof item === "string")
    : [];
  if (current.some((item) => normalizeHandle(item) === handle)) return true;
  await area.set({ allowedHandles: [...current, handle] });
  return true;
}

/**
 * For a click on an "Always show @handle" button: the handle, after stopping the click so X does
 * not also open the post. Null for every other click, which is left alone.
 */
export function allowButtonHandle(event: Event): string | null {
  const target = event.target;
  if (!target || typeof (target as Element).closest !== "function") return null;
  const button = (target as Element).closest(`[${ALLOW_ATTR}]`);
  if (!button) return null;
  event.preventDefault();
  event.stopPropagation();
  return button.getAttribute(ALLOW_ATTR);
}
