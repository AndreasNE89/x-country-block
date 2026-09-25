import { foldText } from "../shared/normalize.ts";

/** One pickable row with everything search can match on. */
export type SearchRow = {
  id: string;
  /** Display name, kept verbatim. */
  label: string;
  /** Display code shown on the right ("IN", "pt"); empty for regions. */
  code: string;
  /** Folded codes (ISO2, ISO3, language code): exact or prefix matches only. */
  codes: string[];
  /** Folded names and aliases: exact, word-start or inner matches. */
  keys: string[];
};

// Letters NFD does not split into base + mark.
const LETTER_FOLDS: Record<string, string> = {
  ø: "o",
  æ: "ae",
  œ: "oe",
  ß: "ss",
  ł: "l",
  đ: "d",
  ð: "d",
  þ: "th",
  ı: "i",
};

/** foldText with accents removed first, so "Côte" becomes "cote" instead of "c te". */
export function foldSearch(text: string): string {
  const stripped = text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[øæœßłđðþı]/g, (ch) => LETTER_FOLDS[ch] ?? ch);
  return foldText(stripped);
}

/**
 * 0 = exact code, name or alias; 1 = a code or word starts with the query;
 * 2 = the query is inside a name; null = no match. `query` must be folded.
 */
export function matchRank(row: SearchRow, query: string): number | null {
  if (!query) return 0;
  if (row.codes.includes(query) || row.keys.includes(query)) return 0;
  if (row.codes.some((code) => code.startsWith(query))) return 1;
  if (row.keys.some((key) => ` ${key}`.includes(` ${query}`))) return 1;
  if (row.keys.some((key) => key.includes(query))) return 2;
  return null;
}
