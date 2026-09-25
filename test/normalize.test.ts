import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  collapseDottedInitials,
  expandCompassInitials,
  flagCountryCodes,
  foldText,
  stripFlags,
} from "../src/shared/normalize.ts";

describe("foldText", () => {
  it("lowercases and strips punctuation", () => {
    expect(foldText("  Lagos, Nigeria! ")).toBe("lagos nigeria");
  });

  it("folds accents instead of deleting the letter", () => {
    expect(foldText("Montréal")).toBe("montreal");
    expect(foldText("São Paulo")).toBe("sao paulo");
    expect(foldText("México")).toBe("mexico");
    expect(foldText("Türkiye")).toBe("turkiye");
    expect(foldText("Côte d'Ivoire")).toBe("cote d ivoire");
    expect(foldText("Việt Nam")).toBe("viet nam");
    expect(foldText("Curaçao")).toBe("curacao");
    expect(foldText("Zürich")).toBe("zurich");
    expect(foldText("Kraków")).toBe("krakow");
  });

  it("maps letters that Unicode does not decompose", () => {
    expect(foldText("Łódź")).toBe("lodz");
    expect(foldText("Straße")).toBe("strasse");
    expect(foldText("Tromsø")).toBe("tromso");
    expect(foldText("Færøerne")).toBe("faeroerne");
    expect(foldText("Diyarbakır")).toBe("diyarbakir");
  });

  it("keeps non-Latin letters as tokens", () => {
    expect(foldText("भारत")).toBe("भारत");
    expect(foldText("日本")).toBe("日本");
    expect(foldText("Россия")).toBe("россия");
    expect(foldText("대한민국")).toBe("대한민국");
    expect(foldText("ประเทศไทย")).toBe("ประเทศไทย");
    expect(foldText("Ελλάδα")).toBe("ελλαδα");
  });

  it("folds Arabic alef forms and strips harakat", () => {
    expect(foldText("الإمارات")).toBe(foldText("الامارات"));
    expect(foldText("مِصْر")).toBe("مصر");
    expect(foldText("مـصـر")).toBe("مصر");
  });

  it("strips Hebrew points and keeps Indic vowel signs", () => {
    expect(foldText("יִשְׂרָאֵל")).toBe("ישראל");
    expect(foldText("मुंबई")).toBe("मुंबई");
  });

  it("is written without invisible characters in its source", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../src/shared/normalize.ts"),
      "utf8",
    );
    // Combining marks, format characters (tag letters) and unassigned code points.
    expect(source).not.toMatch(/[\p{M}\p{Cf}\p{Cn}]/u);
  });

  it("maps & to and and collapses dotted initials", () => {
    expect(foldText("Trinidad & Tobago")).toBe("trinidad and tobago");
    expect(foldText("U.S.A.")).toBe("usa");
    expect(foldText("U.K.")).toBe("uk");
    expect(foldText("Washington, D.C.")).toBe("washington dc");
  });

  it("reads fancy Unicode letters as plain ones", () => {
    expect(foldText("𝐍𝐞𝐰 𝐘𝐨𝐫𝐤")).toBe("new york");
    expect(foldText("ＵＳＡ")).toBe("usa");
  });

  it("returns an empty string for emoji-only text", () => {
    expect(foldText("🌍✨")).toBe("");
  });
});

describe("collapseDottedInitials", () => {
  it("removes the dots and keeps the case unless asked", () => {
    expect(collapseDottedInitials("U.S.A. and D.C.")).toBe("USA and DC");
    expect(collapseDottedInitials("u.s.a.")).toBe("usa");
    expect(collapseDottedInitials("u.s.a.", true)).toBe("USA");
    expect(collapseDottedInitials("St. Louis")).toBe("St. Louis");
  });
});

describe("expandCompassInitials", () => {
  it("spells out a compass initial before a capitalised name", () => {
    expect(expandCompassInitials("N. Korea")).toBe("North Korea");
    expect(expandCompassInitials("S Africa")).toBe("South Africa");
    expect(expandCompassInitials("SE Asia")).toBe("Southeast Asia");
    expect(expandCompassInitials("C. America")).toBe("Central America");
    expect(expandCompassInitials("Seoul, S.Korea")).toBe("Seoul, South Korea");
  });

  it("leaves other single letters alone", () => {
    expect(expandCompassInitials("LET'S GO")).toBe("LET'S GO");
    expect(expandCompassInitials("U.S. Navy")).toBe("U.S. Navy");
    expect(expandCompassInitials("Lincoln, NE")).toBe("Lincoln, NE");
    expect(expandCompassInitials("s korea")).toBe("s korea");
  });
});

describe("flagCountryCodes", () => {
  it("reads flag emoji as ISO codes in order", () => {
    expect(flagCountryCodes("🇮🇳")).toEqual(["IN"]);
    expect(flagCountryCodes("NYC 🇺🇸🇮🇳")).toEqual(["US", "IN"]);
    expect(flagCountryCodes("🇳🇬 🇳🇬")).toEqual(["NG"]);
  });

  it("reads the England, Scotland and Wales flags as GB", () => {
    expect(flagCountryCodes("🏴󠁧󠁢󠁥󠁮󠁧󠁿")).toEqual(["GB"]);
    expect(flagCountryCodes("🏴󠁧󠁢󠁳󠁣󠁴󠁿")).toEqual(["GB"]);
    expect(flagCountryCodes("🏴󠁧󠁢󠁷󠁬󠁳󠁿")).toEqual(["GB"]);
  });

  it("ignores other emoji", () => {
    expect(flagCountryCodes("🌍✨🏳️‍🌈")).toEqual([]);
  });
});

describe("stripFlags", () => {
  it("removes flags and keeps the words", () => {
    expect(stripFlags("Lagos 🇳🇬").trim()).toBe("Lagos");
    expect(stripFlags("🏴󠁧󠁢󠁳󠁣󠁴󠁿 Glasgow").trim()).toBe("Glasgow");
  });
});
