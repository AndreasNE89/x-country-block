// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PACKAGED_ICONS } from "../lib/package-files.mjs";
import { decodePng, opaqueBounds } from "../lib/png.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const icon = (file) => decodePng(readFileSync(join(root, "icons", file)));
const sizeOf = (file) => Number(/icon(\d+)\.png$/.exec(file)[1]);

describe("packaged icons", () => {
  it.each(PACKAGED_ICONS)("%s has the size its name and the manifests claim", (file) => {
    const { width, height } = icon(file);
    expect([width, height]).toEqual([sizeOf(file), sizeOf(file)]);
  });

  it("icon128 is 96x96 artwork inside 16px of transparent padding (Chrome Web Store)", () => {
    const bounds = opaqueBounds(icon("icon128.png"));
    // The soft drop plate may reach 2px below the tile.
    expect(bounds.left).toBe(16);
    expect(bounds.top).toBe(16);
    expect(bounds.right).toBe(111);
    expect(bounds.bottom).toBeGreaterThanOrEqual(111);
    expect(bounds.bottom).toBeLessThanOrEqual(113);
  });

  it.each(["icon16.png", "icon32.png"])("toolbar %s stays edge to edge so the glyph is not shrunk", (file) => {
    const bounds = opaqueBounds(icon(file));
    const last = sizeOf(file) - 1;
    expect(bounds).toEqual({ left: 0, top: 0, right: last, bottom: last });
  });
});
