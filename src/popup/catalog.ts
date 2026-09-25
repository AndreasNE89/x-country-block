import { COUNTRY_ALIASES, COUNTRY_ISO3, COUNTRY_NAMES } from "../shared/countries.ts";
import { LANGUAGE_ALIASES, LANGUAGES, languageName, normalizeLang, X_LANGUAGE_CODES } from "../shared/languages.ts";
import { REGIONS, regionName } from "../shared/regions.ts";
import { foldSearch, type SearchRow } from "./search.ts";

/** Popup tabs, in display order. */
export type PickKind = "languages" | "countries" | "regions";

export const PICK_KINDS: readonly PickKind[] = ["languages", "countries", "regions"];

// Search-only names the shared table does not list yet. Same shape as LANGUAGE_ALIASES;
// once shared/languages.ts has them, these lines can go.
const EXTRA_LANGUAGE_ALIASES: Record<string, string> = {
  castellano: "es",
  putonghua: "zh",
};

// Extra search words not already in REGIONS[].phrases.
const REGION_ALIASES: Record<string, string[]> = {};

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

// Only languages X actually tags posts with: a pick X never emits could never match.
// Older picks outside this list still show as removable chips in the tray.
// Search keys come from the matcher's own alias table, so the popup finds every name it understands.
function languageRows(): SearchRow[] {
  const aliasesByCode = new Map<string, string[]>();
  for (const [alias, code] of Object.entries({ ...EXTRA_LANGUAGE_ALIASES, ...LANGUAGE_ALIASES })) {
    const target = normalizeLang(code) ?? code;
    aliasesByCode.set(target, [...(aliasesByCode.get(target) ?? []), alias]);
  }
  return LANGUAGES.filter((row) => X_LANGUAGE_CODES.has(row.code)).map((row) => ({
    id: row.code,
    label: row.name,
    code: row.code,
    codes: uniqueFolded([row.code]),
    keys: uniqueFolded([row.name, ...(aliasesByCode.get(row.code) ?? [])]),
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
