import { describe, expect, it } from "vitest";
import { catalogRows, pickLabel } from "../src/popup/catalog.ts";
import { visibleOptionRows } from "../src/popup/option-rows.ts";
import { foldSearch, matchRank } from "../src/popup/search.ts";
import { X_LANGUAGE_CODES } from "../src/shared/languages.ts";

function ids(kind: "languages" | "countries" | "regions", query: string, selected: string[] = []): string[] {
  return visibleOptionRows(catalogRows(kind), selected, query).map((row) => row.id);
}

describe("foldSearch", () => {
  it("should strip accents instead of dropping the letter", () => {
    expect(foldSearch("Türkiye")).toBe("turkiye");
    expect(foldSearch("Côte d'Ivoire")).toBe("cote d ivoire");
    expect(foldSearch("Curaçao")).toBe("curacao");
    expect(foldSearch("  Español ")).toBe("espanol");
    expect(foldSearch("Bokmål")).toBe("bokmal");
    expect(foldSearch("Ørsted Æble Straße")).toBe("orsted aeble strasse");
  });
});

describe("country search", () => {
  it("should find countries by common aliases", () => {
    expect(ids("countries", "usa")[0]).toBe("US");
    expect(ids("countries", "america")[0]).toBe("US");
    expect(ids("countries", "britain")[0]).toBe("GB");
    expect(ids("countries", "england")[0]).toBe("GB");
    expect(ids("countries", "turkey")[0]).toBe("TR");
    expect(ids("countries", "holland")[0]).toBe("NL");
    expect(ids("countries", "burma")[0]).toBe("MM");
    expect(ids("countries", "uae")[0]).toBe("AE");
    expect(ids("countries", "ivory coast")[0]).toBe("CI");
  });

  it("should rank the United Kingdom above Ukraine for 'uk'", () => {
    const shown = ids("countries", "uk");
    expect(shown[0]).toBe("GB");
    expect(shown).toContain("UA");
  });

  it("should rank an exact ISO code first", () => {
    expect(ids("countries", "us")[0]).toBe("US");
    expect(ids("countries", "IN")[0]).toBe("IN");
    expect(ids("countries", "deu")[0]).toBe("DE");
  });

  it("should ignore accents in names", () => {
    expect(ids("countries", "cote")).toEqual(["CI"]);
    expect(ids("countries", "turkiye")[0]).toBe("TR");
    expect(ids("countries", "curacao")).toEqual(["CW"]);
    expect(ids("countries", "Türk")[0]).toBe("TR");
  });

  it("should find nothing for nonsense", () => {
    expect(ids("countries", "zzzz")).toEqual([]);
  });
});

describe("region search", () => {
  it("should find regions by their other names", () => {
    expect(ids("regions", "middle east")).toEqual(["MIDDLE_EAST", "WEST_ASIA"]);
    expect(ids("regions", "latin america")).toEqual(["LATIN_AMERICA"]);
    expect(ids("regions", "latam")).toEqual(["LATIN_AMERICA"]);
    expect(ids("regions", "eur")[0]).toBe("EUROPE");
  });
});

describe("language search", () => {
  it("should find languages by name, code and common other names", () => {
    expect(ids("languages", "ja")[0]).toBe("ja");
    expect(ids("languages", "japanese")).toEqual(["ja"]);
    expect(ids("languages", "farsi")).toEqual(["fa"]);
    expect(ids("languages", "mandarin")).toEqual(["zh"]);
    expect(ids("languages", "deutsch")).toEqual(["de"]);
    expect(ids("languages", "español")).toEqual(["es"]);
    expect(ids("languages", "filipino")).toEqual(["tl"]);
    expect(ids("languages", "bokmal")).toEqual(["no"]);
    expect(ids("languages", "nynorsk")).toEqual(["no"]);
  });

  it("should show one Norwegian row, since X tags all Norwegian as no", () => {
    expect(ids("languages", "norsk")).toEqual(["no"]);
    expect(ids("languages", "nb")).toEqual([]);
  });
});

describe("matchRank", () => {
  const row = { id: "US", label: "United States", code: "US", codes: ["us", "usa"], keys: ["united states", "america"] };

  it("should rank exact, word-start and inner matches", () => {
    expect(matchRank(row, "usa")).toBe(0);
    expect(matchRank(row, "united states")).toBe(0);
    expect(matchRank(row, "sta")).toBe(1);
    expect(matchRank(row, "ates")).toBe(2);
    expect(matchRank(row, "xyz")).toBeNull();
  });

  it("should not match codes by inner substring", () => {
    expect(matchRank({ ...row, keys: [] }, "s")).toBeNull();
    expect(matchRank({ ...row, keys: [] }, "u")).toBe(1);
  });
});

describe("catalog", () => {
  it("should keep names verbatim and show the code separately", () => {
    const india = catalogRows("countries").find((row) => row.id === "IN");
    expect(india?.label).toBe("India");
    expect(india?.code).toBe("IN");
    const pt = catalogRows("languages").find((row) => row.id === "pt");
    expect(pt?.label).toBe("Portuguese");
    expect(pt?.code).toBe("pt");
  });

  it("should label picks by kind", () => {
    expect(pickLabel("countries", "NO")).toBe("Norway");
    expect(pickLabel("languages", "nb")).toBe("Norwegian Bokmål");
    expect(pickLabel("regions", "WEST_ASIA")).toBe("West Asia");
    expect(pickLabel("countries", "ZZ")).toBe("ZZ");
  });
});

describe("language rows", () => {
  it("should list only languages X tags posts with", () => {
    const codes = catalogRows("languages").map((row) => row.id);
    expect(codes).toContain("ja");
    expect(codes).toContain("no");
    expect(codes).not.toContain("ab");
    expect(codes).not.toContain("nb");
    expect(codes.length).toBe(X_LANGUAGE_CODES.size);
  });
});
