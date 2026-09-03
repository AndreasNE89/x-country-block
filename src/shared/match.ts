import { COUNTRY_NAMES } from "./countries.ts";
import { foldText } from "./normalize.ts";
import { countryForSubdivisionCode } from "./places.ts";
import { regionName, regionsForCountry, regionsFromLocation } from "./regions.ts";
import type { CountryIndex, FilterMode, Settings, TweetRecord, UserRecord } from "./types.ts";

export function allowListLabel(settings: Settings): string {
  const bits = [
    ...settings.hiddenCountryCodes.map((code) => COUNTRY_NAMES[code] ?? code),
    ...settings.hiddenRegionIds.map((id) => regionName(id)),
    ...settings.hiddenLanguageCodes,
  ];
  return bits.join(" · ") || "allow list";
}

export function effectiveFilterMode(settings: Settings): FilterMode {
  if (settings.filterMode === "only" && settings.onlyShowUnlocked) return "only";
  return "hide";
}

export type MatchDecision = {
  hit: string | null;
  decided: boolean;
};

export function actionReason(decision: MatchDecision, settings: Settings): string | null {
  if (hideListsEmpty(settings)) return null;
  const mode = effectiveFilterMode(settings);
  switch (mode) {
    case "hide":
      return decision.hit;
    case "only":
      return decision.hit ? null : `outside · ${allowListLabel(settings)}`;
    default: {
      const _never: never = mode;
      return _never;
    }
  }
}

const ISO2 = /^[a-z]{2}$/;
const PLACE_STOP = new Set([
  "from",
  "in",
  "the",
  "at",
  "to",
  "of",
  "and",
  "or",
  "a",
  "an",
  "via",
  "based",
  "live",
  "lives",
]);

export function countriesFromLocation(text: string, index: CountryIndex): string[] {
  const folded = foldText(text);
  if (!folded) return [];
  const hits = new Set<string>();
  const tokens = folded.split(" ");
  const iso2Codes = new Set(index.names.values());
  const phrases = new Map<string, string>([...index.names, ...index.cities]);
  addLongestPhrases(folded, phrases, hits);

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (ISO2.test(token) || countryForSubdivisionCode(token.toUpperCase())) {
      const code = token.toUpperCase();
      const subdiv = countryForSubdivisionCode(code);
      if (subdiv) {
        if (iso2Codes.has(code) && hits.has(code)) continue;
        if (hits.has(subdiv) || hasNonStopPrefix(tokens, i)) {
          hits.add(subdiv);
          continue;
        }
      }
      if (iso2Codes.has(code)) hits.add(code);
    }
    const from3 = index.iso3.get(token);
    if (from3 && iso3Allowed(text, folded, token)) hits.add(from3);
  }

  const last = tokens[tokens.length - 1];
  const lastCode = last?.toUpperCase() ?? "";
  const lastSub = lastCode ? countryForSubdivisionCode(lastCode) : null;
  if (
    lastSub &&
    hasNonStopPrefix(tokens, tokens.length - 1) &&
    !(iso2Codes.has(lastCode) && hits.has(lastCode))
  ) {
    return [lastSub];
  }
  return [...hits];
}

function addLongestPhrases(folded: string, dict: Map<string, string>, hits: Set<string>): void {
  const phrases = [...dict.keys()].sort((a, b) => b.length - a.length);
  const used = new Uint8Array(folded.length);
  const padded = ` ${folded} `;
  for (const phrase of phrases) {
    if (!phrase) continue;
    const needle = ` ${phrase} `;
    let from = 0;
    while (from <= padded.length - needle.length) {
      const at = padded.indexOf(needle, from);
      if (at < 0) break;
      const start = at;
      const end = start + phrase.length;
      let overlap = false;
      for (let i = start; i < end; i += 1) {
        if (used[i]) {
          overlap = true;
          break;
        }
      }
      if (!overlap) {
        for (let i = start; i < end; i += 1) used[i] = 1;
        const iso2 = dict.get(phrase);
        if (iso2) hits.add(iso2);
      }
      from = at + 1;
    }
  }
}

