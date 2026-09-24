import { describe, expect, it } from "vitest";
import { ONLY_SHOW_TRIAL_MS } from "../src/shared/license.ts";
import {
  emptySettings,
  filteringActive,
  normalizeHandle,
  parseSettings,
  SETTINGS_KEYS,
} from "../src/shared/settings.ts";

describe("parseSettings", () => {
  it("returns empty defaults for junk", () => {
    expect(parseSettings(undefined)).toEqual(emptySettings());
    expect(parseSettings(null)).toEqual({
      enabled: true,
      hiddenCountryCodes: [],
      hiddenLanguageCodes: [],
      hiddenRegionIds: [],
      allowedHandles: [],
      markOnly: false,
      filterMode: "hide",
      onlyShowPaid: false,
      trialStartedAt: null,
      onlyShowUnlocked: false,
      trialExpired: false,
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
      enabled: true,
      hiddenCountryCodes: ["IN", "US"],
      hiddenLanguageCodes: ["hi", "en"],
      hiddenRegionIds: ["SOUTH_ASIA", "ASIA"],
      allowedHandles: [],
      markOnly: false,
      filterMode: "hide",
      onlyShowPaid: false,
      trialStartedAt: null,
      onlyShowUnlocked: false,
      trialExpired: false,
    });
  });

  it("dedupes codes", () => {
    expect(parseSettings({ hiddenCountryCodes: ["in", "IN", " In "] }).hiddenCountryCodes).toEqual(["IN"]);
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

  it("ignores a stored onlyShowUnlocked flag", () => {
    expect(parseSettings({ onlyShowUnlocked: true }).onlyShowUnlocked).toBe(false);
  });

  it("defaults enabled to true and only turns off on explicit false", () => {
    expect(parseSettings({}).enabled).toBe(true);
    expect(parseSettings({ enabled: "no" }).enabled).toBe(true);
    expect(parseSettings({ enabled: false }).enabled).toBe(false);
  });

  it("normalizes allowed handles", () => {
    expect(parseSettings({ allowedHandles: ["@Jack", "jack", "bad handle", 3, "a_b_1"] }).allowedHandles).toEqual([
      "jack",
      "a_b_1",
    ]);
    expect(normalizeHandle(" @Some_User ")).toBe("some_user");
    expect(normalizeHandle("way_too_long_handle_x")).toBeNull();
  });

  it("marks an expired, unpaid trial", () => {
    const now = 1_000_000_000_000;
    const started = now - ONLY_SHOW_TRIAL_MS - 1;
    const s = parseSettings({ trialStartedAt: started }, now);
    expect(s.onlyShowUnlocked).toBe(false);
    expect(s.trialExpired).toBe(true);
    expect(parseSettings({ trialStartedAt: started, onlyShowPaid: true }, now).trialExpired).toBe(false);
    expect(parseSettings({ trialStartedAt: now - 1000 }, now).trialExpired).toBe(false);
  });

  it("lists every stored key it reads", () => {
    expect([...SETTINGS_KEYS]).toContain("enabled");
    expect([...SETTINGS_KEYS]).toContain("allowedHandles");
    expect([...SETTINGS_KEYS]).not.toContain("onlyShowUnlocked");
  });
});

describe("filteringActive", () => {
  it("is off when paused", () => {
    expect(filteringActive(parseSettings({ enabled: false, hiddenCountryCodes: ["IN"] }))).toBe(false);
  });

  it("is off when only-show is selected but locked", () => {
    const now = 1_000_000_000_000;
    const expired = parseSettings({ filterMode: "only", trialStartedAt: now - ONLY_SHOW_TRIAL_MS - 1 }, now);
    expect(filteringActive(expired)).toBe(false);
    expect(filteringActive(parseSettings({ filterMode: "only" }, now))).toBe(false);
  });

  it("is on for hide mode and unlocked only-show", () => {
    expect(filteringActive(parseSettings({}))).toBe(true);
    expect(filteringActive(parseSettings({ filterMode: "only", onlyShowPaid: true }))).toBe(true);
  });
});
