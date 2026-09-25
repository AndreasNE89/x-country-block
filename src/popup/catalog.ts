import { COUNTRY_ALIASES, COUNTRY_ISO3, COUNTRY_NAMES } from "../shared/countries.ts";
import { LANGUAGES, languageName } from "../shared/languages.ts";
import { REGIONS, regionName } from "../shared/regions.ts";
import { foldSearch, type SearchRow } from "./search.ts";

/** Popup tabs, in display order. */
export type PickKind = "languages" | "countries" | "regions";

export const PICK_KINDS: readonly PickKind[] = ["languages", "countries", "regions"];

// Other names people type for a language: endonyms written in Latin script and common synonyms.
const LANGUAGE_ALIASES: Record<string, string[]> = {
  de: ["deutsch"],
  da: ["dansk"],
  es: ["espanol", "castellano"],
  fa: ["farsi"],
  fi: ["suomi"],
  fr: ["francais"],
  id: ["bahasa indonesia"],
  it: ["italiano"],
  ms: ["bahasa melayu"],
  nb: ["norsk", "bokmal"],
  nl: ["nederlands", "flemish"],
  nn: ["norsk", "nynorsk"],
  no: ["norsk"],
  pa: ["panjabi"],
  pl: ["polski"],
  ps: ["pushto"],
  pt: ["portugues"],
  sv: ["svenska"],
  tl: ["filipino", "pilipino"],
  tr: ["turkce"],
  zh: ["mandarin", "cantonese", "putonghua"],
};

const REGION_ALIASES: Record<string, string[]> = {
  AMERICAS: ["latam"],
};

function uniqueFolded(values: string[]): string[] {
  return [...new Set(values.map(foldSearch).filter(Boolean))];
}

function countryRows(): SearchRow[] {
  const iso3ByIso2 = new Map<string, string[]>();
  for (const [iso3, iso2] of Object.entries(COUNTRY_ISO3)) {
    iso3ByIso2.set(iso2, [...(iso3ByIso2.get(iso2) ?? []), iso3]);
  }
  const aliasesByIso2 = new Map<string, string[]>();
  for (const [alias, iso2] of Object.entries(COUNTRY_ALIASES)) {
    aliasesByIso2.set(iso2, [...(aliasesByIso2.get(iso2) ?? []), alias]);
  }
  return Object.entries(COUNTRY_NAMES).map(([id, name]) => ({
    id,
    label: name,
    code: id,
    codes: uniqueFolded([id, ...(iso3ByIso2.get(id) ?? [])]),
    keys: uniqueFolded([name, ...(aliasesByIso2.get(id) ?? [])]),
  }));
}

function regionRows(): SearchRow[] {
  return REGIONS.map((region) => ({
    id: region.id,
    label: region.name,
    code: "",
    codes: [],
    keys: uniqueFolded([region.name, ...region.phrases, ...(REGION_ALIASES[region.id] ?? [])]),
  }));
}

function languageRows(): SearchRow[] {
  return LANGUAGES.map((row) => ({
    id: row.code,
    label: row.name,
    code: row.code,
    codes: uniqueFolded([row.code]),
    keys: uniqueFolded([row.name, ...(LANGUAGE_ALIASES[row.code] ?? [])]),
  }));
}

const cache = new Map<PickKind, readonly SearchRow[]>();

export function catalogRows(kind: PickKind): readonly SearchRow[] {
  let rows = cache.get(kind);
  if (!rows) {
    switch (kind) {
      case "languages":
        rows = languageRows();
        break;
      case "countries":
        rows = countryRows();
        break;
      case "regions":
        rows = regionRows();
        break;
      default: {
        const _never: never = kind;
        return _never;
      }
    }
    cache.set(kind, rows);
  }
  return rows;
}

export function pickLabel(kind: PickKind, id: string): string {
  switch (kind) {
    case "languages":
      return languageName(id);
    case "countries":
      return COUNTRY_NAMES[id] ?? id;
    case "regions":
      return regionName(id);
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}
