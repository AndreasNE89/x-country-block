import { COUNTRY_NAMES } from "./countries.ts";
import { isNoLanguageCode, languageName, normalizeLang } from "./languages.ts";
import { collapseDottedInitials, flagCountryCodes, foldText, stripFlags } from "./normalize.ts";
import {
  AMBIGUOUS_PLACES,
  CITY_ALT_COUNTRIES,
  countriesForSubdivisionCode,
  SUBDIVISION_NAMES,
  UPPERCASE_PLACE_CODES,
} from "./places.ts";
import {
  REGION_PHRASES,
  REGIONS,
  regionName,
  regionsForCountry,
  regionsFromLocation,
} from "./regions.ts";
import type { CountryIndex, FilterMode, Settings, TweetRecord, UserRecord } from "./types.ts";

const NOT_IN_PICKS = "Not in your Focus picks";

/** Short list of the ticked items: "Japan, Norway +3". */
export function allowListLabel(settings: Settings, max = 2): string {
  const bits = [
    ...settings.hiddenCountryCodes.map((code) => COUNTRY_NAMES[code] ?? code),
    ...settings.hiddenRegionIds.map((id) => regionName(id)),
    ...settings.hiddenLanguageCodes.map((code) => languageName(code)),
  ];
  if (bits.length === 0) return "your Focus picks";
  const shown = bits.slice(0, max).join(", ");
  return bits.length > max ? `${shown} +${bits.length - max}` : shown;
}

export function effectiveFilterMode(settings: Settings): FilterMode {
  if (settings.filterMode === "only" && settings.onlyShowUnlocked) return "only";
  return "hide";
}

export type MatchDecision = {
  /** Why the post matches a pick, in plain words; null when it does not. */
  hit: string | null;
  /** Something about the post or author was known (so no hit means "not a match"). */
  decided: boolean;
  /** X tagged the post itself as having no language (photo, link, emoji or mentions only). */
  noLanguage?: boolean;
};

export function actionReason(decision: MatchDecision, settings: Settings): string | null {
  if (hideListsEmpty(settings)) return null;
  const mode = effectiveFilterMode(settings);
  switch (mode) {
    case "hide":
      return decision.hit;
    case "only":
      return focusReason(decision, settings);
    default: {
      const _never: never = mode;
      return _never;
    }
  }
}

/**
 * Focus mode ("Only show") keeps proven matches and sets everything else aside:
 * - a match for any pick keeps the post;
 * - something is known but none of it matches: set aside;
 * - nothing is known: set aside too (the store listing promises this), with a
 *   reason that says what was missing;
 * - except a post X tags as having no language (photo, link, emoji) when only
 *   languages are ticked: the language pick has nothing to judge, so it stays.
 */
function focusReason(decision: MatchDecision, settings: Settings): string | null {
  if (decision.hit) return null;
  if (decision.decided) return NOT_IN_PICKS;
  const geoPicked = geoPicks(settings);
  const langPicked = settings.hiddenLanguageCodes.length > 0;
  if (decision.noLanguage && !geoPicked) return null;
  const unknown =
    geoPicked && langPicked ? "location and language" : geoPicked ? "location" : "language";
  return `${NOT_IN_PICKS} (${unknown} unknown)`;
}

// ---------------------------------------------------------------------------
// Location parsing
// ---------------------------------------------------------------------------

type EntryKind = "country" | "subdivision" | "city" | "ambiguous" | "region";

type Entry = {
  kind: EntryKind;
  /** Possible countries, most likely first. Empty for region phrases. */
  countries: string[];
  /** Ambiguous names: reading with no context, and right after an unknown place. */
  alone?: string | null;
  afterPlace?: string | null;
  /** Only when written with a capital letter ("Chad", not "chad"). */
  capitalOnly?: boolean;
};

type Derived = {
  phrases: Map<string, Entry>;
  /** First token -> longest phrase (in tokens) starting with it. */
  maxTokens: Map<string, number>;
  iso2: Set<string>;
  /** Upper-case ISO3 -> ISO2. */
  iso3: Map<string, string>;
  /** Names in scripts written without spaces (日本, กรุงเทพ), longest first. */
  scriptNames: [string, Entry][];
  cache: Map<string, string[]>;
};

