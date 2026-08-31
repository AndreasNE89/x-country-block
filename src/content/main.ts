import { UserCache } from "../shared/cache.ts";
import { defaultCountryIndex } from "../shared/countries.ts";
import {
  aboutSignalsFromDocument,
  applyCardAction,
  applyCardMark,
  HIDE_ATTR,
  measureCardZones,
  findNotificationRows,
  findProfileIdentity,
  findTweetArticles,
  restoreScrollAfterHide,
  snapshotAboveFold,
  handleFromProfileHeader,
  profileHeaderTexts,
  screenNameFromElement,
  screenNameFromPath,
  tweetIdFromArticle,
  userIdFromElement,
  visiblePlaceFromCard,
  visibleProfileLocation,
  visibleTranslatedFrom,
} from "../shared/hide-dom.ts";
import { languageCodeFromName } from "../shared/languages.ts";
import { BADGE_MSG } from "../shared/badge.ts";
import { actionReason, cardMatchReason, countriesFromLocation, tweetMatchReason } from "../shared/match.ts";
import { regionsFromLocation } from "../shared/regions.ts";
import { parseSettings } from "../shared/settings.ts";
import { HOOK_SOURCE, type HookMessage, type Settings, type TweetRecord, type UserRecord } from "../shared/types.ts";

const TWEET_LIMIT = 10_000;
const index = defaultCountryIndex();
const tweets = new Map<string, TweetRecord>();
const users = new UserCache(10_000);
let settings: Settings = parseSettings(undefined);
let forceFull = true;

function storage(): typeof chrome.storage.local | null {
  try {
    return globalThis.chrome?.storage?.local ?? null;
  } catch {
    return null;
  }
}

async function load(): Promise<void> {
  const area = storage();
  if (!area) return;
  const raw = await area.get([
    "hiddenCountryCodes",
    "hiddenLanguageCodes",
    "hiddenRegionIds",
    "markOnly",
    "filterMode",
    "onlyShowPaid",
    "trialStartedAt",
    "userCache",
  ]);
  settings = parseSettings(raw);
  if (Array.isArray(raw.userCache)) users.load(raw.userCache as UserRecord[]);
  invalidateUsersMap();
  forceFull = true;
}

function persistUsers(): void {
  const area = storage();
  if (!area) return;
  void area.set({ userCache: users.dump() });
}

let usersMapCache: Map<string, UserRecord> | null = null;

function usersMap(): Map<string, UserRecord> {
  if (usersMapCache) return usersMapCache;
  const map = new Map<string, UserRecord>();
  for (const row of users.dump()) map.set(row.userId, row);
  usersMapCache = map;
  return map;
}

function invalidateUsersMap(): void {
  usersMapCache = null;
}

function putTweet(tweet: TweetRecord): void {
  tweets.set(tweet.tweetId, tweet);
  if (tweets.size <= TWEET_LIMIT) return;
  const oldest = tweets.keys().next();
  if (!oldest.done) tweets.delete(oldest.value);
}

function emptyTweet(partial: Partial<TweetRecord> = {}): TweetRecord {
  return {
    tweetId: "",
    lang: null,
    authorId: null,
    place: null,
    quoted: null,
    retweeted: null,
    ...partial,
  };
}

function locationFromHeaderTexts(): string | null {
  const known = visibleProfileLocation(document);
  if (known) return known;
  for (const text of profileHeaderTexts(document)) {
    if (countriesFromLocation(text, index).length > 0) return text;
    if (regionsFromLocation(text).length > 0) return text;
  }
  return null;
}

function pageSignals(): {
  location: string | null;
  basedIn: string | null;
  connectedVia: string | null;
} {
  const about = aboutSignalsFromDocument(document);
  return {
    location: locationFromHeaderTexts(),
    basedIn: about.basedIn,
    connectedVia: about.connectedVia,
  };
}

let signalsCache: ReturnType<typeof pageSignals> | null = null;
let signalsPath = "";

function signalsForApply(full: boolean): ReturnType<typeof pageSignals> {
  const path = location.pathname;
  if (!full && signalsCache && signalsPath === path) return signalsCache;
  signalsCache = pageSignals();
  signalsPath = path;
  return signalsCache;
}

function pageHandle(): string | null {
  return screenNameFromPath(location.pathname) ?? handleFromProfileHeader(document);
}

function findAuthor(
  map: Map<string, UserRecord>,
  userId: string | null,
  screenName: string | null,
): UserRecord | undefined {
  if (userId) {
    const byId = map.get(userId);
    if (byId) return byId;
  }
  if (!screenName) return undefined;
  const folded = screenName.toLowerCase();
  for (const row of map.values()) {
    if (row.screenName?.toLowerCase() === folded) return row;
  }
  return undefined;
}

function mergeAuthor(
  author: UserRecord | undefined,
  extra: {
    userId?: string | null;
    screenName?: string | null;
    location?: string | null;
    basedIn?: string | null;
    connectedVia?: string | null;
  },
): UserRecord | undefined {
  if (
    !author &&
    !extra.userId &&
    !extra.screenName &&
    !extra.location &&
    !extra.basedIn &&
    !extra.connectedVia
  ) {
    return undefined;
  }
  return {
    userId: extra.userId ?? author?.userId ?? "",
    screenName: extra.screenName ?? author?.screenName ?? null,
    location: author?.location ?? extra.location ?? null,
    basedIn: author?.basedIn ?? extra.basedIn ?? null,
    connectedVia: author?.connectedVia ?? extra.connectedVia ?? null,
    lang: author?.lang ?? null,
  };
}

