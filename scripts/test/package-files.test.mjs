// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compareFiles, manifestFiles, pageRefs } from "../lib/package-files.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (file) => readFileSync(join(root, file), "utf8");

const ICONS = [16, 32, 48, 64, 96, 128].map((size) => `icons/icon${size}.png`);

describe("manifestFiles", () => {
  it("lists every file the Chrome manifest points at", () => {
    expect(manifestFiles(JSON.parse(read("manifest.json")))).toEqual(
      ["background.js", "content.js", "hook.js", ...ICONS, "manifest.json", "paid-page.js", "popup.html"].sort(),
    );
  });

  it("lists every file the Firefox manifest points at", () => {
    expect(manifestFiles(JSON.parse(read("manifest.firefox.json")))).toEqual(
      ["background.js", "content.js", "hook.js", ...ICONS, "manifest.json", "paid-page.js", "popup.html"].sort(),
    );
  });
});

describe("pageRefs", () => {
  it("finds local scripts and stylesheets, skipping remote and fragment links", () => {
    const html = `<link rel="stylesheet" href="popup.css" /><script src="./popup.js"></script>
      <a href="https://example.com/privacy.html">Privacy</a><a href="#top">Top</a>`;
    expect(pageRefs(html)).toEqual(["popup.css", "popup.js"]);
  });
});

describe("compareFiles", () => {
  it("flags a stale bundle left from an older build (extpay-page.js in 0.1.2)", () => {
    const expected = ["manifest.json", "popup.js"];
    expect(compareFiles(["extpay-page.js", "manifest.json", "popup.js"], expected)).toEqual({
      extra: ["extpay-page.js"],
      missing: [],
    });
  });

  it("flags a referenced file the build did not produce", () => {
    expect(compareFiles(["manifest.json"], ["manifest.json", "popup.css"])).toEqual({
      extra: [],
      missing: ["popup.css"],
    });
  });
});
