import { describe, expect, it } from "vitest";
import { mergeTweet, TweetStore } from "../src/content/tweet-store.ts";
import type { TweetRecord } from "../src/shared/types.ts";

function tweet(partial: Partial<TweetRecord> & Pick<TweetRecord, "tweetId">): TweetRecord {
  return { lang: null, authorId: null, place: null, quoted: null, retweeted: null, ...partial };
}

describe("mergeTweet (F46)", () => {
  it("keeps what an earlier sighting carried when a later one is sparser", () => {
    const home = tweet({
      tweetId: "111",
      lang: "en",
      authorId: "7",
      place: "Lagos",
      quoted: tweet({ tweetId: "222", authorId: "9" }),
    });
    const detail = tweet({ tweetId: "111", lang: "en", quotedId: "222" });
    const merged = mergeTweet(home, detail);
    expect(merged.authorId).toBe("7");
    expect(merged.place).toBe("Lagos");
    expect(merged.quoted?.authorId).toBe("9");
    expect(merged.quotedId).toBe("222");
  });

  it("lets new values win", () => {
    const merged = mergeTweet(tweet({ tweetId: "1", lang: "en" }), tweet({ tweetId: "1", lang: "pt" }));
    expect(merged.lang).toBe("pt");
  });

  it("merges nested records instead of replacing them with a stub", () => {
    const prev = tweet({ tweetId: "1", retweeted: tweet({ tweetId: "2", authorId: "9", lang: "hi" }) });
    const next = tweet({ tweetId: "1", retweeted: tweet({ tweetId: "2" }) });
    expect(mergeTweet(prev, next).retweeted).toMatchObject({ tweetId: "2", authorId: "9", lang: "hi" });
    expect(mergeTweet(prev, next).retweetedId).toBe("2");
  });

  it("does not keep nesting deeper than two levels", () => {
    const deep = tweet({
      tweetId: "1",
      quoted: tweet({ tweetId: "2", quoted: tweet({ tweetId: "3", quoted: tweet({ tweetId: "4" }) }) }),
    });
    const merged = mergeTweet(undefined, deep);
    expect(merged.quoted?.quoted).toBeNull();
    expect(merged.quoted?.quotedId).toBe("3");
  });
});

describe("TweetStore", () => {
  it("merges across responses and evicts the least recently seen", () => {
    const store = new TweetStore(2);
    store.put(tweet({ tweetId: "1", authorId: "7" }));
    store.put(tweet({ tweetId: "2" }));
    store.put(tweet({ tweetId: "1", lang: "en" }));
    store.put(tweet({ tweetId: "3" }));
    expect(store.get("2")).toBeUndefined();
    expect(store.get("1")).toMatchObject({ authorId: "7", lang: "en" });
    expect(store.size).toBe(2);
  });
});
