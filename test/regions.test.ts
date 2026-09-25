import { describe, expect, it } from "vitest";
import { COUNTRY_NAMES } from "../src/shared/countries.ts";
import {
  REGION_IDS,
  REGIONS,
  regionName,
  regionsForCountry,
  regionsFromLocation,
} from "../src/shared/regions.ts";

function sorted(values: string[]): string[] {
  return [...values].sort();
}

describe("REGIONS data", () => {
  it("keeps every region id users may have stored", () => {
    for (const id of [
      "ASIA",
      "SOUTH_ASIA",
      "WEST_ASIA",
      "SOUTHEAST_ASIA",
      "EAST_ASIA",
      "CENTRAL_ASIA",
      "AFRICA",
      "EUROPE",
      "AMERICAS",
      "OCEANIA",
    ]) {
      expect(REGION_IDS.has(id), id).toBe(true);
    }
  });

  it("puts every country in at least one region", () => {
    const missing = Object.keys(COUNTRY_NAMES).filter((code) => regionsForCountry(code).length === 0);
    expect(missing).toEqual([]);
  });

  it("only lists known countries, has parents that exist, and no empty regions", () => {
    for (const region of REGIONS) {
      expect(region.countries.length, region.id).toBeGreaterThan(0);
      for (const code of region.countries) expect(code in COUNTRY_NAMES, `${region.id} ${code}`).toBe(true);
      if (region.parent) expect(REGION_IDS.has(region.parent), region.id).toBe(true);
    }
    expect(new Set(REGIONS.map((row) => row.name)).size).toBe(REGIONS.length);
  });

  it("keeps the old Africa and Americas coverage", () => {
    const africa = new Set(REGIONS.find((row) => row.id === "AFRICA")!.countries);
    for (const code of ["NG", "EG", "MA", "ZA", "KE", "ET", "SD", "SS", "TN", "DZ", "LY", "EH"]) {
      expect(africa.has(code), code).toBe(true);
    }
    const americas = new Set(REGIONS.find((row) => row.id === "AMERICAS")!.countries);
    for (const code of ["US", "CA", "MX", "BR", "AR", "JM", "PR", "CU", "GL", "BM"]) {
      expect(americas.has(code), code).toBe(true);
    }
  });
});

describe("regionsForCountry", () => {
  it("includes parents", () => {
    expect(sorted(regionsForCountry("IN"))).toEqual(["ASIA", "SOUTH_ASIA"]);
    expect(sorted(regionsForCountry("NG"))).toEqual(["AFRICA", "SUB_SAHARAN_AFRICA"]);
    expect(sorted(regionsForCountry("BR"))).toEqual(["AMERICAS", "LATIN_AMERICA", "SOUTH_AMERICA"]);
  });

  it("puts Cyprus in Europe and Kosovo in Europe", () => {
    expect(regionsForCountry("CY")).toEqual(expect.arrayContaining(["EUROPE", "EU", "WEST_ASIA"]));
    expect(regionsForCountry("XK")).toContain("EUROPE");
  });

  it("puts Iran, Egypt and Türkiye in the Middle East", () => {
    for (const code of ["IR", "EG", "TR", "SA", "IL"]) {
      expect(regionsForCountry(code), code).toContain("MIDDLE_EAST");
    }
    expect(regionsForCountry("EG")).toContain("NORTH_AFRICA");
    expect(regionsForCountry("IR")).toContain("SOUTH_ASIA");
  });

  it("separates North America from Latin America", () => {
    expect(regionsForCountry("US")).toContain("NORTH_AMERICA");
    expect(regionsForCountry("US")).not.toContain("LATIN_AMERICA");
    expect(regionsForCountry("CA")).toContain("NORTH_AMERICA");
    expect(regionsForCountry("MX")).toEqual(
      expect.arrayContaining(["CENTRAL_AMERICA", "LATIN_AMERICA", "AMERICAS"]),
    );
    expect(regionsForCountry("JM")).toContain("CARIBBEAN");
  });

  it("covers the territories that had no region", () => {
    for (const code of ["RE", "YT", "SH", "IO", "TF"]) expect(regionsForCountry(code), code).toContain("AFRICA");
    for (const code of ["CC", "CX", "HM"]) expect(regionsForCountry(code), code).toContain("OCEANIA");
    for (const code of ["BV", "GS"]) expect(regionsForCountry(code), code).toContain("SOUTH_AMERICA");
    expect(regionsForCountry("AQ")).toEqual(["ANTARCTICA"]);
  });

  it("returns an empty list for unknown codes", () => {
    expect(regionsForCountry("ZZ")).toEqual([]);
  });
});

