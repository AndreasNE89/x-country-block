export const HOOK_SOURCE = "x-country-block" as const;

export type FilterMode = "hide" | "only";

export type Settings = {
  hiddenCountryCodes: string[];
  hiddenLanguageCodes: string[];
  hiddenRegionIds: string[];
  markOnly: boolean;
  filterMode: FilterMode;
  onlyShowPaid: boolean;
  trialStartedAt: number | null;
  onlyShowUnlocked: boolean;
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
