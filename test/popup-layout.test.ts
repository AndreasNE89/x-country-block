import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// jsdom has no layout engine, so this checks the CSS contract that keeps the 520px column
// intact. The rendered result is checked in a real browser (see the commit that added this).
const CSS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/popup/popup.css"), "utf8");
const POPUP_HEIGHT = 520;

/** Declarations of the rule whose selector is exactly `selector`, merged in source order. */
function rule(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  const body = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, selectors, block] of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors.split(",").some((part) => part.trim() === selector)) continue;
    for (const declaration of block.split(";")) {
      const [name, ...value] = declaration.split(":");
      if (name.trim() && value.length > 0) out[name.trim()] = value.join(":").trim();
    }
  }
  return out;
}

function flexShrink(selector: string): number {
  const declarations = rule(selector);
  if (declarations["flex-shrink"] !== undefined) return Number(declarations["flex-shrink"]);
  const flex = declarations.flex ?? "";
  if (flex === "none") return 0;
  return Number(flex.split(/\s+/)[1] ?? 1);
}

describe("popup layout", () => {
  it("should let the top section shrink so the column never spills past the popup", () => {
    expect(flexShrink(".top")).toBeGreaterThan(0);
    expect(rule(".top")["overflow-y"]).toBe("auto");
    expect(rule("body").height).toBe(`${POPUP_HEIGHT}px`);
  });

  it("should take room from the accounts section first, before the top gives up a pixel", () => {
    // Flex shrinks each item by shrink factor × size. With the top as tall as the popup and
    // the accounts section at its smallest, the top may lose under 1px of a full-popup squeeze.
    const accountsMin = Number.parseFloat(rule(".accounts")["min-height"]);
    const top = flexShrink(".top") * POPUP_HEIGHT;
    const accounts = flexShrink(".accounts") * accountsMin;
    expect((POPUP_HEIGHT * top) / (top + accounts)).toBeLessThan(1);
  });

  it("should let the pick chips give up rows inside the top before it needs a scrollbar", () => {
    // The chips already scroll on their own; a scrollbar on .top as well would nest two.
    expect(flexShrink(".tray")).toBeGreaterThan(0);
    expect(Number.parseFloat(rule(".tray")["min-height"])).toBeGreaterThanOrEqual(22);
    expect(rule(".tray .chips")["align-self"]).toBe("stretch");
    expect(rule(".chips")["overflow-y"]).toBe("auto");
  });

  it("should keep the title and the Add form of an open accounts section in view", () => {
    // Summary (about 26px) + the Add form (24px) + gaps and padding.
    expect(Number.parseFloat(rule(".accounts[open]")["min-height"])).toBeGreaterThanOrEqual(66);
  });
});
