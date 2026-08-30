import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseGraphQL } from "../src/shared/parse-graphql.ts";

const fixture = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/timeline-tweet.json"), "utf8"),
);

describe("parseGraphQL", () => {
  it("returns empty on junk", () => {
    expect(parseGraphQL(null)).toEqual({ tweets: [], users: [] });
    expect(parseGraphQL("nope")).toEqual({ tweets: [], users: [] });
    expect(parseGraphQL({ foo: 1 })).toEqual({ tweets: [], users: [] });
  });

  it("extracts tweets, quote, users, location, and based-in", () => {
    const parsed = parseGraphQL(fixture);
    const ids = parsed.tweets.map((t) => t.tweetId).sort();
    expect(ids).toEqual(["111", "222"]);
    const outer = parsed.tweets.find((t) => t.tweetId === "111");
    expect(outer?.lang).toBe("en");
    expect(outer?.authorId).toBe("u-outer");
    expect(outer?.quoted?.tweetId).toBe("222");
    const london = parsed.users.find((u) => u.userId === "u-outer");
    expect(london?.location).toBe("London, UK");
    const lagos = parsed.users.find((u) => u.userId === "u-inner");
    expect(lagos?.location).toBe("Lagos");
    expect(lagos?.basedIn).toBe("Nigeria");
  });

  it("unwraps TweetWithVisibilityResults", () => {
    const parsed = parseGraphQL({
      result: {
        __typename: "TweetWithVisibilityResults",
        tweet: {
          __typename: "Tweet",
          rest_id: "333",
          legacy: { lang: "fr", full_text: "bonjour", created_at: "x" },
          core: {
            user_results: {
              result: {
                __typename: "User",
                rest_id: "u-fr",
                legacy: { location: "Paris", lang: "fr" },
              },
            },
          },
        },
      },
    });
    expect(parsed.tweets[0]?.tweetId).toBe("333");
    expect(parsed.tweets[0]?.lang).toBe("fr");
    expect(parsed.users[0]?.userId).toBe("u-fr");
  });

  it("should unwrap a retweeted status and retain its original author", () => {
    const parsed = parseGraphQL({
      result: {
        __typename: "Tweet",
        rest_id: "444",
        legacy: {
          lang: "en",
          retweeted_status_result: {
            result: {
              __typename: "TweetWithVisibilityResults",
              tweet: {
                __typename: "Tweet",
                rest_id: "555",
                legacy: { lang: "ja" },
                core: {
                  user_results: {
                    result: {
                      __typename: "User",
                      rest_id: "u-original",
                      legacy: { screen_name: "original", location: "Tokyo" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const outer = parsed.tweets.find((tweet) => tweet.tweetId === "444");
    expect(outer?.retweeted?.tweetId).toBe("555");
    expect(outer?.retweeted?.authorId).toBe("u-original");
  });
});