function rememberAuthor(author: UserRecord | undefined): void {
  if (!author?.userId) return;
  const prev = users.get(author.userId);
  if (
    (author.basedIn && !prev?.basedIn) ||
    (author.location && !prev?.location) ||
    (author.connectedVia && !prev?.connectedVia)
  ) {
    users.put(author);
    invalidateUsersMap();
    persistUsers();
  }
}

function reasonForCard(
  card: HTMLElement,
  map: Map<string, UserRecord>,
  signals: ReturnType<typeof pageSignals>,
  pageName: string | null,
): string | null {
  const id = tweetIdFromArticle(card);
  const tweet = id ? tweets.get(id) : undefined;
  const articleName = screenNameFromElement(card);
  const userId = tweet?.authorId ?? userIdFromElement(card);
  let author = findAuthor(map, userId, articleName);
  const onProfile =
    !!pageName && !!articleName && pageName.toLowerCase() === articleName.toLowerCase();
  if (onProfile) {
    author = mergeAuthor(author, {
      userId,
      screenName: articleName,
      location: signals.location,
      basedIn: signals.basedIn,
      connectedVia: signals.connectedVia,
    });
    rememberAuthor(author);
  }
  if (author?.userId) map.set(author.userId, author);
  const place = tweet?.place ?? visiblePlaceFromCard(card);
  const lang =
    tweet?.lang ?? languageCodeFromName(visibleTranslatedFrom(card) ?? "") ?? null;
  const record = tweet
    ? { ...tweet, place: tweet.place ?? place, lang: tweet.lang ?? lang }
    : emptyTweet({
        tweetId: id ?? "",
        authorId: userId ?? author?.userId ?? null,
        place,
        lang,
      });
  const self = tweetMatchReason(record, author, settings, index);
  if (self) return self;
  if (tweet) return cardMatchReason(record, map, settings, index);
  return null;
}

function profileReason(
  map: Map<string, UserRecord>,
  signals: ReturnType<typeof pageSignals>,
  pageName: string | null,
): string | null {
  if (!pageName && !signals.location && !signals.basedIn && !signals.connectedVia) {
    return null;
  }
  const author = mergeAuthor(findAuthor(map, null, pageName), {
    screenName: pageName,
    location: signals.location,
    basedIn: signals.basedIn,
    connectedVia: signals.connectedVia,
  });
  if (author) rememberAuthor(author);
  return tweetMatchReason(emptyTweet(), author, settings, index);
}

function applyCardList(
  cards: HTMLElement[],
  map: Map<string, UserRecord>,
  signals: ReturnType<typeof pageSignals>,
  pageName: string | null,
  full: boolean,
): number {
  const zones = measureCardZones(cards);
  let marked = 0;
  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i]!;
    try {
      if (!full && !settings.markOnly && card.hasAttribute(HIDE_ATTR)) {
        marked += 1;
        continue;
      }
      const reason = actionReason(reasonForCard(card, map, signals, pageName), settings);
      applyCardAction(card, reason, settings.markOnly, zones[i]);
      if (reason) marked += 1;
    } catch {
      // fail open
    }
  }
  return marked;
}

function apply(): void {
  const full = forceFull;
  forceFull = false;
  const map = usersMap();
  const signals = signalsForApply(full);
  const pageName = pageHandle();
  const header = findProfileIdentity(document);
  const articles = findTweetArticles(document);
  const rows = location.pathname.includes("/notifications")
    ? findNotificationRows(document)
    : [];
  const snaps = settings.markOnly
    ? []
    : snapshotAboveFold([...(header ? [header] : []), ...articles, ...rows]);
  if (header && full) {
    try {
      const reason = actionReason(profileReason(map, signals, pageName), settings);
      applyCardMark(header, reason, true);
    } catch {
      // fail open
    }
  }
  applyCardList(articles, map, signals, pageName, full);
  if (rows.length) applyCardList(rows, map, signals, pageName, full);
  if (!settings.markOnly) restoreScrollAfterHide(snaps);
  document.getElementById("xcb-status-hud")?.remove();
  reportBadge(document.querySelectorAll(`[${HIDE_ATTR}]`).length);
}

function reportBadge(count: number): void {
  try {
    chrome.runtime.sendMessage({ type: BADGE_MSG, count });
  } catch {
    // no background
  }
}

function onMessage(event: MessageEvent): void {
  const data = event.data as Partial<HookMessage> | undefined;
  if (
    !data ||
    data.source !== HOOK_SOURCE ||
    data.type !== "graphql" ||
    !Array.isArray(data.users) ||
    !Array.isArray(data.tweets)
  ) {
    return;
  }
  for (const user of data.users) users.put(user);
  for (const tweet of data.tweets) putTweet(tweet);
  invalidateUsersMap();
  persistUsers();
  requestApply();
}

let applying = false;
let applyDirty = false;
const observer = new MutationObserver(() => requestApply());

function requestApply(): void {
  if (applying) {
    applyDirty = true;
    return;
  }
  applying = true;
  observer.disconnect();
  try {
    do {
      applyDirty = false;
      apply();
    } while (applyDirty);
  } catch {
    // fail open — never break x.com
  } finally {
    applying = false;
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
}

window.addEventListener("message", onMessage);
window.addEventListener("scroll", () => requestApply(), { passive: true, capture: true });
observer.observe(document.documentElement, { childList: true, subtree: true });
void load().then(() => {
  const area = storage();
  area?.onChanged.addListener((changes) => {
    if (
      changes.hiddenCountryCodes ||
      changes.hiddenLanguageCodes ||
      changes.hiddenRegionIds ||
      changes.markOnly ||
      changes.filterMode ||
      changes.onlyShowPaid ||
      changes.trialStartedAt ||
      changes.onlyShowUnlocked
    ) {
      void load().then(requestApply);
    }
  });
  requestApply();
});
