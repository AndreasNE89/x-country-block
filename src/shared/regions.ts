import { COUNTRY_NAMES } from "./countries.ts";
import { foldText } from "./normalize.ts";

export type RegionDef = {
  id: string;
  name: string;
  parent: string | null;
  /** Place nouns only. Adjectives ("asian", "african") describe heritage, not location. */
  phrases: string[];
  /** Filled from the child regions when left empty. */
  countries: string[];
};

function existing(codes: string[]): string[] {
  return codes.filter((code) => code in COUNTRY_NAMES);
}

// Ids are stored in users' settings: never rename or remove one, only add.
// Leaf lists follow UN M49; a country may sit in several regions (Cyprus: West Asia,
// Europe, EU; Egypt: North Africa, Middle East).
export const REGIONS: RegionDef[] = [
  {
    id: "ASIA",
    name: "Asia",
    parent: null,
    phrases: ["asia"],
    countries: [],
  },
  {
    id: "SOUTH_ASIA",
    name: "South Asia",
    parent: "ASIA",
    phrases: ["south asia", "southern asia", "indian subcontinent"],
    countries: existing(["AF", "BD", "BT", "IN", "IR", "LK", "MV", "NP", "PK"]),
  },
  {
    id: "WEST_ASIA",
    name: "West Asia",
    parent: "ASIA",
    phrases: ["west asia", "western asia", "middle east", "near east", "mideast"],
    countries: existing([
      "AE",
      "AM",
      "AZ",
      "BH",
      "CY",
      "GE",
      "IL",
      "IQ",
      "JO",
      "KW",
      "LB",
      "OM",
      "PS",
      "QA",
      "SA",
      "SY",
      "TR",
      "YE",
    ]),
  },
  {
    id: "SOUTHEAST_ASIA",
    name: "Southeast Asia",
    parent: "ASIA",
    phrases: ["southeast asia", "south east asia", "south eastern asia", "southeastern asia"],
    countries: existing(["BN", "ID", "KH", "LA", "MM", "MY", "PH", "SG", "TH", "TL", "VN"]),
  },
  {
    id: "EAST_ASIA",
    name: "East Asia",
    parent: "ASIA",
    phrases: ["east asia", "eastern asia", "far east"],
    countries: existing(["CN", "HK", "JP", "KP", "KR", "MO", "MN", "TW"]),
  },
  {
    id: "CENTRAL_ASIA",
    name: "Central Asia",
    parent: "ASIA",
    phrases: ["central asia"],
    countries: existing(["KG", "KZ", "TJ", "TM", "UZ"]),
  },
  {
    id: "MIDDLE_EAST",
    name: "Middle East",
    parent: null,
    phrases: ["middle east", "near east", "mideast"],
    countries: existing([
      "AE",
      "BH",
      "EG",
      "IL",
      "IQ",
      "IR",
      "JO",
      "KW",
      "LB",
      "OM",
      "PS",
      "QA",
      "SA",
      "SY",
      "TR",
      "YE",
    ]),
  },
  {
    id: "AFRICA",
    name: "Africa",
    parent: null,
    phrases: ["africa"],
    countries: [],
  },
  {
    id: "NORTH_AFRICA",
    name: "North Africa",
    parent: "AFRICA",
    phrases: ["north africa", "northern africa", "maghreb"],
    countries: existing(["DZ", "EG", "EH", "LY", "MA", "SD", "TN"]),
  },
  {
    id: "SUB_SAHARAN_AFRICA",
    name: "Sub-Saharan Africa",
    parent: "AFRICA",
    phrases: [
      "sub saharan africa",
      "subsaharan africa",
      "west africa",
      "western africa",
      "east africa",
      "eastern africa",
      "central africa",
      "middle africa",
      "southern africa",
      "horn of africa",
    ],
    countries: existing([
      "AO",
      "BF",
      "BI",
      "BJ",
      "BW",
      "CD",
      "CF",
      "CG",
      "CI",
      "CM",
      "CV",
      "DJ",
      "ER",
      "ET",
      "GA",
      "GH",
      "GM",
      "GN",
      "GQ",
      "GW",
      "IO",
      "KE",
      "KM",
      "LR",
      "LS",
      "MG",
      "ML",
      "MR",
      "MU",
      "MW",
      "MZ",
      "NA",
      "NE",
      "NG",
      "RE",
      "RW",
      "SC",
      "SH",
      "SL",
      "SN",
      "SO",
      "SS",
      "ST",
      "SZ",
      "TD",
      "TF",
      "TG",
      "TZ",
      "UG",
      "YT",
      "ZA",
      "ZM",
      "ZW",
    ]),
  },
  {
    id: "EUROPE",
    name: "Europe",
    parent: null,
    phrases: ["europe"],
    countries: existing([
      "AD",
      "AL",
      "AT",
      "AX",
      "BA",
      "BE",
      "BG",
      "BY",
      "CH",
      "CY",
      "CZ",
      "DE",
      "DK",
      "EE",
      "ES",
      "FI",
      "FO",
      "FR",
      "GB",
      "GG",
      "GI",
      "GR",
      "HR",
      "HU",
      "IE",
      "IM",
      "IS",
      "IT",
      "JE",
      "LI",
      "LT",
      "LU",
      "LV",
      "MC",
      "MD",
      "ME",
      "MK",
      "MT",
      "NL",
      "NO",
      "PL",
      "PT",
      "RO",
      "RS",
      "RU",
      "SE",
      "SI",
      "SJ",
      "SK",
      "SM",
      "UA",
      "VA",
      "XK",
    ]),
  },
  {
    id: "EU",
    name: "European Union",
    parent: null,
    phrases: ["european union"],
    countries: existing([
      "AT",
      "BE",
      "BG",
      "CY",
      "CZ",
      "DE",
      "DK",
      "EE",
      "ES",
      "FI",
      "FR",
      "GR",
      "HR",
      "HU",
      "IE",
      "IT",
      "LT",
      "LU",
      "LV",
      "MT",
      "NL",
      "PL",
      "PT",
      "RO",
      "SE",
      "SI",
      "SK",
    ]),
  },
  {
    id: "AMERICAS",
    name: "Americas",
    parent: null,
    phrases: ["americas", "the americas"],
    countries: [],
  },
  {
    id: "NORTH_AMERICA",
    name: "North America",
    parent: "AMERICAS",
    phrases: ["north america", "northern america"],
    countries: existing(["BM", "CA", "GL", "PM", "US"]),
  },
  {
    id: "LATIN_AMERICA",
    name: "Latin America & Caribbean",
    parent: "AMERICAS",
    phrases: [
      "latin america",
      "latam",
      "latinoamerica",
      "america latina",
      "latin america and caribbean",
      "latin america and the caribbean",
    ],
    countries: [],
  },
  {
    id: "CARIBBEAN",
    name: "Caribbean",
    parent: "LATIN_AMERICA",
    phrases: ["caribbean", "the caribbean", "west indies"],
    countries: existing([
      "AG",
      "AI",
      "AW",
      "BB",
      "BL",
      "BQ",
      "BS",
      "CU",
      "CW",
      "DM",
      "DO",
      "GD",
      "GP",
      "HT",
      "JM",
      "KN",
      "KY",
      "LC",
      "MF",
      "MQ",
      "MS",
      "PR",
      "SX",
      "TC",
      "TT",
      "VC",
      "VG",
      "VI",
    ]),
  },
  {
    id: "CENTRAL_AMERICA",
    name: "Central America",
    parent: "LATIN_AMERICA",
    phrases: ["central america", "centroamerica", "mesoamerica"],
    countries: existing(["BZ", "CR", "GT", "HN", "MX", "NI", "PA", "SV"]),
  },
  {
    id: "SOUTH_AMERICA",
    name: "South America",
    parent: "LATIN_AMERICA",
    phrases: ["south america", "sudamerica", "suramerica", "america del sur", "america do sul"],
    countries: existing([
      "AR",
      "BO",
      "BR",
      "BV",
      "CL",
      "CO",
      "EC",
      "FK",
      "GF",
      "GS",
      "GY",
      "PE",
      "PY",
      "SR",
      "UY",
      "VE",
    ]),
  },
  {
    id: "OCEANIA",
    name: "Oceania",
    parent: null,
    phrases: ["oceania", "pacific islands", "australasia", "south pacific"],
    countries: existing([
      "AS",
      "AU",
      "CC",
      "CK",
      "CX",
      "FJ",
      "FM",
      "GU",
      "HM",
      "KI",
      "MH",
      "MP",
      "NC",
      "NF",
      "NR",
      "NU",
      "NZ",
      "PF",
      "PG",
      "PN",
      "PW",
      "SB",
      "TK",
      "TO",
      "TV",
      "UM",
      "VU",
      "WF",
      "WS",
    ]),
  },
  {
    id: "ANTARCTICA",
    name: "Antarctica",
    parent: null,
    phrases: ["antarctica"],
    countries: existing(["AQ"]),
  },
];