const CAPITAL_ONLY = new Set(["chad"]);
const NO_SPACE_SCRIPT = new RegExp(
  `[${["Han", "Hiragana", "Katakana", "Thai", "Lao", "Khmer", "Myanmar", "Hangul"]
    .map((script) => `\\p{Script=${script}}`)
    .join("")}]`,
  "u",
);
const CACHE_LIMIT = 5000;
const derivedByIndex = new WeakMap<CountryIndex, Derived>();

function derive(index: CountryIndex): Derived {
  const known = derivedByIndex.get(index);
  if (known) return known;
  const phrases = new Map<string, Entry>();
  const subdivisions = new Set(Object.keys(SUBDIVISION_NAMES).map(foldText));
  const ambiguous = new Map(Object.entries(AMBIGUOUS_PLACES).map(([name, v]) => [foldText(name), v]));
  const alts = new Map(Object.entries(CITY_ALT_COUNTRIES).map(([name, v]) => [foldText(name), v]));

  // Lowest priority first: region phrases only consume their words ("Latin America"
  // must not leave "america" for the US alias), then cities, then names.
  for (const key of REGION_PHRASES.keys()) phrases.set(key, { kind: "region", countries: [] });
  for (const [key, code] of index.cities) {
    phrases.set(key, { kind: "city", countries: [code, ...(alts.get(key) ?? [])] });
  }
  for (const [key, code] of index.names) {
    const amb = ambiguous.get(key);
    const entry: Entry = amb
      ? { kind: "ambiguous", countries: amb.countries, alone: amb.alone, afterPlace: amb.afterPlace }
      : { kind: subdivisions.has(key) ? "subdivision" : "country", countries: [code] };
    if (CAPITAL_ONLY.has(key)) entry.capitalOnly = true;
    phrases.set(key, entry);
  }
  // Hashtag spellings: #NewYork, #SouthAfrica.
  for (const [key, entry] of [...phrases]) {
    if (entry.kind === "region" || entry.kind === "ambiguous") continue;
    const parts = key.split(" ");
    const joined = parts.join("");
    if (parts.length >= 2 && parts.length <= 3 && joined.length >= 7 && !phrases.has(joined)) {
      phrases.set(joined, entry);
    }
  }

  const maxTokens = new Map<string, number>();
  const scriptNames: [string, Entry][] = [];
  for (const [key, entry] of phrases) {
    const parts = key.split(" ");
    const first = parts[0]!;
    maxTokens.set(first, Math.max(maxTokens.get(first) ?? 0, parts.length));
    if (NO_SPACE_SCRIPT.test(key) && parts.length === 1) scriptNames.push([key, entry]);
  }
  scriptNames.sort((a, b) => b[0].length - a[0].length);

  const iso3 = new Map<string, string>();
  for (const [code, iso2] of index.iso3) iso3.set(code.toUpperCase(), iso2);

  const derived: Derived = {
    phrases,
    maxTokens,
    iso2: new Set([...index.names.values(), ...index.cities.values()]),
    iso3,
    scriptNames,
    cache: new Map(),
  };
  derivedByIndex.set(index, derived);
  return derived;
}

type Token = {
  text: string;
  /** Written in capitals ("IN", "USA"), at least two letters. */
  upper: boolean;
  capital: boolean;
  /** Comma-separated part within the group. */
  level: number;
};

type Item = {
  kind: EntryKind | "code";
  countries: string[];
  start: number;
  end: number;
  level: number;
  segment: number;
  /** Words come before it in the same segment. */
  hasPrefix: boolean;
  /** Starts a comma part that follows another part: "Macon, Georgia". */
  afterComma: boolean;
  entry?: Entry;
  code?: string;
  /** Set by a neighbour: the country it resolves to, or null to drop it. */
  pinned?: string | null;
};

// Separators between independent locations ("London | Lagos", "Paris / LA").
const GROUP_SEPARATOR =
  /[|/\\·•;\n\r+→>~]+|\.(?=\s|$)|\s[-–—]+\s|[–—]|\p{Extended_Pictographic}+/u;
