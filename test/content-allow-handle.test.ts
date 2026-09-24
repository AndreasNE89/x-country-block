import { describe, expect, it, vi } from "vitest";
import { addAllowedHandle, allowButtonHandle } from "../src/content/allow-handle.ts";
import { ALLOW_ATTR } from "../src/shared/hide-dom.ts";

function memoryArea(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial };
  return {
    data,
    get: vi.fn(async (keys: string[]) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]]))),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(data, items);
    }),
  };
}

describe("addAllowedHandle", () => {
  it("adds a normalized handle and keeps the existing ones", async () => {
    const area = memoryArea({ allowedHandles: ["dave"], hiddenCountryCodes: ["IN"] });
    expect(await addAllowedHandle(area, "@Carol")).toBe(true);
    expect(area.data.allowedHandles).toEqual(["dave", "carol"]);
    expect(area.data.hiddenCountryCodes).toEqual(["IN"]);
  });

  it("does not add a duplicate or an invalid handle", async () => {
    const area = memoryArea({ allowedHandles: ["carol"] });
    expect(await addAllowedHandle(area, "CAROL")).toBe(true);
    expect(await addAllowedHandle(area, "not a handle!")).toBe(false);
    expect(area.set).not.toHaveBeenCalled();
  });
});

describe("allowButtonHandle", () => {
  it("claims clicks on the Always show button and stops X from opening the post", () => {
    document.body.innerHTML = `<article><button ${ALLOW_ATTR}="carol"><span id="inner">Always show @carol</span></button></article>`;
    const opened = vi.fn();
    document.querySelector("article")!.addEventListener("click", opened);
    let claimed: string | null = null;
    document.addEventListener("click", (event) => {
      claimed = allowButtonHandle(event);
    }, true);
    document.getElementById("inner")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(claimed).toBe("carol");
    expect(opened).not.toHaveBeenCalled();
  });

  it("leaves other clicks alone", () => {
    document.body.innerHTML = `<article><a id="link" href="/a/status/1">post</a></article>`;
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "target", { value: document.getElementById("link") });
    expect(allowButtonHandle(event)).toBeNull();
    expect(event.defaultPrevented).toBe(false);
  });
});