/**
 * Labels that join several regions ("Europe & Central Asia", "East Asia & Pacific").
 * They are consumed so their parts are not read as one region, and they name no
 * single region: the account could be in any of the parts.
 */
const COMBINED_LABELS = [
  "europe and central asia",
  "east asia and pacific",
  "east asia and the pacific",
  "middle east and north africa",
  "asia pacific",
  "apac",
  "emea",
  "mena",
];

const regionById = new Map(REGIONS.map((region) => [region.id, region]));

function fillFromChildren(region: RegionDef): string[] {
  if (region.countries.length > 0) return region.countries;
  const codes = REGIONS.filter((row) => row.parent === region.id).flatMap(fillFromChildren);
  region.countries = existing([...new Set(codes)]);
  return region.countries;
}
for (const region of REGIONS) fillFromChildren(region);

export const REGION_IDS = new Set(REGIONS.map((region) => region.id));

export function regionName(id: string): string {
  return regionById.get(id)?.name ?? id;
}

function withAncestors(ids: Iterable<string>): string[] {
  const hits = new Set<string>();
  for (const start of ids) {
    let id: string | null | undefined = start;
    while (id && !hits.has(id)) {
      hits.add(id);
      id = regionById.get(id)?.parent;
    }
  }
  return [...hits];
}