function iso3Allowed(original: string, folded: string, token: string): boolean {
  if (folded === token) return true;
  const code = token.toUpperCase();
  return new RegExp(`(^|[^A-Za-z0-9])${code}([^A-Za-z0-9]|$)`).test(original);
}

function hasNonStopPrefix(tokens: string[], index: number): boolean {
  for (let i = 0; i < index; i += 1) {
    if (!PLACE_STOP.has(tokens[i]!)) return true;
  }
  return false;
}

export function countryFromBasedIn(text: string, index: CountryIndex): string | null {
  const found = countriesFromLocation(text, index);
  return found[0] ?? null;
}

function textMatchReason(
  text: string,
  field: string,
  settings: Settings,
  index: CountryIndex,
): string | null {
  const codes = countriesFromLocation(text, index);
  for (const code of codes) {
    if (settings.hiddenCountryCodes.includes(code)) {
      return `${field} · ${COUNTRY_NAMES[code] ?? code}`;
    }
  }
  for (const code of codes) {
    const viaRegion = regionsForCountry(code).find((id) => settings.hiddenRegionIds.includes(id));
    if (viaRegion) return `${field} · ${COUNTRY_NAMES[code] ?? code} · ${regionName(viaRegion)}`;
  }
  const regionHit = regionsFromLocation(text).find((id) => settings.hiddenRegionIds.includes(id));
  if (regionHit) return `${field} · ${regionName(regionHit)}`;
  return null;
}

function emptyDecision(): MatchDecision {
  return { hit: null, decided: false };
}

function mergeDecision(first: MatchDecision, second: MatchDecision): MatchDecision {
  if (first.hit) return first;
  if (second.hit) return second;
  return { hit: null, decided: first.decided || second.decided };
}

function langDecision(lang: string | null, field: string, settings: Settings): MatchDecision {
  if (!lang || settings.hiddenLanguageCodes.length === 0) return emptyDecision();
  if (settings.hiddenLanguageCodes.includes(lang)) {
    return { hit: `${field} · ${lang}`, decided: true };
  }
  return { hit: null, decided: true };
}

function textDecision(
  text: string,
  field: string,
  settings: Settings,
  index: CountryIndex,
): MatchDecision {
  const hit = textMatchReason(text, field, settings, index);
  if (hit) return { hit, decided: true };
  const geoOn = settings.hiddenCountryCodes.length > 0 || settings.hiddenRegionIds.length > 0;
  if (!geoOn) return emptyDecision();
  if (countriesFromLocation(text, index).length > 0) return { hit: null, decided: true };
  if (regionsFromLocation(text).length > 0) return { hit: null, decided: true };
  return emptyDecision();
}

function firstParsedGeo(
  texts: { text: string | null; field: string }[],
  settings: Settings,
  index: CountryIndex,
): MatchDecision {
  for (const row of texts) {
    if (!row.text) continue;
    const decision = textDecision(row.text, row.field, settings, index);
    if (decision.hit || decision.decided) return decision;
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
    langDecision(author.lang, "account lang", settings),
    firstParsedGeo(
      [
        { text: author.basedIn, field: "based in" },
        { text: author.connectedVia, field: "connected via" },
        { text: author.location, field: "location" },
      ],
      settings,
      index,
    ),
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
  out = mergeDecision(out, langDecision(tweet.lang, "tweet lang", settings));
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
      if (retweeted.hit) return { hit: `retweet · ${retweeted.hit}`, decided: true };
      return mergeDecision(self, retweeted);
    }
    case "hide": {
      let out = self;
      if (tweet.quoted) {
        const quoted = cardDecision(tweet.quoted, users, settings, index);
        if (quoted.hit) return { hit: `quote · ${quoted.hit}`, decided: true };
        out = mergeDecision(out, quoted);
      }
      if (tweet.retweeted) {
        const retweeted = cardDecision(tweet.retweeted, users, settings, index);
        if (retweeted.hit) return { hit: `retweet · ${retweeted.hit}`, decided: true };
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
