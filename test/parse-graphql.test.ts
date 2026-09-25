import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { defaultCountryIndex } from "../src/shared/countries.ts";
import { shouldHideTweet } from "../src/shared/match.ts";
import { parseGraphQL } from "../src/shared/parse-graphql.ts";
import { parseSettings } from "../src/shared/settings.ts";

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
      locationAccurate: null,
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

  it("should read 2026 tweets when legacy is null", () => {
    const parsed = parseGraphQL({
      data: {
        result: {
          __typename: "Tweet",
          rest_id: "2026",
          lang: "hi",
          user_id_str: "u-2026",
          legacy: null,
          core: {
            user_results: {
              result: {
                __typename: "User",
                rest_id: "u-2026",
                legacy: null,
                core: { screen_name: "rahul" },
                location: { location: "Mumbai, India" },
              },
            },
          },
        },
      },
    });
    expect(parsed.tweets[0]?.tweetId).toBe("2026");
    expect(parsed.tweets[0]?.lang).toBe("hi");
    expect(parsed.tweets[0]?.authorId).toBe("u-2026");
    expect(parsed.users[0]).toMatchObject({
      userId: "u-2026",
      screenName: "rahul",
      location: "Mumbai, India",
    });
    expect(
      shouldHideTweet(
        parsed.tweets[0]!,
        parsed.users[0],
        { ...parseSettings(undefined), hiddenCountryCodes: ["IN"] },
        defaultCountryIndex(),
      ),
    ).toBe(true);
  });

  it("should read 2026 location country_code as based-in", () => {
    const parsed = parseGraphQL({
      result: {
        __typename: "User",
        rest_id: "u-ng",
        core: { screen_name: "ada" },
        location: { location: "", country_code: "NG", country: "Nigeria" },
      },
    });
    expect(parsed.users[0]?.basedIn).toBe("Nigeria");
    // Present but blank means the account has no location now: "" so it can replace a cached one.
    expect(parsed.users[0]?.location).toBe("");
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

function userResult(id: string, screenName: string, location: string) {
  return {
    user_results: {
      result: { __typename: "User", rest_id: id, core: { screen_name: screenName }, location: { location } },
    },
  };
}

describe("parseGraphQL quotes by reference (F14)", () => {
  it("reads quotedRefResult and keeps the quoted tweet from the same response", () => {
    const parsed = parseGraphQL({
      data: {
        entries: [
          {
            __typename: "Tweet",
            rest_id: "222",
            core: userResult("20", "ada", "Lagos, Nigeria"),
            legacy: { lang: "en" },
          },
          {
            __typename: "Tweet",
            rest_id: "111",
            core: userResult("10", "alice", "Austin, TX"),
            legacy: { lang: "en" },
            quotedRefResult: { result: { __typename: "Tweet", rest_id: "222" } },
          },
        ],
      },
    });
    const outer = parsed.tweets.find((t) => t.tweetId === "111");
    expect(outer?.quotedId).toBe("222");
    expect(outer?.quoted?.authorId).toBe("20");
  });

  it("reads legacy.quoted_status_id_str", () => {
    const parsed = parseGraphQL({
      __typename: "Tweet",
      rest_id: "111",
      legacy: { lang: "en", quoted_status_id_str: "333", user_id_str: "10" },
    });
    expect(parsed.tweets[0]?.quotedId).toBe("333");
    expect(parsed.tweets[0]?.quoted).toBeNull();
  });

  it("reads the quoted id through a visibility wrapper", () => {
    const parsed = parseGraphQL({
      __typename: "Tweet",
      rest_id: "111",
      legacy: { lang: "en" },
      quoted_status_result: {
        result: {
          __typename: "TweetWithVisibilityResults",
          tweet: { __typename: "Tweet", rest_id: "444", legacy: { lang: "fr" }, core: userResult("40", "zoe", "Paris") },
        },
      },
    });
    const outer = parsed.tweets.find((t) => t.tweetId === "111");
    expect(outer?.quotedId).toBe("444");
    expect(outer?.quoted?.lang).toBe("fr");
  });

  it("does not emit bare reference stubs as tweet records (F46)", () => {
    const parsed = parseGraphQL({
      __typename: "Tweet",
      rest_id: "111",
      legacy: { lang: "en" },
      quotedRefResult: { result: { __typename: "Tweet", rest_id: "222" } },
    });
    expect(parsed.tweets.map((t) => t.tweetId)).toEqual(["111"]);
  });

  it("records the retweeted id", () => {
    const parsed = parseGraphQL({
      __typename: "Tweet",
      rest_id: "900",
      legacy: {
        lang: "en",
        retweeted_status_result: {
          result: { __typename: "Tweet", rest_id: "500", legacy: { lang: "en" }, core: userResult("5", "us", "Ohio") },
        },
      },
    });
    expect(parsed.tweets.find((t) => t.tweetId === "900")?.retweetedId).toBe("500");
  });
});

describe("parseGraphQL ids (F48)", () => {
  it("decodes a base64 node id to the numeric user id", () => {
    const parsed = parseGraphQL({
      __typename: "User",
      id: "VXNlcjo0NDE5NjM5Nw==",
      core: { screen_name: "someone" },
      about_profile: { account_based_in: "United States" },
    });
    expect(parsed.users[0]?.userId).toBe("44196397");
    expect(parsed.users[0]?.basedIn).toBe("United States");
  });

  it("ignores node ids of the wrong kind and non-numeric ids", () => {
    const tweetNodeId = btoa("Tweet:123");
    expect(parseGraphQL({ __typename: "User", id: tweetNodeId, core: { screen_name: "x" } }).users).toEqual([]);
    expect(parseGraphQL({ __typename: "User", id: "not-an-id", core: { screen_name: "x" } }).users).toEqual([]);
    expect(parseGraphQL({ __typename: "User", id: "12345", core: { screen_name: "x" } }).users[0]?.userId).toBe(
      "12345",
    );
  });
});

describe("parseGraphQL location fields", () => {
  it("returns an empty location when X sends it blank (F13)", () => {
    const legacy = parseGraphQL({ __typename: "User", rest_id: "1", legacy: { screen_name: "a", location: "" } });
    expect(legacy.users[0]?.location).toBe("");
    const absent = parseGraphQL({ __typename: "User", rest_id: "1", legacy: { screen_name: "a" } });
    expect(absent.users[0]?.location).toBeNull();
  });

  it("keeps about_profile.location_accurate (F47)", () => {
    const parsed = parseGraphQL({
      __typename: "User",
      rest_id: "9",
      core: { screen_name: "vpn" },
      location: { location: "Toronto, Canada" },
      about_profile: { account_based_in: "Nigeria", location_accurate: false, source: "Canada App Store" },
    });
    expect(parsed.users[0]).toMatchObject({ basedIn: "Nigeria", locationAccurate: false });
    const accurate = parseGraphQL({
      __typename: "User",
      rest_id: "9",
      about_profile: { account_based_in: "Canada", location_accurate: true },
    });
    expect(accurate.users[0]?.locationAccurate).toBe(true);
  });
});

describe("parseGraphQL resilience (F50)", () => {
  it("keeps the other records when one record throws", () => {
    const bad = {
      __typename: "Tweet",
      rest_id: "2",
      get legacy(): never {
        throw new Error("boom");
      },
    };
    const parsed = parseGraphQL({
      entries: [bad, { __typename: "Tweet", rest_id: "1", legacy: { lang: "en" }, core: userResult("10", "a", "Oslo") }],
    });
    expect(parsed.tweets.map((t) => t.tweetId)).toEqual(["1"]);
    expect(parsed.users.map((u) => u.userId)).toEqual(["10"]);
  });

  it("stops at a sane depth instead of overflowing the stack", () => {
    let deep: Record<string, unknown> = { __typename: "Tweet", rest_id: "7", legacy: { lang: "en" } };
    for (let i = 0; i < 20_000; i += 1) deep = { child: deep };
    const parsed = parseGraphQL({
      top: { __typename: "Tweet", rest_id: "1", legacy: { lang: "en" } },
      deep,
    });
    expect(parsed.tweets.map((t) => t.tweetId)).toEqual(["1"]);
  });
});
