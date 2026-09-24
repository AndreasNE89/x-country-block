export const HOOK_SOURCE = "x-country-block" as const;

export type FilterMode = "hide" | "only";

export type Settings = {
  /** Master switch. false = paused: nothing hidden or marked, picks kept. */
  enabled: boolean;
  hiddenCountryCodes: string[];
  hiddenLanguageCodes: string[];
  hiddenRegionIds: string[];
  /** Lowercase screen names (no @) that are never hidden or marked. */
  allowedHandles: string[];
  /** "Highlight instead of hide". */
  markOnly: boolean;
  filterMode: FilterMode;
  onlyShowPaid: boolean;
  trialStartedAt: number | null;
  /** Derived: paid, or trial still running. Never read from storage. */
  onlyShowUnlocked: boolean;
  /** Derived: trial was started and has run out, and not paid. */
  trialExpired: boolean;
};

export type UserRecord = {
  userId: string;
  screenName: string | null;
  location: string | null;
  basedIn: string | null;
  connectedVia: string | null;
  lang: string | null;
};

export type TweetRecord = {
  tweetId: string;
  lang: string | null;
  authorId: string | null;
  place: string | null;
  quoted: TweetRecord | null;
  retweeted: TweetRecord | null;
};

export type CountryIndex = {
  names: Map<string, string>;
  iso3: Map<string, string>;
  cities: Map<string, string>;
};

export type ParsedGraphQL = {
  tweets: TweetRecord[];
  users: UserRecord[];
};

export type HookMessage = {
  source: typeof HOOK_SOURCE;
  type: "graphql";
  tweets: TweetRecord[];
  users: UserRecord[];
};
