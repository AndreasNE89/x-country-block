import { describe, expect, it } from "vitest";
import {
  isNoLanguageCode,
  LANGUAGE_ALIASES,
  LANGUAGES,
  languageCodeFromName,
  languageName,
  normalizeLang,
  X_LANGUAGE_CODES,
} from "../src/shared/languages.ts";

const listed = new Set(LANGUAGES.map((row) => row.code));

describe("normalizeLang", () => {
  it("lowercases and drops region and script subtags", () => {
    expect(normalizeLang("EN")).toBe("en");
    expect(normalizeLang("zh-CN")).toBe("zh");
    expect(normalizeLang("zh-TW")).toBe("zh");
    expect(normalizeLang("zh_cn")).toBe("zh");
    expect(normalizeLang("pt-BR")).toBe("pt");
    expect(normalizeLang("hi-Latn")).toBe("hi");
    expect(normalizeLang(" en-gb ")).toBe("en");
  });

  it("maps legacy and alternative codes to the listed ones", () => {
    expect(normalizeLang("in")).toBe("id");
    expect(normalizeLang("iw")).toBe("he");
    expect(normalizeLang("ji")).toBe("yi");
    expect(normalizeLang("jw")).toBe("jv");
    expect(normalizeLang("ckb")).toBe("ku");
    expect(normalizeLang("nb")).toBe("no");
    expect(normalizeLang("nn")).toBe("no");
    expect(normalizeLang("fil")).toBe("tl");
    expect(normalizeLang("tl")).toBe("tl");
    expect(normalizeLang("msa")).toBe("ms");
  });

  it("returns null for codes that mean no language", () => {
    for (const code of ["und", "zxx", "qme", "qam", "qct", "qht", "qst", "art", "UND", "xx-lc"]) {
      expect(normalizeLang(code)).toBeNull();
      expect(isNoLanguageCode(code)).toBe(true);
    }
    expect(normalizeLang("")).toBeNull();
    expect(normalizeLang(null)).toBeNull();
    expect(normalizeLang(undefined)).toBeNull();
    expect(isNoLanguageCode(null)).toBe(false);
    expect(isNoLanguageCode("en")).toBe(false);
  });

  it("maps every code X can put on a post to a language the user can tick", () => {
    const fromX = [
      ...X_LANGUAGE_CODES,
      "in",
      "iw",
      "ckb",
      "hi-Latn",
      "zh-CN",
      "zh-TW",
      "fil",
      "msa",
      "en-gb",
      "pt-BR",
      "es-MX",
    ];
    for (const code of fromX) {
      const canonical = normalizeLang(code);
      expect(canonical, code).not.toBeNull();
      expect(listed.has(canonical!), `${code} -> ${canonical}`).toBe(true);
    }
  });

  it("keeps every listed code stable or folds it onto another listed code", () => {
    for (const row of LANGUAGES) {
      const canonical = normalizeLang(row.code);
      expect(canonical && listed.has(canonical), row.code).toBe(true);
    }
  });
});

describe("languageName", () => {
  it("names listed and X-specific codes", () => {
    expect(languageName("pt")).toBe("Portuguese");
    expect(languageName("iw")).toBe("Hebrew");
    expect(languageName("in")).toBe("Indonesian");
    expect(languageName("zh-CN")).toBe("Chinese");
    expect(languageName("ckb")).toBe("Kurdish");
    expect(languageName("chr")).toBe("Cherokee");
    expect(languageName("xyz")).toBe("xyz");
  });
});

describe("languageCodeFromName", () => {
  it("maps names shown by X to canonical codes", () => {
    expect(languageCodeFromName("Hindi")).toBe("hi");
    expect(languageCodeFromName("Indonesian")).toBe("id");
    expect(languageCodeFromName("Hebrew")).toBe("he");
    expect(languageCodeFromName("Filipino")).toBe("tl");
    expect(languageCodeFromName("Haitian Creole")).toBe("ht");
    expect(languageCodeFromName("Chinese (Simplified)")).toBe("zh");
    expect(languageCodeFromName("Norwegian Bokmål")).toBe("no");
    expect(languageCodeFromName("  english ")).toBe("en");
    expect(languageCodeFromName("Klingon")).toBeNull();
    expect(languageCodeFromName("")).toBeNull();
  });

  it("maps native names, accent-insensitively", () => {
    expect(languageCodeFromName("Español")).toBe("es");
    expect(languageCodeFromName("espanol")).toBe("es");
    expect(languageCodeFromName("Deutsch")).toBe("de");
    expect(languageCodeFromName("日本語")).toBe("ja");
    expect(languageCodeFromName("हिन्दी")).toBe("hi");
  });

  it("only aliases to listed codes", () => {
    for (const [alias, code] of Object.entries(LANGUAGE_ALIASES)) {
      expect(listed.has(code), alias).toBe(true);
    }
  });
});