describe("regionsFromLocation", () => {
  it("reads region nouns with their parents", () => {
    expect(sorted(regionsFromLocation("South America"))).toEqual([
      "AMERICAS",
      "LATIN_AMERICA",
      "SOUTH_AMERICA",
    ]);
    expect(sorted(regionsFromLocation("North America"))).toEqual(["AMERICAS", "NORTH_AMERICA"]);
    expect(sorted(regionsFromLocation("Latin America & Caribbean"))).toEqual([
      "AMERICAS",
      "LATIN_AMERICA",
    ]);
    expect(sorted(regionsFromLocation("Caribbean"))).toEqual([
      "AMERICAS",
      "CARIBBEAN",
      "LATIN_AMERICA",
    ]);
    expect(sorted(regionsFromLocation("West Africa"))).toEqual(["AFRICA", "SUB_SAHARAN_AFRICA"]);
    expect(sorted(regionsFromLocation("Middle East"))).toEqual(["ASIA", "MIDDLE_EAST", "WEST_ASIA"]);
    expect(sorted(regionsFromLocation("Europe"))).toEqual(["EUROPE"]);
    expect(regionsFromLocation("Asia")).toEqual(["ASIA"]);
  });

  it("prefers the longest phrase", () => {
    expect(sorted(regionsFromLocation("South East Asia"))).toEqual(["ASIA", "SOUTHEAST_ASIA"]);
    expect(sorted(regionsFromLocation("Southern Africa"))).toEqual(["AFRICA", "SUB_SAHARAN_AFRICA"]);
  });

  it("reads compass initials before a region name", () => {
    expect(sorted(regionsFromLocation("SE Asia"))).toEqual(["ASIA", "SOUTHEAST_ASIA"]);
    expect(sorted(regionsFromLocation("S. Asia"))).toEqual(["ASIA", "SOUTH_ASIA"]);
    expect(sorted(regionsFromLocation("W. Africa"))).toEqual(["AFRICA", "SUB_SAHARAN_AFRICA"]);
    expect(sorted(regionsFromLocation("S. America"))).toEqual(["AMERICAS", "LATIN_AMERICA", "SOUTH_AMERICA"]);
    expect(sorted(regionsFromLocation("C. America"))).toEqual([
      "AMERICAS",
      "CENTRAL_AMERICA",
      "LATIN_AMERICA",
    ]);
  });

  it("does not read heritage adjectives as places", () => {
    expect(regionsFromLocation("Asian American, NYC")).toEqual([]);
    expect(regionsFromLocation("African American")).toEqual([]);
    expect(regionsFromLocation("Proud African | Houston")).toEqual([]);
    expect(regionsFromLocation("European in Tokyo")).toEqual([]);
    expect(regionsFromLocation("South Asian diaspora")).toEqual([]);
    expect(regionsFromLocation("Middle Eastern food lover")).toEqual([]);
  });

  it("does not split combined labels into one of their parts", () => {
    expect(regionsFromLocation("Europe & Central Asia")).toEqual([]);
    expect(regionsFromLocation("East Asia & Pacific")).toEqual([]);
    expect(regionsFromLocation("Middle East & North Africa")).toEqual([]);
  });

  it("reads the EU flag", () => {
    expect(sorted(regionsFromLocation("🇪🇺"))).toEqual(["EU", "EUROPE"]);
  });

  it("returns nothing for blank or unrelated text", () => {
    expect(regionsFromLocation("")).toEqual([]);
    expect(regionsFromLocation("Earth")).toEqual([]);
  });
});

describe("regionName", () => {
  it("names regions and falls back to the id", () => {
    expect(regionName("LATIN_AMERICA")).toBe("Latin America & Caribbean");
    expect(regionName("NOPE")).toBe("NOPE");
  });
});
