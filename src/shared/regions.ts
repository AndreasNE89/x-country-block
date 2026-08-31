import { COUNTRY_NAMES } from "./countries.ts";
import { foldText } from "./normalize.ts";

export type RegionDef = {
  id: string;
  name: string;
  parent: string | null;
  phrases: string[];
  countries: string[];
};

function existing(codes: string[]): string[] {
  return codes.filter((code) => code in COUNTRY_NAMES);
}

export const REGIONS: RegionDef[] = [
  {
    id: "ASIA",
    name: "Asia",
    parent: null,
    phrases: ["asia", "asian"],
    countries: [],
  },
  {
    id: "SOUTH_ASIA",
    name: "South Asia",
    parent: "ASIA",
    phrases: ["south asia", "southern asia", "south asian", "indian subcontinent"],
    countries: existing(["AF", "BD", "BT", "IN", "IR", "LK", "MV", "NP", "PK"]),
  },
  {
    id: "WEST_ASIA",
    name: "West Asia",
    parent: "ASIA",
    phrases: ["west asia", "western asia", "west asian", "middle east", "near east", "middle eastern"],
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
    phrases: [
      "southeast asia",
      "south east asia",
      "south eastern asia",
      "southeastern asia",
      "southeast asian",
    ],
    countries: existing(["BN", "ID", "KH", "LA", "MM", "MY", "PH", "SG", "TH", "TL", "VN"]),
  },
  {
    id: "EAST_ASIA",
    name: "East Asia",
    parent: "ASIA",
    phrases: ["east asia", "eastern asia", "east asian"],
    countries: existing(["CN", "HK", "JP", "KP", "KR", "MO", "MN", "TW"]),
  },
  {
    id: "CENTRAL_ASIA",
    name: "Central Asia",
    parent: "ASIA",
    phrases: ["central asia", "central asian"],
    countries: existing(["KG", "KZ", "TJ", "TM", "UZ"]),
  },
  {
    id: "AFRICA",
    name: "Africa",
    parent: null,
    phrases: ["africa", "african"],
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
      "DZ",
      "EG",
      "EH",
      "ER",
      "ET",
      "GA",
      "GH",
      "GM",
      "GN",
      "GQ",
      "GW",
      "KE",
      "KM",
      "LR",
      "LS",
      "LY",
      "MA",
      "MG",
      "ML",
      "MR",
      "MU",
      "MW",
      "MZ",
      "NA",
      "NE",
      "NG",
      "RW",
      "SC",
      "SD",
      "SL",
      "SN",
      "SO",
      "SS",
      "ST",
      "SZ",
      "TD",
      "TG",
      "TN",
      "TZ",
      "UG",
      "ZA",
      "ZM",
      "ZW",
    ]),
  },
  {
    id: "EUROPE",
    name: "Europe",
    parent: null,
    phrases: ["europe", "european"],
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
    ]),
  },
  {
    id: "AMERICAS",
    name: "Americas",
    parent: null,
    phrases: ["americas", "latin america", "south america", "north america", "central america"],
    countries: existing([
      "AG",
      "AI",
      "AR",
      "AW",
      "BB",
      "BL",
      "BM",
      "BO",
      "BQ",
      "BR",
      "BS",
      "BZ",
      "CA",
      "CL",
      "CO",
      "CR",
      "CU",
      "CW",
      "DM",
      "DO",
      "EC",
      "FK",
      "GD",
      "GF",
      "GL",
      "GP",
      "GT",
      "GY",
      "HN",
      "HT",
      "JM",
      "KN",
      "KY",
      "LC",
      "MF",
      "MQ",
      "MS",
      "MX",
      "NI",
      "PA",
      "PE",
      "PM",
      "PR",
      "PY",
      "SR",
      "SV",
      "SX",
      "TC",
      "TT",
      "US",
      "UY",
      "VC",
      "VE",
      "VG",
      "VI",
    ]),
  },
  {
    id: "OCEANIA",
    name: "Oceania",
    parent: null,
    phrases: ["oceania", "pacific islands"],
    countries: existing([
      "AS",
      "AU",
      "CK",
      "FJ",
      "FM",
      "GU",
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
];

export const REGION_IDS = new Set(REGIONS.map((region) => region.id));

export function regionName(id: string): string {
  return REGIONS.find((region) => region.id === id)?.name ?? id;
}

const parentById = new Map(REGIONS.map((region) => [region.id, region.parent]));

const countryLeaves = new Map<string, string[]>();
for (const region of REGIONS) {
  for (const code of region.countries) {
    const list = countryLeaves.get(code) ?? [];
    list.push(region.id);
    countryLeaves.set(code, list);
  }
}

export function regionsForCountry(iso2: string): string[] {
  const leaves = countryLeaves.get(iso2) ?? [];
  const hits = new Set(leaves);
  for (const leaf of leaves) {
    const parent = parentById.get(leaf);
    if (parent) hits.add(parent);
  }
  return [...hits];
}

function hasPhrase(haystack: string, phrase: string): boolean {
  return (` ${haystack} `).includes(` ${phrase} `);
}

function hasEastAsiaPhrase(folded: string): boolean {
  const padded = ` ${folded} `;
  if (padded.includes(" east asia ") && !padded.includes(" south east asia ")) return true;
  if (padded.includes(" eastern asia ") && !padded.includes(" south eastern asia ")) return true;
  if (padded.includes(" east asian ") && !padded.includes(" south east asian ")) return true;
  return false;
}

export function regionsFromLocation(text: string): string[] {
  const folded = foldText(text);
  if (!folded) return [];
  const hits = new Set<string>();
  for (const region of REGIONS) {
    if (region.id === "EAST_ASIA") {
      if (hasEastAsiaPhrase(folded)) hits.add(region.id);
      continue;
    }
    for (const phrase of region.phrases) {
      if (hasPhrase(folded, foldText(phrase))) hits.add(region.id);
    }
  }
  for (const id of [...hits]) {
    const parent = parentById.get(id);
    if (parent) hits.add(parent);
  }
  return [...hits];
}
