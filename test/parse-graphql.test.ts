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
    expect(lagos?.connectedVia).toBeNull();
  });

  it("should read AboutAccount about_profile based-in and connected-via", () => {
    const parsed = parseGraphQL({
      data: {
        user_result_by_screen_name: {
          result: {
            __typename: "User",
            rest_id: "u-india",
            legacy: {
              screen_name: "santoshkvkd",
              location: "Jabalpur, India",
            },
            about_profile: {
              account_based_in: "India",
              source: "India Android App",
            },
          },
        },
      },
    });
    const user = parsed.users.find((row) => row.userId === "u-india");
    expect(user?.location).toBe("Jabalpur, India");
    expect(user?.screenName).toBe("santoshkvkd");
    expect(user?.basedIn).toBe("India");
    expect(user?.connectedVia).toBe("India Android App");
  });

  it("should treat a rest_id plus about_profile blob as a user", () => {
    const parsed = parseGraphQL({
      result: {
        rest_id: "u-about",
        about_profile: {
          account_based_in: "India",
          source: "India Android App",
        },
      },
    });
    expect(parsed.users[0]).toEqual({
      userId: "u-about",
      screenName: null,
      location: null,
      basedIn: "India",
      connectedVia: "India Android App",
      lang: null,
    });
  });

  it("should read tweet place country from legacy.place", () => {
    const parsed = parseGraphQL({
      result: {
        __typename: "Tweet",
        rest_id: "999",
        legacy: {
          lang: "en",
          place: { country: "India", full_name: "Jabalpur, India" },
        },
      },
    });
    expect(parsed.tweets[0]?.place).toBe("India");
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
