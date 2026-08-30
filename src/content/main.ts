import { UserCache } from "../shared/cache.ts";
import { defaultCountryIndex } from "../shared/countries.ts";
import {
  findNotificationRows,
  findTweetArticles,
  setArticleHidden,
  tweetIdFromArticle,
} from "../shared/hide-dom.ts";
import { shouldHideCard } from "../shared/match.ts";
import { parseSettings } from "../shared/settings.ts";
import type { HookMessage, Settings, TweetRecord, UserRecord } from "../shared/types.ts";

const index = defaultCountryIndex();
const tweets = new Map<string, TweetRecord>();
const users = new UserCache(10_000);
let settings: Settings = parseSettings(undefined);
let persistTimer: number | undefined;

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
  const raw = await area.get(["hiddenCountryCodes", "hiddenLanguageCodes", "userCache"]);
  settings = parseSettings(raw);
  if (Array.isArray(raw.userCache)) users.load(raw.userCache as UserRecord[]);
}

function schedulePersist(): void {
  if (persistTimer) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    const area = storage();
    if (!area) return;
    void area.set({ userCache: users.dump() });
  }, 1000);
}

function usersMap(): Map<string, UserRecord> {
  const map = new Map<string, UserRecord>();
  for (const row of users.dump()) map.set(row.userId, row);
  return map;
}

function apply(): void {
  const map = usersMap();
  for (const article of findTweetArticles(document)) {
    const id = tweetIdFromArticle(article);
    if (!id) continue;
    const tweet = tweets.get(id);
    const hide = tweet ? shouldHideCard(tweet, map, settings, index) : false;
    setArticleHidden(article, hide);
  }
  for (const row of findNotificationRows(document)) {
    const id = tweetIdFromArticle(row);
    if (!id) continue;
    const tweet = tweets.get(id);
    setArticleHidden(row, tweet ? shouldHideCard(tweet, map, settings, index) : false);
  }
}

function onMessage(event: MessageEvent): void {
  const data = event.data as HookMessage | undefined;
  if (!data || data.source !== "x-country-hide" || data.type !== "graphql") return;
  for (const user of data.users) users.put(user);
  for (const tweet of data.tweets) tweets.set(tweet.tweetId, tweet);
  schedulePersist();
  apply();
}

void load().then(() => {
  window.addEventListener("message", onMessage);
  const observer = new MutationObserver(() => apply());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const area = storage();
  area?.onChanged.addListener((changes) => {
    if (changes.hiddenCountryCodes || changes.hiddenLanguageCodes) {
      void load().then(apply);
    }
  });
  apply();
});
