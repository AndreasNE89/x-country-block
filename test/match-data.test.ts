import { describe, expect, it } from "vitest";
import {
  buildCountryIndex,
  COUNTRY_ALIASES,
  COUNTRY_ISO3,
  COUNTRY_NAMES,
  MAJOR_CITIES,
} from "../src/shared/countries.ts";
import { foldText } from "../src/shared/normalize.ts";
import {
  AMBIGUOUS_PLACES,
  CITY_ALT_COUNTRIES,
  CITY_TO_COUNTRY,
  countriesForSubdivisionCode,
  SUBDIVISION_NAMES,
  UPPERCASE_PLACE_CODES,
} from "../src/shared/places.ts";

// Countries and territories with more than about a million people (Singapore and
// Macao are cities themselves).
const OVER_A_MILLION = [
  "AF", "AM", "AZ", "BH", "BD", "KH", "CN", "CY", "GE", "HK", "IN", "ID", "IR", "IQ", "IL",
  "JP", "JO", "KZ", "KW", "KG", "LA", "LB", "MY", "MN", "MM", "NP", "KP", "OM", "PK", "PS",
  "PH", "QA", "SA", "KR", "LK", "SY", "TW", "TJ", "TH", "TL", "TR", "TM", "AE", "UZ", "VN",
  "YE", "DZ", "AO", "BJ", "BW", "BF", "BI", "CM", "CF", "TD", "CD", "CG", "CI", "DJ", "EG",
  "GQ", "ER", "SZ", "ET", "GA", "GM", "GN", "GW", "LS", "LR", "LY", "MG", "MW", "ML", "MR",
  "MU", "MA", "MZ", "NA", "NE", "NG", "RW", "SN", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG",
  "TN", "UG", "ZM", "ZW", "AL", "AT", "BY", "BE", "BA", "BG", "HR", "CZ", "DK", "EE", "FI",
  "FR", "DE", "GR", "HU", "IE", "IT", "XK", "LV", "LT", "MD", "NL", "MK", "NO", "PL", "PT",
  "RO", "RU", "RS", "SK", "SI", "ES", "SE", "CH", "UA", "GB", "AR", "BO", "BR", "CA", "CL",
  "CO", "CR", "CU", "DO", "EC", "SV", "GT", "HT", "HN", "JM", "MX", "NI", "PA", "PY", "PE",
  "PR", "TT", "US", "UY", "VE", "AU", "NZ", "PG",
];

const countryByFoldedName = new Map(
  Object.entries(COUNTRY_NAMES).map(([code, name]) => [foldText(name), code]),
);

describe("place tables", () => {
  it("lists at least one city for every country above a million people", () => {
    const withCity = new Set(Object.values(CITY_TO_COUNTRY));
    const missing = OVER_A_MILLION.filter((code) => !withCity.has(code));
    expect(missing).toEqual([]);
  });

  it("only points at known countries", () => {
    const tables: Record<string, string>[] = [
      COUNTRY_ALIASES,
      COUNTRY_ISO3,
      MAJOR_CITIES,
      CITY_TO_COUNTRY,
      SUBDIVISION_NAMES,
      UPPERCASE_PLACE_CODES,
    ];
    for (const table of tables) {
      for (const [key, code] of Object.entries(table)) {
        expect(code in COUNTRY_NAMES, `${key} -> ${code}`).toBe(true);
      }
    }
    for (const [key, codes] of Object.entries(CITY_ALT_COUNTRIES)) {
      for (const code of codes) expect(code in COUNTRY_NAMES, `${key} -> ${code}`).toBe(true);
    }
    for (const [key, place] of Object.entries(AMBIGUOUS_PLACES)) {
      for (const code of place.countries) expect(code in COUNTRY_NAMES, `${key} -> ${code}`).toBe(true);
    }
  });

  it("never lets an alias, city or state name mean a different country than its name", () => {
    const tables: Record<string, string>[] = [COUNTRY_ALIASES, CITY_TO_COUNTRY, SUBDIVISION_NAMES];
    for (const table of tables) {
      for (const [key, code] of Object.entries(table)) {
        const named = countryByFoldedName.get(foldText(key));
        if (named) expect(named, key).toBe(code);
      }
    }
  });

  it("only lists alternate countries for cities it knows", () => {
    const cities = new Set(Object.keys(CITY_TO_COUNTRY).map(foldText));
    for (const key of Object.keys(CITY_ALT_COUNTRIES)) expect(cities.has(foldText(key)), key).toBe(true);
  });

  it("keeps the subdivision code tables", () => {
    expect(countriesForSubdivisionCode("WA")).toEqual(["US", "AU"]);
    expect(countriesForSubdivisionCode("ON")).toEqual(["CA"]);
    expect(countriesForSubdivisionCode("ZZ")).toEqual([]);
  });
});

describe("buildCountryIndex", () => {
  const index = buildCountryIndex();

  it("folds every country name, alias and city", () => {
    for (const name of Object.values(COUNTRY_NAMES)) expect(index.names.has(foldText(name)), name).toBe(true);
    expect(index.names.get("turkiye")).toBe("TR");
    expect(index.names.get("cote d ivoire")).toBe("CI");
    expect(index.names.get("deutschland")).toBe("DE");
    expect(index.names.get("भारत")).toBe("IN");
    expect(index.names.get("uk")).toBe("GB");
    expect(index.names.get("usa")).toBe("US");
    expect(index.cities.get("sao paulo")).toBe("BR");
    expect(index.cities.get("東京")).toBe("JP");
  });

  it("keeps country names ahead of same-named places", () => {
    expect(index.names.get("georgia")).toBe("GE");
    expect(index.names.get("jersey")).toBe("JE");
    expect(index.names.get("republic of china")).toBe("TW");
  });

  it("does not index ordinary short words", () => {
    for (const word of ["us", "in", "me", "it", "no", "to", "at", "is", "la", "de", "st", "or", "ok"]) {
      expect(index.names.has(word), word).toBe(false);
      expect(index.cities.has(word), word).toBe(false);
    }
  });

  it("covers Kosovo", () => {
    expect(COUNTRY_NAMES.XK).toBe("Kosovo");
    expect(index.names.get("kosovo")).toBe("XK");
  });
});
