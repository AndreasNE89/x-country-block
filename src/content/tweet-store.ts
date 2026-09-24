import type { TweetRecord } from "../shared/types.ts";

const NESTED_DEPTH = 2;

function mergeNested(prev: TweetRecord | null, next: TweetRecord | null, depth: number): TweetRecord | null {
  if (depth >= NESTED_DEPTH) return null;
  if (!next) return prev ? trim(prev, depth) : null;
  return mergeTweetAt(prev ?? undefined, next, depth);
}

function trim(tweet: TweetRecord, depth: number): TweetRecord {
  return {
    ...tweet,
    quoted: mergeNested(null, tweet.quoted, depth + 1),
    retweeted: mergeNested(null, tweet.retweeted, depth + 1),
  };
}

function mergeTweetAt(prev: TweetRecord | undefined, next: TweetRecord, depth: number): TweetRecord {
  return {
    tweetId: next.tweetId,
    lang: next.lang ?? prev?.lang ?? null,
    authorId: next.authorId ?? prev?.authorId ?? null,
    place: next.place ?? prev?.place ?? null,
    quoted: mergeNested(prev?.quoted ?? null, next.quoted, depth + 1),
    retweeted: mergeNested(prev?.retweeted ?? null, next.retweeted, depth + 1),
    quotedId: next.quotedId ?? prev?.quotedId ?? next.quoted?.tweetId ?? prev?.quoted?.tweetId ?? null,
    retweetedId:
      next.retweetedId ?? prev?.retweetedId ?? next.retweeted?.tweetId ?? prev?.retweeted?.tweetId ?? null,
  };
}

/**
 * Merge a later sighting of a tweet into what is known: a sparser payload (no author, no quote
 * link, no place) never erases what an earlier one carried.
 */
export function mergeTweet(prev: TweetRecord | undefined, next: TweetRecord): TweetRecord {
  return mergeTweetAt(prev, next, 0);
}

/** Tweets seen in X's responses, merged across responses, least recently seen evicted first. */
export class TweetStore {
  private readonly rows = new Map<string, TweetRecord>();

  constructor(private readonly limit: number) {}

  get size(): number {
    return this.rows.size;
  }

  get(id: string): TweetRecord | undefined {
    return this.rows.get(id);
  }

  put(tweet: TweetRecord): TweetRecord {
    const merged = mergeTweet(this.rows.get(tweet.tweetId), tweet);
    this.rows.delete(tweet.tweetId);
    this.rows.set(tweet.tweetId, merged);
    while (this.rows.size > this.limit) {
      const oldest = this.rows.keys().next();
      if (oldest.done) break;
      this.rows.delete(oldest.value);
    }
    return merged;
  }
}
