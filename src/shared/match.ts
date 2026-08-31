import { COUNTRY_NAMES } from "./countries.ts";
import { foldText } from "./normalize.ts";
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

export function actionReason(match: string | null, settings: Settings): string | null {
  if (hideListsEmpty(settings)) return null;
  const mode = effectiveFilterMode(settings);
  switch (mode) {
    case "hide":
      return match;
    case "only":
      return match ? null : `outside · ${allowListLabel(settings)}`;
    default: {
      const _never: never = mode;
      return _never;
    }
  }
}

const ISO2 = /^[a-z]{2}$/;

export function countriesFromLocation(text: string, index: CountryIndex): string[] {
  const folded = foldText(text);
  if (!folded) return [];
  const hits = new Set<string>();
  const tokens = folded.split(" ");
  const iso2Codes = new Set(index.names.values());

  for (const [phrase, iso2] of index.names) {
    if (hasPhrase(folded, phrase)) hits.add(iso2);
  }
  for (const [phrase, iso2] of index.cities) {
    if (hasPhrase(folded, phrase)) hits.add(iso2);
  }
  for (const token of tokens) {
    if (ISO2.test(token)) {
      const iso2 = token.toUpperCase();
      if (iso2Codes.has(iso2)) hits.add(iso2);
    }
    const from3 = index.iso3.get(token);
    if (from3) hits.add(from3);
  }
  return [...hits];
}

function hasPhrase(haystack: string, phrase: string): boolean {
  return (` ${haystack} `).includes(` ${phrase} `);
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
  const regionHit = regionsFromLocation(text).find((id) => settings.hiddenRegionIds.includes(id));
  if (regionHit) return `${field} · ${regionName(regionHit)}`;
  for (const code of countriesFromLocation(text, index)) {
    if (settings.hiddenCountryCodes.includes(code)) {
      return `${field} · ${COUNTRY_NAMES[code] ?? code}`;
    }
    const viaRegion = regionsForCountry(code).find((id) => settings.hiddenRegionIds.includes(id));
    if (viaRegion) return `${field} · ${COUNTRY_NAMES[code] ?? code} · ${regionName(viaRegion)}`;
  }
  return null;
}

function authorMatchReason(
  author: UserRecord | undefined,
  settings: Settings,
  index: CountryIndex,
): string | null {
  if (!author) return null;
  if (author.lang && settings.hiddenLanguageCodes.includes(author.lang)) {
    return `account lang · ${author.lang}`;
  }
  if (author.basedIn) {
    const reason = textMatchReason(author.basedIn, "based in", settings, index);
    if (reason) return reason;
  }
  if (author.connectedVia) {
    const reason = textMatchReason(author.connectedVia, "connected via", settings, index);
    if (reason) return reason;
  }
  if (author.location) {
    const reason = textMatchReason(author.location, "location", settings, index);
    if (reason) return reason;
  }
  return null;
}

function hideListsEmpty(settings: Settings): boolean {
  return (
    settings.hiddenCountryCodes.length === 0 &&
    settings.hiddenLanguageCodes.length === 0 &&
    settings.hiddenRegionIds.length === 0
  );
}

export function tweetMatchReason(
  tweet: TweetRecord,
  author: UserRecord | undefined,
  settings: Settings,
  index: CountryIndex,
): string | null {
  if (hideListsEmpty(settings)) return null;
  if (tweet.place) {
    const placeReason = textMatchReason(tweet.place, "place", settings, index);
    if (placeReason) return placeReason;
  }
  if (tweet.lang && settings.hiddenLanguageCodes.includes(tweet.lang)) {
    return `tweet lang · ${tweet.lang}`;
  }
  return authorMatchReason(author, settings, index);
}

export function shouldHideTweet(
  tweet: TweetRecord,
  author: UserRecord | undefined,
  settings: Settings,
  index: CountryIndex,
): boolean {
  return actionReason(tweetMatchReason(tweet, author, settings, index), settings) !== null;
}

export function cardMatchReason(
  tweet: TweetRecord,
  users: Map<string, UserRecord>,
  settings: Settings,
  index: CountryIndex,
): string | null {
  const author = tweet.authorId ? users.get(tweet.authorId) : undefined;
  const self = tweetMatchReason(tweet, author, settings, index);
  if (self) return self;
  if (tweet.quoted) {
    const quoted = cardMatchReason(tweet.quoted, users, settings, index);
    if (quoted) return `quote · ${quoted}`;
  }
  if (tweet.retweeted) {
    const retweeted = cardMatchReason(tweet.retweeted, users, settings, index);
    if (retweeted) return `retweet · ${retweeted}`;
  }
  return null;
}

export function shouldHideCard(
  tweet: TweetRecord,
  users: Map<string, UserRecord>,
  settings: Settings,
  index: CountryIndex,
): boolean {
  return actionReason(cardMatchReason(tweet, users, settings, index), settings) !== null;
}