// Separators between the levels of one location ("Austin, Texas, USA").
const LEVEL_SEPARATOR = /[,()[\]{}:]+/;
const WORD_SEPARATOR = /[^\p{L}\p{N}\p{M}]+/u;
// Words that join separate places inside one part ("Berlin & LA", "Lagos to London").
const LIST_WORDS = new Set(["and", "or", "to", "via", "from", "vs", "x"]);

const URLS = /(?:https?:\/\/|www\.)\S+|\S+@\S+\.\S+|(?:^|\s)@\w+/gi;
// Bare domains ("site.de", "example.in/about"). The top-level part must be lower case,
// so "St.Louis" or "Lagos.Nigeria" are kept.
const DOMAINS = /[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)*\.[a-z]{2,12}(?:\/\S*)?(?=$|[\s,;|)])/gu;
// "St. Louis", "St Kitts" -> "Saint ..." so "St" is never read as São Tomé (ST).
// All-caps forms need the dot: "MT USA" is Montana, not "Mount USA".
const SAINT = /(?<![\p{L}\p{N}])(?:(St|Ste)(?:\.\s*|\s+)(?=\p{Lu})|(ST|STE|st|ste)\.\s*(?=\p{L}))/gu;
const MOUNT_FORT = /(?<![\p{L}\p{N}])(?:(Mt|Ft)(?:\.\s*|\s+)(?=\p{Lu})|(MT|FT|mt|ft)\.\s*(?=\p{L}))/gu;

/**
 * Two-letter codes that are ordinary words. After another word in the same part
 * ("Follow ME", "Photo ID") they only count when that word is a known city
 * ("Portland ME").
 */
const TRAILING_CODE_WORDS = new Set([
  "AI", "AM", "AN", "AS", "AT", "BE", "BY", "DE", "DO", "ES", "GM", "GO", "HE", "HI", "ID",
  "IF", "IN", "IS", "IT", "ME", "MY", "NO", "OH", "OK", "OR", "PM", "SO", "ST", "TO", "TV",
  "UP", "WE",
]);
/** Codes that mean nothing on their own ("IT", "OK", "PS"). */
const STANDALONE_CODE_WORDS = new Set([
  "AI", "AM", "AS", "AT", "BE", "BY", "DJ", "DM", "DO", "GM", "HI", "IS", "IT", "MC", "ME",
  "MY", "OK", "OR", "PM", "PS", "SO", "TO", "TV",
]);
/**
 * A bare code that is both a country and a US/Canadian/Australian state ("MA",
 * "IN", "CA") is ambiguous on its own and decides nothing, except "LA", which on X
 * is Los Angeles far more often than Laos.
 */
const STANDALONE_COLLISIONS: Record<string, string | null> = { LA: "US" };
/**
 * "City, XX" where the city is not in the tables and XX is both a state code and a
 * country code. US "City, ST" is by far the most common form on X, so the state
 * reading wins; foreign cities of any size are in the tables, so "Jaipur, IN" and
 * "Munich, DE" still resolve by the city. Exceptions: small provinces lose to the
 * country (NL, PE, SK), and DE/SA stay undecided (Germans write "Stadt, DE";
 * "SA" is Saudi Arabia, South Australia or South Africa).
 */
const AFTER_PLACE_COLLISIONS: Record<string, string | null> = {
  DE: null,
  NL: "NL",
  PE: "PE",
  SK: "SK",
  SA: null,
  NU: "CA",
  YT: "CA",
};
/** Upper-case country abbreviations that are not ISO codes. */
const UPPERCASE_COUNTRY_CODES: Record<string, string> = { DR: "DO" };
/** ISO3 codes that are English words or common acronyms. */
const ISO3_WORDS = new Set([
  "AND", "ARE", "ARM", "BEN", "BLM", "CAF", "CAN", "COD", "COL", "COM", "CUB", "DOM", "EST",
  "FIN", "GAB", "GIN", "GRL", "GUM", "GUY", "HUN", "IOT", "IRL", "JAM", "LIE", "MAC", "MDA",
  "MUS", "NIC", "NOR", "PAN", "PER", "PNG", "PRY", "SEN", "SOM", "TLS", "TON", "VAT", "ALA",
  "ATF",
]);

