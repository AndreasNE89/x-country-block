import { foldText } from "./normalize.ts";
import type { CountryIndex, Settings, TweetRecord, UserRecord } from "./types.ts";

const ISO2 = /^[a-z]{2}$/;

export function countriesFromLocation(text: string, index: CountryIndex): string[] {
  const folded = foldText(text);
  if (!folded) return [];
  const hits = new Set<string>();
  const tokens = folded.split(" ");

  for (const [phrase, iso2] of index.names) {
    if (hasPhrase(folded, phrase)) hits.add(iso2);
  }
  for (const [phrase, iso2] of index.cities) {
    if (hasPhrase(folded, phrase)) hits.add(iso2);
  }
  for (const token of tokens) {
    if (ISO2.test(token)) {
      for (const iso2 of index.names.values()) {
        if (iso2.toLowerCase() === token) hits.add(iso2);
      }
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

function hideFromAuthor(
  author: UserRecord | undefined,
  settings: Settings,
  index: CountryIndex,
): boolean {
  if (!author) return false;
  if (author.lang && settings.hiddenLanguageCodes.includes(author.lang)) return true;
  if (author.basedIn) {
    const code = countryFromBasedIn(author.basedIn, index);
    if (code && settings.hiddenCountryCodes.includes(code)) return true;
  }
  if (author.location) {
    for (const code of countriesFromLocation(author.location, index)) {
      if (settings.hiddenCountryCodes.includes(code)) return true;
    }
  }
  return false;
}

export function shouldHideTweet(
  tweet: TweetRecord,
  author: UserRecord | undefined,
  settings: Settings,
  index: CountryIndex,
): boolean {
  if (settings.hiddenCountryCodes.length === 0 && settings.hiddenLanguageCodes.length === 0) {
    return false;
  }
  if (tweet.lang && settings.hiddenLanguageCodes.includes(tweet.lang)) return true;
  return hideFromAuthor(author, settings, index);
}

export function shouldHideCard(
  tweet: TweetRecord,
  users: Map<string, UserRecord>,
  settings: Settings,
  index: CountryIndex,
): boolean {
  const author = tweet.authorId ? users.get(tweet.authorId) : undefined;
  if (shouldHideTweet(tweet, author, settings, index)) return true;
  if (tweet.quoted && shouldHideCard(tweet.quoted, users, settings, index)) return true;
  if (tweet.retweeted && shouldHideCard(tweet.retweeted, users, settings, index)) return true;
  return false;
}
