// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (file) => JSON.parse(readFileSync(join(root, file), "utf8"));
const chrome = read("manifest.json");
const firefox = read("manifest.firefox.json");

const X_HOSTS = [
  "https://x.com/*",
  "https://www.x.com/*",
  "https://twitter.com/*",
  "https://www.twitter.com/*",
  "https://mobile.twitter.com/*",
];
// Must equal STRIPE_SUCCESS_PATH and the Stripe Payment Link redirect.
const PAID_PAGE = "https://andreasne89.github.io/x-country-block/privacy.html*";

describe.each([
  ["manifest.json", chrome],
  ["manifest.firefox.json", firefox],
])("%s", (_file, manifest) => {
  it("uses the Tamis name and a summary within the store limit", () => {
    expect(manifest.name).toBe("Tamis: Country & Language Filter for X");
    expect(manifest.short_name).toBe("Tamis");
    expect(manifest.action.default_title).toBe("Tamis");
    expect(manifest.description.length).toBeLessThanOrEqual(132);
    expect(`${manifest.name} ${manifest.description}`).not.toMatch(/block|ban\b|foreign/i);
  });

  it("asks for no permission or host beyond 0.1.2", () => {
    // A new host makes Chrome disable the extension on update.
    expect(manifest.permissions).toEqual(["storage"]);
    expect(manifest.host_permissions).toEqual(["https://x.com/*", "https://twitter.com/*"]);
    expect(manifest.optional_permissions).toBeUndefined();
    expect(manifest.optional_host_permissions).toBeUndefined();
    expect(manifest.content_scripts.map((script) => script.matches)).toEqual([X_HOSTS, X_HOSTS, [PAID_PAGE]]);
  });
});

describe("manifests", () => {
  it("agree on everything except browser-specific keys", () => {
    const shared = ({ background, browser_specific_settings, minimum_chrome_version, action, ...rest }) => ({
      ...rest,
      action: { ...action, default_icon: undefined },
    });
    expect(shared(firefox)).toEqual(shared(chrome));
  });

  it("keep Firefox settings out of the Chrome manifest", () => {
    expect(chrome.browser_specific_settings).toBeUndefined();
    // content_scripts world: "MAIN" needs Chrome 111+; esbuild targets chrome120.
    expect(chrome.minimum_chrome_version).toBe("120");
  });

  it("keep the AMO add-on id and data consent", () => {
    expect(firefox.browser_specific_settings.gecko.id).toBe("x-country-block@andreasne89.github.io");
    expect(firefox.browser_specific_settings.gecko.data_collection_permissions).toEqual({ required: ["none"] });
  });
});