function isUpperWord(word: string): boolean {
  return word.length >= 2 && word === word.toUpperCase() && word !== word.toLowerCase();
}

function foldWord(word: string): string[] {
  const folded = /^[\x00-\x7f]*$/.test(word) ? word.toLowerCase() : foldText(word);
  return folded ? folded.split(" ") : [];
}

function cleanLocation(text: string): string {
  return collapseDottedInitials(text.replace(URLS, " "), true)
    .replace(DOMAINS, " ")
    .replace(SAINT, (_match, title?: string, other?: string) =>
      (title ?? other ?? "").toLowerCase() === "ste" ? "Sainte " : "Saint ",
    )
    .replace(MOUNT_FORT, (match: string) => (match[0]!.toLowerCase() === "m" ? "Mount " : "Fort "))
    .replace(/&/g, " and ");
}

function tokenizeGroup(group: string): Token[] {
  const tokens: Token[] = [];
  group.split(LEVEL_SEPARATOR).forEach((part, level) => {
    for (const word of part.split(WORD_SEPARATOR)) {
      if (!word) continue;
      const upper = isUpperWord(word);
      const capital = word[0] !== word[0]!.toLowerCase();
      for (const text of foldWord(word)) tokens.push({ text, upper, capital, level });
    }
  });
  return tokens;
}

/** Countries named in free text (profile location, place tag). Order of appearance. */
export function countriesFromLocation(text: string, index: CountryIndex): string[] {
  const derived = derive(index);
  const cached = derived.cache.get(text);
  if (cached) return [...cached];
  const found = parseLocation(text, derived);
  if (derived.cache.size >= CACHE_LIMIT) derived.cache.clear();
  derived.cache.set(text, found);
  return [...found];
}

function parseLocation(text: string, derived: Derived): string[] {
  const flags = flagCountryCodes(text).filter((code) => code in COUNTRY_NAMES || derived.iso2.has(code));
  const cleaned = cleanLocation(stripFlags(text));
  const out = new Set<string>();
  for (const group of cleaned.split(GROUP_SEPARATOR)) {
    if (!group || !group.trim()) continue;
    for (const code of parseGroup(tokenizeGroup(group), derived)) out.add(code);
  }
  // Flags are a fallback: many profiles add them for heritage or solidarity
  // next to the place they live ("NYC 🇺🇦").
  if (out.size === 0) for (const code of flags) out.add(code);
  return [...out];
}

/**
 * One location, possibly with several comma-separated levels ("Austin, Texas, USA").
 * List words that no phrase consumed ("Berlin & LA") start a new segment: places on
 * either side are listed side by side, not one inside the other.
 */
function parseGroup(tokens: Token[], derived: Derived): string[] {
  const at: Cursor = { tokens, segment: 0, segmentStart: 0 };
  const items: Item[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i]!;
    const phrase = matchPhrase(tokens, i, derived);
    if (phrase) {
      const [len, entry] = phrase;
      items.push(makeItem(at, entry.kind, entry.countries, i, i + len, entry));
      i += len;
      continue;
    }
    if (isListWord(token)) {
      at.segment += 1;
      at.segmentStart = i + 1;
      i += 1;
      continue;
    }
    const code = token.upper ? codeItem(at, i, items, derived) : null;
    if (code) items.push(code);
    else if (NO_SPACE_SCRIPT.test(token.text)) items.push(...scriptItems(at, i, derived));
    i += 1;
  }
  return resolveItems(items);
}

function matchPhrase(tokens: Token[], start: number, derived: Derived): [number, Entry] | null {
  const first = tokens[start]!;
  let max = derived.maxTokens.get(first.text) ?? 0;
  if (max === 0) return null;
  let end = start;
  while (end < tokens.length && tokens[end]!.level === first.level) end += 1;
  max = Math.min(max, end - start);
  for (let len = max; len > 0; len -= 1) {
    const key = len === 1 ? first.text : tokens.slice(start, start + len).map((t) => t.text).join(" ");
    const entry = derived.phrases.get(key);
    if (!entry) continue;
    if (entry.capitalOnly && !first.capital) continue;
    return [len, entry];
  }
  return null;
}

