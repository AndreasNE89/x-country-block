import { describe, expect, it } from "vitest";
import { hasPicks, matchingActive, SettingsState } from "../src/content/settings-state.ts";
import { ONLY_SHOW_TRIAL_MS } from "../src/shared/license.ts";
import { parseSettings } from "../src/shared/settings.ts";

const NOW = 1_800_000_000_000;

describe("SettingsState", () => {
  it("reacts to every settings key, including enabled and allowedHandles", () => {
    const state = new SettingsState(NOW);
    state.load({ hiddenCountryCodes: ["IN"] }, NOW);
    expect(state.applyChanges({ enabled: { newValue: false } }, NOW)).toBe(true);
    expect(state.current.enabled).toBe(false);
    expect(state.applyChanges({ allowedHandles: { newValue: ["@Carol"] } }, NOW)).toBe(true);
    expect(state.current.allowedHandles).toEqual(["carol"]);
    expect(state.applyChanges({ enabled: {} }, NOW)).toBe(true);
    expect(state.current.enabled).toBe(true);
  });

  it("ignores keys that are not settings, and no-op writes", () => {
    const state = new SettingsState(NOW);
    state.load({ hiddenCountryCodes: ["IN"] }, NOW);
    expect(state.applyChanges({ userCache: { newValue: [] } }, NOW)).toBe(false);
    expect(state.applyChanges({ hiddenCountryCodes: { newValue: ["in"] } }, NOW)).toBe(false);
  });

  it("notices a trial that ends while the tab is open (F56)", () => {
    const started = NOW - ONLY_SHOW_TRIAL_MS + 60_000;
    const state = new SettingsState(NOW);
    state.load({ filterMode: "only", trialStartedAt: started, hiddenCountryCodes: ["NO"] }, NOW);
    expect(matchingActive(state.current)).toBe(true);
    expect(state.refresh(NOW + 30_000)).toBe(false);
    expect(state.refresh(NOW + 61_000)).toBe(true);
    expect(state.current.trialExpired).toBe(true);
    expect(matchingActive(state.current)).toBe(false);
  });
});

describe("matchingActive", () => {
  it("is off when paused, when nothing is ticked, or when Only show is locked", () => {
    expect(matchingActive(parseSettings({ hiddenLanguageCodes: ["pt"] }, NOW))).toBe(true);
    expect(matchingActive(parseSettings({ hiddenLanguageCodes: ["pt"], enabled: false }, NOW))).toBe(false);
    expect(matchingActive(parseSettings({}, NOW))).toBe(false);
    expect(matchingActive(parseSettings({ hiddenLanguageCodes: ["pt"], filterMode: "only" }, NOW))).toBe(false);
    expect(hasPicks(parseSettings({ hiddenRegionIds: ["EUROPE"] }, NOW))).toBe(true);
  });
});
