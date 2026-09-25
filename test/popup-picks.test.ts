import { describe, expect, it } from "vitest";
import {
  pickTotal,
  picksOf,
  sameMembers,
  selectedPicks,
  summarizeNames,
  tabLabel,
  toggleCode,
} from "../src/popup/picks.ts";
import { parseSettings } from "../src/shared/settings.ts";

describe("selectedPicks", () => {
  it("should list places first, then languages, with display names", () => {
    const settings = parseSettings({
      hiddenLanguageCodes: ["no"],
      hiddenCountryCodes: ["NO"],
      hiddenRegionIds: ["EUROPE"],
    });
    expect(selectedPicks(settings)).toEqual([
      { kind: "countries", id: "NO", label: "Norway" },
      { kind: "regions", id: "EUROPE", label: "Europe" },
      { kind: "languages", id: "no", label: "Norwegian" },
    ]);
    expect(pickTotal(settings)).toBe(3);
    expect(picksOf(settings, "languages")).toEqual(["no"]);
  });

  it("should be empty when nothing is ticked", () => {
    expect(selectedPicks(parseSettings({}))).toEqual([]);
  });
});

describe("summarizeNames", () => {
  it("should show at most three names, then +N more", () => {
    expect(summarizeNames([])).toBe("");
    expect(summarizeNames(["Japanese"])).toBe("Japanese");
    expect(summarizeNames(["A", "B", "C"])).toBe("A, B, C");
    expect(summarizeNames(["A", "B", "C", "D", "E"])).toBe("A, B, C +2 more");
  });
});

describe("toggleCode", () => {
  it("should add once and remove every copy", () => {
    expect(toggleCode(["NO"], "SE", true)).toEqual(["NO", "SE"]);
    expect(toggleCode(["NO", "SE"], "SE", true)).toEqual(["NO", "SE"]);
    expect(toggleCode(["NO", "SE"], "NO", false)).toEqual(["SE"]);
    expect(toggleCode([], "NO", false)).toEqual([]);
  });

  it("should compare lists by members", () => {
    expect(sameMembers(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameMembers(["a"], ["a", "b"])).toBe(false);
  });
});

describe("tabLabel", () => {
  it("should add the ticked count", () => {
    expect(tabLabel("languages", 2)).toBe("Languages · 2");
    expect(tabLabel("countries", 0)).toBe("Countries");
    expect(tabLabel("regions", 1)).toBe("Regions · 1");
  });
});
