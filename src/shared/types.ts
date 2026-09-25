export const HOOK_SOURCE = "x-country-block" as const;
/**
 * Hook messages carry this, and the content script reads only messages with the same value, so
 * records a hook from an older build posts (Firefox leaves it running in a tab open across an
 * update) are not merged in. Raise it when the records' meaning changes.
 */
export const HOOK_VERSION = 2 as const;
/** Posted once by a hook when it installs, so hooks of earlier builds in the same page stand down. */
export const HOOK_INSTALLED = "hook-installed" as const;

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
  /** Profile location. "" means X sent it blank (cleared); null means not sent. */
  location: string | null;
  basedIn: string | null;
  connectedVia: string | null;
  lang: string | null;
  /** X's about_profile.location_accurate: false when X says "based in" may be wrong (VPN, travel). */
  locationAccurate?: boolean | null;
};

export type TweetRecord = {
  tweetId: string;
  lang: string | null;
  authorId: string | null;
  place: string | null;
  quoted: TweetRecord | null;
  retweeted: TweetRecord | null;
  /** Quoted post id, also when X only references it (quotedRefResult, quoted_status_id_str). */
  quotedId?: string | null;
  retweetedId?: string | null;
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
  v: typeof HOOK_VERSION;
  tweets: TweetRecord[];
  users: UserRecord[];
};
