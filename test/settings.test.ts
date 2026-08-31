import { describe, expect, it } from "vitest";
import { emptySettings, parseSettings } from "../src/shared/settings.ts";

describe("parseSettings", () => {
  it("returns empty defaults for junk", () => {
    expect(parseSettings(undefined)).toEqual(emptySettings());
    expect(parseSettings(null)).toEqual({
      hiddenCountryCodes: [],
      hiddenLanguageCodes: [],
      hiddenRegionIds: [],
      markOnly: false,
      filterMode: "hide",
      onlyShowPaid: false,
      trialStartedAt: null,
      onlyShowUnlocked: false,
    });
    expect(parseSettings({ hiddenCountryCodes: "IN" })).toEqual(emptySettings());
  });

  it("keeps valid ISO-looking codes", () => {
    expect(
      parseSettings({
        hiddenCountryCodes: ["IN", "us", 1, ""],
        hiddenLanguageCodes: ["hi", "EN"],
        hiddenRegionIds: ["south-asia", "ASIA", "nope"],
      }),
    ).toEqual({
      hiddenCountryCodes: ["IN", "US"],
      hiddenLanguageCodes: ["hi", "en"],
      hiddenRegionIds: ["SOUTH_ASIA", "ASIA"],
      markOnly: false,
      filterMode: "hide",
      onlyShowPaid: false,
      trialStartedAt: null,
      onlyShowUnlocked: false,
    });
  });

  it("keeps markOnly true when set", () => {
    expect(parseSettings({ markOnly: true }).markOnly).toBe(true);
    expect(parseSettings({}).markOnly).toBe(false);
  });

  it("should parse only-show filter mode", () => {
    expect(parseSettings({ filterMode: "only" }).filterMode).toBe("only");
    expect(parseSettings({ filterMode: "nope" }).filterMode).toBe("hide");
  });

  it("should unlock only-show from a paid license", () => {
    expect(parseSettings({ onlyShowPaid: true }).onlyShowUnlocked).toBe(true);
    expect(parseSettings({ onlyShowPaid: false, trialStartedAt: Date.now() }).onlyShowUnlocked).toBe(
      true,
    );
  });
});