/** Where the parser is in a group: the tokens and the current list segment. */
type Cursor = { tokens: Token[]; segment: number; segmentStart: number };

function makeItem(
  at: Cursor,
  kind: Item["kind"],
  countries: string[],
  start: number,
  end: number,
  entry?: Entry,
): Item {
  const level = at.tokens[start]!.level;
  const levelStart = start === 0 || at.tokens[start - 1]!.level !== level;
  return {
    kind,
    countries,
    start,
    end,
    level,
    segment: at.segment,
    hasPrefix: start > at.segmentStart,
    afterComma: levelStart && level > 0 && start > 0,
    entry,
  };
}

/**
 * An upper-case code counts only where a place would go: as a whole part
 * ("Lagos, NG", "TX") or as the last word of a part after another word
 * ("Houston TX"), and never inside an all-caps sentence.
 */
function codeItem(at: Cursor, i: number, items: Item[], derived: Derived): Item | null {
  const { tokens } = at;
  const token = tokens[i]!;
  const code = token.text.toUpperCase();
  if (!/^[A-Z]{2,4}$/.test(code)) return null;
  const inPart = (t: Token | undefined) => t !== undefined && t.level === token.level && !isListWord(t);
  let partStart = i;
  while (partStart > at.segmentStart && inPart(tokens[partStart - 1])) partStart -= 1;
  let partEnd = i + 1;
  while (inPart(tokens[partEnd])) partEnd += 1;
  const whole = partStart === i && partEnd === i + 1;
  const last = partEnd === i + 1;
  if (!whole) {
    if (!last) return null;
    const part = tokens.slice(partStart, partEnd);
    if (part.every((t) => t.upper)) return null;
    const prev = items[items.length - 1];
    const afterCity = prev !== undefined && prev.end === i && prev.kind === "city";
    if (TRAILING_CODE_WORDS.has(code) && !afterCity) return null;
  }
  const hasPrefix = i > at.segmentStart;
  const make = (kind: Item["kind"], countries: string[]): Item => ({
    ...makeItem(at, kind, countries, i, i + 1),
    code,
  });

  const city = UPPERCASE_PLACE_CODES[code];
  if (city) return make("city", [city]);
  const country = UPPERCASE_COUNTRY_CODES[code];
  if (country) return make("country", [country]);
  if (code.length === 3 && whole && !ISO3_WORDS.has(code)) {
    const iso2 = derived.iso3.get(code);
    if (iso2) return make("country", [iso2]);
  }
  const states = countriesForSubdivisionCode(code);
  const iso2 = code.length === 2 && derived.iso2.has(code) ? code : null;
  if (!iso2 && states.length === 0) return null;
  if (!hasPrefix && whole && STANDALONE_CODE_WORDS.has(code)) return null;
  return make("code", iso2 ? [...states, iso2] : states);
}

function isListWord(token: Token): boolean {
  return LIST_WORDS.has(token.text) && !token.upper;
}

/** Native names inside a token of a script written without spaces ("日本東京"). */
function scriptItems(at: Cursor, i: number, derived: Derived): Item[] {
  let rest = at.tokens[i]!.text;
  const found: [number, Entry][] = [];
  for (const [name, entry] of derived.scriptNames) {
    const pos = rest.indexOf(name);
    if (pos < 0) continue;
    found.push([pos, entry]);
    rest = rest.slice(0, pos) + " ".repeat(name.length) + rest.slice(pos + name.length);
  }
  return found
    .sort((a, b) => a[0] - b[0])
    .map(([, entry]) => makeItem(at, entry.kind, entry.countries, i, i + 1, entry));
}

function intersect(first: string[], second: string[]): string[] {
  return first.filter((code) => second.includes(code));
}

/**
 * Decide what each place in one location means, using its neighbours:
 * - a city or ambiguous name followed by a state or country ("Paris, Texas",
 *   "Atlanta, Georgia", "London, ON") takes the reading they share; if none is
 *   shared, a state or country name wins over the city ("London, Kentucky"), while
 *   a known city wins over a bare country code ("Mumbai, MH", "Durban, SA");
 * - anything still open takes a country named elsewhere in the same segment
 *   ("Springfield, IL, USA"), else its default reading.
 */