const regionsByCountry = new Map<string, string[]>();
{
  const leaves = new Map<string, string[]>();
  for (const region of REGIONS) {
    if (REGIONS.some((row) => row.parent === region.id)) continue;
    for (const code of region.countries) {
      leaves.set(code, [...(leaves.get(code) ?? []), region.id]);
    }
  }
  for (const [code, ids] of leaves) regionsByCountry.set(code, withAncestors(ids));
}

/** Every region a country belongs to, including parents (India -> South Asia, Asia). */
export function regionsForCountry(iso2: string): string[] {
  return [...(regionsByCountry.get(iso2) ?? [])];
}

/** Folded region phrase -> region ids. Combined labels map to an empty list. */
export const REGION_PHRASES: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const region of REGIONS) {
    for (const phrase of region.phrases) {
      const key = foldText(phrase);
      map.set(key, [...(map.get(key) ?? []), region.id]);
    }
  }
  for (const label of COMBINED_LABELS) map.set(foldText(label), []);
  return map;
})();

const MAX_PHRASE_TOKENS = Math.max(...[...REGION_PHRASES.keys()].map((key) => key.split(" ").length));
const EU_FLAG = "\u{1F1EA}\u{1F1FA}";
const CACHE_LIMIT = 2000;
const cache = new Map<string, string[]>();

/** Regions named in free text, with parents ("West Africa" -> Sub-Saharan Africa, Africa). */
export function regionsFromLocation(text: string): string[] {
  const hit = cache.get(text);
  if (hit) return [...hit];
  const found = parseRegions(text);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(text, found);
  return [...found];
}

function parseRegions(text: string): string[] {
  const ids: string[] = text.includes(EU_FLAG) ? ["EU", "EUROPE"] : [];
  const folded = foldText(text);
  if (folded) {
    const tokens = folded.split(" ");
    let i = 0;
    while (i < tokens.length) {
      let matched = 0;
      for (let len = Math.min(MAX_PHRASE_TOKENS, tokens.length - i); len > 0; len -= 1) {
        const regions = REGION_PHRASES.get(tokens.slice(i, i + len).join(" "));
        if (!regions) continue;
        ids.push(...regions);
        matched = len;
        break;
      }
      i += matched || 1;
    }
  }
  return withAncestors(ids);
}
