import { describe, expect, it } from "vitest";
import { emptySettings, parseSettings } from "../src/shared/settings.ts";

describe("parseSettings", () => {
  it("returns empty defaults for junk", () => {
    expect(parseSettings(undefined)).toEqual(emptySettings());
    expect(parseSettings(null)).toEqual({ hiddenCountryCodes: [], hiddenLanguageCodes: [] });
    expect(parseSettings({ hiddenCountryCodes: "IN" })).toEqual(emptySettings());
  });

  it("keeps valid ISO-looking codes", () => {
    expect(
      parseSettings({
        hiddenCountryCodes: ["IN", "us", 1, ""],
        hiddenLanguageCodes: ["hi", "EN"],
      }),
    ).toEqual({
      hiddenCountryCodes: ["IN", "US"],
      hiddenLanguageCodes: ["hi", "en"],
    });
  });
});