function resolveItems(items: Item[]): string[] {
  for (let i = 0; i < items.length - 1; i += 1) {
    const item = items[i]!;
    const next = items[i + 1]!;
    if (item.segment !== next.segment) continue;
    if (item.kind !== "city" && item.kind !== "ambiguous" && item.kind !== "code") continue;
    if (next.kind === "city" || next.kind === "region") continue;
    const shared = intersect(item.countries, next.countries);
    if (shared.length > 0) {
      if (item.countries.length > 1 || item.kind !== "code") item.pinned ??= shared[0]!;
      if (next.countries.length > 1) next.pinned ??= shared[0]!;
      continue;
    }
    if (next.kind === "ambiguous") continue;
    const nextIsIsoCode =
      next.kind === "code" && next.code !== undefined && next.countries.includes(next.code);
    // A code cannot contain a state of another country ("PH, Rivers State").
    if (item.kind === "code") {
      if (!nextIsIsoCode && item.pinned === undefined) item.pinned = null;
    } else if (nextIsIsoCode) next.pinned = null;
    else if (item.pinned === undefined) item.pinned = null;
  }

  const explicit = new Map<number, Set<string>>();
  const settled = (item: Item): string | null | undefined => {
    if (item.pinned !== undefined) return item.pinned;
    if (item.kind === "country" || item.kind === "subdivision") return item.countries[0] ?? null;
    if (item.kind === "code" && item.countries.length === 1) return item.countries[0]!;
    return undefined;
  };
  for (const item of items) {
    const code = settled(item);
    if (!code) continue;
    const set = explicit.get(item.segment) ?? new Set<string>();
    set.add(code);
    explicit.set(item.segment, set);
  }

  const out: string[] = [];
  for (const item of items) {
    if (item.kind === "region") continue;
    let code = settled(item);
    if (code === undefined) {
      const context = explicit.get(item.segment);
      code = item.countries.find((c) => context?.has(c)) ?? fallback(item);
    }
    if (code) out.push(code);
  }
  return out;
}

function fallback(item: Item): string | null {
  switch (item.kind) {
    case "ambiguous":
      return (item.afterComma ? item.entry?.afterPlace : item.entry?.alone) ?? null;
    case "code": {
      const code = item.code ?? "";
      if (!item.hasPrefix) return code in STANDALONE_COLLISIONS ? STANDALONE_COLLISIONS[code]! : null;
      if (code in AFTER_PLACE_COLLISIONS) return AFTER_PLACE_COLLISIONS[code]!;
      return item.countries[0] ?? null;
    }
    default:
      return item.countries[0] ?? null;
  }
}

const X_LABEL_SUFFIX = /\s+(?:app store|android app|google play|ios app|iphone app|ipad app|app)$/;

/**
 * Countries in one of X's own labels ("Account based in: Georgia", "Connected via:
 * India App Store"). X shows country names there, so an exact name wins ("Georgia"
 * is the country); anything else is parsed like a location.
 */
function xLabelCountries(text: string, index: CountryIndex): string[] {
  const folded = foldText(text).replace(X_LABEL_SUFFIX, "");
  const exact = folded ? index.names.get(folded) : undefined;
  if (exact) return [exact];
  return countriesFromLocation(text, index);
}

