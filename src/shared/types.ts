export type Settings = {
  hiddenCountryCodes: string[];
  hiddenLanguageCodes: string[];
};

export type UserRecord = {
  userId: string;
  location: string | null;
  basedIn: string | null;
  lang: string | null;
};

export type TweetRecord = {
  tweetId: string;
  lang: string | null;
  authorId: string | null;
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
  source: "x-country-hide";
  type: "graphql";
  tweets: TweetRecord[];
  users: UserRecord[];
};
