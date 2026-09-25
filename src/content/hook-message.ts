import { HOOK_SOURCE, HOOK_VERSION, type TweetRecord, type UserRecord } from "../shared/types.ts";
import { sanitizeList, sanitizeTweet, sanitizeUser } from "./records.ts";

/** More records than one X GraphQL page carries; anything past this is dropped. */
export const MAX_RECORDS = 400;

export type HookData = { users: UserRecord[]; tweets: TweetRecord[] };

type MessageLike = Pick<MessageEvent, "data" | "origin" | "source">;

/**
 * Accept a record batch from the MAIN-world hook. Only messages this window posted to itself are
 * read (child frames such as embeds and login iframes cannot inject records), and every record is
 * shape-checked and capped.
 */
export function readHookMessage(event: MessageLike, win: Window): HookData | null {
  if (event.source !== win || event.origin !== win.location.origin) return null;
  const data: unknown = event.data;
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (obj.source !== HOOK_SOURCE || obj.type !== "graphql" || obj.v !== HOOK_VERSION) return null;
  if (!Array.isArray(obj.users) || !Array.isArray(obj.tweets)) return null;
  const users = sanitizeList(obj.users, sanitizeUser, MAX_RECORDS);
  const tweets = sanitizeList(obj.tweets, (row) => sanitizeTweet(row), MAX_RECORDS);
  if (users.length === 0 && tweets.length === 0) return null;
  return { users, tweets };
}
