import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildCountryIndex, defaultCountryIndex } from "../src/shared/countries.ts";
import { countriesFromLocation, countryFromBasedIn } from "../src/shared/match.ts";

const real = defaultCountryIndex();

const cases = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/locations.json"), "utf8"),
) as [string, string[]][];

function parse(text: string): string[] {
  return [...countriesFromLocation(text, real)].sort();
}

describe("real-world profile locations", () => {
  it("has a large corpus with no duplicates", () => {
    expect(cases.length).toBeGreaterThanOrEqual(250);
    expect(new Set(cases.map(([text]) => text)).size).toBe(cases.length);
  });

  it.each(cases)("%s", (text, expected) => {
    expect(parse(text)).toEqual([...expected].sort());
  });
});

describe("countriesFromLocation", () => {
  it("ignores ordinary words that look like codes (F04)", () => {
    for (const text of [
      "In the clouds",
      "in my head",
      "Living in the moment",
      "follow me",
      "it is what it is",
      "no DMs",
      "To the moon",
      "Living at home",
      "IN GOD WE TRUST",
      "Follow ME",
      "EST. 1999",
      "www.site.de",
      "https://example.in",
    ]) {
      expect(parse(text), text).toEqual([]);
    }
    expect(parse("BORN AND RAISED IN TEXAS")).toEqual(["US"]);
    expect(parse("In NYC")).toEqual(["US"]);
  });

  it("counts a two-letter code only in capitals and where a place goes", () => {
    expect(parse("from US")).toEqual(["US"]);
    expect(parse("from us")).toEqual([]);
    expect(parse("Houston TX")).toEqual(["US"]);
    expect(parse("Houston tx")).toEqual(["US"]);
    expect(parse("Lagos, NG")).toEqual(["NG"]);
    expect(parse("Lagos, ng")).toEqual(["NG"]);
    expect(parse("Somewhere, ng")).toEqual([]);
  });

  it("never reads St or St. as São Tomé", () => {
    expect(parse("St. Petersburg, Russia")).toEqual(["RU"]);
    expect(parse("St Kitts & Nevis")).toEqual(["KN"]);
    expect(parse("St. Louis")).toEqual(["US"]);
  });

  it("reads a colliding code by the city before it (F05)", () => {
    expect(parse("Jaipur, IN")).toEqual(["IN"]);
    expect(parse("Indianapolis, IN")).toEqual(["US"]);
    expect(parse("Munich, DE")).toEqual(["DE"]);
    expect(parse("Wilmington, DE")).toEqual(["US"]);
    expect(parse("Haifa, IL")).toEqual(["IL"]);
    expect(parse("Tirana, AL")).toEqual(["AL"]);
    expect(parse("Perth, WA")).toEqual(["AU"]);
    expect(parse("Seattle, WA")).toEqual(["US"]);
    expect(parse("Utrecht, NL")).toEqual(["NL"]);
    expect(parse("Dammam, SA")).toEqual(["SA"]);
    expect(parse("Adelaide, SA")).toEqual(["AU"]);
    expect(parse("Durban, SA")).toEqual(["ZA"]);
    expect(parse("Mumbai, MH")).toEqual(["IN"]);
    expect(parse("Chennai, TN")).toEqual(["IN"]);
  });

  it("reads a city before a US state code as the US town of that name", () => {
    expect(parse("Venice, CA")).toEqual(["US"]);
    expect(parse("Oxford, MS")).toEqual(["US"]);
    expect(parse("Warsaw, IN")).toEqual(["US"]);
    expect(parse("Delhi, LA")).toEqual(["US"]);
    expect(parse("Milan, MI")).toEqual(["US"]);
    expect(parse("Vienna, VA, USA")).toEqual(["US"]);
    expect(parse("Oxford, Georgia")).toEqual(["US"]);
  });

  it("reads a country or state name before a state code as a US town", () => {
    expect(parse("Lebanon, PA")).toEqual(["US"]);
    expect(parse("Mexico, MO")).toEqual(["US"]);
    expect(parse("Poland, OH")).toEqual(["US"]);
    expect(parse("India, MH")).toEqual(["IN"]);
    expect(parse("Canada, BC")).toEqual(["CA"]);
  });

  it("still reads a state code of the city's own country by the city", () => {
    expect(parse("Chennai, TN")).toEqual(["IN"]);
    expect(parse("Panaji, GA")).toEqual(["IN"]);
    expect(parse("Belém, PA")).toEqual(["BR"]);
    expect(parse("Tijuana, B.C.")).toEqual(["MX"]);
    expect(parse("La Paz, BCS")).toEqual(["MX"]);
    expect(parse("Palermo (PA)")).toEqual(["IT"]);
    expect(parse("Milano, MI")).toEqual(["IT"]);
    // Alone or after an unknown place, such a code keeps its usual reading.
    expect(parse("Somewhere, BC")).toEqual(["CA"]);
    expect(parse("KA")).toEqual([]);
  });

  it("drops a city abbreviation that disagrees with the place before it", () => {
    expect(parse("Kochi, KL")).toEqual(["IN"]);
    expect(parse("Petaling Jaya, KL")).toEqual(["MY"]);
    expect(parse("KL")).toEqual(["MY"]);
  });

  it("counts acronym and slang codes only right after a known city", () => {
    for (const text of [
      "Tired AF",
      "NA",
      "EU/NA",
      "AI/ML",
      "Coffee, code, AI",
      "Engineer, QA",
      "Founder, VC",
      "ETH",
      "BTC | ETH",
      "GEO",
      "KEN",
    ]) {
      expect(parse(text), text).toEqual([]);
    }
    expect(parse("Texas AF")).toEqual(["US"]);
    expect(parse("Kabul AF")).toEqual(["AF"]);
    expect(parse("Windhoek, NA")).toEqual(["NA"]);
    expect(parse("Doha, QA")).toEqual(["QA"]);
  });

  it("uses the documented default for an unknown city before a colliding code", () => {
    // US "City, ST" is the common form; a few codes lean to the country or stay open.
    expect(parse("Carmel, IN")).toEqual(["US"]);
    expect(parse("Somewhere, CA")).toEqual(["US"]);
    expect(parse("Somewhere, NL")).toEqual(["NL"]);
    expect(parse("Somewhere, DE")).toEqual([]);
    expect(parse("Somewhere, SA")).toEqual([]);
    expect(parse("Springfield, IL, USA")).toEqual(["US"]);
  });

  it("leaves a bare colliding code undecided, except LA", () => {
    expect(parse("MA")).toEqual([]);
    expect(parse("IN")).toEqual([]);
    expect(parse("CA")).toEqual([]);
    expect(parse("LA")).toEqual(["US"]);
    expect(parse("TX")).toEqual(["US"]);
    expect(parse("FR")).toEqual(["FR"]);
    expect(parse("IT")).toEqual([]);
  });

  it("keeps every place in a multi-location text (F19)", () => {
    expect(parse("Lagos, Nigeria. Follow me")).toEqual(["NG"]);
    expect(parse("India | DM me")).toEqual(["IN"]);
    expect(parse("London / LA")).toEqual(["GB", "US"]);
    expect(parse("Berlin & LA")).toEqual(["DE", "US"]);
    expect(parse("Karachi, Pakistan | Dallas, TX")).toEqual(["PK", "US"]);
    expect(parse("London, UK / Toronto, ON")).toEqual(["CA", "GB"]);
    expect(countriesFromLocation("Lagos, Nigeria, London, UK", real)).toEqual(["NG", "GB"]);
  });

  it("does not re-read words inside a matched phrase (F21)", () => {
    expect(parse("Rio de Janeiro")).toEqual(["BR"]);
    expect(parse("Dar es Salaam")).toEqual(["TZ"]);
    expect(parse("Frankfurt am Main")).toEqual(["DE"]);
    expect(parse("Port of Spain")).toEqual(["TT"]);
    expect(parse("La Paz, Bolivia")).toEqual(["BO"]);
    expect(parse("Santiago de Chile")).toEqual(["CL"]);
  });

  it("lets a state or country after a city decide which city is meant (F21)", () => {
    expect(parse("Paris, Texas")).toEqual(["US"]);
    expect(parse("Moscow, Idaho")).toEqual(["US"]);
    expect(parse("London, Ontario")).toEqual(["CA"]);
    expect(parse("Perth, Scotland")).toEqual(["GB"]);
    expect(parse("Sydney, Nova Scotia")).toEqual(["CA"]);
    expect(parse("Hyderabad, Sindh, Pakistan")).toEqual(["PK"]);
    expect(parse("Birmingham, Alabama")).toEqual(["US"]);
  });

  it("reads Georgia by context", () => {
    expect(parse("Atlanta, Georgia")).toEqual(["US"]);
    expect(parse("Tbilisi, Georgia")).toEqual(["GE"]);
    expect(parse("Macon, Georgia")).toEqual(["US"]);
    expect(parse("Georgia")).toEqual([]);
    expect(parse("South Georgia")).toEqual(["US"]);
    expect(parse("South Georgia and the South Sandwich Islands")).toEqual(["GS"]);
    expect(countryFromBasedIn("Georgia", real)).toBe("GE");
  });

  it("tells similar names apart", () => {
    expect(parse("Indiana")).toEqual(["US"]);
    expect(parse("New Mexico")).toEqual(["US"]);
    expect(parse("New Jersey")).toEqual(["US"]);
    expect(parse("Dominica")).toEqual(["DM"]);
    expect(parse("Dominican Republic")).toEqual(["DO"]);
    expect(parse("Niger")).toEqual(["NE"]);
    expect(parse("Nigeria")).toEqual(["NG"]);
    expect(parse("Port Harcourt, Niger Delta")).toEqual(["NG"]);
    expect(parse("Jersey")).toEqual(["JE"]);
    expect(parse("South Jersey")).toEqual(["US"]);
    expect(parse("Sudan")).toEqual(["SD"]);
    expect(parse("South Sudan")).toEqual(["SS"]);
  });

  it("reads America region names as regions, never the US (F22)", () => {
    for (const text of ["South America", "Latin America", "Central America", "North America"]) {
      expect(parse(text), text).toEqual([]);
    }
    expect(parse("Lima, Peru, South America")).toEqual(["PE"]);
    expect(parse("America")).toEqual(["US"]);
  });

  it("folds accents instead of splitting words (F20)", () => {
    expect(parse("Montréal")).toEqual(["CA"]);
    expect(parse("Ciudad de México")).toEqual(["MX"]);
    expect(parse("Việt Nam")).toEqual(["VN"]);
    expect(parse("Curaçao")).toEqual(["CW"]);
    expect(parse("Cote d'Ivoire")).toEqual(["CI"]);
  });

  it("reads flags, native names and exonyms (F25)", () => {
    expect(parse("🇮🇳")).toEqual(["IN"]);
    expect(parse("भारत")).toEqual(["IN"]);
    expect(parse("日本東京")).toEqual(["JP"]);
    expect(parse("Deutschland")).toEqual(["DE"]);
    expect(parse("Estados Unidos")).toEqual(["US"]);
  });

  it("uses flags only when the words name no place", () => {
    expect(parse("NYC 🇺🇦")).toEqual(["US"]);
    expect(parse("Proud 🇺🇸 patriot")).toEqual(["US"]);
  });

  it("does not read heritage words as a place (F58)", () => {
    expect(parse("Asian American, NYC")).toEqual(["US"]);
    expect(parse("Indian-American")).toEqual([]);
    expect(parse("Nigerian in London")).toEqual(["GB"]);
  });

  it("works with a small hand-built index", () => {
    const tiny = {
      names: new Map([
        ["nigeria", "NG"],
        ["japan", "JP"],
      ]),
      iso3: new Map([["nga", "NG"]]),
      cities: new Map([["lagos", "NG"]]),
    };
    expect(countriesFromLocation("Lagos / Japan", tiny)).toEqual(["NG", "JP"]);
    expect(countriesFromLocation("NGA", tiny)).toEqual(["NG"]);
    expect(countriesFromLocation("from NG", tiny)).toEqual(["NG"]);
  });

  it("parses 20k locations quickly (F27)", () => {
    const index = buildCountryIndex();
    const started = performance.now();
    for (let i = 0; i < 20_000; i += 1) {
      countriesFromLocation(`${cases[i % cases.length]![0]} ${i}`, index);
    }
    expect(performance.now() - started).toBeLessThan(1500);
  });
});