export function countryFromBasedIn(text: string, index: CountryIndex): string | null {
  return xLabelCountries(text, index)[0] ?? null;
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

type GeoField = "place" | "basedIn" | "connectedVia" | "location";

const FIELD_LABEL: Record<GeoField, string> = {
  place: "Place",
  basedIn: "Account based in",
  connectedVia: "Connected via",
  location: "Profile location",
};

function geoReason(field: GeoField, what: string): string {
  const suffix = field === "basedIn" ? " (as shown by X)" : "";
  return `${FIELD_LABEL[field]}: ${what}${suffix}`;
}

type GeoParse = { countries: string[]; regions: string[] };

function parseGeo(text: string, field: GeoField, index: CountryIndex): GeoParse {
  const xLabel = field === "basedIn" || field === "connectedVia";
  const countries = xLabel ? xLabelCountries(text, index) : countriesFromLocation(text, index);
  // A named place beats a region word in the same text ("Europe-based, Tokyo").
  return { countries, regions: countries.length > 0 ? [] : regionsFromLocation(text) };
}

function geoDecision(parse: GeoParse, field: GeoField, settings: Settings): MatchDecision {
  for (const code of parse.countries) {
    if (settings.hiddenCountryCodes.includes(code)) {
      return { hit: geoReason(field, countryName(code)), decided: true };
    }
  }
  for (const code of parse.countries) {
    const region = regionsForCountry(code).find((id) => settings.hiddenRegionIds.includes(id));
    if (region) {
      return { hit: geoReason(field, `${countryName(code)}, ${regionName(region)}`), decided: true };
    }
  }
  const region = parse.regions.find((id) => settings.hiddenRegionIds.includes(id));
  if (region) return { hit: geoReason(field, regionName(region)), decided: true };
  return { hit: null, decided: parse.countries.length > 0 || parse.regions.length > 0 };
}

function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}

function geoPicks(settings: Settings): boolean {
  return settings.hiddenCountryCodes.length > 0 || settings.hiddenRegionIds.length > 0;
}

function emptyDecision(): MatchDecision {
  return { hit: null, decided: false };
}

function mergeDecision(first: MatchDecision, second: MatchDecision): MatchDecision {
  if (first.hit) return first;
  if (second.hit) return second;
  const out: MatchDecision = { hit: null, decided: first.decided || second.decided };
  if (first.noLanguage || second.noLanguage) out.noLanguage = true;
  return out;
}

const languagePicksCache = new WeakMap<string[], Set<string>>();

function languagePicks(settings: Settings): Set<string> {
  const codes = settings.hiddenLanguageCodes;
  let picks = languagePicksCache.get(codes);
  if (!picks) {
    picks = new Set(codes.map(normalizeLang).filter((code): code is string => code !== null));
    languagePicksCache.set(codes, picks);
  }
  return picks;
}

function langDecision(
  lang: string | null,
  source: "post" | "account",
  settings: Settings,
): MatchDecision {
  if (!lang || settings.hiddenLanguageCodes.length === 0) return emptyDecision();
  const code = normalizeLang(lang);
  if (!code) {
    return source === "post" && isNoLanguageCode(lang)
      ? { hit: null, decided: false, noLanguage: true }
      : emptyDecision();
  }
  if (languagePicks(settings).has(code)) {
    const label = source === "post" ? "Post language" : "Account language";
    return { hit: `${label}: ${languageName(code)}`, decided: true };
  }
  return { hit: null, decided: true };
}

function textDecision(
  text: string,
  field: GeoField,
  settings: Settings,
  index: CountryIndex,
): MatchDecision {
  if (!geoPicks(settings)) return emptyDecision();
  return geoDecision(parseGeo(text, field, index), field, settings);
}

/** The most specific regions in a list (drops parents of other listed regions). */
function namedRegions(ids: string[]): string[] {
  const parents = new Set(
    ids.map((id) => REGIONS.find((region) => region.id === id)?.parent).filter(Boolean),
  );
  return ids.filter((id) => !parents.has(id));
}

/**
 * Author geography, most reliable source first: X's "Account based in", then
 * "Connected via", then the free-text profile location. When "based in" shows
 * only a region, a country from the later fields refines it if it lies inside
 * that region ("South Asia" + "India Android App" -> India).
 */
function authorGeoDecision(
  author: UserRecord,
  settings: Settings,
  index: CountryIndex,
): MatchDecision {
  if (!geoPicks(settings)) return emptyDecision();
  const basedIn = author.basedIn ? parseGeo(author.basedIn, "basedIn", index) : null;
  if (basedIn && basedIn.countries.length > 0) return geoDecision(basedIn, "basedIn", settings);
  const later: [GeoParse | null, GeoField][] = [
    [author.connectedVia ? parseGeo(author.connectedVia, "connectedVia", index) : null, "connectedVia"],
    [author.location ? parseGeo(author.location, "location", index) : null, "location"],
  ];
  if (basedIn && basedIn.regions.length > 0) {
    const shown = namedRegions(basedIn.regions);
    for (const [parse, field] of later) {
      const inside = parse?.countries.filter((code) =>
        regionsForCountry(code).some((id) => shown.includes(id)),
      );
      if (inside && inside.length > 0) {
        return geoDecision({ countries: inside, regions: [] }, field, settings);
      }
    }
    return geoDecision(basedIn, "basedIn", settings);
  }
  for (const [parse, field] of later) {
    if (parse && (parse.countries.length > 0 || parse.regions.length > 0)) {
      return geoDecision(parse, field, settings);
    }
  }
  return emptyDecision();
}

function authorDecision(
  author: UserRecord | undefined,
  settings: Settings,
  index: CountryIndex,
): MatchDecision {
  if (!author) return emptyDecision();
  return mergeDecision(
    langDecision(author.lang, "account", settings),
    authorGeoDecision(author, settings, index),
  );
}

function hideListsEmpty(settings: Settings): boolean {
  return (
    settings.hiddenCountryCodes.length === 0 &&
    settings.hiddenLanguageCodes.length === 0 &&
    settings.hiddenRegionIds.length === 0
  );
}

export function tweetDecision(
  tweet: TweetRecord,
  author: UserRecord | undefined,
  settings: Settings,
  index: CountryIndex,
): MatchDecision {
  if (hideListsEmpty(settings)) return emptyDecision();
  let out = emptyDecision();
  if (tweet.place) {
    out = mergeDecision(out, textDecision(tweet.place, "place", settings, index));
  }
  out = mergeDecision(out, langDecision(tweet.lang, "post", settings));
  return mergeDecision(out, authorDecision(author, settings, index));
}

export function tweetMatchReason(
  tweet: TweetRecord,
  author: UserRecord | undefined,
  settings: Settings,
  index: CountryIndex,
): string | null {
  return tweetDecision(tweet, author, settings, index).hit;
}

export function shouldHideTweet(
  tweet: TweetRecord,
  author: UserRecord | undefined,
  settings: Settings,
  index: CountryIndex,
): boolean {
  return actionReason(tweetDecision(tweet, author, settings, index), settings) !== null;
}

export function cardDecision(
  tweet: TweetRecord,
  users: Map<string, UserRecord>,
  settings: Settings,
  index: CountryIndex,
): MatchDecision {
  const author = tweet.authorId ? users.get(tweet.authorId) : undefined;
  const self = tweetDecision(tweet, author, settings, index);
  if (self.hit) return self;
  const mode = effectiveFilterMode(settings);
  switch (mode) {
    case "only": {
      if (!tweet.retweeted) return self;
      const retweeted = cardDecision(tweet.retweeted, users, settings, index);
      if (retweeted.hit) return { hit: `Repost of a match: ${retweeted.hit}`, decided: true };
      return mergeDecision(self, retweeted);
    }
    case "hide": {
      let out = self;
      if (tweet.quoted) {
        const quoted = cardDecision(tweet.quoted, users, settings, index);
        if (quoted.hit) return { hit: `Quotes a match: ${quoted.hit}`, decided: true };
        out = mergeDecision(out, quoted);
      }
      if (tweet.retweeted) {
        const retweeted = cardDecision(tweet.retweeted, users, settings, index);
        if (retweeted.hit) return { hit: `Repost of a match: ${retweeted.hit}`, decided: true };
        out = mergeDecision(out, retweeted);
      }
      return out;
    }
    default: {
      const _never: never = mode;
      return _never;
    }
  }
}

export function cardMatchReason(
  tweet: TweetRecord,
  users: Map<string, UserRecord>,
  settings: Settings,
  index: CountryIndex,
): string | null {
  return cardDecision(tweet, users, settings, index).hit;
}

export function shouldHideCard(
  tweet: TweetRecord,
  users: Map<string, UserRecord>,
  settings: Settings,
  index: CountryIndex,
): boolean {
  return actionReason(cardDecision(tweet, users, settings, index), settings) !== null;
}
